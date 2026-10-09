// =============================================================================
// chatwoot — LO QUE QUEDA del WhatsApp oficial: firmas apagadas, sin un solo pedido a Chatwoot
// =============================================================================
// ⛔ CHATWOOT NO EXISTE MÁS EN MAKO. Martín, 09/10/2026: «Elimina de todos lados la
// integración con Chatwoot, que no exista más. Guardalo en privado, por si en un futuro
// queremos volver a utilizarla». Ese día se apagó con un interruptor; el mismo día, más
// tarde («terminalo todo»), se borró el código. Lo que había —el cliente HTTP, el webhook,
// la bandeja oficial, el espejo de etiquetas, el chequeo de salud— está ENTERO en la
// etiqueta de git `archivo/chatwoot-2026-10-09` (`git show archivo/chatwoot-2026-10-09:lib/chatwoot.ts`).
//
// ⚠️ POR QUÉ ESTE ARCHIVO NO SE BORRÓ TODAVÍA: lo importan archivos que tiene a medio
// cambiar otra rama (wip/api-acciones-0910), y tocarlos le generaba conflictos:
//   · app/crm/actions.ts ............................ ensureContactoWhatsapp
//   · lib/api-mako/areas/whatsapp.helpers.ts ........ listConversations, getApprovedTemplates
//   · lib/api-mako/areas/whatsapp.run.ts ............ getContactMessages, contactoEnInboxWA,
//       contactoIdPorTelefono, markContactRead, blockContact, ensureContactoWhatsapp,
//       chatwootConfigurado, estadoWebhookChatwoot, repararWebhookChatwoot
//   · lib/nutricion.ts .............................. sendWhatsappTemplate
// y además lib/meta-templates.ts (getWabaConfig), que es de las plantillas de Meta y se va
// con ellas en la segunda tanda. Cuando esos archivos dejen de importarlo, se borra entero.
//
// Cada función contesta LO MISMO QUE CONTESTABA CON EL INTERRUPTOR APAGADO: las que
// devolvían un resultado devuelven el fallo o el vacío, y las que tiraban tiran. Nadie la
// puede usar para prender nada: `chatwootConfigurado()` es `false` para todos, y es la
// pregunta con la que todo llamador decidía si usarla. tests/sin-chatwoot.test.ts fija que
// no vuelva un `fetch`, una credencial ni un importador nuevo.
// =============================================================================

import 'server-only';

const APAGADO = 'Chatwoot no existe más en MaKo (se retiró el 09/10/2026).';
const apagado = (): never => { throw new Error(APAGADO); };

/** ¿El workspace tiene Chatwoot? No: no lo tiene nadie. */
export async function chatwootConfigurado(): Promise<boolean> {
  return false;
}

// ── Tipos que todavía nombran los importadores ───────────────────────────────

export type WhatsappTemplate = {
  name: string;
  category: 'marketing' | 'utility' | 'authentication';
  language: string;
  bodyParams: Record<string, string>;
};

export type SendResult =
  | { ok: true; conversationId: number }
  | { ok: false; error: string };

export type ChatwootConversation = {
  id: number;
  contactId: number;
  contacto: string;
  telefono: string | null;
  avatar: string | null;
  ultimoMensaje: string | null;
  ultimaActividad: number | null;
  sinLeer: number;
  ultimoEntrante: boolean;
  estado: string;
  puedeResponder: boolean;
  bloqueado: boolean;
};

export type AdjuntoWA = { tipo: string; url: string; ext: string | null };

export type ChatwootMessage = {
  id: number;
  texto: string | null;
  saliente: boolean;
  fecha: number | null;
  template: string | null;
  status: string | null;
  error: string | null;
  adjuntos: AdjuntoWA[];
  messageType: number;
};

export type BlockResult = { ok: true; blocked: boolean } | { ok: false; error: string };

export type WabaConfig = { token: string; wabaId: string; phoneNumberId: string; version: string; appId: string };

export type TemplateInfo = {
  name: string;
  category: string;
  language: string;
  params: string[];
  body: string;
};

export type ChatwootWebhookEstado =
  | 'ok' | 'sin_secret' | 'secret_prod' | 'url_distinta'
  | 'no_registrado' | 'sin_ruteo' | 'ruteo_ocupado' | 'error';
export type ChatwootWebhookSalud = { estado: ChatwootWebhookEstado; urlActual: string | null; urlEsperada: string };

// ── Las firmas, apagadas ─────────────────────────────────────────────────────

/** Mandaba una plantilla por el WhatsApp oficial. Devuelve el fallo, como con el interruptor. */
export async function sendWhatsappTemplate(_params: {
  phone: string;
  name: string;
  content: string;
  template: WhatsappTemplate;
}): Promise<SendResult> {
  return { ok: false, error: APAGADO };
}

/** Alta silenciosa del contacto de un lead nuevo: no hay dónde darlo de alta. */
export async function ensureContactoWhatsapp(_nombre: string, _telefono: string | null | undefined): Promise<number | null> {
  return null;
}

/** El contacto de un teléfono: no hay ninguno. */
export async function contactoIdPorTelefono(_telefono: string): Promise<number | null> {
  return null;
}

/** El guard de aislamiento de la bandeja oficial: un id inválido nunca pasa, y uno válido no se puede comprobar. */
export async function contactoEnInboxWA(contactId: number): Promise<boolean> {
  if (!Number.isInteger(contactId) || contactId <= 0) return false;
  return apagado();
}

export async function listConversations(_maxPages = 12): Promise<ChatwootConversation[]> {
  return apagado();
}

export async function getContactMessages(_contactId: number): Promise<ChatwootMessage[]> {
  return apagado();
}

export async function markContactRead(_contactId: number): Promise<void> {
  return apagado();
}

export async function blockContact(_contactId: number, _blocked: boolean): Promise<BlockResult> {
  return { ok: false, error: APAGADO };
}

export async function getApprovedTemplates(): Promise<TemplateInfo[]> {
  return apagado();
}

/** La cuenta de WhatsApp Business que guardaba el inbox de Chatwoot (la leen las plantillas de Meta). */
export async function getWabaConfig(): Promise<WabaConfig> {
  return apagado();
}

/** «No pude comprobar»: no hay webhook que comprobar. Sólo se llega si alguien saltea `chatwootConfigurado()`. */
export async function estadoWebhookChatwoot(): Promise<ChatwootWebhookSalud> {
  return { estado: 'error', urlActual: null, urlEsperada: '' };
}

export async function repararWebhookChatwoot(): Promise<{ ok: boolean; estado: ChatwootWebhookEstado; error?: string }> {
  return { ok: false, estado: 'error', error: APAGADO };
}
