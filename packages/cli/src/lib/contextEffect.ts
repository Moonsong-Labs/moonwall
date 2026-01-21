/**
 * Effect-based integration module for MoonwallContext.
 *
 * This module provides Effect-based wrappers around foundation and provider
 * lifecycle operations. It serves as a bridge between the Effect services
 * and the existing Promise-based MoonwallContext API.
 *
 * The key principle is: Effect is used internally for typed error handling,
 * composability, and resource management. Effect.runPromise converts to
 * Promises at the boundary to maintain backwards compatibility.
 */

import { Effect, Exit } from "effect";
import type {
  ConnectedProvider,
  Environment,
  FoundationType,
  MoonwallConfig,
  ProviderConfig,
} from "@moonwall/types";
import { createLogger } from "@moonwall/util";
import {
  DevFoundationService,
  type DevFoundationConfig,
  type DevFoundationRunningInfo,
} from "../internal/effect/services/DevFoundationService.js";
import { DevFoundationServiceLive } from "../internal/effect/services/DevFoundationServiceLive.js";
import {
  ChopsticksFoundationService,
  type ChopsticksFoundationConfig,
  type ChopsticksFoundationRunningInfo,
} from "../internal/effect/services/ChopsticksFoundationService.js";
import { ChopsticksFoundationServiceLive } from "../internal/effect/services/ChopsticksFoundationServiceLive.js";
import {
  ZombieFoundationService,
  type ZombieFoundationConfig,
  type ZombieFoundationRunningInfo,
} from "../internal/effect/services/ZombieFoundationService.js";
import { ZombieFoundationServiceLive } from "../internal/effect/services/ZombieFoundationServiceLive.js";
import {
  ReadOnlyFoundationService,
  type ReadOnlyFoundationConfig,
  type ReadOnlyFoundationRunningInfo,
} from "../internal/effect/services/ReadOnlyFoundationService.js";
import { ReadOnlyFoundationServiceLive } from "../internal/effect/services/ReadOnlyFoundationServiceLive.js";
import {
  ProviderService,
  type ProviderServiceConfig,
} from "../internal/effect/services/ProviderService.js";
import { ProviderServiceLive } from "../internal/effect/services/ProviderServiceLive.js";
import { isEthereumDevConfig, isEthereumZombieConfig } from "./configReader.js";

const logger = createLogger({ name: "contextEffect" });

/**
 * Result from starting a foundation.
 * Contains the running info and a cleanup function.
 */
export interface FoundationStartResult<T> {
  readonly info: T;
  readonly cleanup: () => Promise<void>;
}

/**
 * Result from connecting providers.
 * Contains the connected providers and a cleanup function.
 */
export interface ProviderConnectResult {
  readonly providers: ConnectedProvider[];
  readonly cleanup: () => Promise<void>;
}

/**
 * Unified foundation result type that wraps any foundation type's result.
 */
export type AnyFoundationStartResult =
  | { type: "dev"; result: FoundationStartResult<DevFoundationRunningInfo> }
  | { type: "chopsticks"; result: FoundationStartResult<ChopsticksFoundationRunningInfo> }
  | { type: "zombie"; result: FoundationStartResult<ZombieFoundationRunningInfo> }
  | { type: "read_only"; result: FoundationStartResult<ReadOnlyFoundationRunningInfo> };

/**
 * Start a dev foundation using Effect services.
 *
 * This wraps DevFoundationService.start() and converts the Effect to a Promise
 * for use by MoonwallContext.
 */
export async function startDevFoundation(
  config: DevFoundationConfig
): Promise<FoundationStartResult<DevFoundationRunningInfo>> {
  const program = Effect.gen(function* () {
    const devService = yield* DevFoundationService;
    const { info, stop } = yield* devService.start(config);

    // Create cleanup function that runs the stop Effect
    const cleanup = async () => {
      const stopResult = await Effect.runPromiseExit(stop);
      if (Exit.isFailure(stopResult)) {
        logger.warn(`Dev foundation cleanup failed: ${stopResult.cause}`);
      }
    };

    return { info, cleanup };
  }).pipe(Effect.provide(DevFoundationServiceLive));

  return Effect.runPromise(program);
}

/**
 * Start a chopsticks foundation using Effect services.
 *
 * This wraps ChopsticksFoundationService.start() and converts the Effect to a Promise
 * for use by MoonwallContext.
 */
