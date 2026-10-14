// =============================================================================
// editor-landing/pago-pedido — lo que manda el visitante en el paso de pago, y qué se hace con eso
// =============================================================================
// Tanda 4 (14/10/2026): el «Botón de pago» de una landing cobrado por la pasarela de MaKo
// (pago-landing.ts tiene el recorrido entero). Acá vive lo que DECIDE el POST de
// app/api/landing-generator/pagar sin tocar la base: leer el formulario (con el campo trampa), de
// dónde viene (Origin, en positivo), cuál es el lead de ese email (comparación EXACTA) y si un cobro
// pendiente ya es lo que se va a cobrar.
//
// ⚠️ PURO (sin server-only, con test) PERO NO PARA EL NAVEGADOR: importa del CRM (`emailComparable`
// arrastra el embudo entero). El editor importa pago-landing.ts, nunca éste.
// =============================================================================

import { slugValido } from './doc';
import { DOMINIOS_DE_MAKO, dominioValido, esHostDeMako } from './dominios-reglas';
import { productoDeSegmento } from './pago-landing';
import type { Cobro, Pasarela, TipoCobro } from '../cobros-tipos';
import { emailNormalizado, emailUtilizable } from '../agencia-altas';
import { emailComparable } from '../leads-duplicados';

/** Adonde postea el formulario del paso. RELATIVA a propósito: el mismo host que sirve la página. */
export const RUTA_POST_PAGO = '/api/landing-generator/pagar';

// ─────────────────────────────────────────────────────────────────────────────
// Lo que manda el formulario del paso
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El campo trampa: invisible para una persona (fuera de la pantalla, sin tab, sin autocompletar) y
 * tentador para un bot. Con algo adentro, no se crea nada. El nombre no dice «trampa» a propósito.
 */
export const CAMPO_TRAMPA = 'sitio_web';
export const TOPE_NOMBRE = 120;
export const TOPE_EMAIL = 254;

export type PedidoPago = { slug: string; productoId: number; nombre: string; email: string };
export type FallaPedidoPago = 'forma' | 'trampa' | 'nombre' | 'email';
/**
 * Lo que falló y, si fue un CAMPO, lo que se mandó: el POST vuelve a dibujar el formulario con el
 * error y con lo que la persona ya había escrito (nadie vuelve a tipear su nombre por un email mal).
 */
export type LecturaPedidoPago =
  | { ok: true; pedido: PedidoPago }
  | { ok: false; falla: 'forma' | 'trampa' }
  | { ok: false; falla: 'nombre' | 'email'; slug: string; productoId: number; valores: { nombre: string; email: string } };

/** Un nombre limpio: sin caracteres de control, espacios colapsados, recortado. '' si no queda nada. */
export function nombreLimpio(v: unknown): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TOPE_NOMBRE);
}

/**
 * Lee el cuerpo del formulario. El ORDEN importa: lo que no tiene forma (slug, producto) no llega ni a
 * mirar la trampa; la trampa va antes que los campos (un bot no recibe pistas de qué le faltó).
 */
export function leerPedidoPago(campos: { get(k: string): string | null }): LecturaPedidoPago {
  const slug = (campos.get('slug') ?? '').trim();
  const productoId = productoDeSegmento((campos.get('bloque') ?? '').trim());
  if (!slugValido(slug) || productoId === null) return { ok: false, falla: 'forma' };
  if ((campos.get(CAMPO_TRAMPA) ?? '').trim() !== '') return { ok: false, falla: 'trampa' };
  const nombre = nombreLimpio(campos.get('nombre'));
  const email = emailNormalizado(campos.get('email') ?? '').slice(0, TOPE_EMAIL + 1);
  const valores = { nombre, email: email.slice(0, TOPE_EMAIL) };
  if (!nombre) return { ok: false, falla: 'nombre', slug, productoId, valores };
  if (!emailUtilizable(email) || email.length > TOPE_EMAIL) return { ok: false, falla: 'email', slug, productoId, valores };
  return { ok: true, pedido: { slug, productoId, nombre, email } };
}

/** El texto corto que ve el visitante en el formulario cuando un campo no sirve. */
export const TEXTO_FALLA_CAMPO: Readonly<Record<'nombre' | 'email', string>> = {
  nombre: 'Escribe tu nombre.',
  email: 'Revisa tu email.',
};

/** Lo que ve el visitante cuando no se puede cobrar (el motivo real va al historial del lead). */
export const TEXTO_NO_DISPONIBLE = 'Este pago no está disponible en este momento.';
/** Lo que ve cuando falló algo nuestro o de la pasarela (el motivo real, al log y al historial). */
export const TEXTO_FALLO = 'No pudimos abrir el pago. Prueba de nuevo en unos minutos.';
export const TEXTO_DEMASIADOS = 'Demasiados intentos. Prueba de nuevo en unos minutos.';

// ─────────────────────────────────────────────────────────────────────────────
// De dónde viene el POST (Origin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El host donde se van a servir las landings publicadas (la mudanza en curso: `https://hola-mako.site/<slug>`).
 * ⚠️ SI LA MUDANZA LO DECLARA EN OTRO LADO (p. ej. en `DOMINIOS_DE_MAKO`), esto pasa a importarlo de ahí:
 * dos constantes del mismo host son la misma regla escrita dos veces.
 */
