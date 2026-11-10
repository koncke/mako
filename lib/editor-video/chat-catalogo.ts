// =============================================================================
// editor-video/chat-catalogo — lo que el chat del Video Editor PUEDE pedir
// =============================================================================
// Pedido de Martín (15/10/2026, por «Estrategia 3 cuentas»): «es importante que video
// editor tenga, como landing, un chat al costado donde pueda ir editando todo con
// prompt». El modelo es el del Landing Generator (app/web-generator/editor/paneles/
// PanelAgente.tsx): la IA PROPONE, la persona mira «Original | Modificado» y acepta o
// descarta entero.
//
// Lo que cambia respecto del Landing es el transporte, no el comportamiento: una
// landing es texto y la IA la devuelve entera; la línea de tiempo son ticks, ids y
// parámetros, y devolverla entera la rompe. Así que la IA devuelve OPERACIONES de esta
// lista cerrada, y el editor las aplica con los comandos del propio motor
// (app/video-editor/_opencut/chat/comandos.ts), en un solo paso de deshacer.
//
// Una lista, un lugar: de acá salen el texto que lee la IA (`catalogoParaPrompt`) y la
// validación de lo que vuelve (`validarOperaciones`), en el server y en el editor.
// «Debería aceptar cualquier pedido del usuario. Por eso es importante documentar las
// cosas de la API» (Martín, 15/10): el `para` de cada operación es lo ÚNICO que el
// modelo sabe de ella, así que dice qué hace, sus unidades, rangos y valores válidos.
// Lo que no está acá, el modelo lo tiene que DECIR (operaciones vacías), nunca simular.
//
// Esta validación mira la FORMA. Los NOMBRES de transiciones, animaciones, filtros,
// efectos, curvas y fuentes viven en el motor, que este módulo no puede importar: los
// manda el editor dentro de la línea de tiempo («disponibles») y los valida
// `revisarOperaciones` (app/video-editor/_opencut/chat/linea.ts) con su motivo.
//
// SIN `server-only` y sin importar nada del motor (`_opencut/`): lo importan la ruta (un
// módulo del server no puede importar un valor del motor:
// tests/video-editor-integracion.test.ts) y el editor. Puro, con test
// (tests/video-editor-chat.test.ts). Las tablas que copian una clave o un rango del
// motor (ajustes de color, intensidad objetivo, modos de mezcla, topes) las fija el test
// contra el motor.
//
// ⚠️ Nada de esta lista cuesta plata (Avatar de IA y Texto a voz no están). Una
// operación que cobre entra con su confirmación de pantalla aparte, nunca acá.
//
// Las plantillas de anuncio (tanda 4 del plan docs/editor-video/plan-plantillas-anuncio.md):
// el `para` de usar_plantilla se arma desde el catálogo (./plantillas.ts, puro) con los ids,
// la duración, los huecos y sus topes: una plantilla nueva entra sola al prompt. Van en el
// orden de la pestaña, con las sugeridas para el negocio primero y marcadas
// (`catalogoParaPrompt(senales)`; las señales las lee ./ia.ts en el server).
//
// Los motion graphics (lib/motion; traídos el 10/11/2026 de rescate/motion-imagen-2610): agregar_motion y editar_motion.
// Su validación es la del motor (`normalizarMotion` estricto, lib/motion/plantillas.ts), envuelta en
// `valoresMotionValidos`: un campo que no es de la plantilla o un texto más largo que su tope se RECHAZA con su motivo,
// nunca se recorta. Al AGREGAR desde el chat o la API no quedan los textos de ejemplo de la plantilla («Ana Pérez»,
// «+1250», cinco estrellas): no son de la persona (`valoresAlAgregar`); la biblioteca sí los pone, porque ahí la persona
// los edita a mano en el panel.
// =============================================================================

import { PLANTILLAS, huecosDe, plantillaPorId, plantillasEnOrden, validarValores, type Plantilla } from './plantillas';
import type { SenalesNegocio } from '../plantillas-sugeridas';
import {
  PLANTILLAS as DEF_MOTION, ROTULO_TONO, camposDe, catalogoMotionParaPrompt, esPlantilla, normalizarMotion, valoresPorDefecto,
} from '../motion/plantillas';
import { PLANTILLAS_MOTION, type CampoMotion, type IdPlantilla, type Tono, type ValoresMotion } from '../motion/tipos';

/** Entrada · Salida · Combinado (video e imagen) · Bucle (texto, sticker y forma). */
export type CategoriaAnimChat = 'entrada' | 'salida' | 'combinado' | 'bucle';
export type ObjetivoNormalizar = 'predeterminado' | 'tiktok' | 'youtube';

/**
 * «Ajustar › Básico» de CapCut: la clave que usa el chat (el rótulo de la pantalla, sin
 * tildes) → la del efecto `ajuste` del motor (effects/definitions/ajuste.ts, PARAMS_BASICO)
 * y su rango. Lo fija el test.
 */
export const AJUSTES_COLOR = {
  temperatura: { clave: 'temperatura', min: -50, max: 50 },
  tinte: { clave: 'matiz', min: -50, max: 50 },
  saturacion: { clave: 'saturacion', min: -50, max: 50 },
  brillo: { clave: 'brillo', min: -50, max: 50 },
  contraste: { clave: 'contraste', min: -50, max: 50 },
  exposicion: { clave: 'exposicion', min: -50, max: 50 },
  luminosidad: { clave: 'luminosidad', min: -50, max: 50 },
  iluminar: { clave: 'resaltados', min: -50, max: 50 },
  sombras: { clave: 'sombras', min: -50, max: 50 },
  blancos: { clave: 'blancos', min: -50, max: 50 },
  negros: { clave: 'negros', min: -50, max: 50 },
  claridad: { clave: 'claridad', min: -50, max: 50 },
  enfocar: { clave: 'nitidez', min: 0, max: 100 },
  granulado: { clave: 'grano', min: 0, max: 100 },
  desvanecer: { clave: 'desvanecer', min: 0, max: 100 },
  vineta: { clave: 'vineta', min: 0, max: 100 },
} as const;
export type ClaveAjuste = keyof typeof AJUSTES_COLOR;

/** «Intensidad objetivo» (audio/claves.ts, OBJETIVOS_INTENSIDAD). Lo fija el test. */
export const OBJETIVOS_NORMALIZAR: Record<ObjetivoNormalizar, string> = {
  predeterminado: '-23',
  tiktok: '-12',
  youtube: '-14',
};

/**
 * Mezcla › Modo: los 10 de CapCut que el motor tiene (properties/video/basico.tsx,
 * MODOS_CAPCUT; «Profundidad lineal» no está en el WASM). Chat → valor del motor.
 */
export const MEZCLAS: Record<string, string> = {
  normal: 'normal',
  pantalla: 'screen',
  oscurecer: 'darken',
  iluminar: 'lighten',
  superposicion: 'overlay',
  'luz-intensa': 'hard-light',
  'luz-tenue': 'soft-light',
  'profundidad-del-color': 'color-burn',
  'desvanecimiento-del-color': 'color-dodge',
  multiplicar: 'multiply',
};

export type EstiloTextoChat = {
  fuente?: string;
  tamano?: number;
  color?: string;
  negrita?: boolean;
  cursiva?: boolean;
  subrayado?: boolean;
  mayusculas?: 'ninguno' | 'mayusculas' | 'minusculas' | 'titulo';
  alineacion?: 'izquierda' | 'centro' | 'derecha';
  espaciado?: number;
  interlineado?: number;
  /** Un color prende el trazo con ese color; false lo apaga. */
  trazo?: string | false;
  grosor_trazo?: number;
  /** true la prende con su color; un color, con ése; false la apaga. */
  sombra?: string | boolean;
  fondo?: string | false;
  opacidad_fondo?: number;
  resplandor?: string | false;
};

/** Posición en px del lienzo desde el centro, con Y hacia ARRIBA (como el panel de CapCut). */
export type TransformChat = { x?: number; y?: number; escala?: number; rotacion?: number; opacidad?: number; mezcla?: string };

/**
 * «Fondo › Desenfoque» del panel Proyecto (background/blur.ts, BACKGROUND_BLUR_INTENSITY_PRESETS: Light, Medium y
 * Heavy), con el nombre que dice la persona. Lo fija el test contra el motor.
 */
export const DESENFOQUES_FONDO = { suave: 100, medio: 200, fuerte: 500 } as const;
export type DesenfoqueFondo = keyof typeof DESENFOQUES_FONDO;

/**
 * Las proporciones del diálogo «Recortar» (params/extra/recorte.ts, PROPORCIONES_RECORTE), sin «Libre», que no es una
 * proporción: para recortar libre van los lados. Lo fija el test contra el motor.
 */
export const PROPORCIONES_ENCUADRE = ['original', '16:9', '9:16', '1:1', '4:3', '3:4', '2:1', '2.35:1', '1.85:1'] as const;
export type ProporcionEncuadre = (typeof PROPORCIONES_ENCUADRE)[number];
/** Los lados de un encuadre, en % de la fuente que se le saca a cada uno. */
export type LadosEncuadre = { izquierda: number; arriba: number; derecha: number; abajo: number };
const LADOS_ENCUADRE = ['izquierda', 'arriba', 'derecha', 'abajo'] as const;

