'use client';
// =============================================================================
// BotonEstrella — la estrella de GitHub, para cualquier creación de MaKo
// =============================================================================
// UNA pieza para toda la app: la galería la usa en cada fila, y la pantalla de una feature que muestre una creación
// (una plantilla de Automations, un dashboard publicado) la monta igual. Como la de GitHub: «☆ Estrella» con el número
// al lado, que se rellena al darla. Optimista: cambia al instante y vuelve atrás si el server dice que no.
//   · Las creaciones PROPIAS no se puntúan: el botón se ve (con su número) y no se puede apretar.
// =============================================================================

import { useState } from 'react';
import { numeroCorto } from '@/lib/creaciones-reglas';
import { estrellaAction } from './actions';

export function IconoEstrella({ llena, size = 16 }: { llena: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flex: 'none' }}
      fill={llena ? 'var(--warn)' : 'none'} stroke={llena ? 'var(--warn)' : 'currentColor'} strokeWidth={1.8} strokeLinejoin="round">
      <path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1 6L12 17.05 6.65 19.85l1-6L3.3 9.6l6-.9Z" />
    </svg>
  );
}

export function BotonEstrella({
  creacionId, estrellas, conEstrella, mia = false, onCambio,
}: {
  creacionId: number;
  estrellas: number;
  conEstrella: boolean;
  /** La publicó este negocio: se ve, no se aprieta. */
  mia?: boolean;
  onCambio?: (x: { estrellas: number; conEstrella: boolean }) => void;
}) {
  const [estado, setEstado] = useState({ estrellas, conEstrella });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alternar = async () => {
    if (mia || ocupado) return;
    const antes = estado;
    const dar = !estado.conEstrella;
    setEstado({ conEstrella: dar, estrellas: Math.max(0, estado.estrellas + (dar ? 1 : -1)) });
    setOcupado(true);
    setError(null);
    const r = await estrellaAction(creacionId, dar).catch(() => ({ error: 'Sin conexión' }));
    setOcupado(false);
    if ('error' in r) { setEstado(antes); setError(r.error); return; }
    setEstado(r);
    onCambio?.(r);
  };

  const rotulo = estado.conEstrella ? 'Con estrella' : 'Estrella';
  const titulo = mia ? 'Es tuya: las estrellas las dan los demás' : estado.conEstrella ? 'Quitar tu estrella' : 'Darle tu estrella';
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <button
        type="button"
        onClick={alternar}
        disabled={mia || ocupado}
        aria-pressed={estado.conEstrella}
        aria-label={`${titulo} (${estado.estrellas})`}
        title={titulo}
        style={{
          display: 'inline-flex', alignItems: 'stretch', padding: 0, borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)',
          font: 'inherit', fontSize: 13, fontWeight: 600, lineHeight: 1, cursor: mia ? 'default' : 'pointer',
          opacity: ocupado ? 0.7 : 1,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}>
          <IconoEstrella llena={estado.conEstrella} />
          {rotulo}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', fontVariantNumeric: 'tabular-nums' }}>
          {numeroCorto(estado.estrellas)}
        </span>
      </button>
      {error && <span role="alert" style={{ fontSize: 12, color: 'var(--bad)' }}>{error}</span>}
    </span>
  );
}
