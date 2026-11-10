// =============================================================================
// Los motion graphics en el chat «Editar con IA» y en la API de MaKo: agregar_motion y editar_motion (26/10/2026)
// =============================================================================
// Pedido de Martín (26/10/2026): motion graphics de punta a punta, también por el chat del editor y por la API. Un motion
// graphic es un `graphic` con `definitionId` «motion-<plantilla>» y sus valores en `element.params`
// (app/video-editor/_opencut/graphics/definitions/motion.ts). Lo que fija este archivo:
//   · la FORMA (lib/editor-video/chat-catalogo.ts): la validación es la del motor (`normalizarMotion` estricto) y lo
//     malo se RECHAZA con su motivo, nunca se recorta; agregar exige los obligatorios (y el número de una cifra), y
//     editar no cambia la plantilla;
//   · lo que se inserta no lleva los textos ni las estrellas de EJEMPLO de la plantilla (no son de la persona);
//   · la vista (chat/linea.ts) muestra cada motion como "tipo":"motion" con su plantilla y SUS valores (no la posición
//     ni la opacidad del elemento), y una forma común sigue siendo una forma;
//   · la revisión valida editar_motion contra los campos y topes de SU plantilla, y escribe sólo lo que cambia;
//   · la tarjeta de la propuesta, la API (lista [{campo, valor}] con su tipo) y la revisión contra la copia;
//   · el comando que aplica es el de la biblioteca (agregar) y el `updateElements` del panel (editar).
//
// Correr: node --import tsx --test tests/video-editor-chat-motion.test.ts
//
// Traído de la etiqueta rescate/motion-imagen-2610 el 10/11/2026, con dos cambios: M10 vuelve a pedir la ORDEN
// («nunca los inventes»; el 27/10 se había editado la regex para que coincidiera con un texto impersonal, y el que se
// arregló fue el código) y M14 es nuevo (la cifra con decimales).
//
// PROBADO ROMPIÉNDOLO (10/11/2026, base 14/0, cada rotura restaurada de memoria):
//   · agregar deja los textos de ejemplo de la plantilla (`valoresAlAgregar`)      -> 12/2 (M5, M8)
//   · motion sin la validación ESTRICTA de `normalizarMotion`                      -> 9/5 (M2, M3, M7, M12, M14)
//   · el catálogo dice «nunca se inventan» en vez de la orden                      -> 13/1 (M10)
//   · agregar no exige los obligatorios ni el número de la cifra                   -> 12/2 (M2, M11)
//   · `leerVista` no anota la plantilla de cada motion                             -> 13/1 (M12)
//   · el comando de agregar inserta sin los valores                                -> 13/1 (M13)
//   · la fila de la revisión dice el número con punto («4.5»)                      -> 13/1 (M14)
//   · la vista no muestra los campos del motion                                    -> 13/1 (M5)
//   · un cambio sin efecto (`[...Object.keys(entrada)]`)                           -> 14/0
//   · la API sin pasar «4,5» a número (`valorMotion`)                              -> 14/0: NO lo ve ningún test, y no
//     puede: el «4,5» que queda como texto lo lee igual `normalizarMotion` (lib/motion/plantillas.ts). Es una red de más.
//   · `!alAgregar && !claves.length` INVERTIDO (27/10)                               -> NO lo ve ningún test, y no
//     puede: un editar_motion sin valores ya lo rechaza la forma (`valoresMotionDeForma`) antes de llegar ahí, y un
//     agregar sin valores lo rechaza el obligatorio. Esa rama es una red de más, no una regla.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NO_SE_PUEDE_CHAT, OPERACIONES_CHAT, TIPO_CAMPO_MOTION, TOPES_CHAT, catalogoParaPrompt, validarOperacion, valoresAlAgregar,
  type OperacionChat,
} from '../lib/editor-video/chat-catalogo';
import { vistaDeLinea, revisarOperaciones, type OperacionResuelta } from '../app/video-editor/_opencut/chat/linea';
import { OPERACIONES_API, descripcionApi, operacionDesdeInput } from '../lib/editor-video/chat-api';
import { filasDePropuesta } from '../lib/editor-video/propuesta-bloque';
import { leerVista, lineaDeOperacion, refsDeOperacion, revisarContraCopia } from '../lib/editor-video/propuestas';
import { validarInput } from '../lib/api-mako/validar';
import { porId } from '../lib/api-mako/registro';
import { camposDe, valoresPorDefecto } from '../lib/motion/plantillas';
import { PLANTILLAS_MOTION } from '../lib/motion/tipos';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const TPS = 120_000;
const t = (s: number) => Math.round(s * TPS);
const v = validarOperacion;
const motivo = (r: ReturnType<typeof validarOperacion>) => (r.ok ? '' : r.motivo);