export async function startChopsticksFoundation(
  config: ChopsticksFoundationConfig
): Promise<FoundationStartResult<ChopsticksFoundationRunningInfo>> {
  const program = Effect.gen(function* () {
    const chopsticksService = yield* ChopsticksFoundationService;
    const { info, stop } = yield* chopsticksService.start(config);

    const cleanup = async () => {
      const stopResult = await Effect.runPromiseExit(stop);
      if (Exit.isFailure(stopResult)) {
        logger.warn(`Chopsticks foundation cleanup failed: ${stopResult.cause}`);
      }
    };

    return { info, cleanup };
  }).pipe(Effect.provide(ChopsticksFoundationServiceLive));

  return Effect.runPromise(program);
}

/**
 * Start a zombie foundation using Effect services.
 *
 * This wraps ZombieFoundationService.start() and converts the Effect to a Promise
 * for use by MoonwallContext.
 */
export async function startZombieFoundation(
  config: ZombieFoundationConfig
): Promise<FoundationStartResult<ZombieFoundationRunningInfo>> {
  const program = Effect.gen(function* () {
    const zombieService = yield* ZombieFoundationService;
    const { info, stop } = yield* zombieService.start(config);

    const cleanup = async () => {
      const stopResult = await Effect.runPromiseExit(stop);
      if (Exit.isFailure(stopResult)) {
        logger.warn(`Zombie foundation cleanup failed: ${stopResult.cause}`);
      }
    };

    return { info, cleanup };
  }).pipe(Effect.provide(ZombieFoundationServiceLive));

  return Effect.runPromise(program);
}

/**
 * Connect to a read-only foundation using Effect services.
 *
 * This wraps ReadOnlyFoundationService.connect() and converts the Effect to a Promise
 * for use by MoonwallContext.
 */
export async function connectReadOnlyFoundation(
  config: ReadOnlyFoundationConfig
): Promise<FoundationStartResult<ReadOnlyFoundationRunningInfo>> {
  const program = Effect.gen(function* () {
    const readOnlyService = yield* ReadOnlyFoundationService;
    const { info, disconnect } = yield* readOnlyService.connect(config);

    const cleanup = async () => {
      const disconnectResult = await Effect.runPromiseExit(disconnect);
      if (Exit.isFailure(disconnectResult)) {
        logger.warn(`ReadOnly foundation cleanup failed: ${disconnectResult.cause}`);
      }
    };

    return { info, cleanup };
  }).pipe(Effect.provide(ReadOnlyFoundationServiceLive));

  return Effect.runPromise(program);
}

/**
 * Connect providers using Effect services.
 *
 * This wraps ProviderService.connect() and converts the Effect to a Promise
 * for use by MoonwallContext.
 */
export async function connectProvidersEffect(
  config: ProviderServiceConfig
): Promise<ProviderConnectResult> {
  const program = Effect.gen(function* () {
    const providerService = yield* ProviderService;
    const { info, disconnect } = yield* providerService.connect(config);

    const cleanup = async () => {
      const disconnectResult = await Effect.runPromiseExit(disconnect);
      if (Exit.isFailure(disconnectResult)) {
        logger.warn(`Provider cleanup failed: ${disconnectResult.cause}`);
      }
    };

    return {
      providers: [...info.connectedProviders],
      cleanup,
    };
  }).pipe(Effect.provide(ProviderServiceLive));

  return Effect.runPromise(program);
}

/**
 * Build DevFoundationConfig from environment configuration.
 */
export function buildDevFoundationConfig(
  env: Environment,
  _config: MoonwallConfig
): DevFoundationConfig | null {
  if (env.foundation.type !== "dev") {
    return null;
  }

  const launchSpec = env.foundation.launchSpec[0];
  if (!launchSpec) {
    return null;
  }

  return {
    command: launchSpec.binPath || "",
    args: launchSpec.options || [],
    name: launchSpec.name,
    launchSpec,
    isEthereumChain: isEthereumDevConfig(),
  };
}

/**
 * Build ChopsticksFoundationConfig from environment configuration.
 */
