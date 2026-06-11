"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileDown,
  PackagePlus,
  Plus,
} from "lucide-react";
import { restockAction } from "@/app/actions";
import { formatCents } from "@/lib/money";

export interface CatalogRow {
  id: string;
  name: string;
  wholesaleCents: number;
  defaultPriceCents: number;
  unitsSold: number;
  revenueCents: number;
  stockOnHand: number;
}

export interface RecentOrderRow {
  id: string;
  patientName: string;
  status: string;
  totalCents: number;
  marginCents: number;
  feeCents: number;
  createdAtMs: number;
}

type Direction = "asc" | "desc";
type CatalogSortKey =
  | "name"
  | "wholesaleCents"
  | "defaultPriceCents"
  | "unitsSold"
  | "revenueCents"
  | "stockOnHand";
type OrderSortKey =
  | "id"
  | "patientName"
  | "status"
  | "totalCents"
  | "marginCents"
  | "feeCents"
  | "createdAtMs";

interface SortState<Key extends string> {
  key: Key;
  direction: Direction;
}

export function ProviderDashboardTables({
  catalogRows,
  recentOrderRows,
}: {
  catalogRows: CatalogRow[];
  recentOrderRows: RecentOrderRow[];
}) {
  const [catalogSort, setCatalogSort] = useSortable<CatalogSortKey>({
    key: "name",
    direction: "asc",
  });
  const [orderSort, setOrderSort] = useSortable<OrderSortKey>({
    key: "createdAtMs",
    direction: "desc",
  });

  const sortedCatalog = [...catalogRows].sort((a, b) =>
    compareRows(a, b, catalogSort),
  );
  const sortedOrders = [...recentOrderRows].sort((a, b) =>
    compareRows(a, b, orderSort),
  );

  return (
    <div className="space-y-8">
      <section className="dashboard-export-bar print-hide">
        <div>
          <p className="section-label">Dashboard report</p>
          <p className="text-sm text-[var(--cerbo-muted)]">
            Sorted tables export with the current ranking.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary px-4 py-2 text-sm"
          onClick={() => window.print()}
        >
          <FileDown size={16} strokeWidth={2.4} aria-hidden="true" />
          Export PDF
        </button>
      </section>

      <section className="space-y-3 print-section">
        <div className="flex flex-wrap items-center justify-between gap-3 print-hide">
          <h2 className="section-label">Catalog, sales &amp; inventory</h2>
          <Link
            href="/provider/orders/new"
            className="btn-secondary px-4 py-2 text-sm"
          >
            <PackagePlus size={16} strokeWidth={2.4} aria-hidden="true" />
            Create order
          </Link>
        </div>
        <div className="brand-card overflow-x-auto">
          <table className="brand-table min-w-[820px]">
            <thead>
              <tr>
                <SortableTh
                  label="Supplement"
                  sortKey="name"
                  sort={catalogSort}
                  onSort={setCatalogSort}
                />
                <SortableTh
                  label="COGS"
                  sortKey="wholesaleCents"
                  sort={catalogSort}
                  onSort={setCatalogSort}
                  align="right"
                />
                <SortableTh
                  label="Default price"
                  sortKey="defaultPriceCents"
                  sort={catalogSort}
                  onSort={setCatalogSort}
                  align="right"
                />
                <SortableTh
                  label="Units sold"
                  sortKey="unitsSold"
                  sort={catalogSort}
                  onSort={setCatalogSort}
                  align="right"
                />
                <SortableTh
                  label="Revenue"
                  sortKey="revenueCents"
                  sort={catalogSort}
                  onSort={setCatalogSort}
                  align="right"
                />
                <SortableTh
                  label="Stock"
                  sortKey="stockOnHand"
                  sort={catalogSort}
                  onSort={setCatalogSort}
                  align="right"
                />
                <th className="text-right print-hide">Restock</th>
              </tr>
            </thead>
            <tbody>
              {sortedCatalog.map((row) => (
                <tr key={row.id}>
                  <td className="font-bold text-[var(--cerbo-navy)]">{row.name}</td>
                  <td className="text-right text-[var(--cerbo-muted)]">
                    {formatCents(row.wholesaleCents)}
                  </td>
                  <td className="text-right text-[var(--cerbo-muted)]">
                    {formatCents(row.defaultPriceCents)}
                  </td>
                  <td className="text-right">{row.unitsSold}</td>
                  <td className="text-right">{formatCents(row.revenueCents)}</td>
                  <td
                    className={`text-right font-bold ${
                      row.stockOnHand <= 10
                        ? "text-red-600"
                        : "text-[var(--cerbo-navy)]"
                    }`}
                  >
                    {row.stockOnHand}
                  </td>
                  <td className="print-hide">
                    <form action={restockAction} className="flex justify-end gap-2">
                      <input type="hidden" name="supplementId" value={row.id} />
                      <input
                        type="number"
                        name="quantity"
                        placeholder="qty"
                        className="brand-input w-20 px-2 py-1 text-right"
                      />
                      <button
                        type="submit"
                        className="btn-secondary px-3 py-1 text-xs"
                      >
                        <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
                        Add
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-[var(--cerbo-muted)]">
          Stock is derived from the inventory movement log (initial + restocks - sales).
        </p>
      </section>

      <section className="space-y-3 print-section">
        <h2 className="section-label">Recent orders</h2>
        <div className="brand-card overflow-x-auto">
          <table className="brand-table min-w-[760px]">
            <thead>
              <tr>
                <SortableTh
                  label="Order"
                  sortKey="id"
                  sort={orderSort}
                  onSort={setOrderSort}
                />
                <SortableTh
                  label="Patient"
                  sortKey="patientName"
                  sort={orderSort}
                  onSort={setOrderSort}
                />
                <SortableTh
                  label="Status"
                  sortKey="status"
                  sort={orderSort}
                  onSort={setOrderSort}
                />
                <SortableTh
                  label="Total"
                  sortKey="totalCents"
                  sort={orderSort}
                  onSort={setOrderSort}
                  align="right"
                />
                <SortableTh
                  label="Margin"
                  sortKey="marginCents"
                  sort={orderSort}
                  onSort={setOrderSort}
                  align="right"
                />
                <SortableTh
                  label="Fee"
                  sortKey="feeCents"
                  sort={orderSort}
                  onSort={setOrderSort}
                  align="right"
                />
              </tr>
            </thead>
            <tbody>
              {sortedOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--cerbo-muted)]">
                    No orders yet - create the first one.
                  </td>
                </tr>
              )}
              {sortedOrders.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link
                      href={`/provider/orders/${row.id}`}
                      className="font-mono text-sm font-bold text-[var(--cerbo-blue)] hover:underline"
                    >
                      {row.id.slice(-8)}
                    </Link>
                  </td>
                  <td>{row.patientName}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="text-right">{formatCents(row.totalCents)}</td>
                  <td className="text-right">{formatCents(row.marginCents)}</td>
                  <td className="text-right">{formatCents(row.feeCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function useSortable<Key extends string>(initial: SortState<Key>) {
  const [sort, setSort] = useState<SortState<Key>>(initial);

  function chooseSort(key: Key) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  return [sort, chooseSort] as const;
}

function SortableTh<Key extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: Key;
  sort: SortState<Key>;
  onSort: (key: Key) => void;
  align?: "left" | "right";
}) {
  const isActive = sort.key === sortKey;
  const Icon = !isActive ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  const ariaSort = !isActive
    ? "none"
    : sort.direction === "asc"
      ? "ascending"
      : "descending";

  return (
    <th
      className={align === "right" ? "text-right" : undefined}
      aria-sort={ariaSort}
      scope="col"
    >
      <button
        type="button"
        className={`sort-button ${align === "right" ? "justify-end" : ""}`}
        onClick={() => onSort(sortKey)}
        title={`Sort by ${label}`}
      >
        {label}
        <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </th>
  );
}

function compareRows<Row, Key extends string>(
  a: Row,
  b: Row,
  sort: SortState<Key>,
) {
  const aValue = (a as Record<Key, string | number>)[sort.key];
  const bValue = (b as Record<Key, string | number>)[sort.key];
  const direction = sort.direction === "asc" ? 1 : -1;

  if (typeof aValue === "number" && typeof bValue === "number") {
    return (aValue - bValue) * direction;
  }

  return String(aValue).localeCompare(String(bValue), "en-US", {
    numeric: true,
    sensitivity: "base",
  }) * direction;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-[#ecfdf3] text-[#067647]",
    AWAITING_PAYMENT: "bg-[#fffaeb] text-[#b54708]",
    CANCELED: "bg-[#f2f4f7] text-[var(--cerbo-muted)]",
  };
  return (
    <span className={`status-pill ${styles[status] ?? ""}`}>
      {status.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}
