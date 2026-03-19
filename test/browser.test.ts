import { describe, expect, test } from "vitest";

import { parseWaitMs } from "../src/browser.js";

describe("browser helpers", () => {
  test("parses a valid wait time", () => {
    expect(parseWaitMs("2500")).toBe(2_500);
  });

  test("rejects negative wait times", () => {
    expect(() => parseWaitMs("-1")).toThrow(
      "wait-ms must be a non-negative integer.",
    );
  });
});
