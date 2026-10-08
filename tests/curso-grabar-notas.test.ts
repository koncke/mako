// =============================================================================
// curso-grabar-notas — lo que QUEDA de la marca de grabar (#693) y de las notas del equipo (#692):
// sus columnas, su tabla, su bucket y la purga de los archivos huérfanos. Y que su pantalla NO esté.
// =============================================================================
// 08/10/2026, items 13 y 15 del pedido de Martín: «Elimina la sección de "Notas" en todos lados» y
// «Elimina el botón de "grabar/no grabar"». Este archivo cambió de sentido ese día: antes fijaba el
// cableado de la marca y de las notas; ahora fija que la pantalla, las acciones, la lectura y el
// conteo NO estén, y que lo que se quedó a propósito (la columna, la tabla, el bucket, la purga)
// siga en su lugar.
//
// Ejecuta app/customer-success/curso/reglas.ts (puro) y lee como FUENTE (sin comentarios, con los
// \r\n normalizados) lo que no se puede ejecutar sin base: lib/curso-admin.ts, lib/curso-purga.ts, el
// cron, las actions, la tab del curso y la migración 0208.
//
// Probado ROMPIÉNDOLO: ver los bloques «Roturas» al final del archivo, con el resultado de cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as reglas from '../app/customer-success/curso/reglas';
import {
  validarClase, mimeDeNota, pathDeNota, pathEsNotaDelProducto, pathEsNotaDelWorkspace,
  nombreDeAdjunto, validarNota, adjuntoSeVe, huerfanosABorrar, decidirPurga, esVideoSubido, esAdjuntoSubido, pideBorrarPurga,
  MIME_NOTA, TOPE_NOTA_BYTES, TOPE_NOTA_TEXTO, TOPE_NOMBRE_ADJUNTO, type ArchivoBucket,
} from '../app/customer-success/curso/reglas';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

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
/** Los fuentes (.ts/.tsx) de una carpeta, recursivo, con su ruta relativa a la raíz. */
const fuentesDe = (rel: string): string[] => readdirSync(join(RAIZ, rel)).flatMap((n) => {
  const r = `${rel}/${n}`;
  if (statSync(join(RAIZ, r)).isDirectory()) return fuentesDe(r);
  return /\.tsx?$/.test(n) ? [r] : [];
});

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';

// ── Grabar / no grabar: se fue la pantalla, queda la columna ─────────────────

test('«Grabar / No grabar» se fue entero: ni la regla, ni la escritura, ni la lectura, ni el conteo, ni el control', () => {
  // La UI del curso (la tab, el dibujo compartido) y lo que la servía. Sin comentarios: el que
  // explica por qué se fue nombra lo que se fue.
  const archivos = [
    ...fuentesDe('app/customer-success/curso'), ...fuentesDe('app/_cursos'),
    'lib/curso-admin.ts', 'lib/curso-datos.ts', 'lib/curso-portal.ts',
  ];
  assert.ok(archivos.length >= 20, `barrí sólo ${archivos.length} archivos: la lista de carpetas quedó vieja`);
  const rastro = /\b(?:marcarGrabar|marcarGrabarAction|grabarDeProductos|valorGrabar|porGrabar|ControlGrabar|nPorGrabar)\b|por grabar|cu-grabar|'No grabar'|"No grabar"|>\s*No grabar\s*</;
  for (const f of archivos) assert.doesNotMatch(sinComentarios(leer(f)), rastro, `${f} todavía tiene la marca de grabar`);
  // Y ninguna exportación de las reglas: un `export` que nadie llama es la puerta para volver a cablearla.
  assert.equal('valorGrabar' in reglas, false);
  assert.equal('porGrabar' in reglas, false);
});

test('guardar la clase entera NO trae la marca: validarClase no devuelve `grabar` aunque llegue (la columna queda)', () => {
  const r = validarClase({ productoId: 7, etapa: 'bienvenida', titulo: 'Tu compromiso', grabar: true },
    { ws: 1, productoId: 7, modulos: ['bienvenida'] });
  assert.ok(r.ok);
  assert.equal('grabar' in r.fila, false, 'el guardado de la clase escribiría la marca que la mig 0208 dejó guardada');
  const guardar = bloque(sinComentarios(leer('lib/curso-admin.ts')), 'export async function guardarClase(');
  assert.doesNotMatch(guardar, /grabar/);
});

