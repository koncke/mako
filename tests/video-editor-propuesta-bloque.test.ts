// =============================================================================
// La propuesta del Video Editor como tarjeta «Original | Modificado» (pieza 1.14 del Ops Center, 20/10/2026)
// =============================================================================
// Cada edición pedida desde el chat deja una PROPUESTA que se acepta en el editor (el proyecto vive en el navegador).
// Hasta acá el chat no la mostraba: la respuesta sólo decía qué se había pedido y el link no llegaba (el modelo no puede
// escribir links en el chat de la app). Ahora la API la devuelve como el bloque G4 del marco de bloques
// (lib/chat-bloques.ts, Ops Center 3): fila por fila, el elemento como está HOY en la copia del proyecto y cómo queda,
// con «Aceptar en el editor» en ESA propuesta. Lo que fija este archivo:
//   · cada una de las 34 operaciones del editor se dice en palabras, sin «undefined» ni «NaN»;
//   · «Original» sale de la copia (nombre y tiempos), y «—» cuando la operación agrega algo nuevo;
//   · el bloque tiene la forma del G4 y su link es una ruta de la app que abre ESA propuesta;
//   · el server lo arma con la propuesta ENTERA (lo que ya tenía y lo nuevo), y la API lo devuelve fuera de WhatsApp;
//   · con el marco de bloques en el árbol, su saneador lo deja pasar entero.
//
// PROBADO ROMPIÉNDOLO (20/10/2026, con lib/chat-bloques.ts de ola1 traído al árbol para que corra el último; base
// 6 / 0). Pasan / fallan:
//   R1  el campo es el id crudo de la operación              → 4 / 2
//   R2  agregar_texto muestra su ref nueva como «antes»      → 5 / 1
//   R3  la velocidad se escribe con punto («0.5×»)           → 5 / 1
//   R4  sin tope de filas (más de 12)                        → 5 / 1
//   R5  el link sin codificar (un espacio en el nombre)      → 4 / 2  (el saneador lo descarta)
//   R6  el server muestra sólo el último cambio              → 5 / 1
//   R7  el bloque viaja también por WhatsApp                 → 5 / 1
//   R8  el link es absoluto, a un dominio                    → 4 / 2  (el saneador lo descarta)
//   R9  una tarjeta vacía se dibuja                          → 5 / 1
//   R10 los segundos sin dos cifras («1:5,5»)                → 4 / 2

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OPERACIONES_API } from '../lib/editor-video/chat-api';
import type { OperacionChat } from '../lib/editor-video/chat-catalogo';
import { bloqueDePropuesta, despuesDe, filasDePropuesta, MAX_FILAS_TARJETA, rutaDePropuesta, tiempo } from '../lib/editor-video/propuesta-bloque';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/** Una copia del proyecto como la sube el editor (lib/editor-video/espejo.ts → la vista del chat). */
const VISTA = {
  pistas: [
    { tipo: 'video', principal: true, elementos: [{ ref: 'v1', tipo: 'video', nombre: 'toma-1.mp4', inicio: 0, fin: 8 }, { ref: 'v2', tipo: 'video', nombre: 'toma-2.mp4', inicio: 8, fin: 15.5 }] },
    { tipo: 'texto', elementos: [{ ref: 't2', tipo: 'texto', texto: 'Hola', inicio: 2, fin: 5 }] },
  ],
  medios: [{ ref: 'm1', nombre: 'producto.mp4' }],
};

test('cada fila: qué cambia, cómo está hoy en la copia y cómo queda', () => {
  const filas = filasDePropuesta([
    { op: 'cambiar_texto', ref: 't2', texto: 'Bienvenidos' },
    { op: 'cortar_tramo', inicio: 0, fin: 3 },
    { op: 'velocidad', ref: 'v1', x: 2 },
    { op: 'volumen', ref: 'v2', db: -6 },
    { op: 'reemplazar_en_subtitulos', buscar: 'hola', reemplazo: 'chau' },
    { op: 'borrar', refs: ['t2', 'v2'] },
    { op: 'reemplazar_clip', ref: 'v1', medio: 'm1' },
    { op: 'agregar_texto', texto: '50% off', inicio: 0, duracion: 3, ref: 'n1' },
  ] as OperacionChat[], VISTA);
  assert.deepEqual(filas[0], { campo: 'Cambiar un texto del video', antes: '«Hola» (t2, de 0:02 a 0:05)', despues: '«Bienvenidos»' });
  assert.equal(filas[1].antes, '—', 'un tramo del video entero no tiene un «antes» de un elemento');
  assert.equal(filas[1].despues, 'Sin el tramo de 0:00 a 0:03');
  assert.equal(filas[2].antes, 'toma-1.mp4 (v1, de 0:00 a 0:08)');
  assert.equal(filas[2].despues, 'A 2×');
  assert.equal(filas[3].antes, 'toma-2.mp4 (v2, de 0:08 a 0:15,5)');
  assert.equal(filas[3].despues, 'Volumen -6 dB');
  assert.deepEqual([filas[4].antes, filas[4].despues], ['«hola»', '«chau»']);
  assert.equal(filas[5].antes, '«Hola» (t2, de 0:02 a 0:05); toma-2.mp4 (v2, de 0:08 a 0:15,5)');
  assert.equal(filas[6].despues, 'Con el archivo producto.mp4');
  // `ref` en agregar_texto NOMBRA lo nuevo: no hay un «antes».
  assert.deepEqual([filas[7].antes, filas[7].despues], ['—', 'Texto «50% off» de 0:00 a 0:03']);
});

