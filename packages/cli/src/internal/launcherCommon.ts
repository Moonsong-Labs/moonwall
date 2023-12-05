import { NodeContext } from "@effect/platform-node";
import { Environment } from "@moonwall/types";
import chalk from "chalk";
import { execSync } from "child_process";
import { Effect } from "effect";
import fs from "fs";
import path from "path";
import * as Err from "../errors";
import {
  importJsonConfig,
  importMoonwallConfig,
  parseZombieConfigForBins,
} from "../lib/configReader";
import { checkAlreadyRunning, downloadBinsIfMissing, promptAlreadyRunning } from "./fileCheckers";

export const commonChecks = (env: Environment) =>
  Effect.gen(function* (_) {
    yield* _(Effect.logDebug("Running common checks"));
    const globalConfig = yield* _(importMoonwallConfig());

    if (env.foundation.type == "dev") {
      yield* _(devBinCheck(env));
    }

    if (env.foundation.type == "zombie") {
      yield* _(Effect.promise(() => zombieBinCheck(env)));
    }

    if (
      process.env.MOON_RUN_SCRIPTS == "true" &&
      globalConfig.scriptsDir &&
      env.runScripts &&
      env.runScripts.length > 0
    ) {
      for (const scriptCommand of env.runScripts) {
        yield* _(Effect.promise(() => executeScript(scriptCommand)));
      }
    }
  });

async function zombieBinCheck(env: Environment) {
  if (env.foundation.type !== "zombie") {
    throw new Error("This function is only for zombie environments");
  }

  const bins = parseZombieConfigForBins(env.foundation.zombieSpec.configPath);
  // const pids = (await Promise.all(bins.flatMap((bin) => checkAlreadyRunning(bin)))).flat();

  const pids = (await Promise.all(
    bins.flatMap((bin) =>
      Effect.runPromise(Effect.provide(checkAlreadyRunning(bin), NodeContext.layer))
    )
  )) as any;
  return (
    pids.length == 0 || process.env.CI || (await promptAlreadyRunning(pids.map((a) => parseInt(a))))
  );
}

const devBinCheck = (env: Environment) =>
  Effect.gen(function* (_) {
    if (env.foundation.type !== "dev") {
      return new Err.CommonCheckError();
    }

    const binName = path.basename(env.foundation.launchSpec[0].binPath);

    const pids = yield* _(checkAlreadyRunning(binName));
    pids.length == 0 ||
      process.env.CI ||
      (yield* _(Effect.promise(() => promptAlreadyRunning(pids.map((a) => parseInt(a))))));
    yield* _(
      Effect.promise(() => downloadBinsIfMissing((env.foundation as any).launchSpec[0].binPath))
    );
  });

// async function devBinCheck(env: Environment) {
//   if (env.foundation.type !== "dev") {
//     throw new Error("This function is only for dev environments");
//   }

//   const binName = path.basename(env.foundation.launchSpec[0].binPath);
//   // const pids = await checkAlreadyRunning(binName);
//   const pids = (await Effect.runPromise(
//     Effect.provide(checkAlreadyRunning(binName), NodeContext.layer)
//   )) as any;
//   pids.length == 0 || process.env.CI || (await promptAlreadyRunning(pids.map((a) => parseInt(a))));
//   await downloadBinsIfMissing(env.foundation.launchSpec[0].binPath);
// }

export async function executeScript(scriptCommand: string, args?: string) {
  const scriptsDir = importJsonConfig().scriptsDir;
  const files = await fs.promises.readdir(scriptsDir);

  try {
    const script = scriptCommand.split(" ")[0];
    const ext = path.extname(script);
    const scriptPath = path.join(process.cwd(), scriptsDir, scriptCommand);

    if (!files.includes(script)) {
      throw new Error(`Script ${script} not found in ${scriptsDir}`);
    }

    console.log(`========== Executing script: ${chalk.bgGrey.greenBright(script)} ==========`);

    switch (ext) {
      case ".js": {
        execSync("node " + scriptPath + ` ${args}`, { stdio: "inherit" });
        break;
      }
      case ".ts": {
        execSync("pnpm tsx " + scriptPath + ` ${args}`, { stdio: "inherit" });
        break;
      }
      case ".sh": {
        execSync(scriptPath + ` ${args}`, { stdio: "inherit" });
        break;
      }
      default:
        console.log(`${ext} not supported, skipping ${script}`);
    }
  } catch (err) {
    console.error(`Error executing script: ${chalk.bgGrey.redBright(err)}`);
  }
}
