import { Chain } from "viem";
import { MoonwallContext } from "../lib/globalContext.js";

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
