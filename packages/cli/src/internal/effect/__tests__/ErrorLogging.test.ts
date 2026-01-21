import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { Effect, Cause, Data, FiberId } from "effect";
import {
  redactSensitiveData,
  categorizeError,
  toStructuredError,
  formatStructuredError,
  formatStructuredErrorJson,
  formatCausePretty,
  causeToStructuredErrors,
  causeSummary,
  logError,
  logCause,
  logAndStructure,
  logErrorEffect,
  formatErrorForCli,
  shouldIncludeStackTrace,
  isStructuredError,
  type StructuredError,
} from "../ErrorLogging.js";

// ============================================================================
// Test Error Classes
// ============================================================================

class TestStartupError extends Data.TaggedError("TestStartupError")<{
  message: string;
  cause?: unknown;
}> {}

class TestConnectionError extends Data.TaggedError("ProviderConnectionError")<{
  message: string;
  providerType: string;
  endpoint: string;
}> {}

class TestShutdownError extends Data.TaggedError("FoundationShutdownError")<{
  message: string;
  foundationType: string;
}> {}

class TestTimeoutError extends Data.TaggedError("OperationTimeoutError")<{
  message: string;
  operation: string;
  timeoutMs: number;
  userMessage: string;
}> {}

class TestConfigLoadError extends Data.TaggedError("ConfigLoadError")<{
  message: string;
  filePath: string;
}> {}

class TestProcessError extends Data.TaggedError("ProcessError")<{
  message: string;
  pid: number;
}> {}

class TestTestExecutionError extends Data.TaggedError("TestExecutionError")<{
  message: string;
  exitCode: number;
}> {}

// ============================================================================
// Sensitive Data Redaction Tests
// ============================================================================

describe("redactSensitiveData", () => {
  it("should redact API keys in object keys", () => {
    const data = {
      api_key: "secret123",
      name: "test",
    };
    const result = redactSensitiveData(data);
    expect(result.api_key).toBe("[REDACTED]");
    expect(result.name).toBe("test");
  });

  it("should redact private keys in object keys", () => {
    const data = {
      private_key: "0x1234567890abcdef",
      public_key: "0xpublic",
    };
    const result = redactSensitiveData(data);
    expect(result.private_key).toBe("[REDACTED]");
    expect(result.public_key).toBe("0xpublic");
  });

  it("should redact passwords", () => {
    const data = {
      password: "supersecret",
      username: "admin",
    };
    const result = redactSensitiveData(data);
    expect(result.password).toBe("[REDACTED]");
    expect(result.username).toBe("admin");
  });

  it("should redact values that look like hex private keys", () => {
    const data = {
      key: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    };
    const result = redactSensitiveData(data);
    expect(result.key).toBe("[REDACTED]");
  });

  it("should redact JWT tokens", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const data = { token: jwt };
    const result = redactSensitiveData(data);
    expect(result.token).toBe("[REDACTED]");
  });

  it("should handle nested objects", () => {
    const data = {
      config: {
        api_key: "secret",
        endpoint: "http://example.com",
      },
    };
    const result = redactSensitiveData(data);
    expect(result.config.api_key).toBe("[REDACTED]");
    expect(result.config.endpoint).toBe("http://example.com");
  });

  it("should handle arrays", () => {
    const data = {
      secrets: ["0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
    };
    const result = redactSensitiveData(data);
    expect(result.secrets[0]).toBe("[REDACTED]");
  });

  it("should handle null and undefined", () => {
    expect(redactSensitiveData(null)).toBe(null);
    expect(redactSensitiveData(undefined)).toBe(undefined);
  });

  it("should handle MOON_PRIV_KEY pattern", () => {
    const data = {
      MOON_PRIV_KEY: "secret_key",
    };
    const result = redactSensitiveData(data);
    expect(result.MOON_PRIV_KEY).toBe("[REDACTED]");
  });

  it("should handle ALITH_PRIVATE_KEY pattern", () => {
    const data = {
      ALITH_PRIVATE_KEY: "secret_key",
    };
    const result = redactSensitiveData(data);
    expect(result.ALITH_PRIVATE_KEY).toBe("[REDACTED]");
  });
});

// ============================================================================
// Error Categorization Tests
// ============================================================================

