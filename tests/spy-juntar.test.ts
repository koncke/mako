// =============================================================================
// Juntar dos cargas de la misma persona: las piezas se MUDAN, no se borran (6/11/2026)
// =============================================================================
// El pedido: «Competidores cargados dos veces con nombres distintos siguen duplicados. El cliente los ve repetidos y hay
// que borrarlos de a uno: borrar se lleva todas sus piezas y no se puede deshacer». El alta ya no los crea
// (`tests/spy-alta-duplicados.test.ts`); esto es para los que YA ESTÁN y para los pares que el alta no puede ver.
//
//   1. por qué se parecen: una cuenta compartida es un hecho, un nombre es un parecido, y un DOMINIO no se empareja
//      con una persona (lo dice el pedido: «acquisition.com» no se junta nunca con «@AlexHormozi»);
//   2. los nombres del pedido: «sofiacontreras» ≡ «Sofia Contreras», «hormozi» ⊂ «@AlexHormozi», y lo que NO empareja;
//   3. cuál queda: el que tiene más piezas leídas, nunca el nombre más lindo;
//   4. de a UN par por vuelta, y nadie entra en dos pares;
//   5. qué se completa y qué piezas se mudan (las que el que queda ya tiene no se pueden mudar: la tabla es única por
//      negocio, competidor, canal y ref);
//   6. el ORDEN en el servidor: mudar y DESPUÉS borrar, y la puerta del administrador.
//
// PROBADO ROMPIÉNDOLO (6/11/2026), una rotura por vez, base en verde (cada una, 1 rojo de 6):
//   · `mismoNombre` que acepta compartir UNA palabra de varias               → 2
//   · `mismoNombre` sin el largo mínimo de una palabra sola                  → 2
//   · `mismoNombre` que acepta el nombre en el MEDIO del otro                → 2
//   · `mismoNombre` contando palabras sobre el nombre NORMALIZADO            → 2
//   · `cualQueda` que decide por el id (el más viejo) en vez de las piezas    → 3
//   · `paresParecidos` sin `usados` (uno entra en dos pares)                  → 4
//   · `piezasQueSeMudan` que muda las que el que queda ya tiene               → 5
//   · `juntarCompetidores` que borra antes de mudar                           → 6
//   · `juntarCompetidoresAction` con `soloMiembro` en vez de `soloAdmin`      → 6
//
// ⚠️ Y LA ROTURA QUE ENCONTRÓ UN BUG DE VERDAD: cambiar el `every` de la rama de varias palabras por `some` NO ponía
// nada en rojo. La rama estaba MUERTA: las palabras se contaban sobre el nombre ya normalizado, y `nombreComparable`
// saca los espacios, así que «Ana Pérez» tenía UNA palabra («anaperez») y nunca entraba ahí. Se arregló contando sobre
// el nombre crudo, y ahora esa misma rotura sí cae.
//
// ⚠️ Lo que el caso 1 dice del DOMINIO documenta una decisión, no la vigila: en el código no existe ninguna comparación
// nombre-contra-dominio, así que ningún cambio de una línea lo pone en rojo. Está para que no se agregue.
// Correr: node --import tsx --test tests/spy-juntar.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EN_PALABRAS, camposQueSeCompletan, cualQueda, mismoNombre, paresParecidos, piezasQueSeMudan, porQueSeParecen,
  type CompetidorJuntable,
} from '../lib/spy-juntar-reglas';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const uno = (id: number, nombre: string, extra: Partial<CompetidorJuntable> = {}): CompetidorJuntable => ({
  id, nombre, instagram: null, youtube_id: null, tiktok: null, landing_url: null, pagina_anuncios: null,
  pais: null, avatar: null, mirado_en: null, ...extra,
});

