# playwright-cli command reference

Full surface of the global `playwright-cli` (`@playwright/cli`) plus repo recipes. Read
this when the bundled `scripts/shoot.mjs` is not enough — interactive flows, auth state,
network inspection, form filling. `SKILL.md` covers setup and the common screenshot job.

## Session model

Every command targets a browser session named with `-s=<name>` (default session if
omitted). A session is a persistent browser process — `open` once, run many commands
against it, `close` when done. Omitting `-s` reuses one shared default session, which is
fine for a single linear flow but collides if two flows run at once.

```bash
playwright-cli -s=qa open              # launch (headless Chromium)
playwright-cli -s=qa goto <url>        # navigate
# ... work ...
playwright-cli -s=qa close             # end this session
playwright-cli close-all               # end every session
playwright-cli kill-all                # force-kill stale/zombie sessions
playwright-cli list                    # list live sessions
```

Session state (snapshots, console logs) is written to a `.playwright-cli/` folder in the
**current working directory**. Always run from an out-of-repo dir (the scratchpad) so it
never dirties the git tree — see `SKILL.md`.

## Global flags

- `--json` — machine-readable output (status + code + result).
- `--raw` — result value only. Serializes as JSON: objects → JSON, strings → quoted
  string, numbers → bare. `JSON.parse` the output once to consume it.
- `--help [command]` — per-command help and options.

## Navigation & inspection

```bash
playwright-cli -s=qa goto http://127.0.0.1:5173/cart
playwright-cli -s=qa go-back
playwright-cli -s=qa reload
playwright-cli -s=qa snapshot                 # accessibility tree with element refs (e15, ...)
playwright-cli -s=qa find "Add to cart"       # search snapshot for text/regex -> refs + context
playwright-cli -s=qa --raw eval "() => document.title"
playwright-cli -s=qa --raw eval "() => location.pathname"
```

`snapshot`/`find` return element **refs** (like `e15`). Prefer refs for clicks. CSS or
role selectors also work as targets: `"role=button[name=Checkout]"`, `".custom-blend-nav-link"`.

## Interaction

```bash
playwright-cli -s=qa click e15                 # click a ref
playwright-cli -s=qa click "role=button[name=Add to cart]"
playwright-cli -s=qa fill "#email" "buyer@example.com"
playwright-cli -s=qa type "some text"          # types into focused editable
playwright-cli -s=qa select e22 "Freight"      # dropdown option
playwright-cli -s=qa check e30                 # checkbox/radio
playwright-cli -s=qa press Enter
playwright-cli -s=qa hover e15
playwright-cli -s=qa upload ./file.pdf
```

## Screenshots & PDF

```bash
playwright-cli -s=qa resize 1280 800
playwright-cli -s=qa screenshot --filename ./shot.png              # viewport
playwright-cli -s=qa screenshot --filename ./full.png --full-page  # whole scrollable page
playwright-cli -s=qa screenshot e15 --filename ./element.png       # single element
playwright-cli -s=qa screenshot --filename ./hi.png --hires        # device-pixel resolution
playwright-cli -s=qa pdf                                            # save page as PDF
```

The internal MCP browser pane renders inline only and needs a manual "Open" per
navigation; this writes real PNG files to disk with none of that. Use it whenever a
screenshot must be saved, compared, or attached.

## Console, network, dialogs

```bash
playwright-cli -s=qa console            # all console messages
playwright-cli -s=qa console error      # errors only (favicon 404 is common + harmless)
playwright-cli -s=qa requests           # numbered list of network requests
playwright-cli -s=qa request 3          # full detail of request #3
playwright-cli -s=qa response-body 3    # response body (binary saved to file, path printed)
playwright-cli -s=qa dialog-accept      # accept a native dialog on next appearance
playwright-cli -s=qa dialog-dismiss
```

## Auth / storage state (skip re-login)

This app uses session auth. Log in once through the UI, save the storage state, then
reload it in later runs instead of repeating the login flow.

```bash
playwright-cli -s=qa goto http://127.0.0.1:5173/login
playwright-cli -s=qa fill "#email" "buyer@example.com"
playwright-cli -s=qa fill "#password" "<from seed/README>"
playwright-cli -s=qa click "role=button[name=Sign in]"
playwright-cli -s=qa state-save ./auth.json          # persist cookies + storage

# later / other session:
playwright-cli -s=qa2 open
playwright-cli -s=qa2 state-load ./auth.json
playwright-cli -s=qa2 goto http://127.0.0.1:5173/account
```

Keep `auth.json` in the scratchpad, never in the repo — it holds session secrets.

## Recipe: verify a full customer journey

```bash
# dev server already running (see SKILL.md); run from scratchpad
playwright-cli -s=journey open
playwright-cli -s=journey goto http://127.0.0.1:5173/
playwright-cli -s=journey find "Browse materials"
playwright-cli -s=journey click "role=link[name=Browse materials]"
playwright-cli -s=journey snapshot                    # discover product refs
playwright-cli -s=journey click "<product ref>"
playwright-cli -s=journey click "role=button[name=Add to cart]"
playwright-cli -s=journey goto http://127.0.0.1:5173/cart
playwright-cli -s=journey screenshot --filename ./cart.png
playwright-cli -s=journey console error               # assert no unexpected errors
playwright-cli -s=journey close
```

## Notes / gotchas

- `file:` protocol is blocked. Serve over loopback (`http://127.0.0.1:5173`); the CLI is
  built for a running dev server, not static files.
- Headless by default. Nothing here needs a visible window; there is no user Chrome
  involvement and none is permitted.
- On Windows the binary is `playwright-cli.cmd` in the nvm Node 22 dir — it is only on
  PATH after the Node-path prepend from `SKILL.md`.
- If a session hangs or a prior run left zombies: `playwright-cli kill-all`.
