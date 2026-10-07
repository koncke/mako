// =============================================================================
// curso-grabar-notas — la marca de grabar (#693), las notas del equipo con su adjunto (#692) y
// la purga de los archivos huérfanos de los buckets del curso
// =============================================================================
// Ejecuta app/customer-success/curso/reglas.ts (puro) y lee como FUENTE (sin comentarios, con
// los \r\n normalizados) lo que no se puede ejecutar sin base: lib/curso-admin.ts,
// lib/curso-purga.ts, el cron, las actions, el editor y la migración 0208.
//
// Probado ROMPIÉNDOLO: ver el bloque «Roturas» al final del archivo, con el resultado de cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  valorGrabar, porGrabar, validarClase, mimeDeNota, pathDeNota, pathEsNotaDelProducto, pathEsNotaDelWorkspace,
  nombreDeAdjunto, validarNota, adjuntoSeVe, huerfanosABorrar, decidirPurga, esVideoSubido, esAdjuntoSubido, pideBorrarPurga,
  MIME_NOTA, TOPE_NOTA_BYTES, TOPE_NOTA_TEXTO, TOPE_NOMBRE_ADJUNTO, type ArchivoBucket,
} from '../app/customer-success/curso/reglas';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';
import type { Clase } from '../lib/curso';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas `//` PRIMERO y los bloques después (AGENTS.md: un `/*` adentro de un comentario de
// línea abre un bloque que se come el código del medio).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función exportada, hasta la próxima declaración de nivel superior. */
const bloque = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.slice(i + firma.length).search(/\n(export |async function |function |const |type )/);
  return fin < 0 ? src.slice(i) : src.slice(i, i + firma.length + fin);
};

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const clase = (id: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 7, etapa: 'bienvenida', orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});

// ── Grabar / no grabar ───────────────────────────────────────────────────────

test('valorGrabar: sólo true, false o null; cualquier otra cosa no escribe nada', () => {
  assert.equal(valorGrabar(true), true);
  assert.equal(valorGrabar(false), false);
  assert.equal(valorGrabar(null), null);
  for (const malo of ['true', 1, 0, undefined, {}, 'null']) assert.equal(valorGrabar(malo), undefined, `aceptó ${JSON.stringify(malo)}`);
});

test('porGrabar: las marcadas «Grabar» que todavía no tienen video; sin decidir no cuenta', () => {
  const cs = [
    clase(1), // grabar, sin video → cuenta
    clase(2, { videoTipo: 'youtube', videoUrl: 'https://youtu.be/x' }), // grabar, ya tiene video → no
    clase(3), // no grabar → no
    clase(4), // sin decidir → no
    clase(5), // sin entrada en el mapa → no
  ];
  assert.equal(porGrabar(cs, { 1: true, 2: true, 3: false, 4: null }), 1);
  assert.equal(porGrabar(cs, {}), 0);
});

test('guardar la clase entera NO trae la marca: validarClase no devuelve `grabar` aunque llegue', () => {
  const r = validarClase({ productoId: 7, etapa: 'bienvenida', titulo: 'Tu compromiso', grabar: true },
    { ws: 1, productoId: 7, etapas: ['bienvenida'] });
  assert.ok(r.ok);
  assert.equal('grabar' in r.fila, false, 'el guardado de la clase escribiría la marca y pisaría lo que eligió Mauricio');
});

