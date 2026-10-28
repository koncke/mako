// =============================================================================
// image-editor/chat/api — las operaciones del chat «MaKo IA» del Image Editor, como acciones de la API de MaKo
// =============================================================================
// Pedido de Martín (27/10/2026, textual): «Y asegurate de que funcione bien la API con todos los comandos, si una persona
// quiere editar lo que sea debería poder. Con prompts en mako me refiero». El espejo del Video Editor
// (lib/editor-video/chat-api.ts): UNA operación de la API por operación del chat, generadas de su catálogo
// (./catalogo.ts). La descripción es el `para` que ya lee la IA del chat y la forma la vuelve a validar `validarOperacion`,
// la MISMA del chat. La API declara cada campo (`validarInput` deja pasar SÓLO lo declarado) y `operacionDesdeInput` lo
// devuelve a la forma del chat.
//
// ⚠️ NINGUNA EJECUTA. Cada una PROPONE (`confirmacion: 'pantalla'`, pantalla /image-editor) y se suma a la propuesta
//    abierta de ese diseño en ese canal (`image_editor_propuestas`, mig 0340); una persona la mira y la acepta en el
//    editor con el mismo «Aceptar» del chat (que la vuelve a probar contra el diseño de ese momento, por id). El diseño
//    se guarda en la base, pero lo que el motor necesita para aplicar bien (las fuentes cargadas para medir el texto,
//    la imagen con IA generada) vive en el navegador: por eso no se escribe directo como cambiar_textos_diseno_imagen.
// ⚠️ crear_imagen y editar_imagen SE COBRAN en la cuenta del negocio: `costo: 'dinero'` (pantalla + admin, lo exige
//    tests/api-mako-registro.test.ts). La imagen se crea recién al «Aceptar», con la persona mirando.
// ⚠️ cambiar_texto NO tiene espejo: ya está cambiar_textos_diseno_imagen (por el texto, no por la ref, y aplica directo).
//
// Puro y sin `server-only`: lo leen las definiciones (lib/api-mako/areas/imagen.def.ts), el runner y los tests.
// =============================================================================

import type { Parametro } from '../../api-mako/tipos';
import { OPERACIONES_CHAT_IMAGEN, TOPES_CHAT_IMAGEN, validarOperacion, type IdOperacionImagen, type OperacionImagen } from './catalogo';

/** Una operación del chat, como acción de la API. `dinero`: la imagen la dibuja la IA del negocio y se cobra en su cuenta. */
export type OperacionApiImagen = { op: IdOperacionImagen; id: string; titulo: string; parametros: readonly Parametro[]; dinero?: true };

export const PARAM_DISENO: Parametro = {
  nombre: 'disenoId', rotulo: 'Diseño', tipo: 'string', obligatorio: true, max: 36,
  descripcion: 'El id del diseño (de listar_disenos_imagen).',
};
const REF: Parametro = {
  nombre: 'ref', rotulo: 'Elemento', tipo: 'string', obligatorio: true, max: 12,
  descripcion: 'La ref del elemento (t3k, f0z, i7q…) de ver_diseno_imagen; o una nueva («n1») que agregó otra operación de la MISMA propuesta.',
};
const REF_NUEVA: Parametro = {
  nombre: 'ref', rotulo: 'Ref nueva', tipo: 'string', max: 4,
  descripcion: 'Opcional: una ref nueva («n1», «n2»…) para que otra operación de la misma propuesta lo cambie.',
};
const PAGINA: Parametro = {
  nombre: 'pagina', rotulo: 'Página', tipo: 'string', max: 12,
  descripcion: 'Opcional: la ref de una página (p…) de ver_diseno_imagen; sin ella, la primera.',
};
const num = (nombre: string, rotulo: string, descripcion: string, minimo: number, maximo: number, obligatorio = false): Parametro =>
  ({ nombre, rotulo, tipo: 'number', ...(obligatorio ? { obligatorio: true } : {}), minimo, maximo, descripcion });
