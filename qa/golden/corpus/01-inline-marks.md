# Inline Typography Conformance Survey

## Purpose and reading order

This survey records the behaviour of every inline mark in the DocForge
dialect, written as the running prose of a production manuscript rather than
as a bare checklist of tokens. Each construct is load-bearing: the document
doubles as a golden master, so a change on any rendered page signals a
regression in the inline tokenizers rather than a shift in editorial taste.
The survey was frozen against the engine baseline of 2024-03-14, and that
date must keep its hyphens in print even though the numeric ranges further
down this report are expected to take en dashes.

The sections proceed from the classic emphases through the ribbon marks, the
full highlighter palette, and the vertical marks, then into the combination
cases, and close with the punctuation the engine corrects on its own. The
padding prose between sections is not filler in the pejorative sense; it is
what carries the combination cases toward the first page boundary, which is
where inline marks have historically broken first.

## Baseline emphases

The four classic emphases come first, because everything else in this report
is measured against them. A phrase set in **bold weight** must read one full
grade heavier than its neighbours; a phrase set in *italic* must slope
without changing weight; and a phrase set in ***bold italic*** must do both
at once, drawn from a true cut rather than smeared from the roman. Fragments
of `inline code` sit in the fixed-pitch face and refuse every smart
substitution applied to the prose around them, which is why `i++ == "raw"`
prints exactly as typed. Struck material such as ~~the earlier nine-week
estimate~~ keeps its rule through the x-height rather than the baseline.

