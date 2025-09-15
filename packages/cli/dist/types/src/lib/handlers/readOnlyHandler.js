import { MoonwallContext } from "../globalContext";
export const readOnlyHandler = ({ testCases, context, testCase, logger }) => {
  testCases({
    context: {
      ...context,
      waitBlock: async (blocksToWaitFor = 1, chainName, mode = "quantity") => {
        const ctx = await MoonwallContext.getContext();
        const provider = chainName
          ? ctx.providers.find((prov) => prov.name === chainName && prov.type === "polkadotJs")
          : ctx.providers.find((prov) => prov.type === "polkadotJs");
        if (!provider) {
          throw new Error("No PolkadotJs api found in provider config");
        }
        const api = provider.api;
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
//# sourceMappingURL=readOnlyHandler.js.map
