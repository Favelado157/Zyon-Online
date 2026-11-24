// Cobertura de protocolo: opcodes que o cliente AS3 envia (`new PackageOut(N)`) × opcodes que o
// servidor trata (`router.on(N` em apps/server/src). Agrupa os ausentes pelo gerenciador AS3.
// Uso: node tools/opcode-coverage.ts [--md caminho.md]
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const walk = async function* (dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
};

const client = new Map<number, { hits: number; files: Set<string> }>();
for await (const f of walk(join(root, '.docs/legend-online-main/decompiled'))) {
  if (!f.endsWith('.as')) continue;
  const src = await readFile(f, 'utf8');
  for (const m of src.matchAll(/new\s+PackageOut\(\s*(\d+)/g)) {
    const op = Number(m[1]);
    const e = client.get(op) ?? { hits: 0, files: new Set<string>() };
    e.hits++; e.files.add(basename(f));
    client.set(op, e);
  }
}

const handled = new Set<number>();
for await (const f of walk(join(root, 'apps/server/src'))) {
  if (!f.endsWith('.ts')) continue;
  const src = await readFile(f, 'utf8');
  for (const m of src.matchAll(/\.on\(\s*(\d+)/g)) handled.add(Number(m[1]));
  // Registro em laço: for (const code of [15005, 25024]) router.on(code, ...)
  for (const m of src.matchAll(/for\s*\(\s*const\s+(\w+)\s+of\s+\[([\d,\s]+)\]\s*(?:as\s+const\s*)?\)[\s\S]{0,600}?\.on\(\s*(\w+)/g)) {
    if (m[1] === m[3]) for (const n of m[2]!.split(',')) if (n.trim()) handled.add(Number(n));
  }}

let names: Record<string, { constant?: string }> = {};
try { names = JSON.parse(await readFile(join(root, 'data/protocol/opcodes.json'), 'utf8')).send ?? {}; } catch {}

const missing = [...client.entries()].filter(([op]) => !handled.has(op)).sort((a, b) => b[1].hits - a[1].hits);
const byMgr = new Map<string, number[]>();
for (const [op, e] of missing) {
  const mgr = [...e.files][0]!;
  byMgr.set(mgr, [...(byMgr.get(mgr) ?? []), op]);
}

const lines = [
  `Cliente envia: ${client.size} | servidor trata: ${[...client.keys()].filter((o) => handled.has(o)).length} | ausentes: ${missing.length}`,
  '',
  '| Gerenciador AS3 | Ausentes | Opcodes |',
  '|---|---|---|',
  ...[...byMgr.entries()].sort((a, b) => b[1].length - a[1].length)
    .map(([m, ops]) => `| ${m} | ${ops.length} | ${ops.map((o) => `${o}${names[o]?.constant ? ` ${names[o]!.constant}` : ''}`).join(', ')} |`),
];
const mdArg = process.argv.indexOf('--md');
if (mdArg > 0) await writeFile(resolve(process.argv[mdArg + 1]!), lines.join('\n') + '\n');
console.log(lines.slice(0, 1).join('\n'));
console.log(lines.slice(4, 34).join('\n'));
