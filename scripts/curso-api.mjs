// =============================================================================
// curso-api — preguntarle a la API qué tiene un curso, sin depender del timing
// =============================================================================
// CAPTURAR la llamada correcta en el momento correcto no funciona. La página pide sus
// endpoints ANTES de resolver la sesión —ahí devuelven `[]`— y otra vez después, y cuál
// de las dos cae dentro de la ventana depende de la red, del caché y de cuántos módulos
// alcanzó a desplegar. Medido: «Mateo Maffia» capturaba `[]` corrida tras corrida con la
// sesión viva y `check_course_access` devolviendo true, mientras sus 2 PDF existían.
//
// Esto no captura: PREGUNTA. Se evalúa un `fetch` DENTRO de la página, que ya tiene la
// sesión, y se lee la respuesta. No hay ventana que errar.
//
// Las dos piezas que hacían falta:
//   · el TOKEN de sesión → sale del `localStorage` de la página (`sb-<ref>-auth-token`).
//   · la ANON KEY → sale de los HEADERS de una request real, capturados con CDP. Scrapear
//     el bundle de Next fue el camino que no funcionó: el regex se rompe al pasar por un
//     template literal y el error («Invalid regular expression flags») no dice por qué.
//
// El código de página vive en `curso-api-pagina.js`, en un archivo aparte y por ese mismo
// motivo. Los placeholders se reemplazan con split/join, sin escapado de por medio.
//
//   node scripts/curso-api.mjs <slug>
//   node scripts/curso-api.mjs <slug> --json    → el objeto crudo
// =============================================================================
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', 9333));

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
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 40000);
    });
  }
}

export async function preguntarCurso(slug, port = 9333) {
  const lista = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
  const t = lista.find((x) => x.type === 'page' && x.url.includes('cursoselite'));
  if (!t) throw new Error('no hay ninguna pestaña de cursoselite abierta');

  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar a CDP')), { once: true });
  });
  const cdp = new Cdp(ws);

  // La anon key, de los headers de cualquier request a Supabase.
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
  await cdp.enviar('Page.navigate', { url: `https://cursoselite.com.mx/curso/${slug}` });

  // Se espera a la apikey, no un tiempo fijo: sin ella la consulta vuelve 401 y el
  // mensaje habla del curso, no de la credencial que faltó.
  for (let i = 0; i < 40 && !apikey; i++) await new Promise((r) => setTimeout(r, 500));
  if (!apikey) { ws.close(); throw new Error('no capturé la apikey en 20s (¿la página cargó?)'); }

  const plantilla = readFileSync(join(process.cwd(), 'scripts', 'curso-api-pagina.js'), 'utf8');
  const expr = plantilla.split('__SLUG__').join(slug).split('__APIKEY__').join(apikey);

  const r = await cdp.enviar('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  ws.close();
  const crudo = r.result?.value;
  if (typeof crudo !== 'string') throw new Error(`la página no devolvió texto: ${JSON.stringify(r.result ?? r).slice(0, 200)}`);
  const d = JSON.parse(crudo);
  if (d.error) throw new Error(d.error);
  return d;
}

// ⚠️ «¿SOY EL MÓDULO PRINCIPAL?» SE COMPARA POR URL, no por el nombre del archivo. La
// primera versión comparaba el basename y el guard de CLI se disparaba al IMPORTARLO:
// el que importaba pasaba SUS argumentos, `process.argv[2]` era `--plan`, y el script
// moría con «Falta el slug del curso» sin haber sido invocado desde la línea de comandos.
const esPrincipal = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (esPrincipal) {
  const SLUG = process.argv[2];
  const JSON_CRUDO = process.argv.includes('--json');
  if (!SLUG || SLUG.startsWith('--')) { console.error('\n  ✖ Falta el slug del curso.\n'); process.exit(1); }
  try {
    const d = await preguntarCurso(SLUG, PORT);
    if (JSON_CRUDO) { console.log(JSON.stringify(d, null, 1)); process.exit(0); }
    console.log(`\n  ${d.curso}`);
    console.log(`  sesión: ${d.conToken ? 'con token' : 'SIN token (solo anon)'}`);
    console.log(`  módulos: ${d.modulos.length} · recursos: ${d.recursos.length}`);
    const tipos = {};
    for (const x of d.recursos) tipos[x.file_type ?? '?'] = (tipos[x.file_type ?? '?'] ?? 0) + 1;
    if (d.recursos.length) console.log(`  por tipo: ${JSON.stringify(tipos)}`);
    for (const x of d.recursos.slice(0, 6)) console.log(`     · ${String(x.title).slice(0, 56)} (${x.file_type}, ${x.file_size ?? '?'} B)`);
    console.log('');
  } catch (e) {
    console.error(`\n  ✖ ${e.message}\n`);
    process.exit(1);
  }
}
