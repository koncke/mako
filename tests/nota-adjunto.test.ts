// =============================================================================
// El adjunto de una nota del lead (archivos e imágenes, como en los chats de MaKo)
// =============================================================================
// Pedido de Martín (12/10/2026, tercer feedback del CRM, punto 3): «las notas como los chats de
// MaKo». Mig 0267: cuatro columnas en `lead_audit` y el bucket privado `lead-notas`. El molde es el
// de las notas del curso (mig 0208, lib/curso-notas.ts).
//
// Verificado contra producción el 13/10/2026 en ws3 (scratchpad/adjunto-ws3.mts), y borrado al
// final: PUT multipart 200, el archivo en el bucket, un .exe rebota con 400, la nota se lee con su
// adjunto SIN la ruta, y la URL firmada devuelve el mismo contenido.
//
// Correr: npx tsx --test tests/nota-adjunto.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026), una rotura por vez, 5 tests: aceptar cualquier ruta del
// negocio (no sólo la del lead), guardar sin comprobar que el archivo llegó, mandar la ruta en el
// historial, descartar un archivo que una nota todavía nombra y agregar con la subida a medias:
// 4 / 1 cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathDeNotaLead, pathEsNotaDelLead, BUCKET_NOTAS_LEAD } from '../app/crm/notas-reglas';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
const UUID = '0b0f7a1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b';

test('la ruta: <ws>/<lead>/<uuid>, y sólo la de ESTE lead de ESTE negocio pasa', () => {
  assert.equal(BUCKET_NOTAS_LEAD, 'lead-notas');
  const p = pathDeNotaLead(3, 2615, UUID);
  assert.equal(p, `3/2615/${UUID}`);
  assert.equal(pathEsNotaDelLead(p, 3, 2615), true);
  assert.equal(pathEsNotaDelLead(p, 3, 2616), false, 'el archivo de otro lead');
  assert.equal(pathEsNotaDelLead(p, 4, 2615), false, 'el archivo de otro negocio');
  assert.equal(pathEsNotaDelLead(`3/2615/${UUID}/../x`, 3, 2615), false);
  assert.equal(pathEsNotaDelLead(`3/2615/nombre-de-cliente.pdf`, 3, 2615), false, 'el nombre original nunca va en la ruta');
  assert.equal(pathDeNotaLead(3, 2615, 'no-es-un-uuid'), null);
});

test('el alta valida TODO lo que manda el navegador antes de guardar', () => {
  const src = leer('app/crm/actions.ts');
  const f = src.slice(src.indexOf('export async function addLeadNoteAction'), src.indexOf('export async function addLeadNoteAction') + 2200);
  const insert = f.indexOf(".from('lead_audit').insert(");
  for (const guarda of ['pathEsNotaDelLead(adjunto.path, ws, id)', 'esMimeNota(adjunto.mime)', 'bytes > TOPE_NOTA_BYTES', '.exists(adjunto.path)', "if (!hay) throw new Error('El archivo no terminó de subir.');"]) {
    const i = f.indexOf(guarda);
    assert.ok(i > 0 && i < insert, `falta (o va después de guardar): ${guarda}`);
  }
  assert.match(f, /archivo_nombre: nombreDeAdjunto\(adjunto\.nombre\)/, 'el nombre viaja desde el navegador: se limpia');
});

test('la ruta del bucket no viaja a la pantalla: se abre por el id de la nota', () => {
  const leads = leer('lib/leads.ts');
  const sel = leads.slice(leads.indexOf('export async function getLeadAudit'), leads.indexOf('export async function getLeadAudit') + 500);
  assert.match(sel, /archivo_nombre, archivo_mime, archivo_bytes/);
  assert.doesNotMatch(sel, /archivo_path/, 'el historial manda la ruta del bucket al navegador');
  const acc = leer('app/crm/notas-actions.ts');
  assert.match(acc, /export async function urlAdjuntoNotaLeadAction\(leadId: number, notaId: number\)/);
  assert.match(acc, /createSignedUrl\(f\.archivo_path, VIDA_ADJUNTO_SEG/);
});

test('borrar la nota se lleva su archivo; descartar sólo uno de este lead y sin nota', () => {
  const acc = leer('app/crm/notas-actions.ts');
  const borrar = acc.slice(acc.indexOf('export async function borrarNotaLeadAction'), acc.indexOf('export async function borrarNotaLeadAction') + 1500);
  assert.match(borrar, /storage\.from\(BUCKET_NOTAS_LEAD\)\.remove\(\[r\.fila\.archivo_path\]\)/);
  const desc = acc.slice(acc.indexOf('export async function descartarAdjuntoNotaLeadAction'));
  assert.match(desc, /if \(!pathEsNotaDelLead\(path, g\.ws, leadId\)\) return/);
  assert.match(desc, /\.eq\('archivo_path', path\)\.limit\(1\)/, 'descartar borraría el archivo de una nota que ya lo nombra');
  assert.match(desc, /if \(\(usos \?\? \[\]\)\.length\) return \{ ok: true \};/, 'con una nota que lo nombra, descartar tiene que irse sin borrar');
});

test('la tarjeta: sube al elegir, deja agregar una nota que es sólo el archivo, y espera la subida', () => {
  const src = leer('app/crm/lead-view/NotasCard.tsx');
  assert.match(src, /accept=\{ACEPTA_NOTA\}/);
  assert.match(src, /subirConProgreso\(r\.signedUrl/);
  assert.match(src, /if \(\(!t && !adjunto\?\.path\) \|\| pending \|\| subiendo\) return;/, 'agregar con la subida a medias guarda una nota que nombra un archivo que no está');
  assert.match(src, /await addLeadNoteAction\(leadId, t, adj\)/);
  assert.match(src, /onClick=\{\(\) => void abrirAdjunto\(n\.id\)\}/);
});
