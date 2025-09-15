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
var notePreimage = async (context, proposal, account = alith) => {
  const encodedProposal = proposal.method.toHex() || "";
  await context.createBlock(
    context.polkadotJs().tx.preimage.notePreimage(encodedProposal).signAsync(account)
  );
  return blake2AsHex(encodedProposal);
};
var instantFastTrack = async (
  context,
  proposal,
  { votingPeriod, delayPeriod } = { votingPeriod: 2, delayPeriod: 0 }
) => {
  const proposalHash =
    typeof proposal === "string" ? proposal : await notePreimage(context, proposal);
  await execCouncilProposal(
    context,
    context.polkadotJs().tx.democracy.externalProposeMajority({
      Lookup: {
        hash: proposalHash,
        len: typeof proposal === "string" ? proposal : proposal.method.encodedLength,
      },
    })
  );
  await execTechnicalCommitteeProposal(
    context,
    context.polkadotJs().tx.democracy.fastTrack(proposalHash, votingPeriod, delayPeriod)
  );
  return proposalHash;
};
var whiteListTrackNoSend = async (context, proposal) => {
  const proposalHash =
    typeof proposal === "string" ? proposal : await notePreimage(context, proposal);
  const proposalLen = (await context.pjsApi.query.preimage.requestStatusFor(proposalHash)).unwrap()
    .asUnrequested.len;
  const dispatchWLCall = context.pjsApi.tx.whitelist.dispatchWhitelistedCall(
    proposalHash,
    proposalLen,
    {
      refTime: 2e9,
      proofSize: 1e5,
    }
  );
  const wLPreimage = await notePreimage(context, dispatchWLCall);
  const wLPreimageLen = dispatchWLCall.encodedLength - 2;
  console.log(
    `\u{1F4DD} DispatchWhitelistedCall preimage noted: ${wLPreimage.slice(0, 6)}...${wLPreimage.slice(
      -4
    )}, len: ${wLPreimageLen}`
  );
  const openGovProposal = await context.pjsApi.tx.referenda
    .submit(
      {
        Origins: { whitelistedcaller: "WhitelistedCaller" },
      },
      { Lookup: { hash: wLPreimage, len: wLPreimageLen } },
      { After: { After: 0 } }
    )
    .signAsync(faith);
  const { result } = await context.createBlock(openGovProposal);
  if (!result?.events) {
    throw new Error("No events in block");
  }
  let proposalId;
  filterAndApply(result.events, "referenda", ["Submitted"], (found) => {
    proposalId = found.event.data.index.toNumber();
  });
  if (typeof proposalId === "undefined") {
    throw new Error("No proposal id found");
  }
  console.log(`\u{1F3DB}\uFE0F Referendum submitted with proposal id: ${proposalId}`);
  await context.createBlock(context.pjsApi.tx.referenda.placeDecisionDeposit(proposalId));
  const whitelistCall = context.pjsApi.tx.whitelist.whitelistCall(proposalHash);
  await execOpenTechCommitteeProposal(context, whitelistCall);
  return { proposalHash, whitelistedHash: wLPreimage };
};
var whiteListedTrack = async (context, proposal) => {
  const proposalHash =
    typeof proposal === "string" ? proposal : await notePreimage(context, proposal);
  const proposalLen = (await context.pjsApi.query.preimage.requestStatusFor(proposalHash)).unwrap()
    .asUnrequested.len;
  const dispatchWLCall = context.pjsApi.tx.whitelist.dispatchWhitelistedCall(
    proposalHash,
    proposalLen,
    {
      refTime: 2e9,
      proofSize: 1e5,
    }
  );
  const wLPreimage = await notePreimage(context, dispatchWLCall);
  const wLPreimageLen = dispatchWLCall.encodedLength - 2;
  console.log(
    `\u{1F4DD} DispatchWhitelistedCall preimage noted: ${wLPreimage.slice(0, 6)}...${wLPreimage.slice(
      -4
    )}, len: ${wLPreimageLen}`
  );
  const openGovProposal = await context.pjsApi.tx.referenda
    .submit(
      {
        Origins: { whitelistedcaller: "WhitelistedCaller" },
      },
      { Lookup: { hash: wLPreimage, len: wLPreimageLen } },
      { After: { After: 0 } }
    )
    .signAsync(faith);
  const { result } = await context.createBlock(openGovProposal);
  if (!result?.events) {
    throw new Error("No events in block");
  }
  let proposalId;
  filterAndApply(result.events, "referenda", ["Submitted"], (found) => {
    proposalId = found.event.data.index.toNumber();
  });
  if (typeof proposalId === "undefined") {
    throw new Error("No proposal id found");
  }
  console.log(`\u{1F3DB}\uFE0F Referendum submitted with proposal id: ${proposalId}`);
  await context.createBlock(context.pjsApi.tx.referenda.placeDecisionDeposit(proposalId));
  const whitelistCall = context.pjsApi.tx.whitelist.whitelistCall(proposalHash);
  await execOpenTechCommitteeProposal(context, whitelistCall);
  await maximizeConvictionVotingOf(context, [ethan], proposalId);
  await context.createBlock();
  await fastFowardToNextEvent(context);
  await fastFowardToNextEvent(context);
  await fastFowardToNextEvent(context);
};
var execOpenTechCommitteeProposal = async (
  context,
  call,
  voters = OPEN_TECHNICAL_COMMITTEE_MEMBERS,
  threshold = OPEN_TECHNICAL_COMMITTEE_THRESHOLD
) => {
  const openTechCommitteeProposal = context.pjsApi.tx.openTechCommitteeCollective.propose(
    threshold,
    call,
    100
  );
  const { result: result2 } = await context.createBlock(openTechCommitteeProposal, {
    signer: voters[0],
  });
  if (!result2?.events) {
    throw new Error("No events in block");
  }
  let openTechProposal;
  let openTechProposalIndex;
  filterAndApply(result2.events, "openTechCommitteeCollective", ["Proposed"], (found) => {
    openTechProposalIndex = found.event.data.proposalIndex.toNumber();
    openTechProposal = found.event.data.proposalHash.toHex();
  });
  if (typeof openTechProposal === "undefined" || typeof openTechProposalIndex === "undefined") {
    console.error("Error submitting OpenTechCommittee proposal");
    return result2;
  }
  console.log(
    `\u{1F3DB}\uFE0F OpenTechCommittee proposal submitted with proposal id: ${openTechProposalIndex} and hash: ${openTechProposal?.slice(
      0,
      6
    )}...${openTechProposal?.slice(-4)}`
  );
  for (const voter of voters) {
    const nonce = (await context.pjsApi.query.system.account(voter.address)).nonce.toNumber();
    const vote = context.pjsApi.tx.openTechCommitteeCollective
      .vote(openTechProposal, openTechProposalIndex, true)
      .signAsync(voter, { nonce });
    await context.createBlock(vote);
  }
  const { result } = await context.createBlock(
    context.pjsApi.tx.openTechCommitteeCollective.close(
      openTechProposal,
      openTechProposalIndex,
      {
        refTime: 2e9,
        proofSize: 1e5,
      },
      100
    ),
    { signer: voters[0] }
  );
  if (!result) {
    throw new Error("No result in block");
  }
  return result;
};
var execCouncilProposal = async (
  context,
  polkadotCall,
  index = -1,
  voters = COUNCIL_MEMBERS,
  threshold = COUNCIL_THRESHOLD
) => {
  const lengthBound = polkadotCall.method.encodedLength;
  const { result: proposalResult } = await context.createBlock(
    context
      .polkadotJs()
      .tx.councilCollective.propose(threshold, polkadotCall, lengthBound)
      .signAsync(charleth)
  );
  if (!proposalResult) {
    throw "Proposal result is undefined";
  }
  if (threshold <= 1) {
    return proposalResult;
  }
  if (!proposalResult.successful) {
    throw `Council proposal refused: ${proposalResult?.error?.name}`;
  }
  const proposed = proposalResult.events.find(
    ({ event: { method } }) => method.toString() === "Proposed"
  );
  if (!proposed) {
    throw "Proposed event not found";
  }
  const proposalHash = proposed.event.data[2].toHex();
  const proposalIndex =
    index >= 0
      ? index
      : (await context.polkadotJs().query.councilCollective.proposalCount()).toNumber() - 1;
  await Promise.all(
    voters.map((voter) =>
      context
        .polkadotJs()
        .tx.councilCollective.vote(proposalHash, proposalIndex, true)
        .signAndSend(voter)
    )
  );
  await context.createBlock();
  return await context.createBlock(
    context
      .polkadotJs()
      .tx.councilCollective.close(
        proposalHash,
        proposalIndex,
        {
          refTime: 2e9,
          proofSize: 1e5,
        },
        lengthBound
      )
      .signAsync(dorothy)
  );
};
var proposeReferendaAndDeposit = async (context, decisionDepositer, proposal, origin) => {
  const proposalHash =
    typeof proposal === "string" ? proposal : await notePreimage(context, proposal);
  const { result: proposalResult } = await context.createBlock(
    context
      .polkadotJs()
      .tx.referenda.submit(
        origin,
        {
          Lookup: {
            hash: proposalHash,
            len: typeof proposal === "string" ? proposal : proposal.method.encodedLength,
          },
        },
        { At: 0 }
      )
      .signAsync(alith)
  );
  if (!proposalResult) {
    throw "Proposal result is undefined";
  }
  if (!proposalResult.successful) {
    throw `Unable to post referenda: ${proposalResult?.error?.name}`;
  }
  const refIndex = proposalResult.events
    .find(({ event: { method } }) => method.toString() === "Submitted")
    ?.event.data[0].toString();
  if (!refIndex) {
    throw "Referendum index not found";
  }
  await context.createBlock(
    context.polkadotJs().tx.referenda.placeDecisionDeposit(refIndex).signAsync(decisionDepositer)
  );
  return [+refIndex, proposalHash];
};
var dispatchAsGeneralAdmin = async (context, call) => {
  await context.createBlock(
    context.polkadotJs().tx.sudo.sudo(
      context.polkadotJs().tx.utility.dispatchAs(
        {
          Origins: "GeneralAdmin",
        },
        call
      )
    )
  );
};
var maximizeConvictionVotingOf = async (context, voters, refIndex) => {
  const fee = (
    await context
      .polkadotJs()
      .tx.convictionVoting.vote(refIndex, {
        Standard: {
          vote: { aye: true, conviction: "Locked6x" },
          balance: (await context.polkadotJs().query.system.account(alith.address)).data.free,
        },
      })
      .paymentInfo(alith)
  ).partialFee;
  await context.createBlock(
    voters.map(async (voter) =>
      context
        .polkadotJs()
        .tx.convictionVoting.vote(refIndex, {
          Standard: {
            vote: { aye: true, conviction: "Locked6x" },
            balance: await (
              await context.polkadotJs().query.system.account(voter.address)
            ).data.free.sub(fee),
          },
        })
        .signAsync(voter)
    )
  );
};
var execTechnicalCommitteeProposal = async (
  context,
  polkadotCall,
  voters = TECHNICAL_COMMITTEE_MEMBERS,
  threshold = TECHNICAL_COMMITTEE_THRESHOLD
) => {
  const lengthBound = polkadotCall.encodedLength;
  const { result: proposalResult } = await context.createBlock(
    context.polkadotJs().tx.techCommitteeCollective.propose(threshold, polkadotCall, lengthBound)
  );
  if (!proposalResult) {
    throw "Proposal result is undefined";
  }
  if (threshold <= 1) {
    return proposalResult;
  }
  if (!proposalResult.successful) {
    throw `Council proposal refused: ${proposalResult?.error?.name}`;
  }
  const proposalHash = proposalResult.events
    .find(({ event: { method } }) => method.toString() === "Proposed")
    ?.event.data[2].toHex();
  if (!proposalHash) {
    throw "Proposed event not found";
  }
  const proposalCount = await context.polkadotJs().query.techCommitteeCollective.proposalCount();
  await context.createBlock(
    voters.map((voter) =>
      context
        .polkadotJs()
        .tx.techCommitteeCollective.vote(proposalHash, Number(proposalCount) - 1, true)
        .signAsync(voter)
    )
  );
  const { result: closeResult } = await context.createBlock(
    context
      .polkadotJs()
      .tx.techCommitteeCollective.close(
        proposalHash,
        Number(proposalCount) - 1,
        {
          refTime: 2e9,
          proofSize: 1e5,
        },
        lengthBound
      )
      .signAsync(baltathar)
  );
  return closeResult;
};
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
var fastFowardToNextEvent = async (context) => {
  const [entry] = await context.pjsApi.query.scheduler.agenda.entries();
  const [key, _] = entry;
  if (key.isEmpty) {
    throw new Error("No items in scheduler.agenda");
  }
  const decodedKey = key.toHuman();
  const desiredHeight = Number(decodedKey[0].valueOf().replaceAll(",", ""));
  const currentHeight = (await context.pjsApi.rpc.chain.getHeader()).number.toNumber();
  console.log(
    `\u23E9\uFE0F Current height: ${currentHeight}, desired height: ${desiredHeight}, jumping ${desiredHeight - currentHeight + 1} blocks`
  );
  await context.jumpBlocks?.(desiredHeight - currentHeight + 1);
};
export {
  COUNCIL_MEMBERS,
  COUNCIL_THRESHOLD,
  OPEN_TECHNICAL_COMMITTEE_MEMBERS,
  OPEN_TECHNICAL_COMMITTEE_THRESHOLD,
  TECHNICAL_COMMITTEE_MEMBERS,
  TECHNICAL_COMMITTEE_THRESHOLD,
  cancelReferendaWithCouncil,
  dispatchAsGeneralAdmin,
  execCouncilProposal,
  execOpenTechCommitteeProposal,
  execTechnicalCommitteeProposal,
  executeOpenTechCommitteeProposal,
  executeProposalWithCouncil,
  fastFowardToNextEvent,
  instantFastTrack,
  maximizeConvictionVotingOf,
  notePreimage,
  proposeReferendaAndDeposit,
  whiteListTrackNoSend,
  whiteListedTrack,
};
