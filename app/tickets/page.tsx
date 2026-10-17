// =============================================================================
// /tickets — «Reportar problema»: levantar un ticket al equipo de MaKo y ver los tuyos (17/10/2026)
// =============================================================================
// Martín: «Implementa end-to-end la ticketera para los usuarios, copia el diseño y la funcionalidad de alguna muy
// conocida... Para el usuario debe ser fácil levantar un ticket». Se copió el lado del cliente de Intercom (el ticket
// con cinco estados en palabras suyas y la conversación con el equipo) y el «Mis solicitudes» de Zendesk. El diseño:
// docs/diseno-ticketera-usuarios.md. La puerta principal es el chat de MaKo (lib/api-mako/areas/tickets.def.ts); esta
// es la entrada a mano y la lista de lo que levantó.
//
// ⚠️ LA VEN TODOS LOS ROLES Y TODAS LAS CAPAS, y NO la frena el onboarding: el que está trabado a la mitad del wizard
// es el que más necesita reportar algo.
// ⚠️ Lo que se le manda al navegador es `paraElCliente`: nada del triage, de la nota de Martín ni del Runner.

import { requireRolWs } from '@/lib/tab-access';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { misTickets, miTicket, SIN_TABLA } from '@/lib/tickets-db';
import { paraElCliente, type TicketCliente } from '@/lib/tickets-reglas';
import { Pagina, PageHeader } from '@/app/_ui';
import { TicketsCliente } from './TicketsCliente';
import './tickets.css';

export const dynamic = 'force-dynamic';

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs(['closer', 'setter'], { nav: 'tickets', gateOnboarding: false });
  const [s, ws, q] = await Promise.all([getUsuarioActual(), getWorkspaceActual(), searchParams]);
  const email = s?.email?.trim().toLowerCase() ?? '';
  let tickets: TicketCliente[] = [];
  let error: string | null = null;
  if (ws && email) {
    const r = await misTickets(ws, email);
    if (r.ok) tickets = r.datos.map((t) => paraElCliente(t));
    else error = r.faltaTabla ? SIN_TABLA : 'No pude leer tus tickets ahora: recarga en un rato.';
  }
  // `?t=12` abre ése (el link del aviso). Sólo si es SUYO: `miTicket` filtra por workspace y email.
  const t = Number(Array.isArray(q.t) ? q.t[0] : q.t);
  const abierto = ws && email && Number.isInteger(t) && t > 0 ? await miTicket(ws, email, t) : null;
  return (
    <Pagina>
      <PageHeader titulo="Reportar problema" proposito="Cuéntale al equipo de MaKo qué no anda o qué te falta. Te avisamos cuando cambie." />
      <TicketsCliente tickets={tickets} error={error} abierto={abierto ? paraElCliente(abierto.ticket, abierto.eventos) : null} />
    </Pagina>
  );
}
