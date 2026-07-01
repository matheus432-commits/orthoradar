import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Smile Design Analyzer",
  description: "Analise digital do sorriso com marcacao manual de pontos.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🦷</span>
              <span className="text-lg font-bold text-brand">
                Smile Design Analyzer
              </span>
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/" className="btn-ghost">
                Dashboard
              </Link>
              <Link href="/cases/new" className="btn-primary">
                + Novo Caso
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
          Smile Design Analyzer — marcacao manual de pontos, calculos automaticos.
        </footer>
      </body>
    </html>
  );
}
