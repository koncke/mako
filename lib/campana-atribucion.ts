// =============================================================================
// campana-atribucion — de QUÉ campaña y conjunto vino un lead que ya existe
// =============================================================================
// Pedido de Martín (05/10/2026): «si selecciono una campaña, me traiga todos los
// leads. No solo los futuros. Por ejemplo, si yo estoy creando un nuevo producto, pero
// tengo una campaña que lleva tiempo, si la selecciono debería traerme esos leads».
//
// El problema es que `leads.meta_campaign_id` se empezó a escribir ese mismo día (mig
// 0193): lo viejo no lo tiene. Se reconstruye con datos EXACTOS que ya estaban, medido
// sobre producción antes de escribir esto:
//
//   · `utm_campaign` de la landing, cuando es un id (en la landing ES el id de la
//     campaña: 35 de 35 en un cliente, 72 de 119 en otro);
//   · el ANUNCIO —`meta_ad_id` del formulario, `utm_content` de la landing— cruzado con
//     `marketing_metrics_daily`, que tiene `ad_id`, `adset_id` y `campaign_id` en la misma
//     fila desde la 0009.
//
// Con eso, 1.105 de los 1.148 leads de Meta del cliente más grande tienen su campaña
// (96%), 277 de 299 en otro, 36 de 36 en un tercero. Y el NOMBRE de la campaña no agrega
// NINGUNO: todo lead que sólo tenía el nombre ya salía por otro lado. Por eso no se
// matchea por nombre — un nombre no es una clave (se renombra, se repite), y acá no hacía
// falta pagar ese riesgo.
//
// Sin `server-only`: es la parte que se puede equivocar (qué dato le gana a cuál), y
// tiene que poder testearse sin base.
// =============================================================================

import { esIdMeta } from './campana-config';
import { adIdDeLead } from './atribucion-url';

/** Lo que el cruce necesita de cada lead. */
export type LeadAtribuible = {
  id: number;
  funnel_id?: number | null;
  meta_campaign_id?: string | null;
  adset_id_origen?: string | null;
  meta_ad_id?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  /** Los nombres que Graph escribió al ingestar. Sólo para MOSTRAR: nunca deciden de qué
   *  campaña es un lead (ver la cabecera). */
  meta_campaign_name?: string | null;
  meta_ad_name?: string | null;
};

/** Una fila de `marketing_metrics_daily`. */
export type FilaAnuncio = { ad_id: string | null; campaign_id: string | null; adset_id: string | null };

export type Anuncio = { campaignId: string | null; adsetId: string | null };

/** El mapa anuncio → campaña y conjunto. Las métricas tienen una fila por anuncio POR DÍA:
 *  se colapsan, y si dos filas del mismo anuncio dicen algo distinto gana la primera que
 *  traiga el dato (no pasa: un anuncio no cambia de campaña). */
export function mapaDeAnuncios(filas: FilaAnuncio[]): Map<string, Anuncio> {
  const m = new Map<string, Anuncio>();
  for (const f of filas) {
    const ad = f.ad_id?.trim();
    if (!esIdMeta(ad)) continue;
    const prev = m.get(ad);
    const campaignId = esIdMeta(f.campaign_id) ? f.campaign_id.trim() : null;
    const adsetId = esIdMeta(f.adset_id) ? f.adset_id.trim() : null;
    m.set(ad, {
      campaignId: prev?.campaignId ?? campaignId,
      adsetId: prev?.adsetId ?? adsetId,
    });
  }
  return m;
}

/**
 * La campaña y el conjunto de un lead.
 *
 * ⚠️ EL ORDEN ES DEL DATO MÁS DIRECTO AL MÁS INDIRECTO, y es la única decisión de acá:
 *   1. lo que escribió Graph al ingestar (`meta_campaign_id`, `adset_id_origen`);
 *   2. el anuncio del formulario (`meta_ad_id`) en las métricas;
 *   3. el `utm_campaign` de la landing, si es un id;
 *   4. el anuncio de la landing (`utm_content`) en las métricas.
 * Un `utm_campaign` con NOMBRE no cuenta nunca (ver la cabecera).
 */
export function campanaDeLead(l: LeadAtribuible, anuncios: Map<string, Anuncio>): Anuncio {
  const porAd = (v: string | null | undefined) => (esIdMeta(v) ? anuncios.get(v.trim()) : undefined);
  const form = porAd(l.meta_ad_id);
  const landing = porAd(l.utm_content);
  const utm = esIdMeta(l.utm_campaign) ? l.utm_campaign.trim() : null;
  return {
    campaignId: (esIdMeta(l.meta_campaign_id) ? l.meta_campaign_id.trim() : null)
      ?? form?.campaignId ?? utm ?? landing?.campaignId ?? null,
    adsetId: (esIdMeta(l.adset_id_origen) ? l.adset_id_origen.trim() : null)
      ?? form?.adsetId ?? landing?.adsetId ?? null,
  };
}

