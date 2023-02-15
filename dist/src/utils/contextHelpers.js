"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alithSigner = exports.extractInfo = exports.isExtrinsicSuccessful = exports.extractError = exports.getDispatchError = exports.filterAndApply = exports.createBlock = exports.resetToGenesis = void 0;
const providers_1 = require("../../src/cli/runner/internal/providers");
const accounts_1 = require("../../src/cli/runner/lib/accounts");
const block_1 = require("../../src/cli/runner/util/block");
const ethers_1 = require("ethers");
const globalContext_1 = require("../cli/runner/internal/globalContext");
const types_1 = require("../../src/cli/runner/lib/types");
const chai_1 = require("chai");
const debug = require("debug")("context");
async function resetToGenesis(api) {
    if (!globalContext_1.MoonwallContext.getContext().genesis) {
        debug(`No genesis noted for context, is forkGenesis() being called too early?`);
        throw new Error("No genesis found for context");
    }
    else {
        await api.rpc.engine.createBlock(true, true, globalContext_1.MoonwallContext.getContext().genesis);
        const newGenesis = (await api.rpc.chain.getFinalizedHead()).toString();
        globalContext_1.MoonwallContext.getContext().genesis = newGenesis;
    }
}
exports.resetToGenesis = resetToGenesis;
async function createBlock(w3Api, pjsApi, transactions, options = {}) {
    (0, chai_1.assert)(globalContext_1.MoonwallContext.getContext().foundation == types_1.FoundationType.DevMode, "createBlock should only be used on DevMode foundations");
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
                hash: (await (0, providers_1.customWeb3Request)(w3Api, "eth_sendRawTransaction", [call]))
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
                hash: (await call.signAndSend(accounts_1.alith)).toString(),
            });
        }
    }
    const { parentHash, finalize } = options;
    const blockResult = await (0, block_1.createAndFinalizeBlock)(pjsApi, parentHash, finalize);
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
exports.createBlock = createBlock;
function filterAndApply(events, section, methods, onFound) {
    return events
        .filter(({ event }) => section === event.section && methods.includes(event.method))
        .map((record) => onFound(record));
}
exports.filterAndApply = filterAndApply;
function getDispatchError({ event: { data: [dispatchError], }, }) {
    return dispatchError;
}
exports.getDispatchError = getDispatchError;
function getDispatchInfo({ event: { data, method }, }) {
    return method === "ExtrinsicSuccess"
        ? data[0]
        : data[1];
}
function extractError(events = []) {
    return filterAndApply(events, "system", ["ExtrinsicFailed"], getDispatchError)[0];
}
exports.extractError = extractError;
function isExtrinsicSuccessful(events = []) {
    return (filterAndApply(events, "system", ["ExtrinsicSuccess"], () => true).length >
        0);
}
exports.isExtrinsicSuccessful = isExtrinsicSuccessful;
function extractInfo(events = []) {
    return filterAndApply(events, "system", ["ExtrinsicFailed", "ExtrinsicSuccess"], getDispatchInfo)[0];
}
exports.extractInfo = extractInfo;
const alithSigner = (context) => {
    const signer = new ethers_1.ethers.Wallet(accounts_1.ALITH_PRIVATE_KEY, context);
    signer.connect(context);
    return signer;
};
exports.alithSigner = alithSigner;
//# sourceMappingURL=contextHelpers.js.map