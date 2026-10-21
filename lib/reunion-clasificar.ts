// =============================================================================
// reunion-clasificar — clasifica una reunión por email, PURO (sin IO, testeable)
// =============================================================================
// Punto 10 del rediseño del pipeline de reuniones. Vive aparte de plan-fathom.ts
// (que es server-only por importar el CRM) para poder testear la regla sin base ni
// red — mismo split que crm-auto / retro-seguimiento.
//
// LA REGLA: cada reunión es de ventas / entrega / equipo / otra, según el email de
// sus invitados externos. El lead MANDA sobre el usuario del workspace: si el
// contraparte está en el CRM es una llamada de negocio (venta o entrega) aunque
// además sea del equipo; solo si NO es lead pero SÍ es usuario del workspace es
// 'equipo'. Determinístico, sin IA — barato y auditable.
//
// Para qué sirve: traer pocas reuniones ya clasificadas, auto-cargar al plan a
// futuro, y sobre todo SEGURIDAD — el Perro puede FRENAR "me estás cargando una
// llamada de VENTAS como tareas del plan de ejecución".
// =============================================================================

// Solo el TIPO (se borra en runtime): fathom-api.ts es 'server-only' y este módulo
// tiene que poder cargarse en un test suelto. externalInviteeEmails se reimplementa
// acá abajo — son cuatro líneas y así el módulo queda sin dependencias de servidor.
import type { FathomMeeting } from './fathom-api';

export type TipoReunion = 'entrega' | 'ventas' | 'equipo' | 'otra';

/** Lo que el clasificador mira de un lead del CRM. `cliente_ws` y `nombre` sólo los usa `esClienteMako`. */
export type LeadDeReunion = { estado_lead: string | null; cliente_ws?: number | null; nombre?: string | null };

/**
 * QUIÉN TIENE SU PROPIA CUENTA DE MAKO (20/10/2026). Sólo lo arma el tablero del DUEÑO (el super admin): para él, alguien
 * con un workspace en MaKo es un CLIENTE, y su llamada es de entrega aunque su lead siga en «abierto». El caso: las
 * llamadas de feedback con Florencia (18/10, ya paga) y con Leila (19/10) quedaron descartadas como «ventas» porque sus
 * leads decían prospecto, y no dejaron ni una tarea. En el tablero de un cliente esto no se arma: un usuario de MaKo no
 * es cliente de Mauricio.
 *   · `emails`: los usuarios de los OTROS workspaces (no el propio: ése es el equipo).
 *   · `nombres`: los nombres completos de esos workspaces y de sus usuarios, normalizados. Es la red para cuando la cuenta
 *     se abrió con OTRO correo (Florencia: el lead es su gmail personal, la cuenta es la de Consultesis).
 */
export type ClientesMako = { emails: ReadonlySet<string>; nombres: readonly string[] };

const normNom = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();

/**
 * ¿Este invitado tiene su propia cuenta de MaKo? Por la base, de lo más duro a lo más blando: su correo es usuario de otro
 * workspace; su lead apunta a una cuenta (`leads.cliente_ws`, el puente que escribe el alta por pago); o el nombre
 * COMPLETO de su lead (dos palabras o más) es el de un usuario o está entero en el nombre de un workspace («Florencia
 * Ayelen Carballo» en «mi marca personal: Florencia Ayelen Carballo»). Un nombre de pila solo no alcanza.
 */
export function esClienteMako(email: string, lead: LeadDeReunion | undefined, clientes: ClientesMako): boolean {
  if (clientes.emails.has(email)) return true;
  if (lead?.cliente_ws != null) return true;
  const n = normNom(lead?.nombre ?? '');
  if (n.split(' ').filter((w) => w.length >= 2).length < 2) return false;
  return clientes.nombres.some((x) => x === n || ` ${x} `.includes(` ${n} `));
}

/** Emails (minúscula) de los invitados EXTERNOS. Espejo de fathom-api, sin server-only. */
export function emailsInvitadosExternos(m: FathomMeeting): string[] {
  return (m.calendar_invitees ?? [])
    .filter((i) => i.is_external && i.email)
    .map((i) => i.email!.trim().toLowerCase())
    .filter(Boolean);
}