test('sin copia (proyecto muy grande), la fila dice la ref en vez de inventar un nombre', () => {
  const [f] = filasDePropuesta([{ op: 'velocidad', ref: 'v9', x: 0.5 }], null);
  assert.deepEqual([f.antes, f.despues], ['v9', 'A 0,5×']);
});

test('las operaciones del editor se dicen en palabras, sin «undefined» ni «NaN»', () => {
  // Una operación de muestra con todos los campos posibles: cada una toma los suyos.
  const campos = {
    ref: 'v1', refs: ['v1'], texto: 'x', inicio: 1, fin: 2, duracion: 1, en: 1, db: -3, silenciado: true, entrada: 1, salida: 1,
    activo: true, separado: true, oculto: true, x: 2, id: 'fundido', tipo: 'filtro', valores: { brillo: 10 }, estilo: {}, cambios: {},
    horizontal: true, revertido: true, buscar: 'a', reemplazo: 'b', modo: 'palabra', frase: 'eh', medio: 'm1', textos: {}, clips: {},
    palabras: ['hoy'], preset: 'Hormozi',
    // agregar_motion (10/11/2026): la plantilla del motion graphic.
    plantilla: 'titular',
  };
  const ops = new Set(OPERACIONES_API.map((o) => o.op));
  assert.ok(ops.size >= 30, `encontré ${ops.size} operaciones`);
  for (const op of ops) {
    const d = despuesDe({ ...campos, op } as unknown as OperacionChat);
    assert.ok(d && !/undefined|NaN|\[object/.test(d), `«${op}» se dice «${d}»`);
    const [f] = filasDePropuesta([{ ...campos, op } as unknown as OperacionChat], VISTA);
    assert.ok(f.campo && !/_/.test(f.campo), `«${op}» no tiene título humano: «${f.campo}»`);
  }
});

test('el bloque G4: su forma, su link a ESA propuesta, el tope de filas y nada si está vacío', () => {
  const filas = filasDePropuesta(Array.from({ length: 15 }, () => ({ op: 'eliminar_muletillas' }) as OperacionChat), VISTA);
  assert.equal(filas.length, MAX_FILAS_TARJETA);
  const id = '6f1c2b0e-8a1d-4c2f-9b7e-1a2b3c4d5e6f';
  const b = bloqueDePropuesta({ proyecto: 'Promo octubre', nombre: 'Promo octubre', id, filas, total: 15 });
  assert.ok(b);
  assert.equal(b.t, 'antes_despues');
  assert.match(b.titulo, /^Cambios propuestos en «Promo octubre» \(y 3 más en el editor\)$/);
  assert.deepEqual(b.abrir, { titulo: 'Aceptar en el editor', href: `/video-editor/Promo%20octubre?propuesta=${id}` });
  // Las reglas de una ruta de la app (lib/chat-bloques.ts → rutaInterna): una sola barra, sin espacios ni «\».
  assert.ok(b.abrir.href.startsWith('/') && !b.abrir.href.startsWith('//') && !/[\s\\]/.test(b.abrir.href));
  assert.equal(rutaDePropuesta('a/../b', 'x'), '/video-editor/a%2F..%2Fb?propuesta=x', 'un nombre raro no sale de /video-editor');
  assert.equal(bloqueDePropuesta({ proyecto: 'p', id, filas: [] }), null, 'una tarjeta vacía no se dibuja');
  assert.equal(tiempo(65.5), '1:05,5');
});

test('el server arma las filas con la propuesta ENTERA, y la API las devuelve fuera de WhatsApp', () => {
  const srv = sinComentarios(leer('lib', 'editor-video', 'propuestas-server.ts'));
  assert.match(srv, /filas: filasDePropuesta\(\[p\.op\], copia\.fila\.vista\), total: 1, nombre: copia\.fila\.nombre/);
  assert.match(srv, /const todas = \[\.\.\.previas, p\.op\];[\s\S]{0,200}filas: filasDePropuesta\(todas, copia\.fila\.vista\), total: todas\.length/);
  const run = sinComentarios(leer('lib', 'api-mako', 'areas', 'video.run.ts'));
  assert.match(run, /const bloque = ctx\.canal === 'whatsapp' \? null : bloqueDePropuesta\(\{ proyecto, nombre: r\.nombre, id: r\.id, filas: r\.filas, total: r\.total \}\);/);
  assert.match(run, /\.\.\.\(bloque \? \{ bloque \} : \{\}\),/);
});

const MARCO = join(RAIZ, 'lib', 'chat-bloques.ts');
test('el saneador del marco de bloques lo deja pasar entero', { skip: !existsSync(MARCO) && 'el marco de bloques (rama ola1 de Ops Center 3) todavía no está en este árbol' }, async () => {
  const { sanearBloque } = (await import(pathToFileURL(MARCO).href)) as { sanearBloque: (b: unknown) => unknown };
  const filas = filasDePropuesta([{ op: 'cambiar_texto', ref: 't2', texto: 'Bienvenidos' }, { op: 'cortar_tramo', inicio: 0, fin: 3 }], VISTA);
  const b = bloqueDePropuesta({ proyecto: 'Promo octubre', nombre: 'Promo octubre', id: '6f1c2b0e-8a1d-4c2f-9b7e-1a2b3c4d5e6f', filas, total: 2 });
  assert.deepEqual(sanearBloque(b), b);
});
