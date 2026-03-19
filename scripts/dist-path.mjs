import path from "node:path";
import process from "node:process";

export function getDistDir(repoRoot = process.cwd()) {
  return path.join(repoRoot, "dist");
}
