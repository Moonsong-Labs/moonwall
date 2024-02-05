import "@moonbeam-network/api-augment";
import { expect } from "vitest";
import type { ApiPromise } from "@polkadot/api";
import { ApiTypes, SubmittableExtrinsic } from "@polkadot/api/types";
import { KeyringPair } from "@polkadot/keyring/types";
import {
  PalletDemocracyReferendumInfo,
  PalletReferendaReferendumInfo,
} from "@polkadot/types/lookup";
import { blake2AsHex } from "@polkadot/util-crypto";
import {
  GLMR,
  alith,
  baltathar,
  charleth,
  dorothy,
  ethan,
  faith,
  filterAndApply,
} from "@moonwall/util";
import { DevModeContext } from "@moonwall/types";
import { fastFowardToNextEvent } from "../internal/foundations/devModeHelpers";
import { REFUSED } from "node:dns";

export const COUNCIL_MEMBERS: KeyringPair[] = [baltathar, charleth, dorothy];
export const COUNCIL_THRESHOLD = Math.ceil((COUNCIL_MEMBERS.length * 2) / 3);
export const TECHNICAL_COMMITTEE_MEMBERS: KeyringPair[] = [alith, baltathar];
export const TECHNICAL_COMMITTEE_THRESHOLD = Math.ceil(
  (TECHNICAL_COMMITTEE_MEMBERS.length * 2) / 3
);
export const OPEN_TECHNICAL_COMMITTEE_MEMBERS: KeyringPair[] = [alith, baltathar];
export const OPEN_TECHNICAL_COMMITTEE_THRESHOLD = Math.ceil(
  (TECHNICAL_COMMITTEE_MEMBERS.length * 2) / 3
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
  const proposalLen = (await context.pjsApi.query.preimage.requestStatusFor(proposalHash)).unwrap()
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
  await execOpenTechCommitteeProposal(context, proposalHash);
  await maximizeConvictionVotingOf(context, [ethan], proposalId);
  await context.createBlock();

  await fastFowardToNextEvent(context); // ⏩️ until preparation done
  await fastFowardToNextEvent(context); // ⏩️ until proposal confirmed
  await fastFowardToNextEvent(context); // ⏩️ until proposal enacted
};

