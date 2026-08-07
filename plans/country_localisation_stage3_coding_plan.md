# Country Localisation Stage 3 Coding Plan

Status: complete — S1 convergence and E30AA full pass 2026-08-07.
E30AA evidence: Node v22.23.1/npm 10.9.8; format, lint, all-workspace typecheck, and localisation guard pass (879 source files, 0 findings); reset pass; integration pass (web 18 files/54 tests, API 293 subtests/434 tests); verify pass in 322s (format, guard, typecheck, lint, all-workspace tests/builds). R30 High closed; follow-up format and stale postcode consumer fixes have focused evidence; no re-review per rule. Final completion.
Source: `plans/country_localisation_handoff.md` -> `Delivery Stages` item 3, plus `Money`, `Language`, `Configuration Location`
Repository baseline: branch `expansion_002`, `HEAD` `9f4df4e419ac8c8e19454a09bc3ee6e14fcde572`; inspected 2026-08-06

## Runtime Worktree

- source: record source checkout absolute path, named branch, and branch `HEAD` before implementation writes
- current input warning: `plans/country_localisation_handoff.md` has relevant uncommitted changes absent from baseline `HEAD`; runtime must stop and ask user to commit them or choose baseline
- detached `HEAD`: stop and ask user to select branch
- other relevant uncommitted or untracked input absent from `HEAD`: stop and ask user to commit it or choose baseline; never copy, stash, discard, or import it without approval
- create: `git worktree add -b <implementation-branch> <absolute-worktree-path> <source-branch>`
- execution root: all worker, reviewer, fix, test, and convergence activity runs inside dedicated worktree
- source checkout: read-only after worktree creation except saved plan and run-scoped temp state
- integration: no merge, rebase, cherry-pick, copy-back, branch removal, or worktree cleanup; user handles merge
- completion reply: absolute worktree path + implementation branch + source branch + base revision; state worktree remains intact

## Objective

Complete item 10 Stage 3: seven-country translation lookup, locale-owned number/date presentation, fixed display-only currency conversion, single money/date formatter path, localized public errors and generated messages, converted checkout/receipt display beside authoritative GBP. Preserve pence authority, persisted commerce semantics, routes, country isolation, and English catalog data.

## Scope

### In

- checked-in language, number/date locale, display currency, rational exchange rate in every country profile
- shared pure localisation workspace consumed by API and web
- exhaustive feature-sliced message bundles for `UK`, `US`, `CN`, `PL`, `ES`, `DE`, `FR`
- all shop-authored UI, accessibility, validation, public API error, help/policy, notification, mailbox, and system lifecycle wording behind lookup keys
- localized money, number, instant, and civil-date render helpers; removal of formatter forks and ambient browser locale use
- local display conversion for ordinary money; authoritative GBP alongside converted checkout and receipt totals
- gateway currency correction from `USD` to `GBP` without amount conversion
- structured order receipt facts and typed mailbox templates; no converted mail value stored
- non-UK order/company country provenance repair needed by localisation
- safe public error codes and metadata; generic validation/internal errors reveal no implementation detail
- automated translation-surface guard, seed/reset coverage, README, `AGENTS.md`, handoff, and high-level-plan status sync

### Out

- stored, charged, refunded, reserved, audited, or snapshotted foreign currency
- live rates, network lookup, rate timestamps, currency selection independent from country
- product/catalog data translation: product names, descriptions, categories, variant labels, facts, SKU, promo/operator/user-authored data remain English/raw
- route localisation, locale URL prefixes, IP/geolocation, browser-language detection
- standing-order scheduling semantics, delivery cut-off arithmetic, stock/inventory rules, promo eligibility rules
- relative-time UI
- admin `datetime-local` write interpretation changes; existing absolute-instant submission semantics stay intact
- translation of technical admin identifiers, webhook payloads, job kinds, audit codes, exception diagnostics

## Repository Findings

- existing: `packages/contracts/src/countryProfiles/types.ts` -> `CountryProfile` owns availability, raw banner/postcode label, delivery zones, time zone, cut-off; no language, locale, currency, rate
- existing: `packages/contracts/src/countryProfiles/{uk,us,cn,pl,es,de,fr}.ts` -> seven checked-in profile files; `packages/contracts/test/country-profiles.test.ts` proves totality
- existing: `apps/web/src/hooks/CountryContext.tsx` -> `activeCountry`; `apps/web/src/components/Layout.tsx` -> provider insertion point below `CountryProvider`
- gap: no translation runtime; audit found 492 JSX/visible-prop candidates across 127 production files and 125 long-form help/policy fields
- gap: `apps/web/src/lib/formatMoney.ts` formats pence as `en-US`/`USD`; 59 calls across 12 files; five more components create `en-GB`/`GBP` formatters
- gap: date presentation has 14 formatted call sites across nine forks plus raw ISO rendering; `apps/web/src/features/orders/orderPresentation.ts` hardcodes `en-US`
- constraint: `apps/api/src/features/delivery/deliverySlotRules.ts` uses `Intl.DateTimeFormat(...profile.timeZone)` for rule computation; this is not display formatting and must remain isolated
- constraint: `formatDeliverySlot()` deliberately treats `YYYY-MM-DD` as UTC civil date; profile time zone must never shift booked day
- gap: `apps/api/src/features/payments/paymentGateway.ts` and `apps/api/src/features/checkout/checkoutService.ts` declare/send `USD` despite authoritative pence/GBP
- gap: `apps/api/src/features/checkout/checkoutFinalizer.ts` stores dollar-formatted receipt prose in `dev_mailbox`; `apps/web/src/features/mailbox/MailboxPage.tsx` renders it verbatim
- existing: no persisted currency column; checkout quote, gateway amount, orders, payments, refunds all carry integer pence unchanged
- defect: migration `032` added `orders.country` and `company_accounts.country`, but `orderRepository.create()` and `companyRepository.create()` omit country and receive `UK` defaults
- gap: `packages/contracts/src/common.ts` `ErrorResponse` carries prose only; `apps/web/src/api/client.ts` and consumers branch on exact English strings or unsafe casts
- security defect: `apps/api/src/app.ts` returns raw validation details, exception messages, and method/URL not-found text
- constraint: auth and country resolution currently run in `preHandler`; validation fails earlier, so safe localized validation errors need read-only identity/country resolution in ordered `preValidation`
- existing: server-generated buyer copy persists from password reset, company invites, approvals, order events, notifications, standing orders, webhooks, back-in-stock, exports, and checkout
- reuse: help registry has stable article/block/paragraph/FAQ IDs in `apps/web/src/features/help/content/helpContentTypes.ts`; use IDs as lookup-key roots while preserving paths/slugs
- constraint: web integration tests run only through `npm run test:integration -w @shop/web`; root `npm run verify` does not run that tier
- constraint: new workspace must stay local-only and build after `@shop/contracts`; Node 22 and `npm ci` health protocol remain mandatory

## Decisions and Invariants

- shared package: proposed `packages/localisation/` (`@shop/localisation`) depends only on `@shop/contracts`; API and web depend on it. Two runtime consumers justify workspace boundary.
- catalog shape: feature-sliced modules under proposed `packages/localisation/src/messages/`; each key owns exhaustive `Record<Country, MessageTemplate>`. Wildcard package export prevents central registry edits.
- no fallback: missing country/key, empty value, placeholder mismatch, or missing plural `other` branch fails tests/build. US default applies only to isolated provider-free web tests.
- message values: plain templates plus locale-aware plural branches. Interpolation escapes as text; no HTML templates.
- profile metadata:
  - `UK`: language `en`, locales `en-GB`, currency `GBP`, rate `1/1`
  - `US`: language `en`, locales `en-US`, currency `USD`, rate `5/4`
  - `CN`: language `zh`, locales `zh-CN`, currency `CNY`, rate `9/1`
  - `PL`: language `pl`, locales `pl-PL`, currency `PLN`, rate `5/1`
  - `ES`: language `es`, locales `es-ES`, currency `EUR`, rate `117/100`
  - `DE`: language `de`, locales `de-DE`, currency `EUR`, rate `117/100`
  - `FR`: language `fr`, locales `fr-FR`, currency `EUR`, rate `117/100`
- rate meaning: target minor units per GBP penny as positive integer numerator/denominator. Convert with integer arithmetic and deterministic half-up rounding once; never float-based business computation.
- money API: display money converts; settlement money always `en-GB`/`GBP`; dual total returns local display + settlement. UK suppresses duplicate equal total.
- authoritative forms: company threshold and admin refund inputs remain GBP. Labels say `GBP`; posted pence never derive from converted display.
- dates: instants use active profile date locale + profile time zone; civil `YYYY-MM-DD` uses locale + `UTC`; callers select semantic preset, never raw `Intl` options.
- country switching: translate/format during render. UI state stores stable code/key + parameters, never rendered string, when response can outlive country selection.
- public errors: stable typed code + safe typed metadata + localized `error` fallback. Ownership-hiding mappings remain collapsed. Unknown exception -> `INTERNAL_ERROR`; validation -> `REQUEST_INVALID`; no raw exception/AJV/URL detail.
- generated messages: notification/system lifecycle copy resolves recipient/entity country and persists stable localized snapshot. Mailbox producers persist typed key + canonical parameters + intended country; receipt persists `order_id`. Mail containing money formats only at read/render time.
- order receipt country: persisted `orders.country`, not current admin browsing country. Customer/guest receipt route still respects owning order access.
- catalog boundary: API/catalog-returned values stay verbatim. Shop control labels, warnings, status labels, and accessibility copy translate.
- temporary compatibility: raw profile banner/postcode label fields may coexist with new keys only until last consumer moves; `S1` removes them.
- verification: automated repository commands only.

## Target Design

### Country profiles

