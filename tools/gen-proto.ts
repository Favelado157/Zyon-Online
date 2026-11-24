import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const decompiled = process.argv[2] ?? join(root, '.docs', 'legend-online-main', 'decompiled');
const out = join(root, 'data', 'protocol', 'schema.json');
const PREFIX = 'com.road.yishi.proto.';

interface Field { num: number; name: string; type: string; repeated: boolean; msg?: string }
interface Msg { name: string; package: string; fields: Field[]; source: string }

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.as')) yield p;
  }
}

function parse(text: string, source: string): Msg | null {
  const pkg = /^\s*package\s+([\w.]+)/m.exec(text)?.[1];
  const cls = /public\s+(?:final\s+)?(?:dynamic\s+)?class\s+(\w+)\s+extends\s+Message\b/.exec(text)?.[1];
  if (!pkg || !cls || !pkg.startsWith(PREFIX.slice(0, -1))) return null;
  const pkgShort = pkg === PREFIX.slice(0, -1) ? '' : pkg.slice(PREFIX.length);
  const imports = new Map<string, string>();
  for (const m of text.matchAll(/import\s+com\.road\.yishi\.proto\.([\w.]+)\.(\w+);/g)) imports.set(m[2], `${m[1]}.${m[2]}`);
  const decl = new Map<string, string>();
  for (const m of text.matchAll(/(?:private|public)\s+var\s+(\w+?)(?:\$field)?\s*:\s*(\w+)/g)) decl.set(m[1], m[2]);
  const elem = new Map<string, string>();
  for (const m of text.matchAll(/\[ArrayElementType\("([\w.]+)"\)\]\s*public\s+var\s+(\w+)\s*:\s*Array/g)) elem.set(m[2], m[1]);
  for (const m of text.matchAll(/(_loc\d+_)\s*=\s*new\s+(\w+)\(\);[\s\S]{0,200}?(\w+)\.push\(\1\)/g)) if (!elem.has(m[3])) elem.set(m[3], m[2]);

  const qualify = (t: string) => {
    if (t.startsWith(PREFIX)) return t.slice(PREFIX.length);
    return imports.get(t) ?? (pkgShort ? `${pkgShort}.${t}` : t);
  };

  const body = text.slice(text.indexOf('writeToBuffer'), text.indexOf('readFromSlice'));
  const fields: Field[] = [];
  const re = /writeTag\(param1,(\d+),(\d+)\);\s*WriteUtils\.write\$TYPE_(\w+)\(param1,([\w$]+)(\[[^\]]*\])?\)/g;
  for (const m of body.matchAll(re)) {
    const num = Number(m[2]);
    if (fields.some(f => f.num === num)) continue;
    const repeated = !!m[5];
    const name = m[4].replace(/\$field$/, '');
    const type = m[3];
    const f: Field = { num, name, type, repeated };
    if (type === 'MESSAGE') {
      const t = repeated ? elem.get(name) : decl.get(name);
      if (t) f.msg = qualify(t);
    }
    fields.push(f);
  }
  fields.sort((a, b) => a.num - b.num);
  return { name: cls, package: pkgShort, fields, source };
}

const msgs: Record<string, Msg> = {};
const byName: Record<string, string[]> = {};
for await (const file of walk(decompiled)) {
  if (!file.replace(/\\/g, '/').includes('/com/road/yishi/proto/')) continue;
  const m = parse(await readFile(file, 'utf8'), file.slice(decompiled.length + 1).replace(/\\/g, '/'));
  if (!m) continue;
  const key = m.package ? `${m.package}.${m.name}` : m.name;
  if (msgs[key]) continue;
  msgs[key] = m;
  (byName[m.name] ??= []).push(key);
}
const sorted = Object.fromEntries(Object.entries(msgs).sort(([a], [b]) => a.localeCompare(b)));
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ messages: sorted, byName }, null, 1));
const missing = Object.values(msgs).flatMap(m => m.fields.filter(f => f.type === 'MESSAGE' && (!f.msg || !msgs[f.msg])).map(f => `${m.package}.${m.name}.${f.name} -> ${f.msg}`));
console.log(`${Object.keys(msgs).length} mensagens, ${Object.values(byName).filter(v => v.length > 1).length} nomes repetidos, ${missing.length} referencias sem resolver`);
for (const x of missing.slice(0, 20)) console.log('  ', x);
