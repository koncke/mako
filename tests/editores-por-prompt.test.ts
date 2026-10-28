// =============================================================================
// Editar lo que sea POR PROMPT: cada pedido a MaKo llega a la operación del Video Editor o del Image Editor que lo hace
// =============================================================================
// Pedido de Martín (27/10/2026, textual): «Y asegurate de que funcione bien la API con todos los comandos, si una persona
// quiere editar lo que sea debería poder. Con prompts en mako me refiero». Sin un modelo vivo, «probado de punta a punta
// por prompt» es esto: el turno que CORRE (AGENTS.md, «Una capacidad nueva del doer se prueba con el turno que CORRE»):
//   · la app: `clasificarIntencion(texto, { canal: 'app' })` + `herramientasDelChat` (lib/mako-turno-app.ts);
//   · WhatsApp: `clasificarIntencion(texto)` + `herramientasDelTurno` (lib/mako-doer-in.ts);
// con las frases como las escribe la persona (tuteo y voseo), y la operación tiene que estar entre las herramientas que
// VIAJAN, dentro del presupuesto de 12.000 caracteres del registro (el techo de Groq, que no se sube). Molde:
// tests/ops-center-clasificador-app.test.ts y tests/agenda-whatsapp.test.ts.
//
// Y de cada operación nueva del 27/10, lo puro de punta a punta: la API la vuelve a la forma del chat
// (`operacionDesdeInput*`), la valida el MISMO catálogo, la revisión la simula sobre la copia («Original | Modificado») y
// la aplicación la escribe (el documento del Image Editor, que es puro; del video, la operación resuelta que arma el
// comando: el comando del motor necesita el WASM y se mira en el navegador).
//
// Correr SOLO: node --import tsx --test tests/editores-por-prompt.test.ts
//
// PROBADO ROMPIÉNDOLO (27/10/2026, base 15/0, cada rotura restaurada de memoria):
//   · sin la rama 6-bis-ter de clasificarIntencion (el pedido de editar)          -> 11/4 (P1, P2, P3, P4)
//   · voltear con la condición INVERTIDA (lib/image-editor/chat/aplicar.ts)       -> 13/2 (E4, E5)
//   · la propuesta acepta lo que no cambia nada (`<=` → `<`)                       -> 14/1 (E6)
//   · fondo_lienzo con «uno de los dos» INVERTIDO                                  -> 14/1 (E1)
//   · quitar_fondo sin exigir un clip                                              -> 14/1 (E3)
//   · crear/editar con IA sin `costo: 'dinero'`                                    -> 14/1 (A1)
//   · el título de duplicar sin «clip» (la relevancia contra el pedido)            -> 13/2 (P1, P2)
//   · «Discutir» sin salidaDeDiscutir                                              -> 14/1 (D1)
//   · sin los sinónimos de «elemento» (logo) en la puerta de las destructivas       -> 13/2 (P1, P3)
//   · sin capturar el link de la propuesta del Image Editor (base 16/0)             -> 15/1 (L1)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelChat } from '../lib/mako-turno-app-reglas';
import { herramientasDelTurno, PRESUPUESTO_REGISTRO_CHARS } from '../lib/doer-herramientas';
import { aToolDef, porId, type Vista } from '../lib/api-mako/registro';
import { validarInput } from '../lib/api-mako/validar';
import { RUTAS_REST } from '../lib/api-mako/rest';
import { OPERACIONES_API, operacionDesdeInput } from '../lib/editor-video/chat-api';
import { NIVELES_DESENFOQUE_LIENZO, RELACIONES_LIENZO, validarOperacion as validarVideo } from '../lib/editor-video/chat-catalogo';
import { filasDePropuesta } from '../lib/editor-video/propuesta-bloque';
import { leerVista, refsDeOperacion, revisarContraCopia } from '../lib/editor-video/propuestas';
import { vistaDeLinea, revisarOperaciones, textoFondoLienzo } from '../app/video-editor/_opencut/chat/linea';
import { OPERACIONES_API_IMAGEN, operacionApiImagenPorId, operacionDesdeInputImagen } from '../lib/image-editor/chat/api';
import { validarOperacion as validarImagen, validarOperacionesDePropuesta } from '../lib/image-editor/chat/catalogo';
import { aplicarOperaciones } from '../lib/image-editor/chat/aplicar';
import { vistaDeDiseno } from '../lib/image-editor/chat/vista';
import { probarPropuesta, refsUsadas, revisarContraDiseno, vistaGuardada } from '../lib/image-editor/chat/propuestas';
import { ESCRITURAS_IMAGEN } from '../lib/doer-recetas';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// lib/api-mako/flujo.ts tiene `server-only`: lo que decide si una acción corre en un flujo se lee del fuente.
const FLUJO = leer('lib/api-mako/flujo.ts');
const enElEditorDeVideo = (d: { pantalla?: string }) => d.pantalla === '/video-editor';
const enElEditorDeImagen = (d: { pantalla?: string }) => d.pantalla === '/image-editor';

