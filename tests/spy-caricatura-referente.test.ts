// =============================================================================
// Las 22 caricaturas que ya tenemos entran en la tarjeta de Spy, y evitan la tarjeta doble (2/11/2026)
// =============================================================================
// Martín, dos pedidos de la misma tarde:
//   a) «aprovechá todas las caricaturas que ya tenemos hechas de todos los gurús para ponerlas ahí
//      también… yo mismo voy a entrar a poner ese arroba, entonces ya directamente salen con la
//      caricatura correspondiente»;
//   b) «no pueden haber dos Alex Hormozi, no pueden haber dos Sofía Contreras. Si se analizó el
//      Instagram pero no el YouTube de alguien, y se detecta que ese YouTube es del mismo, que esa
//      data se cargue en ese que ya existía, no que se creen dos tarjetas diferentes».
//
// Las dos las resuelve la MISMA pieza, y por eso están en el mismo test: si sabemos que este
// competidor es tal referente, sabemos qué cara ponerle Y sabemos que no es uno nuevo.
//
// ⚠️ LO QUE LO HACE FUNCIONAR SIN CARGAR NADA: `nombreComparable` borra tildes, espacios y signos,
// así que el @, el nombre corto y el nombre completo colapsan al MISMO texto. Por eso no hay una
// tabla de arrobas que mantener —y que se desactualizaría cuando alguien cambia su usuario—.
//
// ⚠️ EL HUECO QUE ESTO TAPA, Y QUE LA DEDUPLICACIÓN DEL 2/11 NO CUBRÍA: pegar el YouTube de alguien
// guardaba el nombre `UCxxxxxx` (el id del canal), que no se parece a «Alex Hormozi» en nada. La
// deduplicación por nombre no los juntaba y salía la segunda tarjeta. Ahora, si lo pegado y el que
// ya está son el mismo referente, es la misma persona.
//
// PROBADO ROMPIÉNDOLO (2/11/2026), con el archivo en 9 / 0, una rotura por vez y restaurada:
//   · `MINIMO_PARA_EMPAREJAR` en 2 (cualquier sigla emparejaría con alguien)   → 8 / 1
//   · `referenteDeCompetidor` que también prueba un `youtube_id` sin `@`        → 8 / 1
//   · `comoAQuienMira` que manda una landing como `nombre`                      → 8 / 1
//   · el mapa sin la forma `completo` (sólo el nombre corto y el id)            → 7 / 2
// ⚠️ LA SEGUNDA ROTURA NO SE CAZABA EN LA PRIMERA VERSIÓN: quedaba en 9 / 0, porque el único caso
//    que probaba era un `UCxxxxxx`, y ése no se parece al nombre de nadie con o sin la guarda. El
//    caso que discrimina es un NOMBRE suelto en la columna `youtube_id`. Es la misma trampa que en
//    `spy-canal-de-la-bio`: si otra cosa del camino devuelve lo mismo, el test pasa con el código
//    roto. Un test de rechazo tiene que elegir el caso donde ESA regla es la única que puede
//    rechazar (docs/hallazgos-competitors-spy.md).
// Correr: node --import tsx --test tests/spy-caricatura-referente.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  MINIMO_PARA_EMPAREJAR, caricaturaDeCompetidor, comoAQuienMira, nombreDeReferente, nombreDeTarjeta, referenteDeCompetidor,
} from '../lib/spy-caricatura';
import { ASESORES } from '../lib/asesores/catalogo';

test('el @ de Instagram encuentra la caricatura, sin tabla de arrobas', () => {
  // 'alexhormozi' y 'Alex Hormozi' colapsan al mismo texto comparable.
  assert.equal(referenteDeCompetidor({ instagram: 'alexhormozi' }), 'hormozi');
  assert.equal(caricaturaDeCompetidor({ instagram: 'alexhormozi' }), '/asesores/grandes/hormozi.png');
});

test('TODO referente tiene su cara grande, y la chica sigue siendo liviana', () => {
  // ⚠️ SON DOS ARCHIVOS A PROPÓSITO y los dos tienen que existir, o la tarjeta de Spy muestra un
  // hueco. El chico (200 px) lo baja la lista de chats del Ops Center y tiene tope de peso
  // (tests/coaches-ops-center.test.ts); el grande (600 px) lo pide la tarjeta, que es cuadrada y a
  // sangre. Agrandar el chico en vez de agregar el grande ponía en rojo aquel test: 159 KB contra
  // un tope de 150. Esto se cayó de verdad el 2/11/2026 antes de subirlo.
  const raiz = join(__dirname, '..');
  for (const a of ASESORES) {
    const grande = join(raiz, 'public/asesores/grandes', `${a.id}.png`);
    assert.ok(existsSync(grande), `${a.id} no tiene cara grande: la tarjeta de Spy quedaría vacía`);
    const chica = join(raiz, 'public/asesores', `${a.id}.png`);
    assert.ok(statSync(chica).size < 150_000, `${a.id}: la cara chica se baja en cada lista de chats y no puede pesar`);
  }
});

test('el nombre completo y el nombre corto también lo encuentran', () => {
  assert.equal(referenteDeCompetidor({ nombre: 'Alex Hormozi' }), 'hormozi');
  assert.equal(referenteDeCompetidor({ nombre: 'hormozi' }), 'hormozi');
});

