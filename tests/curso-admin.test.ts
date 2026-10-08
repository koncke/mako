// =============================================================================
// curso-admin — la tab Curso: lo que valida el editor, el orden, el path de un video subido,
// la fila de Avance, y que la barra tenga el destino
// =============================================================================
// Ejecuta app/customer-success/curso/reglas.ts (puro: lo usan la página, el editor y las
// escrituras de lib/curso-admin.ts) y lee app/_components/nav.ts.
//
// Probado ROMPIÉNDOLO (06/10/2026), una rotura por regla, sobre el archivo real y restaurado con
// el texto guardado (verificado por hash). Con todo en su lugar: 16 pass / 0 fail. Cada rotura
// dio 15 pass / 1 fail, y el que cayó fue SU test:
//   · `validarClase` sin el chequeo de `pathEsDelProducto` (acepta el video de otro ws).
//   · `validarClase` sin el «Cierra la etapa sin tarea».
//   · `reordenar` sin el tope del borde de arriba (j < 0).
//   · `porEtapas` sin las huérfanas.
//   · `pathEsDelWorkspace` con `.+` en vez de `\d{1,12}` en el producto (deja pasar `..`).
//   · `nuevoIdCampo` como contador `c${i + 1}` (devuelve el id de un campo borrado).
//   · `avanceDeCliente` promediando también los videos que no se miden.
//   · nav: el ítem de Clientes con `starts('/customer-success')` (se enciende en /curso).
//   · «Sin clases.» → «No tenés clases.» en CursoApp.tsx (el guard de voseo).
// 08/10/2026 (D1, los módulos sueltos): 19 pass sin romper; `validarClase` dejando «Cierra la etapa»
// en un módulo suelto → 18 / 1 «una clase puede ir a un módulo SUELTO…».
// REVISIÓN del 08/10/2026: 20 pass sin romper; `guardarClase` rechazando la «Cierra la etapa» que la
// clase YA tenía en el suelto → 19 / 1 «guardarClase: … se conserva» (scratchpad/rev-nucleo/romper-final.mjs).
// ⚠️ La primera versión de la rotura de `nuevoIdCampo` (`c${existentes.length + 1}`) dio 16/0:
// chocaba siempre, y la salida de emergencia de la función la rescataba. Una rotura que no
// imita el bug real no prueba nada; la que vale es el contador que busca el primer hueco.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  validarClase, validarVideoEntrada, ordenConClaseEn, ERROR_OBLIGATORIA_SUELTO,
  reordenar, moverEnLista, porEtapas, pathDeSubida, pathEsDelProducto, pathEsDelWorkspace,
  mimeDeArchivo, nuevoIdCampo, avanceDeCliente, etapaDelCliente, videoDeClase, ordenarFilas, siguienteOrden,
  type FilaAvance,
} from '../app/customer-success/curso/reglas';
import type { Clase } from '../lib/curso';
import { FAMILIAS, itemsDe } from '../app/_components/nav';
import { CAPAS, tabEnCapa, type CapaId } from '../lib/capas';

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
// Las claves de los MÓDULOS del curso (D1, 08/10/2026): los vinculados son etapas; `m_extra` es suelto.
const ctx = { ws: 1, productoId: 7, modulos: ['bienvenida', 'contexto', 'm_extra'], sueltos: ['m_extra'] };
const base = { productoId: 7, etapa: 'bienvenida', titulo: 'Tu compromiso' };

const clase = (id: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 7, etapa: 'bienvenida', orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});

// ── validarClase ─────────────────────────────────────────────────────────────

test('validarClase: lo mínimo pasa y se normaliza (link reconocido, minutos enteros)', () => {
  const r = validarClase({ ...base, titulo: '  Tu compromiso ', minutos: '4.6', video: { tipo: 'link', url: 'https://youtu.be/abc' } }, ctx);
  assert.ok(r.ok);
  assert.equal(r.fila.titulo, 'Tu compromiso');
  assert.equal(r.fila.minutos, 5);
  assert.equal(r.fila.video_tipo, 'youtube');
  assert.equal(r.fila.video_path, null);
  assert.equal(r.id, null);
});

