# Continuous Integration

Moonwall is designed to work seamlessly with CI/CD systems, allowing you to automate your blockchain testing pipelines. This guide explains how to set up and optimize Moonwall for continuous integration environments.

## Overview

Running Moonwall tests in CI enables you to:

- Automatically verify code changes against blockchain functionality
- Detect regressions early in the development cycle
- Ensure consistent testing across different environments
- Generate standardized test reports
- Parallelize test execution for faster feedback

## CI Setup Basics

A basic CI setup for Moonwall requires:

1. Installing dependencies
2. Building the project
3. Running Moonwall tests
4. Processing test results

Here's an example workflow structure:

```yaml
# Generic CI workflow structure
steps:
  - name: Checkout code
    # Checkout code from repository

  - name: Set up Node.js
    # Set up Node.js environment

  - name: Install dependencies
    run: pnpm install

  - name: Build project
    run: pnpm build

  - name: Run tests
    run: pnpm moonwall test <environment>

  - name: Process test results
    # Process test results and generate reports
```

## GitHub Actions Integration

Here's a complete GitHub Actions workflow example for Moonwall:

```yaml
name: Moonwall Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
          run_install: false

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Download binaries
        run: |
          pnpm moonwall download moonbeam latest ./tmp
          pnpm moonwall download polkadot latest ./tmp

      - name: Run Moonwall tests
        run: pnpm moonwall test basic_env --vitest "reporters=default,json,junit"
        
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            tmp/testResults.json
            reports/junit.xml
```

## GitLab CI Integration

Here's a GitLab CI configuration example:

```yaml
image: node:18

stages:
  - build
  - test

cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .pnpm-store/

before_script:
  - npm install -g pnpm
  - pnpm config set store-dir .pnpm-store
  - pnpm install

build:
  stage: build
  script:
    - pnpm build
  artifacts:
    paths:
      - dist/

test:
  stage: test
  script:
    - mkdir -p ./tmp
    - pnpm moonwall download moonbeam latest ./tmp
    - pnpm moonwall test basic_env --vitest "reporters=default,json,junit"
  artifacts:
    paths:
      - tmp/testResults.json
      - reports/junit.xml
    reports:
      junit: reports/junit.xml
```

## Jenkins Integration

For Jenkins, you can use a Jenkinsfile like this:

```groovy
pipeline {
    agent {
        docker {
            image 'node:18'
        }
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm install -g pnpm'
                sh 'pnpm install'
            }
        }
        
        stage('Build') {
            steps {
                sh 'pnpm build'
            }
        }
        
        stage('Download Binaries') {
            steps {
                sh 'mkdir -p ./tmp'
                sh 'pnpm moonwall download moonbeam latest ./tmp'
                sh 'pnpm moonwall download polkadot latest ./tmp'
            }
        }
        
        stage('Test') {
            steps {
                sh 'pnpm moonwall test basic_env --vitest "reporters=default,junit"'
            }
            post {
                always {
                    junit 'reports/junit.xml'
                }
            }
        }
    }
}
```

## CI Performance Optimization

Blockchain tests can be time-consuming. Here are strategies to optimize CI performance:

### 1. Parallelization

Split tests across multiple CI jobs:

```yaml
jobs:
  test-basic:
    runs-on: ubuntu-latest
    steps:
      # ... setup steps
      - run: pnpm moonwall test basic_env

  test-chopsticks:
    runs-on: ubuntu-latest
    steps:
      # ... setup steps
      - run: pnpm moonwall test chopsticks_env
      
  test-read-only:
    runs-on: ubuntu-latest
    steps:
      # ... setup steps
      - run: pnpm moonwall test readonly_env
```

### 2. Test Sharding

Use the `--testShard` option to split a single environment's tests:

```yaml
matrix:
  shard: [1/3, 2/3, 3/3]
  
steps:
  - run: pnpm moonwall test basic_env --testShard "${{ matrix.shard }}"
```

### The shard parameter format is `index/total` where:
- `index` is the current shard (1-based)
- `total` is the total number of shards

### 3. Caching

Cache dependencies, binaries, and other artifacts:

```yaml
- uses: actions/cache@v3
  with:
    path: |
      node_modules
      ./tmp/binaries
    key: ${{ runner.os }}-moonwall-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-moonwall-
```

## Binary Management

Managing blockchain binaries in CI requires special attention:

### 1. Download at Runtime

