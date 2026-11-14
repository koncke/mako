// =============================================================================
// image-editor/plantillas-reales — las plantillas reales de Image: ESTRUCTURA y EJEMPLO aparte, generadas por código
// =============================================================================
// El plan es docs/plantillas-reales/image.md (la tabla de la sección 2.1 y el detalle capa por capa de cada plantilla). De
// sus 12 plantillas, la 3, la 4 y la 5 (los carruseles) ya existen como tipos de lib/carruseles/tipos.ts (`lista`, `mito` y
// `caso`) y no se repiten acá: estas son las otras 9.
//
// La regla de Martín del 29/10, la misma de los carruseles: la plantilla nace con la ESTRUCTURA (las mismas capas y la misma
// composición, con textos que dicen qué va en cada una: «Tu precio», «Tu gancho»…), y el EJEMPLO lleno de un negocio
// ficticio del elenco (docs/plantillas-reales/README.md, 2.2) se arma aparte. Las dos salen de la MISMA función `armar` con
// dos juegos de textos del mismo tipo: no pueden tener capas distintas ni separarse con el tiempo.
//
// Se generan acá y no en JSON escritos a mano (image.md, 5.1: doce JSON de fabric crudo son ~400 KB). Los objetos tienen la
// forma que guarda el motor (la de `DoryDocument`, como lib/carruseles/documento.ts): `textbox`, `rect`,
// `ellipse` y `path`, con NOMBRES por función («Gancho», «Titular», «Tu foto», «Acción»): así el chat del editor los
// encuentra por su nombre. Sin grupos (Fabric ubica a los hijos de un grupo desde su centro, y el chat no edita adentro):
// lo que va inclinado (las notificaciones de la 1, la polaroid de la 10) se rota capa por capa alrededor de un mismo pivote.
//
// Las fotos son MARCOS VACÍOS (un `rect` con `isPlaceholder`, como lo hacían las plantillas de Doory): al tocarlos, el
// editor pide la foto. Ni la estructura ni el ejemplo traen fotos de stock ni caras (image.md, trampa 6); las fotos de
// muestra son un paso aparte. Un marco vacío no sale en la descarga (`render.ts` lo filtra).
//
// Medidas que se apartan del plan, por lo que MIDE la fuente (Fontsource 5.3, PIL, 06/11/2026; image.md, trampa 9: se acorta
// o se acomoda, no se deja desbordar):
//   · 1: el «15/15» va en Anton 260 (en 300 mide 616 px y no entra en los 540 de la derecha); las notificaciones, en tarjetas
//     de 590 con Inter 30 («Pago recibido · USD 800 (1 de 2)» mide 497 en 32 y no entraba en 540); el marco de la versión B
//     baja a 500 × 520 para dejar libre la esquina de la duración.
//   · 6: el titular en Playfair 56, el precio en 80 y los datos en Inter 30: en el 32 % de abajo no entran las siete capas
//     con los tamaños del plan. Los «íconos de línea» de los datos son tres rombos dorados.
//   · 10: la carta en Lora 34 (en 40 son ~16 renglones y no entra con la polaroid y la firma), y la polaroid de 270 × 300.
//
// Puro (sin `server-only`, sin el motor): lo pueden leer la acción que crea, la API de MaKo y los tests.
// =============================================================================

import type { DocObject, DocPage, DoryDocument, ObjectEffects, PageBackground, ShadowSpec } from '@/app/image-editor/_doory/types/document';
import { altoDeTexto } from '@/lib/carruseles/documento';

export type DocumentoDoory = DoryDocument;

export type GrupoImagen = 'Miniaturas de YouTube' | 'Miniaturas verticales' | 'Publicaciones' | 'Historias' | 'Anuncios' | 'Presentaciones';

/** Los hechos que pide cada plantilla, en orden (image.md, 3.4: la tabla de preguntas). */
export type PideImagen =
  | 'titulo_video' | 'resultado' | 'caso' | 'foto' | 'respuesta_mensaje' | 'cupos' | 'fecha'
  | 'propiedad' | 'comparacion' | 'historia' | 'creencia' | 'oferta';

