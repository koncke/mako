// =============================================================================
// image-editor/chat/catalogo — lo que el chat «MaKo IA» del Image Editor sabe hacer (el catálogo cerrado)
// =============================================================================
// La IA devuelve operaciones de ESTA lista y nada más (molde: lib/editor-video/chat-catalogo.ts). Cada una tiene:
//   · `forma`: el JSON de ejemplo que lee la IA;
//   · `para`: qué hace y cuándo usarla. Es lo que lee el MODELO (regla de Martín para los chats: «Debería aceptar
//     cualquier pedido del usuario. Por eso es importante documentar las cosas de la API»): lo que no está aquí, la IA
//     tiene que DECIRLO (`NO_SE_PUEDE_CHAT`), no simularlo con otra operación.
// `validarOperacion` es la ÚNICA validación de la forma: la usan la ruta, el panel al pedir y al aceptar, y la API.
// ⚠️ Por eso corre DOS veces sobre lo mismo: lo que devuelve tiene que pasar de nuevo (tests/image-editor-chat.test.ts).
// Fuera de rango se RECHAZA con su motivo, nunca se recorta.
//
// Puro y sin `server-only`: lo leen el panel, la ruta de la IA, la API y los tests.
// =============================================================================

export const TOPES_CHAT_IMAGEN = {
  operaciones: 80,
  texto: 1000,
  posicionMax: 20_000,
  tamanoMin: 1,
  tamanoMax: 20_000,
  fuenteMin: 4,
  fuenteMax: 800,
  // Un carrusel se pega entero: el de Leila (30/10/2026) ya andaba por 1.800. Más de 4.000 no entra en la respuesta de la IA
  // (`maxTokens` de ./ia.ts), y es lo mismo que guarda el hilo (TOPES_HILO.texto).
  instruccion: 4_000,
  vistaMax: 60_000,
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
  | { op: 'agregar_pagina'; despues_de?: string; duplicar?: boolean; nueva?: string }
  | { op: 'borrar_pagina'; pagina: string }
  | { op: 'agregar_forma'; forma: FormaNueva; pagina?: string; x: number; y: number; ancho: number; alto: number; color?: string; ref?: string }
  | { op: 'agregar_foto'; foto: string; pagina?: string; x?: number; y?: number; ancho?: number; alto?: number; cubrir?: boolean; ref?: string }
  | { op: 'fondo_foto'; foto: string; pagina?: string };

export type IdOperacionImagen = OperacionImagen['op'];

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
  { op: 'fondo', forma: '{"op":"fondo","color":"#F3EFE7"}', para: `El color de fondo de UNA página (#RRGGBB). ${PAGINA}. Para que todo el diseño lleve ese fondo, una por cada página.` },
  { op: 'agregar_pagina', forma: '{"op":"agregar_pagina","despues_de":"pa3","duplicar":true,"nueva":"pn1"}', para: 'Agrega una página después de "despues_de" (la ref de una página; sin ella, al final). Con "duplicar": true es una copia de esa página; si no, una en blanco. "nueva": una ref nueva («pn1», «pn2»…) para poner cosas en esa página en este mismo pedido, con su "pagina": sin ella, lo que agregues NO va ahí.' },
  { op: 'borrar_pagina', forma: '{"op":"borrar_pagina","pagina":"pa3"}', para: 'Borra una página con todo lo que tiene. Un diseño siempre se queda con al menos una.' },
  { op: 'agregar_forma', forma: '{"op":"agregar_forma","forma":"rectangulo","x":0,"y":900,"ancho":1080,"alto":180,"color":"#141414","ref":"n2"}', para: `Agrega una forma: "forma" es rectangulo o circulo. ${MEDIDAS}. "color" de relleno (#RRGGBB). ${PAGINA}. "ref" opcional: una nueva («n1»…) para seguir cambiándola en este pedido.` },
  { op: 'agregar_foto', forma: '{"op":"agregar_foto","foto":"o1","x":0,"y":0,"ancho":1080,"alto":720,"cubrir":true,"ref":"n3"}', para: `Pone una foto de la lista "fotos" del DISEÑO: "foto" es su ref. Sin "cubrir" entra entera en la caja (ancho y alto), sin deformarse; con "cubrir": true llena la caja y corta lo que sobra. ${MEDIDAS} (sin medidas va centrada). ${PAGINA}. "ref" opcional: una nueva («n1»…) para seguir cambiándola en este pedido, por ejemplo mandarla atrás de los textos con "capa". Sólo las de "fotos": una dirección de internet no sirve.` },
  { op: 'fondo_foto', forma: '{"op":"fondo_foto","foto":"o1","pagina":"pa3"}', para: `Pone una foto de la lista "fotos" como fondo de UNA página, llenándola. ${PAGINA}.` },
];

