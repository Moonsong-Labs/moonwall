import { describeSuite, expect, beforeAll, afterAll } from "moonwall";
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
        log("Connecting to Polkadot relaychain via PAPI");
        const { number } = await papi.getFinalizedBlock();
        log(`Finalized block number: ${number}`);
        expect(number).toBeGreaterThan(0);
        const { name } = await papi.getChainSpecData();
        log(`Chain name: ${name}`);
        expect(name).toBe("Polkadot");
      },
    });

    it({
      id: "T2",
      title: "Can do queries with untyped api",
      test: async () => {
        log("Testing untyped API queries");
        const unsafeApi = await papi.getUnsafeApi();
        const gav = "16SDAKg9N6kKAbhgDyxBXdHEwpwHUHs2CNEiLNGeZV55qHna";
        const {
          data: { free },
        } = await unsafeApi.query.System.Account.getValue(gav);
        log(`Gav's free balance: ${free}`);
        expect(free).toBeGreaterThanOrEqual(0n);
      },
    });

    it({
      id: "T3",
      title: "Can do queries with typed api",
      test: async () => {
        log("Testing typed API queries");
        const typedApi = await papi.getUnsafeApi<typeof dot>();
        const gav = "16SDAKg9N6kKAbhgDyxBXdHEwpwHUHs2CNEiLNGeZV55qHna";
        const {
          data: { free },
        } = await typedApi.query.System.Account.getValue(gav);
        log(`Gav's free balance via typed API: ${free}`);
        expect(free).toBeGreaterThanOrEqual(0n);
      },
    });

    it({
      id: "T4",
      title: "Can fetch chain constants",
      test: async () => {
        log("Fetching chain constants");
        const typedApi = await papi.getUnsafeApi<typeof dot>();
        const { spec_version, spec_name } = await typedApi.constants.System.Version();

        log(`Spec version: ${spec_version}, Spec name: ${spec_name}`);
        expect(spec_version).toBeGreaterThan(0);
        expect(spec_name).toBe("polkadot");
      },
    });

    it({
      id: "T5",
      title: "Can get safeApi ",
      test: async () => {
        log("Testing safe API access");
        const safeApi = await context.papi().getTypedApi(dot);
        expect(safeApi).not.toBeNull();
        const block = await safeApi.query.System.Number.getValue();
        log(`Current block number via safe API: ${block}`);
        expect(block).toBeGreaterThan(0);
      },
    });
  },
});