export const HOST_SITIOS = 'hola-mako.site';

export type OrigenPago = { tipo: 'mako' } | { tipo: 'dominio'; host: string };

const origenDe = (url: string | null | undefined): string | null => {
  try {
    const u = new URL(String(url ?? ''));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
};

const esDe = (host: string, base: string): boolean => host === base || host.endsWith('.' + base);

/**
 * ¿Desde dónde se mandó el formulario? EN POSITIVO: la app (APP_BASE_URL), un dominio de MaKo, el host
 * de los sitios publicados, o el MISMO host que contesta cuando es un deploy de MaKo o una máquina local
 * (en dev la landing se sirve en /l/<slug> del mismo host). Un dominio de cliente vuelve como
 * `dominio`: quien llama confirma que es el de ESA landing (`landingDeDominio`). Lo demás —sin Origin,
 * `null` (un iframe sandbox), otro sitio, un puerto raro— es null.
 *
 * ⚠️ `*.vercel.app` NO entra solo: es de cualquier cliente de Vercel. Sólo el deploy que contesta.
 * ⚠️ No es una barrera contra un script (el Origin se falsifica con curl): corta el formulario de un
 *    sitio ajeno en el navegador de un visitante. Lo que frena el abuso son los topes y la trampa.
 */
export function origenDelPago(origin: string | null | undefined, op: { appBaseUrl: string; propio?: string | null }): OrigenPago | null {
  if (!origin || origin === 'null') return null;
  const o = origenDe(origin);
  if (!o || o !== origin.trim().replace(/\/+$/, '')) return null;
  if (o === origenDe(op.appBaseUrl)) return { tipo: 'mako' };
  const u = new URL(o);
  const host = u.hostname.toLowerCase();
  const propio = origenDe(op.propio);
  const local = host === 'localhost' || host === '127.0.0.1';
  if (o === propio && (local || esHostDeMako(host))) return { tipo: 'mako' };
  if (u.protocol !== 'https:' || u.port) return null;
  if (esDe(host, HOST_SITIOS) || DOMINIOS_DE_MAKO.some((d) => esDe(host, d))) return { tipo: 'mako' };
  if (esHostDeMako(host)) return null; // un *.vercel.app que no es el que contesta
  return dominioValido(host) ? { tipo: 'dominio', host } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// El lead y el cobro
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El lead de ese email en el negocio: comparación EXACTA (`emailComparable`), nunca un patrón (un `_`
 * del email es comodín en `ilike`, AGENTS.md «Un patrón trae CANDIDATOS»). Con más de uno se elige el
 * MÁS VIEJO (el id más chico): es la ficha que actualizan Calendly y Meta, y elegirla es un dato, no
 * el primero que devolvió la consulta. `ambiguo` lo dice para dejarlo escrito.
 */
export function leadPorEmail(candidatos: ReadonlyArray<{ id: number | string; email?: string | null }>, email: string): { id: number; ambiguo: boolean } | null {
  const buscado = emailComparable(email);
  if (!buscado) return null;
  const ids = candidatos
    .filter((c) => emailComparable(c.email) === buscado)
    .map((c) => Number(c.id))
    .filter((n) => Number.isSafeInteger(n) && n > 0)
    .sort((a, b) => a - b);
  return ids.length ? { id: ids[0], ambiguo: ids.length > 1 } : null;
}

export type CobroBuscado = { productoId: number; pasarela: Pasarela; monto: number; moneda: string; tipo: TipoCobro };

/**
 * ¿Este cobro pendiente ya es lo que se va a cobrar? El MISMO producto, por la MISMA pasarela, al MISMO
 * precio. `cobroPendienteDelLead` devuelve el más nuevo de CUALQUIER producto, y un pendiente viejo con
 * el precio de antes cobraría lo que el catálogo ya no dice: los dos se comparan antes de reusar.
 */
export function cobroReusable(c: Pick<Cobro, 'estado' | 'producto_id' | 'proveedor' | 'monto' | 'moneda' | 'tipo'>, b: CobroBuscado): boolean {
  return c.estado === 'pendiente'
    && c.producto_id === b.productoId
    && c.proveedor === b.pasarela
    && String(c.moneda).toUpperCase() === b.moneda.toUpperCase()
    && Math.round(Number(c.monto) * 100) === Math.round(b.monto * 100)
    && c.tipo === b.tipo;
}

/** El primer pendiente reusable (la lista viene del más nuevo al más viejo), o null. */
export function cobroPendienteReusable<C extends Pick<Cobro, 'estado' | 'producto_id' | 'proveedor' | 'monto' | 'moneda' | 'tipo'>>(pendientes: readonly C[], b: CobroBuscado): C | null {
  return pendientes.find((c) => cobroReusable(c, b)) ?? null;
}

/** El `creadoPor` del cobro y el autor del historial: de QUÉ landing vino. */
export function creadoPorLanding(titulo: string, slug: string): string {
  const t = nombreLimpio(titulo).slice(0, 60) || slug;
  return `Landing «${t}» (${slug})`;
}
