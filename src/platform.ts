import os from "node:os";
import path from "node:path";

import { APP_NAME } from "./constants.js";

export function assertSupportedPlatform(): void {
  if (process.platform !== "darwin") {
    throw new Error("multicheese v1 only supports macOS.");
  }
}

export function getAppSupportDirectory(homeDir = os.homedir()): string {
  return path.join(homeDir, "Library", "Application Support", APP_NAME);
}
