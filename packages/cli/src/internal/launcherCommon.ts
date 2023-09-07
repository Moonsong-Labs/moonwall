import { Environment } from "@moonwall/types";
import { checkAlreadyRunning, downloadBinsIfMissing, promptAlreadyRunning } from "./fileCheckers";
import { parseZombieConfigForBins } from "../lib/configReader";
import path from "path"

export async function zombieBinCheck(env: Environment) {
    if (env.foundation.type !== "zombie") {
      throw new Error("This function is only for zombie environments");
    }
    
    const bins = parseZombieConfigForBins(env.foundation.zombieSpec.configPath);
    const pids = bins.flatMap((bin) => checkAlreadyRunning(bin));
    pids.length == 0 || process.env.CI || (await promptAlreadyRunning(pids));
  }
  
  export async function devBinCheck(env: Environment) {
    if (env.foundation.type !== "dev") {
      throw new Error("This function is only for dev environments");
    }
  
    const binName = path.basename(env.foundation.launchSpec[0].binPath);
    const pids = checkAlreadyRunning(binName);
    pids.length == 0 || process.env.CI || (await promptAlreadyRunning(pids));
    await downloadBinsIfMissing(env.foundation.launchSpec[0].binPath);
  }
  
  