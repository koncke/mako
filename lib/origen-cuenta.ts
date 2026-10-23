// =============================================================================
// origen-cuenta — de qué landing / funnel de MaKo vino cada cuenta (lo PURO)
// =============================================================================
// Pedido (23/10/2026, Cerebro por Martín): «cada landing lleva su origen (avatar y funcionalidad) en la URL/UTM
// y en el Píxel/CAPI con el UID. Cuando la persona se registra o paga en MaKo, ese origen queda guardado en su
// cuenta, para que el onboarding sepa de qué funnel vino».
//
// CONTRATO (acordado con el chat «Planes de MaKo y Partners», que lo lee en el onboarding):
//   app_settings del workspace NUEVO, clave `cuenta.origen` (CLAVE_ORIGEN_CUENTA), con un `OrigenCuenta` en JSON.
//   null en un campo = no se sabe (NUNCA inventado). Sin la clave = cuenta de antes o alta sin lead.
// Lo escribe el alta que sale de un cobro (lib/cobros.ts → lib/origen-cuenta-server.ts) desde el lead del
// comprador en el CRM de la plataforma: sus UTM y su visitante (el Pixel de MaKo) → su primera visita a una
// landing de MaKo → el slug → el avatar y la funcionalidad de LANDINGS_MAKO.
// =============================================================================

export const CLAVE_ORIGEN_CUENTA = 'cuenta.origen';

export const AVATARES = ['inmobiliarias', 'infoproductores', 'coaches'] as const;
export const FUNCIONALIDADES = ['landings', 'automatizaciones', 'dashboards', 'contenidos', 'avatares-ia'] as const;
export type AvatarOrigen = (typeof AVATARES)[number];
export type FuncionalidadOrigen = (typeof FUNCIONALIDADES)[number];

/**
 * Las landings de MaKo, por su slug (el de Web Generator: hola-mako.com/vsl/<slug> y hola-mako.site/<slug>).
 * 'principal' = la portada (hola-mako.com/ y hola-mako.site/hola-mako). Una landing nueva se suma ACÁ con su
 * avatar o su funcionalidad: lo que no está en la lista se guarda con su slug y sin avatar ni funcionalidad.
 */
export const LANDINGS_MAKO: Readonly<Record<string, { avatar: AvatarOrigen | null; funcionalidad: FuncionalidadOrigen | null }>> = {
  principal: { avatar: null, funcionalidad: null },
  'crear-landings': { avatar: null, funcionalidad: 'landings' },
  automatizaciones: { avatar: null, funcionalidad: 'automatizaciones' },
  dashboards: { avatar: null, funcionalidad: 'dashboards' },
  contenidos: { avatar: null, funcionalidad: 'contenidos' },
  'avatares-ia': { avatar: null, funcionalidad: 'avatares-ia' },
  inmobiliarias: { avatar: 'inmobiliarias', funcionalidad: null },
  infoproductores: { avatar: 'infoproductores', funcionalidad: null },
  coaches: { avatar: 'coaches', funcionalidad: null },
};

export type UtmOrigen = { source: string | null; medium: string | null; campaign: string | null; content: string | null };

export type OrigenCuenta = {
  v: 1;
  /** Slug de la landing de MaKo ('principal' = la portada), o null. */
  landing: string | null;
  avatar: AvatarOrigen | null;
  funcionalidad: FuncionalidadOrigen | null;
  utm: UtmOrigen;
  /** El visitante del Pixel de MaKo (`nqe_visitor_id`), el UID que viaja a Meta como external_id. */
  visitorId: string | null;
  leadId: number | null;
  /** 'checkout' = vino EXPLÍCITO en el link a /planes (cobros.origen); 'lead' = reconstruido del lead (primer toque). */
  fuente: 'lead' | 'checkout' | 'manual';
  at: string;
};

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/;

/**
 * El slug de una landing de MaKo a partir de la URL de una visita: hola-mako.com/ (y www) → 'principal';
 * hola-mako.com/vsl/<slug> → <slug> si es una landing de la lista (las 24 de funcionalidad viejas, no);
 * hola-mako.site/hola-mako → 'principal'; hola-mako.site/<slug> → <slug> de la lista. Otra cosa → null.
 */
export function slugDeLandingMako(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const partes = u.pathname.split('/').filter(Boolean);
  if (host === 'hola-mako.com') {
    if (!partes.length) return 'principal';
    if (partes[0] === 'vsl' && partes.length === 2 && SLUG.test(partes[1]) && LANDINGS_MAKO[partes[1]]) return partes[1];
    return null;
  }
  if (host === 'hola-mako.site' && partes.length === 1) {
    if (partes[0] === 'hola-mako') return 'principal';
    return LANDINGS_MAKO[partes[0]] ? partes[0] : null;
  }
  return null;
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);

