// One tutorial video, end to end, from guiones.json: voice (Martín's clone, LA-CONFIG) → check against the script → word
// alignment → photo of the drawn tab with what each "toca X" step marks → beats → frames to LOOK → the video + the manifest.
//   node motor/hacer.mjs <id> cuadros     → everything up to a contact sheet (trabajo/<id>/hoja.jpg) to look at
//   node motor/hacer.mjs <id> video       → the whole render, voice + music → VIDEOS/<id>.mp4 and the manifest
//   (add "voz-nueva" to regenerate the voice even if the script did not change)
// Run from C:/dev/tutoriales-video. One at a time: each render is a Chromium (the PC is tight on RAM).
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const RAIZ = 'C:/dev/tutoriales-video';
const PESTANAS = `${RAIZ}/pestanas-copia`;
const VIDEOS = 'C:/Users/marti/OneDrive/Escritorio/MaKo-VSL/tutoriales/videos';
const MANIFIESTO = 'C:/Users/marti/OneDrive/Escritorio/MaKo-VSL/tutoriales/manifiesto.json';
const PUBLICO = `${RAIZ}/public-tutoriales`;                               // → public/tutoriales/ in the repo
const MANIFIESTO_PUB = `${PUBLICO}/manifiesto.json`;
const LA_CONFIG = 'C:/dev/reel-mentores/voz/LA-CONFIG.json';
const CHEQUEAR = 'C:/dev/reel-mentores/voz/chequear-guion.mjs';
const env = readFileSync('C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local', 'utf8');
const KEY = (env.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/m) || [])[1]?.replace(/^["']|["']$/g, '');
const VOZ = JSON.parse(readFileSync(LA_CONFIG, 'utf8'))._para_texto_sin_video;

const [id, modo = 'cuadros', ...flags] = process.argv.slice(2);
const todos = JSON.parse(readFileSync(`${RAIZ}/guiones.json`, 'utf8'));
const g = todos.find((x) => x.id === id);
if (!g) { console.log('no hay guion para', id); process.exit(2); }
const DIR = `${RAIZ}/trabajo/${id}`;
mkdirSync(DIR, { recursive: true });
const t0 = Date.now();
const paso = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(3)} s] ${s}`);

// ── 1. the voice ──
const textoVoz = g.pasos.map((p) => p.dice.trim()).join(' ');                  // "Máko" with accent: that is how it says it right
const textoPantalla = textoVoz.replace(/Máko/g, 'MaKo');
const guionPrevio = existsSync(`${DIR}/guion.txt`) ? readFileSync(`${DIR}/guion.txt`, 'utf8') : '';
const vozNueva = flags.includes('voz-nueva') || guionPrevio !== textoVoz || !existsSync(`${DIR}/voz.mp3`);
if (vozNueva) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ.voz}?output_format=mp3_44100_192`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: textoVoz, model_id: VOZ.model_id }) });
  if (!r.ok) { console.log('FALLÓ la voz', r.status, (await r.text()).slice(0, 300)); process.exit(1); }
  writeFileSync(`${DIR}/voz.mp3`, Buffer.from(await r.arrayBuffer()));
  writeFileSync(`${DIR}/guion.txt`, textoVoz);
  paso(`voz nueva (${VOZ.model_id}, ${textoVoz.length} caracteres, cobró ${r.headers.get('character-cost') || '?'} créditos)`);
} else paso('voz: la misma de antes (el guion no cambió)');

// ── 2. does it say the script? (transcribe and compare, Martín's rule of 9/11) ──
let chequeo = existsSync(`${DIR}/chequeo.txt`) ? readFileSync(`${DIR}/chequeo.txt`, 'utf8') : '';
if (vozNueva || !chequeo) {
  try { chequeo = execFileSync('node', [CHEQUEAR, `${DIR}/voz.mp3`, textoPantalla], { encoding: 'utf8' }); }
  catch (e) { chequeo = (e.stdout || '') + (e.stderr || ''); }
  writeFileSync(`${DIR}/chequeo.txt`, chequeo);
}
// Differences that are the TRANSCRIBER's spelling, not the voice: digits written as words, «OK»/«okey», brand names it
// writes as they sound (Zernio → «sernio», Claude → «cloud», MaKo → «maco», Ops → «op»). Anything else is a real error.
const ORTOGRAFIA = [['ok', 'okey'], ['zernio', 'sernio'], ['claude', 'cloud'], ['mako', 'maco'], ['ops', 'op']];
const difs = [...chequeo.matchAll(/cambiada: «(.+?)» → «(.+?)»/g)].map((m) => [m[1], m[2]]);
const otras = /faltante|sobrante|repetida/i.test(chequeo);
const soloOrtografia = !otras && difs.every(([a, b]) => /^\d+$/.test(a) || ORTOGRAFIA.some(([x, y]) => x === a && y === b));
const dijoBien = chequeo.includes('✅') || (difs.length > 0 && soloOrtografia);
const diferencias = difs.map(([a, b]) => `${a} → ${b}`);
paso('chequeo: ' + chequeo.split('\n').filter(Boolean).slice(0, 2).join(' · '));

