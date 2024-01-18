# Running Tests Quick Start

This guide assumes that you've already installed Moonwall and you have a basic test case that you want to run. The test case can be a simple transaction that transfers some dust from one test account to another. You can put together a simple test suite here in the [Quick Start Writing Tests guide](/guide/write/quick-start)

## Getting your Config File Sorted

Your `moonwall.config.json` file that lives in the root directory of your project is the key to setting up a sublime testing experience. Go ahead and open it up and let's get started setting it up. In this quick start, we'll set up our Moonwall config file for testing on a local moonbeam node using the [dev foundation](/guide/intro/foundations.html#dev){target=blank}.

### Environment

You'll need to give a name to your environment and you'll need to specify a directory for your test files. The default parameters are as follows:

```json
"environments": [
      {
         "name": "default_env",
         "multiThreads":false,
         "testFileDir": [
            "tests/"
         ],
```

### Foundation

For this quick start, we've chosen the dev foundation, which utilizes a local development node. We also specify our port information. 

```json
 "foundation": {
            "type": "dev",
            "launchSpec": [{
              "name": "Moonbeam",
              "running": true,
              "newRpcBehaviour": true,
              "binPath": "tmp/moonbeam",
              "ports": {"wsPort": 1337}
            }]
         },
```

### Connections and Providers

We've defined here our endpoint information and set up two connections, one that uses the polkadotJs provider and another that uses the Ethers provider.

```json
{
  "connections": [
    {
      "name": "myconnection",
      "type": "polkadotJs",
      "endpoints": [
        "ws://127.0.0.1:1337"
      ]
    },
    {
      "name": "myconnection",
      "type": "ethers",
      "endpoints": [
        "ws://127.0.0.1:1337"
      ]
    }
  ]
}
```

### Sample Config File for Dev 

Putting it all together, our config file for testing on a local Moonbeam node using the dev foundation looks like this: 

```json
{
   "label": "moonwall_config",
   "$schema": "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/packages/types/config_schema.json",
   "defaultTestTimeout": 30000,
   "environments": [
      {
         "name": "default_env",
         "multiThreads":false,
         "testFileDir": [
            "tests/"
         ],
         "foundation": {
            "type": "dev",
            "launchSpec": [{
              "name": "Moonbeam",
              "running": true,
              "newRpcBehaviour": true,
              "binPath": "tmp/moonbeam",
              "ports": {"wsPort": 1337}
            }]
         },
            "connections":[{"name": "myconnection", "type": "polkadotJs", "endpoints": ["ws://127.0.0.1:1337"]},
            {"name": "myconnection", "type": "ethers", "endpoints": ["ws://127.0.0.1:1337"]}

         ]

      }
   ]
}
```

## Running your Tests

After you've assembled your config file and written your test suite now it's time to run it! To do so, take the following steps:

- Run `pnpm moonwall`
- Select the option of **3) Test Suite Execution** 
- Select the environment that you configured
- Review the results

![run tests](/run-tests.png)