// =============================================================================
// Media Buyer — «Lánzame una campaña»: qué se pide y qué viaja a Zernio (PURO: lo prueban los tests)
// =============================================================================
// Martín a la agencia de Thiago, 29/10/2026 [12:19]: «lánzame una campaña». Hasta hoy el Media Buyer sólo operaba lo que ya
// estaba en la cuenta: el asistente de campañas se borró con la vista vieja del Ads Manager (25/10) y las rutas de creación
// iban con el token de Meta, deprecado. Una campaña nueva sale ENTERA por la Zernio del negocio (`POST /v1/ads/create`, la
// forma «legacy»: campaña + conjunto + anuncio en un pedido, y si Meta rechaza algo Zernio deshace lo creado). Con el token
// no se puede: el creativo nuevo nace de la app en desarrollo del cliente y Meta lo rechaza (1885183).
//
// Lo que viaja, leído en la OpenAPI de Zernio v1.416.0 (29/10/2026):
//   · `goal`: formulario → `lead_generation` (con `leadGenFormId`); web → `lead_conversion` (píxel + un evento de leads:
//     LEAD, SCHEDULE, SUBMIT_APPLICATION, CONTACT); compras → `conversions` (píxel + PURCHASE); tráfico → `traffic`.
//   · ⚠️ `budgetAmount` en UNIDADES de la moneda de la cuenta, nunca en centavos (AGENTS.md, «Las unidades»).
//   · `endDate` con la fecha sola corre hasta las 23:59:59 de la zona de la CUENTA. Es el «hasta» de la campaña.
//   · ⚠️ `status: PAUSED` pausa sólo lo de ARRIBA (lo de adentro nace prendido; medido el 25/10). «En pausa» manda los tres.
//   · `existingCreativeId` reusa el creativo de un anuncio (sus textos y su media; los campos de copia se ignoran).
// =============================================================================

import type { LugarZona } from './zona';
import { esPathDeStaging } from '@/lib/ads-staging';

export const OBJETIVOS_CAMPANA = ['formulario', 'web', 'trafico', 'compras'] as const;
export type ObjetivoCampana = (typeof OBJETIVOS_CAMPANA)[number];
export const NOMBRE_OBJETIVO: Record<ObjetivoCampana, string> = {
  formulario: 'Formulario de Meta', web: 'Registros en tu página', trafico: 'Visitas a tu página', compras: 'Compras en tu página',
};
/** Los eventos del píxel que Meta acepta para optimizar registros (los de clase «leads»). */
export const EVENTOS_WEB = ['LEAD', 'SCHEDULE', 'SUBMIT_APPLICATION', 'CONTACT', 'COMPLETE_REGISTRATION'] as const;
export const BOTONES_CAMPANA = ['LEARN_MORE', 'SIGN_UP', 'APPLY_NOW', 'BOOK_NOW', 'CONTACT_US', 'GET_QUOTE', 'SUBSCRIBE', 'SHOP_NOW', 'WHATSAPP_MESSAGE'] as const;
export type BotonCampana = (typeof BOTONES_CAMPANA)[number];

export type CreativoCampana =
  | { tipo: 'imagen'; url: string }
  | { tipo: 'video'; url: string; miniatura?: string | null }
  | { tipo: 'video_cuenta'; videoId: string }
  /** Reusar el creativo de un anuncio de la cuenta (su texto, su media y su botón). */
  | { tipo: 'anuncio'; adId: string }
  /** Un archivo que la pantalla subió al staging de siempre (`creative-signurl`): el servidor lo firma y se lo pasa a Zernio. */
  | { tipo: 'archivo'; path: string; media: 'imagen' | 'video' };

