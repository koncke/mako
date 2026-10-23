// =============================================================================
// Los tickets de la persona, para la Ticketera de su Ops Center (22/10/2026)
// =============================================================================
// Los pide el navegador después de dibujar, y cada minuto (como el número de la Ticketera del super admin: ./bandeja/usarContador.ts).
// Un refresco que falla deja lo último que se vio (la regla del Ops Center, tests/ops-center-refresco-sin-parpadeo.test.ts): el
// error sólo se dice si todavía no hay nada que mostrar.
// ⚠️ SIN 'use client' A PROPÓSITO (como usarContador.ts): es un hook que sólo importan componentes de cliente.

import { useEffect, useState } from 'react';
import { misTicketsAction } from './acciones';
import { esperanTuRespuesta, type TicketCliente } from '@/lib/tickets-reglas';

/** `fueraDelPlan`: el plan no trae la tab de tickets; el botón no se ofrece. */
export type MisTickets = { tickets: TicketCliente[] | null; error: string | null; esperanTuRespuesta: number; fueraDelPlan: boolean };

export function useMisTickets(activo: boolean): MisTickets {
  const [tickets, setTickets] = useState<TicketCliente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fueraDelPlan, setFueraDelPlan] = useState(false);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const leer = () => {
      misTicketsAction()
        .then((r) => { if (!vivo) return; if (r.ok) { setTickets(r.tickets); setError(null); setFueraDelPlan(false); } else { setError(r.error); setFueraDelPlan(!!r.fueraDelPlan); } })
        .catch(() => { if (vivo) setError('No pude leer tus tickets ahora: prueba en un rato.'); });
    };
    leer();
    const t = window.setInterval(leer, 60_000);
    return () => { vivo = false; window.clearInterval(t); };
  }, [activo]);
  return { tickets, error: tickets ? null : error, esperanTuRespuesta: esperanTuRespuesta(tickets), fueraDelPlan };
}
