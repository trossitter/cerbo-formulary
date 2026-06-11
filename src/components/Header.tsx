import Link from "next/link";
import { cookies } from "next/headers";
import {
  LayoutDashboard,
  PackagePlus,
  RefreshCw,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { PATIENTS, PROVIDER, ROLE_COOKIE } from "@/lib/actors";
import { switchRoleAction } from "@/app/actions";

export async function Header() {
  const jar = await cookies();
  const role = jar.get(ROLE_COOKIE)?.value ?? "provider";
  const isProvider = role === "provider";
  const activePatient = PATIENTS.find((p) => p.id === role) ?? PATIENTS[0];
  const RoleIcon = isProvider ? Stethoscope : UserRound;
  const roleLabel = isProvider ? "Provider workspace" : "Patient portal";
  const roleName = isProvider ? PROVIDER.name : activePatient.name;

  return (
    <header className="brand-header">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-6">
          <Link href="/" className="flex items-center gap-3 font-bold text-[var(--cerbo-navy)]">
            <span className="brand-mark" aria-hidden="true">
              <span className="brand-dot dot-blue" />
              <span className="brand-dot dot-pink" />
              <span className="brand-dot dot-green" />
              <span className="brand-dot dot-orange" />
              <span className="brand-dot dot-teal" />
              <span className="brand-dot dot-purple" />
              <span className="brand-dot dot-yellow" />
              <span className="brand-dot dot-blue" />
              <span className="brand-dot dot-pink" />
            </span>
            <span>cerbo formulary</span>
          </Link>
          {isProvider && (
            <nav className="flex flex-wrap gap-2 text-sm text-[var(--cerbo-ink)]">
              <Link href="/provider" className="nav-link">
                <LayoutDashboard size={16} strokeWidth={2.3} aria-hidden="true" />
                Dashboard
              </Link>
              <Link href="/provider/orders/new" className="nav-link">
                <PackagePlus size={16} strokeWidth={2.3} aria-hidden="true" />
                New order
              </Link>
            </nav>
          )}
        </div>

        <div className="header-actions">
          <p className="design-credit">Designed by Thalia</p>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="role-chip" aria-live="polite">
              <RoleIcon size={16} strokeWidth={2.35} aria-hidden="true" />
              <span className="font-bold">{roleLabel}</span>
              <span className="role-chip-name">{roleName}</span>
            </div>

            <form action={switchRoleAction} className="role-switcher text-sm">
              <label htmlFor="role-select" className="sr-only">
                Viewing as
              </label>
              <select
                id="role-select"
                name="role"
                defaultValue={role}
                className="brand-input max-w-[15rem] px-3 py-2"
              >
                <option value="provider">{PROVIDER.name} (provider)</option>
                {PATIENTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (patient)
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="btn-primary px-4 py-2 text-sm"
              >
                <RefreshCw size={16} strokeWidth={2.4} aria-hidden="true" />
                Switch
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
