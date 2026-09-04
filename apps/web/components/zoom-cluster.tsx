"use client";
/* One zoom instrument, mounted in both modes (ledger I4).

   The studio's preview bar and the PDF bench used to ship two: different
   markup, different styling, and a percentage readout that reset to fit in
   one and did nothing at all in the other. A reader who learns "click the
   percentage to reset" should find it true wherever they are, so there is one
   component now and both bars mount it. */

export function ZoomCluster({
  pct,
  onStep,
  onFit,
  label = "Zoom",
}: {
  /** The level as a percentage, already rounded. */
  pct: number;
  /** ±0.1 of scale — the step both surfaces used. */
  onStep: (delta: number) => void;
  onFit: () => void;
  label?: string;
}) {
  return (
    <fieldset
      className="m-0 flex items-center gap-1 border-0 p-0"
      aria-label={label}
      data-zoom-cluster=""
    >
      <button
        type="button"
        onClick={() => onStep(-0.1)}
        className="min-h-6 min-w-6 px-1 hover:text-ink"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        onClick={onFit}
        className="min-w-12 px-1 tabular-nums hover:text-ink"
        title="Reset to fit"
      >
        {pct}%
      </button>
      <button
        type="button"
        onClick={() => onStep(0.1)}
        className="min-h-6 min-w-6 px-1 hover:text-ink"
        aria-label="Zoom in"
      >
        +
      </button>
      <button type="button" onClick={onFit} className="px-1 hover:text-ink">
        Fit
      </button>
    </fieldset>
  );
}
