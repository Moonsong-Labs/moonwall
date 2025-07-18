# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Supplement this with contents of @CLAUDE.local.md if present

## What is Moonwall?

Moonwall is a comprehensive blockchain testing framework specifically designed for Substrate-based networks. It provides a unified approach to network configuration, testing, deployment, and script execution. Built as a monorepo using pnpm workspaces, it facilitates testing against various network environments and supports multiple blockchain client libraries.

## Commands

### Installation

```bash
# Install all dependencies for the monorepo (run from project root)
pnpm i

# To install the CLI globally (optional, for using `moonwall` directly outside pnpm scripts)
pnpm -g i @moonwall/cli
```

### Build and Development

```bash
# Build all packages within the monorepo
pnpm build

# Generate TypeScript types for all packages
pnpm generate-types

# Clean all build artifacts and node_modules, then reinstall and rebuild everything
pnpm pristine-build

# Start the Moonwall CLI (interactive mode)
pnpm start # or pnpm moonwall
```

### Testing

Moonwall uses Vitest as its test runner.

```bash
# Run a predefined set of tests (e.g., 'basic', 'chopsticks', 'dev_seq', 'chop_state_test')
pnpm test

# Run tests for a specific environment defined in moonwall.config.json
pnpm exec moonwall test <ENV_NAME>

# Run tests for a specific environment with a pattern
pnpm exec moonwall test <ENV_NAME> --pattern "<PATTERN>"

# View HTML test reports in browser (after tests have run and generated reports)
pnpm display-reports
```
The `moonwall/test` directory contains example test suites and configurations. It also includes dependencies like `solc` and `@openzeppelin/contracts`, indicating support for compiling and testing Solidity smart contracts.

### Code Quality

Moonwall uses Biome for formatting and linting.

```bash
# Format code across the monorepo
pnpm fmt
pnpm fmt:fix

# Lint code across all packages
pnpm lint
pnpm lint:fix

# Perform type checking for all packages
pnpm typecheck
```

### Working with the Moonwall CLI

The CLI is the primary interface for interacting with Moonwall.

```bash
# Launch Moonwall CLI (interactive main menu)
pnpm moonwall

# Run a specific network environment (as defined in moonwall.config.json) without running tests
pnpm moonwall run <ENV_NAME>

# Run tests against a specific network environment
pnpm moonwall test <ENV_NAME> # Similar to `pnpm exec moonwall test <ENV_NAME>`

# Download blockchain artifacts (e.g., node binaries) from GitHub releases
pnpm moonwall download <ARTIFACT_NAME> <VERSION> <PATH>
```
The CLI uses `yargs` for argument parsing and `@inquirer/prompts` for interactive menus.

## Architecture Overview

Moonwall is structured as a TypeScript monorepo managed with pnpm workspaces.

### Key Technologies

*   **PNPM Workspaces**: Manages the monorepo structure and dependencies.
*   **TypeScript**: The primary programming language, providing strong typing.
*   **Tsup**: Used for bundling TypeScript code in the individual packages (`cli`, `types`, `util`).
*   **Biome**: For code formatting and linting, ensuring consistent code style.
*   **Vitest**: The testing framework used for running unit and integration tests.
    *   **`@vitest/ui`**: Provides a browser-based UI for viewing test results.
*   **Chai**: Assertion library used with Vitest.

### Project Structure

The monorepo is organized into several key directories:

*   `moonwall/packages/`: Contains the core logic of Moonwall, split into:
    *   `cli`: Implements the command-line interface (`moonwall`). It handles command parsing, orchestrates test execution, and network management. Uses `yargs`, `@inquirer/prompts`, `@octokit/rest` (for artifact downloads), and `dockerode` (likely for Zombienet).
    *   `types`: Defines shared TypeScript types and interfaces used across the project, including the structure for `moonwall.config.json`. It uses `typescript-json-schema` to generate a JSON schema for the configuration file.
    *   `util`: Provides common utility functions and helpers shared by other packages.
*   `moonwall/test/`: Contains example test configurations (`moonwall.config.json`, `configs/`), test suites (`suites/`), Solidity contracts (`contracts/`), and scripts (`scripts/`). This package demonstrates how to use Moonwall and also serves as an internal testing ground.
*   `moonwall.config.json` (typically in a test project or user's project, example in `moonwall/test/moonwall.config.json`): The central configuration file for defining test environments, network settings, and global parameters.

### Key Concepts

1.  **Foundations**: These are the underlying systems used to create blockchain network environments for testing. Moonwall supports:
    *   `dev`: A local development Substrate node.
    *   `chopsticks`: Utilises `@acala-network/chopsticks` for creating forked Substrate network environments, allowing testing against a snapshot of a live network.
    *   `read_only`: Allows Moonwall to connect to an existing, already running network for non-intrusive testing.
    *   `zombie`: Integrates with `@zombienet/orchestrator` (Parity's Zombienet) for setting up and testing multi-node Substrate networks, often using Docker.

2.  **Environments**: Defined in `moonwall.config.json`, each environment specifies:
    *   The `foundation` to use (e.g., `chopsticks`, `dev`).
    *   Network-specific settings (e.g., node image, chain spec).
    *   Test directories and patterns to include.
    *   Blockchain client `connections` to establish.
    *   Scripts to run before or after tests.

3.  **Connections (Blockchain Clients)**: Moonwall supports multiple client libraries for interacting with the blockchain nodes:
    *   `polkadotJs`: The Polkadot-JS API suite (`@polkadot/api`, `@polkadot/keyring`, etc.) for comprehensive Substrate interaction.
    *   `ethers`: Ethers.js library for interacting with Ethereum-compatible features of Substrate chains (e.g., EVM).
    *   `web3`: Web3.js library, another popular choice for Ethereum interaction.
    *   `viem`: A modern TypeScript interface for Ethereum.
    *   `papi`: The Polkadot API client (`polkadot-api`), a newer, lighter-weight alternative for Substrate interaction.

4.  **Context System**: Each foundation type provides a dedicated "context" object to the tests. This context offers environment-specific functionalities and access to the configured client connections. Core types related to the runner and context are defined in `moonwall/packages/types/src/runner.ts`.

5.  **Configuration (`moonwall.config.json`)**:
    *   This JSON file is central to Moonwall's operation.
    *   Defines global settings (e.g., default timeouts, script directories).
    *   Specifies repositories for artifact downloads (via `@octokit/rest`).
    *   Details each test `environment`, including its `foundation`, `connections`, test files, and specific settings.
    *   A JSON schema for this configuration is generated using `typescript-json-schema` from types in `moonwall/packages/types/src/config.ts`, ensuring configuration validity. Example configurations can be found in `moonwall/test/configs/`.

### Testing Flow

A typical Moonwall testing flow involves:

1.  **Configuration**: Define network setups and test suites in `moonwall.config.json`.
2.  **Network Initialization**: Moonwall starts the specified network(s) using the chosen `foundation` (e.g., launching a local dev node, spinning up a Chopsticks fork, or orchestrating a Zombienet deployment).
3.  **Test Execution**: Vitest runs the test files, which use the provided context to interact with the network(s) via configured client libraries (Polkadot.js, Ethers.js, etc.).
4.  **Network Teardown**: After tests complete (or on error), Moonwall tears down the networks it started.
5.  **Reporting**: Test results are available in the console and can be viewed in a web UI using `pnpm display-reports`.

The framework is designed to be flexible, allowing users to test various aspects of Substrate-based chains, including runtime logic, smart contracts (Solidity), and off-chain components.