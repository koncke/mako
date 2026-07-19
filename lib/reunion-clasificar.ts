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

/** Emails (minúscula) de los invitados EXTERNOS. Espejo de fathom-api, sin server-only. */
export function emailsInvitadosExternos(m: FathomMeeting): string[] {
  return (m.calendar_invitees ?? [])
    .filter((i) => i.is_external && i.email)
    .map((i) => i.email!.trim().toLowerCase())
    .filter(Boolean);
}

export function clasificarReunion(
  m: FathomMeeting,
  leadsByEmail: Map<string, { estado_lead: string | null }>,
  equipoEmails: Set<string>,
): TipoReunion {
  const emails = emailsInvitadosExternos(m);
  for (const e of emails) {
    const lead = leadsByEmail.get(e);
    if (lead) return lead.estado_lead === 'ganado' ? 'entrega' : 'ventas';
  }
  for (const e of emails) if (equipoEmails.has(e)) return 'equipo';
  return 'otra';
}

/** Etiqueta y color de cada tipo, para la UI del selector. */
export const TIPO_REUNION_UI: Record<TipoReunion, { label: string; tono: 'good' | 'blue' | 'warn' | 'gris' }> = {
  entrega: { label: 'Entrega', tono: 'good' },
  ventas: { label: 'Ventas', tono: 'blue' },
  equipo: { label: 'Equipo', tono: 'warn' },
  otra: { label: 'Otra', tono: 'gris' },
};
