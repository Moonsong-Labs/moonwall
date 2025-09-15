import "@moonbeam-network/api-augment";
import WebSocket from "ws";
//**************************
// DEV
//**************************
export async function jumpBlocksDev(polkadotJsApi, blocks) {
  let blockCount = blocks;
  while (blockCount > 0) {
    await polkadotJsApi.rpc.engine.createBlock(true, true);
    blockCount--;
  }
}
export async function jumpRoundsDev(polkadotJsApi, count) {
  // Calculate the number of blocks to create via arithmetic
  const round = (await polkadotJsApi.query.parachainStaking.round()).current
    .addn(count.valueOf())
    .toNumber();
  return jumpToRoundDev(polkadotJsApi, round);
}
export async function jumpToRoundDev(polkadotJsApi, round) {
  // Calculate the number of blocks to create via arithmetic
  let lastBlockHash = "";
  for (;;) {
    const currentRound = (await polkadotJsApi.query.parachainStaking.round()).current.toNumber();
    if (currentRound === round) {
      return lastBlockHash;
    }
    if (currentRound > round) {
      return null;
    }
    lastBlockHash = (await polkadotJsApi.rpc.engine.createBlock(true, true)).blockHash.toString();
  }
}
//**************************
// CHOPSTICKS
//**************************
async function calculateBlocks(polkadotJsApi, targetRound) {
  const roundInfo = await polkadotJsApi.query.parachainStaking.round();
  if (roundInfo.current.toNumber() >= targetRound) {
    return 0;
  }
  const roundsToJump = targetRound - roundInfo.current.toNumber();
  const heightToJump = roundInfo.first.toNumber() + roundsToJump * roundInfo.length.toNumber();
  const currentBlock = (await polkadotJsApi.rpc.chain.getHeader()).number.toNumber();
  return heightToJump - currentBlock;
}
export async function jumpRoundsChopsticks(polkadotJsApi, port, count) {
  const round = (await polkadotJsApi.query.parachainStaking.round()).current
    .addn(count.valueOf())
    .toNumber();
  return jumpToRoundChopsticks(polkadotJsApi, port, round);
}
export async function jumpToRoundChopsticks(polkadotJsApi, port, round) {
  const blockToJump = await calculateBlocks(polkadotJsApi, round);
  return jumpBlocksChopsticks(port, blockToJump);
}
export async function jumpBlocksChopsticks(port, blockCount) {
  return await sendNewBlockCmd(port, blockCount);
}
const sendNewBlockCmd = async (port, count = 1) => {
  const websocketUrl = `ws://127.0.0.1:${port}`;
  const socket = new WebSocket(websocketUrl);
  const result = await new Promise((resolve) => {
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
      const data = JSON.parse(chunk.toString());
      resolve(data.result);
      socket.close();
    });
  });
  return result;
};
//# sourceMappingURL=jumping.js.map