test('marcarGrabar escribe SÓLO la columna grabar, y guardarClase no la nombra', () => {
  const admin = sinComentarios(leer('lib/curso-admin.ts'));
  const marcar = bloque(admin, 'export async function marcarGrabar(');
  const updates = marcar.match(/\.update\(/g) ?? [];
  assert.equal(updates.length, 1, 'marcarGrabar tiene que hacer UNA escritura');
  assert.match(marcar, /\.update\(\{ grabar: valor \}\)/, 'la escritura tiene que llevar sólo `grabar`');
  assert.doesNotMatch(marcar, /updated_at/, 'la marca no es un cambio del contenido');
  assert.match(marcar, /valorGrabar\(raw\)/, 'el valor tiene que pasar por la regla pura');
  const guardar = bloque(admin, 'export async function guardarClase(');
  assert.doesNotMatch(guardar, /grabar/);
});

test('el portal no depende de la 0208: COLUMNAS_CLASE no lee `grabar`, la tab la lee aparte', () => {
  const datos = sinComentarios(leer('lib/curso-datos.ts'));
  const linea = datos.split('\n').find((l) => l.includes('export const COLUMNAS_CLASE'));
  assert.ok(linea);
  assert.doesNotMatch(linea!, /grabar/);
  const admin = sinComentarios(leer('lib/curso-admin.ts'));
  assert.match(bloque(admin, 'export async function grabarDeProductos('), /'id, grabar'/);
});

test('marcar es de un admin; las notas, de quien VE la tab', () => {
  const acc = sinComentarios(leer('app/customer-success/curso/actions.ts'));
  assert.match(bloque(acc, 'export async function marcarGrabarAction('), /await puedeEditar\(\)/);
  for (const f of ['notasAction', 'agregarNotaAction', 'borrarNotaAction', 'urlSubidaNotaAction', 'descartarAdjuntoNotaAction', 'urlAdjuntoNotaAction']) {
    const b = bloque(acc, `export async function ${f}(`);
    assert.match(b, /await puedeVer\(\)/, `${f} no pregunta si puede ver`);
    assert.doesNotMatch(b, /puedeEditar/, `${f} pide ser admin: el equipo no podría comentar`);
  }
  // El autor sale de la SESIÓN, no del pedido.
  assert.match(bloque(acc, 'export async function agregarNotaAction('), /await quienMira\(\)/);
});

// ── Las notas: el adjunto ────────────────────────────────────────────────────

test('mimeDeNota: la extensión manda; lo que no es documento, planilla o imagen no va', () => {
  const XLS = 'application/vnd.ms-excel';
  assert.equal(mimeDeNota('datos.csv', XLS), 'text/csv', 'Windows con Excel le pone ms-excel a un .csv');
  assert.equal(mimeDeNota('Plan.DOCX', ''), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(mimeDeNota('foto.JPEG', 'application/octet-stream'), 'image/jpeg');
  assert.equal(mimeDeNota('sin-extension', 'application/pdf'), 'application/pdf');
  assert.equal(mimeDeNota('clase.mp4', 'video/mp4'), null, 'un video no es un adjunto: va a curso-videos');
  assert.equal(mimeDeNota('virus.exe', 'application/x-msdownload'), null);
  assert.equal(mimeDeNota('pagina.html', 'text/html'), null);
});

test('pathDeNota y sus guardas: el workspace primero, un uuid, y sólo extensiones de la lista', () => {
  const p = pathDeNota(1, 7, 'application/pdf', UUID);
  assert.equal(p, `1/7/${UUID}.pdf`);
  assert.equal(pathDeNota(1, 7, 'video/mp4', UUID), null);
  assert.equal(pathDeNota(1, 7, 'application/pdf', 'no-es-un-uuid'), null);
  assert.equal(pathDeNota(0, 7, 'application/pdf', UUID), null);
  assert.equal(pathEsNotaDelProducto(p, 1, 7), true);
  assert.equal(pathEsNotaDelProducto(p, 2, 7), false, 'el adjunto de otro negocio');
  assert.equal(pathEsNotaDelProducto(p, 1, 8), false);
  assert.equal(pathEsNotaDelWorkspace(p, 1), true);
  assert.equal(pathEsNotaDelWorkspace(p, 11), false, 'el prefijo «1» no es el ws 11');
  assert.equal(pathEsNotaDelWorkspace(`1/../2/${UUID}.pdf`, 1), false);
  assert.equal(pathEsNotaDelWorkspace(`1/7/${UUID}.mp4`, 1), false);
});

test('nombreDeAdjunto: sin carpetas, sin caracteres de control, con tope', () => {
  assert.equal(nombreDeAdjunto('C:\\fakepath\\Precios 2026.xlsx'), 'Precios 2026.xlsx');
  assert.equal(nombreDeAdjunto('a/b/c.pdf'), 'c.pdf');
  assert.equal(nombreDeAdjunto('ho\u0000la\u001f.pdf'), 'hola.pdf');
  assert.equal(nombreDeAdjunto('   '), 'archivo');
  assert.equal(nombreDeAdjunto(42), 'archivo');
  assert.equal(nombreDeAdjunto('x'.repeat(500)).length, TOPE_NOMBRE_ADJUNTO);
});

test('adjuntoSeVe: PDF, imágenes y texto se abren; una planilla se baja', () => {
  assert.equal(adjuntoSeVe('application/pdf'), true);
  assert.equal(adjuntoSeVe('image/png'), true);
  assert.equal(adjuntoSeVe('text/plain'), true);
  assert.equal(adjuntoSeVe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), false);
  assert.equal(adjuntoSeVe(null), false);
});

// ── Las notas: lo que se guarda ──────────────────────────────────────────────

const ctxN = { ws: 1, productoId: 7, etapas: ['bienvenida', 'contexto'] };
const adj = { path: `1/7/${UUID}.pdf`, nombre: 'Precios.pdf', mime: 'application/pdf', bytes: 2048 };

test('validarNota: una nota cuelga de UNA clase o de UNA etapa', () => {
  const err = (raw: unknown) => { const r = validarNota(raw, ctxN); assert.equal(r.ok, false); return (r as { error: string }).error; };
  assert.equal(err({ productoId: 7, texto: 'hola' }), 'La nota no tiene dónde ir.');
  assert.equal(err({ productoId: 7, claseId: 3, etapa: 'bienvenida', texto: 'hola' }), 'La nota no tiene dónde ir.');
  assert.equal(err({ productoId: 7, etapa: 'otra', texto: 'hola' }), 'Esa etapa no existe.');
  assert.equal(err({ productoId: 7, claseId: -1, texto: 'hola' }), 'Esa clase no existe.');
  assert.equal(err({ productoId: 8, claseId: 3, texto: 'hola' }), 'Ese producto no es este.');
  const deEtapa = validarNota({ productoId: 7, etapa: 'contexto', texto: '  ojo con el PAS  ' }, ctxN);
  assert.ok(deEtapa.ok);
  assert.deepEqual([deEtapa.fila.clase_id, deEtapa.fila.etapa, deEtapa.fila.texto], [null, 'contexto', 'ojo con el PAS']);
  const deClase = validarNota({ productoId: 7, claseId: 3, texto: 'x' }, ctxN);
  assert.ok(deClase.ok);
  assert.deepEqual([deClase.fila.clase_id, deClase.fila.etapa], [3, null]);
});

test('validarNota: el adjunto tiene que ser de ESTE producto, de un tipo del bucket y debajo del tope', () => {
  const err = (archivo: unknown, texto = '') => { const r = validarNota({ productoId: 7, claseId: 3, texto, archivo }, ctxN); assert.equal(r.ok, false); return (r as { error: string }).error; };
  assert.equal(err({ ...adj, path: `2/7/${UUID}.pdf` }), 'Ese archivo no es de este curso.');
  assert.equal(err({ ...adj, path: `1/9/${UUID}.pdf` }), 'Ese archivo no es de este curso.');
  assert.equal(err({ ...adj, mime: 'text/html' }), 'Ese formato no va.');
  assert.equal(err({ ...adj, bytes: TOPE_NOTA_BYTES + 1 }), 'Pasa de 25 MB.');
  assert.equal(err({ ...adj, bytes: 0 }), 'Pasa de 25 MB.');
  const ok = validarNota({ productoId: 7, claseId: 3, archivo: { ...adj, nombre: 'C:\\x\\Precios.pdf' } }, ctxN);
  assert.ok(ok.ok, 'un adjunto sin texto es una nota');
  assert.equal(ok.fila.archivo_nombre, 'Precios.pdf');
  assert.equal(ok.fila.texto, '');
});

test('validarNota: vacía o demasiado larga no se guarda', () => {
  const err = (raw: unknown) => { const r = validarNota(raw, ctxN); assert.equal(r.ok, false); return (r as { error: string }).error; };
  assert.equal(err({ productoId: 7, claseId: 3, texto: '   ' }), 'La nota está vacía.');
  assert.equal(err({ productoId: 7, claseId: 3, texto: 'x'.repeat(TOPE_NOTA_TEXTO + 1) }), 'La nota es demasiado larga.');
});

// ── La migración y el registro del inquilino ─────────────────────────────────

const MIG = 'supabase/migrations/0208_curso_grabar_y_notas.sql';

test('0208: se aplica antes del deploy, `grabar` sin default, RLS y revoke en la tabla nueva', () => {
  const crudo = leer(MIG);
  assert.match(crudo, /se aplica ANTES del deploy: el código nuevo la lee/);
  const sql = crudo.replace(/^\s*--.*$/gm, '');
  const add = sql.split('\n').find((l) => /add column if not exists grabar/.test(l));
  assert.ok(add, 'falta la columna grabar');
  assert.match(add!, /grabar boolean;/);
  assert.doesNotMatch(add!, /default|not null/, 'NULL es «sin decidir»: un default inventa una decisión');
  assert.match(sql, /create table if not exists curso_clase_notas \(/);
  assert.match(sql, /workspace_id\s+bigint not null default 1 references workspaces\(id\) on delete cascade/);
  assert.match(sql, /clase_id\s+bigint references curso_clases\(id\) on delete cascade/);
  assert.match(sql, /alter table curso_clase_notas enable row level security;/);
  assert.match(sql, /revoke all on curso_clase_notas from anon, authenticated;/);
});

test('0208: el bucket curso-notas es privado y acepta EXACTAMENTE los tipos y el tope de reglas.ts', () => {
  const sql = leer(MIG).replace(/^\s*--.*$/gm, '');
  const ins = sql.slice(sql.indexOf('insert into storage.buckets'));
  assert.match(ins, /values \('curso-notas', 'curso-notas', false, (\d+), array\[/);
  const tope = Number(/values \('curso-notas', 'curso-notas', false, (\d+)/.exec(ins)![1]);
  assert.equal(tope, TOPE_NOTA_BYTES, 'el tope del bucket y el de la pantalla son distintos');
  const lista = ins.slice(ins.indexOf('array['), ins.indexOf(']'));
  const mimes = [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(mimes, [...MIME_NOTA].sort(), 'la lista del bucket y MIME_NOTA se separaron');
  assert.match(ins, /on conflict \(id\) do update set public = false/);
});

test('curso_clase_notas está en TENANT_TABLES, en la lista de inquilino, y su bucket en el reset', () => {
  const ws = sinComentarios(leer('lib/workspace.ts'));
  const tenant = ws.slice(ws.indexOf('const TENANT_TABLES'), ws.indexOf(']);', ws.indexOf('const TENANT_TABLES')));
  assert.match(tenant, /'curso_clase_notas'/, 'sin esto getTenantDb() es PASSTHROUGH: las notas de otro negocio');
  assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes('curso_clase_notas'));
  const reset = sinComentarios(leer('lib/reset-workspace.ts'));
  const buckets = reset.split('\n').find((l) => l.includes('const BUCKETS'));
  assert.match(buckets!, /'curso-notas'/);
});

// ── La purga de huérfanos ────────────────────────────────────────────────────

const AHORA = Date.parse('2026-10-07T12:00:00Z');
const hace = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();
const V = (ws: number, prod: number, u: string, ext = 'mp4') => `${ws}/${prod}/${u}.${ext}`;
const U2 = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';
const U3 = '6fa459ea-ee8a-3ca4-894e-db77e160355e';

test('huerfanosABorrar: sólo lo que tiene forma de subida, nadie nombra y pasó las 24 h', () => {
  const archivos: ArchivoBucket[] = [
    { path: V(1, 7, UUID), createdAt: hace(48) },      // huérfano viejo → se borra
    { path: V(2, 9, U2), createdAt: hace(48) },        // lo usa una clase de OTRO workspace → no
    { path: V(1, 7, U3), createdAt: hace(3) },         // reciente (puede estar subiéndose) → no
    { path: V(1, 8, U3), createdAt: null },            // sin fecha no hay edad → no
    { path: '1/7/.emptyFolderPlaceholder', createdAt: hace(99) }, // no es una subida → no
    { path: 'suelto.mp4', createdAt: hace(99) },       // tampoco
  ];
  const usados = new Set([V(2, 9, U2)]);
  assert.deepEqual(huerfanosABorrar(archivos, usados, AHORA, esVideoSubido), [V(1, 7, UUID)]);
  assert.deepEqual(huerfanosABorrar([{ path: V(1, 7, UUID), createdAt: hace(23.9) }], new Set(), AHORA, esVideoSubido), []);
});

test('decidirPurga es FAIL-CLOSED: lectura caída, o vacía con archivos, no borra nada', () => {
  const archivos: ArchivoBucket[] = [{ path: V(1, 7, UUID), createdAt: hace(48) }, { path: V(1, 7, U2), createdAt: hace(48) }];
  const caida = decidirPurga({ archivos, referencias: { ok: false, error: 'timeout' }, ahoraMs: AHORA, esPropio: esVideoSubido });
  assert.deepEqual(caida.borrar, []);
  assert.match(caida.motivo!, /timeout/);
  const vacia = decidirPurga({ archivos, referencias: { ok: true, paths: [] }, ahoraMs: AHORA, esPropio: esVideoSubido });
  assert.deepEqual(vacia.borrar, [], 'una lectura que volvió vacía borraría el video de cada clase');
  assert.match(vacia.motivo!, /no borro/);
  const normal = decidirPurga({ archivos, referencias: { ok: true, paths: [V(1, 7, U2)] }, ahoraMs: AHORA, esPropio: esVideoSubido });
  assert.deepEqual(normal, { borrar: [V(1, 7, UUID)], motivo: null });
  // Vacía pero sin subidas propias en el bucket: no hay nada que decidir, y no es una alarma.
  const nada = decidirPurga({ archivos: [{ path: 'x/.emptyFolderPlaceholder', createdAt: hace(48) }], referencias: { ok: true, paths: [] }, ahoraMs: AHORA, esPropio: esVideoSubido });
  assert.deepEqual(nada, { borrar: [], motivo: null });
});

test('esVideoSubido y esAdjuntoSubido no se pisan: un bucket no barre la forma del otro', () => {
  assert.equal(esVideoSubido(V(1, 7, UUID, 'mov')), true);
  assert.equal(esVideoSubido(V(1, 7, UUID, 'pdf')), false);
  assert.equal(esAdjuntoSubido(V(1, 7, UUID, 'xlsx')), true);
  assert.equal(esAdjuntoSubido(V(1, 7, UUID, 'mp4')), false);
  assert.equal(esAdjuntoSubido(`1/7/${UUID}-Precios.pdf`), false);
});

test('la purga lee TODOS los workspaces, lista ANTES de leer, y vuelve a preguntar antes de borrar', () => {
  const src = sinComentarios(leer('lib/curso-purga.ts'));
  assert.doesNotMatch(src, /getTenantDb|runWithWorkspace/, 'cruzar el bucket contra UN inquilino borra los videos de los demás');
  assert.match(bloque(src, 'async function rutasUsadas('), /leerTodo<.*?>\(getSupabaseServer\(\)/);
  const purgar = bloque(src, 'async function purgarBucket(');
  const iLista = purgar.indexOf('await listarBucket(');
  const iLee = purgar.indexOf('await rutasUsadas(');
  assert.ok(iLista >= 0 && iLee > iLista, 'las filas se leen DESPUÉS de listar el bucket');
  assert.match(purgar, /decidirPurga\(\{ archivos, referencias/);
  const iRelee = purgar.indexOf('.in(cfg.columna, lote)');
  const iBorra = purgar.indexOf('.remove(borrar)');
  assert.ok(iRelee >= 0 && iBorra > iRelee, 'falta la segunda pregunta antes de borrar');
  assert.equal((src.match(/\.remove\(/g) ?? []).length, 1, 'hay otro camino que borra sin pasar por la regla');
  assert.match(bloque(src, 'async function listarBucket('), /if \(error\) throw/);
});

test('pideBorrarPurga: borra SÓLO con un «1» explícito, en la URL o en el entorno', () => {
  assert.equal(pideBorrarPurga(null, undefined), false, 'sin nada tiene que ser el modo prueba');
  assert.equal(pideBorrarPurga(undefined, ''), false);
  assert.equal(pideBorrarPurga('1', undefined), true);
  assert.equal(pideBorrarPurga(null, '1'), true);
  for (const malo of ['', '0', 'true', 'TRUE', 'si', 'yes', ' 1', '1 ', '01']) {
    assert.equal(pideBorrarPurga(malo, malo), false, `borró con ${JSON.stringify(malo)}`);
  }
});

test('la purga, sin pedirlo, NO borra: cuenta, devuelve los candidatos y corta antes de la segunda pregunta', () => {
  const src = sinComentarios(leer('lib/curso-purga.ts'));
  const exp = bloque(src, 'export async function purgarHuerfanosDelCurso(');
  assert.match(exp, /\{ borrar = false, ahoraMs = Date\.now\(\) \}/, 'el default tiene que ser NO borrar');
  assert.match(exp, /await purgarBucket\(cfg, ahoraMs, borrar === true\)/);
  const purgar = bloque(src, 'async function purgarBucket(');
  const iCorte = purgar.indexOf('if (!candidatos.length || !borra) return r;');
  assert.ok(iCorte >= 0, 'falta el corte del modo prueba');
  assert.ok(iCorte < purgar.indexOf('.in(cfg.columna, lote)'), 'el modo prueba hace la segunda pregunta');
  assert.ok(iCorte < purgar.indexOf('.remove(borrar)'), 'el modo prueba llega al remove');
  // Y lo que hay que leer antes de prenderla sale ANTES del corte, o la prueba no muestra nada.
  for (const linea of ['r.huerfanos = d.borrar.length;', 'r.candidatos = candidatos;', 'r.bytesCandidatos = ']) {
    const i = purgar.indexOf(linea);
    assert.ok(i >= 0 && i < iCorte, `«${linea}» no sale en el modo prueba`);
  }
});

test('el cron de la purga usa la auth de la casa, no itera inquilinos, y borra sólo si se lo piden', () => {
  const src = sinComentarios(leer('app/api/cron/curso-purga/route.ts'));
  assert.match(src, /const denied = checkCronAuth\(req\);\s*if \(denied\) return denied;/);
  assert.match(src, /const borrar = pideBorrarPurga\(req\.nextUrl\.searchParams\.get\('borrar'\), process\.env\.CURSO_PURGA_BORRAR\);/);
  assert.match(src, /await purgarHuerfanosDelCurso\(\{ borrar \}\)/);
  assert.equal((src.match(/purgarHuerfanosDelCurso\(/g) ?? []).length, 1, 'hay otra llamada que no pasa por pideBorrarPurga');
  assert.doesNotMatch(src, /correrPorWorkspace|runWithWorkspace/);
});

// ── El cableado de la pantalla ───────────────────────────────────────────────

test('EditorClase monta las notas AFUERA del fieldset deshabilitado', () => {
  const src = sinComentarios(leer('app/customer-success/curso/EditorClase.tsx'));
  const cierre = src.indexOf('</fieldset>');
  const notas = src.indexOf('<NotasClase');
  assert.ok(cierre > 0 && notas > cierre, 'adentro de <fieldset disabled> quien sólo mira no puede comentar');
  assert.equal((src.match(/<NotasClase/g) ?? []).length, 1);
  assert.match(src.slice(notas, src.indexOf('/>', notas)), /destino=\{\{ claseId: clase\.id \}\}/);
});

test('CursoApp: el control de grabar sólo para quien edita, y las notas de cada etapa para todos', () => {
  const src = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.match(src, /\{puedeEditar && marca !== undefined && \(\s*<ControlGrabar /);
  assert.match(src, /await marcarGrabarAction\(c\.id, valor\)/);
  assert.match(src, /porGrabar\(delProducto, grabar\)/);
  assert.match(src, /<NotasClase[^>]*destino=\{\{ etapa: notasEtapa \}\}/);
  // El botón «Notas» de la etapa no cuelga de puedeEditar. Desde el 07/10/2026 vive en la cabecera
  // del módulo abierto del curso (`acciones` de app/_cursos/CursoUgc.tsx), que arma `modulos`: ni
  // el botón ni el bloque que lo arma pueden mirar `puedeEditar`.
  const ini = src.indexOf('<span className="cu-sec-acciones">');
  const accion = src.slice(ini, src.indexOf('</button>', ini));
  assert.match(accion, /<button type="button" className="ugc-btn" onClick=\{\(\) => setNotasEtapa\(m\.key\)\}>/);
  const bloque = src.slice(src.indexOf('const modulos = servicio'), src.indexOf('const clasesUgc = '));
  assert.ok(bloque.length > 200 && bloque.includes('cu-sec-acciones'), 'no encontré el bloque que arma los módulos');
  assert.doesNotMatch(bloque, /puedeEditar/);
});

test('NotasClase sube por URL firmada y abre por el id de la nota', () => {
  const src = sinComentarios(leer('app/customer-success/curso/NotasClase.tsx'));
  assert.match(src, /await urlSubidaNotaAction\(productoId, mime, archivo\.size\)/);
  assert.match(src, /subirConProgreso\(firma\.signedUrl, archivo, firma\.apikey, setSubiendo, FORMATOS\)/);
  assert.match(src, /await urlAdjuntoNotaAction\(n\.id\)/);
  assert.match(src, /await agregarNotaAction\(/);
});

// ── Roturas (06/10/2026) ─────────────────────────────────────────────────────
// Con todo en su lugar: 24 pass / 0 fail. Un arnés (scratchpad, curso-admin-roturas.mjs) rompió
// UNA cosa por vez sobre el archivo real y restauró de MEMORIA (nunca con git), verificando que
// el archivo volviera idéntico. 34 roturas; cada una dio 23 pass / 1 fail con SU test caído,
// salvo la que se nota en dos:
//   · valorGrabar aceptando 'true' o 1 · porGrabar contando las marcadas que ya tienen video
//   · validarClase dejando pasar `grabar` · marcarGrabar escribiendo también `updated_at`
//   · COLUMNAS_CLASE con `grabar` · marcarGrabarAction con puedeVer · agregarNotaAction con puedeEditar
//   · mimeDeNota creyéndole primero al navegador · pathEsNotaDelWorkspace con `.+`
//   · pathDeNota sin chequear el uuid · adjuntoSeVe siempre true · validarNota sin el XOR del
//     destino, aceptando el adjunto de otro ws, sin tope de bytes, sin tope de texto, o vacía
//   · la 0208 con `default false`, sin el revoke, o sin 'image/gif' en el bucket
//   · TENANT_TABLES sin la tabla · el reset sin el bucket
//   · huerfanosABorrar sin la edad, o tomando «sin fecha» por viejo · decidirPurga sin el guard
//     de la lectura vacía · esVideoSubido aceptando .pdf
//   · la purga leyendo con getTenantDb, sin la segunda pregunta, o leyendo antes de listar
//   · el cron sin checkCronAuth · las notas ADENTRO del fieldset · el control de grabar para
//     todos · las notas de etapa sólo para admin · NotasClase abriendo por otra cosa que el id
//   · nombreDeAdjunto sin sacar las carpetas → 22 / 2: su test y el del adjunto de validarNota,
//     que también manda un `C:\x\Precios.pdf`.
//
// ── Roturas del MODO PRUEBA de la purga (06/10/2026) ─────────────────────────
// El revisor marcó que la purga borraba desde la primera corrida (el plan pedía arrancar contando).
// Con el modo prueba puesto: 26 pass / 0 fail. Mismo arnés (scratchpad, curso-purga-roturas.mjs),
// restaurando de MEMORIA y comprobando el md5 de los tres archivos antes y después. 11 roturas,
// cada una 25 pass / 1 fail con SU test caído:
//   · pideBorrarPurga con `!!query || !!env`, con «el entorno presente alcanza» (`env != null`), o
//     con `trim()` → cae «pideBorrarPurga: borra SÓLO con un "1" explícito»
//   · el default en `borrar = true` · `purgarBucket(cfg, ahoraMs, true)` · el corte sin `!borra` ·
//     `r.candidatos` o `r.bytesCandidatos` movidos DESPUÉS del corte (la prueba no mostraría nada)
//     → cae «la purga, sin pedirlo, NO borra»
//   · la ruta con `{ borrar: true }` fijo · la ruta con el entorno reemplazado por '1' · una segunda
//     llamada que no pasa por pideBorrarPurga → cae «el cron de la purga… borra sólo si se lo piden»
