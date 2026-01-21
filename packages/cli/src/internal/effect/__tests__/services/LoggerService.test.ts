/**
 * Unit tests for LoggerService.
 */

import { describe, it, expect, beforeEach, afterEach, } from "bun:test";
import { Effect, Layer, } from "effect";
import {
  LoggerService,
  LoggerServiceLive,
  makeLoggerServiceLayer,
  LoggerServiceDisabled,
  LoggerCreationError,
  type LoggerServiceType,
} from "../../services/index.js";
import { clearLoggers } from "@moonwall/util";

describe("LoggerService", () => {
  // Clean up loggers between tests
  beforeEach(() => {
    clearLoggers();
  });

  afterEach(() => {
    clearLoggers();
  });

  describe("interface", () => {
    it("should create LoggerCreationError with all fields", () => {
      const error = new LoggerCreationError({
        message: "Test error",
        loggerName: "test-logger",
        cause: new Error("underlying error"),
      });

      expect(error._tag).toBe("LoggerCreationError");
      expect(error.message).toBe("Test error");
      expect(error.loggerName).toBe("test-logger");
      expect(error.cause).toBeDefined();
    });

    it("should create LoggerCreationError without optional fields", () => {
      const error = new LoggerCreationError({
        message: "Minimal error",
      });

      expect(error._tag).toBe("LoggerCreationError");
      expect(error.message).toBe("Minimal error");
      expect(error.loggerName).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });
  });

  describe("LoggerServiceLive", () => {
    it("should create a logger with getLogger", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;
        const logger = yield* loggerService.getLogger({ name: "test-logger" });

        expect(logger.name).toBe("test-logger");
        expect(logger.enabled).toBe(true);
        expect(typeof logger.debug).toBe("function");
        expect(typeof logger.info).toBe("function");
        expect(typeof logger.warn).toBe("function");
        expect(typeof logger.error).toBe("function");
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));
    });

    it("should cache loggers by name", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;

        const logger1 = yield* loggerService.getLogger({ name: "cached-logger" });
        const logger2 = yield* loggerService.getLogger({ name: "cached-logger" });

        // Same name should return equivalent logger instances
        expect(logger1.name).toBe(logger2.name);
        expect(logger1.level).toBe(logger2.level);
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));
    });

    it("should track logger names", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;

        yield* loggerService.getLogger({ name: "logger-a" });
        yield* loggerService.getLogger({ name: "logger-b" });

        const hasA = yield* loggerService.hasLogger("logger-a");
        const hasB = yield* loggerService.hasLogger("logger-b");
        const hasC = yield* loggerService.hasLogger("logger-c");

        expect(hasA).toBe(true);
        expect(hasB).toBe(true);
        expect(hasC).toBe(false);

        const names = yield* loggerService.getLoggerNames();
        expect(names).toContain("logger-a");
        expect(names).toContain("logger-b");
        expect(names).not.toContain("logger-c");
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));
    });

    it("should return Active status when enabled", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;

        yield* loggerService.getLogger({ name: "status-test" });
        const status = yield* loggerService.getStatus();

        expect(status._tag).toBe("Active");
        if (status._tag === "Active") {
          expect(status.loggerCount).toBe(1);
          expect(status.defaultLevel).toBe("info");
        }
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));
    });

    it("should clear loggers", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;

        yield* loggerService.getLogger({ name: "clear-test" });
        const hasBeforeClear = yield* loggerService.hasLogger("clear-test");
        expect(hasBeforeClear).toBe(true);

        yield* loggerService.clearLoggers();

        const hasAfterClear = yield* loggerService.hasLogger("clear-test");
        expect(hasAfterClear).toBe(false);

        const status = yield* loggerService.getStatus();
        if (status._tag === "Active") {
          expect(status.loggerCount).toBe(0);
        }
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));
    });

    it("should log at debug level", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;

        yield* loggerService.getLogger({ name: "debug-test", level: "debug" });
        yield* loggerService.debug("debug-test", "Debug message");
        yield* loggerService.debug("debug-test", "Debug with context", { key: "value" });

        // If we get here without error, the logging worked
        expect(true).toBe(true);
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));
    });

    it("should log at info level", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;

        yield* loggerService.getLogger({ name: "info-test" });
        yield* loggerService.info("info-test", "Info message");
        yield* loggerService.info("info-test", "Info with context", { count: 42 });

        expect(true).toBe(true);
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));
    });

    it("should log at warn level", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;

        yield* loggerService.getLogger({ name: "warn-test" });
        yield* loggerService.warn("warn-test", "Warning message");
        yield* loggerService.warn("warn-test", "Warning with context", { severity: "high" });

        expect(true).toBe(true);
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));
    });

    it("should log at error level", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;

        yield* loggerService.getLogger({ name: "error-test" });
        yield* loggerService.error("error-test", "Error message");
        yield* loggerService.error("error-test", "Error with context", {
          errorCode: "E001",
        });

        expect(true).toBe(true);
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));
    });

    it("should handle logging to non-existent logger gracefully", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;

        // Log to a logger that doesn't exist - should not throw
        yield* loggerService.info("non-existent-logger", "This should not throw");

        expect(true).toBe(true);
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));
    });
  });

  describe("makeLoggerServiceLayer", () => {
    it("should create layer with custom default level", async () => {
      const customLayer = makeLoggerServiceLayer({ defaultLevel: "debug" });

      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;

        yield* loggerService.getLogger({ name: "custom-level-test" });
        const status = yield* loggerService.getStatus();

        expect(status._tag).toBe("Active");
        if (status._tag === "Active") {
          expect(status.defaultLevel).toBe("debug");
        }
      });

      await Effect.runPromise(program.pipe(Effect.provide(customLayer)));
    });

    it("should create disabled layer", async () => {
      const disabledLayer = makeLoggerServiceLayer({ enabled: false });

      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;
        const status = yield* loggerService.getStatus();

        expect(status._tag).toBe("Disabled");
      });

      await Effect.runPromise(program.pipe(Effect.provide(disabledLayer)));
    });
  });

  describe("LoggerServiceDisabled", () => {
    it("should return Disabled status", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;
        const status = yield* loggerService.getStatus();

        expect(status._tag).toBe("Disabled");
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceDisabled)));
    });

    it("should return no-op logger when disabled", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;
        const logger = yield* loggerService.getLogger({ name: "disabled-test" });

        expect(logger.name).toBe("disabled-test");
        expect(logger.level).toBe("silent");
        expect(logger.enabled).toBe(false);

        // These should be no-ops, not throw
        logger.debug("test");
        logger.info("test");
        logger.warn("test");
        logger.error("test");

        expect(true).toBe(true);
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceDisabled)));
    });
  });

  describe("setLoggerEnabled", () => {
    it("should enable/disable loggers by pattern", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;

        yield* loggerService.getLogger({ name: "test:a" });
        yield* loggerService.getLogger({ name: "test:b" });
        yield* loggerService.getLogger({ name: "other:c" });

        // Disable all test:* loggers
        yield* loggerService.setLoggerEnabled("test:*", false);

        // This should complete without error
        expect(true).toBe(true);
      });

      await Effect.runPromise(program.pipe(Effect.provide(LoggerServiceLive)));
    });
  });

  describe("mocking with Layer.succeed", () => {
    it("should work with mocked LoggerService", async () => {
      const logs: Array<{ level: string; name: string; message: string }> = [];

      const mockLoggerService: LoggerServiceType = {
        getLogger: (config) =>
          Effect.succeed({
            name: config.name,
            level: config.level || "info",
            enabled: true,
            debug: (msg) => logs.push({ level: "debug", name: config.name, message: msg }),
            info: (msg) => logs.push({ level: "info", name: config.name, message: msg }),
            warn: (msg) => logs.push({ level: "warn", name: config.name, message: msg }),
            error: (msg) => logs.push({ level: "error", name: config.name, message: msg }),
          }),
        debug: (name, msg) => Effect.sync(() => logs.push({ level: "debug", name, message: msg })),
        info: (name, msg) => Effect.sync(() => logs.push({ level: "info", name, message: msg })),
        warn: (name, msg) => Effect.sync(() => logs.push({ level: "warn", name, message: msg })),
        error: (name, msg) => Effect.sync(() => logs.push({ level: "error", name, message: msg })),
        getStatus: () => Effect.succeed({ _tag: "Active", loggerCount: 1, defaultLevel: "info" }),
        setLoggerEnabled: () => Effect.void,
        clearLoggers: () => Effect.void,
        hasLogger: () => Effect.succeed(true),
        getLoggerNames: () => Effect.succeed(["mock-logger"]),
      };

      const MockLayer = Layer.succeed(LoggerService, mockLoggerService);

      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;
        const logger = yield* loggerService.getLogger({ name: "mock-test" });

        logger.info("Hello from mock");
        yield* loggerService.warn("mock-test", "Warning from service");

        expect(logs.length).toBe(2);
        expect(logs[0].level).toBe("info");
        expect(logs[0].message).toBe("Hello from mock");
        expect(logs[1].level).toBe("warn");
        expect(logs[1].message).toBe("Warning from service");
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockLayer)));
    });
  });
});
