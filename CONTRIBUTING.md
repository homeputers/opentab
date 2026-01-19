# Contributing

Thanks for contributing to OpenTab! This repository focuses on the OpenTab
specification and reference tooling.

## Tooling workflow

From the repository root:

```bash
pnpm -C tools i
pnpm -C tools -r build
pnpm -C tools -r test
```

These commands install tooling dependencies, build all packages, and run the
workspace test suite.