test('las tildes no estorban: Sofía Contreras y sofiacontreras son la misma', () => {
  // Son exactamente los duplicados que Martín tenía en producción.
  const porNombre = referenteDeCompetidor({ nombre: 'Sofía Contreras' });
  const porArroba = referenteDeCompetidor({ instagram: 'sofiacontreras' });
  assert.equal(porNombre, 'sofia-contreras');
  assert.equal(porArroba, porNombre);
});

test('un handle de YouTube sirve; lo que no es un handle NO se empareja', () => {
  assert.equal(referenteDeCompetidor({ youtube_id: '@julianalborna' }), 'julian-alborna');
  // `UCxxxxxx` no se parece al nombre de nadie, así que el prefijo ya lo protege solo.
  assert.equal(referenteDeCompetidor({ youtube_id: 'UCjulianalborna999' }), null);
  // ⚠️ ÉSTE ES EL CASO QUE PRUEBA LA GUARDA, y la primera versión de este test no lo tenía: un
  // nombre suelto metido en la columna `youtube_id` —a mano, o por una reparación de datos— NO es
  // un canal, y emparejarlo pondría la cara de Hormozi en una tarjeta cuyo canal no sabemos de
  // quién es. La columna guarda `UCxxxx`, `@handle` o `user:algo`; cualquier otra cosa es un dato
  // roto y no se usa para decidir una identidad.
  assert.equal(referenteDeCompetidor({ youtube_id: 'Alex Hormozi' }), null);
});

test('EL CASO QUE PIDIÓ MARTÍN: su @ y su canal resuelven al MISMO referente', () => {
  // Con esto, pegar su YouTube cae sobre la tarjeta que ya existía por su Instagram en vez de crear
  // una segunda. Los nombres guardados no se parecen en nada; el referente sí.
  const porInstagram = referenteDeCompetidor({ instagram: 'imangadzhi' });
  const porYoutube = referenteDeCompetidor({ youtube_id: '@ImanGadzhi' });
  assert.equal(porInstagram, 'iman-gadzhi');
  assert.equal(porYoutube, porInstagram);
});

test('la tarjeta se titula con su nombre real aunque esté guardado el @', () => {
  // ⚠️ VISTO EN PRODUCCIÓN el 2/11/2026: una tarjeta decía «@AlexHormozi». El alta guarda el nombre
  // completo desde hoy, pero los competidores que YA estaban se guardaron con lo que se pegó.
  assert.equal(nombreDeTarjeta({ nombre: '@AlexHormozi', instagram: 'alexhormozi' }), 'Alex Hormozi');
  assert.equal(nombreDeTarjeta({ nombre: 'hormozi' }), 'Alex Hormozi');
  assert.equal(nombreDeTarjeta({ nombre: 'sofiacontreras' }), 'Sofía Contreras');
});

test('pero NO pisa el nombre que el negocio le puso', () => {
  // Reescribir esto sería cambiarle un dato suyo sin que lo pida.
  assert.equal(nombreDeTarjeta({ nombre: 'Hormozi (competencia directa)', instagram: 'alexhormozi' }), 'Hormozi (competencia directa)');
  assert.equal(nombreDeTarjeta({ nombre: 'Panadería La Esquina' }), 'Panadería La Esquina');
});

test('se guarda su nombre de verdad, que es lo que junta las dos tarjetas', () => {
  assert.equal(nombreDeReferente('hormozi'), 'Alex Hormozi');
  assert.equal(nombreDeReferente('agustin-nievas'), 'Agustín Nievas');
});

test('una sigla corta no empareja con nadie', () => {
  // Sin el tope, un competidor llamado «Ads» o «IA» se llevaría la cara de un desconocido.
  assert.ok(MINIMO_PARA_EMPAREJAR >= 6, 'el tope tiene que dejar afuera los nombres de dos sílabas');
  assert.equal(referenteDeCompetidor({ nombre: 'Ads' }), null);
  assert.equal(referenteDeCompetidor({ nombre: 'IA' }), null);
});

test('alguien que no es referente no recibe ninguna cara', () => {
  assert.equal(referenteDeCompetidor({ nombre: 'Panadería La Esquina', instagram: 'panaderialaesquina' }), null);
  assert.equal(caricaturaDeCompetidor({ nombre: 'Panadería La Esquina' }), null);
});

test('una landing no se empareja con una persona', () => {
  // `acquisition.com` colapsa a 'acquisitioncom'. Juntar un dominio con alguien necesita una tabla
  // de dominios, que es otra cosa; mandarlo como `nombre` sería adivinar.
  assert.deepEqual(comoAQuienMira({ campo: 'landing_url', valor: 'https://acquisition.com' }), {});
  assert.equal(referenteDeCompetidor(comoAQuienMira({ campo: 'landing_url', valor: 'https://acquisition.com' })), null);
  // Y las otras tres formas sí viajan al campo que les corresponde.
  assert.deepEqual(comoAQuienMira({ campo: 'instagram', valor: 'alexhormozi' }), { instagram: 'alexhormozi' });
  assert.deepEqual(comoAQuienMira({ campo: 'youtube_id', valor: '@ImanGadzhi' }), { youtube_id: '@ImanGadzhi' });
  assert.deepEqual(comoAQuienMira({ campo: 'nombre', valor: 'Alex Hormozi' }), { nombre: 'Alex Hormozi' });
});
