// =============================================================================
// Los webhooks de Stripe y de Mercado Pago: el ORDEN de lo que hacen, leído del fuente
// =============================================================================
// Una ruta no se puede ejecutar acá (importa server-only y habla con la base), así que lo que se fija
// es su forma, como tests/webhooks-ruteo-estricto.test.ts y tests/canal-social.test.ts. Cada
// pregunta es una regla de docs/diseno-pasarela-pagos.md §4.5 y de AGENTS.md («Una integracion son
// TRES registros»: 5xx sólo a lo transitorio, lectura estricta):
//   · el cuerpo CRUDO (`req.text()`) antes de cualquier parseo: la firma es sobre esos bytes;
//   · el ruteo ESTRICTO, y su fallo por `responderFalloDeRuteo`;
//   · el secreto con `credWsEstricta` y del workspace RUTEADO;
//   · la firma ANTES de contestar «sin workspace» (si no, se enumera la cartera);
//   · la deduplicación ANTES de aplicar;
//   · todo lo que toca el CRM adentro de `runWithWorkspace`, también en `after()`;
//   · 5xx SÓLO con `esErrorTransitorio`.
//
// Probado rompiéndolo (11/10/2026), una rotura por vez y restaurando de memoria (los números al pie).
//
// Correr: node --import tsx --test tests/cobros-webhook-rutas.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (ver AGENTS.md).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const STRIPE = sinComentarios(leer('../app/api/webhooks/stripe/route.ts'));
const MP = sinComentarios(leer('../app/api/webhooks/mercadopago/route.ts'));
const EVENTOS = sinComentarios(leer('../lib/pasarela-eventos.ts'));
const WEBHOOK = sinComentarios(leer('../lib/cobros-webhook.ts'));

/** El cuerpo de POST (lo que corre en cada aviso). */
const post = (src: string) => src.slice(src.indexOf('export async function POST('));

/** `a` aparece y va antes que `b` (las dos tienen que estar). */
function antes(src: string, a: string | RegExp, b: string | RegExp, msg: string) {
  const ia = typeof a === 'string' ? src.indexOf(a) : src.search(a);
  const ib = typeof b === 'string' ? src.indexOf(b) : src.search(b);
  assert.ok(ia >= 0, `no encontré ${a}`);
  assert.ok(ib >= 0, `no encontré ${b}`);
  assert.ok(ia < ib, msg);
}

