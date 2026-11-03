"""Subset the OFL source fonts into public/assets/fonts/*.woff2 for the offline kiosk (DESIGN.md §3).

Usage: python -I tools/subset-fonts.py <dir>
<dir> holds the google/fonts originals: Orbitron.ttf (variable), Rajdhani-{Medium,SemiBold,Bold}.ttf,
NotoSansTC.ttf (variable) and *-OFL.txt. Needs fonttools + brotli.
Re-run after UI copy changes: Noto Sans TC keeps only the glyphs found in src/.
"""
import pathlib
import sys

from fontTools import subset

src = pathlib.Path(sys.argv[1])
root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'public/assets/fonts'
out.mkdir(parents=True, exist_ok=True)

latin = ''.join(map(chr, range(0x20, 0x7f))) + '·‹›«»×✓⚠⌁…—–’“”'
used = set(latin)
for p in root.glob('src/**/*'):
    if p.suffix in ('.ts', '.json', '.css'):
        used |= set(p.read_text(encoding='utf-8'))
# ponytail: UI glyphs only; IME nicknames fall back to Microsoft JhengHei per glyph. Add a common-character list if the PO wants one face for names.
cjk = ''.join(sorted(c for c in used if c.isprintable()))

for name, target, text in [
    ('Orbitron.ttf', 'orbitron.woff2', latin),
    ('Rajdhani-Medium.ttf', 'rajdhani-500.woff2', latin),
    ('Rajdhani-SemiBold.ttf', 'rajdhani-600.woff2', latin),
    ('Rajdhani-Bold.ttf', 'rajdhani-700.woff2', latin),
    ('NotoSansTC.ttf', 'noto-sans-tc.woff2', cjk),
]:
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    font = subset.load_font(str(src / name), opts)
    s = subset.Subsetter(opts)
    s.populate(text=text)
    s.subset(font)
    subset.save_font(font, str(out / target), opts)
    print(target, (out / target).stat().st_size)

for lic in src.glob('*-OFL.txt'):
    (out / lic.name).write_bytes(lic.read_bytes())