/**
 * Lo que el editor sabe hacer con la mano y el chat NO (todavía). Va al final del catálogo para que la IA lo DIGA
 * en el resumen en vez de simularlo con otra operación.
 */
export const NO_SE_PUEDE_CHAT_IMAGEN =
  'agregar íconos o gráficos de la biblioteca; poner una foto que no esté en "fotos" (si la persona no subió ninguna, pídele que la adjunte en el chat); generar imágenes con IA; quitar el fondo de una foto; recortar una foto o cambiar su encuadre; filtros y ajustes de foto; degradados; animaciones; agrupar o desagrupar; cambiar el tamaño del diseño (Redimensionar); usar una plantilla; tablas, gráficos de datos y códigos QR; y lo que va adentro de un grupo («grupo» en la vista)';

const IDS = new Set<string>(OPERACIONES_CHAT_IMAGEN.map((o) => o.op));

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
/** Una ref del diseño («t3k», «pa3») o una nueva («n1»). */
const esRef = (x: unknown): x is string => typeof x === 'string' && /^[a-z][a-z0-9]{1,8}$/.test(x);
// La ref de algo que se agrega en este pedido. Se le pide «n1» (o «pn1» a una página), pero el modelo pone las suyas («t1», «p1k1»):
// probado con la IA de verdad (30/10/2026), por eso se perdía TODO el texto. Un nombre raro no es motivo para perder el contenido.
const esRefNueva = esRef;
// Una página puede venir con la ref que le puso «agregar_pagina» en este pedido, y el modelo también la llama «n1». Si no existe, lo dice aplicar.ts.
const esRefPagina = esRef;
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

/**
 * Cómo se llama cada campo del estilo EN LA PANTALLA. El nombre del campo del JSON no se dibuja: los que son iguales
 * están acá igual, con sus tildes, para que agregar uno nuevo obligue a elegirle un nombre en vez de filtrar el interno.
 */
const NOMBRE_ESTILO: Readonly<Record<(typeof CAMPOS_ESTILO)[number], string>> = {
  fuente: 'la letra', tamano: 'el tamaño de la letra', color: 'el color del texto', negrita: 'la negrita',
  cursiva: 'la cursiva', subrayado: 'el subrayado', alineacion: 'la alineación', mayusculas: 'las mayúsculas',
  interlineado: 'el espacio entre renglones', espaciado: 'el espacio entre letras',
};

/** El estilo de un texto, de los campos sueltos de la operación. `vacio` = se acepta sin ningún campo (agregar_texto). */
function validarEstilo(raw: Record<string, unknown>, vacio: boolean): { ok: true; estilo: EstiloTexto } | { ok: false; motivo: string } {
  const e: EstiloTexto = {};
  const mal = (campo: (typeof CAMPOS_ESTILO)[number]) => ({ ok: false as const, motivo: `no pude cambiar ${NOMBRE_ESTILO[campo]}` });
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
  if (!vacio && !Object.keys(e).length) return { ok: false, motivo: 'un cambio de estilo que no decía qué cambiar' };
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
  agregar_pagina: ['despues_de', 'duplicar', 'nueva'],
  borrar_pagina: ['pagina'],
  agregar_forma: ['forma', 'pagina', 'x', 'y', 'ancho', 'alto', 'color', 'ref'],
  agregar_foto: ['foto', 'pagina', 'x', 'y', 'ancho', 'alto', 'cubrir', 'ref'],
  fondo_foto: ['foto', 'pagina'],
};

const textoValido = (x: unknown): string | null => {
  if (typeof x !== 'string') return null;
  const t = x.trim();
  return t && t.length <= TOPES_CHAT_IMAGEN.texto ? t : null;
};
const posicion = (x: unknown) => enRango(numero(x), -TOPES_CHAT_IMAGEN.posicionMax, TOPES_CHAT_IMAGEN.posicionMax);
const medida = (x: unknown) => enRango(numero(x), TOPES_CHAT_IMAGEN.tamanoMin, TOPES_CHAT_IMAGEN.tamanoMax);

/**
 * Esta función devuelve el estilo adentro de "estilo", pero la IA lo escribe suelto. La ruta valida y el panel vuelve a
 * validar lo que contestó la ruta: sin esto, la segunda pasada tiraba TODOS los textos, y del carrusel de Leila
 * (30/10/2026) quedó sólo el fondo. Lo de adentro pasa por la misma lista que lo suelto.
 */
