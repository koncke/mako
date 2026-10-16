// =============================================================================
// «Tu plan»: cancelar uno mismo el plan de MaKo, como todo SaaS (15/10/2026)
// =============================================================================
// Lo decidió Estrategia el 15/10 (copiar a todo SaaS): el negocio cancela su plan de MaKo sin escribir. Lo que se fija:
//   1. el portal de cliente de Stripe (se EJECUTA contra un `fetch` de mentira): el cliente sale de la suscripción; si la
//      cuenta no tiene una configuración del portal se crea (cancelar AL FINAL del período, tarjeta y facturas), y la
//      sesión NO lleva Idempotency-Key (cada una es de un uso y vence en minutos);
//   2. el plan del negocio se lee por `alta_ws = ws` en el workspace de la PLATAFORMA (un negocio ve el suyo y nunca el
//      de otro), y la plataforma misma no tiene plan;
//   3. las acciones son sólo del ADMIN de ese workspace, y vuelven a ESE negocio (`?ws=`);
//   4. Mercado Pago (sin portal) se cancela con su botón; uno de Stripe, sólo desde el portal;
//   5. la sección está en «Configuración del negocio», la API de MaKo la cuenta, y /reembolsos y /terminos remiten a ella.
//
// PROBADO ROMPIÉNDOLO (15/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 6 pases, 0 fallos. Rota (pases / fallos):
//   · el portal con cancelar «immediately» (no al final del período)                  → 5 / 1
//   · la sesión del portal con Idempotency-Key                                        → 5 / 1
//   · suscripcionDeMakoDe sin filtrar por `alta_ws` (el plan de otro negocio)          → 5 / 1
//   · las acciones sin `adminDeWorkspaceActual`                                       → 5 / 1
//   · cancelarMiPlan cancelando también uno de Stripe por la API                       → 5 / 1
//   · la sección fuera de «Configuración del negocio»                                 → 5 / 1
// Correr: node --import tsx --test tests/mi-plan.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seccionesNegocio } from '../lib/ajustes-secciones';
import { porId } from '../lib/api-mako/registro';

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
const que = (l: Llamada) => `${l.metodo} ${l.url.pathname}`;

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
function cuerpo(src: string, nombre: string): string {
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const |\n\/\/ ─/);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

test('el portal de Stripe: el cliente de la suscripción, la configuración si falta (cancelar al final), y la sesión sin clave', async () => {
  const { portalDeSuscripcionStripe } = await import('../lib/stripe-api');
  const responder = (conConfig: boolean) => (l: Llamada) => {
    if (que(l) === 'GET /v1/subscriptions/sub_1') return json({ id: 'sub_1', customer: 'cus_9' });
    if (que(l) === 'GET /v1/billing_portal/configurations') return json({ data: conConfig ? [{ id: 'bpc_1' }] : [] });
    if (que(l) === 'POST /v1/billing_portal/configurations') return json({ id: 'bpc_nuevo' });
    if (que(l) === 'POST /v1/billing_portal/sessions') return json({ id: 'bps_1', url: 'https://billing.stripe.com/p/session/x' });
    return new Response('{}', { status: 404 });
  };
  llamadas = []; contestar = responder(false);
  const r = await portalDeSuscripcionStripe('sk_test_x', { suscripcionId: 'sub_1', returnUrl: 'https://mako.test/configuraciones/plan?ws=13' });
  assert.deepEqual(r, { ok: true, url: 'https://billing.stripe.com/p/session/x' });
  assert.deepEqual(llamadas.map(que), ['GET /v1/subscriptions/sub_1', 'GET /v1/billing_portal/configurations', 'POST /v1/billing_portal/configurations', 'POST /v1/billing_portal/sessions']);
  const conf = new URLSearchParams(llamadas[2].cuerpo ?? '');
  assert.equal(conf.get('features[subscription_cancel][enabled]'), 'true');
  assert.equal(conf.get('features[subscription_cancel][mode]'), 'at_period_end', 'cancelar corta el cobro SIGUIENTE: el mes pagado se usa');
  assert.equal(conf.get('features[payment_method_update][enabled]'), 'true');
  assert.equal(conf.get('features[invoice_history][enabled]'), 'true');
  const ses = new URLSearchParams(llamadas[3].cuerpo ?? '');
  assert.equal(ses.get('customer'), 'cus_9');
  assert.equal(ses.get('return_url'), 'https://mako.test/configuraciones/plan?ws=13');
  assert.equal(llamadas[3].headers.get('Idempotency-Key'), null, 'una clave repetida devolvería una sesión ya vencida');
  // Con una configuración por defecto ya guardada, no se crea otra.
  llamadas = []; contestar = responder(true);
  await portalDeSuscripcionStripe('sk_test_x', { suscripcionId: 'sub_1', returnUrl: 'https://mako.test/x' });
  assert.ok(!llamadas.some((l) => que(l) === 'POST /v1/billing_portal/configurations'));
});

