import "@moonbeam-network/api-augment";
import { describeSuite, expect, beforeAll } from "@moonwall/cli";
import { CHARLETH_ADDRESS, BALTATHAR_ADDRESS, alith, baltathar } from "@moonwall/util";
import { Signer, parseEther } from "ethers";
import { BN } from "@polkadot/util";
import Web3 from "web3";
import { ApiPromise } from "@polkadot/api";
import { formatEther, getContract } from "viem";
import { bytecode, tokenAbi } from "../_test_data/token.js";

describeSuite({
  id: "D01",
  title: "Dev test suite",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
    let signer: Signer;
    let w3: Web3;
    let polkadotJs: ApiPromise;

    beforeAll(async () => {
      polkadotJs = context.polkadotJs();
      signer = context.ethersSigner();
      w3 = context.web3();
    });

    it({
      id: "T01",
      title: "Checking that launched node can create blocks",
      test: async function () {
        const block = (await polkadotJs.rpc.chain.getBlock()).block.header.number.toNumber();
        await context.createBlock();
        const block2 = (await polkadotJs.rpc.chain.getBlock()).block.header.number.toNumber();
        log(`Previous block #${block}, new block #${block2}`);
        expect(block2).to.be.greaterThan(block);
      },
    });

    it({
      id: "T02",
      title: "Checking that substrate txns possible",
      timeout: 20000,
      test: async function () {
        const balanceBefore = (await polkadotJs.query.system.account(BALTATHAR_ADDRESS)).data.free;

        await polkadotJs.tx.balances
          .transfer(BALTATHAR_ADDRESS, parseEther("2"))
          .signAndSend(alith);
        await context.createBlock();

        const balanceAfter = (await polkadotJs.query.system.account(BALTATHAR_ADDRESS)).data.free;
        expect(balanceBefore.lt(balanceAfter)).to.be.true;
      },
    });

    it({
      id: "T03",
      title: "Checking that sudo can be used",
      test: async function () {
        await context.createBlock();
        const tx = polkadotJs.tx.rootTesting.fillBlock(60 * 10 ** 7);
        await polkadotJs.tx.sudo.sudo(tx).signAndSend(alith);

        await context.createBlock();
        const blockFill = await polkadotJs.query.system.blockWeight();
        expect(blockFill.normal.refTime.unwrap().gt(new BN(0))).to.be.true;
      },
    });

    it({
      id: "T04",
      title: "Can send Ethers txns",
      test: async function () {
        const balanceBefore = (await polkadotJs.query.system.account(BALTATHAR_ADDRESS)).data.free;

        await signer.sendTransaction({
          to: BALTATHAR_ADDRESS,
          value: parseEther("1.0"),
          nonce: await signer.getNonce(),
        });
        await context.createBlock();

        const balanceAfter = (await polkadotJs.query.system.account(BALTATHAR_ADDRESS)).data.free;
        expect(balanceBefore.lt(balanceAfter)).to.be.true;
      },
    });

    it({
      id: "T05",
      title: "Testing out Create block and listen for event",
      // modifier: "only",
      timeout: 30000,
      test: async function () {
        const expectEvents = [
          polkadotJs.events.system.ExtrinsicSuccess,
          polkadotJs.events.balances.Transfer,
          // polkadotJs.events.authorFilter.EligibleUpdated,
        ];

        await context.createBlock(
          polkadotJs.tx.balances.transfer(CHARLETH_ADDRESS, parseEther("3")),
          { expectEvents, logger: log }
        );
      },
    });

    it({
      id: "T06",
      title: "Testing out Create block and analyse failures",
      timeout: 30000,
      test: async function () {
        const { result } = await context.createBlock(
          polkadotJs.tx.balances.forceTransfer(
            BALTATHAR_ADDRESS,
            CHARLETH_ADDRESS,
            parseEther("3")
          ),
          { allowFailures: true, logger: log }
        );

        expect(
          result.events.find((evt) => polkadotJs.events.system.ExtrinsicFailed.is(evt.event)),
          "No Event found in block"
        ).toBeTruthy();
      },
    });

    it({
      id: "T07",
      title: "Can send viem txns",
      test: async function () {
        const balanceBefore = await context
          .viemClient("public")
          .getBalance({ address: BALTATHAR_ADDRESS });
        await context.viemClient("wallet").sendTransaction({
          to: BALTATHAR_ADDRESS,
          value: parseEther("1.0"),
        });

        await context.createBlock();

        const balanceAfter = await context
          .viemClient("public")
          .getBalance({ address: BALTATHAR_ADDRESS });
        log(`Baltahaar balance before: ${formatEther(balanceBefore)}`);
        log(`Baltahaar balance after: ${formatEther(balanceAfter)}`);
        expect(balanceBefore < balanceAfter).to.be.true;
      },
    });

    it({
      id: "T08",
      title: "It can deploy a contract",
      test: async function () {
        const hash = await context.viemClient("wallet").deployContract({
          abi: tokenAbi,
          bytecode,
        });

        await context.createBlock();
        log(`Deployed contract with hash ${hash}`);
        const receipt = await context.viemClient("public").getTransactionReceipt({ hash });
        expect(receipt.status).to.be.toStrictEqual("success");
      },
    });

    it({
      id: "T09",
      title: "It can write-interact with a contract",
      test: async function () {
        const hash = await context.viemClient("wallet").deployContract({
          abi: tokenAbi,
          bytecode,
        });
        await context.createBlock();
        const { contractAddress } = await context
          .viemClient("public")
          .getTransactionReceipt({ hash });
        log(`Deployed contract at ${contractAddress}`);

        const contractInstance = getContract({
          abi: tokenAbi,
          address: contractAddress!,
          publicClient: context.viemClient("public"),
        });

        const symbol = await contractInstance.read.symbol();
        const balBefore = (await contractInstance.read.balanceOf([BALTATHAR_ADDRESS])) as bigint;

        await context
          .viemClient("wallet")
          .writeContract({
            abi: tokenAbi,
            address: contractAddress!,
            functionName: "transfer",
            args: [BALTATHAR_ADDRESS, parseEther("2.0")],
          });
        await context.createBlock();

        const balanceAfter = (await contractInstance.read.balanceOf([BALTATHAR_ADDRESS])) as bigint;
        log(`Baltahaar balance before: ${formatEther(balBefore)} ${symbol}`);
        log(`Baltahaar balance after: ${formatEther(balanceAfter)} ${symbol}`);
        expect(balBefore < balanceAfter).to.be.true;
      },
    });
    it({
      // TODO
      id: "T10",
      title: "It can sign a message and decrypt it",
      test: async function () {},
    });
    it({
      // TODO
      id: "T11",
      title: "It can calculate the gas cost of a contract interaction",
      test: async function () {},
    });
    it({
      // TODO
      id: "T12",
      title: "It can calculate the gas cost of a simple balance transfer",
      test: async function () {},
    });

    it({
      // TODO
      id: "T13",
      title: "It can simulate a contract interation",
      test: async function () {},
    });

    it({
      // TODO
      id: "T14",
      title: "It can decode an error result",
      test: async function () {},
    });

    it({
      // TODO
      id: "T15",
      title: "It can decode an event log",
      test: async function () {},
    });
  },
});
