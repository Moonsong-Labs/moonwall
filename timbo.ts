import {
  Foundation,
  MoonwallConfig,
  ProviderType,
} from "./src/types/configAndContext.js";

export const globalConfig: MoonwallConfig = {
        label: "moonwall_config",
        defaultTestTimeout: 30000,
        environments: [
          {
            name: "default_env",
            testFileDir: "tests/",
            foundation: {
              type: Foundation.ReadOnly,
            },
          },
        ],
      };