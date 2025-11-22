export class MultipartUploadQueue {
  private readonly maxConcurrent: number;
  private activeUploads = 0;
  private readonly queue: Array<() => Promise<void>> = [];
  private completedCount = 0;
  private failedCount = 0;
  private cancelled = false;
  private readonly activePromises = new Set<Promise<void>>();

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(uploadFn: () => Promise<T>): Promise<T> {
    if (this.cancelled) {
      throw new Error('Upload queue has been cancelled');
    }

    return new Promise((resolve, reject) => {
      const task = async () => {
        if (this.cancelled) {
          this.failedCount++;
          reject(new Error('Upload cancelled'));

          return;
        }

        const executeUpload = async () => {
          try {
            const result = await uploadFn();

            if (this.cancelled) {
              throw new Error('Upload cancelled');
            }

            this.completedCount++;
            resolve(result);
          } catch (error) {
            this.failedCount++;
            reject(error);
          } finally {
            this.activeUploads--;
            this.processQueue();
          }
        };

        const uploadPromise = executeUpload();

        this.activePromises.add(uploadPromise);

        uploadPromise.finally(() => {
          this.activePromises.delete(uploadPromise);
        });
      };

      this.queue.push(task);
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.cancelled) {
      return;
    }

    while (this.activeUploads < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();

      if (task) {
        this.activeUploads++;
        console.log(
          `[upload-queue] starting upload (active: ${this.activeUploads}/${this.maxConcurrent}, ` +
            `queued: ${this.queue.length})`,
        );
        task();
      }
    }
  }

  cancel(): void {
    if (this.cancelled) {
      return;
    }

    console.log(
      `[upload-queue] cancelling (active: ${this.activeUploads}, queued: ${this.queue.length}, ` +
        `completed: ${this.completedCount})`,
    );

    this.cancelled = true;
    const queuedCount = this.queue.length;

    this.queue.length = 0;
    this.failedCount += queuedCount;

    console.log(`[upload-queue] cancelled ${queuedCount} queued uploads`);
  }

  async waitForActiveUploads(): Promise<void> {
    if (this.activePromises.size === 0) {
      console.log('[upload-queue] no active uploads to wait for');

      return;
    }

    console.log(`[upload-queue] waiting for ${this.activePromises.size} active uploads to complete`);

    await Promise.allSettled(Array.from(this.activePromises));

    console.log('[upload-queue] all active uploads completed');
  }

  async waitForAll(): Promise<void> {
    if (this.cancelled) {
      console.log('[upload-queue] queue cancelled, not waiting');

      return;
    }

    while (this.activeUploads > 0 || this.queue.length > 0) {
      if (this.cancelled) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  getStats(): {
    active: number;
    queued: number;
    completed: number;
    failed: number;
    total: number;
    cancelled: boolean;
  } {
    return {
      active: this.activeUploads,
      queued: this.queue.length,
      completed: this.completedCount,
      failed: this.failedCount,
      total: this.completedCount + this.failedCount,
      cancelled: this.cancelled,
    };
  }

  isIdle(): boolean {
    return this.activeUploads === 0 && this.queue.length === 0;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }
}
