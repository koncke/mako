// =============================================================================
// Una devolución de Stripe que FALLA después (15/10/2026): se escucha, se revierte, y se puede reintentar
// =============================================================================
// Una devolución de Stripe se crea `pending` o `succeeded` y días después puede pasar a `failed` (tarjeta denunciada o
// dada de baja, una disputa): Stripe devuelve la plata al saldo del negocio y el cargo vuelve a estar cobrado. MaKo la
// daba por hecha para siempre: el cobro «Reembolsado», la cuota desmarcada, y nadie se enteraba. Lo que se fija:
//   1. el webhook escucha `refund.failed` (existe desde 2024-10-28.acacia; un nombre que Stripe no conoce haría fallar la
//      CREACIÓN del aviso, o sea, conectar Stripe), y el aviso trae lo que hay que releer;
//   2. los avisos YA registrados se ponen al día (`asegurarEventosStripe`): cambiar EVENTOS_STRIPE no les llega solo;
//   3. la devolución releída tiene que haber FALLADO, y el CARGO releído dice si sigue devuelto por otra (entonces no se
//      revierte nada); si no, el cobro vuelve a `pagado` (compare-and-set) y la cuota se vuelve a marcar;
//   4. pedir una devolución que Stripe contesta ya fallida no se da por hecha, y reintentar después de una fallida usa
//      OTRA clave de idempotencia (la misma, dentro de las 24 h, devolvería la respuesta vieja sin crear otra).
// Lo puro y el cliente HTTP se EJECUTAN (stripe-api con `fetch` de mentira y el parche de `server-only` de
// tests/stripe-api.test.ts); el cableado de lib/cobros.ts, lib/cobros-webhook.ts y lib/pagos.ts se lee del FUENTE.
//
// PROBADO ROMPIÉNDOLO (15/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 7 pases, 0 fallos. Rota (pases / fallos):
//   · sin `refund.failed` en EVENTOS_STRIPE (cae también la puesta al día)                       → 5 / 2
//   · asegurarEventosStripe actualizando también el aviso que ya escucha todo (`*`)             → 6 / 1
//   · confirmarDevolucionFallida aceptando una `succeeded`                                      → 6 / 1
//   · aplicarReembolsoFallido revirtiendo aunque el cargo siga devuelto (sin `!p.sigueDevuelto`)→ 6 / 1
//   · el webhook pasando `sigueDevuelto: false` fijo                                            → 6 / 1
//   · reembolsarCobro sin cortar una devolución creada ya `failed`                              → 6 / 1
//   · reembolsarCobro con la clave de siempre después de una fallida                            → 6 / 1
//   · remarcarCobroDeProveedor sin `asegurarLeadDelNegocio`                                     → 6 / 1
//   · textoDevolucionFallida inventando una razón que no conoce                                 → 6 / 1
// Correr: node --import tsx --test tests/devolucion-fallida.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoStripe, confirmarDevolucionFallida, eventoStripe } from '../lib/cobros-eventos';
import { esDevolucionFallida, idemReembolso, textoDevolucionFallida } from '../lib/cobros-reglas';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;
const stripeApi = () => import('../lib/stripe-api');

type Llamada = { url: URL; metodo: string; headers: Headers; cuerpo: string | null };
let llamadas: Llamada[] = [];
let contestar: (l: Llamada) => Response = () => json(500, {});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const l: Llamada = { url, metodo: (init.method ?? 'GET').toUpperCase(), headers: new Headers(init.headers), cuerpo: typeof init.body === 'string' ? init.body : null };
  llamadas.push(l);
  return contestar(l);
}) as typeof fetch;
const preparar = (f: (l: Llamada) => Response) => { llamadas = []; contestar = f; };
const que = (l: Llamada) => `${l.metodo} ${l.url.pathname}`;

const KEY = 'sk_test_51MaKoPruebaAbcdefghijklmn';
const URL_AVISO = 'https://mako.test/api/webhooks/stripe?acct=acct_A';

const RAIZ = join(__dirname, '..');
/** Sin comentarios y con LF (AGENTS.md: las líneas PRIMERO y los bloques después). */
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función, hasta la siguiente declaración de primer nivel. */
function cuerpo(src: string, nombre: string): string {
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const /);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

