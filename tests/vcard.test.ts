// =============================================================================
// La tarjeta de contacto de WhatsApp: leerla, y no decir que no llegó
// =============================================================================
// EL CASO (2026-08-13). Leila quiso cargar un lead desde el grupo de MaKo:
//
//   Leila — «Me puedes agregar MaKo este lead que asistió a la primera sesión?»
//   MaKo  — «no me pasaste el nombre ni los datos del contacto…»
//   Leila — «Aquí»   ← y compartió la TARJETA DE CONTACTO
//   MaKo  — «No me llegó ningún dato ni contacto.»
//
// El doer solo leía conversation / extendedText / image / document. Un
// `contactMessage` entraba, no producía ni texto ni adjunto, y MaKo afirmaba lo
// contrario de lo que había pasado.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerVcard, contactosDelMensaje, textoDeContactos } from '../lib/vcard';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

// El formato EXACTO que manda WhatsApp: TEL con parámetros y `waid`.
const VCARD_WA = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'N:Gudiño;German;;;',
  'FN:German Gudiño',
  'TEL;type=CELL;type=VOICE;waid=5491133445566:+54 9 11 3344-5566',
  'END:VCARD',
].join('\n');

test('Un vCard de WhatsApp da nombre y teléfono', () => {
  const c = leerVcard(VCARD_WA);
  assert.ok(c, 'no se pudo leer la tarjeta');
  assert.equal(c!.nombre, 'German Gudiño');
  // ⚠️ La clave viene como `TEL;type=CELL;…`, no como `TEL`. Comparar la línea
  // contra 'TEL' a secas deja el teléfono en null justo cuando el contacto viene
  // de WhatsApp — que es el 100% de los casos acá.
  assert.equal(c!.telefono, '5491133445566', 'se perdió el teléfono: ¿se volvió a comparar la clave sin cortar los parámetros?');
});

test('Prefiere el waid al número visible', () => {
  // El valor visible trae paréntesis y guiones de la agenda; `waid` es el
  // internacional limpio y es con el que después matchea su chat.
  const c = leerVcard(VCARD_WA);
  assert.ok(!/[()\-\s+]/.test(c!.telefono ?? ''), 'el teléfono quedó con formato de agenda');
});

test('Sin FN, arma el nombre desde N (apellido;nombre)', () => {
  const c = leerVcard('BEGIN:VCARD\nVERSION:3.0\nN:Fittipaldi;Leila;;;\nTEL:+5491100000000\nEND:VCARD');
  assert.equal(c!.nombre, 'Leila Fittipaldi', 'no dio vuelta apellido/nombre');
});

test('Aguanta las líneas cortadas del estándar', () => {
  // vCard parte las líneas largas y continúa con un espacio inicial. Sin
  // desdoblarlas, el nombre o el waid quedan partidos al medio.
  const c = leerVcard('BEGIN:VCARD\nFN:Nombre Muy Largo De\n  Una Persona\nTEL:+5491122334455\nEND:VCARD');
  assert.equal(c!.nombre, 'Nombre Muy Largo De Una Persona');
});

test('Lee un contacto y también VARIOS de una', () => {
  const uno = contactosDelMensaje({ contactMessage: { vcard: VCARD_WA } });
  assert.equal(uno.length, 1);
  // Compartir dos contactos juntos manda `contactsArrayMessage`. Con solo la
  // primera forma, ese mensaje se perdía entero y en silencio.
  const varios = contactosDelMensaje({
    contactsArrayMessage: { contacts: [{ vcard: VCARD_WA }, { vcard: 'BEGIN:VCARD\nFN:Ana Gomez\nTEL:+5491199887766\nEND:VCARD' }] },
  });
  assert.equal(varios.length, 2, 'se perdió el mensaje con varios contactos');
  assert.equal(varios[1].nombre, 'Ana Gomez');
});

test('Un vCard ilegible NO borra el contacto: queda el displayName', () => {
  // Es mejor un nombre solo que decirle a la persona que no llegó nada.
  const c = contactosDelMensaje({ contactMessage: { vcard: 'basura', displayName: 'German Gudiño' } });
  assert.equal(c.length, 1);
  assert.equal(c[0].nombre, 'German Gudiño');
  assert.equal(c[0].telefono, null);
});

