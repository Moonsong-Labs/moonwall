# Moonwall Troubleshooting Guide

This guide provides solutions for common issues encountered when using Moonwall in development and testing environments.

## Table of Contents

- [Development Environment Issues](#development-environment-issues)
  - [Using Moonwall in Other Repositories](#using-moonwall-in-other-repositories)
  - [Alternative to `pnpm link`](#alternative-to-pnpm-link)
  - [Debugging Moonwall Packages](#debugging-moonwall-packages)
- [Runtime Errors](#runtime-errors)
  - [Network Connection Issues](#network-connection-issues)
  - [Test Execution Failures](#test-execution-failures)
  - [Node Binary Compatibility](#node-binary-compatibility)
- [Configuration Issues](#configuration-issues)
  - [moonwall.config.json Validation Errors](#moonwallconfigjson-validation-errors)
  - [Environment Setup Problems](#environment-setup-problems)
- [Common Error Messages](#common-error-messages)
  - [NONCE_EXPIRED and Other Transaction Errors](#nonce_expired-and-other-transaction-errors)
  - [Docker-related Issues](#docker-related-issues)
  - [Polkadot.js API Errors](#polkadotjs-api-errors)

## Development Environment Issues

### Using Moonwall in Other Repositories

When integrating Moonwall into your project, you might encounter issues with development workflows, especially when trying to make changes to Moonwall itself while using it in your project.

#### Issue: `pnpm link` Compatibility

The standard approach of using `pnpm link` for local package development doesn't work well with Moonwall due to its monorepo structure and package interdependencies.

**Solution: Local Package Referencing**

Instead of using `pnpm link`, reference the local Moonwall package directory directly in your project's `package.json`:

```json
{
  "dependencies": {
    "@moonwall/cli": "file:/path/to/moonwall/packages/cli",
    "@moonwall/util": "file:/path/to/moonwall/packages/util",
    "@moonwall/types": "file:/path/to/moonwall/packages/types"
  }
}
```

Then run `pnpm install` to create the symlinks.

### Alternative to `pnpm link`

For a more robust development workflow:

1. **Fork and Clone the Moonwall Repository**

   ```bash
   git clone https://github.com/your-username/moonwall.git
   cd moonwall
   ```

2. **Install Dependencies and Build**

   ```bash
   pnpm i
   pnpm build
   ```

3. **Add Your Repository as a Test Project**

   Create a directory for your test project inside the Moonwall repository, then set up your project there.

4. **Use Moonwall Package Version Overrides**

   If you need to use your project's existing repository with local Moonwall development, use pnpm's overrides feature in your project's `package.json`:

   ```json
   {
     "pnpm": {
       "overrides": {
         "@moonwall/cli": "file:/path/to/moonwall/packages/cli",
         "@moonwall/util": "file:/path/to/moonwall/packages/util"
       }
     }
   }
   ```

### Debugging Moonwall Packages

When debugging issues between your project and Moonwall:

1. **Enable Debug Logs**

   ```bash
   DEBUG=moonwall* pnpm moonwall test <ENV_NAME>
   ```

2. **Use Source Maps for Better Stack Traces**

   Add a `.npmrc` file to your project with:

   ```
   node-option=--enable-source-maps
   ```

3. **Create Minimal Reproduction Case**

   When reporting issues, create a minimal reproduction in a separate project using the Moonwall test directory structure.

## Runtime Errors

### Network Connection Issues

If you encounter network connection issues:

1. **Check Node Binary Availability**

   Ensure the binary paths in your `moonwall.config.json` are correct:

   ```bash
   # Verify binary existence and permissions
   ls -la /path/to/your/binary
   
   # Check if it's executable
   chmod +x /path/to/your/binary
   ```

2. **Verify Port Availability**

   ```bash
   # Check if the port is already in use
   lsof -i :<port_number>
   
   # Kill the process if needed
   kill -9 <PID>
   ```

3. **Docker Issues**

   For Zombienet foundation:
   
   ```bash
   # Check Docker container status
   docker ps -a
   
   # Remove stuck containers
   docker rm -f <container_id>
   ```

### Test Execution Failures

When tests fail to execute:

1. **Run Tests with Verbose Output**

   ```bash
   pnpm moonwall test <ENV_NAME> --verbose
   ```

2. **Check Vitest Configuration**

   Ensure your test files match the patterns specified in your `moonwall.config.json`.

3. **Verify Test Suite Dependencies**

   Check that all dependencies required by your tests are correctly installed.

### Node Binary Compatibility

For architecture-specific issues (e.g., ARM64 vs x86_64):

1. **Build from Source**

   On Apple Silicon or other non-x86_64 platforms:

   ```bash
   # Clone the repository for your chain
   git clone https://github.com/your-chain/node-repo.git
   
   # Build the binary following chain-specific instructions
   cd node-repo
   cargo build --release
   
   # Copy the binary to your Moonwall project
   cp target/release/your-node /path/to/moonwall/project/binaries/
   ```

2. **Use Compatible Docker Images**

   If available, use multi-architecture Docker images in your Zombienet configuration.

## Configuration Issues

### moonwall.config.json Validation Errors

If your configuration file has validation errors:

1. **Check JSON Schema**

   Moonwall validates configuration against a schema. Check the error message for specifics.

2. **Common Configuration Mistakes**

   - Missing required fields for specific foundation types
   - Incorrect file paths
   - Invalid connection parameters

3. **Reference Valid Examples**

   Check the [example configurations](https://github.com/Moonsong-Labs/moonwall/tree/main/test/configs) in the Moonwall repository.

### Environment Setup Problems

Issues with specific environment configurations:

1. **Chopsticks Foundation**

   - Ensure you have a valid endpoint for forking
   - Verify the block number for state snapshots exists
   - Check that the account keys have sufficient balance

2. **Zombienet Foundation**

   - Verify Docker is running with sufficient permissions
   - Check network configurations for correct relay/parachain setup
   - Ensure WASM validation works in your environment

3. **Dev Foundation**

   - Verify binary paths and options
   - Check for port conflicts
   - Ensure sufficient system resources

## Common Error Messages

### NONCE_EXPIRED and Other Transaction Errors

Transaction nonce issues include:

- `NONCE_EXPIRED`
- `Nonce too low`
- `Nonce has already been used`

**Solutions:**

1. **Manual Nonce Management**

   When testing with multiple transactions:

   ```typescript
   // Get the current nonce
   const nonce = await ethers.provider.getTransactionCount(wallet.address);
   
   // Use it for your transactions with explicit incrementation
   const tx1 = await wallet.sendTransaction({ 
     to: recipient,
     value: amount1,
     nonce: nonce 
   });
   
   const tx2 = await wallet.sendTransaction({ 
     to: recipient,
     value: amount2,
     nonce: nonce + 1 
   });
   ```

2. **Reset Dev Chain State**

   For persistent nonce issues, restart your dev chain to reset the state.

### Docker-related Issues

For Zombienet foundation using Docker:

1. **Permission Denied**

   ```bash
   # Add your user to the docker group
   sudo usermod -aG docker $USER
   
   # Then log out and back in, or run
   newgrp docker
   ```

2. **Resource Limitations**

   Increase Docker resource limits in Docker Desktop settings.

3. **Network Conflicts**

   Remove existing Docker networks that might conflict:

   ```bash
   docker network prune
   ```

### Polkadot.js API Errors

Common Polkadot.js connection issues:

1. **API Connection Failures**

   - Check WebSocket endpoint availability
   - Verify API types match your chain's runtime

2. **Missing Types**

   Register custom types if your chain has specific types:

   ```typescript
   const api = await ApiPromise.create({
     provider: wsProvider,
     types: {
       YourCustomType: 'u32',
       AnotherType: {
         field1: 'u32',
         field2: 'Vec<u8>'
       }
     }
   });
   ```

3. **Event Subscription Issues**

   Handle unsubscription properly:

   ```typescript
   const unsub = await api.query.system.events((events) => {
     // Handle events
   });
   
   // Later, unsubscribe
   await unsub();
   ```

---

If you encounter issues not covered by this guide, please [open an issue](https://github.com/Moonsong-Labs/moonwall/issues/new) with details about your problem, including relevant configuration files and error messages.