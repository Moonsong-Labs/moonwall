"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const block_1 = require("../../src/cli/runner/util/block");
const bottleneck_1 = __importDefault(require("bottleneck"));
const lt_1 = __importDefault(require("semver/functions/lt"));
const runner_functions_1 = require("../../src/cli/runner/util/runner-functions");
const debug = require("debug")("smoke:block-finalized");
const timePeriod = process.env.TIME_PERIOD
    ? Number(process.env.TIME_PERIOD)
    : 60 * 1000;
const timeout = Math.floor(timePeriod / 12);
(0, runner_functions_1.testSuite)({
    id: "S400",
    title: "Parachain blocks should be finalized",
    testCases: ({ context, it }) => {
        const api = context.polkaCtx("MB");
        const web3 = context.web3Api("w3");
        it("C100", `should have a recently finalized block`, async function () {
            const head = await api.rpc.chain.getFinalizedHead();
            const block = await api.rpc.chain.getBlock(head);
            const diff = Date.now() - (0, block_1.getBlockTime)(block);
            debug(`Last finalized block was ${diff / 1000} seconds ago`);
            (0, chai_1.expect)(diff).to.be.lessThanOrEqual(10 * 60 * 1000);
        });
        it("C200", `should have a recent eth block`, async function () {
            const specVersion = api.consts.system.version.specVersion.toNumber();
            const clientVersion = (await api.rpc.system.version())
                .toString()
                .split('-')[0];
            if (specVersion < 1900 || (0, lt_1.default)(clientVersion, '0.27.2')) {
                debug(`ChainSpec ${specVersion}, client ${clientVersion} unsupported BlockTag, skipping.`);
                this.skip();
            }
            const timestamp = (await web3.eth.getBlock("latest")).timestamp;
            const diff = BigInt(Date.now()) - timestamp * 1000n;
            debug(`Last eth block was ${diff / 1000n} seconds ago`);
            (0, chai_1.expect)(diff < 10n * 60n * 1000n).to.be.true;
        });
        it('C300', `should have only finalized blocks in the past` +
            ` ${(timePeriod / (1000 * 60 * 60)).toFixed(2)} hours #C300`, async function () {
            this.timeout(timeout);
            const signedBlock = await api.rpc.chain.getBlock(await api.rpc.chain.getFinalizedHead());
            const lastBlockNumber = signedBlock.block.header.number.toNumber();
            const lastBlockTime = (0, block_1.getBlockTime)(signedBlock);
            const limiter = new bottleneck_1.default({ maxConcurrent: 5, minTime: 100 });
            const firstBlockTime = lastBlockTime - timePeriod;
            debug(`Searching for the block at: ${new Date(firstBlockTime)}`);
            const firstBlockNumber = (await limiter.wrap(block_1.fetchHistoricBlockNum)(api, lastBlockNumber, firstBlockTime));
            debug(`Checking if blocks #${firstBlockNumber} - #${lastBlockNumber} are finalized.`);
            const promises = (() => {
                const length = lastBlockNumber - firstBlockNumber;
                return Array.from({ length }, (_, i) => firstBlockNumber + i);
            })().map((num) => limiter.schedule(() => (0, block_1.checkBlockFinalized)(api, num)));
            const results = await Promise.all(promises);
            const unfinalizedBlocks = results.filter((item) => !item.finalized);
            (0, chai_1.expect)(unfinalizedBlocks, `The following blocks were not finalized ${unfinalizedBlocks
                .map((a) => a.number)
                .join(', ')}`).to.be.empty;
        });
    },
});
//# sourceMappingURL=test_block_finalized.js.map