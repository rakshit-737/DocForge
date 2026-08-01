"""Produce the subsetted static TTF cuts that DocForge embeds.

Run this only when the font set changes; the output in fonts/ is committed so that
`node build.mjs` needs neither Python nor a network connection.

    python tools/build_fonts.py

Source families are variable fonts from github.com/google/fonts (all SIL OFL 1.1).
Each is instanced to a fixed weight, subsetted to the character set DocForge can
actually print, and written as a plain TrueType file. TrueType — not WOFF2 — because
the *same bytes* are used twice: inlined as an @font-face for the PDF path and
embedded into the .docx for the Word path. One set of outlines, two consumers,
guaranteed identical letterforms.
"""

import io
import os
import sys
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.subset import Subsetter, Options

RAW = "https://raw.githubusercontent.com/google/fonts/main/ofl"
OUT = os.path.join(os.path.dirname(__file__), "..", "fonts")
CACHE = os.path.join(os.path.dirname(__file__), ".fontcache")

# The characters DocForge can put on a page: Latin text, the punctuation the
# typographic pass introduces (curly quotes, dashes, ellipsis, nbsp/thin/figure
# spaces), the currency and arrow glyphs the shipped templates use, footnote
# superscripts, and the bullet the callout titles draw.
CODEPOINTS = (
    list(range(0x0020, 0x007F))                      # basic latin
    + list(range(0x00A0, 0x0100))                    # latin-1 supplement
    + [0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017D, 0x017E]   # OE oe S caron etc
    + [0x0131, 0x0192, 0x02C6, 0x02DC]
    + [0x2007, 0x2009, 0x200A, 0x2011, 0x202F, 0x2060]           # spaces & non-breaking
    + [0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E]
    + [0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203A, 0x2044]
    + [0x2032, 0x2033, 0x25CF, 0x25AA, 0x25A0]
    + [0x20AC, 0x20B9, 0x20BD, 0x2122, 0x2113, 0x2116]           # euro, rupee, ruble, tm
    + [0x2190, 0x2191, 0x2192, 0x2193, 0x2194, 0x21D2]           # arrows (report template)
    + [0x2212, 0x2260, 0x2264, 0x2265, 0x2248, 0x00B1, 0x00D7, 0x00F7]
    + [0x00B2, 0x00B3, 0x00B9]                                    # superscript 1 2 3
    + list(range(0x2070, 0x207A))                                 # superscript 0 4-9 + - ( )
    + [0x207F]
    + [0xFB01, 0xFB02]                                            # fi fl ligatures
)

# family key -> (source file, output name, weight, italic?)
CUTS = [
    ("sourcesans3",  "SourceSans3[wght].ttf",            "DocForgeSans-Regular.ttf",     400, False),
    ("sourcesans3",  "SourceSans3[wght].ttf",            "DocForgeSans-Bold.ttf",        700, False),
    ("sourcesans3",  "SourceSans3-Italic[wght].ttf",     "DocForgeSans-Italic.ttf",      400, True),
    ("sourcesans3",  "SourceSans3-Italic[wght].ttf",     "DocForgeSans-BoldItalic.ttf",  700, True),
    ("sourceserif4", "SourceSerif4[opsz,wght].ttf",      "DocForgeSerif-Regular.ttf",    400, False),
    ("sourceserif4", "SourceSerif4[opsz,wght].ttf",      "DocForgeSerif-Bold.ttf",       700, False),
    ("sourceserif4", "SourceSerif4-Italic[opsz,wght].ttf", "DocForgeSerif-Italic.ttf",   400, True),
    ("sourceserif4", "SourceSerif4-Italic[opsz,wght].ttf", "DocForgeSerif-BoldItalic.ttf", 700, True),
    ("sourcecodepro", "SourceCodePro[wght].ttf",         "DocForgeMono-Regular.ttf",     400, False),
    ("sourcecodepro", "SourceCodePro[wght].ttf",         "DocForgeMono-Bold.ttf",        700, False),
    ("inter",         "Inter[opsz,wght].ttf",            "DocForgeInter-Regular.ttf",    400, False),
    ("inter",         "Inter[opsz,wght].ttf",            "DocForgeInter-Bold.ttf",       700, False),
    ("inter",         "Inter-Italic[opsz,wght].ttf",     "DocForgeInter-Italic.ttf",     400, True),
    ("inter",         "Inter-Italic[opsz,wght].ttf",     "DocForgeInter-BoldItalic.ttf", 700, True),
    ("montserrat",    "Montserrat[wght].ttf",            "DocForgeMont-Regular.ttf",     400, False),
    ("montserrat",    "Montserrat[wght].ttf",            "DocForgeMont-Bold.ttf",        700, False),
    ("montserrat",    "Montserrat-Italic[wght].ttf",     "DocForgeMont-Italic.ttf",      400, True),
    ("montserrat",    "Montserrat-Italic[wght].ttf",     "DocForgeMont-BoldItalic.ttf",  700, True),
    ("ebgaramond",    "EBGaramond[wght].ttf",            "DocForgeGaramond-Regular.ttf", 400, False),
    ("ebgaramond",    "EBGaramond[wght].ttf",            "DocForgeGaramond-Bold.ttf",    700, False),
    ("ebgaramond",    "EBGaramond-Italic[wght].ttf",     "DocForgeGaramond-Italic.ttf",  400, True),
    ("ebgaramond",    "EBGaramond-Italic[wght].ttf",     "DocForgeGaramond-BoldItalic.ttf", 700, True),
    ("crimsonpro",    "CrimsonPro[wght].ttf",            "DocForgeCrimson-Regular.ttf",  400, False),
    ("crimsonpro",    "CrimsonPro[wght].ttf",            "DocForgeCrimson-Bold.ttf",     700, False),
    ("crimsonpro",    "CrimsonPro-Italic[wght].ttf",     "DocForgeCrimson-Italic.ttf",   400, True),
    ("crimsonpro",    "CrimsonPro-Italic[wght].ttf",     "DocForgeCrimson-BoldItalic.ttf", 700, True),
]