/** Una escena con dos motion graphics (una cifra a mano y un cierre agregado por el chat), una forma, un texto y un video. */
function escena(): SceneTracks {
  const el = (id: string, type: string, ini: number, dur: number, extra: Record<string, unknown> = {}) =>
    ({ id, type, name: id, startTime: t(ini), duration: t(dur), trimStart: 0, trimEnd: 0, params: {}, ...extra });
  return {
    overlay: [
      {
        id: 'pg', type: 'graphic', name: 'Gráficos', hidden: false, elements: [
          el('mot1', 'graphic', 0, 4, {
            name: 'Motion · Cifra', definitionId: 'motion-cifra',
            // Los params del elemento llevan también su posición y su opacidad: la IA no los ve como campos.
            params: { ...valoresPorDefecto('cifra'), prefijo: '', numero: 320, etiqueta: 'alumnos', tono: 'energico', 'transform.positionX': 40, opacity: 0.9 },
          }),
          el('mot2', 'graphic', 5, 4.5, { name: 'Motion · Cierre con botón', definitionId: 'motion-cierre', params: valoresAlAgregar('cierre', { titulo: 'Empieza hoy', boton: 'Reserva' }) }),
          el('rect1', 'graphic', 10, 2, { name: 'Rectángulo', definitionId: 'rectangle', params: { fill: '#ff0000' } }),
        ],
      },
      { id: 'pt', type: 'text', name: 'Texto', hidden: false, elements: [el('txt1', 'text', 1, 3, { params: { content: 'Hola' } })] },
    ],
    main: { id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, elements: [el('vid1', 'video', 0, 12, { mediaId: 'm1' })] },
    audio: [],
  } as unknown as SceneTracks;
}

const vista = () => vistaDeLinea({ tracks: escena(), tps: TPS, cabezal: 0, elegidos: [] });
const revisar = (operaciones: unknown[]) => revisarOperaciones({ operaciones: operaciones as OperacionChat[], vista: vista(), alcance: 'video' });
type Params = Extract<OperacionResuelta, { op: 'params' }>;
type Agregada = Extract<OperacionResuelta, { op: 'agregar_motion' }>;

// ─── La FORMA (el catálogo) ──────────────────────────────────────────────────

test('M1: agregar_motion bueno pasa normalizado, guarda sólo lo que vino y validar lo validado da lo mismo', () => {
  const r = v({ op: 'agregar_motion', plantilla: ' Titular ', valores: { titulo: '  50% off  ', tono: 'energico' }, inicio: 1.234, ref: 'n1' });
  assert.deepEqual(r, { ok: true, op: { op: 'agregar_motion', plantilla: 'titular', valores: { titulo: '50% off', tono: 'energico' }, inicio: 1.23, ref: 'n1' } });
  assert.deepEqual(v(r.ok ? r.op : null), r, 'idempotente: la API la guarda y la vuelve a validar al leerla');
  const conDuracion = v({ op: 'agregar_motion', plantilla: 'cifra', valores: { numero: 1250, etiqueta: 'clientes' }, inicio: 0, duracion: 3 });
  assert.ok(conDuracion.ok && conDuracion.op.op === 'agregar_motion' && conDuracion.op.duracion === 3);
});

