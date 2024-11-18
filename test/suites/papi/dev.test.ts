import { describeSuite, expect, beforeAll, afterAll, customDevRpcRequest } from "@moonwall/cli";
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
      api = await papi.getTypedApi(mb);
    });

    it({
      id: "T1",
      title: "Can connect to dev node",
      test: async () => {
        const { spec_name } = await api.constants.System.Version();
        expect(spec_name.toString()).toBe("moonbase");
      },
    });

    it({
      id: "T2",
      title: "Can query chain",
      test: async () => {
        const blockbefore = await api.query.System.Number.getValue();

        await customDevRpcRequest("engine_createBlock", [true, true]);

        const blockafter = await api.query.System.Number.getValue();
        expect(blockafter).toBeGreaterThan(blockbefore);
      },
    });
  },
});
