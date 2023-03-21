---
"@moonsong-labs/moonwall-cli": patch
"@moonsong-labs/moonwall-util": patch
---

## Extended CreateBlock

CreateBlock for `Chopsticks` and `Dev` have been updated so taken new options
- `allowFailures` (Default: false): Will turn off checking for ExtrinsicFailure events
- `expectEvents` :  Takes an array of events, and will verify if the block contains all of those events listed or not.