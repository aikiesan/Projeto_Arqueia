import { Injectable } from '@nestjs/common';

export interface RateLimitStatus {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetTimeMs: number;
}

@Injectable()
export class AuthRateLimiterService {
  private readonly hits = new Map<string, number[]>();

  public constructor(
    private readonly maxAttempts: number = 10,
    private readonly windowSeconds: number = 60,
  ) {}

  public consume(key: string): RateLimitStatus {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const cutoff = now - windowMs;

    const timestamps = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);

    if (timestamps.length >= this.maxAttempts) {
      const oldest = timestamps[0] ?? now;
      const resetTimeMs = oldest + windowMs;
      this.hits.set(key, timestamps);
      return {
        allowed: false,
        remaining: 0,
        resetTimeMs,
      };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);

    return {
      allowed: true,
      remaining: this.maxAttempts - timestamps.length,
      resetTimeMs: now + windowMs,
    };
  }

  public reset(key: string): void {
    this.hits.delete(key);
  }

  public clear(): void {
    this.hits.clear();
  }
}