# The family name written into name ID 1. Word matches embedded fonts by this name,
# and it must be the same string the CSS @font-face declares.
FAMILY_OF = {
    "DocForgeSans": "DocForge Sans",
    "DocForgeSerif": "DocForge Serif",
    "DocForgeMono": "DocForge Mono",
    "DocForgeInter": "DocForge Inter",
    "DocForgeMont": "DocForge Montserrat",
    "DocForgeGaramond": "DocForge Garamond",
    "DocForgeCrimson": "DocForge Crimson",
}


def fetch(family, filename):
    os.makedirs(CACHE, exist_ok=True)
    local = os.path.join(CACHE, filename.replace("[", "_").replace("]", "_"))
    if os.path.exists(local):
        return local
    url = f"{RAW}/{family}/{urllib.request.quote(filename)}"
    print(f"  download {filename}")
    with urllib.request.urlopen(url) as r:
        data = r.read()
    with open(local, "wb") as fh:
        fh.write(data)
    return local


def set_names(font, family, subfamily, weight, italic):
    """Rewrite the name table so Word and CSS agree on one family with four cuts."""
    full = f"{family} {subfamily}" if subfamily != "Regular" else family
    ps = full.replace(" ", "")
    name = font["name"]
    for nid, value in ((1, family), (2, subfamily), (3, f"DocForge:{full}"),
                       (4, full), (6, ps), (16, family), (17, subfamily)):
        name.setName(value, nid, 3, 1, 0x409)
        name.setName(value, nid, 1, 0, 0)
    font["OS/2"].usWeightClass = weight
    # fsSelection / macStyle must agree with the cut or Word synthesises its own bold.
    fs = font["OS/2"].fsSelection & ~(1 | 32 | 64)
    fs |= (1 if italic else 0) | (32 if weight >= 700 else 0)
    if not italic and weight < 700:
        fs |= 64
    font["OS/2"].fsSelection = fs
    font["head"].macStyle = (1 if weight >= 700 else 0) | (2 if italic else 0)


def build():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for family, src, out_name, weight, italic in CUTS:
        path = fetch(family, src)
        font = TTFont(path)

        axes = {"wght": weight}
        if "opsz" in {a.axisTag for a in font["fvar"].axes}:
            axes["opsz"] = 11  # text optical size, not display
        font = instancer.instantiateVariableFont(font, axes, updateFontNames=False)

        stem, subfamily = out_name[:-4].split("-")
        set_names(font, FAMILY_OF[stem], subfamily, weight, italic)

        opts = Options()
        opts.layout_features = ["kern", "liga", "clig", "calt", "ccmp", "locl",
                                "tnum", "onum", "lnum", "pnum", "frac", "sups", "subs", "case"]
        opts.name_IDs = ["*"]
        opts.name_legacy = True
        opts.notdef_outline = True
        opts.recalc_bounds = True
        opts.drop_tables += ["DSIG"]
        opts.hinting = False
        sub = Subsetter(options=opts)
        sub.populate(unicodes=sorted(set(CODEPOINTS)))
        sub.subset(font)

        dest = os.path.join(OUT, out_name)
        font.flavor = None
        font.save(dest)
        size = os.path.getsize(dest)
        total += size
        print(f"  {out_name:32s} {size/1024:7.1f} KB")

    # licence, shipped alongside as OFL 1.1 requires
    for fam in ("sourcesans3", "sourceserif4", "sourcecodepro", "inter", "montserrat", "ebgaramond", "crimsonpro"):
        with urllib.request.urlopen(f"{RAW}/{fam}/OFL.txt") as r:
            with open(os.path.join(OUT, f"OFL-{fam}.txt"), "wb") as fh:
                fh.write(r.read())

    print(f"\n  total {total/1024:.1f} KB raw, ~{total*4/3/1024:.1f} KB base64")


if __name__ == "__main__":
    build()