export type EntradaCampana = {
  nombre: string;
  objetivo: ObjetivoCampana;
  /** Por día, en la MONEDA DE LA CUENTA (lo que va a Meta). */
  presupuestoDia: number;
  /** [] = la zona del Media Buyer (la pone el servidor). */
  lugares: LugarZona[];
  /** YYYY-MM-DD, el día del negocio. null = la fecha de fin del Media Buyer, o sin fecha. */
  hasta: string | null;
  edadMin: number | null;
  edadMax: number | null;
  formularioId: string | null;
  pixelId: string | null;
  evento: string | null;
  url: string | null;
  creativo: CreativoCampana;
  texto: string;
  titulo: string | null;
  boton: BotonCampana | null;
  /** true = nace toda en pausa (campaña, conjunto y anuncio). */
  enPausa: boolean;
};

const texto = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const https = (v: unknown): string | null => { const s = texto(v, 1000); return s && /^https:\/\/[^\s/]+\.[^\s]+$/i.test(s) ? s : null; };
const digitos = (v: unknown): string | null => { const s = texto(v, 30); return s && /^\d{1,30}$/.test(s) ? s : null; };
const edad = (v: unknown): number | null | 'mal' => (v == null || v === '' ? null : Number.isInteger(Number(v)) && Number(v) >= 18 && Number(v) <= 65 ? Number(v) : 'mal');

export type Validacion = { ok: true; valor: EntradaCampana } | { ok: false; error: string; faltan?: string[] };

/**
 * Lo que llega (la pantalla o la API), validado sin red. Lo que depende de la cuenta (la conexión, la zona, los topes, la
 * fecha contra hoy, el anuncio a reusar) lo mira el servidor (campana.ts → prepararCampana). `lugares` ya viene validado
 * por `validarZona` (la misma forma).
 */
