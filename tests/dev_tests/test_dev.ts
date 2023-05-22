import "@moonbeam-network/api-augment";
import "@polkadot/api-augment";
import { describeSuite, expect, beforeAll } from "@moonwall/cli";
import {
  CHARLETH_ADDRESS,
  BALTATHAR_ADDRESS,
  alith,
  baltathar,
  ALITH_ADDRESS,
  BALTATHAR_PRIVATE_KEY,
  CHARLETH_PRIVATE_KEY,
  ALITH_PRIVATE_KEY,
  deployViemContract,
} from "@moonwall/util";
import { Signer, parseEther } from "ethers";
import { BN } from "@polkadot/util";
import Web3 from "web3";
import { ApiPromise } from "@polkadot/api";
import {
  createWalletClient,
  decodeErrorResult,
  decodeEventLog,
  formatEther,
  formatGwei,
  formatUnits,
  getContract,
  http,
  verifyMessage,
} from "viem";
import { bytecode, tokenAbi } from "../_test_data/token.js";
import { privateKeyToAccount } from "viem/accounts";
import { localhost } from "viem/chains";
import { stat } from "fs";

describeSuite({
  id: "D01",
  title: "Dev test suite",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
    let signer: Signer;
    let w3: Web3;

    beforeAll(async () => {
      signer = context.ethersSigner();
      w3 = context.web3();
    });

    it({
      id: "T01",
      title: "Checking that launched node can create blocks",
      test: async function () {
        const block = (
          await context.polkadotJs().rpc.chain.getBlock()
        ).block.header.number.toNumber();
        await context.createBlock();
        const block2 = (
          await context.polkadotJs().rpc.chain.getBlock()
        ).block.header.number.toNumber();
        log(`Previous block #${block}, new block #${block2}`);
        expect(block2).to.be.greaterThan(block);
      },
    });

    it({
      id: "T02",
      title: "Checking that substrate txns possible",
      timeout: 20000,
      test: async function () {
        const balanceBefore = (await context.polkadotJs().query.system.account(BALTATHAR_ADDRESS))
          .data.free;

        await context
          .polkadotJs()
          .tx.balances.transfer(BALTATHAR_ADDRESS, parseEther("2"))
          .signAndSend(alith);
        await context.createBlock();

        const balanceAfter = (await context.polkadotJs().query.system.account(BALTATHAR_ADDRESS))
          .data.free;
        expect(balanceBefore.lt(balanceAfter)).to.be.true;
      },
    });

    it({
      id: "T03",
      title: "Checking that sudo can be used",
      test: async function () {
        await context.createBlock();
        const tx = context.polkadotJs().tx.rootTesting.fillBlock(60 * 10 ** 7);
        await context.polkadotJs().tx.sudo.sudo(tx).signAndSend(alith);

        await context.createBlock();
        const blockFill = await context.polkadotJs().query.system.blockWeight();
        expect(blockFill.normal.refTime.unwrap().gt(new BN(0))).to.be.true;
      },
    });

    it({
      id: "T04",
      title: "Can send Ethers txns",
      test: async function () {
        const balanceBefore = (await context.polkadotJs().query.system.account(BALTATHAR_ADDRESS))
          .data.free;

        await signer.sendTransaction({
          to: BALTATHAR_ADDRESS,
          value: parseEther("1.0"),
          nonce: await signer.getNonce(),
        });
        await context.createBlock();

        const balanceAfter = (await context.polkadotJs().query.system.account(BALTATHAR_ADDRESS))
          .data.free;
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
          context.polkadotJs().events.system.ExtrinsicSuccess,
          context.polkadotJs().events.balances.Transfer,
          // context.polkadotJs().events.authorFilter.EligibleUpdated,
        ];

        await context.createBlock(
          context.polkadotJs().tx.balances.transfer(CHARLETH_ADDRESS, parseEther("3")),
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
          context
            .polkadotJs()
            .tx.balances.forceTransfer(BALTATHAR_ADDRESS, CHARLETH_ADDRESS, parseEther("3")),
          { allowFailures: true, logger: log }
        );

        expect(
          result!.events.find((evt) =>
            context.polkadotJs().events.system.ExtrinsicFailed.is(evt.event)
          ),
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
        const { status, contractAddress } = await deployViemContract(context, tokenAbi, bytecode);
        expect(status).to.be.toStrictEqual("success");
        expect(contractAddress!.length).to.be.greaterThan(0);
      },
    });

    it({
      id: "T09",
      title: "It can write-interact with a contract",
      test: async function () {
        const { contractAddress, status, logs, hash } = await deployViemContract(
          context,
          tokenAbi,
          bytecode,
          {
            gas: 10000000n,
          }
        );

        const contractInstance = getContract({
          abi: tokenAbi,
          address: contractAddress!,
          publicClient: context.viemClient("public"),
        });

        const symbol = await contractInstance.read.symbol();
        const balBefore = (await contractInstance.read.balanceOf([BALTATHAR_ADDRESS])) as bigint;

        await context.viemClient("wallet").writeContract({
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
      id: "T10",
      title: "It can sign a message",
      test: async function () {
        const string = "Boom Boom Lemon";
        const signature = await context.viemClient("wallet").signMessage({ message: string });
        const valid = await verifyMessage({ address: ALITH_ADDRESS, message: string, signature });
        log(`Signature: ${signature}`);

        context.ethersSigner();
        expect(signature.length).to.be.greaterThan(0);
        expect(valid).to.be.true;
      },
    });
    it({
      id: "T11",
      title: "It can calculate the gas cost of a contract interaction",
      test: async function () {
        const { status, contractAddress } = await deployViemContract(context, tokenAbi, bytecode);
        log(`Deployed contract at ${contractAddress}`);

        const gas = await context.viemClient("public").estimateContractGas({
          abi: tokenAbi,
          address: contractAddress!,
          functionName: "transfer",
          args: [BALTATHAR_ADDRESS, parseEther("2.0")],
          account: ALITH_ADDRESS,
        });

        log(`Gas cost to transfer tokens is ${formatGwei(gas)} gwei`);
        expect(gas > 0n).to.be.true;
      },
    });
    it({
      id: "T12",
      title: "It can calculate the gas cost of a simple balance transfer",
      test: async function () {
        const gas = await context
          .viemClient("public")
          .estimateGas({ account: ALITH_ADDRESS, to: BALTATHAR_ADDRESS, value: parseEther("1.0") });

        log(`Gas cost to transfer system balance is ${formatGwei(gas)} gwei`);
        expect(gas > 0n).to.be.true;
      },
    });

    it({
      id: "T13",
      title: "It can simulate a contract interation",
      test: async function () {
        const { status, contractAddress } = await deployViemContract(context, tokenAbi, bytecode);

        const { result } = await context.viemClient("public").simulateContract({
          account: ALITH_ADDRESS,
          abi: tokenAbi,
          address: contractAddress!,
          functionName: "transfer",
          args: [BALTATHAR_ADDRESS, parseEther("2.0")],
        });

        expect(result).to.be.true;
      },
    });

    it({
      id: "T14",
      title: "It can decode an error result",
      test: async function () {
        const errorData =
          ("0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000" +
            "00000000000000002645524332303a207472616e7366657220616d6f756e7420657863656" +
            "564732062616c616e63650000000000000000000000000000000000000000000000000000") as `0x${string}`;

        const value = decodeErrorResult({ abi: tokenAbi, data: errorData });

        expect(value.args![0]).to.contains("ERC20: transfer amount exceeds balance");
      },
    });

    it({
      id: "T15",
      title: "It can decode an event log",
      test: async function () {
        const { status, contractAddress } = await deployViemContract(context, tokenAbi, bytecode);
        log(`Deployed contract at ${contractAddress}`);

        const txHash = await context.viemClient("wallet").writeContract({
          abi: tokenAbi,
          address: contractAddress!,
          functionName: "transfer",
          args: [BALTATHAR_ADDRESS, parseEther("2.0")],
        });

        await context.createBlock();

        const { logs } = await context.viemClient("public").getTransactionReceipt({ hash: txHash });

        const decoded = decodeEventLog({
          abi: tokenAbi,
          data: logs[0].data,
          topics: logs[0].topics,
        });

        expect(decoded.eventName).to.equal("Transfer");
        expect((decoded.args as any).from).to.equal(ALITH_ADDRESS);
      },
    });
  },
});
