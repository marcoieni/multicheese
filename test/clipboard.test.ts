import { describe, expect, test, vi } from "vitest";

import {
  type ClipboardCommandRunner,
  copyImageToClipboard,
  getClipboardCommandSpecs,
} from "../src/clipboard.js";

describe("clipboard helpers", () => {
  test("uses osascript on macOS", () => {
    expect(
      getClipboardCommandSpecs("/tmp/capture.png", {
        platform: "darwin",
        env: {},
      }),
    ).toEqual([
      expect.objectContaining({
        command: "osascript",
        useStdin: false,
      }),
    ]);
  });

  test("prefers wl-copy on Wayland Linux sessions", () => {
    const specs = getClipboardCommandSpecs("/tmp/capture.png", {
      platform: "linux",
      env: {
        WAYLAND_DISPLAY: "wayland-0",
      },
    });

    expect(specs.map((spec) => spec.command)).toEqual(["wl-copy", "xclip"]);
  });

  test("falls back to xclip first outside Wayland", () => {
    const specs = getClipboardCommandSpecs("/tmp/capture.png", {
      platform: "linux",
      env: {
        DISPLAY: ":0",
      },
    });

    expect(specs.map((spec) => spec.command)).toEqual(["xclip", "wl-copy"]);
  });

  test("uses powershell on Windows", () => {
    expect(
      getClipboardCommandSpecs("C:\\temp\\capture.png", {
        platform: "win32",
        env: {},
      }),
    ).toEqual([
      expect.objectContaining({
        command: "powershell",
        useStdin: false,
      }),
    ]);
  });

  test("tries the next Linux clipboard command after a failure", async () => {
    const runCommand = vi
      .fn<ClipboardCommandRunner>()
      .mockRejectedValueOnce(new Error("xclip missing"))
      .mockResolvedValueOnce(undefined);

    await copyImageToClipboard("/tmp/capture.png", {
      platform: "linux",
      env: {},
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand.mock.calls[0]?.[0].command).toBe("xclip");
    expect(runCommand.mock.calls[1]?.[0].command).toBe("wl-copy");
  });

  test("reports a helpful Linux clipboard error when all commands fail", async () => {
    const runCommand = vi
      .fn<ClipboardCommandRunner>()
      .mockRejectedValue(new Error("clipboard unavailable"));

    await expect(
      copyImageToClipboard("/tmp/capture.png", {
        platform: "linux",
        env: {},
        runCommand,
      }),
    ).rejects.toThrow(
      "Failed to copy the screenshot to the clipboard on Linux. Install wl-copy or xclip and ensure a graphical clipboard session is available.",
    );
  });
});
