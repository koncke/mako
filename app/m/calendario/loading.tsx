// =============================================================================
// /m/calendario — mientras se lee la agenda: la FORMA de la pantalla, no un spinner
// =============================================================================
// La lectura son siete fuentes en paralelo, y la de Google son TODOS los calendarios de la cuenta (~1-3 s): sin esto,
// tocar «Calendario» en More, o ir a otra semana, dejaba la pantalla anterior congelada hasta que llegaba todo. El
// título grande lo sigue poniendo el shell.

import { SkeletonFilas } from '@/app/m/_ui';
import './calendario.css';

export default function CalendarioCargando() {
  return (
    <div className="m-calendario" aria-busy="true" aria-label="Cargando el calendario">
      <div className="mk-skel m-calendario-skel-seg" />
      <div className="mk-skel m-calendario-skel-mes" />
      <div className="mk-skel m-calendario-skel-semana" />
      <SkeletonFilas filas={5} />
    </div>
  );
}
