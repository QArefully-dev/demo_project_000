#!/usr/bin/env node
// Multi-viewport screenshot + horizontal-overflow + console-error report.
// Wraps the global `playwright-cli` (see ../SKILL.md). OS-agnostic: shells out
// to the CLI, so it inherits whatever browser session the CLI manages.
//
// Usage:
//   node shoot.mjs --url http://127.0.0.1:5173/custom-blend --out ./shots
//   node shoot.mjs --route /cart --viewports 1280x800,390x844 --full-page
//
// Flags:
//   --url <absolute>     Full URL to capture. Overrides --route/--base.
//   --route <path>       Path appended to --base (default "/"). Use with a running dev server.
//   --base <origin>      Origin for --route. Default http://127.0.0.1:5173
//   --out <dir>          Directory for PNGs. Default ./shots (created if missing).
//   --viewports <list>   Comma list of WxH. Default 1280x800,390x844.
//   --session <name>     playwright-cli session name. Default "qa".
//   --full-page          Capture full scrollable page instead of just the viewport.
//   --keep-open          Leave the browser session open afterwards (for follow-up commands).
//
// Exit code is non-zero if any viewport shows horizontal overflow (> 0px),
// so it doubles as a responsive-layout gate in scripts.

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

function parseArgs(argv) {
  const out = { viewports: '1280x800,390x844', base: 'http://127.0.0.1:5173', route: '/', out: './shots', session: 'qa' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--full-page') out.fullPage = true;
    else if (a === '--keep-open') out.keepOpen = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  return out;
}

// Shell out to playwright-cli. shell:true so Windows resolves playwright-cli.cmd on PATH.
function cli(session, args, { raw = false } = {}) {
  const full = [`-s=${session}`, ...(raw ? ['--raw'] : []), ...args];
  const r = spawnSync('playwright-cli', full, { encoding: 'utf8', shell: true });
  if (r.status !== 0) {
    throw new Error(`playwright-cli ${args[0]} failed (exit ${r.status}):\n${r.stderr || r.stdout}`);
  }
  return (r.stdout || '').trim();
}

const opts = parseArgs(process.argv.slice(2));
const url = opts.url || opts.base.replace(/\/$/, '') + (opts.route.startsWith('/') ? opts.route : '/' + opts.route);
const outDir = resolve(opts.out);
mkdirSync(outDir, { recursive: true });

const viewports = opts.viewports.split(',').map((v) => {
  const [w, h] = v.trim().split('x').map(Number);
  return { w, h, label: `${w}x${h}` };
});

const overflowProbe =
  '() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth })';

console.log(`# browser-qa: ${url}`);
cli(opts.session, ['open']);
try {
  cli(opts.session, ['goto', url]);
  const title = JSON.parse(cli(opts.session, ['eval', '"() => document.title"'], { raw: true }) || '""');
  console.log(`title: ${title}`);

  const results = [];
  for (const vp of viewports) {
    cli(opts.session, ['resize', String(vp.w), String(vp.h)]);
    const probeRaw = cli(opts.session, ['eval', `"${overflowProbe}"`], { raw: true });
    const { scrollW, clientW } = JSON.parse(probeRaw); // --raw serializes the object as JSON
    const overflow = scrollW - clientW;
    const routeSlug = (opts.route || 'page').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'page';
    const file = join(outDir, `${routeSlug}-${vp.label}.png`);
    cli(opts.session, ['screenshot', ...(opts.fullPage ? ['--full-page'] : []), '--filename', file]);
    results.push({ viewport: vp.label, scrollW, clientW, overflow, screenshot: file });
    console.log(`${vp.label}  overflow=${overflow}px  -> ${file}`);
  }

  // Surface console errors (favicon 404s are common and harmless — reported, not fatal).
  let consoleErrors = '';
  try {
    consoleErrors = cli(opts.session, ['console', 'error']);
  } catch {
    /* console command optional */
  }

  const bad = results.filter((r) => r.overflow > 0);
  console.log('\n' + JSON.stringify({ url, title, results, consoleErrors }, null, 2));
  if (bad.length) {
    console.error(`\nHORIZONTAL OVERFLOW at: ${bad.map((b) => `${b.viewport} (+${b.overflow}px)`).join(', ')}`);
    process.exitCode = 2;
  }
} finally {
  if (!opts.keepOpen) cli(opts.session, ['close']);
}
