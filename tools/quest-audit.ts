// Auditoria da timeline de progressão: cruza QuestTemps/QuestCondictionInfos/QuestGoods
// com o catálogo de itens e com os CondictionType que o servidor realmente avança.
// Uso: node --env-file=.env tools/quest-audit.ts [nivelMax=80]
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import postgres from 'postgres';

const root = resolve(import.meta.dirname, '..');
const maxLevel = Number(process.argv[2] ?? 80);
const sql = postgres(process.env.DATABASE_URL!);
const rows = async (set: string) =>
  (await sql<{ data: Record<string, string> }[]>`SELECT data FROM catalog.template_records WHERE set_name = ${set} ORDER BY ordinal`).map(r => r.data);

// 1) CondictionType que o servidor avança ou verifica
const tracked = new Set<string>();
async function walk(dir: string) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (p.endsWith('.ts')) {
      const src = await readFile(p, 'utf8');
      for (const m of src.matchAll(/advanceQuestCondition\([^)]*?,\s*'(\d+)'/gs)) tracked.add(m[1]);
      for (const m of src.matchAll(/const COND_\w+\s*=\s*'(\d+)'/g)) tracked.add(m[1]);
      for (const m of src.matchAll(/for \(const cond of \[([^\]]+)\]\)/g)) for (const n of m[1].matchAll(/'(\d+)'/g)) tracked.add(n[1]);
    }
  }
}
await walk(join(root, 'apps/server/src'));
const quests = await readFile(join(root, 'apps/server/src/game/handlers/quests.ts'), 'utf8');
const verified = new Set<string>();
const metFn = quests.slice(quests.indexOf('function conditionMet'));
for (const m of metFn.slice(0, metFn.indexOf('async function')).matchAll(/case (\d+):/g)) verified.add(m[1]);

const [qt, qc, qg, items] = await Promise.all([rows('QuestTemps'), rows('QuestCondictionInfos'), rows('QuestGoods'), rows('ItemTempInfos')]);
const itemIds = new Set(items.map(i => i.TemplateId));
const questById = new Map(qt.map(q => [q.TemplateId, q]));
const condsBy = new Map<string, Record<string, string>[]>();
for (const c of qc) (condsBy.get(c.TemplateId) ?? condsBy.set(c.TemplateId, []).get(c.TemplateId)!).push(c);

const inRange = qt.filter(q => Number(q.NeedMinLevel || 0) <= maxLevel && q.IsRepeat !== 'true');
const issues: string[] = [];
const untrackedByType = new Map<string, string[]>();
for (const q of inRange) {
  const id = q.TemplateId;
  for (const pre of (q.PreQuestId ?? '').split(',').filter(x => x && x !== '0')) {
    const p = questById.get(pre);
    if (!p) issues.push(`PRE_INEXISTENTE quest ${id} "${q.Title}" pede ${pre}`);
    else if (Number(p.NeedMinLevel || 0) > Number(q.NeedMinLevel || 0) + 20) issues.push(`PRE_NIVEL quest ${id} (Nv${q.NeedMinLevel}) pede ${pre} (Nv${p.NeedMinLevel})`);
  }
  const conds = condsBy.get(id) ?? [];
  if (!conds.length) issues.push(`SEM_CONDICAO quest ${id} "${q.Title}"`);
  if (conds.length > 4) issues.push(`CONDICOES>4 quest ${id} tem ${conds.length} (servidor só guarda 4)`);
  for (const c of conds) {
    const t = c.CondictionType;
    if (!tracked.has(t) && !verified.has(t)) (untrackedByType.get(t) ?? untrackedByType.set(t, []).get(t)!).push(`${id}:Nv${q.NeedMinLevel}`);
    if (['27', '28', '32', '49', '94', '4'].includes(t) && c.Para1 !== '0' && c.Para1 && !itemIds.has(c.Para1)) issues.push(`ITEM_COND_INEXISTENTE quest ${id} cond ${t} item ${c.Para1}`);
  }
}
for (const g of qg) {
  const r = Number(g.RewardItemID);
  if (r > 0 && !itemIds.has(String(r)) && questById.has(g.TemplateId)) issues.push(`RECOMPENSA_INEXISTENTE quest ${g.TemplateId} item ${r}`);
}

const out = [
  `# Auditoria de Quests (gerado por tools/quest-audit.ts, nível <= ${maxLevel})`,
  '',
  `- Quests não repetíveis no intervalo: ${inRange.length}`,
  `- CondictionType avançados no servidor: ${[...tracked].sort((a, b) => +a - +b).join(', ')}`,
  `- CondictionType verificados na entrega (5014): ${[...verified].sort((a, b) => +a - +b).join(', ')}`,
  '',
  '## CondictionType SEM rastreamento (a quest nunca completa sozinha)',
  ...[...untrackedByType].sort((a, b) => b[1].length - a[1].length).map(([t, l]) => `- tipo ${t}: ${l.length} quests (${l.slice(0, 12).join(', ')}${l.length > 12 ? ', ...' : ''})`),
  '',
  '## Inconsistências de dados',
  ...(issues.length ? issues.map(i => `- ${i}`) : ['- nenhuma']),
  '',
];
await writeFile(join(root, '.roadmap/QUEST_AUDIT.md'), out.join('\n'));
console.log(out.slice(0, 60).join('\n'));
await sql.end();
