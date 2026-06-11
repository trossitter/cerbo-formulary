# Cerbo Formulary — supplement ordering vertical slice

**Stack:** Next.js 16 · React 19 · Prisma 7 · PostgreSQL · Tailwind CSS v4 · Vitest

A clinical provider assembles a supplement order for a patient, the patient
pays (stubbed gateway), and the system computes and persists a correct,
auditable money split — exact to the cent — with a postings ledger as proof.

## Money model

Every order line is split into three buckets that sum exactly to what the patient paid:

```
fee    = round(0.0075 × line total)   — 75 bps platform fee on the patient-facing price
margin = line total − COGS − fee      — provider margin (absorbs the rounding residual)
```

Margin is the residual, not the fee, so the invariant `COGS + margin + fee == total`
holds by construction for every line and for the order. All amounts are integer cents;
floats never touch money. Prices and COGS are snapshotted at order time — later catalog
edits cannot change a placed order's economics. The ledger is written in the same
transaction as the payment status flip; a paid order always has a complete ledger.

## Run it locally

```bash
npm install
npx prisma dev          # spins up local Postgres; keep running in its own terminal
# copy the DATABASE_URL it prints into .env (see .env.example)
npx prisma db push      # apply the schema
npm run db:seed         # load catalog + opening inventory
npm run dev             # http://localhost:3000
```

> **Port collision gotcha:** `npm run dev` starts one server. If you see bare 404s,
> check `lsof -iTCP:3000 -sTCP:LISTEN` — two `next-server` processes means a stale
> instance is answering. Kill the old one and reload.

## Try the flow

1. **Provider view** (default): *New order* → pick a patient, set quantities and
   patient-facing prices — margin and fee preview live as you type.
2. Open the order → *Copy payment link*, or switch to the **patient** view via the
   header and hit *Pay now*.
3. Pay with `4242 4242 4242 4242` → succeeds. The order page shows the full ledger:
   COGS, platform fee, and provider margin for every line, with the exact-sum total.
4. Try `4000 0000 0000 0002` → declined. Order stays unpaid, ledger stays empty,
   attempt is recorded.
5. Dashboard: GMV, fees, margin, units sold, stock (decremented by the sale) —
   restock inline.

## Tests

```bash
npm test          # run once
npm run test:watch  # interactive
```

- `src/lib/money.test.ts` — unit tests for the split math, including a 10k-case
  property test (deterministic LCG) verifying the exact-sum invariant.
- `src/lib/orders.integration.test.ts` — end-to-end against real Postgres: declined
  payments write nothing, paid orders carry a complete ledger summing to the charged
  amount, idempotent replay and concurrent payment, stock decrements exactly once.
  Requires the local DB to be running.

## What's stubbed

| Stub | Seam | Production replacement |
|---|---|---|
| Payment gateway | `PaymentGateway` interface (`src/lib/gateway.ts`) | Stripe PaymentIntents + webhooks |
| Auth / identity | `src/lib/actors.ts` + role cookie | Sessions, roles, patient records |
| Email / receipts | copy on the pay confirmation page | Transactional email |
| Provider payout | noted on the order detail page | ACH / Stripe Connect transfer |

See `docs/TECHNICAL.md` for the full data model and money-handling decisions,
and `docs/AI_USAGE.md` for the AI-usage write-up.

## Future directions (out of scope for this slice)

### Clinical co-pilot: Protocol suggestions

The EHR already holds the patient's diagnoses, labs, and medication list. A natural
next layer is a protocol suggestion engine that surfaces a recommended supplement
order when the provider opens the order builder — pre-populated with items, quantities,
and prices drawn from that provider's own ordering history and anonymized aggregate
patterns across the platform.

From the provider's perspective: open a new order, see "Thyroid Support protocol —
3 items" pre-filled based on the patient's chart, confirm or adjust, done. The
AI is doing ranked selection from the catalog against structured EHR data; it is
not generating clinical knowledge from scratch, which keeps the failure mode bounded
and the human firmly in the loop before anything reaches the patient.

Commercially, protocols become a compounding asset: the more providers use the
dispensary, the sharper the suggestions get, and a shareable protocol library
becomes a reason to use Cerbo's dispensary specifically rather than an external
storefront. The dependency is one LLM API key; the latency is hidden behind
streaming on chart open.

### Supplement-drug interaction checking

Before an order is placed, flag potential interactions between the selected
supplements and the patient's current medications. This is the safety-critical
companion to protocol suggestions — the case where AI earns trust rather than
just saves time. It requires a clinical drug-interaction database (e.g. NLM or
a specialized API) in addition to an LLM; the model reasons over structured
interaction data rather than recalling facts from training weights. A clinician
confirms before the order is sent.
