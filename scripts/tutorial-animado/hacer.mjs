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
// a final «s» that melts into the next word («toca Celular» → «tocas», «reenvías su» → «reenvía») is the transcriber too
const ORTOGRAFIA = [['ok', 'okey'], ['zernio', 'sernio'], ['claude', 'cloud'], ['mako', 'maco'], ['ops', 'op'], ['tienes', 'tiene'], ['imich', 'image']];   // «Ímich»: how the voice is told to say «Image» // «tienes sus»: the two s melt into one
const difs = [...chequeo.matchAll(/cambiada: «(.+?)» → «(.+?)»/g)].map((m) => [m[1], m[2]]);
const otras = /faltante|sobrante|repetida/i.test(chequeo);
// two words the transcriber glued («Ops Center» → «Opcenter»): a «falta X» plus a «Y → XY»
const faltas = [...chequeo.matchAll(/falta: «(.+?)»/g)].map((m) => m[1]);
const pegadas = difs.filter(([a, b]) => faltas.some((f) => b === f + a || b === f.replace(/s$/, '') + a));
const soloOrtografia = !/sobrante|repetida/i.test(chequeo) && faltas.every((f) => f === 'ei' || pegadas.some(([a, b]) => b.startsWith(f.replace(/s$/, '')))) && difs.filter((d) => !pegadas.includes(d)).every(([a, b]) => /^\d+$/.test(a) || a === b + 's' || b === a + 's' || ORTOGRAFIA.some(([x, y]) => x === a && y === b));
const dijoBien = chequeo.includes('✅') || ((difs.length > 0 || faltas.length > 0) && soloOrtografia);
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
// Each sentence with its id, times and mark, for the app's tutorial engine (the Cerebro, 18/11): it pauses the video at the end of
// every «accion» until the person touches the marked element. Times in seconds from the alignment (first word's start → last
// word's end); what the screen shows (MaKo, `ver`), not what the voice reads.
let _iw = 0;
const FRASES = g.pasos.map((p, i) => {
  const ws = W.slice(_iw, _iw + tokensPaso[i]); _iw += tokensPaso[i];
  const fr = { id: `${id}-${i + 1}`, rol: p.rol || null, texto: p.dice.trim().replace(/Máko/g, 'MaKo'),
    t_inicio: +ws[0].start.toFixed(2), t_fin: +ws[ws.length - 1].end.toFixed(2) };
  if (p.ver) for (const [a, b] of Object.entries(p.ver)) fr.texto = fr.texto.replace(new RegExp(`(^|[^\\p{L}])${a}(?=[^\\p{L}]|$)`, 'giu'), (m, pre) => pre + b);
  if (p.sel) fr.sel = p.sel;
  if (p.falta) { fr.falta = true; if (p.donde) fr.donde = p.donde; }
  // «Toca aquí» = the video pauses until the touch (only safe things: navigate, open a panel, filter, change view); «Mira aquí»
  // = marked without pausing (what writes, creates, pays, or is not a button); the closing CTA never waits: the video ended
  if (p.rol === 'accion' || p.rol === 'cierre') fr.espera_clic = p.rol === 'accion' && p.tipo === 'toca';
  // it opens a panel or changes the view: the engine closes it before the next mark
  if (p.cierra) fr.cierra_despues = true;
  return fr;
});

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
// ⛔ `soloTexto` (Martín, 18/11, pisa lo anterior): «estás sacando como screenshots… Eso no lo tienes que hacer, pero ni de cerca…
// la persona lo está viendo el tutorial dentro de la misma app». The video is ONLY text with the voice; WHERE to click is marked by
// the app's own tutorial engine, live, next to the video. So no screen at all, and the script names each thing as the app writes it
// (no «aquí», no «este»): DEICTICO below flags any that slipped in.
const enPantalla = g.soloTexto ? [] : conPagina ? g.pasos.map((p, i) => i).filter((i) => (!g.soloDonde && SENALA.test(g.pasos[i].dice)) || (g.pantallas || []).includes(i)) : [];
const DEICTICO = /(^|[\s¿¡«(])(aquí|acá|ahí|este|esta|estos|estas|esto)([\s.,:;?!»)]|$)/i;
const sinPantalla = g.soloTexto ? g.pasos.map((p, i) => i).filter((i) => DEICTICO.test(g.pasos[i].dice))
  : g.pasos.map((p, i) => i).filter((i) => SENALA.test(g.pasos[i].dice) && !enPantalla.includes(i));
