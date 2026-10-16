// =============================================================================
// image-editor/chat/vista — el diseño como lo lee la IA del chat «MaKo IA» (y la API de MaKo)
// =============================================================================
// Pedido de Martín (16/10/2026, por el Cerebro): «implementes este chat en todas las tabs… quiero que la app sea AI
// NATIVE». El chat del Image Editor copia al del Video Editor (app/video-editor/_opencut/chat/): la IA lee una VISTA
// del diseño con refs cortas y devuelve operaciones de un catálogo cerrado (./catalogo.ts), que la persona acepta.
//
// Lo que gobierna, y no se ve en las firmas:
//   · PURO Y SIN EL MOTOR: trabaja sobre el JSON del documento (la salida de Fabric con las props de Doory), como
//     lib/image-editor/reglas.ts. Lo usan el panel en el navegador y la API en el server, y el server NO puede importar
//     `_doory` (test 4 de tests/image-editor-integracion.test.ts).
//   · LAS REFS SALEN DEL ID DE CADA OBJETO (un hash corto, `refsDeIds`): no se corren cuando se agrega o se borra otro,
//     así «t3k» de una propuesta de hace un rato sigue siendo el mismo texto. Una colisión alarga la ref.
//   · LAS MEDIDAS VAN COMO LAS VE LA PERSONA: la esquina de arriba a la izquierda y el tamaño en px de la página, con la
//     escala ya aplicada (Fabric guarda el origen donde quiere: un texto arriba a la izquierda, una forma al centro).
//   · UN GRUPO ES UN ELEMENTO: lo de adentro no se toca por separado (sus medidas son relativas al grupo).
// =============================================================================

type Obj = Record<string, unknown>;

/** Lo que la vista dice de cada elemento, para revisar y aplicar. */
export type TipoElemento = 'texto' | 'forma' | 'imagen' | 'linea' | 'grupo' | 'otro';
export type RefElemento = { ref: string; id: string; pageId: string; tipo: TipoElemento; titulo: string; bloqueado: boolean };

export type VistaDiseno = {
  /** Lo que se le manda a la IA. */
  json: string;
  /** ref → elemento. */
  elementos: Map<string, RefElemento>;
  /** ref de página («pa3») → id de la página. */
  paginas: Map<string, string>;
  /** La página abierta en el editor (su ref). */
  paginaActual: string | null;
};

export const TOPES_VISTA = { json: 60_000, texto: 300, nombre: 60 } as const;

const PREFIJO: Record<TipoElemento, string> = { texto: 't', forma: 'f', imagen: 'i', linea: 'l', grupo: 'g', otro: 'o' };

