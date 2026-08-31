import Link from "next/link";

/* The landing is a type specimen (§7.8) — the product sells typesetting, so
   the page itself must be typeset: nameplate over the double ink rule, the
   two working faces shown rather than described, the product story as a
   ruled Write · Typeset · Export verb row, and exactly one red plate.
   No gradients, no blobs, no logo rows — ink on newsprint. */
export default function Home() {
  return (
    <main className="flex min-h-0 flex-1 overflow-y-auto">
      <div className="m-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
        {/* nameplate over the double rule */}
        <header className="text-center">
          <h1 className="font-display text-5xl font-bold tracking-tight text-ink sm:text-6xl">
            DocForge
          </h1>
          <div className="mx-auto mt-4 w-72 max-w-full border-t-4 border-double border-rule" />
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-ink-2">
            Plain text in — beautifully typeset PDF and Word documents out. Local-first: no account,
            nothing leaves this machine.
          </p>
        </header>

        {/* the two working faces, set as specimens */}
        <section aria-label="Type specimen" className="grid grid-cols-2 border-y border-line">
          <figure className="m-0 flex flex-col items-center gap-2 border-r border-line px-4 py-6 text-center">
            <p aria-hidden="true" className="font-display text-6xl leading-none text-ink">
              Ag
            </p>
            <p className="font-display text-sm text-ink-2">Hamburgefonstiv 0123</p>
            <figcaption className="font-mono text-[11px] text-ink-3">
              DocForge Serif — headings &amp; the nameplate
            </figcaption>
          </figure>
          <figure className="m-0 flex flex-col items-center gap-2 px-4 py-6 text-center">
            <p aria-hidden="true" className="text-6xl leading-none text-ink">
              Ag
            </p>
            <p className="text-sm text-ink-2">Hamburgefonstiv 0123</p>
            <figcaption className="font-mono text-[11px] text-ink-3">
              DocForge Sans — the working text
            </figcaption>
          </figure>
        </section>

        {/* the story of the desk, as a ruled verb row */}
        <ol
          aria-label="How it works"
          className="m-0 grid list-none grid-cols-1 border-y border-rule p-0 sm:grid-cols-3"
        >
          <li className="border-b border-line px-5 py-4 sm:border-b-0 sm:border-r">
            <span className="font-mono text-[11px] text-ink-3">01</span>
            <p className="mt-1 font-display text-xl text-ink">Write</p>
            <p className="mt-1 text-xs leading-5 text-ink-2">
              Markdown with headings, tables, math, footnotes and citations — copy, not markup soup.
            </p>
          </li>
          <li className="border-b border-line px-5 py-4 sm:border-b-0 sm:border-r">
            <span className="font-mono text-[11px] text-ink-3">02</span>
            <p className="mt-1 font-display text-xl text-ink">Typeset</p>
            <p className="mt-1 text-xs leading-5 text-ink-2">
              Real pages compose live as you type: margins, running heads, folios, a table of
              contents.
            </p>
          </li>
          <li className="px-5 py-4">
            <span className="font-mono text-[11px] text-ink-3">03</span>
            <p className="mt-1 font-display text-xl text-ink">Export</p>
            <p className="mt-1 text-xs leading-5 text-ink-2">
              One click to a print-ready PDF or a native Word document. Your file, your machine.
            </p>
          </li>
        </ol>

        {/* the one red plate, then the quiet way out */}
        <div className="flex flex-col items-center gap-4 text-center">
          <Link
            href="/studio"
            className="border border-rule bg-press px-6 py-2.5 font-mono text-sm uppercase tracking-widest text-press-ink transition-colors duration-[160ms] ease-desk hover:bg-press-hover"
          >
            Open the studio
          </Link>
          <p className="font-mono text-xs leading-5 text-ink-3">
            Prefer one file, no install? The{" "}
            <a href="/classic/" className="text-ink-2 underline underline-offset-2 hover:text-ink">
              single-file edition
            </a>{" "}
            is one HTML document, yours forever.
          </p>
        </div>
      </div>
    </main>
  );
}
