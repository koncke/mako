// =============================================================================
// La biblioteca de ARCHIVOS de los mensajes (mig 0225): qué entra, dónde vive, quién lo borra
// =============================================================================
// Un paso `tipo: 'media'` lleva `media_id` de `setting_adjuntos`; el binario vive en `wa-media`
// bajo `<ws>/setting-adjuntos/`. Lo que fija este test:
//   · la lista blanca (sin SVG ni HTML; el tipo sale de la EXTENSIÓN) y los topes de WhatsApp,
//     ejecutando lib/setting-adjuntos-reglas.ts;
//   · la guarda del path: sólo se borra el binario de la biblioteca de ESTE workspace — nunca el
//     del dueño (una copia de «Completar con los datos de Mau») ni el del espejo;
//   · que lo subido y no registrado no quede huérfano en el bucket, sin borrar nunca un archivo
//     que tenga fila (costuras-10);
//   · que `extDeMime` conozca docx y xlsx (el espejo los guardaba como `.bin`);
//   · el cableado que el compilador no ve: TENANT_TABLES, TABLAS_DE_INQUILINO, la migración, el
//     remap de `media_id` en datos-mau, y que la lib filtre por workspace A MANO.
//
// Probado rompiéndolo (08/10/2026) con un arnés que rompe UNA cosa, corre este archivo y restaura
// de memoria: 9 roturas, 9 cazadas (15 tests):
//   1. `image/svg+xml` sumado a MIME_ADJUNTO_WA → 2 fallos.
//   2. `mimeDeArchivoWA` mirando primero el tipo del navegador → 1.
//   3. `pathEsAdjuntoDe` con un `startsWith` del workspace (aceptaba el espejo y el `..`) → 1.
//   4. `borrarAdjunto` sin la guarda antes del `remove` → 1.
//   5. `registrarAdjunto` sin el `info()` (creyéndole al navegador) → 1.
//   6. `setting_adjuntos` fuera de TENANT_TABLES → 1.
//   7. la migración con `default 1` en `workspace_id` → 1.
//   8. datos-mau sin el remap de `media_id` → 1.
//   9. `extDeMime` volviendo a la versión por pedazos (sin la tabla exacta) → 1.
//
// costuras-10 (revisión del 08/10/2026), mismo arnés: 8 roturas, 8 cazadas (17 tests):
//  10. `info()` caído sin `await soltar()` → 1 fallo.
//  11. el insert que rebota sin `await soltar()` → 1.
//  12. el `catch` sin soltar → 1.
//  13. `sinFilaConfirmada` devolviendo true con la lectura caída → 1.
//  14. `tablaNoExiste` sin `PGRST205` (lo que contesta prod hoy) → 1.
//  15. `soltarSiNoQuedo` sin la guarda del path → 1.
//  16. un error cualquiera de la lectura previa soltando el archivo → 1.
//  17. `soltar` armado antes de la lectura previa (borraría un archivo ya registrado) → 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MIME_ADJUNTO_WA, esMimeAdjuntoWA, mimeDeArchivoWA, validarArchivoWA, pathDeAdjuntoWA, pathEsAdjuntoDe,
  tipoEnvioDeMime, topeDe, extDeMime, pasosUsanAdjunto, tituloDeArchivo, pesoLegible, ACEPTA_FOTO_VIDEO, ACEPTA_DOCUMENTO,
  TOPE_IMAGEN_BYTES, TOPE_VIDEO_BYTES, sinFilaConfirmada, tablaNoExiste,
} from '../lib/setting-adjuntos-reglas';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const UUID = '0b6c3a2e-5d4f-4a1b-9c8d-7e6f5a4b3c2d';

// ── Qué entra ────────────────────────────────────────────────────────────────────────────────

