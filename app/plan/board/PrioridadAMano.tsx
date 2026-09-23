'use client';

// =============================================================================
// PrioridadAMano — el lápiz, y el pop-up del 1 al 100
// =============================================================================
// El pedido, textual (22/09/2026): «no hagas un interruptor para apagar el perro… que siga
// funcionando normalmente. Solo que NO tenga fricción a la hora de cambiar prioridad».
//
// ⚠️ Y EL 23/09, MIRANDO LA PANTALLA: «no tiene más sentido que salga el botón o deslizable
// para cambiar la prioridad allí, si para eso teníamos el pop-up» + «que el botón de cambiar
// prioridad sea minimalista, que solo sea un ícono de lápiz». Así que el panel del detalle
// NO tiene slider: tiene el número y un lápiz al lado. El lápiz abre ESTE pop-up, que es el
// mismo que sale al arrastrar una tarjeta de una columna a otra — un solo lugar donde se
// elige un número, en vez de dos controles que hacen lo mismo con distinta cara.
//
// ⚠️ ESCRIBE EL SERVER, Y POR ESO ESTE ARCHIVO NO TOCA NINGÚN CAMPO NI SABE A QUÉ API
// PEGARLE. La escritura entra por `board.repo.prioridadManual`, que cada tablero implementa
// como puede: el del dueño corre la cascada y el candado (`score_manual`, mig 0143), el del
// cliente escribe el número por `/api/todo`. Con el endpoint hardcodeado adentro, este mismo
// control se dibujaba en el board de cada cliente y su única respuesta posible era un 403.
//
// Lo que devuelve el server es lo que se pinta, nunca lo que se pidió: el número final puede
// ser ±1 del pedido (el tablero del dueño no tiene empates, así que si alguien ya ocupaba
// ese número, queda el de al lado).
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import { MakoStar } from '../../_components/MakoBrand';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

export type MovimientoCascada = { id: string; nombre: string; antes: number; despues: number };

const numStyle: CSSProperties = {
  width: 62, textAlign: 'center', fontFamily: MONO, fontSize: 15, fontWeight: 800,
  padding: '7px 4px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)',
};

/**
 * El LÁPIZ. Lo único que se ve del control en el panel del detalle.
 *
 * Va pegado al número —no debajo, no en un botón de ancho completo—: «posicionalo donde
 * realmente se vea bien, porque donde está ahora si aparece un icono de lápiz flotando no
 * tiene sentido». Un ícono suelto al final de una columna no se lee como «editá esto»; al
 * lado del dato que edita, sí.
 */
export function LapizPrioridad({ onClick, titulo = 'Cambiar la prioridad' }: { onClick: () => void; titulo?: string }) {
  return (
    <button type="button" onClick={onClick} title={titulo} aria-label={titulo}
      style={{
        flex: 'none', width: 26, height: 26, borderRadius: 7, border: '1px solid transparent',
        background: 'transparent', color: 'var(--faint)', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--faint)'; }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  );
}

/**
 * El pop-up del 1 al 100. Sale al arrastrar una tarjeta Y al tocar el lápiz.
 *
 * «Y sí que se pueda arrastrar, pero que siempre salga el pop-up para cambiar la prioridad
 * del 1 al 100, solo que ahora ya no habrá fricción» (22/09/2026). O sea: soltar no fija el
 * número por su cuenta. La columna dice la BANDA y el número exacto lo elige la persona.
 *
 * `onDebate` es la ÚNICA puerta que le queda a la audiencia con el Perro, y vive acá adentro
 * a propósito: discutirle el número es una opción de quien ya decidió cambiarlo, no un botón
 * más en el panel. Sin esto, sacar el botón del detalle dejaba la audiencia inalcanzable.
 */
export function MoverPrioridadModal({ titulo, score, sugerido, banda, onAplicado, onDebate, onClose }: {
  titulo: string;
  score: number;
  /** el número con el que arranca el slider: el de la columna donde la soltaste, o el actual */
  sugerido: number;
  banda: string;
  onAplicado: (score: number) => Promise<void> | void;
  /** abrir la audiencia con el Perro. Ausente = este tablero no la tiene. */
  onDebate?: () => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(sugerido);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const aplicar = async () => {
    setGuardando(true);
    setErr('');
    try { await onAplicado(v); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); setGuardando(false); }
  };

  const mueve = v !== score;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(18,21,27,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.3)', padding: '20px 22px' }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>¿Con qué prioridad?</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.45, marginBottom: 16 }}>
          «{titulo.slice(0, 80)}{titulo.length > 80 ? '…' : ''}» está en <b>{score}</b>{mueve ? <> y pasa a la banda <b>{banda}</b></> : null}. El número exacto lo eliges tú.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <input type="range" min={1} max={100} value={v} onChange={(e) => setV(Number(e.target.value))} aria-label="Prioridad, del 1 al 100" style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }} />
          {/* Borrar el contenido del input NO es «prioridad 1»: `Number('') || 1` daba 1 y el
              blur lo guardaba, así que tipear encima del número fijaba un score que nadie
              eligió. Vacío = se queda como está hasta que haya un número. */}
          <input type="number" min={1} max={100} value={v} onChange={(e) => { const t = e.target.value.trim(); if (t === '') return; setV(Math.max(1, Math.min(100, Number(t) || v))); }} aria-label="Prioridad, del 1 al 100" style={numStyle} />
        </div>
        {err && <div style={{ fontSize: 12, color: 'var(--bad)', marginBottom: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', alignItems: 'center', marginTop: 14 }}>
          {onDebate && (
            <button type="button" onClick={() => { onClose(); onDebate(); }}
              style={{ marginRight: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: SANS }}>
              <MakoStar size={14} color="var(--primary)" /> Que lo decida MaKo
            </button>
          )}
          <button type="button" onClick={onClose} style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 10, padding: '9px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Dejarla donde está</button>
          <button type="button" onClick={() => void aplicar()} disabled={guardando} style={{ border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 10, padding: '9px 17px', fontSize: 13, fontWeight: 700, cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? 0.75 : 1 }}>
            {guardando ? 'Fijando…' : `Fijarla en ${v}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ⛔ ACÁ VIVÍA `PrioridadAMano`, el slider del panel, y con él «La fijaste a mano: MaKo ya
// no la toca. Devolvérsela.». Los dos se fueron el 23/09/2026 a pedido, mirando la pantalla:
// el slider porque «para eso teníamos el pop-up» —dos controles para el mismo número, uno
// ocupando cuatro renglones del panel— y el cartel porque explicaba un mecanismo interno en
// el lugar más caro, y ofrecía deshacer algo que nadie había pedido deshacer.
//
// El candado (`score_manual`, mig 0143) NO se tocó: sigue puesto, `recurvarPlanOwner` ahora
// sí lo respeta, y `Repo.prioridadAlPerro` sigue existiendo para quien lo necesite. Lo que
// se sacó es el cartel, no el mecanismo.
