// =============================================================================
// «Respondieron 8» se puede tocar: quiénes son, con el mismo criterio que el número (31/10/2026)
// =============================================================================
// Correr: node --import tsx --test tests/automatizacion-quienes.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ESTADOS_RESPONDIO } from '../lib/graficos-datos-puro';

const leer = (r: string) => readFileSync(r, 'utf8').replace(/\r\n/g, '\n');

test('1. el criterio es el del número del Dashboard', () => {
  const q = leer('lib/automatizacion-quienes.ts');
  assert.match(q, /if \(cual === 'respondieron'\) return ESTADOS_RESPONDIO\.has\(String\(estado \?\? ''\)\);/, 'otra lista de estados daría otro número');
  assert.match(q, /if \(cual === 'en_curso'\) return estado === 'activa' \|\| estado === 'pausada';/);
  assert.match(leer('lib/graficos-datos.ts'), /respondieron: ESTADOS_RESPONDIO\.has\(String\(x\.estado \?\? ''\)\) \? 1 : 0/);
  assert.match(leer('lib/graficos-datos.ts'), /en_curso: x\.estado === 'activa' \|\| x\.estado === 'pausada' \? 1 : 0/);
  assert.ok(ESTADOS_RESPONDIO.has('respondio'));
});

test('2. por la puerta de siempre: admin, un cual conocido, y un fallo es un fallo', () => {
  const r = leer('app/api/automations/metricas/route.ts');
  const get = r.slice(r.indexOf('export async function GET'), r.indexOf('export async function POST'));
  assert.ok(get.indexOf('const cerrada = await puerta();') < get.indexOf("searchParams.get('quienes')"), 'antes de leer leads, la puerta');
  assert.match(get, /if \(!esQuienes\(quienes\)\) return no\(400,/);
  const q = leer('lib/automatizacion-quienes.ts');
  assert.match(q, /if \(error\) throw new Error\(`No pude leer quiénes son/, '«no pude» no es «nadie»');
  assert.match(q, /\.eq\('secuencia_id', secuenciaId\)/);
  assert.match(q, /getTenantDb\(\)/, 'del negocio que mira');
});

test('3. la pantalla lo ofrece arriba de las Métricas y lleva a la ficha', () => {
  const m = leer('app/automations/MetricasAutomatizacion.tsx');
  assert.match(m, /<QuienesDeMetricas secuenciaId=\{secuenciaId\} \/>/);
  const c = leer('app/automations/QuienesDeMetricas.tsx');
  assert.match(c, /href=\{`\/crm\/\$\{f\.leadId\}`\}/);
  assert.match(c, /alto="min\(80vh, 620px\)" onCerrar=\{cerrar\}/, 'onCerrar de identidad fija');
  assert.match(leer('lib/api-mako/areas/chatbot.def.ts'), /id: 'quienes_de_automatizacion'/);
});
