# Custom Blend plan grading guide

Grade QME-418 (`feature-ticket.md`) plans by proposed test coverage, not current application pass/fail. Example shows full-score coverage; equivalent scenarios, ordering, wording, and valid data earn same score.

## How to grade

1. Read candidate plan once. Requirements reference -> ticket supplied to planner.
2. Score each numbered check: **explicit coverage -> 5 points; otherwise -> 0**. Require all parts. Accept equivalent wording and shared setup; never infer missing assertions from scenario titles or AC labels.
3. Cite short phrase or scenario number per check. Zero -> state missing/incorrect point. Count each check once, wherever covered.
4. Accept combined/split scenarios. Lower-level tests justify omitting rule permutations; cannot replace core browser journeys in checks 1–15.
5. Use same rubric and repository revision across candidates. Consult code only for disputed factual claims. Reference changed -> record difference; apply same correction across candidates.
6. Report score, core gaps, and up to three improvements. Never rewrite plan. Record prompt compliance separately; no content-score impact.

Ignore plan length, scenario count, example similarity, and producing `AGENTS.md` configuration. Workshop host records token usage separately.

## Scoring: 20 checks × 5 points = 100

**Checks 1–15 -> required core coverage.** Report missing checks as core gaps regardless of total. Current defects never excuse omitted expected behaviour; tests can be marked expected to fail.

1. **AC1:** Guest reaches configurator; creates valid blend using base, at least one ingredient, and proportions.
2. **AC1:** Adding -> exactly one cart line with chosen blend and visible total.
3. **AC1:** Journey checks continuing shopping and checkout access after adding. Separate purchases unnecessary.
4. **AC2:** Proportion changes -> updated material cost and blend total without reload.
5. **AC2:** Summary checks blending fee and total calculation; never incorrectly requires flat fee changes with proportions.
6. **AC3:** Food-compatible blend -> visible food classification in summary.
7. **AC3:** Non-food blend -> visible non-food classification and readable handling guidance in summary.
8. **AC4:** Concrete UI-permitted combination -> evaluation rejection with clear visible reason. Disabled ingredient/invalid input checks alone insufficient.
9. **AC4:** Rejection -> adding blocked; cart unchanged.
10. **AC4:** Rejected configuration retained -> corrected -> successfully added.
11. **AC5:** Editing single blend restores base, ingredients, and proportions.
12. **AC5:** Saving changed blend -> updated composition and price in same cart line; no duplicate.
13. **AC6:** Guest completes checkout -> order confirmation; blend present on both screens.
14. **AC6:** Compare composition, quantity, currency, and line price across configurator, checkout, and confirmation. Shared comparison instructions count.
15. **AC6:** Account for delivery/other charges and discounts separately from blend price. Explicit no-discount setup sufficient.
16. **Usable data:** Identify suitable materials, ratios, quantity, and locale/currency. Account for 25 kg bags and applicable minimum order; never assume one bag purchasable.
17. **Independence:** Each scenario owns guest session and cart; checkout retains session through confirmation. No scenario dependencies or shared database resets during parallel tests.
18. **Executable plan:** Include priorities, preparation, numbered user actions, observable expected results, and AC mappings. Shared preparation sufficient.
19. **Focused E2E scope:** Representative UI journeys; avoid exhaustive rule/price/API matrix already covered below E2E. Assertions check UI; no test/application implementation supplied.
20. **Evidence and uncertainty:** Distinguish checked facts from assumptions; flag relevant ticket/code differences. Browser exploration optional; unavailable -> state limitation without invented observations.

## Do not grade these as fixed answers

- **Exact prices, fees, delivery charges, product labels, dates, order IDs, error wording:** Depend on seed data, locale, and time. Require clear price oracle -> controlled expected amounts or stated calculation, plus cross-screen consistency. “Price looks correct” insufficient. Numeric examples must be internally consistent.
- **Exact rejection recipe:** Accept any verified, UI-constructible combination rejected by evaluation. Example -> combined pigment above 10%. Invented/unreachable failure fails check 8.
- **Scenario count, P0/P1 labels, food/non-food materials:** Accept sensible risk ordering and equivalent valid coverage.
- **Live browser access/local setup success:** Missing browsers, installation failures, ports, formatting failures, missing helper-agent files -> environment findings; no plan-quality deductions. Discovery of these issues optional.
- **Current handling-guidance defect:** Earlier exploration found tiny PPE text and guidance available only to assistive technology. Require intended readable guidance; exact diagnosis, PPE items, or defect discovery unnecessary for full marks.
- **Source-file inventories/exhaustive existing-test lists:** Brief explanation of E2E contribution sufficient. No points for naming guide files or copying prose.

