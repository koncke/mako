// =============================================================================
// El país de un competidor: se pregunta, se guarda, y cambia lo que dice el lugar de sus anuncios (6/11/2026)
// =============================================================================
// `spy_competidores.pais` existe desde la migración 0359 («decide si se le pueden prometer anuncios o no») y llegaba
// SIEMPRE null: nada lo escribía. Las dos consecuencias medidas:
//   · `enlaceSusAnuncios` abría la Biblioteca con `country=ALL`;
//   · el único que preguntaba por el país (`spy.run.ts`) hace `c.c.pais && !adLibraryCubreComercial(...)`, así que con
//     null el aviso honesto NO salía nunca, y la ficha decía «Sin anuncios activos en Meta» de un competidor cuyos
//     anuncios la Biblioteca no entrega en ningún caso: fuera de la UE y el Reino Unido devuelve sólo política, con
//     HTTP 200 y lista vacía.
//
//   1. lo que se guarda es un ISO-2 de la lista, y se valida ANTES de escribir (la columna tiene un `check`);
//   2. el nombre se escribe en pantalla por su ISO-2, y uno que no está en la lista se dice como vino;
//   3. qué países cubre la Biblioteca, y que sin el dato no se concluye nada;
//   4. el enlace a la Biblioteca va con su país (sin el dato, `ALL`);
//   5. el cableado: la pregunta está en «⋯», la acción tiene su puerta, y la pantalla dice la verdad en el lugar de
//      sus anuncios.
//
// PROBADO ROMPIÉNDOLO (6/11/2026), una rotura por vez, base en verde:
//   · `ponerPais` que escribe sin validar                                     → 1
//   · `nombreDePais` que devuelve el ISO-2 de uno conocido                    → 2
//   · la pantalla con «Sin anuncios activos» para un país sin cobertura       → 5
//   · `ponerPaisAction` sin `soloMiembro`                                     → 5
// Correr: node --import tsx --test tests/spy-pais.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAISES, esPaisConocido, nombreDePais } from '../lib/paises';
import { PAISES_CON_ANUNCIOS_COMERCIALES, adLibraryCubreComercial, sinAnunciosEnEstePais } from '../lib/spy-reglas';
import { enlaceSusAnuncios } from '../lib/spy-funnel';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. se guarda un ISO-2 de la lista, y se valida antes de escribir', () => {
  assert.equal(esPaisConocido('MX'), true);
  assert.equal(esPaisConocido('mx'), true, 'en minúsculas también: lo que se guarda va en mayúsculas');
  assert.equal(esPaisConocido(' AR '), true);
  assert.equal(esPaisConocido('XX'), false);
  assert.equal(esPaisConocido(''), false);
  assert.equal(esPaisConocido('México'), false, 'el nombre no es un ISO-2');
  assert.equal(esPaisConocido(null), false);
  assert.equal(esPaisConocido(42), false);
  for (const p of PAISES) assert.match(p.iso2, /^[A-Z]{2}$/, `${p.nombre} no es un ISO-2 de dos letras`);

  // La validación va ANTES del update: la columna es `check (pais is null or char_length(pais) = 2)` y un valor
  // cualquiera no vuelve como «no válido», vuelve como un error de Postgres en medio de una acción.
  const spy = sinComentarios(leer('lib/spy.ts'));
  const poner = spy.slice(spy.indexOf('export async function ponerPais'), spy.indexOf('export async function quitarCanal'));
  assert.ok(poner.length > 100, 'el recorte es ponerPais');
  assert.match(poner, /if \(iso !== null && !esPaisConocido\(iso\)\) return \{ ok: false/, 'sin validar, la base contesta con su error');
  assert.ok(poner.indexOf('esPaisConocido(iso)') < poner.indexOf(".from('spy_competidores')"), 'se valida ANTES de escribir');
  assert.match(poner, /pais: iso\b/, 'se guarda en mayúsculas y recortado');
  assert.match(poner, /pais: string \| null/, 'null lo borra: un país equivocado hace más daño que ninguno');
});

test('2. el nombre del país se escribe por su ISO-2', () => {
  assert.equal(nombreDePais('MX'), 'México');
  assert.equal(nombreDePais('mx'), 'México');
  assert.equal(nombreDePais('GB'), PAISES.find((p) => p.iso2 === 'GB')!.nombre);
  assert.equal(nombreDePais('ZZ'), 'ZZ', 'uno que no está en la lista se dice como vino');
  assert.equal(nombreDePais(''), '');
});

