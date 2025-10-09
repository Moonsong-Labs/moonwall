---
"@moonwall/util": patch
"@moonwall/cli": patch
---

Fixes a bug, where urls like `wss://wss.api.moondev.network` were being converted to `https://https.api.moondev.network`, which was incorrect.