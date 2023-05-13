import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Chain } from "viem/chains";
import { DevModeContext } from "../types/runner.js";
import { ALITH_PRIVATE_KEY } from "@moonwall/util";

export async function getDevChain(url: string) {
  const httpUrl = url.replace("ws", "http");
  const block = { http: [httpUrl] };

  return {
    id: 1281,
    name: "Moonbeam Dev",
    network: "moonbeam",
    nativeCurrency: {
      decimals: 18,
      name: "Moonbeam",
      symbol: "GLMR",
    },
    rpcUrls: {
      public: block,
      default: block,
    },
  } as const satisfies Chain;
}

export async function deployViemContract(
  context: DevModeContext,
  abi: any[],
  bytecode: `0x${string}`,
  privateKey: `0x${string}` = ALITH_PRIVATE_KEY
) {
  const url = context.viemClient("public").transport.url;
  const account = privateKeyToAccount(ALITH_PRIVATE_KEY);
  const client = createWalletClient({
    transport: http(url),
    account,
    chain: await getDevChain(url),
  });

  // Remove below when viem fixes this type
  // @ts-expect-error
  const hash = await client.deployContract({
    abi,
    bytecode,
    account: privateKeyToAccount(privateKey),
  });

  await context.createBlock();

  const { contractAddress, status, logs } = await context
    .viemClient("public")
    .getTransactionReceipt({ hash });

  return { contractAddress, status, logs };
}
