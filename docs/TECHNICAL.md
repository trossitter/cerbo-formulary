# Technical documentation

## The money model (the crux)

Three buckets per the spec: **COGS**, **provider margin**, **75 bps
platform fee**. The spec fixes the buckets but not their composition, so
these are the defensible choices made, and why:

1. **The fee base is the patient-facing total** — "75 bps *on the
   transaction*" reads most naturally as the amount that moved, i.e. what
   the patient paid. `fee = round(0.0075 × patient_total)`.
2. **Margin is the residual**: `margin = total − COGS − fee`. The provider
   sets the patient price (primary path); whatever rounding does to the
   fee comes out of margin, never out of the invariant.
3. **The invariant** — for every line and every order, exactly:

   ```
   COGS + margin + fee == amount_paid
   ```

   This is enforced three times: at order assembly (`computeOrderSplit`
   throws), at payment (postings are re-summed against the charged amount
   inside the transaction, aborting on drift), and visibly in the UI (the
   order page shows the postings sum against the paid amount).
4. **Integer cents everywhere.** No floats touch money anywhere in the
   codebase. Fee rounding is half-up, implemented in integer math
   (`Math.floor((n × 75 + 5000) / 10000)`).
5. **Price-or-margin (FR1)**: the provider sets price directly in the UI;
   `priceForTargetMargin` implements the inverse (gross-up:
   `price ≈ (COGS + margin) / (1 − 0.0075)`, nudged up so the realized
   margin is never below target). The helper is built and tested; the UI
   surfaces price-first with live margin preview, which covers both
   mental models.
6. **Snapshot at point of sale**: `unit_price` and `unit_cogs` are copied
   from the catalog onto the order line at assembly. Later catalog edits
   cannot change a placed order's economics.

## Data model

```
Supplement          catalog: wholesaleCents (COGS), defaultPriceCents
Order               status, patient/provider, split rollups, paidAt
OrderLine           qty + snapshotted unit price/COGS + per-line split
PaymentAttempt      every attempt, including declines (audit)
LedgerPosting       party + reason + amountCents, 3 per line on payment
InventoryMovement   append-only deltas; stock on hand = SUM(delta)
```

Two deliberate "ledgerful" choices:

- **Money**: rather than three columns on the order, every paid order gets
  postings (`COGS → platform`, `fee → platform`, `margin → provider`) *per
  line*. "Look at a paid order and see exactly where every cent went" is
  then a query, not an inference.
- **Inventory**: stock is derived from movements (`INITIAL`, `SALE`,
  `RESTOCK`, `ADJUSTMENT`), not a mutable counter — same auditability
  property, nearly free to build.

## Payment semantics

`payOrder` guarantees, in order of importance:

- **Atomic**: status flip, payment record, ledger postings, and SALE
  inventory movements commit in one transaction. A declined charge records
  only the attempt. There is no state where an order is paid but
  unaccounted, or unpaid with money movement.
- **Idempotent**: the transition `AWAITING_PAYMENT → PAID` is an atomic
  compare-and-set (`updateMany` with a status guard). Double-clicks,
  replays, and concurrent submissions yield exactly one ledger.
- **Verified**: before commit, postings are re-summed and compared to the
  charged amount; mismatch aborts the whole transaction.

The gateway sits behind a `PaymentGateway` interface. The fake uses
Stripe's test-card convention (4242… succeeds, designated decline cards
fail) so both outcomes are demoable. A real integration would replace one
file and move ledger-writing into the webhook handler — the idempotency
design (CAS on status) is exactly what Stripe's retried webhooks require.

## Stack & deployment

Next.js (App Router) + Prisma 7 + Postgres. One deployable unit on
Vercel; Postgres on Neon (prod) / `prisma dev` (local). Chosen for
deployability — a stated priority — and because the money logic is plain
TypeScript, testable without any framework.

Schema is applied with `prisma db push` rather than migration files:
`prisma migrate dev` is incompatible with the WASM-based local dev server
(P1017), and for a single-schema vertical slice, migration history adds
ceremony without value. First real deploy would switch to checked-in
migrations.

## Deliberate cuts (and what's next with more time)

- **No real auth** — role cookie + seeded personas; seam in `actors.ts`.
- **No payout execution** — provider margin is *owed* in the ledger; a
  payout leg (batched transfers, Stripe Connect) is the natural next unit.
- **No order cancellation/refunds** — would be new posting reasons
  (`REFUND`, reversal postings), which the ledger model accommodates.
- **No tax/shipping** — explicitly out of scope per the spec.
- **Stock checked at assembly, not reserved at payment** — overselling
  between order creation and payment is possible by design; a real system
  would reserve at assembly or re-check in the payment transaction.
- **Provider dashboard shows aggregates** — a payout-statement view
  (margin owed per period, derived from postings) is the obvious next
  query to write.
