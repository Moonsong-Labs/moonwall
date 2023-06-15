---
"@moonwall/types": patch
"@moonwall/util": patch
"@moonwall/cli": patch
---

Added default signer
- [#63](https://github.com/Moonsong-Labs/moonwall/issues/63)
- Signer option added to both when creating new blocks `context.createBlock(TXN, {signer: {type:<type>, privateKey: <key>}})
- Default Signer config option available in moonwall.config for environments