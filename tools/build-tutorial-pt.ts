import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = join(root, '.docs', 'old-legend-ultra', 'apps', 'game-server', 'src', 'legend_server', 'content', 'tutorial.json');
const out = join(root, 'data', 'tutorial', 'pt.json');

type Any = Record<string, any>;
const en = JSON.parse(await readFile(src, 'utf8')) as { maps: Record<string, { start: number[]; nodes: Any[] }>; battles: Record<string, Any>; plots: Any[] };
const clone = <T>(x: T): T => structuredClone(x);

const STAR = 1000211, FIRST_ENEMY = 1000206, BOSS = 1000208, WALKER = 1000202;
const HIDDEN = new Set([1000107, 1000201, 1000203, 1000205, 1000207, 1000209]);
const HERO_ID: Record<number, number> = { 1005: 1301 };
const PAWN_ID: Record<number, number> = { 2001: 2006, 2002: 2007, 2003: 2008 };

const nodes: Any[] = [];
for (const n0 of en.maps['10002'].nodes) {
  const n = clone(n0);
  const camp = n.campDataId as number;
  if (HIDDEN.has(camp)) continue;
  if (camp === FIRST_ENEMY) {
    Object.assign(n, { nodeName: 'Arqueiro do Império', masterType: 42, sonType: 2252, resource: 1, styleType: 1, level: 3, nameColor: 5, sizeType: 1, fightCapaity: 188, state: 1, posX: 67, posY: 63, curX: 67, curY: 63, fixX: 1350, fixY: 1270 });
  } else if (camp === BOSS) {
    Object.assign(n, { nodeName: 'Débora', masterType: 42, sonType: 2254, resource: 1, styleType: 1, level: 5, nameColor: 5, sizeType: 1, fightCapaity: 188, state: 1, posX: 68, posY: 32, curX: 68, curY: 32, fixX: 1350, fixY: 650, param4: '' });
  } else if (camp === WALKER) {
    Object.assign(n, { masterType: 42, sonType: 2253, resource: 1, nameColor: 5, state: 1, posX: 1, posY: 1, curX: 1, curY: 1, fixX: 20, fixY: 20 });
  }
  n.nodeId = camp;
  nodes.push(n);
}
const star = clone(en.maps['10001'].nodes.find(n => n.campDataId === 1000108)!);
Object.assign(star, { nodeId: STAR, campDataId: STAR, nodeName: 'Estrela de Salomão', masterType: 62, sonType: 10007, resource: 2, state: 16, posX: 65, posY: 17, curX: 65, curY: 17, fixX: 1300, fixY: 340 });
nodes.push(star);

function ptBattle(spec: Any): Any {
  const b = clone(spec);
  for (const h of b.heroes) { h.tempId = HERO_ID[h.tempId] ?? h.tempId; if (h.tempId === 1301) h.nickName = 'Tina'; }
  for (const s of b.soldiers) s.tempId = PAWN_ID[s.tempId] ?? s.tempId;
  b.undying = true;
  return b;
}

const first = ptBattle(en.battles['1000203']);
first.heroes = [];
for (const s of first.soldiers) s.tempId = 2007;
first.foeDamage = 40;

const boss = ptBattle(en.battles['1000205']);
const deb = clone(en.battles['8251'].heroes.at(-1));
Object.assign(deb, { tempId: 1008, nickName: 'Cavaleiro das Chamas Débora', grade: 5, pos: 5, maxHp: 450, initHp: 450, hp: 450, res: 'boss032', livingId: 5 });
const janick = clone(boss.heroes[0]);
Object.assign(janick, { tempId: 1012, nickName: 'Paladino Janick', grade: 3, res: 'boss033', livingId: 2, pos: 4, side: 1, skillId: [50021, 50021, 50022, 50021] });
for (const s of boss.soldiers) s.tempId = 2006;
boss.player = { ...(boss.player ?? {}), pos: 6 };
boss.scripted = { round: 2, heroes: [janick], soldiers: boss.soldiers };
boss.heroes = [deb];
boss.soldiers = [];
boss.foeDamage = 25;

const phase2 = clone(boss);
delete phase2.scripted;
const deb2 = Object.assign(clone(deb), { tempId: 1009, nickName: 'Cavaleiro Encantado Débora', res: 'boss032a', maxHp: 300, initHp: 300, hp: 300 });
const sofia = Object.assign(clone(janick), { tempId: 1010, nickName: 'Sacrifício de Sofia', res: 'boss040', livingId: 2, pos: 6, side: 1 });
Object.assign(phase2, { heroes: [deb2, sofia], soldiers: [], mapTempId: 10002, foeDamage: 25, player: { livingId: 1, pos: 4 } });

const data = {
  source: 'Derivado de old-legend-ultra content/tutorial.json (captura oficial EN) com os papeis do tutorial PT descritos em old docs/tutorial.md (gravacao do oficial PT de 15/11/2026).',
  map: 10002,
  start: [62, 52],
  nodes,
  resume: [[12500, { [FIRST_ENEMY]: 8 }], [14000, { [BOSS]: 8 }]],
  battles: { [FIRST_ENEMY]: first, [BOSS]: boss, pt8699: phase2 },
};
await mkdir(join(root, 'data', 'tutorial'), { recursive: true });
await writeFile(out, JSON.stringify(data, null, 1));
console.log(`${nodes.length} nos, ${Object.keys(data.battles).length} lutas -> ${out}`);
