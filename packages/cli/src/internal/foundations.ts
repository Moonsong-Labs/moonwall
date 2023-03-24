import {
  ChopsticksLaunchSpec,
  DevLaunchSpec,
  ZombieLaunchSpec,
} from "../types/config.js";

export function parseZombieCmd(launchSpec: ZombieLaunchSpec) {
  return { cmd: launchSpec.configPath };
}

export function parseRunCmd(launchSpec: DevLaunchSpec) {
  const launch = !!!launchSpec.running ? true : launchSpec.running;
  const cmd = launchSpec.binPath;
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

  `ws://127.0.0.1:${10000 + Number(process.env.VITEST_POOL_ID) * 100}`;

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
  } else {
    args.push(`--port=${10000 + Number(process.env.VITEST_POOL_ID || 1) * 100 + 2}`);
    args.push(`--ws-port=${10000 + Number(process.env.VITEST_POOL_ID || 1) * 100}`);
    args.push(`--rpc-port=${10000 + (Number(process.env.VITEST_POOL_ID || 1) * 100 + 1)}`);
  }
  return { cmd, args, launch };
}

export function parseChopsticksRunCmd(launchSpecs: ChopsticksLaunchSpec[]): {
  cmd: string;
  args: string[];
  launch: boolean;
} {
  const launch = !!!launchSpecs[0].running ? true : launchSpecs[0].running;
  if (launchSpecs.length === 1) {
    const chopsticksCmd = "node";
    const chopsticksArgs = [
      "node_modules/@acala-network/chopsticks/chopsticks.js",
      "dev",
      `--config=${launchSpecs[0].configPath}`,
    ];

    const mode = launchSpecs[0].buildBlockMode ? launchSpecs[0].buildBlockMode : "manual";
    const num = mode == "batch" ? 0 : mode == "instant" ? 1 : 2;
    chopsticksArgs.push(`--build-block-mode=${num}`);

    if (launchSpecs[0].wsPort) {
      chopsticksArgs.push(`--port=${launchSpecs[0].wsPort}`);
    }

    if (launchSpecs[0].wasmOverride) {
      chopsticksArgs.push(`--wasm-override=${launchSpecs[0].wasmOverride}`);
    }

    return {
      cmd: chopsticksCmd,
      args: chopsticksArgs,
      launch,
    };
  }

  const chopsticksCmd = "node";
  const chopsticksArgs = ["node_modules/@acala-network/chopsticks/chopsticks.js", "xcm"];

  launchSpecs.forEach((spec) => {
    const type = spec.type ? spec.type : "parachain";
    switch (type) {
      case "parachain":
        chopsticksArgs.push(`--parachain=${spec.configPath}`);
        break;
      case "relaychain":
        chopsticksArgs.push(`--relaychain=${spec.configPath}`);
    }
  });

  return {
    cmd: chopsticksCmd,
    args: chopsticksArgs,
    launch,
    // rtUpgradePath: launchSpecs[0].rtUpgradePath
    //   ? launchSpecs[0].rtUpgradePath
    //   : "",
  };
}
