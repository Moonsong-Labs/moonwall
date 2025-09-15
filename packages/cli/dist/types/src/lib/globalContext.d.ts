import "@moonbeam-network/api-augment";
import type {
  ConnectedProvider,
  FoundationType,
  LaunchOverrides,
  MoonwallConfig,
  MoonwallEnvironment,
  MoonwallProvider,
} from "@moonwall/types";
import { type Network } from "@zombienet/orchestrator";
import net from "node:net";
import { ChildProcess } from "node:child_process";
import Docker from "dockerode";
export declare class MoonwallContext {
  private static instance;
  configured: boolean;
  environment: MoonwallEnvironment;
  providers: ConnectedProvider[];
  nodes: (ChildProcess | Docker.Container)[];
  foundation: FoundationType;
  zombieNetwork?: Network;
  rtUpgradePath?: string;
  ipcServer?: net.Server;
  injectedOptions?: LaunchOverrides;
  private nodeCleanupHandlers;
  constructor(config: MoonwallConfig, options?: LaunchOverrides);
  setupFoundation(): Promise<void>;
  private handleZombie;
  private handleDev;
  private handleReadOnly;
  private handleChopsticks;
  private startZombieNetwork;
  startNetwork(): Promise<void | MoonwallContext>;
  connectEnvironment(silent?: boolean): Promise<MoonwallContext>;
  private handleZombiePostConnection;
  disconnect(providerName?: string): Promise<void>;
  static getContext(
    config?: MoonwallConfig,
    options?: LaunchOverrides,
    force?: boolean
  ): Promise<MoonwallContext>;
  static destroy(reason?: string): Promise<void>;
}
export declare const contextCreator: (options?: LaunchOverrides) => Promise<MoonwallContext>;
export declare const runNetworkOnly: () => Promise<void>;
export interface IGlobalContextFoundation {
  name: string;
  context?: object;
  providers?: MoonwallProvider[];
  nodes?: {
    name?: string;
    cmd: string;
    args: string[];
    launch: boolean;
  }[];
  foundationType: FoundationType;
}
