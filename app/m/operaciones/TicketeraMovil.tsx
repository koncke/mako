'use client';

// La Ticketera adentro del Centro, en el teléfono: `?ticketera=tickets`, LA Ticketera desde el 17/10/2026 (los tickets que
// levantan los usuarios, la misma bandeja que la computadora, app/tickets/bandeja/BandejaTickets.tsx). Desde el 22/10/2026 es
// un MAZO para deslizar (o la TABLA, si la eligió: se recuerda en su perfil); el teléfono la DESTILA con los cortes del panel
// (bandeja.css, container queries), no con otra pantalla.
// Las rutas de antes (lib/movil-rutas.ts) llegan acá. «Preguntas de los chats» se sacó esa noche (19:31, Martín: «para eso
// tenemos en cada chat la notif de "Espera tu respuesta"»): se contestan en el chat que las hizo.
//
// ⚠️ `TicketsMovil` monta el MISMO motor del Centro (useCentro) que la computadora y que CentroAppMovil, y no por gusto:
// «Aprobar» le FIRMA el ticket al chat «Cerebro» desde este teléfono (cerebroDelCentro), y eso lo necesita: la firma, la
// lista de chats y el estado del Runner. Sin él, Aprobar dejaría el ticket aprobado y sin entregar.

import { useToastM } from '@/app/m/_ui';
import { BandejaTickets } from '@/app/tickets/bandeja/BandejaTickets';
import { cerebroDelCentro } from '@/app/tickets/bandeja/cerebro';
import { useCentro, type DatosCentro } from '@/app/admin/operaciones/useCentro';

/** Los tickets de los usuarios: la bandeja de la computadora, con el Cerebro al que se le firma «Aprobar». */
export function TicketsMovil(datos: DatosCentro) {
  const toast = useToastM();
  const centro = useCentro(datos, (t) => toast(t));
  return <BandejaTickets cerebro={cerebroDelCentro(centro)} />;
}
