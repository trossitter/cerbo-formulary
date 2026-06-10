"use client";

import { useMemo, useState, useTransition } from "react";
import {
  computeLineSplit,
  formatCents,
  parseDollarsToCents,
  MoneyError,
  type LineSplit,
} from "@/lib/money";
import { createOrderAction } from "@/app/actions";

interface CatalogItem {
  id: string;
  name: string;
  wholesaleCents: number;
  defaultPriceCents: number;
  stock: number;
}

interface LineState {
  quantity: string;
  price: string; // dollars, as typed
}

type LineComputation =
  | { state: "empty" }
  | { state: "invalid"; message: string }
  | { state: "ok"; split: LineSplit; quantity: number; unitPriceCents: number };

function computeLine(item: CatalogItem, line: LineState): LineComputation {
  const quantity = Number(line.quantity);
  if (!line.quantity || quantity === 0) return { state: "empty" };
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    return { state: "invalid", message: "Quantity must be a whole number" };
  }
  const unitPriceCents = parseDollarsToCents(line.price);
  if (unitPriceCents === null) {
    return { state: "invalid", message: "Enter a valid price" };
  }
  try {
    const split = computeLineSplit({
      unitPriceCents,
      unitCogsCents: item.wholesaleCents,
      quantity,
    });
    return { state: "ok", split, quantity, unitPriceCents };
  } catch (e) {
    if (e instanceof MoneyError) {
      return { state: "invalid", message: "Price doesn't cover cost + fee" };
    }
    throw e;
  }
}

export function OrderBuilder({
  patients,
  catalog,
}: {
  patients: string[];
  catalog: CatalogItem[];
}) {
  const [patient, setPatient] = useState(patients[0] ?? "");
  const [lines, setLines] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      catalog.map((c) => [
        c.id,
        { quantity: "", price: (c.defaultPriceCents / 100).toFixed(2) },
      ]),
    ),
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const computed = useMemo(
    () => catalog.map((item) => ({ item, result: computeLine(item, lines[item.id]) })),
    [catalog, lines],
  );

  const activeLines = computed.filter((c) => c.result.state === "ok") as Array<{
    item: CatalogItem;
    result: Extract<LineComputation, { state: "ok" }>;
  }>;
  const hasInvalid = computed.some((c) => c.result.state === "invalid");
  const overStock = activeLines.filter((c) => c.result.quantity > c.item.stock);

  const totals = activeLines.reduce(
    (acc, { result }) => ({
      total: acc.total + result.split.totalCents,
      cogs: acc.cogs + result.split.cogsCents,
      fee: acc.fee + result.split.feeCents,
      margin: acc.margin + result.split.marginCents,
    }),
    { total: 0, cogs: 0, fee: 0, margin: 0 },
  );

  const canSubmit =
    activeLines.length > 0 && !hasInvalid && overStock.length === 0 && !isPending;

  function setLine(id: string, patch: Partial<LineState>) {
    setLines((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function submit() {
    setServerError(null);
    startTransition(async () => {
      const result = await createOrderAction(
        patient,
        activeLines.map(({ item, result }) => ({
          supplementId: item.id,
          quantity: result.quantity,
          unitPriceCents: result.unitPriceCents,
        })),
      );
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-900">New supplement order</h1>

      <label className="block text-sm">
        <span className="text-stone-600">Patient</span>
        <select
          value={patient}
          onChange={(e) => setPatient(e.target.value)}
          className="mt-1 block w-64 rounded-md border border-stone-300 bg-white px-2 py-1.5"
        >
          {patients.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2">Supplement</th>
              <th className="px-4 py-2 text-right">Cost (COGS)</th>
              <th className="px-4 py-2 text-right">Stock</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Patient price</th>
              <th className="px-4 py-2 text-right">Fee (75 bps)</th>
              <th className="px-4 py-2 text-right">Your margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {computed.map(({ item, result }) => (
              <tr key={item.id}>
                <td className="px-4 py-2 font-medium text-stone-800">{item.name}</td>
                <td className="px-4 py-2 text-right text-stone-500">
                  {formatCents(item.wholesaleCents)}
                </td>
                <td className="px-4 py-2 text-right text-stone-500">{item.stock}</td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    value={lines[item.id].quantity}
                    onChange={(e) => setLine(item.id, { quantity: e.target.value })}
                    placeholder="0"
                    className="w-16 rounded border border-stone-300 px-1 py-0.5 text-right"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex items-center gap-1">
                    <span className="text-stone-400">$</span>
                    <input
                      value={lines[item.id].price}
                      onChange={(e) => setLine(item.id, { price: e.target.value })}
                      className="w-20 rounded border border-stone-300 px-1 py-0.5 text-right"
                    />
                  </div>
                </td>
                {result.state === "ok" ? (
                  <>
                    <td className="px-4 py-2 text-right text-stone-600">
                      {formatCents(result.split.feeCents)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-emerald-700">
                      {formatCents(result.split.marginCents)}
                    </td>
                  </>
                ) : (
                  <td colSpan={2} className="px-4 py-2 text-right text-xs text-red-600">
                    {result.state === "invalid" ? result.message : ""}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overStock.length > 0 && (
        <p className="text-sm text-red-600">
          Not enough stock for: {overStock.map((c) => c.item.name).join(", ")}
        </p>
      )}
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-4">
        <dl className="flex gap-8 text-sm">
          <div>
            <dt className="text-stone-500">Patient pays</dt>
            <dd className="text-lg font-semibold">{formatCents(totals.total)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">COGS</dt>
            <dd className="text-lg">{formatCents(totals.cogs)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Platform fee</dt>
            <dd className="text-lg">{formatCents(totals.fee)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Your margin</dt>
            <dd className="text-lg font-semibold text-emerald-700">
              {formatCents(totals.margin)}
            </dd>
          </div>
        </dl>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-md bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {isPending ? "Creating…" : "Create order"}
        </button>
      </div>
    </div>
  );
}
