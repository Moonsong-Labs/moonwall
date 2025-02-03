# Init

The `init` command guides you through a step-by-step process to create a configuration file for Moonwall. This command will set up a new `moonwall.config.json` file in your current directory—provided one does not already exist.

When you run:

`pnpm moonwall init`

::: tip
You can provide the option `--acceptAllDefaults` to YOLO the defaults and save a config file immediately.
:::

you will be prompted to enter a few key configuration values. Press `Enter` at each prompt to accept the default value or type your own. The prompts include:

- **Label:** The name for your config file.  
  _Default: `moonwall_config`_

- **Global Timeout:** The default timeout for tests (in milliseconds).  
  _Default: `30000`_

- **Environment Name:** The name of the Moonwall environment you want to create first (you can always make as many new environments as you like).
  _Default: `default_env`_

- **Test Directory:** The path where tests for this environment are stored.  
  _Default: `tests/default/`_

::: info
By default, the `foundation` is set to `dev` but you can change it to `chopsticks`, `zombie`, or `read_only` as required.
:::

After enter and confirming these values, the following will happen:

- Creates the directories `scripts`, `tests`, and `tmp` (if they don’t already exist).
- Generates a new `moonwall.config.json` file with your specified settings.
- Writes a sample test file into your test directory to help you get started.

## Generated Configuration Example

Below is an example of the generated `moonwall.config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/packages/types/config_schema.json",
  "label": "moonwall_config",
  "defaultTestTimeout": 30000,
  "environments": [
    {
      "name": "default_env",
      "testFileDir": ["tests/default/"],
      "multiThreads": false,
      "foundation": {
        "type": "dev",
        "launchSpec": [
          {
            "name": "moonbeam",
            "useDocker": true,
            "newRpcBehaviour": true,
            "binPath": "moonbeamfoundation/moonbeam"
          }
        ]
      }
    }
  ]
}
```

After initialization, a sample test file is created in the specified test directory so you can immediately begin writing tests for your local dev environment.

The tests should run successfully with default settings, as it will use a moonbeam docker image to spin up a local dev environment. You can modify this environment to whichever substrate node binary location or docker as you like.

::: info
If a `moonwall.config.json` file already exists, the init command will abort to prevent overwriting your configuration. Remove or rename the existing file if you wish to run the init process again.
:::

For more details about configuration options and further customization, please see the [Quick Start Guide](/guide/test/quick-start).

![Moonwall init terminal screenshot](/init.png)
