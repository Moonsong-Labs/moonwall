# Build System Notes

## Binary Linking Issue (2025-07-21)

### Problem
After switching to the new `zshy` build system, the CI started failing when running `bun moonwall` commands from the test directory. The error was that the moonwall binary couldn't be found.

### Root Cause
The new build system generates the CLI binary files in `packages/cli/dist/cmds/entrypoint.cjs`, but the bun workspace bin links in the test directory's `node_modules/.bin/moonwall` wrapper script need to be regenerated after the build to properly point to the new output location.

### Solution
1. **Immediate Fix**: Run `bun install` in the test directory after building to regenerate the bin wrapper scripts.

2. **CI Fix**: Added "Update test directory links" steps to all test jobs in `.github/workflows/main.yml` that run `cd test && bun install` after the build step.

3. **Permanent Fix**: Added a `postbuild` script to the root `package.json` that automatically runs `cd test && bun install` after the build completes.

### Technical Details
- The `zshy` build system is configured in `packages/cli/package.json` under the `zshy` section
- It defines the bin entry point as `./src/cmds/entrypoint.ts` which gets compiled to `./dist/cmds/entrypoint.cjs`
- The package.json `bin` field points to the compiled CJS output
- bun creates wrapper scripts in `node_modules/.bin/` that need to be regenerated when bin paths change

### Future Considerations
If you encounter similar issues after build system changes:
1. Check if bin wrapper scripts need regeneration
2. Run `bun install` in affected directories to regenerate links
3. Consider adding postbuild hooks to automate this process