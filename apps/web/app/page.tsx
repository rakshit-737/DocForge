import Link from "next/link";

/* A typeset calling card, not a landing page — that arrives in Phase 8.
   It must still look set by hand: nameplate over a double ink rule. */
export default function Home() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 px-6">
      <header className="text-center">
        <h1 className="font-display text-6xl font-bold tracking-tight text-ink">DocForge</h1>
        <div className="mx-auto mt-3 w-64 border-t-4 border-double border-rule" />
        <p className="mt-4 max-w-md text-sm leading-6 text-ink-2">
          Plain text in — beautifully typeset PDF and Word documents out. Local-first: no account,
          nothing leaves this machine.
        </p>
      </header>
      <Link
        href="/studio"
        className="border border-rule bg-press px-5 py-2 font-mono text-sm uppercase tracking-widest text-press-ink hover:bg-press-hover"
      >
        Open the studio
      </Link>
      <p className="font-mono text-xs text-ink-3">
        Prefer a single file? The offline edition is one HTML document, yours forever.
      </p>
    </main>
  );
}
