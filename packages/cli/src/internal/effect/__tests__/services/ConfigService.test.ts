import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Effect, Layer, Exit } from "effect";
import {
  ConfigService,
  ConfigLoadError,
  ConfigValidationError,
  EnvironmentNotFoundError,
} from "../../services/ConfigService.js";
import { ConfigServiceLive } from "../../services/ConfigServiceLive.js";
import type { MoonwallConfig } from "@moonwall/types";
import path from "node:path";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";

// Test fixture paths
const TEST_DIR = path.join(process.cwd(), "tmp", "config-service-test");
const VALID_CONFIG_PATH = path.join(TEST_DIR, "valid.config.json");
const INVALID_CONFIG_PATH = path.join(TEST_DIR, "invalid.config.json");
const MALFORMED_CONFIG_PATH = path.join(TEST_DIR, "malformed.config.json");
const JSONC_CONFIG_PATH = path.join(TEST_DIR, "valid.config");

// Valid test configuration
const validConfig: MoonwallConfig = {
  label: "Test Config",
  defaultTestTimeout: 30000,
  environments: [
    {
      name: "dev_test",
      testFileDir: ["./tests"],
      foundation: {
        type: "dev",
        launchSpec: [
          {
            name: "moonbeam",
            binPath: "./moonbeam",
          },
        ],
      },
    },
    {
      name: "chopsticks_test",
      testFileDir: ["./tests/chopsticks"],
      foundation: {
        type: "chopsticks",
        launchSpec: [
          {
            name: "moonbeam-fork",
            configPath: "./moonbeam.yml",
          },
        ],
      },
    },
  ],
};

// Invalid config missing required fields
const invalidConfig = {
  label: "Invalid Config",
  // Missing defaultTestTimeout
  // Missing environments
};

