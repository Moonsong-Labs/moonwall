import fs from "node:fs";
import { LaunchConfig } from "@zombienet/orchestrator";
import { checkExists } from "./files.js";

export async function checkZombieBins(config: LaunchConfig) {
  const relayBinPath = config.relaychain.default_command;
  await checkExists(relayBinPath);

  const promises = config.parachains.map((para) => {
    checkExists(para.collator.command);
  });
  await Promise.all(promises);
}

export function getZombieConfig(path: string) {
  const buffer = fs.readFileSync(path, "utf-8");
  return JSON.parse(buffer) as LaunchConfig;
}