/** Los leads de una campaña o de un conjunto. */
export function leadsDe(
  item: { tipo: 'campana' | 'conjunto'; id: string },
  leads: LeadAtribuible[],
  anuncios: Map<string, Anuncio>,
): LeadAtribuible[] {
  return leads.filter((l) => {
    const a = campanaDeLead(l, anuncios);
    return item.tipo === 'conjunto' ? a.adsetId === item.id : a.campaignId === item.id;
  });
}

/** Cuántos leads tiene cada campaña y cada conjunto, en UNA pasada (para la tabla). */
export function conteoPorCampana(leads: LeadAtribuible[], anuncios: Map<string, Anuncio>): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of leads) {
    const a = campanaDeLead(l, anuncios);
    if (a.campaignId) out.set(a.campaignId, (out.get(a.campaignId) ?? 0) + 1);
    if (a.adsetId) out.set(a.adsetId, (out.get(a.adsetId) ?? 0) + 1);
  }
  return out;
}

/**
 * Qué leads hay que AGREGAR al destino al asignar una campaña o un conjunto a un producto.
 *
 * ⚠️ AGREGAR, NO MOVER (06/10/2026). Hasta ese día esto decía «mover», y traer los leads
 * de una campaña los SACABA del producto donde estaban — del principal de Mauricio, en el
 * caso que lo destapó. Martín: «No se debe "Mover" se debe agregar al otro producto». Desde
 * la mig 0207 un lead puede estar en varios productos: su CASA (`leads.funnel_id`) no se
 * toca y el destino gana una fila de `lead_funnel` (lib/lead-funnel.ts).
 *
 * Son los de esa campaña (o conjunto) que todavía no están en el destino —ni por casa ni
 * por fila—, MENOS los que la regla de ruteo mandaría a otro lado: si la campaña va a A
 * pero uno de sus conjuntos está asignado a B, los leads de ese conjunto son de B. Es la
 * misma precedencia que usa `funnelIdDeCampana` para los que entran (conjunto > campaña),
 * así que traer lo viejo y rutear lo nuevo no se pueden contradecir.
 *
 * ⚠️ El destino va con `null` = el producto del negocio, que es como lo escribe el CRM
 * (`leads.funnel_id IS NULL`). Comparar contra el id numérico del principal daría «todos
 * hay que agregarlos» sobre leads que ya están ahí. `enDestino`, en cambio, son ids de
 * LEADS (los que tienen fila en el destino), así que no tiene esa trampa.
 */
export function leadsATraer(
  item: { tipo: 'campana' | 'conjunto'; id: string },
  destino: number | null,
  leads: LeadAtribuible[],
  anuncios: Map<string, Anuncio>,
  /** Los conjuntos asignados a OTRO producto que no es el destino. */
  conjuntosDeOtro: ReadonlySet<string> = new Set(),
  /** Los leads que YA están en el destino por una fila de `lead_funnel` (no por su casa). */
  enDestino: ReadonlySet<number> = new Set(),
): LeadAtribuible[] {
  return leadsDe(item, leads, anuncios).filter((l) => {
    if ((l.funnel_id ?? null) === destino) return false;   // ya es su casa
    if (enDestino.has(l.id)) return false;                  // ya está agregado
    if (item.tipo === 'campana') {
      const adset = campanaDeLead(l, anuncios).adsetId;
      if (adset && conjuntosDeOtro.has(adset)) return false;
    }
    return true;
  });
}

/**
 * El plan de un LOTE: qué leads trae cada campaña o conjunto, con cada lead en UN solo
 * grupo.
 *
 * ⚠️ Elegir una campaña y uno de sus conjuntos juntos hace que el mismo lead salga en los
 * dos; contado dos veces, la pregunta diría «Traer 20» sobre 10 personas y el historial le
 * pondría dos renglones. Gana el primero que lo reclama, y su nombre es el que queda en el
 * historial de ese lead.
 */
export function repartirPorItem(
  items: { tipo: 'campana' | 'conjunto'; id: string }[],
  destino: number | null,
  leads: LeadAtribuible[],
  anuncios: Map<string, Anuncio>,
  conjuntosDeOtro: ReadonlySet<string> = new Set(),
  enDestino: ReadonlySet<number> = new Set(),
): Map<string, LeadAtribuible[]> {
  const vistos = new Set<number>();
  const out = new Map<string, LeadAtribuible[]>();
  for (const item of items) {
    const suyos = leadsATraer(item, destino, leads, anuncios, conjuntosDeOtro, enDestino).filter((l) => !vistos.has(l.id));
    for (const l of suyos) vistos.add(l.id);
    out.set(item.id, suyos);
  }
  return out;
}

/** Una fila de `marketing_metrics_daily` con los nombres. */
export type FilaConNombre = FilaAnuncio & { campaign_name: string | null; adset_name: string | null };