/** Lo que la IA puede devolver. Los tiempos van en SEGUNDOS de la línea de tiempo. */
export type OperacionChat =
  /** `plantilla`: una «Plantilla de texto» de la biblioteca (DISPONIBLES.plantillas_texto): su fuente, tamaño, efecto y animación. */
  | { op: 'agregar_texto'; texto: string; inicio: number; duracion: number; ref?: string; plantilla?: string }
  | { op: 'cambiar_texto'; ref: string; texto: string }
  | { op: 'borrar'; refs: string[] }
  | { op: 'mover'; ref: string; inicio: number }
  | { op: 'duracion'; ref: string; duracion: number }
  | { op: 'dividir'; ref: string; en: number }
  | { op: 'recortar'; ref: string; inicio?: number; fin?: number }
  | { op: 'volumen'; ref: string; db: number }
  | { op: 'silenciar'; ref: string; silenciado: boolean }
  | { op: 'fundido'; ref: string; entrada?: number; salida?: number }
  | { op: 'reducir_ruido'; ref: string; activo: boolean }
  | { op: 'normalizar'; ref: string; activo: boolean; objetivo?: ObjetivoNormalizar }
  | { op: 'separar_audio'; ref: string; separado: boolean }
  | { op: 'ocultar'; ref: string; oculto: boolean }
  | { op: 'velocidad'; ref: string; x?: number; curva?: string | null; cambiar_tono?: boolean }
  | { op: 'transicion'; ref: string; id: string | null; duracion?: number }
  | { op: 'animacion'; ref: string; tipo: CategoriaAnimChat; id: string | null; duracion?: number }
  | { op: 'filtro'; ref: string; id: string | null; intensidad?: number }
  | { op: 'efecto'; ref: string; id: string; quitar?: true }
  | { op: 'capa_efecto'; tipo: 'filtro' | 'efecto'; id: string; inicio: number; duracion: number; ref?: string }
  | { op: 'ajustar_color'; ref: string; valores: Partial<Record<ClaveAjuste, number>> }
  | { op: 'estilo_texto'; ref: string; estilo: EstiloTextoChat }
  | { op: 'transformar'; ref: string; cambios: TransformChat }
  | { op: 'reflejar'; ref: string; horizontal?: boolean; vertical?: boolean }
  | { op: 'revertir'; ref: string; revertido: boolean }
  | { op: 'congelar'; ref: string; en: number }
  | { op: 'reemplazar_en_subtitulos'; buscar: string; reemplazo: string }
  | { op: 'resaltar_palabras'; modo: 'ninguno' | 'palabra' | 'frase'; color?: string; opacidad_no_dichas?: number }
  | { op: 'generar_subtitulos' }
  | { op: 'cortar_frase'; frase: string; vez?: number }
  | { op: 'cortar_tramo'; inicio: number; fin: number }
  | { op: 'eliminar_muletillas' }
  /** Sin `ref`: cada clip con sonido de la pista principal (o los elegidos, con el alcance de la selección). `pausa_min`: la
   *  pausa más corta que se saca, de 0,2 a 2 s (sin ella, 0,4: audio/silencios-aviso.ts, ticket 31). */
  | { op: 'borrar_silencios'; ref?: string; pausa_min?: number }
  /** `medio`: la ref de un medio de Multimedia («m1»), de "medios" en la vista. */
  | { op: 'reemplazar_clip'; ref: string; medio: string }
  /** `textos`: hueco → texto; `clips`: hueco → ref de un medio. */
  | { op: 'usar_plantilla'; id: string; textos: Record<string, string>; clips: Record<string, string> }
  /** «Resaltar palabras clave» de TODOS los subtítulos (subtitles/claves.ts): solas, las nombradas, o ninguna. */
  | {
      op: 'palabras_clave';
      /** «sumar» y «quitar» marcan o desmarcan a mano sin tocar las demás (Submagic, 10/11/2026). */
      modo: 'auto' | 'estas' | 'sumar' | 'quitar' | 'ninguna';
      palabras?: string[];
      color?: string;
      /** El tamaño de las claves en % (100 = igual; hasta 160): «más grandes», como las de Hormozi. */
      tamano?: number;
      /** Un subtítulo solo (su ref); sin esto, todos. */
      ref?: string;
    }
  /** «Animación de la palabra» de TODOS los subtítulos (Submagic, estilo Hormozi): la que se dice salta o crece. */
  | { op: 'animar_palabras'; animacion: 'ninguna' | 'pop' | 'crecer' }
  /** Un preset de subtítulos de la marca (DISPONIBLES.presets_subtitulos), a TODOS los subtítulos. */
  | { op: 'usar_preset_subtitulos'; preset: string }
  /** «B-roll de MaKo» (app/video-editor/_opencut/broll): propone fotos y cambios de plano que la persona deja o saca. */
  | { op: 'broll'; ritmo?: 'poco' | 'normal' | 'mucho'; planos?: boolean }
  /** «Clips mágicos» (app/video-editor/_opencut/clips): busca los mejores momentos para abrir cada uno en un proyecto nuevo. */
  | { op: 'clips_magicos'; cuantos?: number }
  /** «Edición automática» (app/video-editor/_opencut/enjambre): el equipo de agentes edita todo, de una y a la vista. */
  | { op: 'edicion_automatica' }
  /** «Emojis automáticos» (Submagic: «Auto emojis», app/video-editor/_opencut/subtitles/emojis.ts): ponerlos o sacarlos. */
  | { op: 'emojis_subtitulos'; activar: boolean }
  /**
   * Un motion graphic nuevo. `valores`: SÓLO los campos que vinieron, ya normalizados (lo que se inserta lo arma
   * `valoresAlAgregar`); `duracion` sin poner = la de la plantilla.
   */
  | { op: 'agregar_motion'; plantilla: IdPlantilla; valores: ValoresMotion; inicio: number; duracion?: number; ref?: string }
  /** Campos de un motion graphic que ya está (la plantilla no se cambia). */
  | { op: 'editar_motion'; ref: string; valores: ValoresMotion }
  // ── 10/11/2026: lo que el chat no sabía hacer (docs/editor-video/pendientes-video-editor.md §9.1), cada uno con el
  // MISMO camino que su botón (chat/comandos.ts).
  /** «Duplicar» de la línea de tiempo: una copia en el mismo tiempo, encima, en una pista nueva. `copia`: su ref nueva. */
  | { op: 'duplicar'; ref: string; copia?: string }
  /** El fondo del lienzo (Proyecto › Fondo): un color o el desenfoque. Uno de los dos. */
  | { op: 'fondo_lienzo'; color: string; desenfoque?: undefined }
  | { op: 'fondo_lienzo'; desenfoque: DesenfoqueFondo; color?: undefined }
  /** Un «Efecto de texto» del panel Texto (text/estilos-predefinidos.ts); `id` null = «Ninguno». */
  | { op: 'efecto_texto'; ref: string; id: string | null }
  /** Un emoji de la biblioteca (Stickers › Emojis), como sticker en su pista. */
  | { op: 'agregar_emoji'; emoji: string; inicio: number; duracion: number; ref?: string }
  /** «Recortar» el cuadro de un clip: una proporción centrada, los lados en %, o `quitar` (entero). Uno de los tres. */
  | { op: 'encuadre'; ref: string; proporcion: ProporcionEncuadre }
  | ({ op: 'encuadre'; ref: string } & LadosEncuadre)
  | { op: 'encuadre'; ref: string; quitar: true };

export type IdOperacion = OperacionChat['op'];

/** Topes de lo que vuelve. Fuera de rango se RECHAZA con su motivo, nunca se recorta. */
export const TOPES_CHAT = {
  operaciones: 40,
  texto: 200,
  /** Segundos. Un texto nuevo o una duración, entre esto y el máximo. */
  duracionMin: 0.2,
  duracionMax: 600,
  tiempoMax: 3600,
  /** Iguales a VOLUME_DB_MIN/MAX de app/video-editor/_opencut/timeline/audio-constants.ts (lo fija el test). */
  volumenMinDb: -60,
  volumenMaxDb: 20,
  /** Iguales a MIN/MAX_RETIME_RATE de retime/rate.ts (lo fija el test). */
  velocidadMin: 0.1,
  velocidadMax: 100,
  /** Lo mínimo de una transición o una animación (DURACION_MINIMA de transiciones/claves.ts y animaciones/elegir.ts). */
  efectoMin: 0.1,
  /** El tamaño de la letra del panel (text/typography.ts MAX_FONT_SIZE; el deslizador arranca en 1). */
  tamanoMin: 1,
  tamanoMax: 300,
  /** La escala del panel, en % (properties/video/basico.tsx). */
  escalaMin: 1,
  escalaMax: 500,
  /** Píxeles del lienzo desde el centro. */
  posicionMax: 10_000,
  /** Lo que deja la caja «Espaciado» del panel de texto. */
  espaciadoMin: -20,
  espaciadoMax: 100,
  interlineadoMin: 0.5,
  interlineadoMax: 4,
  /** Los medios de Multimedia que lista la vista (los demás sólo se cuentan). */
  medios: 100,
  /** Cuánto se le puede mandar a la IA de una vez (la vista de la línea de tiempo, en JSON). */
  vistaMax: 60_000,
  instruccion: 2_000,
} as const;

// Lo que va en la descripción de varias operaciones.
const REF = '"ref" es la de la LÍNEA DE TIEMPO';
const IDS = (lista: string) => `"id" es uno de DISPONIBLES.${lista} (copia el id exacto; no inventes otros)`;

const segundosTexto = (s: number) => `${String(Math.round(s * 10) / 10).replace('.', ',')} s`;

/** Una plantilla en un renglón, como la lee la IA: id, nombre, duración, qué es y sus huecos con sus topes. */
function plantillaEnRenglon(p: Plantilla, porque: string | null = null): string {
  const huecos = huecosDe(p);
  const clips = huecos
    .filter((h) => h.tipo === 'clip')
    .map((h) => `${h.nombre} (${segundosTexto(h.segundos)}${h.acepta && h.acepta !== 'ambos' ? `, sólo ${h.acepta === 'video' ? 'video' : 'foto'}` : ''}${h.opcional ? ', opcional' : ''})`);
  const textos = huecos.filter((h) => h.tipo === 'texto').map((h) => `${h.nombre} (hasta ${h.maxCaracteres}: «${h.muestra}»)`);
  const sugerida = porque ? ` (SUGERIDA para este negocio: ${porque})` : '';
  return `  · "${p.id}" «${p.nombre}»${sugerida}, ${segundosTexto(p.duracion)}: ${p.descripcion} Clips: ${clips.join(', ')}. Textos: ${textos.join(', ')}.`;
}

/**
 * Lo que lee la IA de usar_plantilla: la regla y el catálogo entero, en el orden de la pestaña Plantillas. Con las
 * señales del negocio, primero las sugeridas y marcadas (lib/plantillas-sugeridas.ts): si la persona no dice cuál,
 * el chat elige como elegiría ella mirando la galería.
 */
function paraUsarPlantilla(senales?: SenalesNegocio | null): string {
  const orden = plantillasEnOrden(senales);
  return [
    'Arma una PLANTILLA de anuncio vertical, como «Utilizar plantilla»: pasa el lienzo a 9:16 y pone sus clips, textos, animaciones y transiciones. SÓLO con la línea de tiempo VACÍA (ningún elemento en "pistas") y SOLA en el pedido: lo que arma recién tiene ref en el pedido siguiente. "textos": {"hueco": "texto"} con lo que DICTA la persona, hasta el máximo de cada hueco; lo que no llenes queda con el texto de ejemplo para cambiarlo después con cambiar_texto (no lo inventes). "clips": {"hueco": "m1"} con la ref de un medio de "medios"; un video tiene que durar al menos los segundos de su hueco y una foto sirve siempre; lo que no llenes queda con una imagen de muestra para sustituir con reemplazar_clip (los opcionales pueden quedar así).'
      + (orden.some((x) => x.porque) ? ' Si la persona no dice cuál, elige una SUGERIDA para este negocio.' : '')
      + ' Las plantillas ("id" «nombre», duración: qué es · huecos):',
    ...orden.map(({ plantilla, porque }) => plantillaEnRenglon(plantilla, porque)),
  ].join('\n');
}

/**
 * Lo que lee la IA de agregar_motion: las reglas de las skills de motion (los textos TAL CUAL, nunca inventar un dato,
 * UN tono), dichas como el resto del catálogo: una ORDEN al modelo («nunca los inventes», como «no lo inventes» de
 * usar_plantilla), no una descripción. Las plantillas van aparte (`catalogoMotionChat` en el prompt del chat; en la
 * API, `catalogoMotionCompacto` en el parámetro "plantilla"): este texto es también la descripción de la API, que tiene
 * presupuesto (12.000 caracteres por turno) y PUNTÚA por sus palabras contra el pedido (lib/api-mako/registro.ts,
 * ordenarPorRelevancia): con el catálogo adentro (título, nombre, precio…) le ganaba el lugar a editar_motion en «cambia
 * el título del motion», y con la palabra «textos» dejaba sin cambiar_estilo_texto a «agrega un texto amarillo» (medido
 * el 27/10/2026 con scripts/presupuesto-turno-app.mts). Por eso tampoco dice «texto».
 */
const PARA_AGREGAR_MOTION =
  'Agrega un MOTION GRAPHIC (una animación ya diseñada que ocupa el cuadro, en su propia pista): "plantilla", y "valores" {campo: valor} sólo con lo que pones, dentro del tope de cada campo; "inicio" en segundos; "duracion" opcional (la de la plantilla). Lo que dice va TAL CUAL lo dijo la persona: nombres, cifras, precios, citas y calificaciones, nunca los inventes (si falta un obligatorio, pídelo en el resumen). Lo que no pones queda vacío (las estrellas, en 0). UN "tono" para todos los motion del video. "ref" nueva opcional ("n1"…).';

/** Las plantillas de motion para el prompt del chat: el catálogo del motor, como sublista de agregar_motion. */
function catalogoMotionChat(): string {
  return catalogoMotionParaPrompt().split('\n').map((l) => `  · ${l.replace(/^- /, '')}`).join('\n');
}

/** Lo que un motion AGREGADO por el chat o la API necesita de la persona, además de sus textos obligatorios. */
const DATOS_MOTION: Partial<Record<IdPlantilla, readonly string[]>> = { cifra: ['numero'] };

/** «titulo*≤90»: un campo de motion en pocas letras (la API tiene presupuesto). `*` = tiene que venir al agregar. */
function campoCompacto(c: CampoMotion, obligatorio: boolean): string {
  const marca = obligatorio ? '*' : '';
  if (c.tipo === 'texto') return `${c.clave}${marca}≤${c.max}`;
  if (c.tipo === 'numero') return `${c.clave}${marca}${c.min < -1000 ? '' : ` ${c.min}-${c.max}`}`;
  return c.clave;
}

/**
 * Las plantillas de motion en un párrafo, para el parámetro "plantilla" de la API (lib/editor-video/chat-api.ts): cada
 * id con sus campos y topes (* = obligatorio al agregar) y los comunes. Sale del MISMO catálogo del motor que lee el chat.
 */
export function catalogoMotionCompacto(): string {
  const propias = PLANTILLAS_MOTION.map((p) => {
    const campos = DEF_MOTION[p].campos.map((c) => campoCompacto(c, (c.tipo === 'texto' && !!c.obligatorio) || !!DATOS_MOTION[p]?.includes(c.clave)));
    return `${p} (${campos.join(', ')})`;
  }).join('; ');
  const tono = camposDe('titular').find((c) => c.clave === 'tono');
  const opciones = tono && tono.tipo === 'opcion' ? tono.opciones.map((o) => o.valor).join('|') : '';
  return `La plantilla. Sus campos (* = obligatorio): ${propias}. Comunes: tono (${opciones}), colorFondo, colorTexto y colorAcento (#RRGGBB), conFondo (true/false), fuente.`;
}

