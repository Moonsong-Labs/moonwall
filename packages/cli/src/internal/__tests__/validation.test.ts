import { describe, test, expect, afterEach } from "bun:test";
import path from "node:path";
import {
  validateFilePath,
  validateOutputPath,
  validateEnvironmentName,
  validateBinaryName,
  validateDownloadUrl,
  validateVersion,
} from "../validation";

describe("validation utilities", () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
  });

  describe("validateFilePath", () => {
    test("accepts valid relative paths", () => {
      const result = validateFilePath("moonwall.config.json");
      expect(result).toBe(path.resolve(process.cwd(), "moonwall.config.json"));
    });

    test("accepts valid nested paths", () => {
      const result = validateFilePath("configs/test.json");
      expect(result).toBe(path.resolve(process.cwd(), "configs/test.json"));
    });

    test("rejects path traversal attempts", () => {
      expect(() => validateFilePath("../../../etc/passwd")).toThrow("path traversal detected");
    });

    test("rejects paths with null bytes", () => {
      expect(() => validateFilePath("file\0.txt")).toThrow("contains null bytes");
    });

    test("rejects empty path", () => {
      expect(() => validateFilePath("")).toThrow("required");
    });

    test("accepts path to base directory itself", () => {
      const result = validateFilePath(".", process.cwd());
      expect(result).toBe(process.cwd());
    });

    test("normalizes paths with . components", () => {
      const result = validateFilePath("./configs/./test.json");
      expect(result).toBe(path.resolve(process.cwd(), "configs/test.json"));
    });

    test("validates against custom base directory", () => {
      const baseDir = path.join(process.cwd(), "configs");
      const result = validateFilePath("test.json", baseDir);
      expect(result).toBe(path.join(baseDir, "test.json"));
    });

    test("rejects traversal outside custom base directory", () => {
      const baseDir = path.join(process.cwd(), "configs");
      expect(() => validateFilePath("../secret.json", baseDir)).toThrow("path traversal detected");
    });
  });

  describe("validateOutputPath", () => {
    test("accepts valid relative paths", () => {
      const result = validateOutputPath("tmp/output.tar.gz");
      expect(result).toBe(path.resolve(process.cwd(), "tmp/output.tar.gz"));
    });

    test("accepts absolute paths", () => {
      const absPath = "/tmp/moonwall/output.tar.gz";
      const result = validateOutputPath(absPath);
      expect(result).toBe(absPath);
    });

    test("rejects relative path traversal", () => {
      expect(() => validateOutputPath("../../etc/malicious")).toThrow("path traversal detected");
    });

    test("rejects paths with null bytes", () => {
      expect(() => validateOutputPath("output\0.txt")).toThrow("contains null bytes");
    });

    test("rejects empty path", () => {
      expect(() => validateOutputPath("")).toThrow("required");
    });
  });

  describe("validateEnvironmentName", () => {
    test("accepts valid environment names", () => {
      expect(validateEnvironmentName("dev")).toBe("dev");
      expect(validateEnvironmentName("chopsticks")).toBe("chopsticks");
      expect(validateEnvironmentName("dev_seq")).toBe("dev_seq");
      expect(validateEnvironmentName("basic-test")).toBe("basic-test");
      expect(validateEnvironmentName("test.env")).toBe("test.env");
    });

    test("accepts names starting with numbers", () => {
      expect(validateEnvironmentName("1test")).toBe("1test");
    });

    test("rejects names with shell metacharacters", () => {
      expect(() => validateEnvironmentName("test;rm -rf /")).toThrow("Invalid environment name");
      expect(() => validateEnvironmentName("test|cat")).toThrow("Invalid environment name");
      expect(() => validateEnvironmentName("test$(whoami)")).toThrow("Invalid environment name");
    });

    test("rejects names with spaces", () => {
      expect(() => validateEnvironmentName("test env")).toThrow("Invalid environment name");
    });

    test("rejects empty names", () => {
      expect(() => validateEnvironmentName("")).toThrow("required");
    });

    test("rejects names longer than 64 characters", () => {
      const longName = "a".repeat(65);
      expect(() => validateEnvironmentName(longName)).toThrow("Invalid environment name");
    });

    test("rejects names starting with special characters", () => {
      expect(() => validateEnvironmentName("-test")).toThrow("Invalid environment name");
      expect(() => validateEnvironmentName("_test")).toThrow("Invalid environment name");
    });
  });

  describe("validateBinaryName", () => {
    test("accepts valid binary names", () => {
      expect(validateBinaryName("polkadot")).toBe("polkadot");
      expect(validateBinaryName("moonbeam")).toBe("moonbeam");
      expect(validateBinaryName("moonbase-runtime")).toBe("moonbase-runtime");
      expect(validateBinaryName("node_v1.0.0")).toBe("node_v1.0.0");
    });

    test("rejects names with path separators", () => {
      expect(() => validateBinaryName("../polkadot")).toThrow("path separators");
      expect(() => validateBinaryName("bin/polkadot")).toThrow("path separators");
    });

    test("rejects names with shell metacharacters", () => {
      expect(() => validateBinaryName("polkadot;rm")).toThrow("shell metacharacter");
      expect(() => validateBinaryName("polkadot|cat")).toThrow("shell metacharacter");
      expect(() => validateBinaryName("polkadot`echo`")).toThrow("shell metacharacter");
      expect(() => validateBinaryName("polkadot$(cmd)")).toThrow("shell metacharacter");
    });

    test("rejects empty names", () => {
      expect(() => validateBinaryName("")).toThrow("required");
    });
  });

  describe("validateDownloadUrl", () => {
    test("accepts valid GitHub URLs", () => {
      const url = "https://github.com/user/repo/releases/download/v1.0.0/binary";
      expect(validateDownloadUrl(url)).toBe(url);
    });

    test("accepts raw.githubusercontent.com URLs", () => {
      const url = "https://raw.githubusercontent.com/user/repo/main/file.txt";
      expect(validateDownloadUrl(url)).toBe(url);
    });

    test("accepts objects.githubusercontent.com URLs", () => {
      const url = "https://objects.githubusercontent.com/abc123";
      expect(validateDownloadUrl(url)).toBe(url);
    });

    test("rejects non-GitHub URLs", () => {
      expect(() => validateDownloadUrl("https://evil.com/malware")).toThrow(
        "not in the allowed list"
      );
    });

    test("rejects HTTP URLs", () => {
      expect(() => validateDownloadUrl("http://github.com/file")).toThrow("must use HTTPS");
    });

    test("rejects WebSocket URLs", () => {
      expect(() => validateDownloadUrl("wss://github.com/socket")).toThrow("must use HTTPS");
    });

    test("rejects malformed URLs", () => {
      expect(() => validateDownloadUrl("not-a-url")).toThrow("not a valid URL");
    });

    test("rejects empty URLs", () => {
      expect(() => validateDownloadUrl("")).toThrow("required");
    });

    test("rejects subdomains that try to spoof GitHub", () => {
      expect(() => validateDownloadUrl("https://github.com.evil.com/file")).toThrow(
        "not in the allowed list"
      );
    });
  });

  describe("validateVersion", () => {
    test("accepts 'latest' keyword", () => {
      expect(validateVersion("latest")).toBe("latest");
    });

    test("accepts semver versions", () => {
      expect(validateVersion("1.0.0")).toBe("1.0.0");
      expect(validateVersion("v1.0.0")).toBe("v1.0.0");
      expect(validateVersion("1.0.0-rc1")).toBe("1.0.0-rc1");
    });

    test("accepts runtime versions", () => {
      expect(validateVersion("runtime-2400")).toBe("runtime-2400");
    });

    test("rejects versions with shell metacharacters", () => {
      expect(() => validateVersion("1.0.0;rm")).toThrow("Invalid version");
      expect(() => validateVersion("1.0.0$(cmd)")).toThrow("Invalid version");
    });

    test("rejects empty versions", () => {
      expect(() => validateVersion("")).toThrow("required");
    });

    test("rejects very long versions", () => {
      const longVersion = "v" + "1".repeat(100);
      expect(() => validateVersion(longVersion)).toThrow("too long");
    });
  });
});