/** Los nombres de las herramientas de siempre (módulos con `server-only`): se los pide a un node con la condición del server. */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; import { porId } from ${url('lib/api-mako/registro.ts')}; const t = porId('levantar_ticket'); process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((x) => x.name).concat(t ? [t.id] : [])));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vistaApp: Vista = { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null };
const vistaWa: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

/** El turno de la app, como lib/mako-turno-app.ts. */
function turnoApp(texto: string) {
  const veredicto = clasificarIntencion(texto, { canal: 'app' });
  const t = herramientasDelChat({ veredicto, texto, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaApp, hayPendientes: false });
  return { veredicto, nombres: t.tools.map((x) => x.name), delRegistro: t.delRegistro.map((x) => x.name) };
}
/** El turno de WhatsApp, como lib/mako-doer-in.ts. */
function turnoWhatsApp(texto: string) {
  const veredicto = clasificarIntencion(texto);
  const t = herramientasDelTurno({ veredicto, texto, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaWa, hayPendientes: false });
  return { veredicto, nombres: t.tools.map((x) => x.name) };
}

/** [frase, operaciones que la hacen (alcanza con UNA), canales]. */
type Caso = [texto: string, ops: string[], canales?: 'app' | 'ambos'];

// El Video Editor: lo que la gente pide, con las palabras con que lo pide.
const VIDEO: Caso[] = [
  ['cambiá el texto del título del video por Oferta', ['cambiar_texto_video']],
  ['cambia el texto del título del video por Oferta', ['cambiar_texto_video']],
  ['recortá el clip 2 segundos', ['recortar_clip_video']],
  ['recorta el clip 2 segundos', ['recortar_clip_video']],
  ['poné el fondo azul al video', ['fondo_lienzo_video']],
  ['pon el fondo del video azul', ['fondo_lienzo_video']],
  ['borrá el logo del video', ['borrar_elementos_video']],
  ['borra el logo del video', ['borrar_elementos_video']],
  ['agregá un subtítulo al video', ['generar_subtitulos_video', 'agregar_texto_video']],
  ['agrega subtítulos al video', ['generar_subtitulos_video']],
  ['subí el volumen de la música del video', ['cambiar_volumen_video']],
  ['sube el volumen de la música del video', ['cambiar_volumen_video']],
  ['poné un motion con el título Black Friday en el video', ['agregar_motion_video']],
  ['pon un motion graphic con el título Black Friday', ['agregar_motion_video']],
  ['cambiá el título del motion por Black Friday', ['editar_motion_video']],
  ['agregá un texto amarillo que diga Oferta al video', ['agregar_texto_video']],
  ['ponele color amarillo al texto del video', ['cambiar_estilo_texto_video']],
  ['duplicá el clip 1 del video', ['duplicar_elemento_video']],
  ['duplica el texto del video', ['duplicar_elemento_video']],
  ['sacale el fondo al video', ['quitar_fondo_video']],
  ['quita el fondo de la persona del video', ['quitar_fondo_video']],
  ['pasá el video a vertical 9:16', ['formato_lienzo_video']],
  ['cambia la relación del video a 1:1', ['formato_lienzo_video']],
  ['agregá la foto del producto al final del video', ['agregar_medio_video']],
  ['poné una transición entre los clips del video', ['poner_transicion_video']],
  ['poné el video en cámara lenta', ['cambiar_velocidad_video']],
  ['aplicale un filtro cálido al video', ['poner_filtro_video']],
  ['dividí el clip del video en el segundo 5', ['dividir_clip_video']],
  ['silenciá el audio del clip 2 del video', ['silenciar_clip_video']],
  ['agrandá el texto del video y subilo arriba', ['transformar_elemento_video', 'cambiar_estilo_texto_video']],
];

