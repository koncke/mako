// =============================================================================
// editor-video/chat-api — las operaciones del chat «Editar con IA», como acciones de la API de MaKo
// =============================================================================
// Etapa 3 del diseño AI-native (docs/diseno-mako-ai-native.md): «las 32 operaciones del chat de Video Editor pasan a la
// API» (hoy son 34). Regla de Martín para el chat, que vale igual acá: «Debería aceptar cualquier pedido del usuario.
// Por eso es importante documentar las cosas de la API».
//
// UNA operación de la API por operación del chat, generadas de su catálogo (./chat-catalogo.ts): la descripción es el
// `para` que ya lee la IA del chat, y la forma la vuelve a validar `validarOperacion`, la MISMA que valida al chat. Lo
// que cambia entre los dos es sólo la entrada: la API declara cada campo (`validarInput` deja pasar SÓLO lo declarado),
// y algunas formas se aplanan para poder declararse (los «textos» y «clips» de una plantilla van como listas; «no»
// saca un color de un estilo). `operacionDesdeInput` lo devuelve a la forma del chat.
//
// ⚠️ NINGUNA EJECUTA. El proyecto vive en el navegador de quien lo edita (decisión 5 de docs/diseno-editor-video.md):
//    cada una PROPONE (`confirmacion: 'pantalla'`) y se suma a la propuesta abierta de ese proyecto; una persona la
//    mira y la acepta en el editor, con el mismo «Aceptar» del chat (que la revisa contra la línea de tiempo de ese
//    momento). Lo hace lib/api-mako/areas/video.run.ts con lib/editor-video/propuestas-server.ts.
//
// Puro y sin `server-only`: lo leen las definiciones (video.def.ts), el runner y los tests.
// =============================================================================

import type { Parametro } from '../api-mako/tipos';
import {
  AJUSTES_COLOR, MEZCLAS, OBJETIVOS_NORMALIZAR, OPERACIONES_CHAT, TOPES_CHAT, validarOperacion,
  type IdOperacion, type OperacionChat,
} from './chat-catalogo';
import { PLANTILLAS } from './plantillas';

/** Una operación del chat, como acción de la API. */
export type OperacionApi = { op: IdOperacion; id: string; titulo: string; parametros: readonly Parametro[] };

// ── Los parámetros que se repiten ────────────────────────────────────────────

export const PARAM_PROYECTO: Parametro = {
  nombre: 'proyecto', rotulo: 'Proyecto', tipo: 'string', obligatorio: true, max: 200,
  descripcion: 'El proyecto: su nombre como se ve en el editor, o su id (de listar_proyectos_video). Si no se encuentra, la respuesta lista los proyectos.',
};
const REF: Parametro = {
  nombre: 'ref', rotulo: 'Elemento', tipo: 'string', obligatorio: true, max: 6,
  descripcion: 'La ref del elemento en la línea de tiempo (v1, i2, t3, a4…), de ver_proyecto_video; o una nueva («n1») que otra operación de la MISMA propuesta agregó.',
};
const REF_NUEVA: Parametro = {
  nombre: 'ref', rotulo: 'Ref nueva', tipo: 'string', max: 6,
  descripcion: 'Opcional: una ref nueva («n1», «n2»…) para que otra operación de la misma propuesta la cambie.',
};
const seg = (nombre: string, rotulo: string, descripcion: string, obligatorio = true, minimo = 0, maximo: number = TOPES_CHAT.tiempoMax): Parametro =>
  ({ nombre, rotulo, tipo: 'number', ...(obligatorio ? { obligatorio: true } : {}), minimo, maximo, descripcion });
const si = (nombre: string, rotulo: string, descripcion: string, obligatorio = true): Parametro =>
  ({ nombre, rotulo, tipo: 'boolean', ...(obligatorio ? { obligatorio: true } : {}), descripcion });
const texto = (nombre: string, rotulo: string, descripcion: string, obligatorio = true, max: number = TOPES_CHAT.texto): Parametro =>
  ({ nombre, rotulo, tipo: 'string', ...(obligatorio ? { obligatorio: true } : {}), max, descripcion });
const elegir = (nombre: string, rotulo: string, opciones: readonly string[], descripcion: string, obligatorio = true): Parametro =>
  ({ nombre, rotulo, tipo: 'string', ...(obligatorio ? { obligatorio: true } : {}), enum: opciones, descripcion });
