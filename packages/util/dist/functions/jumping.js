// src/functions/jumping.ts
import "@moonbeam-network/api-augment";
import WebSocket from "ws";
async function jumpBlocksDev(polkadotJsApi, blocks) {
  let blockCount = blocks;
  while (blockCount > 0) {
    await polkadotJsApi.rpc.engine.createBlock(true, true);
    blockCount--;
  }
}
async function jumpRoundsDev(polkadotJsApi, count) {
  const round = (await polkadotJsApi.query.parachainStaking.round()).current
    .addn(count.valueOf())
    .toNumber();
  return jumpToRoundDev(polkadotJsApi, round);
}
async function jumpToRoundDev(polkadotJsApi, round) {
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
async function jumpRoundsChopsticks(polkadotJsApi, port, count) {
  const round = (await polkadotJsApi.query.parachainStaking.round()).current
    .addn(count.valueOf())
    .toNumber();
  return jumpToRoundChopsticks(polkadotJsApi, port, round);
}
async function jumpToRoundChopsticks(polkadotJsApi, port, round) {
  const blockToJump = await calculateBlocks(polkadotJsApi, round);
  return jumpBlocksChopsticks(port, blockToJump);
}
async function jumpBlocksChopsticks(port, blockCount) {
  return await sendNewBlockCmd(port, blockCount);
}
var sendNewBlockCmd = async (port, count = 1) => {
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
export {
  jumpBlocksChopsticks,
  jumpBlocksDev,
  jumpRoundsChopsticks,
  jumpRoundsDev,
  jumpToRoundChopsticks,
  jumpToRoundDev,
};
//# sourceMappingURL=jumping.js.map