- extend `CountryProfile` with `language`, `numberLocale`, `dateLocale`, `displayCurrency`, `exchangeRate`, `bannerMessageKey`, `postcode.labelMessageKey`
- freeze exact fixtures above in contract tests; validate BCP-47 locales, IANA zones, ISO currencies, positive integer ratios
- keep profile files data-only; no app imports or runtime network

### Shared localisation package

- proposed `src/messages/defineMessages.ts` -> exhaustive country/key typing, template/plural validation, placeholder parity
- proposed `src/translate.ts` -> `translate(catalog,country,key,params)`; `Intl.PluralRules` uses profile language/locale
- proposed `src/formatMoney.ts` -> `convertPenceToDisplayMinor`, `formatDisplayMoney`, `formatSettlementMoney`, `formatDualTotal`
- proposed `src/formatDate.ts` -> fixed presets for instant vs civil date
- proposed `src/formatNumber.ts` -> locale-bound decimal/weight/count formatting
- cache `Intl` formatters only; never cache translations, country, or converted values
- message subpath wildcard -> feature workers add disjoint modules without editing shared registry

### Web adapter

- proposed `apps/web/src/i18n/LocaleContext.tsx` consumes `activeCountry`, exposes profile-bound formatters, sets `<html lang>`
- proposed `useMessages(catalog)` resolves feature bundle at render
- `Layout` mounts adapter directly inside `CountryProvider`
- presentation factories receive locale adapter/country explicitly; module-load labels and formatted constants become keys/factories

### API public errors

- proposed `packages/contracts/src/publicErrors.ts` -> exhaustive `PublicErrorCode`, code-specific safe metadata, transition-compatible response schema
- `sendPublicError(request,reply,status,code,meta)` localizes through shared API-error catalog
- validation/not-found/internal handlers use safe codes; route workers migrate legacy helpers, direct `{error}` objects, and domain-message forwarding
- web `ApiError` exposes `code` + metadata. Feature consumers branch on code, never prose.

### Receipt and async content

- migration `034` adds nullable indexed `dev_mailbox.order_id` FK plus nullable template key/parameter/country fields; existing messages remain legacy snapshots
- mailbox contract becomes discriminated legacy plain message vs typed system template vs structured order receipt facts
- checkout stores receipt relationship, no dollar/converted prose
- web receipt renders local total plus authoritative GBP; UK renders one GBP total
- system notification producers translate with recipient/entity country before snapshot persistence; password-reset/invite/approval/export mailbox producers store typed templates, with canonical pence metadata where needed

### Coverage guard

- proposed AST/static checker scans production web JSX text, visible literal props, UI error setters, presentation maps, direct `Intl`/`toLocale*`, route error emissions, API raw-message forwarding, literal notification/mailbox writes, and literal system order-event titles
- allowlist limited to catalog/operator/user data, routes, identifiers, CSS, technical diagnostics, API delivery computation, admin datetime input serialization
- root `verify` runs checker after formatter/string sweep

## Execution Graph

`G0 -> P1 -> R1 -> GR1 -> P2 -> R2 -> GR2 -> G1`

`G1 -> {P3 -> R3 -> GR3 || P4 -> R4 -> GR4 || P5 -> R5 -> GR5 || P7 -> R7 -> GR7 || P8 -> R8 -> GR8} -> G2`

`GR4 -> P6 -> R6 -> GR6`; `G2 + GR6 -> {P9 -> R9 -> GR9 || P10 -> R10 -> GR10} -> G3`

`G3 -> {P11 -> R11 -> GR11 || P12 -> R12 -> GR12 || P13 -> R13 -> GR13 || P14 -> R14 -> GR14 || P15 -> R15 -> GR15 || P16 -> R16 -> GR16 || P17 -> R17 -> GR17 || P18 -> R18 -> GR18 || P19 -> R19 -> GR19 || P20 -> R20 -> GR20 || P21 -> R21 -> GR21 || P22 -> R22 -> GR22 || P23 -> R23 -> GR23 || P24 -> R24 -> GR24 || P25 -> R25 -> GR25 || P26 -> R26 -> GR26 || P27 -> R27 -> GR27 || P28 -> R28 -> GR28} -> G4`

`G4 -> P29 -> R29 -> GR29 -> G5 -> S1 -> R30 -> GR30 -> G6`

- `G0`: clean implementation worktree, Node 22, install health, baseline evidence; relevant source input committed/chosen
- `G1`: reviewed profile + shared localisation runtime built
- `G2`: reviewed country authority, public-error producer, migration, gateway correction, web locale shell; mailbox contract also reviewed through `GR6`
- `G3`: reviewed API error infrastructure + structured receipt API
- `G4`: every API/web feature lane reviewed; all fan-in interfaces accepted
- `G5`: localisation static guard green; residual legacy paths removed by guard packet only where owned
- `G6`: convergence review closed; reset, integration tier, and full verification green

## Work Packets

### P1: Country display metadata

- mode: sequential producer after `G0`
- depends on: `G0`
- owns: `packages/contracts/src/country.ts`, `packages/contracts/src/countryProfiles/**`, `packages/contracts/test/country-profiles.test.ts`
- reads: `packages/contracts/src/countryProfiles/types.ts` -> profile contract; seven profile files -> stage-2 fixtures; `apps/api/src/features/delivery/deliverySlotRules.ts` -> time-zone consumer invariant
- acceptance: seven exact metadata/rate fixtures compile; locale/currency/rate validation passes; compatibility banner/label values remain until consumers move
- non-goals: translator, app consumer edits, delivery arithmetic changes
- upstream inputs: handoff country/money/config decisions
- changes:
  - add typed language, number/date locale, display currency, rational rate, banner/postcode message keys
  - update stale stage-2/no-format TSDoc
  - extend profile totality tests, exact mapping tests, `Intl` constructibility checks
- invariants: profiles data-only; UK identity rate; every ratio positive integer; time zone unchanged
- relevant evidence: `E0`
- test duty: `npm exec -w @shop/contracts -- tsx --test test/country-profiles.test.ts` -> `E1`
- verification: `E1` pass; `npm run build -w @shop/contracts` pass -> `E1B`
- handoff: accepted profile display contract + exact fixtures
- review: `R1` -> `GR1` blocks `P2`

### P2: Shared localisation workspace

- mode: sequential after `GR1`
- depends on: `P1`, `GR1`
- owns: `packages/localisation/**` (proposed), root `package.json`, `package-lock.json`, `apps/api/package.json`, `apps/web/package.json`
- reads: `packages/contracts/package.json` -> build/export pattern; `packages/contracts/src/countryProfiles/**` -> metadata; root scripts -> postinstall/verify ordering
- acceptance: local-only `@shop/localisation` builds for API/web; exhaustive catalogs, plural/interpolation, money/date/number helpers pass seven-country matrix
- non-goals: feature copy bundles beyond shared country/common primitives; React; API routes
- upstream inputs: `P1` accepted profile contract
- changes:
  - create workspace package, wildcard message export, TS build/test scripts, app dependencies, lockfile entry
  - refresh lockfile only for intentional workspace manifests via `npm install --package-lock-only --ignore-scripts`; then run clean `npm ci`
  - implement `defineMessages`, translation, placeholder/plural validation
  - implement pure money, date, civil-date, number formatters and exact rounding
  - add shared country names, banner, postcode, generic common copy bundle
  - update postinstall order: contracts -> catalog -> localisation
- invariants: no network, no app-private imports, no mutable active-country global, no silent fallback
- relevant evidence: `E1`, `E1B`
- test duty: `npm ci && npm exec -- tsx --version && npm run typecheck -w @shop/api && npm test -w @shop/localisation && npm run build -w @shop/localisation` -> `E2`
- verification: `E2` pass; formatter outputs frozen for all seven fixtures
- handoff: translator/catalog contract + pure formatter APIs + wildcard module convention
- review: `R2` -> `GR2` blocks all consumers

### P3: Persisted country authority and validation hook order

- mode: parallel producer after `G1`
- depends on: `G1`
- owns: `apps/api/src/plugins/auth.ts`, `apps/api/src/plugins/countryContext.ts`, `apps/api/src/features/orders/orderRepository.ts`, `apps/api/src/features/checkout/checkoutFinalizer.ts` country argument only, `apps/api/src/features/companyAccounts/{companyRepository,companyService}.ts`, `apps/api/src/app.ts` hook registration only, focused API tests
- reads: migration `032` -> country defaults/constraints; cart repository -> correct country insert; auth/session service -> last-seen behavior; company membership rows -> user country
- acceptance: US/DE order and company inserts persist correct country; validation-time request has resolved country; valid requests still update session last-seen once
- non-goals: receipt body, error handler, translated errors, company UI
- upstream inputs: `P1` profile/country contract
- changes:
  - require country in order/company create inputs and SQL inserts/select rows
  - pass quote/cart country through checkout finalizer; derive company country from creator account
  - split read-only auth lookup into `preValidation`; retain last-seen write in `preHandler`
  - run country resolution after auth `preValidation`
- invariants: wrong-country auth still fails; admin selected country never rewrites account country; transaction boundaries unchanged
- relevant evidence: `E2`
- test duty: `npm exec -w @shop/api -- tsx --test test/country/countryResolution.integration.test.ts test/checkout/payment.integration.test.ts test/companyAccounts/company.integration.test.ts test/companyAccounts/invites.integration.test.ts` -> `E3`
- verification: `E3` pass with non-UK persisted assertions and last-seen regression
- handoff: trustworthy order/company country + validation-time resolved country
- review: `R3` -> `GR3` blocks `P9`, `P10`, `P15`

### P4: Public error contract and translations