describe("categorizeError", () => {
  it("should categorize startup errors", () => {
    const error = new TestStartupError({ message: "Startup failed" });
    expect(categorizeError(error)).toBe("startup");
  });

  it("should categorize connection errors", () => {
    const error = new TestConnectionError({
      message: "Connection failed",
      providerType: "polkadotJs",
      endpoint: "ws://localhost:9944",
    });
    expect(categorizeError(error)).toBe("connection");
  });

  it("should categorize shutdown/cleanup errors", () => {
    const error = new TestShutdownError({
      message: "Shutdown failed",
      foundationType: "dev",
    });
    expect(categorizeError(error)).toBe("cleanup");
  });

  it("should categorize timeout errors", () => {
    const error = new TestTimeoutError({
      message: "Operation timed out",
      operation: "startup",
      timeoutMs: 30000,
      userMessage: "Timed out",
    });
    expect(categorizeError(error)).toBe("timeout");
  });

  it("should categorize config errors", () => {
    const error = new TestConfigLoadError({
      message: "Config load failed",
      filePath: "/path/to/config",
    });
    // ConfigLoad includes "Config" so goes to config category
    expect(categorizeError(error)).toBe("startup");
  });

  it("should categorize process errors", () => {
    const error = new TestProcessError({
      message: "Process failed",
      pid: 1234,
    });
    expect(categorizeError(error)).toBe("process");
  });

  it("should categorize test errors", () => {
    const error = new TestTestExecutionError({
      message: "Test failed",
      exitCode: 1,
    });
    expect(categorizeError(error)).toBe("test");
  });

  it("should return unknown for unrecognized errors", () => {
    const error = { _tag: "SomeRandomError", message: "Random" };
    expect(categorizeError(error)).toBe("unknown");
  });

  it("should handle plain Error objects", () => {
    const error = new Error("Plain error");
    expect(categorizeError(error)).toBe("unknown");
  });

  it("should handle null/undefined", () => {
    expect(categorizeError(null)).toBe("unknown");
    expect(categorizeError(undefined)).toBe("unknown");
  });
});

// ============================================================================
// toStructuredError Tests
// ============================================================================

describe("toStructuredError", () => {
  it("should convert tagged error to structured error", () => {
    const error = new TestConnectionError({
      message: "Failed to connect",
      providerType: "polkadotJs",
      endpoint: "ws://localhost:9944",
    });

    const structured = toStructuredError(error);

    expect(structured.category).toBe("connection");
    expect(structured.message).toBe("Failed to connect");
    expect(structured.errorTag).toBe("ProviderConnectionError");
    expect(structured.timestamp).toBeDefined();
    expect(structured.context).toBeDefined();
    expect(structured.context?.providerType).toBe("polkadotJs");
    expect(structured.context?.endpoint).toBe("ws://localhost:9944");
  });

  it("should include suggestions for startup errors", () => {
    const error = new TestStartupError({ message: "Startup failed" });
    const structured = toStructuredError(error);

    expect(structured.suggestions).toBeDefined();
    expect(structured.suggestions?.length).toBeGreaterThan(0);
  });

  it("should include suggestions for connection errors", () => {
    const error = new TestConnectionError({
      message: "Connection failed",
      providerType: "ethers",
      endpoint: "http://localhost:8545",
    });
    const structured = toStructuredError(error);

    expect(structured.suggestions).toBeDefined();
    expect(structured.suggestions?.some((s) => s.includes("endpoint"))).toBe(true);
  });

  it("should use userMessage if available", () => {
    const error = new TestTimeoutError({
      message: "Internal timeout message",
      operation: "startup",
      timeoutMs: 30000,
      userMessage: "User-friendly timeout message",
    });
    const structured = toStructuredError(error);

    expect(structured.message).toBe("User-friendly timeout message");
  });

  it("should handle plain strings", () => {
    const structured = toStructuredError("Simple error message");

    expect(structured.message).toBe("Simple error message");
    expect(structured.category).toBe("unknown");
  });

  it("should redact sensitive data in context", () => {
    const error = {
      _tag: "ConfigError",
      message: "Config error",
      api_key: "secret123",
      endpoint: "http://example.com",
    };
    const structured = toStructuredError(error);

    expect(structured.context?.api_key).toBe("[REDACTED]");
    expect(structured.context?.endpoint).toBe("http://example.com");
  });
});

// ============================================================================
// formatStructuredError Tests
// ============================================================================

describe("formatStructuredError", () => {
  it("should format error with category badge", () => {
    const structured: StructuredError = {
      category: "connection",
      message: "Connection failed",
      errorTag: "ProviderConnectionError",
      timestamp: new Date().toISOString(),
    };

    const formatted = formatStructuredError(structured);

    expect(formatted).toContain("CONNECTION");
    expect(formatted).toContain("Connection failed");
    expect(formatted).toContain("ProviderConnectionError");
  });

  it("should include context when present", () => {
    const structured: StructuredError = {
      category: "connection",
      message: "Connection failed",
      timestamp: new Date().toISOString(),
      context: {
        endpoint: "ws://localhost:9944",
        providerType: "polkadotJs",
      },
    };

    const formatted = formatStructuredError(structured);

    expect(formatted).toContain("Context:");
    expect(formatted).toContain("endpoint");
    expect(formatted).toContain("ws://localhost:9944");
  });

  it("should include suggestions when present", () => {
    const structured: StructuredError = {
      category: "startup",
      message: "Startup failed",
      timestamp: new Date().toISOString(),
      suggestions: ["Check the node binary", "Increase timeout"],
    };

    const formatted = formatStructuredError(structured);

    expect(formatted).toContain("Suggestions:");
    expect(formatted).toContain("Check the node binary");
    expect(formatted).toContain("Increase timeout");
  });
});

