# AI usage log

*Draft — first person, to be edited/owned by the author before submission.*

## Tools

- Cursor agent (Claude) for planning dialogue, scaffolding, code
  generation, and test-driven iteration; all decisions reviewed and made
  by me in a question-at-a-time brainstorming session before any code was
  written.

## How the work was structured

1. **Decisions before code.** The agent interviewed me one question at a
   time: scope appetite, stack, persona/auth model, inventory depth,
   payment-stub fidelity. Each came with 2–3 options and a recommendation;
   I picked. The money model (fee base, residual margin, integer cents,
   snapshot-at-sale, postings ledger) was pressure-tested in dialogue
   before a line of code existed.
2. **Test-first on the core.** The split function was written alongside a
   property test (10k random orders) asserting the exact-sum invariant.
3. **Vertical slice, then docs.** Schema → domain ops → UI → integration
   tests → this write-up.

## Where AI helped most

- **Speed on boilerplate**: scaffold, Prisma schema, Tailwind UI — hours
  of typing compressed to minutes.
- **Decision framing**: surfacing trade-offs I would have had to research
  (e.g., fee-base semantics, ledger-vs-columns, gross-up rounding) with
  concrete recommendations to accept or override.
- **The property test caught a real bug immediately** — in the *test's own
  data generator*: it produced prices that couldn't cover COGS + fee, and
  the split function correctly rejected them. Exactly the class of edge
  case the validation exists for, found in the first test run.

## Where it went sideways (and the course corrections)

- **An earlier research thread oversold its findings.** A prior session
  explored extending a real EHR vendor's API model, but on inspection the
  "research" amounted to a couple of confirmed field names. I cut the
  framing entirely and built a clean domain model instead. Lesson: ask
  what the evidence actually is before building on an AI summary of it.
- **`create-next-app` refused to run** in the agent's sandboxed shell
  (writability probe false-negative). Rather than fight it, the agent
  scaffolded the dozen files by hand — same result, no wasted cycles.
- **`prisma migrate dev` failed (P1017)** against the WASM-based local
  Postgres that `prisma dev` provides, even though raw connections worked.
  Diagnosis ruled out networking and shadow-DB config; `prisma db push`
  worked, so we shipped with push and documented the trade-off rather
  than burning time on a tooling incompatibility.
- **Sandbox friction generally** (blocked file watchers, blocked `tsx`
  IPC socket): worked around with a production-build smoke test over HTTP
  and an esbuild-bundled seed script. The agent diagnosed each from error
  output rather than guessing.

## What I deliberately cut

See "Deliberate cuts" in `docs/TECHNICAL.md` — real auth, payout
execution, refunds, stock reservation. Each has a named seam.
