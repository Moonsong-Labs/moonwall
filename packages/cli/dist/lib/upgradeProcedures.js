// src/lib/upgradeProcedures.ts
import "@moonbeam-network/api-augment";
import { blake2AsHex as blake2AsHex2 } from "@polkadot/util-crypto";
import chalk from "chalk";
import { sha256 } from "ethers";
import fs2, { existsSync, readFileSync } from "fs";

// src/lib/binariesHelpers.ts
import "@moonbeam-network/api-augment";
import path from "path";
import fs from "fs";
import child_process from "child_process";
import { OVERRIDE_RUNTIME_PATH } from "@moonwall/util";
var BINARY_DIRECTORY = process.env.BINARY_DIRECTORY || "binaries";
var RUNTIME_DIRECTORY = process.env.RUNTIME_DIRECTORY || "runtimes";
var SPECS_DIRECTORY = process.env.SPECS_DIRECTORY || "specs";
async function getRuntimeWasm(runtimeName, runtimeTag, localPath) {
  const runtimePath = path.join(RUNTIME_DIRECTORY, `${runtimeName}-${runtimeTag}.wasm`);
  if (!fs.existsSync(RUNTIME_DIRECTORY)) {
    fs.mkdirSync(RUNTIME_DIRECTORY, { recursive: true });
  }
  if (runtimeTag === "local") {
    const builtRuntimePath = localPath
      ? localPath
      : path.join(
          OVERRIDE_RUNTIME_PATH || `../target/release/wbuild/${runtimeName}-runtime/`,
          `${runtimeName}_runtime.compact.compressed.wasm`
        );
    const code = fs.readFileSync(builtRuntimePath);
    fs.writeFileSync(runtimePath, `0x${code.toString("hex")}`);
  } else if (!fs.existsSync(runtimePath)) {
    console.log(`     Missing ${runtimePath} locally, downloading it...`);
    child_process.execSync(
      `mkdir -p ${path.dirname(
        runtimePath
      )} && wget -q https://github.com/PureStake/moonbeam/releases/download/${runtimeTag}/${runtimeName}-${runtimeTag}.wasm -O ${runtimePath}.bin`
    );
    const code = fs.readFileSync(`${runtimePath}.bin`);
    fs.writeFileSync(runtimePath, `0x${code.toString("hex")}`);
    console.log(`${runtimePath} downloaded !`);
  }
  return runtimePath;
}

