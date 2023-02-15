import {
  FoundationType,
  MoonwallConfig,
  ProviderType,
} from "./src/cli/runner/lib/types";
import path from "path"

export const globalConfig: MoonwallConfig = {
  label: "test new config",
  defaultTestTimeout: 40000,
  environments: [
    {
      name: "dev_minimal",
      testFileDir: "tests/dev_tests/",
      foundation: {
        type: FoundationType.DevMode,
        launchSpec: [
          {
            bin: {
              name: "moonbeam",
              path: "/home/timbotronic/workspace/moonbeam/moonbeam/target/release/moonbeam",
            }
          },
        ],
      },
    },
    {
      name: "mixed",
      testFileDir: "tests/compile_error/",
      foundation: {
        type: FoundationType.ReadOnly,
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
      testFileDir: "tests/compile_error/",
      foundation: {
        type: FoundationType.DevMode,
        launchSpec: [
          {
            bin: {
              name: "moonbeam",
              path: "/home/timbotronic/workspace/moonbeam/moonbeam/target/release/moonbeam",
            },
            ports: { p2pPort: 30333, wsPort: 9944, rpcPort: 9933 },
            alreadyRunning: false,
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
          name: "w3",
          type: ProviderType.Web3,
          endpoints: ["ws://localhost:9944"],
        },
        {
          name: "mb",
          type: ProviderType.Moonbeam,
          endpoints: ["ws://localhost:9944"],
        },
      ],
    },
    {
      name: "web3_test",
      testFileDir: "tests/web3_test/",
      foundation: {
        type: FoundationType.ReadOnly,
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
      name: "new",
      testFileDir: "tests/eth_test/",
      foundation: {
        type: FoundationType.ReadOnly,
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
      testFileDir: "tests/dev_tests",
      foundation: {
        type: FoundationType.DevMode,
        launchSpec: [
          {
            bin: {
              name: "moonbeam",
              path: "/home/timbotronic/workspace/moonbeam/moonbeam/target/release/moonbeam",
            },
            ports: { p2pPort: 30333, wsPort: 9944, rpcPort: 9933 },
            alreadyRunning: false,
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
          endpoints: ["ws://localhost:9944"],
        },
        {
          name: "w3",
          type: ProviderType.Web3,
          endpoints: ["ws://localhost:9944"],
        },
        {
          name: "pjs",
          type: ProviderType.PolkadotJs,
          endpoints: ["ws://localhost:9944"],
        },
      ],
    },
  ],
};

export default globalConfig;
