// =============================================================================
// La galería de una tab de la ficha se abre SOLA en un negocio NUEVO, y sólo ahí (18/11/2026)
// =============================================================================
// Martín, 16/10/2026: «Si nunca configuró una tab, y entra por primera vez al detail de un lead, que le salten los
// templates y el ¿Qué vas a crear hoy?... Y que pueda elegir», y el mismo día la excepción: «en los casos de los workspace
// que ya tienen leads, simplemente ponles las plantillas sugeridas, es decir que no aparezca el "¿Qué vas a crear hoy?"».
// Del 16/10 al 18/11 no se abría sola en ninguno (docs/feedback-diseno-pendiente.md, fila del 16/10, re-medida el 18/11).
//
// Lo que se EJECUTA (app/crm/lead-view/ficha/galeria.ts): `abreSola` con cada condición, y la memoria de «Cerrar» en el
// navegador (`cerradasDe` / `anotarCerrada`) con un almacenamiento de mentira, uno vacío (el cliente nuevo: la clave
// borrada) y uno que tira (un modo privado). El cableado (quién le pasa `negocioNuevo`) se mira en el fuente.
//
// Correr: node --import tsx --test tests/ficha-galeria-sola.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026, base 4/0), cada rotura restaurada antes de la siguiente:
//   · `abreSola` sin mirar `negocioNuevo` (se abre en un negocio con leads de antes)        → 3 / 1 («las reglas»)
//   · `abreSola` sin mirar `configurada` (la preferencia le gana a la decisión)            → 3 / 1 («las reglas»)
//   · `cerradasDe` leyendo sólo la primera tab                                              → 3 / 1 («cerrar se recuerda»)
//   · `getLeadFullAction` sin `negocioNuevo` en lo que devuelve                             → 3 / 1 («el cableado»)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abreSola, anotarCerrada, cerradasDe, claveCerrada } from '../app/crm/lead-view/ficha/galeria';
import { TABS_FICHA } from '../lib/ficha/catalogo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (x: string) => x.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** El caso que SÍ abre: el admin de un negocio nuevo, en la computadora, mirando una tab que nadie configuró. */
const SI = { puede: true, montado: true, escritorio: true, editando: false, negocioNuevo: true, configurada: false, cerrada: false };

test('las reglas: se abre sola sólo con TODAS; cada una sola la apaga', () => {
  assert.equal(abreSola(SI), true, 'un negocio nuevo, una tab sin configurar: le salta la galería');
  const apagan: Array<[keyof typeof SI, boolean, string]> = [
    ['negocioNuevo', false, 'un negocio con leads de antes ve su sugerida (la excepción de Martín)'],
    ['configurada', true, 'una tab que alguien configuró (la DECISIÓN) gana sobre todo'],
    ['cerrada', true, 'la cerró en este navegador: no vuelve a saltar'],
    ['puede', false, 'quien no personaliza (un closer, un setter) nunca la ve'],
    ['editando', true, 'personalizando se abre con «Templates»'],
    ['montado', false, 'antes de montar no se sabe nada del navegador: el server dibuja la sugerida'],
    ['escritorio', false, 'a lo ancho de un teléfono la galería no se dibuja: abierta sola dejaría la tab en blanco'],
  ];
  for (const [k, v, porque] of apagan) assert.equal(abreSola({ ...SI, [k]: v }), false, porque);
});

test('cerrar se recuerda en ESTE navegador, por funnel y tab; un cliente nuevo (la clave borrada) la ve', () => {
  const datos = new Map<string, string>();
  const almacen = { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => { datos.set(k, v); } };
  // El cliente nuevo: nada guardado, nada cerrado, y la galería se abre.
  assert.equal(cerradasDe(almacen, 41).size, 0);
  assert.equal(abreSola({ ...SI, cerrada: cerradasDe(almacen, 41).has(claveCerrada(41, 'resumen')) }), true);
  // Cerró la de Tracking (la ÚLTIMA de la lista: se leen todas, no sólo la primera).
  anotarCerrada(almacen, claveCerrada(41, 'tracking'));
  const cerradas = cerradasDe(almacen, 41);
  assert.equal(cerradas.has(claveCerrada(41, 'tracking')), true);
  assert.equal(cerradas.has(claveCerrada(41, 'resumen')), false, 'cerrar una tab no cierra las otras');
  assert.equal(cerradasDe(almacen, 42).size, 0, 'cerrar en un funnel no la cierra en otro');
  assert.equal(TABS_FICHA.at(-1), 'tracking', 'el caso de arriba mira la última tab');
  // Sin almacenamiento (modo privado, una vista previa): no tira, nada cerrado, y anotar no rompe.
  const tira = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
  assert.equal(cerradasDe(tira, 41).size, 0);
  assert.doesNotThrow(() => anotarCerrada(tira, claveCerrada(41, 'resumen')));
  assert.equal(cerradasDe(null, 41).size, 0);
});

test('la clave lleva el funnel y la tab (el id de un funnel es de UN solo negocio)', () => {
  assert.equal(claveCerrada(41, 'resumen'), 'mako.ficha.galeria-cerrada.41.resumen');
  assert.notEqual(claveCerrada(41, 'resumen'), claveCerrada(41, 'tracking'));
});

test('el cableado: el server mide si el negocio es nuevo y la ficha se lo pasa a `abreSola`', () => {
  const acciones = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(acciones, /const negocioNuevoP = negocioNuevoParaLaFicha\(\);/);
  assert.match(acciones, /negocioNuevo: await negocioNuevoP,/, 'getLeadFullAction no devuelve si el negocio es nuevo');
  const server = sinComentarios(leer('lib/ficha/config-server.ts'));
  const lectura = server.slice(server.indexOf('export async function negocioNuevoParaLaFicha'), server.indexOf('export type ResultadoGuardarFicha'));
  assert.match(lectura, /\.from\('leads'\)\.select\('id'\)\.lt\('created_at', FICHA_POR_BLOQUES_DESDE\)\.limit\(1\)/);
  assert.match(lectura, /if \(error\) return false;/, 'con la lectura caída no se abre sola (el error caro es abrírsela a un cliente de antes)');
  const ficha = sinComentarios(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx'));
  assert.match(ficha, /negocioNuevo: data\.negocioNuevo === true,/);
  assert.match(ficha, /configurada: efectiva\.configuradas\.includes\(tab\),/);
  assert.match(ficha, /cerrada: funnelDeLaFicha != null && cerradas\.has\(claveCerrada\(funnelDeLaFicha, tab\)\),/);
});
