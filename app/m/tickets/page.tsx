// =============================================================================
// /m/tickets — «Reportar problema» en el teléfono (17/10/2026). En la URL, /tickets.
// =============================================================================
// Referencia: el «Messages / Tickets» del Messenger de Intercom en el celular y el «Mis solicitudes» del SDK de
// Zendesk: la lista de lo que levantaste (número, título, estado en palabras tuyas, cuándo cambió) y UN botón grande
// abajo para levantar uno nuevo, que abre una hoja con una sola pregunta. Es lo mismo que la computadora
// (app/tickets/page.tsx, copiada de los dos), destilado: el campo de arriba pasa a la hoja, y el detalle de un ticket es
// su propia pantalla (/m/tickets/<id>; en la computadora, `?t=<id>`).
//
// ⚠️ LA VEN TODOS LOS ROLES Y TODAS LAS CAPAS, y NO la frena el onboarding (`onboarding: false`), como en escritorio
// (`gateOnboarding: false`): el que está trabado a la mitad del wizard es el que más necesita reportar algo.
// ⚠️ Lee lo MISMO que escritorio y con las mismas funciones: `misTickets` filtra por SU workspace y SU email, y al
// navegador sólo va `paraElCliente` (nada del triage, de la nota de Martín ni del Runner). Las acciones son las de
// escritorio (app/tickets/acciones.ts), que sacan quién es de la sesión.
// =============================================================================

import './tickets.css';
import { requireMovil } from '@/lib/movil-guard';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { misTickets, SIN_TABLA } from '@/lib/tickets-db';
import { paraElCliente, type TicketCliente } from '@/lib/tickets-reglas';
import { PantallaM } from '@/app/m/_ui';
import { TicketsM } from './TicketsM';

export const dynamic = 'force-dynamic';

export default async function TicketsMovil() {
  await requireMovil({ navKey: 'tickets', onboarding: false });
  const [s, ws] = await Promise.all([getUsuarioActual(), getWorkspaceActual()]);
  const email = s?.email?.trim().toLowerCase() ?? '';
  let tickets: TicketCliente[] = [];
  let error: string | null = null;
  if (ws && email) {
    const r = await misTickets(ws, email);
    if (r.ok) tickets = r.datos.map((t) => paraElCliente(t));
    else error = r.faltaTabla ? SIN_TABLA : 'No pude leer tus tickets ahora: recarga en un rato.';
  }
  return (
    <PantallaM>
      <TicketsM tickets={tickets} error={error} />
    </PantallaM>
  );
}