describe("ConfigService", () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }

    // Write test config files
    writeFileSync(VALID_CONFIG_PATH, JSON.stringify(validConfig, null, 2));
    writeFileSync(INVALID_CONFIG_PATH, JSON.stringify(invalidConfig, null, 2));
    writeFileSync(MALFORMED_CONFIG_PATH, "{ invalid json }");

    // JSONC config with comments
    const jsoncContent = `{
      // This is a comment
      "label": "JSONC Config",
      "defaultTestTimeout": 30000,
      "environments": [
        {
          "name": "jsonc_env",
          "testFileDir": ["./tests"],
          "foundation": {
            "type": "dev",
            "launchSpec": [{ "name": "test", "binPath": "./bin" }]
          }
        }
      ]
    }`;
    writeFileSync(JSONC_CONFIG_PATH, jsoncContent);
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    // Clean up env vars
    delete process.env.MOON_CONFIG_PATH;
  });

  describe("loadConfig", () => {
    it("should load a valid JSON config file", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        const config = yield* configService.loadConfig({
          configPath: VALID_CONFIG_PATH,
        });
        return config;
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result.label).toBe("Test Config");
      expect(result.defaultTestTimeout).toBe(30000);
      expect(result.environments).toHaveLength(2);
    });

    it("should load a JSONC config file with comments", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        const config = yield* configService.loadConfig({
          configPath: JSONC_CONFIG_PATH,
        });
        return config;
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result.label).toBe("JSONC Config");
      expect(result.environments[0].name).toBe("jsonc_env");
    });

    it("should return cached config on subsequent calls", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        const config1 = yield* configService.loadConfig({
          configPath: VALID_CONFIG_PATH,
        });
        const config2 = yield* configService.loadConfig({
          configPath: VALID_CONFIG_PATH,
        });
        return { config1, config2 };
      }).pipe(Effect.provide(ConfigServiceLive));

      const { config1, config2 } = await Effect.runPromise(program);

      // Should be the same cached object
      expect(config1).toBe(config2);
    });

    it("should fail with ConfigLoadError when file not found", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        return yield* configService.loadConfig({
          configPath: "/nonexistent/path/config.json",
        });
      }).pipe(Effect.provide(ConfigServiceLive));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBeInstanceOf(ConfigLoadError);
        expect((error as ConfigLoadError).message).toContain("not found");
      }
    });

    it("should fail with ConfigLoadError when JSON is malformed", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        return yield* configService.loadConfig({
          configPath: MALFORMED_CONFIG_PATH,
        });
      }).pipe(Effect.provide(ConfigServiceLive));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBeInstanceOf(ConfigLoadError);
        expect((error as ConfigLoadError).message).toContain("Failed to load");
      }
    });

    it("should use MOON_CONFIG_PATH env var when no path specified", async () => {
      process.env.MOON_CONFIG_PATH = VALID_CONFIG_PATH;

      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        const config = yield* configService.loadConfig();
        return config;
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result.label).toBe("Test Config");
    });

    it("should replace environment variables in config values", async () => {
      process.env.TEST_VAR = "replaced_value";

      const configWithEnvVar = {
        ...validConfig,
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Intentional - testing env var replacement
        label: "Config with ${TEST_VAR}",
      };
      const envVarConfigPath = path.join(TEST_DIR, "envvar.config.json");
      writeFileSync(envVarConfigPath, JSON.stringify(configWithEnvVar, null, 2));

      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        const config = yield* configService.loadConfig({
          configPath: envVarConfigPath,
        });
        return config;
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result.label).toBe("Config with replaced_value");

      delete process.env.TEST_VAR;
    });
  });

  describe("getConfig", () => {
    it("should return config after it is loaded", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: VALID_CONFIG_PATH });
        const config = yield* configService.getConfig();
        return config;
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result.label).toBe("Test Config");
    });

    it("should fail if config not loaded", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        return yield* configService.getConfig();
      }).pipe(Effect.provide(ConfigServiceLive));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBeInstanceOf(ConfigLoadError);
        expect((error as ConfigLoadError).message).toContain("not been loaded");
      }
    });
  });

  describe("isLoaded", () => {
    it("should return false when config not loaded", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        return yield* configService.isLoaded();
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result).toBe(false);
    });

    it("should return true after config is loaded", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: VALID_CONFIG_PATH });
        return yield* configService.isLoaded();
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("should return Unloaded initially", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        return yield* configService.getStatus();
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result._tag).toBe("Unloaded");
    });

    it("should return Loaded after successful load", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: VALID_CONFIG_PATH });
        return yield* configService.getStatus();
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result._tag).toBe("Loaded");
      if (result._tag === "Loaded") {
        expect(result.configPath).toBe(VALID_CONFIG_PATH);
      }
    });

    it("should return Failed after load failure", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        // Try to load non-existent file
        yield* Effect.either(configService.loadConfig({ configPath: "/nonexistent.json" }));
        return yield* configService.getStatus();
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result._tag).toBe("Failed");
    });
  });

  describe("getEnvironment", () => {
    it("should return environment by name", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: VALID_CONFIG_PATH });
        const env = yield* configService.getEnvironment("dev_test");
        return env;
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result.name).toBe("dev_test");
      expect(result.foundation.type).toBe("dev");
    });

    it("should fail with EnvironmentNotFoundError for unknown environment", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: VALID_CONFIG_PATH });
        return yield* configService.getEnvironment("nonexistent");
      }).pipe(Effect.provide(ConfigServiceLive));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBeInstanceOf(EnvironmentNotFoundError);
        const envError = error as EnvironmentNotFoundError;
        expect(envError.environmentName).toBe("nonexistent");
        expect(envError.availableEnvironments).toContain("dev_test");
        expect(envError.availableEnvironments).toContain("chopsticks_test");
      }
    });

    it("should fail if config not loaded", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        return yield* configService.getEnvironment("dev_test");
      }).pipe(Effect.provide(ConfigServiceLive));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBeInstanceOf(ConfigLoadError);
      }
    });
  });

  describe("getEnvironmentNames", () => {
    it("should return all environment names", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: VALID_CONFIG_PATH });
        return yield* configService.getEnvironmentNames();
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result).toContain("dev_test");
      expect(result).toContain("chopsticks_test");
      expect(result).toHaveLength(2);
    });

    it("should fail if config not loaded", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        return yield* configService.getEnvironmentNames();
      }).pipe(Effect.provide(ConfigServiceLive));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("validateConfig", () => {
    it("should succeed for valid config", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: VALID_CONFIG_PATH });
        yield* configService.validateConfig();
        return "valid";
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result).toBe("valid");
    });

    it("should fail for config missing label", async () => {
      const configMissingLabel = {
        defaultTestTimeout: 30000,
        environments: [
          {
            name: "test",
            testFileDir: ["./tests"],
            foundation: { type: "dev", launchSpec: [{ name: "test", binPath: "./bin" }] },
          },
        ],
      };
      const missingLabelPath = path.join(TEST_DIR, "missing-label.config.json");
      writeFileSync(missingLabelPath, JSON.stringify(configMissingLabel, null, 2));

      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: missingLabelPath });
        yield* configService.validateConfig();
      }).pipe(Effect.provide(ConfigServiceLive));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect((error as ConfigValidationError).invalidField).toBe("label");
      }
    });

    it("should fail for config with invalid defaultTestTimeout", async () => {
      const configInvalidTimeout = {
        label: "Test",
        defaultTestTimeout: -1,
        environments: [
          {
            name: "test",
            testFileDir: ["./tests"],
            foundation: { type: "dev", launchSpec: [{ name: "test", binPath: "./bin" }] },
          },
        ],
      };
      const invalidTimeoutPath = path.join(TEST_DIR, "invalid-timeout.config.json");
      writeFileSync(invalidTimeoutPath, JSON.stringify(configInvalidTimeout, null, 2));

      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: invalidTimeoutPath });
        yield* configService.validateConfig();
      }).pipe(Effect.provide(ConfigServiceLive));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect((error as ConfigValidationError).invalidField).toBe("defaultTestTimeout");
      }
    });

    it("should fail for config with empty environments", async () => {
      const configEmptyEnvs = {
        label: "Test",
        defaultTestTimeout: 30000,
        environments: [],
      };
      const emptyEnvsPath = path.join(TEST_DIR, "empty-envs.config.json");
      writeFileSync(emptyEnvsPath, JSON.stringify(configEmptyEnvs, null, 2));

      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: emptyEnvsPath });
        yield* configService.validateConfig();
      }).pipe(Effect.provide(ConfigServiceLive));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect((error as ConfigValidationError).invalidField).toBe("environments");
      }
    });

    it("should fail for environment missing name", async () => {
      const configMissingEnvName = {
        label: "Test",
        defaultTestTimeout: 30000,
        environments: [
          {
            testFileDir: ["./tests"],
            foundation: { type: "dev", launchSpec: [{ name: "test", binPath: "./bin" }] },
          },
        ],
      };
      const missingEnvNamePath = path.join(TEST_DIR, "missing-env-name.config.json");
      writeFileSync(missingEnvNamePath, JSON.stringify(configMissingEnvName, null, 2));

      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: missingEnvNamePath });
        yield* configService.validateConfig();
      }).pipe(Effect.provide(ConfigServiceLive));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBeInstanceOf(ConfigValidationError);
        // Effect Schema provides the actual array index, which is more precise
        expect((error as ConfigValidationError).invalidField).toBe("environments.[0].name");
      }
    });

    it("should fail if config not loaded", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.validateConfig();
      }).pipe(Effect.provide(ConfigServiceLive));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("should clear cached config", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: VALID_CONFIG_PATH });
        const loadedBefore = yield* configService.isLoaded();
        yield* configService.clearCache();
        const loadedAfter = yield* configService.isLoaded();
        return { loadedBefore, loadedAfter };
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result.loadedBefore).toBe(true);
      expect(result.loadedAfter).toBe(false);
    });

    it("should reset status to Unloaded", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: VALID_CONFIG_PATH });
        yield* configService.clearCache();
        return yield* configService.getStatus();
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result._tag).toBe("Unloaded");
    });
  });

  describe("getConfigPath", () => {
    it("should return config path after loading", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        yield* configService.loadConfig({ configPath: VALID_CONFIG_PATH });
        return yield* configService.getConfigPath();
      }).pipe(Effect.provide(ConfigServiceLive));

      const result = await Effect.runPromise(program);

      expect(result).toBe(VALID_CONFIG_PATH);
    });

    it("should fail if config not loaded", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        return yield* configService.getConfigPath();
      }).pipe(Effect.provide(ConfigServiceLive));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("Error classes", () => {
    it("ConfigLoadError should have correct tag", () => {
      const error = new ConfigLoadError({
        message: "Test error",
        configPath: "/test/path",
      });

      expect(error._tag).toBe("ConfigLoadError");
      expect(error.message).toBe("Test error");
      expect(error.configPath).toBe("/test/path");
    });

    it("ConfigValidationError should have correct tag", () => {
      const error = new ConfigValidationError({
        message: "Validation failed",
        invalidField: "testField",
        invalidValue: "bad value",
      });

      expect(error._tag).toBe("ConfigValidationError");
      expect(error.invalidField).toBe("testField");
      expect(error.invalidValue).toBe("bad value");
    });

    it("EnvironmentNotFoundError should have correct tag", () => {
      const error = new EnvironmentNotFoundError({
        environmentName: "missing_env",
        message: "Not found",
        availableEnvironments: ["env1", "env2"],
      });

      expect(error._tag).toBe("EnvironmentNotFoundError");
      expect(error.environmentName).toBe("missing_env");
      expect(error.availableEnvironments).toEqual(["env1", "env2"]);
    });
  });
});

