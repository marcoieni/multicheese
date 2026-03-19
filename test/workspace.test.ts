import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  getNextScreenshotDirectoryName,
  prepareWorkspace,
} from "../src/workspace.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
  tempDirectories.length = 0;
});

describe("workspace validation", () => {
  test("computes the next screenshot directory name", () => {
    expect(
      getNextScreenshotDirectoryName([
        "screenshots000",
        "screenshots003",
        "screenshots001",
      ]),
    ).toBe("screenshots004");
  });

  test("accepts urls.csv, screenshotsNNN directories, and dotfiles", async () => {
    const workspaceDirectory = await mkdtemp(
      path.join(os.tmpdir(), "multicheese-workspace-"),
    );
    tempDirectories.push(workspaceDirectory);

    await writeFile(
      path.join(workspaceDirectory, "urls.csv"),
      "https://example.com\n",
      "utf8",
    );
    await writeFile(path.join(workspaceDirectory, ".DS_Store"), "", "utf8");
    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(path.join(workspaceDirectory, "screenshots000")),
    );

    const preparedWorkspace = await prepareWorkspace(workspaceDirectory);

    expect(preparedWorkspace.outputDirectoryName).toBe("screenshots001");
    expect(preparedWorkspace.urlsFilePath).toBe(
      path.join(workspaceDirectory, "urls.csv"),
    );
  });

  test("rejects unexpected files", async () => {
    const workspaceDirectory = await mkdtemp(
      path.join(os.tmpdir(), "multicheese-invalid-"),
    );
    tempDirectories.push(workspaceDirectory);

    await writeFile(
      path.join(workspaceDirectory, "urls.csv"),
      "https://example.com\n",
      "utf8",
    );
    await writeFile(
      path.join(workspaceDirectory, "notes.txt"),
      "nope\n",
      "utf8",
    );

    await expect(prepareWorkspace(workspaceDirectory)).rejects.toThrow(
      'Unexpected entry: "notes.txt".',
    );
  });
});
