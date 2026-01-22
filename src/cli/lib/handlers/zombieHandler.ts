import type { FoundationHandler, UpgradePreferences } from "../../../types/index.js";
import type { ApiPromise } from "@polkadot/api";
import { upgradeRuntime } from "../upgradeProcedures.js";
import { MoonwallContext } from "../globalContext.js";
import { alith } from "../../../util/index.js";
import { sendIpcMessage } from "../../internal/foundations/zombieHelpers.js";

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
        blocksToWaitFor = 1,
        chain = "parachain",
        mode: "height" | "quantity" = "quantity"
      ) => {
        const ctx = await MoonwallContext.getContext();
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
          }
          if (mode === "height" && newBlockNumber >= blocksToWaitFor) {
            break;
          }
        }
      },

      upgradeRuntime: async (options: UpgradePreferences = {}) => {
        const ctx = await MoonwallContext.getContext();

        if (!ctx.rtUpgradePath) {
          throw new Error("Runtime upgrade path not defined in moonwall config");
        }
        const provider = ctx.providers.find((prov) => prov.name === "parachain");

        if (!provider) {
          throw new Error(`Provider 'parachain' not found`);
        }
        const api = provider.api as ApiPromise;

        const params: UpgradePreferences = {
          runtimeName: options.runtimeName || "moonbase",
          runtimeTag: options.runtimeTag || "local",
          localPath: options.localPath || ctx.rtUpgradePath,
          upgradeMethod: options.upgradeMethod || "Sudo",
          waitMigration: options.waitMigration || true,
          from: options.from || alith,
        };

        if (options.logger) {
          params.logger = options.logger;
        }

        await upgradeRuntime(api, params);
      },

      restartNode: async (nodeName: string): Promise<void> => {
        await sendIpcMessage({
          text: `Restarting node ${nodeName}`,
          cmd: "restart",
          nodeName: nodeName,
        });
      },

      pauseNode: async (nodeName: string): Promise<void> => {
        await sendIpcMessage({
          text: `Pausing node ${nodeName}`,
          cmd: "pause",
          nodeName: nodeName,
        });
      },

      resumeNode: async (nodeName: string): Promise<void> => {
        await sendIpcMessage({
          text: `Resuming node ${nodeName}`,
          cmd: "resume",
          nodeName: nodeName,
        });
      },

      killNode: async (nodeName: string): Promise<void> => {
        await sendIpcMessage({
          text: `Killing node ${nodeName}`,
          cmd: "kill",
          nodeName: nodeName,
        });
      },

      isUp: async (nodeName: string): Promise<boolean> => {
        const response = await sendIpcMessage({
          text: `Checking if node ${nodeName} is up`,
          cmd: "isup",
          nodeName: nodeName,
        });
        return response.status === "success";
      },
    },
    it: testCase,
    log: logger.info.bind(logger),
    logger,
  });
};