export function validarCampana(x: Record<string, unknown>, lugares: LugarZona[]): Validacion {
  const nombre = texto(x.nombre, 200);
  if (!nombre) return { ok: false, error: 'Ponle un nombre a la campaña.', faltan: ['nombre'] };
  const objetivo = String(x.objetivo ?? '') as ObjetivoCampana;
  if (!(OBJETIVOS_CAMPANA as readonly string[]).includes(objetivo)) return { ok: false, error: `El objetivo es uno de: ${OBJETIVOS_CAMPANA.join(', ')}.`, faltan: ['objetivo'] };
  const presupuestoDia = Number(x.presupuestoDia);
  if (!Number.isFinite(presupuestoDia) || presupuestoDia <= 0) return { ok: false, error: 'El presupuesto por día tiene que ser mayor que cero.', faltan: ['presupuestoDia'] };
  const edadMin = edad(x.edadMin);
  const edadMax = edad(x.edadMax);
  if (edadMin === 'mal' || edadMax === 'mal') return { ok: false, error: 'Las edades van de 18 a 65.' };
  if (edadMin != null && edadMax != null && edadMin > edadMax) return { ok: false, error: 'La edad mínima no puede ser mayor que la máxima.' };
  const hastaCrudo = x.hasta;
  const hasta = hastaCrudo == null || hastaCrudo === '' ? null : texto(hastaCrudo, 10);
  if (hasta && !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return { ok: false, error: 'La fecha de fin va como AAAA-MM-DD.' };

  const formularioId = digitos(x.formularioId);
  const pixelId = digitos(x.pixelId);
  const url = https(x.url);
  if (x.url != null && x.url !== '' && !url) return { ok: false, error: 'La página de destino tiene que ser una dirección exacta con https.' };
  let evento: string | null = null;
  if (objetivo === 'formulario' && !formularioId) return { ok: false, error: 'Elige el formulario de Meta donde dejan sus datos.', faltan: ['formularioId'] };
  if ((objetivo === 'web' || objetivo === 'compras') && !pixelId) return { ok: false, error: 'Elige el píxel de tu página.', faltan: ['pixelId'] };
  if (objetivo === 'web') {
    evento = texto(x.evento, 40)?.toUpperCase() ?? 'LEAD';
    if (!(EVENTOS_WEB as readonly string[]).includes(evento)) return { ok: false, error: `El evento del píxel es uno de: ${EVENTOS_WEB.join(', ')}.` };
  }
  if (objetivo === 'compras') evento = 'PURCHASE';
  if (objetivo !== 'formulario' && !url) return { ok: false, error: 'Falta la página a la que lleva el anuncio (con https).', faltan: ['url'] };

  const c = (x.creativo ?? {}) as Record<string, unknown>;
  let creativo: CreativoCampana;
  if (c.tipo === 'anuncio' && digitos(c.adId)) creativo = { tipo: 'anuncio', adId: digitos(c.adId)! };
  else if (c.tipo === 'video_cuenta' && digitos(c.videoId)) creativo = { tipo: 'video_cuenta', videoId: digitos(c.videoId)! };
  else if (c.tipo === 'video' && https(c.url)) creativo = { tipo: 'video', url: https(c.url)!, miniatura: https(c.miniatura) };
  else if (c.tipo === 'imagen' && https(c.url)) creativo = { tipo: 'imagen', url: https(c.url)! };
  else if (c.tipo === 'archivo' && typeof c.path === 'string' && esPathDeStaging(c.path)) creativo = { tipo: 'archivo', path: c.path, media: c.media === 'video' ? 'video' : 'imagen' };
  else return { ok: false, error: 'Falta el creativo: una imagen o un video (con su dirección https), o un anuncio de tu cuenta para reusar.', faltan: ['creativo'] };

  const textoPrincipal = texto(x.texto, 2000) ?? '';
  if (creativo.tipo !== 'anuncio' && !textoPrincipal) return { ok: false, error: 'Falta el texto del anuncio.', faltan: ['texto'] };
  const boton = texto(x.boton, 40) as BotonCampana | null;
  if (boton && !(BOTONES_CAMPANA as readonly string[]).includes(boton)) return { ok: false, error: `El botón es uno de: ${BOTONES_CAMPANA.join(', ')}.` };

  return {
    ok: true,
    valor: {
      nombre, objetivo, presupuestoDia: Math.round(presupuestoDia * 100) / 100, lugares, hasta, edadMin, edadMax,
      formularioId: objetivo === 'formulario' ? formularioId : null, pixelId: objetivo === 'web' || objetivo === 'compras' ? pixelId : null,
      evento, url, creativo, texto: textoPrincipal, titulo: texto(x.titulo, 255), boton, enPausa: x.enPausa === true,
    },
  };
}

const GOAL: Record<ObjetivoCampana, string> = { formulario: 'lead_generation', web: 'lead_conversion', trafico: 'traffic', compras: 'conversions' };

/** Los lugares de la campaña en la forma de Zernio (sólo países, provincias y ciudades: los de la zona). */
function lugaresZernio(ls: readonly LugarZona[]): Record<string, unknown> {
  const g: Record<string, unknown[]> = {};
  const push = (k: string, v: unknown) => { (g[k] ??= []).push(v); };
  for (const l of ls) {
    if (l.tipo === 'country') push('countries', l.key.toUpperCase());
    else if (l.tipo === 'region') push('regions', { key: l.key });
    else if (l.tipo === 'city') push('cities', { key: l.key });
  }
  return g;
}

/**
 * El cuerpo de `POST /v1/ads/create` (forma legacy). `creativoReusado`: el creativo del anuncio a reusar, con lo que el
 * servidor leyó de él (su texto y su link: Zernio pide `body` y `linkUrl` en esta forma aunque los ignore con un creativo
 * existente). `hasta`: la fecha que vale (la de la campaña o la del Media Buyer).
 */
export function cuerpoCampana(e: EntradaCampana, x: {
  conexion: { accountId: string; adAccountId: string };
  hasta: string | null;
  creativoReusado?: { id: string; texto: string | null; link: string | null } | null;
}): Record<string, unknown> {
  const boton: string = e.boton ?? (e.objetivo === 'formulario' ? 'SIGN_UP' : e.objetivo === 'compras' ? 'SHOP_NOW' : 'LEARN_MORE');
  const cuerpo: Record<string, unknown> = {
    accountId: x.conexion.accountId, adAccountId: x.conexion.adAccountId,
    name: `${e.nombre} · Anuncio`.slice(0, 255), campaignName: e.nombre, adSetName: `${e.nombre} · Conjunto`.slice(0, 255), adName: `${e.nombre} · Anuncio`.slice(0, 255),
    goal: GOAL[e.objetivo], budgetAmount: e.presupuestoDia, budgetType: 'daily',
    targeting: { ...lugaresZernio(e.lugares), ...(e.edadMin != null ? { ageMin: e.edadMin } : {}), ...(e.edadMax != null ? { ageMax: e.edadMax } : {}) },
    callToAction: boton,
    // En pausa: los tres niveles y también `status` (el único que se midió; los de nivel, según la OpenAPI, ganan cada uno el suyo).
    ...(e.enPausa ? { status: 'PAUSED', campaignStatus: 'PAUSED', adSetStatus: 'PAUSED', adStatus: 'PAUSED' } : { status: 'ACTIVE' }),
  };
  if (x.hasta) cuerpo.endDate = x.hasta;
  if (e.objetivo === 'formulario') cuerpo.leadGenFormId = e.formularioId;
  if (e.pixelId && e.evento) cuerpo.promotedObject = { pixelId: e.pixelId, customEventType: e.evento };
  if (e.url) cuerpo.linkUrl = e.url;
  if (e.creativo.tipo === 'archivo') throw new Error('Un archivo subido se firma antes de armar el cuerpo (campana.ts).');
  if (e.creativo.tipo === 'anuncio') {
    if (!x.creativoReusado) throw new Error('Falta el creativo del anuncio a reusar.');
    cuerpo.existingCreativeId = x.creativoReusado.id;
    cuerpo.body = e.texto || x.creativoReusado.texto || e.nombre;
    if (!cuerpo.linkUrl && x.creativoReusado.link) cuerpo.linkUrl = x.creativoReusado.link;
  } else {
    cuerpo.body = e.texto;
    if (e.creativo.tipo === 'imagen') cuerpo.imageUrl = e.creativo.url;
    else if (e.creativo.tipo === 'video') cuerpo.video = { url: e.creativo.url, ...(e.creativo.miniatura ? { thumbnailUrl: e.creativo.miniatura } : {}) };
    else cuerpo.video = { id: e.creativo.videoId };
  }
  cuerpo.headline = e.titulo ?? e.nombre;
  return cuerpo;
}

/** Lo que lee la persona antes del «sí» (la API y la pantalla): TODO lo que se va a publicar, sin cortar el texto. */
export function resumenCampana(e: EntradaCampana, x: { moneda: string | null; hasta: string | null; fmt: (n: number) => string }): string {
  const lugares = e.lugares.map((l) => l.nombre).join(', ');
  const edades = e.edadMin != null || e.edadMax != null ? ` · ${e.edadMin ?? 18} a ${e.edadMax ?? '65+'} años` : '';
  const creativo = e.creativo.tipo === 'anuncio' ? `reusando el anuncio ${e.creativo.adId}`
    : e.creativo.tipo === 'imagen' || (e.creativo.tipo === 'archivo' && e.creativo.media === 'imagen') ? 'con una imagen' : 'con un video';
  return [
    `Lanzar la campaña «${e.nombre}» (${NOMBRE_OBJETIVO[e.objetivo]}${e.evento && e.objetivo === 'web' ? `, evento ${e.evento}` : ''})`,
    `${x.fmt(e.presupuestoDia)} por día${x.moneda ? ` (${x.moneda})` : ''}`,
    `en ${lugares}${edades}`,
    x.hasta ? `hasta el ${x.hasta.slice(8, 10)}/${x.hasta.slice(5, 7)}/${x.hasta.slice(0, 4)}` : 'sin fecha de fin',
    `${creativo}${e.texto ? `; texto: «${e.texto}»` : ''}${e.titulo ? `; título: «${e.titulo}»` : ''}`,
    e.url ? `lleva a ${e.url}` : null,
    e.enPausa ? 'Nace en pausa: se prende desde el Media Buyer.' : 'Sale prendida: Meta la revisa antes de mostrarla.',
  ].filter(Boolean).join(' · ');
}