// El Image Editor.
const IMAGEN: Caso[] = [
  ['cambiá el texto del título del diseño por Oferta', ['cambiar_textos_diseno_imagen']],
  ['creá una imagen de un perro en el diseño', ['crear_imagen_ia']],
  ['crea una imagen de un perro con IA para el post', ['crear_imagen_ia']],
  ['duplicá la página del diseño', ['agregar_pagina_imagen']],
  ['duplica la página 2 del diseño', ['agregar_pagina_imagen']],
  ['borrá el logo del diseño', ['borrar_elementos_imagen']],
  ['borra el logo del flyer', ['borrar_elementos_imagen']],
  ['poné el fondo del diseño en negro', ['fondo_pagina_imagen']],
  ['pon el fondo de la página del diseño azul', ['fondo_pagina_imagen']],
  ['hacé el texto del diseño más grande y en negrita', ['estilo_texto_imagen']],
  ['cambia la fuente del título del diseño a Montserrat', ['estilo_texto_imagen']],
  ['mové el logo del diseño arriba a la derecha', ['mover_elemento_imagen', 'alinear_elementos_imagen']],
  ['centrá el título del diseño', ['alinear_elementos_imagen']],
  ['editá la foto del diseño y cambiale el fondo por una playa', ['editar_imagen_ia']],
  ['voltea la imagen del diseño', ['voltear_elemento_imagen']],
  ['agregá un rectángulo rojo abajo en el diseño', ['agregar_forma_imagen']],
  ['cambiá el color del botón del diseño a verde', ['color_elemento_imagen']],
  ['girá el texto del diseño 15 grados', ['rotar_elemento_imagen']],
  ['ocultá el logo del diseño', ['ocultar_elemento_imagen']],
  ['agregá un texto que diga Oferta al diseño', ['agregar_texto_imagen']],
  ['agrandá la imagen del diseño al doble', ['tamano_elemento_imagen']],
  ['mandá la foto del diseño atrás de todo', ['capa_elemento_imagen']],
  ['poné el logo del diseño más transparente', ['opacidad_elemento_imagen']],
  ['borrá la página 3 del diseño', ['borrar_pagina_imagen']],
];

function faltan(casos: Caso[], turno: (t: string) => { veredicto: { intencion: string }; nombres: string[] }): string[] {
  const out: string[] = [];
  for (const [texto, ops] of casos) {
    const r = turno(texto);
    if (!ops.some((o) => r.nombres.includes(o))) out.push(`«${texto}» → ${r.veredicto.intencion}: no trae ${ops.join(' | ')}`);
  }
  return out;
}

const tam = (id: string) => JSON.stringify(aToolDef(porId(id)!)).length;

// ── 1. Cada pedido llega a su operación, en la app y por WhatsApp, dentro del presupuesto ──────────────────────────

test('P1 video: cada pedido llega a su operación por la app', () => {
  assert.deepEqual(faltan(VIDEO, turnoApp), []);
});

test('P2 video: cada pedido llega a su operación por WhatsApp', () => {
  assert.deepEqual(faltan(VIDEO, turnoWhatsApp), []);
});

test('P3 imagen: cada pedido llega a su operación por la app', () => {
  assert.deepEqual(faltan(IMAGEN, turnoApp), []);
});

test('P4 imagen: cada pedido llega a su operación por WhatsApp', () => {
  assert.deepEqual(faltan(IMAGEN, turnoWhatsApp), []);
});

test('P5 lo que viaja del registro entra en el presupuesto de 12.000 (la app)', () => {
  for (const [texto] of [...VIDEO, ...IMAGEN]) {
    const r = turnoApp(texto);
    const usados = r.delRegistro.filter((n) => porId(n)).reduce((s, n) => s + tam(n), 0);
    // Las lecturas que dan los ids de lo que entró van en su margen aparte (lib/relevancia-app.ts, MARGEN_DE_LECTURAS).
    assert.ok(usados <= PRESUPUESTO_REGISTRO_CHARS + 3500, `«${texto}»: ${usados} caracteres`);
  }
});

test('P6 con la operación viaja la lectura que da sus refs (ver_proyecto_video / ver_diseno_imagen)', () => {
  const v = turnoApp('poné el fondo azul al video');
  assert.ok(v.nombres.includes('ver_proyecto_video') || v.nombres.includes('listar_proyectos_video'), v.nombres.join(', '));
  const i = turnoApp('girá el texto del diseño 15 grados');
  assert.ok(i.nombres.includes('ver_diseno_imagen') || i.nombres.includes('listar_disenos_imagen'), i.nombres.join(', '));
});

// ── 2. El espejo de la API: uno por operación del chat, cómo se confirma y por dónde sale ───────────────────────────

