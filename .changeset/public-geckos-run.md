---
"@moonwall/types": minor
"@moonwall/util": minor
"@moonwall/cli": minor
"@moonwall/tests": minor
---

## Migrate from debug to pino logger

- Replace `debug` package with `pino` for improved logging capabilities
- Add proper log levels support (fatal, error, warn, info, debug, trace, silent)
- Environment variable changed from `DEBUG=*` to `LOG_LEVEL=<level>`
- Pretty printing with colors and formatting is always enabled
- Full multithread support - logs maintain consistent formatting in worker threads and forked processes
- Logger uses `pino-pretty` stream with `sync: true` for proper output in all execution contexts
- Test files support `--printlogs` flag to enable test-specific loggers
- Standardized logger names across the codebase for better log filtering and organization
