import { Foundation, ProviderType } from "./src/types/enum.js";
import { MoonwallConfig } from "./src/types/config.js";

export const globalConfig: MoonwallConfig = {
  label: "Global Test Config 🐯",
  defaultTestTimeout: 40000,
  environments: [
    {
      name: "mb_skip",
      testFileDir: ["tests/dummy-smoke/"],
      include: ["**/*conditional*"],
      foundation: {
        type: Foundation.ReadOnly,
      },
      connections: [
        {
          name: "MB",
          type: ProviderType.Moonbeam,
          endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
        },
      ],
    },
    {
      name: "mr_run",
      testFileDir: ["tests/dummy-smoke/"],
      include: ["**/*conditional*"],
      foundation: {
        type: Foundation.ReadOnly,
      },
      connections: [
        {
          name: "MB",
          type: ProviderType.Moonbeam,
          endpoints: ["wss://wss.api.moonriver.moonbeam.network"],
        },
      ],
    },
    {
      name: "chop_state_test",
      testFileDir: ["tests/chopsticks/"],
      include: ["**/*state*"],
      foundation: {
        type: Foundation.Chopsticks,
        launchSpec: [
          {
            name: "mb",
            type: "parachain",
            buildBlockMode: "manual",
            configPath: "./moonbeamChopsticks.yml",
          },
        ],
      },
      connections: [
        {
          name: "MB",
          type: ProviderType.Moonbeam,
          endpoints: ["ws://127.0.0.1:12000"],
        },
      ],
    },
    {
      name: "chopsticks_xcm",
      testFileDir: [],
      foundation: {
        type: Foundation.Chopsticks,
        launchSpec: [
          {
            name: "mb",
            type: "parachain",
            buildBlockMode: "manual",
            configPath: "./moonriverChopsticks.yml",
          },
          {
            name: "mb",
            type: "parachain",
            buildBlockMode: "manual",
            configPath: "./moonbeamChopsticks.yml",
          },
        ],
      },
      connections: [
        {
          name: "MB",
          type: ProviderType.Moonbeam,
          endpoints: ["ws://127.0.0.1:10000"],
        },
        {
          name: "MR",
          type: ProviderType.Moonbeam,
          endpoints: ["ws://127.0.0.1:12000"],
        },
      ],
    },
    {
      name: "chop_test",
      testFileDir: ["tests/chopsticks/"],
      foundation: {
        type: Foundation.Chopsticks,
        rtUpgradePath: "./moonbeam-runtime-2200.wasm",
        launchSpec: [
          {
            name: "mb",
            type: "parachain",
            buildBlockMode: "manual",
            configPath: "./moonbeamChopsticks.yml",
          },
        ],
      },
      connections: [
        {
          name: "MB",
          type: ProviderType.Moonbeam,
          endpoints: ["ws://127.0.0.1:12000"],
        },
      ],
    },
    {
      name: "dev_minimal",
      testFileDir: ["tests/test_separation"],
      threads: 5,
      foundation: {
        type: Foundation.Dev,
        launchSpec: [
          {
            name: "moonbeam",
            binPath: "./moonbeam",
          },
        ],
      },
    },
    {
      name: "wrongFoundation",
      testFileDir: ["tests/run_error/"],
      foundation: {
        type: Foundation.ReadOnly,
      },
      connections: [
        {
          name: "w3",
          type: ProviderType.Web3,
          endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
        },
        {
          name: "mb",
          type: ProviderType.Moonbeam,
          endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
        },
      ],
    },
    {
      name: "pass",
      testFileDir: ["tests/run_error/"],
      foundation: {
        type: Foundation.Dev,
        launchSpec: [
          {
            name: "moonbeam",
            binPath: "./moonbeam",
            ports: { p2pPort: 30333, wsPort: 9944, rpcPort: 9933 },
            options: [
              "--dev",
              "--no-hardware-benchmarks",
              "--no-telemetry",
              "--reserved-only",
              "--rpc-cors=all",
              "--no-grandpa",
              "--unsafe-ws-external",
              "--sealing=manual",
              "--force-authoring",
              "--no-prometheus",
            ],
          },
        ],
      },
      connections: [
        {
          name: "w3",
          type: ProviderType.Web3,
          endpoints: ["ws://127.0.0.1:9944"],
        },
        {
          name: "mb",
          type: ProviderType.PolkadotJs,
          endpoints: ["ws://127.0.0.1:9944"],
        },
      ],
    },
    {
      name: "web3_test",
      testFileDir: ["tests/web3_test/"],
      foundation: {
        type: Foundation.ReadOnly,
      },
      connections: [
        {
          name: "w3",
          type: ProviderType.Web3,
          endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
        },
      ],
    },
    {
      name: "eth_test",
      testFileDir: ["tests/eth_test/"],
      include: ["**/{test,spec,test_,test-}*{ts,mts,cts}"],
      foundation: {
        type: Foundation.ReadOnly,
      },
      connections: [
        {
          name: "eth",
          type: ProviderType.Ethers,
          endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
        },
      ],
    },
    {
      name: "dev_test",
      testFileDir: ["tests/dev_tests"],
      foundation: {
        type: Foundation.Dev,
        launchSpec: [
          {
            name: "moonbeam",
            binPath: "./moonbeam",
            ports: { p2pPort: 30333, wsPort: 9944, rpcPort: 9933 },
            options: [
              "--dev",
              "--no-hardware-benchmarks",
              "--no-telemetry",
              "--reserved-only",
              "--rpc-cors=all",
              "--no-grandpa",
              "--sealing=manual",
              "--force-authoring",
              "--no-prometheus",
            ],
          },
        ],
      },
      connections: [
        {
          name: "eth",
          type: ProviderType.Ethers,
          endpoints: ["ws://127.0.0.1:9944"],
        },
        {
          name: "w3",
          type: ProviderType.Web3,
          endpoints: ["ws://127.0.0.1:9944"],
        },
        {
          name: "pjs",
          type: ProviderType.Moonbeam,
          endpoints: ["ws://127.0.0.1:9944"],
        },
      ],
    },
  ],
};
