// Gera data/events/funny-types.json a partir do catálogo de condições dos "Destaques"
// (.docs/legend-online-main/roadmap/seasonal-events/funny.md, extraído do cliente: FunnyType + textos pt-BR).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const md = readFileSync(join(root, '.docs/legend-online-main/roadmap/seasonal-events/funny.md'), 'utf8');
const out: { code: number; key: string; text: string }[] = [];
for (const line of md.split('\n')) {
  const m = /^\| (\d+) \| `([A-Z0-9_]+)` \| (.*?) \|\s*$/.exec(line.trim());
  if (!m) continue;
  const text = m[3].replace(/\s*\(`title\w+`, :\d+(-\d+)?\)\s*$/, '').replace(/\(no text\)/, '').trim().replace(/,$/, '');
  if (!out.some(o => o.code === Number(m[1]))) out.push({ code: Number(m[1]), key: m[2], text });
}
mkdirSync(join(root, 'data/events'), { recursive: true });
writeFileSync(join(root, 'data/events/funny-types.json'), JSON.stringify(out, null, 1));
console.log(`${out.length} tipos de evento`);
