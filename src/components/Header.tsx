import Link from "next/link";
import { cookies } from "next/headers";
import { PATIENTS, PROVIDER, ROLE_COOKIE } from "@/lib/actors";
import { switchRoleAction } from "@/app/actions";

export async function Header() {
  const jar = await cookies();
  const role = jar.get(ROLE_COOKIE)?.value ?? "provider";
  const isProvider = role === "provider";

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight text-stone-900">
            Supplement Orders
          </Link>
          {isProvider && (
            <nav className="flex gap-4 text-sm text-stone-600">
              <Link href="/provider" className="hover:text-stone-900">
                Dashboard
              </Link>
              <Link href="/provider/orders/new" className="hover:text-stone-900">
                New order
              </Link>
            </nav>
          )}
        </div>

        <form action={switchRoleAction} className="flex items-center gap-2 text-sm">
          <label htmlFor="role-select" className="text-stone-500">
            Viewing as
          </label>
          <select
            id="role-select"
            name="role"
            defaultValue={role}
            className="rounded-md border border-stone-300 bg-white px-2 py-1"
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
            className="rounded-md bg-stone-900 px-3 py-1 text-white hover:bg-stone-700"
          >
            Switch
          </button>
        </form>
      </div>
    </header>
  );
}
