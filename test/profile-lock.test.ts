import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { PROFILE_LOCK_FILE } from "../src/constants.js";
import { acquireProfileLock } from "../src/profile-lock.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.map(async (directory) => {
      await import("node:fs/promises").then(({ rm }) =>
        rm(directory, { recursive: true, force: true }),
      );
    }),
  );
  tempDirectories.length = 0;
});

describe("profile lock", () => {
  test("replaces a stale lock file", async () => {
    const profileDirectory = await mkdtemp(
      path.join(os.tmpdir(), "multicheese-lock-"),
    );
    tempDirectories.push(profileDirectory);

    const lockPath = path.join(profileDirectory, PROFILE_LOCK_FILE);
    await writeFile(lockPath, "999999\n", "utf8");

    const lock = await acquireProfileLock(profileDirectory);
    const contents = await readFile(lockPath, "utf8");

    expect(contents).toBe(`${process.pid}\n`);

    await lock.release();

    await expect(stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("rejects a lock file owned by a running process", async () => {
    const profileDirectory = await mkdtemp(
      path.join(os.tmpdir(), "multicheese-lock-"),
    );
    tempDirectories.push(profileDirectory);

    const lockPath = path.join(profileDirectory, PROFILE_LOCK_FILE);
    await writeFile(lockPath, `${process.pid}\n`, "utf8");

    await expect(acquireProfileLock(profileDirectory)).rejects.toThrow(
      `Profile at "${profileDirectory}" is already in use.`,
    );
  });
});
