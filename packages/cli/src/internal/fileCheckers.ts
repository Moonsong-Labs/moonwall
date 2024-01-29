import fs from "node:fs";
import { execSync } from "child_process";
import chalk from "chalk";
import os from "node:os";
import inquirer from "inquirer";
import path from "node:path";

export async function checkExists(path: string) {
  const binPath = path.split(" ")[0];
  const fsResult = fs.existsSync(binPath);
  if (!fsResult) {
    throw new Error(
      `No binary file found at location: ${binPath} \n Are you sure your ${chalk.bgWhiteBright.blackBright(
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
      )} does not match this system's architecture ${chalk.bgWhiteBright.blackBright(
        currentArch
      )}\nDownload or compile a new binary executable for ${chalk.bgWhiteBright.blackBright(
        currentArch
      )} `
    );
  }

  return true;
}

export async function downloadBinsIfMissing(binPath: string) {
  const binName = path.basename(binPath);
  const binDir = path.dirname(binPath);
  const binPathExists = fs.existsSync(binPath);
  if (!binPathExists && process.arch === "x64") {
    const choices = await inquirer.prompt({
      name: "download",
      type: "list",
      message: `The binary ${chalk.bgBlack.greenBright(
        binName
      )} is missing from ${chalk.bgBlack.greenBright(
        path.join(process.cwd(), binDir)
      )}.\nWould you like to download it now?`,
      default: 0,
      choices: [
        { name: `Yes, download ${binName}`, value: true },
        { name: "No, quit program", value: false },
      ],
    });

    if (!choices.download) {
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
      )} architecture, you will need to build it manually from source 🛠️`
    );
    throw new Error("Executable binary not available");
  }
}

export function checkListeningPorts(processId: number) {
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
  } catch (e: any) {
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

export function checkAlreadyRunning(binaryName: string): number[] {
  try {
    console.log(`Checking if ${chalk.bgWhiteBright.blackBright(binaryName)} is already running...`);
    // pgrep only supports 15 characters
    const stdout = execSync(`pgrep ${[binaryName.slice(0, 14)]}`, {
      encoding: "utf8",
      timeout: 2000,
    });
    const pIdStrings = stdout.split("\n").filter(Boolean);
    return pIdStrings.map((pId) => parseInt(pId, 10));
  } catch (error: any) {
    if (error.status === 1) {
      return [];
    }
    throw error;
  }
}

export async function promptAlreadyRunning(pids: number[]) {
  const choice = await inquirer.prompt({
    name: "AlreadyRunning",
    type: "list",
    message: `The following processes are already running: \n${pids
      .map((pid) => {
        const { binName, ports } = checkListeningPorts(pid);
        return `${binName} - pid: ${pid}, listenPorts: [${ports.join(", ")}]`;
      })
      .join("\n")}`,
    default: 1,
    choices: [
      { name: "🪓  Kill processes and continue", value: "kill" },
      { name: "➡️   Continue (and let processes live)", value: "continue" },
      { name: "🛑  Abort (and let processes live)", value: "abort" },
    ],
  });

  switch (choice.AlreadyRunning) {
    case "kill":
      pids.forEach((pid) => {
        execSync(`kill ${pid}`);
      });
      break;

    case "continue":
      break;

    case "abort":
      throw new Error("Abort Signal Picked");
  }
}

export function checkAccess(path: string) {
  const binPath = path.split(" ")[0];
  try {
    fs.accessSync(binPath, fs.constants.X_OK);
  } catch (err) {
    console.error(`The file ${binPath} is not executable`);
    throw new Error(`The file at ${binPath} , lacks execute permissions.`);
  }
}

async function getBinaryArchitecture(filePath: string) {
  return new Promise((resolve, reject) => {
    const architectureMap = {
      0x0: "unknown",
      0x03: "x86",
      0x3e: "x64",
      0xb7: "arm64",
    };

    fs.open(filePath, "r", (err, fd) => {
      if (err) {
        reject(err);
        return;
      }

      const buffer = Buffer.alloc(20);
      fs.read(fd, buffer, 0, 20, 0, (err, bytesRead, buffer) => {
        if (err) {
          reject(err);
          return;
        }

        // if (
        //   buffer.readUInt8(0) !== 0x7f ||
        //   buffer.readUInt8(1) !== 0x45 ||
        //   buffer.readUInt8(2) !== 0x4c ||
        //   buffer.readUInt8(3) !== 0x46
        // ) {
        //   // reject(new Error("Not an ELF file"));
        //   return;
        // }

        const e_machine = buffer.readUInt16LE(18);
        const architecture = architectureMap[e_machine] || "unknown";
        resolve(architecture);
      });
    });
  });
}
