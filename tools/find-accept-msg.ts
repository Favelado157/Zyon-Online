import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '.docs', 'legend-online-main', 'decompiled');
const codes = process.argv.slice(2).map(Number);

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.as')) yield p;
  }
}

const found = new Map<number, Set<string>>();
for await (const file of walk(root)) {
  const text = await readFile(file, 'utf8');
  for (const code of codes) {
    const re = new RegExp(`"SLGSocketEvent"\\s*\\+\\s*${code}\\s*,\\s*(\\w+)`, 'g');
    for (const m of text.matchAll(re)) {
      const fn = m[1];
      const body = new RegExp(`function\\s+${fn}\\s*\\([^)]*\\)[^{]*\\{([\\s\\S]{0,1500}?)\\n      \\}`).exec(text)?.[1] ?? '';
      const msg = /new\s+(\w+Msg\w*)\(\)/.exec(body)?.[1] ?? (/readBody\(/.test(body) ? '?' : 'sem corpo');
      const imp = msg && msg !== '?' ? new RegExp(`import com\\.road\\.yishi\\.proto\\.([\\w.]+)\\.${msg};`).exec(text)?.[1] : null;
      const s = found.get(code) ?? new Set();
      s.add(`${imp ? `${imp}.` : ''}${msg}  <- ${fn} @ ${file.slice(root.length + 1)}`);
      found.set(code, s);
    }
  }
}
for (const c of codes) console.log(c, [...(found.get(c) ?? ['nao encontrado'])].join('\n     '));
