import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const legend = join(root, '.docs', 'legend-online-main');
const derived = JSON.parse(await readFile(join(legend, 'data', 'derived', 'opcode_messages.json'), 'utf8')) as
  { direction: 'accept' | 'send'; code: number; message: string; handler: string; source_ref: string }[];
const schema = JSON.parse(await readFile(join(root, 'data', 'protocol', 'schema.json'), 'utf8')) as { byName: Record<string, string[]> };
const opcodes = JSON.parse(await readFile(join(legend, 'protocol', 'opcodes.json'), 'utf8')) as Record<'accept' | 'send', Record<string, number>>;

const cache = new Map<string, string>();
async function source(ref: string) {
  const file = ref.replace(/:\d+$/, '');
  if (!cache.has(file)) cache.set(file, await readFile(join(legend, file), 'utf8').catch(() => ''));
  return cache.get(file)!;
}

const out: Record<'accept' | 'send', Record<number, { message: string | null; constant: string | null; handlers: string[] }>> = { accept: {}, send: {} };
const names = { accept: new Map<number, string>(), send: new Map<number, string>() };
for (const dir of ['accept', 'send'] as const) for (const [k, v] of Object.entries(opcodes[dir] ?? {})) names[dir].set(v, k);

let unresolved = 0;
for (const r of derived) {
  const keys = schema.byName[r.message] ?? [];
  let message: string | null = keys.length === 1 ? keys[0] : null;
  if (keys.length > 1) {
    const text = await source(r.source_ref);
    const imp = new RegExp(`import\\s+com\\.road\\.yishi\\.proto\\.([\\w.]+)\\.${r.message};`).exec(text);
    message = imp ? `${imp[1]}.${r.message}` : null;
    if (!message) {
      const pkg = /package\s+com\.road\.yishi\.proto\.([\w.]+)/.exec(text)?.[1];
      if (pkg && keys.includes(`${pkg}.${r.message}`)) message = `${pkg}.${r.message}`;
    }
  }
  const entry = (out[r.direction][r.code] ??= { message: null, constant: names[r.direction].get(r.code) ?? null, handlers: [] });
  if (message && !entry.message) entry.message = message;
  if (message && entry.message && entry.message !== message) entry.handlers.push(`!${message}`);
  entry.handlers.push(`${r.handler} @ ${r.source_ref}`);
  if (!message && r.message) unresolved++;
}
for (const dir of ['accept', 'send'] as const) {
  for (const [code, constant] of names[dir]) out[dir][code] ??= { message: null, constant, handlers: [] };
}
const OVERRIDES: Record<'accept' | 'send', Record<number, string>> = {
  accept: {
    150: 'army.ArmyMsg', 21: 'room.RoomEnterMsg', 127: 'campaign.CampaignNodeListMsg', 140: 'army.MapUpdatedMsg',
    143: 'player.PlayerMovieMsg', 4162: 'campaign.PlayerMoveMsg',
    72: 'battle.ReinforceMsg', 154: 'battle.PrepareOverMsg', 157: 'battle.BattlePrepareMsg', 4382: 'simple.FightOverMoiveMsg',
    4155: 'building.BuildOrderList', 4: 'box.BoxMsg',
  },
  send: { 5124: 'worldmap.PosMoveMsg' },
};
for (const dir of ['accept', 'send'] as const) for (const [code, msg] of Object.entries(OVERRIDES[dir])) out[dir][Number(code)].message = msg;
await writeFile(join(root, 'data', 'protocol', 'opcodes.json'), JSON.stringify(out, null, 1));
const conflicts = Object.entries(out).flatMap(([d, m]) => Object.entries(m).filter(([, e]) => e.handlers.some(h => h.startsWith('!'))).map(([c, e]) => `${d} ${c} ${e.message} vs ${e.handlers.filter(h => h.startsWith('!')).join(',')}`));
console.log(`accept ${Object.keys(out.accept).length}, send ${Object.keys(out.send).length}, sem resolver ${unresolved}, conflitos ${conflicts.length}`);
for (const c of conflicts) console.log('  ', c);
