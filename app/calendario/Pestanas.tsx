'use client';

// «Calendario | Llamadas» (24/10/2026): el selector de arriba a la derecha, como el «Calendario | Tareas» de Google Calendar
// y el «Calendar View · Appointment List View» de HighLevel. «Llamadas» es la lista de citas de venta (./ListaLlamadas.tsx);
// el link lleva el `?ws=` de quien mira (el Link de la casa).

import Link from '@/app/_ui/Link';

export function PestanasCalendario({ activa }: { activa: 'calendario' | 'llamadas' }) {
  return (
    <nav className="gc-que-ver" aria-label="Qué ver">
      <Link href="/calendario" className="gc-que-ver-op" aria-current={activa === 'calendario' ? 'page' : undefined}>Calendario</Link>
      <Link href="/calendario?vista=llamadas" className="gc-que-ver-op" aria-current={activa === 'llamadas' ? 'page' : undefined}>Llamadas</Link>
    </nav>
  );
}
