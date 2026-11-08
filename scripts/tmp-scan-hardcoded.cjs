// Temporary: count hard-coded English UI text in .tsx files.
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const roots = process.argv.slice(2);
const ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label", "description", "emptyText", "confirmText", "cancelText", "helperText", "tooltip"]);
const english = (s) => /[A-Za-z]{2,}/.test(s) && /[a-z]/.test(s) && !/^[a-z0-9_.:/#?=&%@\-]+$/i.test(s.trim()) && !/^(https?:|\/|#|[a-z-]+:[a-z-]+$)/.test(s.trim());
const results = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.next|__tests__/.test(p)) walk(p); }
    else if (p.endsWith(".tsx") && !/\.test\.|\.stories\./.test(p)) scan(p);
  }
}
function scan(file) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let n = 0; const samples = [];
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const s = node.getText().replace(/\s+/g, " ").trim();
      if (s && english(s)) { n++; if (samples.length < 3) samples.push(s.slice(0, 50)); }
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && ATTRS.has(node.name.getText())) {
      const s = node.initializer.text; if (english(s) && /\s/.test(s) || /^[A-Z][a-z]+$/.test(s)) { n++; if (samples.length < 3) samples.push(s.slice(0, 50)); }
    } else if (ts.isCallExpression(node) && /^toast\.(success|error|info|warning)$/.test(node.expression.getText()) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && english(node.arguments[0].text)) {
      n++; if (samples.length < 3) samples.push(node.arguments[0].text.slice(0, 50));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (n) results.push({ file, n, samples });
}
for (const r of roots) walk(r);
results.sort((a, b) => b.n - a.n);
const total = results.reduce((s, r) => s + r.n, 0);
console.log("files", results.length, "strings", total);
const byArea = {};
for (const r of results) { const k = r.file.split("/").slice(0, 3).join("/"); byArea[k] = (byArea[k] || 0) + r.n; }
console.log(Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${v}\t${k}`).join("\n"));
fs.writeFileSync(process.env.OUT, JSON.stringify(results, null, 1));
