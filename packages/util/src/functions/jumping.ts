import "@moonbeam-network/api-augment";
import type { ApiPromise } from "@polkadot/api";

export async function jumpBlocksDev(polkadotJsApi: ApiPromise, blockCount: number) {
  while (blockCount > 0) {
    await polkadotJsApi.rpc.engine.createBlock(true, true);
    blockCount--;
  }
}

export async function jumpRoundsDev(
  polkadotJsApi: ApiPromise,
  count: number
): Promise<string | null> {
  const round = (await polkadotJsApi.query.parachainStaking.round()).current
    .addn(count.valueOf())
    .toNumber();

  return jumpToRoundDev(polkadotJsApi, round);
}

async function jumpToRoundDev(polkadotJsApi: ApiPromise, round: number): Promise<string | null> {
  let lastBlockHash = "";
  for (;;) {
    const currentRound = (await polkadotJsApi.query.parachainStaking.round()).current.toNumber();

    if (currentRound === round) {
      return lastBlockHash;
    } else if (currentRound > round) {
      return null;
    }

    lastBlockHash = (await polkadotJsApi.rpc.engine.createBlock(true, true)).blockHash.toString();
  }
}
