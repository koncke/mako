// =============================================================================
// curso-api-sniff — qué le pide a su API la página de un curso, y qué contesta
// =============================================================================
// `curso-sniff.mjs` mira el PLAYER (HLS/DASH/DRM). Esto mira la API: las llamadas a
// Supabase que la página usa para armar el índice, los módulos y —lo que importa acá—
// los RECURSOS.
//
// Por qué hizo falta: el Módulo 5 de «Hackeando la Edición» se llama «Bonus 2 - Mis
// LUTs» y tiene 8 archivos .CUBE. El RPC de lecciones (`get_vip_lessons_secure`)
// devuelve CERO para ese módulo, porque no tiene lecciones — y eso se leyó como «el
// módulo está vacío». No lo está: los recursos entran por otro endpoint que nadie
// había buscado, y `curso-plan-vip.mjs` no lee `resources` en ninguna línea.
//
// Resultado medido: de 23 cursos del portal, 19 tienen CERO recursos.
//
// ⚠️ DESPLIEGA LOS MÓDULOS antes de esperar. Un acordeón cerrado no pide nada, así que
// capturar «al cargar» es el falso negativo garantizado de esta pantalla.
//
//   node scripts/curso-api-sniff.mjs --tab cursoselite --buscar LUT
//   node scripts/curso-api-sniff.mjs --tab cursoselite --segundos 40 --sin-desplegar
// =============================================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const tiene = (n) => process.argv.includes(`--${n}`);

const PORT = Number(arg('port', 9333));
const SEGUNDOS = Number(arg('segundos', 30));
const FILTRO = arg('tab', 'cursoselite');
const BUSCAR = arg('buscar', '');
// Navegar antes de capturar. Sin esto hay que dejar la pestaña en la página correcta a
// mano, y para recorrer N cursos eso no escala.
const IR_A = arg('url', '');
const RAIZ = arg('raiz', 'C:\\cursos');

/** Lo que cuenta como «llamada a la API» y no un asset. */
const ES_API = /\/rest\/v1\/|\/rpc\/|supabase|\/api\/|graphql/i;
/** Ruido que sí matchea lo de arriba y no aporta. */
const RUIDO = /\.(js|css|png|jpe?g|svg|woff2?|ico|mp4|m3u8|ts)(\?|$)/i;

// ⚠️ ESTE FILTRO SOLO CONOCE LA PLATAFORMA QUE YA MIRAMOS. Se escribió contra Cursos
// Élite, que habla Supabase por `/rest/v1/`. Apuntado a avatarhype devolvió CUATRO
// llamadas y las cuatro eran de Sentry: no es que la página no pida datos, es que los
// pide de otra forma (un Next.js que renderiza en el server manda su contenido en
// payloads RSC, no en XHR a `/api/`).
//
// Un sniffer con lista blanca contesta «no hay API» sobre una plataforma que no conoce,
// que es el mismo cero-ambiguo de siempre. `--todo` la apaga: se captura cualquier
// respuesta que no sea un asset y se ordena por tamaño, que para DESCUBRIR es lo correcto
// —lo que trae los datos casi siempre es lo más pesado que no es un video—.
const TODO = tiene('todo');
const ES_ASSET = /\.(js|mjs|css|png|jpe?g|gif|webp|svg|woff2?|ttf|ico|mp4|m4s|m3u8|mpd|wasm)(\?|$)/i;

// ── CDP mínimo sobre WebSocket (mismo molde que curso-sniff.mjs) ──────────────
class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pend = new Map(); this.oye = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pend.has(m.id)) {
        const { ok, no } = this.pend.get(m.id);
        this.pend.delete(m.id);
        m.error ? no(new Error(m.error.message)) : ok(m.result);
      } else if (m.method) { for (const f of this.oye) f(m); }
    });
  }
  enviar(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((ok, no) => {
      this.pend.set(id, { ok, no });
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 20000);
    });
  }
  al(f) { this.oye.push(f); }
}

// Abre TODO lo que parezca un módulo o submódulo del acordeón. Se corre varias veces
// porque abrir un módulo puede revelar submódulos que también hay que abrir.
const ABRIR = `
(() => {
  let n = 0;
  const cands = [...document.querySelectorAll('button, summary, [role="button"], [aria-expanded]')];
  for (const el of cands) {
    const t = (el.textContent || '').slice(0, 80);
    const cerrado = el.getAttribute('aria-expanded') === 'false' || el.tagName === 'SUMMARY';
    if (!/m[oó]dulo|bonus|fase|secci[oó]n|recurso|material|lut/i.test(t) && !cerrado) continue;
    if (el.getAttribute('aria-expanded') === 'true') continue;
    try { el.click(); n++; } catch (e) {}
  }
  return n;
})();
`;

