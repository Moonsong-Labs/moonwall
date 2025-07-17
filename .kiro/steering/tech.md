# Technology Stack

## Build System & Package Management
- **Package Manager**: pnpm (required, minimum version 7)
- **Build Tool**: tsup for bundling
- **TypeScript**: Version 5.8.3
- **Node.js**: Minimum version 20

## Core Technologies
- **Runtime**: Node.js with ES modules
- **Language**: TypeScript with strict configuration
- **Testing Framework**: Vitest
- **Code Quality**: Biome (linting and formatting)
- **Monorepo**: pnpm workspaces

## Blockchain Libraries
- **Polkadot**: @polkadot/api suite for Substrate interactions
- **Ethereum**: Ethers.js, Viem, Web3.js for EVM compatibility
- **Moonbeam**: @moonbeam-network/api-augment for chain-specific types
- **Testing Tools**: @acala-network/chopsticks, @zombienet/orchestrator

## Key Dependencies
- **Effect**: Functional programming library for error handling
- **React/Ink**: CLI interface components
- **Docker**: Container management via dockerode
- **Logging**: Pino for structured logging

## Common Commands

### Development
```bash
# Install dependencies
pnpm i

# Build all packages
pnpm build

# Generate TypeScript types
pnpm generate-types

# Clean build artifacts
pnpm clean-all

# Full clean rebuild
pnpm pristine-build
```

### Code Quality
```bash
# Format code
pnpm fmt:fix

# Lint and fix
pnpm lint:fix

# Type checking
pnpm typecheck

# Type checking with watch mode
pnpm typecheck:watch
```

### Testing
```bash
# Run tests
pnpm test

# Start moonwall CLI
pnpm start

# Display test reports
pnpm display-reports
```

### Release Management
```bash
# Create changeset
pnpm changeset

# Version packages
pnpm changeset:version

# Publish packages
pnpm changeset:release
```

## Code Style
- **Formatter**: Biome with 2-space indentation
- **Line Width**: 100 characters
- **Semicolons**: Always required
- **Trailing Commas**: ES5 style
- **Import Style**: ES modules only