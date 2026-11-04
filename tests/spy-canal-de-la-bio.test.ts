// =============================================================================
// El link de la bio de Instagram no se tira a la basura al guardar (ítem 10, 2/11/2026)
// =============================================================================
// Martín pidió «con un dato, traer todas sus redes». La mitad GRATIS de eso ya estaba pagada y se
// perdía: la vista previa del alta lee el perfil con Apify y devuelve `web` —el link de su bio—, lo
// MUESTRA («Su sitio: …») y después `agregarCompetidor` guardaba sólo el canal que se pegó.
// `lib/spy.ts` no mencionaba `perfil.web` en ninguna línea.
//
// Ahora el link viaja con la confirmación (no se vuelve a leer el perfil: eso sería pagar dos veces
// y gastar del tope diario de Apify) y `canalDeLaBio` decide si aporta un canal nuevo.
//
// ⚠️ ESTO SE EJECUTA, NO SE LEE COMO TEXTO. La decisión vive en `lib/spy-reglas.ts` justamente por
// eso: `lib/spy.ts` importa `server-only` y ningún test puede importarlo, así que una regla metida
// ahí sólo se podría cuidar emparejando el archivo como string — que es cómo dos guards de esta
// semana pasaron en verde sobre código roto (docs/hallazgos-competitors-spy.md).
//
// PROBADO ROMPIÉNDOLO (2/11/2026), con el archivo en 7 / 0, una rotura por vez y restaurada:
//   · `canalDeLaBio` que acepta también 'instagram'  → 6 / 1  (la landing quedaría en instagram.com)
//   · `canalDeLaBio` sin la lista blanca de campos    → 5 / 2  (texto de la bio guardado como sitio)
// ⚠️ Y LA PRIMERA VERSIÓN DE ESTE TEST NO CAZABA LA PRIMERA ROTURA: quedaba en 7 / 0. Ver el
//    comentario dentro del test de Instagram — el caso que vale es con OTRO canal pegado.
//   · `canalDeLaBio` sin el descarte del mismo campo  → 6 / 1
//   · `canalDeLaBio` que devuelve el canal con `null` → 6 / 1
// Correr: node --import tsx --test tests/spy-canal-de-la-bio.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canalDeLaBio, type CanalLeido } from '../lib/spy-reglas';

const landing: CanalLeido = { campo: 'landing_url', valor: 'https://acme.com/vsl' };
const canal: CanalLeido = { campo: 'youtube_id', valor: 'UC123' };
const otraIg: CanalLeido = { campo: 'instagram', valor: 'otracuenta' };
const texto: CanalLeido = { campo: 'nombre', valor: 'Coach de ventas 🚀' };

test('el sitio de la bio entra como landing cuando se pegó un @', () => {
  assert.deepEqual(canalDeLaBio(landing, 'instagram'), landing);
});

test('y si la bio enlaza su canal, entra como YouTube: ésa es «otra de sus redes»', () => {
  assert.deepEqual(canalDeLaBio(canal, 'instagram'), canal);
});

test('una bio que enlaza a Instagram NO se guarda como landing', () => {
  // Si pasara, el canal «landing» del competidor quedaría apuntando a instagram.com, que no es su
  // página de venta y es la red que ya estamos agregando.
  assert.equal(canalDeLaBio(otraIg, 'instagram'), null);
  // ⚠️ ESTE SEGUNDO CASO ES EL QUE VALE, y la primera versión de este test no lo tenía: con sólo el
  // de arriba, sacar la lista blanca de campos NO ponía el test en rojo, porque el descarte del
  // «mismo campo» devolvía null igual y tapaba el agujero. Pegando un canal de YouTube, la lista
  // blanca es lo ÚNICO que impide guardar instagram.com como su página de venta.
  assert.equal(canalDeLaBio(otraIg, 'youtube_id'), null);
  assert.equal(canalDeLaBio(otraIg, 'landing_url'), null);
});

test('una bio con texto en vez de un link no toca nada', () => {
  // El nombre lo pone el negocio; la biografía no decide cómo se llama su competidor.
  assert.equal(canalDeLaBio(texto, 'instagram'), null);
});

test('si la bio repite el canal que se pegó, no aporta nada', () => {
  assert.equal(canalDeLaBio(landing, 'landing_url'), null);
  assert.equal(canalDeLaBio(canal, 'youtube_id'), null);
});

test('sin bio (perfil que no se pudo leer) no hay canal nuevo', () => {
  assert.equal(canalDeLaBio(null, 'instagram'), null);
  assert.equal(canalDeLaBio(undefined, 'instagram'), null);
});

test('el canal que aporta es el MISMO objeto, sin reescribir el valor', () => {
  // El valor ya viene normalizado y topeado por `queEs` (500 caracteres, `https://` agregado a un
  // dominio pelado). Recortarlo o normalizarlo otra vez acá es cómo se rompen las URLs con query.
  const conQuery: CanalLeido = { campo: 'landing_url', valor: 'https://acme.com/vsl?utm_source=ig&id=7' };
  assert.deepEqual(canalDeLaBio(conQuery, 'instagram'), conQuery);
});
