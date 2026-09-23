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

const post = async (body: Record<string, unknown>): Promise<Record<string, unknown>> =>
  fetch('/api/plan-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch((e) => ({ ok: false, error: String(e) }));

const numStyle: CSSProperties = {
  width: 54, textAlign: 'center', fontFamily: MONO, fontSize: 13, fontWeight: 700,
  padding: '4px 4px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)',
};
const notaStyle: CSSProperties = { fontSize: 11, color: 'var(--faint)', lineHeight: 1.35, marginTop: 5, minHeight: 14 };
const linkStyle: CSSProperties = {
  border: 'none', background: 'transparent', padding: 0, marginTop: 4,
  color: 'var(--primary)', fontSize: 11.5, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline',
};

export function PrioridadAMano({ entidad, id, score, scoreManual, color, onAplicado, onSoltado }: {
  entidad: 'proyecto' | 'tarea';
  id: string;
  score: number;
  /** ya lo fijó una persona: el Perro no lo vuelve a mover hasta que se lo devuelvan */
  scoreManual?: boolean;
  color: string;
  onAplicado: (score: number, movidos: MovimientoCascada[]) => void;
  onSoltado: () => void;
}) {
  const [v, setV] = useState(score);
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'listo' | 'error'>('quieto');
  const [msg, setMsg] = useState('');
  // Lo último que el server confirmó. Sirve para no re-mandar el mismo número al soltar el
  // slider sin haberlo movido, que es lo que pasa con cada click.
  const confirmado = useRef(score);

  useEffect(() => {
    if (estado === 'guardando') return;
    setV(score);
    confirmado.current = score;
  }, [score, estado]);

  const guardar = async (n: number) => {
    const limpio = Math.max(1, Math.min(100, Math.round(n)));
    if (limpio === confirmado.current) return;
    setEstado('guardando');
    setMsg('');
    const j = await post({ action: 'prioridad-manual', entidad, id, score: limpio });
    if (!j?.ok) {
      setV(confirmado.current);
      setEstado('error');
      setMsg(String(j?.error || 'No se pudo guardar. Prueba de nuevo.'));
      return;
    }
    const final = Number(j.score) || limpio;
    const movidos = (Array.isArray(j.movidos) ? j.movidos : []) as MovimientoCascada[];
    confirmado.current = final;
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
    const j = await post({ action: 'prioridad-al-perro', entidad, id });
    if (!j?.ok) { setEstado('error'); setMsg(String(j?.error || 'No se pudo.')); return; }
    setEstado('listo');
    setMsg('Se la devolviste a MaKo');
    onSoltado();
  };

  const guardando = estado === 'guardando';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <input
          type="range" min={1} max={100} value={v} disabled={guardando}
          onChange={(e) => setV(Number(e.target.value))}
          onPointerUp={() => void guardar(v)}
          onKeyUp={(e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key === 'PageUp' || e.key === 'PageDown') void guardar(v); }}
          aria-label={`Prioridad del ${entidad} (1 a 100)`}
          style={{ flex: 1, accentColor: color, cursor: guardando ? 'progress' : 'pointer', minWidth: 0 }}
        />
        <input
          type="number" min={1} max={100} value={v} disabled={guardando}
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
