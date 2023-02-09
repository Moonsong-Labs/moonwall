import { ConnectedProvider, LaunchedNode, MoonwallConfig, MoonwallEnvironment } from '../lib/types';
export declare class MoonwallContext {
    private static instance;
    environments: MoonwallEnvironment[];
    providers: ConnectedProvider[];
    nodes?: LaunchedNode[];
    constructor(config: MoonwallConfig);
    env(query: string): MoonwallEnvironment | undefined;
    connect(environmentName: string): Promise<void>;
    disconnect(providerName?: string): void;
    static printStats(): void;
    static getContext(config?: MoonwallConfig): MoonwallContext;
    static destroy(): Promise<void>;
}
