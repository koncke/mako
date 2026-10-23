// =============================================================================
// compra-plan-reglas — lo que decide el checkout público de /planes (puro, con test)
// =============================================================================
// El servidor vive en lib/compra-plan.ts. Acá: qué se acepta del pedido (nada de precio ni de capa), cómo se limpia el
// ORIGEN que manda la landing y el código de MaKo Partners, y qué pasarela se usa.
// =============================================================================

import type { Pasarela } from './cobros-tipos';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CODIGO_REF_RE = /^[a-z0-9-]{3,32}$/;

/**
 * De dónde vino quien compra. Lo manda la landing de MaKo («Landings de MaKo en Web Generator»): `landing` es el slug,
 * `avatar` a quién le habla y `funcionalidad` lo que vino a buscar (lo lee el onboarding). Más la campaña del anuncio.
 * Todo opcional, todo texto corto: es un dato que se MUESTRA y se usa para elegir una pantalla, nunca para cobrar.
 */
export type OrigenCompra = Partial<Record<(typeof CLAVES_ORIGEN)[number], string>>;

export const CLAVES_ORIGEN = ['landing', 'avatar', 'funcionalidad', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'] as const;
const TOPE_ORIGEN: Record<(typeof CLAVES_ORIGEN)[number], number> = {
  landing: 64, avatar: 40, funcionalidad: 40, utm_source: 100, utm_medium: 100, utm_campaign: 150, utm_content: 150, fbclid: 250,
};
/** Lo que puede venir en `landing`, `avatar` y `funcionalidad`: un slug. La campaña es texto libre (sin control). */
const SLUG_RE = /^[a-z0-9][a-z0-9-_]*$/;

/** El origen limpio, o null si no trae nada que valga. Las claves que no son de la lista se tiran. */
export function origenLimpio(v: unknown): OrigenCompra | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const out: OrigenCompra = {};
  for (const k of CLAVES_ORIGEN) {
    const crudo = typeof o[k] === 'string' ? (o[k] as string).trim() : '';
    if (!crudo) continue;
    // Sin caracteres de control (un salto de línea en un dato que después se escribe en un mail o en un log).
    // eslint-disable-next-line no-control-regex
    const s = crudo.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, TOPE_ORIGEN[k]);
    if (!s) continue;
    if ((k === 'landing' || k === 'avatar' || k === 'funcionalidad')) {
      const slug = s.toLowerCase();
      if (!SLUG_RE.test(slug)) continue;
      out[k] = slug;
    } else out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

/** El código de MaKo Partners del pedido (o de la cookie), en minúscula. null si no es uno. */
export function codigoRefLimpio(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return CODIGO_REF_RE.test(s) ? s : null;
}

export type PedidoCompra = { plan: string; nombre: string; email: string; pasarela: Pasarela | null; origen: OrigenCompra | null; ref: string | null };

/**
 * El pedido del formulario, validado. Lo que NUNCA sale de acá: el precio, la moneda y la capa (los pone el plan). El
 * campo trampa (`web`) lleno es un bot: se contesta como si nada (quien llama no crea nada).
 */
export function leerPedidoCompra(body: unknown): { ok: true; pedido: PedidoCompra } | { ok: false; error: string; bot?: true } {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  if (typeof b.web === 'string' && b.web.trim()) return { ok: false, error: 'bot', bot: true };
  const plan = typeof b.plan === 'string' ? b.plan.trim() : '';
  if (!/^[a-z0-9-]{1,32}$/.test(plan)) return { ok: false, error: 'Ese plan no existe.' };
  const nombre = (typeof b.nombre === 'string' ? b.nombre : '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (nombre.length < 2) return { ok: false, error: 'Escribe tu nombre.' };
  const email = (typeof b.email === 'string' ? b.email : '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, error: 'Escribe un email válido: por ahí te llega el acceso.' };
  const pasarela = b.pasarela === 'stripe' || b.pasarela === 'mercadopago' ? b.pasarela : null;
  return { ok: true, pedido: { plan, nombre, email, pasarela, origen: origenLimpio(b.origen), ref: codigoRefLimpio(b.ref) } };
}

/**
 * Con qué pasarela se cobra: la que eligió (si está conectada y el plan tiene precio en su moneda), o la única que sirve.
 * Con dos que sirven y ninguna elegida, se pregunta (null + `elegir`).
 */
export function pasarelaDeLaCompra(p: {
  pedida: Pasarela | null;
  sirven: readonly Pasarela[];
}): { ok: true; pasarela: Pasarela } | { ok: false; motivo: 'sin-pasarela' | 'elegir' | 'no-sirve' } {
  if (!p.sirven.length) return { ok: false, motivo: 'sin-pasarela' };
  if (p.pedida) return p.sirven.includes(p.pedida) ? { ok: true, pasarela: p.pedida } : { ok: false, motivo: 'no-sirve' };
  return p.sirven.length === 1 ? { ok: true, pasarela: p.sirven[0] } : { ok: false, motivo: 'elegir' };
}

export const TEXTO_SIN_PASARELA = 'Todavía no podemos cobrar en línea. Escríbenos y te damos de alta.';
