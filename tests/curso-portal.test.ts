// =============================================================================
// curso-portal — el portal del alumno: qué etapa se abre, qué clase se le abre a quién, y que
// las rutas públicas arranquen por el token
// =============================================================================
// Lo que se EJECUTA: lib/curso-portal.ts (la mitad pura) y app/compartido/curso/[token]/
// tarea-valores.ts. Lo que se LEE como fuente (sin comentarios): las tres rutas de
// app/api/compartido/curso y la página, para fijar que el workspace sale de la FIRMA del token y
// que lo primero que corre adentro de `runWithWorkspace` es `resolverAcceso`.
//
// Probado ROMPIÉNDOLO (06/10/2026) con un arnés que rompe una regla por vez y restaura de MEMORIA
// (nunca con git). Con todo en su lugar: 21 pass / 0 fail. Cada rotura tumba SU test:
//   · `estadosDeEtapas` sin el «sin actual, la primera» (iActual = -1)       → 20 / 1 «sin fila…»
//   · `decidirClase` sin mirar el producto del alumno                         → 20 / 1 «clase ajena…»
//   · `armarEtapas` mandando las clases de una etapa bloqueada               → 20 / 1 «lo bloqueado no viaja»
//   · `videoDeClase` creyéndole a `video_tipo` en vez de reconocer el link    → 20 / 1 «el link manda»
//   · la ruta de video validando el path contra un producto que manda el pedido → 20 / 1 «el bucket es uno»
//   · `leerJsonTopeado` sin contar bytes (sólo el content-length)            → 20 / 1 «el tope se cuenta»
//   · `campoLleno` contando la etiqueta de una fila fija                     → 20 / 1 «la etiqueta no cuenta»
//   · la ruta de progreso leyendo el workspace de `b.ws`                     → 19 / 2 (los dos guards de la firma)
//   · la ruta de video llamando a `claseDelAlumno` antes de `resolverAcceso` → 20 / 1 «resolverAcceso primero»
//   · `/api/compartido/curso/tarea` fuera de PUBLICOS_ESCRITURA              → 20 / 1 «las que escriben…»
//   · la página contando el ingreso DESPUÉS de armar la vista                → 20 / 1 «la página también…»
//   · PortalAlumno importando un VALOR de lib/curso-portal                   → 20 / 1 «sólo importan TIPOS»
// Y los dos de la mig 0208 (06/10/2026, scratchpad/curso-admin-roturas.mjs). Con todo en su lugar,
// 23 pass / 0 fail; cada rotura da 22 / 1:
//   · `armarVistaAlumno` nombrando `curso_clase_notas`                        → «no lee las notas»
//   · app/mi-curso/portal-comun.tsx nombrando el bucket `curso-notas`         → «no lee las notas»
//   · `claseVista` copiando `grabar` de la clase                              → «lista blanca»
// Y los del link del LÍDER de área (#665, 07/10/2026, scratchpad/b665-roturas.mjs). Con todo en su
// lugar, 24 pass / 0 fail; cada rotura da 23 / 1:
//   · la ruta de la tarea llamando a `claseDelAlumno` sin `lider: acceso.area` → «cada ruta…»
//   · la ruta de video leyendo la base antes de `resolverAccesoPortal`          → «cada ruta…»
//   · la entrada del mail importando `resolverAccesoPortal`                      → «la entrada del mail…»
//   · la página armando la vista sin el área del líder                           → «la página también…»
// ⚠️ El guard «nada lee la base antes del resolver» buscaba `resolverAcceso(`, que NO aparece adentro
// de `resolverAccesoPortal(`: con el nombre viejo el índice daba -1 y aprobaba cualquier orden. Ahora
// cada ruta declara SU resolver y se busca ése.
//
// 08/10/2026 (D1 y D2, docs/diseno-curso-skool.md): el portal arma MÓDULOS (`armarModulos`) con sus
// CANDADOS, y las rutas exigen la clase ABIERTA (`exigeAbierta`). Los tests de `armarEtapas` pasaron a
// `armarModulos` con las mismas aserciones, y se suman los de lo cerrado que no viaja. Roturas en el
// bloque ROTURAS 08/10 de abajo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  estadosDeEtapas, decidirClase, armarModulos, videoDeClase, leerJsonTopeado, idDeClase, primerNombre, esClaseCerrada,
  type ClaseVista, type EntradaModulos,
} from '../lib/curso-portal';
import type { ModuloCurso } from '../lib/curso-modulos';
import { campoLleno, queFalta, filasDeTabla, fraseQueFalta } from '../app/compartido/curso/[token]/tarea-valores';
import { pathEsDelProducto } from '../app/customer-success/curso/reglas';
import { esPublicaDeEscritura, PUBLICOS_ESCRITURA } from '../lib/rutas-publicas';
import type { Clase, Progreso, Campo } from '../lib/curso';

const RAIZ = join(import.meta.dirname, '..');

const clase = (id: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa: 'e1', orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});
const prog = (claseId: number, o: Partial<Progreso> = {}): Progreso => ({
  claseId, segundosMax: 0, duracionSeg: null, pct: 0, vistoAt: null, valores: {}, estado: 'pendiente', enviadaAt: null, ...o,
});

