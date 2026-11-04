'use client';

// =============================================================================
// El indicador de la esquina: la llamada que se está grabando, desde cualquier pantalla (04/11/2026)
// =============================================================================
// Lo monta el layout UNA vez, adentro de la esquina de los avisos (app/_components/EsquinaAvisos.tsx). Sin grabación no dibuja
// nada. Es la salida para cortar aunque se haya cerrado la ficha, y donde se dice cómo terminó. Liviano a propósito: el layout
// lo carga en cada pantalla (el panel entero vive en ./GrabarLlamada.tsx).
// =============================================================================

import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { cortar, decirResultado, reintentarSubida, soltarGrabacion, useGrabadora } from './grabadora';
import { ComoTermino, Punto, Reloj, boton, chip } from './piezas';


/**
 * Mientras se graba (o hasta que se dice cómo terminó), en la esquina de los avisos (app/_components/EsquinaAvisos.tsx): el reloj
 * y «Cortar». Sin grabación, no dibuja nada. Lo monta el layout UNA vez.
 */
export function GrabacionEnCurso() {
  const g = useGrabadora();
  if (g.fase === 'libre') return null;
  const enCurso = g.fase === 'grabando' || g.fase === 'pidiendo' || g.fase === 'cerrando';
  if (!enCurso && (g.resultado || !g.grabacionId) && !g.error) return null;
  return (
    <div role="status" style={{
      pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', maxWidth: 'min(420px, calc(100vw - 32px))',
      padding: '10px 12px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg, 0 8px 30px rgba(0,0,0,.18))',
    }}>
      {enCurso ? (
        <>
          <Punto />
          <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink)' }}>
            {g.fase === 'cerrando' ? 'Guardando…' : <>Grabando · <Reloj desde={g.desde} /></>}
            {g.leadNombre ? <span style={{ fontWeight: 500, color: 'var(--dim)' }}> · {g.leadNombre}</span> : null}
          </span>
          {g.fase === 'grabando' && <button type="button" style={{ ...boton('rojo'), minHeight: 34, padding: '0 12px', fontSize: 13 }} onClick={() => void cortar()}>Cortar</button>}
        </>
      ) : g.error ? (
        <>
          <span role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{g.error}<ReportarASoporte /></span>
          {g.pendientes > 0
            ? <button type="button" style={chip(false)} onClick={() => void reintentarSubida()}>Volver a subir</button>
            : <button type="button" aria-label="Cerrar" style={chip(false)} onClick={() => soltarGrabacion()}>✕</button>}
        </>
      ) : (
        <>
          <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--ink)' }}>¿Cómo terminó{g.leadNombre ? ` con ${g.leadNombre}` : ''}?</span>
          <ComoTermino valor={g.resultado} onElegir={(r) => void decirResultado(r)} />
          <button type="button" aria-label="Cerrar" style={chip(false)} onClick={() => soltarGrabacion()}>✕</button>
        </>
      )}
    </div>
  );
}
