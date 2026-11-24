import { readFile, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import postgres from 'postgres';

const root = resolve(import.meta.dirname, '..');
const cdn = join(root, 'cdn');
const ORIGIN = 'https://res1264oas.creaction-network.com/';
const TILE = 300;
const sql = postgres(process.env.DATABASE_URL!);

const rows = async (set: string) =>
  (await sql<{ data: Record<string, string> }[]>`SELECT data FROM catalog.template_records WHERE set_name = ${set}`).map(r => r.data);

const wanted = new Map<string, string>();
const add = (cat: string, path: string) => {
  const p = path.replace(/^\/+/, '').replace(/\\/g, '/');
  if (p && !p.includes('..') && !wanted.has(p)) wanted.set(p, cat);
};

const model = (name?: string) => {
  const n = (name ?? '').trim().toLowerCase();
  return n && /^[a-z0-9_]+$/.test(n) ? `swf/${n}/${n}.swf` : '';
};

for (const r of await rows('PawnTempInfos')) add('modelos', model(r.Swf));
for (const r of await rows('GameHeroTemp')) add('modelos', model(r.ResPath));
for (const r of await rows('SingleCampaignDatas')) add('modelos', model(r.ResPath));

for (const set of ['ItemTempInfos', 'starTempInfos', 'MountTempInfos', 'SkillTempInfos', 'PetTempInfos']) {
  for (const r of await rows(set).catch(() => [])) {
    const icon = (r.Icon ?? r.Icons ?? '').trim();
    if (icon && /\.(png|jpg|swf)$/i.test(icon)) add('icones', `icon/${icon.replace(/^\/+/, '')}`);
  }
}

// Prévias de montaria (MountAvatarPathHelper.getUrl: equip_show<AvatarPath>/2.swf).
for (const r of await rows('MountTempInfos')) {
  const p = (r.AvatarPath ?? '').trim();
  if (p) add('montarias', `equip_show${p.startsWith('/') ? p : '/' + p}/2.swf`);
}

const maps = await rows('MapInfos');
const seenFiles = new Set<string>();
for (const m of maps) {
  const f = m.MapFileId || m.Id;
  if (!f || seenFiles.has(f)) continue;
  seenFiles.add(f);
  const w = Number(m.Width) || 0, h = Number(m.Height) || 0;
  if (!w || !h) continue;
  for (let r = 0; r < Math.ceil(h / TILE); r++) for (let c = 0; c < Math.ceil(w / TILE); c++) add('mapas', `mapmaterial/land/${f}/tile_${c}_${r}.jpg`);
  // Dados do mapa (nós e grade caminhável), lidos por PreCampaignData; sem eles a campanha não abre.
  add('dados de mapa', `maps/${f}/${f}.maps`);
  add('dados de mapa', `maps/${f}/${f}.titles`);
}
if (process.argv.includes('--local')) {
  // Só conta o que falta no cdn/ local, sem consultar o CDN oficial.
  const byCatLocal = new Map<string, number>();
  for (const [p, cat] of wanted) if (!(await access(join(cdn, p)).then(() => true, () => false))) byCatLocal.set(cat, (byCatLocal.get(cat) ?? 0) + 1);
  for (const [cat, n] of byCatLocal) console.log(`${cat}: ${n} faltando no cdn/ local`);
  await sql.end();
  process.exit(0);
}

for (const m of maps) if (m.MusicPath) add('musicas', `sounds/${m.MusicPath.toLowerCase()}.flv`);
for (const r of await rows('ConfigInfos')) {
  if (/music/i.test(r.ConfigName) && r.ConfigValue) for (const n of r.ConfigValue.split(',')) add('musicas', `sounds/${n.trim().toLowerCase()}.flv`);
}

const missingLog = await readFile(join(root, 'logs', 'cdn_missing.txt'), 'utf8').catch(() => '');
for (const line of missingLog.split('\n')) {
  const rel = line.split(' ').slice(1).join(' ').trim();
  if (rel && /\.(swf|bswf|png|jpg|flv|xml)$/i.test(rel)) add('pedidos pelo cliente', rel);
}

const exists = async (p: string) => access(join(cdn, p)).then(() => true, () => false);
const absent: [string, string][] = [];
for (const [p, cat] of wanted) if (!(await exists(p))) absent.push([p, cat]);

const found: { path: string; cat: string; size: number }[] = [];
let i = 0;
async function worker() {
  while (i < absent.length) {
    const [path, cat] = absent[i++];
    try {
      const r = await fetch(ORIGIN + path, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      if (r.ok) found.push({ path, cat, size: Number(r.headers.get('content-length')) || 0 });
    } catch { /* indisponivel */ }
  }
}
await Promise.all(Array.from({ length: 16 }, worker));

const byCat = new Map<string, { wanted: number; absent: number; found: number; bytes: number }>();
for (const [, cat] of wanted) { const e = byCat.get(cat) ?? { wanted: 0, absent: 0, found: 0, bytes: 0 }; e.wanted++; byCat.set(cat, e); }
for (const [, cat] of absent) byCat.get(cat)!.absent++;
for (const f of found) { const e = byCat.get(f.cat)!; e.found++; e.bytes += f.size; }

const total = found.reduce((a, f) => a + f.size, 0);
console.log('categoria | usados | faltando no cdn | existem no oficial | MB');
for (const [cat, e] of byCat) console.log(`${cat} | ${e.wanted} | ${e.absent} | ${e.found} | ${(e.bytes / 1048576).toFixed(1)}`);
console.log(`TOTAL a baixar: ${found.length} arquivos, ${(total / 1048576).toFixed(1)} MB`);
await writeFile(join(root, 'logs', 'asset-audit.json'), JSON.stringify(found, null, 1));
await sql.end();
