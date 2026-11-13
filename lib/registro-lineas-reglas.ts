// =============================================================================
// registro-lineas-reglas — quién movió la voz o el canal de MaKo, y de qué línea a cuál (puro)
// =============================================================================
// El 12/11/2026 a las 17:38 UTC la voz de MaKo pasó al …3479 —el WhatsApp PERSONAL de Martín— con el botón «Usarlo para MaKo»
// de /agencia, y no quedó rastro de quién: la ruta pide una sesión de admin y no anotaba nada (docs/hallazgos-comunicacion.md,
// «La voz sorda de noche»). El botón se queda (lo pidió Martín el 3/11, con el …2605 baneado), pero deja rastro: desde el 13/11
// cada cambio de la voz o del canal que pasa por /api/admin/mako-canal deja un renglón con quién, cuándo, qué botón, desde qué
// pantalla y de qué línea a cuál. Se ve en Admin › Analytics › Events, tipo «linea».
//
// ⚠️ SE ANOTA EL CAMBIO, NO EL BOTÓN. Se compara la foto de antes del pedido con la de después (`cambioEntre`): así entra
//    cualquier acción que mueva la voz o el canal —las de hoy y una que se sume mañana— y un botón que no cambió nada no ensucia
//    la lista. Lo fija tests/registro-lineas.test.ts.
// ⚠️ UNA FOTO QUE NO SE PUDO LEER NO ES «SIN CAMBIO». Va como `NO_SE_LEYO` y, si la otra foto dice otra cosa, se anota igual:
//    un renglón de más se lee y se descarta; uno de menos es justo lo que pasó el 12/11.
// SIN TABLA NUEVA, como lib/ig-historial.ts: una lista JSON con tope en `app_settings` del dueño (OWNER_WS, donde viven la voz y
// el canal). Una tabla pediría una migración que Martín aplica contra producción; esto sale con el push.
// Puro (sin `server-only`): lo usan la ruta, la pantalla de eventos y los tests.
// =============================================================================

export const KEY_REGISTRO_LINEAS = 'mako.lineas.registro';
/** Cuántos cambios se guardan. Los más viejos se caen del final. */
export const TOPE_REGISTRO_LINEAS = 100;
/** El valor de una foto que no se pudo leer (la base no contestó). */
export const NO_SE_LEYO = '(no se pudo leer)';

export type FotoLineas = { voz: string | null; canal: string | null };
export type Movida = { de: string | null; a: string | null };

export type CambioDeLinea = {
  /** ISO de cuándo terminó el pedido. */
  at: string;
  /** El email de la sesión de admin que hizo el pedido. */
  quien: string;
  /** La `action` del pedido: 'voz-personal', 'usar', 'pasar'… (la lista, en app/api/admin/mako-canal/route.ts). */
  accion: string;
  /** Con 'voz-personal', si fue «Usarlo para MaKo» (true) o «Dejar de usarlo» (false). */
  activar?: boolean;
  /** La ruta de la pantalla que hizo el pedido (el Referer), o `SIN_PANTALLA`. */
  pantalla: string;
  /** null = no cambió. */
  voz: Movida | null;
  canal: Movida | null;
  /** Instancia → número, de lo que se pudo leer al anotarlo (best-effort: sin número, se muestra la instancia sola). */
  numeros: Record<string, string>;
  /**
   * La línea personal de Martín al anotarlo: la de por defecto del negocio del super admin (el …3479). Con la voz ahí no es una
   * alarma: es su decisión (13/11/2026, «Dejarla en mi personal»). null = no se supo.
   */
  personal?: string | null;
};

export const SIN_PANTALLA = '(sin pantalla)';

/** La pantalla desde la que se hizo el pedido: la ruta del Referer, sin el dominio ni los parámetros. */
export function pantallaDelPedido(referer: string | null | undefined): string {
  if (!referer) return SIN_PANTALLA;
  try {
    const p = new URL(referer).pathname;
    return p && p !== '/' ? p : SIN_PANTALLA;
  } catch {
    return SIN_PANTALLA;
  }
}

const mov = (de: string | null, a: string | null): Movida | null => (de === a ? null : { de, a });

