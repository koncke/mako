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

/** Lo que el cruce necesita de cada lead. */
export type LeadAtribuible = {
  id: number;
  funnel_id: number | null;
  meta_campaign_id?: string | null;
  adset_id_origen?: string | null;
  meta_ad_id?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
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
 * Qué leads hay que MOVER al asignar una campaña o un conjunto a un producto.
 *
 * Son los de esa campaña (o conjunto) que todavía no están en el destino, MENOS los que
 * la regla de ruteo mandaría a otro lado: si la campaña va a A pero uno de sus conjuntos
 * está asignado a B, los leads de ese conjunto son de B. Es la misma precedencia que usa
 * `funnelIdDeCampana` para los que entran (conjunto > campaña), así que traer lo viejo y
 * rutear lo nuevo no se pueden contradecir: un lead histórico termina donde terminaría si
 * entrara hoy.
 *
 * ⚠️ El destino va con `null` = el producto del negocio, que es como lo escribe el CRM
 * (`leads.funnel_id IS NULL`). Comparar contra el id numérico del principal daría «todos
 * hay que moverlos» sobre leads que ya están ahí.
 */
export function leadsATraer(
  item: { tipo: 'campana' | 'conjunto'; id: string },
  destino: number | null,
  leads: LeadAtribuible[],
  anuncios: Map<string, Anuncio>,
  /** Los conjuntos asignados a OTRO producto que no es el destino. */
  conjuntosDeOtro: ReadonlySet<string> = new Set(),
): LeadAtribuible[] {
  return leadsDe(item, leads, anuncios).filter((l) => {
    if ((l.funnel_id ?? null) === destino) return false;
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
): Map<string, LeadAtribuible[]> {
  const vistos = new Set<number>();
  const out = new Map<string, LeadAtribuible[]>();
  for (const item of items) {
    const suyos = leadsATraer(item, destino, leads, anuncios, conjuntosDeOtro).filter((l) => !vistos.has(l.id));
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
