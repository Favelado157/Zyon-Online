// Auditoria CORRETA dos assets de mapa. O cliente (PreLoadFloorData.getMapFloorData) só usa
// mapmaterial/land/<id>/tile_x_y.jpg para os mapas 10001..10005; todos os outros montam o chão com os elementos
// listados DENTRO do .maps (campo url). tools/map-audit.ts e tools/asset-audit.ts assumiam tiles para todo mapa
// e acusavam milhares de arquivos "faltando" que o cliente nunca pede.
// Uso: node --env-file=.env tools/map-assets-audit.ts
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import postgres from 'postgres';
import { decodeAmf3 } from './amf3.ts';

const root = resolve(import.meta.dirname, '..');
const cdn = join(root, 'cdn');
const sql = postgres(process.env.DATABASE_URL!);
const rows = async (set: string) => (await sql<{ data: Record<string, string> }[]>`SELECT data FROM catalog.template_records WHERE set_name = ${set}`).map(r => r.data);
const [camps, maps] = await Promise.all([rows('Campaigns'), rows('MapInfos')]);

const urls = (v: unknown, out: Set<string>) => {
  if (!v || typeof v !== 'object') return;
  if (Array.isArray(v)) { for (const x of v) urls(x, out); return; }
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (k === 'url' && typeof x === 'string' && x) out.add(x.replace(/^\/+/, ''));
    else urls(x, out);
  }
};

const mapResult = new Map<string, { exists: boolean; missing: string[]; total: number; error?: string }>();
const check = (file: string) => {
  if (mapResult.has(file)) return mapResult.get(file)!;
  const p = join(cdn, 'maps', file, `${file}.maps`);
  let r: { exists: boolean; missing: string[]; total: number; error?: string };
  if (!existsSync(p)) r = { exists: false, missing: [], total: 0 };
  else {
    try {
      const raw = readFileSync(p);
      const data = decodeAmf3(raw[0] === 0x78 ? inflateSync(raw) : raw);
      const set = new Set<string>();
      urls(data, set);
      const tileMap = Number(file) >= 10001 && Number(file) <= 10005;
      const missing = [...set].filter(u => !existsSync(join(cdn, u)));
      if (tileMap && !(existsSync(join(cdn, 'mapmaterial/land', file)) && readdirSync(join(cdn, 'mapmaterial/land', file)).length)) missing.push(`mapmaterial/land/${file}/ (tiles)`);
      r = { exists: true, missing, total: set.size };
    } catch (e) { r = { exists: true, missing: [], total: 0, error: e instanceof Error ? e.message : String(e) }; }
  }
  mapResult.set(file, r);
  return r;
};

let ok = 0, noMaps = 0, partial = 0, errors = 0;
const bad: string[] = [];
for (const c of camps) {
  const m = maps.find(x => x.CampaignId === c.CampaignId);
  const file = m?.MapFileId;
  if (!file) continue;
  const r = check(file);
  if (r.error) { errors++; bad.push(`${c.CampaignId} ${c.CampaignName}: .maps ilegível (${r.error})`); }
  else if (!r.exists) { noMaps++; bad.push(`${c.CampaignId} ${c.CampaignName}: sem maps/${file}/${file}.maps`); }
  else if (r.missing.length) { partial++; bad.push(`${c.CampaignId} ${c.CampaignName}: ${r.missing.length}/${r.total} elementos ausentes (ex.: ${r.missing.slice(0, 2).join(', ')})`); }
  else ok++;
}
console.log(`campanhas com mapa completo: ${ok} | sem .maps: ${noMaps} | com elementos ausentes: ${partial} | .maps ilegível: ${errors}`);
for (const l of bad.slice(0, 40)) console.log('  ' + l);
const allMissing = new Set([...mapResult.values()].flatMap(r => r.missing));
console.log(`elementos distintos ausentes no cdn/: ${allMissing.size}`);

// --remote: só HEAD no CDN oficial (não baixa nada) para medir quantos existem lá e o tamanho total;
// grava logs/map-assets-missing.json para um download futuro autorizado.
if (process.argv.includes('--remote')) {
  const ORIGIN = 'https://res1264oas.creaction-network.com/';
  const list = [...allMissing].filter(u => !u.endsWith('(tiles)'));
  const found: { path: string; size: number }[] = [];
  let i = 0;
  const worker = async () => {
    while (i < list.length) {
      const path = list[i++]!;
      try {
        const r = await fetch(ORIGIN + path, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
        if (r.ok) found.push({ path, size: Number(r.headers.get('content-length')) || 0 });
      } catch { /* indisponível */ }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  const bytes = found.reduce((s, f) => s + f.size, 0);
  console.log(`no CDN oficial: ${found.length}/${list.length} arquivos, ${(bytes / 1048576).toFixed(1)} MB`);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(root, 'logs', 'map-assets-missing.json'), JSON.stringify(found, null, 1));
}
await sql.end();
