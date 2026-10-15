// =============================================================================
// Offer en la API de MaKo, y que lo guardado no repita un cierre imposible
// =============================================================================
// Regla de Martín (13/10/2026): toda feature nueva va a la API de MaKo. Offer no tenía ninguna
// operación: MaKo por WhatsApp no sabía que existía la conclusión. Quedan dos lecturas en el área
// `negocio` (lib/api-mako/areas/negocio.def.ts), con la tab y el rol de la página y sin http.
//
// Y los avisos GUARDADOS antes del 14/10/2026 pueden decir «Cierras el 170% de las llamadas
// calificadas» (le pasó al PDF de un cliente): `avisosAfirmables` (lib/offer-marco.ts) los saca en los
// tres lugares que leen lo guardado — el PDF, la pantalla y la API.
//
// ROTURAS (14/10/2026, base 4 de 4 en verde, restaurado de memoria): avisosAfirmables con el corte en
// 1000%: 1 fallo, 3 pases · el PDF con `c.calculo.alertas` crudo: 1 fallo, 3 pases · la def sin
// `tab: 'offer'`: 1 fallo, 3 pases · «offer» fuera del área negocio de lib/mako-intencion.ts: 1 fallo,
// 3 pases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisosAfirmables } from '../lib/offer-marco';
import { porId, type Vista } from '../lib/api-mako/registro';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const IDS = ['listar_analisis_oferta', 'ver_analisis_oferta'] as const;

test('avisosAfirmables: saca el aviso con un porcentaje arriba de 100 y deja los demás', () => {
  const guardados = [
    'Tienes 5 productos activos: en la fase 1 conviene empujar una sola oferta hasta tener un anuncio ganador.',
    'Te pagan el 100% al firmar: más de 75% es señal de que el precio está barato.',
    'Cierras el 170% de las llamadas calificadas: más de 30% es señal de que hay margen para subir el precio.',
    'Con un margen de 55,5% queda por debajo de 60%.',
    'Algo con 100,5% adentro.',
  ];
  assert.deepEqual(avisosAfirmables(guardados), [guardados[0], guardados[1], guardados[3]]);
  assert.deepEqual(avisosAfirmables(null), []);
  assert.deepEqual(avisosAfirmables(['', 3, '  ']), [], 'lo que no es un texto no se muestra');
});

test('los tres lectores de lo guardado (PDF, pantalla y API) pasan por avisosAfirmables', () => {
  for (const rel of ['lib/offer-pdf.ts', 'app/offer/Conclusion.tsx', 'lib/api-mako/areas/negocio.run.ts']) {
    const src = sinComentarios(leer(rel));
    assert.match(src, /avisosAfirmables\(/, `${rel} no filtra los avisos guardados`);
  }
  assert.doesNotMatch(sinComentarios(leer('lib/offer-pdf.ts')), /caja\(doc, 'Para tener en cuenta', c\.calculo\.alertas/, 'el PDF dibuja los avisos crudos');
});

test('Offer está en la API: con la tab y el rol de la página, gratis y sin http', () => {
  for (const id of IDS) {
    const d = porId(id);
    assert.ok(d, `${id} no está en el registro`);
    assert.equal(d.area, 'negocio');
    assert.equal(d.tipo, 'lectura');
    assert.equal(d.gating?.tab, 'offer', `${id} sin la tab: un workspace sin Offer la vería`);
    assert.equal(d.gating?.rolMinimo, 'admin', `${id} sin el rol: /offer es requireRolWs([])`);
    assert.equal(d.costo, 'gratis');
    assert.ok(!d.canales.includes('http'), `${id} sale por http: es lo que el dueño contó de su negocio`);
  }
});

test('por WhatsApp, las preguntas por la oferta analizada traen la lectura', () => {
  const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };
  for (const m of ['¿cómo quedó el análisis de mi oferta?', '¿qué ofertas analizamos en Offer?', 'mostrame la conclusión de Offer', '¿qué nota sacó mi oferta en el diagnóstico?']) {
    const veredicto = clasificarIntencion(m, {});
    const t = herramientasDelTurno({ veredicto, texto: m, agendaAbierta: false, deSiempre: [], vista, hayPendientes: false, contextoDelSi: null });
    const nombres = t.tools.map((x) => x.name);
    assert.ok(nombres.includes('ver_analisis_oferta'), `«${m}» → ${veredicto.intencion}: no trae ver_analisis_oferta`);
  }
});
