import { Effect } from "effect";
import { NetworkError, ResourceError } from "@moonwall/types";
import { promiseToEffect, runPromiseEffect, testUtils } from "./interop.wip";
import { makeConnection, makeFileHandle } from "./resources.wip";

// Test that error types work correctly
const testNetworkError = Effect.fail(new NetworkError({
  message: "Connection failed",
  endpoint: "http://localhost:8545",
  operation: "connect",
}));

// Test that resource management works
const testConnection = makeConnection({
  endpoint: "http://localhost:8545",
});

// Test that interop utilities work
const testPromiseConversion = promiseToEffect(
  Promise.resolve("Hello Effect!"),
  (error) => new ResourceError({
    message: "Promise conversion failed",
    resource: "test-promise",
    operation: "use",
    cause: error,
  })
);

// Test that everything works together
const testFoundation = Effect.gen(function* (_) {
  // Test successful operation
  const result = yield* _(testPromiseConversion);
  console.log("Promise conversion result:", result);

  // Test error handling
  try {
    yield* _(testNetworkError);
  } catch (error) {
    console.log("Caught expected error:", error);
  }

  return "Foundation test completed successfully";
});

// Export test function for potential use
export const runFoundationTest = () => runPromiseEffect(testFoundation);

// Export individual test utilities
export const foundationTests = {
  testNetworkError,
  testConnection,
  testPromiseConversion,
  testFoundation,
  runTest: runFoundationTest,
};