import { input, select } from "@inquirer/prompts";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PROFILE_METADATA_FILE } from "./constants.js";
import { getAppSupportDirectory } from "./platform.js";

export interface ProfileRecord {
  name: string;
  slug: string;
  directory: string;
}

interface ProfileMetadata {
  name: string;
}

export function profileNameToSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Profile names must contain letters or numbers.");
  }

  return slug;
}

export function getProfilesRoot(
  appSupportDirectory = getAppSupportDirectory(),
): string {
  return path.join(appSupportDirectory, "profiles");
}

export async function listProfiles(
  appSupportDirectory = getAppSupportDirectory(),
): Promise<ProfileRecord[]> {
  const root = getProfilesRoot(appSupportDirectory);
  await mkdir(root, { recursive: true });

  const entries = await readdir(root, { withFileTypes: true });
  const profiles = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const directory = path.join(root, entry.name);
        const metadataPath = path.join(directory, PROFILE_METADATA_FILE);

        const metadata = await readFile(metadataPath, "utf8")
          .then((contents) => JSON.parse(contents) as ProfileMetadata)
          .catch(() => null);

        return {
          name: metadata?.name ?? entry.name,
          slug: entry.name,
          directory,
        } satisfies ProfileRecord;
      }),
  );

  return profiles.sort((left, right) => left.name.localeCompare(right.name));
}

export async function ensureProfile(
  name: string,
  appSupportDirectory = getAppSupportDirectory(),
): Promise<ProfileRecord> {
  const slug = profileNameToSlug(name);
  const directory = path.join(getProfilesRoot(appSupportDirectory), slug);
  const metadataPath = path.join(directory, PROFILE_METADATA_FILE);

  await mkdir(directory, { recursive: true });
  await writeFile(
    metadataPath,
    `${JSON.stringify({ name: name.trim() } satisfies ProfileMetadata, null, 2)}\n`,
    "utf8",
  );

  return {
    name: name.trim(),
    slug,
    directory,
  };
}

export async function getExistingProfileByName(
  name: string,
  appSupportDirectory = getAppSupportDirectory(),
): Promise<ProfileRecord | null> {
  const slug = profileNameToSlug(name);
  const profiles = await listProfiles(appSupportDirectory);
  return profiles.find((profile) => profile.slug === slug) ?? null;
}

export async function resolveProfileForRun(
  name: string | undefined,
  appSupportDirectory = getAppSupportDirectory(),
): Promise<ProfileRecord> {
  if (name) {
    const existing = await getExistingProfileByName(name, appSupportDirectory);
    if (!existing) {
      throw new Error(
        `Profile "${name}" does not exist. Run "multicheese auth open ${profileNameToSlug(
          name,
        )}" first to create and authenticate it.`,
      );
    }

    return existing;
  }

  const profiles = await listProfiles(appSupportDirectory);
  if (profiles.length === 0) {
    throw new Error(
      'No profiles exist yet. Run "multicheese auth open <profile>" first to create and authenticate one.',
    );
  }

  if (profiles.length === 1) {
    return profiles[0]!;
  }

  const selectedSlug = await select({
    message: "Select the authentication profile to use",
    choices: profiles.map((profile) => ({
      name: profile.name,
      value: profile.slug,
    })),
  });

  const selected = profiles.find((profile) => profile.slug === selectedSlug);
  if (!selected) {
    throw new Error("Selected profile was not found.");
  }

  return selected;
}

export async function resolveProfileForAuth(
  name: string | undefined,
  appSupportDirectory = getAppSupportDirectory(),
): Promise<ProfileRecord> {
  if (name) {
    return ensureProfile(name, appSupportDirectory);
  }

  const profiles = await listProfiles(appSupportDirectory);
  const createValue = "__create__";
  const selected = await select({
    message: "Select or create a managed Chrome profile",
    choices: [
      ...profiles.map((profile) => ({
        name: profile.name,
        value: profile.slug,
      })),
      {
        name: "Create a new profile",
        value: createValue,
      },
    ],
  });

  if (selected !== createValue) {
    const existing = profiles.find((profile) => profile.slug === selected);
    if (!existing) {
      throw new Error("Selected profile was not found.");
    }

    return existing;
  }

  const newProfileName = await input({
    message: "New profile name",
    validate: (value) => {
      try {
        profileNameToSlug(value);
        return true;
      } catch (error) {
        return error instanceof Error ? error.message : "Invalid profile name.";
      }
    },
  });

  return ensureProfile(newProfileName, appSupportDirectory);
}
