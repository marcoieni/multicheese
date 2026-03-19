import { chmod, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getDistDir } from "./dist-path.mjs";

const source = path.join(getDistDir(), "cli.js");
const binDir = path.join(os.homedir(), ".local", "bin");
const destination = path.join(binDir, "multicheese");
const launcher = `#!/bin/sh
exec node "${source}" "$@"
`;

await mkdir(binDir, { recursive: true });
await writeFile(destination, launcher, "utf8");
await chmod(destination, 0o755);

process.stdout.write(`Installed ${destination}\n`);
