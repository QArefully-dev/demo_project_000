# Country Localisation Handoff (high-level plan item 10)

Status: stages 1-3 complete (2026-08-03, 2026-08-05, 2026-08-07). Migration head: `034`.
E30AA (2026-08-07): Node v22.23.1/npm 10.9.8; format, lint, all-workspace typecheck, and localisation guard pass (879 source files, 0 findings); reset pass; integration pass (web 18 files/54 tests, API 293 subtests/434 tests); verify pass in 322s, including all-workspace tests/builds. R30 High closed; follow-up format and stale postcode consumer fixes have focused evidence; no re-review per rule. Final completion.
Audience: implementation and review agents; retained product decision record.
Source: grilling session against `plans/demo_project_high_level_plan.md` item 10. Decisions are user's, recorded verbatim in intent.

## Scope Shift vs Plan Text

Item 10 text is now WRONG in four places. Rewrite it alongside implementation:
- "Europe" -> not a country. Replaced by seven named countries.
- "trading hours" -> DROPPED. Leftover from rejected live-trading direction.
- "translation ... belongs to a dedicated future plan" -> translation IS in scope.
- "multi-currency belongs to a dedicated future plan" -> display conversion IS in scope; stored currency is not.

## Countries

Seven: `UK`, `US`, `CN`, `PL`, `ES`, `DE`, `FR`.
Default for logged-out visitor: `US`.
All existing data migrates to: `UK`.

## Money

- authoritative money unchanged: integer pence, server-resolved, one currency.
- each country file holds fixed made-up exchange rate. No network, no live rates.
- conversion is display-only, applied at last moment before render.
- nothing stored, charged, refunded, or snapshotted changes currency. Order records stay pence.
- checkout and receipt show real `£` total alongside converted figure.
- Stage 3 result: `@shop/localisation` owns translation and number/date/money formatters. Fixed profile rates convert display values only. Gateway and settlement use GBP; receipts render canonical order facts at read time. No formatter forks or ambient browser locale remain.

## Identity

- user account belongs to exactly one country.
- same email may exist once PER COUNTRY -> separate accounts, separate passwords, carts, orders.
- schema impact: `users.email TEXT NOT NULL UNIQUE` (`db/migrations/001_initial.ts:69`) becomes unique per `(email, country)`.
- login form gains country dropdown. Email alone no longer identifies account.
- security test target: right password + wrong country -> must fail.
- admins are ordinary country-bound accounts. `admin` role unlocks top-bar country picker. No separate login path.
- switching admin holds separate cart per country -> one admin can hold 7 independent carts. Cross-contamination is a bug.
- company accounts are single-country. Invite to user in another country -> rejected with clear message.
- knock-on: password reset, invites, sessions, account-deletion tombstones all inherit the new uniqueness rule.

**Stage 1 deferral — admin picker unlock.** Stage 1 keeps `countryDisabled = user !== null` (`apps/web/src/components/Header.tsx:20`), so a signed-in admin gets the same disabled, account-bound picker as a customer. The `admin` role unlock described above is intentionally NOT implemented in stage 1 and no admin behaviour was changed. Stage 2 must decide how an admin's browsing country relates to their account country (and to the cart) before the unlock lands. Current stage-1 behaviour is pinned by `apps/web/src/components/Header.test.tsx` ("also disables the country picker for admins in stage 1"); that test must be updated when the unlock ships.

## Country Selection

- picker in top bar, visible to everyone including logged-out visitors.
- logged-out: defaults `US`, remembered in browser.
- on login: account's country wins.
- guest cart built in country X + login to account in country Y -> cart does NOT follow. State plainly. Never silently merge, never silently bin.
- anonymous carts already exist (`routes/cart.ts:28` -> `{ type: 'anonymous', userId: null }`), so guest country is required, not optional.
- rejected: IP/geolocation guess, derive-from-delivery-address, login-to-see-catalog.

## Availability Rules

- enforcement is SERVER-side. Blocked product is absent from API catalog response, refuses direct product URL, refuses cart add. Menu-hiding alone is rejected.
- blocking granularity: BOTH category-level and product-level, per country.
- one shared stock pool across all seven countries. Country decides permission to buy, not quantity in existence.
  - retained QA value: UK buyer vs DE buyer racing for last pallet.
  - rejected: per-country stock (would multiply inventory rows, reservations, and back-in-stock alerts by 7).
- no cross-border delivery. Deliver inside own country only. Rejected alternative pulled in customs, per-border freight, per-border lead time.
- per-country postcode rule and label in each country file: `US` 5-digit + "ZIP", `PL` `00-001`, `CN` 6-digit, `UK` current format, etc. Today one loose generic pattern (`packages/contracts/src/address.ts:22`).
- no ordering blackout. Country time zone instead drives DELIVERY CUT-OFF.
  - today all delivery date maths is UTC-only and clock-injected (`features/delivery/deliverySlotRules.ts:16`); `features/standingOrders/standingOrderRules.ts` is all `setUTC*`.
  - edge cases wanted: midnight boundary, daylight saving.