const ID_CATALOGO = (de: string, conNinguno: boolean): Parametro => texto(
  'id', 'Nombre',
  `El id de DISPONIBLES.${de} de ver_proyecto_video (copia el id exacto)${conNinguno ? '; «ninguno» lo saca' : ''}.`,
  true, 48,
);
/** Un color #RRGGBB, o «no» para sacarlo (los que se pueden sacar). */
const COLOR = (nombre: string, rotulo: string, sacable: boolean): Parametro =>
  texto(nombre, rotulo, sacable ? 'Un color #RRGGBB, o «no» para sacarlo.' : 'Un color #RRGGBB.', false, 7);

const DUR_EFECTO = seg('duracion', 'Duración', 'Opcional: en segundos.', false, TOPES_CHAT.efectoMin, TOPES_CHAT.duracionMax);

// ── La tabla: una fila por operación del chat ────────────────────────────────

export const OPERACIONES_API: readonly OperacionApi[] = [
  { op: 'agregar_texto', id: 'agregar_texto_video', titulo: 'Agregar un texto al video', parametros: [
    texto('texto', 'Texto', `Lo que dice, hasta ${TOPES_CHAT.texto} caracteres.`),
    seg('inicio', 'Inicio', 'En qué segundo aparece.'),
    seg('duracion', 'Duración', 'Cuántos segundos dura.', true, TOPES_CHAT.duracionMin, TOPES_CHAT.duracionMax),
    REF_NUEVA,
  ] },
  { op: 'cambiar_texto', id: 'cambiar_texto_video', titulo: 'Cambiar un texto del video', parametros: [REF, texto('texto', 'Texto', 'El texto nuevo.')] },
  { op: 'reemplazar_clip', id: 'reemplazar_clip_video', titulo: 'Reemplazar el archivo de un clip', parametros: [
    REF, texto('medio', 'Medio', 'La ref del medio de Multimedia («m1», «m2»…), de "medios" en ver_proyecto_video.', true, 6),
  ] },
  { op: 'borrar', id: 'borrar_elementos_video', titulo: 'Borrar elementos del video', parametros: [
    { nombre: 'refs', rotulo: 'Elementos', tipo: 'string[]', obligatorio: true, max: 200, descripcion: 'Las refs de lo que se borra (v1, t2…).' },
  ] },
  { op: 'mover', id: 'mover_elemento_video', titulo: 'Mover un elemento en el tiempo', parametros: [REF, seg('inicio', 'Inicio', 'El segundo donde empieza ahora.')] },
  { op: 'duracion', id: 'cambiar_duracion_video', titulo: 'Cambiar la duración de un elemento', parametros: [
    REF, seg('duracion', 'Duración', 'Cuántos segundos dura.', true, TOPES_CHAT.duracionMin, TOPES_CHAT.duracionMax),
  ] },
  { op: 'dividir', id: 'dividir_clip_video', titulo: 'Dividir un clip', parametros: [REF, seg('en', 'En', 'El segundo de la línea de tiempo donde se corta.')] },
  { op: 'recortar', id: 'recortar_clip_video', titulo: 'Recortar un clip', parametros: [
    REF, seg('inicio', 'Inicio', 'Opcional: el segundo donde empieza ahora.', false), seg('fin', 'Fin', 'Opcional: el segundo donde termina ahora.', false),
  ] },
  { op: 'volumen', id: 'cambiar_volumen_video', titulo: 'Cambiar el volumen', parametros: [
    REF, seg('db', 'Volumen', `En dB, de ${TOPES_CHAT.volumenMinDb} a ${TOPES_CHAT.volumenMaxDb} (0 es el original).`, true, TOPES_CHAT.volumenMinDb, TOPES_CHAT.volumenMaxDb),
  ] },
  { op: 'silenciar', id: 'silenciar_clip_video', titulo: 'Silenciar un clip', parametros: [REF, si('silenciado', 'Silenciado', 'true silencia; false le devuelve el sonido.')] },
  { op: 'fundido', id: 'poner_fundido_video', titulo: 'Poner un fundido de sonido', parametros: [
    REF, seg('entrada', 'Entrada', 'Opcional: segundos del fundido al empezar.', false, 0, TOPES_CHAT.duracionMax),
    seg('salida', 'Salida', 'Opcional: segundos del fundido al terminar.', false, 0, TOPES_CHAT.duracionMax),
  ] },
  { op: 'reducir_ruido', id: 'reducir_ruido_video', titulo: 'Reducir el ruido', parametros: [REF, si('activo', 'Activo', 'true lo prende; false lo apaga.')] },
  { op: 'normalizar', id: 'normalizar_audio_video', titulo: 'Normalizar la intensidad', parametros: [
    REF, si('activo', 'Activo', 'true lo prende; false lo apaga.'),
    elegir('objetivo', 'Objetivo', Object.keys(OBJETIVOS_NORMALIZAR), 'Opcional: la intensidad objetivo.', false),
  ] },
  { op: 'separar_audio', id: 'separar_audio_video', titulo: 'Extraer el audio de un clip', parametros: [REF, si('separado', 'Separado', 'true lo separa en su pista; false lo vuelve a unir.')] },
  { op: 'ocultar', id: 'ocultar_elemento_video', titulo: 'Ocultar un elemento', parametros: [REF, si('oculto', 'Oculto', 'true lo oculta; false lo vuelve a mostrar.')] },
  { op: 'velocidad', id: 'cambiar_velocidad_video', titulo: 'Cambiar la velocidad', parametros: [
    REF, seg('x', 'Velocidad', `Opcional: veces la original, de ${TOPES_CHAT.velocidadMin} a ${TOPES_CHAT.velocidadMax} (2 = el doble de rápido). Va «x» o «curva».`, false, TOPES_CHAT.velocidadMin, TOPES_CHAT.velocidadMax),
    texto('curva', 'Curva', 'Opcional: el id de DISPONIBLES.curvas_velocidad; «ninguna» la saca. Va «x» o «curva».', false, 48),
    si('cambiar_tono', 'Cambiar el tono', 'Opcional: true cambia el tono con la velocidad.', false),
  ] },
  { op: 'transicion', id: 'poner_transicion_video', titulo: 'Poner una transición', parametros: [REF, ID_CATALOGO('transiciones', true), DUR_EFECTO] },
  { op: 'animacion', id: 'poner_animacion_video', titulo: 'Poner una animación', parametros: [
    REF, elegir('tipo', 'Tipo', ['entrada', 'salida', 'combinado', 'bucle'], 'Cuándo anima.'), ID_CATALOGO('animaciones.<tipo>', true), DUR_EFECTO,
  ] },
  { op: 'filtro', id: 'poner_filtro_video', titulo: 'Poner un filtro', parametros: [
    REF, ID_CATALOGO('filtros', true), seg('intensidad', 'Intensidad', 'Opcional: de 0 a 100.', false, 0, 100),
  ] },
  { op: 'efecto', id: 'poner_efecto_video', titulo: 'Poner un efecto', parametros: [
    REF, ID_CATALOGO('efectos', false), si('quitar', 'Quitar', 'Opcional: true saca ese efecto.', false),
  ] },
  { op: 'capa_efecto', id: 'agregar_capa_efecto_video', titulo: 'Agregar una capa de efecto', parametros: [
    elegir('tipo', 'Tipo', ['filtro', 'efecto'], 'Un filtro o un efecto, sobre todo lo de abajo.'),
    texto('id', 'Nombre', 'El id de DISPONIBLES.filtros o DISPONIBLES.efectos de ver_proyecto_video.', true, 48),
    seg('inicio', 'Inicio', 'En qué segundo empieza.'),
    seg('duracion', 'Duración', 'Cuántos segundos dura.', true, TOPES_CHAT.duracionMin, TOPES_CHAT.tiempoMax),
    REF_NUEVA,
  ] },
  { op: 'ajustar_color', id: 'ajustar_color_video', titulo: 'Ajustar el color de un clip', parametros: [
    REF,
    ...Object.entries(AJUSTES_COLOR).map(([nombre, r]) => seg(nombre, nombre[0].toUpperCase() + nombre.slice(1), `Opcional: de ${r.min} a ${r.max}.`, false, r.min, r.max)),
  ] },
  { op: 'estilo_texto', id: 'cambiar_estilo_texto_video', titulo: 'Cambiar el estilo de un texto', parametros: [
    REF,
    texto('fuente', 'Fuente', 'Opcional: el nombre de una fuente (DISPONIBLES.fuentes_sugeridas, o cualquiera de Google Fonts).', false, 60),
    seg('tamano', 'Tamaño', `Opcional: de ${TOPES_CHAT.tamanoMin} a ${TOPES_CHAT.tamanoMax}.`, false, TOPES_CHAT.tamanoMin, TOPES_CHAT.tamanoMax),
    COLOR('color', 'Color', false),
    si('negrita', 'Negrita', 'Opcional.', false), si('cursiva', 'Cursiva', 'Opcional.', false), si('subrayado', 'Subrayado', 'Opcional.', false),
    elegir('mayusculas', 'Mayúsculas', ['ninguno', 'mayusculas', 'minusculas', 'titulo'], 'Opcional.', false),
    elegir('alineacion', 'Alineación', ['izquierda', 'centro', 'derecha'], 'Opcional.', false),
    seg('espaciado', 'Espaciado', `Opcional: de ${TOPES_CHAT.espaciadoMin} a ${TOPES_CHAT.espaciadoMax}.`, false, TOPES_CHAT.espaciadoMin, TOPES_CHAT.espaciadoMax),
    seg('interlineado', 'Interlineado', `Opcional: de ${TOPES_CHAT.interlineadoMin} a ${TOPES_CHAT.interlineadoMax}.`, false, TOPES_CHAT.interlineadoMin, TOPES_CHAT.interlineadoMax),
    COLOR('trazo', 'Trazo', true), seg('grosor_trazo', 'Grosor del trazo', 'Opcional: de 0 a 100.', false, 0, 100),
    texto('sombra', 'Sombra', 'Opcional: un color #RRGGBB, «si» con la de siempre o «no» para sacarla.', false, 7),
    COLOR('fondo', 'Fondo', true), seg('opacidad_fondo', 'Opacidad del fondo', 'Opcional: de 0 a 100.', false, 0, 100),
    COLOR('resplandor', 'Resplandor', true),
  ] },
  { op: 'transformar', id: 'transformar_elemento_video', titulo: 'Mover o escalar en el cuadro', parametros: [
    REF,
    seg('x', 'X', 'Opcional: píxeles desde el centro del lienzo (a la derecha, positivo).', false, -TOPES_CHAT.posicionMax, TOPES_CHAT.posicionMax),
    seg('y', 'Y', 'Opcional: píxeles desde el centro del lienzo (hacia ARRIBA, positivo).', false, -TOPES_CHAT.posicionMax, TOPES_CHAT.posicionMax),
    seg('escala', 'Escala', `Opcional: en %, de ${TOPES_CHAT.escalaMin} a ${TOPES_CHAT.escalaMax}.`, false, TOPES_CHAT.escalaMin, TOPES_CHAT.escalaMax),
    seg('rotacion', 'Rotación', 'Opcional: en grados, de -360 a 360.', false, -360, 360),
    seg('opacidad', 'Opacidad', 'Opcional: de 0 a 100.', false, 0, 100),
    elegir('mezcla', 'Mezcla', Object.keys(MEZCLAS), 'Opcional: el modo de mezcla.', false),
  ] },
  { op: 'reflejar', id: 'reflejar_clip_video', titulo: 'Reflejar un clip', parametros: [
    REF, si('horizontal', 'Horizontal', 'Opcional: true lo da vuelta de lado.', false), si('vertical', 'Vertical', 'Opcional: true lo da vuelta de arriba abajo.', false),
  ] },
  { op: 'revertir', id: 'revertir_clip_video', titulo: 'Reproducir un clip al revés', parametros: [REF, si('revertido', 'Revertido', 'true lo pasa al revés; false lo devuelve.')] },
  { op: 'congelar', id: 'congelar_cuadro_video', titulo: 'Congelar un cuadro', parametros: [REF, seg('en', 'En', 'El segundo de la línea de tiempo que se congela.')] },
  { op: 'reemplazar_en_subtitulos', id: 'reemplazar_en_subtitulos_video', titulo: 'Reemplazar palabras en los subtítulos', parametros: [
    texto('buscar', 'Buscar', 'Lo que se busca en todos los subtítulos.'),
    texto('reemplazo', 'Reemplazo', 'Opcional: lo que va en su lugar (vacío lo saca).', false),
  ] },
  { op: 'resaltar_palabras', id: 'resaltar_palabras_video', titulo: 'Resaltar la palabra que se dice', parametros: [
    elegir('modo', 'Modo', ['palabra', 'frase', 'ninguno'], 'Cómo se resalta mientras se dice; «ninguno» lo saca.'),
    COLOR('color', 'Color', false),
    seg('opacidad_no_dichas', 'Opacidad de lo no dicho', 'Opcional: de 0 a 100.', false, 0, 100),
  ] },
  { op: 'generar_subtitulos', id: 'generar_subtitulos_video', titulo: 'Generar los subtítulos', parametros: [] },
  { op: 'cortar_frase', id: 'cortar_frase_video', titulo: 'Cortar una frase dicha', parametros: [
    texto('frase', 'Frase', 'Las palabras exactas, como están en los subtítulos.'),
    { nombre: 'vez', rotulo: 'Vez', tipo: 'number', entero: true, minimo: 1, maximo: 1000, descripcion: 'Opcional: cuál de las veces que se dice (1 = la primera).' },
  ] },
  { op: 'cortar_tramo', id: 'cortar_tramo_video', titulo: 'Cortar un tramo del video', parametros: [
    seg('inicio', 'Inicio', 'El segundo donde empieza lo que se saca.'), seg('fin', 'Fin', 'El segundo donde termina lo que se saca.'),
  ] },
  { op: 'eliminar_muletillas', id: 'eliminar_muletillas_video', titulo: 'Eliminar las muletillas', parametros: [] },
  { op: 'usar_plantilla', id: 'usar_plantilla_video', titulo: 'Armar una plantilla de anuncio', parametros: [
    elegir('id', 'Plantilla', PLANTILLAS.map((p) => p.id), 'La plantilla (listar_plantillas_video).'),
    { nombre: 'textos', rotulo: 'Textos', tipo: 'object[]', max: 20, descripcion: 'Opcional: lo que dicta la persona para cada hueco de texto.', campos: [
      texto('hueco', 'Hueco', 'El nombre del hueco de texto.', true, 40), texto('texto', 'Texto', 'Lo que dice, hasta el máximo del hueco.'),
    ] },
    { nombre: 'clips', rotulo: 'Clips', tipo: 'object[]', max: 20, descripcion: 'Opcional: el medio de Multimedia para cada hueco de clip.', campos: [
      texto('hueco', 'Hueco', 'El nombre del hueco de clip.', true, 40), texto('medio', 'Medio', 'La ref del medio («m1», «m2»…).', true, 6),
    ] },
  ] },
];

