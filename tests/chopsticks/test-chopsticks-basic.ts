import { ApiPromise } from "@polkadot/api";
import { Foundation } from "../../src/cli/runner/lib/types.js";
import { MoonwallContext, describeSuite } from "../../src/index.js";
import { expect } from "vitest";
import { blake2AsHex } from "@polkadot/util-crypto";
import { parseEther, formatEther } from "ethers";
import {
  CHARLETH_ADDRESS,
  ETHAN_ADDRESS,
  alith,
} from "../../src/cli/runner/lib/accounts.js";
import { setTimeout } from "timers/promises";
import { readFileSync } from "fs";
import globalConfig from "../../moonwall.config.js";
import { upgradeRuntimeChopsticks } from "../../src/cli/runner/util/upgrade.js";
describeSuite({
  id: "X1",
  title: "Basic chopsticks test",
  foundationMethods: Foundation.Chopsticks,
  testCases: ({ context, it }) => {
    let api: ApiPromise;

    beforeAll(() => {
      api = context.getPolkadotJs();
    });

    it({
      id: "T1",
      title: "Query the chain",
      test: async function () {
        const chainName = api.consts.system.version.specName.toString();
        const currentBlockHeight = (
          await api.rpc.chain.getHeader()
        ).number.toNumber();
        console.log(
          `You are now connected to ${chainName} at height #${currentBlockHeight}`
        );
        expect(currentBlockHeight).toBeGreaterThan(0);
        expect(chainName).toBe("moonbeam");
      },
    });

    it({
      id: "T2",
      title: "Send a transaction ",
      test: async function () {
        const currentBalance = (await api.query.system.account(ETHAN_ADDRESS))
          .data.free;
        await api.tx.balances
          .transfer(ETHAN_ADDRESS, parseEther("10"))
          .signAndSend(alith);
        await context.createBlock();

        const balanceAfter = (await api.query.system.account(ETHAN_ADDRESS))
          .data.free;
        expect(currentBalance.lt(balanceAfter)).toBeTruthy();
      },
    });

    it({
      id: "T3",
      title: "Skips multiple blocks ",
      test: async function () {
        const currentBlock = (
          await api.rpc.chain.getHeader()
        ).number.toNumber();
        await context.createBlock({ count: 3 });
        const laterBlock = (await api.rpc.chain.getHeader()).number.toNumber();
        expect(laterBlock - currentBlock).toBe(3);
      },
    });

    it({
      id: "T4",
      title: "Can overwrite storage values",
      timeout: 30000,
      test: async function () {
        const storageValue = [
          [
            ["0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0"],
            { data: { free: "1337000000000000000000" }, nonce: 1 },
          ],
        ];

        const balBefore = (
          await api.query.system.account(
            "0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0"
          )
        ).data.free;

        await context.setStorage({
          module: "System",
          method: "Account",
          methodParams: storageValue,
        });
        await context.createBlock();
        const balAfter = (
          await api.query.system.account(
            "0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0"
          )
        ).data.free;
        console.log(
          `Balance of 0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0 before: ${formatEther(
            balBefore.toString()
          )} GLMR; after: ${formatEther(balAfter.toString())} GLMR`
        );

        expect(balBefore.lt(balAfter));
      },
    });

    it({
      id: "T5",
      title: "Do an upgrade test",
      timeout: 120000,
      // modifier: "only",
      test: async function () {
        const rtBefore = api.consts.system.version.specVersion.toNumber();
        await context.upgradeRuntime(context);
        const rtafter = api.consts.system.version.specVersion.toNumber();
        expect(rtBefore).toBeLessThan(rtafter);
      },
    });

    it({
      id: "T6",
      title: "Check the createBlockAndCheck fn",
      // modifier: "only",
      test: async function () {
        const events = [
          api.events.system.ExtrinsicSuccess,
          api.events.balances.Transfer,
          api.events.system.NewAccount,
          // api.events.authorFilter.EligibleUpdated
        ];
        await api.tx.balances
          .transfer(CHARLETH_ADDRESS, parseEther("3"))
          .signAndSend(alith);

        const { match } = await context.createBlockAndCheck(events);

        expect(match).toStrictEqual(true);
      },
    });
  },
});
