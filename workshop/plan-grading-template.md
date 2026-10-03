# Custom Blend plan grading guide

Grade QME-418 (`feature-ticket.md`) plans by proposed test coverage, not current application pass/fail. Example shows full-score coverage; equivalent scenarios, ordering, wording, and valid data earn same score.

## How to grade

1. Read candidate plan once. Requirements reference -> ticket supplied to planner.
2. Score each numbered check: **explicit coverage -> 5 points; otherwise -> 0**. Require all parts. Accept equivalent wording and shared setup; never infer missing assertions from scenario titles or AC labels.
3. Cite short phrase or scenario number per check. Zero -> state missing/incorrect point. Count each check once, wherever covered.
4. Accept combined or split coverage for content scoring. Lower-level tests justify omitting rule permutations; they cannot replace core browser journeys in checks 1–12. Apply the four-scenario limit only in prompt compliance.
5. Use same rubric and repository revision across candidates. Consult static code and tests for disputed factual claims. Reference changed -> record difference; apply same correction across candidates.
6. Report score, core gaps, and up to three improvements. Never rewrite plan. Record prompt compliance separately; no content-score impact.

Ignore token usage, example similarity, and producing `AGENTS.md` configuration. Workshop host records token usage separately. This workshop uses static code and test reading only; the planner designs browser E2E journeys without running them.

## Scoring: 17 checks × 5 points = 85 raw points

**Checks 1–12 -> required core coverage.** Report K/12 core checks met and list missing checks as core gaps regardless of total. Current defects never excuse omitted expected behaviour; planned assertions can be marked expected to fail. Normalize to 100 with **round(100 × raw points / 85)** to the nearest whole number.

1. **AC1:** Guest reaches configurator; creates valid blend using base, at least one ingredient, and proportions.
2. **AC1:** Adding -> exactly one cart line with chosen blend and visible total.
3. **AC1:** After adding, journey checks the continue-shopping option and the checkout navigation control, including its destination. Do not complete checkout.
4. **AC2:** Proportion changes -> updated material cost and blend total without reload.
5. **AC2:** Summary checks blending fee and total calculation; never incorrectly requires flat fee changes with proportions.
6. **AC3:** Food-compatible blend -> visible food classification in summary.
7. **AC3:** Non-food blend -> visible non-food classification and readable handling guidance in summary.
8. **AC4:** Concrete UI-permitted combination -> evaluation rejection with clear visible reason. Disabled ingredient/invalid input checks alone insufficient.
9. **AC4:** Rejection -> adding blocked; cart unchanged.
10. **AC4:** Rejected configuration retained -> corrected -> successfully added.
11. **AC5:** Editing single blend restores base, ingredients, and proportions.
12. **AC5:** Saving changed blend -> updated composition and price in same cart line; no duplicate.
13. **Usable data:** Identify suitable materials, ratios, quantity, and locale/currency. Account for 25 kg bags and applicable minimum order; never assume one bag purchasable.
14. **Independence:** Each scenario owns guest session and cart. No scenario dependencies or shared database resets during parallel tests.
15. **Executable plan:** Include priorities, preparation, numbered user actions, observable expected results, and AC mappings. Shared preparation sufficient.
16. **Focused E2E scope:** Representative browser journeys; avoid exhaustive rule/price/API matrix already covered below E2E. Assertions check visible UI; no test/application implementation supplied.
17. **Evidence and uncertainty:** Distinguish facts checked in ticket/code/tests from assumptions; flag relevant differences. Do not invent browser observations.

## Do not grade these as fixed answers

- **Exact prices, fees, product labels, or error wording:** Depend on seed data and locale. Require clear price oracle -> controlled expected amounts or stated calculation, plus summary/cart consistency. “Price looks correct” insufficient. Numeric examples must be internally consistent.
- **Exact rejection recipe:** Accept any verified, UI-constructible combination rejected by evaluation. Example -> combined pigment above 10%. Invented/unreachable failure fails check 8.
- **Scenario count, P0/P1 labels, food/non-food materials:** Accept sensible risk ordering and equivalent valid coverage.
- **Current handling-guidance defect:** Earlier exploration found tiny PPE text and guidance available only to assistive technology. Require intended readable guidance; exact diagnosis, PPE items, or defect discovery unnecessary for full marks.
- **Source-file inventories/exhaustive existing-test lists:** Brief explanation of E2E contribution sufficient. No points for naming guide files or copying prose.

