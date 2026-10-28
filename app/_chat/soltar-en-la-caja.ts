'use client';

// =============================================================================
// soltar-en-la-caja — lo que se suelta sobre la CONVERSACIÓN va a los adjuntos de la caja de adentro (27/10/2026, ticket #16)
// =============================================================================
// Leila: «No me deja adjuntar un documento ni por arrastrar». La zona de soltar es toda la conversación (PanelDeChat,
// app/admin/operaciones/PanelChat.tsx), con los adjuntos que le pasaba la PANTALLA: donde no le pasaba ninguno decía «Este
// chat no recibe archivos», y donde le pasaba los suyos (fotos y PDF en el Second Brain) un Word rebotaba callado. La caja
// (app/_chat/CajaChat.tsx) tiene los de verdad —los de la pantalla y los que ella lee—: se los avisa al panel por acá.
// =============================================================================

import { createContext, useContext, useEffect } from 'react';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';

/** Lo que el panel lee al soltar: los adjuntos de la caja que tiene adentro (undefined = no hay caja que adjunte). */
export type AdjuntosDeLaCaja = { current: AdjuntosDeCaja | undefined };

export const ContextoSoltar = createContext<AdjuntosDeLaCaja | null>(null);

/** La caja le avisa al panel que la contiene cuáles son sus adjuntos (en cada render: cambian con lo elegido). */
export function useAvisarAdjuntos(a: AdjuntosDeCaja | undefined): void {
  const panel = useContext(ContextoSoltar);
  useEffect(() => {
    if (!panel) return;
    panel.current = a;
    return () => { if (panel.current === a) panel.current = undefined; };
  });
}
