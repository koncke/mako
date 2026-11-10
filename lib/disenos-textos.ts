// =============================================================================
// disenos-textos — los TEXTOS que cada uno le cambia a una tarjeta de un diseño copiado (9/11/2026)
// =============================================================================
// Martín (9/11/2026): «los dashboard hoy no son editables... que esté 100 % finalizado». Medido en producción: un bloque
// de diseño (lib/disenos-partes.ts) se movía, se agrandaba y se borraba, pero su título y sus textos («Tasa de cierre»,
// «A quién llamaste») venían escritos en el componente del diseño y no había dónde cambiarlos.
//
// Cómo: el bloque guarda un mapa `Elemento.diseno.textos` = { texto original → texto nuevo }. Al dibujarse, cada texto de la
// tarjeta que es EXACTAMENTE un original (sin los espacios de los costados) se muestra con el nuevo
// (app/dashboard/disenos/textos-de-bloque.ts). Editando, dos toques sobre un texto lo abren en el lugar.
//   · Se guarda por el TEXTO, no por la posición: el diseño cambia de orden o suma una fila y el cambio sigue en su texto.
//   · Un número o un dato del negocio (un lead, una cifra) cambia solo: si el original ya no está, el cambio no se aplica
//     y no rompe nada. Por eso sólo se ofrecen textos con letras (`esTextoEditable`).
//   · Vaciar el campo, o dejar el original, quita el cambio (vuelve el del diseño).
//
// Sin `server-only` y sin React: el catálogo (el saneo), la pantalla y el test (tests/dashboard-textos-de-bloque.test.ts).

/** Cuántos textos cambiados guarda un bloque, y los topes de cada lado. */
export const MAX_TEXTOS_BLOQUE = 40;
export const TOPE_TEXTO_ORIGINAL = 120;
export const TOPE_TEXTO_NUEVO = 160;

export type TextosDeBloque = Record<string, string>;

const LETRA = /\p{L}/gu;
const DIGITO = /\d/g;

/** ¿Se le puede cambiar este texto a la tarjeta? Uno con letras (un rótulo, un título); no una cifra ni un signo suelto. */
export function esTextoEditable(t: string): boolean {
  const s = t.trim();
  if (s.length < 2 || s.length > TOPE_TEXTO_ORIGINAL) return false;
  const letras = s.match(LETRA)?.length ?? 0;
  const digitos = s.match(DIGITO)?.length ?? 0;
  return letras >= 2 && letras >= digitos;
}

/** El mapa tal como se puede guardar: claves editables, valores recortados, sin entradas que no cambian nada. */
export function sanearTextos(v: unknown): TextosDeBloque | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: TextosDeBloque = {};
  let n = 0;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (n >= MAX_TEXTOS_BLOQUE) break;
    if (typeof x !== 'string') continue;
    const original = k.trim();
    const nuevo = x.trim().slice(0, TOPE_TEXTO_NUEVO);
    if (!esTextoEditable(original) || !nuevo || nuevo === original) continue;
    out[original] = nuevo;
    n++;
  }
  return n ? out : undefined;
}

/** El mapa con un texto cambiado (o vuelto al original, si `nuevo` está vacío o es el mismo). undefined = sin cambios. */
export function conTextoCambiado(textos: TextosDeBloque | undefined, original: string, nuevo: string): TextosDeBloque | undefined {
  const o = original.trim();
  const n = nuevo.trim().slice(0, TOPE_TEXTO_NUEVO);
  const resto = { ...(textos ?? {}) };
  delete resto[o];
  if (n && n !== o && esTextoEditable(o)) {
    if (Object.keys(resto).length >= MAX_TEXTOS_BLOQUE) return sanearTextos(resto);
    resto[o] = n;
  }
  return sanearTextos(resto);
}

/** Lo que muestra un texto de la tarjeta: el nuevo si su original (sin los espacios de los costados) se cambió. */
export function textoAMostrar(original: string, textos: TextosDeBloque | undefined): string {
  if (!textos) return original;
  const clave = original.trim();
  const nuevo = clave ? textos[clave] : undefined;
  if (nuevo == null) return original;
  const i = original.indexOf(clave);
  return original.slice(0, i) + nuevo + original.slice(i + clave.length);
}
