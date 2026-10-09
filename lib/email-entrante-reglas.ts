// =============================================================================
// email-entrante-reglas — de quién es un email que LLEGA, y de qué lead (las reglas, puras)
// =============================================================================
// Pedido de Martín (09/10/2026, sexta tanda, CRON 8), textual: «También agrega la opción de "Email"
// que funcione similar... Si recibo un email, que se pueda configurar automatizaciones».
//
// Lo medido antes de escribir esto (09/10/2026, sólo lectura):
//   · Resend RECIBE mails (doc oficial, «Receiving»): en un dominio verificado de la cuenta, con el
//     interruptor de recepción prendido y un registro MX (el de Resend tiene que ser el de prioridad
//     más baja; para no pisar el correo de siempre, Resend recomienda un SUBDOMINIO), y avisa por
//     webhook con el evento `email.received`. ⚠️ El webhook trae SÓLO lo de arriba del sobre —`from`,
//     `to`, `cc`, `bcc`, `received_for`, `subject`, `message_id`, los adjuntos sin contenido—: el
//     cuerpo se pide aparte (`GET /emails/receiving/{id}`). Para disparar una automatización alcanza.
//   · La cuenta de Resend de MaKo tiene UN dominio, `hola-mako.com`, con `receiving: disabled`, y UN
//     webhook (a /api/webhooks/resend) que YA está suscripto a `email.received`. O sea que hoy no
//     llega ningún mail, y el día que llegue, aquella ruta lo ignora.
//   · `resend_domain` (app_settings) lo tiene un solo workspace, el 11 (leilafittipaldi.com), y ese
//     dominio NO está en la cuenta de MaKo: el ws11 manda con su propia key de Resend.
//
// ── QUÉ DECIDE ESTE MÓDULO ──
// · DE QUIÉN ES: del workspace que RECLAMÓ el dominio del destinatario (`resend_domain`, que se
//   reclama con titularidad: primer workspace gana, app/api/email/dominio). Un subdominio cuenta como
//   del dominio que lo contiene (el MX recomendado va en un subdominio: `hola@inbox.negocio.com`), y
//   un reclamo exacto le gana a uno que contiene. ⚠️ NUNCA por `resend_from`: el del ws1 es
//   «MaKo <equipo@hola-mako.com>» —el dominio de la PLATAFORMA—, y rutear por ahí le daría a un
//   cliente los mails de MaKo (AGENTS.md, «OWNER_WS no es la plataforma»).
// · ESTRICTO: si los destinatarios caen en DOS workspaces, no es de ninguno (`ambiguo`). Si no cae en
//   ninguno, tampoco. Nunca «el primero».
// · DE QUÉ LEAD: el que tiene ese email, comparado EXACTO (`emailComparable`); un patrón trae
//   candidatos y nada más (AGENTS.md, «Un patrón trae CANDIDATOS»). Con dos leads con el mismo email
//   no se elige: no se dispara nada y queda escrito.
// · LO AUTOMÁTICO NO DISPARA: un rebote (`mailer-daemon@`), un `no-reply@`. Con una automatización
//   que contesta un email con otro email, una respuesta automática del otro lado sería un bucle.
//
// PURO Y SIN `server-only`: lo ejecuta tests/email-entrante.test.ts. Lo usa lib/email-entrante.ts.
// =============================================================================

import { emailComparable } from './leads-duplicados';

/**
 * El evento del motor de automatizaciones que dispara un email que llega.
 * ⚠️ INTEGRACIÓN: el NOMBRE lo agrega a `EventoNutricion` (lib/nutricion.ts) la parte «disparadores»
 * de la sexta tanda. Tiene que ser el mismo string que use ella.
 */
export const EVENTO_EMAIL_RECIBIDO = 'email_recibido';

/** Lo que importa de un `email.received`, ya leído. */
export type EmailRecibido = {
  /** El id de Resend: la clave de la deduplicación (un reintento del webhook trae el mismo). */
  emailId: string;
  /** Quién lo manda, en minúsculas. */
  de: string;
  /** A quiénes llegó (`received_for`, `to` y `cc`), en minúsculas y sin repetir. */
  para: string[];
  asunto: string;
  messageId: string | null;
  recibidoAt: string | null;
};

/** Una dirección de un encabezado («Ana <ana@x.com>» o «ana@x.com»), en minúsculas, o null. */
export function direccionDeCorreo(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > 320) return null;
  const m = /<\s*([^<>\s]+)\s*>\s*$/.exec(s);
  const d = (m ? m[1] : s).toLowerCase();
  return /^[^\s@<>",;]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(d) ? d : null;
}

const listaDeDirecciones = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).map(direccionDeCorreo).filter((x): x is string => !!x);

/**
 * El cuerpo de un webhook de Resend, si es un `email.received` que se puede usar. null = otro evento,
 * o uno al que le falta lo que decide (el id, quién lo manda, a quién llegó).
 */