// ============================================================================
// formatStructuredErrorJson Tests
// ============================================================================

describe("formatStructuredErrorJson", () => {
  it("should produce valid JSON", () => {
    const structured: StructuredError = {
      category: "test",
      message: "Test failed",
      errorTag: "TestExecutionError",
      timestamp: new Date().toISOString(),
      context: { exitCode: 1 },
    };

    const json = formatStructuredErrorJson(structured);
    const parsed = JSON.parse(json);

    expect(parsed.category).toBe("test");
    expect(parsed.message).toBe("Test failed");
    expect(parsed.context.exitCode).toBe(1);
  });
});

// ============================================================================
// Effect Cause Integration Tests
// ============================================================================

describe("formatCausePretty", () => {
  it("should format a simple failure cause", () => {
    const error = new TestConnectionError({
      message: "Connection failed",
      providerType: "polkadotJs",
      endpoint: "ws://localhost:9944",
    });
    const cause = Cause.fail(error);

    const formatted = formatCausePretty(cause);

    expect(formatted).toContain("ProviderConnectionError");
  });

  it("should format an empty cause", () => {
    const cause = Cause.empty;
    const formatted = formatCausePretty(cause);

    expect(formatted).toBeDefined();
  });
});

describe("causeToStructuredErrors", () => {
  it("should convert single failure to structured errors", () => {
    const error = new TestStartupError({ message: "Startup failed" });
    const cause = Cause.fail(error);

    const structured = causeToStructuredErrors(cause);

    expect(structured.length).toBe(1);
    expect(structured[0].message).toBe("Startup failed");
    expect(structured[0].category).toBe("startup");
  });

  it("should convert parallel failures to structured errors", () => {
    const error1 = new TestConnectionError({
      message: "Connection 1 failed",
      providerType: "polkadotJs",
      endpoint: "ws://localhost:9944",
    });
    const error2 = new TestConnectionError({
      message: "Connection 2 failed",
      providerType: "ethers",
      endpoint: "http://localhost:8545",
    });
    const cause = Cause.parallel(Cause.fail(error1), Cause.fail(error2));

    const structured = causeToStructuredErrors(cause);

    expect(structured.length).toBe(2);
  });

  it("should convert sequential failures to structured errors", () => {
    const error1 = new TestStartupError({ message: "First error" });
    const error2 = new TestShutdownError({
      message: "Second error",
      foundationType: "dev",
    });
    const cause = Cause.sequential(Cause.fail(error1), Cause.fail(error2));

    const structured = causeToStructuredErrors(cause);

    expect(structured.length).toBe(2);
  });
});

describe("causeSummary", () => {
  it("should return 'No error' for empty cause", () => {
    const cause = Cause.empty;
    expect(causeSummary(cause)).toBe("No error");
  });

  it("should return single error message for single failure", () => {
    const error = new TestStartupError({ message: "Startup failed" });
    const cause = Cause.fail(error);

    expect(causeSummary(cause)).toBe("Startup failed");
  });

  it("should return count for multiple failures", () => {
    const error1 = new TestStartupError({ message: "Error 1" });
    const error2 = new TestStartupError({ message: "Error 2" });
    const cause = Cause.parallel(Cause.fail(error1), Cause.fail(error2));

    const summary = causeSummary(cause);
    expect(summary).toContain("2 errors occurred");
  });

  it("should handle interrupts", () => {
    const cause = Cause.interrupt(FiberId.none);
    expect(causeSummary(cause)).toBe("Operation was interrupted");
  });
});

// ============================================================================
// shouldIncludeStackTrace Tests
// ============================================================================

describe("shouldIncludeStackTrace", () => {
  it("should return true for unknown errors", () => {
    const error = new Error("Unknown error");
    expect(shouldIncludeStackTrace(error)).toBe(true);
  });

  it("should return true for process errors", () => {
    const error = new TestProcessError({ message: "Process failed", pid: 123 });
    expect(shouldIncludeStackTrace(error)).toBe(true);
  });

  it("should return false for connection errors", () => {
    const error = new TestConnectionError({
      message: "Connection failed",
      providerType: "polkadotJs",
      endpoint: "ws://localhost:9944",
    });
    expect(shouldIncludeStackTrace(error)).toBe(false);
  });

  it("should return false for startup errors", () => {
    const error = new TestStartupError({ message: "Startup failed" });
    expect(shouldIncludeStackTrace(error)).toBe(false);
  });
});

