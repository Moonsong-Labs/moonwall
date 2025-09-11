import net from "node:net";
import { Mutex } from "async-mutex";

/**
 * Thread-safe port allocator that prevents race conditions when allocating ports
 * for multiple nodes spawned in parallel.
 */
export class PortAllocator {
  private static instance: PortAllocator;
  private readonly mutex = new Mutex();
  private readonly allocatedPorts = new Set<number>();
  private readonly poolRanges = new Map<number, { start: number; end: number }>();
  private readonly poolCounters = new Map<number, number>();

  private constructor() {
    // Base port allocation starts at 10000
    // Each pool gets 100 ports
  }

  /**
   * Get singleton instance of PortAllocator
   */
  public static getInstance(): PortAllocator {
    if (!PortAllocator.instance) {
      PortAllocator.instance = new PortAllocator();
    }
    return PortAllocator.instance;
  }

  /**
   * Atomically allocate a free port for the given pool
   * @param poolId - The Vitest pool ID (defaults to 1)
   * @returns Promise<number> - An available port number
   */
  public async allocatePort(poolId = 1): Promise<number> {
    return await this.mutex.runExclusive(async () => {
      const range = this.getPoolRange(poolId);

      // First, try quick sequential scan from last position
      const port = await this.findNextAvailablePort(poolId, range);
      if (port !== null) {
        return port;
      }

      // If sequential scan failed, do a full range scan
      const availablePort = await this.scanRangeForPort(range, poolId);
      if (availablePort !== null) {
        return availablePort;
      }

      // Last resort: try to find any available port in extended range
      const extendedPort = await this.findPortWithExtendedRange(poolId);
      if (extendedPort !== null) {
        return extendedPort;
      }

      throw new Error(
        `Unable to find available port in pool ${poolId} range ${range.start}-${range.end}. ` +
          `Currently allocated: ${this.allocatedPorts.size} ports`
      );
    });
  }

  /**
   * Atomically allocate multiple ports for the given pool
   * @param poolId - The Vitest pool ID
   * @param count - Number of ports to allocate
   * @returns Promise<number[]> - Array of allocated port numbers
   */
  public async allocatePorts(poolId = 1, count: number): Promise<number[]> {
    return await this.mutex.runExclusive(async () => {
      const ports: number[] = [];
      const range = this.getPoolRange(poolId);
      let currentOffset = this.poolCounters.get(poolId) || 0;

      for (let i = 0; i < count; i++) {
        let portFound = false;

        for (let attempts = 0; attempts < 100; attempts++) {
          const port = range.start + currentOffset;

          if (port > range.end) {
            currentOffset = 0;
            continue;
          }

          if (!this.allocatedPorts.has(port)) {
            const isAvailable = await this.isPortAvailable(port);

            if (isAvailable) {
              this.allocatedPorts.add(port);
              ports.push(port);
              currentOffset++;
              portFound = true;
              break;
            }
          }

          currentOffset++;
        }

        if (!portFound) {
          // Release any ports we allocated so far
          for (const p of ports) {
            this.allocatedPorts.delete(p);
          }
          throw new Error(`Unable to allocate ${count} ports in pool ${poolId}`);
        }
      }

      this.poolCounters.set(poolId, currentOffset);
      return ports;
    });
  }

  /**
   * Release a previously allocated port
   * @param port - The port number to release
   */
  public async releasePort(port: number): Promise<void> {
    await this.mutex.runExclusive(async () => {
      this.allocatedPorts.delete(port);
    });
  }

  /**
   * Release multiple ports
   * @param ports - Array of port numbers to release
   */
  public async releasePorts(ports: number[]): Promise<void> {
    await this.mutex.runExclusive(async () => {
      for (const port of ports) {
        this.allocatedPorts.delete(port);
      }
    });
  }

  /**
   * Clear all allocated ports for a specific pool
   * @param poolId - The pool ID to clear
   */
  public async clearPool(poolId: number): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const range = this.getPoolRange(poolId);
      const portsToRemove: number[] = [];

      for (const port of this.allocatedPorts) {
        if (port >= range.start && port <= range.end) {
          portsToRemove.push(port);
        }
      }

      for (const port of portsToRemove) {
        this.allocatedPorts.delete(port);
      }

