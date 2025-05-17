# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Moonwall is a comprehensive blockchain test framework for Substrate-based networks. It fills the gap between web test frameworks and blockchain-specific testing needs by providing tools for environment configuration, network launching, test execution, and artifact downloading.

The framework supports different "Foundations" (testing environments):
- **Dev**: For local node development 
- **Chopsticks**: For forking existing chain state
- **Read Only**: For interacting with live networks
- **Zombie**: For multi-node network testing

## Project Structure

- **CLI**: Command-line interface for running tests and networks
- **Util**: Utility functions for blockchain testing
- **Types**: TypeScript type definitions
- **Foundations**: Different network configurations for various testing scenarios
- **Test suites**: Various test examples for different blockchain interactions

## Common Commands

### Installation & Setup
```bash
# Install dependencies
pnpm i

# Build the application
pnpm build

# Generate types
pnpm generate-types

# Clean everything and rebuild
pnpm pristine-build
```

### Development Commands
```bash
# Format code
pnpm fmt
pnpm fmt:fix  # Automatically fix formatting issues

# Lint code
pnpm lint
pnpm lint:fix  # Automatically fix linting issues

# Type checking
pnpm typecheck
```

### Running Moonwall
```bash
# Launch the main menu
pnpm start
# or
pnpm moonwall

# Run a specified network
pnpm moonwall run <ENV_NAME>

# Start network and run tests against it
pnpm moonwall test <ENV_NAME>

# Download artifacts from GitHub
pnpm moonwall download <ARTIFACT> <VERSION> <PATH>

# Run documentation site in dev mode
pnpm docs:dev
```

### Testing
```bash
# Run tests (default environments)
pnpm test

# Run tests on specific environments
pnpm moonwall test 'basic chopsticks'

# Run tests with specific patterns
pnpm moonwall test <ENV_NAME> --include "**/specific_test*"

# Display test reports after HTML reporter is used
pnpm display-reports
```

## Test Structure

Tests in Moonwall use a custom `describeSuite` function that extends Vitest's functionality with blockchain-specific features:

```typescript
describeSuite({
  id: "B02",                          // Unique identifier
  title: "Test suite description",    // Suite description
  foundationMethods: "read_only",     // Foundation type to use
  testCases: ({ it, log }) => {
    beforeAll(() => {
      // Setup before tests
    });

    it({
      id: "T01",                      // Unique test ID
      title: "Test case description", // Test description
      test: () => {
                                      // Test code
        expect(true).to.be.true;
      },
    });

    // More test cases...
  },
});
```

## Configuration

Moonwall uses a config file (usually `moonwall.config.json`) that defines:

1. Test environments
2. Network configurations
3. Connection details
4. Test directories

Each environment has:
- A foundation type (dev, read_only, chopsticks, zombie)
- Test file directories
- Network launch specifications
- Connection details for various clients

## Key Testing Patterns

1. **Network Testing**: Launch blockchain nodes and test their functionality
2. **State Transition**: Test that chain state changes as expected after transactions
3. **RPC Endpoint Testing**: Verify that RPC endpoints return expected results
4. **Cross-Chain Testing**: Test interactions between different chains

## Working with Foundations

Different foundation types are used for different testing scenarios:

- **Dev**: Use for testing local development nodes
- **Read Only**: Use for testing against live networks
- **Chopsticks**: Use for testing with forked chain state
- **Zombie**: Use for testing multi-node networks

## Utility Functions

The `@moonwall/util` package provides useful blockchain testing utilities:
- Logger setup
- Account management
- Transaction helpers
- Polkadot.js API utilities
- Ethereum provider utilities (Web3, Ethers, Viem)