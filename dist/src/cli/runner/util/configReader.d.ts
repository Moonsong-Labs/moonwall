import { MoonwallConfig } from '../lib/types';
export declare function loadConfig(path: string): Promise<MoonwallConfig>;
export declare function buildFoundations(config: MoonwallConfig): Promise<void>;
