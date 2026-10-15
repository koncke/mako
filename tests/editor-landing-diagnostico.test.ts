// =============================================================================
// El diagnóstico de una landing como RECORRIDO (tanda 2, T2/T5): ubicar la cita, el texto de una
// landing nuestra, el saneo de lo que devuelve el modelo, la clave, el documento aislado de una de
// afuera y la tabla de los comentarios.
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, punto 7), textual: «que al analizar una landing sea como un
// "tutorial" de los que tenemos en MaKo, que se ponga opaco y señale el lugar donde se esta haciendo el
// comentario, y luego que queden guardados todos los comentarios y sugerencias y claro, la opción de
// solucionarlo allí mismo con IA.» Lo que se prueba vive en lib/editor-landing/diagnostico.ts.
//
// PROBADO ROMPIÉNDOLO (11/10/2026, sobre la versión de este archivo; los números al pie).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script, runInNewContext } from 'node:vm';
import {
  ESTADOS_SUGERENCIA, JS_BUSCAR, SCRIPT_DIAGNOSTICO, TOPES_DIAGNOSTICO,
  bloquesDeTexto, buscarEnTextos, cajaDeMensaje, candidatosDeCita, citaEnTexto, claveSugerencia, documentoDiagnostico,
  documentoErrorDiagnostico, estadoValido, instruccionDeSugerencia, normalizarHallazgos, objetivoDe, ordenarParaRecorrido,
  paginaPrincipal, primeraFrase, resumenDeAnalisis, responderPaginaDiagnostico, srcPaginaDiagnostico, tarjetaDeRecorrido,
  textoParaAnalisis, ubicarCitaEnBloques, type Coincidencia,
} from '../lib/editor-landing/diagnostico';
import { claveDeLanding } from '../lib/landing-url';
import { NODO, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const sinComentariosSql = (s: string) => s.replace(/^\s*--.*$/gm, '');

const NBSP = String.fromCharCode(0xa0);

// ── Ubicar una cita ──────────────────────────────────────────────────────────

test('la cita se encuentra aunque cruce dos nodos de texto pegados (un título y su párrafo)', () => {
  const textos = ['Deja de perder clientes', 'Agenda tu llamada hoy mismo.'];
  const c = buscarEnTextos(textos, 'clientes Agenda tu llamada');
  assert.deepEqual(c, { desde: { nodo: 0, offset: 15 }, hasta: { nodo: 1, offset: 17 } });
});

test('comillas tipográficas, mayúsculas, acentos, espacios raros y asteriscos no impiden encontrarla', () => {
  const textos = [`“Quiero empezar” —${NBSP}dijo   Ana, la DUEÑA del café.`];
  assert.ok(buscarEnTextos(textos, '"quiero empezar" - dijo ana'));
  assert.ok(buscarEnTextos(textos, '**la dueña del cafe**'));
  assert.ok(citaEnTexto('«La Dueña del Café»', textos[0]));
});

test('una cita con «…» se busca por su pedazo más largo; un pedazo de menos de 8 caracteres no cuenta', () => {
  const textos = ['Aprende a vender por WhatsApp sin perseguir a nadie y cierra más ventas cada semana.'];
  const c = buscarEnTextos(textos, 'Aprende a vender … cierra más ventas cada semana');
  assert.ok(c);
  assert.equal(c.desde.offset, textos[0].indexOf('cierra'));
  assert.deepEqual(candidatosDeCita('Hola … mundo'), ['hola...mundo'], 'sólo entera: sus pedazos son cortos');
  assert.equal(buscarEnTextos(['hola mundo'], 'hola'), null);
});

test('si el final de una cita larga no coincide, se busca por su principio', () => {
  const textos = ['La forma más simple de llenar tu agenda con clientes que ya quieren comprar.'];
  const cita = 'La forma más simple de llenar tu agenda con clientes que ya quieren comprar hoy mismo sin esperar';
  const c = buscarEnTextos(textos, cita);
  assert.ok(c);
  assert.equal(c.desde.offset, 0);
});

test('lo que no está no se inventa, y los offsets son de UTF-16 (un emoji ocupa dos)', () => {
  assert.equal(buscarEnTextos(['Nada que ver con esto'], 'otra cosa completamente distinta'), null);
  const c = buscarEnTextos(['🚀 Lanza tu curso en 30 días'], 'lanza tu curso');
  assert.deepEqual(c, { desde: { nodo: 0, offset: 3 }, hasta: { nodo: 0, offset: 17 } });
});

// El guard DIFERENCIAL: la búsqueda vive dos veces (TS para nuestro DOM, JS plano adentro del iframe de
// una landing de afuera). Si una cambia y la otra no, esto cae.
const BATERIA: Array<[string[], string]> = [
  [['Deja de perder clientes', 'Agenda tu llamada hoy mismo.'], 'clientes Agenda tu llamada'],
  [[`“Quiero empezar” —${NBSP}dijo   Ana`], '"quiero empezar" - dijo ana'],
  [['Aprende a vender por WhatsApp sin perseguir a nadie y cierra más ventas.'], 'Aprende a vender … cierra más ventas'],
  [['La forma más simple de llenar tu agenda con clientes que ya quieren comprar.'], 'La forma más simple de llenar tu agenda con clientes que ya quieren comprar hoy mismo'],
  [['🚀 Lanza tu curso en 30 días'], 'lanza tu curso'],
  [['Nada que ver'], 'otra cosa completamente distinta'],
  [['hola mundo'], 'hola'],
  [['El precio: $1.000 / mes', '(antes $2.000)'], 'precio: $1.000 / mes (antes'],
  [['Garantía de 30 días… sin preguntas.'], 'garantia de 30 dias... sin preguntas'],
  [['¿Listo para empezar?'], '¡¿Listo para empezar?!'],
  [['café', 'Ñandú'], 'CAFE ñandu'],
  [['texto `con` acento’s'], "texto con acento's"],
];

test('la búsqueda del iframe (JS plano) contesta EXACTAMENTE lo mismo que la de TypeScript', () => {
  const js = runInNewContext(`(${JS_BUSCAR})`) as (t: string[], c: string) => Coincidencia | null;
  for (const [textos, cita] of BATERIA) {
    assert.deepEqual(JSON.parse(JSON.stringify(js(textos, cita))), buscarEnTextos(textos, cita), `cita: ${cita}`);
  }
});

test('el script del iframe compila y no lleva «</» (cerraría su <script>)', () => {
  assert.equal(SCRIPT_DIAGNOSTICO.includes('</'), false);
  assert.doesNotThrow(() => new Script(SCRIPT_DIAGNOSTICO));
  // Sólo le contesta a SU padre, y avisa que está listo.
  assert.match(SCRIPT_DIAGNOSTICO, /ev\.source !== padre/);
  assert.match(SCRIPT_DIAGNOSTICO, /tipo: 'listo'/);
});

// ── El texto de una landing NUESTRA ──────────────────────────────────────────

const t = (texto: string): JsonNodo => ({ type: 'text', text: texto });
const p = (texto: string): JsonNodo => ({ type: 'paragraph', content: [t(texto)] });
const h = (texto: string): JsonNodo => ({ type: 'heading', attrs: { level: 1 }, content: [t(texto)] });
const tarjeta = (id: string, hijos: JsonNodo[], oculta = false): JsonNodo => ({ type: NODO.tarjeta, attrs: { id, oculta }, content: hijos });

const CONTENIDO: LandingContenido = {
  v: 1,
  paginas: [
    { id: 'p2', titulo: 'Gracias', ruta: 'gracias', doc: { type: 'doc', content: [tarjeta('tg', [p('Gracias por tu compra')])] } },
    {
      id: 'p1', titulo: 'Inicio', ruta: '', doc: {
        type: 'doc', content: [
          tarjeta('t1', [h('Vende más con tu landing'), p('Una página que convierte visitas en clientes.')]),
          tarjeta('t2', [p('Esto está oculto')], true),
          tarjeta('t3', [
            { type: NODO.botones, content: [{ type: NODO.boton, content: [t('Agenda tu llamada')] }, { type: NODO.boton, content: [t('Ver precios')] }] },
            { type: NODO.formulario, attrs: { campos: [{ etiqueta: 'Tu correo' }], boton: 'Quiero mi lugar' } },
          ]),
        ],
      },
    },
  ],
};

test('se diagnostica la página de INICIO, aunque no sea la primera', () => {
  assert.equal(paginaPrincipal(CONTENIDO)?.id, 'p1');
  assert.equal(paginaPrincipal({ v: 1, paginas: [] }), null);
});

test('el texto de cada sección VISIBLE, en orden: los botones y el formulario cuentan, lo oculto no', () => {
  const bloques = bloquesDeTexto(paginaPrincipal(CONTENIDO));
  assert.deepEqual(bloques.map((b) => b.id), ['t1', 't3']);
  assert.equal(bloques[0].texto, 'Vende más con tu landing\nUna página que convierte visitas en clientes.');
  assert.equal(bloques[1].texto, 'Agenda tu llamada\nVer precios\nTu correo\nQuiero mi lugar');
  assert.equal(textoParaAnalisis(bloques).split('\n\n').length, 2);
});

test('cada cita se ubica en SU sección (la de su primer carácter)', () => {
  const bloques = bloquesDeTexto(paginaPrincipal(CONTENIDO));
  assert.equal(ubicarCitaEnBloques('«Agenda tu llamada»', bloques), 't3');
  assert.equal(ubicarCitaEnBloques('convierte visitas en clientes', bloques), 't1');
  assert.equal(ubicarCitaEnBloques('Esto está oculto', bloques), null);
  assert.equal(ubicarCitaEnBloques('en clientes. Agenda tu llamada', bloques), 't1');
});

// ── Lo que devuelve el modelo ────────────────────────────────────────────────

test('un hallazgo sin cita o sin título no es un hallazgo; las comillas se sacan; severidad por default «media»', () => {
  const r = normalizarHallazgos({
    hallazgos: [
      { titulo: 'La promesa no se entiende', severidad: 'ALTA', cita: '«Vende más con tu landing»', por_que: 'x', arreglo: 'y' },
      { titulo: 'Sin cita', severidad: 'baja', cita: '' },
      { titulo: '', cita: 'algo citado' },
      { titulo: 'Otra', severidad: 'rara', cita: '"Ver precios"' },
      { titulo: 'La promesa no se entiende', severidad: 'alta', cita: 'Vende más con tu landing' },
      'basura',
    ],
  });
  assert.deepEqual(r.map((x) => [x.titulo, x.severidad, x.cita]), [
    ['La promesa no se entiende', 'alta', 'Vende más con tu landing'],
    ['Otra', 'media', 'Ver precios'],
  ]);
  assert.equal(normalizarHallazgos(r).length, 2, 'acepta también la lista ya normalizada del Landing Analyst');
  const muchos = Array.from({ length: 50 }, (_, i) => ({ titulo: `Hallazgo ${i}`, cita: `cita número ${i}` }));
  assert.equal(normalizarHallazgos(muchos).length, TOPES_DIAGNOSTICO.hallazgos);
});

test('el veredicto: un score fuera de rango se acota y uno que no vino es null (nunca un número inventado)', () => {
  assert.equal(resumenDeAnalisis({ score: 140 }, null).score, 10);
  assert.equal(resumenDeAnalisis({ score: -3 }, null).score, 0);
  assert.equal(resumenDeAnalisis({}, null).score, null);
  assert.equal(resumenDeAnalisis({ score: null }, null).score, null);
});

// La escala es la del Landing Analyst: 0-10 con una décima (su prompt y las filas de
// landing_analyses: 6.8, 3.2). Con la versión de 0-100 al entero, un 6,8 salía «7/100» en el panel
// (medido en el navegador, 12/10/2026). Verificado rompiéndolo: con `Math.min(100, Math.round(n))`
// de vuelta, el archivo da 2 fallos y 28 pases (éste, 6.84 → 7, y el del rango de arriba, 140 → 100).
test('el veredicto: el score es 0-10 con una décima, como lo da el Landing Analyst', () => {
  assert.equal(resumenDeAnalisis({ score: 6.84 }, null).score, 6.8);
  assert.equal(resumenDeAnalisis({ score: '3.2' }, null).score, 3.2);
  assert.equal(resumenDeAnalisis({ score: 10 }, null).score, 10);
});

test('la clave deduplica lo mismo dicho con otras comillas, y separa landings', () => {
  const a = claveSugerencia({ docId: 7 }, { titulo: 'La promesa', cita: '«Vende más»' });
  assert.equal(a, claveSugerencia({ docId: 7 }, { titulo: 'la PROMESA', cita: '"Vende mas"' }));
  assert.notEqual(a, claveSugerencia({ docId: 8 }, { titulo: 'La promesa', cita: '«Vende más»' }));
  assert.notEqual(a, claveSugerencia({ url: 'https://a.com' }, { titulo: 'La promesa', cita: '«Vende más»' }));
  assert.ok(a.length < 200);
});

test('el objetivo es UNA landing nuestra o UNA url, y la url se normaliza como la llave de landing_analyses', () => {
  assert.deepEqual(objetivoDe({ docId: 12 }), { docId: 12 });
  assert.equal(objetivoDe({ docId: 12, url: 'https://a.com' }), null);
  assert.equal(objetivoDe({}), null);
  assert.equal(objetivoDe({ docId: -1 }), null);
  assert.deepEqual(objetivoDe({ url: 'www.Ejemplo.com/oferta/?fbclid=1' }), { url: claveDeLanding('https://www.Ejemplo.com/oferta/?fbclid=1') });
  assert.deepEqual(objetivoDe({ url: 'www.Ejemplo.com/oferta/?fbclid=1' }), { url: 'https://ejemplo.com/oferta' });
  assert.equal(objetivoDe({ url: 'javascript:alert(1)' }), null);
});

test('los estados son la lista cerrada de la migración', () => {
  assert.ok(estadoValido('resuelta'));
  assert.equal(estadoValido('borrada'), false);
});

// ── El panel ─────────────────────────────────────────────────────────────────

test('el recorrido va de arriba hacia abajo; lo que no se encontró va al final, en su orden', () => {
  const pos: Record<number, number | null> = { 1: 900, 2: null, 3: 120, 4: null, 5: 120 };
  const orden = ordenarParaRecorrido([1, 2, 3, 4, 5].map((id) => ({ id })), (id) => pos[id]);
  assert.deepEqual(orden.map((x) => x.id), [3, 5, 1, 2, 4]);
});

test('la tarjeta del recorrido es corta: la primera frase de la sugerencia', () => {
  assert.equal(primeraFrase('Cambia el título por uno concreto. Después revisa el botón.'), 'Cambia el título por uno concreto.');
  const largo = 'Reescribe el título para que diga en una sola línea qué vendes, a quién y qué resultado obtiene la persona en cuánto tiempo, sin palabras vacías como solución integral o potencia tu negocio que no dicen nada';
  assert.ok(primeraFrase(largo).length <= 181);
  assert.ok(primeraFrase(largo).endsWith('…'));
  assert.deepEqual(tarjetaDeRecorrido({ titulo: 'T', arreglo: '', por_que: 'Porque sí, y nada más que decir.' }), { titulo: 'T', texto: 'Porque sí, y nada más que decir.' });
});

test('la instrucción de «Solucionar con IA» lleva la sugerencia, el problema y la cita', () => {
  const i = instruccionDeSugerencia({ titulo: 'No hay prueba', cita: 'Somos los mejores', por_que: 'Nadie lo cree.', arreglo: 'Agrega un testimonio real.' });
  assert.match(i, /^Aplica esta sugerencia a la sección: Agrega un testimonio real\./);
  assert.match(i, /«Somos los mejores»/);
  assert.ok(i.length <= 4_000);
});

test('una caja del iframe se sanea: cinco números finitos o nada', () => {
  assert.deepEqual(cajaDeMensaje([1, 2, 3, 4, 5]), [1, 2, 3, 4, 5]);
  assert.equal(cajaDeMensaje([1, 2, 3]), null);
  assert.equal(cajaDeMensaje([1, 2, -3, 4, 5]), null);
  assert.equal(cajaDeMensaje([1, 'x', 3, 4, 5]), null);
  assert.deepEqual(cajaDeMensaje([1e9, 0, 1, 1, 0]), [1e6, 0, 1, 1, 0]);
});

// ── La landing de AFUERA, aislada ────────────────────────────────────────────

const HTML_AFUERA = [
  '<!doctype html><html lang="es"><head><meta charset="utf-8">',
  '<base href="/viejo/"><meta http-equiv="Content-Security-Policy" content="default-src none"><meta http-equiv="refresh" content="0;url=/otra">',
  '<link rel="canonical" href="https://su-landing.com/oferta">',
  '<script src="https://hola-mako.com/m.js?id=mko_0123456789abcdef0123456789abcdef" defer></script>',
  '<script>fetch("https://hola-mako.com/api/track/vsl",{method:"POST"})</script>',
  '<script>!function(f){f.fbq=function(){}}(window);fbq("init","123")</script>',
  '<script src="/app.js"></script>',
  '</head><body><h1>Precio: $& y $1</h1></body></html>',
].join('');

test('el documento de afuera: sin Pixel de MaKo ni rastreadores, sin su <base> ni su política, con NUESTRA base y el script ADELANTE', () => {
  const doc = documentoDiagnostico(HTML_AFUERA, 'https://su-landing.com/oferta?utm=1');
  assert.equal(/mko_0123|\/api\/track\//.test(doc), false, 'el Pixel de MaKo no viaja (abrir el diagnóstico no es una visita)');
  assert.equal(/fbq\(/.test(doc), false);
  assert.equal(/http-equiv/i.test(doc), false);
  assert.equal((doc.match(/<base\b/gi) ?? []).length, 1);
  assert.match(doc, /<base href="https:\/\/su-landing\.com\/viejo\/">/, 'la base de la página (resuelta), no la de MaKo');
  assert.match(doc, /<script src="\/app\.js"><\/script>/, 'los scripts de la página siguen (una página armada en el navegador)');
  const iHead = doc.indexOf('<head');
  const iNuestro = doc.indexOf('window.__gmDg');
  const iSuyo = doc.indexOf('/app.js');
  assert.ok(iHead < iNuestro && iNuestro < iSuyo, 'nuestro script va antes que los suyos');
  assert.match(doc, /Precio: \$& y \$1/, 'un $& del HTML no se expande');
});

test('un HTML sin <head> ni <html> igual queda armado', () => {
  assert.match(documentoDiagnostico('<p>Hola</p>', 'https://a.com'), /^<!doctype html><html><head><meta charset="utf-8"><base href="https:\/\/a\.com\/?">/);
  assert.match(documentoDiagnostico('<html><body>x</body></html>', 'https://a.com'), /^<html><head><meta charset/);
});

test('el documento de error avisa al padre y no deja escapar un </script>', () => {
  const d = documentoErrorDiagnostico('La página respondió 403 </script><script>alert(1)</script>');
  assert.equal((d.match(/<\/script>/g) ?? []).length, 1);
  assert.match(d, /tipo:'error'/);
});

const pedido = (dest: string | null, metodo = 'GET') =>
  new Request('https://hola-mako.com/x', { method: metodo, headers: dest ? { 'sec-fetch-dest': dest } : {} });

test('la ruta sólo sirve a un IFRAME, con la política sandbox, sin caché y sin mandar la página como referer', async () => {
  let bajadas = 0;
  const bajar = async () => { bajadas++; return HTML_AFUERA; };
  assert.equal((await responderPaginaDiagnostico(pedido('document'), 'https://su-landing.com', { bajar })).status, 403);
  assert.equal((await responderPaginaDiagnostico(pedido(null), 'https://su-landing.com', { bajar })).status, 403);
  assert.equal(bajadas, 0, 'un pedido que no es de un iframe no baja nada');
  assert.equal((await responderPaginaDiagnostico(pedido('iframe'), 'no es una url', { bajar })).status, 404);
  const r = await responderPaginaDiagnostico(pedido('iframe'), 'https://su-landing.com', { bajar });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy') ?? '', /^sandbox allow-scripts/);
  assert.doesNotMatch(r.headers.get('content-security-policy') ?? '', /allow-same-origin/);
  // Verificación de la tanda 7: la página de un tercero, en el origen de la app, no abre ventanas ni manda formularios
  // (antes usaba la política del bloque y heredó su `allow-popups-to-escape-sandbox`). PROBADO ROMPIÉNDOLO
  // (15/10/2026): CABECERAS_PAGINA_DIAGNOSTICO con CSP_HTML_LIBRE → éste y el de la ventana del lector en rojo (106 / 2
  // con htmllibre, lector y origen; ver tests/editor-landing-htmllibre.test.ts).
  assert.doesNotMatch(r.headers.get('content-security-policy') ?? '', /allow-popups|allow-forms/);
  assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.match(await r.text(), /window\.__gmDg/);
});

test('si la página no se puede bajar, la ruta contesta el documento de error (el panel lo muestra)', async () => {
  const r = await responderPaginaDiagnostico(pedido('iframe'), 'https://su-landing.com', { bajar: async () => { throw new Error('La página respondió 404.'); } });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /La página respondió 404\./);
  assert.equal(srcPaginaDiagnostico('https://a.com/x?y=1'), '/api/landing-generator/diagnostico/pagina?url=https%3A%2F%2Fa.com%2Fx%3Fy%3D1');
});

// ── La tabla y las puertas ───────────────────────────────────────────────────

test('la migración: la lista de estados es la del código, RLS + revoke, y el índice único es el del upsert', () => {
  const sql = sinComentariosSql(leer('supabase/migrations/0264_landing_sugerencias.sql'));
  const cabecera = leer('supabase/migrations/0264_landing_sugerencias.sql').slice(0, 600);
  assert.match(cabecera, /ANTES o JUNTO con el deploy/);
  const m = /estado\s+text not null default 'pendiente' check \(estado in \(([^)]*)\)\)/.exec(sql);
  assert.ok(m, 'falta el CHECK del estado');
  assert.deepEqual(m[1].split(',').map((x) => x.trim().replace(/'/g, '')), [...ESTADOS_SUGERENCIA]);
  assert.match(sql, /alter table landing_sugerencias enable row level security;/);
  assert.match(sql, /revoke all on landing_sugerencias from anon, authenticated;/);
  assert.match(sql, /create unique index if not exists uq_landing_sugerencias_clave on landing_sugerencias \(workspace_id, clave\);/);
  assert.match(sql, /check \(\(doc_id is null\) <> \(url is null\)\)/);
  const server = sinComentarios(leer('lib/editor-landing/diagnostico-server.ts'));
  assert.match(server, /onConflict: 'workspace_id,clave', ignoreDuplicates: true/);
});

test('la tabla está en TENANT_TABLES (getTenantDb la acota) y en TABLAS_DE_INQUILINO (el reset la vacía)', () => {
  const ws = sinComentarios(leer('lib/workspace.ts'));
  const ini = ws.indexOf('const TENANT_TABLES = new Set<string>([');
  const bloque = ws.slice(ini, ws.indexOf(']);', ini));
  assert.ok(ini >= 0 && bloque.length > 200);
  assert.match(bloque, /'landing_sugerencias'/);
  const ti = sinComentarios(leer('lib/tablas-de-inquilino.ts'));
  const i2 = ti.indexOf('export const TABLAS_DE_INQUILINO = [');
  assert.match(ti.slice(i2, ti.indexOf(']', i2)), /'landing_sugerencias'/);
});

test('las dos rutas tienen la puerta de /api/landing-generator (admin + la tab en su capa)', () => {
  for (const ruta of ['app/api/landing-generator/diagnostico/route.ts', 'app/api/landing-generator/diagnostico/pagina/route.ts']) {
    const src = sinComentarios(leer(ruta));
    assert.match(src, /if \(rol !== 'admin'\)/, ruta);
    assert.match(src, /tabEnCapa\('landing-writer'/, ruta);
  }
});

test('el análisis de una landing NUESTRA no escribe en landing_analyses (esa tabla es de páginas por URL)', () => {
  const src = sinComentarios(leer('lib/editor-landing/diagnostico-server.ts'));
  const nuestra = src.slice(src.indexOf('async function analizarNuestra'), src.indexOf('async function analizarDeAfuera'));
  assert.ok(nuestra.length > 400);
  assert.match(nuestra, /analizarCopy\(/);
  assert.doesNotMatch(nuestra, /analizarLanding\(|landing_analyses/);
});

test('la vista de afuera: iframe con sandbox SÓLO allow-scripts, y sólo escucha a SU iframe', () => {
  const src = sinComentarios(leer('app/web-generator/diagnostico/VistaAfuera.tsx'));
  // EL DOCUMENTO AISLADO NUNCA LLEVA allow-same-origin: ese HTML lo sirve una ruta NUESTRA, asi que
  // con ese permiso correria con el origen de hola-mako.com. Desde el 15/10/2026 el recuadro se cae a
  // la pagina REAL cuando el aislado no pinta nada (una landing de constructor), y ahi el origen es de
  // ELLA, no nuestro: el permiso es el de cualquier embed. Lo que se fija es que los dos vayan atados.
  assert.match(src, /sandbox=\{directo \? .allow-scripts allow-same-origin. : .allow-scripts.\}/,
    ("el sandbox depende del estado directo: con el documento aislado, SOLO allow-scripts"));
  assert.match(src, /src=\{directo \? url : src\}/, "y el estado directo sirve la URL de AFUERA, no la nuestra");
  assert.doesNotMatch(src.replace(/directo \? .allow-scripts allow-same-origin. : .allow-scripts./, ""), /allow-same-origin/,
    ("allow-same-origin no puede aparecer en ningun otro lado"));
  assert.match(src, /ev\.source !== iframeRef\.current\.contentWindow/);
  assert.match(src, /conWs\(srcPaginaDiagnostico\(url\), ws\)/, 'el ?ws= viaja en el src (el parche de fetch no toca un iframe)');
});

// LA VENTANA EN BLANCO (15/10/2026). Una landing armada en un constructor manda un HTML enorme con el
// contenido VACÍO: lo dibuja su propio JavaScript. Medido con la de un cliente: 132.704 caracteres de
// HTML y NUEVE de texto visible. Adentro del iframe aislado eso queda en blanco y, como el HTTP fue 200,
// el server no tiene forma de saberlo: el único que puede contarlo es este script, que vive adentro.
// PROBADO ROMPIÉNDOLO: sin el contador en el «listo», 1 fallo; con una sola medición, 1 fallo.
test('el documento cuenta cuánto texto llegó a pintarse, y lo vuelve a contar', () => {
  const doc = documentoDiagnostico('<html><body><div id="app"></div></body></html>', 'https://x.test/');
  assert.match(doc, /function cuantoTextoPinto\(\)/, 'el documento tiene que medir su texto visible');
  assert.match(doc, /tipo: 'listo', texto:/, 'el «listo» lleva el texto medido');
  assert.match(doc, /tipo: 'pinto', texto:/, 'y se vuelve a medir cuando la página pinta');
  // MÁS DE UNA VEZ: lo que pinta el JavaScript de la página tarda, y una sola medición al arrancar
  // diría «vacía» sobre cualquier página que tarde en dibujarse.
  const conteos = (doc.match(/setTimeout\(contarTexto/g) || []).length;
  assert.ok(conteos >= 2, 'el re-conteo tiene que correr más de una vez (hay ' + conteos + ')');
  assert.match(doc, /addEventListener\('load', contarTexto\)/, 'y también al load');
});

// =============================================================================
// ROTURAS (11/10/2026). Cada una se hizo sobre el archivo que se nombra, se corrió este archivo y se
// restauró reemplazando SÓLO lo roto (verificado byte a byte). La base estaba en verde: 29 pass, 0 fail.
// Las 24 dieron rojo:
//   diagnostico.ts · TS: las comillas tipográficas ya no se unifican ............ 4 rojos / 25 verdes
//   diagnostico.ts · JS del iframe: ídem, sólo en la copia JS (el diferencial) ... 1 / 28
//   diagnostico.ts · TS: sin probar los pedazos del «…» ......................... 2 / 27
//   diagnostico.ts · TS: sin probar el principio y el final de una cita larga .... 2 / 27
//   diagnostico.ts · TS: offsets por carácter y no por UTF-16 ................... 2 / 27
//   diagnostico.ts · el formulario no aporta su texto ........................... 1 / 28
//   diagnostico.ts · las secciones ocultas entran al análisis ................... 2 / 27
//   diagnostico.ts · se diagnostica la primera página y no la de inicio ......... 3 / 26
//   diagnostico.ts · un hallazgo sin cita pasa .................................. 1 / 28
//   diagnostico.ts · la clave sin normalizar .................................... 1 / 28
//   diagnostico.ts · la url sin la normalización de landing_analyses ............ 1 / 28
//   diagnostico.ts · el Pixel de MaKo viaja en la vista ......................... 1 / 28
//   diagnostico.ts · nuestro script afuera del <head> ........................... 1 / 28
//   diagnostico.ts · la ruta sirve a una pestaña (sin Sec-Fetch-Dest) ........... 1 / 28
//   diagnostico.ts · la vista con caché compartido .............................. 1 / 28
//   diagnostico.ts · lo no ubicado va primero en el recorrido ................... 1 / 28
//   diagnostico.ts · el score sin acotar ........................................ 1 / 28
//   diagnostico.ts · una caja del iframe con tamaño negativo pasa ............... 1 / 28
//   diagnostico.ts · el script del iframe le contesta a cualquiera .............. 1 / 28
//   0264_landing_sugerencias.sql · el CHECK y el código con listas distintas .... 1 / 28
//   workspace.ts · la tabla afuera de TENANT_TABLES ............................. 1 / 28
//   diagnostico/pagina/route.ts · la ruta de la vista sin el rol admin .......... 1 / 28
//   VistaAfuera.tsx · el iframe con allow-same-origin ........................... 1 / 28
//   diagnostico-server.ts · nuestra landing por el camino que escribe landing_analyses 1 / 28
// =============================================================================
