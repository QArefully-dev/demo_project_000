# W1-D — Merge Evidence

- **Section**: w1-d — Payment
- **Branch**: `codex/demo-expansion-w1-d`
- **Implementation SHA**: `3c8e51b`
- **Merge SHA (integration)**: `d49513c`
- **Checks on final integration**: typecheck ✅, lint ✅, format ✅, seed ✅
- **Reviewer verdict**: Approved — no blockers (2 cosmetic notes, non-blocking)

## Summary

W1-D implements the full payment domain: card validation (Luhn, Visa/Mastercard detection, expiry, CVC), SHA-256 idempotency fingerprinting, gateway simulation with success/decline/timeout test cards, atomic transaction order/payment/redemption/mailbox/cart, and refactored order writer reusable by legacy checkout. Seven files changed (+747/-114): orders domain (refactor), payments domain (full), payments route (wired), payments API client, CheckoutPage, PaymentPage, useCheckout.

## Acceptance criteria trace

| # | Requirement | Status |
|---|------------|--------|
| 1 | Gateway cards: 4242→success, 4000...0002→decline, 4000...0069→250ms timeout, other valid-Luhn→success | ✅ |
| 2 | Detect Visa and Mastercard ranges; unknown otherwise | ✅ |
| 3 | SHA-256 stable normalized body fingerprint; raw body never stored | ✅ |
| 4 | Same key/fingerprint replays prior response; changed fingerprint → 409 | ✅ |
| 5 | Decline/timeout transaction writes payment only | ✅ |
| 6 | Success writes order/lines/payment/redemption/mailbox and deletes cart atomically | ✅ |
| 7 | Attach authenticated user ID; guest null | ✅ |
| 8 | Refactor transaction-aware order writer; legacy checkout remains independent | ✅ |
| 9 | Shipping/contact step → Router state → payment step; missing state redirects | ✅ |
| 10 | Never persist card data client-side; regenerate idempotency key after input changes/retry; duplicate submit reuses key | ✅ |
| 11 | Exact promo error messages; successful payment clears cart and opens confirmation | ✅ |
| 12 | No PAN/CVC storage anywhere (DB, logs, files) | ✅ |
| 13 | M1 gate and SAVE10 preserved | ✅ |
| 14 | Typecheck, lint, format, seed all pass | ✅ |
