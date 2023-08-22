import { FoundationHandler, UpgradePreferences } from "@moonwall/types";
import { ApiPromise } from "@polkadot/api";
import { upgradeRuntime } from "../upgradeProcedures";
import { MoonwallContext } from "../globalContext";
import { alith } from "@moonwall/util";

export const zombieHandler: FoundationHandler<"zombie"> = ({
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
        chain: string = "parachain",
        mode: "height" | "quantity" = "quantity"
      ) => {
        const ctx = MoonwallContext.getContext();
        const provider = ctx.providers.find((prov) => prov.name === chain);

        if (!provider) {
          throw new Error(`Provider '${chain}' not found`);
        }

        const api = provider.api as ApiPromise;
        const currentBlockNumber = (await api.rpc.chain.getBlock()).block.header.number.toNumber();

        for (;;) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const newBlockNumber = (await api.rpc.chain.getBlock()).block.header.number.toNumber();
          if (mode === "quantity" && newBlockNumber >= currentBlockNumber + blocksToWaitFor) {
            break;
          } else if (mode === "height" && newBlockNumber >= blocksToWaitFor) {
            break;
          }
        }
      },
      upgradeRuntime: async (options: UpgradePreferences = {}) => {
        const ctx = MoonwallContext.getContext();
        const provider = ctx.providers.find((prov) => prov.name === "parachain");

        if (!provider) {
          throw new Error(`Provider 'parachain' not found`);
        }
        const api = provider.api as ApiPromise;

        const params: UpgradePreferences = {
          runtimeName: options.runtimeName || "moonbase",
          runtimeTag: options.runtimeTag || "local",
          localPath: options.localPath || ctx.rtUpgradePath!,
          useGovernance: options.useGovernance || false,
          waitMigration: options.waitMigration || true,
          from: options.from || alith,
        };

        if (options.logger) {
          params.logger = options.logger;
        }

        await upgradeRuntime(api, params);
      },
    },
    it: testCase,
    log: logger(),
  });
};
