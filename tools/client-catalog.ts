// Catálogo funcional do CLIENTE: cada pasta de sistema do AS3 decompilado (módulo/scripts/<sistema>)
// com os opcodes que ela envia (`new PackageOut(N)`), quantos o servidor trata (`.on(N`) e quantos
// arquivos/UI existem. É o ponto de partida do mapa "o que o cliente original tem".
// Uso: node tools/client-catalog.ts [--md .roadmap/CATALOGO_CLIENTE.md]
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dec = join(root, '.docs/legend-online-main/decompiled');
const walk = async function* (dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
};

const handled = new Set<number>();
for await (const f of walk(join(root, 'apps/server/src'))) {
  if (!f.endsWith('.ts')) continue;
  const src = await readFile(f, 'utf8');
  for (const m of src.matchAll(/\.on\(\s*(\d+)/g)) handled.add(Number(m[1]));
  for (const m of src.matchAll(/for\s*\(\s*const\s+(\w+)\s+of\s+\[([\d,\s]+)\]\s*(?:as\s+const\s*)?\)[\s\S]{0,600}?\.on\(\s*(\w+)/g))
    if (m[1] === m[3]) for (const n of m[2]!.split(',')) if (n.trim()) handled.add(Number(n));
}

// Opcodes servidor->cliente que o servidor emite (qualquer `send(N` / `sendTo...(..., N`).
const emitted = new Set<number>();
for await (const f of walk(join(root, 'apps/server/src'))) {
  if (!f.endsWith('.ts')) continue;
  const src = await readFile(f, 'utf8');
  for (const m of src.matchAll(/\b(?:send|sendTo\w*|broadcast\w*|push\w*)\(\s*(?:[\w.]+,\s*)?(\d{1,5})\b/g)) emitted.add(Number(m[1]));
  // Pacotes montados como objeto: { code: 75, msg: 'battle.HeroOrderMsg', ... }
  for (const m of src.matchAll(/\bcode:\s*(\d{1,5})\s*,\s*msg:/g)) emitted.add(Number(m[1]));
  // Tabelas de envio: [4178, 'pkg.Msg'] / send(op, ...) com op vindo de constante numérica
  for (const m of src.matchAll(/\[\s*(\d{2,5})\s*,\s*'[\w.]+Msg'/g)) emitted.add(Number(m[1]));
}
// Constantes AcceptProtocolType.X = N
const accept = new Map<string, number>();
for await (const f of walk(dec)) {
  if (!f.endsWith('AcceptProtocolType.as')) continue;
  for (const m of (await readFile(f, 'utf8')).matchAll(/const\s+(\w+):u?int\s*=\s*(\d+)/g)) accept.set(m[1]!, Number(m[2]));
}

type Sys = { module: string; system: string; files: number; ops: Set<number>; listens: Set<number>; grades: Set<number> };
const systems = new Map<string, Sys>();
for await (const f of walk(dec)) {
  if (!f.endsWith('.as')) continue;
  const parts = relative(dec, f).split(sep);
  const module = parts[0]!;
  const i = parts.indexOf('scripts');
  const system = i >= 0 && parts.length > i + 2 ? parts[i + 1]! : (parts.length > 2 ? parts[1]! : '(raiz)');
  const key = `${module}/${system}`;
  const s = systems.get(key) ?? { module, system, files: 0, ops: new Set<number>(), listens: new Set<number>(), grades: new Set<number>() };
  s.files++;
  const src = await readFile(f, 'utf8');
  for (const m of src.matchAll(/new\s+PackageOut\(\s*(\d+)/g)) s.ops.add(Number(m[1]));
  for (const m of src.matchAll(/"SLGSocketEvent"\s*\+\s*(?:(\d+)|AcceptProtocolType\.(\w+))/g)) {
    const n = m[1] ? Number(m[1]) : accept.get(m[2]!);
    if (n) s.listens.add(n);
  }
  for (const m of src.matchAll(/thane\.grades\s*>=\s*(\d+)/g)) s.grades.add(Number(m[1]));
  systems.set(key, s);
}

const rows = [...systems.values()].filter(s => s.ops.size > 0 || s.listens.size > 0)
  .map(s => ({ ...s, ok: [...s.ops].filter(o => handled.has(o)).length, heard: [...s.listens].filter(o => emitted.has(o)).length }))
  .sort((a, b) => (a.ok / a.ops.size) - (b.ok / b.ops.size) || b.ops.size - a.ops.size);
const status = (r: { ok: number; ops: Set<number>; heard: number; listens: Set<number> }) => {
  const total = r.ops.size + r.listens.size, got = r.ok + r.heard;
  return got === total ? 'protocolo completo' : got === 0 ? 'ausente' : 'parcial';
};
const lines = [
  '# Catálogo funcional do cliente (gerado)',
  '',
  `Gerado por \`node tools/client-catalog.ts --md .roadmap/CATALOGO_CLIENTE.md\`. ${rows.length} sistemas do cliente enviam opcodes.`,
  '"Protocolo completo" só quer dizer que todo opcode enviado tem handler — NÃO que a regra está fiel ou validada no jogo.',
  '',
  'Colunas: C→S = opcodes que o cliente envia / com handler; S→C = respostas que o cliente escuta (`"SLGSocketEvent"+N`) / que o servidor emite em algum lugar; Nível = travas `thane.grades >= N` achadas na pasta.',
  '',
  '| Módulo | Sistema (pasta AS3) | Arquivos | C→S | S→C | Nível | Situação | C→S sem handler | S→C nunca emitidas |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.module} | ${r.system} | ${r.files} | ${r.ok}/${r.ops.size} | ${r.heard}/${r.listens.size} | ${[...r.grades].sort((a, b) => a - b).join(', ')} | ${status(r)} | ${[...r.ops].filter(o => !handled.has(o)).sort((a, b) => a - b).join(', ')} | ${[...r.listens].filter(o => !emitted.has(o)).sort((a, b) => a - b).join(', ')} |`),
];
const md = process.argv.indexOf('--md');
if (md > 0) await writeFile(resolve(process.argv[md + 1]!), lines.join('\n') + '\n');
const c = (s: string) => rows.filter(r => status(r) === s).length;
console.log(`sistemas: ${rows.length} | completos: ${c('protocolo completo')} | parciais: ${c('parcial')} | ausentes: ${c('ausente')}`);