/** Lo de la API que acompaña al `para` del chat. */
const PREFIJO =
  'PROPONE en un proyecto del Video Editor; NO lo aplica: el proyecto vive en el navegador de quien lo edita y se acepta en el editor, como un cambio de su chat «Editar con IA» (devuelve el link). Las refs, los medios y los nombres válidos salen de ver_proyecto_video, y lo que se propone en el mismo canal se junta en UNA propuesta. ';

/** El `para` del chat, dicho para la API (la plantilla va con listas en vez de objetos). */
export function descripcionApi(o: OperacionApi): string {
  const para = OPERACIONES_CHAT.find((x) => x.op === o.op)?.para ?? '';
  if (o.op === 'usar_plantilla') {
    return `${PREFIJO}Arma una PLANTILLA de anuncio vertical, como «Utilizar plantilla»: pasa el lienzo a 9:16 y pone sus clips, textos, animaciones y transiciones. SÓLO con la línea de tiempo VACÍA, y sola en la propuesta. "textos": [{hueco, texto}] con lo que DICTA la persona (lo que no se llena queda con el texto de ejemplo); "clips": [{hueco, medio}] con la ref de un medio de "medios" (un video tiene que durar al menos los segundos del hueco; una foto sirve siempre). Las plantillas y sus huecos, en listar_plantillas_video.`;
  }
  return `${PREFIJO}${para}`;
}

