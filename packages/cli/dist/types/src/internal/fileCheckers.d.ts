export declare function checkExists(path: string): Promise<boolean>;
export declare function downloadBinsIfMissing(binPath: string): Promise<void>;
export declare function checkListeningPorts(processId: number): {
  binName: string;
  processId: number;
  ports: string[];
};
export declare function checkAlreadyRunning(binaryName: string): number[];
export declare function promptAlreadyRunning(pids: number[]): Promise<void>;
export declare function checkAccess(path: string): void;
