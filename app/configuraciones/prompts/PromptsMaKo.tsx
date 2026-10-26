'use client';

// =============================================================================
// PromptsMaKo — la persona y los modos de MaKo, con su historial (Settings › Prompts, sólo el super admin)
// =============================================================================
// Era la pestaña «Prompts» de MaKo Context (ContextoTabs.tsx, /contexto), que se fue el 25/10/2026 (Martín, punto 13:
// «Elimina /contexto... Lo de "Configuración" entiendo que la mayoría de cosas allí las personaliza el propio usuario...
// Como tambien "prompts"»). Medido ese día: NO las personaliza cada usuario; esta pantalla y la de los prompts de cada tab
// (Configuraciones.tsx) eran el ÚNICO lugar donde se editan. Para que nada se pierda, se mudaron enteras a Settings,
// junto a «Método», con la misma puerta. Las MISMAS rutas (/api/mako/prompts) y el mismo guardado. «Fases» no vino:
// está deprecado (su dato sigue guardado en `mako.fase.*`).

import { useEffect, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type PromptModo = { key: string; label: string; current: string; isDefault: boolean; versions: Array<{ ts: string; text: string }> };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const area: CSSProperties = { ...input, minHeight: 92, resize: 'vertical', lineHeight: 1.5 };
const btnDark: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: '#14161B', color: '#F3F5F8', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' };

export function PromptsMaKo() {
  const [nucleo, setNucleo] = useState('');
  const [modos, setModos] = useState<PromptModo[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [verVers, setVerVers] = useState<string | null>(null);

  const cargar = () => fetch('/api/mako/prompts').then((r) => r.json()).then((j) => { setNucleo(j.nucleo ?? ''); setModos(j.modos ?? []); setDrafts(Object.fromEntries((j.modos ?? []).map((m: PromptModo) => [m.key, m.current]))); });
  useEffect(() => { cargar(); }, []);

  const guardar = async (modo: string) => { await fetch('/api/mako/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', modo, text: drafts[modo] ?? '' }) }); cargar(); };
  const restaurar = async (modo: string, ts: string) => { await fetch('/api/mako/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore', modo, ts }) }); setVerVers(null); cargar(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>Núcleo</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: 'var(--border)', color: 'var(--dim)' }}>se edita abajo, en los de cada pantalla</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--dim)', whiteSpace: 'pre-wrap', lineHeight: 1.55, fontFamily: MONO }}>{nucleo}</div>
      </div>

      {modos.map((m) => (
        <div key={m.key} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>{m.label}</span>
              {m.key === 'persona' && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: 'var(--accent-soft)', color: '#14161B' }}>en uso</span>}
              {!m.isDefault && <span style={{ fontSize: 11, color: 'var(--faint)' }}>editado</span>}
            </div>
            {m.versions.length > 0 && <button style={btnGhost} onClick={() => setVerVers((v) => (v === m.key ? null : m.key))}>Historial ({m.versions.length})</button>}
          </div>
          <textarea style={{ ...area, minHeight: m.key === 'persona' ? 200 : 90 }} value={drafts[m.key] ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [m.key]: e.target.value }))} />
          {verVers === m.key && (
            <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {m.versions.map((v) => (
                <div key={v.ts} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{v.ts.slice(0, 16).replace('T', ' ')}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--dim)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.text.slice(0, 90)}</span>
                  <button style={btnGhost} onClick={() => restaurar(m.key, v.ts)}>Restaurar</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button style={btnDark} onClick={() => guardar(m.key)}>Guardar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
