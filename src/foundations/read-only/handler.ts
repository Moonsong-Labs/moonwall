import type { ApiPromise } from "@polkadot/api";
import type { FoundationHandler } from "../../api/types/index.js";
import { MoonwallContext } from "../../cli/lib/globalContext.js";

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
        blocksToWaitFor = 1,
        chainName?: string,
        mode: "height" | "quantity" = "quantity"
      ) => {
        const ctx = await MoonwallContext.getContext();
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
          }
          if (mode === "height" && newBlockNumber >= blocksToWaitFor) {
            break;
          }
        }
      },
    },
    it: testCase,
    log: logger.info.bind(logger),
    logger,
  });
};
