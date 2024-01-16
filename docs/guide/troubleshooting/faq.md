# FAQ

### How do I upgrade Moonwall?

You can upgrade Moonwall with the following command:

```bash
pnpm update
```

If you're troubleshooting an error, it's always a good idea to check the [Release Changelog](https://github.com/Moonsong-Labs/moonwall/releases){target=_blank} for details of any breaking changes. As an example, when Moonwall upgraded from Ethers v5 to v6, this required changing from `BigNumber` to `BigInt` types. 