function conEstiloAfuera(raw: Record<string, unknown>): Record<string, unknown> {
  if ((raw.op !== 'agregar_texto' && raw.op !== 'estilo_texto') || !esObjeto(raw.estilo)) return raw;
  const { estilo, ...resto } = raw;
  return { ...(estilo as Record<string, unknown>), ...resto };
}

/** Una operación de la IA, validada; o el motivo por el que no. El motivo es corto: lo ve la persona. */
export function validarOperacion(crudo: unknown): Validada {
  if (!esObjeto(crudo) || typeof crudo.op !== 'string') return { ok: false, motivo: 'un cambio que no entendí' };
  const op = crudo.op as IdOperacionImagen;
  if (!IDS.has(op)) return { ok: false, motivo: 'algo que todavía no sé hacer en el diseño' };
  const raw = conEstiloAfuera(crudo);
  const extra = sobrante(raw, VALIDAS[op]);
  if (extra) return { ok: false, motivo: 'un cambio con un dato que no va ahí' };
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
      if (raw.pagina !== undefined && !esRefPagina(raw.pagina)) return { ok: false, motivo: 'un texto en una página que ya no está' };
      if ((raw.x !== undefined && !posicion(raw.x)) || (raw.y !== undefined && !posicion(raw.y))) return { ok: false, motivo: 'un texto en un lugar que se sale del diseño' };
      if (raw.ancho !== undefined && !medida(raw.ancho)) return { ok: false, motivo: 'un texto con un ancho que no se puede usar' };
      if (ref !== undefined && !esRefNueva(ref)) return { ok: false, motivo: 'un texto nuevo que no pude identificar' };
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
      if (raw.x === undefined && raw.y === undefined) return { ok: false, motivo: 'un movimiento sin decir hacia dónde' };
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
      if (!esRef(ref) || !enRango(g, -360, 360)) return { ok: false, motivo: 'un giro sin elemento, o de más de una vuelta' };
      return { ok: true, op: { op, ref, grados: r1(g) } };
    }
    case 'opacidad': {
      const o = numero(raw.opacidad);
      if (!esRef(ref) || !enRango(o, 0, 100)) return { ok: false, motivo: 'una opacidad fuera de 0 a 100' };
      return { ok: true, op: { op, ref, opacidad: Math.round(o) } };
    }
    case 'color': {
      const c = colorHex(raw.color);
      if (!esRef(ref) || !c) return { ok: false, motivo: 'un color que no pude leer' };
      return { ok: true, op: { op, ref, color: c } };
    }
    case 'borde': {
      if (!esRef(ref)) return sinRef('un borde');
      if (raw.color === undefined && raw.grosor === undefined) return { ok: false, motivo: 'un borde sin color ni grosor' };
      const c = raw.color === undefined ? undefined : colorHex(raw.color);
      if (c === null) return { ok: false, motivo: 'un borde con un color que no pude leer' };
      if (raw.grosor !== undefined && !enRango(numero(raw.grosor), 0, 200)) return { ok: false, motivo: 'un grosor fuera de 0 a 200' };
      return { ok: true, op: { op, ref, ...(c ? { color: c } : {}), ...(raw.grosor !== undefined ? { grosor: r1(raw.grosor as number) } : {}) } };
    }
    case 'borrar':
    case 'alinear': {
      const refs = Array.isArray(raw.refs) ? [...new Set(raw.refs.filter(esRef))] : [];
      if (!refs.length) return { ok: false, motivo: op === 'borrar' ? 'un borrado sin elementos' : 'un alinear sin elementos' };
      if (op === 'borrar') return { ok: true, op: { op, refs } };
      if (!['izquierda', 'centro', 'derecha', 'arriba', 'medio', 'abajo'].includes(String(raw.a))) return { ok: false, motivo: 'un alinear sin decir hacia dónde (izquierda, centro, derecha, arriba, medio o abajo)' };
      return { ok: true, op: { op, refs, a: raw.a as AlinearA } };
    }
    case 'duplicar': {
      if (!esRef(ref)) return sinRef('un duplicar');
      if ((raw.dx !== undefined && !posicion(raw.dx)) || (raw.dy !== undefined && !posicion(raw.dy))) return { ok: false, motivo: 'una copia movida demasiado lejos' };
      if (raw.nueva !== undefined && !esRefNueva(raw.nueva)) return { ok: false, motivo: 'una copia que no pude identificar' };
      return {
        ok: true,
        op: { op, ref, ...(raw.dx !== undefined ? { dx: r1(raw.dx as number) } : {}), ...(raw.dy !== undefined ? { dy: r1(raw.dy as number) } : {}), ...(raw.nueva !== undefined ? { nueva: raw.nueva as string } : {}) },
      };
    }
    case 'capa': {
      if (!esRef(ref) || !['frente', 'atras', 'subir', 'bajar'].includes(String(raw.a))) return { ok: false, motivo: 'un cambio de orden sin decir adónde (al frente, atrás, subir o bajar)' };
      return { ok: true, op: { op, ref, a: raw.a as CapaA } };
    }
    case 'bloquear': {
      if (!esRef(ref) || typeof raw.bloqueado !== 'boolean') return { ok: false, motivo: 'un bloquear incompleto' };
      return { ok: true, op: { op, ref, bloqueado: raw.bloqueado } };
    }
    case 'fondo': {
      const c = colorHex(raw.color);
      if (!c) return { ok: false, motivo: 'un fondo con un color que no pude leer' };
      if (raw.pagina !== undefined && !esRefPagina(raw.pagina)) return { ok: false, motivo: 'un fondo de una página que ya no está' };
      return { ok: true, op: { op, color: c, ...(raw.pagina !== undefined ? { pagina: raw.pagina as string } : {}) } };
    }
    case 'agregar_pagina': {
      if (raw.despues_de !== undefined && !esRefPagina(raw.despues_de)) return { ok: false, motivo: 'una página nueva después de otra que ya no está' };
      if (raw.duplicar !== undefined && typeof raw.duplicar !== 'boolean') return { ok: false, motivo: 'una página nueva sin decir si es una copia' };
      if (raw.nueva !== undefined && !esRefPagina(raw.nueva)) return { ok: false, motivo: 'una página nueva que no pude identificar' };
      return { ok: true, op: { op, ...(raw.despues_de !== undefined ? { despues_de: raw.despues_de as string } : {}), ...(raw.duplicar === true ? { duplicar: true } : {}), ...(raw.nueva !== undefined ? { nueva: raw.nueva as string } : {}) } };
    }
    case 'borrar_pagina': {
      if (!esRefPagina(raw.pagina)) return { ok: false, motivo: 'un borrar página sin la página' };
      return { ok: true, op: { op, pagina: raw.pagina } };
    }
    case 'agregar_forma': {
      if (raw.forma !== 'rectangulo' && raw.forma !== 'circulo') return { ok: false, motivo: 'una forma que no es un rectángulo ni un círculo' };
      if (!posicion(raw.x) || !posicion(raw.y) || !medida(raw.ancho) || !medida(raw.alto)) return { ok: false, motivo: 'una forma sin medidas válidas' };
      const c = raw.color === undefined ? undefined : colorHex(raw.color);
      if (c === null) return { ok: false, motivo: 'una forma con un color que no pude leer' };
      if (raw.pagina !== undefined && !esRefPagina(raw.pagina)) return { ok: false, motivo: 'una forma en una página que ya no está' };
      if (ref !== undefined && !esRefNueva(ref)) return { ok: false, motivo: 'una forma nueva que no pude identificar' };
      return {
        ok: true,
        op: {
          op, forma: raw.forma, x: r1(raw.x as number), y: r1(raw.y as number), ancho: r1(raw.ancho as number), alto: r1(raw.alto as number),
          ...(c ? { color: c } : {}), ...(raw.pagina !== undefined ? { pagina: raw.pagina as string } : {}), ...(ref !== undefined ? { ref: ref as string } : {}),
        },
      };
    }
    case 'agregar_foto': {
      if (!esRef(raw.foto)) return { ok: false, motivo: 'una foto que no es de la lista' };
      if ((raw.x !== undefined && !posicion(raw.x)) || (raw.y !== undefined && !posicion(raw.y))) return { ok: false, motivo: 'una foto fuera de la página' };
      if ((raw.ancho !== undefined && !medida(raw.ancho)) || (raw.alto !== undefined && !medida(raw.alto))) return { ok: false, motivo: 'una foto sin medidas válidas' };
      if (raw.cubrir !== undefined && typeof raw.cubrir !== 'boolean') return { ok: false, motivo: 'una foto sin decir si tiene que cubrir el espacio' };
      if (raw.pagina !== undefined && !esRefPagina(raw.pagina)) return { ok: false, motivo: 'una foto en una página que ya no está' };
      if (ref !== undefined && !esRefNueva(ref)) return { ok: false, motivo: 'una foto nueva que no pude identificar' };
      return {
        ok: true,
        op: {
          op, foto: raw.foto,
          ...(raw.x !== undefined ? { x: r1(raw.x as number) } : {}), ...(raw.y !== undefined ? { y: r1(raw.y as number) } : {}),
          ...(raw.ancho !== undefined ? { ancho: r1(raw.ancho as number) } : {}), ...(raw.alto !== undefined ? { alto: r1(raw.alto as number) } : {}),
          ...(raw.cubrir === true ? { cubrir: true } : {}),
          ...(raw.pagina !== undefined ? { pagina: raw.pagina as string } : {}), ...(ref !== undefined ? { ref: ref as string } : {}),
        },
      };
    }
    case 'fondo_foto': {
      if (!esRef(raw.foto)) return { ok: false, motivo: 'una foto que no es de la lista' };
      if (raw.pagina !== undefined && !esRefPagina(raw.pagina)) return { ok: false, motivo: 'un fondo de una página que ya no está' };
      return { ok: true, op: { op, foto: raw.foto, ...(raw.pagina !== undefined ? { pagina: raw.pagina as string } : {}) } };
    }
  }
}

