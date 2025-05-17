# The `test` Command

The `test` command in Moonwall is the primary way to run automated test suites against blockchain networks. It handles launching the network (if required), running the tests, and reporting the results.

## Overview

The `test` command:

- Launches the specified network environment
- Runs the test suites defined in your configuration
- Reports test results in various formats
- Supports filtering tests by name, ID, or directory
- Provides CI/CD-friendly options

## Command Syntax

```bash
moonwall test <envName> [GrepTest] [options]
```

### Parameters

- **envName**: (Required) The name of the environment to test from your Moonwall config
- **GrepTest**: (Optional) A pattern to test against test IDs or descriptions if you want to run specific tests

### Options

- **--subDirectory, -d**: Additional subdirectory filter for test suites
- **--testShard, -ts**: Test shard information for CI
- **--update, -u**: Update all snapshots
- **--vitestArgPassthrough, --vitest**: Arguments to pass directly to Vitest (space-delimited)

## Usage

### Basic Usage

To run all tests for a specific environment:

```bash
moonwall test basic
```

This will start the network specified in the "basic" environment and run all tests defined in the `testFileDir` paths of that environment.

### Run Specific Tests

To run only tests that match a specific pattern:

```bash
moonwall test chopsticks "T01|StateTest"
```

This will run only tests with IDs or titles containing "T01" or "StateTest" in the "chopsticks" environment.

### Run Tests in a Subdirectory

To limit test execution to a specific subdirectory:

```bash
moonwall test dev_test --subDirectory folder1
```

This will only run tests found in the "folder1" subdirectory of the test directories defined in the "dev_test" environment.

### Update Snapshots

If your tests use Vitest's snapshot feature, you can update the snapshots:

```bash
moonwall test update_env -u
```

### Pass Arguments to Vitest

To pass specific arguments directly to the Vitest test runner:

```bash
moonwall test basic --vitest "bail=true mode=development"
```

## Test Configuration

Tests in Moonwall are configured in the `moonwall.config.json` file under each environment. The key properties related to testing include:

### Basic Test Configuration

```json
{
  "name": "dev_test",
  "testFileDir": [
    "suites/dev_tests"
  ],
  "foundation": {
    "type": "dev",
    // ...foundation configuration
  }
}
```

### Advanced Test Configuration

```json
{
  "name": "advanced_test",
  "testFileDir": [
    "suites/advanced"
  ],
  "include": [
    "**/*{test,spec,test_,test-}*{ts,mts,cts}"
  ],
  "timeout": 300000,
  "reporters": [
    "default",
    "json",
    "html"
  ],
  "reportFile": {
    "json": "tmp/testResults.json"
  },
  "multiThreads": true,
  "vitestArgs": {
    "bail": 3,
    "retry": 4
  },
  "skipTests": [
    {
      "name": "T01",
      "reason": "https://github.com/org/repo/issues/123",
      "since": "2024-01-28T00:00:00Z"
    }
  ],
  "foundation": {
    // ...foundation configuration
  }
}
```

## Test Configuration Options

- **testFileDir**: Array of directories containing test files
- **include**: Optional array of glob patterns to match test files
- **timeout**: Optional test timeout in milliseconds (overrides global default)
- **reporters**: Optional array of reporter types for test results
- **reportFile**: Optional file path to write test reports to
- **multiThreads**: Optional flag or configuration for parallel test execution
- **vitestArgs**: Optional Vitest configuration arguments
- **skipTests**: Optional array of tests to skip with reasons

## Test Reporters

Moonwall supports various test reporters through Vitest:

- **default**: Standard console output
- **verbose**: Detailed console output
- **dot**: Minimal dot notation output
- **json**: JSON-formatted test results
- **html**: HTML report with UI for exploring test results
- **basic**: Simple console output

You can specify multiple reporters to get output in different formats simultaneously.

## Test Report Visualization

If you use the HTML reporter, you can view the HTML report using:

```bash
moonwall display-reports
```

This will serve the HTML report on a local web server and open it in your browser.

## Multi-Threading

To improve test performance, Moonwall supports running tests in parallel:

```json
"multiThreads": true
```

This will run tests in parallel using worker threads. You can also provide more specific configuration:

```json
"multiThreads": {
  "threads": {
    "minThreads": 1,
    "maxThreads": 4,
    "isolate": true
  }
}
```

Or use different pool types:

```json
"multiThreads": {
  "forks": {
    "minForks": 1,
    "maxForks": 4
  }
}
```

## Skipping Tests

You can skip specific tests by adding them to the `skipTests` array:

```json
"skipTests": [
  {
    "name": "T01",
    "reason": "https://github.com/org/repo/issues/123",
    "since": "2024-01-28T00:00:00Z"
  }
]
```

This will skip any test with the ID "T01". The `reason` and `since` fields are required for documentation purposes.

## Test Filtering Based on Runtime

For Read-Only environments, Moonwall can filter tests based on the runtime name and version of the connected chain. This allows you to specify that certain tests should only run on specific runtimes or runtime versions.

This behavior is controlled by the `disableRuntimeVersionCheck` parameter in the Read-Only foundation configuration:

```json
"foundation": {
  "type": "read_only",
  "launchSpec": {
    "disableRuntimeVersionCheck": false
  }
}
```

When this check is enabled (the default), the runtime name and version are exposed as environment variables `MOON_RTNAME` and `MOON_RTVERSION`, which you can use in your tests.

## CI Integration

The `test` command is designed to work well in CI/CD environments:

- Exit code indicates test success/failure
- JSON reports can be saved for later processing
- Test sharding is available for parallel CI jobs
- Snapshots can be updated automatically with the `-u` flag

## Example Workflow

A typical workflow with the `test` command might look like this:

1. Define your test environment in `moonwall.config.json`
2. Write test suites using Moonwall's test framework
3. Run all tests for an environment:
   ```bash
   moonwall test dev_env
   ```
4. Debug a specific test:
   ```bash
   moonwall test dev_env "T01"
   ```
5. Generate a comprehensive test report:
   ```bash
   moonwall test dev_env --vitest "reporters=verbose,json,html"
   ```
6. View the HTML report:
   ```bash
   moonwall display-reports
   ```

## Troubleshooting

If you encounter issues with the `test` command:

- Check that the environment name exists in your configuration
- Ensure the test directories contain valid test files
- Verify that the foundation is configured correctly
- Check that binary paths are correct
- For network-related issues, try running just the network with `moonwall run`
- Use verbose or JSON reporters for more detailed output