// ── 3. every word with its second ──
if (vozNueva || !existsSync(`${DIR}/alin.json`)) {
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(`${DIR}/voz.mp3`)], { type: 'audio/mpeg' }), 'a.mp3');
  fd.append('text', textoVoz);
  const r = await fetch('https://api.elevenlabs.io/v1/forced-alignment', { method: 'POST', headers: { 'xi-api-key': KEY }, body: fd });
  if (!r.ok) { console.log('FALLÓ la alineación', r.status, (await r.text()).slice(0, 300)); process.exit(1); }
  writeFileSync(`${DIR}/alin.json`, JSON.stringify(await r.json()));
}
if (modo === 'voz') { paso('voz lista (sin cuadros)'); process.exit(0); }
const W = JSON.parse(readFileSync(`${DIR}/alin.json`, 'utf8')).words.filter((w) => w.text.trim());   // the spaces come as words
const tokensPaso = g.pasos.map((p) => p.dice.trim().split(/\s+/).length);
const totalTokens = tokensPaso.reduce((a, b) => a + b, 0);
if (W.length !== totalTokens) { console.log(`la alineación trae ${W.length} palabras y el guion ${totalTokens}: revisar`); process.exit(1); }

// ── 4. the icon (Iconify, brand blue) ──
const nombreIcono = g.icono.replace(':', '-') + '.svg';
const rutaIcono = `${RAIZ}/motor/icons/${nombreIcono}`;
if (!existsSync(rutaIcono)) {
  const [col, nom] = g.icono.split(':');
  const r = await fetch(`https://api.iconify.design/${col}/${nom}.svg?color=%232F6FED&height=512`);
  const svg = await r.text();
  if (!svg.startsWith('<svg')) { console.log('ícono inexistente', g.icono); process.exit(1); }
  writeFileSync(rutaIcono, svg);
}

// ── 5. the drawn tab, and where each marked thing sits ──
// Which steps go ON SCREEN (the Cerebro's review of 18/11): every step that says where to touch («toca X») or points at
// something («aquí», «este número», «esta flecha») shows it in that same second — marked when it has a selector, the whole tab
// when it doesn't. Plus the ones the script asks for in `pantallas`. The rest is text, as Martín asked.
// («te toca», «le toca» is «it's your turn», not «touch»). `soloDonde`: the tab itself is not drawn and `pagina` only shows WHERE
// it is (Configuración, Classroom…), so only the steps in `pantallas` go on screen: an «aquí» about the undrawn tab stays text.
const SENALA = /(^|[\s¿¡«(])(?<!\b(?:te|le|les|me|nos) )(toca|tócalo|tócala|aquí|este|esta|estos|estas)([\s.,:;?!»)]|$)/i;
let rects = [];
const conPagina = !!g.pagina && existsSync(`${PESTANAS}/${g.pagina}`);
const enPantalla = conPagina ? g.pasos.map((p, i) => i).filter((i) => (!g.soloDonde && SENALA.test(g.pasos[i].dice)) || (g.pantallas || []).includes(i)) : [];
const sinPantalla = g.pasos.map((p, i) => i).filter((i) => SENALA.test(g.pasos[i].dice) && !enPantalla.includes(i));
if (enPantalla.length) {
  const sels = g.pasos.map((p) => p.sel || null);
  const out = execFileSync('node', [`${RAIZ}/motor/capturar2.cjs`, `${PESTANAS}/${g.pagina}`, `${DIR}/app.png`, JSON.stringify(sels)], { encoding: 'utf8' });
  rects = JSON.parse(out.trim().split('\n').pop()).rects || [];
  paso('pantalla: ' + enPantalla.map((i) => `paso ${i + 1} ${rects[i] ? 'marcado' : g.pasos[i].sel ? 'SIN MARCA (selector sin resultado: la pestaña entera)' : 'la pestaña entera'}`).join(' · '));
}
if (sinPantalla.length) paso('⚠️ señala sin pantalla (no hay pestaña dibujada): ' + sinPantalla.map((i) => `paso ${i + 1}`).join(', '));

