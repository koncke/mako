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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, p), 'utf8');
const evolution = leer('../lib/evolution.ts');
const canal = leer('../lib/mako-canal.ts');
const grupo = leer('../lib/mako-grupo.ts');

test('la sonda mira una operación que HABLA con WhatsApp', () => {
  assert.ok(/export async function socketVivo/.test(evolution), 'desapareció la sonda de sesión viva');
  // `fetchAllGroups` obliga a hablar con WhatsApp. `findContacts` NO —lee la base de
  // Evolution y contesta 200 con el socket muerto—, así que usarlo de sonda sería
  // reproducir exactamente el bug con otro nombre.
  // ⚠️ LA SONDA SE MUDÓ (08/09/2026) y este assert la seguía buscando en el
  // cuerpo de `socketVivo`, que ahora sólo delega. La sonda de verdad es
  // `sondearSocket`, que devuelve TRES respuestas en vez de un booleano —
  // vivo / muerto / sin_respuesta— porque «no pude preguntar» no es «está
  // muerto», y con el chip nuevo esa confusión manda a re-escanear un QR que
  // tumbaría una sesión viva. El guard se sigue sobre la función nueva: lo que
  // este test protege no es un nombre, es que la pregunta se le haga a WhatsApp.
  assert.ok(/export async function sondearSocket/.test(evolution), 'desapareció la sonda de tres estados');
  // Se corta por el FIN DE FUNCIÓN y no por N caracteres: una ventana fija se
  // queda corta en cuanto alguien escribe un comentario adentro, y entonces el
  // guard falla sobre código correcto — que es la forma más rápida de que
  // alguien lo apague.
  const desde = evolution.indexOf('export async function sondearSocket');
  // ⚠️ SIN LOS COMENTARIOS. La primera versión de esto miraba el cuerpo crudo y
  // fallaba por el comentario de adentro de la función, que NOMBRA los endpoints
  // descartados justamente para explicar por qué no se usan. Un guard que se
  // dispara con la explicación de por qué está bien es un guard que alguien va a
  // terminar apagando.
  const sinComentarios = (t: string) => t.replace(/^\s*\/\/.*$/gm, '');
  const cuerpo = sinComentarios(evolution.slice(desde, evolution.indexOf('\n}', desde)));
  assert.ok(/fetchAllGroups/.test(cuerpo), 'la sonda dejó de usar una operación que toca el socket');
  assert.ok(!/findContacts|connectionState/.test(cuerpo),
    'la sonda volvió a preguntarle a la base de Evolution en vez de a WhatsApp');
  // Y `socketVivo` no puede volver a preguntar por su cuenta: si lo hiciera,
  // habría dos sondas y una se quedaría vieja.
  const vivo = evolution.slice(evolution.indexOf('export async function socketVivo'), evolution.indexOf('export async function socketVivo') + 220);
  assert.ok(/sondearSocket/.test(vivo), 'socketVivo dejó de delegar en la sonda: hay dos sondas');

  // ⚠️ MEDIDO EL 08/09/2026, y contradice a la cabecera de este archivo:
  // `whatsappNumbers` contestó **200** sobre la instancia MUERTA (mako_ws1),
  // no el 428 del 16/08. `fetchProfile` también: 200 con todos los campos en
  // null. O sea que los dos «hablan con WhatsApp» y aun así dan vivo sobre una
  // sesión cerrada — el «200 con el fallo adentro» de siempre. El único que
  // sigue sirviendo es traer los grupos, y por eso no se cambia por uno más
  // barato aunque tarde: `mako_ws11` timeoutea a los 30s y la respuesta a eso
  // es un presupuesto por llamada, no una sonda peor.
  assert.ok(!/whatsappNumbers|fetchProfile/.test(cuerpo),
    'la sonda cambió a un endpoint que contesta 200 con el socket muerto');
});

test('los DOS indicadores de «conectado» confirman con el socket', () => {
  // Son dos y hay que tocar los dos: el del canal del super-admin y el del workspace.
  // Arreglar uno solo deja al otro mintiendo, que es como esto empezó.
  for (const [nombre, src] of [['lib/evolution.ts', evolution], ['lib/mako-canal.ts', canal]] as const) {
    // ⚠️ SE ACEPTAN DOS FORMAS, y la segunda es MÁS fuerte que la que este test
    // pedía. La original confirmaba sólo el `conectado`: el `close` se creía a
    // ojos cerrados, sobre el mismo campo que la cabecera de acá arriba declara
    // mentiroso EN LAS DOS DIRECCIONES. Un chequeo que sólo desconfía cuando la
    // respuesta le gusta no es un chequeo. `lib/evolution.ts` ahora decide el
    // estado con la sonda en los dos sentidos (`sondeo === 'vivo' ? … : 'muerto' ? …`),
    // así que ya no contiene el patrón viejo — y rechazarlo por eso sería el
    // guard frenando justo la mejora que venía a pedir.
    assert.ok(/socketVivo\(|sondearSocket\(/.test(src), `${nombre}: el estado dejó de confirmarse contra el socket`);
    const confirmaUnLado = /estado === 'conectado' && !\(await socketVivo\(/.test(src);
    const confirmaLosDos = /sondeo === 'vivo'/.test(src) && /sondearSocket\(/.test(src);
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
  const re = /export function esSesionCaida[\s\S]{0,220}?\}/.exec(evolution);
  assert.ok(re, 'no encontré esSesionCaida');
  assert.ok(/connection closed/i.test(re[0]), 'dejó de reconocer el «Connection Closed» de Baileys');
  assert.ok(/428/.test(re[0]), 'dejó de reconocer el 428 «Precondition Required», que es el mismo problema');
});