if (enPantalla.length) {
  const sels = g.pasos.map((p) => p.sel || null);
  const out = execFileSync('node', [`${RAIZ}/motor/capturar2.cjs`, `${PESTANAS}/${g.pagina}`, `${DIR}/app.png`, JSON.stringify(sels), g.hover || ""], { encoding: 'utf8' });
  rects = JSON.parse(out.trim().split('\n').pop()).rects || [];
  paso('pantalla: ' + enPantalla.map((i) => `paso ${i + 1} ${rects[i] ? 'marcado' : g.pasos[i].sel ? 'SIN MARCA (selector sin resultado: la pestaña entera)' : 'la pestaña entera'}`).join(' · '));
}
if (sinPantalla.length && !g.v4) paso((g.soloTexto ? '⚠️ señala algo («aquí», «este»…) y el video es sólo texto: ' : '⚠️ señala sin pantalla (no hay pestaña dibujada): ') + sinPantalla.map((i) => `paso ${i + 1}`).join(', '));

// ── 6. beats: text that enters with the voice; the screen on the steps in `pantallas` ──
const ms = (s) => Math.round(s * 1000);
const LEAD = 80, TAIL_TEXTO = 380, TAIL_PANTALLA = 900;
const finFrase = (t) => /[.?!:…]["»”]?$/.test(t);
const finComa = (t) => /[,;]["»”]?$/.test(t);
function trozos(pal, max = 10) {                                         // pal: [{t, i}] → chunks of at most `max` words
  const frases = []; let cur = [];
  pal.forEach((w) => { cur.push(w); if (finFrase(w.t)) { frases.push(cur); cur = []; } });
  if (cur.length) frases.push(cur);
  const res = [];
  for (const f of frases) {
    if (f.length <= max) { res.push(f); continue; }
    const partes = []; let p = [];
    f.forEach((w) => { p.push(w); if (finComa(w.t)) { partes.push(p); p = []; } });
    if (p.length) partes.push(p);
    let acc = [];
    for (const q of partes) { if (acc.length && acc.length + q.length > max - 2) { res.push(acc); acc = []; } acc = acc.concat(q); }
    if (acc.length) res.push(acc);
  }
  // anything still too long: cut near the middle, before a joining word
  const final = [];
  for (const r of res) {
    if (r.length <= max) { final.push(r); continue; }
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
// The button an action names, WHOLE («Toca aquí, en A cobrar:», «Mira aquí, Hacerme partner:»): from after «aquí,» (and «en»)
// up to the word that ends in «,», «:» or «.», without a leading article; only if it starts with a capital or «¿» (a name as
// the app writes it) and has 6 words or fewer. Global word indices (w.i), so a chunk break does not matter.
const ARTICULO = /^(el|la|los|las|tu|tus|un|una|su|sus)$/i;
function nombreDeAccion(pal) {
  const fuera = new Set();
  for (let k = 0; k < pal.length; k++) {
    if (!/^aquí[,:]?$/i.test(pal[k].t)) continue;
    let j = k + 1; if (pal[j] && /^en$/i.test(pal[j].t)) j++;
    while (pal[j] && ARTICULO.test(pal[j].t)) j++;
    const ini = j; let fin = -1;
    for (; j < pal.length && j - ini < 7; j++) if (/[,:.;]["»”]?$/.test(pal[j].t)) { fin = j; break; }
    if (fin < 0 || fin - ini + 1 > 6 || !/^[«¿"]*[A-ZÁÉÍÓÚÑ¿]/.test(pal[ini].t)) continue;
    for (let q = ini; q <= fin; q++) fuera.add(pal[q].i);
  }
  return fuera;
}
let NOMBRE_ACCION = new Set();
function enfasis(chunk) {
  const out = new Set(), lw = chunk.map((w) => limpiar(w.t));
  chunk.forEach((w, k) => { if (NOMBRE_ACCION.has(w.i)) out.add(k); });
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
    NOMBRE_ACCION = nombreDeAccion(pal);
    for (const ch of trozos(pal, (g.pasos[i].rol || (i === 0 ? "gancho" : "")) === "gancho" ? 13 : 10)) beats.push({ text: ch.map((w) => w.t).join(' '), emphIdx: enfasis(ch), w0: ch[0], w1: ch[ch.length - 1], n: ch.length, paso: i });
  }
});
// The character (engine3.js): each step's role decides how it stands. gancho, que-es and cierre → «heroe» (big, centered, the
// letters coming out from behind him); cosa → «lado» (small on the right, the text on the left). One short sentence that stands
// alone becomes a passing title («titulo», on blue, without him). Without roles: the first step is the hook, the last the close.
const rolDe = (i) => g.pasos[i].rol || (i === 0 ? 'gancho' : i === g.pasos.length - 1 ? 'cierre' : 'cosa');
// only the FIRST screen of «que-es» stands big (it names the tab: «Eso es el Ops Center:»); the rest of the explanation goes to
// the side — five big screens in a row look all the same
beats.forEach((b, k) => {
  const rol = rolDe(b.paso), primeraDelPaso = k === 0 || beats[k - 1].paso !== b.paso;
  b.modo = rol === 'gancho' || rol === 'cierre' || (rol === 'que-es' && primeraDelPaso) ? 'heroe' : 'lado';
});
const golpe = beats.findIndex((b, k) => k > 0 && k < beats.length - 1 && b.modo === 'lado' && b.n <= 4 && finFrase(b.w1.t) && finFrase(beats[k - 1].w1.t));
if (golpe > 0) { beats[golpe].bg = 'blue'; beats[golpe].modo = 'titulo'; }
// a different pose on every screen, so he is never the same: hello on the hook, open arms when he presents, pointing at the text
// or counting on the side, both arms up on the close
let nLado = 0, nHeroe = 0;
beats.forEach((b) => {
  const rol = rolDe(b.paso);
  if (b.modo === 'heroe') b.pose = rol === 'gancho' && nHeroe++ === 0 ? 'saludo' : rol === 'cierre' ? (beats.find((x) => rolDe(x.paso) === 'cierre') === b ? 'festeja' : 'abre') : 'abre';
  else if (b.modo === 'lado') b.pose = ['senala', 'explica'][nLado++ % 2];
  else b.pose = 'reposo';
  // the classic «letters behind the person» (the Cerebro, 18/11): on the hook and on «Eso es el…», the text is BIG and its last
  // line passes behind his head; on the close, it sits above him
  if (b.modo === 'heroe' && (rol === 'gancho' || rol === 'que-es')) b.detras = true;
  // an object in his hand when the sentence is about it: a microphone for a voice note, a phone for the phone
  if (/nota de voz|grábale|audio/i.test(b.text)) { b.objeto = 'mic'; b.pose = 'sostiene'; }
  else if (/celular|teléfono/i.test(b.text) && b.modo !== 'titulo') { b.objeto = 'tel'; b.pose = 'sostiene'; }
});
beats.forEach((b, k) => {
  b.s = k === 0 ? 0 : b.w0.s - LEAD;
  b.e = k < beats.length - 1 ? beats[k + 1].w0.s - LEAD : b.w1.e + TAIL_TEXTO + 300;
  delete b.w0; delete b.w1; delete b.n;
});
const DUR = beats[beats.length - 1].e;
const PALABRAS = W.map((w) => [ms(w.start), ms(w.end)]);
writeFileSync(`${DIR}/beats.js`, 'window.BEATS=' + JSON.stringify(beats) + ';\nwindow.PALABRAS=' + JSON.stringify(PALABRAS) + ';\nwindow.DUR=' + DUR + ';\n');
const motorRel = path.relative(DIR, `${RAIZ}/motor/engine3.js`).split(path.sep).join('/');
const voxRel = path.relative(DIR, `${RAIZ}/motor/voxel-martin.mjs`).split(path.sep).join('/');
writeFileSync(`${DIR}/tutorial.html`, `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
<style>html,body{margin:0;padding:0;background:#fff}canvas{display:block}#vox{position:absolute;left:-9999px;top:0}.probe{font-family:'Geist';font-weight:800;position:absolute;left:-9999px}</style></head>
<body><span class="probe">MaKo</span><canvas id="c"></canvas><canvas id="vox" width="800" height="1100"></canvas>
<script src="./beats.js"></script><script type="module" src="${voxRel}"></script><script src="${motorRel}"></script></body></html>`);
paso(`${beats.length} pantallas, ${(DUR / 1000).toFixed(1)} s: ` + beats.map((b) => `[${b.modo}${b.bg ? '·azul' : ''}·${b.pose}] ` + b.text.slice(0, 26)).join(' | '));

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
    peso_kb: Math.round(peso / 1024), guion: textoPantalla.replace(/Ei-Ai/g, "AI"), frases: FRASES,
    pantallas: enPantalla.map((i) => ({ paso: i + 1, sel: g.pasos[i].sel || null, marcado: !!rects[i] })),
    ...(g.soloPro ? { solo_pro: true } : {}), formato: g.v4 ? 4 : 3, voz: `${VOZ.model_id} · ${VOZ.voz}`, dice_el_guion: dijoBien, chequeo: diferencias.length ? diferencias.join(' · ') + (soloOrtografia ? ' (ortografía del transcriptor)' : '') : 'idéntico',
    hecho: new Date().toISOString() });
  man.videos.sort((a, b) => (todos.findIndex((x) => x.id === a.key) - todos.findIndex((x) => x.id === b.key)));
  writeFileSync(MANIFIESTO_PUB, JSON.stringify(man, null, 1));
  copyFileSync(MANIFIESTO_PUB, MANIFIESTO);
  paso(`video: ${id}.mp4 ${dur.toFixed(1)} s · 720p ${Math.round(peso / 1024)} KB (crf ${crf}) · 1080p en OneDrive · manifiesto al día`);
}
if (!dijoBien) console.log('⚠️ la voz NO dice exactamente el guion: mirar chequeo.txt');
