import { customWeb3Request } from "../../src/cli/runner/internal/providers.js";
import { ALITH_PRIVATE_KEY, alith } from "../../src/cli/runner/lib/accounts.js";
import { createAndFinalizeBlock } from "../../src/cli/runner/util/block.js";
import { ethers } from "ethers";
import { MoonwallContext } from "../cli/runner/internal/globalContext.js";
import { FoundationType } from "../../src/cli/runner/lib/types.js";
import { assert } from "chai";
import Debug from "debug";
const debug = Debug("context");
export async function resetToGenesis(api) {
    if (!MoonwallContext.getContext().genesis) {
        debug(`No genesis noted for context, is forkGenesis() being called too early?`);
        throw new Error("No genesis found for context");
    }
    else {
        await api.rpc.engine.createBlock(true, true, MoonwallContext.getContext().genesis);
        const newGenesis = (await api.rpc.chain.getFinalizedHead()).toString();
        MoonwallContext.getContext().genesis = newGenesis;
    }
}
export async function createBlock(w3Api, pjsApi, transactions, options = {}) {
    assert(MoonwallContext.getContext().foundation == FoundationType.DevMode, "createBlock should only be used on DevMode foundations");
    const results = [];
    const txs = transactions == undefined
        ? []
        : Array.isArray(transactions)
            ? transactions
            : [transactions];
    for await (const call of txs) {
        if (typeof call == "string") {
            results.push({
                type: "eth",
                hash: (await customWeb3Request(w3Api, "eth_sendRawTransaction", [call]))
                    .result,
            });
        }
        else if (call.isSigned) {
            const tx = pjsApi.tx(call);
            debug(`- Signed: ${tx.method.section}.${tx.method.method}(${tx.args
                .map((d) => d.toHuman())
                .join("; ")}) [ nonce: ${tx.nonce}]`);
            results.push({
                type: "sub",
                hash: (await call.send()).toString(),
            });
        }
        else {
            const tx = pjsApi.tx(call);
            debug(`- Unsigned: ${tx.method.section}.${tx.method.method}(${tx.args
                .map((d) => d.toHuman())
                .join("; ")}) [ nonce: ${tx.nonce}]`);
            results.push({
                type: "sub",
                hash: (await call.signAndSend(alith)).toString(),
            });
        }
    }
    const { parentHash, finalize } = options;
    const blockResult = await createAndFinalizeBlock(pjsApi, parentHash, finalize);
    if (results.length == 0) {
        return {
            block: blockResult,
            result: null,
        };
    }
    const allRecords = (await (await pjsApi.at(blockResult.hash)).query.system.events());
    const blockData = await pjsApi.rpc.chain.getBlock(blockResult.hash);
    const result = results.map((result) => {
        const extrinsicIndex = result.type == "eth"
            ? allRecords
                .find(({ phase, event: { section, method, data } }) => phase.isApplyExtrinsic &&
                section == "ethereum" &&
                method == "Executed" &&
                data[2].toString() == result.hash)
                ?.phase?.asApplyExtrinsic?.toNumber()
            : blockData.block.extrinsics.findIndex((ext) => ext.hash.toHex() == result.hash);
        const events = allRecords.filter(({ phase }) => phase.isApplyExtrinsic &&
            phase.asApplyExtrinsic.toNumber() === extrinsicIndex);
        const failure = extractError(events);
        return {
            extrinsic: extrinsicIndex >= 0 ? blockData.block.extrinsics[extrinsicIndex] : null,
            events,
            error: failure &&
                ((failure.isModule &&
                    pjsApi.registry.findMetaError(failure.asModule)) ||
                    { name: failure.toString() }),
            successful: extrinsicIndex !== undefined && !failure,
            hash: result.hash,
        };
    });
    if (results.find((r) => r.type == "eth")) {
        await new Promise((resolve) => setTimeout(resolve, 2));
    }
    return {
        block: blockResult,
        result: Array.isArray(transactions) ? result : result[0],
    };
}
export function filterAndApply(events, section, methods, onFound) {
    return events
        .filter(({ event }) => section === event.section && methods.includes(event.method))
        .map((record) => onFound(record));
}
export function getDispatchError({ event: { data: [dispatchError], }, }) {
    return dispatchError;
}
function getDispatchInfo({ event: { data, method }, }) {
    return method === "ExtrinsicSuccess"
        ? data[0]
        : data[1];
}
export function extractError(events = []) {
    return filterAndApply(events, "system", ["ExtrinsicFailed"], getDispatchError)[0];
}
export function isExtrinsicSuccessful(events = []) {
    return (filterAndApply(events, "system", ["ExtrinsicSuccess"], () => true).length >
        0);
}
export function extractInfo(events = []) {
    return filterAndApply(events, "system", ["ExtrinsicFailed", "ExtrinsicSuccess"], getDispatchInfo)[0];
}
export const alithSigner = (context) => {
    const signer = new ethers.Wallet(ALITH_PRIVATE_KEY, context);
    signer.connect(context);
    return signer;
};
//# sourceMappingURL=contextHelpers.js.map