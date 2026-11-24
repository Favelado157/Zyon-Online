import { readPack, configOf } from '../apps/server/src/lib/tempinfos.ts';

if (import.meta.main ?? process.argv[1]?.endsWith('tempinfos.ts')) {
  const file = process.argv[2] ?? 'cdn/xml/tempinfos.xml';
  const pack = readPack(file);
  const filter = new RegExp(process.argv[3] ?? '(time|Time|timer|Timer|week|Week|Match)');
  console.log('versão', pack.version, 'blocos', pack.entries.length);
  for (const [k, v] of configOf(pack)) if (filter.test(k) && /\d{1,2}:\d{2}|^\d(,\d)*$/.test(v.value)) console.log(`${k} | ${v.value} | ${v.description}`);
}
