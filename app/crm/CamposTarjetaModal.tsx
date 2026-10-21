'use client';

// =============================================================================
// CamposTarjetaModal — «Personalizar tarjetas»: qué datos muestra la tarjeta de un lead
// =============================================================================
// Martín, 20/10/2026: «Las cards, las debería poder personalizar también, por si el usuario quiere más o menos info».
// Una casilla por dato, en el orden de la tarjeta; el nombre va siempre. Cada cambio se ve EN EL ACTO en el tablero de
// atrás y se guarda para quien mira (por persona, no por funnel: el porqué en lib/tarjeta-kanban.ts →
// CAMPOS_TARJETA_LEAD). Si no se puede guardar (la sesión compartida vieja, sin fila propia), se dice: el cambio vale
// mientras la pestaña esté abierta.
// =============================================================================

import { useCallback, useState } from 'react';
import { Modal } from '@/app/_ui';
import { CAMPOS_TARJETA_DEFAULT, CAMPOS_TARJETA_LEAD, NOMBRE_CAMPO_TARJETA, type CampoTarjetaLead } from '@/lib/tarjeta-kanban';
import { guardarCamposTarjetaAction } from './tarjeta-campos-actions';

/** Los «más info»: los que la tarjeta de siempre no trae. */
const EXTRA = new Set<CampoTarjetaLead>(CAMPOS_TARJETA_LEAD.filter((c) => !CAMPOS_TARJETA_DEFAULT.includes(c)));

export function CamposTarjetaModal({ campos, guardable, onCambio, onCerrar }: {
  campos: readonly CampoTarjetaLead[];
  guardable: boolean;
  /** El tablero de atrás cambia en el acto (y vuelve atrás si no se pudo guardar). */
  onCambio: (campos: CampoTarjetaLead[]) => void;
  onCerrar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cerrar = useCallback(() => onCerrar(), [onCerrar]);

  const guardar = async (nuevos: CampoTarjetaLead[], antes: readonly CampoTarjetaLead[]) => {
    onCambio(nuevos);
    setError(null);
    if (!guardable) return;
    setGuardando(true);
    const r = await guardarCamposTarjetaAction(nuevos).catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    setGuardando(false);
    if (!r.ok) { onCambio([...antes]); setError(r.error); }
  };
  const alternar = (c: CampoTarjetaLead) => {
    const set = new Set(campos);
    if (set.has(c)) set.delete(c); else set.add(c);
    void guardar(CAMPOS_TARJETA_LEAD.filter((x) => set.has(x)), campos);
  };

  const fila = (c: CampoTarjetaLead) => (
    <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', cursor: 'pointer', fontSize: 14, color: 'var(--ink)' }}>
      <input type="checkbox" checked={campos.includes(c)} onChange={() => alternar(c)} disabled={guardando}
        style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer', flex: 'none' }} />
      {NOMBRE_CAMPO_TARJETA[c]}
    </label>
  );

  return (
    <Modal titulo="Personalizar tarjetas" ancho={420} onCerrar={cerrar}>
      <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--dim)' }}>
        Qué ves en cada tarjeta. El nombre va siempre.
      </p>
      {CAMPOS_TARJETA_LEAD.filter((c) => !EXTRA.has(c)).map(fila)}
      <div style={{ margin: '10px 0 2px', fontSize: 12, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Más info</div>
      {CAMPOS_TARJETA_LEAD.filter((c) => EXTRA.has(c)).map(fila)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <button type="button" disabled={guardando}
          onClick={() => void guardar([...CAMPOS_TARJETA_DEFAULT], campos)}
          style={{ border: 'none', background: 'none', padding: 0, color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Volver a lo de siempre
        </button>
        <span style={{ flex: 1 }} />
        {!guardable && <span style={{ fontSize: 12, color: 'var(--dim)' }}>Sin guardar: vale en esta pestaña.</span>}
      </div>
      {error && <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--bad)' }}>{error}</p>}
    </Modal>
  );
}
