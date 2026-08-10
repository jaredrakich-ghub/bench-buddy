import { describe, it, expect, afterEach, vi } from "vitest";
import { generateId } from "./id.js";

describe("generateId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a non-empty string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("generates unique values across many calls", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
  });

  it("uses crypto.randomUUID when available, producing a valid UUID v4", () => {
    // Node/Vitest's environment has crypto.randomUUID globally, same as a
    // modern browser, so this exercises the real (non-fallback) path.
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("falls back to a unique string when crypto.randomUUID isn't available", () => {
    const original = crypto.randomUUID;
    // @ts-ignore - simulating an environment without randomUUID
    crypto.randomUUID = undefined;
    try {
      const id = generateId();
      expect(typeof id).toBe("string");
      expect(id.startsWith("id-")).toBe(true);
    } finally {
      crypto.randomUUID = original;
    }
  });
});
