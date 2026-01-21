import { Effect, type Layer } from "effect";
import type { FoundationType } from "@moonwall/types";
import type { FoundationShutdownError, FoundationHealthCheckError } from "../errors/foundation.js";

import type {
  DevFoundationService,
  DevFoundationConfig,
  DevFoundationRunningInfo,
  DevFoundationStatus,
} from "./DevFoundationService.js";
import { DevFoundationServiceLive } from "./DevFoundationServiceLive.js";

import type {
  ChopsticksFoundationService,
  ChopsticksFoundationConfig,
  ChopsticksFoundationRunningInfo,
  ChopsticksFoundationStatus,
} from "./ChopsticksFoundationService.js";
import { ChopsticksFoundationServiceLive } from "./ChopsticksFoundationServiceLive.js";

import type {
  ZombieFoundationService,
  ZombieFoundationConfig,
  ZombieFoundationRunningInfo,
  ZombieFoundationStatus,
} from "./ZombieFoundationService.js";
import { ZombieFoundationServiceLive } from "./ZombieFoundationServiceLive.js";

import type {
  ReadOnlyFoundationService,
  ReadOnlyFoundationConfig,
  ReadOnlyFoundationRunningInfo,
  ReadOnlyFoundationStatus,
} from "./ReadOnlyFoundationService.js";
import { ReadOnlyFoundationServiceLive } from "./ReadOnlyFoundationServiceLive.js";

// ============================================================================
// Unified Types
// ============================================================================

/**
 * Union type of all foundation configuration types.
 *
 * Use this type when you need to handle any foundation configuration
 * without knowing the specific type at compile time.
 */
export type AnyFoundationConfig =
  | ({ readonly _type: "dev" } & DevFoundationConfig)
  | ({ readonly _type: "chopsticks" } & ChopsticksFoundationConfig)
  | ({ readonly _type: "zombie" } & ZombieFoundationConfig)
  | ({ readonly _type: "read_only" } & ReadOnlyFoundationConfig);

/**
 * Union type of all foundation running info types.
 *
 * Use this type when you need to handle any foundation's running
 * information without knowing the specific type at compile time.
 */
export type AnyFoundationRunningInfo =
  | ({ readonly _type: "dev" } & DevFoundationRunningInfo)
  | ({ readonly _type: "chopsticks" } & ChopsticksFoundationRunningInfo)
  | ({ readonly _type: "zombie" } & ZombieFoundationRunningInfo)
  | ({ readonly _type: "read_only" } & ReadOnlyFoundationRunningInfo);

/**
 * Union type of all foundation status types.
 *
 * Use this type when you need to handle any foundation's status
 * without knowing the specific type at compile time.
 */
export type AnyFoundationStatus =
  | ({ readonly _type: "dev" } & DevFoundationStatus)
  | ({ readonly _type: "chopsticks" } & ChopsticksFoundationStatus)
  | ({ readonly _type: "zombie" } & ZombieFoundationStatus)
  | ({ readonly _type: "read_only" } & ReadOnlyFoundationStatus);

/**
 * Maps foundation type strings to their corresponding service types.
 */
export interface FoundationServiceMap {
  dev: typeof DevFoundationService;
  chopsticks: typeof ChopsticksFoundationService;
  zombie: typeof ZombieFoundationService;
  read_only: typeof ReadOnlyFoundationService;
}

/**
 * Maps foundation type strings to their corresponding config types.
 */
export interface FoundationConfigMap {
  dev: DevFoundationConfig;
  chopsticks: ChopsticksFoundationConfig;
  zombie: ZombieFoundationConfig;
  read_only: ReadOnlyFoundationConfig;
}

/**
 * Maps foundation type strings to their corresponding running info types.
 */
export interface FoundationRunningInfoMap {
  dev: DevFoundationRunningInfo;
  chopsticks: ChopsticksFoundationRunningInfo;
  zombie: ZombieFoundationRunningInfo;
  read_only: ReadOnlyFoundationRunningInfo;
}

/**
 * Maps foundation type strings to their corresponding status types.
 */
export interface FoundationStatusMap {
  dev: DevFoundationStatus;
  chopsticks: ChopsticksFoundationStatus;
  zombie: ZombieFoundationStatus;
  read_only: ReadOnlyFoundationStatus;
}

