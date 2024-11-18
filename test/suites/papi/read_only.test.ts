import { describeSuite, expect, beforeAll, afterAll } from "@moonwall/cli";
import type { PolkadotClient } from "polkadot-api";
import { dot } from "@polkadot-api/descriptors";

describeSuite({
  id: "P01",
  title: "Polkadot API - Read Only ",
  foundationMethods: "read_only",
  testCases: ({ it, context, log }) => {
    let papi: PolkadotClient;

    beforeAll(() => {
      log("Should be before all test cases");
      papi = context.papi();
    });

    it({
      id: "T1",
      title: "Can connect to polkadot relaychain",
      test: async () => {
        const { number } = await papi.getFinalizedBlock();
        expect(number).toBeGreaterThan(0);
        const { name } = await papi.getChainSpecData();
        expect(name).toBe("Polkadot");
      },
    });

    it({
      id: "T2",
      title: "Can do queries with untyped api",
      test: async () => {
        const unsafeApi = await papi.getUnsafeApi();
        const gav = "16SDAKg9N6kKAbhgDyxBXdHEwpwHUHs2CNEiLNGeZV55qHna";
        const {
          data: { free },
        } = await unsafeApi.query.System.Account.getValue(gav);
        expect(free).toBeGreaterThan(0n);
      },
    });

    it({
      id: "T3",
      title: "Can do queries with typed api",
      test: async () => {
        const typedApi = await papi.getUnsafeApi<typeof dot>();
        const gav = "16SDAKg9N6kKAbhgDyxBXdHEwpwHUHs2CNEiLNGeZV55qHna";
        const {
          data: { free },
        } = await typedApi.query.System.Account.getValue(gav);
        expect(free).toBeGreaterThan(0n);
      },
    });

    it({
      id: "T4",
      title: "Can fetch chain constants",
      test: async () => {
        const typedApi = await papi.getUnsafeApi<typeof dot>();
        const { spec_version, spec_name } = await typedApi.constants.System.Version();

        expect(spec_version).toBeGreaterThan(0);
        expect(spec_name).toBe("polkadot");
      },
    });

    it({
      id: "T5",
      title: "Can get safeApi ",
      test: async () => {
        const safeApi = await context.papi().getTypedApi(dot);
        expect(safeApi).not.toBeNull();
        const block = await safeApi.query.System.Number.getValue();
        expect(block).toBeGreaterThan(0);
      },
    });
  },
});
