"use client";

import { useMemo, useState, useTransition } from "react";
import { Send } from "lucide-react";
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
    <div className="space-y-7">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
        <div className="space-y-3">
          <p className="section-label">Provider order builder</p>
          <h1 className="serif-heading page-title">New supplement order</h1>
          <p className="page-subtitle">
            Set quantities and patient-facing prices while the platform fee,
            COGS, and provider margin update from integer cents in real time.
          </p>
        </div>

        <label className="brand-card block p-5 text-sm">
          <span className="label-copy">Patient</span>
          <select
            value={patient}
            onChange={(e) => setPatient(e.target.value)}
            className="brand-input mt-2 block w-full px-3 py-2"
          >
            {patients.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="brand-card overflow-x-auto">
        <table className="brand-table min-w-[880px]">
          <thead>
            <tr>
              <th>Supplement</th>
              <th className="text-right">Cost (COGS)</th>
              <th className="text-right">Stock</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Patient price</th>
              <th className="text-right">Fee (75 bps)</th>
              <th className="text-right">Your margin</th>
            </tr>
          </thead>
          <tbody>
            {computed.map(({ item, result }) => (
              <tr key={item.id}>
                <td className="font-bold text-[var(--cerbo-navy)]">{item.name}</td>
                <td className="text-right text-[var(--cerbo-muted)]">
                  {formatCents(item.wholesaleCents)}
                </td>
                <td className="text-right text-[var(--cerbo-muted)]">{item.stock}</td>
                <td className="text-right">
                  <input
                    type="number"
                    min={0}
                    value={lines[item.id].quantity}
                    onChange={(e) => setLine(item.id, { quantity: e.target.value })}
                    placeholder="0"
                    className="brand-input w-20 px-2 py-1 text-right"
                  />
                </td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <span className="text-[var(--cerbo-muted)]">$</span>
                    <input
                      value={lines[item.id].price}
                      onChange={(e) => setLine(item.id, { price: e.target.value })}
                      className="brand-input w-24 px-2 py-1 text-right"
                    />
                  </div>
                </td>
                {result.state === "ok" ? (
                  <>
                    <td className="text-right text-[var(--cerbo-muted)]">
                      {formatCents(result.split.feeCents)}
                    </td>
                    <td className="text-right font-bold text-[#067647]">
                      {formatCents(result.split.marginCents)}
                    </td>
                  </>
                ) : (
                  <td colSpan={2} className="text-right text-sm font-semibold text-red-600">
                    {result.state === "invalid" ? result.message : ""}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overStock.length > 0 && (
        <p className="error-panel px-4 py-3 text-sm font-semibold">
          Not enough stock for: {overStock.map((c) => c.item.name).join(", ")}
        </p>
      )}
      {serverError && (
        <p className="error-panel px-4 py-3 text-sm font-semibold">{serverError}</p>
      )}

      <div className="brand-card flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="label-copy">Patient pays</dt>
            <dd className="metric-value">{formatCents(totals.total)}</dd>
          </div>
          <div>
            <dt className="label-copy">COGS</dt>
            <dd className="text-xl font-bold text-[var(--cerbo-navy)]">
              {formatCents(totals.cogs)}
            </dd>
          </div>
          <div>
            <dt className="label-copy">Platform fee</dt>
            <dd className="text-xl font-bold text-[var(--cerbo-navy)]">
              {formatCents(totals.fee)}
            </dd>
          </div>
          <div>
            <dt className="label-copy">Your margin</dt>
            <dd className="text-xl font-bold text-[#067647]">
              {formatCents(totals.margin)}
            </dd>
          </div>
        </dl>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="btn-primary px-6 py-3 text-sm lg:min-w-[10rem]"
        >
          <Send size={17} strokeWidth={2.4} aria-hidden="true" />
          {isPending ? "Creating..." : "Create order"}
        </button>
      </div>
    </div>
  );
}
