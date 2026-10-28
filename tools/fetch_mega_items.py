"""Import the two unmodified item icons and upstream license notices.

Upstream README declares CC-BY-NC-SA-4.0 to the extent assets are licensable;
these two files have no overriding entry in root/images REUSE.toml at this revision.
See docs/MEGA_ASSETS.md for provenance and the underlying Pokemon rights notice.
"""
from pathlib import Path
from fetch_sprites import fetch

ROOT = Path(__file__).resolve().parent.parent
REV = '8250b23677d4918801fc6fc1e95b6dd1c30ef6c4'
RAW = 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/' + REV


def main():
    files = [('images/items/' + n + '.png', 'assets/items/' + n + '.png')
             for n in ['lucarionite', 'mega_bracelet']]
    files += [('LICENSES/' + n, 'assets/licenses/' + n)
              for n in ['CC-BY-NC-SA-4.0.txt', 'LicenseRef-FAIR-USE.txt']]
    for source, target in files:
        data = fetch(RAW + '/' + source)
        if not data:
            raise RuntimeError('Missing upstream file: ' + source)
        dest = ROOT / target
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        print(target)


if __name__ == '__main__':
    main()
