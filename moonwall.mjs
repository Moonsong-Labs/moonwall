#!/usr/bin/env -S TS_NODE_FILES=true TS_NODE_TRANSPILE_ONLY=true TS_NODE_COMPILER_OPTIONS="{\"target\":\"esnext\", \"module\":\"esnext\"}"  node --experimental-specifier-resolution=node --experimental-loader ts-node/esm --experimental-modules

import './src/cli/entrypoint.ts'
