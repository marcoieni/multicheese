import { readFile } from "node:fs/promises";

import { parse } from "csv-parse/sync";

export function parseUrlsCsvContent(content: string): string[] {
  const rows: string[][] = parse(content, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
  });

  if (rows.length === 0) {
    throw new Error("urls.csv is empty.");
  }

  for (const [index, row] of rows.entries()) {
    if (row.length !== 1) {
      throw new Error(
        `urls.csv row ${index + 1} must contain exactly one column.`,
      );
    }
  }

  const firstRow = rows[0];
  if (!firstRow) {
    throw new Error("urls.csv is empty.");
  }

  const firstValue = firstRow[0]?.trim().toLowerCase() ?? "";
  const dataRows = firstValue === "url" ? rows.slice(1) : rows;
  const urls = dataRows.map((row) => row[0]?.trim() ?? "").filter(Boolean);

  if (urls.length === 0) {
    throw new Error("urls.csv does not contain any URLs.");
  }

  for (const url of urls) {
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL in urls.csv: "${url}".`);
    }
  }

  return urls;
}

export async function readUrlsFromCsv(csvPath: string): Promise<string[]> {
  const content = await readFile(csvPath, "utf8");
  return parseUrlsCsvContent(content);
}
