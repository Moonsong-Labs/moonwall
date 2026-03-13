import { defineConfig } from "tsdown";

const cliShebangs = new Map<string, string>([
  ["cli.js", "#!/usr/bin/env -S node --no-warnings --no-deprecation"],
  ["moondebug.js", "#!/usr/bin/env -S node --inspect"],
]);

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts", "src/moondebug.ts"],
  format: "esm",
  platform: "node",
  target: "node24",
  tsconfig: "tsconfig.build.json",
  outDir: "dist",
  clean: true,
  treeshake: true,
  hash: false,
  sourcemap: true,
  dts: {
    sourcemap: true,
  },
  fixedExtension: false,
  banner: ({ fileName }) => {
    const shebang = cliShebangs.get(fileName);

    return shebang ? { js: `${shebang}\n` } : undefined;
  },
});
