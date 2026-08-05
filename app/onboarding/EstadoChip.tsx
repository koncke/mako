'use client';

// =============================================================================
// EstadoChip — el estado de producción de un guion, en un clic
// =============================================================================
// Chip compacto que muestra en qué punto del pipeline está el guion y, al
// tocarlo, avanza al siguiente (borrador → aprobado → grabado → publicado →
// vuelve a borrador). Un solo control en vez de un desplegable: el avance es
// lineal y siempre es "el que sigue", así que pedir elegir de una lista sería
// una decisión que la UI ya sabe. El title dice cuál viene, para que no sea
// adivinanza. Lo usan la tarjeta de la matriz y la vista global de guiones.
// =============================================================================

import { ESTADOS_GUION, ESTADO_GUION_LABEL, COLOR_ESTADO_GUION, type EstadoGuion } from './guion-ui';

const MONO = "'Geist Mono', monospace";

export function EstadoChip({ estado, onChange, disabled = false }: {
  estado: EstadoGuion;
  onChange: (e: EstadoGuion) => void;
  disabled?: boolean;
}) {
  const siguiente = ESTADOS_GUION[(ESTADOS_GUION.indexOf(estado) + 1) % ESTADOS_GUION.length];
  const color = COLOR_ESTADO_GUION[estado];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(siguiente)}
      title={disabled ? ESTADO_GUION_LABEL[estado] : `Marcar como ${ESTADO_GUION_LABEL[siguiente]}`}
      aria-label={`Estado: ${ESTADO_GUION_LABEL[estado]}. Marcar como ${ESTADO_GUION_LABEL[siguiente]}`}
      style={{
        flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
        padding: '4px 10px', borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
        border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: color, flex: 'none' }} />
      {ESTADO_GUION_LABEL[estado]}
    </button>
  );
}
