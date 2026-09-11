// =============================================================================
// «Conectado» tiene que significar que WhatsApp contesta, no que existe una fila
// =============================================================================
// EL CASO, del 16/08/2026, con un cliente haciendo el onboarding en vivo. El paso «¿A
// dónde te mando los reportes?» murió con:
//
//   No se pudo preparar tu grupo de WhatsApp: Evolution 500:
//   {"status":500,"error":"Internal Server Error","response":{"message":
//    ["Error creating group","Error: Connection Closed"]}}
//
// Y el panel decía que WhatsApp estaba CONECTADO. Las dos cosas eran ciertas a la vez,
// porque medían cosas distintas. Endpoint por endpoint, sobre la MISMA instancia:
//
//   connectionState   -> 200 open      (lee la BASE de Evolution)
//   findContacts      -> 200           (lee la BASE de Evolution)
//   fetchAllGroups    -> 500 Closed    (habla con WHATSAPP)
//   whatsappNumbers   -> 428 Closed    (habla con WHATSAPP)
//
// O sea: `state: "open"` describe la fila, no la sesión. Un `restart` tampoco lo arregla
// —se probó, y siguió diciendo open con el socket muerto—: hace falta re-escanear el QR.
//
// Es la regla de la casa: un indicador que afirma la mitad verdadera de un proceso de dos
// pasos es peor que uno roto, porque nadie lo audita. Estos tests son la otra capa.
//
// PROBADO ROMPIÉNDOLO contra la versión desplegada antes de la revisión del 11/09 (2ae26f80):
// fallan 3 de 5 —la sonda que traía los grupos, el cableado del veredicto y esSesionCaida
// fuera de su módulo puro—. Pasan los dos que no cambiaron.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, p), 'utf8');
const evolution = leer('../lib/evolution.ts');
const canal = leer('../lib/mako-canal.ts');
const grupo = leer('../lib/mako-grupo.ts');

// ⚠️ SIN LOS COMENTARIOS. La primera versión de esto miraba el cuerpo crudo y
// fallaba por el comentario de adentro de la función, que NOMBRA los endpoints
// descartados justamente para explicar por qué no se usan. Un guard que se
// dispara con la explicación de por qué está bien es un guard que alguien va a
// terminar apagando.
const sinComentarios = (t: string) => t.replace(/^\s*\/\/.*$/gm, '');

// Se corta por el FIN DE FUNCIÓN y no por N caracteres: una ventana fija se
// queda corta en cuanto alguien escribe un comentario adentro, y entonces el
// guard falla sobre código correcto — que es la forma más rápida de que
// alguien lo apague.
const cuerpoDe = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  return i < 0 ? '' : src.slice(i, src.indexOf('\n}', i));
};

