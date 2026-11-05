// =============================================================================
// marca/kits — la marca del negocio: colores, fuentes y logo, en uno o varios kits (PURO; 5/11/2026)
// =============================================================================
// El pedido: en la llamada del 30/10/2026 Leila mostró que sus carruseles sólo tomaban el fondo de su marca, y pidió que
// MaKo le pida su manual de marca y lo guarde en el Second Brain, con varios kits («una agencia tiene muchos»). Lo usan los
// chats de Image, Video y Web Generator, y los carruseles de MaKo.
//
// Lo que gobierna, y no se ve en las firmas:
//   · UN negocio, VARIOS kits, UNO por defecto. Lo que no nombra un kit usa el de por defecto; sin kits, nada (MaKo no
//     inventa una marca). Viven en `app_settings` (`marca.kits`, ./kits-server.ts): el JSON entero, con compare-and-set.
//   · TODO SE SANEA AL LEER Y AL ESCRIBIR (`sanearKits`): lo guarda la pantalla, la API de MaKo y lo que extrajo la IA, y
//     ninguno de los tres es confiable. Un color es #RRGGBB o no es; una fuente, un nombre corto sin comillas.
//   · LO QUE EXTRAE LA IA ES UN BORRADOR (`borradorDeLectura`): la persona lo confirma en la pantalla antes de guardarlo
//     (AGENTS.md: «lo que se interpreta de un texto libre y se GUARDA pasa por un toque de la persona»).
//   · EL BLOQUE DEL PROMPT ES CORTO (`bloqueDeMarca`): cada token lo paga el cliente con su IA. Una línea por cosa.
//
// Sin `server-only` y sin React: lo importan la pantalla, la ruta, la API de MaKo, los prompts y los tests.
// =============================================================================

/** Para qué se usa un color de la marca. `null` = la marca lo trae y no dice para qué. */
export type RolColor = 'principal' | 'secundario' | 'acento' | 'fondo' | 'texto';
export const ROLES_COLOR: readonly RolColor[] = ['principal', 'secundario', 'acento', 'fondo', 'texto'];
export const ROTULO_ROL: Readonly<Record<RolColor, string>> = {
  principal: 'Principal', secundario: 'Secundario', acento: 'Acento', fondo: 'Fondo', texto: 'Texto',
};

export type ColorMarca = { hex: string; rol: RolColor | null };
export type FuentesMarca = { titulos: string | null; texto: string | null };
/** El logo es un archivo de «Subidos» del Image Editor (lib/image-editor/server.ts): su id, su dirección y su tamaño. */
export type LogoMarca = { subidoId: string; url: string; nombre: string; ancho: number; alto: number };

export type KitMarca = {
  id: string;
  nombre: string;
  colores: ColorMarca[];
  fuentes: FuentesMarca;
  logo: LogoMarca | null;
  /** De qué archivo salió (el manual que se subió), si salió de uno. */
  origen: string | null;
  actualizado: string;
};

export type KitsMarca = { kits: KitMarca[]; porDefecto: string | null };

export const TOPES_MARCA = {
  kits: 30,
  colores: 8,
  nombre: 60,
  fuente: 60,
  origen: 120,
  /** Lo que se le manda a la IA para leer un manual (el texto de un PDF largo). */
  lectura: 12_000,
} as const;

export const KITS_VACIOS: KitsMarca = { kits: [], porDefecto: null };

/** Dónde viven: `app_settings` del negocio (./kits-server.ts). */
export const KEY_KITS = 'marca.kits';

const texto = (x: unknown, tope: number): string =>
  typeof x === 'string' ? Array.from(x.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, tope).join('') : '';

