---
name: browser-qa
description: >-
  Drive a real headless Chromium from the shell via the global `playwright-cli` to do
  browser QA on this repo's web app — capture PNG screenshots to disk, measure horizontal
  overflow at 1080p, click through customer journeys, and read console errors
  and network requests. Use this whenever you need to see, screenshot, or verify the
  running storefront (apps/web on http://127.0.0.1:5173) in an actual browser: visual
  checks, "take a screenshot of X", reproducing a UI bug,
  confirming a fix renders, or capturing evidence for a review gate. Prefer this over the
  MCP internal browser pane whenever a screenshot must be saved to a file, compared, or
  attached — the pane renders inline only and needs a manual "Open" click per navigation,
  while this writes real files with no gate. Do NOT use the user's Chrome; this is a
  separate, isolated headless browser.
---

# browser-qa

`playwright-cli` (the global `@playwright/cli`) drives an isolated headless Chromium
through plain shell commands. It writes screenshots straight to disk and needs no
per-navigation approval, which makes it the right tool for saved/compared visual evidence
and scripted UI journeys against this repo's dev server.

For the full command surface (interaction, auth state, network, dialogs, journey recipe)
read `references/command-reference.md`. This file covers setup, the repo glue, and the
common screenshot job.

## Preconditions (install is machine-wide, usually already done)

`playwright-cli` and its Chromium are installed globally for this machine's Node 22. All
node/npm/playwright-cli commands need the repo's Node 22 on PATH first:

```bash
$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH
```

Verify it's ready:

```bash
playwright-cli --version          # prints a version -> ready
```

If the command is missing or the browser is absent (fresh machine), reinstall — this
downloads ~300MB, so only do it when actually broken:

```bash
npm install -g @playwright/cli@latest
playwright-cli install-browser chromium
```

## Two hard rules for a clean tree

1. **Run from an out-of-repo working directory.** `playwright-cli` drops a
   `.playwright-cli/` session folder in the current directory. Run from the scratchpad so
   it never dirties git. Write screenshots there too — they are evidence, not repo files.
2. **`file:` URLs are blocked.** The CLI only drives a running server over loopback. Start
   the dev server first.

## Standard flow

### 1. Start the app (from the repo root)

```bash
$env:PATH='C:\Users\iwano\AppData\Local\nvm\v22.23.1;' + $env:PATH
npm run dev
```

Launch it detached (e.g. `Start-Process`) and poll `http://127.0.0.1:5173` until it
returns 200 before driving the browser. Web = `http://127.0.0.1:5173`, API =
`http://127.0.0.1:3001`. If you started the server, stop it when done (see Cleanup).

### 2a. Quick screenshots + overflow check (bundled helper)

For the common "screenshot this route and tell me if anything overflows" job, use
`scripts/shoot.mjs`. It opens a session, captures at 1080p (`1920x1080`, the only viewport
this repo targets), measures horizontal overflow, surfaces console errors, prints a JSON
summary, and exits non-zero on overflow (so it doubles as a layout gate).

```bash
# run from the scratchpad dir
node <repo>/.claude/skills/browser-qa/scripts/shoot.mjs \
  --route /custom-blend --out ./shots
```

Viewport default is `1920x1080`. Do not check mobile or tablet sizes — out of scope; only
pass `--viewports` if the user names an explicit size.

Key flags (full list in the script header): `--url <absolute>` overrides `--route`;
`--base <origin>` (default `http://127.0.0.1:5173`); `--full-page`; `--keep-open` to leave
the session up for follow-up commands; `--session <name>`.

Then view the PNGs (Read tool renders them inline) to judge the result.

### 2b. Interactive journey / debugging

For anything beyond a screenshot — clicking through a flow, filling forms, reusing login
state, inspecting network — drive the CLI directly. See
`references/command-reference.md`. Minimal shape:

```bash
playwright-cli -s=qa open
playwright-cli -s=qa goto http://127.0.0.1:5173/cart
playwright-cli -s=qa snapshot                     # get element refs
playwright-cli -s=qa click <ref>
playwright-cli -s=qa screenshot --filename ./cart.png
playwright-cli -s=qa close
```

## Cleanup

- Close browser sessions: `playwright-cli close-all` (or `kill-all` for zombies).
- If you started the dev server for this task, stop it — free ports 5173 and 3001. Leave a
  server running only if the user asked you to keep it up.
- Nothing should remain under the repo tree; confirm `git status` is clean of
  `.playwright-cli/` and stray screenshots.

## Boundaries

This is an isolated headless browser dedicated to QA — never the user's Chrome, and no
visible-window automation is needed. Screenshots and any saved auth state are evidence:
keep them in the scratchpad, never commit them, and keep session secrets out of the repo.
