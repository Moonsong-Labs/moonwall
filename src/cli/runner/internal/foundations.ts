import {
  ChopsticksLaunchSpec,
  DevLaunchSpec,
  GenericLaunchSpec,
} from "../../../types/configAndContext";

// export function parseRunCmd(launchSpec: ChopsticksLaunchSpec ): {cmd: string, args:string}
// export function parseRunCmd(launchSpec: DevLaunchSpec ): {cmd: string, args:string}
export function parseRunCmd(launchSpec: DevLaunchSpec) {
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

// export function parseChopsticksRunCmd(launchSpec: ChopsticksLaunchSpec) {
//   const chopsticksCmd = "node";
//   const chopsticksArgs = [
//     "node_modules/@acala-network/chopsticks/chopsticks.js",
//     "dev",
//     `--config=${launchSpec.configPath}`,
//   ];

//   if (launchSpec.wsPort) {
//     chopsticksArgs.push(`--port=${launchSpec.wsPort}`);
//   }

//   return { cmd: chopsticksCmd, args: chopsticksArgs };
// }

export function parseChopsticksRunCmd(launchSpecs: ChopsticksLaunchSpec[]): {
  cmd: string;
  args: string[];
  // rtUpgradePath: string;
} {
  if (launchSpecs.length === 1) {
    const chopsticksCmd = "node";
    const chopsticksArgs = [
      "node_modules/@acala-network/chopsticks/chopsticks.js",
      "dev",
      `--config=${launchSpecs[0].configPath}`,
    ];

    const mode = launchSpecs[0].buildBlockMode
      ? launchSpecs[0].buildBlockMode
      : "manual";
    const num = mode == "batch" ? 0 : mode == "instant" ? 1 : 2;
    chopsticksArgs.push(`--build-block-mode=${num}`);

    if (launchSpecs[0].wsPort) {
      chopsticksArgs.push(`--port=${launchSpecs[0].wsPort}`);
    }

    return {
      cmd: chopsticksCmd,
      args: chopsticksArgs,
    };
  }

  const chopsticksCmd = "node";
  const chopsticksArgs = [
    "node_modules/@acala-network/chopsticks/chopsticks.js",
    "xcm",
  ];

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
    // rtUpgradePath: launchSpecs[0].rtUpgradePath
    //   ? launchSpecs[0].rtUpgradePath
    //   : "",
  };
}
