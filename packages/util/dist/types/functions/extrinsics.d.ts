import type { SubmittableExtrinsic } from "@polkadot/api/types";
import type { ISubmittableResult } from "@polkadot/types/types";
import type { KeyringPair } from "@polkadot/keyring/types";
export declare const signAndSend: (
  tx: SubmittableExtrinsic<"promise", ISubmittableResult>,
  account?: KeyringPair,
  nonce?: number
) => Promise<unknown>;
