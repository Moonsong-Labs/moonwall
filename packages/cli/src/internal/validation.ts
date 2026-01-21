/**
 * Input validation utilities for CLI security.
 *
 * These functions validate and sanitize user input to prevent:
 * - Path traversal attacks
 * - Command injection
 * - Malformed input causing unexpected behavior
 */

import path from "node:path";

/**
 * Validates that a file path is safe and doesn't traverse outside allowed directories.
 *
 * @param inputPath - The user-provided path to validate
 * @param baseDir - The base directory the path should be relative to (defaults to cwd)
 * @returns The normalized, validated path
 * @throws Error if the path is invalid or attempts traversal
 */
export function validateFilePath(inputPath: string, baseDir?: string): string {
  if (!inputPath || typeof inputPath !== "string") {
    throw new Error("File path is required and must be a string");
  }

  // Reject paths with null bytes (common injection technique)
  if (inputPath.includes("\0")) {
    throw new Error("Invalid file path: contains null bytes");
  }

  // Normalize the path to resolve . and .. components
  const base = baseDir || process.cwd();
  const normalizedBase = path.resolve(base);
  const resolvedPath = path.resolve(base, inputPath);

  // Verify the resolved path is still within the base directory
  // Allow exact match (resolvedPath === normalizedBase) for the base directory itself
  if (!resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
    throw new Error(
      `Invalid file path: path traversal detected. Path must be within ${normalizedBase}`
    );
  }

  return resolvedPath;
}

/**
 * Validates that an output path for downloads is safe.
 *
 * @param outputPath - The user-provided output path
 * @param defaultDir - The default directory if path is relative
 * @returns The normalized, validated path
 * @throws Error if the path is invalid
 */
export function validateOutputPath(outputPath: string, defaultDir = "./"): string {
  if (!outputPath || typeof outputPath !== "string") {
    throw new Error("Output path is required and must be a string");
  }

  // Reject paths with null bytes
  if (outputPath.includes("\0")) {
    throw new Error("Invalid output path: contains null bytes");
  }

  // Normalize the path
  const resolvedPath = path.resolve(defaultDir, outputPath);

  // For output paths, we check that the result doesn't go above cwd
  // unless an absolute path was explicitly provided
  const cwd = process.cwd();
  if (!path.isAbsolute(outputPath)) {
    if (!resolvedPath.startsWith(cwd + path.sep) && resolvedPath !== cwd) {
      throw new Error(
        `Invalid output path: path traversal detected. Relative paths must stay within ${cwd}`
      );
    }
  }

  return resolvedPath;
}

/**
 * Pattern for valid environment names.
 * Allows alphanumeric characters, underscores, hyphens, and periods.
 * Must start with a letter or number.
 * Maximum length of 64 characters to prevent DoS.
 */
const ENV_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_\-.]{0,63}$/;

/**
 * Validates an environment name for safety.
 *
 * @param envName - The environment name to validate
 * @returns The validated environment name
 * @throws Error if the name is invalid
 */
export function validateEnvironmentName(envName: string): string {
  if (!envName || typeof envName !== "string") {
    throw new Error("Environment name is required and must be a string");
  }

  if (!ENV_NAME_PATTERN.test(envName)) {
    throw new Error(
      `Invalid environment name "${envName}". ` +
        "Environment names must start with a letter or number, " +
        "contain only letters, numbers, underscores, hyphens, and periods, " +
        "and be at most 64 characters."
    );
  }

  return envName;
}

/**
 * Pattern for valid binary/artifact names.
 * Allows alphanumeric characters, underscores, hyphens, and periods.
 * Must not contain path separators or shell metacharacters.
 */
const BINARY_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_\-.]*$/;

/**
 * Validates a binary/artifact name for safety.
 *
 * @param binaryName - The binary name to validate
 * @returns The validated binary name
 * @throws Error if the name is invalid
 */
export function validateBinaryName(binaryName: string): string {
  if (!binaryName || typeof binaryName !== "string") {
    throw new Error("Binary name is required and must be a string");
  }

  // Reject path separators explicitly
  if (binaryName.includes("/") || binaryName.includes("\\")) {
    throw new Error("Invalid binary name: must not contain path separators");
  }

  // Reject shell metacharacters
  const shellMetachars = [
    ";",
    "|",
    "&",
    "$",
    "`",
    "(",
    ")",
    "{",
    "}",
    "[",
    "]",
    "<",
    ">",
    "!",
    "*",
    "?",
    "~",
    "#",
    "'",
    '"',
    "\n",
    "\r",
  ];
  for (const char of shellMetachars) {
    if (binaryName.includes(char)) {
      throw new Error(`Invalid binary name: contains shell metacharacter '${char}'`);
    }
  }

  if (!BINARY_NAME_PATTERN.test(binaryName)) {
    throw new Error(
      `Invalid binary name "${binaryName}". ` +
        "Binary names must start with a letter or number and contain only " +
        "letters, numbers, underscores, hyphens, and periods."
    );
  }

  return binaryName;
}

/**
 * Allowed domains for artifact downloads.
 * Only GitHub-related domains are trusted for binary downloads.
 */
const ALLOWED_DOWNLOAD_DOMAINS = [
  "github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "github-releases.githubusercontent.com",
  "github-cloud.githubusercontent.com",
  "github-cloud.s3.amazonaws.com",
  "api.github.com",
];

/**
 * Validates that a download URL is from a trusted domain.
 *
 * @param url - The URL to validate
 * @returns The validated URL
 * @throws Error if the URL is not from a trusted domain
 */
export function validateDownloadUrl(url: string): string {
  if (!url || typeof url !== "string") {
    throw new Error("Download URL is required and must be a string");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid download URL: "${url}" is not a valid URL`);
  }

  // Must be HTTPS
  if (parsedUrl.protocol !== "https:") {
    throw new Error(`Invalid download URL: must use HTTPS protocol, got ${parsedUrl.protocol}`);
  }

  // Check against whitelist
  const hostname = parsedUrl.hostname.toLowerCase();
  const isAllowed = ALLOWED_DOWNLOAD_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );

  if (!isAllowed) {
    throw new Error(
      `Invalid download URL: domain "${hostname}" is not in the allowed list. ` +
        `Downloads are only permitted from GitHub domains.`
    );
  }

  return url;
}

/**
 * Validates a version string for safety.
 *
 * @param version - The version string to validate
 * @returns The validated version
 * @throws Error if the version is invalid
 */
export function validateVersion(version: string): string {
  if (!version || typeof version !== "string") {
    throw new Error("Version is required and must be a string");
  }

  // Allow "latest" keyword
  if (version === "latest") {
    return version;
  }

  // Version pattern: semver-like with optional v prefix and rc suffix
  // Examples: v1.0.0, 1.0.0, 1.0.0-rc1, runtime-2400
  const VERSION_PATTERN = /^v?[a-zA-Z0-9][a-zA-Z0-9_.\-]*$/;

  if (!VERSION_PATTERN.test(version)) {
    throw new Error(
      `Invalid version "${version}". ` +
        "Versions must be alphanumeric with optional v prefix, dots, hyphens, and underscores."
    );
  }

  // Maximum length check
  if (version.length > 64) {
    throw new Error("Version string is too long (maximum 64 characters)");
  }

  return version;
}
