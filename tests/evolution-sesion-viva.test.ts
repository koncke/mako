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
  const cuerpo = evolution.slice(evolution.indexOf('export async function socketVivo'), evolution.indexOf('export async function socketVivo') + 320);
  assert.ok(/fetchAllGroups/.test(cuerpo), 'la sonda dejó de usar una operación que toca el socket');
  assert.ok(!/findContacts|connectionState/.test(cuerpo),
    'la sonda volvió a preguntarle a la base de Evolution en vez de a WhatsApp');
});

test('los DOS indicadores de «conectado» confirman con el socket', () => {
  // Son dos y hay que tocar los dos: el del canal del super-admin y el del workspace.
  // Arreglar uno solo deja al otro mintiendo, que es como esto empezó.
  for (const [nombre, src] of [['lib/evolution.ts', evolution], ['lib/mako-canal.ts', canal]] as const) {
    assert.ok(/socketVivo\(/.test(src), `${nombre}: el estado dejó de confirmarse contra el socket`);
    assert.ok(/estado === 'conectado' && !\(await socketVivo\(/.test(src),
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
