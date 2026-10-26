// =============================================================================
// compra-plan-reglas — lo que decide el checkout público de /planes (puro, con test)
// =============================================================================
// El servidor vive en lib/compra-plan.ts. Acá: qué se acepta del pedido (nada de precio ni de capa), cómo se limpia el
// ORIGEN que manda la landing y el código de MaKo Partners, qué pasarela se usa, y el diagnóstico del Acelerador.
// =============================================================================

import type { Pasarela } from './cobros-tipos';
import { PREGUNTAS, type Pregunta } from './fase-diagnostico';
import { PRUEBA_DIAS } from './planes-mako';

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

// =============================================================================
// EL DIAGNÓSTICO DE 2 MINUTOS, la puerta del Acelerador (25/10/2026)
// =============================================================================
// docs/como-venden-otros.md §6c, el molde de Ropofy: «un diagnóstico de 2 minutos como puerta, más la llamada». Antes de
// dejar sus datos, quien pide el Acelerador contesta tres preguntas, una por pantalla, y la llamada arranca sabiendo dónde
// está su negocio. Son las MISMAS del diagnóstico de fase del onboarding (lib/fase-diagnostico.ts), no unas escritas acá:
// docs/embudo-y-high-ticket.md §6 califica la llamada por facturación y por cuello, con esos mismos tramos. Lo que se
// guarda es el TEXTO de la opción (el índice solo no dice nada en el CRM), y nunca lo que escribió el navegador.

export const PREGUNTAS_DE_LA_PUERTA: readonly Pregunta[] = ['facturacion', 'inversion', 'cuello']
  .map((id) => PREGUNTAS.find((p) => p.id === id)!);
/** Cómo se nombra cada respuesta en el historial del lead y en el aviso al equipo. */
const ROTULO_DE_LA_PUERTA: Record<string, string> = {
  facturacion: 'Factura por mes', inversion: 'Invierte por mes en conseguir clientes', cuello: 'Su mayor traba',
};
export type RespuestaDePuerta = { rotulo: string; respuesta: string };

/** Las respuestas del diagnóstico (`{ facturacion: 1, … }`, el índice de cada opción): las tres, o null. */
export function diagnosticoLimpio(v: unknown): RespuestaDePuerta[] | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const out: RespuestaDePuerta[] = [];
  for (const p of PREGUNTAS_DE_LA_PUERTA) {
    const i = o[p.id];
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= p.opciones.length) return null;
    out.push({ rotulo: ROTULO_DE_LA_PUERTA[p.id], respuesta: p.opciones[i] });
  }
  return out;
}

/** El diagnóstico en un renglón, para el historial del lead y el aviso: «Factura por mes: $3.000 – $10.000 · …». */
export function diagnosticoEnTexto(d: readonly RespuestaDePuerta[]): string {
  return d.map((x) => `${x.rotulo}: ${x.respuesta}`).join(' · ');
}

export type PedidoCompra = {
  plan: string; nombre: string; email: string; pasarela: Pasarela | null; origen: OrigenCompra | null; ref: string | null;
  /** El WhatsApp (sólo dígitos), para el pedido sin pasarela: por ahí se le da de alta. */
  whatsapp: string | null;
  /** true = «lo quiero» sin pasarela: deja el pedido en el CRM, no abre un pago (`pedirPlanSinPasarela`). */
  quiero: boolean;
  /** El diagnóstico de la puerta (sólo lo manda el pedido del Acelerador). Incompleto = null: el pedido entra igual. */
  diagnostico: RespuestaDePuerta[] | null;
  /** Por mes o por año (25/10/2026). El anual SIEMPRE se pide: el checkout cobra por mes. */
  periodo: 'mensual' | 'anual';
  /**
   * Empezar SIN la prueba gratis (25/10/2026): la salida de quien ya la usó con ese email. El plan se cobra desde hoy. Sin
   * pedirlo, toda compra en línea empieza con los 7 días gratis.
   */
  sinPrueba: boolean;
  /**
   * El código de referido que la persona ESCRIBIÓ en el carrito (25/10/2026, Martín: «es importante que en la compra, en el
   * carrito, esté la opción de poner código de referido»). Escrito a mano, gana sobre la cookie y el `?ref=`: es quien paga
   * diciendo quién lo trajo. `codigoEscritoMal`: escribió algo que no puede ser un código (se le dice, no se descarta).
   */
  codigoEscrito: string | null;
  codigoEscritoMal: boolean;
};

/** Lo que se le dice a quien escribe un código de referido que no es de ningún partner. */
export const TEXTO_CODIGO_NO_EXISTE = 'Ese código de referido no existe. Revísalo, o deja el campo vacío para seguir.';

