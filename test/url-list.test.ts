import { describe, expect, test } from "vitest";

import { parseUrlsCsvContent } from "../src/url-list.js";

describe("url list parsing", () => {
  test("parses headerless csv files", () => {
    const urls = parseUrlsCsvContent(
      "https://example.com\nhttps://example.com/docs\n",
    );

    expect(urls).toEqual(["https://example.com", "https://example.com/docs"]);
  });

  test("parses a csv file with a url header", () => {
    const urls = parseUrlsCsvContent("url\nhttps://example.com\n");

    expect(urls).toEqual(["https://example.com"]);
  });

  test("rejects rows with multiple columns", () => {
    expect(() =>
      parseUrlsCsvContent("url\nhttps://example.com,extra\n"),
    ).toThrow("urls.csv row 2 must contain exactly one column.");
  });

  test("rejects invalid urls", () => {
    expect(() => parseUrlsCsvContent("url\nnot-a-url\n")).toThrow(
      'Invalid URL in urls.csv: "not-a-url".',
    );
  });
});
