// =============================================================================
// campaign-types — contrato compartido del creador de campañas ("Nueva campaña")
// =============================================================================
// Tipos PUROS (sin side-effects, sin 'server-only'): los importan TANTO el
// modal cliente (NuevaCampanaModal) COMO los route handlers y los lib del
// servidor. MaKo produce un CampaignSpec, el usuario lo edita, y campaign-create
// lo publica en Meta (siempre en PAUSA). Presupuestos en MXN (como Meta).
// =============================================================================

// ── Objetivo de campaña (enum OUTCOME_* de Meta) ──────────────────────────────
export type Objective =
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_AWARENESS';

// Default sano por objetivo: meta de optimización, evento de cobro y de dónde
// sale el promoted_object. MaKo puede sobreescribir optimization_goal en el spec.
//   promoted: 'page'  → promoted_object {page_id}   (formularios instantáneos)
//             'pixel' → promoted_object {pixel_id, custom_event_type}
//             'none'  → sin promoted_object (tráfico/alcance)
export type PromotedKind = 'page' | 'pixel' | 'none';
export const OBJETIVOS: Array<{
  value: Objective;
  label: string;
  optimization_goal: string;
  billing_event: string;
  promoted: PromotedKind;
  custom_event_type?: string;
  hint: string;
}> = [
  { value: 'OUTCOME_LEADS', label: 'Leads (formulario / web)', optimization_goal: 'LEAD_GENERATION', billing_event: 'IMPRESSIONS', promoted: 'page', hint: 'Genera prospectos: formulario instantáneo (página) o conversión de lead en la web (pixel).' },
  { value: 'OUTCOME_SALES', label: 'Ventas (conversión web)', optimization_goal: 'OFFSITE_CONVERSIONS', billing_event: 'IMPRESSIONS', promoted: 'pixel', custom_event_type: 'PURCHASE', hint: 'Optimiza por compras/registros medidos con el pixel en la landing.' },
  { value: 'OUTCOME_TRAFFIC', label: 'Tráfico a la landing/VSL', optimization_goal: 'LANDING_PAGE_VIEWS', billing_event: 'IMPRESSIONS', promoted: 'none', hint: 'Manda gente a ver el VSL / la landing (vistas de página de destino).' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Interacción / mensajes', optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS', promoted: 'none', hint: 'Clics e interacción con el anuncio.' },
  { value: 'OUTCOME_AWARENESS', label: 'Reconocimiento / alcance', optimization_goal: 'REACH', billing_event: 'IMPRESSIONS', promoted: 'none', hint: 'Máximo alcance al menor costo por mil.' },
];

export function objetivoDef(o: Objective) {
  return OBJETIVOS.find((x) => x.value === o) ?? OBJETIVOS[0];
}

// ── Presupuesto: CBO (campaña) vs ABO (conjunto) ──────────────────────────────
export type BudgetLevel = 'campaign' | 'adset';

// ── Segmentación (todo editable; MaKo sugiere el arranque) ────────────────────
// Las claves son las de Meta, tal cual (lib/meta-geo.ts tiene la tabla medida).
export type GeoKey = { key: string; name?: string };
export type GeoLocations = {
  countries?: string[]; // ISO-2 (ej. "MX", "US")
  regions?: GeoKey[]; // provincia / estado
  cities?: Array<{ key: string; name?: string; radius?: number; distance_unit?: 'mile' | 'kilometer' }>; // sin radio = solo la ciudad
  zips?: GeoKey[]; // "AR:C1425"
  neighborhoods?: GeoKey[]; // barrio
  subcities?: GeoKey[]; // localidad
  medium_geo_areas?: GeoKey[]; // partido / municipio
  geo_markets?: GeoKey[]; // DMA (EE.UU.)
  custom_locations?: Array<{ address_string?: string; latitude?: number; longitude?: number; radius: number; distance_unit: 'mile' | 'kilometer'; name?: string }>;
};

export type InterestSpec = { id: string; name: string };
export type AudienceRef = { id: string; name?: string };

export type Targeting = {
  geo_locations?: GeoLocations;
  excluded_geo_locations?: GeoLocations;
  age_min?: number; // 13..65
  age_max?: number; // 13..65 (65 = 65+)
  genders?: number[]; // [1]=hombres, [2]=mujeres; vacío/omitido = todos
  flexible_spec?: Array<{ interests?: InterestSpec[] }>; // intereses (OR dentro, AND entre grupos)
  custom_audiences?: AudienceRef[]; // retargeting / públicos a INCLUIR
  excluded_custom_audiences?: AudienceRef[]; // públicos a EXCLUIR
  publisher_platforms?: string[]; // facebook, instagram, audience_network, messenger
  facebook_positions?: string[];
  instagram_positions?: string[];
  locales?: number[];
  // Advantage+ Audience (público amplio en el que Meta optimiza). 1 = activado.
  advantage_audience?: 0 | 1;
};

export const GENEROS: Array<{ value: string; label: string; genders: number[] }> = [
  { value: 'all', label: 'Todos', genders: [] },
  { value: 'h', label: 'Hombres', genders: [1] },
  { value: 'm', label: 'Mujeres', genders: [2] },
];