test('validarClase: lo que no cierra se rechaza con un error corto', () => {
  const err = (raw: unknown) => { const r = validarClase(raw, ctx); assert.equal(r.ok, false); return (r as { error: string }).error; };
  assert.equal(err({ ...base, titulo: '  ' }), 'Falta el título.');
  assert.equal(err({ ...base, etapa: 'borrada' }), 'Ese módulo no existe.');
  assert.equal(err({ ...base, productoId: 8 }), 'Ese producto no es este.');
  // ⚠️ El link termina en el `src` de un iframe que ve el cliente.
  assert.equal(err({ ...base, video: { tipo: 'link', url: 'javascript:alert(1)' } }), 'Ese link no es válido.');
  assert.equal(err({ ...base, minutos: -3 }), 'Los minutos no cierran.');
  assert.equal(err({ ...base, campos: [{ id: 'a', label: '', tipo: 'texto' }] }), 'Hay un campo sin pregunta.');
  assert.match(err({ ...base, campos: [{ id: 'a', label: 'Elige', tipo: 'eleccion', opciones: ['', ' '] }] }), /Faltan las opciones/);
  assert.match(err({ ...base, campos: [{ id: 'a', label: 'Tabla', tipo: 'tabla' }] }), /Faltan las columnas/);
  assert.equal(err({ ...base, campos: [{ id: 'a', label: 'X', tipo: 'texto' }, { id: 'a', label: 'Y', tipo: 'texto' }] }), 'Hay campos repetidos.');
});

test('validarClase: un video subido sólo vale si es de ESTE workspace y ESTE producto', () => {
  const ok = validarClase({ ...base, video: { tipo: 'archivo', path: `1/7/${UUID}.mp4` } }, ctx);
  assert.ok(ok.ok);
  assert.equal(ok.fila.video_tipo, 'archivo');
  assert.equal(ok.fila.video_url, null);
  for (const path of [`2/7/${UUID}.mp4`, `1/8/${UUID}.mp4`, `1/7/${UUID}.exe`, `1/7/../../2/7/${UUID}.mp4`, `1/7/clase.mp4`]) {
    const r = validarClase({ ...base, video: { tipo: 'archivo', path } }, ctx);
    assert.equal(r.ok, false, `${path} es de otro curso y pasó`);
  }
});

test('validarClase: «Cierra la etapa» sin tarea no se guarda (no cerraría nada)', () => {
  const r = validarClase({ ...base, obligatoria: true }, ctx);
  assert.equal(r.ok, false);
  assert.equal((r as { error: string }).error, 'Para cerrar la etapa, agrega la tarea.');
  assert.ok(validarClase({ ...base, obligatoria: true, tarea: 'Llena tu hoja' }, ctx).ok);
  assert.ok(validarClase({ ...base, obligatoria: true, campos: [{ id: 'c1', label: '¿Qué vendes?', tipo: 'linea' }] }, ctx).ok);
});

test('validarClase: una clase puede ir a un módulo SUELTO, pero ahí «Cierra la etapa» no existe', () => {
  // D1: la clave de un suelto vale como módulo (antes sólo valían las etapas del kanban).
  assert.ok(validarClase({ ...base, etapa: 'm_extra', tarea: 'Llena tu hoja' }, ctx).ok);
  // Un suelto no es una etapa: «Cierra la etapa» se guardaría sin efecto. Se rechaza, corto.
  const r = validarClase({ ...base, etapa: 'm_extra', obligatoria: true, tarea: 'Llena tu hoja' }, ctx);
  assert.equal(r.ok, false);
  assert.equal((r as { error: string }).error, ERROR_OBLIGATORIA_SUELTO);
  // En un vinculado sigue valiendo.
  assert.ok(validarClase({ ...base, etapa: 'contexto', obligatoria: true, tarea: 'Llena tu hoja' }, ctx).ok);
});

test('guardarClase: «Cierra la etapa» que la clase YA tenía en un suelto se conserva (revisión 08/10)', () => {
  // Llega a un suelto al DESVINCULAR su módulo o al arrastrarla (`moverClaseA` no la borra). Con la
  // regla de arriba a secas, guardar el TÍTULO desde el editor rebotaba hasta destildarla. Lo que
  // `validarClase` rechaza es ponerla NUEVA; `guardarClase` le saca a `sueltos` el módulo donde ya la tenía.
  assert.ok(validarClase({ ...base, etapa: 'm_extra', obligatoria: true, tarea: 'x' }, { ...ctx, sueltos: [] }).ok);
  const src = readFileSync(join(import.meta.dirname, '..', 'lib', 'curso-admin.ts'), 'utf8').replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const g = src.slice(src.indexOf('export async function guardarClase('), src.indexOf('export async function borrarClase('));
  assert.ok(g.length > 400 && g.length < 4000, `el recorte mide ${g.length}`);
  assert.match(g, /const yaLaTenia = antes\?\.obligatoria && antes\.productoId === productoId \? antes\.etapa : null;/);
  assert.match(g, /const sueltos = prod\.modulos\.filter\(\(m\) => !m\.vinculado && m\.clave !== yaLaTenia\)/);
  assert.match(g, /validarClase\(raw, \{ ws, productoId, modulos: prod\.claves, sueltos \}\)/);
});

