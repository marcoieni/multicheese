# multicheese

`multicheese` is a macOS CLI that opens authenticated pages in Google Chrome through Playwright and saves one full-page PNG screenshot per URL.

## Why it uses managed profiles

Current Chrome and Playwright releases do not support safely automating your normal Chrome profile. Instead, `multicheese` manages its own persistent Chrome profiles under:

`~/Library/Application Support/multicheese/profiles/<profile>`

This keeps authentication working across runs without depending on unsupported remote-debugging flows.

You do **not** need to close every Chrome window on your laptop. You only need to avoid using the same `multicheese` profile in two `multicheese` sessions at the same time.

## Requirements

- macOS
- Node.js 20+
- pnpm
- Google Chrome installed at the standard macOS location

## Install

Install dependencies:

```bash
pnpm install
```

Build the CLI:

```bash
pnpm build
```

Install it into `~/.local/bin`:

```bash
pnpm install:local
```

This writes a small launcher script into `~/.local/bin` that points at this checkout's built CLI. If you move the repo, run `pnpm install:local` again.

`~/.local/bin` is already in the current machine's `PATH`, so the command will be available as:

```bash
multicheese
```

Alternative global install:

```bash
pnpm link --global
```

## Usage

### 1. Create or open an authenticated profile

```bash
multicheese auth open work
```

Chrome opens with the managed profile. Log in to the websites you need, then return to the terminal and press Enter. The session data stays on disk for the next run.

List available profiles:

```bash
multicheese auth list
```

### 2. Prepare a job folder

Run the command from a separate folder, not from the project root.

That folder must contain one file named `urls.csv`.

The following can also be present:
- zero or more directories named `screenshotsNNN`
- optional hidden files like `.DS_Store`

Example:

```text
/tmp/my-job
├── urls.csv
├── screenshots000/
└── screenshots001/
```

`urls.csv` must contain one URL per row. It may be headerless or use a single `url` header:

```csv
https://example.com
https://example.com/docs
```

or

```csv
url
https://example.com
https://example.com/docs
```

### 3. Capture screenshots

```bash
multicheese run --profile work --workspace /tmp/my-job
```

Options:

- `--profile <name>`: managed profile to use
- `--workspace <dir>`: job folder to validate and process
- `--wait-ms <ms>`: extra time to wait after each page load, default `10`

Each run creates the next output directory:

- first run: `screenshots000`
- second run: `screenshots001`
- third run: `screenshots002`

Output files are named from the URL and prefixed with the CSV order, for example:

```text
001-example-com.png
002-example-com-docs.png
003-example-com-products-widget-a1b2c3d4.png
```

## Development

Useful commands:

```bash
pnpm dev -- auth list
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
```
