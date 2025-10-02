---
"@moonwall/cli": patch
"@moonwall/util": patch
---

Moonwall's run subcommand stopped working due to port mismatch introduced in #498.
This PR fixes the issue by accounting for shard offset within the run subcommand.

- Use singleton class instead of environment variable to manage sharding.
- Adds port information to error logs to allow checking for port mismatches.
