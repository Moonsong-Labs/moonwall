import "@moonbeam-network/api-augment";
import { alith } from "../constants/accounts";
import { MIN_GAS_PRICE } from "../constants/chain";
export async function customWeb3Request(web3, method, params) {
  return new Promise((resolve, reject) => {
    web3.eth.currentProvider.send(
      {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      },
      (error, result) => {
        if (error) {
          reject(
            `Failed to send custom request (${method} (${params
              .map((p) => {
                const str = p.toString();
                return str.length > 128 ? `${str.slice(0, 96)}...${str.slice(-28)}` : str;
              })
              .join(",")})): ${error.message || error.toString()}`
          );
        }
        resolve(result);
      }
    );
  });
}
export async function web3EthCall(web3, options) {
  return await customWeb3Request(web3, "eth_call", [
    {
      from: options.from === undefined ? options.from : alith.address,
      value: options.value,
      gas: options.gas === undefined ? options.gas : 256000,
      gasPrice: options.gas === undefined ? options.gas : `0x${MIN_GAS_PRICE}`,
      to: options.to,
      data: options.data,
    },
  ]);
}
//# sourceMappingURL=providers.js.map