/**
 * Qué código de partner vale en una compra: el que ESCRIBIÓ en el carrito; si no escribió ninguno, el de la cookie de
 * /r/<código> (el primer link que abrió, revisión del 23/10: la cookie gana sobre el `?ref=` de la URL); y si no, el `?ref=`.
 */
export const codigoDeLaCompra = (p: { escrito: string | null; cookie: string | null; url: string | null }): string | null =>
  p.escrito ?? p.cookie ?? p.url;

/** El texto del pedido del anual que llega como compra (sin `quiero`): no hay checkout anual, y no se cobra un mes en su lugar. */
export const TEXTO_ANUAL_SE_PIDE = 'El plan anual se pide con tus datos: te escribimos por WhatsApp para darte de alta.';

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
  const quiero = b.quiero === true;
  const whatsapp = whatsappLimpio(b.whatsapp);
  if (quiero && !whatsapp) return { ok: false, error: 'Escribe tu WhatsApp con el código de país: por ahí te damos de alta.' };
  const periodo = b.periodo === 'anual' ? 'anual' : 'mensual';
  if (periodo === 'anual' && !quiero) return { ok: false, error: TEXTO_ANUAL_SE_PIDE };
  return {
    ok: true,
    pedido: {
      plan, nombre, email, pasarela, origen: origenLimpio(b.origen), ref: codigoRefLimpio(b.ref), whatsapp, quiero,
      diagnostico: diagnosticoLimpio(b.diagnostico), periodo, sinPrueba: b.sinPrueba === true,
      codigoEscrito: codigoRefLimpio(b.codigo),
      codigoEscritoMal: typeof b.codigo === 'string' && b.codigo.trim() !== '' && codigoRefLimpio(b.codigo) == null,
    },
  };
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

// =============================================================================
// SIN PASARELA (23/10/2026): lo que no se puede cobrar no se muestra como si se pudiera
// =============================================================================
// Hasta que Martín conecte la pasarela de MaKo (/integraciones?ws=9), ningún plan se puede pagar en línea. /planes
// prometía «entras en el acto» con un botón «Empezar», y el paso siguiente decía «Escríbenos» sin dar a dónde: un
// callejón. Se decide POR PLAN y con la misma cuenta que el checkout (lib/compra-plan.ts, `ofertasDeLosPlanes`): un plan
// sin precio en la moneda de la pasarela tampoco se cobra.
//
// LA SALIDA YA NO ES LA AGENDA (24/10/2026, Martín: «No voy a usar Calendly, te dije que pongas las columnas de pricing
// de las ofertas»). El botón lleva a la página del plan, y ahí, sin pasarela, la persona deja su nombre, su email y su
// WhatsApp: queda como lead en el CRM de MaKo con el plan, el origen de la campaña y el código de partner
// (lib/compra-plan.ts, `pedirPlanSinPasarela`), y se le da de alta a mano. Es mejor atribución que la agenda: el código de
// partner viaja en el mismo pedido.

export const TEXTO_SIN_PASARELA = 'Todavía no cobramos en línea. Déjanos tus datos y te escribimos por WhatsApp para darte de alta.';

/** El botón de un plan: comprar si se puede cobrar; si no, pedirlo en su página (nunca «Empezar» sin cobro detrás). */
export function botonDelPlan(p: { id: string; nombre: string; cobrable: boolean; sufijo: string }): { href: string; texto: string } {
  return { href: `/planes/${p.id}${p.sufijo}`, texto: p.cobrable ? `Empezar con ${p.nombre}` : `Quiero ${p.nombre}` };
}

/** El botón del anual: siempre «Quiero» (se pide), con el origen y el partner del sufijo más `periodo=anual`. */
export function botonAnualDelPlan(p: { id: string; sufijo: string }): { href: string; texto: string } {
  const sufijo = p.sufijo.startsWith('?') ? `${p.sufijo}&periodo=anual` : '?periodo=anual';
  return { href: `/planes/${p.id}${sufijo}`, texto: 'Quiero el anual' };
}

/** La bajada de /planes: «entras en el acto» sólo si algún plan se puede pagar en línea. */
export function bajadaDePlanes(algunoCobrable: boolean): string {
  return algunoCobrable
    ? `Empiezas con ${PRUEBA_DIAS} días gratis y entras en el acto. Te das de baja cuando quieras.`
    : `Elige tu plan y déjanos tus datos: te damos de alta por WhatsApp, con ${PRUEBA_DIAS} días gratis. Te das de baja cuando quieras.`;
}

/**
 * El WhatsApp del pedido sin pasarela: sólo dígitos (con el código de país), de 8 a 15 (E.164). null = no sirve. No se
 * inventa el país: lo que la persona no escribió no se agrega.
 */
export function whatsappLimpio(v: unknown): string | null {
  const d = (typeof v === 'string' ? v : '').replace(/[^\d]/g, '');
  return d.length >= 8 && d.length <= 15 ? d : null;
}
