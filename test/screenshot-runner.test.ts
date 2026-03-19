import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { runScreenshotJob } from "../src/screenshot-runner.js";
import { readUrlsFromCsv } from "../src/url-list.js";
import { prepareWorkspace } from "../src/workspace.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
  tempDirectories.length = 0;
});

describe("screenshot runner", () => {
  test("creates the next screenshots directory and records partial failures", async () => {
    const workspaceDirectory = await import("node:fs/promises").then(
      ({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), "multicheese-job-")),
    );
    tempDirectories.push(workspaceDirectory);

    await writeFile(
      path.join(workspaceDirectory, "urls.csv"),
      "url\nhttps://example.com\nhttps://example.com/fail\n",
      "utf8",
    );
    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(path.join(workspaceDirectory, "screenshots000")),
    );

    const preparedWorkspace = await prepareWorkspace(workspaceDirectory);
    const urls = await readUrlsFromCsv(preparedWorkspace.urlsFilePath);
    const capturedPaths: string[] = [];

    const summary = await runScreenshotJob({
      preparedWorkspace,
      urls,
      createSession() {
        return Promise.resolve({
          async capture(task) {
            if (task.url.endsWith("/fail")) {
              throw new Error("Navigation failed");
            }

            capturedPaths.push(task.outputPath);
            await writeFile(task.outputPath, `captured:${task.url}`, "utf8");
          },
          async close() {},
        });
      },
    });

    expect(preparedWorkspace.outputDirectoryName).toBe("screenshots001");
    expect(summary.succeededCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.failures[0]?.url).toBe("https://example.com/fail");
    expect(capturedPaths[0]).toContain(
      path.join(workspaceDirectory, "screenshots001"),
    );
    await expect(readFile(capturedPaths[0]!, "utf8")).resolves.toContain(
      "https://example.com",
    );
  });
});