/** Las operaciones, para el texto que lee la IA. El orden es el de la lista que se le muestra. */
export const OPERACIONES_CHAT: Array<{ op: IdOperacion; forma: string; para: string }> = [
  {
    op: 'agregar_texto',
    forma: '{"op":"agregar_texto","texto":"…","inicio":0,"duracion":3,"ref":"n1"}',
    para: 'Agrega un texto en pantalla, en una pista de texto libre, con el estilo predeterminado (Arial 15, blanco, centrado en el lienzo). "ref" es opcional: si le pones una nueva ("n1", "n2"…), las operaciones que siguen pueden cambiarle el estilo, la posición o la animación en este mismo pedido. "plantilla" (opcional): el id de una «Plantilla de texto» de DISPONIBLES.plantillas_texto, y el texto nace con su fuente, su tamaño, su efecto y su animación.',
  },
  {
    op: 'cambiar_texto',
    forma: '{"op":"cambiar_texto","ref":"t1","texto":"…"}',
    para: 'Cambia lo que dice un texto que ya existe. Un texto con "hueco" (de una plantilla) se vuelve a partir en renglones y a ubicar solo, y admite hasta "max_caracteres".',
  },
  {
    op: 'reemplazar_clip',
    forma: '{"op":"reemplazar_clip","ref":"i1","medio":"m2"}',
    para: 'Sustituye el archivo de un clip de video o imagen por un medio de "medios" ("medio": su ref, "m1"…), como «Reemplazar el clip»: conserva dónde está, cuánto dura, la transición, las animaciones, los efectos y la velocidad; del medio se usa el principio. Un video tiene que durar al menos lo que recorre el clip (su largo × su velocidad); una foto sirve siempre. En una MUESTRA de plantilla ("muestra": true) cubre el mismo recuadro y llena también las otras muestras de su "hueco" (el video tiene que alcanzar para la más larga); si el clip trae "acepta", sólo ese tipo. No agrega clips nuevos ni cambia audios.',
  },
  { op: 'borrar', forma: '{"op":"borrar","refs":["v2","t1"]}', para: 'Borra uno o varios elementos (también una capa de efecto).' },
  { op: 'mover', forma: '{"op":"mover","ref":"t1","inicio":4}', para: 'Mueve un elemento en el tiempo, dentro de su pista, sin pisar a otro.' },
  {
    op: 'duracion',
    forma: '{"op":"duracion","ref":"t1","duracion":5}',
    para: 'Cambia cuánto dura un texto, una imagen, un sticker, una forma o una capa de efecto (corre su final). Un video o un audio se acorta con recortar.',
  },
  { op: 'dividir', forma: '{"op":"dividir","ref":"v1","en":2.5}', para: 'Corta un elemento en ese segundo de la línea de tiempo; queda en dos partes.' },
  {
    op: 'recortar',
    forma: '{"op":"recortar","ref":"v1","inicio":1.5,"fin":8}',
    para: 'Como arrastrar los bordes del clip: "inicio" lleva el borde izquierdo a ese segundo y "fin" el derecho (pon uno o los dos). Lo que queda afuera se esconde, no se mueve el resto del clip. Achicar siempre se puede; alargar un video o un audio, sólo hasta el material escondido que indica "recorte":[antes, después] en segundos.',
  },
  { op: 'volumen', forma: '{"op":"volumen","ref":"a1","db":-6}', para: 'Volumen de un video o un audio, en dB (0 = original, −6 ≈ la mitad, de −60 a 20).' },
  { op: 'silenciar', forma: '{"op":"silenciar","ref":"v1","silenciado":true}', para: 'Silencia o devuelve el sonido de un video o un audio.' },
  {
    op: 'fundido',
    forma: '{"op":"fundido","ref":"a1","entrada":1,"salida":2}',
    para: 'Aparición y desaparición progresiva del SONIDO de un video o un audio, en segundos (0 = sin fundido; pon uno o los dos). Entre los dos no pueden pasar el largo del clip.',
  },
  { op: 'reducir_ruido', forma: '{"op":"reducir_ruido","ref":"a1","activo":true}', para: 'Prende o apaga «Reducir el ruido» de un video o un audio.' },
  {
    op: 'normalizar',
    forma: '{"op":"normalizar","ref":"a1","activo":true,"objetivo":"youtube"}',
    para: '«Normalizar la intensidad»: mide el sonido del clip y lo lleva a un volumen parejo. "objetivo": "predeterminado" (−23 LUFS), "tiktok" (−12) o "youtube" (−14). "activo":false la apaga. Medir tarda: se aplica al final, después de las demás.',
  },
  {
    op: 'separar_audio',
    forma: '{"op":"separar_audio","ref":"v1","separado":true}',
    para: '«Extraer audio»: el sonido de un video pasa a su propia pista de audio ("separado":true); con false vuelve al video y se borra el extraído. El audio nuevo no tiene ref en este pedido.',
  },
  { op: 'ocultar', forma: '{"op":"ocultar","ref":"t2","oculto":true}', para: 'Oculta o vuelve a mostrar un elemento visual sin borrarlo.' },
  {
    op: 'velocidad',
    forma: '{"op":"velocidad","ref":"v1","x":2}',
    para: `Velocidad de un video o un audio. "x": constante, de ${TOPES_CHAT.velocidadMin} a ${TOPES_CHAT.velocidadMax} (1 = normal, 2 = el doble de rápido, 0.5 = cámara lenta); el clip se alarga o se acorta y lo que sigue en la pista se corre si hace falta. Conserva el tono; "cambiar_tono":true lo cambia (como cinta). O en vez de "x", "curva": un id de DISPONIBLES.curvas_velocidad (sólo video; "ninguna" la quita).`,
  },
  {
    op: 'transicion',
    forma: '{"op":"transicion","ref":"v1","id":"mezclar","duracion":0.5}',
    para: `Transición en el corte entre un clip de video o imagen ("ref", el de la IZQUIERDA del corte) y el que empieza justo donde termina, en la misma pista. ${IDS('transiciones')}; "ninguna" la quita. "duracion" en segundos (opcional; 0.5 si no tenía), desde ${TOPES_CHAT.efectoMin} y como mucho la mitad del clip más corto del corte. Para todos los cortes, una por corte.`,
  },
  {
    op: 'animacion',
    forma: '{"op":"animacion","ref":"t1","tipo":"entrada","id":"deslizar-arriba","duracion":0.5}',
    para: `Animación de un elemento visual. "tipo": "entrada" (al empezar), "salida" (al terminar), "combinado" (sólo video e imagen: una vez a lo largo del clip; saca la entrada y la salida) o "bucle" (sólo texto, sticker y forma: se repite; "duracion" es lo que dura cada vuelta, hasta 5 s). ${IDS('animaciones.<tipo>')}; "ninguna" la quita. "duracion" en segundos es opcional (la del preset; el combinado, el clip entero). Entrada + salida no pasan el largo del clip.`,
  },
  {
    op: 'filtro',
    forma: '{"op":"filtro","ref":"v1","id":"calido","intensidad":80}',
    para: `Filtro de color de un clip de video o imagen (uno por clip: el nuevo reemplaza al anterior). ${IDS('filtros')}; "ninguno" lo quita. "intensidad" de 0 a 100 (100 si no la pones).`,
  },
  {
    op: 'efecto',
    forma: '{"op":"efecto","ref":"v1","id":"sacudida"}',
    para: `Efecto de video sobre un clip de video o imagen (se suman). ${IDS('efectos')}; "quitar":true saca ese efecto del clip.`,
  },
  {
    op: 'capa_efecto',
    forma: '{"op":"capa_efecto","tipo":"efecto","id":"destello","inicio":2,"duracion":3}',
    para: `Un filtro ("tipo":"filtro") o un efecto ("tipo":"efecto") como CAPA en su propia pista: afecta a todo lo que se ve debajo mientras dura (sirve para «todo el video» o para un tramo). ${IDS('filtros o DISPONIBLES.efectos')}. "ref" nueva opcional ("n1"…) para seguir operando sobre la capa.`,
  },
  {
    op: 'ajustar_color',
    forma: '{"op":"ajustar_color","ref":"v1","brillo":10,"contraste":5}',
    para: `«Ajustar» el color de un clip de video o imagen. Cada valor reemplaza al actual (0 = sin cambio): ${Object.entries(AJUSTES_COLOR).map(([k, r]) => `${k} (${r.min} a ${r.max})`).join(', ')}. Pon sólo los que cambian.`,
  },
  {
    op: 'estilo_texto',
    forma: '{"op":"estilo_texto","ref":"t1","color":"#FFD400","tamano":24,"negrita":true}',
    para: `Estilo de un texto (pon sólo lo que cambia): "fuente" (nombre exacto de una Google Font, p. ej. las de DISPONIBLES.fuentes_sugeridas), "tamano" (${TOPES_CHAT.tamanoMin} a ${TOPES_CHAT.tamanoMax}; el predeterminado es 15), "color" (#RRGGBB), "negrita", "cursiva", "subrayado" (true/false), "mayusculas" ("ninguno", "mayusculas", "minusculas", "titulo"), "alineacion" ("izquierda", "centro", "derecha"), "espaciado" (entre letras, ${TOPES_CHAT.espaciadoMin} a ${TOPES_CHAT.espaciadoMax}), "interlineado" (${TOPES_CHAT.interlineadoMin} a ${TOPES_CHAT.interlineadoMax}), "trazo" (#RRGGBB lo prende con ese color, false lo apaga) y "grosor_trazo" (0 a 100), "sombra" (true, #RRGGBB o false), "fondo" (#RRGGBB o false) y "opacidad_fondo" (0 a 100), "resplandor" (#RRGGBB o false). En un subtítulo no se cambian fuente, tamaño, negrita, cursiva ni espaciado.`,
  },
  {
    op: 'transformar',
    forma: '{"op":"transformar","ref":"t1","y":600,"escala":120}',
    para: `Posición, tamaño y mezcla de un elemento visual (pon sólo lo que cambia): "x" y "y" en píxeles del LIENZO desde el centro (x positiva a la derecha, y positiva hacia ARRIBA; el borde está a ±ancho/2 y ±alto/2), "escala" en % (100 = como entró, ${TOPES_CHAT.escalaMin} a ${TOPES_CHAT.escalaMax}), "rotacion" en grados (−360 a 360; para girar 90° suma 90 a la actual), "opacidad" (0 a 100), "mezcla" (${Object.keys(MEZCLAS).join(', ')}).`,
  },
  {
    op: 'reflejar',
    forma: '{"op":"reflejar","ref":"v1","horizontal":true}',
    para: 'Espejo de un clip de video o imagen: "horizontal" (izquierda ↔ derecha) y/o "vertical" (cabeza abajo), true o false.',
  },
  {
    op: 'revertir',
    forma: '{"op":"revertir","ref":"v1","revertido":true}',
    para: 'Pasa un clip de video hacia atrás ("revertido":true) o lo devuelve al derecho (false). Procesa el archivo y tarda: se aplica al final, después de las demás.',
  },
  {
    op: 'congelar',
    forma: '{"op":"congelar","ref":"v1","en":3}',
    para: 'Congela el cuadro de ese segundo de un clip de video: lo divide ahí, mete una imagen fija de 3 s y corre lo que sigue en la pista. Se aplica al final, después de las demás.',
  },
  {
    op: 'reemplazar_en_subtitulos',
    forma: '{"op":"reemplazar_en_subtitulos","buscar":"…","reemplazo":"…"}',
    para: 'Busca un texto en TODOS los subtítulos y lo cambia por otro, sin distinguir mayúsculas («Buscar y reemplazar»).',
  },
  {
    op: 'resaltar_palabras',
    forma: '{"op":"resaltar_palabras","modo":"palabra","color":"#FFE14D","opacidad_no_dichas":100}',
    para: 'El karaoke de TODOS los subtítulos («Animaciones de subtítulos»): "modo":"palabra" pinta del "color" sólo la palabra que se está diciendo; "frase" pinta todo lo ya dicho; "ninguno" lo apaga. "opacidad_no_dichas" (0 a 100; 100 = igual que lo dicho) atenúa lo que todavía no se dijo. "color" (#RRGGBB) y "opacidad_no_dichas" son opcionales: sin ellos quedan los de ahora ("resaltar" en "estilo_subtitulos"). Necesita subtítulos con tiempos por palabra ("transcripcion_por_palabra": true).',
  },
  {
    op: 'generar_subtitulos',
    forma: '{"op":"generar_subtitulos"}',
    para: 'Subtítulos automáticos de todo el video: transcribe la voz en el navegador (gratis) con el idioma y la plantilla elegidos en Subtítulos. Se aplica al final.',
  },
  {
    op: 'cortar_frase',
    forma: '{"op":"cortar_frase","frase":"…","vez":1}',
    para: 'Saca del video el tramo donde se DICE esa frase: corta el video y el subtítulo, y lo que viene después se corre. Busca palabra por palabra en los subtítulos con tiempos por palabra ("transcripcion_por_palabra"), sin mayúsculas ni puntuación: copia la frase como aparece en el subtítulo. Sin "vez", todas las veces que se dice; "vez":1 sólo la primera, 2 la segunda… Se aplica al final, después de las demás.',
  },
  {
    op: 'cortar_tramo',
    forma: '{"op":"cortar_tramo","inicio":3,"fin":5.5}',
    para: 'Saca de la línea de tiempo el tramo de "inicio" a "fin" (segundos de la LÍNEA DE TIEMPO que ves): corta el video de la pista principal y lo que va con él, y lo que viene después se corre hacia atrás. Se aplica al final; no lo combines con otros cambios que muevan la pista principal (borrar, recortar, velocidad, mover, congelar u otros cortes de frase): pídelo aparte.',
  },
  {
    op: 'eliminar_muletillas',
    forma: '{"op":"eliminar_muletillas"}',
    para: 'Saca del video todas las muletillas («eh», «este», «o sea»…) que se identifiquen en los subtítulos con tiempos por palabra. Se aplica al final, después de las demás.',
  },
  {
    op: 'borrar_silencios',
    // Sin "ref" en el ejemplo (ticket 31, 29/10/2026): con `"ref":"v1"` el modelo nombraba siempre UN clip, y a Leila, que
    // pidió «borrar silencios» del video, le buscó en uno de 0,9 s y le dijo que no había.
    forma: '{"op":"borrar_silencios"}',
    para: '«Borrar silencios», como el botón de la barra: escucha el sonido, saca cada pausa de 0,4 s o más (deja 80 ms a cada lado) y pega lo que queda; lo que viene después en su pista se corre. SIN "ref" (lo normal: «borra los silencios», «saca las pausas»): todo el video, cada clip con sonido de la pista principal (con el alcance de la selección, los elegidos). Con "ref" SÓLO si la persona nombra un clip o un audio en particular. "pausa_min" (opcional, de 0.2 a 2 segundos): la pausa más corta que se saca, cuando pide pausas más cortas o más largas que 0,4 s. No hace falta tener subtítulos. Se aplica al final, después de las demás; no lo combines con otros cortes (cortar_frase, cortar_tramo, eliminar_muletillas): pídelo aparte.',
  },
  {
    op: 'usar_plantilla',
    forma: '{"op":"usar_plantilla","id":"testimonio","textos":{"cita":"…"},"clips":{"clip":"m1"}}',
    para: paraUsarPlantilla(),
  },
  {
    op: 'palabras_clave',
    forma: '{"op":"palabras_clave","modo":"auto"}',
    para: 'Pinta de otro "color" (#RRGGBB, opcional; si no, el de ahora) la palabra que pesa de cada subtítulo, en TODOS: "modo":"auto" la elige sola (números, montos, palabras de venta, nombres propios y las de la marca); "estas" resalta SÓLO las "palabras" que nombra la persona, cada vez que se dicen; "sumar" las agrega a las que ya hay y "quitar" las saca, sin tocar las demás (para marcar o desmarcar una a mano); "ninguna" las saca todas. Con "ref" (un subtítulo) cambia sólo ése. "tamano" (100 a 160, en %) las agranda («más grandes», como las de Hormozi). Las de ahora van en "palabras_clave" de cada subtítulo. No necesita tiempos por palabra.',
  },
  {
    op: 'animar_palabras',
    forma: '{"op":"animar_palabras","animacion":"pop"}',
    para: 'La animación de la palabra que se está diciendo, en TODOS los subtítulos (como Submagic y el estilo Hormozi): "pop" la hace saltar de abajo hacia arriba y quedar apenas más grande; "crecer" la deja más grande mientras se dice; "ninguna" la saca. Va con o sin el color del karaoke (resaltar_palabras). Necesita subtítulos con tiempos por palabra ("transcripcion_por_palabra": true).',
  },
  {
    op: 'usar_preset_subtitulos',
    forma: '{"op":"usar_preset_subtitulos","preset":"p1abc"}',
    para: 'Aplica a TODOS los subtítulos un preset de la marca ("preset": su id de DISPONIBLES.presets_subtitulos): su fuente, colores, tamaño, fondo, contorno, karaoke y palabras clave. Se aplica al final. Sin presets en DISPONIBLES, el negocio todavía no guardó ninguno: dilo.',
  },
  {
    op: 'broll',
    forma: '{"op":"broll","ritmo":"normal","planos":true}',
    para: 'B-roll automático, como Submagic: según lo que se dice, propone fotos con licencia (de Pexels) encima del video y, con "planos": true, cambios de plano (acercamientos al ritmo de las frases). "ritmo" (opcional): "poco", "normal" o "mucho". No elige ni inventa fotos ni tiempos: lo hace al aceptar, y la persona deja o saca cada una en la línea de tiempo. Úsala cuando pidan B-roll, imágenes de apoyo, tomas de recurso, cambios de plano o zooms automáticos. Se aplica al final.',
  },
  {
    op: 'clips_magicos',
    forma: '{"op":"clips_magicos","cuantos":5}',
    para: 'Clips mágicos, como OpusClip: busca en un video LARGO los mejores momentos (de 15 a 60 s, que se entiendan solos) para hacer Reels o Shorts. "cuantos" (opcional, de 1 a 10; sin él, 5). No elige ni inventa los momentos: los busca al aceptar, y la persona abre cada uno en un proyecto nuevo, vertical y con subtítulos. No cambia este proyecto. Se aplica al final.',
  },
  {
    op: 'edicion_automatica',
    forma: '{"op":"edicion_automatica"}',
    para: 'Edición automática con un equipo de agentes, de una y a la vista: quita pausas, subtitula si falta, saca muletillas, resalta lo que pesa en lima, propone fotos de apoyo y acercamientos, limpia la voz, deja el volumen a −14 LUFS y revisa al final. Úsala cuando pidan editarlo todo o dejarlo listo de una. Cada agente sin nada que hacer se saltea. Va SOLA y se aplica al final.',
  },
  {
    op: 'emojis_subtitulos',
    forma: '{"op":"emojis_subtitulos","activar":true}',
    para: 'Emojis automáticos, como Submagic: con "activar": true pone un emoji animado encima de cada subtítulo que dice algo que se puede dibujar (dinero, tiempo, una idea, un error…), en su pista «Emojis», reemplazando los de antes; con false los saca. No elige ni inventa los emojis: los elige el editor al aceptar, con la palabra clave de cada subtítulo. Los de ahora van marcados "emoji_de_subtitulo". Se aplica al final, después de generar los subtítulos.',
  },
  // Los motion graphics (10/11/2026), al FINAL (AGENTS.md: una operación nueva no le saca el lugar a las de antes).
  {
    op: 'agregar_motion',
    forma: '{"op":"agregar_motion","plantilla":"titular","valores":{"titulo":"…","tono":"energico"},"inicio":0,"ref":"n1"}',
    para: PARA_AGREGAR_MOTION,
  },
  {
    op: 'editar_motion',
    forma: '{"op":"editar_motion","ref":"g1","valores":{"titulo":"…"}}',
    para: 'Cambia lo que dice (el título, el nombre, la cifra…), el tono, los colores o la fuente de un motion graphic que ya está ("tipo":"motion", con sus "valores" de ahora): "valores" {campo: valor} sólo con lo que cambia, con los campos y topes de SU plantilla (vacío saca uno que no es obligatorio). La plantilla no se cambia.',
  },
  // Lo que el chat no sabía hacer (10/11/2026), también al FINAL.
  {
    op: 'duplicar',
    forma: '{"op":"duplicar","ref":"t1","copia":"n1"}',
    para: 'Duplica un elemento, como el botón «Duplicar»: la copia es igual (estilo, efectos, animaciones) y queda en el mismo tiempo, encima, en una pista nueva. "copia" (opcional): una ref nueva ("n1"…) para moverla con mover o cambiarla en este mismo pedido.',
  },
  {
    op: 'fondo_lienzo',
    forma: '{"op":"fondo_lienzo","color":"#000000"}',
    para: 'El fondo del lienzo (el del panel Proyecto, en Fondo), lo que se ve donde el video no llena el cuadro, en TODO el proyecto: "color" (#RRGGBB) o "desenfoque" ("suave", "medio" o "fuerte": el mismo video, desenfocado). Uno de los dos. El de ahora va en "fondo_lienzo" de la vista.',
  },
  {
    op: 'efecto_texto',
    forma: '{"op":"efecto_texto","ref":"t1","id":"neon-rosa"}',
    para: `Un «Efecto de texto» del panel Texto en un texto o un subtítulo: su color, trazo, sombra, brillo y fondo de una vez, sin tocar la fuente, el tamaño ni lo que dice. ${IDS('efectos_texto')}; "ninguno" lo deja blanco y sin nada. Para un solo detalle, estilo_texto.`,
  },
  {
    op: 'agregar_emoji',
    forma: '{"op":"agregar_emoji","emoji":"🔥","inicio":2,"duracion":2,"ref":"n1"}',
    para: 'Agrega UN emoji de la biblioteca de emojis del panel Stickers como sticker, en su propia pista y en el centro del cuadro: "emoji" (🔥, 💰, ✅, 👉…), "inicio" y "duracion" en segundos. "ref" nueva opcional ("n1"…) para moverlo o achicarlo con transformar en este mismo pedido. Uno encima de cada subtítulo es emojis_subtitulos.',
  },
  {
    op: 'encuadre',
    forma: '{"op":"encuadre","ref":"v1","proporcion":"9:16"}',
    para: `«Recortar» el CUADRO de un clip de video o imagen, como el diálogo de la barra (el tiempo se recorta con recortar). Uno de tres: "proporcion" (${PROPORCIONES_ENCUADRE.join(', ')}; "original" es la del archivo) deja el rectángulo más grande con esa forma, centrado en el de ahora; o "izquierda", "arriba", "derecha" y "abajo", el % del archivo que se le saca a cada lado (de 0 a 95; lo que no pongas, 0; entre dos lados opuestos queda al menos el 2 %); o "quitar": true lo devuelve entero. El de ahora va en "encuadre" del elemento.`,
  },
];