/** Cada etapa como módulo VINCULADO (un curso sin sueltos), más los sueltos que se pidan. */
const mods = (etapas: ReadonlyArray<{ key: string; label: string }>, extra: ModuloCurso[] = []): ModuloCurso[] =>
  [...etapas.map((e, i): ModuloCurso => ({ clave: e.key, nombre: e.label, vinculado: true, n: i + 1, bloqueo: null })), ...extra];
/** `armarModulos` con los módulos de las etapas: la forma de `armarEtapas` de antes. */
const armar = (
  etapas: ReadonlyArray<{ key: string; label: string; agendaUrl?: string }>, actual: string | null, clases: Clase[],
  progreso: Map<number, Progreso>, o: Partial<EntradaModulos> = {},
) => armarModulos({ modulos: mods(etapas), etapas, actual, clases, progreso, ...o });
/** Las clases ABIERTAS de un módulo (las cerradas no traen nada más que el título y el motivo). */
const abiertas = (m: { clases: ReturnType<typeof armar>[number]['clases'] }) => m.clases.filter((c): c is ClaseVista => !esClaseCerrada(c));

// ── Las etapas ────────────────────────────────────────────────────────────────

test('estadosDeEtapas: antes de la actual hechas, la actual abierta, después bloqueadas', () => {
  assert.deepEqual(estadosDeEtapas(['a', 'b', 'c', 'd'], 'b'), { a: 'hecha', b: 'actual', c: 'bloqueada', d: 'bloqueada' });
  assert.deepEqual(estadosDeEtapas(['a', 'b'], 'b'), { a: 'hecha', b: 'actual' });
  assert.deepEqual(estadosDeEtapas([], 'a'), {});
});

test('sin fila (o con una etapa que ya no existe) está en la PRIMERA, no en ninguna', () => {
  // Es la regla del kanban: los 14 clientes de Mauricio arrancan sin fila en cliente_entrega.
  // Con «ninguna» abrirían el link a un programa entero cerrado.
  assert.deepEqual(estadosDeEtapas(['a', 'b', 'c'], null), { a: 'actual', b: 'bloqueada', c: 'bloqueada' });
  assert.deepEqual(estadosDeEtapas(['a', 'b'], 'borrada'), { a: 'actual', b: 'bloqueada' });
});

test('decidirClase: una clase ajena es un 404, igual que una que no existe', () => {
  const c = clase(5, { productoId: 7 });
  assert.equal(decidirClase(null, [7], true, true), 'no-existe');
  assert.equal(decidirClase(c, [1, 2], true, true), 'no-existe', 'producto que el cliente no compró');
  assert.equal(decidirClase(c, [], true, false), 'no-existe');
  assert.equal(decidirClase(c, [7], true, true), 'ok');
});

test('decidirClase: con la clase ABIERTA exigida, cerrada o desconocida no se abre', () => {
  const c = clase(5, { productoId: 7 });
  assert.equal(decidirClase(c, [7], false, true), 'bloqueada');
  assert.equal(decidirClase(c, [7], undefined, true), 'bloqueada', 'no se evaluó (o su módulo ya no existe): cerrada');
  assert.equal(decidirClase(c, [7], false, false), 'ok', 'sin exigirlo no se mira');
});

test('armarModulos: agrupa en el orden del curso, ordena por orden y cuenta lo que cierra la etapa', () => {
  const etapas = [{ key: 'e1', label: 'Uno' }, { key: 'e2', label: 'Dos' }];
  const clases = [
    clase(3, { etapa: 'e1', orden: 2, obligatoria: true, tarea: 'hazlo' }),
    clase(1, { etapa: 'e1', orden: 1, obligatoria: true, tarea: 'hazlo' }),
    clase(2, { etapa: 'e1', orden: 1 }), // sin tarea: no cuenta como obligatoria
    clase(9, { etapa: 'vieja' }), // su etapa ya no existe: no se dibuja
  ];
  const vista = armar(etapas, 'e1', clases, new Map([[1, prog(1, { estado: 'enviada' })]]));
  assert.deepEqual(vista.map((e) => [e.key, e.etapa, e.abierto]), [['e1', 'actual', true], ['e2', 'bloqueada', false]]);
  assert.deepEqual(vista[0].clases.map((c) => c.id), [1, 2, 3], 'orden, y a igual orden el id');
  assert.equal(vista[0].obligatorias, 2);
  assert.equal(vista[0].enviadas, 1);
  // Lo que ve el alumno cuenta TODAS las tareas (aquí, las dos con tarea; la 2 no pide nada).
  assert.equal(vista[0].tareas, 2);
  assert.equal(vista[0].tareasEnviadas, 1);
  assert.equal(abiertas(vista[0]).find((c) => c.id === 1)?.estado, 'enviada');
  assert.ok(!vista.flatMap((e) => e.clases).some((c) => c.id === 9), 'una clase huérfana no aparece');
});

test('lo bloqueado no viaja: se manda cuántas clases tiene y el porqué, no su contenido', () => {
  const etapas = [{ key: 'e1', label: 'Uno' }, { key: 'e2', label: 'Dos' }];
  const clases = [clase(1, { etapa: 'e1' }), clase(2, { etapa: 'e2', tarea: 'secreto' }), clase(3, { etapa: 'e2' })];
  const [, e2] = armar(etapas, 'e1', clases, new Map());
  assert.equal(e2.abierto, false);
  assert.equal(e2.clases.length, 0);
  assert.equal(e2.cuantas, 2);
  assert.equal(e2.motivo, 'Se abre al terminar «Uno»');
  assert.doesNotMatch(JSON.stringify(e2), /secreto/);
});

