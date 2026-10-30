// =============================================================================
// La verificación independiente de plata de la rama de Thiago (29/10/2026, sobre 4b42b6a7f)
// =============================================================================
// Otra mirada, de otro chat, después de las tres pasadas del mismo revisor (C:/dev/revisiones/
// 2910-verificacion-plata-agency-4b42b6a7f.md). El Cerebro pidió arreglar H2 y H3 y dejar listo H1 como lo decida Martín:
//   · H1: las cuentas de agencia que ya existían (6, de la agencia ws13, capa `completo`) bajaban a Esencial al desplegar.
//     Siguen como PRO hasta que su agencia les elija el plan (`CUENTAS_DE_AGENCIA_SIN_ELEGIR_SON_PRO`, una línea si Martín dice
//     que pasen a Esencial). Una cuenta abierta desde hoy nace con el plan elegido.
//   · H2: una cuenta sin ningún cobro (aprobada a mano) pasaba a Pro gratis.
//   · H3: con una subida a Pro pendiente, si su agencia la soltaba, el cliente pagaba Pro y quedaba en Esencial para siempre.
//
// Probado rompiéndolo (29/10/2026; base 5 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · las cuentas sin elegir rigen como Esencial (la línea en `false` sin decirlo el test)   -> 4 / 1
//   · los candados no miran si el plan está elegido                                         -> 4 / 1
//   · abrir la cuenta sin dejar la marca del plan elegido                                   -> 4 / 1
//   · «Pasar a Pro» sin ningún cobro                                                        -> 4 / 1
//   · la subida pendiente saltea a la cuenta que su agencia soltó                           -> 4 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CUENTAS_DE_AGENCIA_SIN_ELEGIR_SON_PRO, rigeElPlanDeAgencia } from '../lib/plan-esencial-reglas';
import { subeEnElActo } from '../lib/agencia-cobro-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');

test('H1: las cuentas de agencia sin el plan elegido siguen como Pro (hasta que Martín diga otra cosa); con el plan elegido, rige', () => {
  // ⚠️ Si Martín decide que pasen a Esencial, la línea de lib/plan-esencial-reglas.ts va a `false` y este test cambia con ella.
  assert.equal(CUENTAS_DE_AGENCIA_SIN_ELEGIR_SON_PRO, true);
  assert.equal(rigeElPlanDeAgencia(false), false, 'sin elegir: sin topes ni candados, como antes');
  assert.equal(rigeElPlanDeAgencia(true), true, 'elegido: rigen');
});

test('H1: los candados y los topes de una cuenta de agencia preguntan si su plan está elegido', () => {
  assert.match(fuente('lib/plan-esencial.ts'), /&& \(await rigeElPlanDeAgenciaEn\(ws\)\)\) capaVendida = capa \?\? null;/);
  assert.match(fuente('lib/topes-plan-server.ts'), /return rigeElPlanDeAgenciaEn\(ws\);/);
  // La marca es la del cambio de plan, y vive en el módulo puro (los candados de cada página no cargan lib/agencia-cobro-reglas).
  assert.match(fuente('lib/plan-esencial-reglas.ts'), /export const KEY_PLAN_CAMBIADO = 'agency\.plan_cambiado';/);
});

test('H1: abrir una cuenta deja el plan elegido, y la ficha ofrece elegirlo a las de antes', () => {
  const p = fuente('lib/partners.ts');
  const marca = p.indexOf("const { error: eMarca } = await getSupabaseServer().from('app_settings').upsert({ workspace_id: ws.id, key: KEY_PLAN_CAMBIADO");
  assert.ok(marca > 0 && marca < p.indexOf('const cobro = await linkPrimerMes({'), 'la marca, al abrirla y antes del primer mes');
  assert.match(p, /if \(eMarca\) return \{ ok: false/);
  assert.match(p, /planElegido: !sinElegir\(ws\),/);
  const app = fuente('app/agency/AgencyApp.tsx');
  assert.match(app, /!abierta\.planElegido && \(\['esencial', 'pro'\] as const\)\.map\(/);
  assert.match(app, /pl === 'pro' \? 'Elegir Pro' : 'Elegir Esencial'/);
  // Elegirle Esencial a una de antes SÍ hace algo (deja la marca y su precio), y elegirle Pro no le quita nada mientras se cobra.
  const plan = fuente('lib/agencia-plan.ts');
  assert.match(plan, /const yaTeniaPro = !rigeElPlanDeAgencia\(elegido\);\n\s*if \(planDeCapa\(\(w as \{ capa\?: string \} \| null\)\?\.capa\) === p\.plan && !yaTeniaPro\) \{/);
});

test('H2: sin ningún cobro no se pasa a Pro (ni en el acto ni pendiente)', () => {
  assert.equal(subeEnElActo({ diferenciaCobrada: false, algoPagado: false, hayQueCobrar: false }), false);
  const plan = fuente('lib/agencia-plan.ts');
  const rechazo = plan.indexOf("if (p.plan === 'pro' && !hayQueCobrar) return { ok: false");
  assert.ok(rechazo > 0 && rechazo < plan.indexOf('for (const c of vivas) {'), 'antes de tocar nada');
  assert.match(plan, /const hayQueCobrar = vivas\.length > 0 \|\| primerMesSinPagar\.length > 0 \|\| !!primerMesPagado;/);
});

test('H3: la subida pendiente sigue a la suscripción aunque la agencia suelte la cuenta', () => {
  const plan = fuente('lib/agencia-plan.ts');
  const cron = plan.slice(plan.indexOf('export async function aplicarSubidasPendientes('));
  assert.match(cron, /\.or\(`cliente_ws\.eq\.\$\{ws\},alta_ws\.eq\.\$\{ws\}`\)/, 'también la que pasó a ser del cliente (`alta_ws`)');
  assert.doesNotMatch(cron, /neq\('estado', 'revocado'\)/, 'no saltea a la cuenta dada de baja');
});