## Configuration Location

One config file per country. Checked in, resets with seed. Holds:
- language, exchange rate, number/date formats, time zone, postcode rule + label
- blocked categories, blocked products, banner

Promotions stay in DATABASE. Existing `/admin` promo screens gain a country-targeting field. Rationale: item 9 already landed working promo administration; a second promo system in a file would give two sources that disagree.

`/admin` follows the selected country across all nine sections (`products`, `lots`, `promos`, `orders`, `users`, `reviews`, `featureFlags`, `jobs`, `webhooks`). Admin operates inside exactly one country at a time. Audit event records which country the admin stood in.

## Language

- every piece of shop's own wording moves behind lookup key: buttons, menus, error messages, policy pages, banners.
- translated for all seven countries.
- product names and descriptions stay ENGLISH. Catalog data is not translated.
- `@shop/localisation` owns exhaustive seven-country message bundles and render-time lookup.

## Seed and Migration

- migration assigns `UK` to all existing users, orders, carts, saved lists, company accounts, products.
- migration `034` adds typed mailbox template and order-receipt storage without persisting converted money.
- required fixtures:
  - same email registered in `UK` and `DE` -> different passwords, different carts. Primary demo of the feature.
  - one category blocked in one country (sports drinks precedent).
  - banner visible only in `ES`.
  - promo targeting some countries, not others.
- README / demo credentials must state the country out loud: seeded accounts are `UK` except the separate `DE` Alice fixture; default landing country is `US`, so Alice fails to log in until dropdown is changed.

## Delivery Stages

Three stages, each independently shippable and testable.
1. country exists: login dropdown, top-bar picker, migration, everything -> `UK`, `US` default. No other visible behaviour change. **Stage 1: landed 2026-08-03.**
2. behaviour: blocking (category + product), banners, country-targeted promos, cross-border delivery refusal, postcode rules, time-zone delivery cut-off. Security tests live here. **Stage 2: landed 2026-08-05.**
3. sweep: translation lookup layer, formatting consolidation, money/date formatter defork. **Stage 3: landed 2026-08-07.**

Rejected: single big branch. Surface is too wide (login, every screen, catalog, cart, checkout, 9 admin sections, migration).

## Blocked Product Meets Existing Features

`BLOCKED_IN_COUNTRY` joins the shared skip-reason enum in `features/cart/cartBulkAddRules.ts` and takes FIRST position:

`BLOCKED_IN_COUNTRY` -> `VARIANT_RETIRED` -> `BLEND_UNAVAILABLE` -> `INVALID_QUANTITY` -> `INSUFFICIENT_STOCK` -> `BELOW_MOQ`

Rationale: blocking is the only reason that means "this lot does not exist for you". Any lower position lets a buyer learn a blocked lot's retirement or stock state, which contradicts server-side enforcement above. Highest precedence also gives one consistent answer regardless of the lot's other state.

Consumers inheriting it, no parallel vocabulary: reorder (12), saved lists (13), Quick Order (14). Quick Order additionally reaches it via SKU paste, so an unknown SKU and a blocked SKU must stay distinguishable (`SKU_NOT_FOUND` vs `BLOCKED_IN_COUNTRY`).

Back-in-stock (15): a `pending` alert whose lot becomes blocked in the subscriber's country is CANCELLED, reusing the existing retired/inactive-lot cancellation path in `features/backInStock/`. Cancel on the same terms as retirement: the lot can never become purchasable for that buyer, so leaving it `pending` would fire a notification for something they cannot buy. Handler re-reads eligibility inside its own transaction at drain time, so a block landing mid-drain is respected.

Custom Blend (16): a blend whose base lot or any ingredient is blocked in the buyer's country is unavailable. Reuses `BLEND_UNAVAILABLE` rather than adding a second blend-specific reason.

## High-Level Plan Sync

DONE 2026-08-03. `plans/demo_project_high_level_plan.md` rewritten to match this handoff:
- item 10 body replaced. `USA / Europe / China` sketch, trading hours, and the translation/multi-currency exclusions are gone. Item now carries countries, identity, availability, delivery, money, language, configuration, shared vocabulary, staging, and a `rejected, do not re-add` list.
- "Landed 8 and 15 constrain later work" -> corrected. One shared stock pool means country availability never writes stock and never raises a stock-change event, so item 10 does NOT call `StockChangeObserver`. Prior text assumed it might.
- "Landed 9 constrains later work" -> corrected. Per-country profile is a checked-in file, not admin data; only promo country targeting and the country-scoped shell are administered.

No open decisions remain. Stage 3 is landed 2026-08-07. R30 High is closed with no re-review per rule. Country-aware demo behavior, display-only rates, GBP settlement/receipts, and migration head `034` are current implementation facts.