test('1. por qué se parecen: una cuenta es un hecho, un dominio contra una persona no', () => {
  assert.equal(porQueSeParecen(uno(1, 'A', { instagram: 'hormozi' }), uno(2, 'B', { instagram: 'hormozi' })), 'instagram');
  assert.equal(porQueSeParecen(uno(1, 'A', { instagram: 'Hormozi' }), uno(2, 'B', { instagram: 'hormozi' })), 'instagram', 'el @ no distingue mayúsculas');
  assert.equal(porQueSeParecen(uno(1, 'A', { youtube_id: 'UC123' }), uno(2, 'B', { youtube_id: 'UC123' })), 'youtube');
  assert.equal(porQueSeParecen(uno(1, 'A', { tiktok: 'x' }), uno(2, 'B', { tiktok: 'x' })), 'tiktok');
  assert.equal(porQueSeParecen(uno(1, 'A', { pagina_anuncios: '98765' }), uno(2, 'B', { pagina_anuncios: '98765' })), 'anuncios');
  assert.equal(porQueSeParecen(uno(1, 'A', { landing_url: 'https://www.acquisition.com/x' }), uno(2, 'B', { landing_url: 'http://acquisition.com' })), 'web', 'el mismo dominio, con o sin www');

  // Lo que NO empareja.
  assert.equal(porQueSeParecen(uno(1, 'A'), uno(2, 'B')), null, 'dos sin nada en común');
  assert.equal(porQueSeParecen(uno(1, 'A', { instagram: null }), uno(2, 'B', { instagram: null })), null, 'dos vacíos no son iguales');
  assert.equal(porQueSeParecen(uno(1, 'A', { instagram: '  ' }), uno(2, 'B', { instagram: '' })), null);
  // ⚠️ EL CASO DEL PEDIDO: un dominio no se empareja con una persona.
  assert.equal(porQueSeParecen(uno(1, 'acquisition.com'), uno(2, '@AlexHormozi')), null, 'un dominio no es una persona');
  assert.equal(porQueSeParecen(uno(1, 'acquisition.com', { landing_url: 'https://acquisition.com' }), uno(2, '@AlexHormozi', { instagram: 'alexhormozi' })), null);

  // La certeza manda: con cuenta compartida Y nombre distinto, el motivo es la cuenta.
  assert.equal(porQueSeParecen(uno(1, 'Ana', { instagram: 'x' }), uno(2, 'Marcos', { instagram: 'x' })), 'instagram');
  for (const m of Object.keys(EN_PALABRAS)) assert.ok(EN_PALABRAS[m as keyof typeof EN_PALABRAS].length > 10, `${m} sin frase`);
});

test('2. los nombres del pedido', () => {
  assert.equal(mismoNombre('sofiacontreras', 'Sofia Contreras'), true, 'el caso que el alta ya mira');
  assert.equal(mismoNombre('hormozi', '@AlexHormozi'), true, 'una palabra adentro del otro nombre');
  assert.equal(mismoNombre('Sofia Contreras', 'Sofia Contreras Coach'), true, 'todas sus palabras están');
  // ⚠️ «Den Borg» y «den.borgg» NO emparejan por el nombre: los dos tienen dos palabras y `borgg` ≠ `borg`. En el caso
  // real comparten el Instagram (den.borgg es su @), que es un HECHO y no un parecido: `porQueSeParecen` los junta por ahí.
  assert.equal(mismoNombre('Den Borg', 'den.borgg'), false);
  assert.equal(porQueSeParecen(uno(1, 'Den Borg', { instagram: 'den.borgg' }), uno(2, 'den.borgg', { instagram: 'den.borgg' })), 'instagram');

  assert.equal(mismoNombre('Marcos Pérez', 'Ana Pérez'), false, 'compartir UN apellido no es ser la misma persona');
  assert.equal(mismoNombre('Ana', 'Juliana'), false, 'un nombre de tres letras adentro de otro no alcanza');
  assert.equal(mismoNombre('Borg', 'Cyborg'), false, 'cuatro letras tampoco: «borg» es sufijo de «cyborg» y no son la misma');
  assert.equal(mismoNombre('hormozi', 'xhormoziy'), false, 'adentro del MEDIO no cuenta: tiene que estar pegado a una punta');
  assert.equal(mismoNombre('', 'Ana'), false);
  assert.equal(mismoNombre('Ana', ''), false);
});

test('3. cuál queda: el que tiene más piezas leídas', () => {
  const a = uno(10, 'sofiacontreras');
  const b = uno(2, 'Sofia Contreras');
  // ⚠️ El de las piezas gana aunque tenga el nombre feo y el id más alto: el nombre se arregla, las piezas no.
  assert.equal(cualQueda(a, b, { 10: 200, 2: 3 }).queda.id, 10);
  assert.equal(cualQueda(a, b, { 10: 200, 2: 3 }).seVa.id, 2);
  assert.equal(cualQueda(b, a, { 10: 200, 2: 3 }).queda.id, 10, 'el orden en que llegan no decide');
  // Empatados en piezas: el que tiene más cuentas suyas.
  assert.equal(cualQueda(uno(1, 'A'), uno(2, 'B', { instagram: 'x', youtube_id: 'y' }), {}).queda.id, 2);
  // Empatados en todo: el más mirado, y al final el id más chico (el que se cargó primero).
  assert.equal(cualQueda(uno(1, 'A'), uno(2, 'B', { mirado_en: '2026-11-06T00:00:00Z' }), {}).queda.id, 2);
  assert.equal(cualQueda(uno(1, 'A'), uno(2, 'B'), {}).queda.id, 1);
});

