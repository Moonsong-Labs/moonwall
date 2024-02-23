# Networks Supported 

## Overview 
Moonwall works with a variety of Substrate-based networks. Moonwall was first designed to serve the testing requirements of Moonbeam networks but has since been expanded and upgraded to be able to work with any Substrate network. 

For the most-up-to-date list of networks pre-configured to work with Moonwall, refer to the [Moonwall global config](https://github.com/Moonsong-Labs/moonwall/blob/main/test/moonwall.config.json){target=_blank}. Those networks include: 

- [Astar](https://astar.network/){target=_blank}
- [HydraDx](https://hydradx.io/){target=_blank}
- [Interlay](https://www.interlay.io/){target=_blank}
- [Tanssi](https://www.tanssi.network/){target=_blank}
- [Moonbeam](https://docs.moonbeam.network/){target=_blank}
- [Moonriver](https://docs.moonbeam.network/){target=_blank}
- [Zeitgeist](https://zeitgeist.pm/){target=_blank}

## Support for Custom Chains

Moonwall supports any arbitrary Substrate-based chain you specify in your `moonwall.config.json`. You'll need to provide the path to your chain's launch spec, as well as any node options. 

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


You can submit a PR to add your network details to the [Moonwall Global Test Config](https://github.com/Moonsong-Labs/moonwall/blob/main/test/moonwall.config.json){target=_blank}