test('el aviso escucha refund.failed, y el evento dice qué releer (la devolución) y con qué buscar el cobro', async () => {
  const { EVENTOS_STRIPE } = await stripeApi();
  assert.ok((EVENTOS_STRIPE as readonly string[]).includes('refund.failed'), 'sin el evento, una devolución fallida no llega nunca');
  const ev = eventoStripe({
    id: 'evt_1NG8Du2eZvKYlo2CUI79vXWy', object: 'event', type: 'refund.failed', livemode: false,
    data: { object: { id: 're_3MmlLrLkdIwHu7ix0kSMQyF9', object: 'refund', status: 'failed', failure_reason: 'expired_or_canceled_card', charge: 'ch_3MmlLrLkdIwHu7ix0snN0B15', payment_intent: 'pi_3MtwBwLkdIwHu7ix28a3tqPa', metadata: { mako: '1' } } },
  });
  assert.ok(ev);
  const a = avisoStripe(ev);
  if (a.accion !== 'reembolso_fallido') return assert.fail(`el aviso dice «${a.accion}»`);
  assert.deepEqual(a.leer, { objeto: 'reembolso', id: 're_3MmlLrLkdIwHu7ix0kSMQyF9' });
  assert.equal(a.buscar.pagoId, 'pi_3MtwBwLkdIwHu7ix28a3tqPa');
  // La devolución releída: sólo una que FALLÓ (un aviso viejo de una que después salió no revierte nada).
  assert.deepEqual(confirmarDevolucionFallida({ estado: 'failed', cargo: 'ch_1' }), { ok: true, cargo: 'ch_1' });
  assert.equal(confirmarDevolucionFallida({ estado: 'canceled', cargo: 'ch_1' }).ok, true);
  for (const estado of ['succeeded', 'pending', 'requires_action', null]) {
    assert.equal(confirmarDevolucionFallida({ estado, cargo: 'ch_1' }).ok, false, String(estado));
  }
  assert.equal(confirmarDevolucionFallida({ estado: 'failed', cargo: null }).ok, false, 'sin el cargo no se sabe si sigue devuelto');
});

test('los avisos YA registrados se ponen al día: sólo el nuestro, sólo si le falta algo, y sin tocar el secreto', async () => {
  const { asegurarEventosStripe, EVENTOS_STRIPE } = await stripeApi();
  const viejos = EVENTOS_STRIPE.filter((e) => e !== 'refund.failed');
  preparar((l) => {
    if (l.metodo === 'GET') {
      return json(200, { data: [
        { id: 'we_viejo', url: URL_AVISO, enabled_events: viejos, metadata: { mako: '1' } },
        { id: 'we_al_dia', url: 'https://mako-viejo.test/api/webhooks/stripe?acct=acct_A', enabled_events: [...EVENTOS_STRIPE], metadata: { mako: '1' } },
        { id: 'we_todo', url: URL_AVISO, enabled_events: ['*'], metadata: { mako: '1' } },
        { id: 'we_ajeno', url: 'https://otro-sistema.test/hook', enabled_events: ['charge.refunded'] },
      ] });
    }
    return json(200, { id: l.url.pathname.split('/').pop() });
  });
  const r = await asegurarEventosStripe(KEY, URL_AVISO);
  assert.deepEqual(r, { ok: true, actualizados: 1 });
  const posts = llamadas.filter((l) => l.metodo === 'POST');
  assert.deepEqual(posts.map(que), ['POST /v1/webhook_endpoints/we_viejo'], 'se tocó uno al día, uno con «*», o uno ajeno');
  assert.deepEqual(new URLSearchParams(posts[0].cuerpo ?? '').getAll('enabled_events[]'), [...EVENTOS_STRIPE]);
  assert.equal(posts[0].headers.get('Idempotency-Key'), null, 'una clave reusada con OTRA lista, Stripe la rechaza');
  assert.ok(!/secret|url=/.test(posts[0].cuerpo ?? ''), 'actualizar no manda ni la url ni nada del secreto');
});

test('la devolución y el cargo releídos: el estado, por qué falló, y la fecha del cargo', async () => {
  const { leerReembolsoStripe, leerCargoStripe } = await stripeApi();
  preparar((l) => (l.url.pathname.startsWith('/v1/refunds/')
    ? json(200, { id: 're_1', status: 'failed', failure_reason: 'lost_or_stolen_card', charge: 'ch_1', payment_intent: 'pi_1' })
    : json(200, { id: 'ch_1', amount: 4900, amount_refunded: 0, refunded: false, currency: 'usd', payment_intent: 'pi_1', created: 1760486400 })));
  assert.deepEqual(await leerReembolsoStripe(KEY, 're_1'), { ok: true, id: 're_1', estado: 'failed', cargo: 'ch_1', paymentIntent: 'pi_1', motivo: 'lost_or_stolen_card' });
  const c = await leerCargoStripe(KEY, 'ch_1');
  assert.equal(c.ok && c.creado, '2025-10-15T00:00:00.000Z');
  assert.equal(c.ok && c.reembolsado, false);
});