export const PLACEMENTS: Array<{ value: string; label: string }> = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'audience_network', label: 'Audience Network' },
  { value: 'messenger', label: 'Messenger' },
];

// ── Creativo (subido nuevo o reutilizado de un ganador) ───────────────────────
export type CTAType =
  | 'LEARN_MORE' | 'SIGN_UP' | 'SUBSCRIBE' | 'GET_OFFER' | 'BOOK_TRAVEL'
  | 'CONTACT_US' | 'APPLY_NOW' | 'DOWNLOAD' | 'GET_QUOTE' | 'SEE_MORE'
  | 'WATCH_MORE' | 'SHOP_NOW' | 'MESSAGE_PAGE' | 'WHATSAPP_MESSAGE' | 'NO_BUTTON';

export const CTA_OPCIONES: Array<{ value: CTAType; label: string }> = [
  { value: 'LEARN_MORE', label: 'Más información' },
  { value: 'SIGN_UP', label: 'Registrarte' },
  { value: 'SUBSCRIBE', label: 'Suscribirte' },
  { value: 'GET_OFFER', label: 'Ver oferta' },
  { value: 'APPLY_NOW', label: 'Postularte' },
  { value: 'CONTACT_US', label: 'Contactarnos' },
  { value: 'DOWNLOAD', label: 'Descargar' },
  { value: 'GET_QUOTE', label: 'Pedir cotización' },
  { value: 'SEE_MORE', label: 'Ver más' },
  { value: 'WATCH_MORE', label: 'Ver más (video)' },
  { value: 'SHOP_NOW', label: 'Comprar ahora' },
  { value: 'MESSAGE_PAGE', label: 'Enviar mensaje' },
  { value: 'WHATSAPP_MESSAGE', label: 'Enviar WhatsApp' },
  { value: 'NO_BUTTON', label: 'Sin botón' },
];

export type CreativeSource = 'upload' | 'existing';

export type Creative = {
  source: CreativeSource;
  // source === 'upload': se resuelve con /api/ads-manager/creative-upload
  media_type?: 'image' | 'video';
  image_hash?: string | null; // de act_<id>/adimages
  video_id?: string | null; // de act_<id>/advideos
  thumbnail_url?: string | null; // para la previa (video o imagen subida)
  filename?: string | null;
  // source === 'existing': reusar el creativo de un anuncio ganador (su post)
  source_ad_id?: string | null;
  source_ad_name?: string | null;
  // Copy del anuncio (para upload; en 'existing' opcional para override)
  primary_text?: string; // object_story_spec … message
  headline?: string; // título
  description?: string;
  cta_type?: CTAType;
  destination_url?: string; // landing / VSL (link_data.link y value.link del CTA)
  // Formulario instantáneo (lead ad): id de un formulario YA existente en la página
  lead_form_id?: string | null;
  lead_form_name?: string | null;
};

export type AdSpec = {
  name: string;
  creative: Creative;
};

export type AdSetSpec = {
  name: string;
  daily_budget_mxn?: number | null; // ABO: presupuesto del conjunto
  optimization_goal: string; // LEAD_GENERATION / OFFSITE_CONVERSIONS / LANDING_PAGE_VIEWS …
  billing_event: string; // normalmente IMPRESSIONS
  bid_strategy?: string; // LOWEST_COST_WITHOUT_CAP por defecto
  targeting: Targeting;
  ads: AdSpec[];
  // Para OFFSITE_CONVERSIONS: por qué conversión optimizar. pixel_event = evento
  // estándar del pixel (Lead, Schedule, Purchase…); custom_conversion_id = una
  // conversión personalizada de la cuenta (ej. "Programaciones"/agenda).
  conversion?: { pixel_event?: string; custom_conversion_id?: string; pixel_id?: string };
};

export type CampaignSpec = {
  name: string;
  objective: Objective;
  special_ad_categories: string[]; // [] salvo categorías especiales (vivienda/empleo/crédito/política)
  budget_level: BudgetLevel; // CBO (campaña) vs ABO (conjunto)
  daily_budget_mxn?: number | null; // CBO: presupuesto de campaña
  adsets: AdSetSpec[];
  rationale?: string; // explicación de MaKo (NO se manda a Meta)
  /**
   * Con qué página de Facebook e Instagram sale (lib/meta-identidad.ts). Sólo viaja si
   * la conexión tiene más de una opción y la persona eligió; sin esto, la página de la
   * credencial, como siempre. `instagramId: null` = sólo Facebook.
   */
  identidad?: { pageId: string; instagramId: string | null } | null;
};

// Resultado de subir un creativo (lo devuelve /api/ads-manager/creative-upload).
export type UploadResult = {
  media_type: 'image' | 'video';
  image_hash?: string | null;
  video_id?: string | null;
  thumbnail_url?: string | null;
  width?: number | null;
  height?: number | null;
  filename?: string | null;
  /**
   * Sólo video: true mientras Meta lo procesa, y el creativo NO se puede usar todavía.
   * La ruta lo devolvía desde siempre y el cliente lo descartaba (tarea #59): por eso un
   * video sin procesar entraba a la bandeja como listo. Ver app/ads-manager/creativeUpload.ts.
   */
  processing?: boolean;
  video_status?: 'ready' | 'processing' | 'error';
};
