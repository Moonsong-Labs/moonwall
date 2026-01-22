import { type CmdCodes, sendIpcMessage } from "../../internal/foundations/zombieHelpers.js";
import { input, select, Separator } from "@inquirer/prompts";

export async function resolveZombieInteractiveCmdChoice() {
  const cmd = await select({
    choices: [
      { name: "♻️  Restart Node", value: "restart" },
      { name: "🗡️  Kill Node", value: "kill" },
      new Separator(),
      { name: "🔙  Go Back", value: "back" },
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
      cmd: cmd as CmdCodes,
      nodeName: whichNode,
      text: `Running ${cmd} on ${whichNode}`,
    });
  } catch (e: any) {
    console.error("Error: ");
    console.error(e.message);
  }

  return;
}
