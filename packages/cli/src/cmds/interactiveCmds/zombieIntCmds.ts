import inquirer from "inquirer";
import { sendIpcMessage } from "../../internal/foundations/zombieHelpers";

export async function resolveZombieInteractiveCmdChoice() {
  const choice = await inquirer.prompt({
    name: "cmd",
    type: "list",
    choices: [
      { name: "♻️  Restart Node", value: "restart" },
      { name: "🗡️  Kill Node", value: "kill" },
      new inquirer.Separator(),
      { name: "🔙  Go Back", value: "back" },
    ],
    message: "What command would you like to run? ",
    default: "back",
  });

  if (choice.cmd == "back") {
    return;
  } else {
    const whichNode = await inquirer.prompt({
      name: "nodeName",
      type: "input",
      message: `Which node would you like to ${choice.cmd}? `,
    });

    try {
      await sendIpcMessage({
        cmd: choice.cmd,
        nodeName: whichNode.nodeName,
        text: `Running ${choice.cmd} on ${whichNode.nodeName}`,
      });
    } catch (e: any) {
      console.error("Error: ");
      console.error(e.message);
    }
  }

  return;
}
