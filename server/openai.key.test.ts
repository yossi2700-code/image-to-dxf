import { describe, it, expect } from "vitest";

describe("OpenAI API Key", () => {
  it("should be able to reach OpenAI models endpoint", async () => {
    const apiKey = "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";
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { data: Array<{ id: string }> };
    const ids = data.data.map((m) => m.id);
    expect(ids).toContain("gpt-image-2");
    expect(ids).toContain("gpt-image-1");
  });
});
