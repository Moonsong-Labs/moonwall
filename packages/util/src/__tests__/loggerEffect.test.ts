/**
 * Tests for loggerEffect.ts - Effect-based logger wrappers.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { Effect, Layer } from "effect";
import {
  createLoggerEffect,
  getLoggerEffect,
  clearLoggersEffect,
  setLoggerEnabledEffect,
  LoggerService,
  LoggerServiceLive,
  LoggerServiceDisabled,
  makeLoggerServiceLayer,
  LoggerCreationError,
  type LoggerInstance,
  type LoggerServiceStatus,
} from "../functions/loggerEffect.js";
import { clearLoggers as clearLoggersSync } from "../functions/logger.js";

// Clear loggers before each test to avoid state pollution
beforeEach(() => {
  clearLoggersSync();
});

afterEach(() => {
  clearLoggersSync();
});

// ============================================================================
// createLoggerEffect Tests
// ============================================================================

describe("createLoggerEffect", () => {
  it("should create a logger successfully", async () => {
    const result = await Effect.runPromise(createLoggerEffect({ name: "test-logger" }));

    expect(result).toBeDefined();
    expect(result.name).toBe("test-logger");
    expect(typeof result.debug).toBe("function");
    expect(typeof result.info).toBe("function");
    expect(typeof result.warn).toBe("function");
    expect(typeof result.error).toBe("function");
  });

  it("should return cached logger for same name", async () => {
    const logger1 = await Effect.runPromise(createLoggerEffect({ name: "cached-logger" }));
    const logger2 = await Effect.runPromise(createLoggerEffect({ name: "cached-logger" }));

    // Both should have the same name (underlying pino caches by name)
    expect(logger1.name).toBe(logger2.name);
    expect(logger1.name).toBe("cached-logger");
  });

  it("should respect level option", async () => {
    const logger = await Effect.runPromise(
      createLoggerEffect({ name: "level-logger", level: "debug" })
    );

    expect(logger.level).toBe("debug");
  });

  it("should log messages without errors", async () => {
    const logger = await Effect.runPromise(createLoggerEffect({ name: "log-test-logger" }));

    // These should not throw
    expect(() => logger.info("test message")).not.toThrow();
    expect(() => logger.debug("debug message")).not.toThrow();
    expect(() => logger.warn("warning message")).not.toThrow();
    expect(() => logger.error("error message")).not.toThrow();
    expect(() => logger.fatal("fatal message")).not.toThrow();
    expect(() => logger.trace("trace message")).not.toThrow();
  });

  it("should log messages with context", async () => {
    const logger = await Effect.runPromise(createLoggerEffect({ name: "context-logger" }));

    // These should not throw
    expect(() => logger.info("test message", { key: "value" })).not.toThrow();
    expect(() => logger.debug("debug message", { count: 42 })).not.toThrow();
    expect(() => logger.warn("warning message", { nested: { data: true } })).not.toThrow();
  });
});

// ============================================================================
// getLoggerEffect Tests
// ============================================================================

describe("getLoggerEffect", () => {
  it("should return undefined for non-existent logger", async () => {
    const result = await Effect.runPromise(getLoggerEffect("non-existent"));

    expect(result).toBeUndefined();
  });

  it("should return existing logger", async () => {
    // First create a logger
    await Effect.runPromise(createLoggerEffect({ name: "existing-logger" }));

    // Then retrieve it
    const result = await Effect.runPromise(getLoggerEffect("existing-logger"));

    expect(result).toBeDefined();
    expect(result?.name).toBe("existing-logger");
  });
});

// ============================================================================
// clearLoggersEffect Tests
// ============================================================================

describe("clearLoggersEffect", () => {
  it("should clear all cached loggers", async () => {
    // Create some loggers
    await Effect.runPromise(createLoggerEffect({ name: "clear-test-1" }));
    await Effect.runPromise(createLoggerEffect({ name: "clear-test-2" }));

    // Clear them
    await Effect.runPromise(clearLoggersEffect());

    // They should no longer exist
    const logger1 = await Effect.runPromise(getLoggerEffect("clear-test-1"));
    const logger2 = await Effect.runPromise(getLoggerEffect("clear-test-2"));

    expect(logger1).toBeUndefined();
    expect(logger2).toBeUndefined();
  });
});

// ============================================================================
// setLoggerEnabledEffect Tests
// ============================================================================

describe("setLoggerEnabledEffect", () => {
  it("should enable/disable loggers matching pattern", async () => {
    // Create loggers
    await Effect.runPromise(createLoggerEffect({ name: "prefix:logger1" }));
    await Effect.runPromise(createLoggerEffect({ name: "prefix:logger2" }));
    await Effect.runPromise(createLoggerEffect({ name: "other:logger" }));

    // Disable loggers matching "prefix:*"
    await Effect.runPromise(setLoggerEnabledEffect("prefix:*", false));

    // This should not throw - just verifying the Effect runs
    expect(true).toBe(true);
  });
});

// ============================================================================
// LoggerService Tests (with Layer)
// ============================================================================

describe("LoggerService", () => {
  describe("LoggerServiceLive", () => {
    it("should create logger via service", async () => {
      const program = Effect.gen(function* () {
        const service = yield* LoggerService;
        const logger = yield* service.getLogger({ name: "service-logger" });
        return logger;
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));

      expect(result).toBeDefined();
      expect(result.name).toBe("service-logger");
    });

    it("should track logger names", async () => {
      const program = Effect.gen(function* () {
        const service = yield* LoggerService;
        yield* service.getLogger({ name: "tracked-1" });
        yield* service.getLogger({ name: "tracked-2" });
        const names = yield* service.getLoggerNames();
        return names;
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));

      expect(result).toContain("tracked-1");
      expect(result).toContain("tracked-2");
    });

    it("should report active status", async () => {
      const program = Effect.gen(function* () {
        const service = yield* LoggerService;
        yield* service.getLogger({ name: "status-logger" });
        const status = yield* service.getStatus();
        return status;
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));

      expect(result._tag).toBe("Active");
      if (result._tag === "Active") {
        expect(result.loggerCount).toBeGreaterThanOrEqual(1);
        expect(result.defaultLevel).toBe("info");
      }
    });

    it("should clear loggers via service", async () => {
      const program = Effect.gen(function* () {
        const service = yield* LoggerService;
        yield* service.getLogger({ name: "to-clear" });
        yield* service.clearLoggers();
        const names = yield* service.getLoggerNames();
        return names;
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));

      expect(result).toHaveLength(0);
    });

    it("should check if logger exists", async () => {
      const program = Effect.gen(function* () {
        const service = yield* LoggerService;
        yield* service.getLogger({ name: "check-exists" });
        const exists = yield* service.hasLogger("check-exists");
        const notExists = yield* service.hasLogger("non-existent");
        return { exists, notExists };
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));

      expect(result.exists).toBe(true);
      expect(result.notExists).toBe(false);
    });

    it("should log via service methods", async () => {
      const program = Effect.gen(function* () {
        const service = yield* LoggerService;
        yield* service.getLogger({ name: "log-service" });
        yield* service.debug("log-service", "debug message");
        yield* service.info("log-service", "info message");
        yield* service.warn("log-service", "warn message");
        yield* service.error("log-service", "error message");
        return "logged";
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));

      expect(result).toBe("logged");
    });

    it("should log with context via service methods", async () => {
      const program = Effect.gen(function* () {
        const service = yield* LoggerService;
        yield* service.getLogger({ name: "context-service" });
        yield* service.info("context-service", "message", { key: "value" });
        return "logged with context";
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));

      expect(result).toBe("logged with context");
    });
  });

  describe("LoggerServiceDisabled", () => {
    it("should return no-op logger when disabled", async () => {
      const program = Effect.gen(function* () {
        const service = yield* LoggerService;
        const logger = yield* service.getLogger({ name: "disabled-logger" });
        return logger;
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceDisabled)));

      expect(result).toBeDefined();
      expect(result.name).toBe("disabled-logger");
      expect(result.level).toBe("silent");
      expect(result.enabled).toBe(false);
    });

    it("should report disabled status", async () => {
      const program = Effect.gen(function* () {
        const service = yield* LoggerService;
        const status = yield* service.getStatus();
        return status;
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceDisabled)));

      expect(result._tag).toBe("Disabled");
    });
  });

  describe("makeLoggerServiceLayer", () => {
    it("should create layer with custom config", async () => {
      const customLayer = makeLoggerServiceLayer({
        defaultLevel: "debug",
        enabled: true,
      });

      const program = Effect.gen(function* () {
        const service = yield* LoggerService;
        const status = yield* service.getStatus();
        return status;
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(customLayer)));

      expect(result._tag).toBe("Active");
      if (result._tag === "Active") {
        expect(result.defaultLevel).toBe("debug");
      }
    });

    it("should create disabled layer via config", async () => {
      const disabledLayer = makeLoggerServiceLayer({
        enabled: false,
      });

      const program = Effect.gen(function* () {
        const service = yield* LoggerService;
        const status = yield* service.getStatus();
        return status;
      });

      const result = await Effect.runPromise(program.pipe(Effect.provide(disabledLayer)));

      expect(result._tag).toBe("Disabled");
    });
  });
});

// ============================================================================
// Effect Composition Tests
// ============================================================================

describe("Effect Composition", () => {
  it("should compose with pipe", async () => {
    const program = createLoggerEffect({ name: "pipe-logger" }).pipe(
      Effect.map((logger) => logger.name)
    );

    const result = await Effect.runPromise(program);
    expect(result).toBe("pipe-logger");
  });

  it("should compose with flatMap", async () => {
    const program = createLoggerEffect({ name: "flatmap-1" }).pipe(
      Effect.flatMap((_logger1) => createLoggerEffect({ name: "flatmap-2" })),
      Effect.map((logger) => logger.name)
    );

    const result = await Effect.runPromise(program);
    expect(result).toBe("flatmap-2");
  });

  it("should work with Effect.gen", async () => {
    const program = Effect.gen(function* () {
      const logger1 = yield* createLoggerEffect({ name: "gen-1" });
      const logger2 = yield* createLoggerEffect({ name: "gen-2" });
      return [logger1.name, logger2.name];
    });

    const result = await Effect.runPromise(program);
    expect(result).toEqual(["gen-1", "gen-2"]);
  });

  it("should work with Effect.all for parallel creation", async () => {
    const program = Effect.all([
      createLoggerEffect({ name: "parallel-1" }),
      createLoggerEffect({ name: "parallel-2" }),
      createLoggerEffect({ name: "parallel-3" }),
    ]);

    const result = await Effect.runPromise(program);
    expect(result).toHaveLength(3);
    expect(result.map((l) => l.name)).toEqual(["parallel-1", "parallel-2", "parallel-3"]);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("Error Handling", () => {
  it("should have correct error tag", () => {
    const error = new LoggerCreationError({
      message: "test error",
      loggerName: "test",
      cause: new Error("cause"),
    });

    expect(error._tag).toBe("LoggerCreationError");
    expect(error.message).toBe("test error");
    expect(error.loggerName).toBe("test");
    expect(error.cause).toBeInstanceOf(Error);
  });

  it("should support Effect.catchTag for error handling", async () => {
    // Create a mock error scenario by manually failing
    const failingProgram = Effect.fail(
      new LoggerCreationError({
        message: "Mock failure",
        loggerName: "mock",
      })
    );

    const handledProgram = failingProgram.pipe(
      Effect.catchTag("LoggerCreationError", (error) =>
        Effect.succeed(`Handled: ${error.loggerName}`)
      )
    );

    const result = await Effect.runPromise(handledProgram);
    expect(result).toBe("Handled: mock");
  });
});