/** FNV-1a de 32 bits en base 36: corto, estable y sin dependencias. */
function hash36(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

/**
 * Las refs de un conjunto de ids: el prefijo y los primeros 2 caracteres del hash del id; si dos chocan, la que viene
 * después (en orden de id) alarga la suya. Determinista: el mismo diseño da las mismas refs.
 */
export function refsDeIds(items: ReadonlyArray<{ id: string; prefijo: string }>): Map<string, string> {
  const usadas = new Set<string>();
  const porId = new Map<string, string>();
  for (const { id, prefijo } of [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const h = hash36(id);
    let largo = 2;
    let ref = `${prefijo}${h.slice(0, largo)}`;
    while (usadas.has(ref) && largo < h.length) ref = `${prefijo}${h.slice(0, ++largo)}`;
    if (usadas.has(ref)) ref = `${prefijo}${h}${usadas.size}`;
    usadas.add(ref);
    porId.set(id, ref);
  }
  return porId;
}

/** El tipo de un objeto de Fabric, como lo nombra el chat. */
export function tipoDe(o: Obj): TipoElemento {
  const t = String(o.type ?? '').toLowerCase();
  if (/text/.test(t)) return 'texto';
  if (t === 'image') return 'imagen';
  if (t === 'group' || t === 'activeselection') return 'grupo';
  if (t === 'line' || t === 'doryline') return 'linea';
  if (['rect', 'ellipse', 'circle', 'triangle', 'polygon', 'polyline', 'path'].includes(t)) return 'forma';
  return 'otro';
}

const num = (v: unknown, def = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Cuánto se corre el origen de Fabric desde la esquina de arriba a la izquierda (0, la mitad o todo el tamaño). */
export const factorOrigen = (o: unknown): number => (o === 'center' ? 0.5 : o === 'right' || o === 'bottom' ? 1 : 0);

/** La caja del objeto en la página (sin la rotación): la esquina de arriba a la izquierda y el tamaño con la escala. */
export function cajaDe(o: Obj): { x: number; y: number; ancho: number; alto: number } {
  const ancho = num(o.width) * Math.abs(num(o.scaleX, 1));
  const alto = num(o.height) * Math.abs(num(o.scaleY, 1));
  return { x: num(o.left) - ancho * factorOrigen(o.originX), y: num(o.top) - alto * factorOrigen(o.originY), ancho, alto };
}

/** «"Archivo", sans-serif» → «Archivo». */
export const familiaDe = (stack: unknown): string => String(stack ?? '').split(',')[0].trim().replace(/^["']|["']$/g, '');

const ALINEACION: Record<string, string> = { left: 'izquierda', center: 'centro', right: 'derecha', justify: 'justificado' };
const MAYUSCULAS: Record<string, string> = { upper: 'mayusculas', lower: 'minusculas', title: 'titulo', sentence: 'oracion' };

/** Un color de Fabric como lo lee la IA: el hex o el rgb tal cual; un degradado o un patrón, «degradado». */
function colorVista(v: unknown): string | undefined {
  if (typeof v === 'string' && v) return v;
  if (v && typeof v === 'object') return 'degradado';
  return undefined;
}

/** Un elemento para la IA: sólo lo que no es lo de siempre. */
function elementoJson(o: Obj, ref: string, tipo: TipoElemento): Obj {
  const c = cajaDe(o);
  const e: Obj = { ref, tipo };
  if (typeof o.name === 'string' && o.name) e.nombre = o.name.slice(0, TOPES_VISTA.nombre);
  Object.assign(e, { x: r1(c.x), y: r1(c.y), ancho: r1(c.ancho), alto: r1(c.alto) });
  if (num(o.angle)) e.rotacion = r1(num(o.angle));
  const opacidad = Math.round(num(o.opacity, 1) * 100);
  if (opacidad !== 100) e.opacidad = opacidad;
  if (o.locked === true) e.bloqueado = true;
  if (o.visible === false) e.oculto = true;
  if (tipo === 'texto') {
    const texto = String(o.text ?? '');
    e.texto = texto.slice(0, TOPES_VISTA.texto);
    e.fuente = familiaDe(o.fontFamily);
    e.tamano = Math.round(num(o.fontSize, 0) * Math.abs(num(o.scaleY, 1)));
    const color = colorVista(o.fill);
    if (color) e.color = color;
    if (num(o.fontWeight as number, 400) >= 600 || o.fontWeight === 'bold') e.negrita = true;
    if (o.fontStyle === 'italic') e.cursiva = true;
    if (o.underline === true) e.subrayado = true;
    if (typeof o.textAlign === 'string' && o.textAlign !== 'left') e.alineacion = ALINEACION[o.textAlign] ?? o.textAlign;
    if (typeof o.textCase === 'string' && MAYUSCULAS[o.textCase]) e.mayusculas = MAYUSCULAS[o.textCase];
  } else if (tipo === 'forma') {
    e.forma = String(o.shapeKind ?? o.type);
    const color = colorVista(o.fill);
    if (color) e.color = color;
    if (typeof o.stroke === 'string' && o.stroke && num(o.strokeWidth) > 0) e.borde = { color: o.stroke, grosor: r1(num(o.strokeWidth)) };
  } else if (tipo === 'linea') {
    if (typeof o.stroke === 'string') e.color = o.stroke;
    e.grosor = r1(num(o.strokeWidth, 1));
  } else if (tipo === 'grupo') {
    e.contiene = Array.isArray(o.objects) ? o.objects.length : 0;
  }
  return e;
}

/** El fondo de una página, en una palabra o un color. */
function fondoDe(bg: unknown): string {
  const b = (bg ?? {}) as { type?: unknown; color?: unknown };
  if (b.type === 'solid' && typeof b.color === 'string') return b.color;
  if (b.type === 'gradient') return 'degradado';
  if (b.type === 'image') return 'imagen';
  return '#ffffff';
}

/**
 * La vista del diseño para la IA. `activePageId` es la página abierta; `elegidos`, los ids de lo seleccionado en el
 * editor (el alcance «lo elegido»). `fuentes`: unas pocas sugeridas (el catálogo entero no entra).
 */
export function vistaDeDiseno(doc: unknown, op: { activePageId?: string | null; elegidos?: readonly string[]; fuentes?: readonly string[] } = {}): VistaDiseno {
  const d = (doc ?? {}) as { width?: unknown; height?: unknown; pages?: unknown };
  const pages = (Array.isArray(d.pages) ? d.pages : []) as Obj[];
  const items: Array<{ id: string; prefijo: string }> = [];
  for (const p of pages) {
    if (typeof p.id === 'string') items.push({ id: p.id, prefijo: 'p' });
    for (const o of (Array.isArray(p.objects) ? p.objects : []) as Obj[]) {
      if (typeof o.id === 'string') items.push({ id: o.id, prefijo: PREFIJO[tipoDe(o)] });
    }
  }
  const refs = refsDeIds(items);
  const elementos = new Map<string, RefElemento>();
  const paginas = new Map<string, string>();
  const ancho = num(d.width);
  const alto = num(d.height);
  const paginasJson = pages.map((p) => {
    const pageId = String(p.id ?? '');
    const pref = refs.get(pageId) ?? '';
    paginas.set(pref, pageId);
    const objetos = (Array.isArray(p.objects) ? p.objects : []) as Obj[];
    const lista = objetos.flatMap((o) => {
      if (typeof o.id !== 'string') return [];
      const tipo = tipoDe(o);
      const ref = refs.get(o.id)!;
      const titulo = tipo === 'texto' ? `«${String(o.text ?? '').replace(/\s+/g, ' ').slice(0, 40)}»` : String(o.name ?? tipo);
      elementos.set(ref, { ref, id: o.id, pageId, tipo, titulo, bloqueado: o.locked === true });
      return [elementoJson(o, ref, tipo)];
    });
    const pj: Obj = { ref: pref };
    if (typeof p.name === 'string' && p.name) pj.nombre = p.name.slice(0, TOPES_VISTA.nombre);
    if (typeof p.width === 'number' && typeof p.height === 'number' && (p.width !== ancho || p.height !== alto)) pj.tamano = { ancho: p.width, alto: p.height };
    pj.fondo = fondoDe(p.background);
    pj.elementos = lista;
    return pj;
  });
  const refDeId = (id: string) => refs.get(id);
  const actual = op.activePageId ? refDeId(op.activePageId) ?? null : (paginasJson[0]?.ref as string | undefined) ?? null;
  const elegidos = (op.elegidos ?? []).map(refDeId).filter((r): r is string => !!r);
  const json = JSON.stringify({
    tamano: { ancho, alto },
    pagina_actual: actual,
    ...(elegidos.length ? { elegidos } : {}),
    paginas: paginasJson,
    ...(op.fuentes?.length ? { fuentes_sugeridas: op.fuentes.slice(0, 30) } : {}),
  });
  return { json, elementos, paginas, paginaActual: actual };
}
