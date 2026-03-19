import { describe, expect, test } from "vitest";

import { getAppSupportDirectory } from "../src/platform.js";

describe("platform paths", () => {
  test("uses the macOS application support directory", () => {
    expect(
      getAppSupportDirectory({
        homeDir: "/Users/marco",
        platform: "darwin",
        env: {},
      }),
    ).toBe("/Users/marco/Library/Application Support/multicheese");
  });

  test("uses the Linux XDG data directory when present", () => {
    expect(
      getAppSupportDirectory({
        homeDir: "/home/marco",
        platform: "linux",
        env: {
          XDG_DATA_HOME: "/var/lib/marco/data",
        },
      }),
    ).toBe("/var/lib/marco/data/multicheese");
  });

  test("falls back to the default Linux data directory", () => {
    expect(
      getAppSupportDirectory({
        homeDir: "/home/marco",
        platform: "linux",
        env: {},
      }),
    ).toBe("/home/marco/.local/share/multicheese");
  });

  test("uses the Windows roaming app data directory", () => {
    expect(
      getAppSupportDirectory({
        homeDir: "C:\\Users\\marco",
        platform: "win32",
        env: {
          APPDATA: "C:\\Users\\marco\\AppData\\Roaming",
        },
      }),
    ).toBe("C:\\Users\\marco\\AppData\\Roaming\\multicheese");
  });

  test("rejects unsupported platforms", () => {
    expect(() =>
      getAppSupportDirectory({
        homeDir: "/home/marco",
        platform: "freebsd",
        env: {},
      }),
    ).toThrow(
      "multicheese supports macOS, Linux, and Windows. Unsupported platform: freebsd.",
    );
  });
});
