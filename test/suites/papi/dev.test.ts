import { describeSuite, expect, beforeAll, customDevRpcRequest } from "@moonwall/cli";
import type { PolkadotClient, TypedApi } from "polkadot-api";
import { mb } from "@polkadot-api/descriptors";

describeSuite({
  id: "P01",
  title: "Polkadot API - Dev",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
    let papi: PolkadotClient;
    let api: TypedApi<typeof mb>;

    beforeAll(async () => {
      log("Should be before all test cases");
      papi = context.papi();
      api = papi.getTypedApi(mb);
      // The dev node uses manual sealing, so polkadot-api waits for the first
      // block before exposing APIs. Kick off an initial block to avoid
      // heartbeat-induced hangs during setup.
      await customDevRpcRequest("engine_createBlock", [true, true]);
      log("PAPI and Typed API initialized");
    });

    it({
      id: "T1",
      title: "Can connect to dev node",
      test: async () => {
        log("Testing PAPI connection to dev node and spec validation");
        console.log(api.constants);
        const { spec_name } = await api.constants.System.Version();
        log(`Connected to spec: ${spec_name}`);
        expect(spec_name.toString()).toBe("moonbase");
      },
    });

    it({
      id: "T2",
      title: "Can query chain",
      test: async () => {
        log("Testing PAPI chain querying and block creation");
        const blockbefore = await api.query.System.Number.getValue();
        log(`Block number before: ${blockbefore}`);

        await customDevRpcRequest("engine_createBlock", [true, true]);
        await new Promise((resolve) => setTimeout(resolve, 500));
        const blockafter = await api.query.System.Number.getValue();
        log(`Block number after: ${blockafter}`);
        expect(blockafter).toBeGreaterThan(blockbefore);
      },
    });
  },
});
