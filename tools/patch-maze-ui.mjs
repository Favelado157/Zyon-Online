import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

if (!fs.existsSync('cdn/_replaced/9.png.bak')) fs.copyFileSync('cdn/9.png', 'cdn/_replaced/9.png.bak');
if (!fs.existsSync('cdn/_replaced/code_md5.dat.bak')) fs.copyFileSync('cdn/code_md5.dat', 'cdn/_replaced/code_md5.dat.bak');

const raw = fs.readFileSync('cdn/_replaced/9.png.bak');
const swf = Buffer.alloc(3 + (raw.length - 21));
swf[0] = 67; swf[1] = 87; swf[2] = 83;
const rest = raw.length - 21;
raw.copy(swf, 124, 21, 21 + rest - 121);
raw.copy(swf, 3, 21 + rest - 121);

const body = zlib.inflateSync(swf.subarray(8));
const tagOff = 186816;
const patOff = tagOff + 7504;
// Original (7 bytes): findpropstrict addToContent (5d 6b); getlex _maze2Mask (60 07); callpropvoid addToContent, 1 (4f 6b 01)
const orig = Buffer.from([0x5d, 0x6b, 0x60, 0x07, 0x4f, 0x6b, 0x01]);
// Patched  (7 bytes): getlex _maze3 (60 04); pushfalse (27); setproperty enable (61 78); nop (02); nop (02)
// Effect: when floor 100 is not cleared, _maze2Mask is not added (so grayed-out _maze2 stays visible) AND _maze3.enable = false!
const patch = Buffer.from([0x60, 0x04, 0x27, 0x61, 0x78, 0x02, 0x02]);
if (!body.subarray(patOff, patOff + 7).equals(orig)) {
  throw new Error('Pattern mismatch in MazeFrame DoABC tag');
}
patch.copy(body, patOff);

const comp = zlib.deflateSync(body, { level: 9 });
const newSwf = Buffer.concat([swf.subarray(0, 8), comp]);
const enc = Buffer.concat([raw.subarray(0, 21), newSwf.subarray(124), newSwf.subarray(3, 124)]);

// Roundtrip verification
const check = Buffer.alloc(3 + (enc.length - 21));
check[0] = 67; check[1] = 87; check[2] = 83;
const cRest = enc.length - 21;
enc.copy(check, 124, 21, 21 + cRest - 121);
enc.copy(check, 3, 21 + cRest - 121);
const checkBody = zlib.inflateSync(check.subarray(8));
if (!checkBody.subarray(patOff, patOff + 7).equals(patch)) {
  throw new Error('Roundtrip verification failed');
}

fs.writeFileSync('cdn/9.png', enc);

const md5 = crypto.createHash('md5').update(enc).digest('hex').slice(0, 8);
const md5Xml = zlib.inflateSync(zlib.inflateSync(fs.readFileSync('cdn/_replaced/code_md5.dat.bak'))).toString('utf8');
const updatedXml = md5Xml.replace(
  /<Item name="9\.png" md5="[0-9a-f]+" size="\d+" \/>/,
  `<Item name="9.png" md5="${md5}" size="${enc.length}" />`,
);
if (updatedXml === md5Xml) throw new Error('Failed to update 9.png entry in code_md5.dat');
fs.writeFileSync('cdn/code_md5.dat', zlib.deflateSync(zlib.deflateSync(Buffer.from(updatedXml, 'utf8'))));
console.log('PATCHED cdn/9.png & cdn/code_md5.dat OK!', { size: enc.length, md5 });
