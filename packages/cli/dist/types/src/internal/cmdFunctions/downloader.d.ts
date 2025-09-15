import { SingleBar } from "cli-progress";
export declare function downloader(url: string, outputPath: string): Promise<void>;
export declare function initializeProgressBar(): SingleBar;
