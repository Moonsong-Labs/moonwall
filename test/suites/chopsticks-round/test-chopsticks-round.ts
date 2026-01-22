import "@moonbeam-network/api-augment";
import { describeSuite, expect } from "moonwall";

describeSuite({
  id: "CR1",
  title: "Chopsticks tests involving round changes",
  foundationMethods: "chopsticks",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "Query the chain",
      test: async () => {
        const currentRound = (
          await context.polkadotJs().query.parachainStaking.round()
        ).current.toNumber();
        log(`Current round: ${currentRound}`);

        await context.jumpRounds!({ rounds: 1 });
        const newRound = (
          await context.polkadotJs().query.parachainStaking.round()
        ).current.toNumber();
        log(`New round: ${newRound}`);
        expect(newRound).toEqual(currentRound + 1);
      },
    });
  },
});
