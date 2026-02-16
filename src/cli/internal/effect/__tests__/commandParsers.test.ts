import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import type { DevLaunchSpec } from "../../../../api/types/index.js";
import { LaunchCommandParser } from "../../commandParsers.js";

const minimalSpec: DevLaunchSpec = {
  name: "test-node",
  binPath: "/usr/bin/moonbeam",
  options: ["--dev"],
};

describe("LaunchCommandParser.withPorts", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      MOONWALL_RPC_PORT: process.env.MOONWALL_RPC_PORT,
      MOON_RECYCLE: process.env.MOON_RECYCLE,
    };
    delete process.env.MOONWALL_RPC_PORT;
    delete process.env.MOON_RECYCLE;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("should pre-allocate a free port when no explicit ports configured", async () => {
    const parser = new LaunchCommandParser({ launchSpec: minimalSpec });
    await parser.withPorts();
    const { args } = parser.build();
    expect(args.some((a) => a.includes("--rpc-port"))).toBe(true);
    expect(process.env.MOONWALL_RPC_PORT).toBeDefined();
  });

  it("should add explicit ports when configured in launchSpec", async () => {
    const spec: DevLaunchSpec = {
      ...minimalSpec,
      ports: { rpcPort: 9944, p2pPort: 30333, wsPort: 9945 },
    };
    const parser = new LaunchCommandParser({ launchSpec: spec });
    await parser.withPorts();
    const { args } = parser.build();
    expect(args).toContain("--rpc-port=9944");
    expect(args).toContain("--port=30333");
    expect(args).toContain("--ws-port=9945");
  });

  it("should pre-allocate port for Docker containers", async () => {
    const spec: DevLaunchSpec = {
      ...minimalSpec,
      useDocker: true,
    };
    const parser = new LaunchCommandParser({ launchSpec: spec });
    await parser.withPorts();
    const { args } = parser.build();
    expect(args.some((a) => a.includes("--rpc-port"))).toBe(true);
    expect(process.env.MOONWALL_RPC_PORT).toBeDefined();
  });

  it("should use existing port in RECYCLE mode", async () => {
    process.env.MOON_RECYCLE = "true";
    process.env.MOONWALL_RPC_PORT = "12345";

    const parser = new LaunchCommandParser({ launchSpec: minimalSpec });
    await parser.withPorts();
    const { args } = parser.build();
    expect(args).toContain("--rpc-port=12345");
  });

  it("should not add --rpc-port in RECYCLE mode when MOONWALL_RPC_PORT is unset", async () => {
    process.env.MOON_RECYCLE = "true";

    const parser = new LaunchCommandParser({ launchSpec: minimalSpec });
    await parser.withPorts();
    const { args } = parser.build();
    expect(args.some((a) => a.includes("--rpc-port"))).toBe(false);
  });
});
