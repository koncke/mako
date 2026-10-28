// =============================================================================
// image-editor/chat/catalogo — lo que el chat «MaKo IA» del Image Editor sabe hacer (el catálogo cerrado)
// =============================================================================
// La IA devuelve operaciones de ESTA lista y nada más (molde: lib/editor-video/chat-catalogo.ts). Cada una tiene:
//   · `forma`: el JSON de ejemplo que lee la IA;
//   · `para`: qué hace y cuándo usarla. Es lo que lee el MODELO (regla de Martín para los chats: «Debería aceptar
//     cualquier pedido del usuario. Por eso es importante documentar las cosas de la API»): lo que no está aquí, la IA
//     tiene que DECIRLO (`NO_SE_PUEDE_CHAT`), no simularlo con otra operación.
// `validarOperacion` es la ÚNICA validación de la forma: la usan la ruta, el panel al pedir y al aceptar, y la API.
// Fuera de rango se RECHAZA con su motivo, nunca se recorta.
//
// Puro y sin `server-only`: lo leen el panel, la ruta de la IA, la API y los tests.
// =============================================================================

import { TOPE_DISCUTIR, textoDeDiscutir } from '../../chat-discutir';

export const TOPES_CHAT_IMAGEN = {
  operaciones: 40,
  texto: 1000,
  posicionMax: 20_000,
  tamanoMin: 1,
  tamanoMax: 20_000,
  fuenteMin: 4,
  fuenteMax: 800,
  instruccion: 2_000,
  vistaMax: 60_000,
  /** Lo que describe una imagen con IA (crear_imagen, editar_imagen). */
  prompt: 2_000,
  /** Imágenes con IA por pedido: cada una se cobra en la cuenta del negocio. */
  imagenes: 2,
  /** La imagen de referencia de una edición, como data URL: ⚠️ Vercel corta el cuerpo de un pedido en ~4,5 MB. */
  referencia: 3_500_000,
} as const;

export type Alineacion = 'izquierda' | 'centro' | 'derecha' | 'justificado';
export type Mayusculas = 'ninguno' | 'mayusculas' | 'minusculas' | 'titulo' | 'oracion';
export type EstiloTexto = {
  fuente?: string; tamano?: number; color?: string; negrita?: boolean; cursiva?: boolean; subrayado?: boolean;
  alineacion?: Alineacion; mayusculas?: Mayusculas; interlineado?: number; espaciado?: number;
};
export type AlinearA = 'izquierda' | 'centro' | 'derecha' | 'arriba' | 'medio' | 'abajo';
export type CapaA = 'frente' | 'atras' | 'subir' | 'bajar';
export type FormaNueva = 'rectangulo' | 'circulo';

export type OperacionImagen =
  | { op: 'cambiar_texto'; ref: string; texto: string }
  | { op: 'estilo_texto'; ref: string; estilo: EstiloTexto }
  | { op: 'agregar_texto'; texto: string; pagina?: string; x?: number; y?: number; ancho?: number; estilo: EstiloTexto; ref?: string }
  | { op: 'mover'; ref: string; x?: number; y?: number }
  | { op: 'tamano'; ref: string; ancho?: number; alto?: number; escala?: number }
  | { op: 'rotar'; ref: string; grados: number }
  | { op: 'opacidad'; ref: string; opacidad: number }
  | { op: 'color'; ref: string; color: string }
  | { op: 'borde'; ref: string; color?: string; grosor?: number }
  | { op: 'borrar'; refs: string[] }
  | { op: 'duplicar'; ref: string; dx?: number; dy?: number; nueva?: string }
  | { op: 'capa'; ref: string; a: CapaA }
  | { op: 'alinear'; refs: string[]; a: AlinearA }
  | { op: 'bloquear'; ref: string; bloqueado: boolean }
  | { op: 'fondo'; pagina?: string; color: string }
  | { op: 'agregar_pagina'; despues_de?: string; duplicar?: boolean }
  | { op: 'borrar_pagina'; pagina: string }
  | { op: 'agregar_forma'; forma: FormaNueva; pagina?: string; x: number; y: number; ancho: number; alto: number; color?: string; ref?: string }
  // Las imágenes con IA: la IA PIDE (crear_imagen, editar_imagen) y el navegador las genera antes de mostrar la propuesta
  // (/api/image-editor/imagen) y las cambia por las de abajo, que son las que se guardan y se aplican.
  | { op: 'crear_imagen'; prompt: string; pagina?: string; x?: number; y?: number; ancho?: number; alto?: number; ref?: string }
  | { op: 'editar_imagen'; ref: string; prompt: string }
  // 27/10/2026 («toda acción que se puede hacer a mano, por prompt»): «Voltear» y el ojo de «Capas».
  | { op: 'voltear'; ref: string; horizontal?: boolean; vertical?: boolean }
  | { op: 'ocultar'; ref: string; oculto: boolean }
  // INTERNAS: nunca las escribe la IA (no están en el catálogo y `validarOperacion` las rechaza). `src` es la URL estable de
  // «Subidos» que devolvió la ruta; `natural`, los píxeles de la imagen; `asset`, el id de su fila de «Subidos».
  | { op: 'agregar_imagen'; src: string; natural: { ancho: number; alto: number }; x: number; y: number; ancho: number; alto: number; pagina?: string; ref?: string; asset?: string; descripcion: string }
  | { op: 'reemplazar_imagen'; ref: string; src: string; natural: { ancho: number; alto: number }; asset?: string; descripcion: string };