// ── Los módulos sueltos y los candados (D1 y D2, 08/10/2026) ───────────────────

test('un módulo SUELTO se dibuja con sus clases (antes se tiraban por no ser una etapa)', () => {
  const etapas = [{ key: 'e1', label: 'Uno' }, { key: 'e2', label: 'Dos' }];
  const suelto: ModuloCurso = { clave: 'm_bonus', nombre: 'Bonus', vinculado: false, n: 3, bloqueo: null };
  const clases = [clase(1, { etapa: 'e1' }), clase(7, { etapa: 'm_bonus', titulo: 'Extra' })];
  const v = armarModulos({ modulos: mods(etapas, [suelto]), etapas, actual: 'e1', clases, progreso: new Map() });
  const b = v.find((m) => m.key === 'm_bonus')!;
  assert.equal(b.vinculado, false);
  assert.equal(b.etapa, undefined, 'un suelto no tiene estado en el kanban');
  assert.equal(b.abierto, true, 'el default de un suelto es abierto');
  assert.deepEqual(b.clases.map((c) => c.titulo), ['Extra']);
});

test('una clase CERRADA adentro de un módulo abierto viaja con su título y su motivo, y nada más', () => {
  const etapas = [{ key: 'e1', label: 'Uno' }];
  const clases = [
    clase(1, { etapa: 'e1', orden: 1, titulo: 'Intro', tarea: 'hazlo' }),
    clase(2, {
      etapa: 'e1', orden: 2, titulo: 'Secreta', descripcion: 'NO-VIAJA-DESC', descripcionHtml: '<p>NO-VIAJA-HTML</p>',
      tarea: 'NO-VIAJA-TAREA', videoTipo: 'youtube', videoUrl: 'https://youtu.be/NOVIAJA', bloqueo: { tipo: 'anterior' },
    }),
  ];
  const [m] = armar(etapas, 'e1', clases, new Map());
  const cerrada = m.clases.find((c) => c.id === 2)!;
  assert.ok(esClaseCerrada(cerrada));
  assert.deepEqual(Object.keys(cerrada).sort(), ['cerrada', 'id', 'motivo', 'titulo']);
  assert.equal(cerrada.motivo, 'Se abre al terminar «Intro»');
  assert.doesNotMatch(JSON.stringify(m), /NO-VIAJA|NOVIAJA/);
  // Al completar la anterior (enviar su tarea), se abre con todo lo suyo.
  const [m2] = armar(etapas, 'e1', clases, new Map([[1, prog(1, { estado: 'enviada' })]]));
  const abierta = m2.clases.find((c) => c.id === 2)!;
  assert.ok(!esClaseCerrada(abierta));
  assert.equal((abierta as ClaseVista).tarea, 'NO-VIAJA-TAREA');
});

test('un módulo con candado de FECHA no viaja antes del día, con el motivo en palabras', () => {
  const etapas = [{ key: 'e1', label: 'Uno' }];
  const m = { ...mods(etapas)[0], bloqueo: { tipo: 'fecha' as const, fecha: '2026-10-12' } };
  const clases = [clase(1, { etapa: 'e1', tarea: 'hazlo' })];
  const antes = armarModulos({ modulos: [m], etapas, actual: 'e1', clases, progreso: new Map(), contexto: { fechas: { hoy: '2026-10-11', inicio: null }, nivel: null, desbloqueos: [] } });
  assert.equal(antes[0].abierto, false);
  assert.equal(antes[0].clases.length, 0);
  assert.equal(antes[0].motivo, 'Se abre el 12 de octubre');
  const el = armarModulos({ modulos: [m], etapas, actual: 'e1', clases, progreso: new Map(), contexto: { fechas: { hoy: '2026-10-12', inicio: null }, nivel: null, desbloqueos: [] } });
  assert.equal(el[0].abierto, true);
  // Sin poder calcular las fechas (sin contexto), cerrado: no poder leer no abre.
  assert.equal(armarModulos({ modulos: [m], etapas, actual: 'e1', clases, progreso: new Map() })[0].abierto, false);
});

test('un módulo que sus PERMISOS no le dan no viaja en absoluto (ni el nombre)', () => {
  const etapas = [{ key: 'e1', label: 'Uno' }, { key: 'e2', label: 'Escondido' }];
  const clases = [clase(1, { etapa: 'e1' }), clase(2, { etapa: 'e2' })];
  const v = armar(etapas, 'e2', clases, new Map(), { permitido: (k) => k !== 'e2' });
  assert.deepEqual(v.map((m) => m.key), ['e1']);
  assert.doesNotMatch(JSON.stringify(v), /Escondido/);
});

