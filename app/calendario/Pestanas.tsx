'use client';

// =============================================================================
// PestanasCalendario — cómo se mira el Calendario: Día · Semana · Mes · Agenda · Llamadas, en UN selector
// =============================================================================
// «Calendario | Llamadas» (24/10/2026) era un selector arriba a la derecha, como el «Calendario | Tareas» de Google Calendar y
// el «Calendar View · Appointment List View» de HighLevel, y al lado vivía el desplegable de las seis vistas de Google. Desde
// el 29/10/2026 (Martín: «hay muchos botones que son innecesarios… para lo que los dueños de negocio lo van a usar») es UNO:
// las vistas de la grilla y la lista de «Llamadas» (./ListaLlamadas.tsx) son formas de mirar lo mismo (la regla de la casa:
// las vistas de una misma cosa son un selector, no dos controles). Se fueron Año (no dibujaba nada) y 4 días (Google); sus
// links viejos abren el Mes y la Semana (app/calendario/page.tsx).
// Cada opción es un link (el de la casa, con el `?ws=` de quien mira) y la fecha que se mira viaja con las de la grilla.

import Link from '@/app/_ui/Link';
import type { VistaCalendario } from '@/lib/calendario-modelo';

/** Las vistas que se ofrecen, en su orden. La tecla de cada una sigue siendo la de Google (lib/calendario-modelo.ts). */
export const VISTAS_DE_LA_BARRA: ReadonlyArray<{ id: VistaCalendario; nombre: string }> = [
  { id: 'dia', nombre: 'Día' },
  { id: 'semana', nombre: 'Semana' },
  { id: 'mes', nombre: 'Mes' },
  { id: 'agenda', nombre: 'Agenda' },
];

export function PestanasCalendario({ activa, fecha }: { activa: VistaCalendario | 'llamadas'; fecha?: string }) {
  const conFecha = fecha ? `&fecha=${fecha}` : '';
  return (
    <nav className="gc-que-ver" aria-label="Cómo ver">
      {VISTAS_DE_LA_BARRA.map((v) => (
        <Link key={v.id} href={`/calendario?vista=${v.id}${conFecha}`} className="gc-que-ver-op" aria-current={activa === v.id ? 'page' : undefined}>{v.nombre}</Link>
      ))}
      <Link href="/calendario?vista=llamadas" className="gc-que-ver-op" aria-current={activa === 'llamadas' ? 'page' : undefined}>Llamadas</Link>
    </nav>
  );
}
