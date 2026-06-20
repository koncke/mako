'use client';

// =============================================================================
// MakoTab — "Preguntale a MaKo": chat general + navegar todos los chats
// =============================================================================
// Izquierda: chat general nuevo + lista de TODAS las conversaciones (de cada
// gráfico). Derecha: el chat seleccionado (MakoChat).

import { useEffect, useState } from 'react';
import { MakoChat } from '../_components/MakoChat';
import { MakoLogo, MakoIntro } from '../_components/MakoBrand';
import { chartLabel } from '@/lib/chart-registry';
import { fmtDDMMYYYY } from '@/lib/date-utils';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Session = { id: number; chart_key: string; titulo: string | null; updated_at: string };
type Sel = { kind: 'general' } | { kind: 'session'; session: Session };

const SUGERENCIAS_GENERAL = [
  '¿Cómo viene el negocio este mes?',
  '¿Dónde está mi cuello de botella?',
  '¿En qué enfoco la semana?',
  '¿El gasto en ads está rindiendo?',
];

export function MakoTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sel, setSel] = useState<Sel>({ kind: 'general' });
  const [cargando, setCargando] = useState(true);
  // Loader gigante de bienvenida: aparece al entrar y se va solo (lo justo).
  const [intro, setIntro] = useState(true);

  const cargar = () => {
    fetch('/api/chart-insights?all=1')
      .then((r) => r.json())
      .then((j) => setSessions(j.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); }, []);
  useEffect(() => { const t = setTimeout(() => setIntro(false), 1500); return () => clearTimeout(t); }, []);

  const itemStyle = (activo: boolean) => ({
    display: 'block', width: '100%', textAlign: 'left' as const, padding: '11px 14px',
    background: activo ? 'var(--surface-2)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
    cursor: 'pointer', fontFamily: SANS,
  });

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '24px 28px 20px' }}>
      {intro && <MakoIntro />}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flex: 'none' }}>
        <MakoLogo size={36} />
        <h1 style={{ fontWeight: 600, fontSize: 38, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Preguntale a MaKo</h1>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '290px 1fr', gap: 16 }}>
        {/* lista de chats */}
        <aside style={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)', flex: 'none' }}>
            <button type="button" onClick={() => setSel({ kind: 'general' })} style={{ width: '100%', padding: '11px 14px', borderRadius: 11, border: '1px solid var(--accent)', background: sel.kind === 'general' ? 'var(--accent-soft)' : 'rgba(200,135,12,.08)', color: sel.kind === 'general' ? '#171511' : '#9A6A09', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Nuevo chat general</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {cargando ? (
              <div style={{ padding: '14px', fontSize: 13, color: 'var(--faint)', fontFamily: MONO }}>Cargando…</div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: '14px', fontSize: 13, color: 'var(--faint)' }}>Todavía no hay chats. Empezá uno o abrí el ✨ MaKo de cualquier gráfico.</div>
            ) : (
              sessions.map((s) => {
                const activo = sel.kind === 'session' && sel.session.id === s.id;
                return (
                  <button key={s.id} type="button" onClick={() => setSel({ kind: 'session', session: s })} style={itemStyle(activo)}>
                    <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: activo ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.titulo || 'Chat'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chartLabel(s.chart_key)}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>{fmtDDMMYYYY(s.updated_at.slice(0, 10))}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* chat */}
        <section style={{ minHeight: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {sel.kind === 'general' ? (
            <MakoChat key="general" chartKey="mako-general" titulo="Preguntale a MaKo" sugerencias={SUGERENCIAS_GENERAL} />
          ) : (
            <MakoChat key={sel.session.id} chartKey={sel.session.chart_key} titulo={chartLabel(sel.session.chart_key)} initialSessionId={sel.session.id} />
          )}
        </section>
      </div>
    </main>
  );
}
