import "@moonbeam-network/api-augment";
import fs, { readFileSync, existsSync } from "fs";
import chalk from "chalk";
import type { WeightV2 } from "@polkadot/types/interfaces";
import { ApiPromise } from "@polkadot/api";
import { blake2AsHex } from "@polkadot/util-crypto";
import { sha256 } from "ethers";
import { cancelReferendaWithCouncil, executeProposalWithCouncil } from "./governanceProcedures.js";
import { alith } from "@moonwall/util";
import { ChopsticksContext, UpgradePreferences } from "@moonwall/types";
import { getRuntimeWasm } from "./binariesHelpers.js";

export async function upgradeRuntimeChopsticks(context: ChopsticksContext, path: string) {
  if (!!!existsSync(path)) {
    throw new Error("Runtime wasm not found at path: " + path);
  }
  const rtWasm = readFileSync(path);
  const rtHex = `0x${rtWasm.toString("hex")}`;
  const rtHash = blake2AsHex(rtHex);
  await context.setStorage({
    module: "parachainSystem",
    method: "authorizedUpgrade",
    methodParams: rtHash,
  });
  await context.createBlock();

  const api = context.polkadotJs();

  await api.tx.parachainSystem.enactAuthorizedUpgrade(rtHex).signAndSend(alith);

  await context.createBlock({ count: 3 });
}

export async function upgradeRuntime(api: ApiPromise, preferences: UpgradePreferences) {
  const options = {
    from: alith,
    waitMigration: true,
    useGovernance: false,
    ...preferences,
  };
  return new Promise<number>(async (resolve, reject) => {
    const log = (text: string) => {
      if (options.logger) {
        return options.logger(text);
      } else {
        return;
      }
    };

    try {
      const code = fs
        .readFileSync(
          await getRuntimeWasm(options.runtimeName!, options.runtimeTag!, options.localPath)
        )
        .toString();

      log("Checking if upgrade is needed...");
      const existingCode = await api.rpc.state.getStorage(":code");
      if (existingCode!.toString() == code) {
        reject(
          `Runtime upgrade with same code: ${existingCode!.toString().slice(0, 20)} vs ${code
            .toString()
            .slice(0, 20)}`
        );
      }

      let nonce = (await api.rpc.system.accountNextIndex(options.from.address)).toNumber();

      if (options.useGovernance) {
        log("Using governance...");
        // TODO: remove support for old style after all chains upgraded to 2400+
        let proposal =
          api.consts.system.version.specVersion.toNumber() >= 2400
            ? (api.tx.parachainSystem as any).authorizeUpgrade(blake2AsHex(code), false)
            : (api.tx.parachainSystem as any).authorizeUpgrade(blake2AsHex(code));
        let encodedProposal = proposal.method.toHex();
        let encodedHash = blake2AsHex(encodedProposal);

        log("Checking if preimage already exists...");
        // Check if already in governance
        const preImageExists =
          api.query.preimage && (await api.query.preimage.statusFor(encodedHash));
        const democracyPreImageExists =
          !api.query.preimage && ((await api.query.democracy.preimages(encodedHash)) as any);

        if (api.query.preimage && preImageExists.isSome && preImageExists.unwrap().isRequested) {
          log(`Preimage ${encodedHash} already exists !\n`);
        } else if (!api.query.preimage && democracyPreImageExists) {
          log(`Preimage ${encodedHash} already exists !\n`);
        } else {
          log(
            `Registering preimage (${sha256(Buffer.from(code))} [~${Math.floor(
              code.length / 1024
            )} kb])...`
          );
          if (api.query.preimage) {
            await api.tx.preimage
              .notePreimage(encodedProposal)
              .signAndSend(options.from, { nonce: nonce++ });
          } else {
            // TODO: remove support for democracy after 2000
            await api.tx.democracy
              .notePreimage(encodedProposal)
              .signAndSend(options.from, { nonce: nonce++ });
          }
          log(`Complete ✅`);
        }

        // Check if already in referendum
        const referendum = await api.query.democracy.referendumInfoOf.entries();
        // TODO: remove support for democracy after 2000
        const referendaIndex = api.query.preimage
          ? referendum
              .filter(
                (ref) =>
                  ref[1].unwrap().isOngoing &&
                  ref[1].unwrap().asOngoing.proposal.isLookup &&
                  ref[1].unwrap().asOngoing.proposal.asLookup.hash.toHex() == encodedHash
              )
              .map((ref) =>
                api.registry.createType("u32", ref[0].toU8a().slice(-4)).toNumber()
              )?.[0]
          : referendum
              .filter(
                (ref) =>
                  ref[1].unwrap().isOngoing &&
                  (ref[1].unwrap().asOngoing as any).proposalHash.toHex() == encodedHash
              )
              .map((ref) =>
                api.registry.createType("u32", ref[0].toU8a().slice(-4)).toNumber()
              )?.[0];

        if (referendaIndex !== null && referendaIndex !== undefined) {
          log(`Vote for upgrade already in referendum, cancelling it.`);
          await cancelReferendaWithCouncil(api, referendaIndex);
        }
        await executeProposalWithCouncil(api, encodedHash);

        // Needs to retrieve nonce after those governance calls
        nonce = (await api.rpc.system.accountNextIndex(options.from.address)).toNumber();
        log(`Enacting authorized upgrade...`);
        await api.tx.parachainSystem
          .enactAuthorizedUpgrade(code)
          .signAndSend(options.from, { nonce: nonce++ });
        log(`Complete ✅`);
      } else {
        log(
          `Sending sudo.setCode (${sha256(Buffer.from(code))} [~${Math.floor(
            code.length / 1024
          )} kb])...`
        );
        const isWeightV1 = !api.registry.createType<WeightV2>("Weight").proofSize;
        await api.tx.sudo
          .sudoUncheckedWeight(
            await api.tx.system.setCodeWithoutChecks(code),
            isWeightV1
              ? "1"
              : {
                  proofSize: 1,
                  refTime: 1,
                }
          )
          .signAndSend(options.from, { nonce: nonce++ });
        log(`✅`);
      }

      log(`Waiting to apply new runtime (${chalk.red(`~4min`)})...`);
      let isInitialVersion = true;

      const unsub = await api.rpc.state.subscribeStorage([":code"], async (newCode: any) => {
        if (!isInitialVersion) {
          const blockNumber = (await api.rpc.chain.getHeader()).number.toNumber();
          log(
            `Complete ✅ [New Code: ${newCode.toString().slice(0, 5)}...${newCode
              .toString()
              .slice(-4)} , Old Code:${existingCode!.toString().slice(0, 5)}...${existingCode!
              .toString()
              .slice(-4)}] [#${blockNumber}]`
          );
          unsub();
          if (newCode!.toString() != code) {
            reject(
              `Unexpected new code: ${newCode!.toString().slice(0, 20)} vs ${code
                .toString()
                .slice(0, 20)}`
            );
          }
          if (options.waitMigration) {
            const blockToWait = (await api.rpc.chain.getHeader()).number.toNumber() + 1;
            await new Promise(async (resolve) => {
              const subBlocks = await api.rpc.chain.subscribeNewHeads(async (header) => {
                if (header.number.toNumber() == blockToWait) {
                  subBlocks();
                  resolve(blockToWait);
                }
              });
            });
          }
          resolve(blockNumber);
        }
        isInitialVersion = false;
      });
    } catch (e) {
      console.error(`Failed to setCode`);
      reject(e);
    }
  });
}
