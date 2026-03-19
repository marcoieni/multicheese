import os from "node:os";
import path from "node:path";
import process from "node:process";

import { APP_NAME } from "./constants.js";

interface AppSupportDirectoryOptions {
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}

function getEnvPath(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getAppSupportDirectory(
  options: AppSupportDirectoryOptions = {},
): string {
  const {
    homeDir = os.homedir(),
    env = process.env,
    platform = process.platform,
  } = options;

  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", APP_NAME);
  }

  if (platform === "linux") {
    return path.join(
      getEnvPath(env.XDG_DATA_HOME) ?? path.join(homeDir, ".local", "share"),
      APP_NAME,
    );
  }

  if (platform === "win32") {
    return path.win32.join(
      getEnvPath(env.APPDATA) ?? path.win32.join(homeDir, "AppData", "Roaming"),
      APP_NAME,
    );
  }

  throw new Error(
    `multicheese supports macOS, Linux, and Windows. Unsupported platform: ${platform}.`,
  );
}
