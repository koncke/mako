'use client';

// =============================================================================
// HistorialFicha — quién cambió la ficha de este CRM, qué, y «Volver a como estaba» (17/10/2026)
// =============================================================================
// Se abre desde el «⋯» de la ficha. Hasta el 17/10/2026 la configuración de la ficha no dejaba rastro (un `console.info`
// en el server) y el único «Deshacer» era el de la misma pestaña, así que un cambio de MaKo o de otro admin no tenía
// quién ni vuelta atrás. El historial vive en el funnel (`data.fichaHistorial`, lib/ficha/historial.ts), con las
// últimas 20.
//
// «Volver a como estaba» es un cambio más (`restaurar`): deja su propia línea y se puede volver de él. Sólo el admin
// (lo dice el server: `puedeVolver`). Al volver, la ficha se relee y gana la foto más nueva (`masNueva`).
// =============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui';
import { historialFichaAction, volverFichaAction } from '../../ficha-actions';
import type { EntradaHistorialFicha } from '@/lib/ficha/historial';

type Entrada = Omit<EntradaHistorialFicha, 'antes'>;

const cuando = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function HistorialFicha({ funnelId, nombre, onCerrar, onVolvio }: {
  /** El funnel de la ficha (`null` = el del negocio). */
  funnelId: number | null;
  /** El nombre del CRM, para el título. */
  nombre: string;
  onCerrar: () => void;
  /** Ya se escribió: la ficha se tiene que releer. */
  onVolvio: () => void;
}) {
  const [leido, setLeido] = useState<{ entradas: Entrada[]; puedeVolver: boolean } | 'cargando' | string>('cargando');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    void historialFichaAction(funnelId).then(
      (r) => { if (vivo) setLeido(r.ok ? { entradas: r.entradas, puedeVolver: r.puedeVolver } : r.error); },
      () => { if (vivo) setLeido('No se pudo leer el historial.'); },
    );
    return () => { vivo = false; };
  }, [funnelId]);

  const volver = async (at: string) => {
    setOcupado(at);
    setError('');
    try {
      const r = await volverFichaAction(funnelId, at);
      if (!r.ok) { setError(r.error); return; }
      onVolvio();
      onCerrar();
    } catch {
      setError('No se pudo volver.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Modal titulo={`Historial de la ficha · ${nombre}`} ancho={600} anidada onCerrar={onCerrar}>
      {leido === 'cargando' && <p style={{ color: 'var(--dim)', fontSize: 14 }}>Cargando…</p>}
      {typeof leido === 'string' && leido !== 'cargando' && <p style={{ color: 'var(--bad)', fontSize: 14 }}>{leido}</p>}
      {typeof leido === 'object' && !leido.entradas.length && (
        <p style={{ color: 'var(--dim)', fontSize: 14 }}>Todavía no hay cambios guardados. Desde hoy, cada cambio de la ficha queda acá.</p>
      )}
      {typeof leido === 'object' && leido.entradas.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {leido.entradas.map((e) => (
            <li key={e.at} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{e.que}</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{e.autor} · {cuando(e.at)}</div>
              </div>
              {leido.puedeVolver && (
                <Button size="sm" variant="tertiary" loading={ocupado === e.at} disabled={ocupado != null} onClick={() => void volver(e.at)}>
                  Volver a como estaba
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p style={{ color: 'var(--bad)', fontSize: 13, marginTop: 10 }}>{error}</p>}
    </Modal>
  );
}