test('la lista blanca: sin SVG ni HTML (llevan código), sin webp ni gif (WhatsApp los cambia)', () => {
  for (const m of ['image/svg+xml', 'text/html', 'application/xhtml+xml', 'image/webp', 'image/gif', 'video/quicktime', 'application/x-msdownload']) {
    assert.equal(esMimeAdjuntoWA(m), false, `${m} no puede entrar`);
  }
  for (const m of ['image/jpeg', 'image/png', 'video/mp4', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) {
    assert.ok(esMimeAdjuntoWA(m), `${m} tiene que entrar`);
  }
  assert.ok(!MIME_ADJUNTO_WA.some((m) => /svg|html/.test(m)));
  assert.doesNotMatch(ACEPTA_FOTO_VIDEO + ACEPTA_DOCUMENTO, /svg|html|webp|gif/);
});

test('el tipo sale de la EXTENSIÓN antes que de lo que diga el navegador', () => {
  // Windows con Excel le pone `application/vnd.ms-excel` a un .csv; un .docx puede venir vacío.
  assert.equal(mimeDeArchivoWA('lista.csv', 'application/vnd.ms-excel'), 'text/csv');
  assert.equal(mimeDeArchivoWA('Propuesta.DOCX', ''), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(mimeDeArchivoWA('foto.jpeg', 'image/jpeg'), 'image/jpeg');
  // Una extensión que no está no se salva por el tipo: un .svg que se dice png no entra.
  assert.equal(mimeDeArchivoWA('logo.svg', 'image/png'), null);
  assert.equal(mimeDeArchivoWA('video.mov', 'video/mp4'), null);
  // Sin extensión, manda el tipo.
  assert.equal(mimeDeArchivoWA('archivo', 'application/pdf'), 'application/pdf');
});

test('los topes son los de WhatsApp o más bajos, y el error lo dice corto', () => {
  assert.equal(topeDe('image/png'), TOPE_IMAGEN_BYTES);
  assert.equal(TOPE_IMAGEN_BYTES, 5 * 1024 * 1024);
  assert.equal(topeDe('video/mp4'), TOPE_VIDEO_BYTES);
  assert.ok(topeDe('application/pdf') <= 16 * 1024 * 1024, 'el motor baja el documento entero a la memoria de la función');
  assert.deepEqual(validarArchivoWA({ nombre: 'f.png', tipo: 'image/png', tamano: 6 * 1024 * 1024 }), { ok: false, error: 'Pasa de 5 MB.' });
  assert.deepEqual(validarArchivoWA({ nombre: 'f.png', tipo: 'image/png', tamano: 0 }), { ok: false, error: 'El archivo está vacío.' });
  assert.deepEqual(validarArchivoWA({ nombre: 'f.exe', tipo: 'application/x-msdownload', tamano: 10 }), { ok: false, error: 'Ese formato no va.' });
  assert.deepEqual(validarArchivoWA({ nombre: 'f.pdf', tipo: 'application/pdf', tamano: 10 }), { ok: true, mime: 'application/pdf' });
});

test('cómo lo manda Evolution: lo decide el tipo', () => {
  assert.equal(tipoEnvioDeMime('image/jpeg'), 'image');
  assert.equal(tipoEnvioDeMime('video/mp4'), 'video');
  assert.equal(tipoEnvioDeMime('application/pdf'), 'document');
  assert.equal(tipoEnvioDeMime(null), 'document');
});

// ── Dónde vive, y quién lo borra ─────────────────────────────────────────────────────────────

test('el path: `<ws>/setting-adjuntos/<uuid>.<ext>`, y nunca con un uuid inventado', () => {
  assert.equal(pathDeAdjuntoWA(11, 'application/pdf', UUID), `11/setting-adjuntos/${UUID}.pdf`);
  assert.equal(pathDeAdjuntoWA(11, 'image/svg+xml', UUID), null);
  assert.equal(pathDeAdjuntoWA(11, 'application/pdf', '../../x'), null);
  assert.equal(pathDeAdjuntoWA(0, 'application/pdf', UUID), null);
});

test('la guarda del path: SÓLO la biblioteca de ESTE workspace (ni el dueño, ni el espejo)', () => {
  assert.ok(pathEsAdjuntoDe(`11/setting-adjuntos/${UUID}.pdf`, 11));
  // Una copia de «Completar con los datos de Mau» apunta al archivo del DUEÑO (ws 1).
  assert.ok(!pathEsAdjuntoDe(`1/setting-adjuntos/${UUID}.pdf`, 11), 'borraría el archivo de Mauricio');
  assert.ok(!pathEsAdjuntoDe(`11/setting-adjuntos/${UUID}.pdf`, 1), 'el 1 no es el 11');
  // El espejo de las conversaciones: se limpia solo, y no es de la biblioteca.
  assert.ok(!pathEsAdjuntoDe('11/mako_ws11/ABC123.pdf', 11));
  assert.ok(!pathEsAdjuntoDe(`11/setting-adjuntos/../mako_ws11/${UUID}.pdf`, 11));
  assert.ok(!pathEsAdjuntoDe(`11/setting-audios/${UUID}.mp3`, 11));
  assert.ok(!pathEsAdjuntoDe(`11/setting-adjuntos/${UUID}.exe`, 11));
  assert.ok(!pathEsAdjuntoDe(null, 11));
});

test('borrar: el binario se borra sólo si la guarda dice que sí, y no si un paso lo usa', () => {
  const lib = sinComentarios(leer('lib/setting-adjuntos.ts'));
  const borrar = lib.slice(lib.indexOf('export async function borrarAdjunto('));
  assert.ok(borrar.length > 200);
  const iGuarda = borrar.indexOf('if (pathEsAdjuntoDe(a.media_path, ws))');
  const iRemove = borrar.indexOf('.remove([a.media_path])');
  assert.ok(iGuarda > 0 && iRemove > iGuarda, 'el remove tiene que colgar de la guarda');
  assert.match(borrar, /const usos = await usosDeAdjunto\(id\);\s*if \(usos\.length\) return \{ ok: false/, 'un media_id colgado hace fallar al motor cada 24 h sin aviso');
  assert.ok(pasosUsanAdjunto([{ cuerpo: 'x' }, { tipo: 'media', media_id: 4 }], 4));
  assert.ok(!pasosUsanAdjunto([{ tipo: 'media', media_id: 5 }], 4));
  assert.ok(!pasosUsanAdjunto(null, 4));
});

test('registrar le pregunta a Storage QUÉ se guardó y borra lo que no entra', () => {
  const lib = sinComentarios(leer('lib/setting-adjuntos.ts'));
  const reg = lib.slice(lib.indexOf('export async function registrarAdjunto('), lib.indexOf('export async function usosDeAdjunto('));
  assert.ok(reg.length > 300);
  assert.match(reg, /if \(!pathEsAdjuntoDe\(path, ws\)\) return \{ ok: false/);
  assert.match(reg, /await bucket\.info\(path\)/, 'el bucket no filtra tipos: se le cree a Storage, no al navegador');
  assert.match(reg, /!esMimeAdjuntoWA\(mime\)/);
  assert.match(reg, /tamano > topeDe\(mime\)/);
  assert.match(reg, /await bucket\.remove\(\[path\]\)/);
});

// ── Lo que se subió y no se registró no se queda en el bucket (costuras-10) ──────────────────
// Antes, un `info()` caído, un insert que rebotaba o la tabla de la 0225 sin aplicar dejaban el
// binario en `wa-media` para siempre (nadie limpia `<ws>/setting-adjuntos/`), y cada reintento
// subía otra copia con otro uuid. Ahora se borra, pero SÓLO con la fila confirmada ausente.

test('borrar lo subido sólo si la lectura CONFIRMA que no hay fila (se EJECUTA)', () => {
  assert.equal(sinFilaConfirmada({ data: null, error: null }), true);
  assert.equal(sinFilaConfirmada({ data: { id: 4 }, error: null }), false, 'con fila, borrar el binario la deja apuntando a la nada');
  // «No pude leer» no es «no hay»: un insert que falló por la red pudo haber escrito igual.
  assert.equal(sinFilaConfirmada({ data: null, error: { code: '08006' } }), false);
  assert.equal(sinFilaConfirmada({ data: null, error: {} }), false);
  // La tabla que no existe (la 0225 sin aplicar): sin tabla no puede haber fila. Medido en prod.
  assert.equal(sinFilaConfirmada({ data: null, error: { code: 'PGRST205' } }), true);
  assert.equal(sinFilaConfirmada({ data: null, error: { code: '42P01' } }), true);
  assert.equal(tablaNoExiste({ code: 'PGRST205' }), true);
  assert.equal(tablaNoExiste({ code: '23505' }), false);
  assert.equal(tablaNoExiste(null), false);
});

test('registrar suelta lo subido en TODA salida con error, y sólo después de saber que no hay fila', () => {
  const lib = sinComentarios(leer('lib/setting-adjuntos.ts'));
  // El que borra: cuelga de la guarda del path y de la lectura que confirma que no hay fila.
  const soltar = lib.slice(lib.indexOf('async function soltarSiNoQuedo('), lib.indexOf('export async function registrarAdjunto('));
  assert.ok(soltar.length > 150 && soltar.length < 900, `no encontré soltarSiNoQuedo (${soltar.length})`);
  const iGuarda = soltar.indexOf('if (!pathEsAdjuntoDe(path, ws)) return;');
  const iConfirma = soltar.indexOf('if (!sinFilaConfirmada(lectura)) return;');
  const iRemove = soltar.indexOf('.remove([path])');
  assert.ok(iGuarda > 0 && iConfirma > iGuarda && iRemove > iConfirma, 'el remove cuelga de la guarda del path y de la fila ausente');

  const reg = lib.slice(lib.indexOf('export async function registrarAdjunto('), lib.indexOf('export async function usosDeAdjunto('));
  // Se arma DESPUÉS de saber que no hay fila (con fila, el archivo es de alguien).
  const iArma = reg.indexOf('soltar = () => soltarSiNoQuedo(db, ws, path);');
  assert.ok(iArma > reg.indexOf('if (previa.data)'), 'armado antes de la lectura previa, un error borraría un archivo ya registrado');
  // Las tres salidas con error de ahí en más.
  assert.match(reg, /if \(info\.error \|\| !info\.data\) \{ await soltar\(\); return \{ ok: false/, 'info() caído');
  const insert = reg.slice(reg.indexOf('.insert(fila)'), reg.indexOf('soltar = null;'));
  assert.match(insert, /await soltar\(\);\s*return \{ ok: false, error: error\.message \};/, 'el insert que rebota');
  assert.match(reg, /\} catch \(e\) \{\s*if \(soltar\) await soltar\(\);/, 'la excepción');
  // Con la lectura previa caída no se sabe si hay fila: sólo la tabla inexistente suelta.
  const previa = reg.slice(reg.indexOf('if (previa.error) {'), reg.indexOf('if (previa.data)'));
  assert.equal(previa.split('soltarSiNoQuedo(').length - 1, 1, 'un error de lectura cualquiera no autoriza a borrar');
  assert.match(previa, /if \(tablaNoExiste\(previa\.error\)\) \{\s*await soltarSiNoQuedo\(db, ws, path\);/);
});

test('la lib filtra por workspace A MANO (por si TENANT_TABLES pierde la línea al juntar)', () => {
  const lib = sinComentarios(leer('lib/setting-adjuntos.ts'));
  const consultas = [...lib.matchAll(/db\.from\(TABLA\)\.(select|delete)\([^)]*\)([^;\n]*)/g)];
  assert.ok(consultas.length >= 4, `esperaba al menos 4 consultas, hay ${consultas.length}`);
  for (const c of consultas) assert.match(c[2]!, /\.eq\('workspace_id', ws\)/, `una consulta sin el workspace: ${c[0]}`);
  assert.match(lib, /const fila = \{ workspace_id: ws,/);
  assert.match(lib, /leerTodo<Record<string, unknown>>\(db, TABLA, COLS, \{ eq: \{ workspace_id: ws \}/);
});

test('la ruta es sólo del admin del workspace', () => {
  const ruta = sinComentarios(leer('app/api/chat-agent/adjuntos/route.ts'));
  assert.match(ruta, /if \(ws == null \|\| rol !== 'admin'\)/);
  for (const m of ['GET', 'POST', 'DELETE']) {
    const b = ruta.slice(ruta.indexOf(`export async function ${m}(`));
    assert.match(b.slice(0, 200), /const g = await guard\(\);\s*if \(g\) return g;/, `${m} sin guard`);
  }
});

// ── El cableado ──────────────────────────────────────────────────────────────────────────────

test('setting_adjuntos está en TENANT_TABLES y en TABLAS_DE_INQUILINO (el reset la vacía)', () => {
  const ws = leer('lib/workspace.ts');
  const set = ws.match(/const TENANT_TABLES = new Set<string>\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
  assert.match(set.replace(/\/\/[^\n]*/g, ''), /'setting_adjuntos'/, 'sin esto getTenantDb es passthrough y lee los archivos de todos');
  assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes('setting_adjuntos'));
});

test('la migración: workspace SIN default, path con su forma, RLS y revoke', () => {
  const sql = leer('supabase/migrations/0225_setting_adjuntos.sql');
  const tabla = sql.slice(sql.indexOf('create table if not exists setting_adjuntos'), sql.indexOf(');', sql.indexOf('create table if not exists setting_adjuntos')));
  assert.match(tabla, /workspace_id\s+bigint not null references workspaces\(id\) on delete cascade/);
  assert.doesNotMatch(tabla.replace(/--[^\n]*/g, ''), /workspace_id[^,\n]*default/, 'con default 1, una inserción que se olvide del workspace cae en el del dueño');
  assert.match(tabla, /media_path ~ '\^\[0-9\]\{1,12\}\/setting-adjuntos\//);
  assert.match(sql, /alter table setting_adjuntos enable row level security;/);
  assert.match(sql, /revoke all on setting_adjuntos from anon, authenticated;/);
  assert.match(sql, /create unique index if not exists setting_adjuntos_ws_path_uk on setting_adjuntos \(workspace_id, media_path\)/);
});

test('«Completar con los datos de Mau» trae los archivos ANTES que las secuencias y les traduce el media_id', () => {
  const mau = sinComentarios(leer('lib/datos-mau.ts'));
  const iAdj = mau.indexOf("tabla: 'setting_adjuntos'");
  const iSec = mau.indexOf("tabla: 'nutricion_secuencias'");
  assert.ok(iAdj > 0 && iSec > iAdj, 'sin la copia antes no hay mapa viejo→nuevo para los pasos');
  assert.match(mau, /\{ campo: 'pasos', clave: 'media_id', desde: 'setting_adjuntos' \}/);
  assert.match(mau, /\{ campo: 'pasos', clave: 'audio_id', desde: 'setting_audios' \}/);
});

// ── La extensión del espejo ──────────────────────────────────────────────────────────────────

test('extDeMime conoce docx y xlsx (el espejo los guardaba como .bin) y no cambia lo de antes', () => {
  assert.equal(extDeMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'docx');
  assert.equal(extDeMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'xlsx');
  assert.equal(extDeMime('application/vnd.openxmlformats-officedocument.presentationml.presentation'), 'pptx');
  assert.equal(extDeMime('video/3gpp'), '3gp');
  assert.equal(extDeMime('audio/ogg; codecs=opus'), 'ogg');
  assert.equal(extDeMime('audio/mpeg'), 'mp3');
  assert.equal(extDeMime('image/webp'), 'webp');
  assert.equal(extDeMime('application/octet-stream'), 'bin');
  assert.match(sinComentarios(leer('lib/evolution-media.ts')), /export \{ extDeMime \} from '\.\/setting-adjuntos-reglas';/);
});

test('lo que dice el chip', () => {
  assert.equal(tituloDeArchivo('Lista de precios 2026.pdf'), 'Lista de precios 2026');
  assert.equal(tituloDeArchivo('.pdf'), 'Archivo');
  assert.equal(pesoLegible(240 * 1024), '240 KB');
  assert.equal(pesoLegible(3.1 * 1024 * 1024), '3,1 MB');
  assert.equal(pesoLegible(null), '');
});