const si = (nombre: string, rotulo: string, descripcion: string, obligatorio = false): Parametro =>
  ({ nombre, rotulo, tipo: 'boolean', ...(obligatorio ? { obligatorio: true } : {}), descripcion });
const elegir = (nombre: string, rotulo: string, opciones: readonly string[], descripcion: string, obligatorio = false): Parametro =>
  ({ nombre, rotulo, tipo: 'string', ...(obligatorio ? { obligatorio: true } : {}), enum: opciones, descripcion });
const COLOR = (obligatorio: boolean, descripcion = 'Un color #RRGGBB.'): Parametro =>
  ({ nombre: 'color', rotulo: 'Color', tipo: 'string', max: 7, ...(obligatorio ? { obligatorio: true } : {}), descripcion });
const POS = TOPES_CHAT_IMAGEN.posicionMax;
const X = num('x', 'X', 'Opcional: px desde el borde izquierdo de la página (la esquina de arriba a la izquierda).', -POS, POS);
const Y = num('y', 'Y', 'Opcional: px desde el borde de arriba (y crece hacia abajo).', -POS, POS);
const ANCHO = num('ancho', 'Ancho', 'Opcional: en px.', TOPES_CHAT_IMAGEN.tamanoMin, TOPES_CHAT_IMAGEN.tamanoMax);
const ALTO = num('alto', 'Alto', 'Opcional: en px.', TOPES_CHAT_IMAGEN.tamanoMin, TOPES_CHAT_IMAGEN.tamanoMax);

/** Los campos de estilo de un texto (estilo_texto y agregar_texto). */
const ESTILO: readonly Parametro[] = [
  { nombre: 'fuente', rotulo: 'Fuente', tipo: 'string', max: 60, descripcion: 'Opcional: el nombre de una fuente del editor.' },
  num('tamano', 'Tamaño', `Opcional: en px, de ${TOPES_CHAT_IMAGEN.fuenteMin} a ${TOPES_CHAT_IMAGEN.fuenteMax}.`, TOPES_CHAT_IMAGEN.fuenteMin, TOPES_CHAT_IMAGEN.fuenteMax),
  COLOR(false, 'Opcional: #RRGGBB.'),
  si('negrita', 'Negrita', 'Opcional.'), si('cursiva', 'Cursiva', 'Opcional.'), si('subrayado', 'Subrayado', 'Opcional.'),
  elegir('alineacion', 'Alineación', ['izquierda', 'centro', 'derecha', 'justificado'], 'Opcional.'),
  elegir('mayusculas', 'Mayúsculas', ['ninguno', 'mayusculas', 'minusculas', 'titulo', 'oracion'], 'Opcional.'),
  num('interlineado', 'Interlineado', 'Opcional: de 0.5 a 4.', 0.5, 4),
  num('espaciado', 'Espaciado', 'Opcional: entre letras, de -200 a 1000.', -200, 1000),
];
const PROMPT: Parametro = {
  nombre: 'prompt', rotulo: 'Descripción', tipo: 'string', obligatorio: true, max: TOPES_CHAT_IMAGEN.prompt,
  descripcion: 'La imagen descrita en detalle, en el idioma de la persona.',
};

// ── La tabla: una fila por operación del chat (salvo cambiar_texto, ver la cabecera) ─────────────────────────────

