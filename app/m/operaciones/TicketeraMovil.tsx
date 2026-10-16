'use client';

// La Ticketera adentro del Centro, en el teléfono (16/10/2026): el mismo mazo y la misma lista de siempre
// (app/tickets/decisiones/Mazo.tsx, app/admin/runway/Tablero.tsx), con el «Tarjetas | Lista» cambiando acá adentro.
// La abre la fila «Ticketera» de arriba de los chats (/m/operaciones?ticketera=…), y a ella llevan las rutas de antes.

import { useState } from 'react';
import { MazoDecisiones } from '@/app/tickets/decisiones/Mazo';
import { TableroDecisiones } from '@/app/admin/runway/Tablero';
import type { AccionDeshacer, AccionResponder, LecturaDecisiones } from '@/app/admin/runway/decisiones';
import type { VistaTicketera } from '@/app/tickets/decisiones/CambioVista';

export function TicketeraMovil({ lectura, vistaInicial, responder, deshacer }: {
  lectura: LecturaDecisiones; vistaInicial: VistaTicketera; responder: AccionResponder; deshacer: AccionDeshacer;
}) {
  const [vista, setVista] = useState<VistaTicketera>(vistaInicial);
  const cambiar = (v: VistaTicketera) => {
    setVista(v);
    try { const u = new URL(window.location.href); u.searchParams.set('ticketera', v); window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}`); } catch { /* es una comodidad */ }
  };
  return vista === 'tarjetas'
    ? <MazoDecisiones lectura={lectura} responder={responder} deshacer={deshacer} onCambioVista={cambiar} />
    : <TableroDecisiones lectura={lectura} responder={responder} onCambioVista={cambiar} />;
}
