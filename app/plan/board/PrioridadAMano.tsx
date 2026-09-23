'use client';

// =============================================================================
// PrioridadAMano — mover el número sin pedirle permiso a nadie
// =============================================================================
// El pedido, textual (22/09/2026): «no hagas un interruptor para apagar el perro… que siga
// funcionando normalmente. Solo que NO tenga fricción a la hora de cambiar prioridad».
//
// Así que el Perro sigue puntuando todo lo que nace, y la AUDIENCIA sigue existiendo al
// lado («Cambiar prioridad») para cuando quieras que te discutan el número. Lo que cambia es
// que ya no es el único camino: acá se mueve el slider y se escribe.
//
// ⚠️ ESCRIBE EL SERVER, Y POR ESO ESTE COMPONENTE NO TOCA NINGÚN CAMPO. Llama a
// `prioridad-manual`, que corre la misma cascada y las mismas auditorías que un debate
// ganado, y devuelve el número FINAL (puede ser ±1 del pedido: el tablero no tiene empates,
// así que si alguien ya ocupaba ese número, el de al lado es el que queda). Lo que se pinta
// es lo que contestó el server, nunca lo que se pidió.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";

export type MovimientoCascada = { id: string; nombre: string; antes: number; despues: number };

// ⚠️ ESTE COMPONENTE NO SABE A QUÉ API PEGARLE, Y ESO ES EL DISEÑO. La escritura entra por
// `board.repo.prioridadManual`, que sólo implementa el tablero del DUEÑO: `/api/plan-board`
// contesta 403 «solo admin» y `score_manual` (mig 0143) es una columna que la tabla del
// cliente no tiene. Con el endpoint hardcodeado adentro, este mismo slider se dibujaba en
// el board de cada cliente —lo monta el mismo BoardShell— y su única respuesta posible era
// un 403: un control que existe y no puede funcionar se lee como que la app está rota.

const numStyle: CSSProperties = {
  width: 54, textAlign: 'center', fontFamily: MONO, fontSize: 13, fontWeight: 700,
  padding: '4px 4px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)',
};
const notaStyle: CSSProperties = { fontSize: 11, color: 'var(--faint)', lineHeight: 1.35, marginTop: 5, minHeight: 14 };
const linkStyle: CSSProperties = {
  border: 'none', background: 'transparent', padding: 0, marginTop: 4,
  color: 'var(--primary)', fontSize: 11.5, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline',
};

/**
 * El pop-up que sale al ARRASTRAR una tarjeta de una columna a otra.
 *
 * «Y sí que se pueda arrastrar, pero que siempre salga el pop-up para cambiar la prioridad
 * del 1 al 100, solo que ahora ya no habrá fricción» (22/09/2026). O sea: soltar no fija el
 * número por su cuenta. La columna dice la BANDA (Alta, Media, Baja, A futuro) y el número
 * exacto adentro de esa banda lo elige la persona — que es la diferencia entre mover una
 * tarjeta y decidir una prioridad.
 */