/** El renglón de lo que cambió entre las dos fotos, o null si no cambió nada. */
export function cambioEntre(
  antes: FotoLineas,
  despues: FotoLineas,
  d: { at: string; quien: string; accion: string; pantalla: string; activar?: boolean },
): CambioDeLinea | null {
  const voz = mov(antes.voz, despues.voz);
  const canal = mov(antes.canal, despues.canal);
  if (!voz && !canal) return null;
  return {
    at: d.at, quien: d.quien || '(sin sesión)', accion: d.accion || '(sin acción)',
    ...(typeof d.activar === 'boolean' ? { activar: d.activar } : {}),
    pantalla: d.pantalla || SIN_PANTALLA, voz, canal, numeros: {},
  };
}

/** Las instancias que nombra un cambio (para buscarles el número). */
export function instanciasDe(c: CambioDeLinea): string[] {
  const s = new Set<string>();
  for (const m of [c.voz, c.canal]) for (const v of m ? [m.de, m.a] : []) if (v && v !== NO_SE_LEYO) s.add(v);
  return [...s];
}

/** «mako_ws9 (…3479)»: la instancia con los últimos 4 dígitos de su número, si se sabe. */
export function describirLinea(inst: string | null, numeros: Readonly<Record<string, string>>): string {
  if (!inst) return '(ninguna)';
  const n = (numeros[inst] ?? '').replace(/\D/g, '');
  return n.length >= 4 ? `${inst} (…${n.slice(-4)})` : inst;
}

/** ¿La voz quedó en la línea personal de Martín? (Su decisión: se dice, no se alarma.) */
export const vozEnSuPersonal = (c: CambioDeLinea): boolean => !!c.voz?.a && !!c.personal && c.voz.a === c.personal;

/**
 * ¿La voz quedó en la línea de OTRO negocio? `mako_ws<n>` es la línea de un negocio: ahí MaKo habla con el número de un cliente.
 * La del negocio del super admin —el …3479, el WhatsApp personal de Martín— NO cuenta: el 13/11/2026 Martín decidió dejar la voz
 * ahí («Dejarla en mi personal»), y un evento en rojo por su propia decisión es una alarma que enseña a no mirar las alarmas.
 */
export const vozEnLineaAjena = (c: CambioDeLinea): boolean => !!c.voz?.a && /^mako_ws\d/.test(c.voz.a) && !vozEnSuPersonal(c);

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strONull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
function movida(v: unknown): Movida | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const m = { de: strONull(o.de), a: strONull(o.a) };
  return m.de === m.a ? null : m;
}

/** Un renglón crudo de la base, o null si no se puede mostrar. Tolerante: un renglón roto no voltea la lista entera. */
export function normalizarCambio(raw: unknown): CambioDeLinea | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const at = str(o.at);
  if (!at || Number.isNaN(Date.parse(at))) return null;
  const voz = movida(o.voz);
  const canal = movida(o.canal);
  if (!voz && !canal) return null;
  const numeros: Record<string, string> = {};
  if (o.numeros && typeof o.numeros === 'object') {
    for (const [k, v] of Object.entries(o.numeros as Record<string, unknown>)) if (typeof v === 'string' && v.trim()) numeros[k] = v.trim();
  }
  return {
    at, quien: str(o.quien) || '(sin sesión)', accion: str(o.accion) || '(sin acción)',
    ...(typeof o.activar === 'boolean' ? { activar: o.activar } : {}),
    pantalla: str(o.pantalla) || SIN_PANTALLA, voz, canal, numeros, personal: strONull(o.personal),
  };
}

/** Lo guardado, de lo más nuevo a lo más viejo. Nunca tira: sin nada, `[]`. */
export function leerRegistroLineas(raw: string | null | undefined): CambioDeLinea[] {
  if (!raw) return [];
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr
    .map(normalizarCambio)
    .filter((x): x is CambioDeLinea => x !== null)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, TOPE_REGISTRO_LINEAS);
}

/** Lo que se escribe: el cambio nuevo al frente de lo que había, con el tope. */
export function conElCambio(raw: string | null | undefined, c: CambioDeLinea): string {
  return JSON.stringify([c, ...leerRegistroLineas(raw)].slice(0, TOPE_REGISTRO_LINEAS));
}
