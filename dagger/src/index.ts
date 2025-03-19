/**
 * Moonwall Dagger Module
 *
 * This module provides CI/CD functions for the Moonwall project, including
 * formatting and linting capabilities.
 */
import {
  dag,
  type Container,
  type Directory,
  object,
  argument,
  func,
} from "@dagger.io/dagger";

@object()
export class Moonwall {
  /**
   * Returns the base Node.js container with the project mounted and dependencies installed
   *
   * @param source - The source directory to mount
   * @returns A container with the project and dependencies set up
   */
  @func()
  buildEnv(@argument({ defaultPath: "/" }) source: Directory): Container {
    const nodeCache = dag.cacheVolume("node");
    return dag
      .container()
      .from("node:23-bookworm")
      .withExec(["apt-get", "update"])
      .withExec([
        "apt-get",
        "install",
        "-y",
        "curl",
        "wget",
        "lsof",
        "git",
        "vim",
        "htop",
        "docker",
        "net-tools",
        "dnsutils",
        "iputils-ping",
        "procps",
      ])
      .withDirectory("/src", source)
      .withMountedCache("/src/node_modules", nodeCache)
      .withWorkdir("/src")
      .withExec(["npm", "install", "-g", "pnpm@9.1.4"])
      .withEnvVariable("CI", "1")
      .withExec(["pnpm", "install"])
      .withExec(["pnpm", "build"]);
  }

  /**
   * Builds a test environment container with Moonbeam downloaded
   *
   * @param source - The source directory to use
   * @returns A container configured for testing
   */
  @func()
  buildTestEnv(@argument({ defaultPath: "/" }) source: Directory): Container {
    return this.buildEnv(source)
      .withWorkdir("test")
      .withExec(["pnpm", "moonwall", "download", "moonbeam", "0.43", "tmp"]);
  }

  @func()
  buildTestEnvWithPolkadot(
    @argument({ defaultPath: "/" }) source: Directory
  ): Container {
    return this.buildTestEnv(source)
      .withExec([
        "pnpm",
        "moonwall",
        "download",
        "polkadot",
        "stable2409",
        "tmp",
      ])
      .withExec([
        "pnpm",
        "moonwall",
        "download",
        "polkadot-execute-worker",
        "stable2409",
        "tmp",
      ])
      .withExec([
        "pnpm",
        "moonwall",
        "download",
        "polkadot-prepare-worker",
        "stable2409",
        "tmp",
      ]);
  }

  /**
   * Format the codebase using Biome
   *
   * @param source - The source directory to format
   * @param fix - Whether to automatically fix formatting issues (default: false)
   * @returns The command output
   */
  @func()
  async format(
    @argument({ defaultPath: "/" }) source: Directory,
    fix = false
  ): Promise<string> {
    const command = fix ? ["pnpm", "fmt:fix"] : ["pnpm", "fmt"];

    return this.buildEnv(source).withExec(command).stdout();
  }

  /**
   * Lint the codebase using Biome
   *
   * @param source - The source directory to lint
   * @param fix - Whether to automatically fix linting issues (default: false)
   * @returns The command output
   */
  @func()
  async lint(
    @argument({ defaultPath: "/" }) source: Directory,
    fix = false
  ): Promise<string> {
    const command = fix ? ["pnpm", "lint:fix"] : ["pnpm", "lint"];

    return this.buildEnv(source).withExec(command).stdout();
  }

  /**
   * Type check the codebase
   *
   * @param source - The source directory to type check
   * @returns The command output
   */
  @func()
  async typecheck(
    @argument({ defaultPath: "/" }) source: Directory
  ): Promise<string> {
    return this.buildEnv(source).withExec(["pnpm", "typecheck"]).stdout();
  }

  /**
   * Run static analysis on the codebase
   *
   * @param source - The source directory to analyze
   * @returns The command output
   */
  @func()
  async staticAnalysis(
    @argument({ defaultPath: "/" }) source: Directory
  ): Promise<string[]> {
    return Promise.all([
      this.format(source),
      this.lint(source),
      this.typecheck(source),
    ]);
  }

  @func()
  async runMoonwallTest(
    @argument({ defaultPath: "/" }) source: Directory,
    testEnv: string,
    downloadPolkadot = false
  ): Promise<string> {
    return downloadPolkadot
      ? this.buildTestEnvWithPolkadot(source)
          .withExec(["pnpm", "moonwall", "test", testEnv])
          .stdout()
      : this.buildTestEnv(source)
          .withExec(["pnpm", "moonwall", "test", testEnv])
          .stdout();
  }

  /**
   * Run all tests for the project
   *
   * @param source - The source directory containing the tests
   * @returns The test execution results
   */
  @func()
  async devTest(
    @argument({ defaultPath: "/" }) source: Directory
  ): Promise<void> {
    await Promise.all([
      this.runMoonwallTest(source, "dev_multi"),
      this.runMoonwallTest(source, "dev_seq"),
      this.runMoonwallTest(source, "dev_test"),
      this.runMoonwallTest(source, "dev_smoke"),
      this.runMoonwallTest(source, "papi_dev"),
      this.runMoonwallTest(source, "fork_test"),
    ]);
    // This requires some Docker-outside-of-Docker approach, so do later
    // this.runMoonwallTest(source, "dev_docker"),
  }

  @func()
  async zombieTest(
    @argument({ defaultPath: "/" }) source: Directory
  ): Promise<void> {
    await this.runMoonwallTest(source, "zombie_test", true);
  }

  @func()
  async test(@argument({ defaultPath: "/" }) source: Directory): Promise<void> {
    await this.devTest(source);
    // This requires some Docker-outside-of-Docker approach, so do later
    // this.runMoonwallTest(source, "dev_docker"),
  }

  /**
   * Run full CI checks on the codebase
   *
   * @param source - The source directory to check
   * @returns The command output
   */
  @func()
  async fullCI(
    @argument({ defaultPath: "/" }) source: Directory
  ): Promise<void> {
    await Promise.all([this.staticAnalysis(source), this.test(source)]);
  }
}