      this.poolCounters.set(poolId, 0);
    });
  }

  /**
   * Reset the entire allocator state
   */
  public async reset(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      this.allocatedPorts.clear();
      this.poolCounters.clear();
      this.poolRanges.clear();
    });
  }

  /**
   * Get the port range for a given pool
   */
  private getPoolRange(poolId: number): { start: number; end: number } {
    if (!this.poolRanges.has(poolId)) {
      // For shard-based pool IDs (which can be very large), use a different strategy
      // Use the pool ID modulo to map to a reasonable port range
      const basePoolId = poolId % 50000; // Keep within reasonable range
      const start = 10000 + basePoolId;
      const end = start + 99;
      this.poolRanges.set(poolId, { start, end });
    }
    return this.poolRanges.get(poolId)!;
  }

  /**
   * Find the next available port using sequential scanning
   */
  private async findNextAvailablePort(
    poolId: number,
    range: { start: number; end: number }
  ): Promise<number | null> {
    let currentOffset = this.poolCounters.get(poolId) || 0;
    const maxAttempts = range.end - range.start + 1;

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      const port = range.start + currentOffset;

      if (port > range.end) {
        currentOffset = 0;
        continue;
      }

      if (!this.allocatedPorts.has(port)) {
        const isAvailable = await this.isPortAvailable(port);
        if (isAvailable) {
          this.allocatedPorts.add(port);
          this.poolCounters.set(poolId, (currentOffset + 1) % (range.end - range.start + 1));
          return port;
        }
      }

      currentOffset = (currentOffset + 1) % (range.end - range.start + 1);
    }

    return null;
  }

  /**
   * Scan the entire range for an available port
   */
  private async scanRangeForPort(
    range: { start: number; end: number },
    poolId: number
  ): Promise<number | null> {
    // Create array of all ports in range that aren't allocated
    const portsToCheck: number[] = [];
    for (let port = range.start; port <= range.end; port++) {
      if (!this.allocatedPorts.has(port)) {
        portsToCheck.push(port);
      }
    }

    // Shuffle the array to avoid collision patterns
    for (let i = portsToCheck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [portsToCheck[i], portsToCheck[j]] = [portsToCheck[j], portsToCheck[i]];
    }

    // Check ports in batches for efficiency
    const batchSize = 5;
    for (let i = 0; i < portsToCheck.length; i += batchSize) {
      const batch = portsToCheck.slice(i, Math.min(i + batchSize, portsToCheck.length));
      const results = await Promise.all(
        batch.map(async (port) => ({
          port,
          available: await this.isPortAvailable(port),
        }))
      );

      for (const { port, available } of results) {
        if (available && !this.allocatedPorts.has(port)) {
          this.allocatedPorts.add(port);
          // Update counter to start from this position next time
          this.poolCounters.set(poolId, (port - range.start + 1) % (range.end - range.start + 1));
          return port;
        }
      }
    }

    return null;
  }

  /**
   * Try to find a port in an extended range as a fallback
   */
  private async findPortWithExtendedRange(poolId: number): Promise<number | null> {
    const baseRange = this.getPoolRange(poolId);
    const extendedStart = baseRange.end + 1;
    const extendedEnd = baseRange.end + 50; // Extra 50 ports as overflow

    for (let port = extendedStart; port <= extendedEnd; port++) {
      if (!this.allocatedPorts.has(port)) {
        const isAvailable = await this.isPortAvailable(port);
        if (isAvailable) {
          this.allocatedPorts.add(port);
          console.warn(`Pool ${poolId} exhausted primary range, allocated overflow port ${port}`);
          return port;
        }
      }
    }

    return null;
  }

  /**
   * Check if a port is available on the system
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        server.close();
        resolve(false);
      }, 100); // 100ms timeout

      server.once("error", (err: any) => {
        clearTimeout(timeout);
        // EADDRINUSE means port is in use
        // EACCES means we don't have permission (also consider unavailable)
        resolve(false);
      });

      server.once("listening", () => {
        clearTimeout(timeout);
        server.close(() => {
          resolve(true);
        });
      });

      // Try to bind to all interfaces to ensure port is truly available
      server.listen(port, "0.0.0.0");
    });
  }

  /**
   * Advanced port availability check with multiple methods
   */
  private async isPortReallyAvailable(port: number): Promise<boolean> {
    // First, basic check
    const basicCheck = await this.isPortAvailable(port);
    if (!basicCheck) return false;

    // Second, try to connect to the port (should fail if available)
    return new Promise((resolve) => {
      const client = new net.Socket();

      const timeout = setTimeout(() => {
        client.destroy();
        resolve(true); // Timeout means nothing is listening
      }, 50);

      client.once("connect", () => {
        clearTimeout(timeout);
        client.destroy();
        resolve(false); // Connected means something is listening
      });

      client.once("error", () => {
        clearTimeout(timeout);
        client.destroy();
        resolve(true); // Error means port is available
      });

      client.connect(port, "127.0.0.1");
    });
  }

  /**
   * Get statistics about port allocation
   */
  public async getStats(): Promise<{
    totalAllocated: number;
    poolStats: Map<number, { allocated: number; range: { start: number; end: number } }>;
  }> {
    return await this.mutex.runExclusive(async () => {
      const poolStats = new Map<
        number,
        { allocated: number; range: { start: number; end: number } }
      >();

      // Build stats for each pool that has been used
      for (const [poolId] of this.poolCounters) {
        const range = this.getPoolRange(poolId);
        let allocated = 0;

        for (const port of this.allocatedPorts) {
          if (port >= range.start && port <= range.end) {
            allocated++;
          }
        }

        poolStats.set(poolId, { allocated, range });
      }

      return {
        totalAllocated: this.allocatedPorts.size,
        poolStats,
      };
    });
  }
}

