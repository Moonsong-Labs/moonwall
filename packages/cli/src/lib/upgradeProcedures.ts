import "@moonbeam-network/api-augment";
import { ChopsticksContext, UpgradePreferences } from "@moonwall/types";
import type { ApiPromise } from "@polkadot/api";
import type { WeightV2 } from "@polkadot/types/interfaces";
import { blake2AsHex } from "@polkadot/util-crypto";
import chalk from "chalk";
import { sha256 } from "ethers";
import fs, { existsSync, readFileSync } from "fs";
import { getRuntimeWasm } from "./binariesHelpers";
import {
  cancelReferendaWithCouncil,
  executeOpenTechCommitteeProposal,
  executeProposalWithCouncil,
} from "./governanceProcedures";

export async function upgradeRuntimeChopsticks(
  context: ChopsticksContext,
  path: string,
  providerName?: string
) {
  if (!existsSync(path)) {
    throw new Error(`Runtime wasm not found at path: ${path}`);
  }
  const rtWasm = readFileSync(path);
  const rtHex = `0x${rtWasm.toString("hex")}`;
  const rtHash = blake2AsHex(rtHex);
  await context.setStorage({
    providerName,
    module: "parachainSystem",
    method: "authorizedUpgrade",
    methodParams: `${rtHash}01`, // 01 is for the RT ver check = true
  });
  await context.createBlock({ providerName });

  const api = context.polkadotJs(providerName);
  const signer = context.keyring.alice;

  await api.tx.parachainSystem.enactAuthorizedUpgrade(rtHex).signAndSend(signer);

  await context.createBlock({ providerName, count: 3 });
}

