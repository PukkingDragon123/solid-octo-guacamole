#!/usr/bin/env python3
"""
Pack DAM IT into one self-contained HTML file.

The game is written as plain ES modules with no build step, which is lovely to
work on and useless where a page has to be a single file (an Artifact, an email
attachment, a USB stick). This walks the module graph from js/main.js, wraps each
module in a function, and drops the lot into index.html's markup with a tiny
loader in front - no dependencies, no minifier, and the source stays readable in
the output so it can still be debugged in a browser.

    python3 tools/bundle.py [-o dist/damit.html]
"""

import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(os.path.join(__file__, '..')))
ENTRY = 'js/main.js'

IMPORT_RE = re.compile(
    r"^import\s+(?P<what>\{[^}]*\}|\*\s+as\s+\w+)\s+from\s+'(?P<path>[^']+)';[ \t]*$",
    re.MULTILINE | re.DOTALL,
)
EXPORT_DECL_RE = re.compile(r"^export\s+(?:async\s+)?(const|let|function|class)\s+(\w+)", re.MULTILINE)


def resolve(importer, spec):
    """'./gfx/pixel.js' seen from 'js/scenes/camp.js' -> 'js/gfx/pixel.js'."""
    base = os.path.dirname(importer)
    return os.path.normpath(os.path.join(base, spec)).replace(os.sep, '/')


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as fh:
        return fh.read()


def transform(path, src):
    """Rewrite one module's imports and exports. Returns (code, deps)."""
    deps = []

    def swap(match):
        what = match.group('what')
        target = resolve(path, match.group('path'))
        deps.append(target)
        if what.startswith('*'):
            name = what.split('as')[1].strip()
            return f"const {name} = __req('{target}');"
        names = ' '.join(what.split())          # collapse multiline lists
        return f"const {names} = __req('{target}');"

    code = IMPORT_RE.sub(swap, src)
    exports = [m.group(2) for m in EXPORT_DECL_RE.finditer(code)]
    code = re.sub(r"^export\s+", '', code, flags=re.MULTILINE)
    if exports:
        listed = ', '.join(sorted(set(exports)))
        code += f"\n\nreturn {{ {listed} }};\n"
    else:
        code += "\n\nreturn {};\n"
    return code, deps


def collect(entry):
    """Depth-first walk of the module graph, deepest first."""
    order, seen, stack = [], set(), []

    def visit(path):
        if path in seen:
            if path in stack:
                raise SystemExit(f"circular import: {' -> '.join(stack + [path])}")
            return
        stack.append(path)
        code, deps = transform(path, read(path))
        for dep in deps:
            visit(dep)
        stack.pop()
        seen.add(path)
        order.append((path, code))

    visit(entry)
    return order


LOADER = """
// ---- module loader -------------------------------------------------------
// Each module below is a function that takes __req and returns its exports.
// Modules run once, the first time something asks for them.
const __defs = {};
const __cache = {};
function __def(name, fn) { __defs[name] = fn; }
function __req(name) {
  if (__cache[name]) return __cache[name];
  const fn = __defs[name];
  if (!fn) throw new Error('module not bundled: ' + name);
  const exports = fn(__req) || {};
  __cache[name] = exports;
  return exports;
}
"""


ARTIFACT_HEAD = """<title>DAM IT</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bevan&family=Bitter:wght@400;600&family=Special+Elite&display=swap">
<style>
/* One committed visual world: a lamplit workshop after closing time. Every
   colour is painted explicitly, so the page holds on either host ground. */
:root {
  --ground: #150f0b;      /* near-black, warm brown bias */
  --timber: #2b1e14;
  --timber-lit: #3b2a1c;
  --plank: #c99a5f;
  --sawdust: #f2e2bf;
  --lamp: #f7cc55;
  --ledger: #c93b32;
  --rule: #4d301b;
  --display: Bevan, "Bitter", Georgia, serif;
  --body: Bitter, Georgia, "Times New Roman", serif;
  --util: "Special Elite", ui-monospace, Menlo, monospace;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100%;
  background: var(--ground);
  background-image:
    radial-gradient(120% 70% at 50% -10%, rgba(247, 204, 85, 0.10), transparent 60%),
    repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 22px, rgba(255,255,255,0.012) 22px 23px);
  color: var(--sawdust);
  font-family: var(--body);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 18px;
}
.masthead {
  width: 100%;
  max-width: 980px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--rule);
  padding-bottom: 7px;
}
.wordmark {
  font-family: var(--display);
  font-size: clamp(22px, 4.2vw, 34px);
  letter-spacing: 0.02em;
  color: var(--lamp);
  line-height: 1;
  text-wrap: balance;
}
.wordmark span { color: var(--plank); }
.pitch {
  font-family: var(--util);
  font-size: 13px;
  color: var(--plank);
  text-align: right;
  max-width: 46ch;
  line-height: 1.35;
}
.stage {
  width: 100%;
  display: flex;
  justify-content: center;
  overflow: auto;
}
#game {
  image-rendering: pixelated;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
  display: block;
  cursor: crosshair;
  background: #12395e;
  box-shadow: 0 0 0 3px #2e1c11, 0 0 0 6px var(--rule), 0 14px 44px rgba(0, 0, 0, 0.85);
}
#game:focus-visible { outline: 3px solid var(--lamp); outline-offset: 8px; }
#fallback { font-family: var(--util); letter-spacing: 2px; color: var(--plank); }
.keys {
  width: 100%;
  max-width: 980px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  align-items: center;
  font-family: var(--util);
  font-size: 12.5px;
  color: var(--plank);
}
.keys b {
  font-family: var(--util);
  font-weight: 400;
  color: var(--sawdust);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
}
/* key caps, cut from the same timber as the game's own widgets */
kbd {
  font-family: var(--util);
  font-size: 11.5px;
  color: #1d1712;
  background: linear-gradient(180deg, #e8d3a6 0 2px, var(--plank) 2px);
  border: 1px solid #1d1712;
  border-bottom-width: 2px;
  padding: 1px 5px 0;
  margin-right: 2px;
  display: inline-block;
  min-width: 17px;
  text-align: center;
}
.note {
  width: 100%;
  max-width: 980px;
  font-size: 13px;
  line-height: 1.5;
  color: #a9855c;
  border-top: 1px solid var(--rule);
  padding-top: 8px;
}
.note em { color: var(--sawdust); font-style: normal; }
.note .owed { color: var(--ledger); }
@media (max-width: 620px) {
  .masthead { flex-direction: column; align-items: flex-start; gap: 4px; }
  .pitch { text-align: left; }
  body { padding: 8px 8px 14px; }
}
@media (prefers-reduced-motion: reduce) { #game { box-shadow: 0 0 0 3px #2e1c11; } }
</style>
"""