// ── 6. beats: text that enters with the voice; the screen on the steps in `pantallas` ──
const ms = (s) => Math.round(s * 1000);
const LEAD = 80, TAIL_TEXTO = 380, TAIL_PANTALLA = 900;
const finFrase = (t) => /[.?!:…]["»”]?$/.test(t);
const finComa = (t) => /[,;]["»”]?$/.test(t);
function trozos(pal) {                                                    // pal: [{t, i}] → chunks of at most ~8 words
  const frases = []; let cur = [];
  pal.forEach((w) => { cur.push(w); if (finFrase(w.t)) { frases.push(cur); cur = []; } });
  if (cur.length) frases.push(cur);
  const res = [];
  for (const f of frases) {
    if (f.length <= 10) { res.push(f); continue; }
    const partes = []; let p = [];
    f.forEach((w) => { p.push(w); if (finComa(w.t)) { partes.push(p); p = []; } });
    if (p.length) partes.push(p);
    let acc = [];
    for (const q of partes) { if (acc.length && acc.length + q.length > 8) { res.push(acc); acc = []; } acc = acc.concat(q); }
    if (acc.length) res.push(acc);
  }
  // anything still too long: cut near the middle, before a joining word
  const final = [];
  for (const r of res) {
    if (r.length <= 10) { final.push(r); continue; }
    const mid = Math.floor(r.length / 2), une = /^(y|que|para|con|en|a|de|sin|o|tu|tus|el|la|lo)$/i;
    let k = mid; for (let d = 0; d < 3; d++) { if (une.test(r[mid + d]?.t || '')) { k = mid + d; break; } if (une.test(r[mid - d]?.t || '')) { k = mid - d; break; } }
    final.push(r.slice(0, k), r.slice(k));
  }
  // a one- or two-word chunk flashes by: it joins its neighbour (the next one, or the previous at the end) if that stays readable
  for (let k = 0; k < final.length; k++) {
    if (final[k].length > 2 || final.length === 1) continue;
    const j = k < final.length - 1 ? k + 1 : k - 1;
    if (final[j].length + final[k].length > 13) continue;
    if (j > k) final[j] = final[k].concat(final[j]); else final[j] = final[j].concat(final[k]);
    final.splice(k, 1); k--;
  }
  return final;
}
// What goes blue, by POSITION in the chunk (not by value: «reto» must not light up because «Reto de 7 días» is a name):
// the names of buttons and sections (NOMBRES + the script's own `nombres`), anything «quoted», and a Capitalized word mid-chunk.
const NOMBRES = ['Ver info', 'Mover a', 'Más acciones', 'Analicemos mi oferta', 'Nuevo chat', 'Mis landings', 'Usar plantilla',
  'Ver ejemplo', 'Hacer uno así', 'Nueva automatización', 'Vista del alumno', 'Invitar alumnos', 'Nuevo módulo', 'Mayor outlier',
  'Más vistas', 'Tus tickets', 'Instalar la app', 'Tus cuentas de IA', 'Tu plan', 'Report a problem', 'Agency Dashboard',
  'MaKo Partners', 'Identidades fiscales', 'Second Brain', 'Competitor Spy', 'Marketing CoPilot', 'Web Generator', 'AI Avatar',
  'Ops Center', 'Reto de 7 días', 'Mensaje para', 'Pegar link o texto', 'Buscar plantilla', 'Plantillas con estructura',
  'Tu personaje con IA', 'Antes de generar', 'Offer Coach', 'Funnel Coach', 'Tu oferta', 'Tu perfil'].concat(g.nombres || []);
const limpiar = (t) => t.replace(/[.,:;¿?¡!…"«»“”()]/g, '').toLowerCase();
function enfasis(chunk) {
  const out = new Set(), lw = chunk.map((w) => limpiar(w.t));
  for (const n of NOMBRES) {
    const nw = n.split(' ').map(limpiar);
    // the first word keeps its capital (or is «quoted»): «tu oferta» in a sentence is not the panel «Tu oferta»
    for (let k = 0; k + nw.length <= lw.length; k++) if (nw.every((x, j) => lw[k + j] === x) && /^[«¿"]*[A-ZÁÉÍÓÚÑ]/.test(chunk[k].t)) nw.forEach((_, j) => out.add(k + j));
  }
  let dentro = false;
  chunk.forEach((w, k) => {
    if (w.t.includes('«')) dentro = true;
    const sinSignos = w.t.replace(/[.,:;¿?¡!…"«»“”()]/g, '');
    if (dentro) out.add(k);
    else if (k > 0 && /^[A-ZÁÉÍÓÚÑ]/.test(sinSignos) && !/^(M[aá]ko|OK|IA|PDF|QR)$/i.test(sinSignos) && !/[.?!:]$/.test(chunk[k - 1].t)) out.add(k);
    if (w.t.includes('»')) dentro = false;
  });
  return [...out].sort((a, b) => a - b);
}
const beats = []; let idx = 0;
// `ver`: what the screen shows instead of a spoken word («numeral» → «#»: by ear it is not understood). Same word count.
const verPalabra = (t, ver) => {
  if (!ver) return t;
  const m = t.match(/^([«¿¡"(]*)(.*?)([.,:;?!…»")]*)$/);
  const v = ver[m[2].toLowerCase()];
  return v == null ? t : m[1] + v + m[3];
};
g.pasos.forEach((p, i) => {
  const pal = W.slice(idx, idx + tokensPaso[i]).map((w, k) => ({ t: verPalabra(w.text.replace(/Máko/g, 'MaKo'), p.ver), s: ms(w.start), e: ms(w.end), i: idx + k }));
  idx += tokensPaso[i];
  if (enPantalla.includes(i)) {
    const em = enfasis(pal); const clave = em.length ? pal[em[0]] : null;
    beats.push({ type: 'app', text: pal.map((w) => w.t).join(' '), img: './app.png', marca: rects[i] || null, pulso: (clave || pal[Math.floor(pal.length / 2)]).s, w0: pal[0], w1: pal[pal.length - 1] });
  } else {
    for (const ch of trozos(pal)) beats.push({ text: ch.map((w) => w.t).join(' '), emphIdx: enfasis(ch), w0: ch[0], w1: ch[ch.length - 1], n: ch.length });
  }
});
// the tab's icon on the first beat; one blue "golpe" on a short sentence that stands alone (not first, not next to a screen)
const rutaIconoRel = path.relative(DIR, rutaIcono).split(path.sep).join('/');
if (beats[0].type !== 'app') beats[0].icon = rutaIconoRel;
const golpe = beats.findIndex((b, k) => k > 0 && k < beats.length - 1 && !b.type && b.n <= 4 && finFrase(b.w1.t) && finFrase(beats[k - 1].w1.t) && beats[k - 1].type !== 'app' && beats[k + 1].type !== 'app');
if (golpe > 0) beats[golpe].bg = 'blue';
beats.forEach((b, k) => {
  b.s = k === 0 ? 0 : b.w0.s - LEAD;
  b.e = k < beats.length - 1 ? beats[k + 1].w0.s - LEAD : b.w1.e + (b.type === 'app' ? TAIL_PANTALLA : TAIL_TEXTO);
  delete b.w0; delete b.w1; delete b.n;
});
const DUR = beats[beats.length - 1].e;
writeFileSync(`${DIR}/beats.js`, 'window.BEATS=' + JSON.stringify(beats) + ';\nwindow.DUR=' + DUR + ';\n');
const motorRel = path.relative(DIR, `${RAIZ}/motor/engine2.js`).split(path.sep).join('/');
writeFileSync(`${DIR}/tutorial.html`, `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;padding:0;background:#fff}canvas{display:block}.probe{font-family:'Geist';font-weight:800;position:absolute;left:-9999px}</style></head>
<body><span class="probe">MaKo</span><canvas id="c"></canvas><script src="./beats.js"></script><script src="${motorRel}"></script></body></html>`);
paso(`${beats.length} pantallas, ${(DUR / 1000).toFixed(1)} s: ` + beats.map((b) => (b.type === 'app' ? '[APP]' : b.bg === 'blue' ? '[AZUL]' : '') + b.text.slice(0, 28)).join(' | '));

// ── 7a. frames to look at ──
for (const f of (await import('node:fs')).readdirSync(DIR)) if (/^cuadro-\d+\.png$/.test(f)) (await import('node:fs')).unlinkSync(`${DIR}/${f}`);
if (modo === 'cuadros') {
  const tiempos = beats.map((b) => Math.round(b.type === 'app' ? Math.min(b.e - 60, b.s + 1300) : (b.s + b.e) / 2));
  execFileSync('node', [`${RAIZ}/motor/render2.cjs`, DIR, '-', tiempos.join(',')], { stdio: 'inherit' });
  const ins = tiempos.flatMap((t) => ['-i', `${DIR}/cuadro-${t}.png`]);
  const n = tiempos.length, cols = 4, filas = Math.ceil(n / cols);
  const lay = tiempos.map((_, k) => `${(k % cols) * 480}_${Math.floor(k / cols) * 270}`).join('|');
  const pre = tiempos.map((_, k) => `[${k}]scale=480:270[a${k}]`).join(';') + ';' + tiempos.map((_, k) => `[a${k}]`).join('');
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...ins, '-filter_complex', `${pre}xstack=inputs=${n}:layout=${lay}:fill=white`, `${DIR}/hoja.jpg`]);
  paso(`hoja: ${DIR}/hoja.jpg (${n} cuadros, ${filas} filas)`);
}

// ── 7b. the video, and its line in the manifest ──
// Two outputs: the 1080p copy for Martín (OneDrive) and the one the app serves — public/tutoriales/<key>.mp4, 720p, ≤ 1,5 MB
// (the Cerebro's decision, 18/11), with its poster and its line in public/tutoriales/manifiesto.json.
if (modo === 'video' || modo === 'web') {                        // 'web': only redo the 720p from the 1080p already rendered
  mkdirSync(VIDEOS, { recursive: true }); mkdirSync(PUBLICO, { recursive: true });
  const salida = `${VIDEOS}/${id}.mp4`;
  if (modo === 'video') execFileSync('node', [`${RAIZ}/motor/render2.cjs`, DIR, salida], { stdio: 'inherit' });
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', salida], { encoding: 'utf8' }).trim();
  // 720p: text on a flat background compresses well; raise the CRF until it fits in 1,5 MB
  const web = `${PUBLICO}/${id}.mp4`; let crf = 23, peso = 0;
  for (; crf <= 37; crf += 2) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', salida, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', web]);
    peso = statSync(web).size; if (peso <= 1.5 * 1024 * 1024) break;
  }
  const poster = `${PUBLICO}/${id}.jpg`;
  const tPoster = (beats.find((b) => b.type !== 'app') || beats[0]); const tp = ((tPoster.s + Math.min(tPoster.e, tPoster.s + 1600)) / 2 / 1000).toFixed(2);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', tp, '-i', web, '-frames:v', '1', '-q:v', '4', poster]);
  const man = existsSync(MANIFIESTO_PUB) ? JSON.parse(readFileSync(MANIFIESTO_PUB, 'utf8')) : { _: 'Los tutoriales en video de cada pestaña de MaKo (texto al ritmo de la voz de Martín, su clon de ElevenLabs). Los arma scripts/tutorial-animado/hacer.mjs; key = id del guion en scripts/tutorial-animado/guiones.json.', videos: [] };
  man.videos = man.videos.filter((v) => v.key !== id);
  man.videos.push({ key: id, pestana: g.pestana, ruta: g.ruta, archivo: `/tutoriales/${id}.mp4`, poster: `/tutoriales/${id}.jpg`, duracion_s: +dur.toFixed(2),
    peso_kb: Math.round(peso / 1024), guion: textoPantalla,
    pantallas: enPantalla.map((i) => ({ paso: i + 1, sel: g.pasos[i].sel || null, marcado: !!rects[i] })),
    voz: `${VOZ.model_id} · ${VOZ.voz}`, dice_el_guion: dijoBien, chequeo: diferencias.length ? diferencias.join(' · ') + (soloOrtografia ? ' (ortografía del transcriptor)' : '') : 'idéntico',
    hecho: new Date().toISOString() });
  man.videos.sort((a, b) => (todos.findIndex((x) => x.id === a.key) - todos.findIndex((x) => x.id === b.key)));
  writeFileSync(MANIFIESTO_PUB, JSON.stringify(man, null, 1));
  copyFileSync(MANIFIESTO_PUB, MANIFIESTO);
  paso(`video: ${id}.mp4 ${dur.toFixed(1)} s · 720p ${Math.round(peso / 1024)} KB (crf ${crf}) · 1080p en OneDrive · manifiesto al día`);
}
if (!dijoBien) console.log('⚠️ la voz NO dice exactamente el guion: mirar chequeo.txt');