test('A1 el Image Editor: una acción por operación del chat (salvo cambiar_texto), al final, de pantalla, y las de IA cobran', () => {
  const ids = OPERACIONES_API_IMAGEN.map((o) => o.op);
  assert.ok(!ids.includes('cambiar_texto'), 'cambiar_texto ya es cambiar_textos_diseno_imagen');
  for (const o of OPERACIONES_API_IMAGEN) {
    const d = porId(o.id);
    assert.ok(d && d.tipo === 'accion', `${o.id} no está en el registro`);
    assert.equal(d!.area, 'imagen');
    assert.equal((d as { confirmacion?: string }).confirmacion, 'pantalla', `${o.id}: se acepta en el editor`);
    assert.equal((d as { pantalla?: string }).pantalla, '/image-editor');
    assert.equal(d!.gating?.rolMinimo, 'admin');
    assert.equal(d!.costo, o.dinero ? 'dinero' : 'gratis', o.id);
    assert.ok(enElEditorDeImagen(d as never), `${o.id} no corre en un flujo`);
    assert.match(FLUJO, /export const enElEditorDeImagen = \(d: AccionDef\): boolean => d\.pantalla === '\/image-editor';/);
    assert.match(FLUJO, /!NO_EN_FLUJOS\.has\(d\.id\) && !enElEditorDeVideo\(d\) && !enElEditorDeImagen\(d\)\)/, 'fuera de la lista de «⚡ Acción»');
    assert.match(FLUJO, /if \(enElEditorDeImagen\(def\)\) return \{ ok: false,/, 'y un paso viejo no la corre');
    assert.ok(RUTAS_REST.some(([, ruta, id]) => id === o.id && ruta.startsWith('/imagen/disenos/{disenoId}/propuestas/')), `${o.id} sin su ruta REST`);
    assert.ok(ESCRITURAS_IMAGEN.has(o.id), `${o.id} sin la receta del Image Editor`);
  }
  assert.deepEqual(OPERACIONES_API_IMAGEN.filter((o) => o.dinero).map((o) => o.id), ['crear_imagen_ia', 'editar_imagen_ia']);
  // Al final de su área: después de las que había (una nueva no le saca el lugar a las de antes).
  const run = leer('lib/api-mako/areas/imagen.run.ts');
  assert.ok(run.indexOf("estilo_texto_imagen: { ...enElEditor('estilo_texto_imagen') }") > run.indexOf('borrar_diseno_imagen: {'));
  for (const o of OPERACIONES_API_IMAGEN) assert.match(run, new RegExp(`^  ${o.id}: \\{ \\.\\.\\.enElEditor\\('${o.id}'\\) \\},$`, 'm'), `${o.id} sin su runner`);
});

test('A2 el Video Editor: las del 27/10 están en la API, sin correr en un flujo', () => {
  for (const id of ['duplicar_elemento_video', 'quitar_fondo_video', 'fondo_lienzo_video', 'formato_lienzo_video', 'agregar_medio_video']) {
    const d = porId(id);
    assert.ok(d && d.tipo === 'accion' && (d as { confirmacion?: string }).confirmacion === 'pantalla', id);
    assert.ok(enElEditorDeVideo(d as never), id);
  }
  assert.deepEqual(OPERACIONES_API.slice(-5).map((o) => o.op), ['duplicar', 'quitar_fondo', 'fondo_lienzo', 'formato_lienzo', 'agregar_medio'], 'al final del área');
});

// ── 3. De punta a punta, lo puro: API → forma del chat → revisión sobre la copia → aplicación ──────────────────────

const api = (id: string, input: Record<string, unknown>) => {
  const d = porId(id)!;
  const v = validarInput(d.parametros, input, 'json');
  assert.ok('input' in v, 'error' in v ? `${id}: ${v.error}` : id);
  return (v as { input: Record<string, unknown> }).input;
};

// Una línea de tiempo mínima: un video en la principal y un texto arriba (las formas del motor, sólo lo que lee la vista).
const TPS = 120_000;
const tracks = {
  overlay: [{ id: 'pt', type: 'text', name: 'T', muted: false, hidden: false, elements: [
    { id: 'tx', type: 'text', name: 'Título', startTime: 0, duration: 3 * TPS, trimStart: 0, trimEnd: 0, params: { content: 'Hola' } },
  ] }],
  main: { id: 'pv', type: 'video', name: 'V', muted: false, hidden: false, elements: [
    { id: 'vx', type: 'video', name: 'clip.mp4', mediaId: 'm-1', startTime: 0, duration: 10 * TPS, trimStart: 0, trimEnd: 0, params: {} },
  ] },
  audio: [],
} as unknown as SceneTracks;
const medios = [
  { id: 'm-1', name: 'clip.mp4', type: 'video', duration: 10, hasAudio: true },
  { id: 'm-2', name: 'producto.jpg', type: 'image' },
] as never;
const vistaVideo = (lienzo = { ancho: 1080, alto: 1920, fondo: '#000000', relacion: '9:16' }) =>
  vistaDeLinea({ tracks, tps: TPS, cabezal: 0, elegidos: [], lienzo, medios });

