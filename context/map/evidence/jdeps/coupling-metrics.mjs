// Coupling metrics (Robert C. Martin) from jdeps DOT output.
//
// Usage:
//   node coupling-metrics.mjs <main classes.dot> [--test <test classes.dot>]
//        [--classes-dir <target/classes>] [--strip-prefix <prefix>] [--csv]
//
// Input: a class-level graph produced with `jdeps -verbose -e '<app regex>' -dotoutput`,
// i.e. class-full/classes.dot (it must include same-package edges, so -verbose, not -verbose:class).
//
// Metrics count only application classes (edges to JDK/libraries are already filtered out by -e).
// Nested and anonymous classes (Outer$Inner) are folded into their outer class.
//
//   Class level:   Ca = number of distinct classes that depend on it
//                  Ce = number of distinct classes it depends on
//   Package level: Ca = number of classes OUTSIDE the package that depend on classes inside it
//                  Ce = number of classes OUTSIDE the package that classes inside it depend on
//   I = Ce / (Ca + Ce)   (0 = maximally stable, 1 = maximally unstable, n/a when Ca + Ce = 0)
//
// --test         adds Ca_test: number of distinct test classes that reference the class/package
// --classes-dir  lists every compiled class, so classes with no app-internal edges (e.g. system/*)
//                still appear with Ca = Ce = 0 instead of being silently missing from the graph

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const mainDot = args[0];
if (!mainDot || mainDot.startsWith('--')) {
	console.error('usage: node coupling-metrics.mjs <classes.dot> [--test <dot>] [--classes-dir <dir>] [--strip-prefix <p>] [--csv]');
	process.exit(2);
}
const testDot = opt('--test');
const classesDir = opt('--classes-dir');
const prefix = opt('--strip-prefix') ?? '';
const csv = args.includes('--csv');

const norm = (raw) => raw.replace(/\s*\([^)]*\)\s*$/, '').trim().replace(/\$.*$/, '');
const pkgOf = (cls) => (cls.includes('.') ? cls.slice(0, cls.lastIndexOf('.')) : '');
const short = (n) => (prefix && n.startsWith(prefix) ? n.slice(prefix.length) || '<root>' : n);
const shortPkg = (p) => (prefix && (p + '.') === prefix ? '<root>' : short(p));

function readEdges(file) {
	const edges = [];
	for (const [, a, b] of readFileSync(file, 'utf8').matchAll(/"([^"]+)"\s*->\s*"([^"]+)"/g)) {
		const from = norm(a);
		const to = norm(b);
		if (from !== to) edges.push([from, to]);
	}
	return edges;
}

const classes = new Set();
const out = new Map(); // class -> Set(classes it depends on)
const inc = new Map(); // class -> Set(classes depending on it)
const ensure = (c) => {
	classes.add(c);
	if (!out.has(c)) out.set(c, new Set());
	if (!inc.has(c)) inc.set(c, new Set());
};

for (const [a, b] of readEdges(mainDot)) {
	ensure(a);
	ensure(b);
	out.get(a).add(b);
	inc.get(b).add(a);
}

if (classesDir) {
	const walk = (dir) => {
		for (const name of readdirSync(dir)) {
			const p = join(dir, name);
			if (statSync(p).isDirectory()) walk(p);
			else if (name.endsWith('.class') && !name.includes('$') && name !== 'package-info.class') {
				ensure(relative(classesDir, p).slice(0, -'.class'.length).split(sep).join('.'));
			}
		}
	};
	walk(classesDir);
}

const testInc = new Map(); // production class -> Set(test classes)
if (testDot) {
	for (const [a, b] of readEdges(testDot)) {
		if (!classes.has(b) || classes.has(a)) continue; // keep test -> production edges only
		if (!testInc.has(b)) testInc.set(b, new Set());
		testInc.get(b).add(a);
	}
}

const inst = (ca, ce) => (ca + ce === 0 ? 'n/a' : (ce / (ca + ce)).toFixed(2));

// Package level
const pkgs = new Map();
for (const c of classes) {
	const p = pkgOf(c);
	if (!pkgs.has(p)) pkgs.set(p, { classes: 0, ca: new Set(), ce: new Set(), test: new Set() });
	const rec = pkgs.get(p);
	rec.classes++;
	for (const d of out.get(c)) if (pkgOf(d) !== p) rec.ce.add(d);
	for (const s of inc.get(c)) if (pkgOf(s) !== p) rec.ca.add(s);
	for (const t of testInc.get(c) ?? []) rec.test.add(t);
}

const pkgRows = [...pkgs.entries()]
	.map(([p, r]) => [shortPkg(p), r.classes, r.ca.size, r.ce.size, inst(r.ca.size, r.ce.size), testDot ? r.test.size : '-'])
	.sort((x, y) => String(x[0]).localeCompare(String(y[0])));

const classRows = [...classes]
	.map((c) => {
		const ca = inc.get(c).size;
		const ce = out.get(c).size;
		return [short(c), ca, ce, inst(ca, ce), testDot ? (testInc.get(c)?.size ?? 0) : '-',
			[...inc.get(c)].map(short).sort().join(' '), [...out.get(c)].map(short).sort().join(' ')];
	})
	.sort((x, y) => String(x[0]).localeCompare(String(y[0])));

function print(title, header, rows) {
	if (csv) {
		console.log(`# ${title}`);
		console.log(header.join(','));
		rows.forEach((r) => console.log(r.map((v) => `"${v}"`).join(',')));
		console.log();
		return;
	}
	console.log(`\n## ${title}\n`);
	console.log(`| ${header.join(' | ')} |`);
	console.log(`|${header.map(() => '---').join('|')}|`);
	rows.forEach((r) => console.log(`| ${r.join(' | ')} |`));
}

console.log(`source: ${mainDot}${testDot ? ` + ${testDot}` : ''}${classesDir ? ` + ${classesDir}` : ''}`);
print('Packages', ['package', 'classes', 'Ca', 'Ce', 'I', 'Ca_test'], pkgRows);
print('Classes', ['class', 'Ca', 'Ce', 'I', 'Ca_test', 'depended on by', 'depends on'], classRows);
