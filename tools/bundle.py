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
        # collapse multiline lists, and translate `x as y` into the
        # destructuring form `x: y` - the same thing, different syntax
        inner = ' '.join(what.strip()[1:-1].split())
        parts = []
        for entry in inner.split(','):
            entry = entry.strip()
            if not entry:
                continue
            bits = entry.split()
            if len(bits) == 3 and bits[1] == 'as':
                parts.append(f'{bits[0]}: {bits[2]}')
            else:
                parts.append(entry)
        return f"const {{ {', '.join(parts)} }} = __req('{target}');"

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
<style>
/* Nothing but the game. It draws its own interface, so the page is a dark room
   with a screen in it. */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: #0d0a09;
  overflow: hidden;
}
body {
  display: flex;
  align-items: center;
  justify-content: center;
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
}
#game:focus { outline: none; }
#fallback {
  position: absolute;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  letter-spacing: 2px;
  color: #7a4e29;
}
@media (pointer: coarse) { #game { cursor: none; } }
</style>
"""

ARTIFACT_BODY = """<canvas id="game" width="480" height="270" tabindex="0" aria-label="DAM IT"></canvas>
<p id="fallback">Loading the valley&hellip;</p>
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
window.__DAMIT_FIT = {{ padY: 0, padX: 0 }};
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
