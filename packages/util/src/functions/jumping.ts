import "@moonbeam-network/api-augment";
import type { ApiPromise } from "@polkadot/api";
import WebSocket from "ws";

//**************************
// DEV
//**************************

export async function jumpBlocksDev(polkadotJsApi: ApiPromise, blockCount: number) {
  while (blockCount > 0) {
    await polkadotJsApi.rpc.engine.createBlock(true, true);
    blockCount--;
  }
}

export async function jumpRoundsDev(
  polkadotJsApi: ApiPromise,
  count: number
): Promise<string | null> {
  // Calculate the number of blocks to create via arithmetic
  const round = (await polkadotJsApi.query.parachainStaking.round()).current
    .addn(count.valueOf())
    .toNumber();

  return jumpToRoundDev(polkadotJsApi, round);
}

export async function jumpToRoundDev(polkadotJsApi: ApiPromise, round: number) {
  // Calculate the number of blocks to create via arithmetic
  let lastBlockHash = "";
  for (;;) {
    const currentRound = (await polkadotJsApi.query.parachainStaking.round()).current.toNumber();

    if (currentRound === round) {
      return lastBlockHash;
    } else if (currentRound > round) {
      return null;
    }

    lastBlockHash = (await polkadotJsApi.rpc.engine.createBlock(true, true)).blockHash.toString();
  }
}

//**************************
// CHOPSTICKS
//**************************

async function calculateBlocks(polkadotJsApi: ApiPromise, targetRound: number) {
  const roundInfo = await polkadotJsApi.query.parachainStaking.round();

  if (roundInfo.current.toNumber() >= targetRound) {
    return 0;
  }

  const roundsToJump = targetRound - roundInfo.current.toNumber();
  const heightToJump = roundInfo.first.toNumber() + roundsToJump * roundInfo.length.toNumber();
  const currentBlock = (await polkadotJsApi.rpc.chain.getHeader()).number.toNumber();

  return heightToJump - currentBlock;
}

export async function jumpRoundsChopsticks(polkadotJsApi: ApiPromise, port: number, count: number) {
  const round = (await polkadotJsApi.query.parachainStaking.round()).current
    .addn(count.valueOf())
    .toNumber();

  return jumpToRoundChopsticks(polkadotJsApi, port, round);
}

export async function jumpToRoundChopsticks(
  polkadotJsApi: ApiPromise,
  port: number,
  round: number
) {
  const blockToJump = await calculateBlocks(polkadotJsApi, round);
  return jumpBlocksChopsticks(port, blockToJump);
}

export async function jumpBlocksChopsticks(port: number, blockCount: number) {
  return await sendNewBlockCmd(port, blockCount);
}

const sendNewBlockCmd = async (port: number, count: number = 1) => {
  const websocketUrl = `ws://127.0.0.1:${port}`;
  const socket = new WebSocket(websocketUrl);

  const result: string = await new Promise((resolve) => {
    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "dev_newBlock",
          params: [{ count }],
        })
      );
    });

    socket.on("message", (chunk) => {
      const data: { id: number; jsonrpc: string; result: string } = JSON.parse(chunk.toString());
      resolve(data.result);
      socket.close();
    });
  });

  return result;
};
