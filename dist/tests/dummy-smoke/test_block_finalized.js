import { expect } from "chai";
import { checkBlockFinalized, getBlockTime, fetchHistoricBlockNum, } from "../../src/cli/runner/util/block.js";
import Bottleneck from "bottleneck";
import semverLt from "semver/functions/lt.js";
import { testSuite } from "../../src/cli/runner/util/runner-functions.js";
import Debug from "debug";
const debug = Debug("smoke:block-finalized");
const timePeriod = process.env.TIME_PERIOD
    ? Number(process.env.TIME_PERIOD)
    : 60 * 1000;
const timeout = Math.floor(timePeriod / 12);
testSuite({
    id: "S400",
    title: "Parachain blocks should be finalized",
    testCases: ({ context, it }) => {
        const api = context.getPolkadotJs();
        const web3 = context.getWeb3();
        it("C100", `should have a recently finalized block`, async function () {
            const head = await api.rpc.chain.getFinalizedHead();
            const block = await api.rpc.chain.getBlock(head);
            const diff = Date.now() - getBlockTime(block);
            debug(`Last finalized block was ${diff / 1000} seconds ago`);
            expect(diff).to.be.lessThanOrEqual(10 * 60 * 1000);
        });
        it("C200", `should have a recent eth block`, async function () {
            const specVersion = api.consts.system.version.specVersion.toNumber();
            const clientVersion = (await api.rpc.system.version())
                .toString()
                .split('-')[0];
            if (specVersion < 1900 || semverLt(clientVersion, '0.27.2')) {
                debug(`ChainSpec ${specVersion}, client ${clientVersion} unsupported BlockTag, skipping.`);
                this.skip();
            }
            const timestamp = (await web3.eth.getBlock("latest")).timestamp;
            const diff = BigInt(Date.now()) - timestamp * 1000n;
            debug(`Last eth block was ${diff / 1000n} seconds ago`);
            expect(diff < 10n * 60n * 1000n).to.be.true;
        });
        it('C300', `should have only finalized blocks in the past` +
            ` ${(timePeriod / (1000 * 60 * 60)).toFixed(2)} hours #C300`, async function () {
            this.timeout(timeout);
            const signedBlock = await api.rpc.chain.getBlock(await api.rpc.chain.getFinalizedHead());
            const lastBlockNumber = signedBlock.block.header.number.toNumber();
            const lastBlockTime = getBlockTime(signedBlock);
            const limiter = new Bottleneck({ maxConcurrent: 5, minTime: 100 });
            const firstBlockTime = lastBlockTime - timePeriod;
            debug(`Searching for the block at: ${new Date(firstBlockTime)}`);
            const firstBlockNumber = (await limiter.wrap(fetchHistoricBlockNum)(api, lastBlockNumber, firstBlockTime));
            debug(`Checking if blocks #${firstBlockNumber} - #${lastBlockNumber} are finalized.`);
            const promises = (() => {
                const length = lastBlockNumber - firstBlockNumber;
                return Array.from({ length }, (_, i) => firstBlockNumber + i);
            })().map((num) => limiter.schedule(() => checkBlockFinalized(api, num)));
            const results = await Promise.all(promises);
            const unfinalizedBlocks = results.filter((item) => !item.finalized);
            expect(unfinalizedBlocks, `The following blocks were not finalized ${unfinalizedBlocks
                .map((a) => a.number)
                .join(', ')}`).to.be.empty;
        });
    },
});
//# sourceMappingURL=test_block_finalized.js.map