// ¿Drive puede REPRODUCIR los videos que el portal muestra?
//
//   node --import tsx scripts/curso-drive-reproducible.mjs
//   node --import tsx scripts/curso-drive-reproducible.mjs --por-curso 3 --solo agencia-6-cifras-v2
//
// El portal reproduce desde Drive (DRIVE_PREVIEW). Drive genera una version streameable de
// cada video DESPUES de subirlo, y cuando no la tiene contesta «This video file is
// unplayable» dentro del iframe. Desde afuera eso es invisible: la ficha esta completa, la
// clase abre, la transcripcion esta — y el video no arranca.
//
// ⚠️ NO SE PUEDE MEDIR CON `curl`. El preview es una pagina que arma el reproductor con JS,
//    y su HTML crudo es igual en los dos casos. Hay que abrirla en un navegador de verdad,
//    esperar a que monte, y leer lo que dice. Probado: `curl` daba «abierto» sobre un video
//    que en pantalla decia «unplayable».
//
// ⚠️ Y SE MIRA UNA MUESTRA, no todo. Cada archivo son ~9 segundos de espera; 5.000 clases
//    serian 12 horas. Con 3 por curso alcanza para contestar «¿este curso se ve?», que es
//    la pregunta.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('port', 9333));
const POR_CURSO = Number(arg('por-curso', 2));
const SOLO = arg('solo', '');
const ESPERA = Number(arg('espera', 9000));

// El id de Drive vive en drive.json; el `videoId` del plan es el de la plataforma de
// origen (Vimeo) en los cursos viejos, y el de Drive solo en los que nacieron de Drive.
// Confundirlos hace que la prueba mida otra cosa: ya paso.
const muestraDe = (slug) => {
  const base = `C:/cursos/${slug}`;
  let drive = null;
  try { drive = JSON.parse(readFileSync(join(base, 'drive.json'), 'utf8')); } catch { return []; }
  const con = (drive.clases ?? []).filter((c) => c.videoId);
  if (!con.length) return [];
  // Se mira el PRIMERO, el del medio y el mas grande: si algo depende del tamaño, el mas
  // grande es el que lo delata, y mirar solo el primero de cada curso lo escondería.
  const tam = (c) => {
    if (!drive.carpeta || !c.archivo) return 0;
    try { return statSync(join(drive.carpeta, c.rel ?? '', c.archivo)).size; } catch { return 0; }
  };
  const orden = [...con].sort((a, b) => tam(b) - tam(a));
  const elegidas = [con[0], con[Math.floor(con.length / 2)], orden[0]].filter(Boolean);
  const vistos = new Set();
  return elegidas.filter((c) => !vistos.has(c.videoId) && vistos.add(c.videoId))
    .slice(0, POR_CURSO).map((c) => ({ id: c.videoId, titulo: c.titulo, mb: tam(c) / 1e6 }));
};

const slugs = readdirSync('C:/cursos', { withFileTypes: true })
  .filter((x) => x.isDirectory() && existsSync(`C:/cursos/${x.name}/drive.json`))
  .map((x) => x.name)
  .filter((s) => !SOLO || s === SOLO);

const lista = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const tab = lista.find((t) => t.type === 'page' && !/devtools|chrome-extension/.test(t.url));
if (!tab) { console.error(`\n  ✖ No hay Chrome con CDP en ${PORT}. Abrilo con --remote-debugging-port=${PORT}\n`); process.exit(2); }

const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let n = 0; const pend = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const cmd = (method, params = {}) => new Promise((res) => { const i = ++n; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await cmd('Page.enable');

const probar = async (id) => {
  await cmd('Page.navigate', { url: `https://drive.google.com/file/d/${id}/preview` });
  await new Promise((r) => setTimeout(r, ESPERA));
  const r = await cmd('Runtime.evaluate', {
    returnByValue: true,
    expression: `((document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 200))`,
  });
  const t = r?.result?.result?.value ?? '';
  if (/unplayable|no se puede reproducir/i.test(t)) return 'NO REPRODUCE';
  if (/Displaying|Play \(k\)/i.test(t)) return 'ok';
  if (/sign in|iniciar sesi/i.test(t)) return 'pide login';
  return 'no sé';
};

const rotos = [];
console.log(`\n  Probando ${slugs.length} curso(s), hasta ${POR_CURSO} video(s) cada uno…\n`);
for (const slug of slugs) {
  const m = muestraDe(slug);
  if (!m.length) continue;
  const res = [];
  for (const v of m) res.push({ ...v, estado: await probar(v.id) });
  const malas = res.filter((x) => x.estado === 'NO REPRODUCE');
  if (malas.length) {
    rotos.push({ slug, malas, total: m.length });
    console.log(`  ⛔ ${slug.padEnd(38)} ${malas.length}/${m.length} no reproducen`);
    for (const x of malas) console.log(`        ${x.mb ? `${x.mb.toFixed(0)} MB` : '?'}  ${String(x.titulo).slice(0, 52)}`);
  } else {
    console.log(`  ✓  ${slug.padEnd(38)} ${res.map((x) => x.estado).join(' · ')}`);
  }
}
ws.close();

console.log(`\n  ${rotos.length} curso(s) con al menos un video que Drive no puede reproducir\n`);
process.exit(rotos.length ? 1 : 0);
