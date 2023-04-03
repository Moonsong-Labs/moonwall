---
"@moonwall/util": patch
"@moonwall/cli": patch
---

Bin checking

This change will check the bin directories and compare to running architecture. It's a bit of a gotcha running `moonwall` on Apple Silicon, because the downloader is for x64 only (for now). Have added checks to both `dev` and `zombie` foundations so that we flag up when there's a discrepancy.