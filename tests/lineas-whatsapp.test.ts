import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  elegirLinea, esLineaDelWorkspace, nombreLineaNueva, lineaPorDefault, rotuloLinea, instanceNameDeWs, sanearEtiqueta,
} from '../lib/lineas-whatsapp';

// =============================================================================
// Varias líneas de WhatsApp por negocio: de quién es cada una y cuál manda
// =============================================================================
// Pedido de Martín (06/10/2026): «haz que los usuarios puedan escanear varios QR, tener
// varios WhatsApp… un desplegable que cambiaría el chat. Y dentro del chatbot una opción
// para seleccionar de qué número sale esa automatización».
//
// Lo caro de esta feature no es el desplegable: es que UN mensaje salga por una línea que
// no es del negocio. Por eso la elección (`elegirLinea`) se EJECUTA acá con sus casos, y el
// cableado —que cada camino que manda pase por ella— se lee del FUENTE, sin comentarios y
// por BLOQUE (un guard que lee el archivo entero encuentra lo que el archivo dice de sí).
//
// Probado rompiéndolo (06/10/2026), DOCE roturas, una por vez, restaurando de memoria:
//  (1) `esLineaDelWorkspace` sin mirar el número de workspace     → 2 rojos (el nombre y la
//      defensa en profundidad de la default con nombre ajeno)
//  (2) una línea pedida que ya no está cae a la de por default    → 1 rojo
//  (3) la de por default sin ordenar por id                      → 1 rojo
//  (4) el rótulo cae al instance_name                            → 1 rojo
//  (5) `enviarTexto` derivando la línea del workspace            → 1 rojo
//  (6) `upsertInstancia` por `onConflict: 'workspace_id'`         → 1 rojo
//  (7) desvincular vuelve atrás el onboarding siempre            → 1 rojo
//  (8) el espejo del saliente con la línea vacía                 → 1 rojo
//  (9) el envío automático del motor sin la línea de la secuencia → 1 rojo
// (10) la bandeja sin filtrar por línea                          → 1 rojo
// (11) la bandeja montada antes de tener la lista de líneas      → 1 rojo
// (12) la 0198 sacando el unique por workspace                   → 1 rojo
// Y ONCE más, una por cada arreglo de la revisión adversarial del mismo día (22 hallazgos, 0
// refutados): el nombre que vuelve a ser `_2`, borrar la fila sin que Evolution borre la
// instancia, re-apuntar los borradores, adoptar una sesión vieja, el borrador asistido sin
// línea, el webhook sin pasarla, un borrador con línea que cae al oficial, la caché con una
// clave fija, el auto-abrir que cae a otro chat, el aviso sin línea y la 0199 sin su relleno →
// 1 rojo cada una. ⚠️ La de la clave fija pasó en VERDE con el primer assert (pedía un `Map` y
// nada más): ahora cada uso de la caché tiene que llevar la línea en la clave.
// El detalle, en docs/hallazgos-comunicacion.md → «Varias líneas de WhatsApp».

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (rel: string) => readFileSync(RAIZ + rel, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré el arranque del bloque: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre del bloque: ${hasta}`);
  return src.slice(i, j);
}
const cuenta = (src: string, aguja: string) => src.split(aguja).length - 1;

// ─────────────────────────────────────────────────────────────────────────────
// 1. La elección (se EJECUTA)
// ─────────────────────────────────────────────────────────────────────────────

test('un nombre de línea es de UN workspace, y los parecidos no lo son', () => {
  assert.equal(esLineaDelWorkspace('mako_ws13', 13), true);
  assert.equal(esLineaDelWorkspace('mako_ws13_2', 13), true);
  assert.equal(esLineaDelWorkspace('mako_ws1_3', 13), false, 'la tercera del ws1 no es del 13');
  assert.equal(esLineaDelWorkspace('mako_ws1', 13), false);
  assert.equal(esLineaDelWorkspace('mako_ws13x', 13), false);
  assert.equal(esLineaDelWorkspace('mako_superadmin_abc', 13), false, 'la línea de MaKo no es de ningún cliente');
  assert.equal(esLineaDelWorkspace(null, 13), false);
});

test('la primera línea es la de siempre, y las siguientes NUNCA reusan un nombre (heredarían su espejo)', () => {
  assert.equal(nombreLineaNueva(13, []), 'mako_ws13');
  assert.equal(nombreLineaNueva(13, ['mako_ws13'], () => 'k3x9qa'), 'mako_ws13_k3x9qa');
  // Si el sufijo choca con una existente, se pide otro: nunca se devuelve un nombre usado.
  const sufijos = ['aaa', 'bbb'];
  assert.equal(nombreLineaNueva(13, ['mako_ws13', 'mako_ws13_aaa'], () => sufijos.shift() ?? 'zzz'), 'mako_ws13_bbb');
  // ⚠️ El caso que tumbó al «primer número libre»: la línea 2 se quitó (su fila ya no está) pero
  // su espejo sí. Con un sufijo al azar, la línea nueva no vuelve a llamarse `mako_ws13_2`.
  assert.notEqual(nombreLineaNueva(13, ['mako_ws13']), 'mako_ws13_2');
  assert.equal(esLineaDelWorkspace(nombreLineaNueva(13, ['mako_ws13']), 13), true, 'el nombre nuevo tiene que reconocerse como del negocio');
  assert.equal(esLineaDelWorkspace('mako_ws13_k3x9qa', 13), true);
  assert.equal(instanceNameDeWs(7), 'mako_ws7');
});

const L = (instance_name: string, extra: Partial<{ id: number; es_default: boolean; etiqueta: string | null; numero: string | null }> = {}) => ({ instance_name, ...extra });

test('una línea PEDIDA se usa sólo si es del negocio, y si no NO hay respaldo', () => {
  const lineas = [L('mako_ws13', { id: 1, es_default: true }), L('mako_ws13_2', { id: 2 })];
  assert.deepEqual(elegirLinea(lineas, 'mako_ws13_2', 13), { ok: true, instance: 'mako_ws13_2' });
  // De otro cliente: no se manda, y tampoco cae a la de por default.
  const ajena = elegirLinea(lineas, 'mako_ws1', 13);
  assert.equal(ajena.ok, false);
  // Del negocio por el nombre, pero ya no vinculada: tampoco cae a la de por default.
  const ida = elegirLinea(lineas, 'mako_ws13_3', 13);
  assert.equal(ida.ok, false, 'elegir otra que la pedida es mandar desde el número equivocado');
  assert.match((ida as { motivo: string }).motivo, /ya no está vinculada/);
});

test('sin pedido sale la de por default; con varias marcadas, la de id más bajo; sin filas, la de siempre', () => {
  assert.deepEqual(elegirLinea([L('mako_ws13', { id: 1 }), L('mako_ws13_2', { id: 2, es_default: true })], null, 13), { ok: true, instance: 'mako_ws13_2' });
  assert.deepEqual(elegirLinea([L('mako_ws13_2', { id: 5, es_default: true }), L('mako_ws13', { id: 3, es_default: true })], undefined, 13), { ok: true, instance: 'mako_ws13' });
  assert.deepEqual(elegirLinea([], null, 13), { ok: true, instance: 'mako_ws13' });
  // Pedir por su nombre la de siempre, sin filas todavía, es lo mismo que no pedir nada.
  assert.deepEqual(elegirLinea([], 'mako_ws13', 13), { ok: true, instance: 'mako_ws13' });
  // Una fila del negocio con un nombre ajeno no se usa nunca.
  assert.equal(elegirLinea([L('mako_ws1', { id: 1, es_default: true })], null, 13).ok, false);
  assert.equal(lineaPorDefault([]), null);
});

test('en pantalla una línea se llama por su nombre o su número, NUNCA por su instance_name', () => {
  assert.equal(rotuloLinea(L('mako_ws13_2', { etiqueta: 'Ventas', numero: '5215512345678' }), 1), 'Ventas');
  assert.equal(rotuloLinea(L('mako_ws13_2', { numero: '5215512345678' }), 1), '+5215512345678');
  assert.equal(rotuloLinea(L('mako_ws13_2', { etiqueta: '   ' }), 1), 'Línea 2');
  assert.equal(sanearEtiqueta('  Ventas\n  norte '), 'Ventas norte');
  assert.equal(sanearEtiqueta(''), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cada camino que manda o conecta pasa por la elección
// ─────────────────────────────────────────────────────────────────────────────

const EVO = sinComentarios(leer('lib/evolution.ts'));

test('enviar, conectar, el estado, el QR, desvincular y el webhook eligen su línea, nunca la derivan del workspace', () => {
  const funciones: Array<[string, string]> = [
    ['export async function enviarTexto(', 'export async function enviarMedia('],
    ['export async function enviarMedia(', 'export async function enviarAudio('],
    ['export async function enviarAudio(', 'export async function fetchProfilePic('],
    ['export async function estadoEnVivo(', 'export async function refrescarQr('],
    ['export async function refrescarQr(', 'export async function desconectar('],
    ['export async function desconectar(', 'async function soltarReferencias('],
    ['export async function estadoWebhook(', 'export async function repararWebhook('],
  ];
  for (const [desde, hasta] of funciones) {
    const b = bloque(EVO, desde, hasta);
    assert.doesNotMatch(b, /instanceNameDeWs\(/, `${desde} deriva la línea del workspace: con dos números manda siempre por el primero`);
    assert.match(b, /lineaEstricta\(|lineaDeEnvio\(/, `${desde} no elige su línea`);
  }
  // Los únicos `instanceNameDeWs(ws)` que quedan son el respaldo de los lectores SIN línea pedida.
  assert.equal(cuenta(EVO, 'instanceNameDeWs(ws)'), cuenta(EVO, '(await lineaSuave()) ?? instanceNameDeWs(ws)'));
});

test('la fila de una línea se escribe por su NOMBRE, comprobando que sea del negocio, y el error se lee', () => {
  const up = bloque(EVO, 'async function upsertInstancia(', '\n}\n');
  assert.match(up, /if \(!esLineaDelWorkspace\(instance, ws\)\) throw/);
  assert.match(up, /onConflict: 'instance_name'/);
  assert.match(up, /if \(error\) throw/);
  // Y nadie vuelve a apoyarse en el único por workspace que la 0199 saca.
  for (const rel of ['lib/evolution.ts', 'app/api/webhooks/evolution/route.ts', 'app/api/whatsapp/evolution/route.ts']) {
    assert.doesNotMatch(sinComentarios(leer(rel)), /evolution_instancias[\s\S]{0,200}onConflict: 'workspace_id'/, `${rel}: un upsert por workspace_id falla en cuanto se aplica la 0199`);
  }
  // `getInstanciaRow` ya no es un maybeSingle sin filtro (con dos filas, supabase-js da error y null).
  assert.doesNotMatch(bloque(EVO, 'export async function getInstanciaRow(', '\n}\n'), /maybeSingle/);
});

test('soltar un número sólo vuelve atrás el onboarding si no queda ninguna línea viva', () => {
  const d = bloque(EVO, 'export async function desconectar(', 'async function soltarReferencias(');
  assert.match(d, /if \(!otras\.some\(\(l\) => l\.estado === 'conectado'\)\) await revertirEstadoNoOficial\(ws\)/);
});

test('una línea extra se borra SÓLO si Evolution borró la instancia, y «la de por default» es la del resolvedor', () => {
  const d = bloque(EVO, 'export async function desconectar(', 'async function soltarReferencias(');
  // Con Evolution caído, borrar la fila deja la sesión viva y sin dueño.
  const borra = d.indexOf('await borrarFilaLinea(instance)');
  const corta = d.indexOf('if (!borrada) return');
  assert.ok(corta >= 0 && corta < borra, 'se borra la fila sin mirar si Evolution borró la instancia');
  assert.match(d, /const esLaDefault = \(lineaPorDefault\(lineas\)\?\.instance_name \?\? instance\) === instance;/);
  // Los borradores de la línea que se va NO se re-apuntan: fallan a la vista.
  assert.doesNotMatch(bloque(EVO, 'async function soltarReferencias(', '\n}\n'), /wa_borradores/);
  // Y una línea NUEVA no adopta una sesión que ya existía con su nombre.
  assert.match(bloque(EVO, 'export async function conectar(', 'async function borrarFilaLinea('), /if \(opts\.nueva\) \{[\s\S]{0,400}return crearDeCero\(\);/);
});

test('todo borrador de una secuencia lleva su línea, y uno con línea nunca cae al oficial', () => {
  const nutri = sinComentarios(leer('lib/nutricion.ts'));
  const llamadas = nutri.split('crearBorrador({').slice(1).map((s) => s.slice(0, 400));
  // Dos: el del asistido pasó a `guardarBorradorSetter` (uno por lead, #788), que se mira abajo.
  assert.ok(llamadas.length >= 2);
  for (const c of llamadas) assert.match(c, /linea:/, `un crearBorrador del motor sin línea sale por la de por default: ${c.slice(0, 80)}`);
  // El asistido contesta por la línea a la que escribió el lead.
  assert.match(sinComentarios(leer('lib/evolution-mensajes.ts')), /pausarPorRespuesta\(leadId, \{ texto: texto \?\? undefined, linea: instance, origen: 'no_oficial' \}\)/);
  // El borrador del setter (uno por lead, #788) también sale por la línea: la que escribió el lead o la de la secuencia.
  assert.match(nutri, /guardarBorradorSetter\(\{[\s\S]{0,300}?linea,\s*\}\)/);
  assert.match(nutri, /const linea = lineaEntrante \?\? secuencia\.instance_name;/);
  // Un borrador que nombra su línea sale por ELLA o no sale (lib/borrador-camino.ts; hasta el
  // 09/10/2026 se llamaba borrador-oficial.ts y tenía un camino por Chatwoot).
  const bo = sinComentarios(leer('lib/borrador-camino.ts'));
  assert.match(bo, /if \(b\.linea\) \{\s*const fila = lineas\?\.find\(\(l\) => l\.instance_name === b\.linea\);/, 'un borrador que nombra su línea no se decide por su línea');
});

test('la bandeja guarda su caché POR LÍNEA, no cae a otro chat, y el aviso abre la línea por la que entró', () => {
  const inbox = sinComentarios(leer('app/whatsapp/EmpresaInbox.tsx'));
  assert.match(inbox, /const convsCache = new Map<string, Conv\[\]>\(\);/);
  assert.doesNotMatch(inbox, /convsCache = (?!new Map)/, 'una asignación al arreglo de módulo mezcla las listas de las líneas');
  // Un Map con una clave fija es el mismo bug con otra cara: cada lectura y escritura va por la línea.
  const usos = inbox.match(/convsCache\.(?:get|set)\([^,)]*/g) ?? [];
  assert.ok(usos.length >= 4, `esperaba al menos 4 usos de la caché, hay ${usos.length}`);
  for (const u of usos) assert.match(u, /\(linea \?\? ''$/, `un uso de la caché sin la línea en la clave: ${u}`);
  assert.match(inbox, /msgsCache\.get\(claveCache\(sel\)\)/);
  // Con un ?chat= pedido que no está en la lista se espera: no se abre la conversación de otro.
  const auto = bloque(inbox, "const target = searchParamsEmpresa.get('chat');", 'setSel(convs[0].chatJid);');
  assert.match(auto, /if \(target && chatDeepLinkRef\.current !== target\) \{[\s\S]*?return;\s*\}\s*$/);
  const notif = sinComentarios(leer('app/_components/NotificationsProvider.tsx'));
  assert.match(bloque(notif, 'const goToChatNoOficial = (chatJid: string) => {', '\n  };'), /linea=\$\{encodeURIComponent\(linea\)\}/);
});

test('la 0199 repite los rellenos para lo que escribió el código viejo entre las dos migraciones', () => {
  const m199 = leer('supabase/migrations/0199_lineas_sin_unique_ws.sql');
  assert.match(m199, /update evolution_instancias e set es_default = true/);
  assert.match(m199, /update wa_mensajes m set instance_name = 'mako_ws' \|\| m\.workspace_id/);
});

test('el espejo guarda la línea REAL de cada saliente, y el borrador sale por la suya', () => {
  const envio = sinComentarios(leer('lib/evolution-envio.ts'));
  assert.doesNotMatch(envio, /instance_name: ''/, 'un saliente con la línea vacía no aparece en el hilo de ninguna');
  assert.equal(cuenta(envio, 'instance_name: r.instance'), 3);
  assert.match(envio, /enviarTexto\(params\.telefono, params\.texto, params\.linea\)/);
  assert.match(envio, /enviarMedia\(params\.telefono, params\.media, params\.caption, params\.linea\)/);
  assert.match(envio, /enviarAudio\(params\.telefono, params\.base64, params\.linea\)/);
  assert.match(bloque(envio, 'export async function enviarBorrador(', 'export async function descartarBorrador('), /linea: b\.instance_name/);
});

test('el motor manda cada secuencia por SU línea, con una sonda por línea', () => {
  const nutri = sinComentarios(leer('lib/nutricion.ts'));
  const proc = bloque(nutri, 'export async function procesarEnvios(', '\nexport async function ');
  assert.doesNotMatch(proc, /getInstanciaRow\(/, 'una sola fila decidía por todas las líneas');
  const rama = bloque(nutri, "} else if (waOn && paso.canal === 'whatsapp' && paso.proveedor === 'no_oficial') {", "} else if (waOn && paso.canal === 'whatsapp') {");
  // Sexta tanda (09/10/2026, WhatsApp 2): el número es de CADA MENSAJE. Manda la línea del paso
  // (`lineaDelPaso`, lib/mensaje-partes.ts); sin una propia, la de la secuencia, como antes.
  // Probado rompiéndolo: volviendo a `const lineaSec = sec.instance_name;` → 1 falla (15/1; base 16/0).
  assert.match(rama, /const lineaSec = lineaDelPaso\(paso\) \?\? sec\.instance_name;/);
  assert.match(rama, /const canalEvo = await canalDeLinea\(lineaSec\);/);
  // Los cuatro envíos y los tres borradores de la rama llevan la línea de la secuencia (desde el
  // 08/10/2026 el archivo de la biblioteca suma uno de cada: `enviarMediaYEspejar` y su borrador).
  // Probado rompiéndolo (08/10/2026): el envío del archivo sin su línea → 1 falla (15/1).
  // Desde el 09/10/2026 (cuarta tanda, punto 15) el mensaje de VARIAS partes suma su envío
  // (`enviarPartesDelPaso`) y su borrador: 9. Probado rompiéndolo: las partes sin su línea → 1 falla.
  assert.equal(cuenta(rama, 'linea: lineaSec'), 9);
  // Y guardarla valida que sea del negocio.
  assert.match(bloque(nutri, 'export async function setSecuenciaLinea(', '\n}\n'), /elegirLinea\(await listarLineas\(\), linea, ws\)/);
});

test('la bandeja filtra por línea en la base, y la pantalla siempre le pasa una línea explícita', () => {
  const esp = sinComentarios(leer('lib/evolution-mensajes.ts'));
  assert.match(bloque(esp, 'export async function getConversacionesNoOficial(', 'export async function getResumenNoOficial('), /eq\('instance_name', linea\)/);
  assert.match(bloque(esp, 'export async function getMensajesDeChat(', '\n}\n'), /if \(linea\) sel = sel\.eq\('instance_name', linea\)/);
  const app = sinComentarios(leer('app/whatsapp/WhatsAppApp.tsx'));
  // La key lleva prefijo: el panel de conexión es su hermano y comparten la línea (medido en el
  // navegador el 06/10: con la misma key React avisaba «two children with the same key»).
  // (Y desde el 08/10/2026 lleva los productos del «+ Agregar al CRM»: tests/inbox-agregar-al-crm.test.ts.)
  assert.match(app, /<EmpresaInbox key=\{`bandeja-\$\{lineaActiva\?\.linea \?\? 'default'\}`\} puedeChatbot=\{puedeChatbot\} linea=\{lineaActiva\?\.linea \?\? null\} productos=\{productos\} \/>/);
  // Sin la lista —o con la lista caída— la bandeja leería el espejo entero: dos números mezclados.
  // (Hasta el 09/10/2026 la condición arrancaba con `canal === 'empresa' &&`: la otra pestaña era
  // la bandeja oficial, que se fue con Chatwoot.)
  assert.match(app, /\{lineasCargadas && !\(lineasError && !lineas\.length\) && !agregando/);
});

test('las migraciones dicen su orden: la que agrega ANTES del deploy, la que saca DESPUÉS', () => {
  const m198 = leer('supabase/migrations/0198_varias_lineas_whatsapp.sql');
  const m199 = leer('supabase/migrations/0199_lineas_sin_unique_ws.sql');
  assert.match(m198, /ORDEN DE DESPLIEGUE: \*\*ANTES\*\*/);
  assert.match(m198, /create unique index if not exists idx_evolution_default_por_ws\s+on evolution_instancias \(workspace_id\) where es_default/);
  assert.doesNotMatch(sinComentarios(m198.replace(/^--.*$/gm, '')), /drop constraint/, 'la 0198 no puede sacar nada: el código desplegado lo usa');
  assert.match(m199, /ORDEN DE DESPLIEGUE: \*\*DESPUÉS\*\*/);
  assert.match(m199, /pg_get_constraintdef\(oid\) = 'UNIQUE \(workspace_id\)'/);
});
