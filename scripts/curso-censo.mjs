// =============================================================================
// curso-censo — QUÉ tiene la plataforma, y qué de eso está en el portal
// =============================================================================
// Contesta con NÚMEROS la única pregunta que importa antes de decir «ya está todo»:
// cuántos cursos, cuántas lecciones y cuántas horas hay del otro lado, y cuáles de esos
// el portal no tiene.
//
// ⚠️ PREGUNTA, NO CAPTURA. `curso-inventario.mjs` olfatea las respuestas que la página va
// pidiendo, y para «Instituto de Comunicación» y «Mateo Maffia» eso nunca funcionó: la
// captura salía vacía y el inventario quedaba con `capturaFallida` — o sea, sin poder
// afirmar nada sobre esos dos. Acá se le pregunta a la API con la sesión de la página y
// no hay ventana que errar.
//
// ⚠️ Y MIRA LOS 82 CURSOS, NO LOS 18 QUE YA BAJAMOS. El barrido de faltantes compara
// fuente contra portal SOLO donde hay un `inventario.json`, que existe únicamente para
// los cursos ya ingeridos. Leído sin esa aclaración, su «0 faltantes» se entiende como
// «el portal está completo», y son dos afirmaciones distintas: la segunda incluye los
// cursos que nunca se trajeron y los que no tienen fuente en la plataforma.
//
//   node scripts/curso-censo.mjs              → la tabla
//   node scripts/curso-censo.mjs --json       → el objeto crudo
//   node scripts/curso-censo.mjs --faltan     → solo lo que el portal NO tiene
// =============================================================================
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', 9333));
const REPO = arg('repo', process.cwd());
const SOLO_FALTAN = process.argv.includes('--faltan');
const JSON_CRUDO = process.argv.includes('--json');

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pend = new Map(); this.oye = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pend.has(m.id)) {
        const { ok, no } = this.pend.get(m.id); this.pend.delete(m.id);
        m.error ? no(new Error(m.error.message)) : ok(m.result);
      } else if (m.method) for (const f of this.oye) f(m);
    });
  }
  enviar(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, no) => {
      this.pend.set(id, { ok, no });
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 180000);
    });
  }
}

const lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
const t = lista.find((x) => x.type === 'page' && x.url.includes('cursoselite'));
if (!t) { console.error('\n  ✖ No hay ninguna pestaña de cursoselite abierta.\n'); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((ok, no) => {
  ws.addEventListener('open', ok, { once: true });
  ws.addEventListener('error', () => no(new Error('no pude conectar a CDP')), { once: true });
});
const cdp = new Cdp(ws);

// La anon key sale de los HEADERS de una request real (no del bundle: scrapearlo fue el
// camino que no funcionó — ver la cabecera de curso-api.mjs).
let apikey = '';
cdp.oye.push((m) => {
  if (m.method !== 'Network.requestWillBeSent' || apikey) return;
  const h = m.params.request?.headers ?? {};
  const k = h.apikey ?? h.apiKey ?? h.Apikey ?? '';
  if (k) apikey = String(k);
});
await cdp.enviar('Network.enable');
await cdp.enviar('Page.enable');
await cdp.enviar('Runtime.enable');
await cdp.enviar('Page.navigate', { url: 'https://cursoselite.com.mx/' });
for (let i = 0; i < 60 && !apikey; i++) await new Promise((r) => setTimeout(r, 500));
if (!apikey) { ws.close(); console.error('\n  ✖ No capturé la apikey en 30 s (¿la página cargó?).\n'); process.exit(1); }

const plantilla = readFileSync(join(REPO, 'scripts', 'curso-censo-pagina.js'), 'utf8');
const r = await cdp.enviar('Runtime.evaluate', {
  expression: plantilla.split('__APIKEY__').join(apikey),
  awaitPromise: true, returnByValue: true,
});
ws.close();
const crudo = r.result?.value;
if (typeof crudo !== 'string') { console.error(`\n  ✖ La página no devolvió texto: ${JSON.stringify(r.result ?? r).slice(0, 300)}\n`); process.exit(1); }
const d = JSON.parse(crudo);
if (!d.ok) { console.error(`\n  ✖ ${d.error}\n`); process.exit(1); }

// ── Qué de eso está en el portal ────────────────────────────────────────────
const CONO = join(REPO, 'app', 'conocimientos');
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '').toLowerCase();
const enPortal = new Set();
for (const f of readdirSync(CONO).filter((x) => x.startsWith('curso') && x.endsWith('.ts'))) {
  const s = readFileSync(join(CONO, f), 'utf8');
  enPortal.add(norm(f.replace(/^curso-|\.ts$/g, '')));
  for (const m of s.matchAll(/titulo: '([^']*)'/g)) enPortal.add(norm(m[1]));
  for (const m of s.matchAll(/slug: '([^']*)'/g)) enPortal.add(norm(m[1]));
}
const tenemos = (c) => {
  const a = norm(c.slug), b = norm(c.titulo);
  for (const k of enPortal) {
    if (!k || k.length < 8) continue;
    if (a && (k === a || k.includes(a) || a.includes(k))) return true;
    if (b && (k === b || k.includes(b) || b.includes(k))) return true;
  }
  return false;
};

const filas = d.cursos.map((c) => ({ ...c, tenemos: tenemos(c), horas: c.segundos / 3600 }));
if (JSON_CRUDO) { console.log(JSON.stringify({ ...d, cursos: filas }, null, 1)); process.exit(0); }

writeFileSync(join('C:\\cursos', 'censo-plataforma.json'), JSON.stringify({ ...d, cursos: filas }, null, 1), 'utf8');

const faltan = filas.filter((c) => !c.tenemos).sort((a, b) => b.lecciones - a.lecciones);
const hay = filas.filter((c) => c.tenemos);
const suma = (xs, k) => xs.reduce((t, x) => t + (x[k] || 0), 0);

console.log(`\n  LA PLATAFORMA (preguntado a la API, con la sesión de la página)`);
console.log(`  ${d.totales.cursos} cursos · ${d.totales.lecciones} lecciones · ${d.totales.recursos} recursos`);
if (d.totales.leccionesSinCurso) console.log(`  ⚠ ${d.totales.leccionesSinCurso} lección/es sin curso asociado`);
console.log(`\n  EN EL PORTAL : ${hay.length} cursos · ${suma(hay, 'lecciones')} lecciones · ${suma(hay, 'horas').toFixed(0)} h`);
console.log(`  SIN TRAER    : ${faltan.length} cursos · ${suma(faltan, 'lecciones')} lecciones · ${suma(faltan, 'horas').toFixed(0)} h · ${suma(faltan, 'recursos')} recursos\n`);

const mostrar = SOLO_FALTAN ? faltan : filas.sort((a, b) => b.lecciones - a.lecciones);
console.log(`  ${'curso'.padEnd(46)} ${'lecc'.padStart(5)} ${'horas'.padStart(6)} ${'recur'.padStart(6)}  portal`);
for (const c of mostrar) {
  console.log(`  ${String(c.titulo).slice(0, 46).padEnd(46)} ${String(c.lecciones).padStart(5)} ${c.horas.toFixed(0).padStart(6)} ${String(c.recursos).padStart(6)}  ${c.tenemos ? '✓' : '—'}`);
}
console.log(`\n  → C:\\cursos\\censo-plataforma.json\n`);