/**
 * Lo que el editor sabe hacer con la mano y el chat NO (todavía). Va al final del catálogo
 * para que la IA lo DIGA en el resumen en vez de simularlo con otra operación.
 */
export const NO_SE_PUEDE_CHAT =
  'agregar a la línea de tiempo videos, imágenes, música, sonidos, formas o stickers de la biblioteca que no son emojis (sustituir el archivo de un clip que ya está, sí: reemplazar_clip; fotos de apoyo según lo que se dice, sí: broll; un emoji, sí: agregar_emoji; emojis encima de los subtítulos, sí: emojis_subtitulos; un motion graphic, sí: agregar_motion); importar archivos a Multimedia (sólo se usan los de "medios"); usar una plantilla de anuncio en un proyecto que ya tiene algo (desde la pestaña Plantillas, «Utilizar plantilla» la arma en un proyecto nuevo); voz en off o texto a voz; avatar de IA; fotogramas clave (animar la posición o la escala en el tiempo); máscaras; quitar el fondo de un clip o chroma key (el fondo del LIENZO, sí: fondo_lienzo); guardar un preset de subtítulos nuevo (se guarda desde el panel del subtítulo); guardar un efecto de texto propio («Guardar como parámetro predefinido», en el panel); pegar atributos de un elemento en otro; y cambiar una propiedad que tiene fotogramas clave ("fotogramas" en el elemento)';

const IDS_OP = new Set<string>(OPERACIONES_CHAT.map((o) => o.op));

/** El catálogo como lo lee la IA (va en el slot {{catalogo}} del prompt): una operación por renglón y lo que no se puede. */
export function catalogoParaPrompt(senales?: SenalesNegocio | null): string {
  return [
    // usar_plantilla se rearma con las señales: sus plantillas van en el orden de la pestaña, con las sugeridas primero.
    // agregar_motion lleva debajo el catálogo del motor (lib/motion), que no va en su `para` (es también la API).
    ...OPERACIONES_CHAT.map((o) => `- ${o.forma} → ${
      o.op === 'usar_plantilla' ? paraUsarPlantilla(senales) : o.op === 'agregar_motion' ? `${o.para} Las plantillas:\n${catalogoMotionChat()}` : o.para
    }`),
    '',
    `NO SE PUEDE DESDE EL CHAT (dilo en el resumen, no lo simules): ${NO_SE_PUEDE_CHAT}.`,
  ].join('\n');
}

/** Forma del JSON de respuesta (va en el slot {{formato}}). */
export const FORMATO_CHAT = `Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin markdown ni texto fuera del JSON, con esta forma:
{"resumen": "una frase para la persona: qué vas a cambiar, o por qué no se puede", "operaciones": [ …operaciones del catálogo, en el orden en que se aplican… ]}
Si el pedido no se puede hacer con el catálogo, "operaciones" va vacío y el resumen dice qué no se puede. Si sólo se puede una parte, haz esa parte y el resumen dice qué parte no.`;