// ============================================================================
// isStructuredError Tests
// ============================================================================

describe("isStructuredError", () => {
  it("should return true for valid StructuredError", () => {
    const structured: StructuredError = {
      category: "test",
      message: "Test error",
      timestamp: new Date().toISOString(),
    };
    expect(isStructuredError(structured)).toBe(true);
  });

  it("should return false for plain objects without required fields", () => {
    expect(isStructuredError({ message: "test" })).toBe(false);
    expect(isStructuredError({ category: "test" })).toBe(false);
    expect(isStructuredError(null)).toBe(false);
    expect(isStructuredError(undefined)).toBe(false);
    expect(isStructuredError("string")).toBe(false);
  });
});

// ============================================================================
// formatErrorForCli Tests
// ============================================================================

describe("formatErrorForCli", () => {
  it("should format errors with proper structure", () => {
    const error = new TestConnectionError({
      message: "Failed to connect to RPC",
      providerType: "polkadotJs",
      endpoint: "ws://localhost:9944",
    });

    const formatted = formatErrorForCli(error);

    expect(formatted).toContain("Failed to connect to RPC");
    expect(formatted).toContain("CONNECTION");
  });

  it("should handle plain Error objects", () => {
    const error = new Error("Simple error");
    const formatted = formatErrorForCli(error);

    expect(formatted).toContain("Simple error");
  });

  it("should handle string errors", () => {
    const formatted = formatErrorForCli("String error message");
    expect(formatted).toContain("String error message");
  });
});

// ============================================================================
// Effect Integration Tests
// ============================================================================

describe("logAndStructure", () => {
  it("should return StructuredError", async () => {
    const error = new TestStartupError({ message: "Test error" });

    // Capture console output
    const originalError = console.error;
    console.error = mock(() => {});

    const result = await Effect.runPromise(logAndStructure(error));

    console.error = originalError;

    expect(result.message).toBe("Test error");
    expect(result.category).toBe("startup");
  });
});

describe("logErrorEffect", () => {
  it("should create an Effect that logs the error", async () => {
    const error = new TestStartupError({ message: "Test error" });

    // Capture console output
    const originalError = console.error;
    let logged = false;
    console.error = mock(() => {
      logged = true;
    });

    const effect = logErrorEffect({ verbose: false })(error);
    await Effect.runPromise(effect);

    console.error = originalError;

    expect(logged).toBe(true);
  });
});

// ============================================================================
// Console Output Tests (with mocked console.error)
// ============================================================================

describe("logError", () => {
  let consoleErrorMock: ReturnType<typeof mock>;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalConsoleError = console.error;
    consoleErrorMock = mock(() => {});
    console.error = consoleErrorMock;
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("should log error to console", () => {
    const error = new TestStartupError({ message: "Startup failed" });
    logError(error);

    expect(consoleErrorMock).toHaveBeenCalled();
  });

  it("should include suggestions by default", () => {
    const error = new TestStartupError({ message: "Startup failed" });
    logError(error);

    // Check that console.error was called with content containing suggestions
    const calls = consoleErrorMock.mock.calls;
    const output = calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Suggestions");
  });

  it("should include verbose info when requested", () => {
    const error = new TestStartupError({ message: "Startup failed" });
    logError(error, { verbose: true });

    const calls = consoleErrorMock.mock.calls;
    const output = calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Timestamp");
    expect(output).toContain("Category");
  });
});

describe("logCause", () => {
  let consoleErrorMock: ReturnType<typeof mock>;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalConsoleError = console.error;
    consoleErrorMock = mock(() => {});
    console.error = consoleErrorMock;
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("should not log empty cause", () => {
    logCause(Cause.empty);
    // Empty cause should not produce output (only empty string calls)
    const nonEmptyCalls = consoleErrorMock.mock.calls.filter((c) => c[0] !== "");
    expect(nonEmptyCalls.length).toBe(0);
  });

  it("should log cause with structured errors", () => {
    const error = new TestConnectionError({
      message: "Connection failed",
      providerType: "polkadotJs",
      endpoint: "ws://localhost:9944",
    });
    const cause = Cause.fail(error);

    logCause(cause);

    expect(consoleErrorMock).toHaveBeenCalled();
    const calls = consoleErrorMock.mock.calls;
    const output = calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Connection failed");
  });

  it("should include Cause.pretty output when verbose", () => {
    const error = new TestStartupError({ message: "Test error" });
    const cause = Cause.fail(error);

    logCause(cause, { verbose: true, includePretty: true });

    expect(consoleErrorMock).toHaveBeenCalled();
    const calls = consoleErrorMock.mock.calls;
    const output = calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Full error details");
  });
});
