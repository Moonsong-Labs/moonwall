# Moonwall CLI

## Initial Setup

You can interact with the Moonwall CLI by running `moonwall` if you've installed it globally. Otherwise, you can run `bunx moonwall`. 

If you're running moonwall for the first time in a directory setting up a project, you'll see 3 options, namely: 

1. **Initialise**
2. **Artifact Downloader**
3. **Quit Application** 

The instructions in the [`init` guide](/guide/cmd/init) will help you get started with the initial setup of your `Moonwall.config`. For more details about configuring your `Moonwall.config` see the [Quick Start Guide](/guide/test/quick-start). You can also utilize the [artifact downloader](/guide/util/common) to download binaries and more.

![Config File Setup](/cli-setup.png)

## Running Tests

If Moonwall detects a valid `Moonwall.config` file in your directory at launch, it will offer you the following 5 options: 

1. **Execute Script**: Run scripts placed in your config defined script directory
2. **Network Launcher & Toolbox**: Launch network, access tools: tail logs, interactive tests
3. **Test Suite Execution**: Run automated tests, start network if needed
4. **Artifact Downloader**: Fetch artifacts (x86) from GitHub repos
5. **Quit Application**: Gracefully exit Moonwall

![Moonwall normal interface](/cli-normal.png)