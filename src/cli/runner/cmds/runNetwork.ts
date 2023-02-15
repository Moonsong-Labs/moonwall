import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import { loadConfig } from "../util/configReader";
import fs from "fs/promises";
import path from "path";
const inquirer = require('inquirer');
import { MoonwallContext, runNetworkOnly } from "../internal/globalContext";
import { globalConfig } from "../../../../moonwalls.config";
const debug = require("debug")("global:setup");

export async function runNetwork(args) {
  try {
    await runNetworkOnly(globalConfig, args.envName);

  await inquirer.prompt(questions)
    MoonwallContext.destroy();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}


const questions = [
  {
    type: "input",
    name: "quit",
    message: "✅ Network has started. Type 'exit' to quit: "
  }
]