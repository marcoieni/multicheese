import { describe, expect, test } from "vitest";

import { buildScreenshotFileName, sanitizeSlug } from "../src/filenames.js";

describe("filenames", () => {
  test("sanitizes weird characters into dashes", () => {
    expect(sanitizeSlug("Docs.Example.com / A path?")).toBe(
      "docs-example-com-a-path",
    );
  });

  test("adds a hash when the URL has a query string", () => {
    const usedNames = new Set<string>();

    const fileName = buildScreenshotFileName(
      "https://example.com/products/widget?tab=details",
      0,
      usedNames,
    );

    expect(fileName).toMatch(
      /^001-example-com-products-widget-[a-f0-9]{8}\.png$/,
    );
  });

  test("adds a collision suffix when the sanitized stem repeats", () => {
    const usedNames = new Set<string>();

    const first = buildScreenshotFileName(
      "https://example.com/path",
      0,
      usedNames,
    );
    const second = buildScreenshotFileName(
      "https://example.com/path/",
      0,
      usedNames,
    );

    expect(first).toBe("001-example-com-path.png");
    expect(second).toBe("001-example-com-path-2.png");
  });
});
