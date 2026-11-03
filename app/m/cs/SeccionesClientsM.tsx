// =============================================================================
// SeccionesClientsM — las sub-tabs de Classroom (era Clients) en el teléfono: Classroom · Community · Clients
// =============================================================================
// En la computadora, Clientes, Curso y Comunidad son UNA tab, Clients, con sub-tabs (17/10/2026,
// docs/diseno-clients.md D6). El teléfono DESTILA eso (no lo rediseña): sus tres pantallas de siempre (/m/cs, /m/comunidad,
// /m/curso) llevan arriba el MISMO trío, en el mismo orden y con los mismos nombres que la cabecera de escritorio, y More
// pasa a tener una sola fila, Clients. Calendar, Members, Leaderboards y About viven adentro de la comunidad del teléfono.
// Los href son internos (/m/…): `conWs` los sale como /classroom/clients, /classroom/community y /classroom.

import { SegmentadoM } from '@/app/m/_ui';
import { esAppIosDelPedido } from '@/lib/tienda-pedido';

export type SeccionClientsM = 'clients' | 'community' | 'classroom';

const OPCIONES: Array<{ id: SeccionClientsM; label: string; href: string }> = [
  { id: 'classroom', label: 'Classroom', href: '/m/curso' },
  { id: 'community', label: 'Community', href: '/m/comunidad' },
  { id: 'clients', label: 'Clients', href: '/m/cs' },
];

export async function SeccionesClientsM({ activa }: { activa: SeccionClientsM }) {
  // La app de iPhone no lleva Community: Apple (1.2) pide bloquear a un usuario desde la app, y la moderación está en la computadora.
  const opciones = (await esAppIosDelPedido()) ? OPCIONES.filter((o) => o.id !== 'community') : OPCIONES;
  return (
    // Estilo en línea y no una clase: lo dibujan tres pantallas, cada una con SU hoja (app/m/_ui/LEEME.md §5).
    <div style={{ marginBottom: 14 }}>
      <SegmentadoM etiqueta="Classroom" valor={activa} opciones={opciones} />
    </div>
  );
}
