'use client';

// =============================================================================
// EliminarCuenta — «Eliminar mi cuenta» en la computadora (3/11/2026)
// =============================================================================
// Lo mismo que el teléfono (app/m/cuenta/EliminarCuentaM.tsx), con las mismas palabras (`textoDeLaBaja`) y la misma ruta. Abajo de
// todo en Información personal, sin mirar a nadie: quien está viendo la cuenta de otro no lo ve (`deOtro`).

import { useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { Modal } from '@/app/_ui/Modal';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { CONFIRMACION_BAJA, TITULO_BAJA, fechaDeLaBaja, textoDeLaBaja, type AlcanceBaja } from '@/lib/baja-cuenta-reglas';

type Estado = { puede: false; motivo: string } | { puede: true; alcance: AlcanceBaja; negocio: string | null; pendienteHasta: string | null };

export function EliminarCuenta() {
  const [abierta, setAbierta] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [hasta, setHasta] = useState<string | null>(null);

  const abrirDeNuevo = async () => {
    try {
      const j = await (await fetch('/api/cuenta/eliminar', { cache: 'no-store' })).json();
      if (j?.ok) setEstado(j as Estado);
    } catch { /* se queda lo que decía */ }
  };

  const abrir = async () => {
    setAbierta(true); setError(null);
    try {
      const j = await (await fetch('/api/cuenta/eliminar', { cache: 'no-store' })).json();
      if (!j?.ok) { setError(j?.error ?? 'No pudimos leer tu cuenta.'); return; }
      setEstado(j as Estado);
      if (j.puede && j.pendienteHasta) setHasta(j.pendienteHasta);
    } catch { setError('No pudimos leer tu cuenta.'); }
  };

  const confirmar = async () => {
    if (ocupado) return;
    setOcupado(true); setError(null);
    try {
      const j = await (await fetch('/api/cuenta/eliminar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmar: CONFIRMACION_BAJA, alcance: estado?.puede ? estado.alcance : null }),
      })).json();
      // Cambió lo que se borra (se fue otro admin): se vuelve a leer antes de confirmar.
      if (j?.error && !j.ok) void abrirDeNuevo();
      if (!j?.ok) { setError(j?.error ?? 'No pudimos anotar tu pedido.'); return; }
      setHasta(j.hasta);
    } catch { setError('No pudimos anotar tu pedido.'); } finally { setOcupado(false); }
  };

  const t = estado?.puede ? textoDeLaBaja(estado.alcance, estado.negocio) : null;
  return (
    <>
      <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <Button variant="tertiary" size="sm" onClick={() => { void abrir(); }}>{TITULO_BAJA}</Button>
      </div>
      {abierta && <Modal onCerrar={() => { if (!ocupado) setAbierta(false); }} titulo={hasta ? 'Pedido recibido' : '¿Eliminar tu cuenta?'} ancho={440}
        pie={hasta
          ? <Button variant="primary" onClick={() => { window.location.href = '/login'; }}>Salir</Button>
          : t
            ? <><Button variant="tertiary" onClick={() => setAbierta(false)} disabled={ocupado}>Volver</Button><Button variant="danger" loading={ocupado} onClick={() => { void confirmar(); }}>{TITULO_BAJA}</Button></>
            : undefined}>
        <div style={{ display: 'grid', gap: 10, fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>
          {hasta
            ? <p style={{ margin: 0 }}>Se borra antes del {fechaDeLaBaja(hasta)}. Te avisamos por correo al terminar.</p>
            : estado && !estado.puede
              ? <p style={{ margin: 0 }}>{estado.motivo}</p>
              : t && <><p style={{ margin: 0 }}>{t.que}</p>{t.plan && <p style={{ margin: 0 }}>{t.plan}</p>}<p style={{ margin: 0, color: 'var(--dim)' }}>{t.plazo}</p></>}
          {error && <p role="alert" style={{ margin: 0, color: 'var(--bad)' }}>{error}<ReportarASoporte /></p>}
        </div>
      </Modal>}
    </>
  );
}
