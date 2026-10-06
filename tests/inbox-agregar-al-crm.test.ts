import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// =============================================================================
// Las DOS bandejas suben el contacto al CRM, y el duplicado vuelve como DATO
// =============================================================================
// #830 era «allá funciona y acá no»: el alta desde una conversación existía desde el #381
// en la bandeja OFICIAL (Chatwoot) y no en la NO OFICIAL (Evolution) — que es la que quedó
// por default el 05/10/2026 y la que usa el chatbot. Para un contacto que escribió por
// WhatsApp y no estaba en el CRM, la única salida era irse a /crm a cargarlo a mano con el
// teléfono copiado.
//
// El guard es sobre el CONJUNTO («toda bandeja ofrece el alta»), que es lo que no se
// cumple solo: la pieza nueva nace en una pantalla y la de al lado se queda vieja sin que
// nada falle. Mira el FUENTE porque no es un error de tipos: las dos compilan perfecto.
//
// Probado rompiéndolo (05/10/2026), las tres veces 3 pasan / 1 falla y la que falla es la
// que corresponde: cambiando el rótulo del botón en EmpresaInbox.tsx cae «la bandeja NO
// OFICIAL»; con el `catch` de la action devuelto a `throw e` cae «DEVUELVE el choque»; y
// sacando el `leadId: id` del estado local cae «le pone el lead a la conversación».

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (rel: string) => readFileSync(RAIZ + rel, 'utf8').replace(/\r\n/g, '\n');

/** Las líneas de comentario se van ANTES que los bloques (un `//` puede abrir un `/*`). */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Cada bandeja, con el nombre con el que se la reporta. */
const BANDEJAS = [
  { quien: 'la bandeja NO OFICIAL (Evolution)', archivo: 'app/whatsapp/EmpresaInbox.tsx' },
  { quien: 'la bandeja OFICIAL (Chatwoot)', archivo: 'app/whatsapp/WhatsAppApp.tsx' },
];

for (const b of BANDEJAS) {
  test(`${b.quien} ofrece subir el contacto al CRM`, () => {
    const src = sinComentarios(leer(b.archivo));
    assert.match(src, /crearLeadDesdeWhatsappAction\(/, `${b.archivo}: no llama al alta del CRM`);
    assert.match(src, /\+ Agregar al CRM/, `${b.archivo}: no dibuja el botón de alta`);
  });
}

test('el alta desde una conversación DEVUELVE el choque, no lo tira', () => {
  const src = leer('app/crm/actions.ts');
  const ini = src.indexOf('export async function crearLeadDesdeWhatsappAction');
  assert.ok(ini > 0, 'no encontré la action del alta desde WhatsApp');
  // El bloque termina donde ARRANCA el siguiente export, no a los N caracteres: un recorte
  // por largo mira la función de al lado y da verde sobre esta función vacía.
  const fin = src.indexOf('\nexport ', ini + 10);
  assert.ok(fin > ini, 'no encontré el final de la action');
  const cuerpo = sinComentarios(src.slice(ini, fin));
  assert.ok(cuerpo.length < 1800, `el recorte mide ${cuerpo.length}: está mirando más que la action`);

  // Un `throw` acá llega al navegador como un mensaje genérico (Next redacta el error en
  // producción), así que los ids del duplicado —lo único que permite ofrecer «abre el que
  // ya tienes»— se pierden y la pantalla sólo puede mostrar un cartel.
  assert.doesNotMatch(cuerpo, /\bthrow\b/, 'la action tira en vez de devolver el choque');
  assert.match(cuerpo, /ChoqueDeLead/, 'la action no declara el choque en su tipo de retorno');
  assert.match(cuerpo, /coincidencias/, 'la action no devuelve con quién choca');
});

test('la bandeja no oficial le pone el lead a la conversación en el acto', () => {
  const src = leer('app/whatsapp/EmpresaInbox.tsx');
  const ini = src.indexOf('async function agregarAlCrm');
  assert.ok(ini > 0, 'no encontré agregarAlCrm');
  const fin = src.indexOf('\n  // Sincronizar', ini);
  assert.ok(fin > ini, 'no encontré el final de agregarAlCrm');
  const cuerpo = sinComentarios(src.slice(ini, fin));
  // La conversación se enlaza sola al lead por teléfono, pero en la PRÓXIMA carga: sin
  // escribirlo en el estado, el botón sigue ofreciendo el alta sobre un contacto que ya
  // está y el segundo clic choca con el duplicado.
  assert.match(cuerpo, /leadId: id/, 'no escribe el leadId en el estado local');
  // La caché es POR LÍNEA desde el 06/10/2026 (varios números por negocio).
  assert.match(cuerpo, /convsCache\.set\(linea \?\? '', upd\(convsCache\.get\(linea \?\? ''\) \?\? \[\]\)\)/, 'no actualiza el cache del inbox');
  assert.match(cuerpo, /setDetalleLeadId\(id\)/, 'no abre la ficha editable del lead');
});