/** Las internas: las arma el navegador con lo que generó la IA de imágenes. */
export type OperacionInterna = Extract<OperacionImagen, { op: 'agregar_imagen' | 'reemplazar_imagen' }>;
/** Las que puede escribir la IA (las del catálogo). */
export type IdOperacionImagen = Exclude<OperacionImagen['op'], OperacionInterna['op']>;
/** Las que piden una imagen al modelo de imágenes (se cobran en la cuenta del negocio). */
export type OperacionDeImagenIA = Extract<OperacionImagen, { op: 'crear_imagen' | 'editar_imagen' }>;
export const esOperacionDeImagenIA = (o: OperacionImagen): o is OperacionDeImagenIA => o.op === 'crear_imagen' || o.op === 'editar_imagen';

const REF = '"ref" es la de la vista del DISEÑO (t3k, f0z, i7q…; o una nueva «n1» que agregó una operación anterior de este mismo pedido)';
const PAGINA = '"pagina" es la ref de una página (la de "paginas"); sin ella, la página abierta ("pagina_actual")';
const MEDIDAS = 'x, y es la esquina de ARRIBA A LA IZQUIERDA del elemento en px de la página (y crece hacia abajo); ancho y alto, en px';

/** Las operaciones, para el texto que lee la IA. El orden es el de la lista que se le muestra. */
export const OPERACIONES_CHAT_IMAGEN: Array<{ op: IdOperacionImagen; forma: string; para: string }> = [
  { op: 'cambiar_texto', forma: '{"op":"cambiar_texto","ref":"t3k","texto":"…"}', para: `Cambia lo que dice un texto. ${REF}. El texto va tal cual lo dicta la persona; si el texto está en mayúsculas («mayusculas» en la vista), escríbelo normal: el editor lo vuelve a poner en mayúsculas.` },
  { op: 'estilo_texto', forma: '{"op":"estilo_texto","ref":"t3k","fuente":"Montserrat","tamano":64,"color":"#FFD400","negrita":true}', para: `Cambia el estilo de un texto: "fuente" (el nombre de una fuente; mejor una de "fuentes_sugeridas" o la que ya usa el diseño), "tamano" (px), "color" (#RRGGBB), "negrita", "cursiva", "subrayado" (true o false), "alineacion" (izquierda, centro, derecha, justificado), "mayusculas" (ninguno, mayusculas, minusculas, titulo, oracion), "interlineado" (0.5 a 4) y "espaciado" (-200 a 1000, entre letras). Sólo los que cambian. ${REF}.` },
  { op: 'agregar_texto', forma: '{"op":"agregar_texto","texto":"…","x":80,"y":120,"ancho":600,"tamano":48,"color":"#141414","ref":"n1"}', para: `Agrega un texto nuevo. ${MEDIDAS} (sin x/y va centrado; sin ancho, el 70 % de la página). Acepta los mismos campos de estilo que estilo_texto. ${PAGINA}. "ref" opcional: una nueva («n1», «n2»…) para cambiarlo después en este mismo pedido.` },
  { op: 'mover', forma: '{"op":"mover","ref":"f0z","x":40,"y":900}', para: `Mueve un elemento. ${MEDIDAS}. Sólo los que cambian. ${REF}.` },
  { op: 'tamano', forma: '{"op":"tamano","ref":"i7q","ancho":540,"alto":540}', para: `Cambia el tamaño de un elemento: "ancho" y/o "alto" en px, o "escala" en % (100 es como está; mantiene la proporción). La esquina de arriba a la izquierda queda donde estaba. En un texto, "ancho" es el de la caja (el texto se reacomoda) y "escala" agranda la letra. ${REF}.` },
  { op: 'rotar', forma: '{"op":"rotar","ref":"f0z","grados":-12}', para: `Gira un elemento sobre su centro: "grados" es el ángulo final (-360 a 360; 0 lo endereza). ${REF}.` },
  { op: 'opacidad', forma: '{"op":"opacidad","ref":"i7q","opacidad":60}', para: `La transparencia de un elemento, de 0 (invisible) a 100 (opaco). ${REF}.` },
  { op: 'color', forma: '{"op":"color","ref":"f0z","color":"#FF5A1F"}', para: `El color de relleno de una forma o el color de un texto (#RRGGBB). Una línea cambia su trazo. No sirve para una imagen. ${REF}.` },
  { op: 'borde', forma: '{"op":"borde","ref":"f0z","color":"#141414","grosor":4}', para: `El borde de una forma: "color" (#RRGGBB) y "grosor" en px (0 lo saca). ${REF}.` },
  { op: 'borrar', forma: '{"op":"borrar","refs":["f0z","t3k"]}', para: 'Borra elementos del diseño. "refs" son las de la vista. Se puede deshacer con «Restaurar» o Ctrl+Z.' },
  { op: 'duplicar', forma: '{"op":"duplicar","ref":"t3k","dx":0,"dy":120,"nueva":"n1"}', para: `Duplica un elemento, corrido "dx" y "dy" px (sin ellos, 20 y 20). "nueva": una ref nueva («n1»…) para cambiar la copia en este mismo pedido. ${REF}.` },
  { op: 'capa', forma: '{"op":"capa","ref":"i7q","a":"atras"}', para: `Cambia el orden de un elemento: "a" es frente (arriba de todo), atras (abajo de todo), subir o bajar (uno). ${REF}.` },
  { op: 'alinear', forma: '{"op":"alinear","refs":["t3k","f0z"],"a":"centro"}', para: 'Alinea elementos con la PÁGINA: "a" es izquierda, centro, derecha (horizontal) o arriba, medio, abajo (vertical). Cada uno por separado.' },
  { op: 'bloquear', forma: '{"op":"bloquear","ref":"i7q","bloqueado":true}', para: `Bloquea (true) o desbloquea (false) un elemento. Uno bloqueado no se cambia con otras operaciones: primero se desbloquea. ${REF}.` },
  { op: 'fondo', forma: '{"op":"fondo","color":"#F3EFE7"}', para: `El color de fondo de una página (#RRGGBB). ${PAGINA}.` },
  { op: 'agregar_pagina', forma: '{"op":"agregar_pagina","despues_de":"pa3","duplicar":true}', para: 'Agrega una página después de "despues_de" (la ref de una página; sin ella, al final). Con "duplicar": true es una copia de esa página; si no, una en blanco.' },
  { op: 'borrar_pagina', forma: '{"op":"borrar_pagina","pagina":"pa3"}', para: 'Borra una página con todo lo que tiene. Un diseño siempre se queda con al menos una.' },
  { op: 'agregar_forma', forma: '{"op":"agregar_forma","forma":"rectangulo","x":0,"y":900,"ancho":1080,"alto":180,"color":"#141414","ref":"n2"}', para: `Agrega una forma: "forma" es rectangulo o circulo. ${MEDIDAS}. "color" de relleno (#RRGGBB). ${PAGINA}. "ref" opcional: una nueva («n1»…) para seguir cambiándola en este pedido.` },
  { op: 'crear_imagen', forma: '{"op":"crear_imagen","prompt":"Foto de una taza de café humeante sobre una mesa de madera clara, luz natural de mañana, fondo desenfocado, tonos cálidos","x":90,"y":240,"ancho":900,"alto":600,"ref":"n3"}', para: `Crea una imagen NUEVA con IA y la pone en el diseño. La dibuja un modelo de imágenes con la IA del negocio y SE COBRA EN SU CUENTA: úsala sólo cuando la persona pide una imagen, foto o ilustración nueva, nunca para algo que hacen las otras operaciones. "prompt": la imagen descrita en detalle, en el idioma de la persona: qué se ve, el estilo (foto, ilustración, 3D…), los colores, la luz y el encuadre. No le pidas textos adentro de la imagen: el texto va aparte, con agregar_texto. ${MEDIDAS}: la caja donde va (sin medidas, un cuadrado al centro de la página); la imagen sale con la proporción más parecida (cuadrada, apaisada o vertical) y entra entera en la caja. ${PAGINA}. "ref" opcional: una nueva («n1»…) para moverla o cambiarla después en este pedido. Como mucho ${TOPES_CHAT_IMAGEN.imagenes} imágenes con IA por pedido.` },
  { op: 'editar_imagen', forma: '{"op":"editar_imagen","ref":"i7q","prompt":"Cambia el fondo por una playa al atardecer; la persona y su ropa quedan igual"}', para: `Edita con IA una imagen que YA está en el diseño (un elemento «imagen» de la vista): el modelo de imágenes recibe esa imagen, la rehace según "prompt" y la nueva ocupa la misma caja. "prompt": qué cambiar y qué dejar igual, en detalle. SE COBRA EN LA CUENTA DEL NEGOCIO. Para mover, agrandar, girar o hacer transparente una imagen no hace falta: eso es mover, tamano, rotar u opacidad. "ref" es la de una imagen de la vista (i…), nunca una nueva de este pedido.` },
  // 27/10/2026, al FINAL (una operación nueva no le saca el lugar a las de antes).
  { op: 'voltear', forma: '{"op":"voltear","ref":"i7q","horizontal":true}', para: `Espejo de un elemento, como «Voltear»: "horizontal" (izquierda ↔ derecha) y/o "vertical" (cabeza abajo); true lo deja volteado, false lo devuelve ("volteado" en la vista). ${REF}.` },
  { op: 'ocultar', forma: '{"op":"ocultar","ref":"f0z","oculto":true}', para: `Oculta (true) o vuelve a mostrar (false) un elemento sin borrarlo, como el ojo de «Capas» ("oculto" en la vista). ${REF}.` },
];