test('validarVideoEntrada: el contrato de la lección (url / archivo / null) y el de siempre (link)', () => {
  const ok = (raw: unknown) => { const r = validarVideoEntrada(raw, ctx); assert.ok(r.ok, JSON.stringify(raw)); return r.video; };
  assert.deepEqual(ok({ tipo: 'url', url: 'https://youtu.be/abc' }).video_tipo, 'youtube');
  assert.deepEqual(ok({ tipo: 'link', url: 'https://youtu.be/abc' }).video_tipo, 'youtube');
  assert.deepEqual(ok(null), { video_tipo: 'ninguno', video_url: null, video_path: null });
  assert.deepEqual(ok({ tipo: 'archivo', path: `1/7/${UUID}.mp4` }).video_path, `1/7/${UUID}.mp4`);
  const mal = (raw: unknown) => { const r = validarVideoEntrada(raw, ctx); assert.equal(r.ok, false, JSON.stringify(raw)); };
  mal({ tipo: 'url', url: 'javascript:alert(1)' });
  mal({ tipo: 'archivo', path: `2/7/${UUID}.mp4` });
  // Un tipo que no existe no se lee como «sin video»: borrar el video por un pedido roto no.
  mal({ tipo: 'otro' });
});

test('ordenConClaseEn: la clase entra ANTES de la pedida (o al final), venga del mismo módulo o de otro', () => {
  assert.deepEqual(ordenConClaseEn([1, 2, 3], 9, 2), [1, 9, 2, 3], 'de otro módulo, antes de la 2');
  assert.deepEqual(ordenConClaseEn([1, 2, 3], 9, null), [1, 2, 3, 9], 'al final');
  assert.deepEqual(ordenConClaseEn([1, 2, 3], 3, 1), [3, 1, 2], 'del mismo módulo, sube');
  assert.deepEqual(ordenConClaseEn([1, 2, 3], 1, null), [2, 3, 1], 'del mismo módulo, al final');
  assert.equal(ordenConClaseEn([1, 2, 3], 9, 7), null, 'antes de una que no es de ese módulo');
  assert.equal(ordenConClaseEn([1, 2, 3], 2, 2), null, 'antes de sí misma');
});

test('validarClase: los renglones vacíos de una lista se limpian al guardar', () => {
  const r = validarClase({ ...base, campos: [{ id: 'c1', label: 'Elige', tipo: 'eleccion', opciones: ['Sí', '', 'No', ' '] }] }, ctx);
  assert.ok(r.ok);
  assert.deepEqual(r.fila.campos[0].opciones, ['Sí', 'No']);
});

// ── El orden ─────────────────────────────────────────────────────────────────

test('reordenar: sube y baja un lugar; en los bordes o si no está, null', () => {
  assert.deepEqual(reordenar([1, 2, 3], 2, 'arriba'), [2, 1, 3]);
  assert.deepEqual(reordenar([1, 2, 3], 2, 'abajo'), [1, 3, 2]);
  assert.equal(reordenar([1, 2, 3], 1, 'arriba'), null);
  assert.equal(reordenar([1, 2, 3], 3, 'abajo'), null);
  assert.equal(reordenar([1, 2, 3], 9, 'abajo'), null);
  assert.deepEqual(moverEnLista(['a', 'b'], 0, 'arriba'), ['a', 'b']);
  assert.deepEqual(moverEnLista(['a', 'b'], 0, 'abajo'), ['b', 'a']);
});

test('porEtapas: cada etapa en su orden, y las de una etapa borrada NO se pierden', () => {
  const cs = [clase(1, { orden: 2 }), clase(2, { orden: 0 }), clase(3, { etapa: 'contexto' }), clase(4, { etapa: 'vieja' })];
  const { porEtapa, huerfanas } = porEtapas(cs, ['bienvenida', 'contexto']);
  assert.deepEqual(porEtapa.bienvenida.map((c) => c.id), [2, 1]);
  assert.deepEqual(porEtapa.contexto.map((c) => c.id), [3]);
  assert.deepEqual(huerfanas.map((c) => c.id), [4]);
  assert.equal(siguienteOrden(cs, 'bienvenida'), 3);
  assert.equal(siguienteOrden(cs, 'nueva'), 0);
});

