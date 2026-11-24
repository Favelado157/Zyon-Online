// Baixa a versão sazonal atual do CDN oficial e grava em cdn-seasonal/<tema>/ SÓ os arquivos que diferem
// do cdn/ local. Nada em cdn/ é alterado. Ativação: liveops.settings 'cdn.season' = '<tema>' (routes/cdn.ts).
// Uso: node --env-file=.env tools/season-fetch.ts winter
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const theme = process.argv[2];
if (!theme || !/^[a-z0-9_-]+$/i.test(theme)) { console.error('Informe o tema, ex.: winter'); process.exit(1); }
const root = resolve(import.meta.dirname, '..');
const cdn = join(root, 'cdn');
const out = join(root, 'cdn-seasonal', theme);
const ORIGIN = 'https://res1264oas.creaction-network.com/';

const paths: string[] = [];
// Reino do Céu (mapa 10000): todos os tiles + miniatura.
for (const f of await readdir(join(cdn, 'mapmaterial/land/10000'))) paths.push(`mapmaterial/land/10000/${f}`);
// Fundo do vilarejo/castelo (um SWF por tipo de castelo).
for (const d of await readdir(join(cdn, 'sceneima'))) paths.push(`sceneima/${d}/map${d}.swf`);
// Telas de carregamento (UI; o Loading.swf da raiz é código e fica de fora).
paths.push('ui/zh_cn/swf/mainloading.swf', 'ui/zh_cn/swf/mainloadingii.swf', 'ui/zh_cn/swf/smallloading.swf');

const md5 = (b: Buffer) => createHash('md5').update(b).digest('hex');
const valid = (p: string, b: Buffer) => p.endsWith('.jpg') ? b[0] === 0xff && b[1] === 0xd8
  : p.endsWith('.swf') ? ['CWS', 'FWS', 'ZWS'].includes(b.subarray(0, 3).toString('ascii')) : b.length > 16;

let i = 0, changed = 0, same = 0, bytes = 0;
const failed: string[] = [], invalid: string[] = [], changedList: string[] = [];
async function worker() {
  while (i < paths.length) {
    const p = paths[i++];
    try {
      const r = await fetch(ORIGIN + p, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) { failed.push(p); continue; }
      const b = Buffer.from(await r.arrayBuffer());
      if (!valid(p, b)) { invalid.push(p); continue; }
      const local = await readFile(join(cdn, p)).catch(() => null);
      if (local && md5(local) === md5(b)) { same++; continue; }
      await mkdir(dirname(join(out, p)), { recursive: true });
      await writeFile(join(out, p), b);
      changed++; bytes += b.length; changedList.push(p);
    } catch { failed.push(p); }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
const groups = new Map<string, number>();
for (const p of changedList) { const g = p.split('/').slice(0, p.startsWith('sceneima') ? 1 : 3).join('/'); groups.set(g, (groups.get(g) ?? 0) + 1); }
console.log(`tema=${theme} verificados=${paths.length} diferentes=${changed} (${(bytes / 1048576).toFixed(1)} MB) iguais=${same} invalidos=${invalid.length} falharam=${failed.length}`);
for (const [g, n] of groups) console.log(`  ${g}: ${n}`);
if (failed.length) console.log('falharam:', failed.slice(0, 10).join(', '));
await writeFile(join(out, '_manifest.json'), JSON.stringify({ theme, fetchedAt: new Date().toISOString(), files: changedList }, null, 1));
