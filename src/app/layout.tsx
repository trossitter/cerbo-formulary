import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Supplement Orders",
  description:
    "In-house supplement ordering with auditable money splits — vertical slice",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
