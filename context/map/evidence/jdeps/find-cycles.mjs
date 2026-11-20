// Finds dependency cycles in jdeps DOT output (strongly connected components, Tarjan).
//
// Usage:
//   node find-cycles.mjs <file.dot> [--strip-prefix <prefix>] [--merge-nested]
//
// --strip-prefix  removes a package prefix from node names for readability
// --merge-nested  folds nested/anonymous classes (Outer$Inner) into Outer, so a cycle
//                 that runs through an inner class is still reported against its owner
//
// Prints every SCC with more than one node, plus self-loops, and for each SCC the
// shortest cycle (BFS) as the "smallest real loop". Exit code 0 means no cycles.

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args[0];
if (!file) {
	console.error('usage: node find-cycles.mjs <file.dot> [--strip-prefix <p>] [--merge-nested]');
	process.exit(2);
}
const prefixIdx = args.indexOf('--strip-prefix');
const prefix = prefixIdx >= 0 ? args[prefixIdx + 1] : '';
const mergeNested = args.includes('--merge-nested');

const norm = (raw) => {
	let n = raw.replace(/\s*\([^)]*\)\s*$/, '').trim(); // drop " (classes)" / " (jar name)"
	if (mergeNested) n = n.replace(/\$.*$/, '');
	if (prefix && n.startsWith(prefix)) n = n.slice(prefix.length) || '<root>';
	return n;
};

const edgeRe = /"([^"]+)"\s*->\s*"([^"]+)"/g;
const graph = new Map();
const addNode = (n) => graph.has(n) || graph.set(n, new Set());
const selfLoops = new Set();
let edgeCount = 0;

for (const [, a, b] of readFileSync(file, 'utf8').matchAll(edgeRe)) {
	const from = norm(a);
	const to = norm(b);
	addNode(from);
	addNode(to);
	if (from === to) {
		// After --merge-nested, Outer -> Outer$Inner becomes a self-loop; that is not a real cycle.
		if (!mergeNested && !a.includes('$') && !b.includes('$')) selfLoops.add(from);
		continue;
	}
	graph.get(from).add(to);
	edgeCount++;
}

// Tarjan's SCC
let index = 0;
const idx = new Map();
const low = new Map();
const onStack = new Set();
const stack = [];
const sccs = [];

function strongConnect(v) {
	idx.set(v, index);
	low.set(v, index);
	index++;
	stack.push(v);
	onStack.add(v);
	for (const w of graph.get(v)) {
		if (!idx.has(w)) {
			strongConnect(w);
			low.set(v, Math.min(low.get(v), low.get(w)));
		}
		else if (onStack.has(w)) {
			low.set(v, Math.min(low.get(v), idx.get(w)));
		}
	}
	if (low.get(v) === idx.get(v)) {
		const comp = [];
		let w;
		do {
			w = stack.pop();
			onStack.delete(w);
			comp.push(w);
		} while (w !== v);
		if (comp.length > 1) sccs.push(comp.sort());
	}
}
for (const v of graph.keys()) if (!idx.has(v)) strongConnect(v);

// Shortest cycle inside one SCC: BFS from each node back to itself, restricted to the SCC.
function shortestCycle(comp) {
	const inComp = new Set(comp);
	let best = null;
	for (const start of comp) {
		const prev = new Map([[start, null]]);
		const queue = [start];
		let found = null;
		while (queue.length && !found) {
			const v = queue.shift();
			for (const w of graph.get(v)) {
				if (!inComp.has(w)) continue;
				if (w === start) {
					found = v;
					break;
				}
				if (!prev.has(w)) {
					prev.set(w, v);
					queue.push(w);
				}
			}
		}
		if (found) {
			const path = [];
			for (let v = found; v !== null; v = prev.get(v)) path.unshift(v);
			path.push(start);
			if (!best || path.length < best.length) best = path;
		}
	}
	return best;
}

console.log(`file: ${file}`);
console.log(`nodes: ${graph.size}, edges: ${edgeCount}${mergeNested ? ' (nested classes merged)' : ''}`);
console.log(`self-loops: ${selfLoops.size ? [...selfLoops].join(', ') : 'none'}`);
console.log(`cycles (SCC > 1 node): ${sccs.length}`);
sccs.forEach((comp, i) => {
	console.log(`\nSCC ${i + 1} (${comp.length} nodes): ${comp.join(', ')}`);
	console.log(`  smallest loop: ${shortestCycle(comp).join(' -> ')}`);
});
process.exit(sccs.length || selfLoops.size ? 1 : 0);
