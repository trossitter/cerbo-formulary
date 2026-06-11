"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, CreditCard, XCircle } from "lucide-react";
import { payOrderAction, type PayState } from "@/app/actions";

const initialState: PayState = { status: "idle" };
const successCard = "4242424242424242";
const declineCard = "4000000000000002";

export function PayForm({
  orderId,
  amountLabel,
}: {
  orderId: string;
  amountLabel: string;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [state, formAction, isPending] = useActionState(
    payOrderAction.bind(null, orderId),
    initialState,
  );

  if (state.status === "paid" || state.status === "already_paid") {
    return (
      <div className="success-panel p-4 text-sm font-semibold">
        Payment of {amountLabel} succeeded - thank you! A receipt has been
        (pretend) emailed to you.
      </div>
    );
  }

  return (
    <form action={formAction} className="brand-card space-y-5 p-5">
      <label className="block text-sm">
        <span className="label-copy">Card number</span>
        <input
          name="cardNumber"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          required
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          className="brand-input mt-2 block w-full px-3 py-3 font-mono text-base"
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setCardNumber(successCard)}
          className="btn-secondary px-3 py-2 text-sm"
        >
          <CheckCircle2 size={16} strokeWidth={2.4} aria-hidden="true" />
          Use success card
        </button>
        <button
          type="button"
          onClick={() => setCardNumber(declineCard)}
          className="btn-secondary px-3 py-2 text-sm"
        >
          <XCircle size={16} strokeWidth={2.4} aria-hidden="true" />
          Use decline card
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="label-copy">Expiry</span>
          <input
            autoComplete="cc-exp"
            placeholder="12/29"
            className="brand-input mt-2 block w-full px-3 py-3"
          />
        </label>
        <label className="block text-sm">
          <span className="label-copy">CVC</span>
          <input
            autoComplete="cc-csc"
            placeholder="123"
            className="brand-input mt-2 block w-full px-3 py-3"
          />
        </label>
      </div>

      {state.status === "declined" && (
        <p className="error-panel px-3 py-2 text-sm font-semibold">
          Your card was declined ({state.reason}). No charge was made - you can
          try a different card.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full px-4 py-3 text-sm"
      >
        <CreditCard size={17} strokeWidth={2.4} aria-hidden="true" />
        {isPending ? "Processing..." : `Pay ${amountLabel}`}
      </button>

      <p className="text-sm text-[var(--cerbo-muted)]">
        Stubbed payment - no real money moves. Use 4242 4242 4242 4242 to
        succeed, 4000 0000 0000 0002 to be declined.
      </p>
    </form>
  );
}
