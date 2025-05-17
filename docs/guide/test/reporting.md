# Test Reporting

Moonwall provides comprehensive test reporting capabilities through its integration with the Vitest testing framework. This page explains how to configure and use various reporting options to effectively monitor and analyze your test results.

## Overview

Test reporting in Moonwall allows you to:

- View test results in different formats
- Save test reports to files for later analysis
- Generate visual reports for easier interpretation
- Integrate test results with CI/CD systems

## Configuring Reporters

You can configure one or more reporters in your environment configuration within `moonwall.config.json`:

```json
{
  "name": "dev_test",
  "reporters": [
    "default",
    "json",
    "html"
  ],
  "reportFile": {
    "json": "tmp/testResults.json"
  },
  // ...other configuration
}
```

### Available Reporters

Moonwall supports the following reporters through Vitest:

- **default**: Standard console output with colors, errors, and timing
- **verbose**: Detailed console output including full error stacks and test details
- **dot**: Minimal dot notation output (useful for CI environments)
- **json**: JSON-formatted test results (useful for programmatic analysis)
- **html**: HTML report with UI for exploring test results
- **basic**: Simple console output without details
- **junit**: JUnit XML format (useful for CI integration)
- **tap**: Test Anything Protocol (TAP) output

## File-Based Reports

For reporters that produce file output (like json, html, and junit), you can specify output file paths using the `reportFile` option:

```json
"reportFile": {
  "json": "tmp/testResults.json",
  "html": "html/report.html",
  "junit": "reports/junit.xml"
}
```

If you provide a single string instead of an object, it will be used for all file-based reporters:

```json
"reportFile": "reports/test-results"
```

## HTML Report Visualization

The HTML reporter generates an interactive web-based report that allows you to explore test results visually. After running tests with the HTML reporter enabled, you can view the report using:

```bash
moonwall display-reports
```

This command starts a local web server and opens the HTML report in your browser. The report provides:

- An overview of all test suites and results
- Detailed test case information
- Error messages and stack traces
- Test execution times
- Filtering and search capabilities

## JSON Reports

JSON reports are particularly useful for programmatic analysis or integration with other tools. The JSON report includes:

- Complete test suite structure
- Test case results and statuses
- Execution times
- Error messages and stack traces
- Environment information

Example JSON report structure:

```json
{
  "numTotalTestSuites": 5,
  "numPassedTestSuites": 4,
  "numFailedTestSuites": 1,
  "numPendingTestSuites": 0,
  "numTotalTests": 25,
  "numPassedTests": 23,
  "numFailedTests": 2,
  "numPendingTests": 0,
  "numTodoTests": 0,
  "startTime": 1621500000000,
  "success": false,
  "testResults": [
    {
      "name": "/path/to/test/file.ts",
      "status": "failed",
      "startTime": 1621500001000,
      "endTime": 1621500002000,
      "assertionResults": [
        {
          "title": "should pass this test",
          "status": "passed",
          "duration": 50
        },
        {
          "title": "should fail this test",
          "status": "failed",
          "duration": 30,
          "failureMessages": ["Error: Expected 1 to equal 2"]
        }
      ]
    }
  ]
}
```

## CI Integration

For CI/CD environments, Moonwall provides several options:

### JUnit Reports

JUnit XML reports are widely supported by CI systems like Jenkins, GitLab CI, and GitHub Actions:

```json
{
  "reporters": ["junit"],
  "reportFile": {
    "junit": "reports/junit.xml"
  }
}
```

### GitHub Actions Integration

For GitHub Actions, you can use the JSON reporter and parse the results:

```yaml
# GitHub Action example
- name: Run tests
  run: pnpm moonwall test dev_test
  
- name: Process test results
  if: always()
  run: |
    if [ -f tmp/testResults.json ]; then
      # Process test results
      failed_tests=$(jq '.numFailedTests' tmp/testResults.json)
      if [ "$failed_tests" -gt 0 ]; then
        echo "::error::$failed_tests tests failed"
        exit 1
      fi
    fi
```

### GitLab CI Integration

For GitLab CI with JUnit reports:

```yaml
# GitLab CI example
test:
  script:
    - pnpm moonwall test dev_test
  artifacts:
    reports:
      junit: reports/junit.xml
```

## Custom Reporter Configuration

You can pass additional configuration to reporters using the `vitestArgs` option:

```json
"vitestArgs": {
  "reporters": {
    "junit": {
      "outputFile": "reports/junit.xml",
      "classNameTemplate": "{classname}",
      "titleTemplate": "{title}"
    }
  }
}
```

## Combined Reporting Strategies

For comprehensive test reporting, consider using multiple reporters together:

```json
{
  "reporters": [
    "default",   // For immediate feedback in console
    "json",      // For programmatic analysis
    "html",      // For visual exploration
    "junit"      // For CI integration
  ],
  "reportFile": {
    "json": "tmp/testResults.json",
    "html": "html/report",
    "junit": "reports/junit.xml"
  }
}
```

This approach provides immediate feedback during development while also generating artifacts for further analysis and integration.

## Error Reporting

When tests fail, Moonwall provides detailed error information including:

- Error message
- Expected and actual values
- Stack traces with source location
- Test context

These details are captured in all reporter outputs and can help quickly identify and fix issues.

## Performance Metrics

All reporters include performance metrics such as:

- Total test execution time
- Individual test case durations
- Test suite timing information

This data can help identify slow tests that might need optimization.

## Viewing Reports

Once generated, reports can be accessed in various ways:

- **Console Reports**: Displayed directly in your terminal
- **HTML Reports**: Viewed with `moonwall display-reports`
- **JSON Reports**: Analyzed with tools like jq or imported into dashboards
- **JUnit Reports**: Imported into CI systems or test management tools

## Real-Time Reporting

While tests are running, Moonwall provides real-time feedback through the console reporter, showing:

- Test progress
- Passing and failing tests as they complete
- Current test execution status

This allows you to monitor long-running test suites effectively.

## Troubleshooting

If you encounter issues with reporting:

- Ensure report directories exist and are writable
- Check that the specified reporters are valid
- Verify that file paths are correct
- For CI environments, make sure reports are saved as artifacts
- If HTML reports won't display, check for JavaScript errors in your browser