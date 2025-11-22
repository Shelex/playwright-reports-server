interface BufferPoolOptions {
  bufferSize: number;
  maxPoolSize?: number;
}

export class BufferPool {
  private pool: Buffer[] = [];
  private readonly maxPoolSize: number;
  private readonly bufferSize: number;
  private allocatedCount = 0;

  constructor(options: BufferPoolOptions) {
    this.bufferSize = options.bufferSize;
    this.maxPoolSize = options.maxPoolSize ?? 10;
  }

  acquire(): Buffer {
    const buffer = this.pool.pop();

    if (buffer) {
      console.log(`[buffer-pool] reused buffer (pool size: ${this.pool.length})`);

      return buffer;
    }

    this.allocatedCount++;
    console.log(`[buffer-pool] allocated new buffer (total allocated: ${this.allocatedCount})`);

    return Buffer.allocUnsafe(this.bufferSize);
  }

  release(buffer: Buffer): void {
    buffer.fill(0);
    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(buffer);
      console.log(`[buffer-pool] released buffer (pool size: ${this.pool.length})`);
    }
  }

  getStats(): { allocated: number; poolSize: number } {
    return {
      allocated: this.allocatedCount,
      poolSize: this.pool.length,
    };
  }

  clear(): void {
    for (const buffer of this.pool) {
      buffer.fill(0);
    }
    this.pool = [];
    console.log('[buffer-pool] cleared all buffers');
  }
}