test('E1 video · fondo_lienzo: la API, la forma, el desenfoque de 1 a 4, la revisión contra el lienzo y lo que se aplica', () => {
  const o = OPERACIONES_API.find((x) => x.id === 'fondo_lienzo_video')!;
  const op = operacionDesdeInput(o, api('fondo_lienzo_video', { proyecto: 'p', color: '#1E3A8A' }));
  assert.deepEqual(op, { ok: true, op: { op: 'fondo_lienzo', color: '#1e3a8a' } });
  assert.ok(!validarVideo({ op: 'fondo_lienzo', color: '#1E3A8A', desenfoque: 2 }).ok, 'uno de los dos');
  assert.ok(!validarVideo({ op: 'fondo_lienzo', desenfoque: 5 }).ok, '1 a 4');
  assert.ok(!validarVideo({ op: 'fondo_lienzo', color: 'azul' }).ok, '#RRGGBB');
  const v = vistaVideo();
  assert.match(v.json, /"lienzo":\{"ancho":1080,"alto":1920,"fondo":"#000000","relacion":"9:16"\}/, 'la IA ve el fondo y la relación');
  const r = revisarOperaciones({ operaciones: [{ op: 'fondo_lienzo', color: '#1e3a8a' }, { op: 'fondo_lienzo', desenfoque: 2 }], vista: v, alcance: 'video' });
  assert.deepEqual(r.resueltas, [
    { op: 'lienzo', fondo: { type: 'color', color: '#1e3a8a' } },
    { op: 'lienzo', fondo: { type: 'blur', blurIntensity: NIVELES_DESENFOQUE_LIENZO[1] } },
  ]);
  assert.deepEqual(r.cambios.map((c) => [c.antes, c.despues]), [['#000000', '#1e3a8a'], ['#1e3a8a', 'desenfoque 2']]);
  // Lo que ya está así no es un cambio.
  assert.equal(revisarOperaciones({ operaciones: [{ op: 'fondo_lienzo', color: '#000000' }], vista: v, alcance: 'video' }).resueltas.length, 0);
  assert.equal(textoFondoLienzo({ type: 'blur', blurIntensity: 375 }), 'desenfoque 3');
  // Lo aplica el comando del panel Lienzo (UpdateProjectSettingsCommand) con el fondo pedido.
  const com = leer('app/video-editor/_opencut/chat/comandos.ts');
  assert.match(com, /case "lienzo":[\s\S]{0,700}if \(r\.fondo\) cambios\.background = r\.fondo;[\s\S]{0,400}new UpdateProjectSettingsCommand\(cambios\)/);
});

