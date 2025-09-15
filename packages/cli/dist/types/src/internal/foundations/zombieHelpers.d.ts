import type { LaunchConfig } from "@zombienet/orchestrator";
export declare function checkZombieBins(config: LaunchConfig): Promise<void>;
export declare function getZombieConfig(path: string): LaunchConfig;
export type CmdCodes = "restart" | "pause" | "resume" | "kill" | "isup" | "init" | "networkmap";
export type IPCRequestMessage = {
  text: string;
  cmd: CmdCodes;
  nodeName?: string;
};
export type IPCResponseMessage = {
  status: "success" | "failure";
  result: boolean | object;
  message: string;
};
export declare function sendIpcMessage(message: IPCRequestMessage): Promise<IPCResponseMessage>;