/**
 * Lo que el editor sabe hacer con la mano y el chat NO (todavía). Va al final del catálogo para que la IA lo DIGA
 * en el resumen en vez de simularlo con otra operación.
 */
export const NO_SE_PUEDE_CHAT_IMAGEN =
  'agregar fotos, íconos o gráficos de la biblioteca o de Subidos (una imagen NUEVA, sí: con crear_imagen); quitar el fondo de una foto; recortar una foto o cambiar su encuadre; filtros y ajustes de foto; degradados; animaciones; agrupar o desagrupar; cambiar el tamaño del diseño (Redimensionar); usar una plantilla; tablas, gráficos de datos y códigos QR; los efectos de texto (sombra, contorno, neón, curvar), redondear esquinas, el estilo del borde (punteado) y las flechas de una línea; distribuir, reordenar o renombrar páginas y capas; un vínculo; descargar o exportar; y lo que va adentro de un grupo («grupo» en la vista)';

const IDS = new Set<string>(OPERACIONES_CHAT_IMAGEN.map((o) => o.op));

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
/** Una ref del diseño («t3k», «pa3») o una nueva («n1»). */
const esRef = (x: unknown): x is string => typeof x === 'string' && /^[a-z][a-z0-9]{1,8}$/.test(x);
const esRefNueva = (x: unknown): x is string => typeof x === 'string' && /^n\d{1,3}$/.test(x);
const esRefPagina = (x: unknown): x is string => typeof x === 'string' && /^p[a-z0-9]{1,8}$/.test(x);
const numero = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const enRango = (n: number | null, min: number, max: number): n is number => n !== null && n >= min && n <= max;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** «#ffd400», «#FD0» o «ffd400» → «#ffd400»; null si no es un color. */
export function colorHex(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(x.trim());
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`;
}

const CAMPOS_ESTILO = ['fuente', 'tamano', 'color', 'negrita', 'cursiva', 'subrayado', 'alineacion', 'mayusculas', 'interlineado', 'espaciado'] as const;

/** El estilo de un texto, de los campos sueltos de la operación. `vacio` = se acepta sin ningún campo (agregar_texto). */
function validarEstilo(raw: Record<string, unknown>, vacio: boolean): { ok: true; estilo: EstiloTexto } | { ok: false; motivo: string } {
  const e: EstiloTexto = {};
  const mal = (campo: string) => ({ ok: false as const, motivo: `un estilo de texto con «${campo}» inválido` });
  if (raw.fuente !== undefined) {
    if (typeof raw.fuente !== 'string' || !raw.fuente.trim() || raw.fuente.trim().length > 60 || /["'<>;{}]/.test(raw.fuente)) return mal('fuente');
    e.fuente = raw.fuente.trim();
  }
  if (raw.tamano !== undefined) {
    const n = numero(raw.tamano);
    if (!enRango(n, TOPES_CHAT_IMAGEN.fuenteMin, TOPES_CHAT_IMAGEN.fuenteMax)) return mal('tamano');
    e.tamano = Math.round(n);
  }
  if (raw.color !== undefined) {
    const c = colorHex(raw.color);
    if (!c) return mal('color');
    e.color = c;
  }
  for (const k of ['negrita', 'cursiva', 'subrayado'] as const) {
    if (raw[k] === undefined) continue;
    if (typeof raw[k] !== 'boolean') return mal(k);
    e[k] = raw[k] as boolean;
  }
  if (raw.alineacion !== undefined) {
    if (!['izquierda', 'centro', 'derecha', 'justificado'].includes(String(raw.alineacion))) return mal('alineacion');
    e.alineacion = raw.alineacion as Alineacion;
  }
  if (raw.mayusculas !== undefined) {
    if (!['ninguno', 'mayusculas', 'minusculas', 'titulo', 'oracion'].includes(String(raw.mayusculas))) return mal('mayusculas');
    e.mayusculas = raw.mayusculas as Mayusculas;
  }
  if (raw.interlineado !== undefined) {
    const n = numero(raw.interlineado);
    if (!enRango(n, 0.5, 4)) return mal('interlineado');
    e.interlineado = r1(n);
  }
  if (raw.espaciado !== undefined) {
    const n = numero(raw.espaciado);
    if (!enRango(n, -200, 1000)) return mal('espaciado');
    e.espaciado = Math.round(n);
  }
  if (!vacio && !Object.keys(e).length) return { ok: false, motivo: 'un estilo de texto sin cambios' };
  return { ok: true, estilo: e };
}

/** Las claves que sobran se RECHAZAN, no se ignoran: una IA que inventa un campo cree que hizo algo. */
function sobrante(raw: Record<string, unknown>, validas: readonly string[]): string | null {
  return Object.keys(raw).find((k) => k !== 'op' && !validas.includes(k)) ?? null;
}

export type Validada = { ok: true; op: OperacionImagen } | { ok: false; motivo: string };

const VALIDAS: Record<IdOperacionImagen, readonly string[]> = {
  cambiar_texto: ['ref', 'texto'],
  estilo_texto: ['ref', ...CAMPOS_ESTILO],
  agregar_texto: ['texto', 'pagina', 'x', 'y', 'ancho', 'ref', ...CAMPOS_ESTILO],
  mover: ['ref', 'x', 'y'],
  tamano: ['ref', 'ancho', 'alto', 'escala'],
  rotar: ['ref', 'grados'],
  opacidad: ['ref', 'opacidad'],
  color: ['ref', 'color'],
  borde: ['ref', 'color', 'grosor'],
  borrar: ['refs'],
  duplicar: ['ref', 'dx', 'dy', 'nueva'],
  capa: ['ref', 'a'],
  alinear: ['refs', 'a'],
  bloquear: ['ref', 'bloqueado'],
  fondo: ['pagina', 'color'],
  agregar_pagina: ['despues_de', 'duplicar'],
  borrar_pagina: ['pagina'],
  agregar_forma: ['forma', 'pagina', 'x', 'y', 'ancho', 'alto', 'color', 'ref'],
  crear_imagen: ['prompt', 'pagina', 'x', 'y', 'ancho', 'alto', 'ref'],
  editar_imagen: ['ref', 'prompt'],
  voltear: ['ref', 'horizontal', 'vertical'],
  ocultar: ['ref', 'oculto'],
};

/** Lo que describe una imagen: no vacío y dentro del tope (más largo se RECHAZA, no se corta). */
const promptValido = (x: unknown): string | null => {
  if (typeof x !== 'string') return null;
  const t = x.trim();
  return t.length >= 3 && t.length <= TOPES_CHAT_IMAGEN.prompt ? t : null;
};

const textoValido = (x: unknown): string | null => {
  if (typeof x !== 'string') return null;
  const t = x.trim();
  return t && t.length <= TOPES_CHAT_IMAGEN.texto ? t : null;
};
const posicion = (x: unknown) => enRango(numero(x), -TOPES_CHAT_IMAGEN.posicionMax, TOPES_CHAT_IMAGEN.posicionMax);
const medida = (x: unknown) => enRango(numero(x), TOPES_CHAT_IMAGEN.tamanoMin, TOPES_CHAT_IMAGEN.tamanoMax);

/** Una operación de la IA, validada; o el motivo por el que no. El motivo es corto: lo ve la persona. */
export function validarOperacion(raw: unknown): Validada {
  if (!esObjeto(raw) || typeof raw.op !== 'string') return { ok: false, motivo: 'una operación sin forma' };
  const op = raw.op as IdOperacionImagen;
  // `IDS` sale del catálogo: las internas (agregar_imagen, reemplazar_imagen) no están, y la IA no las puede escribir.
  if (!IDS.has(op)) return { ok: false, motivo: `«${String(raw.op).slice(0, 30)}» no es algo que pueda hacer` };
  const extra = sobrante(raw, VALIDAS[op]);
  if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de ${op}` };
  const ref = raw.ref;
  const sinRef = (que: string) => ({ ok: false as const, motivo: `${que} sin elemento` });
  switch (op) {
    case 'cambiar_texto': {
      const texto = textoValido(raw.texto);
      if (!esRef(ref) || !texto) return { ok: false, motivo: 'un cambio de texto incompleto' };
      return { ok: true, op: { op, ref, texto } };
    }
    case 'estilo_texto': {
      if (!esRef(ref)) return sinRef('un estilo de texto');
      const v = validarEstilo(raw, false);
      return v.ok ? { ok: true, op: { op, ref, estilo: v.estilo } } : v;
    }
    case 'agregar_texto': {
      const texto = textoValido(raw.texto);
      if (!texto) return { ok: false, motivo: `un texto vacío o de más de ${TOPES_CHAT_IMAGEN.texto} caracteres` };
      if (raw.pagina !== undefined && !esRefPagina(raw.pagina)) return { ok: false, motivo: 'un texto en una página que no es de la vista' };
      if ((raw.x !== undefined && !posicion(raw.x)) || (raw.y !== undefined && !posicion(raw.y))) return { ok: false, motivo: 'un texto con una posición inválida' };
      if (raw.ancho !== undefined && !medida(raw.ancho)) return { ok: false, motivo: 'un texto con un ancho inválido' };
      if (ref !== undefined && !esRefNueva(ref)) return { ok: false, motivo: 'un texto nuevo con una ref que no es «n1», «n2»…' };
      const v = validarEstilo(raw, true);
      if (!v.ok) return v;
      return {
        ok: true,
        op: {
          op, texto, estilo: v.estilo,
          ...(raw.pagina !== undefined ? { pagina: raw.pagina as string } : {}),
          ...(raw.x !== undefined ? { x: r1(raw.x as number) } : {}),
          ...(raw.y !== undefined ? { y: r1(raw.y as number) } : {}),
          ...(raw.ancho !== undefined ? { ancho: r1(raw.ancho as number) } : {}),
          ...(ref !== undefined ? { ref: ref as string } : {}),
        },
      };
    }
    case 'mover': {
      if (!esRef(ref)) return sinRef('un movimiento');
      if (raw.x === undefined && raw.y === undefined) return { ok: false, motivo: 'un movimiento sin x ni y' };
      if ((raw.x !== undefined && !posicion(raw.x)) || (raw.y !== undefined && !posicion(raw.y))) return { ok: false, motivo: 'un movimiento fuera de rango' };
      return { ok: true, op: { op, ref, ...(raw.x !== undefined ? { x: r1(raw.x as number) } : {}), ...(raw.y !== undefined ? { y: r1(raw.y as number) } : {}) } };
    }
    case 'tamano': {
      if (!esRef(ref)) return sinRef('un cambio de tamaño');
      if (raw.escala !== undefined) {
        if (raw.ancho !== undefined || raw.alto !== undefined) return { ok: false, motivo: 'un cambio de tamaño con escala y medidas a la vez' };
        if (!enRango(numero(raw.escala), 1, 1000)) return { ok: false, motivo: 'una escala fuera de 1 a 1000 %' };
        return { ok: true, op: { op, ref, escala: r1(raw.escala as number) } };
      }
      if (raw.ancho === undefined && raw.alto === undefined) return { ok: false, motivo: 'un cambio de tamaño sin medidas' };
      if ((raw.ancho !== undefined && !medida(raw.ancho)) || (raw.alto !== undefined && !medida(raw.alto))) return { ok: false, motivo: 'un tamaño fuera de rango' };
      return { ok: true, op: { op, ref, ...(raw.ancho !== undefined ? { ancho: r1(raw.ancho as number) } : {}), ...(raw.alto !== undefined ? { alto: r1(raw.alto as number) } : {}) } };
    }
    case 'rotar': {
      const g = numero(raw.grados);
      if (!esRef(ref) || !enRango(g, -360, 360)) return { ok: false, motivo: 'un giro incompleto o fuera de -360 a 360' };
      return { ok: true, op: { op, ref, grados: r1(g) } };
    }
    case 'opacidad': {
      const o = numero(raw.opacidad);
      if (!esRef(ref) || !enRango(o, 0, 100)) return { ok: false, motivo: 'una opacidad fuera de 0 a 100' };
      return { ok: true, op: { op, ref, opacidad: Math.round(o) } };
    }
    case 'color': {
      const c = colorHex(raw.color);
      if (!esRef(ref) || !c) return { ok: false, motivo: 'un color que no es #RRGGBB' };
      return { ok: true, op: { op, ref, color: c } };
    }
    case 'borde': {
      if (!esRef(ref)) return sinRef('un borde');
      if (raw.color === undefined && raw.grosor === undefined) return { ok: false, motivo: 'un borde sin color ni grosor' };
      const c = raw.color === undefined ? undefined : colorHex(raw.color);
      if (c === null) return { ok: false, motivo: 'un borde con un color que no es #RRGGBB' };
      if (raw.grosor !== undefined && !enRango(numero(raw.grosor), 0, 200)) return { ok: false, motivo: 'un grosor fuera de 0 a 200' };
      return { ok: true, op: { op, ref, ...(c ? { color: c } : {}), ...(raw.grosor !== undefined ? { grosor: r1(raw.grosor as number) } : {}) } };
    }
    case 'borrar':
    case 'alinear': {
      const refs = Array.isArray(raw.refs) ? [...new Set(raw.refs.filter(esRef))] : [];
      if (!refs.length) return { ok: false, motivo: op === 'borrar' ? 'un borrado sin elementos' : 'un alinear sin elementos' };
      if (op === 'borrar') return { ok: true, op: { op, refs } };
      if (!['izquierda', 'centro', 'derecha', 'arriba', 'medio', 'abajo'].includes(String(raw.a))) return { ok: false, motivo: 'un alinear sin «a» (izquierda, centro, derecha, arriba, medio o abajo)' };
      return { ok: true, op: { op, refs, a: raw.a as AlinearA } };
    }
    case 'duplicar': {
      if (!esRef(ref)) return sinRef('un duplicar');
      if ((raw.dx !== undefined && !posicion(raw.dx)) || (raw.dy !== undefined && !posicion(raw.dy))) return { ok: false, motivo: 'un duplicar corrido fuera de rango' };
      if (raw.nueva !== undefined && !esRefNueva(raw.nueva)) return { ok: false, motivo: 'una copia con una ref que no es «n1», «n2»…' };
      return {
        ok: true,
        op: { op, ref, ...(raw.dx !== undefined ? { dx: r1(raw.dx as number) } : {}), ...(raw.dy !== undefined ? { dy: r1(raw.dy as number) } : {}), ...(raw.nueva !== undefined ? { nueva: raw.nueva as string } : {}) },
      };
    }
    case 'capa': {
      if (!esRef(ref) || !['frente', 'atras', 'subir', 'bajar'].includes(String(raw.a))) return { ok: false, motivo: 'un cambio de orden sin «a» (frente, atras, subir o bajar)' };
      return { ok: true, op: { op, ref, a: raw.a as CapaA } };
    }
    case 'bloquear': {
      if (!esRef(ref) || typeof raw.bloqueado !== 'boolean') return { ok: false, motivo: 'un bloquear incompleto' };
      return { ok: true, op: { op, ref, bloqueado: raw.bloqueado } };
    }
    case 'fondo': {
      const c = colorHex(raw.color);
      if (!c) return { ok: false, motivo: 'un fondo con un color que no es #RRGGBB' };
      if (raw.pagina !== undefined && !esRefPagina(raw.pagina)) return { ok: false, motivo: 'un fondo de una página que no es de la vista' };
      return { ok: true, op: { op, color: c, ...(raw.pagina !== undefined ? { pagina: raw.pagina as string } : {}) } };
    }
    case 'agregar_pagina': {
      if (raw.despues_de !== undefined && !esRefPagina(raw.despues_de)) return { ok: false, motivo: 'una página nueva después de una que no es de la vista' };
      if (raw.duplicar !== undefined && typeof raw.duplicar !== 'boolean') return { ok: false, motivo: 'un «duplicar» que no es true o false' };
      return { ok: true, op: { op, ...(raw.despues_de !== undefined ? { despues_de: raw.despues_de as string } : {}), ...(raw.duplicar === true ? { duplicar: true } : {}) } };
    }
    case 'borrar_pagina': {
      if (!esRefPagina(raw.pagina)) return { ok: false, motivo: 'un borrar página sin la página' };
      return { ok: true, op: { op, pagina: raw.pagina } };
    }
    case 'agregar_forma': {
      if (raw.forma !== 'rectangulo' && raw.forma !== 'circulo') return { ok: false, motivo: 'una forma que no es rectangulo ni circulo' };
      if (!posicion(raw.x) || !posicion(raw.y) || !medida(raw.ancho) || !medida(raw.alto)) return { ok: false, motivo: 'una forma sin medidas válidas' };
      const c = raw.color === undefined ? undefined : colorHex(raw.color);
      if (c === null) return { ok: false, motivo: 'una forma con un color que no es #RRGGBB' };
      if (raw.pagina !== undefined && !esRefPagina(raw.pagina)) return { ok: false, motivo: 'una forma en una página que no es de la vista' };
      if (ref !== undefined && !esRefNueva(ref)) return { ok: false, motivo: 'una forma nueva con una ref que no es «n1», «n2»…' };
      return {
        ok: true,
        op: {
          op, forma: raw.forma, x: r1(raw.x as number), y: r1(raw.y as number), ancho: r1(raw.ancho as number), alto: r1(raw.alto as number),
          ...(c ? { color: c } : {}), ...(raw.pagina !== undefined ? { pagina: raw.pagina as string } : {}), ...(ref !== undefined ? { ref: ref as string } : {}),
        },
      };
    }
    case 'crear_imagen': {
      const prompt = promptValido(raw.prompt);
      if (!prompt) return { ok: false, motivo: `una imagen sin descripción o de más de ${TOPES_CHAT_IMAGEN.prompt} caracteres` };
      if (raw.pagina !== undefined && !esRefPagina(raw.pagina)) return { ok: false, motivo: 'una imagen en una página que no es de la vista' };
      if ((raw.x !== undefined && !posicion(raw.x)) || (raw.y !== undefined && !posicion(raw.y))) return { ok: false, motivo: 'una imagen con una posición inválida' };
      if ((raw.ancho !== undefined && !medida(raw.ancho)) || (raw.alto !== undefined && !medida(raw.alto))) return { ok: false, motivo: 'una imagen con un tamaño inválido' };
      if (ref !== undefined && !esRefNueva(ref)) return { ok: false, motivo: 'una imagen nueva con una ref que no es «n1», «n2»…' };
      return {
        ok: true,
        op: {
          op, prompt,
          ...(raw.pagina !== undefined ? { pagina: raw.pagina as string } : {}),
          ...(raw.x !== undefined ? { x: r1(raw.x as number) } : {}), ...(raw.y !== undefined ? { y: r1(raw.y as number) } : {}),
          ...(raw.ancho !== undefined ? { ancho: r1(raw.ancho as number) } : {}), ...(raw.alto !== undefined ? { alto: r1(raw.alto as number) } : {}),
          ...(ref !== undefined ? { ref: ref as string } : {}),
        },
      };
    }
    case 'editar_imagen': {
      if (!esRef(ref) || esRefNueva(ref)) return { ok: false, motivo: 'una edición de imagen sin una imagen de la vista' };
      const prompt = promptValido(raw.prompt);
      if (!prompt) return { ok: false, motivo: `una edición de imagen sin descripción o de más de ${TOPES_CHAT_IMAGEN.prompt} caracteres` };
      return { ok: true, op: { op, ref, prompt } };
    }
    case 'voltear': {
      const h = raw.horizontal;
      const v = raw.vertical;
      if (!esRef(ref) || (h === undefined && v === undefined)) return { ok: false, motivo: 'un voltear sin elemento o sin sentido (horizontal o vertical)' };
      if ((h !== undefined && typeof h !== 'boolean') || (v !== undefined && typeof v !== 'boolean')) return { ok: false, motivo: 'un voltear que no es true o false' };
      return { ok: true, op: { op, ref, ...(h !== undefined ? { horizontal: h } : {}), ...(v !== undefined ? { vertical: v } : {}) } };
    }
    case 'ocultar': {
      if (!esRef(ref) || typeof raw.oculto !== 'boolean') return { ok: false, motivo: 'un ocultar incompleto' };
      return { ok: true, op: { op, ref, oculto: raw.oculto } };
    }
  }
}

