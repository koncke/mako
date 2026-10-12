// =============================================================================
// origen-lead — DE DÓNDE VINO el lead, enumerado en UN solo lugar
// =============================================================================
// Client-safe (sin 'server-only'): lo importan las cuatro altas del server, los
// dos lectores de la lista (crm-map) y la ficha. Si los valores se escribieran en
// cada call site, la cuarta alta inventaría 'manual' donde las otras tres pusieron
// 'carga_manual' y los cuatro caminos quedarían siendo tres canales distintos para
// la misma cosa, sin que nada falle: la columna es texto libre.
//
// ⚠️ LA COLUMNA NACIÓ SIENDO UN TACHO. `createLead` acepta `origen_lead` desde
// siempre y lo deja NULL, y ninguna de las cuatro altas se lo pasaba: alta a mano,
// alta desde el chat de WhatsApp, importación y el alta de un cliente en Customer
// Success. Lo tenía anotado el propio repo (lib/pipeline.ts: «origen_lead = NULL es
// un tacho (alta a mano, import, lead creado desde el inbox), no una señal»).
// Medido el 03/10/2026: 70 leads con la columna en NULL, 43 de ellos la lista en
// frío de una clienta — o sea indistinguibles de alguien que llenó un formulario.
// Eso es lo que esta tabla viene a cerrar: cada alta ESTAMPA de dónde vino.
//
// ⚠️ Y NO ES EL MISMO EJE QUE `ENTRADAS` (lib/pipeline.ts), que enumera por dónde
// CAPTA leads un negocio y que a propósito NO tiene `carga_manual` («una entrada se
// afirma con evidencia positiva, nunca por descarte»). Ese eje lo declara el cliente
// y describe su funnel; éste es la procedencia de UNA fila y lo escribe el código en
// el momento del alta. Son dos preguntas y por eso son dos catálogos: mezclarlas
// haría que cargar un contacto a mano le agregue un canal de captación al negocio.
// =============================================================================

/** Todo lo que la columna `leads.origen_lead` puede tener. Nada más entra. */
export type OrigenLeadId =
  // Los cuatro que ya se escribían antes del 03/10/2026, cada uno desde su camino:
  | 'instant_form'   // lib/leads.ts (ingesta de Meta)
  | 'landing'        // app/api/track/optin/route.ts (el formulario de la landing)
  | 'calendly'       // lib/leads.ts (reserva de Calendly)
  | 'calcom'         // app/api/webhooks/calcom/route.ts
  // Los tres que faltaban, uno por alta que no estampaba nada:
  | 'carga_manual'   // alguien lo tipeó: /crm/new, el modal del tablero, Customer Success
  | 'importacion'    // entró en un archivo (la lista en frío)
  | 'chat_whatsapp'  // se creó desde una conversación del inbox
  // Los dos de Zernio (sexta tanda, 09/10/2026): `crearLeadDe` (lib/zernio-entrante.ts) escribe
  // `origen_lead: e.canal`, el canal del evento. Hasta la duodécima tanda (12/10/2026) el catálogo no los
  // conocía, y la tarjeta y el filtro decían «Sin origen» de un lead que llegó por Instagram.
  | 'instagram'      // escribió, comentó o tocó un link de Instagram
  | 'messenger'      // lo mismo por Messenger (la página de Facebook)
  // ⚠️ Y EL OCTAVO, que no es un canal de venta: lo crea la PRUEBA del Pixel
  // (app/integraciones/prueba-lead-actions.ts) para que la grabación de esa
  // prueba se pueda ver en el único lugar donde existe el reproductor, que es la
  // ficha de un lead. Es un origen propio y no `landing` porque nadie llenó un
  // formulario: poner `landing` sería meter una fila inventada entre los leads
  // reales de ese producto, y es justo el tacho que este catálogo vino a cerrar.
  | 'prueba';        // la creó la prueba del Pixel, para poder ver su grabación

