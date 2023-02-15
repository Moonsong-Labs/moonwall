import "@moonbeam-network/api-augment/moonbase";
import Bottleneck from "bottleneck";
import Debug from "debug";
const debug = Debug("test:blocks");
export async function createAndFinalizeBlock(api, parentHash, finalize = false) {
    const startTime = Date.now();
    const block = parentHash
        ? await api.rpc.engine.createBlock(true, finalize, parentHash)
        : await api.rpc.engine.createBlock(true, finalize);
    return {
        duration: Date.now() - startTime,
        hash: block.toJSON().hash,
    };
}
export function calculateFeePortions(amount) {
    const burnt = (amount * 80n) / 100n;
    return { burnt, treasury: amount - burnt };
}
export const getBlockExtrinsic = async (api, blockHash, section, method) => {
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
export const getBlockTime = (signedBlock) => signedBlock.block.extrinsics
    .find((item) => item.method.section == "timestamp")
    .method.args[0].toNumber();
export const checkBlockFinalized = async (api, number) => {
    return {
        number,
        finalized: (await api.rpc.moon.isBlockFinalized(await api.rpc.chain.getBlockHash(number)))
            .isTrue,
    };
};
const fetchBlockTime = async (api, blockNum) => {
    const hash = await api.rpc.chain.getBlockHash(blockNum);
    const block = await api.rpc.chain.getBlock(hash);
    return getBlockTime(block);
};
export const fetchHistoricBlockNum = async (api, blockNumber, targetTime) => {
    if (blockNumber <= 1) {
        return 1;
    }
    const time = await fetchBlockTime(api, blockNumber);
    if (time <= targetTime) {
        return blockNumber;
    }
    return fetchHistoricBlockNum(api, blockNumber - Math.ceil((time - targetTime) / 30000), targetTime);
};
export const getBlockArray = async (api, timePeriod, limiter) => {
    if (limiter == null) {
        limiter = new Bottleneck({ maxConcurrent: 10, minTime: 100 });
    }
    const finalizedHead = await limiter.schedule(() => api.rpc.chain.getFinalizedHead());
    const signedBlock = await limiter.schedule(() => api.rpc.chain.getBlock(finalizedHead));
    const lastBlockNumber = signedBlock.block.header.number.toNumber();
    const lastBlockTime = getBlockTime(signedBlock);
    const firstBlockTime = lastBlockTime - timePeriod;
    debug(`Searching for the block at: ${new Date(firstBlockTime)}`);
    const firstBlockNumber = (await limiter.wrap(fetchHistoricBlockNum)(api, lastBlockNumber, firstBlockTime));
    const length = lastBlockNumber - firstBlockNumber;
    return Array.from({ length }, (_, i) => firstBlockNumber + i);
};
export function extractWeight(weightV1OrV2) {
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
export function extractPreimageDeposit(request) {
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
//# sourceMappingURL=block.js.map