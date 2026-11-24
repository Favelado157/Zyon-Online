// Opcodes cliente->servidor com "message": null no data/protocol/opcodes.json: o servidor não decodifica o corpo
// e o handler recebe {} sem aviso. Para cada um, procura no AS3 o new PackageOut(N) e a mensagem protobuf enviada
// logo depois (sendProtoBuffer/sendProtobuffer(pkg, msg)). Uso: node tools/opcode-body-audit.ts [--fix]
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dec = join(root, '.docs/legend-online-main/decompiled');
const opPath = join(root, 'data/protocol/opcodes.json');
const op = JSON.parse(await readFile(opPath, 'utf8'));
// O data/protocol/schema.json não tem todas as classes; o Schema do pacote de protocolo (o que o servidor usa) tem.
const { Schema } = await import('@lou/protocol');
const real = Schema.load();
const schema = new Proxy({} as Record<string, boolean>, {
  get: (_t, name: string) => { try { real.decode(name, Buffer.alloc(0)); return true; } catch { return false; } },
});
const walk = async function* (d: string): AsyncGenerator<string> {
  for (const e of await readdir(d, { withFileTypes: true }).catch(() => [])) {
    const p = join(d, e.name);
    if (e.isDirectory()) yield* walk(p); else if (p.endsWith('.as')) yield p;
  }
};

const nulls = new Set(Object.entries(op.send as Record<string, { message: string | null }>).filter(([, v]) => !v.message).map(([k]) => Number(k)));
const found = new Map<number, { msgs: Set<string>; bare: number; at: string[] }>();
for await (const f of walk(dec)) {
  const lines = (await readFile(f, 'utf8')).split('\n');
  const imports = new Map<string, string>();
  for (const l of lines) { const m = /import com\.road\.yishi\.proto\.(\w+)\.(\w+);/.exec(l); if (m) imports.set(m[2]!, `${m[1]}.${m[2]}`); }
  lines.forEach((l, i) => {
    const m = /(\w+)\s*:\s*PackageOut\s*=\s*new\s+PackageOut\(\s*(\d+)\s*\)/.exec(l) ?? /(\w+)\s*=\s*new\s+PackageOut\(\s*(\d+)\s*\)/.exec(l);
    if (!m) return;
    const code = Number(m[2]);
    if (!nulls.has(code)) return;
    const e = found.get(code) ?? { msgs: new Set<string>(), bare: 0, at: [] };
    const win = lines.slice(i, i + 25).join('\n');
    const send = new RegExp(`send(?:Proto[Bb]uffer|Protobuffer)\\(\\s*${m[1]}\\s*,\\s*(\\w+)`).exec(win);
    if (send) {
      const v = send[1]!;
      const decl = new RegExp(`${v}\\s*:\\s*(\\w+)\\s*=|${v}\\s*=\\s*new\\s+(\\w+)\\(`).exec(win) ?? new RegExp(`var\\s+${v}\\s*:\\s*(\\w+)`).exec(lines.slice(Math.max(0, i - 15), i + 25).join('\n'));
      const cls = decl?.[1] ?? decl?.[2];
      const fq = cls ? imports.get(cls) : undefined;
      if (fq && schema[fq]) e.msgs.add(fq); else if (cls) e.msgs.add(`?${cls}`);
    } else e.bare++;
    e.at.push(`${relative(dec, f)}:${i + 1}`);
    found.set(code, e);
  });
}

const fix = process.argv.includes('--fix');
let fixed = 0;
const rows: string[] = [];
for (const [code, e] of [...found].sort((a, b) => a[0] - b[0])) {
  const real = [...e.msgs].filter(m => !m.startsWith('?'));
  rows.push(`${code}\t${[...e.msgs].join('|') || '-'}\tsem corpo:${e.bare}\t${e.at[0]}`);
  if (fix && real.length === 1 && e.bare === 0) {
    op.send[code].message = real[0];
    op.send[code].handlers = e.at.map(a => `audit @ decompiled/${a.replace(/\\/g, '/')}`);
    fixed++;
  }
}
console.log(rows.join('\n'));
console.log(`\nnulos: ${nulls.size} | achados no AS3: ${found.size} | com mensagem única (corrigível): ${[...found.values()].filter(e => e.msgs.size === 1 && ![...e.msgs][0]!.startsWith('?') && e.bare === 0).length}`);
if (fix) { await writeFile(opPath, JSON.stringify(op, null, 1) + '\n'); console.log(`corrigidos: ${fixed}`); }
