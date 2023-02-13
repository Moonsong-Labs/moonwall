import { expect } from "chai";
import { testSuite } from "../../src/cli/runner/util/runner-functions";
import { Contract, formatUnits } from "ethers";
import { xcAssetAbi } from "../../src/cli/runner/lib/moonbeam_consts";

testSuite({
  id: "dev",
  title: "Dev test suite",
  testCases: ({ it, context }) => {
    const api = context.ethersApi("eth");
    const polkadotJs = context.polkaCtx("eth");

    it("x01", "Checking that launched node can be queried", async function () {

    });

    // Send a manual extrinsic

    // create a block

    // use sudo to fill block

  },
});