// ── El video subido ──────────────────────────────────────────────────────────

test('el path de un video subido: <ws>/<producto>/<uuid>.<ext>, y nada que se salga del prefijo', () => {
  assert.equal(pathDeSubida(1, 7, 'video/quicktime', UUID), `1/7/${UUID}.mov`);
  assert.equal(pathDeSubida(1, 7, 'image/png', UUID), null);
  assert.equal(pathDeSubida(1, 7, 'video/mp4', 'x/../y'), null);
  assert.equal(pathDeSubida(0, 7, 'video/mp4', UUID), null);
  assert.equal(pathEsDelProducto(`1/7/${UUID}.webm`, 1, 7), true);
  assert.equal(pathEsDelWorkspace(`1/7/${UUID}.webm`, 1), true);
  assert.equal(pathEsDelWorkspace(`11/7/${UUID}.webm`, 1), false);
  assert.equal(pathEsDelWorkspace(`1/../2/${UUID}.webm`, 1), false);
  assert.equal(pathEsDelWorkspace(`1/7/${UUID}.webm?x`, 1), false);
});

test('mimeDeArchivo: el tipo del navegador, o por la extensión si viene vacío', () => {
  assert.equal(mimeDeArchivo('clase.mov', ''), 'video/quicktime');
  assert.equal(mimeDeArchivo('clase.M4V', ''), 'video/x-m4v');
  assert.equal(mimeDeArchivo('clase.mp4', 'video/mp4'), 'video/mp4');
  assert.equal(mimeDeArchivo('foto.png', 'image/png'), null);
  assert.equal(mimeDeArchivo('clase.avi', ''), null);
});

// ── Los campos ───────────────────────────────────────────────────────────────

test('nuevoIdCampo: nunca repite un id existente (las respuestas se guardan por id)', () => {
  // Un azar que devuelve siempre lo mismo: el primer id choca y tiene que salir por otro lado.
  const fijo = () => 0.5;
  const primero = nuevoIdCampo([], fijo);
  const segundo = nuevoIdCampo([{ id: primero }], fijo);
  assert.notEqual(segundo, primero);
  assert.match(primero, /^[\w-]+$/);
  // Borrar el campo 2 de tres y agregar otro NO puede devolverle su id al nuevo.
  const ids = [{ id: 'c1' }, { id: 'c3' }];
  const otro = nuevoIdCampo(ids, () => 0);
  assert.ok(!['c1', 'c2', 'c3'].includes(otro), `devolvió ${otro}: un contador repite el id de un campo borrado`);
});

// ── El avance ────────────────────────────────────────────────────────────────

test('etapaDelCliente: la de su fila si existe; si no (o sin fila), la primera', () => {
  assert.equal(etapaDelCliente(['a', 'b'], 'b'), 'b');
  assert.equal(etapaDelCliente(['a', 'b'], 'borrada'), 'a');
  assert.equal(etapaDelCliente(['a', 'b'], null), 'a');
  assert.equal(etapaDelCliente([], null), null);
});

test('avanceDeCliente: tareas enviadas por etapa, y el % sólo sobre los videos que se miden', () => {
  const cs = [
    clase(1, { tarea: 'A', videoTipo: 'youtube', videoUrl: 'https://youtu.be/x1' }),
    clase(2, { tarea: 'B', videoTipo: 'archivo', videoPath: `1/7/${UUID}.mp4` }),
    clase(3, { videoTipo: 'drive', videoUrl: 'https://drive.google.com/file/d/ID9/view' }),
    clase(4, { etapa: 'contexto', tarea: 'C' }),
  ];
  const prog = new Map([[1, { pct: 80, estado: 'enviada' as const }], [3, { pct: 0, estado: 'pendiente' as const }]]);
  const a = avanceDeCliente(cs, ['bienvenida', 'contexto'], 'bienvenida', prog);
  // `completa` es la regla que MUEVE al cliente (las obligatorias): sin obligatorias, nunca.
  assert.deepEqual(a.porEtapa, { bienvenida: { enviadas: 1, total: 2, completa: false }, contexto: { enviadas: 0, total: 1, completa: false } });
  const c = avanceDeCliente([clase(1, { tarea: 'A', obligatoria: true }), clase(2, { tarea: 'B' })], ['bienvenida'], 'bienvenida', new Map([[1, { pct: 0, estado: 'enviada' as const }]]));
  assert.deepEqual(c.porEtapa.bienvenida, { enviadas: 1, total: 2, completa: true }, 'la obligatoria enviada cierra la etapa aunque falte otra');
  // (80 + 0) / 2 medibles = 40. El de Drive NO entra al promedio: se cuenta aparte.
  assert.equal(a.pctVisto, 40);
  assert.equal(a.videosSinMedir, 1);
  // Una etapa con sólo Drive: «sin medir», no 0%.
  const b = avanceDeCliente([clase(3, { videoTipo: 'drive', videoUrl: 'https://drive.google.com/file/d/ID9/view' })], ['bienvenida'], 'bienvenida', undefined);
  assert.equal(b.pctVisto, null);
  assert.equal(b.videosSinMedir, 1);
});

