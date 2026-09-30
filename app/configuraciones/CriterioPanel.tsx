'use client';

// =============================================================================
// CriterioPanel — el criterio de compromisos que MaKo aplica a cada reunión
// =============================================================================
// Un textarea y un botón. Lo que hace caro a este panel no es la pantalla: es que
// hasta hoy el criterio NO SE PODÍA CARGAR desde ningún lado (ver criterio-actions.ts).
//
// El texto que se dibuja es corto a propósito. El porqué de cada regla vive en el
// criterio mismo, que es justamente lo que se edita acá.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getCriterioAction, saveCriterioAction } from './criterio-actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const primaryBtn: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };

export function CriterioPanel() {
  const [texto, setTexto] = useState('');
  const [tope, setTope] = useState(24000);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  // Lo guardado, para saber si hay cambios sin guardar. Un botón que se puede apretar
  // sobre un texto idéntico al guardado no dice nada de si hay algo por hacer.
  const guardado = useRef('');

  useEffect(() => {
    let vivo = true;
    getCriterioAction()
      .then((d) => { if (!vivo) return; setTexto(d.texto); guardado.current = d.texto; setTope(d.tope); })
      .catch(() => { if (vivo) setAviso('No pude leer el criterio.'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  const sucio = texto !== guardado.current;

  async function guardar() {
    setGuardando(true);
    setAviso('');
    const r = await saveCriterioAction(texto).catch(() => ({ ok: false, error: 'No se pudo guardar.' }));
    setGuardando(false);
    if (!r.ok) { setAviso(r.error || 'No se pudo guardar.'); return; }
    guardado.current = texto;
    setAviso('Guardado');
  }

  if (cargando) return <p style={{ fontSize: 13.5, color: 'var(--dim)', fontFamily: SANS }}>Cargando…</p>;

  return (
    <div style={{ maxWidth: 860 }}>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 18px', fontFamily: SANS }}>
        Con esto MaKo decide qué de cada reunión es un compromiso tuyo y qué es ruido. Sin criterio, carga todo lo que parezca una tarea.
      </p>

      <div style={card}>
        <textarea
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setAviso(''); }}
          spellCheck={false}
          placeholder="Qué cuenta como compromiso, qué no, y con qué reglas."
          style={{
            width: '100%', minHeight: 420, resize: 'vertical', boxSizing: 'border-box',
            padding: 14, borderRadius: 11, border: '1px solid var(--border-strong)',
            background: 'var(--surface-2)', color: 'var(--ink)',
            fontFamily: MONO, fontSize: 12.5, lineHeight: 1.6,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" onClick={guardar} disabled={guardando || !sucio} style={{ ...primaryBtn, opacity: guardando || !sucio ? 0.45 : 1, cursor: guardando || !sucio ? 'default' : 'pointer' }}>
            {guardando ? 'Guardando…' : 'Guardar criterio'}
          </button>
          <span style={{ fontSize: 12, color: texto.length > tope ? 'var(--bad)' : 'var(--faint)', fontFamily: MONO }}>
            {texto.length.toLocaleString('es')} / {tope.toLocaleString('es')}
          </span>
          {aviso && <span style={{ fontSize: 13, color: aviso === 'Guardado' ? 'var(--good)' : 'var(--bad)', fontFamily: SANS }}>{aviso}</span>}
        </div>
      </div>
    </div>
  );
}