test('al LÍDER de un área, el motivo de una clase cerrada no le nombra lo que no ve (revisión 08/10)', () => {
  // #665: «el líder de Ventas no tiene por qué saber que existe el cuestionario de números del dueño».
  // El motivo de la clase por área cerrada nombraba a su anterior, que no es por área.
  const etapas = [{ key: 'e1', label: 'Uno' }];
  const clases = [
    clase(1, { etapa: 'e1', orden: 1, titulo: 'Tus números', tarea: 'del dueño' }),
    clase(2, { etapa: 'e1', orden: 2, titulo: 'Ventas', tarea: 'hazlo', porArea: true, bloqueo: { tipo: 'anterior' } }),
  ];
  const lider = armar(etapas, 'e1', clases, new Map(), { opts: { lider: 'Ventas', areas: ['Ventas'] } });
  assert.doesNotMatch(JSON.stringify(lider), /Tus números/);
  assert.deepEqual(lider[0].clases, [{ id: 2, titulo: 'Ventas', cerrada: true, motivo: 'Se abre más adelante' }]);
  // Al cliente sí: él ve las dos.
  const cliente = armar(etapas, 'e1', clases, new Map());
  assert.equal(cliente[0].clases.find((c) => c.id === 2 && esClaseCerrada(c)) && (cliente[0].clases[1] as { motivo: string }).motivo, 'Se abre al terminar «Tus números»');
});

// ── El video ──────────────────────────────────────────────────────────────────

test('videoDeClase: qué reproductor lleva cada clase y si se mide', () => {
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'archivo', videoPath: '1/a.mp4' })), { video: { tipo: 'archivo' }, medible: true });
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'archivo', videoPath: null })), { video: null, medible: false });
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'youtube', videoUrl: 'https://youtu.be/abc' })), { video: { tipo: 'youtube', id: 'abc' }, medible: true });
  assert.equal(videoDeClase(clase(1, { videoTipo: 'vimeo', videoUrl: 'https://vimeo.com/123' })).video?.tipo, 'vimeo');
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'drive', videoUrl: 'https://drive.google.com/file/d/X/view' })).medible, false);
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'url', videoUrl: 'https://cdn.x.com/a.mp4' })), { video: { tipo: 'directo', url: 'https://cdn.x.com/a.mp4' }, medible: true });
  assert.equal(videoDeClase(clase(1, { videoTipo: 'url', videoUrl: 'https://cdn.x.com/pagina' })).video?.tipo, 'afuera');
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'ninguno', videoUrl: 'https://youtu.be/abc' })), { video: null, medible: false });
});

test('el link manda, no la columna: lo guardado termina en el src de un iframe del cliente', () => {
  assert.deepEqual(videoDeClase(clase(1, { videoTipo: 'youtube', videoUrl: 'javascript:alert(1)' })), { video: null, medible: false });
  // Guardado como 'youtube' pero es un link de Drive: va en un iframe sin medir, no a la API de YouTube.
  const v = videoDeClase(clase(1, { videoTipo: 'youtube', videoUrl: 'https://drive.google.com/file/d/X/view' }));
  assert.equal(v.video?.tipo, 'iframe');
  assert.equal(v.medible, false);
});

test('claseVista: un video que no se mide viaja con pct null («sin medir»), no con 0', () => {
  const [e] = armar([{ key: 'e1', label: 'Uno' }], 'e1', [
    clase(1, { videoTipo: 'loom', videoUrl: 'https://www.loom.com/share/abc' }),
    clase(2, { videoTipo: 'youtube', videoUrl: 'https://youtu.be/x' }),
  ], new Map([[2, prog(2, { pct: 40 })]]));
  assert.equal(abiertas(e)[0].pct, null);
  assert.equal(abiertas(e)[1].pct, 40);
});

test('el bucket es uno para todos: la ruta de video firma sólo lo del workspace Y del producto de la clase', () => {
  // La regla vive en la tab Curso (la usa al guardar); la ruta pública la llama con el
  // workspace de la FIRMA y el producto de la clase. Acá se fija el cableado y se ejecuta la regla.
  const src = leer('app/api/compartido/curso/video/route.ts');
  assert.match(src, /pathEsDelProducto\(\s*r\.clase\.videoPath\s*,\s*acceso\.ws\s*,\s*r\.clase\.productoId\s*\)/);
  assert.ok(src.indexOf('pathEsDelProducto(') < src.indexOf('createSignedUrl('), 'se valida antes de firmar');
  const u = '0f8fad5b-d9cb-469f-a165-70867728950e';
  assert.equal(pathEsDelProducto(`1/7/${u}.mp4`, 1, 7), true);
  assert.equal(pathEsDelProducto(`2/7/${u}.mp4`, 1, 7), false, 'carpeta de otro inquilino');
  assert.equal(pathEsDelProducto(`10/7/${u}.mp4`, 1, 7), false, 'el 10 empieza con 1 y no es el 1');
  assert.equal(pathEsDelProducto(`1/8/${u}.mp4`, 1, 7), false, 'otro producto');
  assert.equal(pathEsDelProducto(`1/7/../../2/7/${u}.mp4`, 1, 7), false);
  assert.equal(pathEsDelProducto(null, 1, 7), false);
});

// ── El cuerpo de las rutas que escriben ───────────────────────────────────────

const pedido = (cuerpo: string, headers: Record<string, string> = {}) =>
  new Request('http://x/api', { method: 'POST', body: cuerpo, headers });

test('el tope se cuenta en bytes, no se le cree al content-length', async () => {
  assert.deepEqual(await leerJsonTopeado(pedido('{"a":1}'), 100), { ok: true, valor: { a: 1 } });
  assert.deepEqual(await leerJsonTopeado(pedido('no es json'), 100), { ok: false, status: 400 });
  // Sin content-length (chunked): lo que corta es contar.
  const largo = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`{"a":"${'x'.repeat(500)}"}`)); c.close(); } });
  const r = new Request('http://x/api', { method: 'POST', body: largo, duplex: 'half' } as RequestInit);
  assert.deepEqual(await leerJsonTopeado(r, 100), { ok: false, status: 413 });
  // Y un content-length declarado de más corta sin leer.
  assert.deepEqual(await leerJsonTopeado(pedido('{}', { 'content-length': '999999' }), 100), { ok: false, status: 413 });
});