/** Todas las de la respuesta: las válidas, en orden, y por qué se descartó cada otra. */
export function validarOperaciones(raw: unknown): { operaciones: OperacionImagen[]; descartes: string[] } {
  const lista = Array.isArray(raw) ? raw : [];
  const operaciones: OperacionImagen[] = [];
  const descartes: string[] = [];
  let imagenes = 0;
  for (const r of lista) {
    if (operaciones.length >= TOPES_CHAT_IMAGEN.operaciones) {
      descartes.push(`más de ${TOPES_CHAT_IMAGEN.operaciones} cambios de una vez`);
      break;
    }
    const v = validarOperacion(r);
    if (!v.ok) { descartes.push(v.motivo); continue; }
    // Cada imagen con IA se cobra en la cuenta del negocio: las que pasan del tope no se piden.
    if (esOperacionDeImagenIA(v.op) && ++imagenes > TOPES_CHAT_IMAGEN.imagenes) {
      descartes.push(`más de ${TOPES_CHAT_IMAGEN.imagenes} imágenes con IA en un pedido (cada una se cobra en tu cuenta)`);
      continue;
    }
    operaciones.push(v.op);
  }
  return { operaciones, descartes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Las de una PROPUESTA (lo que se guarda y se acepta): las del catálogo y las internas de las imágenes
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ¿Es la URL de una imagen de «Subidos» del editor (la que devuelve /api/image-editor/imagen)? Sólo esas entran en una
 * propuesta: la del bucket público `image-editor`, `<ws>/<uuid>.<ext>`, por https. Una propuesta guardada vuelve del
 * navegador y no se le cree.
 */
export function esSrcGenerada(x: unknown): x is string {
  return typeof x === 'string' && x.length <= 600 && /^https:\/\/[^\s"'<>]+\/image-editor\/\d+\/[0-9a-f-]{36}\.(?:png|jpe?g|webp)$/i.test(x);
}

const natural = (x: unknown): { ancho: number; alto: number } | null => {
  const n = x as { ancho?: unknown; alto?: unknown } | null;
  const ok = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 100_000;
  return n && typeof n === 'object' && ok(n.ancho) && ok(n.alto) ? { ancho: n.ancho as number, alto: n.alto as number } : null;
};
const descripcionDe = (x: unknown): string => (typeof x === 'string' ? x.trim().slice(0, TOPES_CHAT_IMAGEN.prompt) : '');
const assetValido = (x: unknown) => x === undefined || (typeof x === 'string' && UUID_RE.test(x));

/**
 * Una operación de una propuesta: las del catálogo (salvo las que piden una imagen, que ya se cambiaron) y las internas.
 * `iaPendiente`: una propuesta de la API de MaKo (27/10/2026) guarda crear_imagen y editar_imagen SIN generar: la imagen
 * se crea (y se cobra) recién cuando una persona la acepta en el editor.
 */
export function validarOperacionDePropuesta(raw: unknown, { iaPendiente = false }: { iaPendiente?: boolean } = {}): Validada {
  if (esObjeto(raw) && raw.op === 'agregar_imagen') {
    const extra = sobrante(raw, ['src', 'natural', 'x', 'y', 'ancho', 'alto', 'pagina', 'ref', 'asset', 'descripcion']);
    if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de agregar_imagen` };
    const n = natural(raw.natural);
    if (!esSrcGenerada(raw.src) || !n) return { ok: false, motivo: 'una imagen que no es de Subidos' };
    if (!posicion(raw.x) || !posicion(raw.y) || !medida(raw.ancho) || !medida(raw.alto)) return { ok: false, motivo: 'una imagen sin medidas válidas' };
    if (raw.pagina !== undefined && !esRefPagina(raw.pagina)) return { ok: false, motivo: 'una imagen en una página que no es de la vista' };
    if (raw.ref !== undefined && !esRefNueva(raw.ref)) return { ok: false, motivo: 'una imagen nueva con una ref que no es «n1», «n2»…' };
    if (!assetValido(raw.asset)) return { ok: false, motivo: 'una imagen con un id de Subidos inválido' };
    return {
      ok: true,
      op: {
        op: 'agregar_imagen', src: raw.src, natural: n, x: r1(raw.x as number), y: r1(raw.y as number), ancho: r1(raw.ancho as number), alto: r1(raw.alto as number),
        ...(raw.pagina !== undefined ? { pagina: raw.pagina as string } : {}), ...(raw.ref !== undefined ? { ref: raw.ref as string } : {}),
        ...(raw.asset !== undefined ? { asset: raw.asset as string } : {}), descripcion: descripcionDe(raw.descripcion),
      },
    };
  }
  if (esObjeto(raw) && raw.op === 'reemplazar_imagen') {
    const extra = sobrante(raw, ['ref', 'src', 'natural', 'asset', 'descripcion']);
    if (extra) return { ok: false, motivo: `«${extra.slice(0, 30)}» no es algo de reemplazar_imagen` };
    const n = natural(raw.natural);
    if (!esRef(raw.ref) || esRefNueva(raw.ref)) return { ok: false, motivo: 'un cambio de imagen sin la imagen' };
    if (!esSrcGenerada(raw.src) || !n) return { ok: false, motivo: 'una imagen que no es de Subidos' };
    if (!assetValido(raw.asset)) return { ok: false, motivo: 'una imagen con un id de Subidos inválido' };
    return { ok: true, op: { op: 'reemplazar_imagen', ref: raw.ref, src: raw.src, natural: n, ...(raw.asset !== undefined ? { asset: raw.asset as string } : {}), descripcion: descripcionDe(raw.descripcion) } };
  }
  const v = validarOperacion(raw);
  if (v.ok && esOperacionDeImagenIA(v.op) && !iaPendiente) return { ok: false, motivo: 'una imagen con IA que no se llegó a crear' };
  return v;
}

/** Las de una propuesta, como `validarOperaciones` (mismo tope). `iaPendiente`: ver `validarOperacionDePropuesta`. */
export function validarOperacionesDePropuesta(raw: unknown, op: { iaPendiente?: boolean } = {}): { operaciones: OperacionImagen[]; descartes: string[] } {
  const operaciones: OperacionImagen[] = [];
  const descartes: string[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (operaciones.length >= TOPES_CHAT_IMAGEN.operaciones) { descartes.push(`más de ${TOPES_CHAT_IMAGEN.operaciones} cambios de una vez`); break; }
    const v = validarOperacionDePropuesta(r, op);
    if (v.ok) operaciones.push(v.op);
    else descartes.push(v.motivo);
  }
  return { operaciones, descartes };
}

/** El catálogo como lo lee la IA (va en el slot {{catalogo}} del prompt). */
export function catalogoParaPrompt(): string {
  return [
    ...OPERACIONES_CHAT_IMAGEN.map((o) => `- ${o.forma} → ${o.para}`),
    '',
    `NO SE PUEDE DESDE EL CHAT (dilo en el resumen, no lo simules): ${NO_SE_PUEDE_CHAT_IMAGEN}.`,
  ].join('\n');
}

export { TOPE_DISCUTIR };

/**
 * «Discutir»: lo que contestó el modelo, como texto para la persona y SIN operaciones, mande lo que mande (el modo no
 * cambia nada; si el modelo igual armó un JSON con operaciones, se usa sólo su texto). Texto plano, corto. El texto lo
 * saca lib/chat-discutir.ts, el mismo del chat del Video Editor.
 */
export function salidaDeDiscutir(salida: unknown): { resumen: string; operaciones: OperacionImagen[]; descartes: string[] } {
  return { resumen: textoDeDiscutir(salida), operaciones: [], descartes: [] };
}

/** Forma del JSON de respuesta (va en el slot {{formato}}). */
export const FORMATO_CHAT_IMAGEN = `Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin markdown ni texto fuera del JSON, con esta forma:
{"resumen": "una frase para la persona: qué vas a cambiar, o por qué no se puede", "operaciones": [ …operaciones del catálogo, en el orden en que se aplican… ]}
Si el pedido no se puede hacer con el catálogo, "operaciones" va vacío y el resumen dice qué no se puede. Si sólo se puede una parte, haz esa parte y el resumen dice qué parte no.`;
