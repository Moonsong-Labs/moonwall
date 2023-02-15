"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalConfig = void 0;
const types_1 = require("./src/cli/runner/lib/types");
exports.globalConfig = {
    label: "test new config",
    defaultTestTimeout: 40000,
    environments: [
        {
            name: "dev_minimal",
            testFileDir: "tests/dev_tests/",
            foundation: {
                type: types_1.FoundationType.DevMode,
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
                type: types_1.FoundationType.ReadOnly,
            },
            connections: [
                {
                    name: "w3",
                    type: types_1.ProviderType.Web3,
                    endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
                },
                {
                    name: "mb",
                    type: types_1.ProviderType.Moonbeam,
                    endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
                },
            ],
        },
        {
            name: "pass",
            testFileDir: "tests/compile_error/",
            foundation: {
                type: types_1.FoundationType.DevMode,
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
                    type: types_1.ProviderType.Web3,
                    endpoints: ["ws://localhost:9944"],
                },
                {
                    name: "mb",
                    type: types_1.ProviderType.Moonbeam,
                    endpoints: ["ws://localhost:9944"],
                },
            ],
        },
        {
            name: "web3_test",
            testFileDir: "tests/web3_test/",
            foundation: {
                type: types_1.FoundationType.ReadOnly,
            },
            connections: [
                {
                    name: "w3",
                    type: types_1.ProviderType.Web3,
                    endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
                },
            ],
        },
        {
            name: "new",
            testFileDir: "tests/eth_test/",
            foundation: {
                type: types_1.FoundationType.ReadOnly,
            },
            connections: [
                {
                    name: "eth",
                    type: types_1.ProviderType.Ethers,
                    endpoints: ["wss://moonbeam.api.onfinality.io/public-ws"],
                },
            ],
        },
        {
            name: "dev_test",
            testFileDir: "tests/dev_tests",
            foundation: {
                type: types_1.FoundationType.DevMode,
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
                    type: types_1.ProviderType.Ethers,
                    endpoints: ["ws://localhost:9944"],
                },
                {
                    name: "w3",
                    type: types_1.ProviderType.Web3,
                    endpoints: ["ws://localhost:9944"],
                },
                {
                    name: "pjs",
                    type: types_1.ProviderType.PolkadotJs,
                    endpoints: ["ws://localhost:9944"],
                },
            ],
        },
    ],
};
exports.default = exports.globalConfig;
//# sourceMappingURL=moonwalls.config.js.map