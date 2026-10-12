'use client';

// =============================================================================
// ServicioSuelto — EL modal de una integración de /integraciones, abierto desde otra pestaña
// =============================================================================
// Decimotercera tanda de Automations (12/10/2026, punto 5), Martín textual: «No crees un nuevo modal de conectar la
// API, reutiliza exactamente el mismo que ya tenemos en integraciones». Hasta acá, «Conectar Instagram» de Automations
// (app/automations/ConectarMedio.tsx) tenía SU campo «API key de Zernio»: un segundo formulario para la misma
// credencial, sin el tutorial, sin «Probar» y sin el estado que muestra /integraciones.
//
// Ahora es el `ServicioModal` de la grilla (app/integraciones/IntegracionesBoard.tsx), tal cual: el carrusel, el chip
// de estado y `ServicioConfigForm` (pegar, guardar, probar). Lo único propio es traer la `Integracion` del server
// (`integracionAction`) y avisar cuando quedó conectada (`onConectado`). Se carga A DEMANDA (`next/dynamic` en quien lo
// monta): la grilla entera no viaja con el lienzo.

import { useEffect, useState } from 'react';
import { ServicioModal } from './IntegracionesBoard';
import { BrandDefs } from '../_components/ServicioVisual';
import { ModalShell, closeBtn } from '../_components/ModalShell';
import { Spinner } from '@/app/_ui';
import { integracionAction } from './servicio-actions';
import type { Integracion } from '@/lib/integraciones';

export default function ServicioSuelto({ servicio, onCerrar, onConectado }: {
  /** La clave de la integración (la de lib/integraciones-catalogo.ts: 'zernio'). */
  servicio: string;
  onCerrar: () => void;
  /** Quedó conectada (lo dice `ServicioConfigForm` al guardar y probar). */
  onConectado?: () => void;
}) {
  const [i, setI] = useState<Integracion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    let vivo = true;
    integracionAction(servicio)
      .then((r) => { if (!vivo) return; if (r.ok) { setI(r.integracion); setError(null); } else setError(r.error); })
      .catch(() => { if (vivo) setError('Sin conexión'); });
    return () => { vivo = false; };
  }, [servicio, vuelta]);

  if (!i) {
    return (
      <ModalShell w={440} label="Integraciones" onClose={onCerrar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', fontSize: 13.5, color: error ? 'var(--bad)' : 'var(--dim)' }}>
          {error ? <span role="alert" style={{ flex: 1 }}>{error}</span> : <><Spinner size={14} /><span style={{ flex: 1 }}>Abriendo…</span></>}
          <button type="button" onClick={onCerrar} style={closeBtn} title="Cerrar" aria-label="Cerrar">✕</button>
        </div>
      </ModalShell>
    );
  }
  return (
    <>
      <BrandDefs />
      <ServicioModal
        i={i} sev={i.estado === 'conectada' ? 'good' : 'warn'}
        gcal={null} health={null} metaError={null} usage={null} cuota={null}
        onClose={onCerrar} onRefetchUsage={() => {}}
        // `ServicioConfigForm` avisa con `onEstado(conectada)` al cambiar: el chip se vuelve a leer y, conectada, se avisa.
        onCambio={(...a: unknown[]) => { setVuelta((v) => v + 1); if (a[0] !== false) onConectado?.(); }}
      />
    </>
  );
}
