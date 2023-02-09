import { expect } from 'chai';
import {
  checkBlockFinalized,
  getBlockTime,
  fetchHistoricBlockNum,
} from '../../src/cli/runner/util/block';
import Bottleneck from 'bottleneck';
import { testSuite } from '../../src/cli/runner/util/runner-functions';
const debug = require('debug')('smoke:block-finalized');
const timePeriod = process.env.TIME_PERIOD ? Number(process.env.TIME_PERIOD) : 2 * 60 * 60 * 1000;
const timeout = Math.floor(timePeriod / 12); // 2 hour -> 10 minute timeout

testSuite({
  id: 'S400',
  title: 'Parachain blocks should be finalized',
  testCases: ({ context, it }) => {
    it('C100', `should have a recently finalized block`, async function () {
      const head = await context.MB.rpc.chain.getFinalizedHead();
      const block = await context.MB.rpc.chain.getBlock(head);
      const diff = Date.now() - getBlockTime(block);
      debug(`Last finalized block was ${diff / 1000} seconds ago`);
      expect(diff).to.be.lessThanOrEqual(10 * 60 * 1000); // 10 minutes in milliseconds
    });

    it('C200', `should have a recently finalized eth block`, async function () {
      //   const specVersion = context.polkadotApi.consts.system.version.specVersion.toNumber();
      //   const clientVersion = (await context.polkadotApi.rpc.system.version())
      //     .toString()
      //     .split('-')[0];
      //   if (specVersion < 1900 || semverLt(clientVersion, '0.27.2')) {
      //     debug(`ChainSpec ${specVersion}, client ${clientVersion} unsupported BlockTag, skipping.`);
      //     this.skip();
      //   }
      //   const timestamp = (await context.ethers.getBlock('finalized')).timestamp;
      //   const diff = Date.now() - timestamp * 1000;
      //   debug(`Last finalized eth block was ${diff / 1000} seconds ago`);
      //   expect(diff).to.be.lessThanOrEqual(10 * 60 * 1000);
    });

    it(
      'C300',
      `should have only finalized blocks in the past` +
        ` ${(timePeriod / (1000 * 60 * 60)).toFixed(2)} hours #C300`,
      async function () {
        this.timeout(timeout);
        const signedBlock = await context.MB.rpc.chain.getBlock(
          await context.MB.rpc.chain.getFinalizedHead()
        );
    
        const lastBlockNumber = signedBlock.block.header.number.toNumber();
        const lastBlockTime = getBlockTime(signedBlock);
        const limiter = new Bottleneck({ maxConcurrent: 5 });

        const firstBlockTime = lastBlockTime - timePeriod;
        debug(`Searching for the block at: ${new Date(firstBlockTime)}`);

        const firstBlockNumber = (await limiter.wrap(fetchHistoricBlockNum)(
          context.MB,
          lastBlockNumber,
          firstBlockTime
        )) as number;

        debug(`Checking if blocks #${firstBlockNumber} - #${lastBlockNumber} are finalized.`);
        const blockHash= await context.MB.rpc.chain.getBlockHash(firstBlockNumber)
        console.log(`block hash is ${blockHash}`)
        console.log( await context.MB.rpc.moon.isBlockFinalized(blockHash))
        // console.log((await checkBlockFinalized(context.MB,firstBlockNumber)))
        const promises = (() => {
          const length = lastBlockNumber - firstBlockNumber;
          return Array.from({ length }, (_, i) => firstBlockNumber + i);
        })().map((num) => limiter.schedule(() => checkBlockFinalized(context.MB, num)));

        const results = await Promise.all(promises);

        const unfinalizedBlocks = results.filter((item) => !item.finalized);
        expect(
          unfinalizedBlocks,
          `The following blocks were not finalized ${unfinalizedBlocks
            .map((a) => a.number)
            .join(', ')}`
        ).to.be.empty;
      }
    );
  },
});
