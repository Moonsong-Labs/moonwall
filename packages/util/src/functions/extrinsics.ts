import { SubmittableExtrinsic } from "@polkadot/api/types";
import { ISubmittableResult } from "@polkadot/types/types";
import { KeyringPair } from "@polkadot/keyring/types";
import { alith } from "../constants";

export const signAndSend = async (
  tx: SubmittableExtrinsic<"promise", ISubmittableResult>,
  account: KeyringPair = alith,
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
