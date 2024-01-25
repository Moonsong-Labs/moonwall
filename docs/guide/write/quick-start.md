# Writing Tests Quick Start 

Let's write a super simple test case that we'll run in the 
[Quick Start Running Tests](/guide/test/quick-start) Section. 

## Moonwall Utils

Moonwall utils is a utils package with helpful constants and various functions for Moonwall. In the test file you can refer to some pre-funded development accounts like ALITH and BALTATHAR which can be easily imported from ```@moonwall/util```

We use describeSuite to define our test suite, similar to how you would use Mocha in Javascript. 

```typescript
import {describeSuite} from "@moonwall/cli"
import {BALTATHAR_ADDRESS, GLMR} from "@moonwall/util"
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

We are going to write a basic test case that transfers some funds to Baltathar (which is prefunded account that exists on Moonbeam local dev nodes). Be sure to give the test case an id and a name that makes sense. Then we'll produce a block. 

```typescript
it ({id: "T1", title: "Demo test case", test: async()=> {
			await context.ethers().sendTransaction({to:BALTATHAR_ADDRESS, value: 10n * GLMR });
			await context.createBlock();
		} })
``` 

### Sample Test File

Once all is said and done your simple test file should look like the below. Remember, this is a simple demo test case and it is not refined or comprehensive. 

```typescript
import {describeSuite, expect } from "@moonwall/cli";
import {alith, GLMR} from "@moonwall/util";
import { utils } from "ethers";
import { ApiPromise } from "@polkadot/api";
import "@polkadot/api-augment";

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
            await context.ethers().sendTransaction({to:DUMMY_ACCOUNT, value: utils.parseEther("1").toString() });
            await context.createBlock();
            const balanceAfter = (await api.query.system.account(DUMMY_ACCOUNT)).data.free;
            log("balance after: " + balanceAfter);
            expect(balanceAfter.sub(balanceBefore).toString()).toEqual(utils.parseEther("1").toString());
		} })

	}
})
```


### Running your Tests

Now it's time to run your demo test suite! Head over to the Head over to the [Quick Start Running Tests](/guide/test/quick-start) Section to continue.