export type LeadParaOrigen = {
  id: number;
  utm_source?: unknown; utm_medium?: unknown; utm_campaign?: unknown; utm_content?: unknown;
  visitor_id?: unknown; pagina_registro?: unknown;
};

/**
 * El origen a partir del lead y sus visitas (las del Pixel, en cualquier orden). La landing es la de la PRIMERA
 * visita a una landing de MaKo (el primer toque: el anuncio que lo trajo); si no hay, la página donde se
 * registró. Las UTM son las del lead; si el lead no las trae, las de esa primera visita.
 */
export function origenDe(lead: LeadParaOrigen, visitas: ReadonlyArray<{ landing_url?: unknown; created_at?: unknown }>, ahora: string): OrigenCuenta {
  const ordenadas = [...visitas].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
  const primera = ordenadas.find((v) => slugDeLandingMako(v.landing_url) !== null) ?? null;
  const landing = (primera ? slugDeLandingMako(primera.landing_url) : null) ?? slugDeLandingMako(lead.pagina_registro);
  let q: URLSearchParams | null = null;
  try { q = primera && typeof primera.landing_url === 'string' ? new URL(primera.landing_url).searchParams : null; } catch { q = null; }
  const utm = (k: 'source' | 'medium' | 'campaign' | 'content') => texto(lead[`utm_${k}`]) ?? texto(q?.get(`utm_${k}`));
  const def = landing ? LANDINGS_MAKO[landing] : undefined;
  return {
    v: 1,
    landing,
    avatar: def?.avatar ?? null,
    funcionalidad: def?.funcionalidad ?? null,
    utm: { source: utm('source'), medium: utm('medium'), campaign: utm('campaign'), content: utm('content') },
    visitorId: texto(lead.visitor_id),
    leadId: Number.isSafeInteger(lead.id) ? lead.id : null,
    fuente: 'lead',
    at: ahora,
  };
}

/**
 * El origen EXPLÍCITO de un cobro del checkout público (`cobros.origen`, jsonb, mig 0330 del chat «Planes de MaKo y
 * Partners»: `{landing, avatar, funcionalidad, utm_source, utm_medium, utm_campaign, utm_content, fbclid}`, de los
 * parámetros del link a /planes). Si trae una landing, gana sobre el primer toque. null si no trae nada usable.
 * El avatar y la funcionalidad salen de LANDINGS_MAKO cuando la landing es nuestra; si no, de lo que vino (validado).
 */
export function origenDeCheckout(raw: unknown, lead: { id?: number | null; visitor_id?: unknown } | null, ahora: string): OrigenCuenta | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const landing = texto(r.landing);
  if (!landing) return null;
  const def = LANDINGS_MAKO[landing];
  const avatar = def ? def.avatar : (AVATARES as readonly unknown[]).includes(r.avatar) ? (r.avatar as AvatarOrigen) : null;
  const funcionalidad = def ? def.funcionalidad : (FUNCIONALIDADES as readonly unknown[]).includes(r.funcionalidad) ? (r.funcionalidad as FuncionalidadOrigen) : null;
  return {
    v: 1, landing, avatar, funcionalidad,
    utm: { source: texto(r.utm_source), medium: texto(r.utm_medium), campaign: texto(r.utm_campaign), content: texto(r.utm_content) },
    visitorId: texto(lead?.visitor_id), leadId: typeof lead?.id === 'number' && Number.isSafeInteger(lead.id) ? lead.id : null,
    fuente: 'checkout', at: ahora,
  };
}

/** El origen guardado (el JSON de app_settings), validado. null si no hay o no tiene la forma. */
export function leerOrigen(valor: unknown): OrigenCuenta | null {
  if (typeof valor !== 'string') return null;
  try {
    const o = JSON.parse(valor) as Partial<OrigenCuenta>;
    if (!o || o.v !== 1 || typeof o.at !== 'string') return null;
    const u = (o.utm ?? {}) as Partial<UtmOrigen>;
    return {
      v: 1,
      landing: texto(o.landing),
      avatar: (AVATARES as readonly unknown[]).includes(o.avatar) ? (o.avatar as AvatarOrigen) : null,
      funcionalidad: (FUNCIONALIDADES as readonly unknown[]).includes(o.funcionalidad) ? (o.funcionalidad as FuncionalidadOrigen) : null,
      utm: { source: texto(u.source), medium: texto(u.medium), campaign: texto(u.campaign), content: texto(u.content) },
      visitorId: texto(o.visitorId),
      leadId: typeof o.leadId === 'number' && Number.isSafeInteger(o.leadId) ? o.leadId : null,
      fuente: o.fuente === 'manual' || o.fuente === 'checkout' ? o.fuente : 'lead',
      at: o.at,
    };
  } catch {
    return null;
  }
}