export type OrigenLeadDef = {
  id: OrigenLeadId;
  /**
   * El rótulo para una FILA: la tarjeta del tablero, el filtro de origen y el
   * export. Corto a propósito — en la tarjeta es una línea `nowrap` con elipsis, y
   * el filtro arma sus opciones con este mismo string.
   *
   * La ficha usa otro, más largo, porque ahí hay lugar para una frase
   * (`labelOrigen` en lead-view/OrigenCard.tsx). No es la misma cadena repetida:
   * son dos superficies con dos techos distintos, y el guard de
   * tests/crm-origen-lead.test.ts exige que las dos cubran los mismos ids.
   */
  lista: string;
};

export const ORIGEN_LEAD: Record<OrigenLeadId, OrigenLeadDef> = {
  instant_form: { id: 'instant_form', lista: 'Meta · Instant Form' },
  landing: { id: 'landing', lista: 'Landing' },
  calendly: { id: 'calendly', lista: 'Calendly' },
  calcom: { id: 'calcom', lista: 'Cal.com' },
  carga_manual: { id: 'carga_manual', lista: 'Cargado a mano' },
  importacion: { id: 'importacion', lista: 'Importado' },
  chat_whatsapp: { id: 'chat_whatsapp', lista: 'WhatsApp' },
  instagram: { id: 'instagram', lista: 'Instagram' },
  messenger: { id: 'messenger', lista: 'Messenger' },
  prueba: { id: 'prueba', lista: 'Prueba del Pixel' },
};

/**
 * Lo que se dibuja cuando la columna está en NULL.
 *
 * ⚠️ NO dice «Directo» ni «Orgánico», que es lo que decía antes: eso AFIRMA que la
 * persona llegó sola, y de un NULL no se sabe nada — son los leads que entraron por
 * las cuatro altas mudas, más todo lo cargado antes de que existiera el tracking.
 * Un default que afirma un hecho del negocio es una afirmación, no un fallback.
 */
export const SIN_ORIGEN_LISTA = 'Sin origen';

/** El rótulo de fila de un `origen_lead` crudo, venga lo que venga en la columna. */
export function origenLista(origen: string | null | undefined): string {
  const id = (origen ?? '').trim();
  if (!id) return SIN_ORIGEN_LISTA;
  // Un valor que no está en el catálogo NO se dibuja crudo: `carga_manual` en una
  // tarjeta es el nombre interno de la cosa, no el nombre de la cosa. Antes el
  // export hacía `return o ?? 'Directo / orgánico'`, así que el id se le escapaba
  // a la pantalla en cuanto alguien escribiera un valor nuevo.
  return (ORIGEN_LEAD as Record<string, OrigenLeadDef | undefined>)[id]?.lista ?? SIN_ORIGEN_LISTA;
}

/**
 * POR DÓNDE ENTRÓ el lead: landing, Cal.com, formulario de Meta, importado… Es lo que lista
 * el filtro «Origen» del tablero.
 *
 * ⚠️ NO ES `origenLegible` (crm-map.ts). Ésa contesta lo más específico que se sepa —el
 * nombre del anuncio, si no el de la campaña, y recién al final el canal— y está bien para
 * la TARJETA. Pero desde que existen los filtros «Campaña» y «Anuncio» (06/10), usarla para
 * el filtro de origen repetía la lista de campañas: «en campaña, y en Origen, aparece lo
 * mismo» (Martín, 10/10/2026). Medido en Código Inmobiliario: los 44 leads de anuncios
 * caían en el origen con el nombre de su campaña, y el canal real —`origen_lead`, 45
 * «landing» y 5 «calcom»— no aparecía en ningún lado del filtro.
 *
 * Vive acá y no en crm-map.ts porque ése importa `lib/queries` y no se puede cargar en un
 * test; este módulo es puro.
 */
export function canalDeLead(lead: { origen_lead?: string | null; meta_lead_id?: string | null }): string {
  if (lead.origen_lead?.trim()) return origenLista(lead.origen_lead);
  // Un lead del formulario de Meta viejo puede no tener la columna: el id del lead de Meta
  // dice por dónde entró aunque nadie haya estampado el canal.
  if (lead.meta_lead_id) return origenLista('instant_form');
  return SIN_ORIGEN_LISTA;
}
