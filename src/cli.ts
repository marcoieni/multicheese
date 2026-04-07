#!/usr/bin/env node

import { Command } from "commander";
import path from "node:path";
import process from "node:process";

import {
  createPlaywrightScreenshotSession,
  getDefaultWaitMs,
  openAuthenticationBrowser,
  parseWaitMs,
} from "./browser.js";
import { copyImageToClipboard } from "./clipboard.js";
import { acquireProfileLock } from "./profile-lock.js";
import {
  listProfiles,
  resolveProfileForAuth,
  resolveProfileForRun,
} from "./profile-store.js";
import { runScreenshotJob } from "./screenshot-runner.js";
import { readUrlsFromCsv } from "./url-list.js";
import { prepareOutputDirectory, prepareWorkspace } from "./workspace.js";

const program = new Command();

program
  .name("multicheese")
  .description("Capture authenticated full-page screenshots for many URLs.")
  .showHelpAfterError();

const authCommand = program
  .command("auth")
  .description("Manage authentication profiles.");

authCommand
  .command("list")
  .description("List available managed Chrome profiles.")
  .action(
    wrapAction(async () => {
      const profiles = await listProfiles();

      if (profiles.length === 0) {
        process.stdout.write("No profiles configured yet.\n");
        return;
      }

      for (const profile of profiles) {
        process.stdout.write(`${profile.name}\t${profile.slug}\n`);
      }
    }),
  );

authCommand
  .command("open")
  .argument("[profile]", "Managed profile name, for example work")
  .description("Open a managed Chrome profile so you can log in manually.")
  .action(
    wrapAction(async (profileName: string | undefined) => {
      const profile = await resolveProfileForAuth(profileName);
      const lock = await acquireProfileLock(profile.directory);

      try {
        await openAuthenticationBrowser(profile);
      } finally {
        await lock.release();
      }
    }),
  );

program
  .command("run")
  .argument(
    "[url]",
    "Capture a single URL and copy the resulting screenshot to the clipboard",
  )
  .description(
    "Capture full-page screenshots from urls.csv, or capture one URL passed directly.",
  )
  .option("--profile <name>", "Managed profile name to use")
  .option(
    "--workspace <dir>",
    "Output folder for screenshotsNNN, and the job folder when reading urls.csv",
    process.cwd(),
  )
  .option(
    "--wait-ms <ms>",
    "Additional settle time after each page load",
    parseWaitMs,
    getDefaultWaitMs(),
  )
  .action(
    wrapAction(
      async (
        url: string | undefined,
        options: {
          profile?: string;
          workspace: string;
          waitMs: number;
        },
      ) => {
        const directUrl = url ? parseRunUrl(url) : null;
        const workspaceDirectory = path.resolve(options.workspace);
        let preparedRunTarget: {
          outputDirectory: string;
          outputDirectoryName: string;
        };
        let urls: string[];

        if (directUrl) {
          preparedRunTarget = await prepareOutputDirectory(workspaceDirectory);
          urls = [directUrl];
        } else {
          const preparedWorkspace = await prepareWorkspace(workspaceDirectory);
          preparedRunTarget = preparedWorkspace;
          urls = await readUrlsFromCsv(preparedWorkspace.urlsFilePath);
        }

        process.stdout.write(
          `📁 Preparing run in workspace ${workspaceDirectory}\n`,
        );
        process.stdout.write(
          `🗂️ Using output directory ${preparedRunTarget.outputDirectoryName}\n`,
        );
        const profile = await resolveProfileForRun(options.profile);
        process.stdout.write(`👤 Using profile "${profile.name}"\n`);
        const lock = await acquireProfileLock(profile.directory);
        process.stdout.write(
          `🔒 Acquired lock for profile "${profile.name}"\n`,
        );

        try {
          process.stdout.write(
            directUrl
              ? `🔗 Capturing direct URL ${directUrl}\n`
              : `🔗 Loaded ${urls.length} URL(s) from urls.csv\n`,
          );
          process.stdout.write("🚀 Starting screenshot capture\n");
          const summary = await runScreenshotJob({
            outputDirectory: preparedRunTarget.outputDirectory,
            urls,
            createSession: () =>
              createPlaywrightScreenshotSession({
                profile,
                waitMs: options.waitMs,
              }),
          });

          process.stdout.write(
            `Saved ${summary.succeededCount} screenshot(s) to ${summary.outputDirectory}\n`,
          );

          if (directUrl) {
            const [completedTask] = summary.completedTasks;
            if (completedTask) {
              process.stdout.write("📋 Copying screenshot to the clipboard\n");
              await copyImageToClipboard(completedTask.outputPath);
              process.stdout.write(
                `📋 Copied ${path.basename(completedTask.outputPath)} to the clipboard\n`,
              );
            }
          }

          if (summary.failures.length > 0) {
            process.stdout.write(
              `Failed to capture ${summary.failedCount} URL(s):\n`,
            );
            for (const failure of summary.failures) {
              process.stdout.write(`- ${failure.url}: ${failure.message}\n`);
            }
            process.exitCode = 1;
          }
        } finally {
          process.stdout.write(
            `🔓 Releasing profile lock for "${profile.name}"\n`,
          );
          await lock.release();
        }
      },
    ),
  );

void program.parseAsync(process.argv);

function wrapAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<void>,
): (...args: TArgs) => Promise<void> {
  return async (...args: TArgs) => {
    try {
      await action(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    }
  };
}

function parseRunUrl(value: string): string {
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid URL: "${value}".`);
  }

  return value;
}
