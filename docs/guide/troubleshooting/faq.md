# FAQ

### General Troubleshooting 

If you're troubleshooting an error, it's always a good idea to check the [Release Changelog](https://github.com/Moonsong-Labs/moonwall/releases){target=_blank} for details of any breaking changes. As an example, when Moonwall upgraded from Ethers v5 to v6, this required changing from `BigNumber` to `BigInt` types. Secondly, it's always a good idea to make sure your packages are updated. 

### How do I upgrade Moonwall?

You can upgrade Moonwall with the following command:

```bash
pnpm update
```

Make sure that you specify the correct version of Moonwall that you'd like to use in your `package.json`. An example `package.json` is included below:

```json
{
  "name": "myMoonwallProjectFolder",
  "type": "module",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@moonbeam-network/api-augment": "^0.2600.0",
    "@moonwall/cli": "^4.7.5",
    "@moonwall/util": "^4.7.5",
    "ethers":"^6.10.0",
    "@polkadot/api": "^10.11.2",
    "typescript": "^5.6.3"
  }
}
```

Then run `pnpm update` or `pnpm i` to update / install the necessary packages. 

![Moonwall init terminal screenshot](/moonwall-update.png)


### How do I add support for my network in Moonwall?

You can define your custom network environment exactly as you'd like in your local `moonwall.config.json`. If you'd like other folks to refer to your environment specs, you can submit a PR to add your network details to the [Moonwall Global Test Config](https://github.com/Moonsong-Labs/moonwall/blob/main/test/moonwall.config.json){target=_blank}

Here's an example of the Astar environment in the Global Test Config:

```json
{
      "name": "astar",
      "testFileDir": ["suites/basic"],
      "description": "A star is born",
      "foundation": {
        "type": "dev",
        "launchSpec": [
          {
            "binPath": "./tmp/astar-collator",
            "disableDefaultEthProviders": true,
            "options": ["--dev"],
            "newRpcBehaviour": true
          }
        ]
      }
    },
```

### Why do I need to build my binary manually from source? 

You may see a notice like this if you're running on an Apple Silicon Chip (e.g. M1, M2, M3): 

```bash
Given you are running arm64 architecture, you will need to build it manually from source 🛠️
```

You can follow the instructions here for [Spining Up a Node with a Binary File](https://docs.moonbeam.network/builders/get-started/networks/moonbeam-dev/#getting-started-with-the-binary-file){target=_blank}. It should take less than 30 minutes to compile the binary. 

### How do I get in touch with the team?

You can reach us at info@moonsonglabs.com. You can also raise an issue in the [GitHub repo](https://github.com/Moonsong-Labs/moonwall/issues/new).