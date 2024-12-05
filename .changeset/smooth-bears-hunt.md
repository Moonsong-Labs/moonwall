---
"@moonwall/cli": patch
---

### Enhanced Test CLI Options

#### New Features

- Added support for passing Vitest configuration options directly through CLI

  ```bash
  moonwall test dev_test --vitest "bail=2 retry=2"
  ```

This can also be added to your `moonwall.config.json` file like:

```json
 {
      "name": "passthrough_test",
      "testFileDir": ["suites/multi_fail"],
      "description": "Testing that bail can be passed through",
      "foundation": {
        "type": "read_only"
      },
      "vitestArgs": {
        "bail": 1
      },
      "connections": []
    }
```
