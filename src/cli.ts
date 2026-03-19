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
import { acquireProfileLock } from "./profile-lock.js";
import {
  listProfiles,
  resolveProfileForAuth,
  resolveProfileForRun,
} from "./profile-store.js";
import { runScreenshotJob } from "./screenshot-runner.js";
import { readUrlsFromCsv } from "./url-list.js";
import { prepareWorkspace } from "./workspace.js";

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
  .description("Capture one full-page screenshot per URL from urls.csv.")
  .option("--profile <name>", "Managed profile name to use")
  .option(
    "--workspace <dir>",
    "Job folder that contains urls.csv and screenshotsNNN",
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
      async (options: {
        profile?: string;
        workspace: string;
        waitMs: number;
      }) => {
        const preparedWorkspace = await prepareWorkspace(
          path.resolve(options.workspace),
        );
        const profile = await resolveProfileForRun(options.profile);
        const lock = await acquireProfileLock(profile.directory);

        try {
          const urls = await readUrlsFromCsv(preparedWorkspace.urlsFilePath);
          const summary = await runScreenshotJob({
            preparedWorkspace,
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
