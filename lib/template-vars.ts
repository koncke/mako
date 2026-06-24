// =============================================================================
// Variables de plantilla derivadas del lead + referencias a las reglas de Meta
// =============================================================================
// Catálogo de variables {{...}} que se pueden usar en una plantilla y que la app
// rellena con los datos del lead al enviar. Es puro (sin server-only) → lo usan
// tanto la UI (dropdown de insertar variable) como el motor de envío.
// =============================================================================

export type VarLead = { key: string; label: string; ejemplo: string; descripcion: string };

// Orden = orden en el dropdown. nombre = SOLO el primer nombre; nombre_completo =
// nombre y apellido; apellido = el resto. (Distinción pedida para no saludar con
// el nombre completo cuando solo querés el nombre.)
export const VARIABLES_LEAD: VarLead[] = [
  { key: 'nombre', label: 'Nombre', ejemplo: 'Luis', descripcion: 'Solo el primer nombre del lead' },
  { key: 'nombre_completo', label: 'Nombre completo', ejemplo: 'Luis Pérez', descripcion: 'Nombre y apellido' },
  { key: 'apellido', label: 'Apellido', ejemplo: 'Pérez', descripcion: 'Apellido(s) del lead' },
  { key: 'empresa', label: 'Empresa', ejemplo: 'Acme', descripcion: 'Empresa del lead (si la tenemos)' },
];

const KEYS = new Set(VARIABLES_LEAD.map((v) => v.key));
export const esVariableConocida = (k: string): boolean => KEYS.has(k);

// Rellena TODAS las variables del catálogo a partir del lead. El template usa las
// que necesite; las demás se ignoran. nombre = 1er token, apellido = el resto.
export function valoresVariablesLead(lead: { nombre?: string | null; empresa?: string | null }): Record<string, string> {
  const full = (lead.nombre ?? '').trim().replace(/\s+/g, ' ');
  const parts = full ? full.split(' ') : [];
  const nombre = parts[0] ?? '';
  const apellido = parts.slice(1).join(' ');
  return {
    nombre,
    nombre_completo: full,
    apellido,
    empresa: (lead.empresa ?? '').trim(),
  };
}

// ── Referencias a la doc de Meta por código de regla (para mostrar al validar) ──
const VARS_URL = 'https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates';
const CAT_URL = 'https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/';
const POLICY_URL = 'https://business.whatsapp.com/policy';
const AUTH_URL = 'https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/template-components';
const COMP_URL = 'https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/template-components';

export type ReglaRef = { titulo: string; url: string };
const REF_POR_CODIGO: Record<string, ReglaRef> = {
  B1: { titulo: 'Variables y formato', url: VARS_URL },
  B2: { titulo: 'Variables y formato', url: VARS_URL },
  B3: { titulo: 'Ejemplos de variables', url: VARS_URL },
  B4: { titulo: 'Política: datos sensibles', url: POLICY_URL },
  B5: { titulo: 'Plantillas de autenticación', url: AUTH_URL },
  B6: { titulo: 'Política de comercio/mensajes', url: POLICY_URL },
  B7: { titulo: 'Componentes y límites', url: COMP_URL },
  B8: { titulo: 'Encabezado y pie', url: COMP_URL },
  S1: { titulo: 'Densidad de variables', url: VARS_URL },
  S2: { titulo: 'Variables consecutivas', url: VARS_URL },
  S3: { titulo: 'Variables con contexto', url: VARS_URL },
  S4: { titulo: 'Categorías de plantilla', url: CAT_URL },
  S5: { titulo: 'Enlaces permitidos', url: COMP_URL },
  S6: { titulo: 'Política: tono/urgencia', url: POLICY_URL },
};
const REF_GENERAL: ReglaRef = { titulo: 'Guía de plantillas de Meta', url: CAT_URL };

export function refDeRegla(codigo?: string | null): ReglaRef {
  if (!codigo) return REF_GENERAL;
  const c = codigo.trim().toUpperCase().match(/[BSM]\d+/)?.[0];
  return (c && REF_POR_CODIGO[c]) || REF_GENERAL;
}

// ── Motivo de rechazo de Meta (enum) → explicación en español ──
// Guardamos el enum crudo en la DB y traducimos SOLO al renderizar (client + server).
const MOTIVO_RECHAZO: Record<string, string> = {
  INVALID_FORMAT: 'Formato inválido: revisá las variables (no empezar/terminar con {{ }}, ejemplos cargados, header/footer sin variables) y los límites de caracteres.',
  ABUSIVE_CONTENT: 'Contenido abusivo o que viola las políticas de WhatsApp.',
  SCAM: 'Meta lo marcó como posible engaño/estafa.',
  INVALID_BUTTON_FORMAT: 'Formato de botón inválido (texto, URL o tipo).',
  TAG_CONTENT_MISMATCH: 'El contenido no coincide con la categoría elegida.',
  PROMOTIONAL: 'Contenido promocional en una categoría que no lo permite (debería ser Marketing).',
  NONE: 'Sin motivo específico informado por Meta.',
};
export function explicarRechazo(reason?: string | null): string {
  if (!reason || reason === 'NONE') return MOTIVO_RECHAZO.NONE;
  // si es un enum conocido, traducimos; si ya viene como texto, lo devolvemos tal cual.
  return MOTIVO_RECHAZO[reason] ?? reason;
}
