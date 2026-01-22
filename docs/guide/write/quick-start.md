# Writing Tests Quick Start

Let's write a super simple test case that we'll run in the
[Quick Start Running Tests](/guide/test/quick-start) Section.

### Moonwall Utils

Moonwall utils is a utils package with helpful constants and various functions for Moonwall. In the test file you can refer to some pre-funded development accounts like ALITH and BALTATHAR which can be easily imported from ```@moonwall/util```. ALITH and BALTATHAR are EVM versions (20 byte Account20 types) of ALICE and BOB, the Substrate (32 byte AccountId32 types) predefined development accounts.

[Moonwall Utils](https://github.com/Moonsong-Labs/moonwall/tree/main/packages/util){target=blank} contains tons of helpful constants, classes, functions, and helpers. For example, [`Chain.ts`](https://github.com/Moonsong-Labs/moonwall/blob/main/packages/util/src/constants/chain.ts){target=blank} includes weights, precompile addresses, gas constants, and more.

We use `describeSuite` to define our test suite, similar to how you would use Mocha in Javascript. We also need to explicity import `expect` from moonwall, as we'll use this to check the validity of our test cases. `beforeAll` enables us to set up our test environment before any tests are executed.

```typescript
import {describeSuite, beforeAll, expect } from "moonwall"
import {alith, GLMR} from "@moonwall/util"
```

### Additional Imports

There are a few additional imports that are a good idea to have. You'll likely want to query the Polkadot API for blockchain state. We also use ether `utils` for `parseEther`.

```typescript
import { ethers } from "ethers";
import { ApiPromise } from "@polkadot/api";
```


### Configure our Test Suite

When describing a test suite, we need to provide an id, a title, and we need to specify the foundation that we'll be using. In this case we're using the dev foundation, so we're configuring our tests to be run against a local dev node.

```typescript
describeSuite({
	id: "D1",
	title: "Demo suite",
	foundationMethods: "dev",
	testCases: ({it, context, log})=> {
		//Test cases will go here
		}
	})
```

### Write Test Cases

Let's write a basic test case that transfers some funds to an empty dummy account. We assert that the initial balance of the dummy account is 0, then we transfer some funds to it. We'll create a block and then ensure that our final balances are consistent with what we expect.

```typescript
it ({id: "T1", title: "Demo test case", test: async()=> {

            const balanceBefore = (await api.query.system.account(DUMMY_ACCOUNT)).data.free;
            expect(balanceBefore.toString()).toEqual("0");

            await context.ethers().sendTransaction({to:DUMMY_ACCOUNT, value: ethers.parseEther("1").toString() });
            await context.createBlock();

            const balanceAfter = (await api.query.system.account(DUMMY_ACCOUNT)).data.free;
            expect(balanceAfter.sub(balanceBefore).toString()).toEqual(ethers.parseEther("1").toString());
		} })
```

### Sample Test File

Once all is said and done your simple test file should look like the below. Remember, this is a simple demo test case and it is not refined or comprehensive.

```typescript
import {describeSuite, beforeAll, expect } from "moonwall";
import {alith, GLMR} from "@moonwall/util";
import { ethers } from "ethers";
import { ApiPromise } from "@polkadot/api";

describeSuite({
    id: "D1",
    title: "Demo suite",
    foundationMethods: "dev",
    testCases: ({it, context, log})=> {
        let api: ApiPromise;
        const DUMMY_ACCOUNT = "0x11d88f59425cbc1867883fcf93614bf70e87E854";

        beforeAll(() => {
          api = context.polkadotJs();
        });


        it ({id: "T1", title: "Demo test case", test: async()=> {

            const balanceBefore = (await api.query.system.account(DUMMY_ACCOUNT)).data.free;
            expect(balanceBefore.toString()).toEqual("0");
            log("balance before: " + balanceBefore);
            await context.ethers().sendTransaction({to:DUMMY_ACCOUNT, value: ethers.parseEther("1").toString() });
            await context.createBlock();
            const balanceAfter = (await api.query.system.account(DUMMY_ACCOUNT)).data.free;
            log("balance after: " + balanceAfter);
            expect(balanceAfter.sub(balanceBefore).toString()).toEqual(ethers.parseEther("1").toString());
        } })

    }
})
```


### Running your Tests

Now it's time to run your demo test suite! Head over to the Head over to the [Quick Start Running Tests](/guide/test/quick-start) Section to continue.
