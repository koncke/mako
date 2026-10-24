// =============================================================================
// La calculadora de presupuesto se abre SIN cuenta de Meta, y usa los números del negocio sólo si están medidos
// =============================================================================
// 24/10/2026, pedido del Cerebro para el lanzamiento: la calculadora vivía en el ⋯ de la tabla del Ads Manager, y la tab
// abre en su wizard de onboarding mientras falte la cuenta, la página o la primera campaña. O sea que el que todavía no
// pauta —el que más necesita calcular— no la veía. Lo que se fija acá:
//   1. El wizard la abre, en sus tres pasos, montada AFUERA del WizardShell (el Modal de la casa no va por portal).
//   2. Lo medido de los anuncios (`deTusAnuncios`) sólo se propone con datos suficientes, y nunca pisa lo que escribió
//      la persona; el costo medido es POR LEAD y se saca con «Optimizas a: Venta».
//   3. Lo guardado en el navegador lleva el negocio en la clave y no guarda lo medido.
//
// Probado rompiéndolo (24/10/2026), una rotura por vez, restaurando desde memoria:
//   · el umbral `leads >= RESULTADOS_PARA_DECIDIR` bajado a `leads >= 1`        → 9 pasan / 1 falla;
//   · `ventas >= 1` quitado del cierre                                          → 9 / 1;
//   · `!out.costo.trim() &&` quitado de completarConLoMedido (pisa lo escrito)  → 9 / 1;
//   · el `if (v !== 'lead' && …)` de cambiarCampo quitado                       → 9 / 1;
//   · el `for … out[k] = ''` de paraGuardar quitado                             → 9 / 1;
//   · el botón «Calcular presupuesto» sacado del pie del wizard                 → 9 / 1;
//   · la clave del navegador sin el negocio                                     → 9 / 1.
// Base: 10 / 0.
//
// Correr: node --import tsx --test tests/calculadora-sin-cuenta.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deTusAnuncios, completarConLoMedido, cambiarCampo, paraGuardar, rangoCorto, RESULTADOS_PARA_DECIDIR,
} from '../lib/calculadora-presupuesto-ads';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const senal = (p: Partial<{ spend_usd: number; leads: number; leads_crm: number; cierres: number }>) =>
  ({ spend_usd: 0, leads: 0, leads_crm: 0, cierres: 0, ...p });
const CAMPOS = { presupuesto: '', dias: '30', costo: '', evento: 'lead' as const, ticket: '', cierre: '', avatares: '3', funcionalidades: '3' };

// ── Lo medido ────────────────────────────────────────────────────────────────

test('sin anuncios no hay nada medido: la calculadora arranca vacía', () => {
  assert.deepEqual(deTusAnuncios([]), { costoPorLead: null, cierre: null });
  assert.deepEqual(deTusAnuncios(null), { costoPorLead: null, cierre: null });
});

test('el costo por lead sólo con la vara del Recon, sumando todos los anuncios', () => {
  const pocos = Array.from({ length: RESULTADOS_PARA_DECIDIR - 1 }, () => senal({ spend_usd: 4, leads: 1 }));
  assert.equal(deTusAnuncios(pocos).costoPorLead, null, 'con menos leads que la vara, no es un dato');
  assert.equal(deTusAnuncios([senal({ spend_usd: 20, leads: 6 }), senal({ spend_usd: 5, leads: 4 })]).costoPorLead, 2.5);
  assert.equal(deTusAnuncios([senal({ spend_usd: Number.NaN, leads: 10 })]).costoPorLead, null, 'sin gasto medido no hay costo');
});

test('cuántos compran de cada 100: con leads suficientes en el CRM y al menos una venta', () => {
  assert.equal(deTusAnuncios([senal({ leads_crm: 40, cierres: 2 })]).cierre, 5);
  assert.equal(deTusAnuncios([senal({ leads_crm: 40, cierres: 0 })]).cierre, null, 'cero ventas no se propone como dato');
  assert.equal(deTusAnuncios([senal({ leads_crm: 5, cierres: 1 })]).cierre, null);
});

