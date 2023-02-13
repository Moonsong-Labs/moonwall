"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchDevNode = void 0;
const child_process_1 = require("child_process");
const globalContext_1 = require("./globalContext");
const debugNode = require("debug")("global:node");
async function launchDevNode(cmd, args, name) {
    const nodesList = globalContext_1.MoonwallContext.getContext().nodes;
    const currentNode = nodesList.length + 1;
    nodesList[currentNode] = null;
    const onProcessExit = () => {
        nodesList[currentNode] && nodesList[currentNode].kill();
    };
    const onProcessInterrupt = () => {
        process.exit(2);
    };
    process.once("exit", onProcessExit);
    process.once("SIGINT", onProcessInterrupt);
    nodesList[currentNode] = (0, child_process_1.spawn)(cmd, args);
    nodesList[currentNode].once("exit", () => {
        process.removeListener("exit", onProcessExit);
        process.removeListener("SIGINT", onProcessInterrupt);
        debugNode(`Exiting dev node: ${name}`);
    });
    nodesList[currentNode].on("error", (err) => {
        if (err.errno == "ENOENT") {
            console.error(`\x1b[31mMissing Moonbeam binary at` +
                `(${cmd}).\nPlease compile the Moonbeam project\x1b[0m`);
        }
        else {
            console.error(err);
        }
        process.exit(1);
    });
    const binaryLogs = [];
    return await new Promise((resolve) => {
        const timer = setTimeout(() => {
            console.error(`\x1b[31m Failed to start Moonbeam Test Node.\x1b[0m`);
            console.error(`Command: ${cmd} ${args.join(" ")}`);
            console.error(`Logs:`);
            console.error(binaryLogs.map((chunk) => chunk.toString()).join("\n"));
            throw new Error("Failed to launch node");
        }, 15000);
        const onData = async (chunk) => {
            debugNode(chunk.toString());
            binaryLogs.push(chunk);
            if (chunk.toString().match(/Development Service Ready/)) {
                clearTimeout(timer);
                if (true) {
                    nodesList[currentNode].stderr.off("data", onData);
                    nodesList[currentNode].stdout.off("data", onData);
                }
                resolve();
            }
        };
        nodesList[currentNode].stderr.on("data", onData);
        nodesList[currentNode].stdout.on("data", onData);
    });
}
exports.launchDevNode = launchDevNode;
//# sourceMappingURL=LocalNode.js.map