'use client';

// =============================================================================
// AvisoEditor — «cómo quiero que me llegue ESTE aviso»
// =============================================================================
// Se abre debajo de la fila del aviso, dentro de la misma pantalla: es una
// preferencia de esa fila, no otro lugar al que ir.
//
// Dos cosas, y nada más:
//   · QUÉ DICE  → la referencia que MaKo usa para redactar. Vacía = la escribe él.
//   · INSISTIR  → que vuelva hasta que alguien conteste en el grupo.
//
// El DISPARADOR no se edita acá, y el subtítulo de la fila ya dice cuál es. Cada
// aviso existe porque pasa algo concreto y ese enganche está cableado en su
// webhook; cambiárselo no lo configura, lo convierte en otro aviso. Para armar uno
// con su propio disparador está el FLUJO, que elige entre los eventos que sí tienen
// dónde engancharse.

import { useEffect, useState, type CSSProperties } from 'react';
import { INSISTIR_MAX_VECES, INSISTIR_MIN_MINUTOS, INSISTIR_VENTANA } from '@/lib/flujos-tipos';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Insistir = { activo: boolean; cadaMin: number; veces: number };

// Los intervalos que se ofrecen. El mínimo sale del techo del producto, no de acá.
const CADA = [
  { min: INSISTIR_MIN_MINUTOS, label: '30 min' },
  { min: 60, label: '1 h' },
  { min: 120, label: '2 h' },
  { min: 240, label: '4 h' },
];

export function AvisoEditor({ id, titulo, onCerrar }: { id: string; titulo: string; onCerrar: () => void }) {
  const [texto, setTexto] = useState('');
  const [insistir, setInsistir] = useState<Insistir>({ activo: false, cadaMin: 60, veces: 3 });
  const [cargando, setCargando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/perfil/aviso?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => { if (vivo && j.ok) { setTexto(j.texto ?? ''); setInsistir(j.insistir); } })
      .catch(() => { /* se edita igual: lo que no cargó no se pisa hasta que guarde */ })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [id]);

  async function guardar() {
    setBusy(true);
    setFlash(null);
    try {
      const j = await (await fetch('/api/perfil/aviso', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, texto, insistir }),
      })).json();
      if (!j.ok) throw new Error(j.error || 'no se pudo guardar');
      setTexto(j.texto ?? texto);
      // Vuelve YA recortado por el techo: si pidió más, se ve lo que quedó.
      setInsistir(j.insistir);
      setFlash('✓ Guardado');
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  if (cargando) return <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--faint)' }}>Cargando…</div>;

  const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', display: 'block', marginBottom: 5 };
  const pill = (on: boolean): CSSProperties => ({
    padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: SANS,
    border: `1px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`,
    background: on ? 'rgba(200,135,12,.12)' : 'var(--surface)',
    color: on ? 'var(--accent)' : 'var(--dim)',
  });

  return (
    <div style={{ marginTop: 12, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      <label style={lbl}>Qué dice</label>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder="Lo escribe MaKo. Si querés que diga algo en particular, escribilo acá."
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontFamily: SANS, lineHeight: 1.5, resize: 'vertical' }}
      />
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 5, lineHeight: 1.45 }}>
        Es una guía, no un molde: MaKo la adapta con los datos reales de cada caso.
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => setInsistir((p) => ({ ...p, activo: !p.activo }))}
          aria-pressed={insistir.activo}
          style={pill(insistir.activo)}
        >
          {insistir.activo ? '✓ ' : ''}Insistir hasta que alguien conteste
        </button>

        {insistir.activo && (
          <div style={{ marginTop: 12, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <label style={lbl}>Cada cuánto</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {CADA.map((c) => (
                  <button key={c.min} type="button" onClick={() => setInsistir((p) => ({ ...p, cadaMin: c.min }))} aria-pressed={insistir.cadaMin === c.min} style={pill(insistir.cadaMin === c.min)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={lbl}>Cuántas veces</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {Array.from({ length: INSISTIR_MAX_VECES }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" onClick={() => setInsistir((p) => ({ ...p, veces: n }))} aria-pressed={insistir.veces === n} style={pill(insistir.veces === n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {insistir.activo && (
          // El límite se DICE, no se esconde: que se entienda por qué no hay un «10».
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 10, lineHeight: 1.5 }}>
            Se corta apenas alguien escribe «ok» en el grupo. Entre las {INSISTIR_VENTANA.hasta} y las {INSISTIR_VENTANA.desde} no
            manda nada: espera a la mañana. El máximo es {INSISTIR_MAX_VECES} mensajes cada {INSISTIR_MIN_MINUTOS} minutos —
            más que eso, WhatsApp puede bloquear tu número.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={busy}
          style={{ padding: '8px 15px', borderRadius: 9, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
        >
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onCerrar} style={{ border: 0, background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Cerrar
        </button>
        {flash && (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: flash.startsWith('✓') ? 'var(--good)' : 'var(--bad)' }}>{flash}</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--faint)', fontFamily: MONO }}>{titulo}</span>
      </div>
    </div>
  );
}
