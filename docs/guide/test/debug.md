# Debugging Tests

## Logging Configuration

Moonwall uses `pino` for logging throughout the project, providing rich structured logging with multiple log levels and beautiful formatting.

### Environment Variables

#### `LOG_LEVEL`

- **Default**: `"info"`
- **Values**: `"fatal"`, `"error"`, `"warn"`, `"info"`, `"debug"`, `"trace"`, `"silent"`
- **Description**: Sets the minimum log level for all loggers.

Example:
```bash
LOG_LEVEL=debug pnpm moonwall test dev_seq
```

### Pretty Printing

- Pretty printing with colors and formatting is **always enabled**
- Logs include timestamp, log level, logger name, and message
- Full multithread support ensures consistent formatting across worker threads and forked processes

### Logger Names

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

### Command Line Arguments

For test files, the `--printlogs` command line argument will enable test loggers when present:

```bash
pnpm moonwall test dev_seq --printlogs
```

## Tailing the Logs

For debugging purposes you may find it helpful to tail the logs while running your tests. To do this, take the following steps: 

1. Choose **2. Network Launcher & Toolbox**
2. Choose your environment.
3. Press any key, then choose **Tail**

![Tail Logs](/tail.png)

While tailing the logs, you can manage your tests with the following key commands: 

- [**q**] Quit 
- [**t**] Run all tests 
- [**g**] Grep test (to run a specific test)
- [**p**] Pause tail 

### Analyzing the Logs

The default location of your log files is `/tmp/node_logs`. The full location can be found at the top of the console output when tailing the logs in the prior step. 

::: tip
The logs automatically get overwritten with each time the network is spooled up, so be sure to make copies of any log files that you wish to keep.
:::