test('el plan del negocio: el cobro de la PLATAFORMA cuya alta creó ESTE workspace, de suscripción y pagado', () => {
  const f = cuerpo(fuente('lib/cobros.ts'), 'suscripcionDeMakoDe');
  assert.match(f, /if \(ws === plataforma\) return null;/, 'la plataforma no se cobra a sí misma');
  assert.match(f, /\.eq\('workspace_id', plataforma\)\.eq\('alta_ws', ws\)\.eq\('tipo', 'suscripcion'\)\.eq\('estado', 'pagado'\)/,
    'sin `alta_ws = ws`, un negocio vería (y cancelaría) el plan de otro');
});

test('las acciones: sólo el admin de ESE workspace, y el portal vuelve a ese negocio', () => {
  const a = fuente('app/configuraciones/plan/actions.ts');
  assert.equal((a.match(/const ws = await adminDeWorkspaceActual\(\)\.catch\(\(\) => null\);\s*if \(ws == null\) return/g) ?? []).length, 2, 'las dos acciones exigen el admin del workspace');
  assert.match(a, /portalDeMiPlan\(ws, linkApp\('\/configuraciones\/plan', ws\)\)/, 'el portal vuelve a ESTE negocio: sin el workspace, quien mira un cliente vuelve a su cuenta');
});

test('Mercado Pago (sin portal) se cancela con su botón; uno de Stripe, sólo desde el portal', () => {
  const f = cuerpo(fuente('lib/cobros.ts'), 'cancelarMiPlan');
  assert.match(f, /if \(c\.proveedor === 'stripe'\) return \{ ok: false,/, 'el de Stripe se cancela al final del período, en el portal');
  assert.match(f, /return cancelarSuscripcionCobro\(c\.workspace_id, c\.id, autor\);/, 'con el workspace del COBRO (la plataforma), no el del negocio');
});

test('la sección está en «Configuración del negocio», para todo admin, y la API de MaKo la cuenta', () => {
  const plan = seccionesNegocio({ general: false, integraciones: false, metodo: false }).find((s) => s.key === 'plan');
  assert.ok(plan, 'la sección no está en Configuración del negocio');
  assert.equal(plan.href, '/configuraciones/plan');
  const api = porId('ver_mi_plan');
  assert.ok(api, 'la API de MaKo no la cuenta (AGENTS.md: toda feature nueva va a la API)');
  assert.equal(api.gating?.rolMinimo, 'admin');
});

test('/reembolsos y /terminos dicen dónde cancelar uno mismo', () => {
  for (const p of ['app/reembolsos/page.tsx', 'app/terminos/page.tsx']) {
    assert.match(readFileSync(join(RAIZ, p), 'utf8'), /Configuración del negocio → Tu\s+plan/, `${p} no dice dónde cancelar`);
  }
});