ARTIFACT_BODY = """<header class="masthead">
  <div class="wordmark">DAM IT <span>&mdash; grandpa's workshop</span></div>
  <p class="pitch">Grandma is in the infirmary. The bill is 4,800 acorns.<br>Fell it, saw it, build it, fit it. Pay her way home.</p>
</header>

<div class="stage">
  <canvas id="game" width="480" height="270" tabindex="0" aria-label="DAM IT, a pixel-art carpentry game"></canvas>
</div>
<p id="fallback">Loading the valley&hellip;</p>

<div class="keys">
  <span><b>Workshop</b> <kbd>A</kbd><kbd>D</kbd> walk &middot; <kbd>E</kbd> use the bench you are at</span>
  <span><b>Trees</b> <kbd>E</kbd> chop &middot; <kbd>Space</kbd> swing &mdash; then run when it creaks</span>
  <span><b>A customer</b> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk &middot; <kbd>E</kbd> carry and fit &middot; <kbd>B</kbd> blueprint</span>
  <span><b>Anywhere</b> <kbd>H</kbd> help &middot; <kbd>Enter</kbd> skip the film</span>
</div>

<p class="note">
  Click the screen once before you play &mdash; that gives it the keyboard, and lets the
  sound start. Every sound is synthesised as it happens, which matters in the wood:
  the <em>creak</em> is the warning that a trunk is coming down, and if you are still
  under it when it lands you wake up in the leaves. The game saves itself to this
  browser, so <em>Continue</em> picks up where you left off. Owing:
  <span class="owed">4,800 acorns</span>.
</p>
"""


def build(out_path, artifact=False):
    modules = collect(ENTRY)
    html = read('index.html')
    css = read('css/style.css')

    chunks = [LOADER]
    for path, code in modules:
        indented = '\n'.join(('  ' + ln if ln.strip() else ln) for ln in code.split('\n'))
        chunks.append(f"__def('{path}', function (__req) {{\n{indented}\n}});\n")
    chunks.append(f"__req('{ENTRY}');\n")
    script = '\n'.join(chunks)

    if artifact:
        # Body-only markup: an Artifact page is wrapped in its own document
        # skeleton at publish time, so no html/head/body tags of our own.
        return write(out_path, ARTIFACT_HEAD + ARTIFACT_BODY + f"""
<script>
document.getElementById('fallback').remove();
// leave room for the masthead and the key legend when sizing the screen
window.__DAMIT_FIT = {{ padY: 190, padX: 24 }};
(function () {{
'use strict';
{script}
}})();
document.getElementById('game').focus({{ preventScroll: true }});
</script>
""", len(modules))

    # inline the stylesheet, and swap the module script for the bundle
    html = html.replace('<link rel="stylesheet" href="css/style.css" />',
                        f"<style>\n{css}\n</style>")
    html = re.sub(r'\s*<script type="module" src="js/main\.js"></script>', '', html)
    html = html.replace('<script type="module">document.getElementById(\'fallback\').remove();</script>',
                        '')
    html = html.replace('</body>', f"""  <script>
document.getElementById('fallback').remove();
(function () {{
'use strict';
{script}
}})();
  </script>
</body>""")

    return write(out_path, html, len(modules))


def write(out_path, text, count):
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as fh:
        fh.write(text)
    size = os.path.getsize(out_path)
    print(f"{out_path}: {count} modules, {size // 1024} KB")
    return out_path


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--out', default='dist/damit.html')
    ap.add_argument('--artifact', action='store_true',
                    help='emit body-only markup for publishing as an Artifact')
    args = ap.parse_args()
    out = args.out if os.path.isabs(args.out) else os.path.join(ROOT, args.out)
    build(out, artifact=args.artifact)