/** «#abc», «ABCDEF», «#aabbcc» → «#AABBCC». null si no es un color de 3 o 6 cifras. */
export function normalizarHex(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(x.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return `#${h.toUpperCase()}`;
}

const esRol = (x: unknown): x is RolColor => typeof x === 'string' && (ROLES_COLOR as readonly string[]).includes(x);

/** Un nombre de fuente: sin comillas ni la familia de respaldo («"Montserrat", sans-serif» → «Montserrat»). */
export function sanearFuente(x: unknown): string | null {
  const t = texto(x, 200).split(',')[0].replace(/["'`]/g, '').trim();
  if (!t || /^(sans-serif|serif|monospace|system-ui|cursive)$/i.test(t)) return null;
  return Array.from(t).slice(0, TOPES_MARCA.fuente).join('') || null;
}

function sanearColores(raw: unknown): ColorMarca[] {
  const out: ColorMarca[] = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    const o = (typeof c === 'string' ? { hex: c } : c ?? {}) as { hex?: unknown; rol?: unknown };
    const hex = normalizarHex(o.hex);
    if (!hex || out.some((x) => x.hex === hex)) continue;
    // Un rol lo tiene UN color: el segundo «principal» queda sin rol (no se pierde el color).
    const rol = esRol(o.rol) && !out.some((x) => x.rol === o.rol) ? o.rol : null;
    out.push({ hex, rol });
    if (out.length >= TOPES_MARCA.colores) break;
  }
  return out;
}

function sanearLogo(raw: unknown): LogoMarca | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const subidoId = texto(o.subidoId, 80);
  const url = texto(o.url, 1000);
  if (!subidoId || !/^https:\/\//i.test(url)) return null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
  return { subidoId, url, nombre: texto(o.nombre, 120) || 'Logo', ancho: n(o.ancho), alto: n(o.alto) };
}

/** Un kit saneado, o null si no tiene id. Sin nombre, «Mi marca». */
export function sanearKit(raw: unknown, ahora = new Date().toISOString()): KitMarca | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const id = texto(o.id, 40).replace(/[^a-z0-9_-]/gi, '');
  if (!id) return null;
  const f = (o.fuentes ?? {}) as Record<string, unknown>;
  return {
    id,
    nombre: texto(o.nombre, TOPES_MARCA.nombre) || 'Mi marca',
    colores: sanearColores(o.colores),
    fuentes: { titulos: sanearFuente(f.titulos), texto: sanearFuente(f.texto) },
    logo: sanearLogo(o.logo),
    origen: texto(o.origen, TOPES_MARCA.origen) || null,
    actualizado: typeof o.actualizado === 'string' && !Number.isNaN(Date.parse(o.actualizado)) ? o.actualizado : ahora,
  };
}

/** ¿El kit trae algo para usar? Uno sin colores, sin fuentes y sin logo no es una marca. */
export const kitTieneAlgo = (k: KitMarca): boolean => k.colores.length > 0 || !!k.fuentes.titulos || !!k.fuentes.texto || !!k.logo;

/** Los kits del negocio, saneados. Lo que no se puede leer es la lista vacía; el de por defecto siempre es uno que existe. */
export function sanearKits(raw: unknown): KitsMarca {
  let v: unknown = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
  const o = (v ?? {}) as { kits?: unknown; porDefecto?: unknown };
  const kits: KitMarca[] = [];
  for (const k of Array.isArray(o.kits) ? o.kits : []) {
    const s = sanearKit(k);
    if (s && !kits.some((x) => x.id === s.id)) kits.push(s);
    if (kits.length >= TOPES_MARCA.kits) break;
  }
  const porDefecto = typeof o.porDefecto === 'string' && kits.some((k) => k.id === o.porDefecto) ? o.porDefecto : kits[0]?.id ?? null;
  return { kits, porDefecto };
}

export const kitPorDefecto = (k: KitsMarca): KitMarca | null => k.kits.find((x) => x.id === k.porDefecto) ?? k.kits[0] ?? null;

/** El kit pedido por id, o el de por defecto si no se pidió ninguno. Uno pedido que no existe es null: no se cambia por otro. */
export function kitElegido(k: KitsMarca, id?: string | null): KitMarca | null {
  if (id) return k.kits.find((x) => x.id === id) ?? null;
  return kitPorDefecto(k);
}

export type CambioKits = { ok: true; kits: KitsMarca } | { ok: false; error: string };

/**
 * Suma o reemplaza (por id) un kit. El primero queda por defecto; `porDefecto: true` lo pone por defecto. No pasa el tope:
 * un kit número 31 se rechaza, no pisa a otro.
 */
export function conKit(k: KitsMarca, kit: KitMarca, op: { porDefecto?: boolean } = {}): CambioKits {
  const s = sanearKit(kit, kit.actualizado);
  if (!s) return { ok: false, error: 'Al kit le falta su id.' };
  if (!kitTieneAlgo(s)) return { ok: false, error: 'El kit no tiene colores, fuentes ni logo.' };
  const ya = k.kits.findIndex((x) => x.id === s.id);
  if (ya < 0 && k.kits.length >= TOPES_MARCA.kits) return { ok: false, error: `Ya tienes ${TOPES_MARCA.kits} kits: borra uno para sumar otro.` };
  const kits = ya < 0 ? [...k.kits, s] : k.kits.map((x, i) => (i === ya ? s : x));
  return { ok: true, kits: { kits, porDefecto: op.porDefecto || !k.porDefecto ? s.id : k.porDefecto } };
}

/** Saca un kit. Si era el de por defecto, pasa a serlo el primero que queda. */
export function sinKit(k: KitsMarca, id: string): CambioKits {
  if (!k.kits.some((x) => x.id === id)) return { ok: false, error: 'Ese kit no existe.' };
  const kits = k.kits.filter((x) => x.id !== id);
  return { ok: true, kits: { kits, porDefecto: k.porDefecto === id ? kits[0]?.id ?? null : k.porDefecto } };
}

export function conPorDefecto(k: KitsMarca, id: string): CambioKits {
  if (!k.kits.some((x) => x.id === id)) return { ok: false, error: 'Ese kit no existe.' };
  return { ok: true, kits: { ...k, porDefecto: id } };
}

/** Un color de un rol, o null. */
export const colorDeRol = (kit: KitMarca, rol: RolColor): string | null => kit.colores.find((c) => c.rol === rol)?.hex ?? null;

// ── El bloque del prompt ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * La marca para la IA de un editor, en pocas líneas (cada token lo paga el cliente). Vacío si no hay kit o no trae nada.
 *   · `fuenteDelEditor`: el nombre como lo tiene ESE editor, o null si no lo tiene (el Image Editor descarta en silencio
 *     una fuente que no conoce: mejor no sugerirla). Sin ella, las fuentes van como están.
 *   · `logo`: cómo se pone el logo en ESE editor (en Image, «la foto con "logo": true»). Sin ella, el logo no se nombra.
 */
export function bloqueDeMarca(kit: KitMarca | null, op: { fuenteDelEditor?: (f: string) => string | null; logo?: string } = {}): string {
  if (!kit || !kitTieneAlgo(kit)) return '';
  const fuente = (f: string | null) => (f ? (op.fuenteDelEditor ? op.fuenteDelEditor(f) : f) : null);
  const lineas: string[] = [];
  if (kit.colores.length) lineas.push(`- Colores: ${kit.colores.map((c) => (c.rol ? `${c.hex} (${ROTULO_ROL[c.rol].toLowerCase()})` : c.hex)).join(', ')}.`);
  const titulos = fuente(kit.fuentes.titulos);
  const cuerpo = fuente(kit.fuentes.texto);
  if (titulos || cuerpo) lineas.push(`- Fuentes: ${[titulos && `${titulos} (títulos)`, cuerpo && `${cuerpo} (texto)`].filter(Boolean).join(', ')}.`);
  if (kit.logo && op.logo) lineas.push(`- Logo: ${op.logo}.`);
  if (!lineas.length) return '';
  return [
    `LA MARCA DEL NEGOCIO («${kit.nombre}»): úsala en lo que armes o cambies, salvo que la persona pida otra cosa.`,
    ...lineas,
  ].join('\n');
}

// ── Lo que lee la IA de un manual de marca ──────────────────────────────────────────────────────────────────────────

/** Lo que se le pide a la IA al leer un manual (el texto de un PDF o la foto de un brand board). Va en el system. */
export const PROMPT_LEER_MARCA = `Lees el manual de marca de un negocio (un PDF o una imagen de su brand board) y sacas su marca. Sólo lo que está escrito o se ve: no inventes.

Devuelve EXCLUSIVAMENTE un objeto JSON, sin markdown, con esta forma:
{"nombre": "cómo se llama la marca o el kit, si lo dice", "colores": [{"hex": "#RRGGBB", "rol": "principal|secundario|acento|fondo|texto"}], "fuentes": {"titulos": "nombre de la fuente de los títulos", "texto": "nombre de la fuente del texto"}, "logo": {"hay": true, "caja": {"x": 0, "y": 0, "ancho": 100, "alto": 100}}}

- "colores": de 1 a 8, los de la paleta de la marca. Si el manual escribe el código (#, HEX, RGB), usa ése. Si sólo se ven, el hex más cercano. "rol" sólo si el manual lo dice o es evidente; si no, null.
- "fuentes": el nombre de la familia tal como lo escribe el manual (Montserrat, Playfair Display), sin el peso. null si no lo dice.
- "logo": "hay" es true si el logo se ve. En una IMAGEN, "caja" es dónde está el logo, en porcentaje del ancho y del alto de la imagen (0 a 100). En un PDF, sin "caja".
- Lo que no está, va null o vacío.`;

/** Los colores que vienen escritos en el texto (#AABBCC, «HEX AABBCC»): la red si la IA no contesta. */
export function hexesDelTexto(t: string): string[] {
  const out: string[] = [];
  const re = /(?:#|\bhex\s*:?\s*)([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z])/gi;
  for (const m of String(t ?? '').matchAll(re)) {
    const h = normalizarHex(m[1]);
    if (h && !out.includes(h)) out.push(h);
    if (out.length >= TOPES_MARCA.colores) break;
  }
  return out;
}

export type CajaLogo = { x: number; y: number; ancho: number; alto: number };
/** El borrador que se le muestra a la persona para confirmar. */
export type BorradorMarca = { nombre: string | null; colores: ColorMarca[]; fuentes: FuentesMarca; logo: { hay: boolean; caja: CajaLogo | null } };

function cajaDe(raw: unknown): CajaLogo | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN);
  const [x, y, ancho, alto] = [n(o.x), n(o.y), n(o.ancho), n(o.alto)];
  if ([x, y, ancho, alto].some(Number.isNaN)) return null;
  if (x < 0 || y < 0 || ancho < 2 || alto < 2 || x + ancho > 100.5 || y + alto > 100.5) return null;
  return { x, y, ancho: Math.min(ancho, 100 - x), alto: Math.min(alto, 100 - y) };
}

