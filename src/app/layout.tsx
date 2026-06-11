import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Header } from "@/components/Header";
import { ROLE_COOKIE } from "@/lib/actors";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cerbo Formulary",
  description:
    "In-house supplement ordering with auditable money splits for Cerbo practices.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const roleCookie = await cookies();
  const role = roleCookie.get(ROLE_COOKIE)?.value;
  const roleClass = role === "provider" || !role ? "role-provider" : "role-patient";

  return (
    <html lang="en">
      <body className={`app-shell ${roleClass} antialiased`}>
        <Header />
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