test('E2 video · formato_lienzo: la relación del motor, la revisión y el tamaño calculado al ejecutar', () => {
  const motor = leer('app/video-editor/_opencut/canvas/sizes.ts');
  const ids = [...motor.slice(motor.indexOf('export const RELACIONES')).matchAll(/\{ id: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...RELACIONES_LIENZO].sort(), [...new Set(ids)].sort(), 'las mismas «Relación» que el menú');
  assert.match(leer('app/video-editor/_opencut/components/editor/panels/properties/video/basico.tsx'), new RegExp(`NIVELES_DESENFOQUE = \\[${NIVELES_DESENFOQUE_LIENZO.join(', ')}\\]`));
  assert.ok(!validarVideo({ op: 'formato_lienzo', relacion: '7:5' }).ok);
  const r = revisarOperaciones({ operaciones: [{ op: 'formato_lienzo', relacion: '1:1' }], vista: vistaVideo(), alcance: 'video' });
  assert.deepEqual(r.resueltas, [{ op: 'lienzo', relacion: '1:1' }]);
  assert.deepEqual(r.cambios[0], { tipo: 'cambia', titulo: 'Relación del lienzo', antes: '9:16', despues: '1:1' });
  assert.equal(revisarOperaciones({ operaciones: [{ op: 'formato_lienzo', relacion: '9:16' }], vista: vistaVideo(), alcance: 'video' }).resueltas.length, 0, 'ya está así');
  assert.match(leer('app/video-editor/_opencut/chat/comandos.ts'), /canvasSize: tamanoDeRelacion\(\{ id: r\.relacion, settings \}\), canvasSizeMode: "preset", relacion: r\.relacion/);
});

test('E3 video · duplicar, quitar_fondo y agregar_medio: la forma, la revisión y el comando de su botón', () => {
  const v = vistaVideo();
  const ref = (titulo: string) => [...v.refs.values()].find((x) => x.titulo.includes(titulo))!.ref;
  const vid = ref('clip.mp4');
  const txt = ref('Hola');
  const m2 = [...v.medios.values()].find((m) => m.nombre === 'producto.jpg')!.ref;
  const r = revisarOperaciones({
    operaciones: [
      { op: 'duplicar', ref: txt },
      { op: 'quitar_fondo', ref: vid, activo: true },
      { op: 'quitar_fondo', ref: txt, activo: true },
      { op: 'agregar_medio', medio: m2, inicio: 10, ref: 'n1' },
      { op: 'transformar', ref: 'n1', cambios: { escala: 50 } },
    ],
    vista: v, alcance: 'video',
  });
  assert.deepEqual(r.resueltas.map((x) => x.op), ['duplicar', 'params', 'agregar_medio', 'params']);
  assert.deepEqual((r.resueltas[1] as { params: unknown }).params, { 'fondo.automatico': true });
  assert.deepEqual(r.resueltas[2], { op: 'agregar_medio', mediaId: 'm-2', tipo: 'imagen', nombre: 'producto.jpg', inicio: 10, duracion: 5, ref: 'n1' });
  assert.deepEqual(r.descartes, ['«Hola» no es un clip de video o imagen'], 'quitar el fondo es de un clip');
  assert.equal(r.cambios[0].titulo, 'Copia de «Hola»');
  // Un video no se estira más de lo que dura.
  const m1 = [...v.medios.values()].find((m) => m.nombre === 'clip.mp4')!.ref;
  const largo = revisarOperaciones({ operaciones: [{ op: 'agregar_medio', medio: m1, inicio: 0, duracion: 30 }], vista: v, alcance: 'video' });
  assert.match(largo.descartes[0], /dura 10 s/);
  const com = leer('app/video-editor/_opencut/chat/comandos.ts');
  assert.match(com, /case "duplicar":\s*\n\s*comandos\.push\(sobre\(r\.el, \(o\) => new DuplicateElementsCommand\(\{ elements: \[o\] \}\)\)\);/);
  assert.match(com, /case "agregar_medio": \{[\s\S]{0,300}buildElementFromMedia\(\{/);
  // La API: la ref nueva NOMBRA lo que agrega, y el medio se revisa contra la copia.
  assert.deepEqual(refsDeOperacion({ op: 'agregar_medio', medio: 'm2', inicio: 0, ref: 'n1' }), { usa: [], medios: ['m2'], define: ['n1'] });
  const copia = leerVista({ pistas: [{ elementos: [{ ref: 'v1', nombre: 'clip' }] }], medios: [{ ref: 'm1', nombre: 'clip' }] });
  const sinMedio = revisarContraCopia({ op: { op: 'agregar_medio', medio: 'm9', inicio: 0 }, vista: copia, previas: [] });
  assert.ok(!sinMedio.ok && /no está en Multimedia/.test(sinMedio.motivo));
  assert.deepEqual(filasDePropuesta([{ op: 'quitar_fondo', ref: 'v1', activo: true }], { pistas: [{ elementos: [{ ref: 'v1', nombre: 'clip', inicio: 0, fin: 10 }] }] })[0],
    { campo: 'Eliminar el fondo de un clip', antes: 'clip (v1, de 0:00 a 0:10)', despues: 'Sin fondo (sólo la persona)' });
});

// El Image Editor: un diseño de dos páginas con un texto, un rectángulo y una foto (las formas de Fabric que guarda Doory).
const DOC = {
  width: 1080, height: 1080,
  pages: [
    { id: 'pag-1', background: { type: 'solid', color: '#ffffff' }, objects: [
      { id: 'o-txt', type: 'textbox', text: 'Hola', left: 100, top: 100, width: 400, height: 60, fontSize: 48, fontFamily: '"Inter", sans-serif', fill: '#111111', scaleX: 1, scaleY: 1, angle: 0, opacity: 1 },
      { id: 'o-rect', type: 'rect', shapeKind: 'rect', left: 0, top: 900, width: 1080, height: 180, fill: '#ff0000', scaleX: 1, scaleY: 1, angle: 0, opacity: 1 },
      { id: 'o-img', type: 'image', src: 'https://x.supabase.co/storage/v1/object/public/image-editor/13/0b9e5f4c-1a2b-4c3d-8e9f-0a1b2c3d4e5f.png', left: 500, top: 200, width: 400, height: 400, scaleX: 1, scaleY: 1, angle: 0, opacity: 1 },
    ] },
    { id: 'pag-2', background: { type: 'solid', color: '#ffffff' }, objects: [] },
  ],
};
const refsImagen = () => {
  const v = vistaDeDiseno(DOC);
  const por = (id: string) => [...v.elementos.values()].find((e) => e.id === id)!.ref;
  const pag = (id: string) => [...v.paginas.entries()].find(([, p]) => p === id)![0];
  return { v, txt: por('o-txt'), rect: por('o-rect'), img: por('o-img'), p1: pag('pag-1'), p2: pag('pag-2') };
};

test('E4 imagen · cada operación de la API llega al catálogo del chat y se aplica sobre el diseño', () => {
  const { txt, rect, img, p2 } = refsImagen();
  const casos: Array<[string, Record<string, unknown>]> = [
    ['estilo_texto_imagen', { ref: txt, color: '#FFD400', negrita: true }],
    ['agregar_texto_imagen', { texto: 'Oferta', x: 80, y: 120, tamano: 64 }],
    ['mover_elemento_imagen', { ref: rect, y: 800 }],
    ['tamano_elemento_imagen', { ref: img, escala: 200 }],
    ['rotar_elemento_imagen', { ref: txt, grados: 15 }],
    ['opacidad_elemento_imagen', { ref: img, opacidad: 50 }],
    ['color_elemento_imagen', { ref: rect, color: '#00AA00' }],
    ['borde_elemento_imagen', { ref: rect, color: '#000000', grosor: 4 }],
    ['borrar_elementos_imagen', { refs: [rect] }],
    ['duplicar_elemento_imagen', { ref: txt }],
    ['capa_elemento_imagen', { ref: img, a: 'atras' }],
    ['alinear_elementos_imagen', { refs: [txt], a: 'centro' }],
    ['bloquear_elemento_imagen', { ref: img, bloqueado: true }],
    ['fondo_pagina_imagen', { color: '#000000' }],
    ['agregar_pagina_imagen', { despues_de: p2, duplicar: true }],
    ['borrar_pagina_imagen', { pagina: p2 }],
    ['agregar_forma_imagen', { forma: 'circulo', x: 10, y: 10, ancho: 100, alto: 100, color: '#FF0000' }],
    ['voltear_elemento_imagen', { ref: img, horizontal: true }],
    ['ocultar_elemento_imagen', { ref: rect, oculto: true }],
  ];
  const vg = vistaGuardada(DOC);
  for (const [id, campos] of casos) {
    const o = operacionApiImagenPorId(id)!;
    const op = operacionDesdeInputImagen(o, api(id, { disenoId: '0b9e5f4c-1a2b-4c3d-8e9f-0a1b2c3d4e5f', ...campos }));
    assert.ok(op.ok, `${id}: ${!op.ok ? op.motivo : ''}`);
    const r = aplicarOperaciones({ doc: DOC, operaciones: [(op as { op: never }).op], vista: vg.refs, nuevoId: () => 'nuevo', activePageId: vg.paginaId });
    assert.equal(r.aplicadas, 1, `${id} no cambió nada: ${r.descartes.join(' · ')}`);
    assert.ok(r.cambios.length >= 1, `${id} sin su fila «Original | Modificado»`);
  }
  assert.equal(casos.length + 3, OPERACIONES_API_IMAGEN.length + 1, 'todas las del espejo (las dos de IA van aparte, E6)');
});

test('E5 imagen · voltear y ocultar: el estado en la vista, la revisión y lo que ya está así', () => {
  const { img, rect } = refsImagen();
  const vg = vistaGuardada(DOC);
  const r = aplicarOperaciones({ doc: DOC, operaciones: [{ op: 'voltear', ref: img, horizontal: true }, { op: 'ocultar', ref: rect, oculto: true }], vista: vg.refs, nuevoId: () => 'n' });
  const objs = (r.doc as { pages: Array<{ objects: Array<Record<string, unknown>> }> }).pages[0].objects;
  assert.equal(objs.find((o) => o.id === 'o-img')!.flipX, true);
  assert.equal(objs.find((o) => o.id === 'o-rect')!.visible, false);
  assert.deepEqual(r.cambios.map((c) => c.despues), ['volteado de lado', 'oculto']);
  const despues = vistaDeDiseno(r.doc);
  assert.match(despues.json, /"volteado":\{"horizontal":true\}/);
  assert.match(despues.json, /"oculto":true/);
  const otra = aplicarOperaciones({ doc: r.doc, operaciones: [{ op: 'voltear', ref: img, horizontal: true }], vista: vg.refs, nuevoId: () => 'n' });
  assert.equal(otra.aplicadas, 0, 'ya está volteado');
  assert.ok(!validarImagen({ op: 'voltear', ref: img }).ok, 'sin sentido');
  assert.ok(!validarImagen({ op: 'ocultar', ref: img, oculto: 'si' }).ok);
});

test('E6 imagen · la propuesta de la API: se prueba contra el diseño guardado, rechaza lo que no cambia y la IA se cobra al aceptar', () => {
  const { txt, img, rect } = refsImagen();
  const ok = revisarContraDiseno({ op: { op: 'color', ref: rect, color: '#00aa00' }, doc: DOC, previas: [] });
  assert.ok(ok.ok);
  assert.deepEqual((ok as { filas: unknown[] }).filas[0], { campo: 'Color de forma', antes: '#ff0000', despues: '#00aa00' });
  const igual = revisarContraDiseno({ op: { op: 'color', ref: rect, color: '#ff0000' }, doc: DOC, previas: [] });
  assert.ok(!igual.ok, 'ya es de ese color');
  const noEsta = revisarContraDiseno({ op: { op: 'mover', ref: 'tzz', x: 1 }, doc: DOC, previas: [] });
  assert.ok(!noEsta.ok && /no está en el diseño/.test(noEsta.motivo));
  // Una ref nueva de la MISMA propuesta vale; dos iguales, no.
  const previas = [{ op: 'agregar_texto' as const, texto: 'Oferta', estilo: {}, ref: 'n1' }];
  assert.ok(revisarContraDiseno({ op: { op: 'estilo_texto', ref: 'n1', estilo: { negrita: true } }, doc: DOC, previas }).ok);
  assert.ok(!revisarContraDiseno({ op: { op: 'agregar_forma', forma: 'rectangulo', x: 0, y: 0, ancho: 10, alto: 10, ref: 'n1' }, doc: DOC, previas }).ok);
  // La IA: no se aplica al proponer, se revisa su destino y la fila dice que se cobra al aceptar.
  const ia = revisarContraDiseno({ op: { op: 'editar_imagen', ref: img, prompt: 'el fondo por una playa' }, doc: DOC, previas: [] });
  assert.ok(ia.ok);
  assert.match((ia as { filas: Array<{ despues: string }> }).filas[0].despues, /se cobra en la cuenta del negocio/);
  const noEsImagen = revisarContraDiseno({ op: { op: 'editar_imagen', ref: txt, prompt: 'una playa de fondo' }, doc: DOC, previas: [] });
  assert.ok(!noEsImagen.ok, 'editar con IA es de una imagen');
  // El tope de imágenes con IA por propuesta (cada una se cobra).
  const dos = [{ op: 'crear_imagen' as const, prompt: 'un perro' }, { op: 'crear_imagen' as const, prompt: 'un gato' }];
  assert.ok(!revisarContraDiseno({ op: { op: 'crear_imagen', prompt: 'un loro' }, doc: DOC, previas: dos }).ok);
  // Guardada, la imagen con IA sigue SIN generar (sólo en una propuesta de la API); en una del chat, no.
  assert.equal(validarOperacionesDePropuesta(dos, { iaPendiente: true }).operaciones.length, 2);
  assert.equal(validarOperacionesDePropuesta(dos).operaciones.length, 0);
  // Las refs que se guardan son las que usa.
  assert.deepEqual(refsUsadas([{ op: 'color', ref: rect, color: '#000000' }], vistaGuardada(DOC)).refs, [[rect, 'o-rect']]);
  assert.equal(probarPropuesta(DOC, [{ op: 'crear_imagen', prompt: 'un perro' }], vistaGuardada(DOC)).aplicadas, 1);
});

// ── 4. «Discutir | Editar» en el chat del Video Editor (27/10/2026, como el Image Editor) ────────────────────────────

test('D1 video · «Discutir» contesta en texto y NUNCA devuelve operaciones, con su prompt propio', async () => {
  const { salidaDeDiscutir } = await import('../lib/editor-video/chat-catalogo');
  const conOps = salidaDeDiscutir('{"resumen":"Acorta el gancho a 3 s.","operaciones":[{"op":"borrar","refs":["v1"]}]}');
  assert.deepEqual(conOps, { resumen: 'Acorta el gancho a 3 s.', operaciones: [], descartes: [] });
  assert.equal(salidaDeDiscutir('```text\nEl ritmo está bien.\n```').resumen, 'El ritmo está bien.');
  const ia = leer('lib/editor-video/ia.ts');
  assert.match(ia, /if \(p\.intencion === 'discutir'\) \{[\s\S]{0,400}renderPrompt\(PROMPTS_CHAT_VIDEO\.discutir\.key, CHAT_VIDEO_DISCUTIR_TEMPLATE/);
  assert.match(ia, /const d = salidaDeDiscutir\(salidaD\);/);
  assert.match(leer('app/api/video-editor/ia/route.ts'), /editarVideo\(\{ instruccion: body\.instruccion, linea: body\.linea, alcance: body\.alcance, intencion: body\.intencion \}\)/);
  assert.match(leer('lib/prompt-registry.ts'), /key: 'video_editor\.chat\.discutir'/);
});

test('L1 el link de la propuesta del Image Editor lo escribe el código (como el del video), y se retira si MaKo pregunta', async () => {
  const { linksDeUnaAccion, aRetirar } = await import('../lib/mako-turno-app-reglas');
  const id = '0b9e5f4c-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
  const out = JSON.stringify({ id, url: `/image-editor/d1?propuesta=${id}`, nueva: true });
  const [l] = linksDeUnaAccion('voltear_elemento_imagen', {}, out);
  assert.equal(l?.clase, 'editor');
  assert.deepEqual(aRetirar(l), { clase: 'editor', id });
  assert.match(leer('lib/mako-turno-app.ts'), /await resolverPropuestaImagen\(\{ ws, id: r\.id, estado: 'descartada'/);
});