export type PlantillaImagen = {
  /** Slug permanente: los diseños creados la recuerdan por él. No se renombra. */
  id: string;
  nombre: string;
  /** Cuándo usarla, en una línea. */
  cuando: string;
  grupo: GrupoImagen;
  /** El negocio ficticio del ejemplo (el elenco del README, 2.2). */
  negocio: string;
  ancho: number;
  alto: number;
  paginas: number;
  insignia: string;
  pide: readonly PideImagen[];
  /** El tope propio de palabras por página, cuando la pieza no entra en el de su formato (image.md, 3.1, punto 3). */
  topePalabras?: number;
  /** El documento con la ESTRUCTURA: las mismas capas y la misma composición, con textos que dicen qué va. */
  estructura: (nuevoId?: () => string) => DocumentoDoory;
  /** La misma composición llena con el ejemplo del negocio ficticio. */
  ejemplo: (nuevoId?: () => string) => DocumentoDoory;
  /** El titular del ejemplo (para la tarjeta). */
  extracto: string;
  /** 2 o 3 nombres de capa o de página que la tarjeta muestra. */
  chips: readonly string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Las piezas: un objeto como lo guarda el motor
// ─────────────────────────────────────────────────────────────────────────────

type Ctx = { id: () => string };
const nuevoCtx = (nuevoId?: () => string): Ctx => ({ id: nuevoId ?? (() => globalThis.crypto.randomUUID()) });

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Las familias, todas en app/image-editor/mako/fuentes.ts. Dos por pieza como mucho. */
const F = {
  anton: '"Anton", sans-serif',
  archivo: '"Archivo Black", sans-serif',
  inter: '"Inter", sans-serif',
  serif: '"DM Serif Display", serif',
  playfair: '"Playfair Display", serif',
  lora: '"Lora", serif',
  caveat: '"Caveat", cursive',
} as const;

/** Lo común de todo objeto, como lo guarda el motor (el mismo de lib/carruseles/documento.ts). */
const BASE = {
  stroke: null, strokeWidth: 0, strokeDashArray: null, strokeLineCap: 'butt', strokeDashOffset: 0, strokeLineJoin: 'miter',
  strokeUniform: true, strokeMiterLimit: 4, scaleX: 1, scaleY: 1, angle: 0, flipX: false, flipY: false, opacity: 1, shadow: null,
  visible: true, backgroundColor: '', fillRule: 'nonzero', paintFirst: 'fill', globalCompositeOperation: 'source-over', skewX: 0, skewY: 0,
} as const;

/** La sombra va en `effects` (lo que guarda y edita el editor) y en `shadow` (lo que dibuja Fabric). */
const sombra = (s: ShadowSpec | undefined) => (s ? { shadow: { ...s } } : {});

type OpTexto = {
  x: number; y: number; w: number; tam: number; fam: string; color: string;
  peso?: number; alin?: 'left' | 'center' | 'right'; inter?: number; esp?: number;
  mayus?: boolean; italica?: boolean; tachado?: boolean;
  contorno?: { color: string; width: number };
  /** Resaltado detrás de las letras (el efecto `background`, image.md 2.0): nunca una forma detrás. */
  resaltado?: string;
  sombra?: ShadowSpec;
};

function texto(c: Ctx, nombre: string, t: string, o: OpTexto): DocObject {
  const inter = o.inter ?? 1.2;
  const visible = o.mayus ? t.toLocaleUpperCase('es') : t;
  const efectos: ObjectEffects = {};
  if (o.contorno) efectos.outline = { ...o.contorno };
  if (o.resaltado) efectos.background = { color: o.resaltado };
  if (o.sombra) efectos.shadow = { ...o.sombra };
  return {
    fontSize: o.tam, fontWeight: o.peso ?? 400, fontFamily: o.fam, fontStyle: o.italica ? 'italic' : 'normal', lineHeight: inter, text: visible,
    charSpacing: o.esp ?? 0, textAlign: o.alin ?? 'left', styles: [], pathStartOffset: 0, pathSide: 'left', pathAlign: 'baseline',
    underline: false, overline: false, linethrough: o.tachado === true, textBackgroundColor: o.resaltado ?? '', direction: 'ltr',
    textDecorationThickness: 66.667, minWidth: 20, splitByGrapheme: false,
    id: c.id(), name: nombre, type: 'textbox', originX: 'left', originY: 'top',
    left: o.x, top: o.y, width: o.w, height: altoDeTexto(visible, o.tam, o.w, inter), fill: o.color,
    ...BASE, strokeWidth: 1,
    ...(o.contorno ? { stroke: o.contorno.color, strokeWidth: o.contorno.width, paintFirst: 'stroke', strokeLineJoin: 'round' } : {}),
    ...sombra(o.sombra),
    ...(Object.keys(efectos).length > 0 ? { effects: efectos } : {}),
    ...(o.mayus ? { textCase: 'upper', caseSource: t } : {}),
  };
}

type OpForma = { borde?: { color: string; width: number }; sombra?: ShadowSpec; opacidad?: number; bloqueado?: boolean };

const extras = (o: OpForma) => ({
  ...(o.borde ? { stroke: o.borde.color, strokeWidth: o.borde.width } : {}),
  ...sombra(o.sombra),
  ...(o.sombra ? { effects: { shadow: { ...o.sombra } } } : {}),
  ...(o.opacidad != null ? { opacity: o.opacidad } : {}),
  ...(o.bloqueado ? { locked: true } : {}),
});

function rect(c: Ctx, nombre: string, o: OpForma & { x: number; y: number; w: number; h: number; fill: string | null; radio?: number }): DocObject {
  return {
    rx: o.radio ?? 0, ry: o.radio ?? 0, id: c.id(), name: nombre, type: 'rect', originX: 'left', originY: 'top',
    left: o.x, top: o.y, width: o.w, height: o.h, fill: o.fill, ...BASE, ...extras(o),
  };
}

function circulo(c: Ctx, nombre: string, o: OpForma & { cx: number; cy: number; r: number; fill: string | null }): DocObject {
  return {
    rx: o.r, ry: o.r, id: c.id(), name: nombre, shapeKind: 'ellipse', type: 'ellipse', originX: 'center', originY: 'center',
    left: o.cx, top: o.cy, width: o.r * 2, height: o.r * 2, fill: o.fill, ...BASE, ...extras(o),
  };
}

/** Un marco de foto VACÍO: al tocarlo, el editor pide la foto y la mete con su máscara. */
function foto(c: Ctx, nombre: string, o: { cx: number; cy: number; w: number; h: number; mascara?: 'rounded' | 'circle'; radio?: number }): DocObject {
  return {
    rx: 0, ry: 0, id: c.id(), name: nombre,
    ...(o.mascara ? { maskShape: o.mascara } : {}),
    ...(o.mascara === 'rounded' ? { maskRadius: o.radio ?? 0.05 } : {}),
    isPlaceholder: true, type: 'rect', originX: 'center', originY: 'center',
    left: o.cx, top: o.cy, width: o.w, height: o.h, fill: 'rgba(140, 128, 132, 0.18)', ...BASE,
  };
}

type Cmd = (string | number)[];

/** La caja de un trazo como la mide Fabric (las curvas, muestreadas): el trazo se ubica por su centro. */
function cajaDe(cmds: readonly Cmd[]): { x0: number; y0: number; x1: number; y1: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  let px = 0;
  let py = 0;
  const punto = (x: number, y: number) => { xs.push(x); ys.push(y); };
  for (const cmd of cmds) {
    const [k, ...n] = cmd as [string, ...number[]];
    if (k === 'M' || k === 'L') { punto(n[0], n[1]); px = n[0]; py = n[1]; }
    else if (k === 'Q') {
      for (let i = 0; i <= 32; i++) {
        const t = i / 32; const u = 1 - t;
        punto(u * u * px + 2 * u * t * n[0] + t * t * n[2], u * u * py + 2 * u * t * n[1] + t * t * n[3]);
      }
      px = n[2]; py = n[3];
    } else if (k === 'C') {
      for (let i = 0; i <= 32; i++) {
        const t = i / 32; const u = 1 - t;
        punto(u ** 3 * px + 3 * u * u * t * n[0] + 3 * u * t * t * n[2] + t ** 3 * n[4], u ** 3 * py + 3 * u * u * t * n[1] + 3 * u * t * t * n[3] + t ** 3 * n[5]);
      }
      px = n[4]; py = n[5];
    }
  }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function trazo(c: Ctx, nombre: string, cmds: Cmd[], o: { stroke?: string; width?: number; fill?: string | null; bloqueado?: boolean }): DocObject {
  const b = cajaDe(cmds);
  return {
    id: c.id(), name: nombre, type: 'path', originX: 'center', originY: 'center',
    left: r2((b.x0 + b.x1) / 2), top: r2((b.y0 + b.y1) / 2), width: r2(b.x1 - b.x0), height: r2(b.y1 - b.y0),
    ...BASE, fill: o.fill ?? null, stroke: o.stroke ?? null, strokeWidth: o.width ?? 0, strokeLineCap: 'round', strokeLineJoin: 'round',
    path: cmds.map((cmd) => cmd.map((v) => (typeof v === 'number' ? r2(v) : v))),
    ...(o.bloqueado ? { locked: true } : {}),
  };
}

/** Rota varias capas como si fueran una: cada una gira alrededor del mismo pivote (Fabric gira cada objeto sobre su origen). */
function rotar(objs: DocObject[], grados: number, px: number, py: number): DocObject[] {
  const a = (grados * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return objs.map((o) => {
    const dx = Number(o.left) - px;
    const dy = Number(o.top) - py;
    return { ...o, left: r2(px + dx * cos - dy * sin), top: r2(py + dx * sin + dy * cos), angle: grados };
  });
}

/** Una flecha: la curva de `desde` a `hasta` y la punta, en un solo trazo. */
function flecha(desde: [number, number], control: [number, number], hasta: [number, number], punta = 36): Cmd[] {
  const vx = hasta[0] - control[0];
  const vy = hasta[1] - control[1];
  const n = Math.hypot(vx, vy) || 1;
  const ux = vx / n;
  const uy = vy / n;
  const ala = (s: number): [number, number] => {
    const a = (s * 28 * Math.PI) / 180;
    const rx = ux * Math.cos(a) - uy * Math.sin(a);
    const ry = ux * Math.sin(a) + uy * Math.cos(a);
    return [hasta[0] - rx * punta, hasta[1] - ry * punta];
  };
  const [a1, a2] = [ala(1), ala(-1)];
  return [['M', ...desde], ['Q', ...control, ...hasta], ['M', ...a1], ['L', ...hasta], ['L', ...a2]];
}

/** Un rectángulo redondeado como sub-trazo (para dibujar muchas tarjetas en un solo `path`). */
function rectRedondo(x: number, y: number, w: number, h: number, r: number): Cmd[] {
  return [
    ['M', x + r, y], ['L', x + w - r, y], ['Q', x + w, y, x + w, y + r], ['L', x + w, y + h - r], ['Q', x + w, y + h, x + w - r, y + h],
    ['L', x + r, y + h], ['Q', x, y + h, x, y + h - r], ['L', x, y + r], ['Q', x, y, x + r, y],
  ];
}

const solido = (color: string): PageBackground => ({ type: 'solid', color });

function pagina(c: Ctx, nombre: string, fondo: PageBackground, objetos: DocObject[], notas?: string): DocPage {
  return { id: c.id(), name: nombre, background: fondo, objects: objetos, ...(notas ? { notes: notas } : {}) };
}

function documento(ancho: number, alto: number, paginas: DocPage[]): DocumentoDoory {
  return { schemaVersion: 1, width: ancho, height: alto, unit: 'px', pages: paginas };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Miniatura · Resultado con cara · Coach (Cierre Consultivo)
// ─────────────────────────────────────────────────────────────────────────────

type T1 = { gancho: string; dato: string; unidad: string; notif: [string, string, string]; notas: string };

const T1_GUIA: T1 = {
  gancho: 'Tu\ngancho',
  dato: '0/0',
  unidad: 'Qué cuentas',
  notif: ['Tu pago o inscripción real', 'Otro pago real', 'Tu meta cumplida'],
  notas: 'Título del video: escríbelo aquí. El gancho de la miniatura no lo repite: le agrega algo. · Prueba las dos versiones con la prueba A/B de miniaturas de YouTube Studio.',
};

const T1_EJEMPLO: T1 = {
  gancho: 'Sin\nanuncios',
  dato: '15/15',
  unidad: 'Lugares',
  notif: ['Pago recibido · USD 1,500', 'Pago recibido · USD 800 (1 de 2)', 'Lugar 15 de 15 confirmado'],
  notas: 'Título: «Cómo llené 15 lugares de mi programa solo por WhatsApp» · Prueba las dos versiones con la prueba A/B de miniaturas de YouTube Studio.',
};

function armar1(c: Ctx, t: T1): DocumentoDoory {
  const fondo: PageBackground = { type: 'gradient', kind: 'linear', angle: 0, stops: [{ offset: 0, color: '#0E7490' }, { offset: 1, color: '#22D3EE' }] };
  const tinta = '#0B1220';
  const gancho = () => texto(c, 'Gancho', t.gancho, { x: 64, y: 60, w: 600, tam: 150, fam: F.anton, color: '#FFFFFF', mayus: true, inter: 1, contorno: { color: tinta, width: 6 } });
  // Las tres notificaciones, inclinadas −4° como una sola pieza alrededor de su esquina de arriba a la izquierda.
  const notificaciones = () => rotar(t.notif.flatMap((linea, i) => {
    const y = 384 + i * 108;
    const n = `Notificaciones: ${i + 1}`;
    return [
      rect(c, `${n} · tarjeta`, { x: 64, y, w: 590, h: 92, fill: '#FFFFFF', radio: 24, sombra: { color: '#0B122040', blur: 18, offsetX: 0, offsetY: 6 } }),
      circulo(c, `${n} · círculo`, { cx: 110, cy: y + 46, r: 26, fill: '#16A34A' }),
      trazo(c, `${n} · tilde`, [['M', 99, y + 47], ['L', 107, y + 55], ['L', 122, y + 38]], { stroke: '#FFFFFF', width: 6 }),
      texto(c, n, linea, { x: 152, y: y + 29, w: 486, tam: 30, peso: 600, fam: F.inter, color: tinta, inter: 1.1 }),
    ];
  }), -4, 64, 384);

  const versionA = pagina(c, 'Versión A · sin cara', fondo, [
    gancho(),
    texto(c, 'Dato', t.dato, { x: 700, y: 40, w: 540, tam: 260, fam: F.anton, color: '#FACC15', alin: 'center', inter: 1, contorno: { color: tinta, width: 8 } }),
    texto(c, 'Dato: unidad', t.unidad, { x: 700, y: 336, w: 540, tam: 64, fam: F.archivo, color: '#FFFFFF', alin: 'center', mayus: true, inter: 1, contorno: { color: tinta, width: 4 } }),
    ...notificaciones(),
  ], t.notas);

  const versionB = pagina(c, 'Versión B · con cara', fondo, [
    gancho(),
    rect(c, 'Marco de la foto', { x: 710, y: 50, w: 500, h: 520, fill: '#FFFFFF', radio: 28, sombra: { color: '#0B122033', blur: 24, offsetX: 0, offsetY: 8 } }),
    foto(c, 'Tu foto', { cx: 960, cy: 310, w: 484, h: 504, mascara: 'rounded', radio: 0.05 }),
    ...notificaciones(),
  ]);
  return documento(1280, 720, [versionA, versionB]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Miniatura · Número sin cara · Agencia (Pulso Dental)
// ─────────────────────────────────────────────────────────────────────────────

/** `gancho` va en dos renglones en la versión A (el salto de línea) y en uno, más chico, en la B. */
type T2 = { gancho: string; notas: string };

const T2_GUIA: T2 = {
  gancho: '¿Y\ntú?',
  notas: 'Título del video: escríbelo aquí. El número vive en la cuadrícula (cuántos de cuántos) y el gancho agrega una pregunta, sin repetir el título. · Prueba las dos versiones con la prueba A/B de miniaturas de YouTube Studio.',
};

const T2_EJEMPLO: T2 = {
  gancho: '¿El\ntuyo?',
  notas: 'Título: «Revisé 50 anuncios de clínicas dentales: por qué 43 no traen pacientes» · Prueba las dos versiones con la prueba A/B de miniaturas de YouTube Studio.',
};

/** La cuadrícula de 10 × 5: dónde va cada tarjeta, cuáles llevan el tilde verde (7) y cuál va señalada (con X). */
const COLUMNAS = 10;
const FILAS = 5;
const CON_TILDE = new Set([3, 12, 26, 31, 37, 44, 49]);
const SENALADA = 35; // fila 4, columna 6 (lleva X)

const tarjeta = (i: number) => ({ x: 48 + (i % COLUMNAS) * 72, y: 118 + Math.floor(i / COLUMNAS) * 100 });

function cuadricula(c: Ctx): DocObject[] {
  const todas = Array.from({ length: COLUMNAS * FILAS }, (_, i) => i);
  const fondos = todas.flatMap((i) => rectRedondo(tarjeta(i).x, tarjeta(i).y, 60, 84, 6));
  const cruces = todas.filter((i) => !CON_TILDE.has(i)).flatMap((i) => {
    const cx = tarjeta(i).x + 30;
    const cy = tarjeta(i).y + 42;
    return [['M', cx - 15, cy - 15], ['L', cx + 15, cy + 15], ['M', cx + 15, cy - 15], ['L', cx - 15, cy + 15]] as Cmd[];
  });
  const tildes = [...CON_TILDE].flatMap((i) => {
    const cx = tarjeta(i).x + 30;
    const cy = tarjeta(i).y + 42;
    return [['M', cx - 15, cy + 1], ['L', cx - 5, cy + 11], ['L', cx + 15, cy - 11]] as Cmd[];
  });
  const s = tarjeta(SENALADA);
  return [
    trazo(c, 'Cuadrícula de anuncios: tarjetas', fondos, { fill: '#FFFFFF', stroke: '#CBD5E1', width: 2, bloqueado: true }),
    trazo(c, 'Cuadrícula de anuncios: cruces', cruces, { stroke: '#DC2626', width: 5, bloqueado: true }),
    trazo(c, 'Cuadrícula de anuncios: tildes', tildes, { stroke: '#16A34A', width: 5, bloqueado: true }),
    circulo(c, 'Señalado', { cx: s.x + 30, cy: s.y + 42, r: 58, fill: null, borde: { color: '#DC2626', width: 10 } }),
  ];
}

function armar2(c: Ctx, t: T2): DocumentoDoory {
  const fondo = solido('#E0F2FE');
  const s = tarjeta(SENALADA);
  const destino: [number, number] = [s.x + 30 + 74, s.y + 30];

  // El alto del texto es de los renglones que lleva (Fabric: tamaño × 1,13 por renglón con interlineado 1): con uno solo
  // calculado, «¿EL TUYO?» en dos renglones se salía del bloque por abajo (medido el 6/11/2026).
  const bloque = (x: number, y: number, w: number, h: number, tam: number, renglones: 1 | 2) => {
    const dice = renglones === 1 ? t.gancho.replace(/\n/g, ' ') : t.gancho;
    return rotar([
      rect(c, 'Bloque del gancho', { x, y, w, h, fill: '#FACC15', radio: 6 }),
      texto(c, 'Gancho', dice, { x, y: y + (h - renglones * tam * 1.13) / 2, w, tam, fam: F.anton, color: '#0B1220', alin: 'center', mayus: true, inter: 1 }),
    ], -3, x + w / 2, y + h / 2);
  };

  const versionA = pagina(c, 'Versión A · sin cara', fondo, [
    ...cuadricula(c),
    ...bloque(800, 50, 430, 380, 150, 2),
    trazo(c, 'Flecha', flecha([880, 450], [780, 520], destino), { stroke: '#0B1220', width: 10 }),
  ], t.notas);

  const versionB = pagina(c, 'Versión B · con cara', fondo, [
    ...cuadricula(c),
    ...bloque(820, 46, 400, 150, 100, 1),
    rect(c, 'Marco de la foto', { x: 880, y: 236, w: 330, h: 344, fill: '#FFFFFF', radio: 24, sombra: { color: '#0B122033', blur: 22, offsetX: 0, offsetY: 8 } }),
    foto(c, 'Tu foto', { cx: 1045, cy: 408, w: 310, h: 324, mascara: 'rounded', radio: 0.06 }),
    trazo(c, 'Flecha', flecha([846, 214], [800, 380], destino), { stroke: '#0B1220', width: 10 }),
  ]);
  return documento(1280, 720, [versionA, versionB]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Publicación · Ficha de propiedad · Inmobiliaria (Torre Alameda)
// ─────────────────────────────────────────────────────────────────────────────

type T6 = { etiqueta: string; titular: string; precio: string; datos: string; accion: string; marca: string; aviso: string; notas: string };

const T6_GUIA: T6 = {
  etiqueta: 'Etapa · estado',
  titular: 'Lo que la hace única',
  precio: 'Desde tu precio',
  datos: 'Recámaras · baños · m²\nTu forma de pago\nTu fecha de entrega',
  accion: 'Escribe una palabra y te mandamos la lista hoy',
  marca: 'Tu marca · tu ciudad',
  aviso: 'Imágenes ilustrativas',
  notas: 'Texto de la publicación: cuántas quedan, qué tienen de especial, dónde están y la palabra que te tienen que escribir.',
};

const T6_EJEMPLO: T6 = {
  etiqueta: 'Etapa 2 · Preventa',
  titular: 'Depa con vista al parque',
  precio: 'Desde MXN 2.4 M',
  datos: '2 recámaras · 2 baños · 78 m²\nEnganche del 10 % diferido a 18 meses\nEntrega: diciembre de 2027',
  accion: 'Escribe PRECIOS y te mandamos la lista hoy',
  marca: 'Torre Alameda · Querétaro',
  aviso: 'Imágenes ilustrativas',
  notas: 'Texto de la publicación: De los 46 departamentos que quedan, 14 tienen vista al parque. A 8 minutos de Constituyentes, con alberca, gimnasio y roof garden. Escríbenos PRECIOS.',
};

function armar6(c: Ctx, t: T6): DocumentoDoory {
  const azul = '#0B2545';
  const oro = '#C9A227';
  const rombo = (cx: number, cy: number): Cmd[] => [['M', cx, cy - 9], ['L', cx + 9, cy], ['L', cx, cy + 9], ['L', cx - 9, cy], ['L', cx, cy - 9]];
  return documento(1080, 1350, [pagina(c, 'Ficha', solido(azul), [
    foto(c, 'Foto de la propiedad', { cx: 540, cy: 459, w: 1080, h: 918 }),
    rect(c, 'Etiqueta: fondo', { x: 64, y: 64, w: 400, h: 64, fill: oro, radio: 8 }),
    texto(c, 'Etiqueta', t.etiqueta, { x: 64, y: 81, w: 400, tam: 30, fam: F.archivo, color: azul, alin: 'center', mayus: true, inter: 1 }),
    rect(c, 'Banda', { x: 0, y: 918, w: 1080, h: 432, fill: azul }),
    texto(c, 'Titular', t.titular, { x: 72, y: 950, w: 936, tam: 56, fam: F.playfair, color: '#FFFFFF', inter: 1.05 }),
    texto(c, 'Precio', t.precio, { x: 72, y: 1012, w: 936, tam: 80, peso: 700, fam: F.playfair, color: '#FFFFFF', inter: 1.05 }),
    trazo(c, 'Datos: viñetas', [...rombo(82, 1129), ...rombo(82, 1173), ...rombo(82, 1217)], { fill: oro, bloqueado: true }),
    texto(c, 'Datos', t.datos, { x: 108, y: 1110, w: 900, tam: 30, fam: F.inter, color: '#E2E8F0', inter: 1.3 }),
    texto(c, 'Acción', t.accion, { x: 72, y: 1250, w: 936, tam: 32, peso: 700, fam: F.inter, color: oro, inter: 1.15 }),
    texto(c, 'Aviso', t.aviso, { x: 72, y: 1306, w: 420, tam: 18, fam: F.inter, color: '#94A3B8', inter: 1.1 }),
    texto(c, 'Marca', t.marca, { x: 528, y: 1302, w: 480, tam: 22, peso: 600, fam: F.inter, color: '#CBD5E1', alin: 'right', inter: 1.1 }),
  ], t.notas)]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Publicación · Creencia al revés · Formación (Voz de Líder)
// ─────────────────────────────────────────────────────────────────────────────

type T7 = { creencia: string; respuesta: string; resaltado: string; iniciales: string; firma: string; notas: string };

const T7_GUIA: T7 = {
  creencia: 'La creencia que escuchas siempre.',
  respuesta: 'Lo que de verdad hace falta,',
  resaltado: 'dicho en pocas palabras.',
  iniciales: 'Tú',
  firma: 'Tu nombre · tu marca',
  notas: 'Texto de la publicación: la frase que te dijo un cliente, por qué no era lo que creía, y una invitación a escribirte.',
};

const T7_EJEMPLO: T7 = {
  creencia: 'No necesitas perder los nervios.',
  respuesta: 'Necesitas ensayar los',
  resaltado: 'primeros 20 segundos.',
  iniciales: 'RI',
  firma: 'Rodrigo Ibarra · Voz de Líder',
  notas: 'Texto de la publicación: Un gerente me dijo: «sé qué decir hasta que me toca el directorio». No eran nervios. Te cuento qué ensayamos:',
};

function armar7(c: Ctx, t: T7): DocumentoDoory {
  const tinta = '#1F2937';
  return documento(1080, 1350, [pagina(c, 'Publicación', solido('#F5F0E8'), [
    texto(c, 'Creencia', t.creencia, { x: 120, y: 250, w: 840, tam: 88, fam: F.serif, color: '#9CA3AF', tachado: true, inter: 1.1 }),
    texto(c, 'Respuesta', t.respuesta, { x: 120, y: 620, w: 840, tam: 88, fam: F.serif, color: tinta, italica: true, inter: 1.1 }),
    texto(c, 'Resaltado', t.resaltado, { x: 120, y: 836, w: 840, tam: 88, fam: F.serif, color: tinta, italica: true, inter: 1.1, resaltado: '#FDE68A' }),
    circulo(c, 'Firma: círculo', { cx: 168, cy: 1158, r: 48, fill: tinta }),
    texto(c, 'Firma: iniciales', t.iniciales, { x: 120, y: 1138, w: 96, tam: 34, peso: 700, fam: F.inter, color: '#FFFFFF', alin: 'center', mayus: true, inter: 1.1 }),
    foto(c, 'Firma: tu foto', { cx: 168, cy: 1158, w: 96, h: 96, mascara: 'circle' }),
    texto(c, 'Firma', t.firma, { x: 240, y: 1138, w: 720, tam: 32, fam: F.inter, color: '#6B7280', inter: 1.2 }),
  ], t.notas)]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Historia · Últimos lugares · Formación (Voz de Líder)
// ─────────────────────────────────────────────────────────────────────────────
// Zonas seguras (image.md): nada importante en los 270 px de arriba, los 672 de abajo ni los 65 de cada costado. Todo vive
// entre y 270 e y 1248, así sirve también como anuncio.

type T8 = { arriba: string; numero: string; titular: string; leyenda: string; cierre: string; accion: string; notas: string };

const T8_GUIA: T8 = {
  arriba: 'Quedan',
  numero: '0',
  titular: 'lugares',
  leyenda: 'Tu grupo o cohorte',
  cierre: 'Cuándo cierras',
  accion: 'Escríbeme TU PALABRA',
  notas: 'Cierre real: el día y la hora en que cierras, con tu huso horario. La hora va en el sticker de cuenta regresiva de Instagram, que se pone a mano. Para quien te escriba: qué es, cuánto dura y cuánto cuesta. Usa esta plantilla solo si los lugares y la fecha son de verdad.',
};

const T8_EJEMPLO: T8 = {
  arriba: 'Quedan',
  numero: '4',
  titular: 'lugares',
  leyenda: 'Cohorte de mayo',
  cierre: 'Cierra el viernes',
  accion: 'Escríbeme JUNTA',
  notas: 'Cierre real: el viernes a las 11:59 p. m. (hora de Lima), la misma hora del email de cierre. La hora va en el sticker de cuenta regresiva de Instagram, que se pone a mano. Para quien escriba JUNTA: 90 días, martes en vivo, USD 2,000.',
};

function armar8(c: Ctx, t: T8): DocumentoDoory {
  const oro = '#FACC15';
  const asientos = Array.from({ length: 12 }, (_, i) => {
    const cx = 540 - 144 + (i % 4) * 96;
    const cy = 862 + Math.floor(i / 4) * 80;
    return i < 8
      ? circulo(c, `Asientos: ${i + 1}`, { cx, cy, r: 32, fill: oro })
      : circulo(c, `Asientos: ${i + 1}`, { cx, cy, r: 30, fill: null, borde: { color: oro, width: 4 } });
  });
  return documento(1080, 1920, [pagina(c, 'Historia', solido('#111111'), [
    texto(c, 'Titular: arriba', t.arriba, { x: 65, y: 290, w: 950, tam: 44, peso: 600, fam: F.inter, color: '#FFFFFF', alin: 'center', inter: 1.1 }),
    texto(c, 'Número', t.numero, { x: 65, y: 336, w: 950, tam: 320, fam: F.anton, color: oro, alin: 'center', inter: 1 }),
    texto(c, 'Titular', t.titular, { x: 65, y: 690, w: 950, tam: 96, fam: F.archivo, color: '#FFFFFF', alin: 'center', inter: 1 }),
    ...asientos,
    // La última fila de asientos termina en 1054 (862 + 2 × 80 + 32): la leyenda va debajo, con aire.
    texto(c, 'Leyenda', t.leyenda, { x: 65, y: 1084, w: 950, tam: 38, fam: F.inter, color: '#D4D4D4', alin: 'center', inter: 1.1 }),
    texto(c, 'Cierre', t.cierre, { x: 65, y: 1140, w: 950, tam: 48, fam: F.archivo, color: oro, alin: 'center', inter: 1 }),
    texto(c, 'Acción', t.accion, { x: 65, y: 1214, w: 950, tam: 44, fam: F.archivo, color: '#111111', alin: 'center', inter: 1, resaltado: oro }),
  ], t.notas)]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Historia · Invitación a clase · Infoproducto (Consulta Rentable)
// ─────────────────────────────────────────────────────────────────────────────
// Los horarios del ejemplo (image.md): CDMX en UTC−6 todo el año, Bogotá y Lima en UTC−5 y Santiago en UTC−3 en noviembre
// por el horario de verano. El 12/11/2026 es jueves. La franja de abajo queda libre para el sticker de enlace, sin ninguna
// guía dibujada (saldría en la descarga).

type T9 = { etiqueta: string; titular: string; fecha: string; horarios: string; accion: string; notas: string };

const T9_GUIA: T9 = {
  etiqueta: 'Tu tipo de clase',
  titular: 'El tema de tu clase, dicho como un resultado',
  fecha: 'Día y fecha',
  horarios: 'Tu hora · tu ciudad\nLa hora en otra ciudad\nLa hora en otra ciudad',
  accion: 'Toca el enlace ↓',
  notas: 'Pega el sticker de enlace justo debajo de «Toca el enlace»: la franja de abajo queda libre para eso. Los horarios de otras ciudades se calculan desde el tuyo.',
};

const T9_EJEMPLO: T9 = {
  etiqueta: 'Clase gratis en vivo',
  titular: 'Cómo llenar tu consulta online sin publicar todos los días',
  fecha: 'Jueves 12 de noviembre',
  horarios: '7:00 p. m. CDMX\n8:00 p. m. Bogotá y Lima\n10:00 p. m. Santiago',
  accion: 'Toca el enlace ↓',
  notas: 'Pega el sticker de enlace justo debajo de «Toca el enlace»: la franja de abajo queda libre para eso. La clase es la del jueves 12 de noviembre a las 7:00 p. m. de CDMX.',
};

function armar9(c: Ctx, t: T9): DocumentoDoory {
  return documento(1080, 1920, [pagina(c, 'Historia', solido('#0F172A'), [
    foto(c, 'Foto de fondo', { cx: 540, cy: 960, w: 1080, h: 1920 }),
    rect(c, 'Velo', { x: 0, y: 0, w: 1080, h: 1920, fill: '#0F172A', opacidad: 0.55, bloqueado: true }),
    rect(c, 'Etiqueta: fondo', { x: 90, y: 300, w: 580, h: 76, fill: '#22C55E', radio: 10 }),
    texto(c, 'Etiqueta', t.etiqueta, { x: 90, y: 316, w: 580, tam: 40, fam: F.archivo, color: '#0F172A', alin: 'center', mayus: true, inter: 1 }),
    texto(c, 'Titular', t.titular, { x: 90, y: 420, w: 900, tam: 80, fam: F.serif, color: '#FFFFFF', inter: 1.08 }),
    texto(c, 'Fecha', t.fecha, { x: 90, y: 836, w: 900, tam: 56, fam: F.archivo, color: '#FDE047', inter: 1.05 }),
    texto(c, 'Horarios', t.horarios, { x: 90, y: 922, w: 900, tam: 34, fam: F.inter, color: '#FFFFFF', inter: 1.35 }),
    texto(c, 'Acción', t.accion, { x: 90, y: 1140, w: 900, tam: 48, fam: F.archivo, color: '#FFFFFF', alin: 'center', inter: 1 }),
  ], t.notas)]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Anuncio · Carta del fundador · Agencia (Pulso Dental)
// ─────────────────────────────────────────────────────────────────────────────
// «Tu foto» es un LUGAR (la recepción vacía de una clínica): una cara de stock firmaría una historia de fracaso (image.md,
// trampa 6). El experto le pide la foto real del fundador.

type T10 = { carta: string; firma: string; negocio: string; notas: string };

const T10_GUIA: T10 = {
  carta: [
    'El momento en que algo salió mal, en una frase.',
    'Qué estaba fallando de verdad, con un detalle que se vea: dónde estabas y qué viste.',
    'Qué haces distinto desde ese día, en concreto.',
    'A quién le hablas, qué le ofreces sin compromiso y la promesa de decirle con honestidad si le puedes ayudar.',
  ].join('\n\n'),
  firma: 'Tu nombre',
  negocio: 'Tu negocio',
  notas: 'Texto principal (125 caracteres): a quién le habla y qué hacer antes de decidir. · Titular (40): tu oferta sin compromiso. · Descripción: para quién es. · Botón: Más información.',
};

const T10_EJEMPLO: T10 = {
  carta: [
    'En 2021 perdí 4 de mis 6 clínicas.',
    'Los anuncios funcionaban. Lo que fallaba pasaba después: una tarde, en la recepción de una clínica, vi entrar 14 mensajes y contestar 5.',
    'Desde ese día no vendemos solo anuncios. Respondemos cada mensaje en menos de 5 minutos, y el paciente llega a su valoración sabiendo el rango de precio.',
    'Si tu clínica recibe mensajes pero no pacientes de implantes, te hago una auditoría gratis de 30 minutos y te digo con honestidad si te puedo ayudar.',
  ].join('\n\n'),
  firma: 'Diego Ferrer',
  negocio: 'Pulso Dental',
  notas: 'Texto principal: «Para dueños de clínicas dentales que reciben mensajes pero no pacientes de implantes. Léela antes de cambiar de agencia.» · Titular: «Auditoría gratis de 30 minutos» · Descripción: «Para clínicas dentales» · Botón: Más información.',
};

function armar10(c: Ctx, t: T10): DocumentoDoory {
  const tinta = '#1F2937';
  // El papel: renglones apenas visibles, con formas (sin foto), bloqueados.
  const renglones: Cmd[] = Array.from({ length: 26 }, (_, i) => [['M', 0, 52 + i * 50], ['L', 1080, 52 + i * 50]] as Cmd[]).flat();
  const polaroid = rotar([
    rect(c, 'Polaroid', { x: 726, y: 70, w: 270, h: 300, fill: '#FFFFFF', radio: 4, sombra: { color: '#1F293733', blur: 20, offsetX: 0, offsetY: 8 } }),
    foto(c, 'Tu foto', { cx: 861, cy: 195, w: 240, h: 220 }),
  ], 3, 861, 220);
  return documento(1080, 1350, [pagina(c, 'Anuncio', solido('#FBF8F1'), [
    trazo(c, 'Papel', renglones, { stroke: '#EFE7D6', width: 1, bloqueado: true }),
    ...polaroid,
    texto(c, 'Carta', t.carta, { x: 110, y: 400, w: 860, tam: 34, fam: F.lora, color: tinta, inter: 1.45 }),
    texto(c, 'Firma', t.firma, { x: 110, y: 1170, w: 600, tam: 72, fam: F.caveat, color: tinta, inter: 1 }),
    texto(c, 'Firma: negocio', t.negocio, { x: 110, y: 1256, w: 600, tam: 28, fam: F.inter, color: '#6B7280', inter: 1.1 }),
  ], t.notas)]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Anuncio · Comparación · Inmobiliaria (Torre Alameda)
// ─────────────────────────────────────────────────────────────────────────────
// Las cifras son las del elenco (image.md): el crédito estimado de MXN 18,900 al mes. No se nombra a ningún competidor real.

type T11 = { titular: string; ellos: string; ellosItems: [string, string, string]; nuestra: string; nuestraItems: [string, string, string]; accion: string; letraChica: string; notas: string };

const T11_GUIA: T11 = {
  titular: 'La duda de tu cliente, y la cuenta que la responde.',
  ellos: 'La otra opción',
  ellosItems: ['Lo que pierde con ella', 'Lo que le cuesta', 'Su riesgo'],
  nuestra: 'Tu negocio',
  nuestraItems: ['Lo que gana contigo', 'Tu precio o tu pago', 'Tu facilidad de pago'],
  accion: 'Escribe UNA PALABRA y agenda',
  letraChica: '*De dónde sale tu número.',
  notas: 'Texto principal (125 caracteres): la cuenta que hace tu cliente, con tu número. · Titular (40): tu oferta con su precio. · Botón: Enviar mensaje.',
};

const T11_EJEMPLO: T11 = {
  titular: '¿Pagas unos 19 mil de renta? Haz esta cuenta.',
  ellos: 'Sigues rentando',
  ellosItems: ['Nada queda a tu nombre', 'Sube cada año', 'Te pueden pedir el depa'],
  nuestra: 'Torre Alameda',
  nuestraItems: ['Escritura a tu nombre', 'Crédito desde MXN 18,900 al mes*', 'Enganche diferido a 18 meses'],
  accion: 'Escribe VISITA y agenda tu recorrido',
  letraChica: '*Crédito estimado a 20 años. Depende del banco.',
  notas: 'Texto principal: «Si pagas renta en Querétaro, haz la cuenta: el enganche se paga en 18 meses y el crédito, desde 18,900 al mes.» · Titular: «Depa de 2 recámaras desde MXN 2.4 M» · Botón: Enviar mensaje.',
};

function armar11(c: Ctx, t: T11): DocumentoDoory {
  const columna = (lado: 'ellos' | 'nuestra', x: number) => {
    const nuestra = lado === 'nuestra';
    const base = nuestra ? 'Columna nuestra' : 'Columna de ellos';
    const items = nuestra ? t.nuestraItems : t.ellosItems;
    const marcas: Cmd[] = items.flatMap((_, i) => {
      const cx = x + 44;
      const cy = 452 + i * 150;
      return nuestra
        ? [['M', cx - 13, cy + 1], ['L', cx - 4, cy + 10], ['L', cx + 14, cy - 11]] as Cmd[]
        : [['M', cx - 11, cy - 11], ['L', cx + 11, cy + 11], ['M', cx + 11, cy - 11], ['L', cx - 11, cy + 11]] as Cmd[];
    });
    return [
      rect(c, `${base}: fondo`, { x, y: 290, w: 456, h: 680, fill: nuestra ? '#0F766E' : '#E5E7EB', radio: 24 }),
      texto(c, `${base}: título`, nuestra ? t.nuestra : t.ellos, { x: x + 32, y: 326, w: 392, tam: 40, fam: F.archivo, color: nuestra ? '#FFFFFF' : '#374151', inter: 1.05 }),
      trazo(c, `${base}: marcas`, marcas, { stroke: nuestra ? '#5EEAD4' : '#9CA3AF', width: 5 }),
      ...items.map((linea, i) => texto(c, `${base}: ${i + 1}`, linea, {
        x: x + 76, y: 430 + i * 150, w: 350, tam: 36, peso: nuestra ? 600 : 400, fam: F.inter, color: nuestra ? '#FFFFFF' : '#6B7280', inter: 1.2,
      })),
    ];
  };
  return documento(1080, 1350, [pagina(c, 'Anuncio', solido('#FFFFFF'), [
    texto(c, 'Titular', t.titular, { x: 72, y: 72, w: 936, tam: 64, fam: F.archivo, color: '#0F172A', inter: 1.1 }),
    ...columna('ellos', 72),
    ...columna('nuestra', 552),
    rect(c, 'Banda', { x: 0, y: 1020, w: 1080, h: 150, fill: '#F59E0B' }),
    texto(c, 'Acción', t.accion, { x: 72, y: 1072, w: 936, tam: 40, fam: F.archivo, color: '#111827', alin: 'center', inter: 1 }),
    texto(c, 'Letra chica', t.letraChica, { x: 72, y: 1226, w: 936, tam: 22, fam: F.inter, color: '#6B7280', inter: 1.2 }),
  ], t.notas)]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Presentación · Clase que vende · Infoproducto (Consulta Rentable)
// ─────────────────────────────────────────────────────────────────────────────
// La portada y la transición van en azul noche; el contenido, en claro. Una idea por diapositiva. «Tu foto» de «Quién soy» es
// un marco vacío: una cara de stock con las credenciales al lado se las atribuiría a una persona real (image.md, trampa 6).

type T12 = {
  portada: { titular: string; bajada: string };
  llevas: { titular: string; texto: string };
  quien: { titular: string; texto: string };
  clave1: { titular: string; texto: string; ejemplo: string };
  clave2: { titular: string; valores: [string, string, string]; rotulos: [string, string, string]; leyenda: string };
  clave3: { titular: string; texto: string };
  transicion: { titular: string };
  oferta: { titular: string; texto: string; precio: string; bono: string; lugares: string };
  cierre: { titular: string; texto: string };
  notas: string;
};

const T12_GUIA: T12 = {
  portada: { titular: 'El tema de tu clase, dicho como un resultado', bajada: 'Clase en vivo · tu nombre' },
  llevas: { titular: 'Lo que te llevas hoy', texto: '· La primera idea que enseñas\n· La segunda\n· La tercera' },
  quien: { titular: 'Quién soy', texto: 'Desde cuándo haces esto\nA cuántas personas ayudaste\nDónde y cómo atiendes' },
  clave1: { titular: 'Clave 1 · La primera idea', texto: 'La regla en una línea', ejemplo: 'Ejemplo: cómo se ve en tu negocio.' },
  clave2: { titular: 'Clave 2 · La segunda idea', valores: ['N', 'N', 'N'], rotulos: ['Paso 1', 'Paso 2', 'Paso 3'], leyenda: 'De dónde salen tus números' },
  clave3: { titular: 'Clave 3 · La tercera idea', texto: 'Qué hacer, en el orden en que se hace.' },
  transicion: { titular: 'La pregunta que lleva a tu oferta' },
  oferta: { titular: 'Tu programa · su duración', texto: 'Qué incluye, en una línea', precio: 'Tu precio y cómo se paga', bono: 'Tu bono', lugares: 'Tus lugares' },
  cierre: { titular: 'Cómo se reserva', texto: 'Y quédate: ahora respondo tus preguntas.' },
  notas: 'El guion de cada diapositiva va en sus notas. Una idea por diapositiva, con 25 palabras como máximo.',
};

const T12_EJEMPLO: T12 = {
  portada: { titular: 'Cómo llenar tu consulta online sin publicar todos los días', bajada: 'Clase en vivo · Dra. Mariana Ochoa' },
  llevas: {
    titular: 'Lo que te llevas hoy',
    texto: '· La oferta de entrada que se entiende en una línea\n· El paso del medio entre el mensaje y la consulta\n· Cómo decir tu precio sin bajar la voz',
  },
  quien: { titular: 'Quién soy', texto: 'Nutrióloga desde 2016\n140 alumnas desde 2023\nAtiendo en línea desde Guadalajara' },
  clave1: { titular: 'Clave 1 · La oferta de entrada', texto: 'Resultado + tiempo + sin qué sacrificio', ejemplo: 'Ejemplo: «Plan de 3 meses para dejar el picoteo nocturno».' },
  clave2: { titular: 'Clave 2 · El paso del medio', valores: ['60', '18', '11'], rotulos: ['mensajes', 'valoraciones', 'pacientes'], leyenda: 'Los números de una alumna' },
  clave3: { titular: 'Clave 3 · El mensaje del precio', texto: 'Primero el resultado que quiere, después el plan, al final el precio.' },
  transicion: { titular: '¿Quieres que te acompañe a armarlo en 90 días?' },
  oferta: {
    titular: 'Consulta Rentable · 90 días',
    texto: 'Sesión grupal semanal + revisión de tus mensajes',
    precio: 'USD 1,200 de contado o 2 pagos de USD 650',
    bono: 'Bono: una revisión 1 a 1',
    lugares: '20 lugares',
  },
  cierre: { titular: 'Reserva tu lugar en el enlace del chat', texto: 'Y quédate: ahora respondo tus preguntas.' },
  notas: 'El guion de cada diapositiva va en sus notas. Una idea por diapositiva, con 25 palabras como máximo.',
};

function armar12(c: Ctx, t: T12): DocumentoDoory {
  const noche = solido('#0F172A');
  const claro = solido('#F8FAFC');
  const verde = '#16A34A';
  const gris = '#334155';
  const acento = (y: number) => rect(c, 'Acento', { x: 160, y, w: 120, h: 8, fill: verde });
  const titular = (s: string, y: number, color = '#0F172A') => texto(c, 'Titular', s, { x: 160, y, w: 1600, tam: 96, fam: F.serif, color, inter: 1.08 });
  const cuerpo = (nombre: string, s: string, y: number, o: Partial<OpTexto> = {}) => texto(c, nombre, s, { x: 160, y, w: 1600, tam: 40, fam: F.inter, color: gris, inter: 1.5, ...o });

  // La gráfica del paso del medio: tres barras con formas, proporcionales a 60, 18 y 11.
  const alturas = [480, 144, 88];
  const grafica = alturas.flatMap((h, i) => {
    const x = 260 + i * 420;
    const base = 900;
    return [
      rect(c, `Gráfica: barra ${i + 1}`, { x, y: base - h, w: 220, h, fill: i === 2 ? verde : '#94A3B8', radio: 10 }),
      texto(c, `Gráfica: valor ${i + 1}`, t.clave2.valores[i], { x: x - 40, y: base - h - 76, w: 300, tam: 56, peso: 700, fam: F.inter, color: '#0F172A', alin: 'center', inter: 1 }),
      texto(c, `Gráfica: rótulo ${i + 1}`, t.clave2.rotulos[i], { x: x - 40, y: base + 20, w: 300, tam: 34, fam: F.inter, color: gris, alin: 'center', inter: 1.1 }),
    ];
  });

  return documento(1920, 1080, [
    pagina(c, 'Portada', noche, [
      acento(300),
      titular(t.portada.titular, 340, '#FFFFFF'),
      cuerpo('Bajada', t.portada.bajada, 780, { color: '#CBD5E1' }),
    ], t.notas),
    pagina(c, 'Lo que te llevas', claro, [acento(160), titular(t.llevas.titular, 196), cuerpo('Texto', t.llevas.texto, 420)]),
    pagina(c, 'Quién soy', claro, [
      acento(160), texto(c, 'Titular', t.quien.titular, { x: 160, y: 196, w: 860, tam: 96, fam: F.serif, color: '#0F172A', inter: 1.08 }),
      cuerpo('Texto', t.quien.texto, 420, { w: 860 }),
      rect(c, 'Marco de la foto', { x: 1180, y: 150, w: 560, h: 780, fill: '#FFFFFF', radio: 28, sombra: { color: '#0F172A22', blur: 24, offsetX: 0, offsetY: 8 } }),
      foto(c, 'Tu foto', { cx: 1460, cy: 540, w: 528, h: 748, mascara: 'rounded', radio: 0.04 }),
    ]),
    pagina(c, 'Clave 1', claro, [
      acento(160), titular(t.clave1.titular, 196), cuerpo('Texto', t.clave1.texto, 420, { tam: 48, peso: 600, color: '#0F172A' }),
      cuerpo('Ejemplo', t.clave1.ejemplo, 560, { color: verde, italica: true }),
    ]),
    pagina(c, 'Clave 2', claro, [acento(110), texto(c, 'Titular', t.clave2.titular, { x: 160, y: 140, w: 1600, tam: 80, fam: F.serif, color: '#0F172A', inter: 1.08 }), ...grafica,
      cuerpo('Leyenda', t.clave2.leyenda, 990, { tam: 30, color: '#64748B', inter: 1.2 })]),
    pagina(c, 'Clave 3', claro, [acento(160), titular(t.clave3.titular, 196), cuerpo('Texto', t.clave3.texto, 420, { tam: 48 })]),
    pagina(c, 'Transición', noche, [texto(c, 'Titular', t.transicion.titular, { x: 160, y: 380, w: 1600, tam: 96, fam: F.serif, color: '#FFFFFF', alin: 'center', inter: 1.1 })]),
    pagina(c, 'Oferta', claro, [
      acento(140), titular(t.oferta.titular, 176),
      cuerpo('Texto', t.oferta.texto, 360),
      cuerpo('Precio', t.oferta.precio, 470, { tam: 56, peso: 700, color: '#0F172A', inter: 1.2 }),
      cuerpo('Bono', t.oferta.bono, 610, { color: verde, peso: 600 }),
      cuerpo('Lugares', t.oferta.lugares, 700),
    ]),
    pagina(c, 'Cierre', claro, [acento(300), titular(t.cierre.titular, 340), cuerpo('Texto', t.cierre.texto, 600)]),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 13 y 14. Miniaturas VERTICALES (13/11/2026): la portada de un Reel o un Short, 1080 × 1920
// ─────────────────────────────────────────────────────────────────────────────
// Martín, 13/11/2026 (por el Cerebro): «miniaturas verticales en Image, para shorts y reels… con plantillas». Las dos de YouTube
// en vertical: con tu cara (la 13) y con un número (la 14). Zonas seguras, como las historias (la 8): la app tapa el 15 % de arriba
// (288 px) y el 25 % de abajo (480 px), y el perfil de Instagram recorta la portada a 3:4 (las 1440 del centro). Todo vive entre
// y 288 e y 1440.

type T13 = { rotulo: string; gancho: string; notas: string };

const NOTA_VERTICAL = 'Lo importante va en el centro: arriba y abajo lo tapa la app, y tu perfil de Instagram la recorta a 3:4.';

const T13_GUIA: T13 = {
  rotulo: 'Tu tema',
  gancho: 'Tu gancho en 3 palabras',
  notas: `El título del reel o del Short: escríbelo aquí. La portada no lo repite: le agrega curiosidad. · ${NOTA_VERTICAL}`,
};

const T13_EJEMPLO: T13 = {
  rotulo: 'Ventas por WhatsApp',
  gancho: 'Cerré 15 sin llamar',
  notas: `Reel: «Cómo cerré 15 clientes sin una sola llamada» · ${NOTA_VERTICAL}`,
};

function armar13(c: Ctx, t: T13): DocumentoDoory {
  const fondo: PageBackground = { type: 'gradient', kind: 'linear', angle: 180, stops: [{ offset: 0, color: '#1F2937' }, { offset: 1, color: '#0B1220' }] };
  return documento(1080, 1920, [pagina(c, 'Miniatura', fondo, [
    // Tu foto a todo el cuadro (la persona ES la portada); el texto va encima, con contorno, a la altura del pecho.
    foto(c, 'Tu foto', { cx: 540, cy: 960, w: 1080, h: 1920 }),
    texto(c, 'Rótulo', t.rotulo, { x: 90, y: 1000, w: 900, tam: 46, fam: F.archivo, color: '#111111', alin: 'center', mayus: true, inter: 1.1, resaltado: '#FACC15' }),
    texto(c, 'Gancho', t.gancho, { x: 60, y: 1080, w: 960, tam: 150, fam: F.anton, color: '#FFFFFF', alin: 'center', mayus: true, inter: 1, contorno: { color: '#000000', width: 8 } }),
  ], t.notas)]);
}

type T14 = { rotulo: string; numero: string; titular: string; linea: string; notas: string };

const T14_GUIA: T14 = {
  rotulo: 'Tu rubro',
  numero: '0',
  titular: 'Qué cuentas',
  linea: 'Lo que promete el video, en una línea',
  notas: `El título del reel o del Short: escríbelo aquí. El número sale de algo que mediste de verdad. · ${NOTA_VERTICAL}`,
};

const T14_EJEMPLO: T14 = {
  rotulo: 'Clínicas dentales',
  numero: '43',
  titular: 'de 50 anuncios no traen pacientes',
  linea: 'Revisé 50 anuncios de clínicas: esto es lo que falla',
  notas: `Reel: «Revisé 50 anuncios de clínicas dentales: por qué 43 no traen pacientes» · ${NOTA_VERTICAL}`,
};

function armar14(c: Ctx, t: T14): DocumentoDoory {
  const oro = '#FACC15';
  return documento(1080, 1920, [pagina(c, 'Miniatura', solido('#0B1220'), [
    texto(c, 'Rótulo', t.rotulo, { x: 90, y: 320, w: 900, tam: 40, peso: 600, fam: F.inter, color: '#94A3B8', alin: 'center', mayus: true, esp: 80, inter: 1.1 }),
    texto(c, 'Número', t.numero, { x: 60, y: 390, w: 960, tam: 420, fam: F.anton, color: oro, alin: 'center', inter: 1 }),
    texto(c, 'Titular', t.titular, { x: 60, y: 900, w: 960, tam: 96, fam: F.archivo, color: '#FFFFFF', alin: 'center', mayus: true, inter: 1 }),
    rect(c, 'Acento', { x: 470, y: 1180, w: 140, h: 10, fill: oro, radio: 5 }),
    texto(c, 'Línea', t.linea, { x: 90, y: 1220, w: 900, tam: 44, peso: 500, fam: F.inter, color: '#CBD5E1', alin: 'center', inter: 1.2 }),
  ], t.notas)]);
}

// ─────────────────────────────────────────────────────────────────────────────
// El catálogo
// ─────────────────────────────────────────────────────────────────────────────

function con<T>(armar: (c: Ctx, t: T) => DocumentoDoory, guia: T, ejemplo: T) {
  return {
    estructura: (nuevoId?: () => string) => armar(nuevoCtx(nuevoId), guia),
    ejemplo: (nuevoId?: () => string) => armar(nuevoCtx(nuevoId), ejemplo),
  };
}

export const PLANTILLAS_IMAGEN: readonly PlantillaImagen[] = [
  {
    id: 'miniatura-resultado', nombre: 'Miniatura · Resultado con cara · Coach', grupo: 'Miniaturas de YouTube',
    cuando: 'Tu video cuenta un resultado tuyo y vas a salir a cámara.',
    negocio: 'Cierre Consultivo', ancho: 1280, alto: 720, paginas: 2, insignia: '1280 × 720 · 2 versiones',
    pide: ['titulo_video', 'resultado', 'foto'],
    ...con(armar1, T1_GUIA, T1_EJEMPLO),
    extracto: 'SIN ANUNCIOS · 15/15 LUGARES', chips: ['Gancho', 'Dato', 'Notificaciones'],
  },
  {
    id: 'miniatura-numero', nombre: 'Miniatura · Número sin cara · Agencia', grupo: 'Miniaturas de YouTube',
    cuando: 'Tu video revela un número que sorprende, sin que tengas que salir.',
    negocio: 'Pulso Dental', ancho: 1280, alto: 720, paginas: 2, insignia: '1280 × 720 · 2 versiones',
    pide: ['titulo_video', 'resultado'],
    ...con(armar2, T2_GUIA, T2_EJEMPLO),
    extracto: T2_EJEMPLO.gancho.toLocaleUpperCase('es'), chips: ['Cuadrícula de anuncios', 'Gancho', 'Tu foto'],
  },
  {
    id: 'vertical-gancho-cara', nombre: 'Miniatura vertical · Gancho con tu cara · Coach', grupo: 'Miniaturas verticales',
    cuando: 'Tu reel o tu Short cuenta un resultado tuyo y sales a cámara.',
    negocio: 'Cierre Consultivo', ancho: 1080, alto: 1920, paginas: 1, insignia: '1080 × 1920 · Reels y Shorts',
    pide: ['titulo_video', 'foto'],
    ...con(armar13, T13_GUIA, T13_EJEMPLO),
    extracto: T13_EJEMPLO.gancho.toLocaleUpperCase('es'), chips: ['Tu foto', 'Gancho', 'Rótulo'],
  },
  {
    id: 'vertical-numero', nombre: 'Miniatura vertical · Número grande · Agencia', grupo: 'Miniaturas verticales',
    cuando: 'Tu reel o tu Short revela un número que sorprende, sin que tengas que salir.',
    negocio: 'Pulso Dental', ancho: 1080, alto: 1920, paginas: 1, insignia: '1080 × 1920 · Reels y Shorts',
    pide: ['titulo_video', 'resultado'],
    ...con(armar14, T14_GUIA, T14_EJEMPLO),
    extracto: `${T14_EJEMPLO.numero} ${T14_EJEMPLO.titular.toLocaleUpperCase('es')}`, chips: ['Número', 'Titular', 'Línea'],
  },
  {
    id: 'ficha-propiedad', nombre: 'Publicación · Ficha de propiedad · Inmobiliaria', grupo: 'Publicaciones',
    cuando: 'Quieres mostrar una propiedad y que te escriban para visitarla.',
    negocio: 'Torre Alameda', ancho: 1080, alto: 1350, paginas: 1, insignia: '1080 × 1350',
    pide: ['propiedad', 'foto', 'respuesta_mensaje'],
    ...con(armar6, T6_GUIA, T6_EJEMPLO),
    extracto: `${T6_EJEMPLO.titular} · ${T6_EJEMPLO.precio}`, chips: ['Foto de la propiedad', 'Precio', 'Datos'],
  },
  {
    id: 'creencia-al-reves', nombre: 'Publicación · Creencia al revés · Formación', grupo: 'Publicaciones',
    cuando: 'Escuchas siempre la misma creencia y quieres darle la vuelta para que te escriban.',
    negocio: 'Voz de Líder', ancho: 1080, alto: 1350, paginas: 1, insignia: '1080 × 1350',
    pide: ['creencia'],
    ...con(armar7, T7_GUIA, T7_EJEMPLO),
    extracto: T7_EJEMPLO.creencia, chips: ['Creencia', 'Respuesta', 'Resaltado'],
  },
  {
    id: 'ultimos-lugares', nombre: 'Historia · Últimos lugares · Formación', grupo: 'Historias',
    cuando: 'Cierras inscripciones y quedan lugares de verdad.',
    negocio: 'Voz de Líder', ancho: 1080, alto: 1920, paginas: 1, insignia: '1080 × 1920',
    pide: ['cupos', 'fecha', 'respuesta_mensaje'],
    ...con(armar8, T8_GUIA, T8_EJEMPLO),
    extracto: `${T8_EJEMPLO.arriba} ${T8_EJEMPLO.numero} ${T8_EJEMPLO.titular}`, chips: ['Número', 'Asientos', 'Acción'],
  },
  {
    id: 'invitacion-clase', nombre: 'Historia · Invitación a clase · Infoproducto', grupo: 'Historias',
    cuando: 'Das una clase en vivo y quieres que se registren desde tus historias.',
    negocio: 'Consulta Rentable', ancho: 1080, alto: 1920, paginas: 1, insignia: '1080 × 1920', topePalabras: 35,
    pide: ['fecha', 'oferta'],
    ...con(armar9, T9_GUIA, T9_EJEMPLO),
    extracto: T9_EJEMPLO.titular, chips: ['Foto de fondo', 'Fecha', 'Horarios'],
  },
  {
    id: 'carta-fundador', nombre: 'Anuncio · Carta del fundador · Agencia', grupo: 'Anuncios',
    cuando: 'Quieres llegar a gente que no te conoce contando por qué empezaste.',
    negocio: 'Pulso Dental', ancho: 1080, alto: 1350, paginas: 1, insignia: '1080 × 1350', topePalabras: 90,
    pide: ['historia', 'oferta', 'foto'],
    ...con(armar10, T10_GUIA, T10_EJEMPLO),
    extracto: T10_EJEMPLO.carta.split('\n')[0], chips: ['Carta', 'Firma', 'Tu foto'],
  },
  {
    id: 'comparacion', nombre: 'Anuncio · Comparación · Inmobiliaria', grupo: 'Anuncios',
    cuando: 'Tu cliente duda entre tú y otra opción, y quieres mostrar la diferencia.',
    negocio: 'Torre Alameda', ancho: 1080, alto: 1350, paginas: 1, insignia: '1080 × 1350', topePalabras: 55,
    pide: ['comparacion', 'oferta', 'respuesta_mensaje'],
    ...con(armar11, T11_GUIA, T11_EJEMPLO),
    extracto: T11_EJEMPLO.titular, chips: ['Columna de ellos', 'Columna nuestra', 'Banda'],
  },
  {
    id: 'clase-que-vende', nombre: 'Presentación · Clase que vende · Infoproducto', grupo: 'Presentaciones',
    cuando: 'Das una clase o un webinar que enseña y termina en tu oferta.',
    negocio: 'Consulta Rentable', ancho: 1920, alto: 1080, paginas: 9, insignia: '1920 × 1080 · 9 diapositivas',
    pide: ['oferta', 'fecha', 'foto', 'resultado'],
    ...con(armar12, T12_GUIA, T12_EJEMPLO),
    extracto: T12_EJEMPLO.portada.titular, chips: ['Portada', 'Clave 2', 'Oferta'],
  },
];

export function plantillaImagen(id: unknown): PlantillaImagen | null {
  if (typeof id !== 'string') return null;
  return PLANTILLAS_IMAGEN.find((p) => p.id === id) ?? null;
}
