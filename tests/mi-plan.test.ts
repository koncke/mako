// =============================================================================
// «Tu plan»: el botón «Darme de baja» del plan de MaKo (15/10/2026)
// =============================================================================
// Lo decidió Estrategia el 15/10: un botón PROPIO en MaKo (no el portal de Stripe), que cubre Stripe y Mercado Pago, y
// cumple la Resolución 316/2018 de Argentina si aplica (el botón a la vista, sin trámites previos, y un código de baja).
// Se copia a los SaaS y a las pasarelas: Stripe (stripe.com/docs/subscriptions/canceling-pausing) y Paddle
// (developer.paddle.com/build/subscriptions/cancel-subscriptions) programan la baja al FINAL del período pagado. Lo que
// se fija:
//   1. Stripe: `cancel_at_period_end`, con su propia clave de idempotencia, y la fecha en que termina (se EJECUTA);
//   2. el código de baja y su texto (se EJECUTAN), sin que `motivoSinDatos` lo confunda con un teléfono;
//   3. el plan del negocio se lee por `alta_ws = ws` en la PLATAFORMA (un negocio da de baja el suyo y nunca el de otro);
//   4. pedirla dos veces devuelve el mismo código sin otra llamada; Mercado Pago (sin «al final») cancela en el acto;
//   5. la acción es sólo del admin de ESE workspace y manda el código por email;
//   6. la pantalla son DOS pasos (el botón y la confirmación); la sección está en «Configuración del negocio»; la API la
//      ofrece (lectura y acción de pantalla); /reembolsos y /terminos remiten al botón.
//
// PROBADO ROMPIÉNDOLO (15/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 7 pases, 0 fallos. Rota (pases / fallos):
//   · la baja de Stripe cancelando en el acto (DELETE) en vez de al final del período   → 6 / 1
//   · la baja de Stripe con la clave de `idemBaja` (la de cancelar en el acto)           → 6 / 1
//   · suscripcionDeMakoDe sin filtrar por `alta_ws` (el plan de otro negocio)            → 6 / 1
//   · darDeBajaMiPlan sin el corte de la baja ya pedida (pide otra a Stripe)             → 6 / 1
//   · la acción sin `adminDeWorkspaceActual`                                            → 6 / 1
//   · la pantalla sin la confirmación (un clic da de baja)                               → 6 / 1
//   · la acción de la API confirmada por chat y no en pantalla                           → 6 / 1
// Correr: node --import tsx --test tests/mi-plan.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seccionesNegocio } from '../lib/ajustes-secciones';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import { codigoDeBaja, esBajaPedida, textoBajaPedida } from '../lib/cobros-reglas';
import { motivoSinDatos } from '../lib/cobros-eventos';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;

type Llamada = { url: URL; metodo: string; headers: Headers; cuerpo: string | null };
let llamadas: Llamada[] = [];
let contestar: (l: Llamada) => Response = () => new Response('{}', { status: 500 });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const l: Llamada = { url, metodo: (init.method ?? 'GET').toUpperCase(), headers: new Headers(init.headers), cuerpo: typeof init.body === 'string' ? init.body : null };
  llamadas.push(l);
  return contestar(l);
}) as typeof fetch;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
function cuerpo(src: string, nombre: string): string {
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const |\nexport type /);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

test('Stripe: la baja va AL FINAL del período pagado, con su propia clave, y dice cuándo termina', async () => {
  const { programarBajaStripe } = await import('../lib/stripe-api');
  llamadas = [];
  contestar = () => json({ id: 'sub_1', cancel_at_period_end: true, cancel_at: 1763164800 });
  const r = await programarBajaStripe('sk_test_x', 'sub_1', 'mako-baja-7-al-fin');
  assert.deepEqual(r, { ok: true, finAt: '2025-11-15T00:00:00.000Z' });
  assert.equal(`${llamadas[0].metodo} ${llamadas[0].url.pathname}`, 'POST /v1/subscriptions/sub_1', 'un DELETE la cancela en el acto: quien pagó el mes lo pierde');
  assert.equal(new URLSearchParams(llamadas[0].cuerpo ?? '').get('cancel_at_period_end'), 'true');
  assert.equal(llamadas[0].headers.get('Idempotency-Key'), 'mako-baja-7-al-fin');
  // Sin `cancel_at`, el fin del período del ítem (desde basil vive ahí).
  contestar = () => json({ id: 'sub_1', items: { data: [{ current_period_end: 1763164800 }] } });
  assert.deepEqual(await programarBajaStripe('sk_test_x', 'sub_1', 'k'), { ok: true, finAt: '2025-11-15T00:00:00.000Z' });
  // Y la clave NO es la de cancelar en el acto (`idemBaja`): Stripe rechaza una clave repetida con otro pedido.
  assert.match(cuerpo(fuente('lib/cobros.ts'), 'darDeBajaMiPlan'), /programarBajaStripe\(stripe\.key, c\.proveedor_suscripcion_id, `\$\{idemBaja\(c\.id\)\}-al-fin`\)/);
});

