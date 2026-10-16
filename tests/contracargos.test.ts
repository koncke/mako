// =============================================================================
// Los contracargos (15/10/2026): se cuentan siempre, y la plata se mueve sólo cuando la pasarela dice que se movió
// =============================================================================
// Hasta este día un contracargo de Mercado Pago quedaba en una fila de `pasarela_eventos` que nadie miraba, y Stripe ni
// lo escuchaba. Lo decidido (docs/hallazgos-planes-y-cobro.md, «Cuatro decisiones…», y lo que se encontró al hacerlo):
//   1. Stripe: se escuchan los cuatro eventos de disputa (nombres verificados en docs.stripe.com/api/events/types: uno
//      inexistente haría fallar CONECTAR); la plata sale del objeto RELEÍDO (sus balance_transactions: un retiro es
//      negativo, un reintegro positivo), no del tipo del evento, porque los avisos pueden llegar desordenados;
//   2. con la plata afuera la cuota se desmarca como un reembolso; si vuelve, se vuelve a marcar. Una disputa PARCIAL
//      no mueve la cuota (no se parte), y un cargo ya devuelto entero tampoco;
//   3. Mercado Pago: se CUENTA sin mover la cuota — su documentación dice en una página que `settled` es en contra del
//      vendedor y en otra que es la plata devuelta al comprador;
//   4. los contracargos llegan sin que MaKo haga nada: el cron pone al día los eventos del aviso una vez por día.
// Lo puro y el cliente HTTP se EJECUTAN; el cableado se lee del FUENTE (módulos `server-only`).
//
// PROBADO ROMPIÉNDOLO (15/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 8 pases, 0 fallos. Rota (pases / fallos):
//   · sin `charge.dispute.funds_withdrawn` en EVENTOS_STRIPE                                   → 7 / 1
//   · leerDisputaStripe con `retirada` mirando cualquier movimiento (no sólo los negativos)       → 7 / 1
//   · el webhook moviendo la cuota en una disputa parcial (sin `!total`)                        → 7 / 1
//   · el webhook con `plataAfuera: d.retirada` (sin mirar si volvió)                             → 7 / 1
//   · el contracargo de MP moviendo la cuota (`plataAfuera: true`)                               → 7 / 1
//   · aplicarContracargo sin el historial                                                       → 7 / 1
//   · el cron sin la puesta al día diaria                                                       → 7 / 1
//   · esLaVueltaDelDia aceptando cualquier minuto de las 6 (dos vueltas por día)                 → 7 / 1
// Correr: node --import tsx --test tests/contracargos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoStripe, eventoStripe, faseDeDisputa } from '../lib/cobros-eventos';
import { esLaVueltaDelDia, textoContracargo } from '../lib/cobros-reglas';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;
const stripeApi = () => import('../lib/stripe-api');

let contestar: (u: URL) => Response = () => new Response('{}', { status: 500 });
globalThis.fetch = (async (entrada: RequestInfo | URL) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  return contestar(u);
}) as typeof fetch;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const RAIZ = join(__dirname, '..');
/** Sin comentarios y con LF (AGENTS.md: las líneas PRIMERO y los bloques después). */
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
function cuerpo(src: string, nombre: string): string {
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const /);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

const DISPUTAS = ['charge.dispute.created', 'charge.dispute.funds_withdrawn', 'charge.dispute.funds_reinstated', 'charge.dispute.closed'];

