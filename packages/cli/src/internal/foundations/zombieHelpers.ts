import { LaunchConfig } from "@zombienet/orchestrator";
import chalk from "chalk";
import fs from "node:fs";
import { checkAccess, checkExists } from "../fileCheckers";
import { setTimeout as timer } from "timers/promises";
import net from "net";

export async function checkZombieBins(config: LaunchConfig) {
  const relayBinPath = config.relaychain.default_command!;
  await checkExists(relayBinPath);
  checkAccess(relayBinPath);

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
      para.collators.forEach((coll) => {
        if (!coll.command) {
          throw new Error(
            "No command found for collators, please check your zombienet config file for para collators command"
          );
        }
        checkExists(coll.command);
        checkAccess(coll.command);
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

export type IPCRequestMessage = {
  text: string;
  cmd: "restart" | "pause" | "resume" | "kill" | "isup";
  nodeName: string;
};

export type IPCResponseMessage = {
  status: "success" | "failure";
  result: boolean;
  message: string;
};

export async function sendIpcMessage(message: IPCRequestMessage) {
  let resume = false;
  let response: IPCResponseMessage;
  const ipcPath = process.env.MOON_IPC_SOCKET;
  const client = net.createConnection({ path: ipcPath }, () => {
    client.write("Connected to server!");
  });

  // Listener to return control flow after server responds
  client.on("data", (data) => {
    response = JSON.parse(data.toString());
    if (response.status === "success") {
      resume = true;
    }
  });

  for (let i = 0; ; i++) {
    if (!client.connecting) {
      break;
    }

    if (i > 100) {
      throw new Error(`Connection to ${ipcPath} failed`);
    }
    await timer(100);
  }

  await new Promise((resolve) => {
    client.write(JSON.stringify(message), () => resolve("Sent!"));
  });

  for (let i = 0; ; i++) {
    if (resume) {
      break;
    }

    if (i > 100) {
      throw new Error(`${message.text} failed`);
    }
    await timer(100);
  }

  client.end();

  for (let i = 0; ; i++) {
    if (client.closed) {
      break;
    }

    if (i > 100) {
      throw new Error(`Closing IPC connection failed`);
    }
    await timer(100);
  }

  return response;
}