// ─────────────────────────────────────────────────────────────────────────────
// Validar lo que devolvió la IA (la FORMA; las referencias y los nombres los mira el editor)
// ─────────────────────────────────────────────────────────────────────────────

type Validada = { ok: true; op: OperacionChat } | { ok: false; motivo: string };

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const esRef = (x: unknown): x is string => typeof x === 'string' && /^[a-z]\d{1,4}$/.test(x);
/** Una ref NUEVA (la que la IA le pone a lo que agrega): «n1», «n2»… */
const esRefNueva = (x: unknown): x is string => esRef(x) && x.startsWith('n');
/** La ref de un medio de Multimedia ("medios" en la vista): «m1», «m2»… */
const esRefMedio = (x: unknown): x is string => typeof x === 'string' && /^m\d{1,4}$/.test(x);
const numero = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const textoValido = (x: unknown): string | null => {
  if (typeof x !== 'string') return null;
  const t = x.trim();
  return t && t.length <= TOPES_CHAT.texto ? t : null;
};
const enRango = (n: number | null, min: number, max: number): n is number => n !== null && n >= min && n <= max;
/** Los tiempos se guardan a la centésima: lo que la IA mande con más decimales no cambia nada. */
const centesima = (n: number) => Math.round(n * 100) / 100;
/** El margen del punto flotante al comparar centésimas (2.15 - 2.1 da 0.0499…). */
const EPS = 1e-9;
const decima = (n: number) => Math.round(n * 10) / 10;

/** «Ninguna» / «ninguno» / null: sacar lo que haya. */
const NINGUNO = new Set(['ninguna', 'ninguno', 'none', '']);
/** Un id de catálogo («fundido-negro», «calido»), en minúsculas; `null` = quitar; `undefined` = sin forma. */
function idCatalogo(x: unknown, conNinguno: boolean): string | null | undefined {
  if (x === null && conNinguno) return null;
  if (typeof x !== 'string') return undefined;
  const id = x.trim().toLowerCase();
  if (NINGUNO.has(id)) return conNinguno ? null : undefined;
  return /^[a-z0-9][a-z0-9.-]{0,47}$/.test(id) ? id : undefined;
}

/** «#ffd400», «#FD0» o «ffd400» → «#ffd400»; null si no es un color. */
export function colorHex(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(x.trim());
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`;
}

/** Las claves que sobran en una operación de campos sueltos: se rechazan, no se ignoran. */
function sobrantes(raw: Record<string, unknown>, validas: readonly string[]): string | null {
  const extra = Object.keys(raw).find((k) => k !== 'op' && k !== 'ref' && !validas.includes(k));
  return extra ?? null;
}

const CAMPOS_ESTILO = [
  'fuente', 'tamano', 'color', 'negrita', 'cursiva', 'subrayado', 'mayusculas', 'alineacion', 'espaciado',
  'interlineado', 'trazo', 'grosor_trazo', 'sombra', 'fondo', 'opacidad_fondo', 'resplandor',
] as const;
const CAMPOS_TRANSFORMAR = ['x', 'y', 'escala', 'rotacion', 'opacidad', 'mezcla'] as const;

function validarEstilo(raw: Record<string, unknown>): { ok: true; estilo: EstiloTextoChat } | { ok: false; motivo: string } {
  const extra = sobrantes(raw, CAMPOS_ESTILO);
  if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es un estilo de texto que pueda cambiar` };
  const e: EstiloTextoChat = {};
  const mal = (campo: string) => ({ ok: false as const, motivo: `un estilo de texto con «${campo}» inválido` });
  const bool = (k: 'negrita' | 'cursiva' | 'subrayado') => {
    if (raw[k] === undefined) return true;
    if (typeof raw[k] !== 'boolean') return false;
    e[k] = raw[k] as boolean;
    return true;
  };
  const colorO = (k: 'trazo' | 'fondo' | 'resplandor') => {
    if (raw[k] === undefined) return true;
    if (raw[k] === false) { e[k] = false; return true; }
    const c = colorHex(raw[k]);
    if (!c) return false;
    e[k] = c;
    return true;
  };
  const num = (k: 'tamano' | 'espaciado' | 'interlineado' | 'grosor_trazo' | 'opacidad_fondo', min: number, max: number, redondeo: (n: number) => number) => {
    if (raw[k] === undefined) return true;
    const n = numero(raw[k]);
    if (!enRango(n, min, max)) return false;
    e[k] = redondeo(n);
    return true;
  };
  if (raw.fuente !== undefined) {
    if (typeof raw.fuente !== 'string' || !raw.fuente.trim() || raw.fuente.trim().length > 60) return mal('fuente');
    e.fuente = raw.fuente.trim();
  }
  if (!num('tamano', TOPES_CHAT.tamanoMin, TOPES_CHAT.tamanoMax, Math.round)) return mal('tamano');
  if (raw.color !== undefined) {
    const c = colorHex(raw.color);
    if (!c) return mal('color');
    e.color = c;
  }
  for (const k of ['negrita', 'cursiva', 'subrayado'] as const) if (!bool(k)) return mal(k);
  if (raw.mayusculas !== undefined) {
    if (typeof raw.mayusculas !== 'string' || !['ninguno', 'mayusculas', 'minusculas', 'titulo'].includes(raw.mayusculas)) return mal('mayusculas');
    e.mayusculas = raw.mayusculas as EstiloTextoChat['mayusculas'];
  }
  if (raw.alineacion !== undefined) {
    if (!['izquierda', 'centro', 'derecha'].includes(String(raw.alineacion))) return mal('alineacion');
    e.alineacion = raw.alineacion as EstiloTextoChat['alineacion'];
  }
  if (!num('espaciado', TOPES_CHAT.espaciadoMin, TOPES_CHAT.espaciadoMax, decima)) return mal('espaciado');
  if (!num('interlineado', TOPES_CHAT.interlineadoMin, TOPES_CHAT.interlineadoMax, decima)) return mal('interlineado');
  for (const k of ['trazo', 'fondo', 'resplandor'] as const) if (!colorO(k)) return mal(k);
  if (!num('grosor_trazo', 0, 100, Math.round)) return mal('grosor_trazo');
  if (!num('opacidad_fondo', 0, 100, Math.round)) return mal('opacidad_fondo');
  if (raw.sombra !== undefined) {
    if (typeof raw.sombra === 'boolean') e.sombra = raw.sombra;
    else {
      const c = colorHex(raw.sombra);
      if (!c) return mal('sombra');
      e.sombra = c;
    }
  }
  if (!Object.keys(e).length) return { ok: false, motivo: 'un estilo de texto sin cambios' };
  return { ok: true, estilo: e };
}

function validarTransformar(raw: Record<string, unknown>): { ok: true; cambios: TransformChat } | { ok: false; motivo: string } {
  const extra = sobrantes(raw, CAMPOS_TRANSFORMAR);
  if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo que transformar pueda cambiar` };
  const c: TransformChat = {};
  const mal = (campo: string) => ({ ok: false as const, motivo: `un cambio de «${campo}» fuera de rango` });
  const tomar = (k: 'x' | 'y' | 'escala' | 'rotacion' | 'opacidad', min: number, max: number, redondeo: (n: number) => number) => {
    if (raw[k] === undefined) return true;
    const n = numero(raw[k]);
    if (!enRango(n, min, max)) return false;
    c[k] = redondeo(n);
    return true;
  };
  if (!tomar('x', -TOPES_CHAT.posicionMax, TOPES_CHAT.posicionMax, Math.round)) return mal('x');
  if (!tomar('y', -TOPES_CHAT.posicionMax, TOPES_CHAT.posicionMax, Math.round)) return mal('y');
  if (!tomar('escala', TOPES_CHAT.escalaMin, TOPES_CHAT.escalaMax, decima)) return mal('escala');
  if (!tomar('rotacion', -360, 360, decima)) return mal('rotacion');
  if (!tomar('opacidad', 0, 100, Math.round)) return mal('opacidad');
  if (raw.mezcla !== undefined) {
    const m = String(raw.mezcla).trim().toLowerCase();
    if (!Object.hasOwn(MEZCLAS, m)) return { ok: false, motivo: `«${m.slice(0, 30)}» no es un modo de mezcla` };
    c.mezcla = m;
  }
  if (!Object.keys(c).length) return { ok: false, motivo: 'un transformar sin cambios' };
  return { ok: true, cambios: c };
}

function validarAjustes(raw: Record<string, unknown>): { ok: true; valores: Partial<Record<ClaveAjuste, number>> } | { ok: false; motivo: string } {
  const claves = Object.keys(AJUSTES_COLOR);
  const extra = sobrantes(raw, claves);
  if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es un ajuste de color` };
  const valores: Partial<Record<ClaveAjuste, number>> = {};
  for (const k of claves as ClaveAjuste[]) {
    if (raw[k] === undefined) continue;
    const n = numero(raw[k]);
    const r = AJUSTES_COLOR[k];
    if (!enRango(n, r.min, r.max)) return { ok: false, motivo: `«${k}» va de ${r.min} a ${r.max}` };
    valores[k] = Math.round(n);
  }
  if (!Object.keys(valores).length) return { ok: false, motivo: 'un ajuste de color sin valores' };
  return { ok: true, valores };
}

/**
 * Los "textos" y los "clips" de usar_plantilla. Lo que existe, lo vacío y el máximo de cada
 * hueco los decide `validarValores` del catálogo (una regla, un lugar: lo usan también la
 * page y la API); acá sólo la forma del chat (cada cosa en su lista, un clip con la ref de un medio).
 */
function valoresDePlantilla(
  p: Plantilla,
  textosRaw: unknown,
  clipsRaw: unknown,
): { ok: true; textos: Record<string, string>; clips: Record<string, string> } | { ok: false; motivo: string } {
  if (textosRaw !== undefined && !esObjeto(textosRaw)) return { ok: false, motivo: '"textos" va como {"hueco": "texto"}' };
  if (clipsRaw !== undefined && !esObjeto(clipsRaw)) return { ok: false, motivo: '"clips" va como {"hueco": "m1"}' };
  const textos = (textosRaw ?? {}) as Record<string, unknown>;
  const clips = (clipsRaw ?? {}) as Record<string, unknown>;
  const tipo = new Map(huecosDe(p).map((h) => [h.nombre, h.tipo]));
  for (const nombre of Object.keys(textos)) {
    if (tipo.get(nombre) === 'clip') return { ok: false, motivo: `«${nombre.slice(0, 30)}» es un hueco de clip: va en "clips"` };
  }
  for (const [nombre, medio] of Object.entries(clips)) {
    if (tipo.get(nombre) === 'texto') return { ok: false, motivo: `«${nombre.slice(0, 30)}» es un hueco de texto: va en "textos"` };
    if (tipo.has(nombre) && !esRefMedio(medio)) return { ok: false, motivo: `«${nombre.slice(0, 30)}» va con la ref de un medio («m1», «m2»…)` };
  }
  const v = validarValores(p, { ...textos, ...Object.fromEntries(Object.entries(clips).map(([k, m]) => [k, { medio: m }])) });
  if (!v.ok) return v;
  const salida = { textos: {} as Record<string, string>, clips: {} as Record<string, string> };
  for (const [nombre, valor] of Object.entries(v.valores)) {
    if (typeof valor === 'string') salida.textos[nombre] = valor;
    else salida.clips[nombre] = valor.medio;
  }
  return { ok: true, ...salida };
}

// ─────────────────────────────────────────────────────────────────────────────
// Los motion graphics (lib/motion): la validación es la del motor, estricta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cada campo de motion y su tipo. Una clave tiene el MISMO tipo en todas las plantillas (lo fija el test): de eso viven
 * editar_motion (que no sabe la plantilla hasta mirar la línea de tiempo) y la API (que recibe todo como texto).
 */
export const TIPO_CAMPO_MOTION: ReadonlyMap<string, CampoMotion['tipo']> = new Map(
  PLANTILLAS_MOTION.flatMap((p) => camposDe(p).map((c) => [c.clave, c.tipo] as const)),
);

export type ValidaMotion = { ok: true; valores: ValoresMotion } | { ok: false; motivo: string };

/**
 * Los "valores" de un motion graphic contra SU plantilla, con `normalizarMotion` ESTRICTO (la única validación del
 * motor): un campo que no es de la plantilla, un texto más largo que su tope, un obligatorio vacío, un color o un número
 * malos se RECHAZAN con su motivo, nunca se recortan. Devuelve sólo los campos que vinieron, normalizados (validar lo
 * ya validado da lo mismo). `alAgregar`: además, los textos obligatorios y los datos de la persona tienen que venir.
 */