Use Moonwall's download command in CI:

```bash
pnpm moonwall download moonbeam latest ./tmp
pnpm moonwall download polkadot latest ./tmp
```

### 2. Cache Binaries

To avoid downloading binaries for each run, use caching:

```yaml
- uses: actions/cache@v3
  with:
    path: ./tmp
    key: ${{ runner.os }}-binaries-${{ hashFiles('pnpm-lock.yaml') }}
```

### 3. Use Pre-Built Images

For complex setups, consider Docker images with pre-installed binaries:

```yaml
services:
  moonbeam:
    image: moonbeamfoundation/moonbeam:latest
    ports:
      - 9944:9944
```

## Test Result Processing

### JUnit Reports

JUnit reports are widely supported by CI systems:

```yaml
- name: Run tests with JUnit reporter
  run: pnpm moonwall test basic_env --vitest "reporters=junit"
  
# GitHub Actions
- name: Publish Test Report
  uses: mikepenz/action-junit-report@v3
  with:
    report_paths: 'reports/junit.xml'
    
# GitLab CI
test:
  artifacts:
    reports:
      junit: reports/junit.xml
      
# Jenkins
post {
  always {
    junit 'reports/junit.xml'
  }
}
```

### JSON Reports

JSON reports can be used for custom processing:

```bash
# Extract test statistics
failures=$(jq '.numFailedTests' tmp/testResults.json)
total=$(jq '.numTotalTests' tmp/testResults.json)
```

## Environment Variables

Set environment variables for CI-specific configurations:

```yaml
env:
  CI: true
  MOONWALL_CI: true
  MOON_TEST_TIMEOUT: 300000  # Extended timeout for CI
```

You can use these variables in your tests:

```typescript
// Adjust timeout based on environment
const timeout = process.env.CI ? 300000 : 60000;

it({
  id: "T01",
  title: "Should process a large batch of transactions",
  test: async function () {
    // Test logic with longer timeout in CI
  },
  timeout: timeout
});
```

## Handling Flaky Tests

Blockchain tests can sometimes be flaky due to timing issues. Strategies to handle flaky tests in CI:

### 1. Test Retries

Use Vitest's retry feature:

```yaml
- run: pnpm moonwall test basic_env --vitest "retry=3"
```

### 2. Skip Known Flaky Tests

Use Moonwall's skipTests configuration:

```json
"skipTests": [
  {
    "name": "T01",
    "reason": "Flaky in CI - issue #123",
    "since": "2024-01-28T00:00:00Z"
  }
]
```

### 3. Identify and Fix Root Causes

Monitor flaky tests with custom reporting:

```bash
# Extract flaky tests from multiple runs
jq '.testResults[].assertionResults[] | select(.status == "failed") | .title' run1.json run2.json | sort | uniq -c
```

## CI Best Practices

1. **Run the full test suite on main branches**, but use targeted testing on PRs
2. **Monitor test execution time** to identify slow tests
3. **Use meaningful test IDs** that help identify failures quickly
4. **Generate artifacts** (logs, reports) for debugging failed runs
5. **Set appropriate timeouts** for blockchain operations
6. **Separate quick tests from long-running tests** into different jobs
7. **Fail fast** by prioritizing fast, critical tests

## Resources

1. [GitHub Actions Documentation](https://docs.github.com/en/actions)
2. [GitLab CI Documentation](https://docs.gitlab.com/ee/ci/)
3. [Jenkins Documentation](https://www.jenkins.io/doc/)
4. [Vitest GitHub Actions Integration](https://vitest.dev/guide/integrations.html#github-actions)

## Troubleshooting CI Issues

### Connection Timeouts

If tests fail with connection timeouts, adjust timeout parameters and ensure networks have time to start:

```yaml
run: |
  pnpm moonwall run basic_env &
  sleep 30  # Wait for network to start
  pnpm moonwall test basic_env
```

### Memory Issues

For memory-intensive tests, increase available memory:

```yaml
# GitHub Actions
runs-on: ubuntu-latest-16-core

# GitLab CI
test:
  variables:
    NODE_OPTIONS: "--max-old-space-size=8192"
```

### Missing Binaries

Verify binary paths and download commands:

```yaml
run: |
  pnpm moonwall download moonbeam latest ./tmp
  ls -la ./tmp  # Verify binary was downloaded
  chmod +x ./tmp/moonbeam  # Ensure executable permissions
```