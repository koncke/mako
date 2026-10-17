'use client';

// La Ticketera adentro del Centro, en el teléfono. Son DOS pantallas, una por paso (Martín: el teléfono destila el
// escritorio), y cada una con su fila en el Centro (CentroAppMovil.tsx):
//   · `?ticketera=tickets` — LA Ticketera desde el 17/10/2026: los tickets que levantan los usuarios, la misma bandeja que
//     la computadora (app/tickets/bandeja/BandejaTickets.tsx). Con la lista angosta se vuelve una lista y, al tocar un
//     ticket, el ticket entero (su hoja ya lo hace: bandeja.css, `max-width: 1100px`). `TicketsMovil`.
//   · `?ticketera=tarjetas|lista` — «Preguntas de los chats», el mazo y la lista de siempre (app/tickets/decisiones/Mazo.tsx,
//     app/admin/runway/Tablero.tsx), con el «Tarjetas | Lista» cambiando acá adentro. `TicketeraMovil`.
// A ellas llevan las rutas de antes (lib/movil-rutas.ts).
//
// ⚠️ `TicketsMovil` monta el MISMO motor del Centro (useCentro) que la computadora y que CentroAppMovil, y no por gusto:
// «Aprobar» le FIRMA el ticket al chat «Cerebro» desde este teléfono (cerebroDelCentro), y eso lo necesita: la firma, la
// lista de chats y el estado del Runner. Sin él, Aprobar dejaría el ticket aprobado y sin entregar.

import { useState } from 'react';
import { useToastM } from '@/app/m/_ui';
import { MazoDecisiones } from '@/app/tickets/decisiones/Mazo';
import { TableroDecisiones } from '@/app/admin/runway/Tablero';
import { BandejaTickets } from '@/app/tickets/bandeja/BandejaTickets';
import { cerebroDelCentro } from '@/app/tickets/bandeja/cerebro';
import { useCentro, type DatosCentro } from '@/app/admin/operaciones/useCentro';
import type { AccionDeshacer, AccionResponder, LecturaDecisiones } from '@/app/admin/runway/decisiones';
import type { VistaTicketera } from '@/app/tickets/decisiones/CambioVista';

/** Los tickets de los usuarios: la bandeja de la computadora, con el Cerebro al que se le firma «Aprobar». */
export function TicketsMovil(datos: DatosCentro) {
  const toast = useToastM();
  const centro = useCentro(datos, (t) => toast(t));
  return <BandejaTickets cerebro={cerebroDelCentro(centro)} />;
}

/** Las preguntas de los chats: el mazo viejo y su lista. */
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
