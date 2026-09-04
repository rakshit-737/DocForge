"use client";
/* Help — the keyboard map and the dialect crib sheet, ported from the classic
   help overlay (src/index.html) and kept honest for the studio as it stands:
   the new shortcuts (Ctrl+1/2/3 headings, Shift+Tab outdent, F3 stepping) are
   in; features the web studio doesn't ship yet (imports, exports, project
   files) are not promised. Serif section rails, wall-less reference tables. */
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

function H({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-2.5 mt-6 border-b border-line pb-1.5 font-display text-[17px] font-normal text-ink first:mt-0">
      {children}
    </h4>
  );
}

function Row({ k, children }: { k: ReactNode; children: ReactNode }) {
  return (
    <tr>
      <td className="whitespace-nowrap py-[7px] pr-4 align-top">{k}</td>
      <td className="py-[7px] align-top text-ink-2">{children}</td>
    </tr>
  );
}

function Crib({ children }: { children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-[12.5px] [&_tr+tr>td]:border-t [&_tr+tr>td]:border-[color-mix(in_srgb,var(--line)_55%,transparent)]">
      <tbody>{children}</tbody>
    </table>
  );
}

export function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Entrances live in globals.css, keyed to Radix's data-state
            (df-fade scrim, df-sheet-in sheet — standalone translate/scale,
            composing with the centring utilities). */}
        <Dialog.Overlay
          data-df-motion="fade"
          className="fixed inset-0 z-[60] bg-[rgba(10,8,5,0.72)]"
        />
        <Dialog.Content
          data-df-motion="sheet"
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[60] flex max-h-[84vh] w-[min(680px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-modal bg-surface shadow-(--elev-l) outline-none"
        >
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <Dialog.Title className="font-display text-base font-normal text-ink">
              Help — writing &amp; shortcuts
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center text-ink-2 hover:bg-tray hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </Dialog.Close>
          </header>
          <div className="min-h-0 overflow-y-auto px-5 py-4 text-[13px] leading-[1.65] text-ink-2 [&_b]:text-ink [&_code]:border [&_code]:border-line [&_code]:bg-desk [&_code]:px-1.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-ink">
            <H>Keyboard</H>
            <Crib>
              <Row
                k={
                  <>
                    <code>Ctrl</code> <code>K</code>
                  </>
                }
              >
                Command palette — every desk action, searchable by name
              </Row>
              <Row
                k={
                  <>
                    <code>Ctrl</code> <code>F</code> / <code>Ctrl</code> <code>H</code>
                  </>
                }
              >
                Find / find &amp; replace — <code>Enter</code> next, <code>Shift</code>+
                <code>Enter</code> previous; <code>F3</code> / <code>Shift</code>+<code>F3</code>{" "}
                step through matches from the editor
              </Row>
              <Row
                k={
                  <>
                    <code>Ctrl</code> <code>B</code> / <code>I</code> / <code>U</code>
                  </>
                }
              >
                Bold / italic / underline
              </Row>
              <Row
                k={
                  <>
                    <code>Ctrl</code> <code>1</code> / <code>2</code> / <code>3</code>
                  </>
                }
              >
                Make the current line a heading — level 1 / 2 / 3
              </Row>
              <Row
                k={
                  <>
                    <code>Tab</code> / <code>Shift</code> <code>Tab</code>
                  </>
                }
              >
                Indent / outdent the line or selection
              </Row>
              <Row
                k={
                  <>
                    <code>Ctrl</code> <code>Z</code> / <code>Ctrl</code> <code>Y</code>
                  </>
                }
              >
                Undo / redo — Replace All comes back in one step
              </Row>
              <Row
                k={
                  <>
                    <code>Ctrl</code> <code>/</code>
                  </>
                }
              >
                This sheet
              </Row>
              <Row k={<code>Esc</code>}>
                Closes whatever is open — find bar, palette, outline, dialogs
              </Row>
            </Crib>
            <p className="mt-2.5 text-xs text-ink-3">On macOS, ⌘ stands in for Ctrl.</p>

            <H>Formatting (Markdown)</H>
            <Crib>
              <Row
                k={
                  <>
                    <code># Title</code> <code>## Section</code> <code>### Sub</code>
                  </>
                }
              >
                Headings — they feed the table of contents automatically
              </Row>
              <Row
                k={
                  <>
                    <code>**bold**</code> · <code>*italic*</code> · <code>`code`</code>
                  </>
                }
              >
                Inline styling
              </Row>
              <Row
                k={
                  <>
                    <code>- item</code> / <code>1. item</code>
                  </>
                }
              >
                Bullet / numbered lists (indent two spaces to nest)
              </Row>
              <Row k={<code>&gt; text</code>}>Quotation block</Row>
              <Row
                k={
                  <>
                    <code>| A | B |</code> rows with <code>| --- | --- |</code>
                  </>
                }
              >
                Tables — the first row becomes the shaded header
              </Row>
              <Row
                k={
                  <>
                    <code>```</code> … <code>```</code>
                  </>
                }
              >
                Code block — name a language on the fence (<code>```python</code>) for syntax
                colouring
              </Row>
              <Row k={<code>[text](https://url)</code>}>Link</Row>
              <Row
                k={
                  <>
                    <code>++underline++</code> · <code>~~strike~~</code>
                  </>
                }
              >
                Underline / strikethrough
              </Row>
              <Row
                k={
                  <>
                    <code>==highlight==</code> · <code>=={"{green}"}text==</code>
                  </>
                }
              >
                Highlighter — Word&rsquo;s 15 colours by name (yellow, green, cyan, magenta,
                darkBlue…)
              </Row>
              <Row
                k={
                  <>
                    <code>~sub~</code> · <code>^sup^</code>
                  </>
                }
              >
                Subscript / superscript (no spaces inside)
              </Row>
              <Row k={<code>{"[text]{color=#c00000}"}</code>}>
                Text colour — also <code>bg=#ffe28a</code> (shading), <code>size=14</code> (pt),{" "}
                <code>font="Georgia"</code>, <code>u</code>, <code>sc</code> (small caps),{" "}
                <code>caps</code>; combine freely
              </Row>
              <Row
                k={
                  <>
                    <code>:::center</code> … <code>:::</code>
                  </>
                }
              >
                Alignment block — also <code>:::right</code>, <code>:::left</code>,{" "}
                <code>:::justify</code>
              </Row>
            </Crib>

            <H>DocForge extras</H>
            <Crib>
              <Row k={<code>Enter</code>}>
                <b>Smart lists</b> — inside a list, Enter carries the marker to the next item
                (numbered lists count on); Enter on an empty item ends the list, or steps a nested
                one out. <code>Tab</code> / <code>Shift</code>+<code>Tab</code> nest and un-nest the
                item
              </Row>
              <Row k={<code>/</code>}>
                <b>Slash commands</b> — type <code>/</code> at the start of a line and the dialect
                offers itself: <code>/table 3x4</code>, <code>/figure</code>, <code>/equation</code>
                , <code>/callout warning</code>, <code>/citation</code>, <code>/code python</code>.
                Enter inserts, Escape dismisses
              </Row>
              <Row k={<code>[screenshot: caption]</code>}>
                Screenshot placeholder — prints as a neat labelled box, numbered &ldquo;Figure
                N&rdquo;. Options after <code>|</code>: <code>w:60%</code> width,{" "}
                <code>noborder</code>, <code>#fig:name</code> for cross-referencing
              </Row>
              <Row k={<code>[table: caption]</code>}>
                Caption for the table that follows — numbered &ldquo;Table N&rdquo;. Add{" "}
                <code>| #tbl:name</code> to reference it
              </Row>
              <Row
                k={
                  <>
                    <code>[toc]</code> · <code>[lof]</code> · <code>[lot]</code>
                  </>
                }
              >
                Table of contents / list of figures / list of tables, with real page numbers
              </Row>
              <Row k={<code>[pagebreak]</code>}>Start a new page</Row>
              <Row
                k={
                  <>
                    <code>:::note Title</code> … <code>:::</code>
                  </>
                }
              >
                Callout box — also <code>:::tip</code>, <code>:::warning</code>,{" "}
                <code>:::important</code>
              </Row>
              <Row
                k={
                  <>
                    <code>:::banner</code> … <code>:::</code>
                  </>
                }
              >
                Title plate — a filled band; first line set large and white, the rest small in the
                accent tint
              </Row>
              <Row
                k={
                  <>
                    <code>[^1]</code> and <code>[^1]: note text</code>
                  </>
                }
              >
                Footnote — set at the foot of the right page, exactly as it prints
              </Row>
              <Row
                k={
                  <>
                    <code>[#fig:name]</code> <code>[#tbl:name]</code> <code>[#sec:name]</code>
                  </>
                }
              >
                Cross-reference — prints as &ldquo;Figure 3&rdquo;, &ldquo;Table 1&rdquo;,
                &ldquo;Section 2.1&rdquo;. Label a heading with{" "}
                <code>{"## Title {#sec:name}"}</code>
              </Row>
              <Row
                k={
                  <>
                    <code>[@key]</code> and <code>[@key]: Full reference</code>
                  </>
                }
              >
                Citation and its entry; <code>[references]</code> places the list. Style (numeric
                [1] or Author–year) in Settings. Locators work: <code>[@key, p. 33]</code>
              </Row>
              <Row
                k={
                  <>
                    <code>$x^2$</code> and <code>$$ … $$</code>
                  </>
                }
              >
                Mathematics (LaTeX) — inline or display
              </Row>
            </Crib>

            <H>The desk</H>
            <p>
              <b>Ctrl+K</b> opens the command palette — every action in the studio, searchable by
              name. The <b>outline</b> button above the manuscript lists your sections; click one to
              jump. <b>Settings</b> holds the document&rsquo;s identity, theme, typefaces, page and
              border options — four themes, six embedded typeface families, and the same accent
              colour system as the classic edition.
            </p>
            <p>
              The moon button switches the chrome between the day desk and the night shift;{" "}
              <b>the document itself always renders and prints on white</b>. Find highlights every
              match in the source and reads out an honest &ldquo;n of m&rdquo;; Replace All is one
              undo step and says how many it changed.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