test('M2: agregar_motion malo se RECHAZA con su motivo: plantilla, campo, tope, obligatorio, número de la cifra, ref', () => {
  assert.match(motivo(v({ op: 'agregar_motion', plantilla: 'carrusel', valores: { titulo: 'x' }, inicio: 0 })), /«carrusel» no es un motion graphic \(son: titular, palabras/);
  assert.match(motivo(v({ op: 'agregar_motion', plantilla: 'titular', valores: { titulo: 'x', subtitulo: 'y' }, inicio: 0 })), /subtitulo: no es un campo de «Titular»/);
  const largo = v({ op: 'agregar_motion', plantilla: 'titular', valores: { titulo: 'x'.repeat(91) }, inicio: 0 });
  assert.match(motivo(largo), /Título: tiene 91 caracteres y el tope es 90/, 'nunca se recorta');
  assert.match(motivo(v({ op: 'agregar_motion', plantilla: 'tercio', valores: { rol: 'CEO' }, inicio: 0 })), /necesita "nombre": sale de lo que dijo la persona/);
  assert.match(motivo(v({ op: 'agregar_motion', plantilla: 'cifra', valores: { etiqueta: 'clientes' }, inicio: 0 })), /necesita "numero"/, 'una cifra no se inventa');
  assert.match(motivo(v({ op: 'agregar_motion', plantilla: 'titular', titulo: 'x', inicio: 0 })), /los campos van dentro de "valores"/);
  assert.match(motivo(v({ op: 'agregar_motion', plantilla: 'titular', valores: { titulo: 'x', colorAcento: 'rojo' }, inicio: 0 })), /no es un color/);
  assert.equal(v({ op: 'agregar_motion', plantilla: 'titular', valores: { titulo: 'x' }, inicio: 0, ref: 'g1' }).ok, false, 'una ref nueva es n1, n2…');
  assert.equal(v({ op: 'agregar_motion', plantilla: 'titular', valores: { titulo: 'x' }, inicio: 0, duracion: TOPES_CHAT.duracionMax + 1 }).ok, false);
});

test('M3: editar_motion: la forma sin saber la plantilla, y la plantilla NO se cambia', () => {
  assert.deepEqual(v({ op: 'editar_motion', ref: 'g1', valores: { titulo: ' Hola ', conFondo: false } }), { ok: true, op: { op: 'editar_motion', ref: 'g1', valores: { titulo: 'Hola', conFondo: false } } });
  assert.match(motivo(v({ op: 'editar_motion', ref: 'g1', plantilla: 'cierre', valores: { titulo: 'x' } })), /la plantilla de un motion graphic no se cambia: bórralo y agrega otro/);
  assert.match(motivo(v({ op: 'editar_motion', ref: 'g1', valores: { plantilla: 'cierre' } })), /no se cambia/);
  assert.match(motivo(v({ op: 'editar_motion', ref: 'g1', valores: { brillo: 3 } })), /«brillo» no es un campo de ningún motion graphic/);
  // Más largo que el tope más largo de las que tienen «titulo» (90): se rechaza ya en la forma, con el motivo del motor.
  assert.match(motivo(v({ op: 'editar_motion', ref: 'g1', valores: { titulo: 'x'.repeat(120) } })), /^Título: tiene 120 caracteres/);
  assert.equal(v({ op: 'editar_motion', ref: 'g1', valores: {} }).ok, false, 'sin cambios');
  assert.equal(v({ op: 'editar_motion', ref: 'g1', titulo: 'x' }).ok, false, 'un campo suelto, fuera de "valores"');
});

test('M4: una clave tiene el MISMO tipo en todas las plantillas (de eso viven editar_motion y la API)', () => {
  for (const p of PLANTILLAS_MOTION) for (const c of camposDe(p)) assert.equal(TIPO_CAMPO_MOTION.get(c.clave), c.tipo, `«${c.clave}» en «${p}»`);
});

// ─── La vista que lee la IA ──────────────────────────────────────────────────

test('M5: la vista muestra cada motion como "motion", con su plantilla y SUS valores; una forma sigue siendo una forma', () => {
  const vv = vista();
  assert.deepEqual([...vv.refs.keys()], ['g1', 'g2', 'g3', 't1', 'v1']);
  const els = JSON.parse(vv.json).pistas[0].elementos as Array<Record<string, unknown>>;
  assert.deepEqual(els[0], {
    ref: 'g1', tipo: 'motion', nombre: 'Motion · Cifra', inicio: 0, fin: 4,
    // Los suyos sin los vacíos; de los comunes, el tono siempre y el resto sólo si no es el de la plantilla.
    plantilla: 'cifra', valores: { numero: 320, decimales: 0, etiqueta: 'alumnos', tono: 'energico' },
    posicion: [40, 0], opacidad: 90,
  });
  assert.deepEqual(els[1].valores, { titulo: 'Empieza hoy', boton: 'Reserva', tono: 'corporativo' });
  assert.equal(els[2].tipo, 'grafico', 'un rectángulo no es un motion');
  assert.ok(!('plantilla' in els[2]) && !('valores' in els[2]));
  assert.equal(vv.refs.get('g1')!.estado.motion?.valores.colorFondo, valoresPorDefecto('cifra').colorFondo, 'la revisión tiene los valores ENTEROS');
  assert.ok(!('transform.positionX' in vv.refs.get('g1')!.estado.motion!.valores));
});

// ─── La revisión («Original | Modificado») ───────────────────────────────────

test('M6: editar_motion escribe SÓLO lo que cambia, con la fila de antes y después, y acumula en el mismo pedido', () => {
  const r = revisar([
    { op: 'editar_motion', ref: 'g1', valores: { numero: 450, tono: 'premium' } },
    { op: 'editar_motion', ref: 'g1', valores: { numero: 450, etiqueta: 'clientes' } },
    { op: 'editar_motion', ref: 'g2', valores: { boton: 'Reserva' } },
  ]);
  assert.deepEqual(r.descartes, []);
  assert.deepEqual(r.resueltas.map((x) => [x.op, (x as Params).de, (x as Params).params]), [
    ['params', 'editar_motion', { numero: 450, tono: 'premium' }],
    ['params', 'editar_motion', { etiqueta: 'clientes' }],
  ], 'lo que ya está así no es un cambio');
  assert.deepEqual(r.cambios[0], { tipo: 'cambia', titulo: 'Motion · Cifra', antes: 'Número 320 · Tono Enérgico', despues: 'Número 450 · Tono Premium' });
  assert.deepEqual([r.cambios[1].antes, r.cambios[1].despues], ['Etiqueta «alumnos»', 'Etiqueta «clientes»']);
});

test('M7: editar_motion contra SU plantilla: un campo de otra, un texto largo para la suya y lo que no es un motion se descartan', () => {
  // «titulo» existe (en titular), así que pasa la forma; pero una cifra no lo tiene.
  const otro = revisar([{ op: 'editar_motion', ref: 'g1', valores: { titulo: 'Hola' } }]);
  assert.deepEqual(otro.resueltas, []);
  assert.match(otro.descartes[0], /titulo: no es un campo de «Cifra»/);
  // 75 caracteres entran en un titular (90) pero no en el título del cierre (60).
  const largo = revisar([{ op: 'editar_motion', ref: 'g2', valores: { titulo: 'x'.repeat(75) } }]);
  assert.match(largo.descartes[0], /Título: tiene 75 caracteres y el tope es 60/);
  for (const ref of ['t1', 'g3', 'v1']) assert.match(revisar([{ op: 'editar_motion', ref, valores: { tono: 'premium' } }]).descartes[0], /no es un motion graphic/, ref);
  assert.match(revisar([{ op: 'cambiar_texto', ref: 'g1', texto: 'x' }]).descartes[0], /sus textos se cambian con editar_motion/);
});

test('M8: agregar_motion inserta sin los textos ni las estrellas de EJEMPLO, con la duración de la plantilla, y su «n1» sigue en el pedido', () => {
  const r = revisar([
    { op: 'agregar_motion', plantilla: 'testimonio', valores: { cita: 'Me cambió el negocio', nombre: 'Laura' }, inicio: 2, ref: 'n1' },
    { op: 'editar_motion', ref: 'n1', valores: { estrellas: 4.5 } },
    { op: 'mover', ref: 'n1', inicio: 3 },
    { op: 'agregar_motion', plantilla: 'titular', valores: { titulo: 'Hola' }, inicio: 0 },
  ]);
  assert.deepEqual(r.descartes, []);
  assert.deepEqual(r.resueltas.map((x) => x.op), ['agregar_motion', 'params', 'mover', 'agregar_motion']);
  const a = r.resueltas[0] as Agregada;
  assert.deepEqual([a.duracion, a.valores.cita, a.valores.nombre, a.valores.cargo, a.valores.estrellas, a.valores.tono], [7, 'Me cambió el negocio', 'Laura', '', 0, 'corporativo']);
  assert.equal((r.resueltas[1] as Params).el.nuevo, true);
  assert.deepEqual((r.resueltas[1] as Params).params, { estrellas: 4.5 });
  const titular = r.resueltas[3] as Agregada;
  assert.deepEqual([titular.valores.antetitulo, titular.valores.bajada, titular.duracion], ['', '', 5], 'ni «NUEVO» ni la bajada de muestra');
  assert.deepEqual(r.cambios[0], { tipo: 'agrega', titulo: 'Motion «Testimonio»', antes: '', despues: 'Cita «Me cambió el negocio» · Nombre «Laura» · de 2 s a 9 s' });
});

// ─── La tarjeta, el catálogo que lee la IA y la API ──────────────────────────

test('M9: la tarjeta de la propuesta dice cada una en palabras, y lo agregado no tiene «antes»', () => {
  const copia = { pistas: [{ tipo: 'grafico', elementos: [{ ref: 'g1', tipo: 'motion', nombre: 'Motion · Cifra', inicio: 0, fin: 4, plantilla: 'cifra' }] }] };
  const filas = filasDePropuesta([
    { op: 'agregar_motion', plantilla: 'titular', valores: { titulo: '50% off', tono: 'energico' }, inicio: 0, ref: 'n1' },
    { op: 'editar_motion', ref: 'g1', valores: { numero: 450 } },
  ], copia);
  assert.deepEqual(filas[0], { campo: 'Agregar un motion graphic', antes: '—', despues: 'Motion «Titular» (Título «50% off» · Tono Enérgico) de 0:00 a 0:05' });
  assert.deepEqual(filas[1], { campo: 'Editar un motion graphic', antes: 'Motion · Cifra (g1, de 0:00 a 0:04)', despues: 'Número 450' });
  assert.equal(lineaDeOperacion('Agregar un motion graphic', { op: 'agregar_motion', plantilla: 'cifra', valores: { numero: 9, etiqueta: 'años' }, inicio: 0 }, null),
    'Agregar un motion graphic → Cifra: Número 9 · Etiqueta «años»');
});

test('M10: el catálogo que lee la IA enseña las plantillas y las reglas, y «no se puede» ya no tapa los motion', () => {
  const txt = catalogoParaPrompt();
  const renglon = txt.split('\n- ').find((l) => l.includes('"op":"agregar_motion"'))!;
  for (const p of PLANTILLAS_MOTION) assert.match(renglon, new RegExp(`\\n  · ${p} — `), p);
  assert.match(renglon, /TAL CUAL/);
  // ⚠️ La regla le habla AL MODELO, como el resto del catálogo («no lo inventes», «no inventes otros»). El 27/10 la
  // descripción pasó a «nunca se inventan» y la regex se cambió para que volviera a coincidir: el 10/11 se volvió a la
  // regex de antes y se arregló el TEXTO (lib/editor-video/chat-catalogo.ts → PARA_AGREGAR_MOTION).
  assert.match(renglon, /nunca los inventes/);
  assert.match(renglon, /UN "tono"/);
  assert.match(NO_SE_PUEDE_CHAT, /un motion graphic, sí: agregar_motion/);
  // Al final del catálogo: después de TODAS las que había antes (una nueva no les saca el lugar en el presupuesto de la
  // API), y las dos juntas. Las de antes se cuentan desde la última del 9/11/2026 (edicion_automatica).
  const ids = OPERACIONES_CHAT.map((o) => o.op);
  assert.ok(ids.indexOf('edicion_automatica') >= 0, 'la última de antes sigue en el catálogo');
  assert.ok(ids.indexOf('agregar_motion') > ids.indexOf('edicion_automatica'), 'después de las de antes');
  assert.equal(ids.indexOf('editar_motion'), ids.indexOf('agregar_motion') + 1);
});

test('M11: la API: una lista [{campo, valor}] que vuelve a {campo: valor} con su tipo, y la descripción con las plantillas', () => {
  const op = (id: string) => OPERACIONES_API.find((o) => o.id === id)!;
  const agregar = op('agregar_motion_video');
  const entrada = { proyecto: 'p', plantilla: 'cifra', inicio: 0, valores: [{ campo: 'numero', valor: 1250 }, { campo: 'etiqueta', valor: 'clientes' }, { campo: 'conFondo', valor: 'no' }] };
  const ok = validarInput(porId('agregar_motion_video')!.parametros, entrada, 'json');
  assert.ok('input' in ok, 'error' in ok ? ok.error : '');
  const r = operacionDesdeInput(agregar, (ok as { input: Record<string, unknown> }).input);
  assert.deepEqual(r, { ok: true, op: { op: 'agregar_motion', plantilla: 'cifra', valores: { numero: 1250, etiqueta: 'clientes', conFondo: false }, inicio: 0 } });
  // Sin «valor» es vacío: saca un campo opcional.
  const vacio = operacionDesdeInput(op('editar_motion_video'), { proyecto: 'p', ref: 'g1', valores: [{ campo: 'nota' }] });
  assert.deepEqual(vacio, { ok: true, op: { op: 'editar_motion', ref: 'g1', valores: { nota: '' } } });
  const malo = operacionDesdeInput(agregar, { proyecto: 'p', plantilla: 'cifra', inicio: 0, valores: [{ campo: 'etiqueta', valor: 'x' }] });
  assert.ok(!malo.ok && /necesita "numero"/.test(malo.motivo));
  // Las plantillas van en el PARÁMETRO "plantilla" (no puntúa contra el pedido); la descripción, las reglas.
  const plantilla = porId('agregar_motion_video')!.parametros.find((p) => p.nombre === 'plantilla')!;
  for (const p of PLANTILLAS_MOTION) assert.ok(plantilla.descripcion.includes(`${p} (`), `el parámetro no nombra «${p}»`);
  assert.match(plantilla.descripcion, /titulo\*≤90/);
  assert.match(plantilla.descripcion, /cifra \(prefijo≤4, numero\*,/, 'el número de una cifra tiene que venir');
  const d = descripcionApi(agregar);
  assert.match(d, /TAL CUAL/);
  assert.doesNotMatch(d, /antetitulo|precioAntes/, 'el catálogo no va en la descripción');
});

test('M12: contra la copia: editar_motion mira la plantilla del elemento (o la del agregar de la misma propuesta), y agregar NOMBRA su ref', () => {
  const copia = leerVista({ pistas: [{ tipo: 'grafico', elementos: [
    { ref: 'g1', tipo: 'motion', nombre: 'Motion · Cierre con botón', plantilla: 'cierre' },
    { ref: 'g2', tipo: 'grafico', nombre: 'Rectángulo' },
  ] }] });
  const editar = (ref: string, valores: Record<string, unknown>): OperacionChat => ({ op: 'editar_motion', ref, valores: valores as never });
  assert.deepEqual(revisarContraCopia({ op: editar('g1', { boton: 'Ya' }), vista: copia, previas: [] }), { ok: true });
  const largo = revisarContraCopia({ op: editar('g1', { titulo: 'x'.repeat(75) }), vista: copia, previas: [] });
  assert.ok(!largo.ok && /el tope es 60/.test(largo.motivo));
  const forma = revisarContraCopia({ op: editar('g2', { tono: 'premium' }), vista: copia, previas: [] });
  assert.ok(!forma.ok && /no es un motion graphic/.test(forma.motivo));
  const agregado: OperacionChat = { op: 'agregar_motion', plantilla: 'cifra', valores: { numero: 3, etiqueta: 'sedes' }, inicio: 0, ref: 'n1' };
  assert.deepEqual(refsDeOperacion(agregado), { usa: [], medios: [], define: ['n1'] });
  assert.deepEqual(revisarContraCopia({ op: editar('n1', { numero: 4 }), vista: copia, previas: [agregado] }), { ok: true });
  const deOtra = revisarContraCopia({ op: editar('n1', { titulo: 'x' }), vista: copia, previas: [agregado] });
  assert.ok(!deOtra.ok && /no es un campo de «Cifra»/.test(deOtra.motivo));
});

test('M14: una cifra con decimales viaja como se pidió por el chat y por la API (4,5 nunca pasa a 5)', () => {
  const r = v({ op: 'agregar_motion', plantilla: 'cifra', valores: { numero: 4.5, etiqueta: 'de calificación' }, inicio: 0 });
  assert.ok(r.ok && r.op.op === 'agregar_motion' && r.op.valores.numero === 4.5, motivo(r));
  // Por la API todo llega como texto, y con coma: «4,5» vuelve a ser 4,5.
  const api = operacionDesdeInput(OPERACIONES_API.find((o) => o.id === 'agregar_motion_video')!, {
    proyecto: 'p', plantilla: 'cifra', inicio: 0, valores: [{ campo: 'numero', valor: '4,5' }, { campo: 'etiqueta', valor: 'de calificación' }],
  });
  assert.ok(api.ok && api.op.op === 'agregar_motion' && api.op.valores.numero === 4.5, api.ok ? '' : api.motivo);
  // Lo que no entra en el paso no se redondea en silencio: se rechaza con su motivo.
  assert.match(motivo(v({ op: 'agregar_motion', plantilla: 'cifra', valores: { numero: 4.567, etiqueta: 'x' }, inicio: 0 })), /Número: 4,567 no va de a 0,01/);
  assert.match(motivo(v({ op: 'editar_motion', ref: 'g1', valores: { estrellas: 4.3 } })), /no va de a 0,5/);
  // Editar la cifra de la escena: la fila dice el número con coma, como se ve.
  const rev = revisar([{ op: 'editar_motion', ref: 'g1', valores: { numero: 4.5 } }]);
  assert.deepEqual(rev.descartes, []);
  assert.deepEqual((rev.resueltas[0] as Params).params, { numero: 4.5 });
  assert.equal(rev.cambios[0].despues, 'Número 4,5');
});

test('M13: aplicar usa el comando de la biblioteca (agregar) y el `updateElements` del panel (editar), en el lote', () => {
  const com = sinComentarios(leer('app/video-editor/_opencut/chat/comandos.ts'));
  const caso = com.slice(com.indexOf('case "agregar_motion"'), com.indexOf('case "capa_efecto"'));
  assert.match(caso, /buildGraphicElement\(\{\s*definitionId: idDefinicionMotion\(r\.plantilla\)/);
  assert.match(caso, /params: r\.valores/);
  assert.match(caso, /new InsertElementCommand\(\{ element, placement: \{ mode: "auto" \} \}\)/);
  assert.match(caso, /if \(r\.ref\) nuevos\.set\(r\.ref, insercion\)/);
  // editar_motion sale de la revisión como «params», que es un UpdateElementsCommand con los params MEZCLADOS.
  assert.match(com, /case "params":\s*\n\s*comandos\.push\(sobre\(r\.el, \(o\) => actualizar\(o, \{ params: r\.params \}/);
  const lin = sinComentarios(leer('app/video-editor/_opencut/chat/linea.ts'));
  assert.match(lin, /case "editar_motion": \{[\s\S]{0,1400}escribir\(\{ \.\.\.nuevos \}, fila\)/);
  assert.doesNotMatch(sinComentarios(leer('app/video-editor/_opencut/chat/comandos.ts')), /"agregar_motion"[^\n]*LARGAS|LARGAS[^\n]*"agregar_motion"/, 'agregar va en el lote, no después');
});

