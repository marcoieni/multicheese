import { chmod, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { getDistDir } from "./dist-path.mjs";

const source = path.join(getDistDir(), "cli.js");
const isWindows = process.platform === "win32";
const binDir = isWindows
  ? path.join(
      process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
      "multicheese",
      "bin",
    )
  : path.join(os.homedir(), ".local", "bin");
const destination = path.join(
  binDir,
  isWindows ? "multicheese.cmd" : "multicheese",
);
const launcher = isWindows
  ? `@echo off
node "${source}" %*
`
  : `#!/bin/sh
exec node "${source}" "$@"
`;

await mkdir(binDir, { recursive: true });
await writeFile(destination, launcher, "utf8");
if (!isWindows) {
  await chmod(destination, 0o755);
}

process.stdout.write(`Installed ${destination}\n`);