test('el texto: la razón en palabras si se conoce (lo que no se conoce no se inventa), y si el cargo sigue devuelto, se dice', () => {
  assert.equal(textoDevolucionFallida({ razon: 'expired_or_canceled_card', sigueDevuelto: false }),
    'La devolución falló en Stripe (la tarjeta venció o se dio de baja): la plata sigue cobrada.');
  assert.equal(textoDevolucionFallida({ razon: 'algo_nuevo_de_stripe', sigueDevuelto: false }), 'La devolución falló en Stripe: la plata sigue cobrada.');
  assert.equal(textoDevolucionFallida({ razon: null, sigueDevuelto: true }), 'Una devolución falló en Stripe; el cargo sigue devuelto por otra.');
  for (const sigue of [true, false]) assert.ok(esDevolucionFallida(textoDevolucionFallida({ razon: 'declined', sigueDevuelto: sigue })));
  assert.equal(esDevolucionFallida('Anulado por Martín'), false);
  assert.equal(idemReembolso(7), 'mako-reembolso-7');
  assert.equal(idemReembolso(7, '1760486400000'), 'mako-reembolso-7-1760486400000');
});

test('el webhook: relee la devolución, confirma que falló, relee su CARGO y pasa si sigue devuelto', () => {
  const w = fuente('lib/cobros-webhook.ts');
  const rama = w.slice(w.indexOf("if (objeto === 'reembolso') {"), w.indexOf("const cargo = await leerCargoStripe(key, id);"));
  assert.ok(rama.length > 100, 'no encontré la rama de la devolución fallida');
  const orden = ['leerReembolsoStripe(key, id)', 'confirmarDevolucionFallida(dev)', 'leerCargoStripe(key, fallo.cargo)', 'cobroDelPagoStripe(', 'aplicarReembolsoFallido('];
  let antes = -1;
  for (const paso of orden) {
    const i = rama.indexOf(paso);
    assert.ok(i > antes, `fuera de orden o falta: ${paso}`);
    antes = i;
  }
  assert.match(rama, /aplicarReembolsoFallido\(b\.cobro, \{ proveedorPagoId: pagoId, sigueDevuelto: cargo\.reembolsado, razon: dev\.motivo, fechaCargo: cargo\.creado \}\)/);
});

test('revertir: sólo si el cargo ya no está devuelto; el cobro con compare-and-set y la cuota otra vez marcada', () => {
  const f = cuerpo(fuente('lib/cobros.ts'), 'aplicarReembolsoFallido');
  const si = f.indexOf('if (!p.sigueDevuelto) {');
  assert.ok(si > 0, 'revierte aunque el cargo siga devuelto por otra devolución');
  const dentro = f.slice(si, f.indexOf('if (c.lead_id) {', si + 30));
  assert.match(dentro, /actualizar\(c\.workspace_id, c\.id, \{ estado: 'pagado', reembolsado_at: null, motivo: texto \}, \{ estado: \['reembolsado'\] \}\)/);
  assert.match(dentro, /remarcarCobroDeProveedor\(\{ leadId: c\.lead_id, proveedor: c\.proveedor, proveedorPagoId: pagoId, fechaPago: fecha \}\)/);
  assert.match(f, /logLeadEvent\(c\.lead_id, 'Devolución fallida'/, 'que falló tiene que quedar dicho en el historial');
  // Y en lib/pagos.ts: la guarda del negocio ANTES de escribir, y una cuota ya pagada no se toca.
  const r = cuerpo(fuente('lib/pagos.ts'), 'remarcarCobroDeProveedor');
  assert.ok(r.indexOf('await asegurarLeadDelNegocio(p.leadId);') >= 0 && r.indexOf('await asegurarLeadDelNegocio(p.leadId);') < r.indexOf('.update('), 'sin la guarda del negocio antes de escribir');
  assert.match(r, /if \(!data \|\| data\.pagado\) return \{ remarcado: false \};/);
  assert.match(r, /await marcarPago\(Number\(data\.id\), true, p\.fechaPago\);/, 'por marcarPago: sincroniza lo cobrado');
});

test('pedir una devolución: el aviso al día ANTES, una ya fallida no se da por hecha, y el reintento lleva otra clave', () => {
  const f = cuerpo(fuente('lib/cobros.ts'), 'reembolsarCobro');
  assert.ok(f.indexOf('await asegurarEventosDelAviso(ws, stripe.key);') >= 0 && f.indexOf('await asegurarEventosDelAviso(ws, stripe.key);') < f.indexOf('reembolsarStripe('),
    'el aviso se pone al día DESPUÉS de pedirla: si falla rápido, no llega');
  const corte = f.indexOf("if (r.estado === 'failed' || r.estado === 'canceled') return { ok: false,");
  assert.ok(corte > 0 && corte < f.indexOf('await aplicarReembolso('), 'una devolución que Stripe contesta fallida se da por hecha');
  assert.match(f, /idemReembolso\(c\.id, esDevolucionFallida\(c\.motivo\) \? String\(Date\.parse\(c\.updated_at\)\) : null\)/,
    'después de una fallida, la misma clave devolvería la respuesta vieja sin crear otra devolución');
  // Y una que después SALE limpia el motivo de la que falló.
  assert.match(cuerpo(fuente('lib/cobros.ts'), 'aplicarReembolso'), /\.\.\.\(esDevolucionFallida\(c\.motivo\) \? \{ motivo: null \} : \{\}\)/);
});