test('el código de baja: uno por cobro, en un texto que se reconoce, y que motivoSinDatos no confunde con un teléfono', () => {
  assert.equal(codigoDeBaja(123), 'BAJA-123');
  const t = textoBajaPedida({ codigo: 'BAJA-123', pedida: '2026-10-15T20:00:00Z', finAt: '2026-11-14T00:00:00Z' });
  assert.equal(t, 'Baja pedida el 2026-10-15 (código BAJA-123). Deja de cobrarse el 2026-11-14.');
  assert.ok(esBajaPedida(t));
  assert.equal(esBajaPedida('Falló el cobro de la renovación: sin fondos'), false);
  assert.equal(motivoSinDatos(t), t, 'el motivo pasa por motivoSinDatos al guardarse: el código tiene que sobrevivir');
  assert.equal(textoBajaPedida({ codigo: 'BAJA-9', pedida: '2026-10-15T20:00:00Z', finAt: null }), 'Baja pedida el 2026-10-15 (código BAJA-9).');
});

test('el plan del negocio: el cobro de la PLATAFORMA cuya alta creó ESTE workspace', () => {
  const f = cuerpo(fuente('lib/cobros.ts'), 'suscripcionDeMakoDe');
  assert.match(f, /if \(ws === plataforma\) return null;/);
  assert.match(f, /\.eq\('workspace_id', plataforma\)\.eq\('alta_ws', ws\)\.eq\('tipo', 'suscripcion'\)\.eq\('estado', 'pagado'\)/,
    'sin `alta_ws = ws`, un negocio daría de baja el plan de otro');
});

test('darDeBajaMiPlan: dos veces = el mismo código; Stripe al final, Mercado Pago en el acto; el código queda en el cobro y en el historial', () => {
  const f = cuerpo(fuente('lib/cobros.ts'), 'darDeBajaMiPlan');
  const corte = f.indexOf('if (esBajaPedida(c.motivo)) return { ok: true, resumen: c.motivo');
  assert.ok(corte > 0 && corte < f.indexOf('programarBajaStripe('), 'una baja ya pedida pide otra a la pasarela');
  assert.match(f, /const r = await cancelarSuscripcionCobro\(c\.workspace_id, c\.id, autor\);/, 'Mercado Pago no tiene «al final»: se cancela en el acto, con el workspace del COBRO');
  assert.match(f, /await actualizar\(c\.workspace_id, c\.id, \{ motivo: texto \}\);/);
  assert.match(f, /logLeadEvent\(c\.lead_id!, 'Baja del plan'/);
});

test('la acción: sólo el admin de ESE workspace, y el código va por email a quien la pidió', () => {
  const a = fuente('app/configuraciones/plan/actions.ts');
  assert.match(a, /const ws = await adminDeWorkspaceActual\(\)\.catch\(\(\) => null\);\s*if \(ws == null\) return/);
  assert.match(a, /mandarCodigoDeBaja\(\{ to: sesion\.email, codigo: r\.codigo, plan, finAt: r\.finAt \}\)/);
});

test('la pantalla: dos pasos (el botón y la confirmación), sin el portal de Stripe', () => {
  const p = fuente('app/configuraciones/plan/PlanPanel.tsx');
  assert.match(p, /titulo="Darme de baja"/);
  assert.match(p, /onClick=\{corriendo \? undefined : \(\) => setPreguntar\(true\)\}/, 'el botón abre la confirmación, no da de baja');
  assert.match(p, /<ConfirmDialog titulo="¿Darte de baja\?"[\s\S]*onConfirm=\{darmeDeBaja\}/);
  assert.doesNotMatch(p, /portal/i, 'lo decidido es un botón propio, no el portal de Stripe');
});

test('la sección, la API y los textos legales', () => {
  const plan = seccionesNegocio({ general: false, integraciones: false, metodo: false }).find((s) => s.key === 'plan');
  assert.equal(plan?.href, '/configuraciones/plan', 'la sección no está en Configuración del negocio');
  assert.equal(porId('ver_mi_plan')?.gating?.rolMinimo, 'admin');
  const baja = porId('dar_de_baja_mi_plan');
  assert.ok(baja && esAccion(baja), 'la API de MaKo no la ofrece (AGENTS.md: toda feature nueva va a la API)');
  assert.equal(baja.confirmacion, 'pantalla', 'corta plata: se confirma en una pantalla, nunca por el chat');
  for (const p of ['app/reembolsos/page.tsx', 'app/terminos/page.tsx']) {
    assert.match(readFileSync(join(RAIZ, p), 'utf8'), /«Darme de baja»[\s\S]{0,40}Configuración del negocio → Tu plan/, `${p} no dice dónde darse de baja`);
  }
});
