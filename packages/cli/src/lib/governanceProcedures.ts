import type { DevModeContext } from "@moonwall/types";
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
import type { ApiPromise } from "@polkadot/api";
import type { ApiTypes, SubmittableExtrinsic } from "@polkadot/api/types";
import type { KeyringPair } from "@polkadot/keyring/types";
// Type cast will be used instead of import
// import type { PalletReferendaReferendumInfo } from "@polkadot/types/lookup";
import { blake2AsHex } from "@polkadot/util-crypto";

export const COUNCIL_MEMBERS: KeyringPair[] = [baltathar, charleth, dorothy];
export const COUNCIL_THRESHOLD = Math.ceil((COUNCIL_MEMBERS.length * 2) / 3);
export const TECHNICAL_COMMITTEE_MEMBERS: KeyringPair[] = [alith, baltathar];
export const TECHNICAL_COMMITTEE_THRESHOLD = Math.ceil(
  (TECHNICAL_COMMITTEE_MEMBERS.length * 2) / 3
);
export const OPEN_TECHNICAL_COMMITTEE_MEMBERS: KeyringPair[] = [alith, baltathar];
export const OPEN_TECHNICAL_COMMITTEE_THRESHOLD = Math.ceil(
  (OPEN_TECHNICAL_COMMITTEE_MEMBERS.length * 2) / 3
);

// TODO: Refactor to support both instant sealing and parachain environment
// (using a waitOrCreateNextBlock common function)
export const notePreimage = async <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  proposal: Call,
  account: KeyringPair = alith
): Promise<string> => {
  const encodedProposal = proposal.method.toHex() || "";
  await context.createBlock(
    context.polkadotJs().tx.preimage.notePreimage(encodedProposal).signAsync(account)
  );

  return blake2AsHex(encodedProposal);
};

