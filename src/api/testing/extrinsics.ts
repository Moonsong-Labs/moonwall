import type { SubmittableExtrinsic } from "@polkadot/api/types";
import type { ISubmittableResult } from "@polkadot/types/types";
import type { KeyringPair } from "@polkadot/keyring/types";
import { ALITH_PRIVATE_KEY } from "../constants/lightAccounts.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let defaultAlith: KeyringPair | undefined;

const getDefaultAlith = (): KeyringPair => {
  if (defaultAlith) {
    return defaultAlith;
  }

  const { Keyring } = require("@polkadot/api") as typeof import("@polkadot/api");
  defaultAlith = new Keyring({ type: "ethereum" }).addFromUri(ALITH_PRIVATE_KEY);
  return defaultAlith;
};

export const signAndSend = async (
  tx: SubmittableExtrinsic<"promise", ISubmittableResult>,
  account: KeyringPair = getDefaultAlith(),
  nonce = -1
) =>
  new Promise((resolve) =>
    tx.signAndSend(account, { nonce }, ({ status }) => {
      if (status.isInBlock) {
        process.stdout.write(
          "Extrinsic submitted and included in block, waiting for finalization..."
        );
      }
      if (status.isFinalized) {
        process.stdout.write("✅\n");
        resolve(true);
      }
    })
  );