/**
 * El borrador a partir de lo que contestó la IA (ya parseado) y del texto leído (`leido`). Los colores escritos en el texto
 * que la IA no devolvió se suman al final: un código impreso en el manual es un dato, no una interpretación.
 */
export function borradorDeLectura(raw: unknown, leido = ''): BorradorMarca {
  const o = (raw ?? {}) as Record<string, unknown>;
  const f = (o.fuentes ?? {}) as Record<string, unknown>;
  const colores = sanearColores(o.colores);
  for (const h of hexesDelTexto(leido)) {
    if (colores.length >= TOPES_MARCA.colores) break;
    if (!colores.some((c) => c.hex === h)) colores.push({ hex: h, rol: null });
  }
  const l = (o.logo ?? {}) as Record<string, unknown>;
  const caja = cajaDe(l.caja);
  return {
    nombre: texto(o.nombre, TOPES_MARCA.nombre) || null,
    colores,
    fuentes: { titulos: sanearFuente(f.titulos), texto: sanearFuente(f.texto) },
    logo: { hay: l.hay === true || !!caja, caja },
  };
}

/** ¿El borrador trae algo para confirmar? */
export const borradorTieneAlgo = (b: BorradorMarca): boolean => b.colores.length > 0 || !!b.fuentes.titulos || !!b.fuentes.texto || b.logo.hay;

/** La marca en una línea, para una lista o un resumen («3 colores · Montserrat · con logo»). */
export function resumenDeKit(kit: KitMarca): string {
  const partes = [
    kit.colores.length ? `${kit.colores.length} ${kit.colores.length === 1 ? 'color' : 'colores'}` : '',
    [kit.fuentes.titulos, kit.fuentes.texto].filter((x, i, a) => x && a.indexOf(x) === i).join(' y '),
    kit.logo ? 'con logo' : '',
  ].filter(Boolean);
  return partes.join(' · ');
}
