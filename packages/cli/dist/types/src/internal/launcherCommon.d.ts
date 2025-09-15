import type { Environment } from "@moonwall/types";
export declare function commonChecks(env: Environment): Promise<void>;
export declare function executeScript(scriptCommand: string, args?: string): Promise<void>;
