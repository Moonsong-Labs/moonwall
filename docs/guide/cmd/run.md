# The `run` Command

The `run` command in Moonwall is used to launch and interact with blockchain networks specified in your configuration. It provides a comprehensive environment for running and managing networks without executing tests.

## Overview

The `run` command:

- Launches a blockchain network based on your configuration
- Provides an interactive menu for network management
- Allows you to view network logs, run commands, and execute individual tests
- Persists the network, making it available for manual interaction or development

## Command Syntax

```bash
moonwall run <envName> [GrepTest] [options]
```

### Parameters

- **envName**: (Required) The name of the environment to run from your Moonwall config
- **GrepTest**: (Optional) A pattern to test against test IDs or descriptions if you want to run specific tests

### Options

- **--subDirectory, -d**: Additional subdirectory filter for test suites

## Usage

### Basic Usage

To launch a network defined in your configuration:

```bash
moonwall run basic
```

This will start the network specified in the "basic" environment of your configuration.

### Run with Test Pattern

To launch a network and run specific tests matching a pattern:

```bash
moonwall run chopsticks "T01|T02"
```

This launches the "chopsticks" environment and runs tests with IDs or titles matching the pattern "T01|T02".

### Run with Subdirectory

To run only tests within a specific subdirectory:

```bash
moonwall run dev_test --subDirectory folder1
```

This runs the "dev_test" environment but only looks for tests within the "folder1" subdirectory.

## Interactive Interface

After launching a network, the `run` command provides an interactive interface with the following options:

### 1. Tail

Prints the logs of the currently running node to the console. This option provides:

- Real-time log streaming for all network components
- For Zombie networks, the ability to switch between log streams for different nodes
- Keyboard shortcuts for navigation and control

### 2. Info

Displays detailed information about the current environment, including:

- Node launch arguments
- Launch specification from the config file
- WebSocket ports and URLs for connecting to the network
- Polkadot.js Apps URLs for direct browser interaction

### 3. Command

Runs specific commands on the network. Available commands depend on the foundation type:

#### For Dev Foundation:

- Create Block: Creates a new block with options to include extrinsics
- Send Extrinsic: Sends a specific extrinsic
- Upgrade Runtime: Performs a runtime upgrade

#### For Chopsticks Foundation:

- Create Block: Creates a new block
- Set Storage: Directly modifies chain storage
- Jump Rounds: For chains with ParachainStaking, jumps forward rounds
- Upgrade Runtime: Performs a runtime upgrade

#### For Zombie Foundation:

- Restart Node: Restarts a specific node
- Pause Node: Pauses a specific node
- Resume Node: Resumes a paused node
- Kill Node: Stops a specific node
- Check Node Status: Checks if a node is running
- Upgrade Runtime: Performs a runtime upgrade

### 4. Test

Executes all tests registered for the environment. This allows you to run all the tests while the network is already running, which is faster than launching the network again with the `test` command.

### 5. GrepTest

Executes individual tests by pattern matching against test IDs or descriptions. This option:

- Prompts you to enter a pattern to filter tests
- Runs only tests that match the pattern
- Is useful for debugging specific test cases

### 6. Quit

Closes the network and exits the application.

## Available Networks

The networks that you can run depend on what's defined in your `moonwall.config.json` file. Only environments with foundation types of `dev`, `chopsticks`, or `zombie` can be run interactively.

Read-only foundations cannot be run with the `run` command as they only connect to existing networks rather than launching new ones.

## Polkadot.js Apps Integration

For each launched network, Moonwall provides a direct URL to the Polkadot.js Apps interface. This allows you to:

- Interact with the network through a web interface
- Submit transactions manually
- Explore the chain state
- Monitor events and blocks

The URLs are displayed in the Info menu and typically look like:

```
https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A9944
```

## Viewing Logs

The "Tail" option in the interactive menu provides a real-time view of node logs. This is particularly useful for:

- Debugging network issues
- Monitoring block production
- Watching for errors or warnings
- Understanding network behavior

For Zombie networks with multiple nodes, you can switch between node logs using keyboard shortcuts.

## Example Workflow

A typical workflow with the `run` command might look like this:

1. Start a network:
   ```bash
   moonwall run chopsticks
   ```

2. View logs to ensure the network is running correctly
   - Select "Tail" from the menu

3. Check network info to get connection details
   - Select "Info" from the menu

4. Run commands on the network
   - Select "Command" from the menu
   - Choose appropriate commands for your foundation type

5. Run tests to verify network behavior
   - Select "Test" or "GrepTest" from the menu

6. When finished, quit the application
   - Select "Quit" from the menu

## Troubleshooting

If you encounter issues with the `run` command:

- Check that the environment name exists in your configuration
- Ensure the foundation type is one of `dev`, `chopsticks`, or `zombie`
- Verify that the binary paths in your configuration are correct
- Check the network logs for specific error messages
- For Zombie networks, ensure the Zombienet configuration file is valid