/**
 * Las campañas y los conjuntos que conocen las MÉTRICAS, con su nombre.
 *
 * ⚠️ POR QUÉ, Y NO ES UN RESPALDO DE ADORNO: la lista de Meta trae lo que la cuenta tiene
 * HOY. Una campaña que se borró —o una cuenta que se desconectó— no aparece, y sus leads
 * siguen en el CRM: «si yo estoy creando un nuevo producto, pero tengo una campaña que
 * lleva tiempo, si la selecciono debería traerme esos leads» (Martín, 05/10/2026). Las
 * métricas guardan el nombre de toda campaña que tuvo un día de datos, así que con esto la
 * tabla puede ofrecerla aunque Meta ya no la nombre — o aunque Meta no conteste.
 */
export function campanasDeMetricas(filas: FilaConNombre[]): {
  campanas: { id: string; nombre: string }[];
  conjuntos: { id: string; nombre: string; campanaId: string }[];
} {
  const camp = new Map<string, string>();
  const conj = new Map<string, { nombre: string; campanaId: string }>();
  for (const f of filas) {
    const c = esIdMeta(f.campaign_id) ? f.campaign_id.trim() : null;
    const s = esIdMeta(f.adset_id) ? f.adset_id.trim() : null;
    if (c && !camp.get(c)) camp.set(c, (f.campaign_name ?? '').trim());
    if (c && s && !conj.get(s)?.nombre) conj.set(s, { nombre: (f.adset_name ?? '').trim(), campanaId: c });
  }
  return {
    campanas: [...camp].map(([id, nombre]) => ({ id, nombre })),
    conjuntos: [...conj].map(([id, v]) => ({ id, ...v })),
  };
}

/** De qué campaña y de qué creativo (anuncio) vino un lead, para el filtro del CRM. */
export type OrigenAds = {
  /** La clave del filtro: el id de la campaña, o `n:<nombre>` si sólo se sabe el nombre. */
  campanaKey: string | null;
  campanaNombre: string | null;
  anuncioKey: string | null;
  anuncioNombre: string | null;
};

/**
 * La campaña y el creativo de un lead, con su nombre, para filtrar el CRM.
 *
 * Pedido de Martín (06/10/2026): «en el CRM pon un filtro por creativo o por campaña, para
 * ver de qué ads vinieron los leads».
 *
 * ⚠️ LA CLAVE ES EL ID, Y EL NOMBRE SÓLO SE MUESTRA. La campaña sale de `campanaDeLead`
 * (lo que decide el producto de un lead, con su orden de datos), y el anuncio de
 * `adIdDeLead`, el mismo que arma el deep-link de la ficha. Filtrar por NOMBRE juntaría dos
 * campañas que se llaman igual y partiría en dos una que se renombró; con el id, una
 * campaña renombrada sigue siendo una fila del filtro, con su nombre de hoy (`campMap`).
 * Sólo cuando no hay id y sí un nombre —un lead viejo con el nombre denormalizado— la clave
 * es `n:<nombre>`, para no tirarlo a «Sin campaña» habiendo un dato.
 */
export function origenAds(
  l: LeadAtribuible,
  anuncios: Map<string, Anuncio>,
  campMap: Record<string, string>,
  adMap: Record<string, string>,
): OrigenAds {
  const limpio = (v: string | null | undefined) => (v ?? '').trim() || null;
  const campId = campanaDeLead(l, anuncios).campaignId;
  const campNombreGuardado = limpio(l.meta_campaign_name)
    ?? (limpio(l.utm_campaign) && !esIdMeta(l.utm_campaign) ? limpio(l.utm_campaign) : null);
  const adId = adIdDeLead(l.meta_ad_id ?? null, l.utm_content ?? null, adMap);
  const adNombreGuardado = limpio(l.meta_ad_name);
  return {
    campanaKey: campId ?? (campNombreGuardado ? `n:${campNombreGuardado}` : null),
    campanaNombre: campId ? (campMap[campId] ?? campNombreGuardado ?? `Campaña ${campId}`) : campNombreGuardado,
    anuncioKey: adId ?? (adNombreGuardado ? `n:${adNombreGuardado}` : null),
    anuncioNombre: adId ? (adMap[adId] ?? adNombreGuardado ?? `Anuncio ${adId}`) : adNombreGuardado,
  };
}

/** Las opciones de un filtro: una por clave, con su nombre y cuántos leads tiene, de la
 *  que más tiene a la que menos. `null` va al final como «Sin …», y sólo si hay. */
export function opcionesDeFiltro(
  pares: { key: string | null; nombre: string | null }[],
  sinRotulo: string,
): { value: string; label: string; n: number }[] {
  const m = new Map<string, { label: string; n: number }>();
  let sin = 0;
  for (const p of pares) {
    if (!p.key) { sin += 1; continue; }
    const prev = m.get(p.key);
    m.set(p.key, { label: prev?.label ?? (p.nombre || p.key), n: (prev?.n ?? 0) + 1 });
  }
  const out = [...m].map(([value, v]) => ({ value, ...v })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'es'));
  if (sin) out.push({ value: SIN_ORIGEN_ADS, label: sinRotulo, n: sin });
  return out;
}

/** La clave de «Sin campaña» / «Sin creativo». No es un id de Meta ni empieza con `n:`. */
export const SIN_ORIGEN_ADS = '__sin';
