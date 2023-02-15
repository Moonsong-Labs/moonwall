#!/usr/bin/env ts-node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const test_1 = require("./runner/cmds/test");
(0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .usage('Usage: $0')
    .version('2.0.0')
    .command(`test [testSpecs..]`, 'Run tests found in test specs', (yargs) => {
    return yargs.positional('testSpecs', {
        alias: 'testSpecs',
        array: true,
        describe: 'Path to test spec file(s)',
        default: '*.ts',
    });
}, async (argv) => {
    await (0, test_1.testCmd)(argv);
})
    .options({
    configFile: {
        type: 'string',
        alias: 'c',
        description: 'path to MoonwallConfig file',
        default: "./moonwall.config.json"
    },
    environment: {
        type: 'string',
        alias: 't',
        description: 'name of environment tests to run',
        demandOption: false
    },
})
    .parse();
//# sourceMappingURL=index.js.map