# Project Structure

## Monorepo Layout
This is a pnpm workspace monorepo with the following structure:

```
moonwall/
├── packages/           # Core packages
│   ├── cli/           # Main CLI package (@moonwall/cli)
│   ├── types/         # Type definitions (@moonwall/types)
│   └── util/          # Utility functions (@moonwall/util)
├── test/              # Test workspace with configurations
├── docs/              # Documentation site (VitePress)
├── .kiro/             # Kiro IDE configuration
├── .changeset/        # Changeset configuration for releases
└── .github/           # GitHub workflows and templates
```

## Package Architecture

### @moonwall/cli
- **Purpose**: Main CLI application and testing framework
- **Exports**: Main entry point, CLI commands, test utilities
- **Binaries**: `moonwall`, `moondebug`
- **Key Features**: Network management, test execution, artifact downloading

### @moonwall/types
- **Purpose**: TypeScript type definitions and interfaces
- **Exports**: Configuration types, API types, test types
- **Schema**: Generates JSON schema for configuration validation

### @moonwall/util
- **Purpose**: Shared utility functions and helpers
- **Exports**: Common functions, constants, helper utilities
- **Dependencies**: Lightweight package with minimal external deps

## Configuration Files

### Root Level
- `package.json`: Workspace configuration and scripts
- `pnpm-workspace.yaml`: Workspace package definitions
- `tsconfig.json`: Root TypeScript configuration
- `biome.json`: Code formatting and linting rules

### Package Level
- Each package has its own `package.json`, `tsconfig.json`
- Build outputs go to `dist/` directories
- Type definitions generated to `dist/types/`

## Development Workflow

### File Organization
- Source code in `src/` directories
- Built artifacts in `dist/` directories
- Type definitions co-located with source
- Tests alongside source files or in dedicated test directories

### Import Patterns
- Use workspace dependencies with `workspace:*` protocol
- Prefer named exports over default exports
- Use absolute imports for cross-package dependencies
- Keep internal imports relative within packages

### Build Process
1. Clean previous builds
2. Compile TypeScript with tsup
3. Generate type definitions with tsc
4. Validate with type checking

## Key Directories to Know

### `/test`
- Contains test configurations and suites
- Has its own package.json and dependencies
- Used for integration testing of the framework

### `/docs`
- VitePress documentation site
- Separate workspace with its own build process
- Contains guides, API docs, and examples

### `/.kiro`
- Kiro IDE configuration and steering rules
- Specs for feature development
- Settings and customizations