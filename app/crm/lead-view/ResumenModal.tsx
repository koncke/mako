'use client';

// =============================================================================
// ResumenModal — qué muestra el Resumen de la ficha del lead
// =============================================================================
// Martín (13/10/2026, Resumen punto 1): «lo hagas personalizable, que sea simple y que el
// diseño sea bonito». Un interruptor por dato, y cada uno se guarda al tocarlo: no hay
// «Guardar» que olvidarse de apretar. Es del NEGOCIO (lo decide el admin, lo ve todo el equipo).
// Nombre, empresa, teléfono y email no están: son el contacto y siempre se ven.
// =============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Switch } from '@/app/_ui/Toggle';
import { CAMPOS_RESUMEN, seVe, type CampoResumen, type ResumenElegido } from '@/lib/resumen-ficha';
import { resumenFichaAction, guardarResumenFichaAction } from '../resumen-actions';

const GRUPOS = ['Datos', 'Formularios'] as const;

export function ResumenModal({ onCerrar, onGuardado }: { onCerrar: () => void; onGuardado?: () => void }) {
  const [elegido, setElegido] = useState<ResumenElegido | null>(null);
  const [puede, setPuede] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void resumenFichaAction()
      .then((r) => { if (vivo) { setElegido(r.elegido); setPuede(r.puedeEditar); } })
      .catch(() => { if (vivo) setErr('No se pudo leer.'); });
    return () => { vivo = false; };
  }, []);

  const cambiar = (id: CampoResumen, ve: boolean) => {
    if (!elegido) return;
    const antes = elegido;
    const nuevos = { ...elegido, [id]: ve };
    setElegido(nuevos);
    setErr(null);
    void guardarResumenFichaAction(nuevos).then((r) => {
      if (!r.ok) { setElegido(antes); setErr(r.error); return; }
      onGuardado?.();
    }).catch(() => { setElegido(antes); setErr('No se pudo guardar.'); });
  };

  return (
    <Modal titulo="Qué muestra el Resumen" onCerrar={onCerrar} ancho={440}>
      <div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--dim)' }}>
          {puede ? 'Lo prendido se ve en la ficha de cada lead.' : 'Solo el administrador puede cambiarlo.'}
        </p>
        {err && <p role="alert" style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{err}</p>}
        {!elegido ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>{err ? '' : 'Cargando…'}</p>
        ) : GRUPOS.map((g) => (
          <div key={g} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', fontFamily: "'Geist Mono', monospace", marginBottom: 6 }}>{g}</div>
            {CAMPOS_RESUMEN.filter((c) => c.grupo === g).map((c) => (
              <div key={c.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                <Switch label={c.label} checked={seVe(elegido, c.id)} disabled={!puede} onChange={(v) => cambiar(c.id, v)} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
