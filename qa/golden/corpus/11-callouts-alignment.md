# Meridian M40 Field Commissioning Guide

This guide walks an installation engineer through the commissioning of the Meridian M40
data logger, from unpacking to the first verified upload. It is written to be printed and
carried: the procedures below assume no network access at the site beyond the logger's own
uplink, and no tools beyond the kit shipped in the crate.

Each stage ends with a verification step. Where a stage carries risk to the instrument or
to the readings, the risk is set in a boxed notice. The conventions used for those notices
are explained as they first appear, so the guide can be read front to back without a
separate key.

## Unpacking and site preparation

The crate contains the logger, two antenna masts, a sensor loom, and a sealed pouch of
desiccant. Inspect the crate before signing the delivery note; transport damage claims
must be lodged within five working days.

:::note
The desiccant pouch is part of the instrument, not the packaging. It ships inside the
enclosure and must remain there until the humidity check in the final stage.
:::

The site survey sheet from the planning pack states the intended mast positions. Confirm
both positions before assembly, because the loom length cannot be extended in the field.

:::tip Checks before assembly
Confirm each of the following on the survey sheet before any bolt is tightened:

- The mast bases sit on undisturbed ground, not backfill
- The cable route crosses no vehicle track, and where it runs along a fence line it is
  fixed on the side away from livestock
- The solar panel faces within 15 degrees of true south, with a clear sky view:
  - no shading between 09:00 and 15:00 at winter solstice
  - no vegetation expected to grow into the sky view within two seasons
- The enclosure door opens fully without fouling the mast stays
:::

Assembly itself follows the sequence printed inside the crate lid. Two engineers are
required for raising the primary mast; the secondary mast can be raised by one. Torque
figures for the stay tensioners are stamped on the tensioner bodies and repeated on the
survey sheet, and the figures on the sheet take precedence where they disagree.

With the masts raised and the loom dressed along the confirmed route, the logger is ready
for its bench check. The bench check is the last point at which a fault can be corrected
without a return visit, so the notice below is the longest in this guide and is worth
reading twice before the enclosure is opened.

:::important The bench check must not be skipped
The logger ships in a transport state in which the uplink radio is disabled and the
sensor bus is isolated. Powering the array before leaving the transport state will not
damage the logger, but it produces a boot log that support cannot distinguish from a
field fault, and it voids the pre-provisioned uplink certificate.

Bring the logger out of the transport state at the bench, on battery power alone, with
the serial console attached:

```
m40> state
transport (radio off, bus isolated)
m40> provision --site KL-0447
certificate ok, expires 2027-03-31
m40> state field
field (radio idle, bus live)
```

If `provision` reports a certificate mismatch, stop: the logger was allocated to a
different site and the uplink will refuse it. Do not attempt to edit the site code in
place. Repack the logger and quote the serial number to allocations.
:::

The remaining stages assume the bench check passed and the console reported the field
state. Reconnect the loom in the order marked on the bulkhead plate.

:::warning
Sensor channels are hot-pluggable but the bus is not: connecting the loom's bulkhead
plug with the array energised will blow the bus fuse. The fuse is a **sacrificial**
part, and one spare is ==taped inside the enclosure door==, but a second failure means
a return visit. The plug is keyed; if it does not seat with *light* pressure, the key
is misaligned -- check that the `BUS-A` marking is uppermost and ++never++ force it.
:::

## Notices and typographic conventions

Boxed notices in this guide carry emphasis exactly as the body text does. A notice may
mark a term as **critical**, flag a superseded figure as ~~withdrawn~~, pick out a
console command in `fixed type`, ++underline++ a hard limit, or ==highlight== the one
value that must be copied onto the survey sheet. Chemical and mathematical marks such as
CO~2~ and m^2^ also pass through unchanged, which matters for the sensor datasheets
reproduced in the service appendix.

## Alignment of set matter

Certain elements of the printed guide are set apart from the body by alignment rather
than by boxing. The dedication of the guide is centred:

:::center
*For the crews of the northern line, who commissioned forty loggers in one winter.*

**Meridian Instruments, Region North**
:::

Sign-off lines at the end of each inspection record are set to the right, in the manner
of a letter:

:::right
R. Halloran, Commissioning Lead

Countersigned at the depot on the day of return
:::

Where a passage must stay ranged left regardless of the document-wide justification
setting -- serial numbers and console transcripts read badly when justified -- it is set
in an explicit left block:

:::left
Serial plates are read from the bulkhead, not from the crate label. Record the plate
exactly, including the two-letter prefix and the check digit.
:::

The legal notice, by contrast, is fully justified even when the body text is ranged
left, so that it prints as a single dense block:

:::justify
The measurements produced by a commissioned logger remain the property of the site
operator. Meridian Instruments retains a licence to aggregate anonymised diagnostics
for reliability engineering, and this licence survives decommissioning of the site. No
other rights in the data are granted or implied by commissioning.
:::

## Notices within set matter

The two conventions combine. A notice may centre a reference line within its own body:

:::tip Reading the wind rose
The wind rose on the survey sheet is oriented to true north, not magnetic.

:::center
**Survey sheet, panel 4** -- the rose is printed beside the mast plan.
:::

Apply the local declination from the sheet's margin before comparing the rose with a
compass reading taken at the site.
:::

And a justified closing block may itself carry a notice where the print run requires it:

:::justify
This guide is revised annually. Between revisions, amendments are issued as numbered
field bulletins, and a bulletin supersedes the page it names from the date it is
issued. A crew working from an unamended copy is working from a superseded guide.

:::note Bulletin service
Bulletins are posted to the address on the service record. Confirm the address at
commissioning time; a wrong address here is the most common cause of crews working
from a superseded page.
:::
:::

## Closing the site

Return the console lead to its pouch, verify the desiccant indicator shows blue, and
close the enclosure to the torque marked on the door. The first verified upload should
appear on the operations dashboard within twenty minutes of the door closing; if it has
not appeared within one hour, reopen the enclosure and repeat the bench check before
leaving the site.
