import { ChopsticksBlockCreation, ChopsticksContext, FoundationHandler } from "@moonwall/types";
import {
  createChopsticksBlock,
  sendSetStorageRequest,
} from "../../internal/foundations/chopsticksHelpers";
import { upgradeRuntimeChopsticks } from "../upgradeProcedures";
import { MoonwallContext } from "../globalContext";

export const chopsticksHandler: FoundationHandler<"chopsticks"> = ({
  testCases,
  context,
  testCase,
  logger,
}) => {
  testCases({
    context: {
      ...context,
      createBlock: async (options: ChopsticksBlockCreation = {}) =>
        await createChopsticksBlock(context, options),
      setStorage: async (params?: {
        providerName?: string;
        module: string;
        method: string;
        methodParams: any[];
      }) => await sendSetStorageRequest(params),
      upgradeRuntime: async (chCtx: ChopsticksContext) => {
        await upgradeRuntimeChopsticks(
          chCtx,
          (() => MoonwallContext.getContext().rtUpgradePath!)()
        );
      },
    },
    it: testCase,
    log: logger(),
  });
};
