#!/usr/bin/env ts-node-esm
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { testCmd } from "./runner/cmds/runTests.js";
import { runNetwork } from "./runner/cmds/runNetwork.js";
yargs(hideBin(process.argv))
    .usage("Usage: $0")
    .version("2.0.0")
    .command(`test [testSpecs..]`, "Run tests found in test specs", (yargs) => {
    return yargs.positional("testSpecs", {
        alias: "testSpecs",
        array: true,
        describe: "Path to test spec file(s)",
        default: "*.ts",
    });
}, async (argv) => {
    await testCmd(argv);
})
    .command(`run <envName>`, "Start new network found in global config", (yargs) => {
    return yargs.positional("envName", {
        describe: "Network environment to start",
    });
}, async (argv) => {
    await runNetwork(argv);
})
    .options({
    configFile: {
        type: "string",
        alias: "c",
        description: "path to MoonwallConfig file",
        default: "./moonwall.config.json",
    },
    environment: {
        type: "string",
        alias: "t",
        description: "name of environment tests to run",
        demandOption: false,
    },
})
    .parse();
//# sourceMappingURL=index.js.map