// Decodificador AMF3 mínimo (leitura) para os arquivos de mapa do cliente (cdn/maps/<id>/<id>.maps|.titles,
// zlib + AMF3). Uso: node tools/amf3.ts cdn/maps/8001/8001.maps [filtroDeUrl]
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function decodeAmf3(buf: Buffer): unknown {
  let p = 0;
  const strs: string[] = [], objs: unknown[] = [], traits: { cls: string; dyn: boolean; keys: string[] }[] = [];
  const u29 = () => {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = buf[p++];
      if (i < 3) { v = (v << 7) | (b & 0x7f); if (!(b & 0x80)) return v; }
      else return (v << 8) | b;
    }
    return v;
  };
  const str = (): string => {
    const r = u29();
    if (!(r & 1)) return strs[r >> 1];
    const len = r >> 1;
    if (!len) return '';
    const s = buf.toString('utf8', p, p + len); p += len; strs.push(s); return s;
  };
  const val = (): unknown => {
    const m = buf[p++];
    switch (m) {
      case 0x00: case 0x01: return null;
      case 0x02: return false;
      case 0x03: return true;
      case 0x04: { const v = u29(); return v & 0x10000000 ? v - 0x20000000 : v; }
      case 0x05: { const d = buf.readDoubleBE(p); p += 8; return d; }
      case 0x06: return str();
      case 0x09: {
        const r = u29();
        if (!(r & 1)) return objs[r >> 1];
        const arr: unknown[] & Record<string, unknown> = [] as never; objs.push(arr);
        for (let k = str(); k; k = str()) arr[k] = val();
        for (let i = 0; i < r >> 1; i++) arr.push(val());
        return arr;
      }
      case 0x0a: {
        const r = u29();
        if (!(r & 1)) return objs[r >> 1];
        let t;
        if (!(r & 2)) t = traits[r >> 2];
        else { t = { cls: '', dyn: !!(r & 8), keys: [] as string[] }; t.cls = str(); for (let i = 0; i < r >> 4; i++) t.keys.push(str()); traits.push(t); }
        const o: Record<string, unknown> = {}; objs.push(o);
        for (const k of t.keys) o[k] = val();
        if (t.dyn) for (let k = str(); k; k = str()) o[k] = val();
        return o;
      }
      default: throw new Error(`marcador AMF3 0x${m?.toString(16)} em ${p - 1}`);
    }
  };
  return val();
}

if (import.meta.main ?? process.argv[1]?.endsWith('amf3.ts')) {
  const [file, filter] = process.argv.slice(2);
  const data = decodeAmf3(inflateSync(readFileSync(file)));
  const out: unknown[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(walk); for (const k of Object.keys(v)) if (isNaN(Number(k))) walk((v as any)[k]); }
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.url === 'string' && (!filter || o.url.includes(filter))) out.push({ url: o.url, x: o.x, y: o.y, width: o.width, height: o.height });
      Object.values(o).forEach(walk);
    }
  };
  walk(data);
  console.log(JSON.stringify(out.slice(0, 40), null, 1));
  if (!filter) console.log('chaves raiz:', Object.keys(data as object).slice(0, 20));
}
