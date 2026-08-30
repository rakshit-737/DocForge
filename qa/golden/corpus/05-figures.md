# Meridian Console Interface Survey

This survey records the operator console of the Meridian platform at release 4.2 as a set of
reserved capture slots. The slots are placed, captioned and numbered now, before the captures
themselves exist, so that pagination and cross-references settle early; until an image is
attached, each slot prints as a labelled placeholder frame, and the document is complete and
reviewable in that state. The figures are listed below in order of appearance.

[lof]

## Full-measure slots

The plainest slot carries nothing but a caption. It spans the full text column and draws the
standard placeholder frame, and it takes the first figure number in the survey.

[screenshot: The console home view as it appears at first sign-in]

A slot may also carry a persistent name, so that prose anywhere in the survey can point to it
by number rather than by position. The overview board below is cited twice more before the
survey ends, and both citations must resolve to the same number that appears beside the slot.

[screenshot: The fleet overview board with all six subsystems reporting | #fig:overview]

## Reduced-width slots

Detail captures do not need the full measure. A width option scales the slot to a percentage
of the text column, and frame, caption and numbering follow it. The queue inspector needs a
little over half the measure; the filter drawer, cropped harder, also drops its frame because
the drawer's own outline reads as a border already.

[screenshot: The queue inspector, cropped to the depth gauge | w:60% | #fig:queue]

[screenshot: The filter drawer at its narrowest useful crop | w:40% | noborder | #fig:filters]

The width key may also be spelled out in full, which some authors find easier to read back in
a longhand source file. The long spelling and the short one must behave identically.

[screenshot: The alert roster, its width spelled with the long key | width:55% | #fig:alias]

A requested width beyond the measure is clamped back to the measure, so an over-eager value
cannot push a slot into the margins or off the page.

[screenshot: An over-wide request, clamped back to the full column | w:150% | #fig:clamp]

## Frameless and unnamed slots

Captures of the console's own dialog windows already carry chrome of their own, so the frame
is dropped while the caption and the number remain.

[screenshot: The export dialog, frameless because its window chrome is border enough | noborder]

Option order is free. The command palette slot below names itself first and sizes itself last,
and it parses identically to the conventional order used everywhere else in the survey.

[screenshot: The command palette caught mid-search | #fig:palette | noborder | w:45%]

A slot may reserve space without any caption at all. It still takes a number, it can still be
named and cited, and its entry in the figure list is simply bare.

[screenshot | #fig:spacer | w:35%]

The tersest slot of all is the bare token on a line of its own, which the survey keeps as a
control beside its fully optioned neighbours.

[screenshot]

## A slot keyed to an absent attachment

One slot is keyed to an attachment name that is not yet present in the document, which is the
normal state of a survey in circulation. Until the keyed image arrives, the slot prints the
same placeholder frame as its unkeyed neighbours, at the width it requested, and its number
and caption stand ready for the capture.

[screenshot: The audit trail, keyed to a capture that has not yet been attached | img:audit-cap | w:50% | #fig:ghost]

## Reading the survey

The slots above were placed against the sign-off checklist, and the checklist reads in figure
numbers. The reviewer confirms the fleet position on [#fig:overview] before anything else,
then walks the two operational details, [#fig:queue] and [#fig:filters], which between them
cover every control the night shift touches. The width conventions are checked against
[#fig:alias] and [#fig:clamp], the first because the long key must behave exactly like the
short one, the second because the clamp is the only thing standing between an over-wide
request and a broken measure.

The palette capture, [#fig:palette], is reviewed last among the named slots, because the
palette changes more often than any other surface on the console and its crop is renegotiated
at nearly every release. The unnamed reservation, [#fig:spacer], is checked only for position:
it holds the gap between the palette and the keyed audit slot, and nothing in the survey
depends on its content. The keyed slot, [#fig:ghost], is signed off only when its attachment
arrives; until then the placeholder stands in, and the survey remains printable in full.

Every number used in the two paragraphs above must match the number printed beside the slot it
names, and each must match its entry in the figure list at the front of the survey. That
three-way agreement, slot to citation to list, is the whole warrant of this document: the
captures will change at every release, but the frame of numbers around them must not.

## Sign-off

The survey is complete when every slot above holds its capture and every citation in the
reading section still resolves to the number beside the slot it names. Nothing else on the
console changed at release 4.2, and no further slots are reserved.