/** La ref que anuncia una operación que agrega algo («ref» de un texto o una forma, «nueva» de una copia o una página). */
function refQueAgrega(raw: unknown): string | null {
  if (!esObjeto(raw)) return null;
  const x = raw.op === 'agregar_texto' || raw.op === 'agregar_forma' || raw.op === 'agregar_foto' ? raw.ref : raw.op === 'duplicar' || raw.op === 'agregar_pagina' ? raw.nueva : null;
  return typeof x === 'string' ? x : null;
}

/** Las refs de las que depende una operación: el elemento, los elementos y la página. */
function refsQueUsa(raw: unknown): string[] {
  if (!esObjeto(raw)) return [];
  const agrega = raw.op === 'agregar_texto' || raw.op === 'agregar_forma' || raw.op === 'agregar_foto';
  return [...(agrega ? [] : [raw.ref]), ...(Array.isArray(raw.refs) ? raw.refs : []), raw.pagina, raw.despues_de].filter((x): x is string => typeof x === 'string');
}

/** Todas las de la respuesta: las válidas, en orden, y por qué se descartó cada otra. */
export function validarOperaciones(raw: unknown): { operaciones: OperacionImagen[]; descartes: string[] } {
  const lista = Array.isArray(raw) ? raw : [];
  const operaciones: OperacionImagen[] = [];
  const descartes: string[] = [];
  // Lo que iba a agregar algo que se cayó: lo que sigue hablando de esa ref se va con ella, porque la IA puede llamar a lo
  // nuevo como a algo que ya está, y un «borrar» caería sobre lo de la persona (la revisión del 30/10/2026).
  const caidas = new Set<string>();
  for (const r of lista) {
    if (operaciones.length >= TOPES_CHAT_IMAGEN.operaciones) {
      descartes.push(`más de ${TOPES_CHAT_IMAGEN.operaciones} cambios de una vez`);
      break;
    }
    const nueva = refQueAgrega(r);
    const v = validarOperacion(r);
    if (!v.ok) {
      if (nueva) caidas.add(nueva);
      // ⚠️ El MOTIVO es para la persona y no nombra ni un campo del JSON ni el id de una operación (encargo del
      //    6/11/2026: leía «estilo no es algo de cambiar_texto»). Lo técnico va acá, que es donde se busca cuando hay
      //    que entender por qué la IA propuso algo inválido — y es más útil que la frase: está la operación entera.
      console.warn('[image-editor/chat] operación descartada:', v.motivo, JSON.stringify(r).slice(0, 400));
      descartes.push(v.motivo);
    } else if (refsQueUsa(r).some((x) => caidas.has(x))) {
      if (nueva) caidas.add(nueva);
      descartes.push('algo que dependía de un elemento que no se pudo agregar');
    } else {
      if (nueva) caidas.delete(nueva);
      operaciones.push(v.op);
    }
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

/** Forma del JSON de respuesta (va en el slot {{formato}}). */
export const FORMATO_CHAT_IMAGEN = `Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin markdown ni texto fuera del JSON, con esta forma:
{"resumen": "una frase para la persona: qué vas a cambiar, o por qué no se puede", "operaciones": [ …operaciones del catálogo, en el orden en que se aplican… ]}
Si el pedido no se puede hacer con el catálogo, "operaciones" va vacío y el resumen dice qué no se puede. Si sólo se puede una parte, haz esa parte y el resumen dice qué parte no.`;