// Creates the Council Proposal and fast track it before executing it
export const instantFastTrack = async <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  proposal: string | Call,
  { votingPeriod, delayPeriod } = { votingPeriod: 2, delayPeriod: 0 }
): Promise<string> => {
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

export const whiteListTrackNoSend = async <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  proposal: string | Call
) => {
  const proposalHash =
    typeof proposal === "string" ? proposal : await notePreimage(context, proposal);

  const proposalLen = ((await context.pjsApi.query.preimage.requestStatusFor(proposalHash)) as any).unwrap()
    .asUnrequested.len;
  const dispatchWLCall = context.pjsApi.tx.whitelist.dispatchWhitelistedCall(
    proposalHash,
    proposalLen,
    {
      refTime: 2_000_000_000,
      proofSize: 100_000,
    }
  );

  const wLPreimage = await notePreimage(context, dispatchWLCall);
  const wLPreimageLen = dispatchWLCall.encodedLength - 2;
  console.log(
    `📝 DispatchWhitelistedCall preimage noted: ${wLPreimage.slice(0, 6)}...${wLPreimage.slice(
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

  let proposalId: number | undefined;
  filterAndApply(result.events, "referenda", ["Submitted"], (found) => {
    proposalId = (found.event as any).data.index.toNumber();
  });

  if (typeof proposalId === "undefined") {
    throw new Error("No proposal id found");
  }

  console.log(`🏛️ Referendum submitted with proposal id: ${proposalId}`);
  await context.createBlock(context.pjsApi.tx.referenda.placeDecisionDeposit(proposalId));

  const whitelistCall = context.pjsApi.tx.whitelist.whitelistCall(proposalHash);
  await execOpenTechCommitteeProposal(context, whitelistCall);
  return { proposalHash, whitelistedHash: wLPreimage };
};

// Uses WhitelistedOrigin track to quickly execute a call
export const whiteListedTrack = async <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  proposal: string | Call
) => {
  const proposalHash =
    typeof proposal === "string" ? proposal : await notePreimage(context, proposal);

  // Construct dispatchWhiteListed call
  const proposalLen = ((await context.pjsApi.query.preimage.requestStatusFor(proposalHash)) as any).unwrap()
    .asUnrequested.len;
  const dispatchWLCall = context.pjsApi.tx.whitelist.dispatchWhitelistedCall(
    proposalHash,
    proposalLen,
    {
      refTime: 2_000_000_000,
      proofSize: 100_000,
    }
  );

  // Note preimage of it
  const wLPreimage = await notePreimage(context, dispatchWLCall);
  const wLPreimageLen = dispatchWLCall.encodedLength - 2;
  console.log(
    `📝 DispatchWhitelistedCall preimage noted: ${wLPreimage.slice(0, 6)}...${wLPreimage.slice(
      -4
    )}, len: ${wLPreimageLen}`
  );

  // Submit openGov proposal
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

  let proposalId: number | undefined;
  filterAndApply(result.events, "referenda", ["Submitted"], (found) => {
    proposalId = (found.event as any).data.index.toNumber();
  });

  if (typeof proposalId === "undefined") {
    throw new Error("No proposal id found");
  }

  console.log(`🏛️ Referendum submitted with proposal id: ${proposalId}`);
  await context.createBlock(context.pjsApi.tx.referenda.placeDecisionDeposit(proposalId));

  const whitelistCall = context.pjsApi.tx.whitelist.whitelistCall(proposalHash);
  await execOpenTechCommitteeProposal(context, whitelistCall);
  await maximizeConvictionVotingOf(context, [ethan], proposalId);
  await context.createBlock();

  await fastFowardToNextEvent(context); // ⏩️ until preparation done
  await fastFowardToNextEvent(context); // ⏩️ until proposal confirmed
  await fastFowardToNextEvent(context); // ⏩️ until proposal enacted
};

// Creates a OpenTechCommitteeProposal and attempts to execute it
export const execOpenTechCommitteeProposal = async <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  call: Call | string,
  voters: KeyringPair[] = OPEN_TECHNICAL_COMMITTEE_MEMBERS,
  threshold: number = OPEN_TECHNICAL_COMMITTEE_THRESHOLD
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

  let openTechProposal: `0x${string}` | undefined;
  let openTechProposalIndex: number | undefined;

  filterAndApply(result2.events, "openTechCommitteeCollective", ["Proposed"], (found) => {
    openTechProposalIndex = (found.event as any).data.proposalIndex.toNumber();
    openTechProposal = (found.event as any).data.proposalHash.toHex();
  });

  if (typeof openTechProposal === "undefined" || typeof openTechProposalIndex === "undefined") {
    console.error("Error submitting OpenTechCommittee proposal");
    return result2;
  }

  console.log(
    `🏛️ OpenTechCommittee proposal submitted with proposal id: ${openTechProposalIndex} and hash: ${openTechProposal?.slice(
      0,
      6
    )}...${openTechProposal?.slice(-4)}`
  );

  // Vote on it
  for (const voter of voters) {
    const nonce = ((await context.pjsApi.query.system.account(voter.address)) as any).nonce.toNumber();
    const vote = context.pjsApi.tx.openTechCommitteeCollective
      .vote(openTechProposal, openTechProposalIndex, true)
      .signAsync(voter, { nonce });

    await context.createBlock(vote);
  }

  // Close proposal
  const { result } = await context.createBlock(
    context.pjsApi.tx.openTechCommitteeCollective.close(
      openTechProposal,
      openTechProposalIndex,
      {
        refTime: 2_000_000_000,
        proofSize: 100_000,
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

// Creates the Council Proposal
// Vote with the members (all members by default)
// Close it (Execute if successful)
export const execCouncilProposal = async <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  polkadotCall: Call,
  index = -1,
  voters: KeyringPair[] = COUNCIL_MEMBERS,
  threshold: number = COUNCIL_THRESHOLD
) => {
  // Charleth submit the proposal to the council (and therefore implicitly votes for)
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
    // Proposal are automatically executed on threshold <= 1
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

  const proposalHash = proposed.event.data[2].toHex() as string;

  // Dorothy vote for this proposal and close it
  const proposalIndex =
    index >= 0
      ? index
      : ((await context.polkadotJs().query.councilCollective.proposalCount()) as any).toNumber() -
        1;
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
          refTime: 2_000_000_000,
          proofSize: 100_000,
        },
        lengthBound
      )
      .signAsync(dorothy)
  );
};

// Proposes referenda and places decision deposit
// Returns referendum index and proposal hash
export const proposeReferendaAndDeposit = async <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  decisionDepositer: KeyringPair,
  proposal: string | Call,
  origin
): Promise<[number, string]> => {
  // Fetch proposal hash
  const proposalHash =
    typeof proposal === "string" ? proposal : await notePreimage(context, proposal);

  // Post referenda
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

  // Place decision deposit
  await context.createBlock(
    context.polkadotJs().tx.referenda.placeDecisionDeposit(refIndex).signAsync(decisionDepositer)
  );

  return [+refIndex, proposalHash];
};

// Proposes referenda and places decision deposit
// Returns referendum index and proposal hash
export const dispatchAsGeneralAdmin = async <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  call: string | Call
) => {
  // Post referenda
  await context.createBlock(
    context.polkadotJs().tx.sudo.sudo(
      context.polkadotJs().tx.utility.dispatchAs(
        {
          Origins: "GeneralAdmin",
        } as any,
        call
      )
    )
  );
};

// Maximizes conviction voting of some voters
// with respect to an ongoing referenda
// Their whole free balance will be used to vote
export const maximizeConvictionVotingOf = async (
  context: DevModeContext,
  voters: KeyringPair[],
  refIndex: number
) => {
  // We need to have enough to pay for fee
  const fee = (
    await context
      .polkadotJs()
      .tx.convictionVoting.vote(refIndex, {
        Standard: {
          vote: { aye: true, conviction: "Locked6x" },
          balance: ((await context.polkadotJs().query.system.account(alith.address)) as any).data.free,
        },
      })
      .paymentInfo(alith)
  ).partialFee;

  // We vote with everything but fee
  await context.createBlock(
    voters.map(async (voter) =>
      context
        .polkadotJs()
        .tx.convictionVoting.vote(refIndex, {
          Standard: {
            vote: { aye: true, conviction: "Locked6x" },
            balance: (await (
              await context.polkadotJs().query.system.account(voter.address)
            ) as any).data.free.sub(fee),
          },
        })
        .signAsync(voter)
    )
  );
};

// Creates the Technical Committee Proposal
// Vote with the members (all members by default)
// Close it (Execute if successful)
export const execTechnicalCommitteeProposal = async <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  polkadotCall: Call,
  voters: KeyringPair[] = TECHNICAL_COMMITTEE_MEMBERS,
  threshold: number = TECHNICAL_COMMITTEE_THRESHOLD
) => {
  // Tech committee members

  // Alith submit the proposal to the council (and therefore implicitly votes for)
  const lengthBound = polkadotCall.encodedLength;
  const { result: proposalResult } = await context.createBlock(
    context.polkadotJs().tx.techCommitteeCollective.propose(threshold, polkadotCall, lengthBound)
  );

  if (!proposalResult) {
    throw "Proposal result is undefined";
  }

  if (threshold <= 1) {
    // Proposal are automatically executed on threshold <= 1
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
  // Get proposal count
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
          refTime: 2_000_000_000,
          proofSize: 100_000,
        },
        lengthBound
      )
      .signAsync(baltathar)
  );
  return closeResult;
};

export const executeOpenTechCommitteeProposal = async (api: ApiPromise, encodedHash: string) => {
  console.log("Executing OpenTechCommittee proposal");
  const queryPreimage = (await api.query.preimage.requestStatusFor(encodedHash) as any)
  if (queryPreimage.isNone) {
    throw new Error("Preimage not found");
  }

  process.stdout.write(`Sending proposal + vote for ${encodedHash}...`);

  // Noting new preimage to dispatchWhiteList
  const proposalLen = queryPreimage.unwrap().asUnrequested.len;
  const dispatchCallHex = api.tx.whitelist
    .dispatchWhitelistedCall(encodedHash, proposalLen, {
      refTime: 2_000_000_000,
      proofSize: 100_000,
    })
    .method.toHex();
  const dispatchCallPreimageHash = blake2AsHex(dispatchCallHex);

  await signAndSend(api.tx.preimage.notePreimage(dispatchCallHex), charleth);

  const queryDispatchPreimage = (await api.query.preimage.requestStatusFor(dispatchCallPreimageHash) as any)

  if (queryDispatchPreimage.isNone) {
    throw new Error("Dispatch preimage not found");
  }

  const dispatchCallPreimageLen = queryDispatchPreimage.unwrap().asUnrequested.len;

  // Raising new proposal to OpenGov under whitelisted track
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
  // await api.tx.referenda
  //   .submit(
  //     {
  //       Origins: { whitelistedcaller: "WhitelistedCaller" },
  //     },
  //     { Lookup: { hash: dispatchCallPreimageHash, len: dispatchCallPreimageLen } },
  //     { After: { After: 0 } }
  //   )
  //   .signAsync(charleth);

  const proposalId = ((await api.query.referenda.referendumCount()) as any).toNumber() - 1;

  if (proposalId < 0) {
    throw new Error("Proposal id not found");
  }

  await api.tx.referenda.placeDecisionDeposit(proposalId).signAndSend(alith);

  // Opening Proposal to whiteList
  process.stdout.write(`Sending proposal to openTechCommittee to whitelist ${encodedHash}...`);
  await signAndSend(
    api.tx.openTechCommitteeCollective.propose(2, api.tx.whitelist.whitelistCall(encodedHash), 100)
  );

  const openTechProposal = ((await api.query.openTechCommitteeCollective.proposals()) as any).at(-1);

  if (!openTechProposal || openTechProposal?.isEmpty) {
    throw new Error("OpenTechProposal not found");
  }

  const index = ((await api.query.openTechCommitteeCollective.proposalCount()) as any).toNumber() - 1;

  if (index < 0) {
    throw new Error("OpenTechProposal index not found");
  }

  process.stdout.write("✅\n");

  const baltaNonce = ((await api.rpc.system.accountNextIndex(baltathar.address)) as any).toNumber();
  // Voting and closing on openTech proposal
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
          refTime: 2_000_000_000,
          proofSize: 100_000,
        },
        100
      ),
      baltathar,
      baltaNonce + 1
    ),
  ]);
  process.stdout.write("✅\n");
  // Voting on referendum with lots of money

  process.stdout.write("Voting on main referendum proposal...");

  const bal = ((await api.query.system.account(dorothy.address)) as any).data.free.toBigInt();

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

  process.stdout.write("✅\n");

  // Waiting one million years for the referendum to be enacted
  process.stdout.write(`Waiting for referendum [${proposalId}] to be no longer ongoing...`);
  let referendaInfo: any | undefined;
  for (;;) {
    try {
      referendaInfo = ((await api.query.referenda.referendumInfoFor(proposalId)) as any).unwrap();

      if (!referendaInfo.isOngoing) {
        process.stdout.write("✅\n");
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (e) {
      console.error(e);
      throw new Error(`Error querying referendum info for proposalId: ${proposalId}`);
    }
  }

  process.stdout.write(`${referendaInfo.isApproved ? "✅" : "❌"} \n`);
  if (!referendaInfo.isApproved) {
    throw new Error("Finished Referendum was not approved");
  }
};

export const executeProposalWithCouncil = async (api: ApiPromise, encodedHash: string) => {
  let nonce = ((await api.rpc.system.accountNextIndex(alith.address)) as any).toNumber();
  const referendumNextIndex = ((await api.query.democracy.referendumCount()) as any).toNumber();

  const callData =
    (api.consts.system.version as any).specVersion.toNumber() >= 2000
      ? { Legacy: encodedHash }
      : encodedHash;

  const external = api.tx.democracy.externalProposeMajority(callData);
  const fastTrack = api.tx.democracy.fastTrack(encodedHash, 1, 0);
  const voteAmount = BigInt(1) * BigInt(Math.pow(10, api.registry.chainDecimals[0]));

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
  process.stdout.write("✅\n");

  process.stdout.write(`Waiting for referendum [${referendumNextIndex}] to be executed...`);
  let referenda: any;
  while (!referenda) {
    try {
      referenda = (
        (await api.query.democracy.referendumInfoOf.entries()).find(
          (ref: any) =>
            ref[1].unwrap().isFinished &&
            (api.registry.createType("u32", ref[0].toU8a().slice(-4)) as any).toNumber() ===
              referendumNextIndex
        )?.[1] as any
      ).unwrap();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  process.stdout.write(`${referenda.asFinished.approved ? "✅" : "❌"} \n`);
  if (!referenda.asFinished.approved) {
    throw new Error("Finished Referendum was not approved");
  }
};

export const cancelReferendaWithCouncil = async (api: ApiPromise, refIndex: number) => {
  const proposal = api.tx.democracy.cancelReferendum(refIndex);
  const encodedProposal = proposal.method.toHex();
  const encodedHash = blake2AsHex(encodedProposal);

  let nonce = ((await api.rpc.system.accountNextIndex(alith.address)) as any).toNumber();
  await api.tx.democracy.notePreimage(encodedProposal).signAndSend(alith, { nonce: nonce++ });
  await executeProposalWithCouncil(api, encodedHash);
};

export const fastFowardToNextEvent = async (context: DevModeContext) => {
  const [entry] = await context.pjsApi.query.scheduler.agenda.entries();
  const [key, _] = entry;
  if (key.isEmpty) {
    throw new Error("No items in scheduler.agenda");
  }
  const decodedKey: object = key.toHuman() as any;

  const desiredHeight = Number(((decodedKey as any)[0].valueOf() as string).replace(/,/g, ""));
  const currentHeight = (await context.pjsApi.rpc.chain.getHeader()).number.toNumber();

  console.log(
    `⏩️ Current height: ${currentHeight}, desired height: ${desiredHeight}, jumping ${
      desiredHeight - currentHeight + 1
    } blocks`
  );
  await context.jumpBlocks?.(desiredHeight - currentHeight + 1);
};
