import { ChopsticksLaunchSpec, DevLaunchSpec, GenericLaunchSpec } from "../lib/types";

// export function parseRunCmd(launchSpec: ChopsticksLaunchSpec ): {cmd: string, args:string}
// export function parseRunCmd(launchSpec: DevLaunchSpec ): {cmd: string, args:string}
export function parseRunCmd(launchSpec: DevLaunchSpec ){
    const cmd = launchSpec.binPath
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
    return {cmd, args}
}

export function parseChopsticksRunCmd(launchSpec: ChopsticksLaunchSpec ){
  const chopsticksCmd = "npx"
  const chopsticksArgs = ["chopsticks" ,"run",`--config=${launchSpec.configPath}`]
  return {cmd: chopsticksCmd, args:chopsticksArgs}
}
