import { createHash } from "node:crypto";

export function sanitizeSlug(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "page";
}

function shortenSlug(slug: string, maxLength = 80): string {
  return slug.length <= maxLength
    ? slug
    : slug.slice(0, maxLength).replace(/-+$/g, "");
}

export function buildScreenshotFileName(
  urlString: string,
  index: number,
  usedNames: Set<string>,
): string {
  const url = new URL(urlString);
  const baseParts = [url.hostname, url.pathname].filter(
    (part) => part && part !== "/",
  );
  const slug = shortenSlug(sanitizeSlug(baseParts.join("-")));
  const hash = createHash("sha1").update(urlString).digest("hex").slice(0, 8);
  const prefix = String(index + 1).padStart(3, "0");
  const needsHash = Boolean(url.search || url.hash);

  let stem = `${prefix}-${slug}`;
  if (needsHash) {
    stem = `${stem}-${hash}`;
  }

  let candidate = `${stem}.png`;
  let collisionCounter = 1;

  while (usedNames.has(candidate)) {
    collisionCounter += 1;
    candidate = `${stem}-${collisionCounter}.png`;
  }

  usedNames.add(candidate);
  return candidate;
}
