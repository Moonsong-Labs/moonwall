# Common Helpers

## Artifact Downloader

Moonwall has an integrated artifact downloader that allows you to quickly grab client artifacts that you need, without having to leave the CLI. 

### Using the Artifact Downloader

1. Choose option **4. Artifact Downloader** from the Moonwall main menu.
2. Select from the desired network
3. Select the desired version
4. Enter the directory where you'd like the artifact placed 
5. Review your selections and press enter to start the download

When the download is completed, Moonwall will attempt to launch the binary, but your operating system may prevent this by default. You can mark the file as executable and run the binary for the respective network as you usually do, or Moonwall can run it for you when running your tests.

![screenshot of artifact downloader](/artifact-downloader.png)

### Supported Networks

Artifact Downloader currently supports downloading artifacts for the following networks:

- Moonbeam
- Polkadot
- Tanssi

Would you like to see other networks added here? You can add [your network configuration to `repoDefinitions`](https://github.com/Moonsong-Labs/moonwall/tree/main/packages/cli/src/lib/repoDefinitions){target=_blank}. `YOUR-NETWORK.ts` needs to specify the network's Github repo name, repo owner, and supported binaries. Here's an example of of the repo definition file for Tanssi: 

```typescript
import { RepoSpec } from "@moonwall/types";

const repo: RepoSpec = {
  name: "tanssi",
  binaries: [
    { name: "tanssi-node", defaultArgs: ["--dev", "--sealing=manual", "--no-hardware-benchmarks"] },
    { name: "container-chain-template-simple-node" },
    { name: "container-chain-template-frontier-node" },
  ],
  ghAuthor: "moondance-labs",
  ghRepo: "tanssi",
};
export default repo;
```