Prompt compliance -> separate: required headings in order (`Scenarios`, `Existing coverage`, `Risks`, `Approach`), at most four independent prioritized scenarios, at most 900 words, required output path, plan-only changes, and no `Files to read` section. Permitted investigation is static code/test reading only: no browser interaction, application startup, test execution, installation, or reset; no subagents or user questions. Do not require a browser-unavailable note. Report execution violations only with evidence; plan text alone cannot prove one. No content-score deductions for compliance issues.

## Example full-score plan: essential content

### Scenarios

**Shared preparation:** Known workshop seed data, UK/GBP, no promotion, and four 25 kg bags where the minimum order requires them. Each scenario has its own guest session and empty cart. Use named seed constants; calculate expected material cost plus the configured flat blending fee. Plan waiting assertions for visible UI updates.

**1. Highest priority — create, reprice, and add a food blend (AC1–AC3).** Data: All-Purpose Flour with Cocoa material; cocoa 25%, then 20%.

1. Guest opens Custom Blend from the category menu and selects materials and the initial ratio. Expect food classification and a summary with composition, material cost, blending fee, and total.
2. Change cocoa to 20%. Without reload, expect 80/20 composition, recalculated material cost and total, unchanged flat fee, and total equal to materials plus fee.
3. Add the blend. Expect a continue-shopping option and checkout control. Verify the checkout control targets the checkout route without proceeding through checkout. Continue shopping, then open the cart: exactly one blend line with chosen composition, four bags, and expected total.

**2. Highest priority — rejection and recovery (AC4).** Data: Plaster of Paris with Titanium White pigment 6% and Iron Oxide Red pigment 5%.

1. Select both pigments and set ratios through available UI controls. Expect evaluation to explain that combined pigment exceeds the allowed limit.
2. Expect adding to be blocked, the cart to remain empty, and the chosen materials and ratios to remain available for correction.
3. Reduce Titanium White to 5%. Expect successful evaluation and addition of exactly one 90/5/5 blend line.

**3. Next priority — edit without duplication (AC5).** Data: a fresh cart with one flour/cocoa 75/25 blend.

1. Edit the blend. Expect original base, cocoa selection, and proportions restored.
2. Change cocoa to 30%, wait for evaluation, and save.
3. Expect exactly one cart line, updated 70/30 composition, recalculated price, and unchanged quantity.

**4. Next priority — non-food handling guidance (AC3).** Data: Plaster of Paris 90%, Titanium White pigment 5%, Iron Oxide Red pigment 5%.

1. Configure the blend and wait for evaluation.
2. Expect non-food classification and readable handling guidance in the summary. Assistive-only text does not establish visual readability; missing or unreadable guidance is a product defect.

### Existing coverage

Existing lower-level tests cover compatibility, percentage boundaries, price tiers, and API behavior. These E2E journeys check representative guest UI transitions and visible outcomes.

### Risks

Recheck seeds and fee configuration before fixing numeric expectations. Four 25 kg bags satisfy the applicable minimum for these bases. Ratio changes leave the flat blending fee unchanged. The handling-guidance assertion may expose a current UI defect; preserve the intended assertion.

### Approach

Use the ticket and static code/test reading to verify data and existing coverage. Keep each journey in its own guest session and cart. Plan observable assertions for evaluation, summary, and cart updates. No browser observations or execution are claimed.

## Grader response format

- **Score:** N/100 (from R/85 raw points); K/12 core checks met.
- **Evidence:** Short line per check -> number, 0 or 5, supporting scenario/quote or missing point.
- **Core gaps:** Missing check numbers + brief descriptions, or “None”.
- **Top improvements:** Up to three concrete changes; highest impact first.
- **Separate notes:** Prompt compliance and unresolved factual uncertainty. No extra content deductions.
