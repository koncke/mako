// El VSL de MaKo, de punta a punta, desde guion.json (19/11/2026). Desde C:/dev/vsl-video:
//   node hacer.mjs voz <sec|todas>       la voz de la sección (clon de Martín, LA-CONFIG: eleven_v4), el chequeo contra el guion,
//                                        la alineación palabra por palabra y las pausas recortadas a 0,3 s
//   node hacer.mjs fotos <sec> [t,t,…]   cuadros para MIRAR (por el turno): cap/<sec>/ y la hoja cap/<sec>-hoja.jpg
//   node hacer.mjs video <sec|todas>     el MP4 de cada sección (por el turno) → salida/secciones/<sec>.mp4
//   node hacer.mjs montar                todas las secciones en orden + la música baja → salida/vsl-principal.mp4
//                                        (si existe tomas/<sec>.mp4, la toma REAL de Martín reemplaza el lugar marcado)
//   node hacer.mjs tomas                 la lista de lo que graba Martín (texto, palabras, segundos) → salida/tomas.md
// Las secciones con "martin": true son tomas de Martín a cámara: llevan su voz clonada como provisoria.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const RAIZ = 'C:/dev/vsl-video';
const GAL = 'C:/dev/artefactos-animaciones';
const SITIO = 'C:/dev/wt-vsl-principal/public/vsl-assets/sitio';
const MUSICA = 'C:/dev/reel-mentores/montaje/musica-eleven.mp3';
const TURNO = `${GAL}/tools/turno.mjs`;
// GUION=guion-<landing>.json para el VSL de otra landing: sus secciones van con el prefijo «<landing>-» en trabajo/, cap/ y salida/
const GNOM = (process.env.GUION || 'guion.json').replace(/\.json$/, ''); const PRE = GNOM === 'guion' ? '' : GNOM.replace(/^guion-/, '') + '-';
const G = JSON.parse(readFileSync(`${RAIZ}/${GNOM}.json`, 'utf8'));
const [modo, cual = 'todas', extra] = process.argv.slice(2);
const pedidas = cual.split(','); const secs = cual === 'todas' ? G.secciones : G.secciones.filter((s) => pedidas.includes(s.id));   // «vender,decidir» vale
const t0 = Date.now(); const paso = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} s] ${s}`);
const sh = (cmd, args, o = {}) => execFileSync(cmd, args, Object.assign({ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }, o));

// la sección como escenas [id, dice]; una toma de Martín es una sola escena
const escenas = (s) => (s.martin ? [{ id: s.id + '-1', dice: s.dice, vis: { tipo: 'toma', n: s.n, de: s.de, gira: s.gira } }] : s.escenas);
const palabrasDe = (txt) => txt.trim().split(/\s+/).length;

// ── grabaciones de la app → cuadros JPG a 30 fps (recs/<rec>/f0001.jpg…) ──
function recs() {
  const usadas = new Set(G.secciones.flatMap((s) => escenas(s)).filter((e) => e.vis.tipo === 'pantalla').map((e) => e.vis.rec));
  const info = {};
  for (const r of usadas) {
    const dir = `${RAIZ}/recs/${r}`; const src = `${SITIO}/${r}.webm`;
    if (!existsSync(dir) || readdirSync(dir).length === 0) {
      mkdirSync(dir, { recursive: true });
      sh('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', 'fps=30,scale=1400:-2:flags=lanczos', '-q:v', '3', `${dir}/f%04d.jpg`]);
      paso(`grabación ${r}: cuadros sacados`);
    }
    const n = readdirSync(dir).filter((f) => f.endsWith('.jpg')).length; info[r] = { n, dur: n / 30 };
  }
  return info;
}
function guionJs() {
  const out = { recs: recs(), secciones: G.secciones.map((s) => ({ id: PRE + s.id, escenas: escenas(s) })) };
  writeFileSync(`${RAIZ}/${GNOM}.js`, 'window.GUION = ' + JSON.stringify(out) + ';\n');
}

// ── la voz de una sección ──
function voz(s) {
  const D = `${RAIZ}/trabajo/${PRE}${s.id}`; mkdirSync(D, { recursive: true });
  const E = escenas(s); const g = E.map((e) => [e.id, e.dice.trim()]);
  const texto = g.map((x) => x[1]).join(' ');
  const previo = existsSync(`${D}/guion.txt`) ? readFileSync(`${D}/guion.txt`, 'utf8') : '';
  const corte = existsSync(`${D}/guion.json`) ? readFileSync(`${D}/guion.json`, 'utf8') : '';
  if (previo === texto && corte === JSON.stringify(g) && existsSync(`${D}/t.js`) && extra !== 'voz-nueva') { paso(`${s.id}: la voz de antes (el guion no cambió)`); return; }
  // el mismo texto partido en otras escenas: se usa la voz y la alineación que ya están, sólo se rehacen los tiempos
  const mismaVoz = previo === texto && existsSync(`${D}/alin.json`) && extra !== 'voz-nueva';
  writeFileSync(`${D}/guion.json`, JSON.stringify(g)); writeFileSync(`${D}/guion.txt`, texto);
  if (mismaVoz) paso(`${s.id}: el mismo texto en otras escenas, la voz de antes`);
  else {
    paso(`${s.id}: voz (${palabrasDe(texto)} palabras)…`);
    console.log(sh('node', [`${GAL}/voz/voz.mjs`, 'tts', `${D}/guion.txt`, `${D}/voz-cruda.mp3`]).trim());
    sh('node', [`${GAL}/voz/voz.mjs`, 'alinear', `${D}/voz-cruda.mp3`, `${D}/guion.txt`, `${D}/alin.json`]);
  }
  // la cola: lo que queda después de la última palabra antes de la sección siguiente (corta: sin silencios muertos)
  const cola = String(s.cola ?? (s.martin ? 0.35 : 0.3));
  sh('python', ['-I', `${GAL}/tools/tiempos.py`, `${D}/guion.json`, `${D}/alin.json`, `${D}/tiempos-crudos.json`, cola]);
  console.log(sh('python', ['-I', `${GAL}/tools/apretar.py`, `${D}/tiempos-crudos.json`, `${D}/voz-cruda.mp3`, `${D}/tiempos.json`, `${D}/voz-apretada.mp3`]).trim());
  sh('ffmpeg', ['-y', '-v', 'error', '-i', `${D}/voz-apretada.mp3`, '-af', 'loudnorm=I=-14:TP=-1:LRA=11', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', `${D}/voz.mp3`]);
  writeFileSync(`${D}/t.js`, 'window.TIEMPOS = ' + readFileSync(`${D}/tiempos.json`, 'utf8') + ';\n');
  let ch = '';
  for (let k = 0; k < 3; k++) { try { ch = sh('node', ['C:/dev/reel-mentores/voz/chequear-guion.mjs', `${D}/voz.mp3`, texto.replace(/Máko/g, 'MaKo')]); } catch (e) { ch = (e.stdout || '') + (e.stderr || ''); }
    if (!/429|system_busy|FALL/.test(ch)) break; }
  writeFileSync(`${D}/chequeo.txt`, ch);
  const T = JSON.parse(readFileSync(`${D}/tiempos.json`, 'utf8'));
  paso(`${s.id}: ${T.anchors.end.toFixed(2)} s · ${ch.split('\n').filter(Boolean).slice(-3).join(' · ')}`);
}

// todas las secciones pedidas en UN turno del navegador (con un turno por sección, la fila de la PC metía a todos en el medio)
function fotos(lista) {
  const partes = lista.map((s) => {
    const T = JSON.parse(readFileSync(`${RAIZ}/trabajo/${PRE}${s.id}/tiempos.json`, 'utf8'));
    let ts = extra ? extra.split(',').map(Number) : null;
    if (!ts) { // por defecto: cada escena al empezar, a la mitad y al final, y el primer cuadro
      const ids = escenas(s).map((e) => e.id); const ini = ids.map((id, i) => (i === 0 ? 0 : T.anchors[id] - 0.12));
      ts = [0.2]; ini.forEach((a, i) => { const b = i < ini.length - 1 ? ini[i + 1] : T.anchors.end; ts.push(a + 0.6, (a + b) / 2, b - 0.15); });
    }
    return `${PRE}${s.id}=${ts.map((t) => t.toFixed(2)).join(',')}`;
  });
  spawnSync('node', [TURNO, 'node', `${RAIZ}/render.mjs`, 'fotos', partes.join(';'), `${RAIZ}/cap`], { stdio: 'inherit' });
  for (const s of lista) { sh('python', ['-I', `${RAIZ}/hoja.py`, `${RAIZ}/cap/${PRE}${s.id}`, `${RAIZ}/cap/${PRE}${s.id}-hoja.jpg`, '3', '640']); paso(`hoja: cap/${PRE}${s.id}-hoja.jpg`); }
}

function video(lista) {
  mkdirSync(`${RAIZ}/salida/secciones`, { recursive: true });
  spawnSync('node', [TURNO, 'node', `${RAIZ}/render.mjs`, 'video', lista.map((s) => PRE + s.id).join(','), `${RAIZ}/salida/secciones`, '30'], { stdio: 'inherit' });
}

function montar() {
  // cada parte a 1920×1080, 30 fps, AAC 44,1 kHz; la toma real de Martín (tomas/<sec>.mp4) gana si existe
  const lista = []; const N = `${RAIZ}/salida/_norm`; mkdirSync(N, { recursive: true });
  for (const s of G.secciones) {
    const real = `${RAIZ}/tomas/${PRE}${s.id}.mp4`; const src = s.martin && existsSync(real) ? real : `${RAIZ}/salida/secciones/${PRE}${s.id}.mp4`;
    if (!existsSync(src)) { console.log('falta', src); process.exit(1); }
    const o = `${N}/${PRE}${s.id}.mp4`;
    sh('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2', o]);
    lista.push(`file '${o}'`);
  }
  writeFileSync(`${N}/lista.txt`, lista.join('\n'));
  sh('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', `${N}/lista.txt`, '-c', 'copy', `${N}/junto.mp4`]);
  const dur = +sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${N}/junto.mp4`]).trim();
  // la música (la del reel, baja) en loop por debajo; se calla en las tomas de Martín y vuelve después
  const sinMusica = []; let acc = 0;
  for (const s of G.secciones) { const d = +sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${N}/${PRE}${s.id}.mp4`]).trim(); if (s.martin) sinMusica.push([acc, acc + d]); acc += d; }
  const vol = sinMusica.map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`).join('+') || '0';
  const fc = `[1:a]aloop=loop=-1:size=2e9,atrim=0:${dur.toFixed(2)},volume='if(${vol},0.0,${G.musica ?? 0.11})':eval=frame,afade=t=out:st=${(dur - 2).toFixed(2)}:d=2[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,loudnorm=I=-14:TP=-1:LRA=11[a]`;
  mkdirSync('C:/Users/marti/OneDrive/Escritorio/MaKo-VSL/vsl-principal-2026', { recursive: true });
  const out = `${RAIZ}/salida/${PRE ? 'vsl-' + PRE.slice(0, -1) : 'vsl-principal'}.mp4`;
  sh('ffmpeg', ['-y', '-v', 'error', '-i', `${N}/junto.mp4`, '-i', MUSICA, '-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
  paso(`LISTO ${out} (${dur.toFixed(1)} s)`);
}

function tomas() {
  const L = ['# Lo que graba Martín', ''];
  for (const s of G.secciones.filter((x) => x.martin)) {
    const n = palabrasDe(s.dice); const T = existsSync(`${RAIZ}/trabajo/${PRE}${s.id}/tiempos.json`) ? JSON.parse(readFileSync(`${RAIZ}/trabajo/${PRE}${s.id}/tiempos.json`, 'utf8')).anchors.end : null;
    L.push(`## Toma ${s.n} de ${s.de}: ${s.titulo}`, '', `> ${s.dice}`, '', `- ${n} palabras · ≈ ${(n / 3.2).toFixed(0)} s a 3,2 palabras por segundo${T ? ` (su clon la dice en ${T.toFixed(1)} s)` : ''}`, `- ${s.grabar}`, '');
  }
  writeFileSync(`${RAIZ}/salida/tomas.md`, L.join('\n')); console.log(L.join('\n'));
}

guionJs();
if (modo === 'voz') { for (const s of secs) voz(s); guionJs(); }
else if (modo === 'fotos') fotos(secs);
else if (modo === 'video') video(secs);
else if (modo === 'montar') montar();
else if (modo === 'tomas') tomas();
else if (modo === 'guion') paso('guion.js listo');
else console.log('modos: voz, fotos, video, montar, tomas, guion');
