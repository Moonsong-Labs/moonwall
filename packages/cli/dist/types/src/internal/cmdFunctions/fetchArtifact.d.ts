export type fetchArtifactArgs = {
  bin: string;
  ver?: string;
  path?: string;
  overwrite?: boolean;
  outputName?: string;
};
export declare function fetchArtifact(args: fetchArtifactArgs): Promise<void>;
export declare function getVersions(name: string, runtime?: boolean): Promise<string[]>;
