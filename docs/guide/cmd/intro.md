# Command Line Interface

Moonwall provides a powerful command-line interface (CLI) that offers a wide range of functionalities for blockchain testing and network management. This guide provides an overview of the Moonwall CLI and its core commands.

## Overview

The Moonwall CLI allows you to:

- Initialize and configure testing environments
- Launch and manage blockchain networks
- Run automated test suites
- Download artifacts from GitHub repositories
- Execute scripts and utilities
- Manage test IDs and organization

## Installation

You can install Moonwall globally using your preferred package manager:

```bash
# Using pnpm (recommended)
pnpm -g i @moonwall/cli

# Using npm
npm -g i @moonwall/cli

# Using yarn
yarn global add @moonwall/cli
```

For local development, you can install Moonwall in your project:

```bash
# Using pnpm
pnpm i @moonwall/cli

# Using npm
npm i @moonwall/cli

# Using yarn
yarn add @moonwall/cli
```

## Command Structure

The basic command structure for Moonwall is:

```bash
moonwall [command] [arguments] [options]
```

If you've installed Moonwall locally instead of globally, you'll need to prefix the command with your package manager's run command:

```bash
# Using pnpm
pnpm moonwall [command] [arguments] [options]

# Using npm
npm run moonwall [command] [arguments] [options]

# Using yarn
yarn moonwall [command] [arguments] [options]
```

## Core Commands

Moonwall provides several core commands:

### `moonwall init`

Initializes a new Moonwall configuration for your project.

```bash
moonwall init [options]
```

Options:
- `--acceptAllDefaults`, `-A`: Accept all defaults during initialization

### `moonwall run`

Launches a blockchain network defined in your configuration.

```bash
moonwall run <envName> [GrepTest] [options]
```

Arguments:
- `envName`: The name of the environment to run
- `GrepTest`: (Optional) Pattern to grep test ID/description to run

Options:
- `--subDirectory`, `-d`: Additional sub-directory filter for test suites

### `moonwall test`

Runs tests against a specified environment.

```bash
moonwall test <envName> [GrepTest] [options]
```

Arguments:
- `envName`: The name of the environment to test
- `GrepTest`: (Optional) Pattern to grep test ID/description to run

Options:
- `--subDirectory`, `-d`: Additional sub-directory filter for test suites
- `--testShard`, `-ts`: Test shard information for CI
- `--update`, `-u`: Update all snapshots
- `--vitestArgPassthrough`, `--vitest`: Arguments to pass directly to Vitest

### `moonwall download`

Downloads artifacts from GitHub repositories.

```bash
moonwall download <bin> [ver] [path] [options]
```

Arguments:
- `bin`: Name of artifact to download (e.g., moonbeam, polkadot, *-runtime)
- `ver`: Artifact version to download (default: "latest")
- `path`: Path where to save artifacts (default: "./")

Options:
- `--overwrite`, `-d`: If file exists, should it be overwritten?
- `--output-name`, `-o`: Rename downloaded file to this name

### `moonwall derive`

Derives test IDs based on position in the directory tree.

```bash
moonwall derive <suitesRootDir> [options]
```

Arguments:
- `suitesRootDir`: Root directory of the test suites

Options:
- `--prefixPhrase`, `-p`: Root phrase to generate prefixes from (e.g., DEV)
- `--singlePrefix`, `-l`: Use a single prefix for all suites

## Interactive Mode

Running Moonwall without any commands launches the interactive CLI menu, which provides a user-friendly interface for accessing all Moonwall functionality.

```bash
moonwall
```

The interactive menu adapts based on whether a Moonwall configuration is present:

### Without Configuration

If no configuration is found, you'll see these options:
1. **Initialise**: Generate a new Moonwall Config File
2. **Artifact Downloader**: Fetch artifacts from GitHub repos
3. **Quit Application**

### With Configuration

If a configuration is found, you'll see these options:
1. **Execute Script**: Run scripts from your script directory
2. **Network Launcher & Toolbox**: Launch networks and access tools
3. **Test Suite Execution**: Run automated tests
4. **Artifact Downloader**: Fetch artifacts from GitHub repos
5. **Rename TestIDs**: Rename test ID prefixes based on directory structure
6. **Quit Application**

## Configuration File

Moonwall uses a configuration file (`moonwall.config.json` by default) to define environments, tests, and networks. The path to this file can be customized using the `--configFile` or `-c` flag:

```bash
moonwall --configFile custom-config.json test basic
```

## Global Options

These options apply to all Moonwall commands:

- `--configFile`, `-c`: Path to MoonwallConfig file (default: "moonwall.config.json")
- `--help`, `-h`: Show help information
- `--version`: Show version information

## Environment Variables

Moonwall recognizes several environment variables that can influence its behavior:

- `MOON_TEST_ENV`: The current test environment name
- `MOON_SUBDIR`: Subdirectory filter for tests
- `MOON_RUN_SCRIPTS`: Whether to run scripts defined in the configuration
- `MOON_GREP`: Pattern to grep test IDs or descriptions
- `MOON_LOG_LOCATION`: Location of log files
- `MOON_RTNAME`: Runtime name (set automatically for read-only environments)
- `MOON_RTVERSION`: Runtime version (set automatically for read-only environments)

## Examples

Here are some common usage examples:

### Initialize a New Project

```bash
# Interactive initialization
moonwall init

# Non-interactive initialization with defaults
moonwall init --acceptAllDefaults
```

### Run a Network

```bash
# Run the 'basic' environment network
moonwall run basic

# Run with subdirectory filter
moonwall run dev_test --subDirectory folder1
```

### Run Tests

```bash
# Run all tests in the 'basic' environment
moonwall test basic

# Run specific tests by pattern
moonwall test chopsticks "T01|Transfer"

# Run tests with Vitest arguments
moonwall test dev_test --vitest "bail=true reporters=verbose"
```

### Download Artifacts

```bash
# Download latest Moonbeam binary
moonwall download moonbeam latest ./tmp

# Download specific runtime version
moonwall download moonbeam-runtime v0.33.0 ./tmp/runtimes
```

### Derive Test IDs

```bash
# Derive test IDs for all suites in the 'suites' directory
moonwall derive suites

# Use custom prefix
moonwall derive suites --prefixPhrase TEST
```

## Common Workflows

### Setting Up a New Project

1. Initialize Moonwall: `moonwall init`
2. Download required binaries: `moonwall download moonbeam latest ./tmp`
3. Configure environments in `moonwall.config.json`
4. Write test suites in the specified test directories
5. Run tests: `moonwall test basic`

### Running a Local Network

1. Ensure your configuration has a Dev, Chopsticks, or Zombie foundation
2. Launch the network: `moonwall run dev_env`
3. Use the interactive menu to view logs, run commands, and execute tests
4. Connect to the network using the provided URLs

### Continuous Integration

1. Set up a CI workflow that installs Moonwall
2. Download required binaries: `moonwall download moonbeam latest ./tmp`
3. Run tests with appropriate reporters: `moonwall test basic --vitest "reporters=junit,json"`
4. Process test results as needed

## Resources

- [Moonwall GitHub Repository](https://github.com/moonsong-labs/moonwall)
- [Moonwall NPM Package](https://www.npmjs.com/package/@moonwall/cli)
- [Vitest Documentation](https://vitest.dev/) (for test runner options)