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

// src/internal/foundations/zombieHelpers.ts
import { setTimeout as timer } from "timers/promises";
import net from "net";
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

// src/cmds/interactiveCmds/zombieIntCmds.ts
import { input, select as select2, Separator } from "@inquirer/prompts";
async function resolveZombieInteractiveCmdChoice() {
  const cmd = await select2({
    choices: [
      { name: "\u267B\uFE0F  Restart Node", value: "restart" },
      { name: "\u{1F5E1}\uFE0F  Kill Node", value: "kill" },
      new Separator(),
      { name: "\u{1F519}  Go Back", value: "back" },
    ],
    message: "What command would you like to run? ",
    default: "back",
  });
  if (cmd === "back") {
    return;
  }
  const whichNode = await input({
    message: `Which node would you like to ${cmd}? `,
  });
  try {
    await sendIpcMessage({
      cmd,
      nodeName: whichNode,
      text: `Running ${cmd} on ${whichNode}`,
    });
  } catch (e) {
    console.error("Error: ");
    console.error(e.message);
  }
  return;
}
export { resolveZombieInteractiveCmdChoice };
