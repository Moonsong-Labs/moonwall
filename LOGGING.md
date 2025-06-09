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
- `global:context` - Global context operations
- `global:providers` - Provider-related operations
- `global:localNode` - Local node management
- `test:blocks` - Block-related test operations
- `test:<env-name>` - Test environment specific logging
- `DevTest` - Development test operations
- `actions:runner` - Action runner operations
- `smoke:block-finalized` - Smoke test operations
- `fast-executor` - Fast execution script operations

## Command Line Arguments

For test files, the `--printlogs` command line argument will enable test loggers when present.

## Migration from Debug

The project has migrated from the `debug` package to `pino`. The main differences are:
- Environment variable changed from `DEBUG=*` to `LOG_LEVEL`
- Logger output is always pretty-printed with colors and formatting
- Log levels are now properly supported (debug only had on/off)