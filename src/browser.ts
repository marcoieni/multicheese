import { chromium, type BrowserContext, type Page } from "playwright";

import {
  DEFAULT_VIEWPORT,
  DEFAULT_WAIT_MS,
  NETWORK_IDLE_TIMEOUT_MS,
} from "./constants.js";
import type { ProfileRecord } from "./profile-store.js";
import type { ScreenshotSession, ScreenshotTask } from "./screenshot-runner.js";

export async function openAuthenticationBrowser(
  profile: ProfileRecord,
): Promise<void> {
  const context = await launchChromeContext(profile.directory, {
    headless: false,
  });

  try {
    const page = await getOrCreatePage(context);
    await page
      .goto("https://www.google.com", { waitUntil: "domcontentloaded" })
      .catch(() => {
        return undefined;
      });

    process.stdout.write(
      `Opened managed profile "${profile.name}". Log in inside Chrome, then press Enter here to save the session and close the browser.\n`,
    );

    await waitForEnter();
  } finally {
    await context.close();
  }
}

export async function createPlaywrightScreenshotSession(options: {
  profile: ProfileRecord;
  waitMs: number;
}): Promise<ScreenshotSession> {
  process.stdout.write(
    `👤 Launching headless Chrome for profile "${options.profile.name}"\n`,
  );
  const context = await launchChromeContext(options.profile.directory, {
    headless: true,
  });
  const page = await getOrCreatePage(context);
  process.stdout.write("✨ Chrome session ready\n");

  return {
    async capture(task: ScreenshotTask) {
      process.stdout.write(`➡️ Opening ${task.url}\n`);
      await page.goto(task.url, { waitUntil: "load" });
      process.stdout.write(`⏳ Waiting for network idle on ${task.url}\n`);
      await page
        .waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT_MS })
        .catch(() => undefined);

      if (options.waitMs > 0) {
        process.stdout.write(
          `🕰️ Waiting ${options.waitMs}ms before screenshot\n`,
        );
        await page.waitForTimeout(options.waitMs);
      }

      process.stdout.write(`💾 Writing screenshot to ${task.outputPath}\n`);
      await page.screenshot({
        path: task.outputPath,
        fullPage: true,
        type: "png",
      });
    },
    async close() {
      await context.close();
    },
  };
}

async function launchChromeContext(
  userDataDir: string,
  options: { headless: boolean },
): Promise<BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: options.headless,
    viewport: DEFAULT_VIEWPORT,
  });
}

async function getOrCreatePage(context: BrowserContext): Promise<Page> {
  const [existing] = context.pages();
  return existing ?? context.newPage();
}

async function waitForEnter(): Promise<void> {
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdout.write("> ");
    process.stdin.once("data", () => {
      process.stdin.pause();
      resolve();
    });
  });
}

export function parseWaitMs(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("wait-ms must be a non-negative integer.");
  }

  return parsed;
}

export function getDefaultWaitMs(): number {
  return DEFAULT_WAIT_MS;
}