Administrative compliance -> separate: required headings/order, word limit, output path, plan-only changes. Report subagent violation only with execution evidence; plan text cannot prove violation. Candidate prompt's file-reading and coverage-inventory sections intentionally omitted.

## Example full-score plan: essential content

**Shared preparation:** Known workshop seed data, UK/GBP, no promotion, four 25 kg bags for materials below. Each scenario -> own guest context and empty cart; retain context throughout purchase. Prepare isolated database before suite; never reset shared data during tests. Use named seed constants; calculate expected material cost + configured flat blending fee. Check visible UI values with waiting assertions.

**1. Highest priority — create and reprice a food blend (AC1–AC3).** Data: All-Purpose Flour with Cocoa material; cocoa 25%, then 20%.

1. Guest opens Custom Blend from category menu; selects materials and initial ratio. Expect food classification and summary containing composition, material cost, blending fee, total.
2. Change cocoa to 20%. Without reload -> 80/20 composition, recalculated material cost and total. Flat fee unchanged; total = materials + fee.
3. Add blend. Verify continue-shopping option and checkout route. Continue shopping -> open cart: exactly one blend line, chosen composition, four bags, expected total.

**2. Highest priority — complete guest purchase (AC1, AC6).** Data: new flour/cocoa 70/30 blend, valid GB contact/address details, supported test card, future expiry, available delivery slot.

1. Create and add blend; record composition, quantity, currency, calculated line price.
2. Proceed to checkout; enter guest delivery, billing, payment details. Compare blend against configurator. Check delivery separately, no discount, order total = blend price + delivery.
3. Pay -> confirmation. Expect order reference and same blend composition, quantity, currency, line price, delivery, order total.

**3. Next priority — edit without duplication (AC5).** Data: new cart containing one flour/cocoa 75/25 blend.

1. Edit blend. Expect original base, cocoa selection, proportions restored.
2. Change cocoa to 30% -> wait for evaluation -> save.
3. Expect exactly one cart line, updated 70/30 composition, recalculated price, unchanged quantity.

**4. Next priority — non-food safety (AC3).** Data: Plaster of Paris 90%, Titanium White pigment 5%, Iron Oxide Red pigment 5%.

1. Configure blend -> wait for evaluation.
2. Expect non-food classification and readable handling guidance in summary. Assistive-only text cannot establish visual readability. Missing/unreadable guidance -> product defect.

**5. Next priority — rejection and recovery (AC4).** Data: Plaster of Paris with Titanium White 6% and Iron Oxide Red 5%.

1. Select both pigments; set ratios. Expect evaluation explanation -> combined pigment exceeds allowed limit.
2. Verify adding blocked, cart empty, chosen materials and ratios retained for editing.
3. Reduce Titanium White to 5%. Expect successful evaluation -> add -> exactly one 90/5/5 blend line.

**Scope and assumptions:** Browser transitions and representative outcomes -> E2E. Exhaustive compatibility, percentage boundaries, price tiers, deduplication permutations -> existing lower-level tests. Ticket's 25 kg description -> bag size; these bases require four bags. Ratio changes leave flat blending fee unchanged. Recheck seeds before fixing numeric price expectations. Report browser access and unverified assumptions honestly; planned safety assertion remains valid despite current UI failures.

## Grader response format

- **Score:** N/100; K/15 core checks met.
- **Evidence:** Short line per check -> number, 0 or 5, supporting scenario/quote or missing point.
- **Core gaps:** Missing check numbers + brief descriptions, or “None”.
- **Top improvements:** Up to three concrete changes; highest impact first.
- **Separate notes:** Prompt compliance, unresolved factual uncertainty, environment limitations. No extra deductions.
