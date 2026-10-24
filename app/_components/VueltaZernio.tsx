'use client';

// =============================================================================
// VueltaZernio — recibe la vuelta de un login de Zernio en una pantalla que NO tiene el botón a la vista
// =============================================================================
// En un teléfono o en el navegador interno de Instagram/Facebook, «Conectar» navega la pestaña a Zernio y VUELVE a la misma pantalla con
// `?zernio=<red>` (ver ConectarViaZernio.tsx). Quien procesa esa vuelta es el hook, y el hook sólo vive donde está montado: el botón de
// Instagram de Automations está adentro de un modal que, al recargar la página, ya no existe, y nadie leía los parámetros (quedaban en la
// barra hasta que alguien abría un modal después). Esta pieza se monta UNA vez en la pantalla y hace eso: leer la vuelta, medir, y decir
// cómo quedó en un aviso chico (con «Reportar a Soporte» si falló), aunque no haya ningún botón.
//
// No dibuja nada hasta que hay algo que decir.

import { useState } from 'react';
import { EstadoConexion, useConectarViaZernio } from './ConectarViaZernio';

export function VueltaZernio({ volver, onConectado }: {
  /** La RUTA de esta pantalla («/automations»). */
  volver: string;
  /** Quedó conectada: vaciar lo que esta pantalla tenga guardado de lo conectado. */
  onConectado?: () => void;
}) {
  const z = useConectarViaZernio({ volver, onConectado: () => onConectado?.() });
  const [cerrado, setCerrado] = useState(false);
  const hayQueDecir = z.fase !== 'listo' || z.nota != null;
  if (!hayQueDecir || cerrado) return <>{z.modal}</>;
  return (
    <>
      <div role="region" aria-label="Conexión con Zernio" data-vuelta-zernio
        style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 400, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px',
          background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,.18)' }}>
        <EstadoConexion z={z} />
        <button type="button" onClick={() => setCerrado(true)} aria-label="Cerrar el aviso"
          style={{ alignSelf: 'flex-end', border: 0, background: 'none', padding: 0, color: 'var(--faint)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Cerrar</button>
      </div>
      {z.modal}
    </>
  );
}
