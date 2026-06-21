'use client';

// =============================================================================
// MakoButton / ChartIA — botón "✨ MaKo" + modal de conclusiones sobre un gráfico
// =============================================================================
// MakoButton: solo el botón ✨ MaKo + el modal (se mete en el header de cualquier
// sección/gráfico existente). ChartIA: header (título + MakoButton) + el gráfico,
// para secciones nuevas. Antes de abrir = estrellita ✨ (el logo no se lee chico);
// al abrir = logo de MaKo en el modal + chat (MakoChat) con el gráfico aislado.

import { useState, type ReactNode } from 'react';
import { MakoChat } from './MakoChat';
import { MakoLogo, MakoStar, MakoWord } from './MakoBrand';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

export function MakoButton({
  chartKey,
  titulo,
  contexto,
  sugerencias,
  chart,
}: {
  chartKey: string;
  titulo: string;
  contexto: string;
  sugerencias?: string[];
  chart?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Conclusiones con MaKo"
        style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px', borderRadius: 999, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(23,21,17,.18)' }}
      >
        <MakoStar size={14} /><MakoWord>MaKo</MakoWord>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto', fontFamily: SANS }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 940, height: 'calc(100vh - 80px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 24px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <MakoLogo size={32} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Conclusiones con MaKo</div>
                  <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <MakoChat chartKey={chartKey} titulo={titulo} contexto={contexto} sugerencias={sugerencias} chart={chart} sidebar />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ChartIA({
  chartKey,
  titulo,
  contexto,
  sugerencias,
  children,
}: {
  chartKey: string;
  titulo: string;
  contexto: string;
  sugerencias?: string[];
  children: ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>{titulo}</h2>
        <MakoButton chartKey={chartKey} titulo={titulo} contexto={contexto} sugerencias={sugerencias} chart={children} />
      </div>
      {children}
    </div>
  );
}
