import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { destinoDelAlta, nombreVisible, pideProducto, productosParaAlta } from '../lib/lead-funnel-reglas';

// =============================================================================
// La bandeja sube el contacto al CRM, y el duplicado vuelve como DATO
// =============================================================================
// ⛔ Hasta el 09/10/2026 eran DOS bandejas: la OFICIAL (Chatwoot, en WhatsAppApp.tsx) se borró
// con toda la integración (tests/sin-chatwoot.test.ts). Queda la NO OFICIAL; la lista de abajo
// sigue siendo una lista para que una bandeja nueva entre al mismo guard.
//
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
//
// ── Y EL LEAD NACE EN EL PRODUCTO ELEGIDO (08/10/2026) ──────────────────────────
// Pedido de Leila (ws11), en un audio: «tengo a Nora Ricardi, ya la agregué al CRM. Pero…
// ella está en marca personal. Primero de por sí me entra al funnel principal, o sea que la
// tengo que eliminar de funnel principal». Medido ese día: los 6 leads que había subido desde
// WhatsApp nacieron en el principal, a los 6 los agregó a mano a otro producto y a 4 los sacó
// del principal después. El botón no preguntaba y la action no recibía el dato.
//
// Desde acá: con 2+ productos el clic abre la lista (BotonAgregarAlCrm, compartido por las
// dos bandejas), la action recibe el producto y lo resuelve `destinoDelAlta` (puro, se
// EJECUTA abajo), que escribe la casa con `casaParaEscribir` y no crea a ciegas cuando la
// lista no se pudo leer. Lo que no se puede ejecutar sin base se mira sobre el fuente.
//
// PROBADO ROMPIÉNDOLO (08/10/2026): ver el pie.

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (rel: string) => readFileSync(RAIZ + rel, 'utf8').replace(/\r\n/g, '\n');

/** Las líneas de comentario se van ANTES que los bloques (un `//` puede abrir un `/*`). */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Cada bandeja, con el nombre con el que se la reporta. */
const BANDEJAS = [
  { quien: 'la bandeja NO OFICIAL (Evolution)', archivo: 'app/whatsapp/EmpresaInbox.tsx' },
];

for (const b of BANDEJAS) {
  test(`${b.quien} ofrece subir el contacto al CRM, en el producto elegido`, () => {
    const src = sinComentarios(leer(b.archivo));
    assert.match(src, /crearLeadDesdeWhatsappAction\(/, `${b.archivo}: no llama al alta del CRM`);
    // El botón es UNO para las dos (el rótulo vive en BotonAgregarAlCrm): dos copias son la
    // forma de que una se quede vieja, que es exactamente el #830.
    assert.match(src, /<BotonAgregarAlCrm\b[^>]*\bproductos=\{productosAlta\}/, `${b.archivo}: no dibuja el botón de alta con los productos`);
    // ⚠️ Y LE PASA EL PRODUCTO a la action: sin el tercer argumento el server no lo sabe y el
    // lead nace en el principal, que es el bug de Leila.
    assert.match(src, /crearLeadDesdeWhatsappAction\([^)]*,\s*funnelId\)/, `${b.archivo}: el alta no le pasa el producto elegido a la action`);
    // Si el server devuelve la lista (no se eligió y hay 2+), la bandeja pasa a preguntar.
    assert.match(src, /setProductosAlta\(r\.elegir\)/, `${b.archivo}: si el server pide elegir, la bandeja no muestra la lista`);
  });
}

test('el botón compartido pregunta el producto sólo con 2+, y con la lista caída deja decidir al server', () => {
  const src = sinComentarios(leer('app/whatsapp/_shared/BotonAgregarAlCrm.tsx'));
  assert.match(src, /\+ Agregar al CRM/, 'no dibuja el rótulo del alta');
  // `null` («no pude leer») va por el botón de un clic con `null`: NO es «hay uno» —eso sería
  // crear en el principal sin preguntar— porque el server relee y, con 2+, pide elegir.
  assert.match(src, /if \(!productos \|\| !pideProducto\(productos\)\)/, 'la regla de cuándo preguntar no es `pideProducto`, o no distingue la lista caída');
  assert.match(src, /onAgregar\(null\)/, 'el clic único no deja la decisión al server');
  assert.match(src, /<Dropdown\b[^>]*value=""[^>]*resetAfterSelect/, 'el menú no es un menú de acción (vuelve al rótulo después de elegir)');
  // ⚠️ Sin preselección: ni «el último usado» ni localStorage (una preferencia no pisa una decisión).
  assert.doesNotMatch(src, /localStorage|sessionStorage/, 'el botón preselecciona un producto guardado');
});

