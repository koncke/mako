// =============================================================================
// leads-exportar — qué se lleva un export de leads (catálogo compartido)
// =============================================================================
// Client-safe a propósito (sin 'server-only'): lo usan el modal (para preguntar)
// y la action (para armar el archivo), así no se desincronizan los campos.
// Mismo criterio que el export del plan: número y nombre van SIEMPRE, el resto se
// elige, y lo que casi nadie necesita queda detrás de "Avanzado".

export type AlcanceLeads = 'todos' | 'activos' | 'ganados' | 'nutricion';
export type CampoLead = 'contacto' | 'etapa' | 'montos' | 'reuniones' | 'equipo' | 'origen' | 'fechas' | 'tracking';
export type FormatoLeads = 'csv' | 'md';

export const CAMPOS_LEAD: Array<{ id: CampoLead; label: string; sub: string }> = [
  { id: 'contacto',  label: 'Contacto',            sub: 'email, teléfono y empresa' },
  { id: 'etapa',     label: 'Etapa y estado',      sub: 'en qué parte del funnel está' },
  { id: 'montos',    label: 'Montos',              sub: 'cierre, cobrado y suscripción' },
  { id: 'reuniones', label: 'Reuniones',           sub: 'fechas de R1/R2 y si asistió' },
  { id: 'equipo',    label: 'Closer y Setter',     sub: 'quién agendó y quién cerró' },
  { id: 'origen',    label: 'Origen',              sub: 'campaña, anuncio y UTMs' },
  { id: 'fechas',    label: 'Fechas',              sub: 'creación, agenda y cierre' },
  { id: 'tracking',  label: 'Tracking del VSL',    sub: 'identificador anónimo del visitante' },
];

export const CAMPOS_LEAD_HABITUALES: CampoLead[] = ['contacto', 'etapa', 'montos'];

/** Columnas reales de `leads` por grupo. id y nombre van siempre (no se listan acá). */
export const COLUMNAS_POR_CAMPO: Record<CampoLead, Array<[string, string]>> = {
  contacto:  [['email', 'Email'], ['telefono', 'Teléfono'], ['empresa', 'Empresa']],
  etapa:     [['estado_lead', 'Estado'], ['pipeline_stage', 'Etapa'], ['calificado', 'Calificado']],
  montos:    [['monto_cierre_usd', 'Monto cierre USD'], ['total_cobrado_usd', 'Cobrado USD'], ['venta_tipo', 'Tipo de venta'], ['suscripcion_monto_usd', 'Suscripción USD/mes'], ['suscripcion_meses', 'Meses de suscripción']],
  reuniones: [['fecha_junta_1', 'Fecha R1'], ['asistio_j1', 'Asistió R1'], ['fecha_junta_2', 'Fecha R2'], ['asistio_j2', 'Asistió R2']],
  equipo:    [['closer', 'Closer'], ['setter', 'Setter']],
  origen:    [['origen_lead', 'Origen'], ['meta_campaign_name', 'Campaña'], ['meta_ad_name', 'Anuncio'], ['utm_campaign', 'UTM campaña'], ['utm_content', 'UTM contenido']],
  fechas:    [['created_at', 'Creado'], ['fecha_agenda', 'Fecha agenda'], ['fecha_cierre', 'Fecha cierre']],
  tracking:  [['visitor_id', 'Visitor ID']],
};

export const ALCANCES: Array<{ id: AlcanceLeads; label: string; sub: string }> = [
  { id: 'todos',     label: 'Todos los leads',   sub: 'la base completa' },
  { id: 'activos',   label: 'Solo los activos',  sub: 'los que están en el pipeline, sin cerrar ni descartar' },
  { id: 'ganados',   label: 'Solo los ganados',  sub: 'clientes cerrados' },
  { id: 'nutricion', label: 'Solo en nutrición', sub: 'los que quedaron para recontactar' },
];
