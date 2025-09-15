// src/internal/foundations/zombieHelpers.ts
import chalk2 from "chalk";
import fs2 from "fs";
import invariant from "tiny-invariant";

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

// src/internal/foundations/zombieHelpers.ts
import { setTimeout as timer } from "timers/promises";
import net from "net";
async function checkZombieBins(config) {
  const relayBinPath = config.relaychain.default_command;
  if (!relayBinPath) {
    throw new Error("No relayBinPath '[relaychain.default_command]' specified in zombie config");
  }
  await checkExists(relayBinPath);
  checkAccess(relayBinPath);
  if (config.parachains) {
    const promises = config.parachains.map((para) => {
      if (para.collator) {
        if (!para.collator.command) {
          throw new Error(
            "No command found for collator, please check your zombienet config file for collator command"
          );
        }
        checkExists(para.collator.command);
        checkAccess(para.collator.command);
      }
      if (para.collators) {
        for (const coll of para.collators) {
          if (!coll.command) {
            throw new Error(
              "No command found for collators, please check your zombienet config file for collators command"
            );
          }
          checkExists(coll.command);
          checkAccess(coll.command);
        }
      }
    });
    await Promise.all(promises);
  }
}
function getZombieConfig(path2) {
  const fsResult = fs2.existsSync(path2);
  if (!fsResult) {
    throw new Error(
      `No ZombieConfig file found at location: ${path2} 
 Are you sure your ${chalk2.bgWhiteBright.blackBright(
   "moonwall.config.json"
 )} file has the correct "configPath" in zombieSpec?`
    );
  }
  const buffer = fs2.readFileSync(path2, "utf-8");
  return JSON.parse(buffer);
}
async function sendIpcMessage(message) {
  return new Promise(async (resolve, reject) => {
    let response;
    const ipcPath = process.env.MOON_IPC_SOCKET;
    invariant(ipcPath, "No IPC path found. This is a bug, please report it.");
    const client = net.createConnection({ path: ipcPath }, () => {
      console.log("\u{1F4E8} Successfully connected to IPC server");
    });
    client.on("error", (err) => {
      console.error("\u{1F4E8} IPC client connection error:", err);
    });
    client.on("data", async (data) => {
      response = JSON.parse(data.toString());
      if (response.status === "success") {
        client.end();
        for (let i = 0; ; i++) {
          if (client.closed) {
            break;
          }
          if (i > 100) {
            reject(new Error("Closing IPC connection failed"));
          }
          await timer(200);
        }
        resolve(response);
      }
      if (response.status === "failure") {
        reject(new Error(JSON.stringify(response)));
      }
    });
    for (let i = 0; ; i++) {
      if (!client.connecting) {
        break;
      }
      if (i > 100) {
        reject(new Error(`Connection to ${ipcPath} failed`));
      }
      await timer(200);
    }
    await new Promise((resolve2) => {
      client.write(JSON.stringify(message), () => resolve2("Sent!"));
    });
  });
}
export { checkZombieBins, getZombieConfig, sendIpcMessage };
