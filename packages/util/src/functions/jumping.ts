import "@moonbeam-network/api-augment";
import { ChopsticksContext, DevModeContext } from "@moonwall/types";

export async function jumpToRoundDev(
  context: DevModeContext,
  round: number
): Promise<string | null> {
  let lastBlockHash = "";
  for (;;) {
    const currentRound = (
      await context.polkadotJs().query.parachainStaking.round()
    ).current.toNumber();

    if (currentRound === round) {
      return lastBlockHash;
    } else if (currentRound > round) {
      return null;
    }

    lastBlockHash = (await context.createBlock()).block.hash.toString();
  }
}

export async function jumpBlocksDev(context: DevModeContext, blockCount: number) {
  while (blockCount > 0) {
    (await context.createBlock()).block.hash.toString();
    blockCount--;
  }
}

export async function jumpRoundsDev(
  context: DevModeContext,
  count: number
): Promise<string | null> {
  const round = (await context.polkadotJs().query.parachainStaking.round()).current
    .addn(count.valueOf())
    .toNumber();

  return jumpToRoundDev(context, round);
}