export function valoresMotionValidos(plantilla: IdPlantilla, raw: unknown, { alAgregar = false }: { alAgregar?: boolean } = {}): ValidaMotion {
  const nombre = DEF_MOTION[plantilla].nombre;
  if (raw !== undefined && !esObjeto(raw)) return { ok: false, motivo: '"valores" va como {"campo": valor}' };
  const entrada = (raw ?? {}) as Record<string, unknown>;
  const claves = Object.keys(entrada);
  if (!alAgregar && !claves.length) return { ok: false, motivo: 'un cambio de motion graphic sin valores' };
  if ('plantilla' in entrada) return { ok: false, motivo: 'la plantilla de un motion graphic no se cambia: bórralo y agrega otro con agregar_motion' };
  const { spec, descartes } = normalizarMotion({ plantilla, valores: entrada }, { estricto: true });
  if (descartes.length) return { ok: false, motivo: `el motion «${nombre}»: ${descartes.slice(0, 3).join('; ')}`.slice(0, 300) };
  if (alAgregar) {
    const faltan = camposDe(plantilla).filter(
      (c) => ((c.tipo === 'texto' && c.obligatorio) || DATOS_MOTION[plantilla]?.includes(c.clave)) && !(c.clave in entrada),
    );
    if (faltan.length) {
      return { ok: false, motivo: `el motion «${nombre}» necesita ${faltan.map((c) => `"${c.clave}"`).join(' y ')}: sale de lo que dijo la persona, no se inventa` };
    }
  }
  return { ok: true, valores: Object.fromEntries(claves.map((k) => [k, spec.valores[k]])) };
}

/**
 * Lo que se INSERTA al agregar desde el chat o la API: el estilo de la plantilla (tono, colores, fondo, fuente), sin sus
 * textos ni sus estrellas de EJEMPLO («Ana Pérez», «+1250», cinco estrellas no son de la persona: las skills de motion,
 * «nunca inventes un nombre, una cifra o una calificación»), y encima lo pedido.
 */
export function valoresAlAgregar(plantilla: IdPlantilla, valores: ValoresMotion): ValoresMotion {
  const base = valoresPorDefecto(plantilla);
  for (const c of camposDe(plantilla)) {
    if (c.tipo === 'texto') base[c.clave] = '';
    else if (c.clave === 'estrellas') base[c.clave] = 0;
  }
  return { ...base, ...valores };
}

/** «Título «50% off» · Tono Enérgico»: unos campos de motion en palabras (la revisión, la tarjeta de la propuesta). */
export function textoValoresMotion(valores: ValoresMotion, plantilla?: IdPlantilla | null): string {
  const campo = (k: string): CampoMotion | undefined =>
    (plantilla ? camposDe(plantilla) : PLANTILLAS_MOTION.flatMap((p) => camposDe(p))).find((c) => c.clave === k);
  return Object.entries(valores).map(([k, v]) => {
    const c = campo(k);
    const rotulo = (c?.rotulo ?? k).replace(/ \(.*$/, '');
    if (c?.tipo === 'texto' || (typeof v === 'string' && !c)) {
      const s = String(v).replace(/\s+/g, ' ').trim();
      return s ? `${rotulo} «${s.length > 60 ? `${s.slice(0, 59)}…` : s}»` : `${rotulo} vacío`;
    }
    if (c?.tipo === 'opcion') return `${rotulo} ${c.clave === 'tono' ? (ROTULO_TONO[v as Tono] ?? String(v)) : String(v)}`;
    if (typeof v === 'boolean') return `${rotulo} ${v ? 'sí' : 'no'}`;
    return `${rotulo} ${typeof v === 'number' ? String(v).replace('.', ',') : String(v)}`;
  }).join(' · ');
}

/**
 * La FORMA de los valores de editar_motion, que todavía no sabe de qué plantilla es el elemento (eso lo mira la
 * revisión contra la línea de tiempo, con `valoresMotionValidos`): cada campo tiene que existir en alguna plantilla y
 * su valor ser válido para alguna de las que lo tienen. Lo que no, se rechaza con el motivo del motor.
 */
function valoresMotionDeForma(raw: unknown): ValidaMotion {
  if (!esObjeto(raw) || !Object.keys(raw).length) return { ok: false, motivo: 'un cambio de motion graphic sin "valores" ({"campo": valor})' };
  const valores: ValoresMotion = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'plantilla') return { ok: false, motivo: 'la plantilla de un motion graphic no se cambia: bórralo y agrega otro con agregar_motion' };
    const con = PLANTILLAS_MOTION.filter((p) => camposDe(p).some((c) => c.clave === k));
    if (!con.length) return { ok: false, motivo: `«${k.slice(0, 30)}» no es un campo de ningún motion graphic` };
    let primera: ValidaMotion | null = null;
    for (const p of con) {
      const r = valoresMotionValidos(p, { [k]: v });
      if (r.ok) { valores[k] = r.valores[k]; primera = r; break; }
      primera ??= r;
    }
    // Sin el nombre de la plantilla: todavía no se sabe de cuál es el elemento.
    if (primera && !primera.ok) return { ok: false, motivo: primera.motivo.replace(/^el motion «[^»]*»: /, '') };
  }
  return { ok: true, valores };
}

const ENVUELTAS: Record<string, string> = { estilo_texto: 'estilo', transformar: 'cambios', ajustar_color: 'valores' };

/**
 * `validarOperacion` devuelve estas tres con sus campos adentro de una clave, pero la IA los escribe sueltos. La ruta valida
 * y PanelChat vuelve a validar lo que contestó la ruta: sin esto, la segunda pasada las tiraba a todas (lo encontró el
 * carrusel de Leila en el Image Editor, 30/10/2026; tests/video-editor-chat.test.ts).
 */
function desenvuelta(raw: Record<string, unknown>): Record<string, unknown> {
  const clave = ENVUELTAS[String(raw.op)];
  if (!clave || !esObjeto(raw[clave])) return raw;
  const { [clave]: adentro, ...resto } = raw;
  return { ...(adentro as Record<string, unknown>), ...resto };
}

/**
 * Una operación de la IA, validada; o el motivo por el que no. El motivo es corto: lo ve la
 * persona en la revisión («No se aplica: …»).
 */