export const OPERACIONES_API_IMAGEN: readonly OperacionApiImagen[] = [
  { op: 'estilo_texto', id: 'estilo_texto_imagen', titulo: 'Estilo de un texto del diseño', parametros: [REF, ...ESTILO] },
  { op: 'agregar_texto', id: 'agregar_texto_imagen', titulo: 'Agregar un texto al diseño', parametros: [
    { nombre: 'texto', rotulo: 'Texto', tipo: 'string', obligatorio: true, max: TOPES_CHAT_IMAGEN.texto, descripcion: 'Lo que dice, tal cual lo dicta la persona.' },
    PAGINA, X, Y, ANCHO, ...ESTILO, REF_NUEVA,
  ] },
  { op: 'mover', id: 'mover_elemento_imagen', titulo: 'Mover un elemento del diseño', parametros: [REF, X, Y] },
  { op: 'tamano', id: 'tamano_elemento_imagen', titulo: 'Agrandar o achicar un elemento', parametros: [
    REF, ANCHO, ALTO, num('escala', 'Escala', 'Opcional: en %, mantiene la proporción (en vez de ancho y alto).', 1, 1000),
  ] },
  { op: 'rotar', id: 'rotar_elemento_imagen', titulo: 'Girar un elemento del diseño', parametros: [REF, num('grados', 'Grados', 'El ángulo final, de -360 a 360.', -360, 360, true)] },
  { op: 'opacidad', id: 'opacidad_elemento_imagen', titulo: 'Cambiar la transparencia de un elemento', parametros: [REF, num('opacidad', 'Opacidad', 'De 0 (invisible) a 100 (opaco).', 0, 100, true)] },
  { op: 'color', id: 'color_elemento_imagen', titulo: 'Color de una forma o texto', parametros: [REF, COLOR(true)] },
  { op: 'borde', id: 'borde_elemento_imagen', titulo: 'Cambiar el borde de una forma', parametros: [REF, COLOR(false, 'Opcional: #RRGGBB.'), num('grosor', 'Grosor', 'Opcional: en px (0 lo saca).', 0, 200)] },
  { op: 'borrar', id: 'borrar_elementos_imagen', titulo: 'Borrar elementos del diseño', parametros: [
    { nombre: 'refs', rotulo: 'Elementos', tipo: 'string[]', obligatorio: true, max: 100, descripcion: 'Las refs de lo que se borra (t3k, f0z…).' },
  ] },
  { op: 'duplicar', id: 'duplicar_elemento_imagen', titulo: 'Duplicar un elemento del diseño', parametros: [
    REF, num('dx', 'Corrido en x', 'Opcional: px (20 si no va).', -POS, POS), num('dy', 'Corrido en y', 'Opcional: px (20 si no va).', -POS, POS),
    { nombre: 'nueva', rotulo: 'Ref de la copia', tipo: 'string', max: 4, descripcion: 'Opcional: una ref nueva («n1»…) para cambiar la copia en la misma propuesta.' },
  ] },
  { op: 'capa', id: 'capa_elemento_imagen', titulo: 'Traer adelante o mandar atrás', parametros: [REF, elegir('a', 'A', ['frente', 'atras', 'subir', 'bajar'], 'Arriba de todo, abajo de todo, o un lugar.', true)] },
  { op: 'alinear', id: 'alinear_elementos_imagen', titulo: 'Centrar o alinear con la página', parametros: [
    { nombre: 'refs', rotulo: 'Elementos', tipo: 'string[]', obligatorio: true, max: 100, descripcion: 'Las refs de lo que se alinea.' },
    elegir('a', 'A', ['izquierda', 'centro', 'derecha', 'arriba', 'medio', 'abajo'], 'Con qué borde o centro de la página.', true),
  ] },
  { op: 'bloquear', id: 'bloquear_elemento_imagen', titulo: 'Bloquear un elemento', parametros: [REF, si('bloqueado', 'Bloqueado', 'true lo bloquea; false lo desbloquea.', true)] },
  { op: 'fondo', id: 'fondo_pagina_imagen', titulo: 'Color de fondo del diseño', parametros: [PAGINA, COLOR(true)] },
  { op: 'agregar_pagina', id: 'agregar_pagina_imagen', titulo: 'Agregar una página al diseño', parametros: [
    { nombre: 'despues_de', rotulo: 'Después de', tipo: 'string', max: 12, descripcion: 'Opcional: la ref de la página tras la que va (sin ella, al final).' },
    si('duplicar', 'Copia', 'Opcional: true la hace copia de esa página.'),
  ] },
  { op: 'borrar_pagina', id: 'borrar_pagina_imagen', titulo: 'Borrar una página del diseño', parametros: [
    { nombre: 'pagina', rotulo: 'Página', tipo: 'string', obligatorio: true, max: 12, descripcion: 'La ref de la página (p…) de ver_diseno_imagen.' },
  ] },
  { op: 'agregar_forma', id: 'agregar_forma_imagen', titulo: 'Agregar una forma al diseño', parametros: [
    elegir('forma', 'Forma', ['rectangulo', 'circulo'], 'Rectángulo o círculo.', true), PAGINA,
    { ...X, obligatorio: true, descripcion: 'px desde el borde izquierdo de la página.' }, { ...Y, obligatorio: true, descripcion: 'px desde el borde de arriba.' },
    { ...ANCHO, obligatorio: true, descripcion: 'En px.' }, { ...ALTO, obligatorio: true, descripcion: 'En px.' },
    COLOR(false, 'Opcional: el relleno, #RRGGBB.'), REF_NUEVA,
  ] },
  // Las que dibuja la IA de imágenes del NEGOCIO: se cobran en su cuenta (costo dinero, pantalla y admin).
  { op: 'crear_imagen', id: 'crear_imagen_ia', titulo: 'Crear una imagen con IA', dinero: true, parametros: [PROMPT, PAGINA, X, Y, ANCHO, ALTO, REF_NUEVA] },
  { op: 'editar_imagen', id: 'editar_imagen_ia', titulo: 'Editar una foto con IA', dinero: true, parametros: [
    { ...REF, descripcion: 'La ref de una imagen del diseño (i…) de ver_diseno_imagen.' }, { ...PROMPT, descripcion: 'Qué cambiar y qué dejar igual, en detalle.' },
  ] },
  // 27/10/2026: las nuevas del chat, al final.
  { op: 'voltear', id: 'voltear_elemento_imagen', titulo: 'Voltear un elemento del diseño', parametros: [
    REF, si('horizontal', 'Horizontal', 'Opcional: true lo voltea de lado; false lo devuelve.'), si('vertical', 'Vertical', 'Opcional: true lo voltea de arriba abajo; false lo devuelve.'),
  ] },
  { op: 'ocultar', id: 'ocultar_elemento_imagen', titulo: 'Ocultar un elemento del diseño', parametros: [REF, si('oculto', 'Oculto', 'true lo oculta; false lo vuelve a mostrar.', true)] },
];

