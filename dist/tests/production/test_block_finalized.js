"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const block_1 = require("../../src/cli/runner/util/block");
const bottleneck_1 = __importDefault(require("bottleneck"));
const runner_functions_1 = require("src/cli/runner/util/runner-functions");
const debug = require('debug')('smoke:block-finalized');
const timePeriod = process.env.TIME_PERIOD ? Number(process.env.TIME_PERIOD) : 2 * 60 * 60 * 1000;
const timeout = Math.floor(timePeriod / 12);
(0, runner_functions_1.testSuite)({
    id: 'S400',
    title: 'Parachain blocks should be finalized',
    testCases: ({ context, it }) => {
        it('C100', `should have a recently finalized block`, async function () {
            const head = await context.polkadotApi.rpc.chain.getFinalizedHead();
            const block = await context.polkadotApi.rpc.chain.getBlock(head);
            const diff = Date.now() - (0, block_1.getBlockTime)(block);
            debug(`Last finalized block was ${diff / 1000} seconds ago`);
            (0, chai_1.expect)(diff).to.be.lessThanOrEqual(10 * 60 * 1000);
        });
        it('C200', `should have a recently finalized eth block`, async function () {
        });
        it('C300', `should have only finalized blocks in the past` +
            ` ${(timePeriod / (1000 * 60 * 60)).toFixed(2)} hours #C300`, async function () {
            this.timeout(timeout);
            const signedBlock = await context.polkadotApi.rpc.chain.getBlock(await context.polkadotApi.rpc.chain.getFinalizedHead());
            const lastBlockNumber = signedBlock.block.header.number.toNumber();
            const lastBlockTime = (0, block_1.getBlockTime)(signedBlock);
            const limiter = new bottleneck_1.default({ maxConcurrent: 5 });
            const firstBlockTime = lastBlockTime - timePeriod;
            debug(`Searching for the block at: ${new Date(firstBlockTime)}`);
            const firstBlockNumber = (await limiter.wrap(block_1.fetchHistoricBlockNum)(context.polkadotApi, lastBlockNumber, firstBlockTime));
            debug(`Checking if blocks #${firstBlockNumber} - #${lastBlockNumber} are finalized.`);
            const promises = (() => {
                const length = lastBlockNumber - firstBlockNumber;
                return Array.from({ length }, (_, i) => firstBlockNumber + i);
            })().map((num) => limiter.schedule(() => (0, block_1.checkBlockFinalized)(context.polkadotApi, num)));
            const results = await Promise.all(promises);
            const unfinalizedBlocks = results.filter((item) => !item.finalized);
            (0, chai_1.expect)(unfinalizedBlocks, `The following blocks were not finalized ${unfinalizedBlocks
                .map((a) => a.number)
                .join(', ')}`).to.be.empty;
        });
    },
});
//# sourceMappingURL=test_block_finalized.js.map