export const operacionApiPorId = (id: string): OperacionApi | undefined => OPERACIONES_API.find((o) => o.id === id);

/** «no» / «si» de un estilo, a la forma del chat (false / true). */
const sacable = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  const t = v.trim().toLowerCase();
  return t === 'no' || t === 'ninguno' || t === 'ninguna' ? false : v;
};

/**
 * La entrada de la API (ya pasada por `validarInput`) devuelta a la forma del chat y validada con la MISMA función que
 * el chat. El motivo de un rechazo lo lee el modelo (que se corrige solo) y la persona.
 */
export function operacionDesdeInput(o: OperacionApi, input: Record<string, unknown>): { ok: true; op: OperacionChat } | { ok: false; motivo: string } {
  const { proyecto: _proyecto, ...campos } = input;
  const raw: Record<string, unknown> = { op: o.op, ...campos };
  if (o.op === 'usar_plantilla') {
    const lista = (x: unknown) => (Array.isArray(x) ? (x as Array<Record<string, unknown>>) : []);
    raw.textos = Object.fromEntries(lista(campos.textos).map((t) => [String(t.hueco ?? ''), t.texto]));
    raw.clips = Object.fromEntries(lista(campos.clips).map((c) => [String(c.hueco ?? ''), c.medio]));
  }
  if (o.op === 'estilo_texto') {
    for (const k of ['trazo', 'fondo', 'resplandor'] as const) if (k in raw) raw[k] = sacable(raw[k]);
    if (typeof raw.sombra === 'string') {
      const t = raw.sombra.trim().toLowerCase();
      raw.sombra = t === 'si' || t === 'sí' ? true : sacable(raw.sombra);
    }
  }
  if (o.op === 'reemplazar_en_subtitulos' && raw.reemplazo === undefined) raw.reemplazo = '';
  const v = validarOperacion(raw);
  return v.ok ? { ok: true, op: v.op } : { ok: false, motivo: v.motivo };
}
