// =============================================================================
// El @ de Instagram como contacto en las propuestas de leads de la API de MaKo (23/10/2026)
// =============================================================================
// Pedido del chat «Ventas» (23/10/2026): el @ ya cuenta como contacto mínimo en el CRM (lib/contacto-minimo.ts), y la
// API de propuestas lo seguía rechazando y perdiendo. Lo que este test fija:
//   · proponer_leads descarta con la MISMA regla que el alta (`tieneContacto`), no con «email o teléfono»;
//   · el @ viaja en las cuatro puertas: el lote, proponer_lead fuera de WhatsApp, la tool de WhatsApp y el flujo
//     que escribe en el acto (hasta `createLead`);
//   · sin teléfono, el @ es la llave de idempotencia de proponer_lead (dos pedidos de la misma persona no son dos).
//
// Probado rompiéndolo (23/10/2026, este archivo, base 4 / 0), cada rotura → 1 fallo y 3 pases:
//   · el descarte del lote con `!email && !telefono`;
//   · `crearLeadsDePropuesta` sin pasarle el @ a createLead;
//   · proponer_lead (app y HTTP) sin el @ en los datos;
//   · la tool de WhatsApp con la llave sin el @.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFS } from '../lib/api-mako/areas/crm.def';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

function bloque(src: string, desde: string, hasta: RegExp): string {
  const ini = src.indexOf(desde);
  assert.ok(ini >= 0, `no encontré ${desde}`);
  const fin = src.slice(ini + desde.length).search(hasta);
  const cuerpo = fin < 0 ? src.slice(ini) : src.slice(ini, ini + desde.length + fin);
  assert.ok(cuerpo.length > 80 && cuerpo.length < 7000, `el recorte de ${desde} mide ${cuerpo.length}: está mirando otra cosa`);
  return cuerpo;
}

test('el lote descarta con la regla única del contacto mínimo, y el @ viaja en la fila', () => {
  const lote = bloque(sinComentarios(leer('lib/api-mako/areas/crm.helpers.ts')), 'export async function proponerLote(', /\nexport /);
  assert.match(lote, /if \(!tieneContacto\(\{ email, telefono, instagram \}\)\)/);
  assert.doesNotMatch(lote, /!email && !telefono/, 'la regla vieja dejaría afuera a quien sólo tiene el @');
  assert.match(lote, /const instagram = usuarioInstagram\(txt\(c\.instagram\)\);/);
  assert.match(lote, /filas\.push\(\{ nombre, email, telefono, instagram,/);
});

test('el flujo que escribe en el acto le pasa el @ a createLead', () => {
  const flujo = sinComentarios(leer('lib/api-mako/flujo.ts'));
  assert.match(flujo, /createLead\(\{ nombre: f\.nombre, email: f\.email, telefono: f\.telefono, instagram: usuarioInstagram\(f\.instagram\),/);
});

test('proponer_lead lleva el @ por la app, HTTP y WhatsApp, y sin teléfono es su llave', () => {
  const def = DEFS.find((d) => d.id === 'proponer_lead');
  assert.ok(def?.parametros.some((p) => p.nombre === 'instagram'), 'proponer_lead no declara el @');
  const run = bloque(sinComentarios(leer('lib/api-mako/areas/crm.run.ts')), '  proponer_lead: {', /\n {2}[a-z_]+: \{/);
  assert.match(run, /datos: \{ nombre, telefono: telefono \|\| null, email: s\(input\.email\) \?\? null, instagram,/);
  assert.match(run, /telefono \|\| \(instagram \? `ig:\$\{instagram\}`/);
});

test('la tool de WhatsApp también, con la misma llave', () => {
  const doer = bloque(sinComentarios(leer('lib/mako-doer-acciones.ts')), "case 'proponer_lead': {", /\n {6}case '/);
  assert.match(doer, /const instagram = usuarioInstagram\(str\(input, 'instagram'\)\);/);
  assert.match(doer, /telefono \|\| \(instagram \? `ig:\$\{instagram\}`/);
  assert.match(doer, /email: email \|\| null, instagram,/);
});
