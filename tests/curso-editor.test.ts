// =============================================================================
// El EDITOR DE LA ESTRUCTURA del curso: arrastrar, el candado, «+ Nuevo módulo», el menú «…»
// =============================================================================
// Pedido de Martín (07/10/2026, items 3 a 9, 11 y 12). Lo que se EJECUTA acá:
//   · app/_cursos/orden.ts — dónde cae lo que se arrastra y cómo queda la lista.
//   · app/customer-success/curso/estructura.ts — lo que la tab hace en el acto (optimista).
//   · app/customer-success/curso/bloqueo-editor.ts — el selector del candado (D2).
// Lo que se LEE del fuente: que la tab arme el editor de verdad (los call sites: un menú, un
// arrastre o un «+» que nadie pasa no existe en pantalla), y que el candado y el arrastre lleguen
// a las actions del núcleo.
//
// ── Roturas (08/10/2026) ─────────────────────────────────────────────────────
// Sin romper: 10 pass / 0 fail. Una rotura por vez sobre el archivo real, restaurada DESHACIENDO EL
// REEMPLAZO sobre lo que había en disco (otra sesión editaba los mismos archivos: escribir el original
// de memoria le habría borrado lo suyo), scratchpad/editor/roturas.mjs. Cada una tumbó SU test:
//   · orden: la grilla sólo por la Y · sin corregir por el origen · escribir sin que cambie nada  → 9 / 1
//   · estructura: sin renumerar · reclavear otro producto · la portada vieja queda               → 9 / 1
//   · candado: un suelto ofrece «Abierto» · sin el saneo del server · sin bloqueoPermitido ·
//     no espera la fecha · un módulo espera a una suya · avisa lo de siempre                     → 9 / 1
//   · candado: «abierto» de un suelto deja de ser el default                                     → 8 / 2
//   · la tab sin `onLlevarClase` · el arrastre que no vuelve si el server rebota · desvincular
//     sin mudar las clases                                                                       → 9 / 1
//   · «Mover antes / después» más allá de la punta · el menú moviendo por otro camino que el
//     arrastre                                                                                   → 9 / 1
// ⚠️ La primera corrida dejó DOS roturas puestas: lo roto («crudo», un `if (!r.ok)` que se repite)
//    no era único y el restaurador no supo cuál deshacer. Lo cazó la última línea (FINAL 8/2); se
//    arregló a mano y el arnés ahora exige que lo roto sea único antes de aplicarlo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Clase } from '../lib/curso';
import type { ModuloCurso } from '../lib/curso-modulos';
import { estiloVacio } from '../lib/curso-estilo';
import { NIVEL_MAX } from '../lib/comunidad-niveles';
import { MAX_DIAS_BLOQUEO } from '../lib/curso-bloqueo';
import { antesDeEn, conMovidoAntesDe, indiceEnGrilla, indiceEnLista, ordenAlSoltar } from '../app/_cursos/orden';
import { clasesConMovida, clasesReclaveadas, clavesConMovido, conOrdenDe, estiloReclaveado, modulosEnOrden } from '../app/customer-success/curso/estructura';
import {
  avisoDeBloqueo, bloqueoDeOpcion, chipDeBloqueo, clasesParaTarea, datosDe, faltaDato, opcionDe, opcionesDeBloqueo,
} from '../app/customer-success/curso/bloqueo-editor';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se comería el código.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque que arranca en `desde` y termina en el primer `hasta` después de él. */
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: ¿se movió?`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(i, j);
};

// ── Dónde cae lo que se arrastra (app/_cursos/orden.ts) ──────────────────────

test('la grilla va en ORDEN DE LECTURA: una fila de más arriba, o la misma fila y más a la izquierda', () => {
  // Dos filas de dos tarjetas: (a b) arriba, (c d) abajo. Centros x = 100 y 300.
  const r = [
    { id: 'a', x: 100, y1: 0, y2: 100 }, { id: 'b', x: 300, y1: 0, y2: 100 },
    { id: 'c', x: 100, y1: 120, y2: 220 }, { id: 'd', x: 300, y1: 120, y2: 220 },
  ];
  assert.equal(indiceEnGrilla(r, 50, 50), 0, 'arriba a la izquierda de «a»');
  assert.equal(indiceEnGrilla(r, 250, 50), 1, 'misma fila, antes del centro de «b»');
  assert.equal(indiceEnGrilla(r, 380, 50), 2, 'pasado «b», la fila de abajo arranca en «c»');
  assert.equal(indiceEnGrilla(r, 250, 170), 3, 'segunda fila, antes de «d»');
  assert.equal(indiceEnGrilla(r, 380, 400), 4, 'debajo de todo: al final');
  // Con sólo la Y (lo que hace una lista), las dos de la misma fila empatarían.
  assert.equal(indiceEnLista([50, 170], 60), 1);
  assert.equal(indiceEnLista([50, 170], 10), 0);
  assert.equal(indiceEnLista([50, 170], 900), 2);
});

test('soltar cuenta el ORIGEN que sigue en su lugar, y donde no cambia nada no se escribe', () => {
  const l = ['a', 'b', 'c', 'd'];
  // El hueco 3 (antes de «d») con «a» en la mano: «a» todavía ocupa el 0, así que va al 2.
  assert.deepEqual(ordenAlSoltar(l, 'a', 3), ['b', 'c', 'a', 'd']);
  assert.deepEqual(ordenAlSoltar(l, 'd', 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(ordenAlSoltar(l, 'b', 4), ['a', 'c', 'd', 'b']);
  // El hueco de al lado de sí mismo (antes o después) no cambia nada: null, no se manda nada.
  assert.equal(ordenAlSoltar(l, 'b', 1), null);
  assert.equal(ordenAlSoltar(l, 'b', 2), null);
  assert.equal(ordenAlSoltar(l, 'x', 0), null, 'lo que no está en la lista no se suelta');
  assert.deepEqual(ordenAlSoltar(l, 'a', 99), ['b', 'c', 'd', 'a'], 'un índice pasado se recorta al final');
  // Lo que viaja al server es un VECINO, no un número.
  assert.equal(antesDeEn(['b', 'c', 'a', 'd'], 'a'), 'd');
  assert.equal(antesDeEn(['a', 'b'], 'b'), null, 'el último va «al final»');
  assert.deepEqual(conMovidoAntesDe([1, 2, 3], 3, 1), [3, 1, 2]);
  assert.deepEqual(conMovidoAntesDe([1, 2, 3], 1, null), [2, 3, 1]);
  assert.deepEqual(conMovidoAntesDe([1, 2], 9, 2), [1, 9, 2], 'una clase que viene de otro módulo entra');
});

// ── Lo que la tab hace en el acto (app/customer-success/curso/estructura.ts) ──

const mod = (clave: string, n: number, o: Partial<ModuloCurso> = {}): ModuloCurso => ({ clave, nombre: clave.toUpperCase(), vinculado: true, n, bloqueo: null, ...o });
const clase = (id: number, etapa: string, orden: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa, orden, titulo: `C${id}`, descripcion: '', tipo: 'video', minutos: null,
  videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
} as Clase);

test('reordenar módulos en el acto: renumera, y uno que la lista no nombra no se pierde', () => {
  const ms = [mod('a', 1), mod('b', 2), mod('c', 3)];
  assert.deepEqual(modulosEnOrden(ms, ['c', 'a', 'b']).map((m) => [m.clave, m.n]), [['c', 1], ['a', 2], ['b', 3]]);
  assert.deepEqual(modulosEnOrden(ms, ['b', 'zz', 'b']).map((m) => m.clave), ['b', 'a', 'c'], 'una clave vieja o repetida no rompe nada');
  // «Mover antes / después» del menú (el teclado, una pantalla táctil): un lugar, y nada en las puntas.
  assert.deepEqual(clavesConMovido(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(clavesConMovido(['a', 'b', 'c'], 'b', 1), ['a', 'c', 'b']);
  assert.equal(clavesConMovido(['a', 'b', 'c'], 'a', -1), null);
  assert.equal(clavesConMovido(['a', 'b', 'c'], 'c', 1), null);
  assert.equal(clavesConMovido(['a'], 'z', 1), null);
});

test('llevar una clase a otro módulo la renumera ahí (como el server), y el orden del server manda', () => {
  const cs = [clase(1, 'a', 0), clase(2, 'a', 1), clase(3, 'b', 0), clase(4, 'b', 1), clase(9, 'a', 0, { productoId: 2 })];
  const r = clasesConMovida(cs, 2, 'b', 4);
  const deB = r.filter((c) => c.etapa === 'b' && c.productoId === 1).sort((x, y) => x.orden - y.orden).map((c) => c.id);
  assert.deepEqual(deB, [3, 2, 4], 'antes de la 4');
  assert.equal(r.find((c) => c.id === 1)!.orden, 0, 'el módulo de origen no se toca');
  assert.equal(r.find((c) => c.id === 9)!.etapa, 'a', 'otro producto, con la misma clave, no se toca');
  const alFinal = clasesConMovida(cs, 1, 'b', null).filter((c) => c.etapa === 'b' && c.productoId === 1).sort((x, y) => x.orden - y.orden).map((c) => c.id);
  assert.deepEqual(alFinal, [3, 4, 1]);
  assert.deepEqual(conOrdenDe(cs, 1, 'b', [4, 3]).filter((c) => c.etapa === 'b' && c.productoId === 1).map((c) => [c.id, c.orden]), [[3, 1], [4, 0]]);
});

test('desvincular cambia la CLAVE: las clases y la portada del módulo la siguen (las de otro producto no)', () => {
  const cs = [clase(1, 'bienvenida', 0), clase(2, 'otra', 0), clase(3, 'bienvenida', 0, { productoId: 2 })];
  const r = clasesReclaveadas(cs, 1, 'bienvenida', 'm_x1');
  assert.deepEqual(r.map((c) => c.etapa), ['m_x1', 'otra', 'bienvenida']);
  const e = { ...estiloVacio(), portadasEtapa: { bienvenida: 'grad:noche', otra: 'grad:sol' } };
  assert.deepEqual(estiloReclaveado(e, 'bienvenida', 'm_x1').portadasEtapa, { otra: 'grad:sol', m_x1: 'grad:noche' });
  assert.equal(estiloReclaveado(e, 'nada', 'm_y'), e, 'sin portada que mudar, el mismo estilo');
});

// ── El candado en el editor (app/customer-success/curso/bloqueo-editor.ts) ──

test('cada cosa ofrece SUS opciones: «etapa» nunca es un tipo, y lo de siempre es `null`', () => {
  const valores = (o: Parameters<typeof opcionesDeBloqueo>[0]) => opcionesDeBloqueo(o).map((x) => x.valor);
  assert.deepEqual(valores('vinculado'), ['default', 'abierto', 'anterior', 'dias', 'fecha', 'tarea', 'nivel', 'manual']);
  // Un suelto y una clase ya están abiertos por default: «Abierto» aparte sería decir lo mismo dos veces.
  assert.deepEqual(valores('suelto'), ['default', 'anterior', 'dias', 'fecha', 'tarea', 'nivel', 'manual']);
  assert.deepEqual(valores('clase'), valores('suelto'));
  assert.equal(opcionesDeBloqueo('vinculado')[0].texto, 'Al llegar a su etapa');
  assert.equal(opcionesDeBloqueo('clase')[0].texto, 'Como su módulo');
  // Lo guardado que ES el default se ve como el default.
  assert.equal(opcionDe('vinculado', { tipo: 'etapa' }), 'default');
  assert.equal(opcionDe('suelto', { tipo: 'abierto' }), 'default');
  assert.equal(opcionDe('vinculado', { tipo: 'abierto' }), 'abierto');
  assert.equal(opcionDe('clase', { tipo: 'dias', dias: 3 }), 'dias');
  assert.deepEqual(bloqueoDeOpcion('vinculado', 'default', datosDe(null)), { ok: true, bloqueo: null });
});

test('el candado se arma con el MISMO saneo del server: lo que rebotaría se dice antes, corto', () => {
  const d = datosDe(null);
  assert.deepEqual(bloqueoDeOpcion('suelto', 'dias', { ...d, dias: 7 }), { ok: true, bloqueo: { tipo: 'dias', dias: 7 } });
  assert.equal(bloqueoDeOpcion('suelto', 'dias', { ...d, dias: 2.5 }).ok, false, 'un decimal no se redondea');
  assert.equal(bloqueoDeOpcion('suelto', 'dias', { ...d, dias: MAX_DIAS_BLOQUEO + 1 }).ok, false);
  assert.deepEqual(bloqueoDeOpcion('suelto', 'fecha', d), { ok: false, error: 'Elige la fecha.' });
  assert.equal(bloqueoDeOpcion('suelto', 'fecha', { ...d, fecha: '2026-02-30' }).ok, false, 'una fecha que no existe');
  assert.deepEqual(bloqueoDeOpcion('suelto', 'tarea', d), { ok: false, error: 'Elige la clase.' });
  assert.deepEqual(bloqueoDeOpcion('clase', 'tarea', { ...d, claseId: 5, aprobada: true }, { claseId: 4 }),
    { ok: true, bloqueo: { tipo: 'tarea', claseId: 5, aprobada: true } });
  assert.equal(bloqueoDeOpcion('clase', 'tarea', { ...d, claseId: 4 }, { claseId: 4 }).ok, false, 'una clase no se espera a sí misma');
  assert.equal(bloqueoDeOpcion('suelto', 'nivel', { ...d, nivel: NIVEL_MAX + 1 }).ok, false);
  assert.deepEqual(bloqueoDeOpcion('vinculado', 'manual', d), { ok: true, bloqueo: { tipo: 'manual' } });
  // Lo que falta elegir no se manda (ni se marca como error): se espera.
  assert.equal(faltaDato('fecha', d), true);
  assert.equal(faltaDato('dias', d), false, 'los días arrancan en una semana: se guarda en el acto');
});

test('«Al terminar otra clase»: un MÓDULO no puede esperar a una suya (cerrado no se completa)', () => {
  const cs = [{ id: 1, etapa: 'a' }, { id: 2, etapa: 'a' }, { id: 3, etapa: 'b' }];
  assert.deepEqual(clasesParaTarea(cs, { modulo: 'a' }).map((c) => c.id), [3]);
  assert.deepEqual(clasesParaTarea(cs, { clase: 2 }).map((c) => c.id), [1, 3]);
});

test('el aviso del candado sobre la tarjeta: nada para lo de siempre, y en palabras para lo demás', () => {
  const titulo = (id: number) => (id === 7 ? 'Tu primera venta' : null);
  assert.equal(avisoDeBloqueo('vinculado', null, titulo), undefined);
  assert.equal(avisoDeBloqueo('vinculado', { tipo: 'etapa' }, titulo), undefined);
  assert.equal(avisoDeBloqueo('suelto', { tipo: 'abierto' }, titulo), undefined);
  assert.equal(avisoDeBloqueo('suelto', { tipo: 'dias', dias: 7 }, titulo), '7 días después de entrar');
  assert.equal(avisoDeBloqueo('vinculado', { tipo: 'tarea', claseId: 7 }, titulo), 'Al terminar «Tu primera venta»');
  // Un candado roto (su clase se borró) se ve como roto: el equipo lo tiene que arreglar.
  assert.equal(avisoDeBloqueo('suelto', { tipo: 'tarea', claseId: 99 }, titulo), 'Su clase ya no existe');
  assert.deepEqual(chipDeBloqueo({ tipo: 'manual' }, titulo), { tono: 'aviso', texto: 'A mano' });
  assert.equal(chipDeBloqueo(null, titulo), null);
});

// ── Lo que se lee del fuente: los call sites ─────────────────────────────────

test('la tab ARMA el editor: el «+», el arrastre y los dos menús llegan al dibujo', () => {
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  const edicion = bloque(app, 'edicion={puedeEditar ? {', '} : undefined}');
  for (const k of ['onNuevoModulo: nuevoModulo', 'onOrdenarModulos:', 'onLlevarClase:', 'menuModulo,', 'menuClase,']) {
    assert.ok(edicion.includes(k), `la tab no le pasa «${k}» al dibujo: el control no existe en pantalla`);
  }
  // Y cada uno llega a la action del núcleo (./modulos-actions.ts), con lo que contesta el server mandando.
  assert.match(bloque(app, 'const nuevoModulo = async', 'const ordenarModulos'), /await crearModuloAction\(pid, \{ nombre, vinculado, despuesDe: modulosActuales\.at\(-1\)\?\.clave \?\? null \}\)/);
  const ordenar = bloque(app, 'const ordenarModulos = async', 'const llevarClase');
  assert.match(ordenar, /ponerModulos\(pid, modulosEnOrden\(antes, claves\)\)/, 'el arrastre se ve en el acto');
  assert.match(ordenar, /if \(!r\.ok\) \{ ponerModulos\(pid, antes\);/, 'si el server rechaza (la primera etapa), vuelve');
  assert.match(ordenar, /ponerModulos\(pid, r\.modulos\)/, 'lo que contestó el server manda');
  const llevar = bloque(app, 'const llevarClase = async', 'const vincular = async');
  assert.match(llevar, /await moverClaseAAction\(claseId, clave, antesDe\)/);
  assert.match(llevar, /if \(!r\.ok\) \{ setClases\(antes\);/);
  const vinc = bloque(app, 'const vincular = async', 'const candado = async');
  assert.match(vinc, /clasesReclaveadas\(cs, pid, m\.clave, nueva\)/, 'desvincular deja las clases en «Sin módulo» hasta recargar');
  assert.match(bloque(app, 'const candado = async', 'const porArea = async'), /await guardarBloqueoAction\(pid, objetivo, b\)/);
  // El menú de un módulo mueve por el MISMO camino que el arrastre (no un segundo `reordenar…`).
  const menu = bloque(app, 'const menuModulo = ', 'const menuClase = ');
  assert.match(menu, /const n = clavesConMovido\(claves, mc\.clave, dir\); return n \? \(\) => \{ void ordenarModulos\(n\); \} : null;/);
  assert.match(menu, /onMover=\{\{ antes: mover\(-1\), despues: mover\(1\) \}\}/);
});

// REVISIÓN FINAL del 08/10/2026: el campo de «+ Nuevo módulo» dejaba escribir 80 letras y el server
// (`nombreDeModulo`: el tope de una etapa del kanban, `TOPE_NOMBRE_ETAPA` = 40) rebotaba desde la 41:
// un campo que promete un nombre que después no se guarda. El tope viaja desde la tab.
// Roturas (scratchpad/rev-final/romper.mjs, deshaciendo el reemplazo y comparando el md5): sin romper
// 11 / 0; el input con `maxLength={80}` fijo → 10 / 1 · la tab sin pasar `topeNombreModulo` → 10 / 1.
test('«+ Nuevo módulo» no deja escribir más de lo que el server acepta', () => {
  const ugc = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  const campo = bloque(ugc, 'function NuevoModulo(', '\n}\n');
  assert.match(campo, /<input type="text" autoFocus value=\{nombre\} maxLength=\{tope\}/, 'el campo topea con lo que pasa la tab');
  assert.match(ugc, /<NuevoModulo [^>]*tope=\{edicion\.topeNombreModulo\}/);
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.match(bloque(app, 'edicion={puedeEditar ? {', '} : undefined}'), /topeNombreModulo: TOPE_NOMBRE_ETAPA,/);
  assert.match(sinComentarios(leer('lib/curso-modulos.ts')), /nombre\.length > TOPE_NOMBRE_ETAPA/, 'el server topea con la misma constante');
});
