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
// la duración, los huecos y sus topes: una plantilla nueva entra sola al prompt.
// =============================================================================

import { PLANTILLAS, huecosDe, plantillaPorId, validarValores, type Plantilla } from './plantillas';

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

/** Lo que la IA puede devolver. Los tiempos van en SEGUNDOS de la línea de tiempo. */
export type OperacionChat =
  | { op: 'agregar_texto'; texto: string; inicio: number; duracion: number; ref?: string }
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
  /** `medio`: la ref de un medio de Multimedia («m1»), de "medios" en la vista. */
  | { op: 'reemplazar_clip'; ref: string; medio: string }
  /** `textos`: hueco → texto; `clips`: hueco → ref de un medio. */
  | { op: 'usar_plantilla'; id: string; textos: Record<string, string>; clips: Record<string, string> };

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
function plantillaEnRenglon(p: Plantilla): string {
  const huecos = huecosDe(p);
  const clips = huecos
    .filter((h) => h.tipo === 'clip')
    .map((h) => `${h.nombre} (${segundosTexto(h.segundos)}${h.acepta && h.acepta !== 'ambos' ? `, sólo ${h.acepta === 'video' ? 'video' : 'foto'}` : ''}${h.opcional ? ', opcional' : ''})`);
  const textos = huecos.filter((h) => h.tipo === 'texto').map((h) => `${h.nombre} (hasta ${h.maxCaracteres}: «${h.muestra}»)`);
  return `  · "${p.id}" «${p.nombre}», ${segundosTexto(p.duracion)}: ${p.descripcion} Clips: ${clips.join(', ')}. Textos: ${textos.join(', ')}.`;
}

/** Lo que lee la IA de usar_plantilla: la regla y el catálogo entero (sale de PLANTILLAS). */
function paraUsarPlantilla(): string {
  return [
    'Arma una PLANTILLA de anuncio vertical, como «Utilizar plantilla»: pasa el lienzo a 9:16 y pone sus clips, textos, animaciones y transiciones. SÓLO con la línea de tiempo VACÍA (ningún elemento en "pistas") y SOLA en el pedido: lo que arma recién tiene ref en el pedido siguiente. "textos": {"hueco": "texto"} con lo que DICTA la persona, hasta el máximo de cada hueco; lo que no llenes queda con el texto de ejemplo para cambiarlo después con cambiar_texto (no lo inventes). "clips": {"hueco": "m1"} con la ref de un medio de "medios"; un video tiene que durar al menos los segundos de su hueco y una foto sirve siempre; lo que no llenes queda con una imagen de muestra para sustituir con reemplazar_clip (los opcionales pueden quedar así). Las plantillas ("id" «nombre», duración: qué es · huecos):',
    ...PLANTILLAS.map(plantillaEnRenglon),
  ].join('\n');
}

/** Las operaciones, para el texto que lee la IA. El orden es el de la lista que se le muestra. */
export const OPERACIONES_CHAT: Array<{ op: IdOperacion; forma: string; para: string }> = [
  {
    op: 'agregar_texto',
    forma: '{"op":"agregar_texto","texto":"…","inicio":0,"duracion":3,"ref":"n1"}',
    para: 'Agrega un texto en pantalla, en una pista de texto libre, con el estilo predeterminado (Arial 15, blanco, centrado en el lienzo). "ref" es opcional: si le pones una nueva ("n1", "n2"…), las operaciones que siguen pueden cambiarle el estilo, la posición o la animación en este mismo pedido.',
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
    op: 'usar_plantilla',
    forma: '{"op":"usar_plantilla","id":"testimonio","textos":{"cita":"…"},"clips":{"clip":"m1"}}',
    para: paraUsarPlantilla(),
  },
];

/**
 * Lo que el editor sabe hacer con la mano y el chat NO (todavía). Va al final del catálogo
 * para que la IA lo DIGA en el resumen en vez de simularlo con otra operación.
 */
export const NO_SE_PUEDE_CHAT =
  'agregar a la línea de tiempo videos, imágenes, música, sonidos, stickers o formas de la biblioteca (sustituir el archivo de un clip que ya está, sí: reemplazar_clip); importar archivos a Multimedia (sólo se usan los de "medios"); usar una plantilla de anuncio en un proyecto que ya tiene algo (desde la pestaña Plantillas, «Utilizar plantilla» la arma en un proyecto nuevo); voz en off o texto a voz; avatar de IA; fotogramas clave (animar la posición o la escala en el tiempo); máscaras; quitar el fondo o chroma key; recortar el encuadre del cuadro; el fondo del lienzo; las plantillas de estilo de texto o de subtítulos; resaltar palabras CLAVE de los subtítulos; duplicar o copiar elementos; pegar atributos; y cambiar una propiedad que tiene fotogramas clave ("fotogramas" en el elemento)';

const IDS_OP = new Set<string>(OPERACIONES_CHAT.map((o) => o.op));

/** El catálogo como lo lee la IA (va en el slot {{catalogo}} del prompt): una operación por renglón y lo que no se puede. */
export function catalogoParaPrompt(): string {
  return [
    ...OPERACIONES_CHAT.map((o) => `- ${o.forma} → ${o.para}`),
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
    if (!['ninguno', 'mayusculas', 'minusculas', 'titulo'].includes(String(raw.mayusculas))) return mal('mayusculas');
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
    if (!(m in MEZCLAS)) return { ok: false, motivo: `«${m.slice(0, 30)}» no es un modo de mezcla` };
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

/**
 * Una operación de la IA, validada; o el motivo por el que no. El motivo es corto: lo ve la
 * persona en la revisión («No se aplica: …»).
 */
export function validarOperacion(raw: unknown): Validada {
  if (!esObjeto(raw) || typeof raw.op !== 'string') return { ok: false, motivo: 'una operación sin forma' };
  const op = raw.op;
  if (!IDS_OP.has(op)) return { ok: false, motivo: `«${op.slice(0, 30)}» no es algo que pueda hacer` };
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
      return { ok: true, op: { op: 'agregar_texto', texto, inicio: centesima(inicio), duracion: centesima(duracion), ...(ref ? { ref } : {}) } };
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
      if (inicio != null && fin != null && fin - inicio < TOPES_CHAT.duracionMin) return { ok: false, motivo: 'un recorte que deja el clip sin largo' };
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
      if (objetivo !== undefined && !(objetivo in OBJETIVOS_NORMALIZAR)) return { ok: false, motivo: `«${objetivo.slice(0, 20)}» no es una intensidad objetivo` };
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
      if (fin - inicio < 0.05) return { ok: false, motivo: 'un corte de tramo que termina antes de empezar' };
      return { ok: true, op: { op: 'cortar_tramo', inicio: centesima(inicio), fin: centesima(fin) } };
    }
    case 'eliminar_muletillas':
      return { ok: true, op: { op: 'eliminar_muletillas' } };
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