describe("ConfigService with Layer.succeed mock", () => {
  it("should work with mocked service", async () => {
    const mockConfig: MoonwallConfig = {
      label: "Mock Config",
      defaultTestTimeout: 10000,
      environments: [
        {
          name: "mock_env",
          testFileDir: ["./mock"],
          foundation: {
            type: "read_only",
            launchSpec: { name: "mock" },
          },
        },
      ],
    };

    const mockService: ConfigService["Type"] = {
      loadConfig: () => Effect.succeed(mockConfig),
      getConfig: () => Effect.succeed(mockConfig),
      isLoaded: () => Effect.succeed(true),
      getStatus: () => Effect.succeed({ _tag: "Loaded", configPath: "/mock/path" }),
      getEnvironment: (name) => {
        const env = mockConfig.environments.find((e) => e.name === name);
        return env
          ? Effect.succeed(env)
          : Effect.fail(
              new EnvironmentNotFoundError({
                environmentName: name,
                message: `Not found: ${name}`,
              })
            );
      },
      getEnvironmentNames: () => Effect.succeed(mockConfig.environments.map((e) => e.name)),
      validateConfig: () => Effect.void,
      clearCache: () => Effect.void,
      getConfigPath: () => Effect.succeed("/mock/path"),
    };

    const MockConfigService = Layer.succeed(ConfigService, mockService);

    const program = Effect.gen(function* () {
      const configService = yield* ConfigService;
      const config = yield* configService.loadConfig();
      const env = yield* configService.getEnvironment("mock_env");
      return { config, env };
    }).pipe(Effect.provide(MockConfigService));

    const result = await Effect.runPromise(program);

    expect(result.config.label).toBe("Mock Config");
    expect(result.env.name).toBe("mock_env");
  });
});