const mail = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/**
 * TODOS los emails que aparecen en la reunión, mire donde mire: invitados de
 * calendario (externos o no), quien la grabó, y los dueños que Fathom ya asignó a
 * sus action items.
 *
 * Antes se miraban SOLO los invitados externos, y eso dejaba ciega a la app en el
 * caso más común de una reunión de trabajo: un Meet ad-hoc, sin evento de
 * calendario. Sin invitados, `emails` quedaba vacío, la reunión caía en 'otra' y el
 * cron la descartaba entera y en silencio — pasó con la reunión del 1-ago
 * ("Impromptu Google Meet Meeting"), de la que no salió ni una tarea al plan.
 */
export function emailsDeLaReunion(m: FathomMeeting): string[] {
  const out = new Set<string>();
  for (const i of m.calendar_invitees ?? []) { const e = mail(i.email); if (e) out.add(e); }
  const rec = m as unknown as { recorded_by?: { email?: string }; action_items?: Array<{ assignee?: { email?: string } }> };
  const host = mail(rec.recorded_by?.email);
  if (host) out.add(host);
  for (const a of rec.action_items ?? []) { const e = mail(a.assignee?.email); if (e) out.add(e); }
  return [...out];
}

export function clasificarReunion(
  m: FathomMeeting,
  leadsByEmail: Map<string, LeadDeReunion>,
  equipoEmails: Set<string>,
  clientes?: ClientesMako | null,
): TipoReunion {
  // El lead sigue mandando (una llamada de venta NO es una reunión de plan), pero
  // solo se lo busca entre los INVITADOS EXTERNOS: el host y los dueños de action
  // items son de casa, y si alguno figura en el CRM no convierte la reunión en venta.
  // Y ANTES que el lead, si tiene su propia cuenta de MaKo (`esClienteMako`): es cliente, aunque el CRM diga prospecto.
  const externos = emailsInvitadosExternos(m);
  for (const e of externos) {
    const lead = leadsByEmail.get(e);
    if (clientes && esClienteMako(e, lead, clientes)) return 'entrega';
    if (lead) return lead.estado_lead === 'ganado' ? 'entrega' : 'ventas';
  }
  // Para "¿es del equipo?" se mira TODO: invitados (externos o no), quien grabó y
  // los dueños de los action items.
  for (const e of emailsDeLaReunion(m)) if (equipoEmails.has(e)) return 'equipo';
  return 'otra';
}

/**
 * POR QUÉ quedó en ese tipo, en una línea que se dibuja (16/10/2026, «Fathom sin fricción»).
 *
 * El cron descarta las de ventas y las «otra», y hasta ese día el único rastro era un
 * `console.log` en Vercel: para el dueño una reunión descartada era igual a una que nunca existió.
 * Ahora queda escrita (mig 0300) y se muestra en el modal de Fathom con «Leer igual», y el motivo
 * tiene que decir QUÉ vio el clasificador —el correo que lo decidió—, para que la persona pueda
 * desmentirlo sin abrir la grabación. Recorre lo MISMO que `clasificarReunion`, en el mismo orden:
 * si divergieran, el motivo explicaría otro veredicto.
 */
export function motivoDelTipo(
  m: FathomMeeting,
  leadsByEmail: Map<string, LeadDeReunion>,
  equipoEmails: Set<string>,
  clientes?: ClientesMako | null,
): string {
  for (const e of emailsInvitadosExternos(m)) {
    const lead = leadsByEmail.get(e);
    if (clientes && esClienteMako(e, lead, clientes)) return `${e} tiene su cuenta en MaKo: es una reunión de entrega.`;
    if (lead) return lead.estado_lead === 'ganado'
      ? `${e} es cliente tuyo: es una reunión de entrega.`
      : `${e} está en tu CRM como prospecto: es una llamada de ventas.`;
  }
  const todos = emailsDeLaReunion(m);
  for (const e of todos) if (equipoEmails.has(e)) return `${e} es de tu equipo.`;
  if (!todos.length) return 'No tiene invitados con correo: no sé de quién es.';
  const lista = todos.slice(0, 3).join(', ') + (todos.length > 3 ? ` y ${todos.length - 3} más` : '');
  return `No reconocí a nadie: ${lista} no ${todos.length === 1 ? 'es' : 'son'} de tu equipo ni de tu CRM.`.slice(0, 300);
}

/** Etiqueta y color de cada tipo, para la UI del selector. */
export const TIPO_REUNION_UI: Record<TipoReunion, { label: string; tono: 'good' | 'blue' | 'warn' | 'gris' }> = {
  entrega: { label: 'Entrega', tono: 'good' },
  ventas: { label: 'Ventas', tono: 'blue' },
  equipo: { label: 'Equipo', tono: 'warn' },
  otra: { label: 'Otra', tono: 'gris' },
};