// src/lib/governanceProcedures.ts
import "@moonbeam-network/api-augment";
import {
  GLMR,
  alith,
  baltathar,
  charleth,
  dorothy,
  ethan,
  faith,
  filterAndApply,
  signAndSend,
} from "@moonwall/util";
import { blake2AsHex } from "@polkadot/util-crypto";
var COUNCIL_MEMBERS = [baltathar, charleth, dorothy];
var COUNCIL_THRESHOLD = Math.ceil((COUNCIL_MEMBERS.length * 2) / 3);
var TECHNICAL_COMMITTEE_MEMBERS = [alith, baltathar];
var TECHNICAL_COMMITTEE_THRESHOLD = Math.ceil((TECHNICAL_COMMITTEE_MEMBERS.length * 2) / 3);
var OPEN_TECHNICAL_COMMITTEE_MEMBERS = [alith, baltathar];
var OPEN_TECHNICAL_COMMITTEE_THRESHOLD = Math.ceil(
  (OPEN_TECHNICAL_COMMITTEE_MEMBERS.length * 2) / 3
);
var executeOpenTechCommitteeProposal = async (api, encodedHash) => {
  console.log("Executing OpenTechCommittee proposal");
  const queryPreimage = await api.query.preimage.requestStatusFor(encodedHash);
  if (queryPreimage.isNone) {
    throw new Error("Preimage not found");
  }
  process.stdout.write(`Sending proposal + vote for ${encodedHash}...`);
  const proposalLen = queryPreimage.unwrap().asUnrequested.len;
  const dispatchCallHex = api.tx.whitelist
    .dispatchWhitelistedCall(encodedHash, proposalLen, {
      refTime: 2e9,
      proofSize: 1e5,
    })
    .method.toHex();
  const dispatchCallPreimageHash = blake2AsHex(dispatchCallHex);
  await signAndSend(api.tx.preimage.notePreimage(dispatchCallHex), charleth);
  const queryDispatchPreimage = await api.query.preimage.requestStatusFor(dispatchCallPreimageHash);
  if (queryDispatchPreimage.isNone) {
    throw new Error("Dispatch preimage not found");
  }
  const dispatchCallPreimageLen = queryDispatchPreimage.unwrap().asUnrequested.len;
  await signAndSend(
    api.tx.referenda.submit(
      {
        Origins: { whitelistedcaller: "WhitelistedCaller" },
      },
      {
        Lookup: {
          hash: dispatchCallPreimageHash,
          len: dispatchCallPreimageLen,
        },
      },
      { After: { After: 0 } }
    ),
    charleth
  );
  const proposalId = (await api.query.referenda.referendumCount()).toNumber() - 1;
  if (proposalId < 0) {
    throw new Error("Proposal id not found");
  }
  await api.tx.referenda.placeDecisionDeposit(proposalId).signAndSend(alith);
  process.stdout.write(`Sending proposal to openTechCommittee to whitelist ${encodedHash}...`);
  await signAndSend(
    api.tx.openTechCommitteeCollective.propose(2, api.tx.whitelist.whitelistCall(encodedHash), 100)
  );
  const openTechProposal = (await api.query.openTechCommitteeCollective.proposals()).at(-1);
  if (!openTechProposal || openTechProposal?.isEmpty) {
    throw new Error("OpenTechProposal not found");
  }
  const index = (await api.query.openTechCommitteeCollective.proposalCount()).toNumber() - 1;
  if (index < 0) {
    throw new Error("OpenTechProposal index not found");
  }
  process.stdout.write("\u2705\n");
  const baltaNonce = (await api.rpc.system.accountNextIndex(baltathar.address)).toNumber();
  process.stdout.write("Voting on openTechCommittee proposal...");
  await Promise.all([
    signAndSend(api.tx.openTechCommitteeCollective.vote(openTechProposal, index, true)),
    signAndSend(
      api.tx.openTechCommitteeCollective.vote(openTechProposal, index, true),
      baltathar,
      baltaNonce
    ),
    signAndSend(
      api.tx.openTechCommitteeCollective.close(
        openTechProposal,
        index,
        {
          refTime: 2e9,
          proofSize: 1e5,
        },
        100
      ),
      baltathar,
      baltaNonce + 1
    ),
  ]);
  process.stdout.write("\u2705\n");
  process.stdout.write("Voting on main referendum proposal...");
  const bal = (await api.query.system.account(dorothy.address)).data.free.toBigInt();
  if (bal <= GLMR) {
    throw new Error("Dorothy has no funds to vote with");
  }
  await signAndSend(
    api.tx.convictionVoting.vote(proposalId, {
      Standard: {
        vote: { aye: true, conviction: "Locked6x" },
        balance: bal - GLMR,
      },
    }),
    dorothy
  );
  process.stdout.write("\u2705\n");
  process.stdout.write(`Waiting for referendum [${proposalId}] to be no longer ongoing...`);
  let referendaInfo;
  for (;;) {
    try {
      referendaInfo = (await api.query.referenda.referendumInfoFor(proposalId)).unwrap();
      if (!referendaInfo.isOngoing) {
        process.stdout.write("\u2705\n");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    } catch (e) {
      console.error(e);
      throw new Error(`Error querying referendum info for proposalId: ${proposalId}`);
    }
  }
  process.stdout.write(`${referendaInfo.isApproved ? "\u2705" : "\u274C"} 
`);
  if (!referendaInfo.isApproved) {
    throw new Error("Finished Referendum was not approved");
  }
};
var executeProposalWithCouncil = async (api, encodedHash) => {
  let nonce = (await api.rpc.system.accountNextIndex(alith.address)).toNumber();
  const referendumNextIndex = (await api.query.democracy.referendumCount()).toNumber();
  const callData =
    api.consts.system.version.specVersion.toNumber() >= 2e3 ? { Legacy: encodedHash } : encodedHash;
  const external = api.tx.democracy.externalProposeMajority(callData);
  const fastTrack = api.tx.democracy.fastTrack(encodedHash, 1, 0);
  const voteAmount = 1n * 10n ** BigInt(api.registry.chainDecimals[0]);
  process.stdout.write(`Sending motion + fast-track + vote for ${encodedHash}...`);
  await Promise.all([
    api.tx.councilCollective
      .propose(1, external, external.length)
      .signAndSend(alith, { nonce: nonce++ }),
    api.tx.techCommitteeCollective
      .propose(1, fastTrack, fastTrack.length)
      .signAndSend(alith, { nonce: nonce++ }),
    api.tx.democracy
      .vote(referendumNextIndex, {
        Standard: {
          balance: voteAmount,
          vote: { aye: true, conviction: 1 },
        },
      })
      .signAndSend(alith, { nonce: nonce++ }),
  ]);
  process.stdout.write("\u2705\n");
  process.stdout.write(`Waiting for referendum [${referendumNextIndex}] to be executed...`);
  let referenda;
  while (!referenda) {
    try {
      referenda = (
        (await api.query.democracy.referendumInfoOf.entries()).find(
          (ref) =>
            ref[1].unwrap().isFinished &&
            api.registry.createType("u32", ref[0].toU8a().slice(-4)).toNumber() ===
              referendumNextIndex
        )?.[1]
      ).unwrap();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
  }
  process.stdout.write(`${referenda.asFinished.approved ? "\u2705" : "\u274C"} 
`);
  if (!referenda.asFinished.approved) {
    throw new Error("Finished Referendum was not approved");
  }
};
var cancelReferendaWithCouncil = async (api, refIndex) => {
  const proposal = api.tx.democracy.cancelReferendum(refIndex);
  const encodedProposal = proposal.method.toHex();
  const encodedHash = blake2AsHex(encodedProposal);
  let nonce = (await api.rpc.system.accountNextIndex(alith.address)).toNumber();
  await api.tx.democracy.notePreimage(encodedProposal).signAndSend(alith, { nonce: nonce++ });
  await executeProposalWithCouncil(api, encodedHash);
};

// src/lib/upgradeProcedures.ts
async function upgradeRuntimeChopsticks(context, path2, providerName) {
  if (!existsSync(path2)) {
    throw new Error(`Runtime wasm not found at path: ${path2}`);
  }
  const rtWasm = readFileSync(path2);
  const rtHex = `0x${rtWasm.toString("hex")}`;
  const rtHash = blake2AsHex2(rtHex);
  const api = context.polkadotJs(providerName);
  const signer = context.keyring.alice;
  if ("authorizedUpgrade" in api.query.system) {
    await context.setStorage({
      providerName,
      module: "system",
      method: "authorizedUpgrade",
      methodParams: `${rtHash}01`,
      // 01 is for the RT ver check = true
    });
    await context.createBlock({ providerName });
    await api.tx.system.applyAuthorizedUpgrade(rtHex).signAndSend(signer);
  } else {
    await context.setStorage({
      providerName,
      module: "parachainSystem",
      method: "authorizedUpgrade",
      methodParams: `${rtHash}01`,
      // 01 is for the RT ver check = true
    });
    await context.createBlock({ providerName });
    await api.tx.parachainSystem.enactAuthorizedUpgrade(rtHex).signAndSend(signer);
  }
  await context.createBlock({ providerName, count: 3 });
}
async function upgradeRuntime(api, preferences) {
  const options = {
    waitMigration: true,
    upgradeMethod: "Sudo",
    ...preferences,
  };
  return new Promise(async (resolve, reject) => {
    const log = (text) => {
      if (options.logger) {
        if (typeof options.logger === "function") {
          return options.logger(text);
        }
        if (typeof options.logger.info === "function") {
          return options.logger.info(text);
        }
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
      const code = fs2
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
          `Runtime upgrade with same code: ${existingCode.toString().slice(0, 20)} vs ${code.toString().slice(0, 20)}`
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
          const isWeightV1 = !api.registry.createType("Weight").proofSize;
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
          log("\u2705");
          break;
        }
        case "Governance": {
          log("Using governance...");
          const proposal =
            api.consts.system.version.specVersion.toNumber() >= 2400
              ? api.tx.parachainSystem.authorizeUpgrade(blake2AsHex2(code), true)
              : api.tx.parachainSystem.authorizeUpgrade(blake2AsHex2(code));
          const encodedProposal = proposal.method.toHex();
          const encodedHash = blake2AsHex2(encodedProposal);
          log("Checking if preimage already exists...");
          const preImageExists =
            api.query.preimage && (await api.query.preimage.statusFor(encodedHash));
          const democracyPreImageExists =
            !api.query.preimage && (await api.query.democracy.preimages(encodedHash));
          if (api.query.preimage && preImageExists.isSome && preImageExists.unwrap().isRequested) {
            log(`Preimage ${encodedHash} already exists !
`);
          } else if (!api.query.preimage && democracyPreImageExists) {
            log(`Preimage ${encodedHash} already exists !
`);
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
              await api.tx.democracy
                .notePreimage(encodedProposal)
                .signAndSend(options.from, { nonce: nonce++ });
            }
            log("Complete \u2705");
          }
          const referendum = await api.query.democracy.referendumInfoOf.entries();
          const referendaIndex = api.query.preimage
            ? referendum
                .filter(
                  (ref) =>
                    ref[1].unwrap().isOngoing &&
                    ref[1].unwrap().asOngoing.proposal.isLookup &&
                    ref[1].unwrap().asOngoing.proposal.asLookup.hash.toHex() === encodedHash
                )
                .map((ref) =>
                  api.registry.createType("u32", ref[0].toU8a().slice(-4)).toNumber()
                )?.[0]
            : referendum
                .filter(
                  (ref) =>
                    ref[1].unwrap().isOngoing &&
                    ref[1].unwrap().asOngoing.proposalHash.toHex() === encodedHash
                )
                .map((ref) =>
                  api.registry.createType("u32", ref[0].toU8a().slice(-4)).toNumber()
                )?.[0];
          if (referendaIndex !== null && referendaIndex !== void 0) {
            log("Vote for upgrade already in referendum, cancelling it.");
            await cancelReferendaWithCouncil(api, referendaIndex);
          }
          await executeProposalWithCouncil(api, encodedHash);
          nonce = (await api.rpc.system.accountNextIndex(options.from.address)).toNumber();
          log("Enacting authorized upgrade...");
          await api.tx.parachainSystem
            .enactAuthorizedUpgrade(code)
            .signAndSend(options.from, { nonce: nonce++ });
          log("Complete \u2705");
          break;
        }
        case "WhiteListedCaller": {
          log("Using WhiteListed Caller...");
          const proposal = api.tx.parachainSystem.authorizeUpgrade(blake2AsHex2(code), true);
          const encodedProposal = proposal.method.toHex();
          const encodedHash = blake2AsHex2(encodedProposal);
          log("Checking if preimage already exists...");
          const preImageExists =
            api.query.preimage && (await api.query.preimage.statusFor(encodedHash));
          if (preImageExists.isSome && preImageExists.unwrap().isRequested) {
            log(`Preimage ${encodedHash} already exists !
`);
          } else {
            log(
              `Registering preimage (${sha256(Buffer.from(code))} [~${Math.floor(
                code.length / 1024
              )} kb])...`
            );
            await api.tx.preimage
              .notePreimage(encodedProposal)
              .signAndSend(options.from, { nonce: nonce++ });
            log("Complete \u2705");
          }
          const referendum = await api.query.referenda.referendumInfoFor.entries();
          const referendaIndex = referendum
            .filter(
              (ref) =>
                ref[1].unwrap().isOngoing &&
                ref[1].unwrap().asOngoing.proposal.isLookup &&
                ref[1].unwrap().asOngoing.proposal.asLookup.hash.toHex() === encodedHash
            )
            .map((ref) => api.registry.createType("u32", ref[0].toU8a().slice(-4)).toNumber())?.[0];
          await executeOpenTechCommitteeProposal(api, encodedHash);
          break;
        }
      }
      log(`Waiting to apply new runtime (${chalk.red("~4min")})...`);
      let isInitialVersion = true;
      const unsub = await api.rpc.state.subscribeStorage([":code"], async (newCode) => {
        if (!isInitialVersion) {
          const blockNumber = (await api.rpc.chain.getHeader()).number.toNumber();
          log(
            `Complete \u2705 [New Code: ${newCode.toString().slice(0, 5)}...${newCode.toString().slice(-4)} , Old Code:${existingCode.toString().slice(0, 5)}...${existingCode.toString().slice(-4)}] [#${blockNumber}]`
          );
          unsub();
          if (newCode.toString() !== code) {
            reject(
              `Unexpected new code: ${newCode.toString().slice(0, 20)} vs ${code.toString().slice(0, 20)}`
            );
          }
          if (options.waitMigration) {
            const blockToWait = (await api.rpc.chain.getHeader()).number.toNumber() + 1;
            await new Promise(async (resolve2) => {
              const subBlocks = await api.rpc.chain.subscribeNewHeads(async (header) => {
                if (header.number.toNumber() === blockToWait) {
                  subBlocks();
                  resolve2(blockToWait);
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
export { upgradeRuntime, upgradeRuntimeChopsticks };
