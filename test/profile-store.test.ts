import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  ensureProfile,
  getExistingProfileByName,
  getProfilesRoot,
  listProfiles,
  profileNameToSlug,
} from "../src/profile-store.js";

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

describe("profile store", () => {
  test("slugifies a profile name", () => {
    expect(profileNameToSlug("Work Profile")).toBe("work-profile");
  });

  test("creates and lists profiles from the app support directory", async () => {
    const appSupportDirectory = await mkdtemp(
      path.join(os.tmpdir(), "multicheese-profiles-"),
    );
    tempDirectories.push(appSupportDirectory);

    await ensureProfile("Work", appSupportDirectory);
    await ensureProfile("Personal", appSupportDirectory);

    const profiles = await listProfiles(appSupportDirectory);

    expect(getProfilesRoot(appSupportDirectory)).toContain("profiles");
    expect(profiles.map((profile) => profile.name)).toEqual([
      "Personal",
      "Work",
    ]);
    expect(profiles.map((profile) => profile.slug)).toEqual([
      "personal",
      "work",
    ]);
  });

  test("finds an existing profile by name", async () => {
    const appSupportDirectory = await mkdtemp(
      path.join(os.tmpdir(), "multicheese-profile-"),
    );
    tempDirectories.push(appSupportDirectory);

    await ensureProfile("Screenshots", appSupportDirectory);

    const profile = await getExistingProfileByName(
      "Screenshots",
      appSupportDirectory,
    );

    expect(profile?.slug).toBe("screenshots");
    expect(profile?.directory).toBe(
      path.join(appSupportDirectory, "profiles", "screenshots"),
    );
  });
});
