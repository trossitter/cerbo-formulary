"use client";

import { useActionState } from "react";
import { payOrderAction, type PayState } from "@/app/actions";

const initialState: PayState = { status: "idle" };

export function PayForm({
  orderId,
  amountLabel,
}: {
  orderId: string;
  amountLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    payOrderAction.bind(null, orderId),
    initialState,
  );

  if (state.status === "paid" || state.status === "already_paid") {
    return (
      <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
        Payment of {amountLabel} succeeded — thank you! A receipt has been
        (pretend) emailed to you.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
      <label className="block text-sm">
        <span className="text-stone-600">Card number</span>
        <input
          name="cardNumber"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          required
          className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 font-mono"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-stone-600">Expiry</span>
          <input
            autoComplete="cc-exp"
            placeholder="12/29"
            className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-600">CVC</span>
          <input
            autoComplete="cc-csc"
            placeholder="123"
            className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2"
          />
        </label>
      </div>

      {state.status === "declined" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Your card was declined ({state.reason}). No charge was made — you can
          try a different card.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:bg-stone-300"
      >
        {isPending ? "Processing…" : `Pay ${amountLabel}`}
      </button>

      <p className="text-xs text-stone-400">
        Stubbed payment — no real money moves. Use 4242 4242 4242 4242 to
        succeed, 4000 0000 0000 0002 to be declined.
      </p>
    </form>
  );
}
