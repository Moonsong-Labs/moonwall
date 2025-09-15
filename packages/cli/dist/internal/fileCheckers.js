// src/internal/fileCheckers.ts
import fs from "fs";
import { execSync } from "child_process";
import chalk from "chalk";
import os from "os";
import path from "path";
import { select } from "@inquirer/prompts";
async function checkExists(path2) {
  const binPath = path2.split(" ")[0];
  const fsResult = fs.existsSync(binPath);
  if (!fsResult) {
    throw new Error(
      `No binary file found at location: ${binPath} 
 Are you sure your ${chalk.bgWhiteBright.blackBright(
   "moonwall.config.json"
 )} file has the correct "binPath" in launchSpec?`
    );
  }
  const binArch = await getBinaryArchitecture(binPath);
  const currentArch = os.arch();
  if (binArch !== currentArch && binArch !== "unknown") {
    throw new Error(
      `The binary architecture ${chalk.bgWhiteBright.blackBright(
        binArch
      )} does not match this system's architecture ${chalk.bgWhiteBright.blackBright(currentArch)}
Download or compile a new binary executable for ${chalk.bgWhiteBright.blackBright(currentArch)} `
    );
  }
  return true;
}
async function downloadBinsIfMissing(binPath) {
  const binName = path.basename(binPath);
  const binDir = path.dirname(binPath);
  const binPathExists = fs.existsSync(binPath);
  if (!binPathExists && process.arch === "x64") {
    const download = await select({
      message: `The binary ${chalk.bgBlack.greenBright(
        binName
      )} is missing from ${chalk.bgBlack.greenBright(path.join(process.cwd(), binDir))}.
Would you like to download it now?`,
      default: 0,
      choices: [
        { name: `Yes, download ${binName}`, value: true },
        { name: "No, quit program", value: false },
      ],
    });
    if (!download) {
      process.exit(0);
    } else {
      execSync(`mkdir -p ${binDir}`);
      execSync(`pnpm moonwall download ${binName} latest ${binDir}`, {
        stdio: "inherit",
      });
    }
  } else if (!binPathExists) {
    console.log(
      `The binary: ${chalk.bgBlack.greenBright(
        binName
      )} is missing from: ${chalk.bgBlack.greenBright(path.join(process.cwd(), binDir))}`
    );
    console.log(
      `Given you are running ${chalk.bgBlack.yellowBright(
        process.arch
      )} architecture, you will need to build it manually from source \u{1F6E0}\uFE0F`
    );
    throw new Error("Executable binary not available");
  }
}
function checkListeningPorts(processId) {
  try {
    const stdOut = execSync(`lsof -p  ${processId} | grep LISTEN`, {
      encoding: "utf-8",
    });
    const binName = stdOut.split("\n")[0].split(" ")[0];
    const ports = stdOut
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const port = line.split(":")[1];
        return port.split(" ")[0];
      });
    const filtered = new Set(ports);
    return { binName, processId, ports: [...filtered].sort() };
  } catch (e) {
    const binName = execSync(`ps -p ${processId} -o comm=`).toString().trim();
    console.log(
      `Process ${processId} is running which for binary ${binName}, however it is unresponsive.`
    );
    console.log(
      "Running Moonwall with this in the background may cause unexpected behaviour. Please manually kill the process and try running Moonwall again."
    );
    console.log(`N.B. You can kill it with: sudo kill -9 ${processId}`);
    throw new Error(e);
  }
}
function checkAlreadyRunning(binaryName) {
  try {
    console.log(`Checking if ${chalk.bgWhiteBright.blackBright(binaryName)} is already running...`);
    const stdout = execSync(`pgrep ${[binaryName.slice(0, 14)]}`, {
      encoding: "utf8",
      timeout: 2e3,
    });
    const pIdStrings = stdout.split("\n").filter(Boolean);
    return pIdStrings.map((pId) => Number.parseInt(pId, 10));
  } catch (error) {
    if (error.status === 1) {
      return [];
    }
    throw error;
  }
}
async function promptAlreadyRunning(pids) {
  const alreadyRunning = await select({
    message: `The following processes are already running: 
${pids
  .map((pid) => {
    const { binName, ports } = checkListeningPorts(pid);
    return `${binName} - pid: ${pid}, listenPorts: [${ports.join(", ")}]`;
  })
  .join("\n")}`,
    default: 1,
    choices: [
      { name: "\u{1FA93}  Kill processes and continue", value: "kill" },
      { name: "\u27A1\uFE0F   Continue (and let processes live)", value: "continue" },
      { name: "\u{1F6D1}  Abort (and let processes live)", value: "abort" },
    ],
  });
  switch (alreadyRunning) {
    case "kill":
      for (const pid of pids) {
        execSync(`kill ${pid}`);
      }
      break;
    case "continue":
      break;
    case "abort":
      throw new Error("Abort Signal Picked");
  }
}
function checkAccess(path2) {
  const binPath = path2.split(" ")[0];
  try {
    fs.accessSync(binPath, fs.constants.X_OK);
  } catch (err) {
    console.error(`The file ${binPath} is not executable`);
    throw new Error(`The file at ${binPath} , lacks execute permissions.`);
  }
}
async function getBinaryArchitecture(filePath) {
  return new Promise((resolve, reject) => {
    const architectureMap = {
      0: "unknown",
      3: "x86",
      62: "x64",
      183: "arm64",
    };
    fs.open(filePath, "r", (err, fd) => {
      if (err) {
        reject(err);
        return;
      }
      const buffer = Buffer.alloc(20);
      fs.read(fd, buffer, 0, 20, 0, (err2, bytesRead, buffer2) => {
        if (err2) {
          reject(err2);
          return;
        }
        const e_machine = buffer2.readUInt16LE(18);
        const architecture = architectureMap[e_machine] || "unknown";
        resolve(architecture);
      });
    });
  });
}
export {
  checkAccess,
  checkAlreadyRunning,
  checkExists,
  checkListeningPorts,
  downloadBinsIfMissing,
  promptAlreadyRunning,
};
