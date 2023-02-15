/// <reference types="node" />
import { ConnectedProvider, MoonwallConfig, MoonwallEnvironment } from "../lib/types";
import { ChildProcess } from "child_process";
export declare class MoonwallContext {
    private static instance;
    environments: MoonwallEnvironment[];
    providers: ConnectedProvider[];
    nodes: ChildProcess[];
    constructor(config: MoonwallConfig);
    startNetwork(environmentName: string): Promise<MoonwallContext>;
    env(query: string): MoonwallEnvironment | undefined;
    connectEnvironment(environmentName: string): Promise<MoonwallContext>;
    disconnect(providerName?: string): void;
    static printStats(): void;
    static getContext(config?: MoonwallConfig): MoonwallContext;
    static destroy(): void;
}
export declare const contextCreator: (config: MoonwallConfig, env: string) => Promise<MoonwallContext>;
