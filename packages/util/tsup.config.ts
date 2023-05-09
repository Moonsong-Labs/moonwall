import alias from 'esbuild-plugin-alias';
import type { Options } from 'tsup';

const config: Options = {
  esbuildPlugins: [
    alias({
      '@polkadot/rpc-core': '@polkadot/rpc-core',
      '@polkadot/types': '@polkadot/types',
      '@polkadot/types-create': '@polkadot/types-create',
    }),
  ],
};

export default config;