test('los DOS montajes de la bandeja le pasan los productos (page.tsx y el cierre del wizard)', () => {
  // ⚠️ OnboardingCanalWhatsApp.tsx monta <WhatsAppApp /> al cerrar el wizard, sin volver al
  // server: con `productos` opcional ese camino lo dejaba caer y volvía el clic único. La prop
  // es obligatoria (el compilador ya lo exige); esto cubre además a quien la pase en `undefined`.
  const archivos = (readdirSync(RAIZ + 'app', { recursive: true }) as string[])
    .map((f) => 'app/' + f.replace(/\\/g, '/'))
    .filter((f) => f.endsWith('.tsx'));
  let montajes = 0;
  for (const f of archivos) {
    const crudo = leer(f);
    // Filtro barato antes de sacar comentarios: barrer todo app/ con el regex tarda segundos.
    if (!/<(WhatsAppApp|OnboardingCanalWhatsApp|EmpresaInbox)\b/.test(crudo)) continue;
    const src = sinComentarios(crudo);
    for (const m of src.matchAll(/<(WhatsAppApp|OnboardingCanalWhatsApp|EmpresaInbox)\b[^>]*>/g)) {
      montajes++;
      assert.match(m[0], /\bproductos=\{productos\}/, `${f}: <${m[1]}> se monta sin los productos del alta`);
    }
  }
  // page.tsx: 1 del wizard + 1 de la bandeja · el wizard: 1 · WhatsAppApp: 1 de EmpresaInbox.
  // (Eran 5: page.tsx tenía un segundo montaje del wizard para el canal oficial, que se fue con
  // Chatwoot el 09/10/2026.)
  assert.equal(montajes, 4, `encontré ${montajes} montajes: el barrido no está mirando lo que debe`);
  // Y page.tsx los lee con `leerFunnels` (null = falló), no con `listarFunnels` ([] = falló).
  const page = sinComentarios(leer('app/whatsapp/page.tsx'));
  assert.match(page, /leerFunnels\(\)/, 'page.tsx no lee los productos con leerFunnels: una lectura caída se lee como «hay uno»');
  assert.match(page, /productosParaAlta\(funnels\)/, 'page.tsx arma la lista sin la regla del nombre');
});

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
  assert.match(cuerpo, /AltaDesdeWhatsapp/, 'la action no declara el choque en su tipo de retorno');
  assert.match(src, /export type AltaDesdeWhatsapp = \{ id: number \} \| \(ChoqueDeLead &/, 'el tipo de retorno dejó de ser el choque');
  assert.match(cuerpo, /coincidencias/, 'la action no devuelve con quién choca');
});