export function leerEmailRecibido(raw: unknown): EmailRecibido | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.type !== 'email.received') return null;
  const d = (o.data && typeof o.data === 'object' && !Array.isArray(o.data) ? o.data : {}) as Record<string, unknown>;
  const emailId = typeof d.email_id === 'string' ? d.email_id.trim() : '';
  const de = direccionDeCorreo(d.from);
  // `received_for` primero: es la casilla de Resend que lo RECIBIÓ (en un reenvío, `to` es la original).
  const para = [...new Set([...listaDeDirecciones(d.received_for), ...listaDeDirecciones(d.to), ...listaDeDirecciones(d.cc)])];
  if (!emailId || emailId.length > 120 || !de || !para.length) return null;
  return {
    emailId, de, para,
    asunto: typeof d.subject === 'string' ? d.subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 300) : '',
    messageId: typeof d.message_id === 'string' ? d.message_id.trim().slice(0, 300) || null : null,
    recibidoAt: typeof d.created_at === 'string' ? d.created_at : typeof o.created_at === 'string' ? o.created_at : null,
  };
}

/** Un dominio reclamado por un workspace (`resend_domain`). */
export type DominioReclamado = { ws: number; dominio: string };

export type DestinoDelEmail = { ws: number } | { ws: null; motivo: 'sin_dominio' | 'ambiguo' };

/** El dominio de una dirección. */
const dominioDe = (d: string): string => d.slice(d.lastIndexOf('@') + 1);

/**
 * De qué workspace es un email que llegó, por el dominio de sus destinatarios. Para cada dirección,
 * el reclamo exacto o, si no, el dominio reclamado MÁS LARGO que la contiene (`inbox.negocio.com` →
 * `negocio.com`). Si dos workspaces reclaman lo mismo, esa dirección es ambigua. Al final: UN
 * workspace, o ninguno con su motivo.
 */
export function workspaceDelEmail(para: readonly string[], reclamados: readonly DominioReclamado[]): DestinoDelEmail {
  const limpios = reclamados
    .map((r) => ({ ws: Number(r.ws), dominio: String(r.dominio ?? '').trim().toLowerCase().replace(/^\.+|\.+$/g, '') }))
    .filter((r) => Number.isInteger(r.ws) && r.ws > 0 && r.dominio.includes('.'));
  const encontrados = new Set<number>();
  let ambiguo = false;
  for (const dir of para) {
    const d = dominioDe(dir);
    const cubren = limpios.filter((r) => d === r.dominio || d.endsWith(`.${r.dominio}`));
    if (!cubren.length) continue;
    const largo = Math.max(...cubren.map((r) => r.dominio.length));
    const mejores = new Set(cubren.filter((r) => r.dominio.length === largo).map((r) => r.ws));
    if (mejores.size > 1) { ambiguo = true; continue; }
    encontrados.add([...mejores][0]);
  }
  // Estricto: una dirección ambigua, o dos workspaces, y no es de nadie.
  if (ambiguo || encontrados.size > 1) return { ws: null, motivo: 'ambiguo' };
  if (encontrados.size === 1) return { ws: [...encontrados][0] };
  return { ws: null, motivo: 'sin_dominio' };
}

/** ¿Lo mandó una máquina? Un rebote o un «no responder» no dispara nada (ver la cabecera). */
export function esRemitenteAutomatico(de: string): boolean {
  return /^(?:mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?|notifications?)(?:[+._-][^@]*)?@/i.test(de.trim());
}

/** Un valor para un `ilike` que tiene que ser EXACTO: `\`, `%` y `_` dejan de ser comodines. */
export function escaparIlike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type LeadDelEmail = { leadId: number } | { leadId: null; motivo: 'sin_lead' | 'ambiguo' };

/**
 * El lead de quien manda, entre los candidatos que trajo el patrón: los que tienen ESE email, exacto.
 * Uno → ése. Ninguno o varios → ninguno, con el motivo: no se elige el primero.
 */
export function leadDelEmail(candidatos: ReadonlyArray<{ id: unknown; email: unknown }>, de: string): LeadDelEmail {
  const buscado = emailComparable(de);
  if (!buscado) return { leadId: null, motivo: 'sin_lead' };
  const ids = new Set<number>();
  for (const c of candidatos) {
    const id = Number(c.id);
    if (Number.isInteger(id) && id > 0 && emailComparable(c.email) === buscado) ids.add(id);
  }
  if (ids.size === 1) return { leadId: [...ids][0] };
  return { leadId: null, motivo: ids.size ? 'ambiguo' : 'sin_lead' };
}

/**
 * Los estados con que queda escrita una fila de `email_entrantes` (mig 0245; el CHECK de la tabla
 * repite esta lista). 'error' es el ÚNICO que un reintento del webhook puede volver a procesar.
 */
export const ESTADOS_ENTRANTE = ['procesando', 'disparado', 'sin_workspace', 'sin_lead', 'ambiguo', 'automatico', 'error'] as const;
export type EstadoEntrante = typeof ESTADOS_ENTRANTE[number];

/** Una fila que ya se procesó o se está procesando: otro reintento es un duplicado. */
export function yaProcesado(estado: unknown): boolean {
  return typeof estado === 'string' && (ESTADOS_ENTRANTE as readonly string[]).includes(estado) && estado !== 'error';
}