Hyperlinks behave as ordinary prose that happens to be anchored. The
[conformance archive](https://example.com/archive/typography/inline-marks/2024/conformance-survey)
above carries a deliberately long address so that the anchor text is likely
to wrap, and a short [reference card](https://example.org/refcard) sits
mid-sentence without disturbing the baseline grid around it.

## The ribbon marks

Word's Home ribbon contributes the marks that plain markdown never had. An
++underlined phrase++ takes a continuous rule, and the rule must clear the
descenders of ++typography++ rather than cut through them. The default
highlighter wraps ==a marked phrase== in the same yellow that Word applies
when no colour is named. The two marks nest in either order, so
++==an underlined highlight==++ and ==++a highlighted underline++== are
required to produce identical ink on the page.

Not every doubled sign is a mark. In the expressions i++ and j++ the
operators stay literal because a closer may not run into a word, and in the
condition done==1 the doubled equals stays literal for the same reason. The
tokenizers also keep to a single line of source, so a stray pair of equals
signs cannot swallow three paragraphs of an unlucky manuscript.

## The highlighter palette

The engine ships Word's fixed highlighter palette of fifteen named colours,
and this survey exercises every one of them, because the Word exporter takes
the colour by name and an unknown name falls back silently to yellow. In the
review workflow this document models, the palette carries meaning, and the
legend below is the meaning the editorial desk has agreed:

- =={yellow}Pending decisions== are held in the default yellow.
- =={green}Approved wording== signals text the reviewers have settled.
- =={cyan}Engineering queries== await an answer from the platform team.
- =={magenta}Legal escalations== go to counsel before publication.
- =={blue}Costing annotations== belong to the finance reviewer.
- =={red}Blocking defects== must be cleared before the gate review.
- =={darkBlue}Archived rulings== record decisions that are no longer open.
- =={darkCyan}Instrument readings== are copied straight from the bench log.
- =={darkGreen}Verified figures== have been checked against source data.
- =={darkMagenta}Supplier commitments== are contractual and carry dates.
- =={darkRed}Withdrawn claims== remain visible for the audit trail.
- =={darkYellow}Provisional totals== will be restated at quarter close.
- =={darkGray}Background material== may be cut without a formal ruling.
- =={lightGray}Formatting debts== are cosmetic and left unranked.
- =={black}Redacted passages== are struck from the published edition.

Colour names are matched without regard to case, so =={GREEN}a shouted green== and =={darkblue}a whispered dark blue== must resolve to exactly the
same run properties as their canonical spellings in the legend above.

## The vertical marks

Chemistry and mathematics lean on subscript and superscript. Water is H~2~O,
carbon dioxide is CO~2~, and the dilution series runs from 10^2^ through
10^6^ cells per ml. The test chamber measures 12 m^2^ in floor area and
30 m^3^ in volume. Subscripted indices such as x~i~ and x~j~ coexist with
superscripted powers such as x^2^, and a single term may carry both marks in
sequence, as k~B~^2^ does here. A superscript may itself carry weight, so
the notation 2^**10**^ sets its exponent in bold. Neither mark tolerates an
interior space, which is the documented boundary of the Pandoc convention
this dialect follows, and the doubled tilde remains the property of
strikethrough alone.

## Combinations under load

The combination cases are the heart of the survey, and they are set in full
sentences because running text is where nesting fails first. A bold phrase
may carry italic within it, as **a warning with *narrow exceptions* folded
inside** demonstrates; the mirrored case, *an aside resting on **hard
numbers** midway*, must weigh the inner words without losing the slope. The
highlighter accepts the same nesting, and so
==a marked phrase carrying a **bold core** and an *italic edge*== must tint every word while preserving both textures beneath the colour.

An underline may wrap richer content than plain words, and
++a rule spanning `verbatim code` and a [linked term](https://example.org/rule) together++ keeps one continuous line beneath all three textures. Struck
material accepts an inner highlight, so ~~an estimate containing ==its own marked correction== inside~~ layers the rule over the tint, while the inverse,
==a highlight carrying ~~struck words~~ inside==, layers the tint beneath the rule. The highlighter also wraps the vertical marks without complaint, as
==the corrected H~2~O yield of 10^3^ units== demonstrates in passing.

Wrap behaviour is exercised on purpose rather than left to chance. The
clause that follows is longer than any reasonable measure, and
++the continuous rule beneath this deliberately protracted underlined clause must survive the line break that the justified measure will force upon it, emerging on the following line with no gap at either end++ before the
paragraph returns to plain text. The same requirement binds the highlighter:
=={cyan}this cyan passage is long enough that the tinted box must break at the right margin and resume flush at the left margin of the following line, without bleeding into the margin on either side of the turn== and the prose
then continues as though nothing unusual had been asked of the compositor.

## Punctuation the engine corrects on its own

The prose of this section is typed in plain ASCII and must print with the
typographer's set. Straight double quotes around "a quoted phrase" become
curly, straight single quotes around 'a nested term' follow suit, and the
apostrophes in don't, it's, and the survey's own running head curl the same
way. A doubled hyphen -- like the one just typed -- prints as an en dash,
while a tripled hyphen---set tight against its neighbours---prints as an em
dash. Numeric ranges such as 1990-2020, pages 14-18, and the 9-5 working day
take en dashes without being asked, yet the ISO date 2024-03-14 keeps its
hyphens. An ellipsis typed as three periods... becomes a single character.
Units bind to their numbers with no-break spaces: 10 kg, 25 mm, 250 ms,
60 %, and 3 s must each refuse to break, and a mention of Figure 3 or
Table 2 or Section 4 holds together the same way, even though this survey
deliberately contains no figures or tables for those labels to resolve to.

## What the corrections must not touch

Every correction above stops at the border of code. The fence below repeats
the survey's own tokens inside a code block, and each must print as typed:

```
==not a highlight== ++not a rule++ **not bold** *not italic*
"straight quotes stay straight" -- stays doubled --- stays tripled
1990-2020 stays hyphenated, and i++ == done is untouched
```

## Closing statement

The survey finds the inline layer fit for purpose when, and only when, every
specimen above renders identically in the paginated preview, the printed
PDF, and the exported Word file. The palette legend must carry fifteen
distinct tints, the nested cases must hold their inner textures, the long
underlined and highlighted clauses must cross their line breaks cleanly, and
the punctuation section must show the typographer's set everywhere except
inside the fence. Any visible drift from the frozen baseline of this
document is a defect in the engine, not in the manuscript, and should be
raised against the inline tokenizers before any other suspect is pursued.
