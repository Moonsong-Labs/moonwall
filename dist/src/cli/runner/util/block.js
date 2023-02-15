"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPreimageDeposit = exports.extractWeight = exports.getBlockArray = exports.fetchHistoricBlockNum = exports.checkBlockFinalized = exports.getBlockTime = exports.getBlockExtrinsic = exports.calculateFeePortions = exports.createAndFinalizeBlock = void 0;
require("@moonbeam-network/api-augment/moonbase");
const bottleneck_1 = __importDefault(require("bottleneck"));
const debug = require("debug")("test:blocks");
async function createAndFinalizeBlock(api, parentHash, finalize = false) {
    const startTime = Date.now();
    const block = parentHash
        ? await api.rpc.engine.createBlock(true, finalize, parentHash)
        : await api.rpc.engine.createBlock(true, finalize);
    return {
        duration: Date.now() - startTime,
        hash: block.toJSON().hash,
    };
}
exports.createAndFinalizeBlock = createAndFinalizeBlock;
function calculateFeePortions(amount) {
    const burnt = (amount * 80n) / 100n;
    return { burnt, treasury: amount - burnt };
}
exports.calculateFeePortions = calculateFeePortions;
const getBlockExtrinsic = async (api, blockHash, section, method) => {
    const apiAt = await api.at(blockHash);
    const [{ block }, records] = await Promise.all([
        api.rpc.chain.getBlock(blockHash),
        apiAt.query.system.events(),
    ]);
    const extIndex = block.extrinsics.findIndex((ext) => ext.method.section == section && ext.method.method == method);
    const extrinsic = extIndex > -1 ? block.extrinsics[extIndex] : null;
    const events = records
        .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extIndex))
        .map(({ event }) => event);
    const resultEvent = events.find((event) => event.section === "system" &&
        (event.method === "ExtrinsicSuccess" || event.method === "ExtrinsicFailed"));
    return { block, extrinsic, events, resultEvent };
};
exports.getBlockExtrinsic = getBlockExtrinsic;
const getBlockTime = (signedBlock) => signedBlock.block.extrinsics
    .find((item) => item.method.section == "timestamp")
    .method.args[0].toNumber();
exports.getBlockTime = getBlockTime;
const checkBlockFinalized = async (api, number) => {
    return {
        number,
        finalized: (await api.rpc.moon.isBlockFinalized(await api.rpc.chain.getBlockHash(number)))
            .isTrue,
    };
};
exports.checkBlockFinalized = checkBlockFinalized;
const fetchBlockTime = async (api, blockNum) => {
    const hash = await api.rpc.chain.getBlockHash(blockNum);
    const block = await api.rpc.chain.getBlock(hash);
    return (0, exports.getBlockTime)(block);
};
const fetchHistoricBlockNum = async (api, blockNumber, targetTime) => {
    if (blockNumber <= 1) {
        return 1;
    }
    const time = await fetchBlockTime(api, blockNumber);
    if (time <= targetTime) {
        return blockNumber;
    }
    return (0, exports.fetchHistoricBlockNum)(api, blockNumber - Math.ceil((time - targetTime) / 30000), targetTime);
};
exports.fetchHistoricBlockNum = fetchHistoricBlockNum;
const getBlockArray = async (api, timePeriod, limiter) => {
    if (limiter == null) {
        limiter = new bottleneck_1.default({ maxConcurrent: 10, minTime: 100 });
    }
    const finalizedHead = await limiter.schedule(() => api.rpc.chain.getFinalizedHead());
    const signedBlock = await limiter.schedule(() => api.rpc.chain.getBlock(finalizedHead));
    const lastBlockNumber = signedBlock.block.header.number.toNumber();
    const lastBlockTime = (0, exports.getBlockTime)(signedBlock);
    const firstBlockTime = lastBlockTime - timePeriod;
    debug(`Searching for the block at: ${new Date(firstBlockTime)}`);
    const firstBlockNumber = (await limiter.wrap(exports.fetchHistoricBlockNum)(api, lastBlockNumber, firstBlockTime));
    const length = lastBlockNumber - firstBlockNumber;
    return Array.from({ length }, (_, i) => firstBlockNumber + i);
};
exports.getBlockArray = getBlockArray;
function extractWeight(weightV1OrV2) {
    if ("isSome" in weightV1OrV2) {
        const weight = weightV1OrV2.unwrap();
        if ("refTime" in weight) {
            return weight.refTime.unwrap();
        }
        return weight;
    }
    if ("refTime" in weightV1OrV2) {
        return weightV1OrV2.refTime.unwrap();
    }
    return weightV1OrV2;
}
exports.extractWeight = extractWeight;
function extractPreimageDeposit(request) {
    const deposit = "deposit" in request ? request.deposit : request;
    if ("isSome" in deposit) {
        return {
            accountId: deposit.unwrap()[0].toHex(),
            amount: deposit.unwrap()[1],
        };
    }
    return {
        accountId: deposit[0].toHex(),
        amount: deposit[1],
    };
}
exports.extractPreimageDeposit = extractPreimageDeposit;
//# sourceMappingURL=block.js.map