// ============================================================================
// Base Foundation Interface
// ============================================================================

/**
 * Base interface that all foundation services share.
 *
 * This defines the common lifecycle operations that all foundation types
 * must implement. Note that ReadOnlyFoundation uses connect/disconnect
 * instead of start/stop, but the unified interface abstracts this.
 */
export interface BaseFoundationLifecycle<_TRunningInfo, TStatus> {
  /**
   * Stop or disconnect the foundation.
   */
  readonly stop: () => Effect.Effect<void, FoundationShutdownError>;

  /**
   * Get the current status of the foundation.
   */
  readonly getStatus: () => Effect.Effect<TStatus>;

  /**
   * Perform a health check on the foundation.
   */
  readonly healthCheck: () => Effect.Effect<void, FoundationHealthCheckError>;
}

// ============================================================================
// Foundation Service Factory
// ============================================================================

/**
 * Result type for dev foundation service.
 */
export interface DevFoundationServiceResult {
  readonly foundationType: "dev";
  readonly layer: Layer.Layer<DevFoundationService>;
}

/**
 * Result type for chopsticks foundation service.
 */
export interface ChopsticksFoundationServiceResult {
  readonly foundationType: "chopsticks";
  readonly layer: Layer.Layer<ChopsticksFoundationService>;
}

/**
 * Result type for zombie foundation service.
 */
export interface ZombieFoundationServiceResult {
  readonly foundationType: "zombie";
  readonly layer: Layer.Layer<ZombieFoundationService>;
}

/**
 * Result type for read_only foundation service.
 */
export interface ReadOnlyFoundationServiceResult {
  readonly foundationType: "read_only";
  readonly layer: Layer.Layer<ReadOnlyFoundationService>;
}

/**
 * Union type of all foundation service results.
 */
export type FoundationServiceResult =
  | DevFoundationServiceResult
  | ChopsticksFoundationServiceResult
  | ZombieFoundationServiceResult
  | ReadOnlyFoundationServiceResult;

/**
 * Get the service result for a specific foundation type.
 *
 * @param foundationType - The type of foundation to get
 * @returns An Effect yielding the foundation type and live layer
 *
 * @example
 * ```ts
 * const result = yield* getFoundationService("chopsticks");
 * // result.foundationType === "chopsticks"
 * // result.layer is the ChopsticksFoundationServiceLive layer
 * ```
 */
function getFoundationService(
  foundationType: FoundationType
): Effect.Effect<FoundationServiceResult, never> {
  return Effect.sync(() => {
    switch (foundationType) {
      case "dev":
        return {
          foundationType: "dev" as const,
          layer: DevFoundationServiceLive,
        };

      case "chopsticks":
        return {
          foundationType: "chopsticks" as const,
          layer: ChopsticksFoundationServiceLive,
        };

      case "zombie":
        return {
          foundationType: "zombie" as const,
          layer: ZombieFoundationServiceLive,
        };

      case "read_only":
        return {
          foundationType: "read_only" as const,
          layer: ReadOnlyFoundationServiceLive,
        };
    }
  });
}

/**
 * Get the live layer for a specific foundation type.
 *
 * @param foundationType - The type of foundation to get
 * @returns An Effect yielding the live layer for the specified foundation type
 *
 * @example
 * ```ts
 * const layer = yield* getFoundationLayer("zombie");
 * const program = myEffect.pipe(Effect.provide(layer));
 * ```
 */
function getFoundationLayer(
  foundationType: FoundationType
): Effect.Effect<
  | Layer.Layer<DevFoundationService>
  | Layer.Layer<ChopsticksFoundationService>
  | Layer.Layer<ZombieFoundationService>
  | Layer.Layer<ReadOnlyFoundationService>,
  never
> {
  return Effect.map(getFoundationService(foundationType), (result) => result.layer);
}

/**
 * Check if a foundation type is supported.
 *
 * @param foundationType - The foundation type to check
 * @returns true if the foundation type is supported
 */
function isFoundationTypeSupported(foundationType: string): foundationType is FoundationType {
  return ["dev", "chopsticks", "zombie", "read_only"].includes(foundationType);
}

/**
 * Get all supported foundation types.
 *
 * @returns Array of all supported foundation type strings
 */