test('4. de a un par por vuelta, y nadie entra en dos pares', () => {
  const tres = [uno(1, 'hormozi', { instagram: 'alexhormozi' }), uno(2, '@AlexHormozi', { instagram: 'alexhormozi' }), uno(3, 'Alex Hormozi', { instagram: 'alexhormozi' })];
  const pares = paresParecidos(tres, { 1: 50, 2: 1, 3: 1 });
  assert.equal(pares.length, 1, 'tres cargas dan UN par: el siguiente aparece al juntar el primero');
  assert.deepEqual(pares[0], { queda: 1, seVa: 2, motivo: 'instagram' });
  assert.deepEqual(paresParecidos([uno(1, 'A'), uno(2, 'B')]), [], 'sin parecidos, nada que ofrecer');
  assert.deepEqual(paresParecidos([]), []);

  // Dos pares distintos sí salen juntos.
  const cuatro = [uno(1, 'Ana', { instagram: 'ana' }), uno(2, 'Ana Coach', { instagram: 'ana' }), uno(3, 'Beto', { youtube_id: 'UCb' }), uno(4, 'Beto Fit', { youtube_id: 'UCb' })];
  assert.equal(paresParecidos(cuatro, { 1: 9, 3: 9 }).length, 2);
});

test('5. qué se completa y qué piezas se mudan', () => {
  const queda = uno(1, 'Ana', { instagram: 'ana', landing_url: null, pais: null });
  const seVa = uno(2, 'Ana Coach', { instagram: 'otra', landing_url: 'https://ana.com', pais: 'MX', avatar: 'https://x/f.jpg' });
  const c = camposQueSeCompletan(queda, seVa);
  assert.deepEqual(c, { landing_url: 'https://ana.com', pais: 'MX', avatar: 'https://x/f.jpg' });
  assert.equal('instagram' in c, false, '⚠️ nunca se pisa un dato del que queda: el cliente vio ESE');
  assert.deepEqual(camposQueSeCompletan(seVa, queda), {}, 'el que ya tiene todo no se completa con nada');

  // Las piezas: se mudan las que el que queda no tiene. La tabla es única por (negocio, competidor, canal, ref).
  const suyas = [{ id: 11, canal: 'instagram', ref: 'A' }, { id: 12, canal: 'instagram', ref: 'B' }, { id: 13, canal: 'youtube', ref: 'A' }];
  assert.deepEqual(piezasQueSeMudan(suyas, [{ canal: 'instagram', ref: 'B' }]), [11, 13], 'la repetida no se muda: chocaría y caería la mudanza entera');
  assert.deepEqual(piezasQueSeMudan(suyas, []), [11, 12, 13]);
  assert.deepEqual(piezasQueSeMudan(suyas, [{ canal: 'instagram', ref: 'A' }, { canal: 'instagram', ref: 'B' }, { canal: 'youtube', ref: 'A' }]), []);
  assert.deepEqual(piezasQueSeMudan([], [{ canal: 'instagram', ref: 'A' }]), []);
  // El mismo `ref` en OTRO canal es otra pieza.
  assert.deepEqual(piezasQueSeMudan([{ id: 20, canal: 'anuncios', ref: 'A' }], [{ canal: 'instagram', ref: 'A' }]), [20]);
});

test('6. el servidor: mudar y DESPUÉS borrar, y la puerta del administrador', () => {
  const j = sinComentarios(leer('lib/spy-juntar.ts'));
  // ⚠️ EL ORDEN ES LO QUE IMPORTA: `spy_piezas` tiene `on delete cascade`, así que borrar primero se lleva TODO lo leído.
  const mudanza = j.indexOf("update({ competidor_id: quedaId })");
  const borrado = j.indexOf('quitarCompetidor(seVaId)');
  assert.ok(mudanza > 0 && borrado > 0, 'tienen que estar los dos');
  assert.ok(mudanza < borrado, 'se muda ANTES de borrar: al revés, el cascade se lleva sus piezas y no hay vuelta atrás');
  assert.match(j, /if \(e3\) return \{ ok: false[\s\S]{0,200}?No borré a nadie/, 'si la mudanza se corta, no se borra nada');
  assert.match(j, /piezasQueSeMudan\(/, 'qué se muda lo decide la regla pura');
  assert.match(j, /if \(quedaId === seVaId\) return \{ ok: false/, 'juntar a alguien consigo mismo lo borraría');

  const a = sinComentarios(leer('app/competitor-spy/actions.ts'));
  const act = a.slice(a.indexOf('export async function juntarCompetidoresAction'), a.indexOf('export async function quitarCompetidorAction'));
  assert.ok(act.length > 80, 'el recorte es la acción');
  assert.match(act, /const no = await soloAdmin\(\);/, 'se lleva una fila del negocio: es del administrador, como borrar');
  assert.ok(act.indexOf('soloAdmin()') < act.indexOf('juntarCompetidores('), 'la puerta ANTES de tocar la base');

  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /puedeBorrar\r?\n?\s*\? paresParecidos\(/, 'quien no puede borrar no ve el aviso: un botón que siempre falla es peor que no estar');
  assert.match(app, /confirmLabel="Juntarlos"/);
  assert.match(app, /No se pierde ninguna pieza\./, 'la confirmación dice QUÉ PASA');
  assert.match(app, /if \(!r\.ok\) \{ setError\(r\.error\); return; \}\s*\r?\n\s*setJuntando\(null\);/, 'sólo se cierra si salió');
});
