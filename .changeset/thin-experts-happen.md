---
"@moonsong-labs/moonwall-cli": patch
---

## Added Grep & QoL

- New option to `grep` test cases
    - Filter by name/id either via the run menu, TestGrep command
    - Filter by name/id as option when calling `pnpm moonwall test <env_name>` directly with new option `-g`

- Increased GUI's height

- Application will inform user if newer version available

- Ability to skip test suites or cases based on which RT version/ chain name