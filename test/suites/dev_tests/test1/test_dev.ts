import "@moonbeam-network/api-augment";
import {
  beforeAll,
  describeSuite,
  expect,
  fetchCompiledContract,
  whiteListedTrack,
} from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  ALITH_PRIVATE_KEY,
  BALTATHAR_ADDRESS,
  BALTATHAR_PRIVATE_KEY,
  CHARLETH_ADDRESS,
  DOROTHY_ADDRESS,
  GLMR,
  PRECOMPILES,
  alith,
  baltathar,
  createViemTransaction,
  deployViemContract,
} from "@moonwall/util";
import { BN } from "@polkadot/util";
import { type Wallet, parseEther } from "ethers";
import {
  type Abi,
  createWalletClient,
  decodeErrorResult,
  decodeEventLog,
  encodeFunctionData,
  encodeFunctionResult,
  formatEther,
  formatGwei,
  getContract,
  http,
  publicActions,
  verifyMessage,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { tokenAbi, bytecode as tokenBytecode } from "../../../_test_data/token";
import assert from "node:assert";

describeSuite({
  id: "D01",
  title: "Dev test suite",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
    let signer: Wallet;

    beforeAll(async () => {
      signer = context.ethers();
    });

    it({
      id: "T01",
      title: "Checking that launched node can create blocks",
      test: async () => {
        const block = (
          await context.polkadotJs().rpc.chain.getBlock()
        ).block.header.number.toNumber();
        await context.createBlock();
        const block2 = (
          await context.polkadotJs().rpc.chain.getBlock()
        ).block.header.number.toNumber();
        log(`Previous block #${block}, new block #${block2}`);

        const balance = (await context.polkadotJs().query.system.account(baltathar.address)).data
          .free;
        log(balance.toBigInt());

        balance;
        expect(block2).to.be.greaterThan(block);
      },
    });

    it({
      id: "T02",
      title: "Checking that substrate txns possible",
      timeout: 20000,
      test: async () => {
        log("Testing substrate balance transfer from Alith to Baltathar");
        const balanceBefore = (await context.polkadotJs().query.system.account(BALTATHAR_ADDRESS))
          .data.free;

        await context
          .polkadotJs()
          .tx.balances.transferAllowDeath(BALTATHAR_ADDRESS, parseEther("2"))
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
      test: async () => {
        log("Testing sudo functionality with fillBlock operation");
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
      test: async () => {
        log("Testing Ethers transaction - sending 1.0 ETH to Baltathar");
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
      test: async () => {
        const expectEvents = [
          context.polkadotJs().events.system.ExtrinsicSuccess,
          context.polkadotJs().events.balances.Transfer,
          // context.polkadotJs().events.authorFilter.EligibleUpdated,
        ];

        await context.createBlock(
          context.polkadotJs().tx.balances.transferAllowDeath(CHARLETH_ADDRESS, parseEther("3")),
          { expectEvents, logger: log }
        );
      },
    });

    it({
      id: "T06",
      title: "Testing out Create block and analyse failures",
      timeout: 30000,
      test: async () => {
        const { result } = await context.createBlock(
          context
            .polkadotJs()
            .tx.balances.forceTransfer(BALTATHAR_ADDRESS, CHARLETH_ADDRESS, parseEther("3")),
          { allowFailures: true, logger: log }
        );

        expect(
          result?.events.find((evt) =>
            context.polkadotJs().events.system.ExtrinsicFailed.is(evt.event)
          ),
          "No Event found in block"
        ).toBeTruthy();
      },
    });

    it({
      id: "T07",
      title: "Can send viem txns",
      test: async () => {
        log("Testing Viem transaction - sending 1.0 ETH to Baltathar");
        const balanceBefore = await context.viem().getBalance({ address: BALTATHAR_ADDRESS });

        await context.viem().sendTransaction({
          to: BALTATHAR_ADDRESS,
          value: parseEther("1.0"),
        });

        await context.createBlock();

        const balanceAfter = await context.viem().getBalance({ address: BALTATHAR_ADDRESS });
        log(`Baltahaar balance before: ${formatEther(balanceBefore)}`);
        log(`Baltahaar balance after: ${formatEther(balanceAfter)}`);
        expect(balanceBefore < balanceAfter).to.be.true;
      },
    });

    it({
      id: "T08",
      title: "It can deploy a contract",
      test: async () => {
        log("Testing contract deployment with MultiplyBy7 contract");
        const { abi, bytecode, methods } = fetchCompiledContract("MultiplyBy7");
        log(methods);

        const { status, contractAddress } = await deployViemContract(context, abi, bytecode);

        expect(status).to.be.toStrictEqual("success");
        expect(contractAddress.length).to.be.greaterThan(0);
      },
    });

    it({
      id: "T09",
      title: "It can call with a contract",
      test: async () => {
        log("Testing contract call - calling multiply function on MultiplyBy7 contract");
        const { abi, bytecode, methods } = fetchCompiledContract("MultiplyBy7");
        const { status, contractAddress } = await deployViemContract(context, abi, bytecode);

        const timbo = await context.viem().call({
          account: ALITH_ADDRESS,
          to: contractAddress,
          value: 0n,
          data: encodeFunctionData({ abi, functionName: "multiply", args: [7n] }),
        });

        expect(
          BigInt(encodeFunctionResult({ abi, functionName: "multiply", result: timbo.data }))
        ).to.be.equal(49n);
      },
    });

    it({
      id: "T10",
      title: "It can write-interact with a contract",
      // modifier: "only",
      test: async () => {
        log("Testing contract write interaction - transferring tokens to Baltathar");
        // log(methods)
        const { contractAddress, status, logs, hash } = await deployViemContract(
          context,
          tokenAbi as Abi,
          tokenBytecode,
          {
            gas: 10000000n,
          }
        );

        const contractInstance = getContract({
          abi: tokenAbi as Abi,
          address: contractAddress,
          client: {
            wallet: context.viem() as any,
            public: context.viem() as any,
          },
        });
        // @ts-ignore
        const symbol = await contractInstance.read.symbol();
        //@ts-ignore
        const balBefore = (await contractInstance.read.balanceOf([BALTATHAR_ADDRESS])) as bigint;

        await context.viem().writeContract({
          abi: tokenAbi as Abi,
          address: contractAddress,
          value: 0n,
          functionName: "transfer",
          args: [BALTATHAR_ADDRESS, parseEther("2.0")],
        });
        await context.createBlock();

        //@ts-ignore
        const balanceAfter = (await contractInstance.read.balanceOf([BALTATHAR_ADDRESS])) as bigint;
        log(`Baltahaar balance before: ${formatEther(balBefore)} ${symbol}`);
        log(`Baltahaar balance after: ${formatEther(balanceAfter)} ${symbol}`);
        expect(balBefore < balanceAfter).to.be.true;
      },
    });

    it({
      id: "T11",
      title: "It can sign a message",
      test: async () => {
        log("Testing message signing with Viem - signing 'Boom Boom Lemon'");
        const string = "Boom Boom Lemon";
        const signature = await context.viem().signMessage({ message: string });
        const valid = await verifyMessage({ address: ALITH_ADDRESS, message: string, signature });
        log(`Signature: ${signature}`);

        const tim = createWalletClient({
          account: privateKeyToAccount(ALITH_PRIVATE_KEY),
          transport: http("211312awd"),
        }).extend(publicActions);

        expect(signature.length).to.be.greaterThan(0);
        expect(valid).to.be.true;
      },
    });
    it({
      id: "T12",
      title: "It can calculate the gas cost of a contract interaction",
      test: async () => {
        log("Testing gas estimation for token transfer contract interaction");
        const { status, contractAddress } = await deployViemContract(
          context,
          tokenAbi as Abi,
          tokenBytecode
        );
        log(`Deployed contract at ${contractAddress}`);

        const gas = await context.viem().estimateContractGas({
          abi: tokenAbi,
          address: contractAddress,
          functionName: "transfer",
          args: [BALTATHAR_ADDRESS, parseEther("2.0")],
          account: ALITH_ADDRESS,
        });

        log(`Gas cost to transfer tokens is ${formatGwei(gas)} gwei`);
        expect(gas > 0n).to.be.true;
      },
    });
    it({
      id: "T13",
      title: "It can calculate the gas cost of a simple balance transfer",
      test: async () => {
        log("Testing gas estimation for simple balance transfer");
        const gas = await context
          .viem()
          .estimateGas({ account: ALITH_ADDRESS, to: BALTATHAR_ADDRESS, value: parseEther("1.0") });

        log(`Gas cost to transfer system balance is ${formatGwei(gas)} gwei`);
        expect(gas > 0n).to.be.true;
      },
    });

    it({
      id: "T14",
      title: "It can simulate a contract interation",
      test: async () => {
        log("Testing contract simulation - simulating token transfer");
        const { status, contractAddress } = await deployViemContract(
          context,
          tokenAbi as Abi,
          tokenBytecode
        );

        const { result } = await context.viem().simulateContract({
          account: ALITH_ADDRESS,
          abi: tokenAbi,
          address: contractAddress,
          functionName: "transfer",
          args: [BALTATHAR_ADDRESS, parseEther("2.0")],
        });

        expect(result).to.be.true;
      },
    });

    it({
      id: "T15",
      title: "It can decode an error result",
      test: async () => {
        log("Testing error decoding - decoding ERC20 transfer exceeds balance error");
        const errorData =
          ("0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000" +
            "00000000000000002645524332303a207472616e7366657220616d6f756e7420657863656" +
            "564732062616c616e63650000000000000000000000000000000000000000000000000000") as `0x${string}`;

        const value = decodeErrorResult({ abi: tokenAbi, data: errorData });

        expect(value.args?.[0]).to.contains("ERC20: transfer amount exceeds balance");
      },
    });

    it({
      id: "T16",
      title: "It can decode an event log",
      test: async () => {
        log("Testing event log decoding - decoding Transfer event from token contract");
        const { status, contractAddress } = await deployViemContract(
          context,
          tokenAbi as Abi,
          tokenBytecode
        );
        log(`Deployed contract at ${contractAddress}`);
        assert(contractAddress, "Contract address is undefined");

        const txHash = await context.viem().writeContract({
          abi: tokenAbi,
          address: contractAddress,
          functionName: "transfer",
          args: [BALTATHAR_ADDRESS, parseEther("2.0")],
        });

        await context.createBlock();

        const { logs } = await context.viem().getTransactionReceipt({ hash: txHash });

        const decoded = decodeEventLog({
          abi: tokenAbi,
          data: logs[0].data,
          topics: logs[0].topics,
        });

        expect(decoded.eventName).to.equal("Transfer");
        expect((decoded.args as any).from).to.equal(ALITH_ADDRESS);
      },
    });

    it({
      id: "T17",
      title: "It can use different signers when creating a block",
      test: async () => {
        log("Testing different signers - using Baltathar private key to sign transaction");
        const txn = context.polkadotJs().tx.balances.transferAllowDeath(DOROTHY_ADDRESS, GLMR);
        const balBefore = (
          await context.polkadotJs().query.system.account(BALTATHAR_ADDRESS)
        ).data.free.toBigInt();

        await context.createBlock(txn, {
          signer: { type: "ethereum", privateKey: BALTATHAR_PRIVATE_KEY },
        });
        const balanceAfter = (
          await context.polkadotJs().query.system.account(BALTATHAR_ADDRESS)
        ).data.free.toBigInt();

        expect(balanceAfter).toBeLessThan(balBefore);
      },
    });

    it({
      id: "T18",
      title: "It can use different apis",
      test: async () => {
        log("Testing different API usage - comparing context.viem() vs context.api('viem')");
        log(await context.viem().getBalance({ address: BALTATHAR_ADDRESS }));
        expect(
          await context.api("viem").getBalance({ address: BALTATHAR_ADDRESS })
        ).toBeGreaterThan(0n);
      },
    });

    it({
      id: "T19",
      title: "It has working runner functions added to context",
      test: async () => {
        log("Testing runner functions - creating raw transactions with createTxn");
        const address1 = privateKeyToAccount(generatePrivateKey()).address;
        const address2 = privateKeyToAccount(generatePrivateKey()).address;

        const rawTxn1 = await context.createTxn?.({
          to: address1,
          value: parseEther("1.0"),
          libraryType: "viem",
        });

        await context.createBlock(rawTxn1);
        log(`Raw generated txn1 is ${rawTxn1}`);
        expect(rawTxn1?.length).toBeGreaterThan(2);

        const balance1 = await context.viem().getBalance({ address: address1 });
        expect(balance1).toBe(GLMR);
        const rawTxn2 = await context.createTxn?.({
          to: address2,
          value: parseEther("1.0"),
          libraryType: "viem",
        });
        await context.createBlock(rawTxn2);
        log(`Raw generated txn2 is ${rawTxn2}`);
        expect(rawTxn2?.length).toBeGreaterThan(2);

        const balance2 = await context.viem().getBalance({ address: address2 });
        expect(balance2).toBe(GLMR);
      },
    });

    it({
      id: "T20",
      title: "It can read a precompiled contracts",
      test: async () => {
        log("Testing precompiled contract reading - reading ParachainStaking round");
        const round = await context.readPrecompile?.({
          precompileName: "ParachainStaking",
          functionName: "round",
        });

        log(`Parachain staking Round is ${round}`);
        expect(round).toBe(1n);
      },
    });

    it({
      id: "T21",
      title: "It can write to a precompiled contract",
      test: async () => {
        log("Testing precompiled contract writing - approving NativeErc20 allowance");
        const allowanceBefore = (await context.readPrecompile?.({
          precompileName: "NativeErc20",
          functionName: "allowance",
          args: [ALITH_ADDRESS, BALTATHAR_ADDRESS],
        })) as bigint;

        log(`Allowance of baltathar is:  ${allowanceBefore}`);

        // const tx = await context.writePrecompile?.({
        //   precompileName: "NativeErc20",
        //   functionName: "approve",
        //   args: [BALTATHAR_ADDRESS, GLMR],
        //   gas: 400_123n,
        //   // web3Library: "ethers",
        //   rawTxOnly:true,

        // });

        const { abi } = fetchCompiledContract(PRECOMPILES.NativeErc20[1]);
        const data = encodeFunctionData({
          abi,
          functionName: "approve",
          args: [BALTATHAR_ADDRESS, GLMR],
        });

        const tx = await createViemTransaction(context, {
          to: PRECOMPILES.NativeErc20[0],
          value: 0n,
          data,
          txnType: "legacy",
          gas: 400_123n,
        });

        log(`Txn hash is ${tx}`);

        await context.createBlock(tx);

        const allowanceAfter = (await context.readPrecompile?.({
          precompileName: "NativeErc20",
          functionName: "allowance",
          args: [ALITH_ADDRESS, BALTATHAR_ADDRESS],
        })) as bigint;
        log(`Allowance of baltathar is:  ${allowanceAfter}`);
        expect(allowanceAfter - allowanceBefore).toBe(GLMR);

        const rawTx = await context.writePrecompile?.({
          precompileName: "NativeErc20",
          functionName: "approve",
          rawTxOnly: true,
          args: [BALTATHAR_ADDRESS, 2n * GLMR],
        });
        log(rawTx);

        await context.createBlock(rawTx);

        const allowanceFinal = (await context.readPrecompile?.({
          precompileName: "NativeErc20",
          functionName: "allowance",
          args: [ALITH_ADDRESS, BALTATHAR_ADDRESS],
        })) as bigint;
        log(`Allowance of baltathar is:  ${allowanceFinal}`);
        expect(allowanceFinal - allowanceAfter).toBe(GLMR);
      },
    });

    it({
      id: "T22",
      title: "it can read a newly deployed contract",
      test: async () => {
        log("Testing contract deployment and reading - deploying ToyContract and reading value");
        const result = await context.deployContract?.("ToyContract");
        if (!result) {
          throw new Error("No result");
        }

        const contractAddress = result.contractAddress;

        log(`Deployed contract at ${contractAddress}`);

        const value = await context.readContract?.({
          contractName: "ToyContract",
          contractAddress,
          functionName: "value",
        });
        log(`Value is ${value}`);
        expect(value).toBe(5n);
        await context.writeContract?.({
          contractName: "ToyContract",
          contractAddress,
          functionName: "setter",
          args: [20],
        });
        await context.createBlock();

        const value2 = await context.readContract?.({
          contractName: "ToyContract",
          contractAddress,
          functionName: "value",
        });
        log(`Value is ${value2}`);
        expect(value2).toBe(20n);
      },
    });

    it({
      id: "T23",
      title: "it can interact with a contract with balance",
      test: async () => {
        log("Testing contract with balance - sending ETH to ToyContract");
        const { contractAddress } = await context.deployContract!("ToyContract");
        const balBefore = await context.viem().getBalance({ address: contractAddress });

        await context.writeContract?.({
          contractName: "ToyContract",
          contractAddress,
          functionName: "acceptBalance",
          value: parseEther("1.0"),
        });
        await context.createBlock();

        const balAfter = await context.viem().getBalance({ address: contractAddress });
        log(`Balance before: ${formatEther(balBefore)}`);
        log(`Balance after: ${formatEther(balAfter)}`);

        expect(balAfter - balBefore).toBe(parseEther("1.0"));
      },
    });

    it({
      id: "T24",
      title: "it can jump 10 blocks",
      test: async () => {
        log("Testing block jumping - advancing 10 blocks");
        const block = (
          await context.polkadotJs().rpc.chain.getBlock()
        ).block.header.number.toNumber();

        await context.jumpBlocks?.(10);

        const block2 = (
          await context.polkadotJs().rpc.chain.getBlock()
        ).block.header.number.toNumber();
        log(`Previous block #${block}, new block #${block2}`);
        expect(block2).toBe(block + 10);
      },
    });

    it({
      id: "T25",
      title: "it can jump ParachainStaking rounds",
      test: async () => {
        log("Testing ParachainStaking round jumping - advancing 1 round");
        log(`This chain has parachainStaking: ${context.isParachainStaking}`);
        const round = (
          (await context.polkadotJs().query.parachainStaking.round()) as any
        ).current.toNumber();

        const block = (
          await context.polkadotJs().rpc.chain.getBlock()
        ).block.header.number.toNumber();

        await context.jumpRounds?.(1);
        const round2 = (
          (await context.polkadotJs().query.parachainStaking.round()) as any
        ).current.toNumber();
        const block2 = (
          await context.polkadotJs().rpc.chain.getBlock()
        ).block.header.number.toNumber();
        log(`Previous block #${block}, new block #${block2}`);
        log(`Previous round #${round}, new round #${round2}`);
        expect(round2).toBe(round + 1);
      },
    });

    it({
      id: "T26",
      title: "it can fast execute an openGov proposal",
      test: async () => {
        log("Testing OpenGov proposal execution - authorizing system upgrade");
        // change this to system.authorizedupgrade after sdk 1.7
        const value = (await context.pjsApi.query.system.authorizedUpgrade()).isNone;
        expect(value, "system.authorizedUpgrade should be empty to begin with").toBe(true);

        const extrinsicCall = context.pjsApi.tx.system.authorizeUpgrade(
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        );

        await whiteListedTrack(context, extrinsicCall);

        const postStatus = (await context.pjsApi.query.system.authorizedUpgrade()).isNone;
        expect(postStatus).toBe(false);

        expect(
          (await context.pjsApi.query.system.authorizedUpgrade()).unwrap().codeHash.toHex()
        ).toBe("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      },
    });
  },
});