- mode: parallel producer after `G1`
- depends on: `G1`
- owns: proposed `packages/contracts/src/publicErrors.ts`, `packages/contracts/src/common.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/test/public-errors.test.ts`, proposed `packages/localisation/src/messages/apiErrors.ts`, its tests
- reads: `apps/api/src/utils/errors.ts` + `apps/api/src/routes/**` -> emitted vocabulary; `apps/web/src/api/client.ts` -> prose coupling; feature error unions -> stable identities
- acceptance: exhaustive public code vocabulary covers buyer/admin/common failures; typed safe metadata covers money/date/product IDs without arbitrary details; seven-country error catalog complete
- non-goals: route/helper/client consumption; status-code changes
- upstream inputs: `P2` catalog contract
- changes:
  - add transition-compatible `code` + `meta`, deprecate free-form `details`
  - define code/metadata maps and enumeration-hiding rules
  - add exhaustive localized error bundle with interpolation parity tests
- invariants: no exception text/public URL/AJV structure; payment machine identities use code field; domain codes remain unchanged
- relevant evidence: `E2`
- test duty: `npm test -w @shop/contracts && npm test -w @shop/localisation` -> `E4`
- verification: `E4` pass; every public code has seven translations and valid metadata schema
- handoff: accepted public error code/meta/catalog interface
- review: `R4` -> `GR4` blocks `P6`, `P9`, `P11`-`P14`

### P5: Migration 034 structured mailbox content

- mode: parallel producer after `G1`
- depends on: `G1`
- owns: proposed `apps/api/src/db/migrations/034_mailbox_order_receipt.ts`, `apps/api/src/db/migrations/index.ts`, proposed `apps/api/test/db/mailboxReceiptSchema.integration.test.ts`
- reads: migration `033` -> current head; `apps/api/src/db/migrate.ts` -> FK runner contract; migration `032` -> idempotent helper style; `001_initial.ts` -> `dev_mailbox`
- acceptance: nullable `dev_mailbox.order_id` FK + index and nullable template key/JSON/country fields; existing rows preserved; rerun no-op; FK check clean; head `034`
- non-goals: repository/contract/checkout consumers
- upstream inputs: receipt design decision
- changes: add ordered additive migration, index, strict row-state check for legacy/template/receipt shapes, idempotency/FK behavior tests
- invariants: no converted columns; no landed migration edits; no FK pragma inside transaction
- relevant evidence: `E2`
- test duty: `npm exec -w @shop/api -- tsx --test test/db/mailboxReceiptSchema.integration.test.ts test/db/migrations.integration.test.ts` -> `E5`
- verification: `E5` pass and `PRAGMA foreign_key_check` empty
- handoff: migration head `034`, nullable receipt/template storage
- review: `R5` -> `GR5` blocks `P10`

### P6: Structured mailbox transport

- mode: sequential contract producer after `GR4`
- depends on: `P4`, `GR4`
- owns: `packages/contracts/src/mailbox.ts`, `packages/contracts/test/mailbox-contracts.test.ts`
- reads: existing mailbox schema -> legacy shape; `packages/contracts/src/orders.ts` + delivery contracts -> canonical receipt facts
- acceptance: discriminated plain/template/order-receipt schema validates legacy snapshots, typed template parameters, and canonical receipt facts; no converted money field
- non-goals: migration, repository, UI
- upstream inputs: `P4` error/metadata conventions; receipt design
- changes: add receipt variant carrying order ID, country, pence totals, delivery slot/charge, optional PO reference; add `SystemMailboxTemplateKey` + code-specific parameters/intended country; retain plain variant
- invariants: integer pence; strict TypeBox validation; no API source import
- relevant evidence: `E4`
- test duty: `npm exec -w @shop/contracts -- tsx --test test/mailbox-contracts.test.ts` -> `E6`
- verification: `E6` pass; contracts build pass
- handoff: accepted `MailboxMessage` union
- review: `R6` -> `GR6` blocks `P10`, `P24`

### P7: Authoritative payment currency

- mode: parallel after `G1`
- depends on: `G1`
- owns: `apps/api/src/features/payments/paymentGateway.ts`, `apps/api/src/features/checkout/checkoutService.ts` gateway call only, payment/checkout focused tests
- reads: `checkoutQuote.ts` -> pence authority; `checkoutFinalizer.ts` -> order/payment amount persistence; `adminRefundService.ts` -> refund source
- acceptance: simulated gateway receives exact quote pence with currency `GBP`; order/payment/refund amounts unchanged
- non-goals: display conversion, receipt, currency persistence
- upstream inputs: authoritative money invariant
- changes: add/export `AUTHORITATIVE_CURRENCY='GBP'`; narrow request type; replace USD call; pin integration assertions
- invariants: no conversion before gateway; no new DB currency field
- relevant evidence: `E2`
- test duty: `npm exec -w @shop/api -- tsx --test test/checkout/payment.integration.test.ts test/checkout/checkoutDepth.integration.test.ts` -> `E7`
- verification: `E7` pass with exact pence/GBP assertion
- handoff: corrected settlement boundary
- review: `R7` -> `GR7` blocks checkout/receipt consumers

### P8: Web locale adapter and shared shell