test('lo medido llena sólo lo VACÍO, y el costo sólo optimizando a lead', () => {
  const m = { costoPorLead: 2.5, cierre: 5 };
  const r = completarConLoMedido(CAMPOS, m);
  assert.equal(r.campos.costo, '2.5');
  assert.equal(r.campos.cierre, '5');
  assert.deepEqual(r.medido, ['costo', 'cierre']);
  const escrito = completarConLoMedido({ ...CAMPOS, costo: '4' }, m);
  assert.equal(escrito.campos.costo, '4', 'lo que escribió la persona gana');
  assert.deepEqual(escrito.medido, ['cierre']);
  assert.equal(completarConLoMedido({ ...CAMPOS, evento: 'venta' }, m).campos.costo, '', 'un costo por LEAD no es un costo por venta');
});

test('tocar un campo medido lo vuelve de la persona; pasar a venta saca el costo medido y volver a lead lo trae', () => {
  const m = { costoPorLead: 2.5, cierre: null };
  let e = completarConLoMedido(CAMPOS, m);
  e = cambiarCampo(e, 'evento', 'venta', m);
  assert.equal(e.campos.costo, '');
  assert.deepEqual(e.medido, []);
  e = cambiarCampo(e, 'evento', 'lead', m);
  assert.equal(e.campos.costo, '2.5');
  e = cambiarCampo(e, 'costo', '3', m);
  assert.deepEqual(e.medido, [], 'el que lo tocó ya no es medido');
  assert.equal(cambiarCampo(e, 'evento', 'venta', m).campos.costo, '3', 'lo escrito por la persona no se borra al cambiar de evento');
});

test('al navegador va lo escrito, nunca lo medido', () => {
  const e = completarConLoMedido({ ...CAMPOS, presupuesto: '2000' }, { costoPorLead: 2.5, cierre: 5 });
  const g = paraGuardar(e);
  assert.equal(g.presupuesto, '2000');
  assert.equal(g.costo, '');
  assert.equal(g.cierre, '');
  assert.equal(rangoCorto('2026-10-01', '2026-10-23'), 'del 1/10 al 23/10');
});

// ── Dónde se abre ────────────────────────────────────────────────────────────

test('el wizard del Ads Manager (lo que ve quien no tiene cuenta) abre la calculadora', () => {
  const onb = sinComentarios(leer('../app/ads-manager/OnboardingAdsManager.tsx'));
  assert.match(onb, /onClick=\{\(\) => setCalcOpen\(true\)\}[\s\S]{0,300}Calcular presupuesto/, 'el pie del wizard no ofrece la calculadora');
  const fin = onb.indexOf('</WizardShell>');
  assert.ok(fin > 0);
  assert.match(onb.slice(fin), /\{calcOpen && <CalculadoraPresupuesto ws=\{ws\} deTusAnuncios=\{deTusAnuncios\(senales\)\} rango=\{rangoCorto\(desde, hasta\)\}/,
    'la calculadora va AFUERA del WizardShell, con lo medido y el negocio');
});

test('la guarda del Ads Manager devuelve ESE wizard antes que la tabla', () => {
  const v = sinComentarios(leer('../app/ads-manager/AdsManagerView.tsx'));
  const i = v.indexOf('return <OnboardingAdsManager');
  assert.ok(i > 0 && i < v.indexOf('<CampanasBrowser '), 'si la guarda cambió, el wizard puede no ser lo que ve quien no pauta');
});

test('la tabla también le pasa lo medido', () => {
  assert.match(sinComentarios(leer('../app/ads-manager/CampanasBrowser.tsx')), /<CalculadoraPresupuesto ws=\{ws\} deTusAnuncios=\{deTusAnuncios\(senales\)\} rango=\{rangoCorto\(desde, hasta\)\}/);
});

test('la pantalla guarda por negocio y dice de dónde sale un número medido', () => {
  const calc = sinComentarios(leer('../app/ads-manager/CalculadoraPresupuesto.tsx'));
  assert.match(calc, /const clave = ws != null \? `\$\{CLAVE_LOCAL\}:\$\{ws\}` : CLAVE_LOCAL;/);
  assert.ok(!/useWs\(/.test(calc), 'el negocio llega del server por props, no del ?ws= de la pestaña');
  assert.match(calc, /localStorage\.setItem\(clave, JSON\.stringify\(paraGuardar\(n\)\)\)/);
  assert.match(calc, /`De tus anuncios\$\{rango \? ` \$\{rango\}` : ''\}`/);
});