function getSupportedFoundationTypes(): ReadonlyArray<FoundationType> {
  return ["dev", "chopsticks", "zombie", "read_only"] as const;
}

/**
 * FoundationServiceFactory provides a unified way to obtain the appropriate
 * foundation service based on the foundation type.
 *
 * This factory enables runtime polymorphism across foundation types while
 * maintaining type safety. Given a foundation type string, it returns the
 * corresponding live layer.
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { FoundationServiceFactory, DevFoundationService } from "./FoundationService.js";
 *
 * // Get the appropriate layer for the foundation type
 * const result = yield* FoundationServiceFactory.getService("dev");
 * if (result.foundationType === "dev") {
 *   const program = Effect.gen(function* () {
 *     const devService = yield* DevFoundationService;
 *     const { info, stop } = yield* devService.start(config);
 *     console.log(`Started on port ${info.rpcPort}`);
 *     yield* stop;
 *   }).pipe(Effect.provide(result.layer));
 *
 *   Effect.runPromise(program);
 * }
 * ```
 */
export const FoundationServiceFactory = {
  /**
   * Get the service layer for a specific foundation type.
   *
   * The returned result includes a `foundationType` discriminator that can be
   * used to narrow the type when accessing the layer.
   *
   * @param foundationType - The type of foundation to get
   * @returns An Effect yielding the foundation type and live layer
   */
  getService: getFoundationService,

  /**
   * Get the live layer for a specific foundation type.
   *
   * This is a convenience method when you only need the layer
   * and not the foundation type discriminator.
   *
   * @param foundationType - The type of foundation to get
   * @returns An Effect yielding the live layer
   */
  getLayer: getFoundationLayer,

  /**
   * Check if a foundation type is supported.
   *
   * @param foundationType - The foundation type to check
   * @returns true if the foundation type is supported
   */
  isSupported: isFoundationTypeSupported,

  /**
   * Get all supported foundation types.
   *
   * @returns Array of all supported foundation type strings
   */
  getSupportedTypes: getSupportedFoundationTypes,
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a config is a DevFoundationConfig.
 */
export function isDevFoundationConfig(
  config: AnyFoundationConfig
): config is { readonly _type: "dev" } & DevFoundationConfig {
  return config._type === "dev";
}

/**
 * Type guard to check if a config is a ChopsticksFoundationConfig.
 */
export function isChopsticksFoundationConfig(
  config: AnyFoundationConfig
): config is { readonly _type: "chopsticks" } & ChopsticksFoundationConfig {
  return config._type === "chopsticks";
}

/**
 * Type guard to check if a config is a ZombieFoundationConfig.
 */
export function isZombieFoundationConfig(
  config: AnyFoundationConfig
): config is { readonly _type: "zombie" } & ZombieFoundationConfig {
  return config._type === "zombie";
}

/**
 * Type guard to check if a config is a ReadOnlyFoundationConfig.
 */
export function isReadOnlyFoundationConfig(
  config: AnyFoundationConfig
): config is { readonly _type: "read_only" } & ReadOnlyFoundationConfig {
  return config._type === "read_only";
}

/**
 * Type guard to check if a status is a DevFoundationStatus.
 */
export function isDevFoundationStatus(
  status: AnyFoundationStatus
): status is { readonly _type: "dev" } & DevFoundationStatus {
  return status._type === "dev";
}

/**
 * Type guard to check if a status is a ChopsticksFoundationStatus.
 */
export function isChopsticksFoundationStatus(
  status: AnyFoundationStatus
): status is { readonly _type: "chopsticks" } & ChopsticksFoundationStatus {
  return status._type === "chopsticks";
}

/**
 * Type guard to check if a status is a ZombieFoundationStatus.
 */
export function isZombieFoundationStatus(
  status: AnyFoundationStatus
): status is { readonly _type: "zombie" } & ZombieFoundationStatus {
  return status._type === "zombie";
}

/**
 * Type guard to check if a status is a ReadOnlyFoundationStatus.
 */
export function isReadOnlyFoundationStatus(
  status: AnyFoundationStatus
): status is { readonly _type: "read_only" } & ReadOnlyFoundationStatus {
  return status._type === "read_only";
}