test('videoDeClase y ordenarFilas', () => {
  assert.deepEqual(videoDeClase(clase(1)), { hay: false, rotulo: '', medible: false });
  assert.equal(videoDeClase(clase(1, { videoTipo: 'loom', videoUrl: 'https://www.loom.com/share/aa' })).medible, false);
  assert.equal(videoDeClase(clase(1, { videoTipo: 'url', videoUrl: 'https://cdn.x.com/a.mp4' })).medible, true);
  const f = (leadId: number, nombre: string, etapa: string | null): FilaAvance =>
    ({ leadId, nombre, empresa: null, etapa, porEtapa: {}, pctVisto: null, videosSinMedir: 0, acceso: null });
  assert.deepEqual(ordenarFilas([f(1, 'Zoe', 'b'), f(2, 'Ana', 'b'), f(3, 'Beto', 'a')], ['a', 'b']).map((x) => x.leadId), [3, 2, 1]);
});

// ── La barra ─────────────────────────────────────────────────────────────────

const todos = FAMILIAS.flatMap(itemsDe);

test('nav: Customer Success tiene Clientes (key customer-success) y Curso, y no se encienden juntos', () => {
  const clientes = todos.filter((i) => i.key === 'customer-success');
  assert.equal(clientes.length, 1, 'la key customer-success tiene que estar UNA vez: la pide requireCapa');
  assert.equal(clientes[0].href, '/customer-success');
  const curso = todos.find((i) => i.href === '/customer-success/curso');
  assert.ok(curso, 'falta el destino /customer-success/curso en la barra');
  assert.equal(curso.match('/customer-success/curso'), true);
  assert.equal(clientes[0].match('/customer-success/curso'), false, 'Clientes se enciende estando en Curso');
  assert.equal(curso.match('/customer-success'), false);
  const keys = todos.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length, 'hay keys de ítem repetidas en la barra');
});

// La página del Curso pide `customer-success` (no tiene capa propia), y la barra filtra por la
// key del ítem (`cs-curso`): si alguna capa las separa, el destino se esconde donde la página
// abre (o al revés). Hoy coinciden en las cuatro.
//
// ⚠️ LO QUE PARECÍA EL BUG NO LO ERA, y conviene saberlo antes de «arreglarlo»: la capa
// `superadmin` declara una lista cerrada de `navKeys` sin `cs-curso`, pero su `userNavKeys` es
// `null`, y `tabEnCapa` UNE los dos menús — así que para esa capa contesta `true` a CUALQUIER
// key. La lista cerrada no restringe la barra (ver lib/capas.ts, `tabEnCapa`).
test('nav: el Curso se ve en la barra en cada capa donde la página deja entrar', () => {
  const curso = todos.find((i) => i.href === '/customer-success/curso')!;
  for (const capa of Object.keys(CAPAS) as CapaId[]) {
    assert.equal(tabEnCapa(curso.key, capa), tabEnCapa('customer-success', capa), `capa ${capa}`);
  }
});

// ── El texto de pantalla: español neutro, sin voseo ───────────────────────────

test('la tab Curso no vosea (los clientes de Mauricio son mexicanos, y la UI interna tampoco)', () => {
  const dir = join(import.meta.dirname, '..', 'app', 'customer-success', 'curso');
  const VOSEO = /\b(tenés|podés|querés|sabés|elegí|subí|pegá|guardá|escribí|agregá|mirá|hacé|poné|borrá|cargá|probá|fijate|vos|creá|completá|llená|contestá)\b/i;
  const malos: string[] = [];
  for (const f of readdirSync(dir).filter((x) => /\.tsx?$/.test(x))) {
    // Sólo lo que se DIBUJA: los comentarios del repo van en rioplatense y está bien.
    const src = readFileSync(join(dir, f), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const s of src.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`|>[^<>{}\n]+</g) ?? []) if (VOSEO.test(s)) malos.push(`${f}: ${s.trim()}`);
  }
  assert.deepEqual(malos, []);
});