/** Lo de la API que acompaña al `para` del chat. */
const PREFIJO =
  'PROPONE en un diseño del Image Editor; NO lo aplica: se acepta en el editor, como un cambio de su chat (devuelve el link). Las refs de elementos y páginas salen de ver_diseno_imagen (sin "pagina", la primera), y lo que se propone por el mismo canal se junta en UNA propuesta. ';
/** Lo de las que dibuja la IA del negocio. */
const PREFIJO_DINERO =
  'PROPONE una imagen con la IA de imágenes del NEGOCIO, que SE COBRA EN SU CUENTA: se crea recién cuando una persona la acepta en el editor (devuelve el link). Las refs salen de ver_diseno_imagen. ';

/** El `para` del chat, dicho para la API. */
export function descripcionApiImagen(o: OperacionApiImagen): string {
  const para = OPERACIONES_CHAT_IMAGEN.find((x) => x.op === o.op)?.para ?? '';
  return `${o.dinero ? PREFIJO_DINERO : PREFIJO}${para}`;
}

export const operacionApiImagenPorId = (id: string): OperacionApiImagen | undefined => OPERACIONES_API_IMAGEN.find((o) => o.id === id);

/** Los campos de estilo que en el chat van sueltos (en la API también: ya tienen la forma del chat). */
export function operacionDesdeInputImagen(o: OperacionApiImagen, input: Record<string, unknown>): { ok: true; op: OperacionImagen } | { ok: false; motivo: string } {
  const { disenoId: _diseno, ...campos } = input;
  const v = validarOperacion({ op: o.op, ...campos });
  return v.ok ? { ok: true, op: v.op } : { ok: false, motivo: v.motivo };
}
