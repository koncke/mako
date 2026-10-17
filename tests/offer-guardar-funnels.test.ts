// =============================================================================
// Offer: guardar una oferta en UNO O VARIOS funnels (tarjeta #895, 17/10/2026)
// =============================================================================
// Hasta hoy, «Guardar en este funnel» ligaba la oferta sólo al funnel de la conversación, aunque el modelo ya permitía
// varios (`funnel_ofertas`, mig 0171). Ahora se elige en cuáles con el selector de la casa (`ElegirFunnels`, el de los
// OKR de /general): el de la conversación marcado de entrada, uno o varios, o «Todos los funnels». Lo de acá fija:
//   1. a qué funnels va (`destinoDeLaOferta`): sin elección, el de la conversación (MaKo Mobile y el onboarding siguen
//      igual); vacío, todos los activos; si no, los elegidos;
//   2. los avisos de varios funnels en uno, y «Guardada en VSL y Renovación»;
//   3. la pantalla: el selector sólo cuando hay más de un funnel y la conversación tiene uno;
//   4. la ruta, el motor y la vista: la elección viaja, cada funnel se liga, y «ligada» mira CUALQUIER funnel;
//   5. la API de MaKo (regla de Martín del 13/10: toda feature va ahí): guardar_oferta_analisis, con su «sí».
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (17/10/2026, arnés romper-888.mjs con otra lista, en el scratchpad de la sesión:
// rompe UNA cosa, corre este archivo y restaura DE MEMORIA). La base en verde (5 de 5); 9 roturas, las 9 cazadas (la de
// «ligada» se escapó la primera vez: la aserción aceptaba un filtro de más; arreglado). Los números, al lado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { destinoDeLaOferta, juntarLigas } from '../lib/offer-reglas';
import { textoGuardada } from '../app/offer/ayudas';
import { Conclusion } from '../app/offer/Conclusion';
import { DIMENSION_IDS, type ConclusionOferta, type OfferSesionVista } from '../lib/offer-marco';

const leer = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// rotura (sin elección, todos en vez del de la conversación): 1 fallo, 4 pases. rotura (vacío = ninguno): 1 fallo, 4 pases.
test('1 · a qué funnels va: sin elección el de la conversación, vacío todos, si no los elegidos', () => {
  const activos = [1, 6, 29];
  assert.deepEqual(destinoDeLaOferta({ funnelConversacion: 6, elegidos: null, activos }), [6], 'MaKo Mobile y el onboarding, como antes');
  assert.deepEqual(destinoDeLaOferta({ funnelConversacion: null, elegidos: null, activos }), [], 'una conversación de la v1, sin funnel');
  assert.deepEqual(destinoDeLaOferta({ funnelConversacion: 6, elegidos: [], activos }), [1, 6, 29], 'vacío es «Todos los funnels»');
  assert.deepEqual(destinoDeLaOferta({ funnelConversacion: 6, elegidos: [29, 6, 29], activos }), [29, 6], 'los elegidos, sin repetir');
});

// rotura (`juntarLigas` quedándose con el primero aunque otro pida reintentar): 1 fallo, 4 pases.
test('2 · los avisos de varios funnels en uno, y «Guardada en …» con los nombres', () => {
  assert.deepEqual(juntarLigas([{}, {}]), {});
  const r = juntarLigas([{ aviso: 'Ese funnel ya no existe.', avisoReintentable: false }, { aviso: 'Falló la base: vuelve a tocar «Guardar».', avisoReintentable: true }]);
  assert.equal(r.avisoReintentable, true, 'si alguno se arregla reintentando, el botón se queda');
  assert.equal(r.aviso, 'Falló la base: vuelve a tocar «Guardar». (y 1 aviso más)');
  assert.equal(textoGuardada([{ id: 6, nombre: 'Negocio que escala' }, { id: 29, nombre: 'Renovación' }]), 'Guardada en Negocio que escala y Renovación');
  assert.equal(textoGuardada([]), 'Guardada');
});

function conclusion(): ConclusionOferta {
  return {
    version: 1, at: '2026-10-17T10:00:00.000Z', modelo: 'IA',
    calculo: { total: 71, cuello: 'D8', lista: false, alertas: [], cifrasConFuente: true },
    diagnostico: { tesis: 'T.', fuerte: 'F.', fuertes: ['F.'], dimensiones: DIMENSION_IDS.map((id) => ({ id, nota: 7, porque: 'p', mejora: 'm' })), cambios: [{ titulo: 'C', porque: 'p', hipotesis: 'h' }] },
    propuesta: { nombre: 'Sistema', frase: 'Frase.', completar: [], avisos: [], supuestos: [], propuestoPorMako: [] },
  } as unknown as ConclusionOferta;
}
const sesion = (s: Partial<OfferSesionVista>) => ({ id: 8, ofertaId: null, ligada: true, funnelId: 6, guardadaEn: [], ...s }) as unknown as OfferSesionVista;
const FUNNELS = [{ id: 6, nombre: 'Negocio que escala' }, { id: 29, nombre: 'Renovación' }];
const dibujar = (s: OfferSesionVista, funnels = FUNNELS) => renderToStaticMarkup(createElement(Conclusion, {
  sesion: s, conclusion: conclusion(), onSeguir: () => {}, onGuardar: async () => null, funnels, pestanaInicial: 'diagnostico',
}));

// rotura (el selector siempre, también con un solo funnel): 1 fallo, 4 pases. rotura (sin «Guardada en …»): 1 fallo, 4 pases.
test('3 · la pantalla: con varios funnels se elige (el de la conversación marcado); con uno, como antes', () => {
  const varios = dibujar(sesion({}));
  assert.match(varios, /aria-label="En qué funnels guardarla"/);
  assert.match(varios, />Negocio que escala</, 'el de la conversación, marcado de entrada');
  assert.match(varios, />Guardar</);
  assert.doesNotMatch(varios, /Guardar en este funnel/);
  const uno = dibujar(sesion({}), [FUNNELS[0]]);
  assert.doesNotMatch(uno, /En qué funnels guardarla/);
  assert.match(uno, /Guardar en este funnel/);
  assert.match(dibujar(sesion({ funnelId: null })), /Guardar como mi oferta/, 'la v1, sin funnel');
  assert.match(dibujar(sesion({ ofertaId: 51, guardadaEn: FUNNELS })), /Guardada en Negocio que escala y Renovación/);
  // Lo elegido viaja al guardar; sin selector, nada (el motor usa el de la conversación).
  assert.match(leer('app/offer/Conclusion.tsx'), /setAviso\(await onGuardar\(elegible \? elegidos : undefined\)\)/);
});

// rotura (la ruta sin pasar la elección): 1 fallo, 4 pases. rotura (`ligada` mirando sólo el funnel de la conversación): 1 fallo,
// 4 pases (con la aserción arreglada).
test('4 · la ruta, el motor y la vista: la elección viaja, cada funnel se liga y «ligada» mira cualquiera', () => {
  const ruta = leer('app/api/offer/route.ts');
  assert.match(ruta, /const elegidos = body\.funnelIds === undefined \? null : sanearFunnelIds\(body\.funnelIds\);\n\s*const \{ ofertaId, fila, aviso, avisoReintentable \} = await guardarComoOferta\(id, elegidos\);/);
  assert.match(leer('app/offer/OfferApp.tsx'), /\{ action: 'guardar-oferta', sesionId: id, \.\.\.\(funnelIds \? \{ funnelIds \} : \{\}\) \}/);
  const ses = leer('lib/offer-sesiones.ts');
  assert.match(ses, /export async function guardarComoOferta\(id: number, elegidos: readonly number\[\] \| null = null\)/);
  assert.match(ses, /for \(const id of funnelIds\) rs\.push\(await ligarAlFunnel\(id, ofertaId\)\);\n\s*return juntarLigas\(rs\);/);
  // «ligada» y «Guardada en»: las ligas de la oferta a CUALQUIER funnel, no sólo al de la conversación.
  const nombres = ses.slice(ses.indexOf('export async function nombresDeSesion('), ses.indexOf('export async function vistaSesion('));
  // Sólo por la oferta: un `.eq('funnel_id', …)` de más volvería a mirar sólo el de la conversación.
  assert.match(nombres, /db\.from\('funnel_ofertas'\)\.select\('funnel_id'\)\.eq\('oferta_id', f\.ofertaId as number\),\n/);
  assert.match(nombres, /if \(f\.funnelId == null \|\| ids\.length\) \{ out\.ligada = true; return; \}/);
  assert.match(ses, /guardadaEn: nombres\.guardadaEn \?\? \[\],/);
});

// rotura (la operación sin su runner): 1 fallo, 4 pases. rotura (ejecutar sin los funnels): 1 fallo, 4 pases.
test('5 · la API de MaKo: guardar_oferta_analisis, por chat y con su «sí», en los mismos funnels que la tab', () => {
  const def = leer('lib/api-mako/areas/negocio.def.ts');
  const d = def.slice(def.indexOf("id: 'guardar_oferta_analisis'"), def.indexOf("id: 'listar_preguntas_diagnostico_fase'"));
  assert.match(d, /tipo: 'accion', confirmacion: 'chat'/);
  assert.match(d, /gating: \{ tab: 'offer', rolMinimo: 'admin' \}/);
  assert.match(d, /nombre: 'funnels', tipo: 'string'/);
  const run = leer('lib/api-mako/areas/negocio.run.ts');
  const r = run.slice(run.indexOf('guardar_oferta_analisis: {'), run.indexOf('listar_preguntas_diagnostico_fase: {'));
  assert.match(r, /const r = await guardarComoOferta\(Number\(payload\.id\), funnelIds\);/);
  assert.match(r, /if \(\/\^tod\[oa\]s\?\$\/i\.test\(crudo\)\) funnelIds = \[\];/);
  assert.match(run, /guardada_en: s\.guardadaEn,/);
});
