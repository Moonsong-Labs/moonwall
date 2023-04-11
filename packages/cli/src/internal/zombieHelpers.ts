import fs from "node:fs";
import { LaunchConfig } from "@zombienet/orchestrator";
import { checkExists } from "./files.js";
import chalk from "chalk";

export async function checkZombieBins(config: LaunchConfig) {
  const relayBinPath = config.relaychain.default_command;
  await checkExists(relayBinPath);

  const promises = config.parachains.map((para) => {
    if (para.collator) {
      checkExists(para.collator.command);
    }


  
    if (para.collators) {
      para.collators.forEach((coll) => {
        checkExists(coll.command);
      });
    }
  });
  await Promise.all(promises);
}

export function getZombieConfig(path: string) {
  const fsResult = fs.existsSync(path);
  if (!fsResult) {
    throw new Error(
      `No ZombieConfig file found at location: ${path} \n Are you sure your ${chalk.bgWhiteBright.blackBright(
        "moonwall.config.json"
      )} file has the correct "configPath" in zombieSpec?`
    );
  }


  const buffer = fs.readFileSync(path, "utf-8");
  return JSON.parse(buffer) as LaunchConfig;
}