test('el portal no depende de la 0208: COLUMNAS_CLASE no lee `grabar`, y la tab tampoco ya', () => {
  const datos = sinComentarios(leer('lib/curso-datos.ts'));
  const linea = datos.split('\n').find((l) => l.includes('export const COLUMNAS_CLASE'));
  assert.ok(linea);
  assert.doesNotMatch(linea!, /grabar/);
  assert.doesNotMatch(sinComentarios(leer('app/customer-success/curso/page.tsx')), /grabar/i, 'la página de la tab volvió a leer la marca');
});

test('las notas del equipo se fueron de la tab: ni la caja, ni sus seis acciones, ni el conteo, ni el botón de la etapa', () => {
  const acc = sinComentarios(leer('app/customer-success/curso/actions.ts'));
  for (const f of ['notasAction', 'agregarNotaAction', 'borrarNotaAction', 'urlSubidaNotaAction', 'descartarAdjuntoNotaAction', 'urlAdjuntoNotaAction', 'marcarGrabarAction', 'guardarClaseAction']) {
    assert.doesNotMatch(acc, new RegExp(`export async function ${f}\\(`), `${f} sigue abierta: una action sin pantalla es un POST que cualquiera con sesión puede mandar`);
  }
  assert.doesNotMatch(acc, /@\/lib\/curso-notas/, 'actions.ts sigue importando las notas');
  const rastro = /\b(?:NotasClase|notasAction|agregarNotaAction|conteoDeNotas|ConteoNotas|setNotasEtapa|notasEtapa|contarNotasClase|contarNotasEtapa)\b|['"`>]\s*Notas\b|curso-notas'/;
  for (const f of [...fuentesDe('app/customer-success/curso'), ...fuentesDe('app/_cursos')]) {
    assert.doesNotMatch(sinComentarios(leer(f)), rastro, `${f} todavía tiene las notas del equipo`);
  }
  // Los dos componentes de la pantalla, borrados (no «sin usar»: un archivo que nadie importa se
  // vuelve a montar con una línea).
  const curso = readdirSync(join(RAIZ, 'app/customer-success/curso'));
  assert.ok(!curso.includes('NotasClase.tsx'), 'volvió NotasClase.tsx');
  assert.ok(!curso.includes('EditorClase.tsx'), 'volvió EditorClase.tsx (el modal de «Editar», que tenía la caja de notas)');
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

// ── Roturas (06/10/2026) ─────────────────────────────────────────────────────
// ⚠️ Las de la marca de grabar, de las acciones de las notas y del cableado de la pantalla son de lo
// que se BORRÓ el 08/10/2026: quedan acá como registro, y las que valen hoy están en el bloque del
// 08/10, al final.
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
//
// ── Roturas del 08/10/2026: que la pantalla de la marca y de las notas NO vuelva ──────
// Sin romper: 21 pass / 0 fail. Arnés scratchpad/leccion/romper.mjs: una rotura por vez sobre el
// archivo real, restaurado de MEMORIA (nunca con git) y comprobado con md5; si otra sesión hubiera
// escrito el archivo mientras estaba roto, deshace SÓLO la rotura. 8 roturas, cada una 20 / 1 con SU
// test caído:
//   · `export const valorGrabar` de vuelta en reglas.ts · un `'No grabar'` en la lección
//     → «"Grabar / No grabar" se fue entero»
//   · validarClase devolviendo `grabar: true` en la fila → «guardar la clase entera NO trae la marca»
//   · la página de la tab leyendo algo llamado `grabar…` → «el portal no depende de la 0208…»
//   · `export async function guardarClaseAction` de vuelta · `import '@/lib/curso-notas'` en las
//     actions · un `'Notas'` en la lección · un EditorClase.tsx (aunque vacío) en la carpeta
//     → «las notas del equipo se fueron de la tab»