for (const [nombre, src] of [['stripe', STRIPE], ['mercadopago', MP]] as const) {
  test(`${nombre}: el cuerpo CRUDO primero, y nunca req.json()`, () => {
    const p = post(src);
    assert.match(p, /^export async function POST\(req: NextRequest\) \{\s*\n\s*const raw = await req\.text\(\);/m, 'lo primero del POST tiene que ser leer el cuerpo crudo');
    assert.ok(!/\breq(?:uest)?\.json\(/.test(src), 'req.json() consume el stream: no queda el texto exacto para la firma');
    antes(p, 'await req.text()', 'JSON.parse(', 'se parsea antes de tener el crudo');
  });

  test(`${nombre}: el ruteo y el secreto son ESTRICTOS y su fallo va por el clasificador`, () => {
    assert.ok(!/\bwsPorIdentificador\(/.test(src), 'la lectura tolerante: con la base caída, «no pude leer» se contesta como «no es de nadie»');
    assert.ok(!/\bcredWs\(|\benvCred\(|\bprocess\.env\b|\bcredDelCliente\(/.test(src), 'una credencial de pasarela leída con la tolerante o del entorno (cae al ws1)');
    assert.match(src, new RegExp(`wsPorIdentificadorEstricto\\('${nombre}', `));
    assert.equal((src.match(new RegExp(`responderFalloDeRuteo\\('${nombre}', err, `, 'g')) ?? []).length, 1, 'el fallo del ruteo y del secreto va por responderFalloDeRuteo');
    const bloque = src.slice(src.indexOf('try {', src.indexOf('let secreto')), src.indexOf(`responderFalloDeRuteo('${nombre}'`));
    assert.match(bloque, /wsPorIdentificadorEstricto\(/, 'el ruteo tiene que estar en el try del clasificador');
    assert.match(bloque, /credWsEstricta\('(?:STRIPE|MERCADOPAGO)_WEBHOOK_SECRET', ws\)/, 'el secreto tiene que leerse estricto y del ws ruteado, en el mismo try');
  });

  test(`${nombre}: UNA sola declaración de ws, cortada si es null antes de procesar`, () => {
    assert.equal([...src.matchAll(/\b(?:const|let|var)\s+ws\b/g)].length, 1, 'dos `ws`: el que llega al CRM puede no ser el del ruteo');
    antes(post(src), 'if (ws == null) {', 'reclamarEvento(', 'se reclama el evento sin haber cortado «sin workspace»');
  });

  test(`${nombre}: todo lo que toca el CRM corre en runWithWorkspace, también lo que sigue en after()`, () => {
    const p = post(src);
    const proceso = nombre === 'stripe' ? 'procesarEventoStripe' : 'aplicarNotificacionMp';
    assert.match(p, new RegExp(`runWithWorkspace\\(wsFinal, \\(\\) => ${proceso}\\(wsFinal, `), `${proceso} fuera de su workspace: getTenantDb y logLeadEvent caen al ws1`);
    assert.match(p, /after\(\(\) => runWithWorkspace\(wsFinal, \(\) => cerrarAlTerminar\(/, 'after() corre FUERA del contexto del pedido: el workspace se fija otra vez adentro');
  });

  test(`${nombre}: 5xx SÓLO a lo transitorio`, () => {
    const cincos = [...src.matchAll(/status:\s*5\d\d/g)];
    assert.equal(cincos.length, 1, 'un 5xx fuera del clasificador: el proveedor reintenta algo que va a fallar igual');
    const fn = src.slice(src.indexOf('function responderFallo('), src.indexOf('export async function GET('));
    assert.match(fn, /if \(esErrorTransitorio\(e\)\) \{[\s\S]*?status: 503[\s\S]*?\}\s*\n[\s\S]*?return Response\.json\(\{ ok: false, error: donde, reintentar: false/, 'el 503 tiene que estar adentro del if del clasificador, y lo demás 200');
    // Y los fallos de proceso pasan por ahí, con la fila marcada en error.
    assert.match(post(src), /catch \(e\) \{\s*await marcarEvento\('(?:stripe|mercadopago)', [^,]+, \{ estado: 'error', motivo: mensajeDeError\(e\) \}\);\s*return responderFallo\('proceso', e\);/,
      'un fallo de proceso tiene que dejar la fila en error (así el reintento la reclama) y pasar por el clasificador');
  });
}

test('stripe: el ?acct= con tope, la firma con el secreto de ESE negocio ANTES de «sin workspace», dedup ANTES de aplicar', () => {
  const p = post(STRIPE);
  assert.match(p, /const acct = acctDelWebhook\(req\.nextUrl\.searchParams\.get\('acct'\)\);/, 'el ?acct= se lee antes de la firma: sin tope, un id de 20 KB es una consulta por pedido');
  assert.match(p, /verificarFirmaStripe\(raw, req\.headers\.get\('stripe-signature'\), secreto\)/);
  antes(p, 'verificarFirmaStripe(', 'if (ws == null) {', 'cortar por «sin workspace» antes de la firma deja enumerar la cartera (200 = no, 401 = sí)');
  antes(p, /status: 401/, 'if (ws == null) {', 'la firma inválida tiene que contestarse antes que «sin workspace»');
  antes(p, 'reclamarEvento(', 'procesarEventoStripe(', 'se aplica antes de reclamar el evento: un reintento de Stripe aplicaría dos veces');
  assert.match(p, /reclamarEvento\(\{ proveedor: 'stripe', eventoId: ev\.id, /, 'la dedup de Stripe es por event.id');
});

test('mercadopago: firma si hay secreto y viene x-signature (sólo el formato nuevo), relectura → dedup → aplicar', () => {
  const p = post(MP);
  assert.match(p, /if \(secreto && firma && n\.formato === 'webhook'\) \{/, 'un IPN no se puede validar (lo dice MP): pedirle firma lo rechazaría para siempre');
  assert.match(p, /verificarFirmaMercadoPago\(\{ dataId: q\.get\('data\.id'\), requestId: req\.headers\.get\('x-request-id'\), header: firma \}, secreto\)/, 'el data.id del manifiesto sale del QUERY');
  const firma = p.slice(p.indexOf("if (secreto && firma && n.formato === 'webhook') {"), p.indexOf('if (ws == null) {'));
  assert.match(firma, /status: 401/, 'una firma inválida es 401');
  antes(p, 'verificarFirmaMercadoPago(', 'if (ws == null) {', 'la firma va antes de «sin workspace»');
  antes(p, 'releerNotificacionMp(', 'reclamarEvento(', 'la clave de MP lleva el estado resultante: sale de releer');
  antes(p, 'reclamarEvento(', 'aplicarNotificacionMp(', 'se aplica antes de reclamar: un reintento de MP aplicaría dos veces');
  assert.match(p, /eventoId: lectura\.clave/, 'la dedup de MP es <tipo>:<id>:<estado resultante>');
});

test('la relectura de MP exige que el pago lo haya COBRADO la cuenta del negocio', () => {
  // Con su token también se leen los pagos donde esa cuenta PAGÓ: sin esto, una compra del dueño
  // en otro comercio podría marcar pagado un cobro.
  assert.match(WEBHOOK, /if \(p\.cobradorId !== cuenta\) return lecturaIgnorada\(/);
  assert.match(WEBHOOK, /if \(s\.cobradorId !== cuenta\) return lecturaIgnorada\(/);
  assert.match(WEBHOOK, /credPasarela\('MERCADOPAGO_USER_ID', ws\)/);
});

test('el cobro se busca SIEMPRE en el workspace ruteado, y la clave se lee sin el entorno', () => {
  const llamadas = [...WEBHOOK.matchAll(/cobroDelAviso\(([^,]+),/g)].map((m) => m[1].trim());
  assert.ok(llamadas.length >= 2, 'no encontré las búsquedas del cobro');
  assert.deepEqual([...new Set(llamadas)], ['ws'], 'un cobro buscado con otro ws que el ruteado');
  // credPasarela: la estricta para que «no pude leer» TIRE, y la del cliente para el valor.
  const fn = WEBHOOK.slice(WEBHOOK.indexOf('async function credPasarela('), WEBHOOK.indexOf('function errorDelProveedor('));
  assert.match(fn, /await credWsEstricta\(clave, ws\);\s*\n\s*return credDelCliente\(clave, ws\);/);
  assert.ok(!/\bcredWs\(|\benvCred\(|\bprocess\.env\b/.test(WEBHOOK));
});

test('pasarela_eventos: reclama un error y un procesando VIEJO con compare-and-set, y tolera la tabla que falta', () => {
  const fn = EVENTOS.slice(EVENTOS.indexOf('export async function reclamarEvento('), EVENTOS.indexOf('export type EstadoFinal'));
  assert.match(fn, /if \(esTablaQueFalta\(error\.code\)\) return 'sin_tabla';/);
  assert.match(fn, /if \(error\.code !== '23505'\) return \{ error:/, 'un error que no es «ya existe» se devuelve para clasificarlo');
  assert.match(fn, /\.or\(`estado\.eq\.error,and\(estado\.eq\.procesando,updated_at\.lt\.\$\{hace\}\)`\)/,
    'sin el procesando viejo, una corrida que murió deja el evento como duplicado para siempre');
  assert.match(fn, /estado: 'procesando'/);
  assert.match(EVENTOS, /motivo: r\.motivo \? motivoSinDatos\(r\.motivo\)/, 'el motivo se guarda sin datos personales');
});

// ── Las roturas (11/10/2026) ───────────────────────────────────────────────────
// Una por vez, restaurando de memoria (un script que guarda el texto y lo vuelve a escribir, nunca
// git). Sin romper: 15 pasan / 0 fallan. Cada una de estas → 14 / 1, y falla la pregunta que nombra:
//   stripe: `req.json()` en vez del crudo · «sin workspace» antes de la firma · aplicar antes de
//     reclamar · el proceso fuera de runWithWorkspace · `after()` sin runWithWorkspace · 503 para
//     todo (`if (true)`) · `bad_json` con 500 · una segunda declaración de `ws`.
//   mercadopago: pedirle firma también al IPN · reclamar antes de releer.
//   lib/cobros-webhook.ts: sin el chequeo de `collector_id` · un cobro buscado con otro ws · la clave
//     leída sólo con `credDelCliente` (sin la estricta).
//   lib/pasarela-eventos.ts: el reclamo sólo de `error` (sin el `procesando` viejo).
