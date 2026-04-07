import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import {
  SCREENSHOTS_PATTERN,
  SCREENSHOTS_PREFIX,
  URLS_FILE_NAME,
} from "./constants.js";

export interface PreparedWorkspace {
  workspaceDirectory: string;
  urlsFilePath: string;
  outputDirectory: string;
  outputDirectoryName: string;
}

export interface PreparedOutputDirectory {
  workspaceDirectory: string;
  outputDirectory: string;
  outputDirectoryName: string;
}

export function getNextScreenshotDirectoryName(
  existingNames: string[],
): string {
  const usedNumbers = existingNames
    .filter((name) => SCREENSHOTS_PATTERN.test(name))
    .map((name) => Number.parseInt(name.slice(SCREENSHOTS_PREFIX.length), 10));

  const nextNumber =
    usedNumbers.length === 0 ? 0 : Math.max(...usedNumbers) + 1;
  return `${SCREENSHOTS_PREFIX}${String(nextNumber).padStart(3, "0")}`;
}

export async function prepareWorkspace(
  workspaceDirectory: string,
): Promise<PreparedWorkspace> {
  const entries = await readdir(workspaceDirectory, { withFileTypes: true });

  let urlsFileSeen = false;
  const screenshotDirectories: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    if (entry.isFile() && entry.name === URLS_FILE_NAME) {
      urlsFileSeen = true;
      continue;
    }

    if (entry.isDirectory() && SCREENSHOTS_PATTERN.test(entry.name)) {
      screenshotDirectories.push(entry.name);
      continue;
    }

    throw new Error(
      `Workspace "${workspaceDirectory}" may only contain "${URLS_FILE_NAME}" and directories named "${SCREENSHOTS_PREFIX}NNN". Unexpected entry: "${entry.name}".`,
    );
  }

  if (!urlsFileSeen) {
    throw new Error(
      `Workspace "${workspaceDirectory}" is missing "${URLS_FILE_NAME}".`,
    );
  }

  const preparedOutputDirectory = buildPreparedOutputDirectory(
    workspaceDirectory,
    screenshotDirectories,
  );

  return {
    ...preparedOutputDirectory,
    urlsFilePath: path.join(workspaceDirectory, URLS_FILE_NAME),
  };
}

export async function prepareOutputDirectory(
  workspaceDirectory: string,
): Promise<PreparedOutputDirectory> {
  const entries = await readdir(workspaceDirectory, { withFileTypes: true });
  const screenshotDirectories = entries
    .filter(
      (entry) => entry.isDirectory() && SCREENSHOTS_PATTERN.test(entry.name),
    )
    .map((entry) => entry.name);

  return buildPreparedOutputDirectory(
    workspaceDirectory,
    screenshotDirectories,
  );
}

function buildPreparedOutputDirectory(
  workspaceDirectory: string,
  screenshotDirectories: string[],
): PreparedOutputDirectory {
  const outputDirectoryName = getNextScreenshotDirectoryName(
    screenshotDirectories,
  );
  const outputDirectory = path.join(workspaceDirectory, outputDirectoryName);

  return {
    workspaceDirectory,
    outputDirectory,
    outputDirectoryName,
  };
}

export async function createOutputDirectory(
  preparedWorkspace: PreparedWorkspace,
): Promise<void> {
  await mkdir(preparedWorkspace.outputDirectory, { recursive: false });
}