test('Stripe: los cuatro eventos de disputa se escuchan, y cada uno dice qué releer y en qué fase va', async () => {
  const { EVENTOS_STRIPE } = await stripeApi();
  for (const e of DISPUTAS) assert.ok((EVENTOS_STRIPE as readonly string[]).includes(e), `${e} no se escucha`);
  const fases = DISPUTAS.map((tipo) => {
    const ev = eventoStripe({ id: 'evt_1NG8Du2eZvKYlo2CUI79vXWy', object: 'event', type: tipo, livemode: false,
      data: { object: { id: 'dp_1MmlLrLkdIwHu7ix0abcdEF', object: 'dispute', charge: 'ch_1', payment_intent: 'pi_3MtwBwLkdIwHu7ix28a3tqPa', status: 'needs_response' } } });
    assert.ok(ev);
    const a = avisoStripe(ev);
    if (a.accion !== 'disputa') return assert.fail(`${tipo}: el aviso dice «${a.accion}»`);
    assert.deepEqual(a.leer, { objeto: 'disputa', id: 'dp_1MmlLrLkdIwHu7ix0abcdEF' });
    assert.equal(a.buscar.pagoId, 'pi_3MtwBwLkdIwHu7ix28a3tqPa');
    return faseDeDisputa(tipo);
  });
  assert.deepEqual(fases, ['abierto', 'plata_salio', 'plata_volvio', 'cerrado']);
  assert.equal(faseDeDisputa('charge.dispute.updated'), null);
});

test('la disputa releída: la plata sale y vuelve por sus movimientos (retiro negativo, reintegro positivo)', async () => {
  const { leerDisputaStripe } = await stripeApi();
  const disputa = (movs: number[]) => json({ id: 'dp_1', status: 'needs_response', charge: 'ch_1', payment_intent: 'pi_1', reason: 'fraudulent', amount: 4900, currency: 'usd', balance_transactions: movs.map((amount) => ({ amount })) });
  const leer = async (movs: number[]) => { contestar = () => disputa(movs); const r = await leerDisputaStripe('sk_test_x', 'dp_1'); assert.ok(r.ok); return r; };
  const salio = await leer([-4900]);
  assert.deepEqual([salio.retirada, salio.reintegrada], [true, false]);
  assert.equal(salio.monto, 49, 'el monto en unidades, no en centavos');
  assert.equal(salio.motivo, 'fraudulent');
  const volvio = await leer([-4900, 4900]);
  assert.deepEqual([volvio.retirada, volvio.reintegrada], [true, true]);
  // El SIGNO es lo que dice la dirección: un movimiento positivo solo es plata que entra, no que sale.
  const reintegro = await leer([4900]);
  assert.deepEqual([reintegro.retirada, reintegro.reintegrada], [false, true]);
  const consulta = await leer([]);
  assert.deepEqual([consulta.retirada, consulta.reintegrada], [false, false], 'una consulta del banco (warning_*) no mueve plata');
});

test('el texto: cada fase dice qué pasó con la plata; el motivo del cliente en palabras si se conoce', () => {
  assert.equal(textoContracargo({ pasarela: 'stripe', fase: 'abierto', razon: 'product_not_received' }),
    'El cliente disputó este cargo con su banco (dice que no recibió lo que compró): Stripe abrió una disputa.');
  assert.equal(textoContracargo({ pasarela: 'stripe', fase: 'abierto', razon: 'general' }), 'El cliente disputó este cargo con su banco: Stripe abrió una disputa.');
  assert.match(textoContracargo({ pasarela: 'stripe', fase: 'plata_salio' }), /descontó la plata/);
  assert.match(textoContracargo({ pasarela: 'stripe', fase: 'plata_volvio' }), /vuelve a estar cobrado/);
  assert.match(textoContracargo({ pasarela: 'stripe', fase: 'cerrado', estado: 'won' }), /se ganó/);
  assert.match(textoContracargo({ pasarela: 'stripe', fase: 'cerrado', estado: 'lost' }), /se perdió/);
  assert.match(textoContracargo({ pasarela: 'mercadopago', fase: 'mp', estado: 'in_process' }), /en revisión/);
  const mp = textoContracargo({ pasarela: 'mercadopago', fase: 'mp', estado: 'settled' });
  assert.match(mp, /revisa en tu cuenta de Mercado Pago/);
  assert.doesNotMatch(mp, /ganó|perdió|devolvió|descontó/, 'de MP no se afirma qué pasó con la plata: su documentación se contradice');
});

