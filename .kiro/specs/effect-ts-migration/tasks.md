# Implementation Plan

## Phase 1: Foundation Setup

- [x] 1. Setup Effect-TS dependencies and development infrastructure
  - Add Effect-TS dependencies to all packages that will use it
  - Create TypeScript configuration files for WIP development
  - Add development scripts for continuous type checking
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 1.1 Add Effect-TS dependencies to package.json files
  - Add `effect` to packages/types/package.json
  - Add `effect` to packages/util/package.json  
  - Add `effect` to packages/cli/package.json
  - Update root package.json with new development scripts
  - _Requirements: 7.1_

- [x] 1.2 Create TypeScript configuration for WIP development
  - Create tsconfig.wip.json in packages/types with relaxed settings
  - Create tsconfig.wip.json in packages/util with relaxed settings
  - Create tsconfig.wip.json in packages/cli with relaxed settings
  - Update existing tsconfig.json files to exclude *.wip.ts files
  - _Requirements: 7.2_

- [x] 1.3 Add development scripts for continuous type checking
  - Add typecheck:wip script to root package.json
  - Add typecheck:watch script to root package.json
  - Add typecheck:wip script to each package's package.json
  - Add typecheck:watch script to each package's package.json
  - _Requirements: 7.3_

- [x] 2. Create foundational error types and resource management patterns
  - Implement base error hierarchy using Effect's Data.TaggedError
  - Create resource management utilities for common patterns
  - Add basic Effect utilities for Promise interop
  - _Requirements: 3.1, 3.2, 3.3, 4.1_

- [x] 2.1 Implement base error hierarchy in packages/types
  - Create src/errors.effect.ts with MoonwallError base class
  - Add NetworkError, ResourceError, ConfigurationError classes
  - Add TimeoutError, ValidationError, ProcessError, DockerError classes
  - Export all error types from main index
  - _Requirements: 3.1, 3.2_

- [x] 2.2 Create resource management utilities in packages/util
  - Create src/effect/resources.wip.ts with makeConnection pattern
  - Add makeDockerContainer resource management pattern
  - Add makeFileHandle and makeProcess resource patterns
  - Create utility functions for common resource operations
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 2.3 Add Effect-Promise interop utilities
  - Create src/effect/interop.wip.ts with Promise conversion utilities
  - Add runPromiseEffect function for backward compatibility
  - Add promiseToEffect and effectToPromise conversion functions
  - Create testing utilities for Effect-based functions
  - _Requirements: 1.1, 1.2, 1.3_

## Phase 2: Utility Function Migration

- [ ] 3. Migrate core utility functions to Effect while maintaining Promise APIs
  - Start with pure functions that don't manage resources
  - Add comprehensive tests for both Effect and Promise behaviors
  - Ensure backward compatibility for all public APIs
  - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2_

- [ ] 3.1 Migrate blockchain utility functions in packages/util/src/functions
  - Migrate checkBalance function to Effect internally, Promise externally
  - Migrate createRawTransfer function with proper error handling
  - Migrate sendRawTransaction with retry logic and timeouts
  - Add comprehensive tests for all migrated functions
  - _Requirements: 2.1, 2.2, 6.1_

- [ ] 3.2 Migrate Web3 provider functions in packages/util/src/functions/providers.ts
  - Migrate customWeb3Request to Effect with proper error handling
  - Migrate web3EthCall with timeout and retry capabilities
  - Add typed errors for different failure modes
  - Maintain existing Promise-based public APIs
  - _Requirements: 2.1, 2.3, 3.1, 3.2_

- [ ] 3.3 Migrate Viem utility functions in packages/util/src/functions/viem.ts
  - Migrate deriveViemChain with proper error handling
  - Migrate deployViemContract with resource management
  - Migrate createViemTransaction with validation and error handling
  - Add Effect-based versions alongside Promise APIs
  - _Requirements: 2.1, 2.2, 5.1, 5.2_

- [ ] 3.4 Add comprehensive testing for migrated utility functions
  - Create test utilities for Effect-based functions
  - Add tests for success scenarios with expected outputs
  - Add tests for all error scenarios and error types
  - Add performance comparison tests between old and new implementations
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

## Phase 3: Provider Management Migration

- [ ] 4. Migrate provider connection management to Effect-based resource handling
  - Implement connection pooling with automatic cleanup
  - Add retry logic and timeout handling for connections
  - Ensure all connections are properly managed as resources
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2_

- [ ] 4.1 Create Effect-based provider pool in packages/cli/src/internal/providerFactories.ts
  - Create EffectProviderPool class with resource management
  - Implement connection acquisition and release patterns
  - Add connection pooling with configurable limits
  - Add comprehensive error handling for connection failures
  - _Requirements: 4.1, 4.2, 5.1_

- [ ] 4.2 Migrate ProviderInterfaceFactory to Effect patterns
  - Migrate populate method to use Effect for connection management
  - Add retry logic for connection attempts with exponential backoff
  - Add timeout handling for connection operations
  - Maintain backward compatibility with existing Promise APIs
  - _Requirements: 4.1, 4.3, 5.2, 5.3_

- [ ] 4.3 Add connection lifecycle management
  - Implement proper connection cleanup on errors
  - Add connection health checking and automatic reconnection
  - Add metrics and monitoring for connection pool usage
  - Create tests for connection lifecycle scenarios
  - _Requirements: 4.1, 4.4, 6.2_

