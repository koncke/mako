'use client';

// =============================================================================
// SelectorHora — elegir una hora tocando, no tipeando
// =============================================================================
// Reemplaza al <input type="time"> nativo, que es el control más incómodo del
// CRM: cambia de aspecto y de teclado en cada navegador, obliga a acertarle a
// un spinner de dos dígitos y al AM/PM, y en el celular abre una ruedita.
// Reagendar una reunión —la acción más frecuente del worklist— terminaba siendo
// la más lenta.
//
// La observación que lo simplifica: las reuniones no caen en cualquier minuto.
// Caen en horas y medias horas de la jornada laboral. Entonces se muestran esos
// horarios como botones (un toque = elegido) y el campo libre queda detrás de
// "Otro horario", para el caso raro (las 7:15, un cliente en otro huso).
//
// Mismo criterio que el resto de la app: se toca, no se tipea. Vive suelto en
// app/crm/ para poder usarlo en cualquier lado donde se pida una hora.

import { useState, type CSSProperties } from 'react';

const SANS = "'Geist', sans-serif";

/** Jornada laboral por defecto: de 9:00 a 19:00, en bloques de 30 minutos. */
export const HORA_DESDE = 9;
export const HORA_HASTA = 19;
const PASO_MIN = 30;

/** "09:30" → "9:30 AM". La grilla se lee como la lee una persona, no en 24h. */
export function horaLegible(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? '').trim());
  if (!m) return hhmm ?? '';
  const h = Number(m[1]);
  const sufijo = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${sufijo}`;
}

/** Los horarios de la grilla, en formato "HH:MM" (el mismo valor que emite el input nativo). */
function horariosFrecuentes(desde: number, hasta: number): string[] {
  const out: string[] = [];
  for (let min = desde * 60; min <= hasta * 60; min += PASO_MIN) {
    out.push(`${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`);
  }
  return out;
}

export function SelectorHora({
  value,
  onChange,
  desde = HORA_DESDE,
  hasta = HORA_HASTA,
  ariaLabel = 'Hora',
}: {
  /** "HH:MM" o '' si todavía no se eligió. */
  value: string;
  onChange: (v: string) => void;
  desde?: number;
  hasta?: number;
  ariaLabel?: string;
}) {
  const opciones = horariosFrecuentes(desde, hasta);
  // "Otro horario" se abre solo si el valor que llega NO está en la grilla: al
  // reabrir el formulario con las 7:15 ya cargadas, el campo libre tiene que
  // estar visible con su valor, no escondido detrás de un botón.
  const [libre, setLibre] = useState(() => !!value && !opciones.includes(value));

  const chip = (activo: boolean): CSSProperties => ({
    padding: '9px 12px', borderRadius: 10, fontFamily: SANS, fontSize: 13.5, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
    background: activo ? 'var(--ink)' : 'var(--surface)',
    border: '1px solid ' + (activo ? 'var(--ink)' : 'var(--border-strong)'),
    color: activo ? '#F3F5F8' : 'var(--ink)',
  });

  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* auto-fill y no una fila con scroll: la grilla completa a la vista es lo
          que permite elegir de un toque sin buscar. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 7 }}>
        {opciones.map((h) => (
          <button key={h} type="button" aria-pressed={!libre && value === h}
            onClick={() => { setLibre(false); onChange(h); }}
            style={chip(!libre && value === h)}>
            {horaLegible(h)}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" aria-pressed={libre}
          onClick={() => { setLibre(true); onChange(''); }}
          style={{ ...chip(libre), borderStyle: libre ? 'solid' : 'dashed' }}>
          Otro horario
        </button>
        {libre && (
          <input type="time" value={value} autoFocus aria-label={`${ariaLabel} (libre)`}
            onChange={(e) => onChange(e.target.value)}
            style={{ flex: '0 1 140px', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' }} />
        )}
      </div>
    </div>
  );
}
