import "@moonbeam-network/api-augment";
export declare const BINARY_DIRECTORY: string;
export declare const RUNTIME_DIRECTORY: string;
export declare const SPECS_DIRECTORY: string;
export declare function getGithubReleaseBinary(url: string, binaryPath: string): Promise<string>;
export declare function getMoonbeamReleaseBinary(binaryTag: string): Promise<string>;
export declare function getPolkadotReleaseBinary(binaryTag: string): Promise<string>;
export declare function getTanssiReleaseBinary(binaryTag: string): Promise<string>;
export declare function getTagSha8(binaryTag: string): Promise<string>;
export declare function getMoonbeamDockerBinary(binaryTag: string): Promise<string>;
export declare function getRuntimeWasm(
  runtimeName: "moonbase" | "moonriver" | "moonbeam",
  runtimeTag: "local" | string,
  localPath?: string
): Promise<string>;
export declare function getPlainSpecsFromTag(
  runtimeName: "moonbase-local" | "moonriver-local" | "moonbeam-local",
  tag: string
): Promise<string>;
export declare function getRawSpecsFromTag(
  runtimeName: "moonbase-local" | "moonriver-local" | "moonbeam-local",
  tag: string
): Promise<string>;
export declare function generatePlainSpecs(
  binaryPath: string,
  runtimeName: "moonbase-local" | "moonriver-local" | "moonbeam-local"
): Promise<string>;
export declare function generateRawSpecs(
  binaryPath: string,
  runtimeName: "moonbase-local" | "moonriver-local" | "moonbeam-local"
): Promise<string>;