test('idDeClase y primerNombre: lo que llega del navegador', () => {
  assert.equal(idDeClase(12), 12);
  assert.equal(idDeClase('12'), 12);
  for (const malo of [0, -1, 1.5, '1e3', 'abc', null, undefined, {}]) assert.equal(idDeClase(malo), null, String(malo));
  assert.equal(primerNombre('  María José Pérez '), 'María');
  assert.equal(primerNombre(''), null);
  assert.equal(primerNombre(null), null);
});

// ── La tarea (lo que mira la pantalla antes de mandar) ────────────────────────

const tabla = (o: Partial<Campo> = {}): Campo => ({ id: 't', label: 'Tabla', tipo: 'tabla', columnas: ['Bloque', 'Cuántas'], ...o });

test('la etiqueta de una fila fija no cuenta como contestada', () => {
  const c = tabla({ filasFijas: ['Las buenas', 'Las malas'], obligatorio: true });
  const soloEtiquetas = filasDeTabla(c, undefined);
  assert.deepEqual(soloEtiquetas, [['Las buenas', ''], ['Las malas', '']]);
  assert.equal(campoLleno(c, soloEtiquetas), false);
  assert.equal(campoLleno(c, [['Las buenas', '3'], ['Las malas', '']]), true);
  // Sin filas fijas, la primera columna es del alumno y sí cuenta.
  assert.equal(campoLleno(tabla(), [['algo', '']]), true);
});

test('filasDeTabla: las fijas mandan en su orden; filasMin se ve desde el arranque', () => {
  const c = tabla({ filasFijas: ['A', 'B'] });
  assert.deepEqual(filasDeTabla(c, [['otra cosa', '1'], ['x', '2'], ['de más', '9']]), [['A', '1'], ['B', '2']]);
  assert.equal(filasDeTabla(tabla({ filasMin: 3 }), undefined).length, 3);
  assert.equal(filasDeTabla(tabla(), undefined).length, 1);
});

test('queFalta: misma regla que el server, dicha en una frase', () => {
  assert.deepEqual(queFalta([], {}), { tipo: 'respuesta' });
  assert.equal(queFalta([], { respuesta: 'listo' }), null);
  const a: Campo = { id: 'a', label: 'Tu meta', tipo: 'texto', obligatorio: true };
  const b: Campo = { id: 'b', label: 'Tu plazo', tipo: 'linea', obligatorio: true };
  const libre: Campo = { id: 'c', label: 'Algo más', tipo: 'texto' };
  assert.deepEqual(queFalta([a, b], { a: 'crecer' }), { tipo: 'campos', labels: ['Tu plazo'] });
  assert.equal(queFalta([a, b], { a: 'crecer', b: '3 meses' }), null);
  assert.deepEqual(queFalta([libre], {}), { tipo: 'alguno' });
  assert.equal(fraseQueFalta({ tipo: 'campos', labels: ['Tu plazo', 'Tu meta'] }), 'Falta «Tu plazo» y 1 más.');
});

// ── Las rutas públicas: el workspace sale de la firma y lo primero es resolverAcceso ──────────

const DIR_RUTAS = join(RAIZ, 'app/api/compartido/curso');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));

// En POSITIVO: una ruta nueva bajo esta carpeta falla acá hasta que alguien decide que cumple.
// `entrar` (06/10/2026) es el link del mail de invitación: verifica el token y deja la cookie del
// alumno (lib/alumno-acceso.ts). Cumple lo mismo que las otras —la firma primero, resolverAcceso
// primero— y no recibe ninguna clase, así que es la única exenta de `claseDelAlumno`.
// Probado rompiéndolo (06/10/2026, scratchpad/u2/roturas-portal.cjs): sacar `entrar` de RUTAS,
// sacar la exención, leer la base antes de resolverAcceso en `entrar` y leer el ws del pedido dan
// 20 / 1 cada uno (cae SU test). Restaurado: 21 / 0.
// #665 (mig 0212): las tres rutas de una CLASE abren también el link del LÍDER de un área (`c2.`),
// así que leen el token con `leerTokenPortal` y lo resuelven con `resolverAccesoPortal`. `entrar`
// NO: deja la cookie DEL CLIENTE, y con el resolver del portal un líder saldría con ella — por eso
// se fija cuál usa cada una, y no «alguno de los dos».
const RUTAS = {
  progreso: { metodo: 'POST', lector: 'leerTokenPortal', resolver: 'resolverAccesoPortal' },
  tarea: { metodo: 'POST', lector: 'leerTokenPortal', resolver: 'resolverAccesoPortal' },
  video: { metodo: 'GET', lector: 'leerTokenPortal', resolver: 'resolverAccesoPortal' },
  // Las dos del curso tipo Skool (07/10/2026): lo que sube el alumno en una tarea y los adjuntos de
  // la descripción de una clase. Las dos abren el link del líder, así que van con el del portal.
  entrega: { metodo: 'POST', lector: 'leerTokenPortal', resolver: 'resolverAccesoPortal' },
  adjunto: { metodo: 'GET', lector: 'leerTokenPortal', resolver: 'resolverAccesoPortal' },
  entrar: { metodo: 'GET', lector: 'leerAccesoCurso', resolver: 'resolverAcceso' },
} as const;
const SIN_CLASE: ReadonlySet<string> = new Set(['entrar']);

