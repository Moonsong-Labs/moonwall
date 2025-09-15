interface DeriveTestIdsOptions {
  rootDir: string;
  singlePrefix?: boolean;
  prefixPhrase?: string;
}
export declare function deriveTestIds(params: DeriveTestIdsOptions): Promise<void>;
export {};
