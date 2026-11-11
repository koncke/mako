// Baja las portadas de los 854 reels (nuestro bucket) y arma hojas numeradas de 24 (6×4) con ffmpeg, más la lista de cada hoja.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const reels = JSON.parse(readFileSync(join(aqui, 'reels.json'), 'utf8'));
// Orden estable: por cuenta y por fecha, así una hoja mira reels parecidos (el juez compara mejor).
reels.sort((a, b) => a.cuenta.localeCompare(b.cuenta) || String(b.fecha).localeCompare(String(a.fecha)));
reels.forEach((r, i) => { r.n = i + 1; });
writeFileSync(join(aqui, 'reels-numerados.json'), JSON.stringify(reels, null, 1));
const dirP = join(aqui, 'portadas');
mkdirSync(dirP, { recursive: true });
let bajadas = 0, fallas = [];
const tandas = 12;
for (let i = 0; i < reels.length; i += tandas) {
  await Promise.all(reels.slice(i, i + tandas).map(async (r) => {
    const f = join(dirP, `${r.n}.jpg`);
    if (existsSync(f) && statSync(f).size > 1000) return;
    try {
      const res = await fetch(r.miniatura, { headers: { referer: '' } });
      if (!res.ok) throw new Error(String(res.status));
      writeFileSync(f, Buffer.from(await res.arrayBuffer()));
      bajadas++;
    } catch (e) { fallas.push(`${r.n} ${r.ref} ${e.message}`); }
  }));
}
console.log('bajadas', bajadas, 'fallas', fallas.length, fallas.slice(0, 5));
const FUENTE = 'C\\:/Windows/Fonts/arialbd.ttf';
const dirH = join(aqui, 'hojas');
mkdirSync(dirH, { recursive: true });
const POR = 24, W = 200, H = 356;
for (let h = 0; h * POR < reels.length; h++) {
  const grupo = reels.slice(h * POR, h * POR + POR);
  const args = ['-y', '-loglevel', 'error'];
  const filtros = [];
  grupo.forEach((r, i) => {
    const f = join(dirP, `${r.n}.jpg`);
    args.push('-i', existsSync(f) ? f : join(aqui, 'vacio.jpg'));
    filtros.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x777777,drawbox=x=0:y=0:w=74:h=36:color=black@0.8:t=fill,drawtext=fontfile='${FUENTE}':text='${r.n}':x=6:y=5:fontsize=28:fontcolor=yellow[t${i}]`);
  });
  // Relleno para la última hoja.
  for (let i = grupo.length; i < POR; i++) filtros.push(`color=c=0x333333:s=${W}x${H}:d=1[t${i}]`);
  const layout = Array.from({ length: POR }, (_, i) => `${(i % 6) * (W + 6)}_${Math.floor(i / 6) * (H + 6)}`).join('|');
  filtros.push(`${Array.from({ length: POR }, (_, i) => `[t${i}]`).join('')}xstack=inputs=${POR}:layout=${layout}:fill=0x111111[o]`);
  args.push('-filter_complex', filtros.join(';'), '-map', '[o]', '-frames:v', '1', '-q:v', '3', join(dirH, `hoja-${String(h + 1).padStart(2, '0')}.jpg`));
  execFileSync('ffmpeg', args);
  const lista = grupo.map((r) => `#${r.n} · @${r.cuenta} · ${r.fecha ?? '?'} · ▶${r.vistas ?? '?'} ♥${r.megusta ?? '?'} · «${(r.texto || '').slice(0, 160)}»`).join('\n');
  writeFileSync(join(dirH, `hoja-${String(h + 1).padStart(2, '0')}.txt`), lista);
}
console.log('hojas', Math.ceil(reels.length / POR));
