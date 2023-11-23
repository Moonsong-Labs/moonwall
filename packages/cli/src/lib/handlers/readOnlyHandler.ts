import { ApiPromise } from "@polkadot/api";
import { FoundationHandler } from "@moonwall/types";
import { MoonwallContext } from "../globalContextEffect";

export const readOnlyHandler: FoundationHandler<"read_only"> = ({
  testCases,
  context,
  testCase,
  logger,
}) => {
  testCases({
    context: {
      ...context,
      waitBlock: async (
        blocksToWaitFor: number = 1,
        chainName?: string,
        mode: "height" | "quantity" = "quantity"
      ) => {
        const ctx = MoonwallContext.getContext();
        const provider = chainName
          ? ctx.providers.find((prov) => prov.name === chainName && prov.type === "polkadotJs")
          : ctx.providers.find((prov) => prov.type === "polkadotJs");

        if (!provider) {
          throw new Error("No PolkadotJs api found in provider config");
        }

        const api = provider.api as ApiPromise;

        const currentBlockNumber = (await api.rpc.chain.getBlock()).block.header.number.toNumber();

        for (;;) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const newBlockNumber = (await api.rpc.chain.getBlock()).block.header.number.toNumber();
          if (mode === "quantity" && newBlockNumber >= currentBlockNumber + blocksToWaitFor) {
            break;
          } else if (mode === "height" && newBlockNumber >= blocksToWaitFor) {
            break;
          }
        }
      },
    },
    it: testCase,
    log: logger(),
  });
};
