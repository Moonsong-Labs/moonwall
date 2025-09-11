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
      let currentOffset = this.poolCounters.get(poolId) || 0;

      // Try to find an available port within the pool's range
      for (let attempts = 0; attempts < 100; attempts++) {
        const port = range.start + currentOffset;

        if (port > range.end) {
          // Wrap around to the beginning of the range
          currentOffset = 0;
          continue;
        }

        // Check if port is already allocated in our tracking
        if (!this.allocatedPorts.has(port)) {
          // Verify the port is actually available on the system
          const isAvailable = await this.isPortAvailable(port);

          if (isAvailable) {
            this.allocatedPorts.add(port);
            this.poolCounters.set(poolId, currentOffset + 1);
            return port;
          }
        }

        currentOffset++;
      }

      throw new Error(
        `Unable to find available port in pool ${poolId} range ${range.start}-${range.end}`
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
      const start = 10000 + poolId * 100;
      const end = start + 99;
      this.poolRanges.set(poolId, { start, end });
    }
    return this.poolRanges.get(poolId)!;
  }

  /**
   * Check if a port is available on the system
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once("error", () => {
        resolve(false);
      });

      server.once("listening", () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.listen(port, "127.0.0.1");
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
 */
export async function getAtomicFreePort(poolId?: number): Promise<number> {
  const allocator = PortAllocator.getInstance();
  const effectivePoolId = poolId ?? Number(process.env.VITEST_POOL_ID || 1);
  return await allocator.allocatePort(effectivePoolId);
}

/**
 * Convenience function to get multiple free ports
 * @param count - Number of ports to allocate
 * @param poolId - Optional pool ID (defaults to VITEST_POOL_ID or 1)
 */
export async function getAtomicFreePorts(count: number, poolId?: number): Promise<number[]> {
  const allocator = PortAllocator.getInstance();
  const effectivePoolId = poolId ?? Number(process.env.VITEST_POOL_ID || 1);
  return await allocator.allocatePorts(effectivePoolId, count);
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