export function validarOperacion(crudo: unknown): Validada {
  if (!esObjeto(crudo) || typeof crudo.op !== 'string') return { ok: false, motivo: 'una operación sin forma' };
  const op = crudo.op;
  if (!IDS_OP.has(op)) return { ok: false, motivo: `«${op.slice(0, 30)}» no es algo que pueda hacer` };
  const raw = desenvuelta(crudo);
  const ref = raw.ref;
  switch (op as IdOperacion) {
    case 'agregar_texto': {
      const texto = textoValido(raw.texto);
      const inicio = numero(raw.inicio);
      const duracion = numero(raw.duracion);
      if (!texto) return { ok: false, motivo: `un texto vacío o de más de ${TOPES_CHAT.texto} caracteres` };
      if (!enRango(inicio, 0, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'un texto sin inicio válido' };
      if (!enRango(duracion, TOPES_CHAT.duracionMin, TOPES_CHAT.duracionMax)) return { ok: false, motivo: 'un texto sin duración válida' };
      if (ref !== undefined && !esRefNueva(ref)) return { ok: false, motivo: 'un texto nuevo con una ref que no es «n1», «n2»…' };
      const plantilla = raw.plantilla === undefined ? undefined : idCatalogo(raw.plantilla, false);
      if (plantilla === undefined && raw.plantilla !== undefined) return { ok: false, motivo: 'un texto nuevo con una plantilla sin forma (el id de DISPONIBLES.plantillas_texto)' };
      return {
        ok: true,
        op: { op: 'agregar_texto', texto, inicio: centesima(inicio), duracion: centesima(duracion), ...(ref ? { ref } : {}), ...(plantilla ? { plantilla } : {}) },
      };
    }
    case 'cambiar_texto': {
      const texto = textoValido(raw.texto);
      if (!esRef(ref) || !texto) return { ok: false, motivo: 'un cambio de texto incompleto' };
      return { ok: true, op: { op: 'cambiar_texto', ref, texto } };
    }
    case 'borrar': {
      const refs = Array.isArray(raw.refs) ? [...new Set(raw.refs.filter(esRef))] : [];
      if (!refs.length) return { ok: false, motivo: 'un borrado sin elementos' };
      return { ok: true, op: { op: 'borrar', refs } };
    }
    case 'mover': {
      const inicio = numero(raw.inicio);
      if (!esRef(ref) || !enRango(inicio, 0, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'un movimiento incompleto' };
      return { ok: true, op: { op: 'mover', ref, inicio: centesima(inicio) } };
    }
    case 'duracion': {
      const duracion = numero(raw.duracion);
      if (!esRef(ref) || !enRango(duracion, TOPES_CHAT.duracionMin, TOPES_CHAT.duracionMax)) return { ok: false, motivo: 'una duración inválida' };
      return { ok: true, op: { op: 'duracion', ref, duracion: centesima(duracion) } };
    }
    case 'dividir': {
      const en = numero(raw.en);
      if (!esRef(ref) || !enRango(en, 0, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'un corte incompleto' };
      return { ok: true, op: { op: 'dividir', ref, en: centesima(en) } };
    }
    case 'recortar': {
      const inicio = raw.inicio === undefined ? undefined : numero(raw.inicio);
      const fin = raw.fin === undefined ? undefined : numero(raw.fin);
      if (!esRef(ref) || (inicio === undefined && fin === undefined)) return { ok: false, motivo: 'un recorte sin bordes' };
      if (inicio !== undefined && !enRango(inicio, 0, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'un recorte con un inicio inválido' };
      if (fin !== undefined && !enRango(fin, 0, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'un recorte con un fin inválido' };
      // DESPUÉS de redondear (con un margen por el punto flotante): validar lo ya validado tiene que dar lo mismo.
      if (inicio != null && fin != null && centesima(fin) - centesima(inicio) < TOPES_CHAT.duracionMin - EPS) return { ok: false, motivo: 'un recorte que deja el clip sin largo' };
      return { ok: true, op: { op: 'recortar', ref, ...(inicio != null ? { inicio: centesima(inicio) } : {}), ...(fin != null ? { fin: centesima(fin) } : {}) } };
    }
    case 'volumen': {
      const db = numero(raw.db);
      if (!esRef(ref) || !enRango(db, TOPES_CHAT.volumenMinDb, TOPES_CHAT.volumenMaxDb)) return { ok: false, motivo: `un volumen fuera de ${TOPES_CHAT.volumenMinDb} a ${TOPES_CHAT.volumenMaxDb} dB` };
      return { ok: true, op: { op: 'volumen', ref, db: Math.round(db * 10) / 10 } };
    }
    case 'silenciar': {
      if (!esRef(ref) || typeof raw.silenciado !== 'boolean') return { ok: false, motivo: 'un silencio incompleto' };
      return { ok: true, op: { op: 'silenciar', ref, silenciado: raw.silenciado } };
    }
    case 'fundido': {
      const entrada = raw.entrada === undefined ? undefined : numero(raw.entrada);
      const salida = raw.salida === undefined ? undefined : numero(raw.salida);
      if (!esRef(ref) || (entrada === undefined && salida === undefined)) return { ok: false, motivo: 'un fundido sin segundos' };
      if ((entrada !== undefined && !enRango(entrada, 0, TOPES_CHAT.duracionMax)) || (salida !== undefined && !enRango(salida, 0, TOPES_CHAT.duracionMax))) {
        return { ok: false, motivo: 'un fundido fuera de rango' };
      }
      return { ok: true, op: { op: 'fundido', ref, ...(entrada != null ? { entrada: decima(entrada) } : {}), ...(salida != null ? { salida: decima(salida) } : {}) } };
    }
    case 'reducir_ruido': {
      if (!esRef(ref) || typeof raw.activo !== 'boolean') return { ok: false, motivo: 'un «reducir el ruido» incompleto' };
      return { ok: true, op: { op: 'reducir_ruido', ref, activo: raw.activo } };
    }
    case 'normalizar': {
      if (!esRef(ref) || typeof raw.activo !== 'boolean') return { ok: false, motivo: 'un «normalizar» incompleto' };
      const objetivo = raw.objetivo === undefined ? undefined : String(raw.objetivo).trim().toLowerCase();
      if (objetivo !== undefined && !Object.hasOwn(OBJETIVOS_NORMALIZAR, objetivo)) return { ok: false, motivo: `«${objetivo.slice(0, 20)}» no es una intensidad objetivo` };
      return { ok: true, op: { op: 'normalizar', ref, activo: raw.activo, ...(objetivo ? { objetivo: objetivo as ObjetivoNormalizar } : {}) } };
    }
    case 'separar_audio': {
      if (!esRef(ref) || typeof raw.separado !== 'boolean') return { ok: false, motivo: 'un «extraer audio» incompleto' };
      return { ok: true, op: { op: 'separar_audio', ref, separado: raw.separado } };
    }
    case 'ocultar': {
      if (!esRef(ref) || typeof raw.oculto !== 'boolean') return { ok: false, motivo: 'un ocultar incompleto' };
      return { ok: true, op: { op: 'ocultar', ref, oculto: raw.oculto } };
    }
    case 'velocidad': {
      if (!esRef(ref)) return { ok: false, motivo: 'una velocidad sin elemento' };
      const tono = raw.cambiar_tono;
      if (tono !== undefined && typeof tono !== 'boolean') return { ok: false, motivo: 'un «cambiar_tono» que no es true o false' };
      if (raw.curva !== undefined) {
        if (raw.x !== undefined) return { ok: false, motivo: 'una velocidad con "x" y "curva" a la vez' };
        const curva = idCatalogo(raw.curva, true);
        if (curva === undefined) return { ok: false, motivo: 'una curva de velocidad sin forma' };
        return { ok: true, op: { op: 'velocidad', ref, curva } };
      }
      const x = numero(raw.x);
      if (!enRango(x, TOPES_CHAT.velocidadMin, TOPES_CHAT.velocidadMax)) return { ok: false, motivo: `una velocidad fuera de ${TOPES_CHAT.velocidadMin}× a ${TOPES_CHAT.velocidadMax}×` };
      return { ok: true, op: { op: 'velocidad', ref, x: centesima(x), ...(tono !== undefined ? { cambiar_tono: tono } : {}) } };
    }
    case 'transicion': {
      const id = idCatalogo(raw.id, true);
      const duracion = raw.duracion === undefined ? undefined : numero(raw.duracion);
      if (!esRef(ref) || id === undefined) return { ok: false, motivo: 'una transición incompleta' };
      if (duracion !== undefined && !enRango(duracion, TOPES_CHAT.efectoMin, TOPES_CHAT.duracionMax)) return { ok: false, motivo: `una transición de menos de ${TOPES_CHAT.efectoMin} s` };
      return { ok: true, op: { op: 'transicion', ref, id, ...(duracion != null && id ? { duracion: decima(duracion) } : {}) } };
    }
    case 'animacion': {
      const tipo = String(raw.tipo ?? '').trim().toLowerCase();
      if (!['entrada', 'salida', 'combinado', 'bucle'].includes(tipo)) return { ok: false, motivo: 'una animación sin tipo (entrada, salida, combinado o bucle)' };
      const id = idCatalogo(raw.id, true);
      const duracion = raw.duracion === undefined ? undefined : numero(raw.duracion);
      if (!esRef(ref) || id === undefined) return { ok: false, motivo: 'una animación incompleta' };
      if (duracion !== undefined && !enRango(duracion, TOPES_CHAT.efectoMin, TOPES_CHAT.duracionMax)) return { ok: false, motivo: `una animación de menos de ${TOPES_CHAT.efectoMin} s` };
      return { ok: true, op: { op: 'animacion', ref, tipo: tipo as CategoriaAnimChat, id, ...(duracion != null && id ? { duracion: decima(duracion) } : {}) } };
    }
    case 'filtro': {
      const id = idCatalogo(raw.id, true);
      const intensidad = raw.intensidad === undefined ? undefined : numero(raw.intensidad);
      if (!esRef(ref) || id === undefined) return { ok: false, motivo: 'un filtro incompleto' };
      if (intensidad !== undefined && !enRango(intensidad, 0, 100)) return { ok: false, motivo: 'una intensidad de filtro fuera de 0 a 100' };
      return { ok: true, op: { op: 'filtro', ref, id, ...(intensidad != null && id ? { intensidad: Math.round(intensidad) } : {}) } };
    }
    case 'efecto': {
      const id = idCatalogo(raw.id, false);
      if (!esRef(ref) || !id) return { ok: false, motivo: 'un efecto incompleto' };
      if (raw.quitar !== undefined && typeof raw.quitar !== 'boolean') return { ok: false, motivo: 'un «quitar» que no es true o false' };
      return { ok: true, op: { op: 'efecto', ref, id, ...(raw.quitar === true ? { quitar: true as const } : {}) } };
    }
    case 'capa_efecto': {
      const tipo = raw.tipo;
      const id = idCatalogo(raw.id, false);
      const inicio = numero(raw.inicio);
      const duracion = numero(raw.duracion);
      if ((tipo !== 'filtro' && tipo !== 'efecto') || !id) return { ok: false, motivo: 'una capa de efecto sin tipo o sin id' };
      if (!enRango(inicio, 0, TOPES_CHAT.tiempoMax) || !enRango(duracion, TOPES_CHAT.duracionMin, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'una capa de efecto sin tiempos válidos' };
      if (ref !== undefined && !esRefNueva(ref)) return { ok: false, motivo: 'una capa nueva con una ref que no es «n1», «n2»…' };
      return { ok: true, op: { op: 'capa_efecto', tipo: tipo as 'filtro' | 'efecto', id, inicio: centesima(inicio), duracion: centesima(duracion), ...(ref ? { ref } : {}) } };
    }
    case 'ajustar_color': {
      if (!esRef(ref)) return { ok: false, motivo: 'un ajuste de color sin elemento' };
      const v = validarAjustes(raw);
      return v.ok ? { ok: true, op: { op: 'ajustar_color', ref, valores: v.valores } } : v;
    }
    case 'estilo_texto': {
      if (!esRef(ref)) return { ok: false, motivo: 'un estilo de texto sin elemento' };
      const v = validarEstilo(raw);
      return v.ok ? { ok: true, op: { op: 'estilo_texto', ref, estilo: v.estilo } } : v;
    }
    case 'transformar': {
      if (!esRef(ref)) return { ok: false, motivo: 'un transformar sin elemento' };
      const v = validarTransformar(raw);
      return v.ok ? { ok: true, op: { op: 'transformar', ref, cambios: v.cambios } } : v;
    }
    case 'reflejar': {
      const h = raw.horizontal;
      const v = raw.vertical;
      if (!esRef(ref) || (h === undefined && v === undefined)) return { ok: false, motivo: 'un reflejar incompleto' };
      if ((h !== undefined && typeof h !== 'boolean') || (v !== undefined && typeof v !== 'boolean')) return { ok: false, motivo: 'un reflejar que no es true o false' };
      return { ok: true, op: { op: 'reflejar', ref, ...(h !== undefined ? { horizontal: h } : {}), ...(v !== undefined ? { vertical: v } : {}) } };
    }
    case 'revertir': {
      if (!esRef(ref) || typeof raw.revertido !== 'boolean') return { ok: false, motivo: 'un revertir incompleto' };
      return { ok: true, op: { op: 'revertir', ref, revertido: raw.revertido } };
    }
    case 'congelar': {
      const en = numero(raw.en);
      if (!esRef(ref) || !enRango(en, 0, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'un congelar incompleto' };
      return { ok: true, op: { op: 'congelar', ref, en: centesima(en) } };
    }
    case 'reemplazar_en_subtitulos': {
      const buscar = textoValido(raw.buscar);
      const reemplazo = typeof raw.reemplazo === 'string' ? raw.reemplazo.trim() : null;
      if (!buscar || reemplazo === null || reemplazo.length > TOPES_CHAT.texto) return { ok: false, motivo: 'un reemplazo incompleto' };
      if (buscar === reemplazo) return { ok: false, motivo: 'un reemplazo que no cambia nada' };
      return { ok: true, op: { op: 'reemplazar_en_subtitulos', buscar, reemplazo } };
    }
    case 'generar_subtitulos':
      return { ok: true, op: { op: 'generar_subtitulos' } };
    case 'resaltar_palabras': {
      const extra = Object.keys(raw).find((k) => !['op', 'modo', 'color', 'opacidad_no_dichas'].includes(k));
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo del resaltado que pueda cambiar` };
      const modo = raw.modo;
      if (modo !== 'ninguno' && modo !== 'palabra' && modo !== 'frase') return { ok: false, motivo: 'un resaltado sin modo («palabra», «frase» o «ninguno»)' };
      let color: string | undefined;
      if (raw.color !== undefined) {
        const c = colorHex(raw.color);
        if (!c) return { ok: false, motivo: 'un resaltado con un color que no es #RRGGBB' };
        color = c;
      }
      let opacidad: number | undefined;
      if (raw.opacidad_no_dichas !== undefined) {
        const o = numero(raw.opacidad_no_dichas);
        if (!enRango(o, 0, 100)) return { ok: false, motivo: 'un resaltado con «opacidad_no_dichas» fuera de 0 a 100' };
        opacidad = Math.round(o);
      }
      return { ok: true, op: { op: 'resaltar_palabras', modo, ...(color ? { color } : {}), ...(opacidad !== undefined ? { opacidad_no_dichas: opacidad } : {}) } };
    }
    case 'cortar_frase': {
      const frase = textoValido(raw.frase);
      if (!frase) return { ok: false, motivo: 'un corte de frase sin frase' };
      if (raw.vez !== undefined && (typeof raw.vez !== 'number' || !Number.isInteger(raw.vez) || raw.vez < 1)) {
        return { ok: false, motivo: 'un corte de frase con una «vez» que no es 1, 2, 3…' };
      }
      return { ok: true, op: { op: 'cortar_frase', frase, ...(raw.vez !== undefined ? { vez: raw.vez as number } : {}) } };
    }
    case 'cortar_tramo': {
      const inicio = numero(raw.inicio);
      const fin = numero(raw.fin);
      if (!enRango(inicio, 0, TOPES_CHAT.tiempoMax) || !enRango(fin, 0, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'un corte de tramo sin tiempos válidos' };
      // ⚠️ DESPUÉS de redondear (tercera revisión del 21/10): 2.104 → 2.155 pasaba (0.051), se guardaba como 2.1 → 2.15
      // y al volver a validarlo (el GET de las propuestas, el editor) daba 0.0499… y se tiraba. Esa operación quedaba
      // invisible para el editor y su propuesta no se podía cerrar nunca.
      if (centesima(fin) - centesima(inicio) < 0.05 - EPS) return { ok: false, motivo: 'un corte de tramo que termina antes de empezar' };
      return { ok: true, op: { op: 'cortar_tramo', inicio: centesima(inicio), fin: centesima(fin) } };
    }
    case 'eliminar_muletillas':
      return { ok: true, op: { op: 'eliminar_muletillas' } };
    case 'borrar_silencios': {
      if (ref !== undefined && !esRef(ref)) return { ok: false, motivo: 'un «borrar silencios» con un elemento que no es una ref' };
      const pausa = raw.pausa_min === undefined ? undefined : numero(raw.pausa_min);
      // De 0,2 a 2 s (PAUSA_MIN_RANGO de audio/silencios-aviso.ts): con menos, el margen de 80 ms a cada lado no deja nada.
      if (pausa === null || (pausa !== undefined && (pausa < 0.2 - EPS || pausa > 2 + EPS))) return { ok: false, motivo: 'un «borrar silencios» con una pausa mínima fuera de 0,2 a 2 segundos' };
      return { ok: true, op: { op: 'borrar_silencios', ...(ref !== undefined ? { ref } : {}), ...(pausa !== undefined ? { pausa_min: decima(pausa) } : {}) } };
    }
    case 'reemplazar_clip': {
      if (!esRef(ref) || !esRefMedio(raw.medio)) return { ok: false, motivo: 'un reemplazo de clip sin clip o sin medio («m1», «m2»…)' };
      return { ok: true, op: { op: 'reemplazar_clip', ref, medio: raw.medio } };
    }
    case 'usar_plantilla': {
      const extra = sobrantes(raw, ['id', 'textos', 'clips']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de usar_plantilla` };
      const p = plantillaPorId(typeof raw.id === 'string' ? raw.id.trim().toLowerCase() : null);
      if (!p) return { ok: false, motivo: `«${String(raw.id ?? '').slice(0, 30)}» no es una plantilla (son: ${PLANTILLAS.map((x) => x.id).join(', ')})` };
      const v = valoresDePlantilla(p, raw.textos, raw.clips);
      return v.ok ? { ok: true, op: { op: 'usar_plantilla', id: p.id, textos: v.textos, clips: v.clips } } : v;
    }
    case 'animar_palabras': {
      const extra = sobrantes(raw, ['animacion']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de la animación de la palabra` };
      const a = raw.animacion;
      if (a !== 'ninguna' && a !== 'pop' && a !== 'crecer') return { ok: false, motivo: 'una animación de la palabra sin «animacion» («pop», «crecer» o «ninguna»)' };
      return { ok: true, op: { op: 'animar_palabras', animacion: a } };
    }
    case 'palabras_clave': {
      const extra = sobrantes(raw, ['modo', 'palabras', 'color', 'tamano', 'ref']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de las palabras clave` };
      const modo = raw.modo;
      if (modo !== 'auto' && modo !== 'estas' && modo !== 'sumar' && modo !== 'quitar' && modo !== 'ninguna')
        return { ok: false, motivo: 'unas palabras clave sin modo («auto», «estas», «sumar», «quitar» o «ninguna»)' };
      let tamano: number | undefined;
      if (raw.tamano !== undefined) {
        const t = numero(raw.tamano);
        if (!enRango(t, 100, 160)) return { ok: false, motivo: 'unas palabras clave con «tamano» fuera de 100 a 160' };
        tamano = Math.round(t);
      }
      let ref: string | undefined;
      if (raw.ref !== undefined) {
        if (!esRef(raw.ref)) return { ok: false, motivo: 'unas palabras clave con una «ref» que no es la de un subtítulo (t1, t2…)' };
        ref = raw.ref;
      }
      let color: string | undefined;
      if (raw.color !== undefined) {
        const c = colorHex(raw.color);
        if (!c) return { ok: false, motivo: 'unas palabras clave con un color que no es #RRGGBB' };
        color = c;
      }
      let palabras: string[] | undefined;
      if (modo === 'estas' || modo === 'sumar' || modo === 'quitar') {
        const lista = Array.isArray(raw.palabras) ? raw.palabras : [];
        palabras = [...new Set(lista.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter((x) => x && x.length <= 40 && !/\s/.test(x)))].slice(0, 30);
        if (!palabras.length) return { ok: false, motivo: `unas palabras clave «${modo}» sin palabras (una por elemento, sin espacios)` };
      } else if (raw.palabras !== undefined) {
        return { ok: false, motivo: '«palabras» va sólo con los modos «estas», «sumar» y «quitar»' };
      }
      return {
        ok: true,
        op: { op: 'palabras_clave', modo, ...(palabras ? { palabras } : {}), ...(color ? { color } : {}), ...(tamano !== undefined ? { tamano } : {}), ...(ref ? { ref } : {}) },
      };
    }
    case 'usar_preset_subtitulos': {
      const extra = sobrantes(raw, ['preset']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de un preset de subtítulos` };
      const preset = typeof raw.preset === 'string' ? raw.preset.trim() : '';
      if (!preset || preset.length > 80) return { ok: false, motivo: 'un preset de subtítulos sin preset' };
      return { ok: true, op: { op: 'usar_preset_subtitulos', preset } };
    }
    case 'broll': {
      const extra = sobrantes(raw, ['ritmo', 'planos']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo del B-roll` };
      const ritmo = raw.ritmo === undefined ? undefined : raw.ritmo;
      if (ritmo !== undefined && ritmo !== 'poco' && ritmo !== 'normal' && ritmo !== 'mucho') return { ok: false, motivo: 'un B-roll con un ritmo que no es «poco», «normal» ni «mucho»' };
      if (raw.planos !== undefined && typeof raw.planos !== 'boolean') return { ok: false, motivo: 'un B-roll con «planos» que no es sí o no' };
      return { ok: true, op: { op: 'broll', ...(ritmo ? { ritmo } : {}), ...(typeof raw.planos === 'boolean' ? { planos: raw.planos } : {}) } };
    }
    case 'clips_magicos': {
      const extra = sobrantes(raw, ['cuantos']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de los clips mágicos` };
      if (raw.cuantos === undefined) return { ok: true, op: { op: 'clips_magicos' } };
      if (typeof raw.cuantos !== 'number' || !Number.isInteger(raw.cuantos) || raw.cuantos < 1 || raw.cuantos > 10) {
        return { ok: false, motivo: 'unos clips mágicos con «cuantos» fuera de 1 a 10' };
      }
      return { ok: true, op: { op: 'clips_magicos', cuantos: raw.cuantos } };
    }
    case 'edicion_automatica': {
      const extra = sobrantes(raw, []);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de la edición automática (no lleva nada más)` };
      return { ok: true, op: { op: 'edicion_automatica' } };
    }
    case 'emojis_subtitulos': {
      const extra = sobrantes(raw, ['activar']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de los emojis de los subtítulos` };
      if (typeof raw.activar !== 'boolean') return { ok: false, motivo: 'unos emojis de subtítulos sin «activar» (true o false)' };
      return { ok: true, op: { op: 'emojis_subtitulos', activar: raw.activar } };
    }
    case 'agregar_motion': {
      const extra = sobrantes(raw, ['plantilla', 'valores', 'inicio', 'duracion']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de agregar_motion${TIPO_CAMPO_MOTION.has(extra) ? ': los campos van dentro de "valores"' : ''}` };
      const plantilla = typeof raw.plantilla === 'string' ? raw.plantilla.trim().toLowerCase() : '';
      if (!esPlantilla(plantilla)) {
        return { ok: false, motivo: `«${String(raw.plantilla ?? '').slice(0, 30)}» no es un motion graphic (son: ${PLANTILLAS_MOTION.join(', ')})` };
      }
      const inicio = numero(raw.inicio);
      const duracion = raw.duracion === undefined ? undefined : numero(raw.duracion);
      if (!enRango(inicio, 0, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'un motion graphic sin inicio válido' };
      if (duracion !== undefined && !enRango(duracion, TOPES_CHAT.duracionMin, TOPES_CHAT.duracionMax)) return { ok: false, motivo: 'un motion graphic sin duración válida' };
      if (ref !== undefined && !esRefNueva(ref)) return { ok: false, motivo: 'un motion graphic nuevo con una ref que no es «n1», «n2»…' };
      const v = valoresMotionValidos(plantilla, raw.valores, { alAgregar: true });
      if (!v.ok) return v;
      return {
        ok: true,
        op: { op: 'agregar_motion', plantilla, valores: v.valores, inicio: centesima(inicio), ...(duracion != null ? { duracion: centesima(duracion) } : {}), ...(ref ? { ref } : {}) },
      };
    }
    case 'editar_motion': {
      if (!esRef(ref)) return { ok: false, motivo: 'un cambio de motion graphic sin elemento' };
      if (raw.plantilla !== undefined) return { ok: false, motivo: 'la plantilla de un motion graphic no se cambia: bórralo y agrega otro con agregar_motion' };
      const extra = sobrantes(raw, ['valores']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de editar_motion${TIPO_CAMPO_MOTION.has(extra) ? ': los campos van dentro de "valores"' : ''}` };
      const v = valoresMotionDeForma(raw.valores);
      return v.ok ? { ok: true, op: { op: 'editar_motion', ref, valores: v.valores } } : v;
    }
    case 'duplicar': {
      const extra = sobrantes(raw, ['copia']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de duplicar` };
      if (!esRef(ref)) return { ok: false, motivo: 'un duplicar sin elemento' };
      if (raw.copia !== undefined && !esRefNueva(raw.copia)) return { ok: false, motivo: 'una copia con una ref que no es «n1», «n2»…' };
      return { ok: true, op: { op: 'duplicar', ref, ...(raw.copia !== undefined ? { copia: raw.copia as string } : {}) } };
    }
    case 'fondo_lienzo': {
      const extra = sobrantes(raw, ['color', 'desenfoque']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo del fondo del lienzo` };
      if ((raw.color === undefined) === (raw.desenfoque === undefined)) return { ok: false, motivo: 'un fondo del lienzo va con "color" o con "desenfoque" (uno de los dos)' };
      if (raw.color !== undefined) {
        const c = colorHex(raw.color);
        if (!c) return { ok: false, motivo: 'un fondo del lienzo con un color que no es #RRGGBB' };
        return { ok: true, op: { op: 'fondo_lienzo', color: c } };
      }
      const d = typeof raw.desenfoque === 'string' ? raw.desenfoque.trim().toLowerCase() : '';
      if (!Object.hasOwn(DESENFOQUES_FONDO, d)) return { ok: false, motivo: 'un fondo desenfocado va «suave», «medio» o «fuerte»' };
      return { ok: true, op: { op: 'fondo_lienzo', desenfoque: d as DesenfoqueFondo } };
    }
    case 'efecto_texto': {
      const extra = sobrantes(raw, ['id']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de un efecto de texto` };
      const id = idCatalogo(raw.id, true);
      if (!esRef(ref) || id === undefined) return { ok: false, motivo: 'un efecto de texto incompleto' };
      return { ok: true, op: { op: 'efecto_texto', ref, id } };
    }
    case 'agregar_emoji': {
      const extra = sobrantes(raw, ['emoji', 'inicio', 'duracion']);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de agregar_emoji` };
      const emoji = typeof raw.emoji === 'string' ? raw.emoji.trim() : '';
      // UN emoji: corto, sin espacios y con un pictograma (o una bandera). Que esté en la biblioteca lo mira la revisión.
      if (!emoji || emoji.length > 16 || /\s/.test(emoji) || !/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(emoji)) {
        return { ok: false, motivo: 'un emoji que no es UN emoji (🔥, 💰, ✅…)' };
      }
      const inicio = numero(raw.inicio);
      const duracion = numero(raw.duracion);
      if (!enRango(inicio, 0, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'un emoji sin inicio válido' };
      if (!enRango(duracion, TOPES_CHAT.duracionMin, TOPES_CHAT.duracionMax)) return { ok: false, motivo: 'un emoji sin duración válida' };
      if (ref !== undefined && !esRefNueva(ref)) return { ok: false, motivo: 'un emoji nuevo con una ref que no es «n1», «n2»…' };
      return { ok: true, op: { op: 'agregar_emoji', emoji, inicio: centesima(inicio), duracion: centesima(duracion), ...(ref ? { ref } : {}) } };
    }
    case 'encuadre': {
      const extra = sobrantes(raw, ['proporcion', 'quitar', ...LADOS_ENCUADRE]);
      if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo del encuadre` };
      if (!esRef(ref)) return { ok: false, motivo: 'un encuadre sin elemento' };
      const conLados = LADOS_ENCUADRE.some((k) => raw[k] !== undefined);
      const formas = [raw.proporcion !== undefined, raw.quitar !== undefined, conLados].filter(Boolean).length;
      if (formas !== 1) return { ok: false, motivo: 'un encuadre va con "proporcion", con los lados o con "quitar" (uno de los tres)' };
      if (raw.quitar !== undefined) {
        if (raw.quitar !== true) return { ok: false, motivo: 'un encuadre con «quitar» que no es true' };
        return { ok: true, op: { op: 'encuadre', ref, quitar: true } };
      }
      if (raw.proporcion !== undefined) {
        const p = typeof raw.proporcion === 'string' ? raw.proporcion.trim().toLowerCase() : '';
        if (!(PROPORCIONES_ENCUADRE as readonly string[]).includes(p)) return { ok: false, motivo: `«${String(raw.proporcion).slice(0, 20)}» no es una proporción (son: ${PROPORCIONES_ENCUADRE.join(', ')})` };
        return { ok: true, op: { op: 'encuadre', ref, proporcion: p as ProporcionEncuadre } };
      }
      const lados = {} as LadosEncuadre;
      for (const k of LADOS_ENCUADRE) {
        const n = raw[k] === undefined ? 0 : numero(raw[k]);
        if (!enRango(n, 0, 95)) return { ok: false, motivo: `un encuadre con «${k}» fuera de 0 a 95 %` };
        lados[k] = decima(n);
      }
      if (lados.izquierda + lados.derecha > 98 + EPS || lados.arriba + lados.abajo > 98 + EPS) return { ok: false, motivo: 'un encuadre que deja el cuadro sin nada (entre dos lados opuestos queda al menos el 2 %)' };
      if (LADOS_ENCUADRE.every((k) => lados[k] === 0)) return { ok: false, motivo: 'un encuadre sin nada que recortar (para dejarlo entero, "quitar": true)' };
      return { ok: true, op: { op: 'encuadre', ref, ...lados } };
    }
  }
}

/** Todas las de la respuesta: las válidas, en orden, y por qué se descartó cada otra. */
export function validarOperaciones(raw: unknown): { operaciones: OperacionChat[]; descartes: string[] } {
  const lista = Array.isArray(raw) ? raw : [];
  const operaciones: OperacionChat[] = [];
  const descartes: string[] = [];
  for (const r of lista) {
    if (operaciones.length >= TOPES_CHAT.operaciones) {
      descartes.push(`más de ${TOPES_CHAT.operaciones} cambios de una vez`);
      break;
    }
    const v = validarOperacion(r);
    if (v.ok) operaciones.push(v.op);
    else descartes.push(v.motivo);
  }
  return { operaciones, descartes };
}
