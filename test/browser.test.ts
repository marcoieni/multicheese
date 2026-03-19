import { describe, expect, test } from "vitest";

import { getDefaultWaitMs, parseWaitMs } from "../src/browser.js";

describe("browser helpers", () => {
  test("returns the default wait time", () => {
    expect(getDefaultWaitMs()).toBe(1_000);
  });

  test("parses a valid wait time", () => {
    expect(parseWaitMs("2500")).toBe(2_500);
  });

  test("rejects negative wait times", () => {
    expect(() => parseWaitMs("-1")).toThrow(
      "wait-ms must be a non-negative integer.",
    );
  });
});
