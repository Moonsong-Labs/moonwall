import Bottleneck from "bottleneck";
import semverLt from "semver/functions/lt";
import { expect, describeSuite, ApiPromise, beforeAll, Web3 } from "@moonwall/cli";
import { checkBlockFinalized, fetchHistoricBlockNum, getBlockTime } from "@moonwall/util";
import Debug from "debug";
const debug = Debug("smoke:block-finalized");
const timePeriod = process.env.TIME_PERIOD ? Number(process.env.TIME_PERIOD) : 60 * 1000;
const timeout = Math.floor(timePeriod / 12); // 2 hour -> 10 minute timeout

describeSuite({
  id: "S400",
  title: "Parachain blocks should be finalized",
  foundationMethods: "read_only",
  testCases: ({ context, it }) => {
    let api: ApiPromise;
    let web3: Web3;

    beforeAll(() => {
      api = context.polkadotJs();
      web3 = context.web3();
    });

    it({
      id: "C100",
      title: `should have a recently finalized block`,
      test: async function () {
        const head = await api.rpc.chain.getFinalizedHead();
        const block = await api.rpc.chain.getBlock(head);
        const diff = Date.now() - getBlockTime(block);

        debug(`Last finalized block was ${diff / 1000} seconds ago`);
        expect(diff).to.be.lessThanOrEqual(10 * 60 * 1000); // 10 minutes in milliseconds
      },
    });

    it({
      id: "C200",
      title: `should have a recent eth block`,
      test: async function () {
        const specVersion = api.consts.system.version.specVersion.toNumber();
        const clientVersion = (await api.rpc.system.version()).toString().split("-")[0];

        if (specVersion < 1900 || semverLt(clientVersion, "0.27.2")) {
          debug(
            `ChainSpec ${specVersion}, client ${clientVersion} unsupported BlockTag, skipping.`
          );
          this.skip();
        }
        const timestamp = (await web3.eth.getBlock("latest")).timestamp;
        const diff = BigInt(Date.now()) - timestamp * 1000n;
        debug(`Last eth block was ${diff / 1000n} seconds ago`);
        expect(diff < 10n * 60n * 1000n).to.be.true;
      },
    });

    it({
      id: "C300",
      title:
        `should have only finalized blocks in the past` +
        ` ${(timePeriod / (1000 * 60 * 60)).toFixed(2)} hours #C300`,
      test: async function () {
        this.timeout(timeout);
        const signedBlock = await api.rpc.chain.getBlock(await api.rpc.chain.getFinalizedHead());

        const lastBlockNumber = signedBlock.block.header.number.toNumber();
        const lastBlockTime = getBlockTime(signedBlock);
        const limiter = new Bottleneck({ maxConcurrent: 5, minTime: 100 });

        const firstBlockTime = lastBlockTime - timePeriod;
        debug(`Searching for the block at: ${new Date(firstBlockTime)}`);

        const firstBlockNumber = (await limiter.wrap(fetchHistoricBlockNum)(
          api,
          lastBlockNumber,
          firstBlockTime
        )) as number;

        debug(`Checking if blocks #${firstBlockNumber} - #${lastBlockNumber} are finalized.`);
        const promises = (() => {
          const length = lastBlockNumber - firstBlockNumber;
          return Array.from({ length }, (_, i) => firstBlockNumber + i);
        })().map((num) => limiter.schedule(() => checkBlockFinalized(api, num)));

        const results = await Promise.all(promises);

        const unfinalizedBlocks = results.filter((item) => !item.finalized);
        expect(
          unfinalizedBlocks,
          `The following blocks were not finalized ${unfinalizedBlocks
            .map((a) => a.number)
            .join(", ")}`
        ).to.be.empty;
      },
    });
  },
});
