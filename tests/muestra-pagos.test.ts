// =============================================================================
// La tab Pagos de la ficha: UNA regla para las dos puertas, y con la pasarela
// =============================================================================
// Hasta el 11/10/2026 la ruta /crm/[id] dibujaba Pagos con «es venta o tiene plan» y el modal del
// tablero (app/crm/LeadSheet.tsx) con «tiene cuotas»: un Ganado sin cuotas tenía Pagos por el link del
// WhatsApp y no la tenía desde el tablero. Y con la pasarela de pagos, el botón «Cobrar con link» vive
// adentro de Pagos: sin cambiar la regla, justo el lead al que hay que cobrarle (el que todavía no
// compró) no tenía dónde apretarlo. Ahora la regla es una función pura (lib/muestra-pagos.ts) que leen
// las dos puertas, con las señales de la pasarela leídas por la MISMA action (`senalesDeCobroAction`).
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez y restaurando de memoria. Con el código como
// está: 5 pases, 0 fallos. Rota (pases / fallos):
//   · `muestraPagos` sin `|| s.pasarelaConectada`                                     → 4 / 1
//   · LeadSheet vuelto a `...(pagos.length ? [{ key: 'cobranza'`                       → 4 / 1
//   · getLeadFullAction sin `senalesDeCobroAction(id)` (cobro armado a mano)            → 4 / 1
//   · DealDetailsCard dibujando el deal entero siempre (`const conDeal = true`)        → 4 / 1
// Correr: node --import tsx --test tests/muestra-pagos.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { muestraPagos, planEnLead, tieneDeal, type SenalesPagos } from '../lib/muestra-pagos';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const codigo = (r: string) => leer(r).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const NADA: SenalesPagos = { estado: 'abierto', etapa: 'lead', cuotas: 0, planEnLead: false, hayCobros: false, pasarelaConectada: false };

test('cuándo se dibuja la tab: cualquiera de las seis señales alcanza; ninguna, no', () => {
  assert.equal(muestraPagos(NADA), false, 'un lead abierto, sin plata y sin pasarela: no hay nada que mostrar');
  assert.equal(muestraPagos({ ...NADA, estado: 'ganado' }), true, 'es venta');
  assert.equal(muestraPagos({ ...NADA, etapa: 'facturando' }), true, 'está facturando');
  assert.equal(muestraPagos({ ...NADA, cuotas: 1 }), true, 'tiene cuotas');
  assert.equal(muestraPagos({ ...NADA, planEnLead: true }), true, 'tiene plan en el lead');
  assert.equal(muestraPagos({ ...NADA, hayCobros: true }), true, 'tiene links de pago');
  assert.equal(muestraPagos({ ...NADA, pasarelaConectada: true }), true, 'se le puede cobrar con un link');
});

test('el DEAL es otra pregunta: la pasarela sola abre la tab, no el deal vacío', () => {
  assert.equal(tieneDeal({ ...NADA, ...{ hayCobros: true, pasarelaConectada: true } }), false);
  assert.equal(tieneDeal({ ...NADA, estado: 'ganado' }), true);
  assert.equal(tieneDeal({ ...NADA, cuotas: 2 }), true);
  assert.equal(planEnLead({ cobro_inicial_usd: 500, total_cuotas: null }), true);
  assert.equal(planEnLead({ cobro_inicial_usd: null, total_cuotas: 3 }), true);
  assert.equal(planEnLead({ cobro_inicial_usd: 0, total_cuotas: 0 }), false);
  assert.equal(planEnLead({}), false);
});

test('las DOS puertas de la ficha usan la misma regla, con las mismas señales', () => {
  const ruta = codigo('app/crm/[id]/page.tsx');
  const modal = codigo('app/crm/LeadSheet.tsx');
  for (const [nombre, src] of [['ruta /crm/[id]', ruta], ['modal LeadSheet', modal]] as const) {
    assert.match(src, /const verPagos = muestraPagos\(/, `${nombre}: la tab no sale de muestraPagos`);
    assert.match(src, /\.\.\.\(verPagos \? \[\{ key: 'cobranza'/, `${nombre}: la tab Pagos no mira verPagos`);
    assert.match(src, /planEnLead: planEnLead\(lead\)/, `${nombre}: el plan no sale de planEnLead`);
  }
  // Las señales de la pasarela: la ruta las lee directo, el modal las recibe de getLeadFullAction.
  assert.match(ruta, /senalesDeCobroAction\(lead\.id\)/);
  assert.match(codigo('app/crm/actions.ts'), /senalesDeCobroAction\(id\)\]\);/);
  assert.match(modal, /muestraPagos\(\{ \.\.\.etapaPagos, \.\.\.vigente\.cobro \}\)/);
  assert.match(ruta, /muestraPagos\(\{ estado: lead\.estado_lead, etapa: stageKey, cuotas: pagos\.length, planEnLead: planEnLead\(lead\), \.\.\.cobro \}\)/);
});

test('la tarjeta: sin deal dibuja SÓLO los links; con deal, los links van debajo de Pagos', () => {
  const card = codigo('app/crm/[id]/DealDetailsCard.tsx');
  assert.match(card, /const conDeal = !!d \|\| tieneDeal\(\{ estado: lead\.estado_lead, etapa: pipelineStageOf\(lead\), cuotas: pagos\.length, planEnLead: planEnLead\(lead\) \}\);/);
  assert.match(card, /if \(!conDeal\) \{\s*return \(\s*<div[^>]*>\s*\{feedback && [^\n]*\n\s*\{seccionLinks\}\s*<\/div>/);
  assert.match(card, /<CobrarConLink lead=\{/);
  assert.match(card, /<CobrosDelLead cobros=\{cobros\}/);
  // Las tres puertas montan la tarjeta: los datos de los cobros los trae ella por actions.
  assert.match(card, /opcionesCobroAction\(lead\.id\)/);
  assert.match(card, /cobrosDelLeadAction\(lead\.id\)/);
});

test('el módulo es puro: lo importan la ruta (server) y el modal (cliente)', () => {
  assert.doesNotMatch(codigo('lib/muestra-pagos.ts'), /server-only|'use client'|'use server'|from '/);
});
