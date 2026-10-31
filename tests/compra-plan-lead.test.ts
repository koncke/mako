// =============================================================================
// El lead del checkout público: nunca se duplica, nunca frena una compra, y al pagar queda para llamarlo (30/10/2026)
// =============================================================================
// docs/estrategia-lanzamiento-low-to-high.md. Con 219 leads traídos de grupos en la plataforma, `createLead` frenaba con
// LeadDuplicadoError a un comprador por tener el MISMO NOMBRE que otro, y el checkout contestaba «No pudimos registrar tu compra».
//
// Correr: node --import tsx --test tests/compra-plan-lead.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (ver docs/hallazgos-planes-y-cobro.md, «El lead del comprador»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leadDeLaCompra } from '../lib/compra-plan-reglas';

const leer = (r: string) => readFileSync(r, 'utf8').replace(/\r\n/g, '\n');
const c = (motivo: 'email' | 'telefono' | 'instagram' | 'nombre', id: number, email: string | null = null) => ({ motivo, lead: { id, email } });

test('1. el mismo contacto es el mismo lead; un homónimo con otro email es otra persona', () => {
  assert.equal(leadDeLaCompra([c('email', 7, 'a@x.com')]), 7);
  assert.equal(leadDeLaCompra([c('telefono', 8, 'otro@x.com')]), 8, 'mismo teléfono: se reusa aunque tenga otro email');
  assert.equal(leadDeLaCompra([c('nombre', 9, 'otro@x.com'), c('telefono', 8)]), 8, 'el contacto gana sobre el nombre');
  assert.equal(leadDeLaCompra([c('nombre', 9, 'otro@x.com')]), null, 'homónimo con otro email: no se le ata la compra');
  assert.equal(leadDeLaCompra([]), null);
});

test('2. cargado a mano sin email y con ese nombre: es él (lo cargan antes de que compre); con dos así, no se adivina', () => {
  assert.equal(leadDeLaCompra([c('nombre', 5)]), 5);
  assert.equal(leadDeLaCompra([c('nombre', 5, '   ')]), 5);
  assert.equal(leadDeLaCompra([c('nombre', 5), c('nombre', 6)]), null);
  assert.equal(leadDeLaCompra([c('nombre', 5), c('nombre', 6, 'otro@x.com')]), null);
  assert.equal(leadDeLaCompra([c('nombre', 5), c('email', 5)]), 5);
});

test('3. el checkout reusa o crea: un duplicado por nombre nunca frena la compra', () => {
  const s = leer('lib/compra-plan.ts');
  const f = s.slice(s.indexOf('async function leadDelComprador'), s.indexOf('«LO QUIERO» SIN PASARELA'));
  assert.match(f, /const mismo = leadDeLaCompra\(e\.coincidencias\);/);
  assert.match(f, /enriquecerLead\(mismo, \{ email: p\.email, telefono: datos\.telefono \}, 'Checkout de MaKo'\)/, 'el reusado no se queda sin el email con el que compró');
  assert.match(f, /createLead\(\{ \.\.\.datos, permitirDuplicado: true \}\)/);
  assert.doesNotMatch(f, /throw e;\n {2}\}\n\}/, 'volvió a tirar el duplicado');
});

test('5. el número del dueño llega a su lead: sólo lo vacío, con UN lead, en la plataforma', () => {
  const g = leer('lib/mako-grupo.ts');
  assert.match(g, /await guardarNumeroDueno\(ws, c\.num\);\n[^\n]*\n\s+await import\('\.\/compra-plan-llamada'\)\.then\(\(m\) => m\.anotarTelefonoDelComprador\(ws, c\.num\)\)\.catch\(\(\) => \{\}\);/);
  const l = leer('lib/compra-plan-llamada.ts');
  const f = l.slice(l.indexOf('export async function anotarTelefonoDelComprador'), l.indexOf('Corre adentro de'));
  assert.match(f, /if \(cuentaWs === plataforma\) return;/);
  assert.match(f, /runWithWorkspace\(plataforma,/, 'el lead es de la plataforma, no de la cuenta');
  assert.match(f, /\.eq\('cliente_ws', cuentaWs\)/);
  assert.match(f, /if \(filas\.length === 1\) await enriquecerLead\(/, 'con dos leads de la misma cuenta no se adivina');
});

test('4. al pagar el PRIMER mes queda para llamarlo, después de la cuenta; sin setting no pasa nada', () => {
  const s = leer('lib/cobros.ts');
  assert.match(s, /await altaSiCorresponde\(actual\);\n[^]{0,300}?if \(!renovacion\) await anotarParaLlamar\(actual\);/);
  const l = leer('lib/compra-plan-llamada.ts');
  assert.match(l, /if \(!c\.lead_id \|\| !c\.alta_capa\) return;/, 'una venta que no es un plan de MaKo no se llama');
  assert.match(l, /if \(c\.workspace_id !== await wsSuperAdmin\(\)\) return;/, 'un cliente con su Stripe no entra acá');
  assert.match(l, /if \(crm == null\) return;/);
  assert.match(l, /agregarAProducto\(c\.lead_id, crm,/, 'mover lo sacaría de Ganado: se agrega');
  assert.doesNotMatch(l, /setPipelineStage|moverEtapaEnProducto/);
});
