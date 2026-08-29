'use client';

// =============================================================================
// MakoTab — "Pregúntale a MaKo": chat general + navegar todos los chats
// =============================================================================
// Izquierda: chat general nuevo + lista de TODAS las conversaciones (de cada
// gráfico). Derecha: el chat seleccionado (MakoChat).

import { useEffect, useState } from 'react';
import { MakoChat } from '../_components/MakoChat';
import { MakoIntro } from '../_components/MakoBrand';
import { Icon } from '../_components/icons';
import { ChatItemMenu } from '../_components/ChatItemMenu';
import { chartLabel } from '@/lib/chart-registry';
import { fmtDDMMYYYY } from '@/lib/date-utils';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Session = { id: number; chart_key: string; titulo: string | null; updated_at: string; pinned?: boolean };
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
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  const cargar = () => {
    fetch('/api/chart-insights?all=1')
      .then((r) => r.json())
      .then((j) => setSessions(j.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); }, []);
  useEffect(() => { const t = setTimeout(() => setIntro(false), 1500); return () => clearTimeout(t); }, []);

  // Renombrar / pinear / archivar / eliminar un chat desde la lista.
  const accion = async (a: 'rename' | 'pin' | 'archive' | 'delete', id: number, extra: { valor?: boolean; titulo?: string } = {}) => {
    await fetch('/api/chart-insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: a, sessionId: id, ...extra }) });
    cargar();
    if ((a === 'delete' || a === 'archive') && sel.kind === 'session' && sel.session.id === id) setSel({ kind: 'general' });
  };

  const itemWrap = (activo: boolean) => ({
    padding: '11px 14px', borderBottom: '1px solid var(--border)',
    background: activo ? 'var(--surface-2)' : 'transparent',
  });
  const selBtn = { display: 'block', flex: 1, minWidth: 0, textAlign: 'left' as const, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: SANS };
  const inpStyle = { width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, outline: 'none' } as const;

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '24px 28px 20px' }}>
      {intro && <MakoIntro />}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flex: 'none' }}>
        <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="mako" size={34} /></span>
        <h1 style={{ fontWeight: 600, fontSize: 38, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Pregúntale a MaKo</h1>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '290px 1fr', gap: 16 }}>
        {/* lista de chats */}
        <aside style={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)', flex: 'none' }}>
            <button type="button" onClick={() => setSel({ kind: 'general' })} style={{ width: '100%', padding: '11px 14px', borderRadius: 11, border: '1px solid var(--primary)', background: sel.kind === 'general' ? 'var(--primary)' : 'var(--primary-bg)', color: sel.kind === 'general' ? '#fff' : 'var(--primary)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Nuevo chat general</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {cargando ? (
              <div style={{ padding: '14px', fontSize: 13, color: 'var(--faint)', fontFamily: MONO }}>Cargando…</div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: '14px', fontSize: 13, color: 'var(--faint)' }}>Todavía no hay chats. Empieza uno o abre el botón de MaKo de cualquier gráfico.</div>
            ) : (
              sessions.map((s) => {
                const activo = sel.kind === 'session' && sel.session.id === s.id;
                return (
                  <div key={s.id} style={itemWrap(activo)}>
                    {editId === s.id ? (
                      <input
                        autoFocus
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={() => { if (editVal.trim()) accion('rename', s.id, { titulo: editVal.trim() }); setEditId(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { if (editVal.trim()) accion('rename', s.id, { titulo: editVal.trim() }); setEditId(null); } if (e.key === 'Escape') setEditId(null); }}
                        style={inpStyle}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <button type="button" onClick={() => setSel({ kind: 'session', session: s })} style={selBtn}>
                          <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: activo ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.pinned && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Fijado · </span>}{s.titulo || 'Chat'}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 3 }}>
                            <span style={{ fontSize: 11.5, color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chartLabel(s.chart_key)}</span>
                            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none' }}>{fmtDDMMYYYY(s.updated_at.slice(0, 10))}</span>
                          </div>
                        </button>
                        <ChatItemMenu
                          pinned={s.pinned}
                          onRename={() => { setEditId(s.id); setEditVal(s.titulo || ''); }}
                          onPin={() => accion('pin', s.id, { valor: !s.pinned })}
                          onArchive={() => accion('archive', s.id, { valor: true })}
                          onDelete={() => accion('delete', s.id)}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* chat */}
        <section style={{ minHeight: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {sel.kind === 'general' ? (
            <MakoChat key="general" chartKey="mako-general" titulo="Pregúntale a MaKo" sugerencias={SUGERENCIAS_GENERAL} />
          ) : (
            <MakoChat key={sel.session.id} chartKey={sel.session.chart_key} titulo={chartLabel(sel.session.chart_key)} initialSessionId={sel.session.id} />
          )}
        </section>
      </div>
    </main>
  );
}