test('Lo que no trae ningún dato no se propone', () => {
  assert.equal(leerVcard(''), null);
  assert.equal(leerVcard('BEGIN:VCARD\nVERSION:3.0\nEND:VCARD'), null);
  assert.deepEqual(contactosDelMensaje({}), []);
  assert.deepEqual(contactosDelMensaje(undefined), []);
});

test('El texto que ve el modelo trae el dato, no un placeholder', () => {
  const t = textoDeContactos(contactosDelMensaje({ contactMessage: { vcard: VCARD_WA } }));
  assert.match(t, /German Gudiño/);
  assert.match(t, /5491133445566/, 'el modelo recibe el contacto sin el teléfono: no va a poder proponer el lead');
});

test('CABLEADO: el doer lee la tarjeta y NO la manda al plan', () => {
  const doer = leer('../lib/mako-doer-in.ts');
  assert.ok(doer.includes('contactosDelMensaje('),
    'el doer volvió a ignorar los contactos: un `contactMessage` entra y no produce nada');

  const intencion = leer('../lib/mako-intencion.ts');
  assert.ok(/hayContacto/.test(intencion),
    'compartir un contacto no tiene intención propia: cae en el default («capturar») y el lead termina de tarea en el plan');
});

test('El mensaje del lead dice que TODAVÍA NO está cargado', async () => {
  const { mensajeLeadPropuesto } = await import('../lib/respuesta-doer');
  const m = mensajeLeadPropuesto('https://x/crm/revisar/abc', 'Enrique Duarte');

  // El caso: el modelo escribió «Anotado los datos de Enrique Duarte. Revisalo y
  // sumalo directo al CRM desde acá» y la clienta entendió que ya estaba cargado.
  assert.match(m, /Todavía no está cargado/i, 'el mensaje dejó de decir que el lead NO está en el CRM');
  assert.match(m, /Enrique Duarte/, 'no nombra a quién preparó: no se puede verificar que entendió bien');
  assert.match(m, /confirm/i, 'no dice qué falta para que entre');

  // Nada en pasado que suene a hecho.
  for (const p of [/^anotado/i, /\bya (lo )?(cargu|ingres|sum)/i, /\blisto\b/i]) {
    assert.ok(!p.test(m), `el mensaje volvió a sonar a hecho (${p})`);
  }
});

test('CABLEADO: el mensaje del lead lo escribe el CÓDIGO, no el modelo', () => {
  const doer = leer('../lib/mako-doer-in.ts');
  // Mismo tratamiento que el borrador del plan: el trabajo del modelo termina
  // cuando llama la tool. Dejarle redactar el estado de un dato es cómo «propuse»
  // se convirtió en «anotado».
  assert.ok(doer.includes('mensajeLeadPropuesto('),
    'la respuesta del lead volvió a ser la que redacta el modelo');
  assert.ok(/linkLead/.test(doer), 'no se captura el link que devolvió la tool');
  // El nombre sale del INPUT de la tool, no de lo que el modelo recuerde después.
  assert.ok(/nombreLead = String\(\(input as/.test(doer),
    'el nombre del lead dejó de salir del input de la tool');
});

test('CABLEADO: existe la tool para cargar el lead, y PROPONE', () => {
  const acciones = leer('../lib/mako-doer-acciones.ts');
  assert.ok(acciones.includes("name: 'proponer_lead'"),
    'MaKo volvió a quedarse sin forma de cargar un lead — y su respuesta promete que puede');
  const i = acciones.indexOf("case 'proponer_lead'");
  const caso = acciones.slice(i, acciones.indexOf('\n      case ', i + 10));
  assert.ok(caso.includes('crearPropuesta('), 'la tool dejó de proponer');
  assert.ok(!/from\('leads'\)/.test(caso), 'la tool escribe el lead directo: un canal PROPONE, una persona confirma');
  assert.ok(caso.includes('ref'), 'sin `ref` idempotente, el buffer de WhatsApp deja dos tarjetas del mismo lead');
});
