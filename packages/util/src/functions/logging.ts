import "@moonbeam-network/api-augment";
import type { ApiPromise } from "@polkadot/api";
import { mapExtrinsics } from "./block";
import type { Extrinsic } from "@polkadot/types/interfaces";
import { setupLogger as createTestLogger } from "./logger";

// Re-export setupLogger from logger.ts for backward compatibility
export const setupLogger = createTestLogger;

export function log(...msg: any[]) {
  if (process.argv?.[2] && process.argv[2] === "--printlogs") {
    console.log(...msg);
  }
}

export const printTokens = (api: ApiPromise, tokens: bigint, decimals = 2, pad = 9) => {
  if (!api.registry.chainDecimals[0]) {
    throw new Error("Chain decimals not found for system token");
  }

  return `${(
    Math.ceil(Number(tokens / 10n ** BigInt(api.registry.chainDecimals[0] - decimals))) /
    10 ** decimals
  )
    .toString()
    .padStart(pad)} ${api.registry.chainTokens[0]}`;
};

export const printEvents = async (api: ApiPromise, hash?: string) => {
  const blockHash = hash || (await api.rpc.chain.getBlockHash()).toString();
  const apiAt = await api.at(blockHash);
  const { block } = await api.rpc.chain.getBlock(blockHash);
  const allRecords = (await apiAt.query.system.events()) as any;

  const txsWithEvents = mapExtrinsics(block.extrinsics as unknown as Extrinsic[], allRecords);

  console.log(`===== Block #${block.header.number.toString()}: ${blockHash}`);
  console.log(block.header.toHuman());
  console.log(
    txsWithEvents
      .map(
        ({ extrinsic, events }, i) =>
          `  [${i}]: ${extrinsic.method.section.toString()}. ` +
          `${extrinsic.method.method.toString()}\n` +
          `  - 0x${Buffer.from(extrinsic.data).toString("hex")}\n${events
            .map(
              (event) =>
                `    * ${event.section.toString()}.${event.method.toString()}:\n${event.data
                  .map((datum) => `      - ${datum.toHex()}`)
                  .join("\n")}`
            )
            .join("\n")}`
      )
      .join("\n")
  );
};