export function MoverPrioridadModal({ titulo, score, sugerido, banda, onAplicado, onClose }: {
  titulo: string;
  score: number;
  /** el número con el que arranca el slider: el representativo de la columna donde la soltaste */
  sugerido: number;
  banda: string;
  onAplicado: (score: number) => Promise<void> | void;
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

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(18,21,27,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Geist', sans-serif" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.3)', padding: '20px 22px' }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>¿Con qué prioridad?</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.45, marginBottom: 16 }}>
          «{titulo.slice(0, 80)}{titulo.length > 80 ? '…' : ''}» pasa de <b>{score}</b> a la banda <b>{banda}</b>. El número exacto lo eliges tú.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <input type="range" min={1} max={100} value={v} onChange={(e) => setV(Number(e.target.value))} aria-label="Prioridad, del 1 al 100" style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }} />
          <input type="number" min={1} max={100} value={v} onChange={(e) => setV(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} aria-label="Prioridad, del 1 al 100" style={numStyle} />
        </div>
        {err && <div style={{ fontSize: 12, color: 'var(--bad)', marginBottom: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" onClick={onClose} style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 10, padding: '9px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Dejarla donde está</button>
          <button type="button" onClick={() => void aplicar()} disabled={guardando} style={{ border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 10, padding: '9px 17px', fontSize: 13, fontWeight: 700, cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? 0.75 : 1 }}>
            {guardando ? 'Fijando…' : `Fijarla en ${v}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PrioridadAMano({ entidad, score, scoreManual, color, guardar: guardarEnServer, soltar: soltarEnServer, onAplicado, onSoltado }: {
  entidad: 'proyecto' | 'tarea';
  score: number;
  /** ya lo fijó una persona: el Perro no lo vuelve a mover hasta que se lo devuelvan */
  scoreManual?: boolean;
  color: string;
  /** escribe el número (lo trae el Repo del tablero: sólo el del dueño lo tiene) */
  guardar: (score: number) => Promise<{ score: number; movidos: MovimientoCascada[] }>;
  /** le devuelve la decisión a MaKo */
  soltar: () => Promise<void>;
  onAplicado: (score: number, movidos: MovimientoCascada[]) => void;
  onSoltado: () => void;
}) {
  const [v, setV] = useState(score);
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'listo' | 'error'>('quieto');
  const [msg, setMsg] = useState('');
  // Lo último que el server confirmó. Sirve para no re-mandar el mismo número al soltar el
  // slider sin haberlo movido, que es lo que pasa con cada click.
  const confirmado = useRef(score);
  /** el ÚLTIMO número pedido: lo que llega tarde no pisa a lo que se pidió después */
  const ultimo = useRef(score);

  useEffect(() => {
    if (estado === 'guardando') return;
    setV(score);
    confirmado.current = score;
    ultimo.current = score;
  }, [score, estado]);

  const guardar = async (n: number) => {
    const limpio = Math.max(1, Math.min(100, Math.round(n)));
    if (limpio === confirmado.current) return;
    // ⚠️ `confirmado` se mueve ANTES de mandar, no cuando vuelve. Si no, el mismo número
    // se manda DOS veces: la primera versión deshabilitaba los inputs mientras guardaba, y
    // deshabilitar el input que tiene el foco hace que el navegador lo suelte → otro
    // `focusout` → otro guardado idéntico. Medido: dos POST por cada edición, y el segundo
    // llegaba DESPUÉS de «devolvérsela a MaKo» y volvía a poner el candado.
    const previo = confirmado.current;
    confirmado.current = limpio;
    ultimo.current = limpio;
    setEstado('guardando');
    setMsg('');
    let r: { score: number; movidos: MovimientoCascada[] };
    try { r = await guardarEnServer(limpio); }
    catch (e) {
      if (ultimo.current !== limpio) return;
      confirmado.current = previo;
      setV(previo);
      setEstado('error');
      setMsg(e instanceof Error ? e.message : 'No se pudo guardar. Prueba de nuevo.');
      return;
    }
    // Una respuesta vieja no pisa a la última: si mientras tanto se pidió otro número, el
    // que manda es el otro.
    if (ultimo.current !== limpio) return;
    const final = r.score || limpio;
    const movidos = r.movidos;
    confirmado.current = final;
    ultimo.current = final;
    setV(final);
    setEstado('listo');
    setMsg(
      (final !== limpio ? `Quedó en ${final} (el ${limpio} estaba ocupado)` : 'Listo')
      + (movidos.length ? ` · se corrieron ${movidos.length} más` : ''),
    );
    onAplicado(final, movidos);
  };

  const soltar = async () => {
    setEstado('guardando');
    setMsg('');
    try { await soltarEnServer(); }
    catch (e) { setEstado('error'); setMsg(e instanceof Error ? e.message : 'No se pudo.'); return; }
    setEstado('listo');
    setMsg('Se la devolviste a MaKo');
    onSoltado();
  };

  const guardando = estado === 'guardando';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <input
          type="range" min={1} max={100} value={v}
          onChange={(e) => setV(Number(e.target.value))}
          onPointerUp={() => void guardar(v)}
          onKeyUp={(e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key === 'PageUp' || e.key === 'PageDown') void guardar(v); }}
          aria-label={`Prioridad del ${entidad} (1 a 100)`}
          style={{ flex: 1, accentColor: color, cursor: 'pointer', minWidth: 0, opacity: guardando ? 0.7 : 1 }}
        />
        <input
          type="number" min={1} max={100} value={v}
          onChange={(e) => setV(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
          onBlur={() => void guardar(v)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          aria-label="Prioridad, del 1 al 100"
          style={{ ...numStyle, color, borderColor: color + '55' }}
        />
      </div>
      <div style={{ ...notaStyle, color: estado === 'error' ? 'var(--bad)' : 'var(--faint)' }}>
        {guardando ? 'Guardando…' : msg}
      </div>
      {scoreManual && (
        <button type="button" onClick={() => void soltar()} disabled={guardando} style={linkStyle}>
          La fijaste a mano: MaKo ya no la toca. Devolvérsela.
        </button>
      )}
    </div>
  );
}
