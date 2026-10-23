// =============================================================================
// /m/tickets/<id> — UN ticket en el teléfono: la conversación con el equipo y responder (17/10/2026)
// =============================================================================
// En la URL, /tickets?t=<id> (el link del aviso abre ése). Referencia: el detalle de un ticket del Messenger de Intercom
// en el celular — el estado arriba, la conversación en burbujas (lo tuyo a la derecha) y la caja de responder pegada
// abajo, como un chat. Desde el 23/10/2026, la conversación del chat de Soporte (app/tickets/soporte/) en su propia pantalla.
//
// ⚠️ Sólo SUYO: `miTicket` filtra por el workspace y el email de la sesión, igual que escritorio; uno ajeno o que no
// existe se ve como «No encuentro ese ticket», sin decir cuál de las dos.
// =============================================================================

import '../tickets.css';
import { requireMovil } from '@/lib/movil-guard';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { miTicket } from '@/lib/tickets-db';
import { paraElCliente } from '@/lib/tickets-reglas';
import { CabeceraM, PantallaM, VacioM } from '@/app/m/_ui';
import { ChatTicketM } from '../SoporteM';

export const dynamic = 'force-dynamic';

export default async function TicketMovil({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMovil({ navKey: 'tickets', onboarding: false });
  const n = Number(id);
  const [s, ws] = await Promise.all([getUsuarioActual(), getWorkspaceActual()]);
  const email = s?.email?.trim().toLowerCase() ?? '';
  const r = ws && email && Number.isInteger(n) && n > 0 ? await miTicket(ws, email, n) : null;
  if (!r) {
    return (
      <PantallaM>
        <CabeceraM titulo="Ticket" />
        <VacioM frase="No encuentro ese ticket." accion={{ rotulo: 'Ver tus tickets', href: '/m/tickets' }} />
      </PantallaM>
    );
  }
  const t = paraElCliente(r.ticket, r.eventos);
  return (
    <PantallaM>
      <CabeceraM titulo={`Ticket #${t.id}`} trabajo />
      {/* La conversación de ESE ticket con el equipo, como un chat (23/10/2026, ../SoporteM.tsx). */}
      <ChatTicketM t={t} />
    </PantallaM>
  );
}
