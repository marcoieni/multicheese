import { mkdir } from "node:fs/promises";
import path from "node:path";

import { buildScreenshotFileName } from "./filenames.js";
import type { PreparedWorkspace } from "./workspace.js";

export interface ScreenshotTask {
  index: number;
  url: string;
  outputPath: string;
}

export interface ScreenshotFailure {
  url: string;
  message: string;
}

export interface ScreenshotSummary {
  outputDirectory: string;
  succeededCount: number;
  failedCount: number;
  failures: ScreenshotFailure[];
}

export interface ScreenshotSession {
  capture(task: ScreenshotTask): Promise<void>;
  close(): Promise<void>;
}

export interface RunScreenshotJobOptions {
  preparedWorkspace: PreparedWorkspace;
  urls: string[];
  createSession(): Promise<ScreenshotSession>;
}

export async function runScreenshotJob(
  options: RunScreenshotJobOptions,
): Promise<ScreenshotSummary> {
  const usedNames = new Set<string>();
  const tasks = options.urls.map((url, index) => ({
    index,
    url,
    outputPath: path.join(
      options.preparedWorkspace.outputDirectory,
      buildScreenshotFileName(url, index, usedNames),
    ),
  }));

  const failures: ScreenshotFailure[] = [];
  let succeededCount = 0;
  await mkdir(options.preparedWorkspace.outputDirectory, { recursive: false });
  const session = await options.createSession();

  try {
    for (const task of tasks) {
      try {
        await session.capture(task);
        succeededCount += 1;
      } catch (error) {
        failures.push({
          url: task.url,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    await session.close();
  }

  return {
    outputDirectory: options.preparedWorkspace.outputDirectory,
    succeededCount,
    failedCount: failures.length,
    failures,
  };
}