// Creates a OpenTechCommitteeProposal and attempts to execute it
export const execOpenTechCommitteeProposal = async (
  context: DevModeContext,
  polkadotCallHash: string,
  voters: KeyringPair[] = OPEN_TECHNICAL_COMMITTEE_MEMBERS,
  threshold: number = OPEN_TECHNICAL_COMMITTEE_THRESHOLD
) => {
  const whitelistCall = context.pjsApi.tx.whitelist.whitelistCall(polkadotCallHash).method.toHex();
  const openTechCommitteeProposal = context.pjsApi.tx.openTechCommitteeCollective.propose(
    threshold,
    whitelistCall,
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
    throw new Error("Error submitting OpenTechCommittee proposal");
  }

  console.log(
    `🏛️ OpenTechCommittee proposal submitted with proposal id: ${openTechProposalIndex} and hash: ${openTechProposal.slice(
      0,
      6
    )}...${openTechProposal.slice(-4)}`
  );

  // Vote on it
  for (const voter of voters) {
    const nonce = (await context.pjsApi.query.system.account(voter.address)).nonce.toNumber();
    const vote = context.pjsApi.tx.openTechCommitteeCollective
      .vote(openTechProposal, openTechProposalIndex, true)
      .signAsync(voter, { nonce });

    await context.createBlock(vote);
  }

  // Close proposal
  const result = await context.createBlock(
    [
      context.pjsApi.tx.openTechCommitteeCollective.close(
        openTechProposal,
        openTechProposalIndex,
        {
          refTime: 2_000_000_000,
          proofSize: 100_000,
        },
        100
      ),
    ],
    { signer: voters[0] }
  );

  const isWhitelisted = (await context.pjsApi.query.whitelist.whitelistedCall(polkadotCallHash))
    .isSome;

  if (!isWhitelisted) {
    throw new Error("Whitelisted procedure failed");
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
          balance: (await context.polkadotJs().query.system.account(alith.address)).data.free,
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
            balance: await (
              await context.polkadotJs().query.system.account(voter.address)
            ).data.free.sub(fee),
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

  expect(proposalResult.successful, `Council proposal refused: ${proposalResult?.error?.name}`).to
    .be.true;
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
  let nonce = (await api.rpc.system.accountNextIndex(alith.address)).toNumber();
  // const referendumNextIndex = (await api.query.referenda.referendumCount()).toNumber();
  const voteAmount = 1_000_000n * GLMR;

  const queryPreimage = await api.query.preimage.requestStatusFor(encodedHash);
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

  await api.tx.preimage.notePreimage(dispatchCallHex).signAndSend(charleth);

  const queryDispatchPreimage = await api.query.preimage.requestStatusFor(dispatchCallPreimageHash);

  if (queryDispatchPreimage.isNone) {
    throw new Error("Dispatch preimage not found");
  }

  const dispatchCallPreimageLen = queryDispatchPreimage.unwrap().asUnrequested.len;

  // Raising new proposal to OpenGov under whitelisted track
  await api.tx.referenda
    .submit(
      {
        Origins: { whitelistedcaller: "WhitelistedCaller" },
      },
      { Lookup: { hash: dispatchCallPreimageHash, len: dispatchCallPreimageLen } },
      { After: { After: 0 } }
    )
    .signAsync(charleth);

  const proposalId = (await api.query.referenda.referendumCount()).toNumber() - 1;

  if (proposalId < 0) {
    throw new Error("Proposal id not found");
  }

  // Opening Proposal to whiteList
  process.stdout.write(`Sending proposal to openTechCommittee to whitelist ${encodedHash}...`);
  await api.tx.openTechCommitteeCollective
    .propose(2, api.tx.whitelist.whitelistCall(encodedHash), 100)
    .signAndSend(alith);
  const openTechProposal = (await api.query.openTechCommitteeCollective.proposals()).at(-1);

  if (!openTechProposal || openTechProposal?.isEmpty) {
    throw new Error("OpenTechProposal not found");
  }

  const index = (await api.query.openTechCommitteeCollective.proposalCount()).toNumber() - 1;

  if (index < 1) {
    throw new Error("OpenTechProposal index not found");
  }

  process.stdout.write("✅\n");

  const baltaNonce = (await api.rpc.system.accountNextIndex(baltathar.address)).toNumber();
  // Voting and closing on openTech proposal
  process.stdout.write("Voting on openTechCommittee proposal...");
  await Promise.all([
    api.tx.openTechCommitteeCollective.vote(openTechProposal, index, true).signAndSend(alith),
    api.tx.openTechCommitteeCollective
      .vote(openTechProposal, index, true)
      .signAndSend(baltathar, { nonce: baltaNonce }),
    api.tx.openTechCommitteeCollective
      .close(
        openTechProposal,
        index,
        {
          refTime: 2_000_000_000,
          proofSize: 100_000,
        },
        100
      )
      .signAndSend(baltathar, { nonce: baltaNonce + 1 }),
  ]);
  process.stdout.write("✅\n");
  // Voting on referendum with lots of money

  process.stdout.write("Voting on main referendum proposal...");
  await api.tx.convictionVoting
    .vote(proposalId, {
      Standard: {
        vote: { aye: true, conviction: "Locked6x" },
        balance: (await api.query.system.account(ethan.address)).data.free.toBigInt() - GLMR,
      },
    })
    .signAndSend(ethan);

  process.stdout.write("✅\n");

  // Waiting one million years for the referendum to be enacted

  process.stdout.write(`Waiting for referendum [${proposalId}] to be executed...`);
  let referendaInfo: PalletReferendaReferendumInfo | undefined;
  for (;;) {
    try {
      referendaInfo = (await api.query.referenda.referendumInfoFor(proposalId)).unwrap();

      if (referendaInfo.isOngoing) {
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
  let nonce = (await api.rpc.system.accountNextIndex(alith.address)).toNumber();
  const referendumNextIndex = (await api.query.democracy.referendumCount()).toNumber();

  // process.stdout.write(
  //   `Sending council motion (${encodedHash} ` +
  //     `[threashold: 1, expected referendum: ${referendumNextIndex}])...`
  // );
  const callData =
    (api.consts.system.version as any).specVersion.toNumber() >= 2000
      ? { Legacy: encodedHash }
      : encodedHash;

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
  process.stdout.write("✅\n");

  process.stdout.write(`Waiting for referendum [${referendumNextIndex}] to be executed...`);
  let referenda: PalletDemocracyReferendumInfo | undefined;
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

  let nonce = (await api.rpc.system.accountNextIndex(alith.address)).toNumber();
  await api.tx.democracy.notePreimage(encodedProposal).signAndSend(alith, { nonce: nonce++ });
  await executeProposalWithCouncil(api, encodedHash);
};
