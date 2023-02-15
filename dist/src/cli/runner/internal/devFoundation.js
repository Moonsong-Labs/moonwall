"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRunCmd = void 0;
function parseRunCmd(launchSpec) {
    const cmd = launchSpec.bin.path;
    let args = launchSpec.options
        ? [...launchSpec.options]
        : [
            "--no-hardware-benchmarks",
            "--no-telemetry",
            "--reserved-only",
            "--rpc-cors=all",
            "--no-grandpa",
            "--sealing=manual",
            "--force-authoring",
            "--no-prometheus",
            "--alice",
            "--chain=moonbase-dev",
            "--in-peers=0",
            "--out-peers=0",
            "--tmp",
        ];
    if (launchSpec.ports) {
        const ports = launchSpec.ports;
        if (ports.p2pPort) {
            args.push(`--port=${ports.p2pPort}`);
        }
        if (ports.wsPort) {
            args.push(`--ws-port=${ports.wsPort}`);
        }
        if (ports.rpcPort) {
            args.push(`--rpc-port=${ports.rpcPort}`);
        }
    }
    return { cmd, args };
}
exports.parseRunCmd = parseRunCmd;
//# sourceMappingURL=devFoundation.js.map