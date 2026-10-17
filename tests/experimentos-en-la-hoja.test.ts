// =============================================================================
// «Experiments» vive en el chat de MaKo del Dashboard: «probemos X» propone un experimento en la hoja
// =============================================================================
// Martín, 17/10/2026: «Quiero que "Experiments" la simplifiques completamente: la funcionalidad, o lo que pretendía,
// puede vivir dentro del chat de MaKo de "Dashboard"». Lo que se prueba es lo que se puede equivocar sin que nada se vea
// roto: un experimento que mide OTRA métrica que la pedida (una adivinada), uno que entra en General, uno que la hoja
// tira al guardarse, y la puerta que arranca dos veces el mismo.
//
// Correr: node --import tsx --test tests/experimentos-en-la-hoja.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 6/0): `sanearPropuesta` que cae a 'cpl' con una métrica que no existe → 5 / 1;
// `conExperimentos` que deja pasar General → 5 / 1; la rama `experimento` fuera de `sanearElemento` → 4 / 2.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { METRICAS_EXPERIMENTO, VENTANA_MAX, VENTANA_MIN, sanearPropuesta } from '../lib/experimentos-catalogo';
import { aplicarEdicion, conExperimentos, userDeEdicion } from '../lib/graficos-ia-edicion';
import { ALCANCE_GENERAL } from '../lib/graficos-ia';
import { sanearElemento, sanearHoja, esElemento, type Hoja } from '../lib/graficos-catalogo';

const BASE = { titulo: 'Anuncio con testimonio', hipotesis: 'Un anuncio con testimonio baja el costo por formulario', metrica: 'cp_form', direccion: 'bajar', ventana_dias: 14, criterio_exito: 'baja un 15%' };
const hoja = (): Hoja => sanearHoja({ id: 'h1', nombre: 'Marketing', componentes: [] }, 0)!;

test('la propuesta se sanea: una métrica que no existe NO se adivina', () => {
  assert.equal(sanearPropuesta({ ...BASE, metrica: 'ventas_magicas' }), null);
  assert.equal(sanearPropuesta({ ...BASE, hipotesis: '  ' }), null, 'sin hipótesis no hay experimento');
  const p = sanearPropuesta({ ...BASE, ventana_dias: 400, direccion: 'de costado' })!;
  assert.equal(p.metrica, 'cp_form');
  assert.equal(p.ventana_dias, VENTANA_MAX);
  assert.equal(p.direccion, 'bajar', 'una dirección que no existe cae a la natural de la métrica');
  assert.equal(sanearPropuesta({ ...BASE, ventana_dias: 1 })!.ventana_dias, VENTANA_MIN);
});

test('«probemos X» en el Dashboard: la IA propone y la hoja lo muestra como un elemento «Experimento»', () => {
  const r = aplicarEdicion(hoja(), { respuesta: 'Te lo armé.', agregar: [{ experimento: BASE }] });
  assert.deepEqual(r.errores, []);
  const e = r.hoja.componentes.find(esElemento);
  assert.ok(e && e.tipo === 'experimento', 'no entró el elemento');
  assert.equal(e.experimento?.id, null);
  assert.equal(e.experimento?.propuesta?.metrica, 'cp_form');
  assert.match(r.cambios[0], /Propuse el experimento «Anuncio con testimonio»/);
});

test('General no es un banco de pruebas: allá ni se ofrece ni entra', () => {
  assert.equal(conExperimentos(ALCANCE_GENERAL), false);
  assert.equal(conExperimentos({}), true);
  assert.doesNotMatch(userDeEdicion({ hoja: hoja(), pedido: 'x', alcance: ALCANCE_GENERAL }), /MÉTRICAS DE EXPERIMENTOS/);
  assert.match(userDeEdicion({ hoja: hoja(), pedido: 'x' }), /MÉTRICAS DE EXPERIMENTOS/);
  const r = aplicarEdicion(hoja(), { respuesta: 'ok', agregar: [{ experimento: BASE }] }, ALCANCE_GENERAL);
  assert.equal(r.hoja.componentes.length, 0);
});

test('la IA conoce TODAS las métricas que se pueden medir', () => {
  const u = userDeEdicion({ hoja: hoja(), pedido: 'probemos algo' });
  for (const m of METRICAS_EXPERIMENTO) assert.ok(u.includes(`${m.key} — `), m.key);
});

test('la hoja guarda el elemento (al saneo de cada guardado) y tira el que no dice nada', () => {
  const e = sanearElemento({ id: 'x1', tipo: 'experimento', texto: 'T', experimento: { id: null, propuesta: BASE } });
  assert.ok(e?.experimento?.propuesta);
  assert.deepEqual(sanearElemento({ id: 'x2', tipo: 'experimento', experimento: { id: 42 } })?.experimento, { id: 42, propuesta: null });
  assert.equal(sanearElemento({ id: 'x3', tipo: 'experimento', experimento: {} }), null);
  assert.equal(sanearElemento({ id: 'x4', tipo: 'experimento', experimento: { id: null, propuesta: BASE } }, { enPopup: true }), null, 'no vive en un pop-up');
});

test('la puerta: del Dashboard, re-sanea lo que llega, y arrancar dos veces el mismo elemento es UN experimento', () => {
  const r = readFileSync('app/api/experimentos/route.ts', 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.equal((r.match(/const cerrada = await soloAdminDeTab\('graphics'\);/g) ?? []).length, 2, 'GET y POST, con la puerta del Dashboard');
  assert.match(r, /const p = sanearPropuesta\(body\.propuesta\);/);
  const i = r.indexOf('const ya = await experimentoDeElemento(elemento);');
  assert.ok(i > 0 && i < r.indexOf('await crearExperimento('), 'se mira si ya existe ANTES de crear');
  assert.match(r, /config: \{ elemento \}/);
});
