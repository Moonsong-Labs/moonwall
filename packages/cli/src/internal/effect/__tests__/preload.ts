/**
 * Test preload file for common imports and setup.
 *
 * This file is loaded before all test files to:
 * 1. Pre-load commonly used modules (effect, bun:test) into module cache
 * 2. Set up any global test configuration
 * 3. Reduce per-test-file import overhead
 *
 * @see https://bun.sh/docs/cli/test#preload-scripts
 */

// Pre-load commonly used Effect modules
import "effect";

// Pre-load bun:test for faster test execution
import "bun:test";

// Pre-load Node.js built-ins commonly used in tests
import "node:path";
import "node:fs";
import "node:events";

// Global test timeout configuration (can be overridden per-test)
// This extends the default 5000ms to accommodate Effect-based async tests
if (!process.env.BUN_TEST_TIMEOUT) {
  process.env.BUN_TEST_TIMEOUT = "30000";
}
