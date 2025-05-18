# Read-Only Foundation Configuration

The **read-only foundation** tells Moonwall to **connect to an already running remote chain** instead of starting one for you.  
It is ideal when:

* You want to smoke-test a **public test-net** (e.g. Moonbase Alpha).
* Your CI pipeline points to a chain that is spun-up **outside** of Moonwall (Docker-Compose, Kubernetes, …).
* You need to run **long-running soak tests** without restarting the network between test-suites.

Because Moonwall has no control over the node process there are only a couple of parameters to tweak.

---

## 1 – Quick reference

| Property                               | Type / Values                         | Required | Description |
|----------------------------------------|---------------------------------------|----------|-------------|
| `type`                                 | `"read_only"`                         | ✅       | Identifies the foundation. |
| `rateLimiter`                          | `boolean` \| `Bottleneck.Options`     | ❌       | Enables a per-provider rate limiter (**on by default**).  Pass `false` to disable or an object to fine-tune [`Bottleneck`](https://www.npmjs.com/package/bottleneck). |
| `disableRuntimeVersionCheck`           | `boolean`                             | ❌       | Set to **true** if you do *not* want Moonwall to query the chain’s metadata for `specName` / `specVersion`.  Helpful when the node exposes a custom RPC that blocks `state_getMetadata`. |

All other runtime parameters – WS endpoints, providers, default signer, … – live in the *environment level* objects (see [`config/environment`](/config/environment)).

---

## 2 – Example – Target public Moonbase Alpha

```jsonc
{
  "label": "moonwall_config",
  "environments": [
    {
      "name": "moonbase_alpha",
      "description": "Public Moonbase Alpha RPC",
      "foundation": {
        "type": "read_only",
        "rateLimiter": { "maxConcurrent": 4, "minTime": 60 }
      },
      "connections": [
        {
          "name": "pjs",
          "type": "polkadotJs",
          "endpoints": ["wss://wss.api.moonbase.moonbeam.network"]
        },
        {
          "name": "ethers",
          "type": "ethers",
          "endpoints": ["wss://wss.api.moonbase.moonbeam.network"]
        }
      ]
    }
  ]
}
```

Moonwall will *never* attempt to kill or restart this network – it only opens the WS connection, injects the providers into the test context and off you go.

---

## 3 – Runtime checks & selective test execution

By default Moonwall figures out **which runtime** is running under the hood so you can do things like:

```ts
// Inside a describeSuite
it({
  id: "MB-001",
  title: "should only run on Moonbase Alpha >= v2302",
  test: async ({ context, expect }) => {
    const { runtimeName, runtimeVersion } = context.runtime();

    expect(runtimeName).toBe("moonbase");
    expect(runtimeVersion).toBeGreaterThanOrEqual(2302);
  },
  onlyOnRuntime: {
    name: "moonbase",
    minVersion: 2302
  }
});
```

If the metadata query is *expensive* on your node you can opt-out by setting `disableRuntimeVersionCheck: true` – the helper above will then return `{ runtimeName: "unknown", runtimeVersion: -1 }` and the runtime filtering logic is skipped.

---

## 4 – Tips

* **Use a rate-limiter** – public RPCs often ban IPs that send >20 requests/s.  The default limiter (`{ minTime: 50 }`) is usually enough.
* **Prefer WebSocket endpoints** – HTTP endpoints work but you lose subscription-based helpers like `context.waitForEvent()`.
* Disable automatic Ethereum providers (`disableDefaultEthProviders: true` on the *environment* level) if the node does not expose an EVM pallet.

---

Enjoy writing tests directly against production chains! ✨
