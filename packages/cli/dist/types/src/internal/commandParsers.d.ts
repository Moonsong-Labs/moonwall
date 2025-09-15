import type {
  ChopsticksLaunchSpec,
  DevLaunchSpec,
  RepoSpec,
  ZombieLaunchSpec,
  LaunchOverrides,
} from "@moonwall/types";
export declare function parseZombieCmd(launchSpec: ZombieLaunchSpec): {
  cmd: string;
};
export declare class LaunchCommandParser {
  private args;
  private cmd;
  private launch;
  private launchSpec;
  private additionalRepos?;
  private launchOverrides?;
  constructor(options: {
    launchSpec: DevLaunchSpec;
    additionalRepos?: RepoSpec[];
    launchOverrides?: LaunchOverrides;
  });
  private overrideArg;
  withPorts(): Promise<this>;
  withDefaultForkConfig(): LaunchCommandParser;
  withLaunchOverrides(): LaunchCommandParser;
  private print;
  private applyForkOptions;
  build(): {
    cmd: string;
    args: string[];
    launch: boolean;
  };
  static create(options: {
    launchSpec: DevLaunchSpec;
    additionalRepos?: RepoSpec[];
    launchOverrides?: LaunchOverrides;
    verbose?: boolean;
  }): Promise<{
    cmd: string;
    args: string[];
    launch: boolean;
  }>;
}
export declare function parseChopsticksRunCmd(launchSpecs: ChopsticksLaunchSpec[]): {
  cmd: string;
  args: string[];
  launch: boolean;
};
/**
 * Get a free port with availability checking
 * Uses async port allocation for better collision avoidance
 */
export declare const getFreePort: () => Promise<number>;