test('3. qué países cubre la Biblioteca de Meta, y sin el dato no se concluye nada', () => {
  assert.equal(adLibraryCubreComercial('ES'), true, 'la Unión Europea');
  assert.equal(adLibraryCubreComercial('GB'), true, 'el Reino Unido');
  assert.equal(adLibraryCubreComercial('gb'), true);
  assert.equal(adLibraryCubreComercial('MX'), false);
  assert.equal(adLibraryCubreComercial('AR'), false);
  assert.equal(adLibraryCubreComercial('US'), false, 'Estados Unidos tampoco: sólo la UE y el Reino Unido');
  assert.equal(adLibraryCubreComercial(''), false);
  assert.equal(PAISES_CON_ANUNCIOS_COMERCIALES.length, 28, 'los 27 de la UE y el Reino Unido');
  // El aviso de pantalla nombra al país y dice el porqué, sin prometer que se va a poder.
  assert.match(sinAnunciosEnEstePais('México'), /^En México,/);
  assert.match(sinAnunciosEnEstePais('México'), /pol[íi]tica/);
  assert.ok(sinAnunciosEnEstePais('México').length < 160, 'en pantalla, corto (el largo es para la API y el chat)');
});

test('4. el enlace a la Biblioteca va con su país', () => {
  const c = { nombre: 'Den Borg', instagram: 'den.borgg', landing_url: 'https://denborg.example.com' };
  assert.match(enlaceSusAnuncios({ ...c, pais: 'MX' }), /[?&]country=MX(&|$)/);
  assert.match(enlaceSusAnuncios({ ...c, pais: 'mx' }), /[?&]country=MX(&|$)/, 'en mayúsculas');
  assert.match(enlaceSusAnuncios({ ...c, pais: null }), /[?&]country=ALL(&|$)/, 'sin el dato, todos');
  assert.match(enlaceSusAnuncios(c), /[?&]country=ALL(&|$)/);
});

test('5. el cableado: la pregunta en «⋯», su puerta, y la pantalla dice la verdad', () => {
  const acciones = sinComentarios(leer('app/competitor-spy/actions.ts'));
  const act = acciones.slice(acciones.indexOf('export async function ponerPaisAction'), acciones.indexOf('export async function sumarCanalAction'));
  assert.ok(act.length > 80, 'el recorte es ponerPaisAction');
  assert.match(act, /const no = await soloMiembro\(\);/, 'la misma puerta que el resto de la tab');
  assert.ok(act.indexOf('soloMiembro()') < act.indexOf('ponerPais(id, pais)'), 'la puerta ANTES de escribir');
  assert.match(act, /Number\.isInteger\(id\) \|\| id <= 0/, 'un id que no es id no llega a la base');

  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /\{ value: 'pais', label: c\.pais \?/, 'la pregunta vive en «⋯ Más acciones», con el país que ya tiene');
  // Con el nombre de su tarjeta desde el 11/11 (`nombreC`, tests/mirada-prod-11-11.test.ts caso 11).
  assert.match(app, /<ModalPais nombre=\{nombreC\} actual=\{c\.pais\}/);
  assert.match(app, /onElegir=\{\(iso\) => void guardarPais\(c\.id, iso\)\}/);
  assert.match(app, /ponerPaisAction\(id, iso\)/);
  // El alta NO lo pide: es un campo y un Enter («un paso por pantalla»), y sin el dato no se dibuja un «falta».
  assert.doesNotMatch(app, /ModalPais[\s\S]{0,400}?modal === 'alta'/, 'el alta no pregunta el país');

  // ⚠️ LO QUE IMPORTA: con un país que la Biblioteca no cubre, el lugar de sus anuncios NO dice «sin anuncios activos».
  // ⚠️ Desde la JSX, no desde el CSS: `spy-sin-anuncios` aparece primero en el `const CSS` de este mismo archivo.
  const bloque = app.slice(app.indexOf('className="spy-aviso spy-aviso--suave spy-sin-anuncios"'), app.indexOf('className="spy-herramientas"'));
  assert.ok(bloque.length > 100 && bloque.length < 1200, 'el recorte es el aviso de sus anuncios');
  assert.match(bloque, /c\.pais && !adLibraryCubreComercial\(c\.pais\)/, 'se pregunta por su país antes de afirmar que no pauta');
  assert.match(bloque, /\? sinAnunciosEnEstePais\(nombreDePais\(c\.pais\)\)/, 'con un país sin cobertura, la verdad');
  assert.match(bloque, /: `Sin anuncios activos en Meta/, 'y con cobertura (o sin el dato), lo de antes');
  assert.ok(bloque.indexOf('adLibraryCubreComercial') < bloque.indexOf('Sin anuncios activos'), 'la pregunta va primero');
});