test('las rutas del portal son exactamente éstas', () => {
  const hay = readdirSync(DIR_RUTAS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  assert.deepEqual(hay, Object.keys(RUTAS).sort());
  for (const r of Object.keys(RUTAS)) assert.ok(existsSync(join(DIR_RUTAS, r, 'route.ts')), r);
});

test('cada ruta: el workspace sale de la firma y lo primero adentro de runWithWorkspace es su resolver', () => {
  for (const [r, { metodo, lector, resolver }] of Object.entries(RUTAS)) {
    const src = leer(`app/api/compartido/curso/${r}/route.ts`);
    const handlers = [...src.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
    assert.deepEqual(handlers, [metodo], `${r}: un solo handler, ${metodo}`);

    const firma = src.match(new RegExp(`const\\s+(\\w+)\\s*=\\s*${lector}\\(`));
    assert.ok(firma, `${r}: la firma sale de ${lector}`);
    const v = firma![1];
    const run = new RegExp(`runWithWorkspace\\(\\s*${v}\\.ws\\s*,\\s*async\\s*\\(\\)\\s*=>\\s*\\{\\s*const\\s+(\\w+)\\s*=\\s*await\\s+${resolver}\\(`);
    const m = src.match(run);
    assert.ok(m, `${r}: runWithWorkspace(${v}.ws, …) tiene que arrancar con ${resolver}`);

    // Nada que lea la base corre antes del resolver. (Se busca con el NOMBRE EXACTO y su paréntesis:
    // «resolverAcceso(» no aparece adentro de «resolverAccesoPortal(», y con el nombre equivocado el
    // índice daba -1 y este guard aprobaba cualquier orden.)
    const iResolver = src.indexOf(`${resolver}(`);
    assert.ok(iResolver > 0, `${r}: no encontré ${resolver}(`);
    for (const lectura of ['claseDelAlumno(', 'claseDeId(', 'productosDelAlumno(', 'avanceDelCliente(', 'estadoDeTareaEnArea(', 'guardarVisto(', 'guardarTarea(', 'alEnviarTarea(', 'getTenantDb(', 'getSupabaseServer(', 'createSignedUrl(']) {
      const i = src.indexOf(lectura);
      if (i >= 0) assert.ok(i > iResolver, `${r}: ${lectura} corre antes de ${resolver}`);
    }
    // Toda clase pedida pasa por claseDelAlumno (que valida existencia + producto del alumno), y
    // con el ÁREA del acceso: es lo que le cierra al líder lo que no es por área.
    if (!SIN_CLASE.has(r)) {
      assert.ok(src.includes('claseDelAlumno('), `${r}: la clase se valida contra el alumno`);
      assert.match(src, /claseDelAlumno\([^)]*lider:\s*acceso\.area/, `${r}: claseDelAlumno sin el área del acceso: un líder abriría cualquier clase`);
    }
  }
});

test('la entrada del mail NO abre el link de un líder: deja la cookie DEL CLIENTE', () => {
  // Con el resolver del portal, un `c2.` saldría de acá con la cookie `mako_alumno` del cliente, y
  // esa cookie abre /mi-curso entero.
  const src = leer('app/api/compartido/curso/entrar/route.ts');
  assert.doesNotMatch(src, /leerTokenPortal|resolverAccesoPortal|leerAccesoLider/);
});

test('el workspace sale de la firma: ninguna ruta lo lee del pedido', () => {
  for (const r of Object.keys(RUTAS)) {
    const src = leer(`app/api/compartido/curso/${r}/route.ts`);
    assert.doesNotMatch(src, /\.get\(\s*['"]ws['"]\s*\)/, `${r}: ?ws= del pedido`);
    const usos = [...src.matchAll(/\b(\w+)\.ws\b/g)].map((m) => m[1]);
    for (const u of usos) assert.ok(u === 'firma' || u === 'acceso', `${r}: «${u}.ws» no es el workspace de la firma`);
  }
});

test('las que escriben están en PUBLICOS_ESCRITURA; la que lee, no', () => {
  for (const [r, { metodo }] of Object.entries(RUTAS)) {
    const ruta = `/api/compartido/curso/${r}`;
    assert.equal(esPublicaDeEscritura(ruta), metodo === 'POST', ruta);
  }
  assert.ok((PUBLICOS_ESCRITURA as readonly string[]).includes('/api/compartido/curso/tarea'));
});

test('la página también arranca por la firma y por su resolver, y cuenta el ingreso', () => {
  const src = leer('app/compartido/curso/[token]/page.tsx');
  assert.match(src, /const\s+firma\s*=\s*leerTokenPortal\(token\)/);
  // El callback puede llevar su tipo de retorno (`async (): Promise<…> => {`).
  assert.match(src, /runWithWorkspace\(\s*firma\.ws\s*,\s*async\s*\(\)\s*(?::[^=]+)?=>\s*\{\s*const\s+acceso\s*=\s*await\s+resolverAccesoPortal\(token\)/);
  assert.ok(src.indexOf('contarIngreso(') > src.indexOf('resolverAccesoPortal('));
  assert.ok(src.indexOf('contarIngreso(') < src.indexOf('armarVistaAlumno('), 'el ingreso se cuenta antes de armar la vista');
  // El área del líder sale del ACCESO resuelto, y llega a la vista: sin esto, un link de líder
  // armaría el portal entero del cliente. Y los PERMISOS (mig 0219), del mismo acceso: sin ellos el
  // alumno vería los módulos que le sacaron.
  assert.match(src, /armarVistaAlumno\(\s*acceso\.leadId\s*,\s*\{\s*lider:\s*acceso\.area\s*,\s*alcance:\s*acceso\.alcance\s*\}\s*\)/);
});

test('los permisos del alumno (mig 0219) entran por la única puerta, en las seis rutas y en las dos páginas', () => {
  // Rompiéndolo (08/10/2026): sacar `alcance: acceso.alcance` de la ruta del video, o el filtro de
  // `armarVistaAlumno`, tumba este test (1 fallo). Restaurado: pasa.
  for (const r of ['progreso', 'tarea', 'video', 'entrega', 'adjunto']) {
    assert.match(leer(`app/api/compartido/curso/${r}/route.ts`), /claseDelAlumno\([^)]*alcance:\s*acceso\.alcance/, `${r}: sin los permisos`);
  }
  assert.match(leer('app/mi-curso/portal-comun.tsx'), /armarVistaAlumno\(\s*acceso\.leadId\s*,\s*\{\s*alcance:\s*acceso\.alcance\s*\}\s*\)/);
  const portal = leer('lib/curso-portal.ts');
  assert.match(portal, /permitido: \(clave\) => moduloPermitido\(alcance, productoId, clave\)/, 'armarVistaAlumno no filtra los módulos');
  assert.match(portal, /!moduloPermitido\(alcance, clase\.productoId, clase\.etapa\)\) \{\s*return \{ decision: 'no-existe' \}/, 'claseDelAlumno no mira los permisos');
});

// ROTURAS 08/10/2026 (scratchpad/nucleo/romper.mjs, de a una, restaurando de memoria). Sin romper,
// 31 pass / 0 fail; las del evaluador están en tests/curso-bloqueo.test.ts. Acá, las de la puerta:
//   · un módulo cerrado manda sus clases                            → 29 / 2 (los dos de «no viaja»)
//   · una clase cerrada viaja entera                                → 30 / 1 «una clase CERRADA…»
//   · un módulo no permitido viaja                                  → 30 / 1 «…sus PERMISOS no le dan…»
//   · la ruta del progreso con `exigeAbierta: false`                → 30 / 1 «las cinco rutas exigen…»
//     (y la del adjunto, ídem: cae también «la ruta del alumno» de tests/curso-adjuntos.test.ts)
//   · `armarVistaAlumno` leyendo los módulos sin `estricta`         → 30 / 1 «la vista se arma ESTRICTA…»
//   · `armarVistaAlumno` sin `conHtmlSaneado`                       → 30 / 1 «la vista se arma ESTRICTA…»
//   · `decidirClase` abriendo lo que no se evaluó (`undefined`)      → 30 / 1 «decidirClase: con la clase ABIERTA…»
//   · el líder marcando «hecha» una clase por el cliente            → 30 / 1 «las cinco rutas exigen…»
// REVISIÓN del 08/10/2026 (scratchpad/rev-nucleo/romper-final.mjs, restaurado de memoria). Sin romper,
// 32 pass / 0 fail; cada una dio 31 / 1:
//   · `armarModulos` sin pasarle `nombrable` al líder                → «al LÍDER de un área, el motivo…»
//   · `claseDelAlumno` con `abierta !== false` (lo no evaluado abre)  → «la vista se arma ESTRICTA…»
//   · `marcarHecha` (la función) sin rechazar una clase con tarea      → el mismo
//   (las dos últimas daban 32 / 0 antes de la revisión: no las miraba nadie)
test('las cinco rutas de una clase exigen la clase ABIERTA (el progreso también: completar abre otras)', () => {
  for (const r of ['progreso', 'tarea', 'video', 'entrega', 'adjunto']) {
    assert.match(leer(`app/api/compartido/curso/${r}/route.ts`), /claseDelAlumno\([^)]*exigeAbierta:\s*true/, `${r}: no exige la clase abierta`);
  }
  // Marcar «hecha» una clase con tarea no se puede: se completa enviándola.
  const progreso = leer('app/api/compartido/curso/progreso/route.ts');
  // Y el líder de un área no la marca por el cliente.
  assert.match(progreso, /if \(hecha != null\) \{\s*if \(acceso\.area != null \|\| tieneTarea\(r\.clase\)\) return NO\(\);/);
});

test('la vista se arma ESTRICTA (módulos y etapas) y con la descripción rica saneada otra vez', () => {
  const portal = leer('lib/curso-portal.ts');
  const vista = portal.slice(portal.indexOf('export async function armarVistaAlumno('), portal.indexOf('export async function claseDelAlumno('));
  assert.ok(vista.length > 500 && vista.length < 5000, `el recorte mide ${vista.length}`);
  assert.match(vista, /modulosDelCurso\(productoId, \{ estricta: true \}\)/);
  assert.match(vista, /if \(!cur\) throw new Error/);
  assert.match(vista, /conHtmlSaneado\(armarModulos\(/);
  assert.match(vista, /\}\), sanearHtml\);/);
  assert.doesNotMatch(vista, /entregaDeProducto\(/, 'la lectura que cae al default no decide qué se abre');
  // La ruta y los mensajes que nombran clases leen y evalúan con UN armado (`aperturasDelAlumno`,
  // revisión 08/10), que es la MISMA evaluación que el dibujo (`aperturasDe`) sobre lo ESTRICTO.
  const clase = portal.slice(portal.indexOf('export async function claseDelAlumno('), portal.indexOf('export async function aperturasDelAlumno('));
  const armado = portal.slice(portal.indexOf('export async function aperturasDelAlumno('));
  assert.ok(clase.length > 300 && clase.length < 3000 && armado.length > 300 && armado.length < 3000, `recortes de ${clase.length} y ${armado.length}`);
  assert.match(armado, /modulosDatos\.modulosDelCurso\(p\.productoId, \{ estricta: true \}\)/);
  assert.match(armado, /if \(!cur\) throw new Error/);
  assert.match(armado, /return aperturasDe\(\{/, 'la ruta decide con la MISMA evaluación que el dibujo');
  assert.match(armado, /permitido: \(clave\) => moduloPermitido\(p\.alcance, p\.productoId, clave\)/);
  // Lo que la evaluación no contestó (una clase que no está en la lista leída) NO se abre: `=== true`,
  // nunca `!== false` (revisión 08/10: cambiarlo no tumbaba nada).
  assert.match(clase, /await aperturasDelAlumno\(\{[^}]*\}\)\)\s*\.clases\.get\(clase\.id\)\?\.abierta === true;/);
  assert.match(sinComentarios(readFileSync(join(RAIZ, 'lib/curso-mensajes.ts'), 'utf8')), /aperturasDelAlumno\(/, 'los mensajes nombran clases sin mirar candados');
  // Y la marca de «hecha» de una clase con tarea la rechaza también la FUNCIÓN, no sólo la ruta: una
  // exportada la puede llamar el próximo sin pasar por ahí.
  const datos = leer('lib/curso-datos.ts').replace(/\r\n/g, '\n');
  const marcar = datos.slice(datos.indexOf('export async function marcarHecha('), datos.indexOf('export async function abiertoDesdeDe('));
  assert.ok(marcar.length > 100 && marcar.length < 1500, `el recorte mide ${marcar.length}`);
  assert.match(marcar, /^export async function marcarHecha\([^)]*\): Promise<Progreso> \{\s*if \(tieneTarea\(clase\)\) throw new Error/);
});

test('los componentes del portal sólo importan TIPOS de lib/curso-portal (trae la capa de datos)', () => {
  const dir = join(RAIZ, 'app/compartido/curso/[token]');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx') || x.endsWith('.ts'))) {
    if (f === 'page.tsx') continue; // el server sí la llama
    const src = sinComentarios(readFileSync(join(dir, f), 'utf8'));
    const imports = [...src.matchAll(/import\s+(type\s+)?[^;]*?from\s+['"]@\/lib\/curso-portal['"]/g)];
    for (const m of imports) assert.ok(m[1], `${f}: importa un VALOR de lib/curso-portal`);
  }
});

// ── Lo del EQUIPO no viaja al alumno (mig 0208: las notas y la marca de grabar) ──────────────

/** Todos los .ts/.tsx de una carpeta, recursivo. */
const fuentesDe = (rel: string): string[] => {
  const out: string[] = [];
  const bajar = (d: string) => {
    for (const e of readdirSync(join(RAIZ, d), { withFileTypes: true })) {
      const r = `${d}/${e.name}`;
      if (e.isDirectory()) bajar(r);
      else if (/\.tsx?$/.test(e.name)) out.push(r);
    }
  };
  bajar(rel);
  return out;
};

// ⚠️ LAS NOTAS DEL EQUIPO JAMÁS LLEGAN AL PORTAL (#692): pueden nombrar a otros clientes de
// Mauricio. Se mira el FUENTE del portal entero —lib/curso-portal.ts, la página, las rutas y
// /mi-curso—, no sólo `claseVista`: una lectura nueva en cualquiera de ellos las filtraría.
test('el portal del alumno no lee las notas del equipo ni su bucket', () => {
  const archivos = ['lib/curso-portal.ts', ...fuentesDe('app/compartido/curso'), ...fuentesDe('app/api/compartido/curso'), ...fuentesDe('app/mi-curso')];
  assert.ok(archivos.length >= 8, `barrí sólo ${archivos.length} archivos: la lista de carpetas quedó vieja`);
  for (const f of archivos) {
    assert.doesNotMatch(leer(f), /curso_clase_notas|curso-notas|NotasClase/, `${f} toca las notas del equipo`);
  }
});

test('claseVista es una lista blanca: la marca de grabar, el candado (ni nada que no esté en ella) no viaja', () => {
  const conMarca = { ...clase(1), grabar: true, notas: ['interna'], bloqueo: { tipo: 'abierto' } } as unknown as Clase;
  const [e] = armar([{ key: 'e1', label: 'Uno' }], 'e1', [conMarca], new Map());
  assert.deepEqual(Object.keys(e.clases[0]).sort(), [
    'campos', 'completa', 'descripcion', 'descripcionHtml', 'estado', 'hecha', 'id', 'minutos', 'obligatoria', 'pct', 'tarea', 'tieneTarea', 'titulo', 'valores', 'video',
  ]);
});
