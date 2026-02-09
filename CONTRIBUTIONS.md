# Contribution Guide

## Development Setup

```bash
# Install dependencies
pnpm i

# Build the package
pnpm build

# Run type checking
pnpm typecheck
```

## Submitting a PR

1. Create a feature branch from `main`
2. Make your changes
3. Run tests: `pnpm test`
4. Run formatting: `pnpm fmt:fix`
5. Run linting: `pnpm lint:fix`
6. Run type checking: `pnpm typecheck`
7. Commit changes and push to GitHub
8. Raise PR targeting `main` with description of changes

## Code Quality

Before submitting, ensure:

- All tests pass
- Code is formatted with 0xfmt
- No TypeScript errors
- No linting warnings

## Release Process

1. Run `pnpm changeset` locally and follow the wizard, or use the **"Add Changeset"** GitHub Action (Actions tab → "Add Changeset" → Run workflow) to create one remotely
2. Describe the changes in the generated `.changeset/<name>.md` file
3. Commit and push to your feature branch
4. Raise PR targeting `main` and merge
5. The CI will automatically create a release PR from the changeset
6. Review and merge the release PR — this triggers the npm publish
