// =============================================================================
// «Ser partner NO es gratis»: el alta exige MaKo Pro ACTIVO (Martín, 18/11/2026)
// =============================================================================
// «no es gratis, deben estar pagando su suscripción… sí o sí necesitan el plan de 97, el de MaKo Pro». Reemplaza «cualquier plan es partner» (29/10).
// ⚠️ Medido el 19/11: NADIE paga su plan por la pasarela todavía; Leila paga su Pro por Binance (mensualidad propia) y Código es una agencia con
// mensualidad. Por eso «Pro activo» cuenta la pasarela O la mensualidad (lib/partners-reglas.ts `esProActivo`).
// Correr: node --import tsx --test tests/partners-solo-pro.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esProActivo, RUTA_PASARSE_A_PRO, TEXTO_PARTNER_SOLO_PRO } from '../lib/partners-reglas';

const fuente = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const PRO = { plan: 'pro', capa: 'agencia', cancelada: false };

test('Pro por la pasarela (pagado o con la tarjeta de la prueba): sí; Essential, cancelado o en pausa: no', () => {
  assert.equal(esProActivo({ estado: 'activo', pasarela: PRO, mensualidad: null }), true);
  assert.equal(esProActivo({ estado: 'activo', pasarela: { plan: null, capa: 'agencia', cancelada: false }, mensualidad: null }), true, 'sin plan_mako, la capa de Pro');
  assert.equal(esProActivo({ estado: 'activo', pasarela: { plan: 'esencial', capa: 'completo', cancelada: false }, mensualidad: null }), false);
  assert.equal(esProActivo({ estado: 'activo', pasarela: { ...PRO, cancelada: true }, mensualidad: null }), false, 'se dio de baja');
  assert.equal(esProActivo({ estado: 'pausado', pasarela: PRO, mensualidad: 'pro' }), false, 'en pausa no');
});

test('Pro por su mensualidad de Binance (Leila, una agencia): sí; Essential por mensualidad o «habilitado sin cobro» (P2P): no', () => {
  assert.equal(esProActivo({ estado: 'activo', pasarela: null, mensualidad: 'pro' }), true);
  assert.equal(esProActivo({ estado: 'activo', pasarela: null, mensualidad: 'esencial' }), false);
  assert.equal(esProActivo({ estado: 'activo', pasarela: null, mensualidad: null }), false, 'cargado a mano sin cobro no paga');
});

test('lo que no se pudo leer no decide a ciegas (salvo que lo otro ya diga que sí)', () => {
  assert.equal(esProActivo({ estado: undefined, pasarela: PRO, mensualidad: 'pro' }), undefined);
  assert.equal(esProActivo({ estado: 'activo', pasarela: undefined, mensualidad: null }), undefined);
  assert.equal(esProActivo({ estado: 'activo', pasarela: null, mensualidad: undefined }), undefined);
  assert.equal(esProActivo({ estado: 'activo', pasarela: undefined, mensualidad: 'pro' }), true);
});

test('el alta frena SIN Pro y antes de crear el código; quien ya era partner sigue; las pantallas no ofrecen el alta', () => {
  const p = fuente('lib/partners-programa.ts');
  const cuerpo = p.slice(p.indexOf('export async function hacermePartner'));
  const guarda = cuerpo.indexOf('const pro = await planProActivo(ws);');
  assert.ok(guarda > 0 && guarda < cuerpo.indexOf('const codigo = await codigoDe(ws);'), 'la guarda va antes del código');
  assert.match(cuerpo, /if \(!antes\) \{\n      const pro = await planProActivo\(ws\);/, 'sólo para entrar: quien ya es partner no pierde nada');
  assert.match(cuerpo, /if \(!pro\) return \{ ok: false, error: `\$\{TEXTO_PARTNER_SOLO_PRO\} \$\{linkApp\(RUTA_PASARSE_A_PRO, ws\)\}` \};/, 'el link con el negocio (tests/link-con-workspace.test.ts)');
  assert.match(TEXTO_PARTNER_SOLO_PRO, /MaKo Pro activo/);
  assert.equal(RUTA_PASARSE_A_PRO, '/configuraciones/plan');
  const web = fuente('app/partners/page.tsx');
  assert.match(web, /if \(pro !== true\) \{[\s\S]{0,600}accion=\{\{ href: RUTA_PASARSE_A_PRO, texto: 'Pasarme a MaKo Pro' \}\}/);
  // En el teléfono no se ofrece pagar (T5): sin botón.
  assert.match(fuente('app/m/partners/page.tsx'), /if \(pro !== true\) \{[\s\S]{0,400}<LandingPartners modo="app" accion=\{null\} \/>/);
});
