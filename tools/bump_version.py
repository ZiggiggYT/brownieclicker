"""Set the release version everywhere it appears: python tools/bump_version.py 1.2.0

Updates js/version.js (BB.VERSION, which also names the service worker cache)
and every ?v= cache-busting query string in index.html.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) != 2 or not re.fullmatch(r'\d+\.\d+\.\d+', sys.argv[1]):
    sys.exit('usage: python tools/bump_version.py X.Y.Z')
v = sys.argv[1]

p = os.path.join(ROOT, 'js', 'version.js')
s = open(p).read()
open(p, 'w').write(re.sub(r"BB\.VERSION = '[^']*'", "BB.VERSION = '%s'" % v, s))

p = os.path.join(ROOT, 'index.html')
s = open(p).read()
open(p, 'w').write(re.sub(r'\?v=[0-9.]+', '?v=' + v, s))
print('version is now', v)