- mode: parallel consumer after `G1`
- depends on: `G1`
- owns: proposed `apps/web/src/i18n/**` except final guard; `apps/web/src/components/{Layout,Header,Footer,CategoryNav,SearchBar,AccountMenu,CountryPicker,CountryBanner,ErrorMessage,LoadingSpinner,ToastProvider,ProtectedRoute,AdminRoute}.tsx` and tests; `apps/web/src/components/nav/**`; `apps/web/src/components/ui/sheet.tsx`; `apps/web/src/features/{home,notFound}/**`
- reads: `CountryContext.tsx` -> active state; shell tests -> provider conventions; shared catalog module from `P2`
- acceptance: active country rerenders shell copy/formatters and updates HTML language; isolated tests default US; banner/postcode key path works without raw profile copy in migrated files
- non-goals: feature pages, API error infrastructure, catalog data translation
- upstream inputs: `P2` locale runtime
- changes: mount `LocaleProvider`; add `useLocalisation`/`useMessages`; migrate shell/accessibility/toast/home/404 wording and country labels
- invariants: selected country remains sole locale state; no second browser storage key; async state stores codes/keys
- relevant evidence: `E2`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/i18n src/components/Header.test.tsx src/components/Layout.test.tsx src/components/CountryPicker.test.tsx src/components/CountryBanner.test.tsx src/features/home src/features/notFound` -> `E8`
- verification: `E8` pass including US/DE/ES switch cases
- handoff: web locale context + shell migration conventions
- review: `R8` -> `GR8` blocks web feature lanes

### P9: Safe localized API error infrastructure

- mode: parallel after `G2` + `GR6`
- depends on: `P3`, `P4`, `P6`, `G2`
- owns: `apps/api/src/utils/errors.ts`, `apps/api/src/app.ts` error/not-found handlers, `apps/api/src/plugins/auth.ts` public responses, `apps/web/src/api/client.ts` and tests
- reads: accepted public error contract/catalog; `countryContext.ts` -> validation-time country; current client prose branches
- acceptance: validation, auth, not-found, and unknown failures emit typed safe codes/localized fallback; client exposes code/meta and captures request country; no raw internal detail
- non-goals: feature route migration, feature UI state migration
- upstream inputs: `P3` preValidation country; `P4` public codes; `P6` build settled
- changes: add `sendPublicError`; convert global handlers/auth; add `ApiError.code/meta`; retain temporary legacy helpers for route packets
- invariants: 500 never exposes exception; invalid request never exposes AJV details; status codes unchanged
- relevant evidence: `E3`, `E4`, `E6`
- test duty: `npm exec -w @shop/api -- tsx --test test/country/countryResolution.integration.test.ts test/errors/publicErrors.integration.test.ts && npm exec -w @shop/web -- vitest run --configLoader runner src/api/client.test.ts` -> `E9`
- verification: `E9` pass with malicious validation/exception fixtures
- handoff: safe helper + client error descriptor
- review: `R9` -> `GR9` blocks route and web error consumers

### P10: Canonical receipt persistence and API

- mode: parallel after `G2` + `GR6`
- depends on: `P3`, `P5`, `P6`, `P7`, `G2`
- owns: `apps/api/src/features/mailbox/mailboxRepository.ts`, `apps/api/src/routes/mailbox.ts`, `apps/api/src/features/checkout/checkoutFinalizer.ts` receipt block, receipt/checkout/mailbox API tests
- reads: migration `034`; accepted mailbox union; order repository country/totals; unit-of-work finalization
- acceptance: new confirmation stores order relationship and no formatted/converted receipt amount; repository supports validated template descriptors; mailbox response returns canonical facts from owning order; legacy messages still map
- non-goals: web receipt rendering; other mailbox producers
- upstream inputs: `P3` order country; `P5` schema; `P6` contract; `P7` GBP boundary
- changes: extend mailbox row/add/list for plain/template/receipt; validate parsed template parameters; join receipt order facts; replace checkout prose write with structured receipt; route validates response
- invariants: receipt insert stays in checkout transaction; ownership/access behavior unchanged; converted values never persist
- relevant evidence: `E3`, `E5`, `E6`, `E7`
- test duty: `npm exec -w @shop/api -- tsx --test test/checkout/payment.integration.test.ts test/mailbox/mailboxRoutes.integration.test.ts` -> `E10`
- verification: `E10` pass; DB assertion finds no `$`/converted receipt text
- handoff: canonical receipt API for `P21`, `P24`
- review: `R10` -> `GR10` blocks receipt UI

### P11: Account, identity, and trade public errors

- mode: parallel feature lane after `G3`
- depends on: `P9`, `G3`
- owns: buyer routes `auth.ts`, `accountDeletion.ts`, `accountSessions.ts`, `preferences.ts`, `accountExport.ts`, `tradeAccount.ts`, `companyAccounts.ts`, `orderApprovals.ts`; matching API tests
- reads: route/domain error maps -> status and concealment behavior; `sendPublicError` -> boundary contract
- acceptance: every owned failure emits stable code + safe metadata + localized fallback; no domain prose forwarding
- non-goals: domain rule changes, web UI, admin routes
- upstream inputs: `P9` error infrastructure
- changes: map existing domain identities to public codes; preserve country-bound auth and invite refusal; remove raw helper use in owned routes
- invariants: wrong-country credentials remain indistinguishable; ownership failures stay not-found where currently hidden
- relevant evidence: `E9`
- test duty: `npm exec -w @shop/api -- tsx --test test/auth/auth.integration.test.ts test/auth/countryIdentity.integration.test.ts test/accountDeletion/deletion.integration.test.ts test/preferences/preferences.integration.test.ts test/tradeAccount/tradeAccountRoutes.integration.test.ts test/companyAccounts/company.integration.test.ts test/companyAccounts/invites.integration.test.ts test/orderApprovals/approvalWorkflow.integration.test.ts` -> `E11`
- verification: `E11` pass with UK/DE response language and code assertions
- handoff: account/trade public-error mappings
- review: `R11` -> `GR11` blocks `G4`

### P12: Catalog, cart, order, and repeat public errors

- mode: parallel feature lane after `G3`
- depends on: `P9`, `G3`
- owns: buyer routes `products.ts`, `bundles.ts`, `cart.ts`, `customBlends.ts`, `orders.ts`, `reorder.ts`, `savedLists.ts`, `quickOrder.ts`, `backInStock.ts`; matching API tests
- reads: bulk-add/skip error unions -> stable identities; product/cart non-disclosure paths -> status behavior
- acceptance: owned routes expose typed localized errors; blocked/not-found/retired distinctions stay exactly as Stage 2 specifies
- non-goals: cart/order rules, web presentation
- upstream inputs: `P9` error infrastructure
- changes: replace direct `{error}` and legacy helper calls; carry code-specific IDs/count metadata only
- invariants: `BLOCKED_IN_COUNTRY` precedence; Quick Order `SKU_NOT_FOUND` distinction; no blocked-lot detail leakage
- relevant evidence: `E9`
- test duty: `npm exec -w @shop/api -- tsx --test test/catalog/products.integration.test.ts test/cart/cart.integration.test.ts test/reorder/reorderRoutes.integration.test.ts test/savedLists/savedListRoutes.integration.test.ts test/quickOrder/quickOrderRoutes.integration.test.ts test/backInStock/backInStockFlow.integration.test.ts` -> `E12`
- verification: `E12` pass with code/status/non-disclosure assertions
- handoff: commerce/repeat public-error mappings
- review: `R12` -> `GR12` blocks `G4`

### P13: Checkout, promo, return, review, and notification public errors

- mode: parallel feature lane after `G3`
- depends on: `P7`, `P9`, `G3`
- owns: buyer routes `payments.ts`, `promo.ts`, `deliverySlots.ts`, `returns.ts`, `reviews.ts`, `notifications.ts`, `standingOrders.ts`; `apps/api/src/features/promos/promoService.ts` threshold result; matching tests
- reads: payment result codes + current `error` machine identities; promo threshold string fork; return/review code maps
- acceptance: payment/promo state machines branch on codes; promo minimum carries canonical `minSubtotalCents`; no dollar formatting or raw message forwarding
- non-goals: pricing/payment arithmetic, web checkout
- upstream inputs: `P7` GBP boundary; `P9` public errors
- changes: normalize payment conflicts; add safe metadata; replace promo prose threshold with code + pence; migrate routes
- invariants: idempotency, reservation, stock, delivery, and authorization statuses unchanged
- relevant evidence: `E7`, `E9`
- test duty: `npm exec -w @shop/api -- tsx --test test/checkout/payment.integration.test.ts test/promos/promoCountry.integration.test.ts test/returns/customerReturns.integration.test.ts test/reviews/reviews.integration.test.ts test/notifications/notificationRoutes.integration.test.ts test/standingOrders/standingOrderRoutes.integration.test.ts` -> `E13`
- verification: `E13` pass; exact pence metadata and failure codes asserted
- handoff: checkout/lifecycle public-error mappings
- review: `R13` -> `GR13` blocks `G4`

### P14: Admin public errors

- mode: parallel feature lane after `G3`
- depends on: `P9`, `G3`
- owns: `apps/api/src/routes/admin*.ts`, `apps/api/src/routes/audit.ts`, matching admin route tests
- reads: admin service error codes -> current status maps; audit sanitization -> technical-data boundary
- acceptance: every admin route error uses selected admin country, stable code, safe metadata; no service exception prose leaks
- non-goals: admin service rules/UI, technical payload translation
- upstream inputs: `P9` error infrastructure
- changes: migrate product/lot/promo/order/user/review/refund/flag/job/webhook/audit route boundaries
- invariants: permissions, country scoping, audit writes, idempotency unchanged
- relevant evidence: `E9`
- test duty: `npm exec -w @shop/api -- tsx --test "test/admin*.integration.test.ts" "test/admin/**/*.integration.test.ts" test/audit/auditRoute.integration.test.ts` -> `E14`
- verification: `E14` pass with admin-country language assertions
- handoff: admin public-error mappings
- review: `R14` -> `GR14` blocks `G4`

### P15: Localized system messages and lifecycle copy

- mode: parallel feature lane after `G3`
- depends on: `P3`, `P10`, `G3`
- owns: proposed `packages/localisation/src/messages/asyncContent.ts`; API producers in `passwordReset`, `companyAccounts/companyService.ts` invite block, `orderApprovals/approvalService.ts` notification block, `accountExport`, `backInStock`, `standingOrders`, `webhooks`, `notifications/notificationDeliveryHandler.ts`, `orders/orderService.ts` system titles; seed async fixture; focused tests
- reads: owning user/order/company country lookups; notification/mailbox persistence APIs; system vs operator-authored order event boundary
- acceptance: notifications and system lifecycle titles use recipient/entity country and store translated snapshots; password-reset/invite/approval/export mail stores typed templates; approval total remains canonical pence; raw job/domain exception text never appears
- non-goals: structured order receipt, operator-entered tracking detail/title, UI shell
- upstream inputs: `P3` country provenance; `P2` translator; `P10` mailbox API
- changes: add typed async templates/params; translate notifications/lifecycle before snapshot persistence; store typed mailbox descriptors for password reset/invite/approval/export; preserve links/names/IDs as interpolation data
- invariants: user country authority; notification dedupe/preferences/retries unchanged; historical snapshots stable
- relevant evidence: `E3`, `E10`
- test duty: `npm exec -w @shop/api -- tsx --test test/passwordReset/passwordReset.integration.test.ts test/accountExport/dataExport.integration.test.ts test/orderApprovals/approvalWorkflow.integration.test.ts test/notifications/notificationService.integration.test.ts test/standingOrders/standingOrderService.integration.test.ts test/backInStock/backInStockFlow.integration.test.ts test/webhooks/webhookService.integration.test.ts` -> `E15`
- verification: `E15` pass with DE/FR snapshot assertions and no raw failure code
- handoff: localized persisted async/system copy
- review: `R15` -> `GR15` blocks `G4`

### P16: Discovery, catalog, bundles, and comparison UI

- mode: parallel web lane after `G3`
- depends on: `P8`, `P9`, `G3`
- owns: `apps/web/src/features/{catalog,bundles,comparison}/**`, `apps/web/src/components/home/**`, shared product grid/card/media/pagination components, `apps/web/src/hooks/{useProducts,useProductFilterOptions,useCategories,useBundles}.ts`, proposed `packages/localisation/src/messages/discovery.ts`
- reads: catalog contracts -> data fields to preserve; current filters/sorts/maps -> module-load copy; locale context -> format API
- acceptance: search/filter/sort/pagination/bundle/comparison copy translated; money/number/date displays use shared formatters; catalog values stay verbatim
- non-goals: product detail, custom blend, API rules
- upstream inputs: `P8` web adapter; `P9` error descriptors
- changes: replace static labels/maps with keys/factories; localize added-date chips; remove direct formatter use in owned files
- invariants: query parameters, category identifiers, product names/descriptions unchanged
- relevant evidence: `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/catalog src/features/bundles src/features/comparison src/components/ProductCard.test.tsx` -> `E16`
- verification: `E16` pass including US/DE price/date rerender and stale-request cases
- handoff: localized discovery UI
- review: `R16` -> `GR16` blocks `G4`

### P17: Product, review, packaging, and availability UI

- mode: parallel web lane after `G3`
- depends on: `P8`, `P9`, `G3`
- owns: `apps/web/src/features/product/**`, buyer `apps/web/src/features/backInStock/**`, `apps/web/src/features/designs/**`, packaging/artwork components, `NotifyWhenAvailableButton`, `apps/web/src/hooks/{BackInStockContext,useBackInStock,useProductReviews}*`, related tests, proposed `packages/localisation/src/messages/product.ts`
- reads: product contracts -> English data boundary; packaging resolver -> static warning/accessibility text; date/money forks in purchase/review surfaces
- acceptance: product controls, facts labels, reviews, stock alerts, artwork accessibility/warnings translated; catalog data unchanged; money/date/weights centralized
- non-goals: Custom Blend configurator, cart, API eligibility
- upstream inputs: `P8`, `P9`
- changes: migrate copy and formatters; translate shop-authored artwork labels without translating product facts/brand
- invariants: packaging resolver identity and colors unchanged; product availability semantics unchanged
- relevant evidence: `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/product src/features/backInStock src/components/packaging src/components/NotifyWhenAvailableButton.test.tsx` -> `E17`
- verification: `E17` pass with locale switch, clearance instant, review date, alert error scenarios
- handoff: localized product/availability UI
- review: `R17` -> `GR17` blocks `G4`

### P18: Custom Blend UI

- mode: parallel web lane after `G3`
- depends on: `P8`, `P9`, `G3`
- owns: `apps/web/src/features/customBlend/**`, proposed `packages/localisation/src/messages/customBlend.ts`
- reads: custom blend contracts/rules -> invariant vocabulary; state/presentation modules -> stored strings/plurals
- acceptance: configurator, validation, recipe, quantity grammar, made-to-order copy translated; product/ingredient names stay English; money centralized
- non-goals: API blend rules, packaging shared components owned by `P17`
- upstream inputs: `P8`, `P9`
- changes: key validation/presentation state; use locale plural/money helpers; keep config identity unchanged
- invariants: ratio bounds, MOQ, base/ingredient availability, fee rules unchanged
- relevant evidence: `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/customBlend` -> `E18`
- verification: `E18` pass including Polish plural and non-UK fee display
- handoff: localized Custom Blend UI
- review: `R18` -> `GR18` blocks `G4`

### P19: Cart UI and shared cart state

- mode: parallel web lane after `G3`
- depends on: `P8`, `P9`, `G3`
- owns: `apps/web/src/features/cart/**`, `apps/web/src/components/{CartSheet,CartLineItem}.tsx` and tests, `apps/web/src/hooks/{CartContext,useCart}.tsx`, proposed `packages/localisation/src/messages/cart.ts`
- reads: cart contracts/error codes; bulk tier/MOQ labels; cart country storage invariant
- acceptance: cart sheet/page/lines/errors translated; all money/weight/number output centralized; error state code-based and rerenders on country switch
- non-goals: checkout, saved lists, cart API/domain
- upstream inputs: `P4` public codes; `P8` locale adapter; `P9` client error descriptor
- changes: migrate copy/formatters; replace prose error map and missing-cart comparison with codes
- invariants: per-country cart IDs and line identity unchanged; converted figures never feed cart commands
- relevant evidence: `E4`, `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/cart src/components/CartSheet.test.tsx src/components/CartLineItem.test.tsx src/hooks/useCart.test.tsx src/hooks/useCart.country.test.tsx` -> `E19`
- verification: `E19` pass with admin country-cart isolation and dynamic currency/error language
- handoff: localized cart state/UI
- review: `R19` -> `GR19` blocks `G4`

### P20: Saved Lists, Quick Order, and reorder UI

- mode: parallel web lane after `G3`
- depends on: `P8`, `P9`, `G3`
- owns: `apps/web/src/features/{savedLists,quickOrder,reorder}/**`, `apps/web/src/hooks/{SavedListsContext,useSavedLists}*`, `SaveToListButton`, proposed `packages/localisation/src/messages/repeatBuying.ts`
- reads: shared skip reason contracts -> exhaustive labels; current presentation maps -> plural/error forks
- acceptance: lists, pasted-line outcomes, reorder drift, skip reasons, summaries translated; money centralized; code paths exhaustive
- non-goals: API bulk rules, cart-owned files
- upstream inputs: `P4` public codes; `P8` locale adapter; `P9` client error descriptor
- changes: key maps/presentation factories; localized plural branches; code-based async errors
- invariants: `SKU_NOT_FOUND` vs `BLOCKED_IN_COUNTRY`; `configKey` and server prices unchanged
- relevant evidence: `E4`, `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/savedLists src/features/quickOrder src/features/reorder` -> `E20`
- verification: `E20` pass; exhaustive seven-country skip catalog
- handoff: localized repeat-buying UI
- review: `R20` -> `GR20` blocks `G4`

### P21: Checkout and confirmation UI

- mode: parallel web lane after `G3`
- depends on: `P7`, `P8`, `P9`, `P10`, `G3`
- owns: `apps/web/src/features/checkout/**`, proposed `packages/localisation/src/messages/checkout.ts`
- reads: checkout/payment contracts + public error metadata; canonical receipt/order detail interface; authoritative form boundaries
- acceptance: all steps/errors/promo/delivery copy translated; local display figures throughout; final non-UK total shows local + GBP; UK deduplicates; confirmation same
- non-goals: order detail implementation owned `P22`; mailbox receipt owned `P24`; checkout arithmetic
- upstream inputs: GBP boundary, locale adapter, error codes, canonical receipt API
- changes: migrate strings/state to codes; replace `$0.00`; use dual-total primitive; localize delivery civil dates without day shift
- invariants: gateway/order pence untouched; promo minimum formats metadata only; async stale/cancel behavior preserved
- relevant evidence: `E7`, `E8`, `E9`, `E10`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/checkout` -> `E21`
- verification: `E21` pass with US/DE/UK totals, civil-day, payment-code, retry scenarios
- handoff: localized checkout/confirmation UI
- review: `R21` -> `GR21` blocks `G4`

### P22: Orders and returns UI

- mode: parallel web lane after `G3`
- depends on: `P8`, `P9`, `G3`
- owns: `apps/web/src/features/{orders,returns}/**`, proposed `packages/localisation/src/messages/orderLifecycle.ts`
- reads: order/return contracts -> statuses/data; `orderPresentation.ts` -> date/status forks; order detail money layout
- acceptance: history/detail/timeline/cancellation/return forms translated; instants use country zone; delivery date stays civil day; receipt/order total uses dual display
- non-goals: system event persistence, API lifecycle rules
- upstream inputs: `P4` public codes; `P8` locale adapter; `P9` client error descriptor
- changes: key status/window/reason maps; replace date/money forks; preserve user/operator event text as data
- invariants: return/cancellation eligibility and pence values unchanged; invalid timestamps do not render `Invalid Date`
- relevant evidence: `E4`, `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/orders src/features/returns` -> `E22`
- verification: `E22` pass with midnight/DST/civil-day and dual-total cases
- handoff: localized order/returns UI
- review: `R22` -> `GR22` blocks `G4`

### P23: Authentication and account UI

- mode: parallel web lane after `G3`
- depends on: `P8`, `P9`, `G3`
- owns: `apps/web/src/features/{auth,account}/**`, `apps/web/src/hooks/AuthContext.tsx`, proposed `packages/localisation/src/messages/identityAccount.ts`
- reads: auth/account contracts + codes; `PostalAddressFields.tsx` -> profile label/pattern; sessions date fork
- acceptance: login/signup/reset/sessions/preferences/deletion/export/address UI translated; postcode uses key; account errors code-based; session instant localized
- non-goals: auth API/security rules, company page
- upstream inputs: `P4` public codes; `P8` locale adapter; `P9` client error descriptor
- changes: migrate forms/accessibility/copy; remove raw profile label consumer; preserve country selector behavior
- invariants: account country wins after login; right password/wrong country fails; password inputs never logged/stored
- relevant evidence: `E4`, `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/auth src/features/account` -> `E23`
- verification: `E23` pass including Country Login integration and seven postcode labels
- handoff: localized identity/account UI
- review: `R23` -> `GR23` blocks `G4`

### P24: Company, approvals, notifications, schedules, and mailbox UI

- mode: parallel web lane after `G3`
- depends on: `P6`, `P8`, `P9`, `P10`, `G3`
- owns: `apps/web/src/features/{company,approvals,notifications,standingOrders,mailbox}/**`, `apps/web/src/hooks/{NotificationsContext,useNotifications}*`, proposed `packages/localisation/src/messages/tradeAsync.ts`
- reads: mailbox union; async snapshots; company/approval contracts; date/money form boundaries
- acceptance: trade/async UI translated; notifications preserve snapshot language; mailbox templates and receipt facts materialize in intended country; monetary mail renders local + GBP at last moment; threshold input remains GBP; dates centralized
- non-goals: product alert widget owned `P17`; API jobs; converted threshold/refund submission
- upstream inputs: mailbox contract/API, public error codes, web locale adapter; notification snapshots remain transport data
- changes: migrate copy/presentation maps; render typed mailbox templates and structured receipt; code-based errors; label authoritative GBP forms
- invariants: one-country company/invite rule; preference/dedupe/read state unchanged; links/user data raw
- relevant evidence: `E4`, `E6`, `E8`, `E9`, `E10`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/company src/features/approvals src/features/notifications src/features/standingOrders src/features/mailbox` -> `E24`
- verification: `E24` pass with DE snapshot, US receipt dual total, GBP threshold post
- handoff: localized trade/async/mailbox UI
- review: `R24` -> `GR24` blocks `G4`

### P25: Admin catalog UI

- mode: parallel web lane after `G3`
- depends on: `P8`, `P9`, `G3`
- owns: `apps/web/src/features/admin/{products,lots,promos}/**`, proposed `packages/localisation/src/messages/adminCatalog.ts`
- reads: admin contracts/codes; promo/clearance date input helpers; selected-country admin context
- acceptance: product/lot/promo forms/lists/dialogs/errors translated and displayed dates/money centralized; technical/catalog values remain raw
- non-goals: change `datetime-local` write semantics; backend admin rules
- upstream inputs: `P4` admin public codes; `P8` locale adapter; `P9` client descriptor
- changes: migrate labels/status/copy; format displayed instants; keep input ISO conversion in explicit allowlisted helper
- invariants: selected admin country, audit country, promo targeting, GBP authoritative inputs unchanged
- relevant evidence: `E4`, `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/admin/products src/features/admin/lots src/features/admin/promos` -> `E25`
- verification: `E25` pass including existing integration tests and DE display
- handoff: localized admin catalog lane
- review: `R25` -> `GR25` blocks `G4`

### P26: Admin commerce and people UI

- mode: parallel web lane after `G3`
- depends on: `P8`, `P9`, `G3`
- owns: `apps/web/src/features/admin/{orders,users,reviews}/**`, proposed `packages/localisation/src/messages/adminCommerce.ts`
- reads: admin order/refund/user/review contracts and codes; current money fork/input parser
- acceptance: orders/users/reviews UI translated; display money localized; refund input/result explicitly GBP and pence post unchanged
- non-goals: refund/order/user domain rules
- upstream inputs: `P4` admin public codes; `P8` locale adapter; `P9` client descriptor
- changes: remove local GBP formatter/bare pound strings; key copy/status; dual-display refundable balance near GBP input
- invariants: refund cap/idempotency/audit/permissions unchanged; user/catalog content raw
- relevant evidence: `E4`, `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/admin/orders src/features/admin/users src/features/admin/reviews` -> `E26`
- verification: `E26` pass with non-UK display + exact GBP refund request
- handoff: localized admin commerce lane
- review: `R26` -> `GR26` blocks `G4`

### P27: Admin diagnostics and shell UI

- mode: parallel web lane after `G3`
- depends on: `P8`, `P9`, `G3`
- owns: `apps/web/src/features/admin/{AdminLayout,AdminIndexPage,jobs,webhooks,featureFlags}*`, related files/tests, proposed `packages/localisation/src/messages/adminDiagnostics.ts`
- reads: admin diagnostics contracts -> technical-data boundary; raw ISO output sites; selected-country shell
- acceptance: admin shell/jobs/webhooks/flags shop labels/errors translated; instants localized; job kinds/payloads/IDs/raw diagnostics unchanged
- non-goals: API async behavior, payload translation
- upstream inputs: `P4` admin public codes; `P8` locale adapter; `P9` client descriptor
- changes: migrate nav/forms/status labels; format `runAt`, attempts, received/processed instants; preserve raw technical blocks
- invariants: all nine admin sections remain reachable/scoped; retry/toggle actions unchanged
- relevant evidence: `E4`, `E8`, `E9`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/admin/jobs src/features/admin/webhooks src/features/admin/featureFlags src/features/admin/AdminLayout.test.tsx` -> `E27`
- verification: `E27` pass including async/admin integration tests
- handoff: localized admin diagnostics lane
- review: `R27` -> `GR27` blocks `G4`

### P28: Help and policy content

- mode: parallel web lane after `G3`
- depends on: `P2`, `P8`, `G3`
- owns: `apps/web/src/features/help/**`, product context links, remaining footer help links if not migrated by `P8`, proposed `packages/localisation/src/messages/helpPolicy.ts`
- reads: stable help content IDs/registry; service/policy/FAQ article sources; pricing constant for blend fee
- acceptance: seven help articles + two policies + FAQ/shell materialize from exhaustive seven-country keys; IDs/slugs/paths/structure identical; fee formats during render
- non-goals: help API, route changes, product/catalog translation
- upstream inputs: shared translator/formatters and web adapter
- changes: replace authored text with stable keys; country-aware materializer; remove unused legacy Powder Co. article after zero-consumer check
- invariants: local-demo/no-real-commerce/safety meaning retained; no module-load formatted money
- relevant evidence: `E2`, `E8`
- test duty: `npm exec -w @shop/web -- vitest run --configLoader runner src/features/help && npm exec -w @shop/web -- vitest run --configLoader runner --config vitest.integration.config.ts src/features/help/HelpJourney.integration.test.tsx` -> `E28`
- verification: `E28` pass with structural parity, required concepts, dynamic fee
- handoff: localized help/policy registry
- review: `R28` -> `GR28` blocks `G4`

### P29: Translation and formatter surface guard

- mode: sequential after feature fan-in
- depends on: `P11`-`P28`, `G4`
- owns: proposed `scripts/check-localisation.mjs`, its fixtures/tests, proposed `apps/web/src/i18n/translationSurface.test.ts`, root `package.json`; residual files reported by checker only when ownership is explicitly transferred at `G4`
- reads: all accepted feature change sets; ESLint/TypeScript compiler availability; approved data/technical boundaries
- acceptance: guard rejects untranslated JSX/visible props/error setters/presentation maps/direct display `Intl`/`toLocale*`/raw route errors/literal generated-message writes; explicit narrow allowlist documented and tested
- non-goals: broad copy rewrite, browser/static visual inspection, catalog data translation
- upstream inputs: reviewed fan-in + accepted ownership transfer list
- changes: implement AST/static guard, root `check:localisation`, wire into `verify`; remove remaining `formatMoney.ts` and raw profile copy after zero-consumer proof
- invariants: allow API delivery computation and admin datetime serialization only; no wildcard directory exemption
- relevant evidence: `E11`-`E28`
- test duty: `npm run check:localisation` -> `E29`
- verification: `E29` pass; negative fixtures prove each forbidden pattern detected
- handoff: enforced no-fork/no-hardcoded-copy boundary
- review: `R29` -> `GR29` blocks convergence

### S1: Convergence, documentation, and regression gate

- mode: sequential after `GR29`
- depends on: all packets, `G5`
- owns: shared composition leftovers explicitly reserved for convergence, `AGENTS.md`, `README.md`, `plans/demo_project_high_level_plan.md`, `plans/country_localisation_handoff.md`, this plan status only; no feature rewrite
- reads: accepted handoffs/evidence; package/build manifests; seed/reset; high-level item 10 status
- acceptance: no legacy formatter/error/raw profile path; package/dependency graph settled; Stage 3 docs accurate; full reset, web integration tier, verify green
- non-goals: merge-back, worktree cleanup, new localization behavior
- upstream inputs: all accepted reviewed change sets + `E29`
- changes: resolve fan-in imports/test fixtures, run static audit, update repository map/migration head/package, document display-only rates/GBP receipt and country-aware demo behavior, mark item 10 complete
- invariants: no converted persistence; no catalog translation; no course spoiler or new runtime requirement
- relevant evidence: `E1`-`E29`, invalidated entries rerun only as needed
- test duty: `npm run reset` -> pass; `npm run test:integration` -> pass; `npm run verify` -> pass -> `E30AA`
- verification: `E30AA` pass 2026-08-07; web integration 18 files/54 tests; API integration 293 subtests/434 tests; verify 322s; `git status --short` contains only planned implementation changes
- handoff: retained implementation worktree + completion evidence + user-owned merge instructions
- review: `R30` -> `GR30` closed; R30 High follow-up fixes verified; no re-review per rule; `G6` complete

## Review Assignments

Every assignment carries: `review_skill=code-reviewer`; reviewer invokes `.claude/skills/code-reviewer`; critical + high severity gate; verification-before-reporting; supplied relevant evidence only; `test policy: assess supplied evidence, run command only when assigned or stale/missing evidence blocks verdict`; no writes.

### R1: Review profile metadata

- target: `P1` exact settled change set
- timing: immediately after `P1`; before `P2`
- blocks: `GR1`, `P2`
- consolidation reason: none
- reads: country profile type/files/tests
- acceptance: exact seven metadata fixtures, rational-rate and compatibility invariants
- invariants: stage-2 delivery/availability unchanged
- risk focus: wrong locale/rate; float semantics; missing profile
- non-goals: consumers
- relevant evidence: `E1`, `E1B`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R2: Review localisation workspace

- target: `P2` exact settled change set
- timing: immediately after `P2`; before `G1`
- blocks: `GR2`, `G1`
- consolidation reason: none
- reads: new workspace runtime/tests/manifests
- acceptance: exhaustive typed catalogs, placeholder/plural validation, pure deterministic formatters
- invariants: local-only; no active-country global; pence never mutated
- risk focus: rounding, civil-date shift, silent fallback, package cycle
- non-goals: feature copy
- relevant evidence: `E2`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R3: Review country authority and hooks

- target: `P3` exact settled change set
- timing: immediately after `P3`; before `P9`, `P10`, `P15`
- blocks: `GR3`, dependent API packets
- consolidation reason: none
- reads: auth/country hooks, order/company inserts, focused tests
- acceptance: validation-time country and non-UK persistence correct
- invariants: security, last-seen, transaction behavior
- risk focus: hook order, double mutation, UK default masking
- non-goals: translated errors/receipt
- relevant evidence: `E3`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R4: Review public error producer

- target: `P4` exact settled change set
- timing: immediately after `P4`; before `P6`, `P9`, routes
- blocks: `GR4`, error consumers
- consolidation reason: none
- reads: error schemas/codes/meta and API-error catalog
- acceptance: vocabulary exhaustive, metadata safe, translations total
- invariants: concealment identities and status meanings preserved
- risk focus: arbitrary detail, missing code, unsafe parameter
- non-goals: route migration
- relevant evidence: `E4`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R5: Review migration 034

- target: `P5` exact settled change set
- timing: immediately after `P5`; before receipt persistence
- blocks: `GR5`, `P10`
- consolidation reason: none
- reads: migration, index registration, schema test, runner
- acceptance: idempotent additive FK/index, legacy rows preserved, FK clean
- invariants: no landed migration edits; no converted field
- risk focus: FK behavior, head ordering, rerun
- non-goals: repository/contract
- relevant evidence: `E5`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R6: Review mailbox contract

- target: `P6` exact settled change set
- timing: immediately after `P6`; before API/UI receipt consumers
- blocks: `GR6`, `P10`, `P24`
- consolidation reason: none
- reads: mailbox schemas/tests and order/delivery types
- acceptance: strict discriminated variants; canonical pence facts only
- invariants: legacy plain messages validate
- risk focus: ambiguous union, converted field, missing country
- non-goals: persistence/UI
- relevant evidence: `E6`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R7: Review GBP gateway boundary

- target: `P7` exact settled change set
- timing: immediately after `P7`; before checkout consumers
- blocks: `GR7`, `P21`
- consolidation reason: none
- reads: gateway request/call and payment tests
- acceptance: exact pence + `GBP`; no downstream arithmetic change
- invariants: one settlement currency
- risk focus: accidental amount conversion or persisted currency
- non-goals: display
- relevant evidence: `E7`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R8: Review web locale shell

- target: `P8` exact settled change set
- timing: immediately after `P8`; before web feature lanes
- blocks: `GR8`, `P16`-`P28`
- consolidation reason: none
- reads: locale context, Layout, shell components/messages/tests
- acceptance: country switch rerenders and HTML language follows
- invariants: CountryContext remains sole state authority
- risk focus: module-load freeze, provider test breakage, raw profile copy
- non-goals: feature pages
- relevant evidence: `E8`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R9: Review error infrastructure

- target: `P9` exact settled change set
- timing: immediately after `P9`; before routes/UI consumers
- blocks: `GR9`, `P11`-`P14`, `P16`-`P27`
- consolidation reason: none
- reads: API handler/helpers/auth and web client tests
- acceptance: safe localized codes for generic failures; client code/meta stable
- invariants: status/security and request-country capture
- risk focus: exception/AJV leak, URL leak, prose branch regression
- non-goals: feature mapping
- relevant evidence: `E9`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R10: Review structured receipt API

- target: `P10` exact settled change set
- timing: immediately after `P10`; before receipt UI
- blocks: `GR10`, `P21`, `P24`
- consolidation reason: none
- reads: mailbox repository/route, checkout finalizer, tests
- acceptance: canonical facts returned; no converted/formatted stored value
- invariants: checkout atomicity and legacy messages
- risk focus: order-country mismatch, FK/orphan, money snapshot
- non-goals: UI
- relevant evidence: `E10`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R11: Review account/trade route errors

- target: `P11` exact settled change set
- timing: immediately after `P11`; before `G4`
- blocks: `GR11`, `G4`
- consolidation reason: none
- reads: owned routes, mappings, API tests
- acceptance: typed localized errors with preserved concealment/status
- invariants: country-bound identity/company rules
- risk focus: auth enumeration, cross-country invite leak
- non-goals: UI/domain edits
- relevant evidence: `E11`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R12: Review commerce route errors

- target: `P12` exact settled change set
- timing: immediately after `P12`; before `G4`
- blocks: `GR12`, `G4`
- consolidation reason: none
- reads: owned routes, bulk reasons, integration tests
- acceptance: codes/statuses exhaustive and non-disclosing
- invariants: blocked reason precedence and SKU distinction
- risk focus: blocked stock/retirement leak, prose fallback
- non-goals: rules/UI
- relevant evidence: `E12`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R13: Review checkout/lifecycle route errors

- target: `P13` exact settled change set
- timing: immediately after `P13`; before `G4`
- blocks: `GR13`, `G4`
- consolidation reason: none
- reads: payment/promo/return/review/async routes and tests
- acceptance: machine codes separated from copy; pence metadata exact
- invariants: idempotency/reservation/payment states
- risk focus: payment branch drift, promo dollar formatting
- non-goals: UI/arithmetic
- relevant evidence: `E13`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R14: Review admin route errors

- target: `P14` exact settled change set
- timing: immediately after `P14`; before `G4`
- blocks: `GR14`, `G4`
- consolidation reason: none
- reads: admin route mappings/tests
- acceptance: selected-country localized errors; safe metadata
- invariants: permissions/audit/idempotency
- risk focus: service exception leak, wrong admin country
- non-goals: admin UI/services
- relevant evidence: `E14`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R15: Review generated system copy

- target: `P15` exact settled change set
- timing: immediately after `P15`; before `G4`
- blocks: `GR15`, `G4`
- consolidation reason: none
- reads: async catalog, producers, country lookups, tests
- acceptance: recipient-country snapshots total; system titles keyed
- invariants: retries/dedupe/preferences and operator-authored data
- risk focus: raw failure text, wrong country, untranslated producer
- non-goals: receipt/UI
- relevant evidence: `E15`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R16: Review discovery UI

- target: `P16` exact settled change set
- timing: immediately after `P16`; before `G4`
- blocks: `GR16`, `G4`
- consolidation reason: none
- reads: discovery messages/components/tests
- acceptance: copy/formatters localized; catalog data untouched
- invariants: queries/routes/catalog identities
- risk focus: translated data, stale response, local formatter fork
- non-goals: product detail
- relevant evidence: `E16`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R17: Review product UI

- target: `P17` exact settled change set
- timing: immediately after `P17`; before `G4`
- blocks: `GR17`, `G4`
- consolidation reason: none
- reads: product/availability/artwork messages and tests
- acceptance: shop labels/accessibility localized; product data verbatim
- invariants: availability and packaging resolution
- risk focus: product-data translation, time-zone/date error
- non-goals: blend/cart
- relevant evidence: `E17`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R18: Review Custom Blend UI

- target: `P18` exact settled change set
- timing: immediately after `P18`; before `G4`
- blocks: `GR18`, `G4`
- consolidation reason: none
- reads: blend messages/state/components/tests
- acceptance: validation/plurals/money localized
- invariants: ratio/MOQ/fee/config identity
- risk focus: grammar branches, translated product data, fee drift
- non-goals: API
- relevant evidence: `E18`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R19: Review cart UI

- target: `P19` exact settled change set
- timing: immediately after `P19`; before `G4`
- blocks: `GR19`, `G4`
- consolidation reason: none
- reads: cart messages/components/state/tests
- acceptance: code-based errors and centralized formats rerender by country
- invariants: cart country/identity/server authority
- risk focus: converted value submission, stale translated state
- non-goals: checkout/repeat
- relevant evidence: `E19`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R20: Review repeat-buying UI

- target: `P20` exact settled change set
- timing: immediately after `P20`; before `G4`
- blocks: `GR20`, `G4`
- consolidation reason: none
- reads: three feature messages/presentation/state/tests
- acceptance: exhaustive localized outcomes/plurals/money
- invariants: skip vocabulary and price resolution
- risk focus: missing reason, SKU/block conflation
- non-goals: API/cart internals
- relevant evidence: `E20`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R21: Review checkout UI

- target: `P21` exact settled change set
- timing: immediately after `P21`; before `G4`
- blocks: `GR21`, `G4`
- consolidation reason: none
- reads: checkout messages/state/components/tests
- acceptance: local + GBP final total, code errors, civil dates
- invariants: pence/gateway/idempotency/stale handling
- risk focus: converted total feeding submit, UK duplication, date shift
- non-goals: order/mailbox UI
- relevant evidence: `E21`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R22: Review order/return UI

- target: `P22` exact settled change set
- timing: immediately after `P22`; before `G4`
- blocks: `GR22`, `G4`
- consolidation reason: none
- reads: lifecycle messages/presentation/components/tests
- acceptance: translated statuses/forms; instant/civil-date and dual money correct
- invariants: lifecycle/return rules and data text
- risk focus: booked-day shift, user event translation, refund display drift
- non-goals: API
- relevant evidence: `E22`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R23: Review auth/account UI

- target: `P23` exact settled change set
- timing: immediately after `P23`; before `G4`
- blocks: `GR23`, `G4`
- consolidation reason: none
- reads: identity/account messages/forms/state/tests
- acceptance: translated forms/errors/postcode/session dates
- invariants: country-bound auth and secret handling
- risk focus: wrong-country security regression, raw profile label
- non-goals: company
- relevant evidence: `E23`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R24: Review trade/async/mailbox UI

- target: `P24` exact settled change set
- timing: immediately after `P24`; before `G4`
- blocks: `GR24`, `G4`
- consolidation reason: none
- reads: trade/async messages, receipt branch, tests
- acceptance: localized UI/snapshots; receipt last-render dual money; GBP forms
- invariants: company country, notification state, canonical pence
- risk focus: translated snapshot retranslation, receipt wrong country, converted input
- non-goals: API jobs/product widget
- relevant evidence: `E24`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R25: Review admin catalog UI

- target: `P25` exact settled change set
- timing: immediately after `P25`; before `G4`
- blocks: `GR25`, `G4`
- consolidation reason: none
- reads: admin catalog messages/forms/tests
- acceptance: localized shop copy/display formats; technical data raw
- invariants: selected-country admin behavior and input instant semantics
- risk focus: locale display/write confusion, translated identifiers
- non-goals: backend
- relevant evidence: `E25`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R26: Review admin commerce UI

- target: `P26` exact settled change set
- timing: immediately after `P26`; before `G4`
- blocks: `GR26`, `G4`
- consolidation reason: none
- reads: admin commerce messages/forms/tests
- acceptance: localized UI; refund GBP authority explicit
- invariants: refund pence/idempotency/permissions
- risk focus: converted refund submission, bare pound fork
- non-goals: backend
- relevant evidence: `E26`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R27: Review admin diagnostics UI

- target: `P27` exact settled change set
- timing: immediately after `P27`; before `G4`
- blocks: `GR27`, `G4`
- consolidation reason: none
- reads: admin shell/diagnostic messages/date output/tests
- acceptance: translated shell labels; localized instants; raw diagnostics preserved
- invariants: actions/retries/toggles and nine-section reachability
- risk focus: payload translation, raw ISO display, wrong country
- non-goals: API async
- relevant evidence: `E27`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R28: Review help/policy content

- target: `P28` exact settled change set
- timing: immediately after `P28`; before `G4`
- blocks: `GR28`, `G4`
- consolidation reason: none
- reads: keyed registry/catalog/materializer/tests
- acceptance: seven-country structural parity and required warnings
- invariants: IDs/slugs/paths/catalog data and dynamic fee
- risk focus: missing safety/no-commerce meaning, module-load format
- non-goals: help API
- relevant evidence: `E28`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R29: Review localisation guard

- target: `P29` exact settled change set
- timing: immediately after `P29`; before convergence
- blocks: `GR29`, `S1`
- consolidation reason: none
- reads: checker, fixtures, allowlist, root script, residual removals
- acceptance: positive tree passes; negative fixtures catch each forbidden class
- invariants: narrow explicit exemptions only
- risk focus: false-negative wildcard, generated/test scanning, delivery-rule rejection
- non-goals: feature copy judgment
- relevant evidence: `E29`
- write policy: inspect-only
- return: `reviewer_report_v1`

### R30: Review convergence

- target: `S1` exact settled convergence change set
- timing: after convergence edits/evidence; before completion
- blocks: `GR30`, `G6`
- consolidation reason: none
- reads: full fan-in diff, manifests, docs, final evidence
- acceptance: Stage 3 scope complete; no legacy path; docs accurate; broad evidence current
- invariants: no converted persistence/catalog translation/runtime dependency
- risk focus: cross-lane key/import collision, incomplete status sync, stale evidence
- non-goals: merge/worktree cleanup
- relevant evidence: `E29`, `E30AA`, affected packet evidence
- write policy: inspect-only
- return: `reviewer_report_v1`

## Ownership and Collision Rules

- `packages/contracts/src/countryProfiles/**`: `P1` only; `S1` may remove compatibility fields after zero-consumer proof
- `packages/localisation` runtime/manifests: `P2` only; feature packets own only named message modules
- `packages/contracts/src/publicErrors.ts` + `common.ts`: `P4` only; `S1` may finalize required-code/removal after route migration
- `packages/contracts/src/mailbox.ts`: `P6` only
- migration version: `P5` reserves `034`; no other packet adds migration
- `apps/api/src/app.ts`, auth/country hooks: `P3` writes hook order first; `P9` writes error handlers later; all route lanes read only
- `checkoutFinalizer.ts`: `P3` owns country argument -> `P10` owns receipt block; `P15` excludes receipt
- API routes: `P11`-`P14` own disjoint explicit sets; no UI packet edits API
- web locale shell: `P8` only; feature packets consume without provider edits
- web feature paths: `P16`-`P28` disjoint as listed; shared path ambiguity resolved at `G3` before launch
- root manifests: `P2` owns workspace/dependencies; `P29` later adds checker script; `S1` reads only unless fan-in fix required
- translation catalogs: one named module per packet; wildcard export avoids shared registry
- tests: each packet owns colocated/focused files for its source; shared broad tests reserved for `S1`
- residual checker fixes: `P29` receives exact ownership transfer list at `G4`; otherwise reports blocker instead of editing another packet path
- concurrent commands: never run package builds, reset, migrations, or shared DB tests concurrently in same worktree; orchestrator serializes evidence commands even when code lanes run in parallel

## Harness Role Binding

- Codex only: launch globally configured `worker` agent for implementation/fixes/worker verification; launch globally configured `reviewer` for reviews. Never override models or reasoning in runtime plan/assignments.
- non-Codex harnesses: use harness-native roles while preserving worker/reviewer responsibilities and communication contracts.
- all harnesses: every reviewer assignment sets `review_skill=code-reviewer`; reviewer invokes skill explicitly.

## Test Execution Schedule

- `T0`: `G0` owner orchestrator -> prepend Node 22 path; `node --version`; `npm ci`; `npm exec -- tsx --version`; `npm run typecheck -w @shop/api`; `npm run verify`. Record `E0` baseline.
- `T1`: packet completion -> packet owner runs exact focused command listed once against settled packet change set.
- `T2`: reviewed foundation fan-in at `G2` -> orchestrator runs `npm run typecheck && npm run build --workspaces --if-present` once -> `EG2`.
- `T3`: feature fan-in after `GR11`-`GR28` -> `P29` runs `npm run check:localisation` once -> `E29`.
- `T4`: final owner `S1` after every fix -> `npm run reset && npm run test:integration && npm run verify` once -> `E30`.
- policy: automated repository commands only.
- reuse: passing evidence remains valid across sessions while its change set and invalidators stay unchanged; reviewers assess supplied evidence and do not rerun for confidence.
- invalidation: contract/profile/localisation runtime change invalidates every downstream typecheck/formatter/catalog test; migration/mailbox change invalidates receipt/API reset evidence; feature-only change invalidates its focused test + guard + final suite; manifest/config/fixture change invalidates build/reset/final suite.
- fix flow: stable finding ID -> fresh worker full assignment + fix directive -> smallest targeted verification -> orchestrator closes finding; no reviewer return loop.

## Agent Communication Contract

- style: `$llm-oriented-markdowns` for every subagent message and JSON string value
- transport: inline canonical JSON; temp artifacts only for bulky logs/diffs under `[temp]/orchestrator/[run_id]/[packet_id]/`
- context boundary: saved plan -> fresh runtime orchestrator -> fresh/minimal subagent context
- projection: packet objective, acceptance, owned/read paths, invariants, accepted upstream interface, relevant evidence, non-goals; exclude full plan/source plan/prior reports/global ledger/closed findings
- worker assignment: `worker_assignment_v1`
- reviewer assignment: `reviewer_assignment_v1`
- follow-up: `orchestrator_directive_v1`
- worker return: `worker_report_v1`
- reviewer return: `reviewer_report_v1`
- reviewer method: `code-reviewer`; assignment carries `review_skill=code-reviewer`
- recovery snapshot: `orchestrator_run_state_v1` at `[temp]/orchestrator/[run_id]/state.json`, atomically replaced
- worktree context: every assignment includes absolute worktree path, implementation branch, base revision; repository-relative paths resolve beneath worktree
- templates: `.claude/skills/write-orchestrator-coding-plan/templates/communication/*.json`
- record shapes: `.claude/skills/write-orchestrator-coding-plan/references/communication-record-shapes.md`
- reports: malformed schema -> correction directive; no free-text substitute

## Orchestrator Run Order

1. End planning context after saving plan.
2. Start fresh orchestrator; load repository instructions, saved plan, canonical communication contracts, current checkpoint.
3. Record source checkout/branch/`HEAD`; current relevant uncommitted handoff input triggers user baseline decision unless committed by then.
4. Create/verify dedicated branch + worktree; persist identity; select Node 22 and run `T0`.
5. Run `P1 -> R1 -> GR1 -> P2 -> R2 -> GR2`; rebuild shared packages; validate `G1`.
6. Launch `P3 || P4 || P5 || P7 || P8`; serialize their test commands; review each exact change set. Launch `P6` only after `GR4`.
7. Validate `G2` only after `GR3`-`GR8`; run shared type/build evidence once.
8. Launch `P9 || P10`; review; close findings through fresh workers; validate `G3`.
9. Project accepted interfaces only; launch `P11`-`P28` in disjoint lanes. Serialize commands touching shared build/DB state.
10. Review each settled lane before `G4`; close critical/high findings through fresh workers + targeted evidence.
11. Validate all reviews/handoffs; form exact residual-ownership list; launch `P29`, review, validate `G5`.
12. Launch `S1`; resolve composition/docs only; run final integration/reset/verify once; review convergence; close findings without re-review.
13. Validate `G6`; keep branch/worktree intact; reply with worktree path, implementation/source branches, base revision, evidence summary, user-owned merge note.

## Risks and Open Questions

- risk: translation semantic quality cannot be proven by structural tests -> mitigation: exhaustive parity + required-concept tests + reviewer inspection; optional native-speaker review remains user-owned follow-up, never implementation gate
- risk: 127-file surface leaves hidden hardcoded copy -> mitigation: AST guard + negative fixtures + final zero-fork searches
- risk: feature workers edit shared catalogs -> mitigation: feature-sliced modules + wildcard export + ownership gate
- risk: converted value enters command/write form -> mitigation: distinct display/settlement APIs, GBP-labelled form tests, static review focus
- risk: order/company UK defaults hide country bug -> mitigation: `P3` prerequisite + non-UK SQLite integration tests
- risk: validation localization changes auth hook timing -> mitigation: read-only `preValidation`, last-seen retained in `preHandler`, security/last-seen tests
- risk: persisted receipt violates last-render rule -> mitigation: migration `034` stores order relationship only; contract exposes canonical facts
- risk: server snapshot messages do not change when admin later switches browsing country -> mitigation: intentional recipient-country snapshot; historical email/notification language stays stable
- risk: translated long-form policy loses safety/no-commerce meaning -> mitigation: required-concept parity tests and dedicated review risk focus
- risk: direct `Intl` guard rejects Stage-2 delivery computation -> mitigation: exact API computation exemption, no general API directory exemption
- question: none blocking. Handoff states no open product decisions. Admin `datetime-local` write interpretation explicitly remains outside Stage 3.

## Done Criteria

- every supported country has exact checked-in language/locale/currency/rate config and complete message coverage
- all shop-authored customer/admin/help/policy/accessibility/public-error/system copy resolves through keys; product/catalog/operator/user/technical data stays raw
- direct web display `Intl.NumberFormat`, `Intl.DateTimeFormat`, `toLocale*`, hardcoded money symbols, and legacy `formatMoney.ts` eliminated outside explicit guard exemptions
- local display conversion occurs only during formatting; stored/charged/refunded/reserved/snapshotted commerce values remain integer pence
- gateway uses exact pence + `GBP`
- non-UK checkout/order/company country persists correctly
- non-UK checkout/confirmation/mailbox receipt shows converted total + authoritative GBP; UK shows one GBP total; converted receipt values never persist
- public errors always carry stable code/safe metadata; raw exception/AJV/URL details never escape
- async/system messages use owning recipient/entity country and preserve retry/dedupe/audit behavior
- `npm run check:localisation`, `npm run reset`, `npm run test:integration`, `npm run verify` pass on final reviewed change set
- README, `AGENTS.md`, high-level plan, handoff, and plan status accurately describe completed Stage 3 and migration head `034`
- completion leaves dedicated implementation worktree/branch intact for user merge
