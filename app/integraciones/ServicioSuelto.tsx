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
//
// 14/10/2026 — LA REGLA PARA TODAS LAS TABS (Martín: «para una integración jamás se debe salir de la tab»). Lo monta
// `app/_components/ConectarIntegracion.tsx` (el botón, el link y el hook que usan las tabs). Para Google Calendar trae
// además lo que el tablero de /integraciones pregunta una vez al abrir: el PERMISO real de la agenda
// (`getGoogleCalendarStatusAction`), del que dependen el chip y el «Conectar»/«Reconectar»; y, si el OAuth volvió con un
// fallo (`motivoGoogle`, el `?gcal=` del callback), lo dice adentro del modal.

import { useEffect, useState } from 'react';
import { ServicioModal } from './IntegracionesBoard';
import { BrandDefs } from '../_components/ServicioVisual';
import { ModalShell, closeBtn } from '../_components/ModalShell';
import { Spinner } from '@/app/_ui';
import { integracionAction } from './servicio-actions';
import { getGoogleCalendarStatusAction, type GoogleCalendarStatus } from '@/app/configuraciones/gcal-actions';
import { GCAL_MSG } from '@/app/configuraciones/GoogleCalendarPanel';
import type { Integracion } from '@/lib/integraciones';

export default function ServicioSuelto({ servicio, motivoGoogle = null, onCerrar, onConectado }: {
  /** La clave de la integración (la de lib/integraciones-catalogo.ts: 'zernio'). */
  servicio: string;
  /** Cómo volvió el OAuth de Google (`?gcal=` del callback). Sólo para 'google'. */
  motivoGoogle?: string | null;
  onCerrar: () => void;
  /** Quedó conectada (lo dice `ServicioConfigForm` al guardar y probar). */
  onConectado?: () => void;
}) {
  const [i, setI] = useState<Integracion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [gcal, setGcal] = useState<GoogleCalendarStatus | null>(null);
  useEffect(() => {
    let vivo = true;
    integracionAction(servicio)
      .then((r) => { if (!vivo) return; if (r.ok) { setI(r.integracion); setError(null); } else setError(r.error); })
      .catch(() => { if (vivo) setError('Sin conexión'); });
    return () => { vivo = false; };
  }, [servicio, vuelta]);
  // El permiso de la agenda: sólo con token guardado (como el tablero). Sin respuesta no se degrada nada.
  const googleConToken = servicio === 'google' && i?.estado === 'conectada';
  useEffect(() => {
    if (!googleConToken) { setGcal(null); return; }
    let vivo = true;
    getGoogleCalendarStatusAction().then((s) => { if (vivo) setGcal(s); }).catch(() => { /* sin respuesta = no degradamos */ });
    return () => { vivo = false; };
  }, [googleConToken, vuelta]);

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
  // Google: verde SÓLO con el permiso completo, como en la grilla (`sevOf` de IntegracionesBoard).
  const gcalIncompleta = !!gcal?.puede && gcal.conectado && !gcal.puedeMover;
  const gcalRechazada = !!gcal?.puede && !gcal.conectado;
  const sev = i.estado !== 'conectada' || (i.key === 'google' && (gcalIncompleta || gcalRechazada)) ? 'warn' : 'good';
  const aviso = i.key === 'google' && motivoGoogle ? GCAL_MSG[motivoGoogle] ?? null : null;
  return (
    <>
      <BrandDefs />
      <ServicioModal
        i={i} sev={sev} chipWord={i.key === 'google' && gcalIncompleta ? 'Falta permiso' : undefined} aviso={aviso}
        gcal={gcal} health={null} metaError={null} usage={null} cuota={null}
        onClose={onCerrar} onRefetchUsage={() => {}}
        // `ServicioConfigForm` avisa con `onEstado(conectada)` al cambiar: el chip se vuelve a leer y, conectada, se avisa.
        onCambio={(...a: unknown[]) => { setVuelta((v) => v + 1); if (a[0] !== false) onConectado?.(); }}
      />
    </>
  );
}