test('⚠️ el alta RECIBE el producto, lo valida y escribe la casa por casaParaEscribir', () => {
  const src = leer('app/crm/actions.ts');
  const ini = src.indexOf('export async function crearLeadDesdeWhatsappAction');
  const cuerpo = sinComentarios(src.slice(ini, src.indexOf('\nexport ', ini + 10)));
  assert.match(cuerpo, /crearLeadDesdeWhatsappAction\(nombre: string, telefono: string, funnelId\?: number \| null\)/, 'la action no recibe el producto');
  // La validación y la casa las decide `destinoDelAlta` (se ejecuta abajo), con la lectura
  // que DISTINGUE el fallo: `listarFunnels` devuelve [] y eso es «hay uno» o «no existe».
  assert.match(cuerpo, /destinoDelAlta\(await leerFunnels\(\), funnelId\)/, 'la action no valida el producto contra los embudos del workspace');
  assert.doesNotMatch(cuerpo, /listarFunnels/, 'la action lee con listarFunnels: una lectura caída sale como «no existe»');
  assert.match(cuerpo, /if \('error' in destino\) return \{ error: destino\.error, coincidencias: \[\], elegir: destino\.elegir \}/, 'un producto inválido (o la lista caída) no corta el alta');
  // ⚠️ createLead escribe lo que le llega: el id del default escrito deja al lead invisible en
  // TODOS los tableros. `destino.casa` es la salida de `casaParaEscribir`.
  assert.match(cuerpo, /createLead\(\{[^}]*funnel_id: destino\.casa[^}]*\}\)/, 'el lead no nace en el producto elegido');
  assert.match(cuerpo, /choqueDeLead\(e, destino\.casa\)/, '`estaAca` no se mide contra el producto elegido');
  // La persona que ya estaba se AGREGA al elegido (una fila más, la casa intacta), nunca se mueve.
  assert.match(cuerpo, /agregarAProducto\(una\.id, destino\.real\)/, 'una persona que ya existía no se agrega al producto elegido');
  assert.doesNotMatch(cuerpo, /moverLeadDeFunnel|update\(\{\s*funnel_id/, 'la persona que ya existía se MUEVE de producto');
});

