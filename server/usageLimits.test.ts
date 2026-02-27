import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Mock schema
vi.mock("../drizzle/schema", () => ({
  appUsers: { id: "id", maxActions: "maxActions", createdAt: "createdAt" },
  userActions: { appUserId: "appUserId", createdAt: "createdAt" },
}));

import { getDb } from "./db";
import { DAILY_LIMIT, FREE_DAYS, checkUsageLimit } from "./usageLimits";

// Helper to build a chainable mock that resolves at the end
function buildChainMock(resolveValue: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "from", "where", "limit"];
  // The last method in a chain resolves the promise
  methods.forEach((m, i) => {
    chain[m] = vi.fn(() => {
      if (i === methods.length - 1) return Promise.resolve(resolveValue);
      return chain;
    });
  });
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usageLimits constants", () => {
  it("DAILY_LIMIT should be 3", () => {
    expect(DAILY_LIMIT).toBe(3);
  });

  it("FREE_DAYS should be 5", () => {
    expect(FREE_DAYS).toBe(5);
  });
});

describe("checkUsageLimit", () => {
  it("returns allowed:true when db is unavailable", async () => {
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await checkUsageLimit(1);
    expect(result.allowed).toBe(true);
  });

  it("returns allowed:true for unlimited user (maxActions=null)", async () => {
    let callCount = 0;
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([{ maxActions: null, createdAt: new Date() }]);
        return Promise.resolve([{ total: 0 }]);
      }),
    };
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

    const result = await checkUsageLimit(1);
    expect(result.allowed).toBe(true);
    expect(result.max).toBeNull();
  });

  it("returns allowed:false with reason=expired when account is older than FREE_DAYS", async () => {
    const oldDate = new Date(Date.now() - (FREE_DAYS + 1) * 24 * 60 * 60 * 1000);
    let callCount = 0;
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { limit: () => Promise.resolve([{ maxActions: 10, createdAt: oldDate }]) };
        // Total count
        return Promise.resolve([{ total: 5 }]);
      }),
      limit: vi.fn().mockResolvedValue([{ maxActions: 10, createdAt: oldDate }]),
    };
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

    const result = await checkUsageLimit(1);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("expired");
    }
  });

  it("returns allowed:false with reason=daily when daily limit reached", async () => {
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    let whereCount = 0;
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        whereCount++;
        if (whereCount === 1) {
          // User query — has limit() chained
          return { limit: () => Promise.resolve([{ maxActions: 10, createdAt: recentDate }]) };
        }
        if (whereCount === 2) {
          // Total count query (no limit)
          return Promise.resolve([{ total: 2 }]);
        }
        // Daily count query (and() condition)
        return Promise.resolve([{ total: DAILY_LIMIT }]);
      }),
    };
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

    const result = await checkUsageLimit(1);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("daily");
    }
  });

  it("returns allowed:true when within daily limit", async () => {
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    let whereCount = 0;
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        whereCount++;
        if (whereCount === 1) {
          return { limit: () => Promise.resolve([{ maxActions: 10, createdAt: recentDate }]) };
        }
        if (whereCount === 2) {
          return Promise.resolve([{ total: 1 }]);
        }
        return Promise.resolve([{ total: 1 }]);
      }),
    };
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

    const result = await checkUsageLimit(1);
    expect(result.allowed).toBe(true);
  });
});
