# Supplement Orders — vertical slice

A clinical provider assembles a supplement order for a patient, the patient
pays (stubbed gateway), and the system computes and persists a correct,
auditable money split: **COGS + provider margin + 75 bps platform fee**,
exact to the cent, with a postings ledger as proof.

## Run it locally

```bash
npm install
npx prisma dev          # local Postgres (keep running in its own terminal)
# copy the DATABASE_URL it prints into .env (see .env.example)
npx prisma db push      # create the schema
npm run db:seed         # seed catalog + opening stock
npm run dev             # http://localhost:3000
```

## Try the flow (30-second demo)

1. As the **provider** (default view): *New order* → pick a patient, set
   quantities and patient-facing prices — margin and fee preview live.
2. Open the order, *Copy payment link* — or use the header to switch to the
   **patient** view and hit *Pay now*.
3. Pay with `4242 4242 4242 4242` → succeeds. The order page now shows the
   full ledger: where every cent went, with the exact-sum check visible.
4. Pay another order with `4000 0000 0000 0002` → declined. Order stays
   unpaid; the ledger stays empty; the attempt is recorded.
5. Back on the dashboard: GMV, fees, margin, units sold, and stock
   (decremented by the sale) — restock inline.

## Tests

```bash
npm test
```

- `src/lib/money.test.ts` — unit tests for the split math, including a
  10k-case property test of the exact-sum invariant.
- `src/lib/orders.integration.test.ts` — end-to-end against real Postgres:
  declined payments write nothing, paid orders carry a ledger summing to
  exactly the charged amount, replay/concurrent payment is idempotent,
  stock decrements exactly once. Requires the local DB + seed.

## What's stubbed (and where the seams are)

| Stub | Seam | Real-world replacement |
|---|---|---|
| Payment | `PaymentGateway` interface (`src/lib/gateway.ts`) | Stripe PaymentIntents + webhooks |
| Auth / identity | `src/lib/actors.ts` + role cookie | Sessions, roles, patient records |
| Email / receipts | copy on the pay page | transactional email |
| Provider payout | noted on the order page | ACH/Stripe Connect transfer leg |

See `docs/TECHNICAL.md` for the data model and money-handling decisions,
and `docs/AI_USAGE.md` for the AI-usage write-up.