export function buildChopsticksFoundationConfig(
  env: Environment
): ChopsticksFoundationConfig | null {
  if (env.foundation.type !== "chopsticks") {
    return null;
  }

  const launchSpec = env.foundation.launchSpec[0];
  if (!launchSpec) {
    return null;
  }

  // ChopsticksFoundationConfig.type only accepts "relaychain" | "parachain"
  // If type is "single" or undefined, we don't pass it
  const chopsticksType =
    launchSpec.type === "relaychain" || launchSpec.type === "parachain"
      ? launchSpec.type
      : undefined;

  return {
    configPath: launchSpec.configPath,
    name: launchSpec.name || `chopsticks-${launchSpec.configPath}`,
    launchSpec,
    wsPort: launchSpec.wsPort,
    type: chopsticksType,
    wasmOverride: launchSpec.wasmOverride,
    buildBlockMode: launchSpec.buildBlockMode,
  };
}

/**
 * Build ZombieFoundationConfig from environment configuration.
 */
export function buildZombieFoundationConfig(env: Environment): ZombieFoundationConfig | null {
  if (env.foundation.type !== "zombie") {
    return null;
  }

  const zombieSpec = env.foundation.zombieSpec;
  if (!zombieSpec) {
    return null;
  }

  return {
    configPath: zombieSpec.configPath,
    name: zombieSpec.name,
    launchSpec: zombieSpec,
    disableDefaultEthProviders: zombieSpec.disableDefaultEthProviders,
    disableLogEavesdropping: zombieSpec.disableLogEavesdropping,
    skipBlockCheck: zombieSpec.skipBlockCheck,
  };
}

/**
 * Build ReadOnlyFoundationConfig from environment configuration.
 */
export function buildReadOnlyFoundationConfig(env: Environment): ReadOnlyFoundationConfig | null {
  if (env.foundation.type !== "read_only") {
    return null;
  }

  const launchSpec = env.foundation.launchSpec;

  return {
    name: launchSpec.name || env.name,
    launchSpec,
    connections: env.connections || [],
    disableRuntimeVersionCheck: launchSpec.disableRuntimeVersionCheck,
  };
}

/**
 * Build ProviderServiceConfig from environment configuration.
 */
export function buildProviderServiceConfig(
  env: Environment,
  foundationType: FoundationType
): ProviderServiceConfig {
  let providers: ProviderConfig[] = [];

  if (env.connections && env.connections.length > 0) {
    providers = env.connections;
  } else if (foundationType === "zombie" && isEthereumZombieConfig()) {
    // Use default zombie providers for Ethereum chains
    // This matches the behavior in globalContext.ts
    providers = [];
  } else if (foundationType === "dev" && isEthereumDevConfig()) {
    // Use default dev providers for Ethereum chains
    providers = [];
  }

  return {
    providers,
    connectionTimeout: 10000, // 10 seconds
    retryAttempts: 150, // Matches existing moonwall behavior
    retryDelay: 100, // 100ms between retries
  };
}

/**
 * Start any foundation type based on the environment configuration.
 *
 * This is a unified entry point that dispatches to the appropriate
 * foundation-specific start function.
 */
export async function startFoundation(
  env: Environment,
  config: MoonwallConfig
): Promise<AnyFoundationStartResult> {
  const foundationType = env.foundation.type;

  switch (foundationType) {
    case "dev": {
      const devConfig = buildDevFoundationConfig(env, config);
      if (!devConfig) {
        throw new Error("Failed to build dev foundation config");
      }
      const result = await startDevFoundation(devConfig);
      return { type: "dev", result };
    }

    case "chopsticks": {
      const chopsticksConfig = buildChopsticksFoundationConfig(env);
      if (!chopsticksConfig) {
        throw new Error("Failed to build chopsticks foundation config");
      }
      const result = await startChopsticksFoundation(chopsticksConfig);
      return { type: "chopsticks", result };
    }

    case "zombie": {
      const zombieConfig = buildZombieFoundationConfig(env);
      if (!zombieConfig) {
        throw new Error("Failed to build zombie foundation config");
      }
      const result = await startZombieFoundation(zombieConfig);
      return { type: "zombie", result };
    }

    case "read_only": {
      const readOnlyConfig = buildReadOnlyFoundationConfig(env);
      if (!readOnlyConfig) {
        throw new Error("Failed to build read_only foundation config");
      }
      const result = await connectReadOnlyFoundation(readOnlyConfig);
      return { type: "read_only", result };
    }

    default:
      throw new Error(`Unsupported foundation type: ${foundationType}`);
  }
}