test('leerFunnels devuelve null cuando la lectura falla (y listarFunnels sigue en [])', () => {
  const fn = leer('lib/funnels.ts');
  const ini = fn.indexOf('export async function leerFunnels');
  assert.ok(ini > 0, 'no encontré leerFunnels');
  const cuerpo = sinComentarios(fn.slice(ini, fn.indexOf('\nexport ', ini + 10)));
  assert.equal(cuerpo.match(/return null;/g)?.length, 2, 'leerFunnels no devuelve null en los dos caminos de error');
  assert.doesNotMatch(cuerpo, /return \[\];/, 'leerFunnels vuelve a confundir «no pude leer» con «no hay»');
  assert.match(fn, /export async function listarFunnels\(\): Promise<FunnelResumen\[\]> \{\s*return \(await leerFunnels\(\)\) \?\? \[\];/, 'listarFunnels dejó de ser leerFunnels con [] (dos lecturas que se desincronizan)');
});

// ── destinoDelAlta, ejecutado ─────────────────────────────────────────────────

const DEF = { id: 4, nombre: 'Funnel principal', producto: null, esDefault: true };
const MARCA = { id: 18, nombre: 'Funnel principal', producto: 'Marca Personal', esDefault: false };
const CAPA = { id: 23, nombre: 'Capacitaciones para Empresas', producto: '  ', esDefault: false };

test('⚠️ el producto del negocio nace NULL; otro producto nace con su id', () => {
  assert.deepEqual(destinoDelAlta([DEF, MARCA, CAPA], 18), { casa: 18, real: 18, nombre: 'Marca Personal' });
  // El default elegido a mano: la casa va NULL (con su id escrito el lead no sale en ningún
  // tablero), pero el id real viaja, para agregar ahí a una persona que ya existía.
  assert.deepEqual(destinoDelAlta([DEF, MARCA, CAPA], 4), { casa: null, real: 4, nombre: 'Funnel principal' });
});

test('sin elegir: con 0-1 producto nace en el del negocio; con 2+ NO crea y devuelve la lista', () => {
  assert.deepEqual(destinoDelAlta([DEF], null), { casa: null, real: null, nombre: null });
  assert.deepEqual(destinoDelAlta([], undefined), { casa: null, real: null, nombre: null });
  const r = destinoDelAlta([DEF, MARCA], null);
  assert.ok('error' in r, 'con dos productos y sin elegir, creó a ciegas en el principal');
  assert.deepEqual(r.elegir, [
    { id: 4, nombre: 'Funnel principal', esDefault: true },
    { id: 18, nombre: 'Marca Personal', esDefault: false },
  ]);
});

test('⚠️ «no pude leer» no es «no existe» ni «hay uno»', () => {
  assert.deepEqual(destinoDelAlta(null, 18), { error: 'No pude leer tus productos.' });
  assert.deepEqual(destinoDelAlta(null, null), { error: 'No pude leer tus productos.' }, 'con la lista caída y sin elegir, creó en el principal');
  assert.deepEqual(destinoDelAlta([DEF, MARCA], 99), { error: 'Ese producto no existe.' });
});

test('el default de la casa sale de la MISMA lista, no de otra lectura', () => {
  // Una lista sin default (no debería pasar: el default no se archiva) no convierte a nadie en
  // NULL: el elegido se escribe con su id.
  assert.deepEqual(destinoDelAlta([MARCA, CAPA], 23), { casa: 23, real: 23, nombre: 'Capacitaciones para Empresas' });
});

test('la regla del nombre y cuándo preguntar', () => {
  assert.equal(nombreVisible(MARCA), 'Marca Personal');
  assert.equal(nombreVisible(CAPA), 'Capacitaciones para Empresas', 'un producto con nombre en blanco sale en blanco');
  assert.equal(nombreVisible(DEF), 'Funnel principal');
  assert.equal(productosParaAlta(null), null, '«no pude leer» se convirtió en una lista');
  assert.equal(pideProducto([]), false);
  assert.equal(pideProducto([DEF]), false, 'con un solo producto el alta pregunta (fricción nueva)');
  assert.equal(pideProducto([DEF, MARCA]), true);
});

test('⚠️ la regla del nombre de un producto vive en UN lugar (nombreVisible)', () => {
  // Estaba copiada en 11 lugares, dos sin el `trim`. Una copia nueva es la que se queda vieja.
  const archivos = ['app', 'lib'].flatMap((d) => (readdirSync(RAIZ + d, { recursive: true }) as string[])
    .map((f) => `${d}/${f.replace(/\\/g, '/')}`)
    .filter((f) => /\.(ts|tsx)$/.test(f) && f !== 'lib/lead-funnel-reglas.ts'));
  const copias: string[] = [];
  for (const f of archivos) {
    const crudo = leer(f);
    if (!crudo.includes('.producto')) continue;   // filtro barato: son cientos de archivos
    const src = sinComentarios(crudo);
    if (/\.producto\?\.trim\(\) \|\||\.producto \?\? \w+\??\.nombre/.test(src)) copias.push(f);
  }
  assert.deepEqual(copias, [], `la regla del nombre está copiada a mano en: ${copias.join(', ')}`);
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
  // Y si la persona ya estaba y el server la agregó al producto elegido, se dice: si no, la
  // ficha que se abre parece la de un lead recién creado.
  assert.match(cuerpo, /if \(r\.agregadoA\) mostrarAvisoAlta\(/, 'no avisa que la persona ya estaba y se la agregó al producto');
});

// ── Probado rompiéndolo (08/10/2026) ─────────────────────────────────────────
// El archivo entero daba 14 / 0 (13 desde el 09/10/2026: la bandeja oficial se fue con Chatwoot).
// Doce roturas, cada una restaurada de memoria; las doce dieron 13 pasan / 1 falla y la que cae
// es la que corresponde (la de la oficial ya no existe):
//   · EmpresaInbox llama a la action sin `funnelId`              -> «la bandeja NO OFICIAL…»
//   · createLead sin `funnel_id: destino.casa`                    -> «el alta RECIBE el producto…»
//   · la action valida con `listarFunnels` en vez de `leerFunnels` -> «el alta RECIBE el producto…»
//   · se saca el `agregarAProducto` de la persona que ya estaba   -> «el alta RECIBE el producto…»
//   · destinoDelAlta escribe `f.id` sin `casaParaEscribir`         -> «el producto del negocio nace NULL…»
//   · con la lista caída devuelve «el del negocio»                 -> «"no pude leer" no es…»
//   · sin elegir y con 2+ crea en el principal                     -> «sin elegir: con 0-1…»
//   · el wizard monta <WhatsAppApp> con `productos` en undefined   -> «los DOS montajes…» (sin la
//     prop, además, no compila: es obligatoria)
//   · el botón trata `null` como `[]` («hay uno»)                   -> «el botón compartido…»
//   · leerFunnels vuelve a `return []` en el catch                 -> «leerFunnels devuelve null…»
//   · una copia nueva de la regla del nombre en CrmToolbar         -> «la regla del nombre… en UN lugar»
