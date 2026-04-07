import { mkdir } from "node:fs/promises";
import path from "node:path";

import { buildScreenshotFileName } from "./filenames.js";
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
  completedTasks: ScreenshotTask[];
}

export interface ScreenshotSession {
  capture(task: ScreenshotTask): Promise<void>;
  close(): Promise<void>;
}

export interface RunScreenshotJobOptions {
  outputDirectory: string;
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
      options.outputDirectory,
      buildScreenshotFileName(url, index, usedNames),
    ),
  }));

  const failures: ScreenshotFailure[] = [];
  const completedTasks: ScreenshotTask[] = [];
  let succeededCount = 0;
  process.stdout.write(
    `📂 Creating output directory ${options.outputDirectory}\n`,
  );
  await mkdir(options.outputDirectory, { recursive: false });
  process.stdout.write(
    `🌐 Starting browser session for ${tasks.length} URL(s)\n`,
  );
  const session = await options.createSession();

  try {
    for (const task of tasks) {
      const displayIndex = task.index + 1;
      process.stdout.write(
        `📸 [${displayIndex}/${tasks.length}] Capturing ${task.url}\n`,
      );
      try {
        await session.capture(task);
        succeededCount += 1;
        completedTasks.push(task);
        process.stdout.write(
          `✅ [${displayIndex}/${tasks.length}] Saved ${path.basename(task.outputPath)}\n`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({
          url: task.url,
          message,
        });
        process.stdout.write(
          `❌ [${displayIndex}/${tasks.length}] Failed ${task.url}: ${message}\n`,
        );
      }
    }
  } finally {
    process.stdout.write("🧹 Closing browser session\n");
    await session.close();
  }

  return {
    outputDirectory: options.outputDirectory,
    succeededCount,
    failedCount: failures.length,
    failures,
    completedTasks,
  };
}
