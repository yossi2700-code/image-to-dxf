import { describe, it, expect } from "vitest";
import { anonymizeIp } from "./usageDb";

describe("anonymizeIp", () => {
  it("should anonymize IPv4 by replacing last octet with x", () => {
    expect(anonymizeIp("192.168.1.100")).toBe("192.168.1.x");
    expect(anonymizeIp("1.2.3.4")).toBe("1.2.3.x");
    expect(anonymizeIp("10.0.0.255")).toBe("10.0.0.x");
  });

  it("should anonymize IPv6 by keeping first 3 groups", () => {
    const result = anonymizeIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    expect(result).toBe("2001:0db8:85a3:x");
  });

  it("should return null for undefined input", () => {
    expect(anonymizeIp(undefined)).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(anonymizeIp("")).toBeNull();
  });

  it("should handle localhost IPv4", () => {
    expect(anonymizeIp("127.0.0.1")).toBe("127.0.0.x");
  });
});
