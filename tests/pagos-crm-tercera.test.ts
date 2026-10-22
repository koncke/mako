// =============================================================================
// La tercera revisión de Cobros (22/10/2026, revision-cobros-2210-tercera.md): lo cobrado que se muestra al lado de un
// saldo es el de ESA venta, y lo que cambia los CRMs del lead re-sincroniza lo cobrado de la casa.
// =============================================================================
// Caso de la revisión: venta de la casa US$2.000, 1.000 pagados en la casa y 500 en una Renovación → pagó 1.000 de su
// venta y le faltan 1.000. Lo que se puede ejecutar se ejecuta (`valoresDelLead`, `cobradoDeLaVentaSiHay`); lo demás se
// lee del fuente.
// Probado ROMPIÉNDOLO (22/10/2026): cada test dice su rotura y cuántos fallos dio.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cobradoDeLaVentaSiHay } from '../lib/pagos-crm';
import { valoresDelLead } from '../lib/variables-del-lead';
import type { Lead } from '../lib/leads';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const leadDelCaso = (extra: Partial<Lead> = {}) =>
  ({ id: 28, nombre: 'Cliente', monto_cierre_usd: 2000, total_cobrado_usd: 1500, total_cobrado_casa_usd: 1000, ...extra }) as unknown as Lead;

// M2 · Rotura: `{{lead_cobrado}}` con `l.total_cobrado_usd`: 1 fallo.
test('M2: {{lead_cobrado}} y {{lead_saldo}} hablan de la MISMA venta: los tres suman', () => {
  const v = valoresDelLead(leadDelCaso());
  const plata = (s: string | undefined) => Number(String(s ?? '').replace(/[^\d]/g, ''));
  assert.equal(plata(v.lead_cobrado), 1000, `cobrado: ${v.lead_cobrado}`);
  assert.equal(plata(v.lead_saldo), 1000, `saldo: ${v.lead_saldo}`);
  assert.equal(plata(v.lead_monto_cierre), plata(v.lead_cobrado) + plata(v.lead_saldo));
  // Sin ninguna de las dos columnas no se inventa «US$ 0».
  assert.equal(valoresDelLead(leadDelCaso({ total_cobrado_usd: null, total_cobrado_casa_usd: null })).lead_cobrado, undefined);
});

// Rotura: `cobradoDeLaVentaSiHay` devolviendo 0 sin dato: 1 fallo.
test('lo cobrado de la venta, o null sin dato (el CSV y el MD lo dibujan vacío, no «0»)', () => {
  assert.equal(cobradoDeLaVentaSiHay({ total_cobrado_casa_usd: 1000, total_cobrado_usd: 1500 }), 1000);
  assert.equal(cobradoDeLaVentaSiHay({ total_cobrado_casa_usd: null, total_cobrado_usd: 1500 }), 1500, 'sin la 0325 en esa fila, lo de antes');
  assert.equal(cobradoDeLaVentaSiHay({ total_cobrado_casa_usd: 0, total_cobrado_usd: 500 }), 0, 'sólo pagó la renovación: 0 de su venta');
  assert.equal(cobradoDeLaVentaSiHay({ total_cobrado_casa_usd: null, total_cobrado_usd: null }), null);
});

// M1 · Rotura: el MD con `l.total_cobrado_usd`: 1 fallo. B5 · Rotura: las sugerencias con `l.total_cobrado_usd`: 1 fallo.
test('M1 y B5: el export en MD y «Ganados sin cobro» miran lo cobrado de la venta', () => {
  const a = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(a, /^\s*cobrado: cobradoDeLaVentaSiHay\(l\),$/m, 'el MD (`filaALeadDoc`)');
  assert.match(a, /l\['#cobrado'\] = cobradoDeLaVentaSiHay\(l\);/, 'el CSV');
  assert.match(sinComentarios(leer('lib/sugerencias-crm-server.ts')), /cobrado: cobradoDeLaVenta\(l\), ventaTipo:/);
  assert.match(leer('lib/leads.ts'), /'monto_cierre_usd, total_cobrado_usd, total_cobrado_casa_usd, /, 'la lista del CRM trae la columna');
});

// B1 · Rotura: `agregarAProducto` sin re-sincronizar: 1 fallo. El lote sin filtrar por el CRM: 1 fallo.
test('B1: agregar, quitar y deshacer re-sincronizan lo cobrado de la casa', () => {
  const f = sinComentarios(leer('lib/lead-funnel.ts'));
  const cuerpo = (firma: string) => { const i = f.indexOf(firma); return f.slice(i, f.indexOf('\nexport ', i + 1)); };
  assert.match(cuerpo('export async function agregarAProducto('), /await resincronizarCobrado\(\[leadId\], funnelId\);/);
  assert.equal(cuerpo('export async function quitarDeProducto(').match(/await resincronizarCobrado\(\[leadId\]\);/g)?.length, 2, 'quitar una fila y quitar la casa');
  assert.match(cuerpo('export async function deshacerQuitar('), /await resincronizarCobrado\(\[d\.leadId\]\);/);
  assert.match(cuerpo('export async function agregarLoteAProducto('), /await resincronizarCobrado\(ok, funnelId\);/);
  assert.match(f, /\.from\('pagos'\)\.select\('lead_id'\)\.eq\('funnel_id', funnelId\)\.in\('lead_id', ids\)/, 'un lote sólo sincroniza a los que tienen pagos en ese CRM');
});

// B3 · Rotura: `funnelDelNegocio` sin mirar `error`: 1 fallo. B4 · Rotura: `listar_leads` sin `sinCasa`: 1 fallo.
test('B3 y B4: una lectura que falla no se escribe como saldo ni cae callada a la cuenta vieja', () => {
  const p = sinComentarios(leer('lib/pagos.ts'));
  assert.match(p, /async function funnelDelNegocio\(\)[\s\S]{0,300}if \(error\) throw new Error\(`No pude leer el funnel del negocio/);
  const r = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  assert.match(r, /if \(error\) sinCasa = true;/);
  assert.match(r, /falta_cobrar_usd: sinCasa \? null : faltaDeLaVenta\(conCasa\)/);
});