const main = async () => {
  let lista;
  try { lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()); }
  catch {
    console.error(`\n  ✖ No hay CDP en 127.0.0.1:${PORT}. Corré antes: powershell -File scripts/curso-perfil.ps1\n`);
    process.exit(1);
  }
  const paginas = lista.filter((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
  const objetivo = paginas.find((t) => t.url.includes(FILTRO) || (t.title || '').includes(FILTRO));
  if (!objetivo) {
    console.error(`  ✖ No hay pestaña que matchee "${FILTRO}". Abiertas:`);
    for (const p of paginas) console.error(`      ${p.url}`);
    process.exit(1);
  }

  console.log(`\n  Pestaña : ${objetivo.title || '(sin título)'}`);
  console.log(`  URL     : ${objetivo.url}\n`);

  const ws = new WebSocket(objetivo.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar al WebSocket de CDP')), { once: true });
  });
  const cdp = new Cdp(ws);

  // requestId → { url, method, mime }. El cuerpo se pide DESPUÉS: pedirlo en el evento
  // da «No data found for resource» porque todavía se está recibiendo.
  const vistos = new Map();
  cdp.al((m) => {
    if (m.method !== 'Network.responseReceived') return;
    const { response, requestId, type } = m.params;
    const url = response?.url ?? '';
    if (TODO ? ES_ASSET.test(url) : (!ES_API.test(url) || RUIDO.test(url))) return;
    vistos.set(requestId, { url, mime: response.mimeType, status: response.status, type });
  });

  await cdp.enviar('Network.enable', { maxTotalBufferSize: 64 * 1024 * 1024, maxResourceBufferSize: 32 * 1024 * 1024 });
  await cdp.enviar('Page.enable');
  if (IR_A) { console.log(`  Navegando a ${IR_A}`); await cdp.enviar('Page.navigate', { url: IR_A }); }
  else await cdp.enviar('Page.reload', { ignoreCache: false });

  // Se le da tiempo a hidratar antes de clickear: un React que todavía no montó no
  // tiene los handlers puestos y los clicks se pierden sin ruido.
  await new Promise((r) => setTimeout(r, 6000));

  if (!tiene('sin-desplegar')) {
    let total = 0;
    for (let ronda = 1; ronda <= 4; ronda++) {
      const r = await cdp.enviar('Runtime.evaluate', { expression: ABRIR, returnByValue: true }).catch(() => null);
      const n = Number(r?.result?.value ?? 0);
      total += n;
      console.log(`  ronda ${ronda}: abrí ${n} bloque(s)`);
      if (!n) break;
      await new Promise((r2) => setTimeout(r2, 2500));
    }
    console.log(`  → ${total} bloques abiertos en total\n`);
  }

  console.log(`  Capturando ${SEGUNDOS}s…`);
  await new Promise((r) => setTimeout(r, SEGUNDOS * 1000));

  // Recién ahora los cuerpos.
  const salida = [];
  for (const [requestId, info] of vistos) {
    let body = '';
    try {
      const r = await cdp.enviar('Network.getResponseBody', { requestId });
      body = r.base64Encoded ? Buffer.from(r.body, 'base64').toString('utf8') : r.body;
    } catch (e) { body = `<sin cuerpo: ${e.message}>`; }
    salida.push({ ...info, largo: body.length, body });
  }

  mkdirSync(RAIZ, { recursive: true });
  const dest = join(RAIZ, 'api-sniff.json');
  writeFileSync(dest, JSON.stringify({ url: objetivo.url, cuando: objetivo.title, llamadas: salida }, null, 1), 'utf8');

  console.log(`\n  ${salida.length} llamada(s) a la API:\n`);
  for (const s of salida.sort((a, b) => b.largo - a.largo)) {
    const hit = BUSCAR && s.body.includes(BUSCAR) ? '  ◀◀ CONTIENE «' + BUSCAR + '»' : '';
    console.log(`  ${String(s.status).padEnd(4)} ${String(s.largo).padStart(8)}b  ${s.url.slice(0, 110)}${hit}`);
  }
  console.log(`\n  Crudo: ${dest}\n`);
  process.exit(0);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