- [ ] 4.4 Migrate network operation functions
  - Migrate functions that use providers to Effect-based resource access
  - Add structured concurrency for parallel network operations
  - Implement proper error propagation and recovery
  - Add comprehensive tests for network operation scenarios
  - _Requirements: 5.1, 5.2, 5.3, 6.1_

## Phase 4: Context Management Migration

- [ ] 5. Migrate global context management to Effect-based lifecycle handling
  - Implement scoped resource management for entire environments
  - Add proper cleanup for all resources on context destruction
  - Ensure environment setup and teardown is atomic
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 5.1 Create Effect-based MoonwallContext in packages/cli/src/lib/globalContext.ts
  - Create EffectMoonwallContext class with Effect-based lifecycle
  - Implement setupFoundation using Effect resource management
  - Add proper error handling for environment setup failures
  - Maintain backward compatibility with existing getContext API
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 5.2 Migrate environment setup methods to Effect
  - Migrate handleDev, handleZombie, handleChopsticks, handleReadOnly methods
  - Implement proper resource acquisition and cleanup for each foundation type
  - Add comprehensive error handling and recovery for setup failures
  - Add timeout handling for environment startup operations
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 5.3 Migrate network startup and connection management
  - Migrate startNetwork method to Effect with proper resource management
  - Migrate connectEnvironment method with retry and timeout logic
  - Implement structured concurrency for parallel provider connections
  - Add comprehensive error handling and cleanup for network failures
  - _Requirements: 4.1, 4.2, 5.1, 5.2_

- [ ] 5.4 Add comprehensive testing for context management
  - Create tests for successful environment setup and teardown
  - Add tests for error scenarios during environment setup
  - Add tests for resource cleanup in failure scenarios
  - Add integration tests for complete environment lifecycle
  - _Requirements: 6.1, 6.2, 6.3_

## Phase 5: CLI Integration and Process Management

- [ ] 6. Migrate CLI command handlers and process management to Effect
  - Implement Effect-based process lifecycle management
  - Add proper resource cleanup for Docker containers and processes
  - Ensure all external processes are managed as resources
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 6.1 Migrate Docker container management
  - Create Effect-based Docker container resource management
  - Implement proper container lifecycle with guaranteed cleanup
  - Add error handling for container creation and management failures
  - Add timeout handling for Docker operations
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 6.2 Migrate process management in packages/cli/src/internal/localNode.ts
  - Migrate launchNode function to Effect-based process management
  - Implement proper process cleanup with resource management
  - Add error handling for process startup and management failures
  - Add monitoring and health checking for managed processes
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 6.3 Migrate command handlers to Effect patterns
  - Migrate CLI command handlers to use Effect for operation composition
  - Add proper error handling and user-friendly error messages
  - Implement structured concurrency for parallel operations
  - Add comprehensive logging and monitoring for CLI operations
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 6.4 Add end-to-end testing for CLI integration
  - Create tests for complete CLI workflows using Effect
  - Add tests for error scenarios and recovery in CLI operations
  - Add tests for resource cleanup in CLI failure scenarios
  - Add performance tests comparing old and new CLI implementations
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

## Phase 6: Full Effect APIs and Optimization

- [ ] 7. Expose Effect-based APIs and optimize performance
  - Create public Effect APIs alongside existing Promise APIs
  - Add Effect-specific configuration options
  - Optimize performance and add monitoring
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 7.1 Create public Effect APIs in all packages
  - Export Effect-based versions of all migrated functions
  - Add Effect-specific configuration interfaces
  - Create comprehensive documentation for Effect APIs
  - Add migration guide for users wanting to adopt Effect APIs
  - _Requirements: 7.4, 8.1, 8.2_

- [ ] 7.2 Add Effect-specific configuration options
  - Add retry policy configuration to MoonwallConfig
  - Add timeout configuration for different operation types
  - Add concurrency limits and resource pool configuration
  - Add monitoring and metrics configuration options
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 7.3 Implement performance optimizations
  - Add connection pooling and resource reuse optimizations
  - Implement batching for bulk operations using Effect.forEach
  - Add caching for expensive operations with Effect-based cache
  - Add lazy evaluation optimizations for unused code paths
  - _Requirements: 5.4_

- [ ] 7.4 Add comprehensive monitoring and metrics
  - Add metrics collection for Effect operations
  - Add monitoring for resource usage and cleanup
  - Add error rate and retry pattern tracking
  - Create performance benchmarks and regression tests
  - _Requirements: 6.4_

## Phase 7: Documentation and Migration Support

- [ ] 8. Create comprehensive documentation and migration support
  - Document all Effect patterns and best practices
  - Create migration guides for different user scenarios
  - Add troubleshooting guides for common issues
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 8.1 Create Effect pattern documentation
  - Document error handling patterns and best practices
  - Document resource management patterns with examples
  - Document testing patterns for Effect-based code
  - Create troubleshooting guide for common Effect issues
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 8.2 Create migration guides for users
  - Create guide for migrating from Promise to Effect APIs
  - Create guide for adopting Effect patterns in user code
  - Create guide for configuring Effect-specific options
  - Add examples and best practices for different scenarios
  - _Requirements: 7.4, 8.1, 8.2_
