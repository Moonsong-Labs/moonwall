# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Moonwall?

Moonwall is a comprehensive blockchain testing framework specifically designed for Substrate-based networks. It provides a unified approach to network configuration, testing, and deployment, addressing the need for specialized testing tools for blockchain node software.

## Commands

### Build and Installation
```bash
# Install globally
pnpm -g i @moonwall/cli

# Local installation
pnpm i

# Build all packages
pnpm build
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests for a specific environment
moonwall test <ENV_NAME>

# Start a specific network without running tests
moonwall run <ENV_NAME>
```

### Code Quality
```bash
# Format code
pnpm fmt
pnpm fmt:fix

# Lint code
pnpm lint
pnpm lint:fix
```

### CLI Usage
```bash
# Launch main menu
moonwall

# Download blockchain artifacts
moonwall download <ARTIFACT> <VERSION> <PATH>
```

## Architecture

Moonwall is structured as a monorepo using pnpm workspaces to manage multiple packages.

### Foundations

Moonwall supports different testing environment types:

1. `dev`: Local development node
2. `chopsticks`: Acala Foundation's forked network environment
3. `read_only`: Connect to existing networks
4. `zombie`: Parity's multi-node network framework

### Context System

Each foundation type provides a dedicated context that offers environment-specific functionality. The core types are defined in `packages/types/src/runner.ts`.

### Configuration

Moonwall uses a JSON configuration file (`moonwall.config.json`) to define:

- Test environments
- Network settings
- Foundation-specific configurations
- Test directories and patterns
- Timeout settings

Example configurations can be found in `/test/configs/`.

## Testing Flow

1. Define network configuration in config file
2. Start the network using the appropriate foundation
3. Execute tests against the running network
4. Tear down the network when tests complete

The framework supports multiple blockchain client libraries including Polkadot.js, Ethers.js, Viem, and Web3.js.