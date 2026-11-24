// Lista campanhas cujo mapa (MapInfos.MapFileId) não existe em cdn/maps ou cdn/mapmaterial/land.
// Uso: node --env-file=.env tools/map-audit.ts
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import postgres from 'postgres';

const root = resolve(import.meta.dirname, '..');
const sql = postgres(process.env.DATABASE_URL!);
const rows = async (set: string) => (await sql<{ data: Record<string, string> }[]>`SELECT data FROM catalog.template_records WHERE set_name = ${set}`).map(r => r.data);
const [camps, maps] = await Promise.all([rows('Campaigns'), rows('MapInfos')]);
const byType = new Map<string, { ok: number; missing: string[] }>();
for (const c of camps) {
  const m = maps.find(x => x.CampaignId === c.CampaignId);
  const file = m?.MapFileId;
  const has = !!file && existsSync(join(root, 'cdn/maps', file)) && existsSync(join(root, 'cdn/mapmaterial/land', file))
    && readdirSync(join(root, 'cdn/mapmaterial/land', file)).length > 0;
  const e = byType.get(c.Types) ?? byType.set(c.Types, { ok: 0, missing: [] }).get(c.Types)!;
  if (has || !m) e.ok++; else e.missing.push(`${c.CampaignId}:${c.CampaignName}`);
}
for (const [t, e] of [...byType].sort((a, b) => +a[0] - +b[0])) {
  if (e.missing.length) console.log(`Types ${t}: ${e.missing.length} sem mapa (ok ${e.ok}) → ${e.missing.slice(0, 6).join(', ')}${e.missing.length > 6 ? ', ...' : ''}`);
}
await sql.end();
