import { ConnectedProvider, LaunchedNode, MoonwallConfig, MoonwallEnvironment } from "../lib/types";
export declare class MoonwallContext {
    private static instance;
    environments: MoonwallEnvironment[];
    providers: ConnectedProvider[];
    nodes?: LaunchedNode[];
    constructor(config: MoonwallConfig);
    env(query: string): MoonwallEnvironment | undefined;
    connectEnvironment(environmentName: string): Promise<MoonwallContext>;
    disconnect(providerName?: string): void;
    static printStats(): void;
    static getContext(config?: MoonwallConfig): MoonwallContext;
    static destroy(): void;
}
export declare const contextCreator: (config: MoonwallConfig, env: string) => Promise<void>;