test('el webhook: la plata de la disputa RELEÍDA, sin mover la cuota en una parcial ni en un cargo ya devuelto', () => {
  const w = fuente('lib/cobros-webhook.ts');
  const rama = w.slice(w.indexOf("if (objeto === 'disputa') {"), w.indexOf("if (objeto === 'reembolso') {"));
  assert.ok(rama.length > 100, 'no encontré la rama de la disputa');
  const orden = ['faseDeDisputa(ev.tipo)', 'leerDisputaStripe(key, id)', 'leerCargoStripe(key, d.cargo)', 'cobroDelPagoStripe(', 'aplicarContracargo('];
  let antes = -1;
  for (const paso of orden) {
    const i = rama.indexOf(paso);
    assert.ok(i > antes, `fuera de orden o falta: ${paso}`);
    antes = i;
  }
  assert.match(rama, /const total = d\.monto != null && cargo\.monto != null && d\.monto >= cargo\.monto - 0\.005;/);
  assert.match(rama, /const plataAfuera = !total \|\| cargo\.reembolsado \? null : d\.retirada && !d\.reintegrada;/);
});

test('Mercado Pago: el contracargo se cuenta y NO mueve la cuota', () => {
  const w = fuente('lib/cobros-webhook.ts');
  const rama = w.slice(w.indexOf("if (plan.accion === 'contracargo') {"));
  assert.ok(w.includes("if (plan.accion === 'contracargo') {"), 'el contracargo de MP no se aplica');
  assert.match(rama.slice(0, 600), /fase: 'mp'[\s\S]*plataAfuera: null,/);
});

test('aplicarContracargo: la cuota sólo con lo que dice la pasarela, y SIEMPRE el historial y el motivo', () => {
  const f = cuerpo(fuente('lib/cobros.ts'), 'aplicarContracargo');
  assert.match(f, /if \(c\.lead_id && pagoId && p\.plataAfuera != null\) \{/, 'con `null` no se toca la cuota');
  assert.match(f, /if \(p\.plataAfuera\) await desmarcarCobroDeProveedor\(/);
  assert.match(f, /await remarcarCobroDeProveedor\(/);
  assert.match(f, /await actualizar\(c\.workspace_id, c\.id, \{ motivo: p\.texto \}\);/);
  assert.match(f, /logLeadEvent\(c\.lead_id, 'Contracargo', p\.texto/, 'un contracargo que no se ve en la ficha es lo que había');
});

test('el cron pone al día los avisos de Stripe UNA vez por día (los contracargos llegan sin que MaKo haga nada)', () => {
  const r = fuente('app/api/cron/cobros-reconciliar/route.ts');
  assert.match(r, /const delDia = esLaVueltaDelDia\(t0\);/);
  assert.match(r, /if \(delDia\) await runWithWorkspace\(ws, \(\) => mantenerAvisosStripe\(ws\)\)\.catch\(/, 'sin el catch, una cuenta caída corta la corrida');
  assert.match(cuerpo(fuente('lib/cobros.ts'), 'mantenerAvisosStripe'), /await asegurarEventosDelAviso\(ws, stripe\.key\)/);
});

test('esLaVueltaDelDia: sólo la vuelta de las 06:17 UTC (el cron corre a los :17 y :47)', () => {
  assert.equal(esLaVueltaDelDia(Date.UTC(2026, 9, 15, 6, 17)), true);
  assert.equal(esLaVueltaDelDia(Date.UTC(2026, 9, 15, 6, 47)), false, 'dos vueltas por día');
  assert.equal(esLaVueltaDelDia(Date.UTC(2026, 9, 15, 5, 17)), false);
  assert.equal(esLaVueltaDelDia(Date.UTC(2026, 9, 15, 18, 17)), false);
});
