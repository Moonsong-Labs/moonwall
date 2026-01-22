interface ShardInfo {
  readonly current: number;
  readonly total: number;
  readonly isSharded: boolean;
}

export class ShardManager {
  private static instance: ShardManager | null = null;
  private _shardInfo: ShardInfo | null = null;

  private constructor() {}

  static getInstance(): ShardManager {
    if (!ShardManager.instance) {
      ShardManager.instance = new ShardManager();
    }
    return ShardManager.instance;
  }

  /**
   * Initialize shard configuration from command line argument or environment
   * @param shardArg Optional shard argument from CLI (format: "current/total")
   */
  initializeSharding(shardArg?: string): void {
    if (shardArg) {
      this._shardInfo = this.parseShardString(shardArg);
      process.env.MOONWALL_TEST_SHARD = shardArg;
    } else if (process.env.MOONWALL_TEST_SHARD) {
      this._shardInfo = this.parseShardString(process.env.MOONWALL_TEST_SHARD);
    } else {
      // Default: no sharding
      this._shardInfo = { current: 1, total: 1, isSharded: false };
    }
  }

  /**
   * Get current shard information
   */
  getShardInfo(): ShardInfo {
    if (!this._shardInfo) {
      this.initializeSharding();
    }
    return this._shardInfo as ShardInfo;
  }

  /**
   * Get shard index (0-based) for port calculations
   */
  getShardIndex(): number {
    return this.getShardInfo().current - 1;
  }

  /**
   * Get total number of shards
   */
  getTotalShards(): number {
    return this.getShardInfo().total;
  }

  /**
   * Check if sharding is enabled
   */
  isSharded(): boolean {
    return this.getShardInfo().isSharded;
  }

  /**
   * Reset shard configuration (mainly for testing)
   */
  reset(): void {
    this._shardInfo = null;
    delete process.env.MOONWALL_TEST_SHARD;
  }

  private parseShardString(shardString: string): ShardInfo {
    if (!shardString.includes("/")) {
      throw new Error(
        `Invalid shard format: "${shardString}". Expected format: "current/total" (e.g., "1/3")`
      );
    }

    const [currentStr, totalStr] = shardString.split("/");
    const current = parseInt(currentStr, 10);
    const total = parseInt(totalStr, 10);

    if (Number.isNaN(current) || Number.isNaN(total) || current < 1 || total < 1) {
      throw new Error(
        `Invalid shard numbers in "${shardString}". Both current and total must be positive integers.`
      );
    }

    if (current > total) {
      throw new Error(
        `Invalid shard configuration: current shard ${current} cannot be greater than total ${total}`
      );
    }

    const isSharded = total > 1;

    return { current, total, isSharded };
  }
}

// Export singleton instance for convenience
export const shardManager = ShardManager.getInstance();
