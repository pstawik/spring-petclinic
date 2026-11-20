// Converts a jdeps DOT graph into a Mermaid flowchart (used when Graphviz is not installed).
//
// Usage:
//   node dot-to-mermaid.mjs <file.dot> [--keep <regex>] [--only <Name,Name,...>]
//        [--extra <Name,Name,...>] [--direction TB|LR]
//
// --keep   keep only nodes whose full name matches the regex
//          (default: ^org\.springframework\.samples\.petclinic(\.|$))
// --only   after shortening, keep only these node names (class-level graph for one question)
// --extra  add isolated nodes that have no edges (e.g. a package with no app-internal deps)
//
// Names are shortened to their last segment; the application root package becomes "petclinic".
// Nested classes (Outer$Inner) are folded into Outer, self-loops are dropped.

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n) => {
	const i = args.indexOf(n);
	return i >= 0 ? args[i + 1] : undefined;
};
const file = args[0];
const keep = new RegExp(opt('--keep') ?? '^org\\.springframework\\.samples\\.petclinic(\\.|$)');
const only = opt('--only') ? new Set(opt('--only').split(',')) : null;
const extra = opt('--extra') ? opt('--extra').split(',') : [];
const direction = opt('--direction') ?? 'TB';

const full = (raw) => raw.replace(/\s*\([^)]*\)\s*$/, '').trim().replace(/\$.*$/, '');
const short = (n) => n.slice(n.lastIndexOf('.') + 1);
const id = (n) => n.replace(/[^A-Za-z0-9_]/g, '_');

const nodes = new Set(extra);
const edges = new Set();
for (const [, a, b] of readFileSync(file, 'utf8').matchAll(/"([^"]+)"\s*->\s*"([^"]+)"/g)) {
	const fa = full(a);
	const fb = full(b);
	if (!keep.test(fa) || !keep.test(fb)) continue;
	const sa = short(fa);
	const sb = short(fb);
	if (sa === sb) continue;
	if (only && (!only.has(sa) || !only.has(sb))) continue;
	nodes.add(sa);
	nodes.add(sb);
	edges.add(`${sa}\u0000${sb}`);
}

console.log(`flowchart ${direction}`);
for (const n of [...nodes].sort()) console.log(`    ${id(n)}["${n}"]`);
for (const e of [...edges].sort()) {
	const [a, b] = e.split('\u0000');
	console.log(`    ${id(a)} --> ${id(b)}`);
}
