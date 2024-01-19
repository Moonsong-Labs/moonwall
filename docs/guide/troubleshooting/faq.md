# FAQ

### How do I upgrade Moonwall?

You can upgrade Moonwall with the following command:

```bash
pnpm update
```

If you're troubleshooting an error, it's always a good idea to check the [Release Changelog](https://github.com/Moonsong-Labs/moonwall/releases){target=_blank} for details of any breaking changes. As an example, when Moonwall upgraded from Ethers v5 to v6, this required changing from `BigNumber` to `BigInt` types. 

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
            "options": ["--dev", "--sealing=manual", "--no-hardware-benchmarks", "--no-telemetry"],
            "newRpcBehaviour": true
          }
        ]
      }
    },
```


### How do I get in touch with the team?

You can reach us at info@moonsonglabs.com. You can also raise an issue in the [GitHub repo](https://github.com/Moonsong-Labs/moonwall/issues/new).