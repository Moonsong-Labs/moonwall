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
8. Raise PR with description of changes

## Code Quality

Before submitting, ensure:

- All tests pass
- Code is formatted with 0xfmt
- No TypeScript errors
- No linting warnings

## Release Process

1. Run `pnpm changeset` and follow the wizard
2. Describe the changes in the generated `.changeset/<GENERATED_NAME>.md` file
3. Commit and push to GitHub
4. Raise PR and merge
5. Review the auto-generated release PR from the CI bot and merge if ready

The CI will automatically publish to npm when the release PR is merged.
