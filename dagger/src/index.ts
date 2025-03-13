/**
 * Moonwall Dagger Module
 *
 * This module provides CI/CD functions for the Moonwall project, including
 * formatting and linting capabilities.
 */
import { dag, type Container, type Directory, object, func } from "@dagger.io/dagger"

@object()
class Moonwall {
  /**
   * Returns the base Node.js container with the project mounted and dependencies installed
   */
  @func()
  buildEnv(source: Directory): Container {
    const nodeCache = dag.cacheVolume("node")
    return (dag
      .container()
      .from("node:23-bookworm")
      .withDirectory("/src", source)
      .withMountedCache("/root/.pnpm", nodeCache)
      .withWorkdir("/src")
      .withExec(["npm", "install", "-g", "pnpm@9.1.4"])
      .withEnvVariable("CI", "1")
      .withExec(["pnpm", "install"])
      .withExec(["pnpm", "build"])
    )
  }

  /**
   * Format the codebase using Biome
   * 
   * @param source - The source directory to format
   * @param fix - Whether to automatically fix formatting issues (default: false)
   * @returns The command output
   */
  @func()
  async format(source: Directory, fix = false): Promise<string> {
    const command = fix ? ["pnpm", "fmt:fix"] : ["pnpm", "fmt"];
    
    return this.buildEnv(source)
      .withExec(command)
      .stdout()
  }

  /**
   * Lint the codebase using Biome
   * 
   * @param source - The source directory to lint
   * @param fix - Whether to automatically fix linting issues (default: false)
   * @returns The command output
   */
  @func()
  async lint(source: Directory, fix = false): Promise<string> {
    const command = fix ? ["pnpm", "lint:fix"] : ["pnpm", "lint"];
    
    return this.buildEnv(source)
      .withExec(command)
      .stdout()
  }

  /**
   * Type check the codebase
   * 
   * @param source - The source directory to type check
   * @returns The command output
   */
  @func()
  async typecheck(source: Directory): Promise<string> {
    return this.buildEnv(source)
      .withExec(["pnpm", "typecheck"])
      .stdout()
  }
  
  /**
   * Run static analysis on the codebase
   * 
   * @param source - The source directory to analyze
   * @returns The command output
   */
  @func()
  async staticAnalysis(source: Directory){
    await this.format(source)
    await this.lint(source)
    await this.typecheck(source)
  }
}
