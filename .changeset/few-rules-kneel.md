---
"@moonwall/util": patch
"@moonwall/cli": patch
---

Added custom RPC support

As described [here](https://polkadot.js.org/docs/api/start/rpc.custom/) we can now added custom RPC methods in the `moonwall.config.json` file.

This can be done by adding the Module and Method details to the provider config as specified in connections:

```
"connections": [
        {
          "name": "para",
          "type": "moon",
          "endpoints": ["ws://127.0.0.1:9944"],
          "rpc": {
            "moon": {
              "isTxFinalized": {
                "description": "Just a test method",
                "params": [
                  {
                    "name": "txHash",
                    "type": "Hash"
                  }
                ],
                "type": "bool"
              }
            }
          }
        }
      ]
```

> :information_source: Whilst this allows you to send RPC commands via the API, it will not automatically decorate the API in typescript, and will give you errors. Use `// @typescript-expect-error` to stop in-editor errors until a proper api-augment package is developed for your project.
> :warning: Even if you define a custom method, it will only be callable if it is being returned in the list by `api.rpc.rpc.methods()` which is the list of known RPCs the node exposes.