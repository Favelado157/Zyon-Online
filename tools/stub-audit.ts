// Lista handlers do tipo `router.on(X, s => s.send(Y, ...))` e confere no opcodes.json
// se X (cliente->servidor) e Y (servidor->cliente) existem e pertencem ao mesmo sistema.
// Uso: node tools/stub-audit.ts
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const op = JSON.parse(await readFile(join(root, 'data/protocol/opcodes.json'), 'utf8'));
const dir = join(root, 'apps/server/src/game/handlers');
for (const f of await readdir(dir)) {
  const src = await readFile(join(dir, f), 'utf8');
  for (const m of src.matchAll(/router\.on\((\d+),\s*\(?s\)?\s*=>\s*\{?\s*s\.send\((\d+),\s*([^)]*)\)/g)) {
    const [, x, y, body] = m;
    const sx = op.send[x], ay = op.accept[y];
    const flag = !sx ? 'X_DESCONHECIDO' : !ay ? 'Y_DESCONHECIDO' : '';
    console.log([f, x, sx?.constant ?? '-', '->', y, ay?.constant ?? '-', ay?.message ?? '-', body.trim().slice(0, 40), flag].join(' | '));
  }
}