test('la sonda mira una operación que HABLA con WhatsApp', () => {
  assert.ok(/export async function socketVivo/.test(evolution), 'desapareció la sonda de sesión viva');
  // `findContacts` NO habla con WhatsApp —lee la base de Evolution y contesta 200 con el
  // socket muerto—, así que usarlo de sonda sería reproducir exactamente el bug con otro nombre.
  // ⚠️ LA SONDA SE MUDÓ DOS VECES. El 08/09 a `sondearSocket`, que devuelve TRES respuestas
  // en vez de un booleano —vivo / muerto / sin_respuesta— porque «no pude preguntar» no es
  // «está muerto». El 11/09 a `sondearSocketDetalle`, que además devuelve el status y el
  // mensaje de Evolution: el vigilante los necesita para decir POR QUÉ no puede comprobar.
  // Lo que este test protege no es un nombre, es que la pregunta se le haga a WhatsApp.
  assert.ok(/export async function sondearSocketDetalle/.test(evolution), 'desapareció la sonda con detalle');
  const cuerpo = sinComentarios(cuerpoDe(evolution, 'export async function sondearSocketDetalle('));
  assert.ok(/fetchBusinessProfile/.test(cuerpo), 'la sonda dejó de usar una operación que toca el socket');
  assert.ok(!/findContacts|connectionState/.test(cuerpo),
    'la sonda volvió a preguntarle a la base de Evolution en vez de a WhatsApp');
  // Y nadie vuelve a preguntar por su cuenta: dos sondas y una se queda vieja.
  const vivo = evolution.slice(evolution.indexOf('export async function socketVivo'), evolution.indexOf('export async function socketVivo') + 220);
  assert.ok(/sondearSocket\(/.test(vivo), 'socketVivo dejó de delegar en la sonda: hay dos sondas');
  assert.ok(/sondearSocketDetalle\(/.test(cuerpoDe(evolution, 'export async function sondearSocket(')),
    'sondearSocket dejó de delegar en sondearSocketDetalle: hay dos sondas');

  // ⚠️ MEDIDO EL 08/09/2026, y contradice a la cabecera de este archivo:
  // `whatsappNumbers` contestó **200** sobre la instancia MUERTA (mako_ws1),
  // no el 428 del 16/08. `fetchProfile` también: 200 con todos los campos en
  // null. O sea que los dos «hablan con WhatsApp» y aun así dan vivo sobre una
  // sesión cerrada — el «200 con el fallo adentro» de siempre.
  // Y EL 11/09 SE SUMARON DOS AL MISMO CAJÓN, medidos sobre la voz zombi:
  // `fetchPrivacySettings` y `fetchProfilePictureUrl` contestan 200 idéntico
  // viva o muerta. (La regex `fetchProfile` ya atrapa al segundo.)
  assert.ok(!/whatsappNumbers|fetchProfile|fetchPrivacySettings/.test(cuerpo),
    'la sonda cambió a un endpoint que contesta 200 con el socket muerto');

  // ⚠️ EL CASO CONTRARIO, que la versión del 08/09 no midió: una sonda que NO
  // PUEDE DECIR «VIVO». Esa versión traía los grupos y se defendía con «aunque
  // tarde». El 11/09, sobre la voz de MaKo VIVA —acababa de contestar un
  // «Hola?»—, `fetchAllGroups` no respondió ni con 90 s de tope. El panel dijo
  // «con error» sobre una línea perfecta y Martín leyó «no funcionó». Una sonda
  // que nunca dice «vivo» miente igual que una que nunca dice «muerto».
  assert.ok(!/fetchAllGroups/.test(cuerpo),
    'la sonda volvió a traer los grupos: en una cuenta grande no termina y nunca dice «vivo»');
});

test('el veredicto y el lector de errores están CABLEADOS, no solo escritos', () => {
  // tests/evolution-sonda.test.ts prueba las funciones puras con los bodies medidos; esto
  // prueba que se USAN. Sin esto, alguien vuelve a escribir en evFetch el lector inline de
  // `body.message` y las tres muertas vuelven a dar `sin_respuesta` con todos los tests en
  // verde (revisión adversarial del 11/09/2026).
  const fetchEv = sinComentarios(cuerpoDe(evolution, 'async function evFetch<'));
  assert.match(fetchEv, /detalle: mensajeEvolution\(body, res\.status\)/,
    'evFetch dejó de pasar el mensaje anidado de Evolution: la sonda vuelve a no ver «Connection Closed»');
  const sonda = sinComentarios(cuerpoDe(evolution, 'export async function sondearSocketDetalle('));
  assert.match(sonda, /veredictoSondeo\(/, 'la sonda dejó de decidir con el veredicto testeado');
  assert.ok(!/r\.status === 0 \?/.test(sonda), 'la sonda volvió a decidir el veredicto inline');
});

test('los DOS indicadores de «conectado» confirman con el socket', () => {
  // Son dos y hay que tocar los dos: el del canal del super-admin y el del workspace.
  // Arreglar uno solo deja al otro mintiendo, que es como esto empezó.
  //
  // ⚠️ SE ACEPTAN DOS FORMAS, y la segunda es MÁS fuerte que la que este test pedía. La
  // original confirmaba sólo el `conectado`: el `close` se creía a ojos cerrados, sobre el
  // mismo campo que la cabecera declara mentiroso EN LAS DOS DIRECCIONES. Un chequeo que
  // sólo desconfía cuando la respuesta le gusta no es un chequeo.
  //
  // ⚠️ Y SOBRE EL CUERPO DE CADA FUNCIÓN, no el archivo entero (revisión del 11/09/2026): en
  // lib/mako-canal.ts `conectarCanalMaKo` también sondea, así que sacarle el sondeo a
  // `estadoCanalMaKo` dejaba este test en verde.
  for (const [nombre, src, firma] of [
    ['estadoEnVivo (lib/evolution.ts)', evolution, 'export async function estadoEnVivo('],
    ['estadoCanalMaKo (lib/mako-canal.ts)', canal, 'export async function estadoCanalMaKo('],
  ] as const) {
    const c = cuerpoDe(src, firma);
    assert.ok(c.length > 0, `${nombre}: no encontré la función`);
    assert.ok(/socketVivo\(|sondearSocket\(/.test(c), `${nombre}: el estado dejó de confirmarse contra el socket`);
    const confirmaUnLado = /estado === 'conectado' && !\(await socketVivo\(/.test(c);
    const confirmaLosDos = /sondeo === 'vivo'/.test(c) && /sondearSocket\(/.test(c);
    assert.ok(confirmaUnLado || confirmaLosDos,
      `${nombre}: volvió a pintar «conectado» con solo mirar connectionState`);
  }
});

test('el error de MaKo no se le factura al número del cliente', () => {
  // Lo que leía el cliente era un volcado de JSON en el paso donde acababa de escribir su
  // teléfono: se lee como que lo escribió mal. Su número estaba perfecto.
  assert.ok(/esSesionCaida/.test(grupo), 'el paso del teléfono dejó de distinguir de quién es el problema');
  assert.ok(/es de nuestro lado/.test(grupo), 'se perdió la frase que le saca la culpa al cliente');
  // Y le tiene que decir qué hacer AHORA, que es seguir sin verificar.
  assert.ok(/sin verificar/.test(grupo), 'el mensaje no ofrece la salida que sí existe');
});

test('«sesión caída» no se confunde con un dato mal cargado', () => {
  // Los dos llegan como 500 de Evolution. Si se los mezcla, o se le echa la culpa al
  // cliente por algo nuestro, o se le esconde un error suyo que sí puede arreglar.
  // Vive en lib/evolution-sonda.ts desde el 11/09/2026 (puro, para testear el veredicto
  // con respuestas medidas); lib/evolution.ts lo re-exporta.
  const re = /export function esSesionCaida[\s\S]{0,220}?\}/.exec(leer('../lib/evolution-sonda.ts'));
  assert.ok(re, 'no encontré esSesionCaida');
  assert.ok(/connection closed/i.test(re[0]), 'dejó de reconocer el «Connection Closed» de Baileys');
  assert.ok(/428/.test(re[0]), 'dejó de reconocer el 428 «Precondition Required», que es el mismo problema');
});