export async function upgradeRuntime(api: ApiPromise, preferences: UpgradePreferences) {
  const options: UpgradePreferences = {
    waitMigration: true,
    upgradeMethod: "Sudo",
    ...preferences,
  };

  return new Promise<number>(async (resolve, reject) => {
    const log = (text: string) => {
      if (options.logger) {
        return options.logger(text);
      }
      return;
    };

    if (!options.runtimeName) {
      throw new Error("'runtimeName' is required to upgrade runtime");
    }

    if (!options.runtimeTag) {
      throw new Error("'runtimeTag' is required to upgrade runtime");
    }

    if (!options.from) {
      throw new Error("'from' is required to upgrade runtime");
    }

    try {
      const code = fs
        .readFileSync(
          await getRuntimeWasm(options.runtimeName, options.runtimeTag, options.localPath)
        )
        .toString();

      log("Checking if upgrade is needed...");
      const existingCode = await api.rpc.state.getStorage(":code");

      if (!existingCode) {
        throw "No existing runtime code found";
      }

      if (existingCode.toString() === code) {
        reject(
          `Runtime upgrade with same code: ${existingCode.toString().slice(0, 20)} vs ${code
            .toString()
            .slice(0, 20)}`
        );
      }

      let nonce = (await api.rpc.system.accountNextIndex(options.from.address)).toNumber();

      switch (options.upgradeMethod) {
        case "Sudo": {
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
          log("✅");
          break;
        }

        case "Governance": {
          log("Using governance...");
          // TODO: remove support for old style after all chains upgraded to 2400+
          const proposal =
            api.consts.system.version.specVersion.toNumber() >= 2400
              ? api.tx.parachainSystem.authorizeUpgrade(blake2AsHex(code), true)
              : (api.tx.parachainSystem as any).authorizeUpgrade(blake2AsHex(code));
          const encodedProposal = proposal.method.toHex();
          const encodedHash = blake2AsHex(encodedProposal);

          log("Checking if preimage already exists...");
          // Check if already in governance
          const preImageExists: any =
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
            log("Complete ✅");
          }

          // Check if already in referendum
          const referendum = await api.query.democracy.referendumInfoOf.entries();
          // TODO: remove support for democracy after 2000
          const referendaIndex = api.query.preimage
            ? referendum
                .filter(
                  (ref: any) =>
                    ref[1].unwrap().isOngoing &&
                    ref[1].unwrap().asOngoing.proposal.isLookup &&
                    ref[1].unwrap().asOngoing.proposal.asLookup.hash.toHex() === encodedHash
                )
                .map((ref) =>
                  (api.registry.createType("u32", ref[0].toU8a().slice(-4)) as any).toNumber()
                )?.[0]
            : referendum
                .filter(
                  (ref: any) =>
                    ref[1].unwrap().isOngoing &&
                    (ref[1].unwrap().asOngoing as any).proposalHash.toHex() === encodedHash
                )
                .map((ref) =>
                  (api.registry.createType("u32", ref[0].toU8a().slice(-4)) as any).toNumber()
                )?.[0];

          if (referendaIndex !== null && referendaIndex !== undefined) {
            log("Vote for upgrade already in referendum, cancelling it.");
            await cancelReferendaWithCouncil(api, referendaIndex);
          }
          await executeProposalWithCouncil(api, encodedHash);

          // Needs to retrieve nonce after those governance calls
          nonce = (await api.rpc.system.accountNextIndex(options.from.address)).toNumber();
          log("Enacting authorized upgrade...");
          await api.tx.parachainSystem
            .enactAuthorizedUpgrade(code)
            .signAndSend(options.from, { nonce: nonce++ });
          log("Complete ✅");
          break;
        }

        case "WhiteListedCaller": {
          log("Using WhiteListed Caller...");
          const proposal = api.tx.parachainSystem.authorizeUpgrade(blake2AsHex(code), true);
          const encodedProposal = proposal.method.toHex();
          const encodedHash = blake2AsHex(encodedProposal);

          log("Checking if preimage already exists...");
          const preImageExists =
            api.query.preimage && (await api.query.preimage.statusFor(encodedHash));

          if (preImageExists.isSome && preImageExists.unwrap().isRequested) {
            log(`Preimage ${encodedHash} already exists !\n`);
          } else {
            log(
              `Registering preimage (${sha256(Buffer.from(code))} [~${Math.floor(
                code.length / 1024
              )} kb])...`
            );
            await api.tx.preimage
              .notePreimage(encodedProposal)
              .signAndSend(options.from, { nonce: nonce++ });
            log("Complete ✅");
          }

          const referendum = await api.query.referenda.referendumInfoFor.entries();
          const referendaIndex = referendum
            .filter(
              (ref: any) =>
                ref[1].unwrap().isOngoing &&
                ref[1].unwrap().asOngoing.proposal.isLookup &&
                ref[1].unwrap().asOngoing.proposal.asLookup.hash.toHex() === encodedHash
            )
            .map((ref) =>
              (api.registry.createType("u32", ref[0].toU8a().slice(-4)) as any).toNumber()
            )?.[0];

          await executeOpenTechCommitteeProposal(api, encodedHash);

          break;
        }
      }

      log(`Waiting to apply new runtime (${chalk.red("~4min")})...`);
      let isInitialVersion = true;

      const unsub = await api.rpc.state.subscribeStorage([":code"], async (newCode: any) => {
        if (!isInitialVersion) {
          const blockNumber = (await api.rpc.chain.getHeader()).number.toNumber();
          log(
            `Complete ✅ [New Code: ${newCode.toString().slice(0, 5)}...${newCode
              .toString()
              .slice(-4)} , Old Code:${existingCode.toString().slice(0, 5)}...${existingCode
              .toString()
              .slice(-4)}] [#${blockNumber}]`
          );
          unsub();
          if (newCode.toString() !== code) {
            reject(
              `Unexpected new code: ${newCode.toString().slice(0, 20)} vs ${code
                .toString()
                .slice(0, 20)}`
            );
          }
          if (options.waitMigration) {
            const blockToWait = (await api.rpc.chain.getHeader()).number.toNumber() + 1;
            await new Promise(async (resolve) => {
              const subBlocks = await api.rpc.chain.subscribeNewHeads(async (header) => {
                if (header.number.toNumber() === blockToWait) {
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
      console.error(e);
      console.error("Failed to setCode");
      reject(e);
    }
  });
}
