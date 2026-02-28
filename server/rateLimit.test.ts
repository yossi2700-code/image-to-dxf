/**
 * Tests for admin login rate limiting logic.
 * Mirrors the in-memory rate limit implementation in routers.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Replicate the rate limiting logic from routers.ts ─────────────────────────

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface RateLimitEntry {
  attempts: number;
  blockedUntil: number | null;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();

  check(ip: string): { blocked: boolean; minutesLeft?: number } {
    const now = Date.now();
    const entry = this.store.get(ip);
    if (entry?.blockedUntil && now < entry.blockedUntil) {
      const minutesLeft = Math.ceil((entry.blockedUntil - now) / 60000);
      return { blocked: true, minutesLeft };
    }
    return { blocked: false };
  }

  recordFailure(ip: string): { nowBlocked: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.store.get(ip) ?? { attempts: 0, blockedUntil: null };
    if (entry.blockedUntil && now >= entry.blockedUntil) {
      entry.attempts = 0;
      entry.blockedUntil = null;
    }
    entry.attempts += 1;
    if (entry.attempts >= MAX_ATTEMPTS) {
      entry.blockedUntil = now + BLOCK_DURATION_MS;
    }
    this.store.set(ip, entry);
    const remaining = Math.max(0, MAX_ATTEMPTS - entry.attempts);
    return { nowBlocked: entry.blockedUntil !== null, remaining };
  }

  clear(ip: string): void {
    this.store.delete(ip);
  }

  getEntry(ip: string): RateLimitEntry | undefined {
    return this.store.get(ip);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RateLimiter", () => {
  let limiter: RateLimiter;
  const IP = "192.168.1.1";

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it("allows the first attempt", () => {
    expect(limiter.check(IP).blocked).toBe(false);
  });

  it("does not block after fewer than MAX_ATTEMPTS failures", () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      limiter.recordFailure(IP);
    }
    expect(limiter.check(IP).blocked).toBe(false);
  });

  it("blocks after exactly MAX_ATTEMPTS failures", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      limiter.recordFailure(IP);
    }
    expect(limiter.check(IP).blocked).toBe(true);
  });

  it("reports remaining attempts correctly", () => {
    limiter.recordFailure(IP); // 1 failure
    const entry = limiter.getEntry(IP);
    expect(entry?.attempts).toBe(1);
    // remaining = MAX_ATTEMPTS - attempts = 4
    const { remaining } = limiter.recordFailure(IP); // 2nd failure
    expect(remaining).toBe(MAX_ATTEMPTS - 2);
  });

  it("clears rate limit on successful login", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      limiter.recordFailure(IP);
    }
    expect(limiter.check(IP).blocked).toBe(true);
    limiter.clear(IP);
    expect(limiter.check(IP).blocked).toBe(false);
  });

  it("different IPs are tracked independently", () => {
    const IP2 = "10.0.0.1";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      limiter.recordFailure(IP);
    }
    expect(limiter.check(IP).blocked).toBe(true);
    expect(limiter.check(IP2).blocked).toBe(false);
  });

  it("reports minutesLeft when blocked", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      limiter.recordFailure(IP);
    }
    const result = limiter.check(IP);
    expect(result.blocked).toBe(true);
    expect(result.minutesLeft).toBeGreaterThan(0);
    expect(result.minutesLeft).toBeLessThanOrEqual(15);
  });

  it("nowBlocked is true only at the MAX_ATTEMPTS threshold", () => {
    let result = { nowBlocked: false, remaining: 0 };
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      result = limiter.recordFailure(IP);
      expect(result.nowBlocked).toBe(false);
    }
    result = limiter.recordFailure(IP); // 5th failure
    expect(result.nowBlocked).toBe(true);
  });

  it("resets counter after block expires (simulated)", () => {
    // Manually set an expired block
    limiter["store"].set(IP, {
      attempts: MAX_ATTEMPTS,
      blockedUntil: Date.now() - 1000, // already expired
    });
    // check() should not block (expired)
    expect(limiter.check(IP).blocked).toBe(false);
    // recordFailure should reset and start fresh
    const { nowBlocked } = limiter.recordFailure(IP);
    expect(nowBlocked).toBe(false);
    expect(limiter.getEntry(IP)?.attempts).toBe(1);
  });
});
