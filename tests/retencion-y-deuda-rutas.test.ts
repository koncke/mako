// =============================================================================
// La baja con retención y las rutas de la deuda (23/10/2026)
// =============================================================================
// Martín (22/10/2026): «si te querés dar de baja en la suscripción debería habilitarte un descuento como lo tienen todas
// las aplicaciones». Y la deuda se paga desde la sesión del ADMIN del negocio propio (un negocio pausado no resuelve
// workspace). Se lee el cableado del fuente: lo que mueve plata va contra la pasarela y no se ejecuta en un test.
//
// Probado rompiéndolo (23/10/2026; base 5 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · el reclamo de la oferta sin compare-and-set (setSetting en vez de cambiarSettingSi)  -> 4 / 1
//   · el cupón de Stripe `forever` en vez de `repeating`                                    -> 4 / 1
//   · la restauración de MP cuenta la cuota del mismo día (gte)                             -> 4 / 1
//   · «Darme de baja» va directo a confirmar aunque haya oferta                             -> 4 / 1
//   · /api/plan/pagar deja pagar a un no-admin                                              -> 4 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');

test('la oferta se reclama UNA vez por negocio (compare-and-set de null) antes de tocar la pasarela', () => {
  const r = fuente('lib/retencion-plan.ts');
  const reclamo = r.indexOf('cambiarSettingSi(CLAVE_RETENCION, null,');
  assert.ok(reclamo > 0, 'el reclamo es un compare-and-set desde null');
  assert.ok(reclamo < r.indexOf('descuentoStripe(key'), 'y va ANTES de pedirle el descuento a Stripe');
  assert.ok(reclamo < r.indexOf('montoSuscripcionMp(token, subMp, Math.round'), 'y ANTES de cambiar el monto en MP');
  assert.ok(reclamo < r.indexOf('pausarStripe(key, sub,'), 'y ANTES de pausar');
  assert.ok(reclamo < r.indexOf('cambiarPrecioStripe(key, sub,'), 'y ANTES de bajar de plan');
});

test('Stripe vuelve solo al precio de lista (cupón repeating); MP se restaura con las cuotas cobradas DESPUÉS', () => {
  assert.match(fuente('lib/pasarela-plan-api.ts'), /duration: 'repeating', duration_in_months: p\.meses/);
  const r = fuente('lib/retencion-plan.ts');
  assert.match(r, /\.gt\('fecha_pago', g\.aplicadaAt\.slice\(0, 10\)\)/);
  assert.match(r, /if \(\(count \?\? 0\) < \(g\.meses \?\? 1\)\) continue;/);
  assert.match(fuente('app/api/cron/cobros-reconciliar/route.ts'), /await restaurarRetencionesMp\(\)/);
});

test('«Darme de baja» muestra la oferta antes de la confirmación, y rechazarla sigue a la baja de siempre', () => {
  const p = fuente('app/configuraciones/plan/PlanPanel.tsx');
  assert.match(p, /onClick=\{corriendo \? undefined : \(\) => \(ofertaViva \? setOfrecer\(true\) : setPreguntar\(true\)\)\}/);
  assert.match(p, /onClick=\{\(\) => \{ setOfrecer\(false\); setPreguntar\(true\); \}\}/);
});

test('la deuda la paga el ADMIN del negocio PROPIO de la sesión (no el super admin, no otro rol)', () => {
  const r = fuente('app/api/plan/pagar/route.ts');
  assert.match(r, /if \(!s \|\| s\.legacy \|\| s\.rol === 'admin' \|\| s\.ws == null\) return null;/);
  assert.match(r, /if \(\(s\.rolWs \?\? 'admin'\) !== 'admin'\) return null;/);
  assert.match(r, /if \(d\?\.deuda\) return Response\.json\(\{ error: 'Primero paga lo que quedó pendiente\.'/);
});

test('revisión del 23/10: sin link vivo para otro email, Stripe vivo sin factura no abre otro cobro, MP sólo los ciclos perdidos', () => {
  const c = fuente('lib/compra-plan.ts');
  assert.doesNotMatch(c, /linkVivoDelPlan/, 'alta 1: el token de /pagar no se le da a quien tipea el email de otro');
  assert.match(c, /const base = cobros\.find\(\(c\) => c\.tipo === 'suscripcion'/, 'alta 7: reactivar con el precio de la suscripción, no el de la deuda');
  const d = fuente('lib/plan-deuda.ts');
  assert.match(d, /if \(cobrando\.suscripcion_estado === 'activa'\) return \{ tipo: 'nada'/, 'alta 2');
  assert.match(d, /ciclosPerdidosMp\(hasta, deuda\.ciclos, ahora\)/, 'media 8');
  assert.match(d, /for \(const x of faltan\.filter\(\(f\) => \(f\.monto \?\? 0\) > 0\)\.reverse\(\)\)/, 'media 9: una factura de $0 no se asienta');
  assert.match(fuente('app/api/planes/comprar/route.ts'), /const ref = codigoRefLimpio\(req\.cookies\.get\(COOKIE_REF\)\?\.value\) \?\? pedido\.ref;/, 'media 14');
});

test('el cobro de la deuda y el de reactivar quedan atados al negocio ANTES de devolver el link', () => {
  const d = fuente('lib/plan-deuda.ts');
  const atar = d.indexOf(".update({ alta_ws: ws, meses: aPagar.ciclos })");
  assert.ok(atar > 0 && atar < d.indexOf("return { tipo: 'link', url: r.link"));
  const c = fuente('lib/compra-plan.ts');
  const atar2 = c.indexOf(".update({ alta_ws: ws, ...(planId ? { plan_mako: planId } : {}) })");
  assert.ok(atar2 > 0 && atar2 < c.indexOf("return { ok: true, link: r.link };", atar2));
});
