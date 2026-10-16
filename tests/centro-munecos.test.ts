// =============================================================================
// Los muñecos elegidos y el renombre de un chat (15/10/2026)
// =============================================================================
// Martín: «Crea más diseños variados de las figuras tipo trabajadores... Y que si le doy click pueda elegir cambiar a
// otro», y «que yo tenga los 3 puntos en cada chat para poder configurar cosas, como cambiarle el nombre».
//
// Lo que fija, cada uno probado rompiéndolo (15/10/2026, con la base en 0 fallos):
//   1. Lo que llega del navegador o de la base se sanea: una pieza que no existe no se guarda, y las claves se
//      normalizan (el muñeco de «CRM» es el de «crm»). Aceptando cualquier string como forma → 1 fallo.
//   2. Lo elegido le gana al de siempre, y un sub-chat es de la familia de su jefe (mismo cuerpo y color). Ignorando
//      lo elegido en `aspectoDe` → 1 fallo.
//   3. Guardar uno lee el mapa ESTRICTO: con la lectura tolerante, una caída de la base lo escribiría vacío. Cambiando
//      `getSettingEstricto` por `getSetting` en guardarMuneco → 1 fallo.
//   4. Un nombre nuevo se rechaza vacío o largo (no se recorta), y el pedido de renombre nombra la herramienta.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CARAS, COLORES, FORMAS, TOPE_MUNECOS, aspectoAlAzar, aspectoDe, claveDeMuneco, elegidoPara, sanearAspecto, sanearMunecos,
  type Aspecto,
} from '../lib/centro-munecos';
import { TOPE_NOMBRE, nombreValido, textoDeRenombre } from '../lib/centro-chats';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const UNO: Aspecto = { forma: 'gota', color: '--grafo-voz', cara: 'lengua' };

test('lo que llega se sanea: una pieza que no existe no se guarda, y la clave es el nombre normalizado', () => {
  assert.deepEqual(sanearAspecto(UNO), UNO);
  assert.equal(sanearAspecto({ ...UNO, forma: 'dragon' }), null, 'una forma que no existe');
  assert.equal(sanearAspecto({ ...UNO, color: '#ff0000' }), null, 'un color que no es de la paleta');
  assert.equal(sanearAspecto({ forma: 'gota' }), null, 'le faltan piezas');
  // Sin accesorios desde el 16/10/2026 («Elimina los accesorios de los personajes»): uno guardado antes con el suyo se
  // sigue leyendo, sin él. Probado rompiéndolo: exigiendo las cuatro piezas de antes, el guardado viejo se pierde.
  assert.deepEqual(sanearAspecto({ ...UNO, accesorio: 'antena' }), UNO, 'lo guardado antes, sin su accesorio');
  assert.deepEqual(sanearMunecos({ CRM: { ...UNO, accesorio: 'gorro' } }), { crm: UNO });
  assert.equal('accesorio' in aspectoDe('Automations'), false, 'el de siempre tampoco lo trae');
  const m = sanearMunecos({ ' CRM ': UNO, Graphics: { ...UNO, cara: 'x' }, '': UNO });
  assert.deepEqual(Object.keys(m), ['crm'], 'el inválido y el vacío se van; la clave, normalizada');
  assert.deepEqual(sanearMunecos('no es un objeto'), {});
  assert.deepEqual(sanearMunecos([UNO]), {});
  const muchos = Object.fromEntries(Array.from({ length: TOPE_MUNECOS + 20 }, (_, i) => [`chat ${i}`, UNO]));
  assert.equal(Object.keys(sanearMunecos(muchos)).length, TOPE_MUNECOS, 'con su tope');
});

test('lo elegido le gana al de siempre, y un sub-chat es de la familia de su jefe', () => {
  assert.deepEqual(aspectoDe('CRM', UNO), UNO);
  assert.deepEqual(elegidoPara({ crm: UNO }, 'Crm'), UNO, 'se busca por el nombre normalizado');
  assert.equal(elegidoPara({ crm: UNO }, 'Graphics'), null);
  const jefe = aspectoDe('CRM'), sub = aspectoDe('CRM › Lead Detail');
  assert.deepEqual([sub.forma, sub.color], [jefe.forma, jefe.color], 'el mismo cuerpo y color que su jefe');
  assert.equal(claveDeMuneco('  Ádmin  CRM '), 'admin crm');
  // Al azar, siempre algo válido (con el azar en los dos bordes).
  for (const r of [0, 0.5, 0.999999]) assert.ok(sanearAspecto(aspectoAlAzar(() => r)));
  // Y hay de dónde elegir: más cuerpos y caras que antes (5 cuerpos y una sola cara).
  assert.ok(FORMAS.length >= 7 && CARAS.length >= 6 && COLORES.length >= 9);
});

test('guardar un muñeco lee el mapa estricto: una caída de la base no borra lo elegido', () => {
  const src = readFileSync(join(RAIZ, 'lib/centro-munecos-db.ts'), 'utf8').replace(/\r\n/g, '\n');
  const cuerpo = src.slice(src.indexOf('export async function guardarMuneco'));
  assert.ok(cuerpo.length > 100, 'encontré guardarMuneco');
  assert.match(cuerpo, /getSettingEstricto\(CLAVE_MUNECOS\)/);
  assert.doesNotMatch(cuerpo, /[^o]getSetting\(CLAVE_MUNECOS\)/, 'la lectura tolerante es para dibujar, no para escribir');
  assert.match(src, /runWithWorkspace\(ws, async \(\) =>/, 'en el workspace de la plataforma');
  assert.match(src, /const ws = await wsSuperAdmin\(\);/);
});

test('renombrar: el nombre se rechaza vacío o largo (no se recorta), y el pedido nombra la herramienta', () => {
  assert.deepEqual(nombreValido('  CRM   ›  Lead Detail '), { ok: true, nombre: 'CRM › Lead Detail' });
  assert.equal(nombreValido('   ').ok, false);
  assert.equal(nombreValido('x'.repeat(TOPE_NOMBRE + 1)).ok, false);
  assert.equal(nombreValido('x'.repeat(TOPE_NOMBRE)).ok, true);
  const t = textoDeRenombre('CRM › Lead Detail');
  assert.match(t, /«CRM › Lead Detail»/);
  assert.match(t, /set_session_title/);
});