/**
 * Convenience function to get a free port using the singleton allocator
 * @param poolId - Optional pool ID (defaults to VITEST_POOL_ID or 1)
 * @param retries - Number of retries with exponential backoff (default: 3)
 */
export async function getAtomicFreePort(poolId?: number, retries = 3): Promise<number> {
  const allocator = PortAllocator.getInstance();
  // Use shard-based pool ID for proper isolation in CI environments
  const shardId = process.env.MOONWALL_SHARD_ID;
  const vitestPoolId = process.env.VITEST_POOL_ID;

  const effectivePoolId = poolId ?? (shardId ? Number(shardId) : Number(vitestPoolId || 1));

  // Log port allocation strategy for debugging in CI
  if (process.env.CI && shardId) {
    console.log(
      `[Shard ${process.env.MOONWALL_SHARD_INDEX}] Using pool ID ${effectivePoolId} for port allocation`
    );
  }

  let lastError: Error | undefined;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await allocator.allocatePort(effectivePoolId);
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries - 1) {
        // Exponential backoff: 50ms, 100ms, 200ms
        const delay = 50 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to allocate port after ${retries} attempts`);
}

/**
 * Convenience function to get multiple free ports
 * @param count - Number of ports to allocate
 * @param poolId - Optional pool ID (defaults to VITEST_POOL_ID or 1)
 * @param retries - Number of retries with exponential backoff (default: 3)
 */
export async function getAtomicFreePorts(
  count: number,
  poolId?: number,
  retries = 3
): Promise<number[]> {
  const allocator = PortAllocator.getInstance();
  // Use shard-based pool ID for proper isolation in CI environments
  const shardId = process.env.MOONWALL_SHARD_ID;
  const vitestPoolId = process.env.VITEST_POOL_ID;

  const effectivePoolId = poolId ?? (shardId ? Number(shardId) : Number(vitestPoolId || 1));

  let lastError: Error | undefined;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await allocator.allocatePorts(effectivePoolId, count);
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries - 1) {
        // Exponential backoff: 50ms, 100ms, 200ms
        const delay = 50 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to allocate ${count} ports after ${retries} attempts`);
}

/**
 * Convenience function to release a port
 * @param port - Port number to release
 */
export async function releasePort(port: number): Promise<void> {
  const allocator = PortAllocator.getInstance();
  return await allocator.releasePort(port);
}

/**
 * Convenience function to release multiple ports
 * @param ports - Array of port numbers to release
 */
export async function releasePorts(ports: number[]): Promise<void> {
  const allocator = PortAllocator.getInstance();
  return await allocator.releasePorts(ports);
}
