# Logging Configuration

Moonwall uses `pino` for logging throughout the project.

## Environment Variables

### `LOG_LEVEL`

- **Default**: `"info"`
- **Values**: `"fatal"`, `"error"`, `"warn"`, `"info"`, `"debug"`, `"trace"`, `"silent"`
- **Description**: Sets the minimum log level for all loggers.

## Pretty Printing

- Pretty printing with colors and formatting is **always enabled**
- Logs include timestamp, log level, logger name, and message

## Logger Names

The following logger names are used throughout the codebase:

- `context` - Global context operations (MoonwallContext)
- `providers` - Provider-related operations and connections
- `localNode` - Local node management and Docker operations
- `runner` - Test runner and Vitest configuration
- `test:blocks` - Block-related utility functions
- `test:<env-name>` - Test environment specific logging (dynamically created)
- `DevTest` - Development mode test operations
- `actions:runner` - Process runner and task execution
- `test:<name>` - Test-specific loggers created via `setupLogger(name)`
- `smoke:block-finalized` - Smoke test for block finalization
- `fast-executor` - Fast execution script for chopsticks proposals

## Command Line Arguments

For test files, the `--printlogs` command line argument will enable test loggers when present.

## Migration from Debug

The project has migrated from the `debug` package to `pino`. The main differences are:

- Environment variable changed from `DEBUG=*` to `LOG_LEVEL`
- Logger output is always pretty-printed with colors and formatting
- Log levels are now properly supported (debug only had on/off)