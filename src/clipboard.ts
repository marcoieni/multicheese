import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";

export interface ClipboardCommandSpec {
  command: string;
  args: string[];
  useStdin: boolean;
}

export type ClipboardCommandRunner = (
  spec: ClipboardCommandSpec,
  imagePath: string,
) => Promise<void>;

interface ClipboardCopyOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  runCommand?: ClipboardCommandRunner;
}

export function getClipboardCommandSpecs(
  imagePath: string,
  options: Pick<ClipboardCopyOptions, "platform" | "env"> = {},
): ClipboardCommandSpec[] {
  const { platform = process.platform, env = process.env } = options;

  if (platform === "darwin") {
    return [
      {
        command: "osascript",
        args: [
          "-e",
          "on run argv",
          "-e",
          "set imagePath to item 1 of argv",
          "-e",
          "set the clipboard to (read POSIX file imagePath as «class PNGf»)",
          "-e",
          "end run",
          imagePath,
        ],
        useStdin: false,
      },
    ];
  }

  if (platform === "linux") {
    const preferWayland =
      Boolean(env.WAYLAND_DISPLAY) || env.XDG_SESSION_TYPE === "wayland";
    const waylandCommand = {
      command: "wl-copy",
      args: ["--type", "image/png"],
      useStdin: true,
    };
    const xclipCommand = {
      command: "xclip",
      args: ["-selection", "clipboard", "-t", "image/png", "-i"],
      useStdin: true,
    };

    return preferWayland
      ? [waylandCommand, xclipCommand]
      : [xclipCommand, waylandCommand];
  }

  if (platform === "win32") {
    return [
      {
        command: "powershell",
        args: [
          "-NoProfile",
          "-STA",
          "-Command",
          "& { param([string]$ImagePath) Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $image = [System.Drawing.Image]::FromFile($ImagePath); try { [System.Windows.Forms.Clipboard]::SetImage($image) } finally { $image.Dispose() } }",
          imagePath,
        ],
        useStdin: false,
      },
    ];
  }

  throw new Error(
    `Copying screenshots to the clipboard is not supported on platform "${platform}".`,
  );
}

export async function copyImageToClipboard(
  imagePath: string,
  options: ClipboardCopyOptions = {},
): Promise<void> {
  const { platform = process.platform, runCommand = runClipboardCommand } =
    options;
  const commandSpecs = getClipboardCommandSpecs(imagePath, options);
  const failures: string[] = [];

  for (const commandSpec of commandSpecs) {
    try {
      await runCommand(commandSpec, imagePath);
      return;
    } catch (error) {
      failures.push(formatClipboardCommandError(commandSpec.command, error));
    }
  }

  throw new Error(buildClipboardFailureMessage(platform, failures));
}

async function runClipboardCommand(
  spec: ClipboardCommandSpec,
  imagePath: string,
): Promise<void> {
  const input = spec.useStdin ? await readFile(imagePath) : undefined;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(spec.command, spec.args, {
      stdio: ["pipe", "ignore", "pipe"],
    });
    let stderr = "";

    child.on("error", reject);
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          stderr.trim() ||
            `${spec.command} exited with code ${code ?? "null"}.`,
        ),
      );
    });

    if (input) {
      child.stdin.end(input);
      return;
    }

    child.stdin.end();
  });
}

function formatClipboardCommandError(command: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${command}: ${message}`;
}

function buildClipboardFailureMessage(
  platform: NodeJS.Platform,
  failures: string[],
): string {
  const details = failures.join(" ");

  if (platform === "linux") {
    return `Failed to copy the screenshot to the clipboard on Linux. Install wl-copy or xclip and ensure a graphical clipboard session is available. ${details}`.trim();
  }

  if (platform === "darwin") {
    return `Failed to copy the screenshot to the clipboard on macOS. ${details}`.trim();
  }

  if (platform === "win32") {
    return `Failed to copy the screenshot to the clipboard on Windows. ${details}`.trim();
  }

  return `Failed to copy the screenshot to the clipboard. ${details}`.trim();
}
