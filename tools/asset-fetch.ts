import { readFile, writeFile, mkdir, access, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cdn = join(root, 'cdn');
const stage = process.argv[2];
const ORIGIN = 'https://res1264oas.creaction-network.com/';
const list = JSON.parse(await readFile(join(root, 'logs', 'asset-audit.json'), 'utf8')) as { path: string; cat: string }[];

const valid = (path: string, b: Buffer) => {
  const ext = path.split('.').pop()!.toLowerCase();
  if (ext === 'jpg') return b[0] === 0xff && b[1] === 0xd8;
  if (ext === 'png') return b.subarray(1, 4).toString('ascii') === 'PNG';
  if (ext === 'swf') return ['CWS', 'FWS', 'ZWS'].includes(b.subarray(0, 3).toString('ascii'));
  if (ext === 'flv') return b.subarray(0, 3).toString('ascii') === 'FLV';
  if (ext === 'maps' || ext === 'titles') return b[0] === 0x78; // zlib (AMF3 comprimido), igual aos locais
  return b.length > 16;
};
const exists = (p: string) => access(p).then(() => true, () => false);

let i = 0, ok = 0, bytes = 0;
const bad: string[] = [], failed: string[] = [];
async function worker() {
  while (i < list.length) {
    const { path } = list[i++];
    const dst = join(cdn, path);
    if (await exists(dst)) continue;
    try {
      const r = await fetch(ORIGIN + path, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) { failed.push(path); continue; }
      const b = Buffer.from(await r.arrayBuffer());
      if (!valid(path, b)) { bad.push(path); continue; }
      const tmp = join(stage, path);
      await mkdir(dirname(tmp), { recursive: true });
      await writeFile(tmp, b);
      await mkdir(dirname(dst), { recursive: true });
      await rename(tmp, dst).catch(async () => { await writeFile(dst, b); });
      ok++; bytes += b.length;
    } catch { failed.push(path); }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.log(`instalados=${ok} total=${(bytes / 1048576).toFixed(1)}MB invalidos=${bad.length} falharam=${failed.length}`);
if (bad.length) console.log('invalidos:', bad.slice(0, 20).join(', '));
if (failed.length) console.log('falharam:', failed.slice(0, 20).join(', '));
