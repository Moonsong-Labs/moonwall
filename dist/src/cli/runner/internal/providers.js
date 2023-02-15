"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.web3Subscribe = exports.web3EthCall = exports.customWeb3Request = void 0;
const accounts_1 = require("../lib/accounts");
const constants_1 = require("../lib/constants");
async function customWeb3Request(web3, method, params) {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            id: 1,
            method,
            params,
        }, (error, result) => {
            if (error) {
                reject(`Failed to send custom request (${method} (${params
                    .map((p) => {
                    const str = p.toString();
                    return str.length > 128 ? `${str.slice(0, 96)}...${str.slice(-28)}` : str;
                })
                    .join(",")})): ${error.message || error.toString()}`);
            }
            resolve(result);
        });
    });
}
exports.customWeb3Request = customWeb3Request;
async function web3EthCall(web3, options) {
    return await customWeb3Request(web3, "eth_call", [
        {
            from: options.from == undefined ? options.from : accounts_1.alith.address,
            value: options.value,
            gas: options.gas == undefined ? options.gas : 256000,
            gasPrice: options.gas == undefined ? options.gas : `0x${constants_1.MIN_GAS_PRICE}`,
            to: options.to,
            data: options.data,
        },
    ]);
}
exports.web3EthCall = web3EthCall;
function web3Subscribe(web3, type, params) {
    return web3.eth.subscribe(...[].slice.call(arguments, 1));
}
exports.web3Subscribe = web3Subscribe;
//# sourceMappingURL=providers.js.map