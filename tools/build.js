/* Inline the whole game into one file.
   Writes:
     dist/index.html     - a standalone document you can open or email
     dist/artifact.html  - page-content only (no doctype/html/head/body),
                           for hosts that supply their own document shell */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// <link rel=stylesheet href=...> -> <style>
html = html.replace(/<link[^>]*href="([^"]+\.css)"[^>]*>/g, (m, href) => {
  const css = fs.readFileSync(path.join(root, href), 'utf8');
  return '<style>\n' + css + '\n</style>';
});

// <script src=...> -> <script>
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  let js = fs.readFileSync(path.join(root, src), 'utf8');
  // a literal </script> inside a string would close the tag early
  js = js.replace(/<\/script/gi, '<\\/script');
  return '<script>\n/* ===== ' + src + ' ===== */\n' + js + '\n</script>';
});

fs.writeFileSync(path.join(out, 'index.html'), html);

// content-only variant: strip the document shell, keep <title> + everything in <body>
const title = (html.match(/<title>[\s\S]*?<\/title>/i) || [''])[0];
const style = (html.match(/<style>[\s\S]*?<\/style>/i) || [''])[0];
const body = (html.match(/<body>([\s\S]*)<\/body>/i) || [, ''])[1];
fs.writeFileSync(path.join(out, 'artifact.html'), title + '\n' + style + '\n' + body.trim() + '\n');

const kb = f => (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + ' KB';
console.log('dist/index.html    ' + kb('index.html'));
console.log('dist/artifact.html ' + kb('artifact.html'));
