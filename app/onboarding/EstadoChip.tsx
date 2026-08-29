'use client';

// =============================================================================
// EstadoChip — el estado de producción de un guion, en un clic
// =============================================================================
// Muestra en qué punto del pipeline está el guion y, al tocarlo, lo AVANZA al
// siguiente: borrador → aprobado → grabado → publicado. Un solo control en vez
// de un desplegable, porque el avance es lineal y siempre es «el que sigue».
//
// ⚠️ NO CICLA. La versión anterior daba la vuelta (publicado → borrador) con un
// clic suelto. Eso era tolerable cuando el chip vivía entre otros seis botones
// en una fila; en una tarjeta de galería, donde es la ÚNICA acción además de
// abrir, un clic errado despublicaba un anuncio en producción sin preguntar.
// Ahora en 'publicado' el chip queda quieto y para retroceder hay que pasar por
// `onRetroceder` (la galería lo resuelve con una confirmación).
// =============================================================================

import { ESTADOS_GUION, ESTADO_GUION_LABEL, COLOR_ESTADO_GUION, type EstadoGuion } from './guion-ui';

const MONO = "'Geist Mono', monospace";

export function EstadoChip({ estado, onChange, onRetroceder, disabled = false }: {
  estado: EstadoGuion;
  onChange: (e: EstadoGuion) => void;
  /** Qué hacer cuando ya está en el último estado. Si no viene, el chip queda
   *  inerte en 'publicado' (mostrar el estado sigue siendo útil). */
  onRetroceder?: () => void;
  disabled?: boolean;
}) {
  const i = ESTADOS_GUION.indexOf(estado);
  const siguiente = i >= 0 && i < ESTADOS_GUION.length - 1 ? ESTADOS_GUION[i + 1] : null;
  const inerte = disabled || (!siguiente && !onRetroceder);

  const titulo = disabled
    ? ESTADO_GUION_LABEL[estado]
    : siguiente
      ? `Marcar como ${ESTADO_GUION_LABEL[siguiente]}`
      : onRetroceder
        ? 'Ya está publicado · toca para cambiarlo'
        : 'Publicado';

  return (
    <button
      type="button"
      disabled={inerte}
      onClick={(e) => {
        e.stopPropagation(); // vive adentro de tarjetas clickeables
        if (siguiente) onChange(siguiente);
        else onRetroceder?.();
      }}
      title={titulo}
      aria-label={`Estado: ${ESTADO_GUION_LABEL[estado]}. ${titulo}`}
      style={{
        flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7,
        minHeight: 'var(--touch)', padding: '0 14px', borderRadius: 999,
        fontFamily: MONO, fontSize: 'var(--fs-meta)', fontWeight: 700,
        letterSpacing: '.05em', textTransform: 'uppercase',
        cursor: inerte ? 'default' : 'pointer',
        border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)',
        opacity: disabled ? 0.6 : 1,
        transition: 'background .14s ease, border-color .14s ease, color .14s ease',
      }}
    >
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: COLOR_ESTADO_GUION[estado], flex: 'none' }} />
      {ESTADO_GUION_LABEL[estado]}
    </button>
  );
}
