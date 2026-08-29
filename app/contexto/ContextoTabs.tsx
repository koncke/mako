'use client';

// =============================================================================
// ContextoTabs — Conocimiento (RAG) · Fases · Prompts
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import { Icon } from '../_components/icons';
import { ConfirmDialog } from '../_components/ChatItemMenu';
import { Configuraciones } from '../configuraciones/Configuraciones';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Estado = 'indexado' | 'pendiente' | 'error';
type Entry = { id: number; titulo: string; categoria: string | null; cuerpo: string; activo: boolean; estado: Estado; error: string | null; updated_at: string };
type Fase = { key: string; label: string; ejemplo: string };
type PromptModo = { key: string; label: string; current: string; isDefault: boolean; versions: Array<{ ts: string; text: string }> };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const area: CSSProperties = { ...input, minHeight: 92, resize: 'vertical', lineHeight: 1.5 };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: '#14161B', color: '#F3F5F8', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' };

function EstadoBadge({ estado, error }: { estado: Estado; error: string | null }) {
  const map: Record<Estado, { t: string; bg: string; fg: string }> = {
    indexado: { t: 'Indexado', bg: 'var(--good-bg)', fg: 'var(--good)' },
    pendiente: { t: 'Pendiente', bg: 'var(--warn-bg)', fg: 'var(--warn)' },
    error: { t: 'Error', bg: 'var(--bad-bg)', fg: 'var(--bad)' },
  };
  const m = map[estado];
  return <span title={error ?? undefined} style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: m.bg, color: m.fg }}>{m.t}</span>;
}

// ── Conocimiento ─────────────────────────────────────────────────────────────
function KnowledgeTab() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cargando, setCargando] = useState(true);
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Entry | null>(null);
  const [del, setDel] = useState<Entry | null>(null);

  const cargar = () => { fetch('/api/mako/knowledge').then((r) => r.json()).then((j) => setEntries(j.entries ?? [])).finally(() => setCargando(false)); };
  useEffect(() => { cargar(); }, []);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try { await fetch('/api/mako/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); cargar(); }
    finally { setBusy(false); }
  };
  const agregar = async () => { if (!titulo.trim()) return; await post({ action: 'create', titulo, categoria: categoria || null, cuerpo }); setTitulo(''); setCategoria(''); setCuerpo(''); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 14 }}>Agregar entrada de metodología</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, marginBottom: 12 }}>
          <div><label style={labelStyle}>Título</label><input style={input} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Framework de anuncio ganador" /></div>
          <div><label style={labelStyle}>Categoría</label><input style={input} value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ads · Oferta · Funnel…" /></div>
        </div>
        <label style={labelStyle}>Cuerpo</label>
        <textarea style={area} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} placeholder="La metodología, en tus palabras. MaKo la usa para responder." />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button style={{ ...btnDark, opacity: busy || !titulo.trim() ? 0.55 : 1 }} disabled={busy || !titulo.trim()} onClick={agregar}>Agregar</button>
        </div>
      </div>

      {cargando ? (
        <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando…</div>
      ) : entries.length === 0 ? (
        <div style={{ ...card, color: 'var(--faint)', fontSize: 14 }}>
          Todavía no hay conocimiento cargado.
        </div>
      ) : entries.map((e) => (
        <div key={e.id} style={card}>
          {edit?.id === e.id ? (
            <EditEntry entry={e} onCancel={() => setEdit(null)} onSave={async (f) => { setEdit(null); await post({ action: 'update', id: e.id, ...f }); }} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>{e.titulo}</span>
                    <EstadoBadge estado={e.estado} error={e.error} />
                    {!e.activo && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--faint)' }}>Inactiva</span>}
                  </div>
                  {e.categoria && <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--accent)', marginTop: 4 }}>{e.categoria}</div>}
                </div>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 10, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{e.cuerpo}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button style={btnGhost} onClick={() => post({ action: 'update', id: e.id, activo: !e.activo })}>{e.activo ? 'Desactivar' : 'Activar'}</button>
                <button style={btnGhost} onClick={() => setEdit(e)}>Editar</button>
                <button style={btnGhost} onClick={() => post({ action: 'reindex', id: e.id })}>Reindexar</button>
                <button style={{ ...btnGhost, color: 'var(--bad)' }} onClick={() => setDel(e)}>Eliminar</button>
              </div>
            </>
          )}
        </div>
      ))}

      {del && (
        <ConfirmDialog
          titulo="¿Eliminar esta entrada?"
          detalle={`"${del.titulo}" se borra del conocimiento de MaKo.`}
          confirmLabel="Eliminar"
          danger
          onCancel={() => setDel(null)}
          onConfirm={() => { const id = del.id; setDel(null); post({ action: 'delete', id }); }}
        />
      )}
    </div>
  );
}

function EditEntry({ entry, onCancel, onSave }: { entry: Entry; onCancel: () => void; onSave: (f: { titulo: string; categoria: string | null; cuerpo: string }) => void }) {
  const [titulo, setTitulo] = useState(entry.titulo);
  const [categoria, setCategoria] = useState(entry.categoria ?? '');
  const [cuerpo, setCuerpo] = useState(entry.cuerpo);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, marginBottom: 12 }}>
        <div><label style={labelStyle}>Título</label><input style={input} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div><label style={labelStyle}>Categoría</label><input style={input} value={categoria} onChange={(e) => setCategoria(e.target.value)} /></div>
      </div>
      <label style={labelStyle}>Cuerpo</label>
      <textarea style={area} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6 }}>Solo se re-indexa si cambia el cuerpo. Editar título o categoría no re-embebe.</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button style={btnGhost} onClick={onCancel}>Cancelar</button>
        <button style={btnDark} onClick={() => onSave({ titulo, categoria: categoria || null, cuerpo })}>Guardar</button>
      </div>
    </div>
  );
}

// ── Fases ────────────────────────────────────────────────────────────────────
function FasesTab() {
  const [fases, setFases] = useState<Fase[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => { fetch('/api/mako/fases').then((r) => r.json()).then((j) => { setFases(j.fases ?? []); setValores(j.valores ?? {}); }); }, []);

  const guardar = async (key: string) => {
    await fetch('/api/mako/fases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value: valores[key] ?? '' }) });
    setSaved(key); setTimeout(() => setSaved((s) => (s === key ? null : s)), 1800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0 }}>Para cada sección, qué tiene que mirar y hacer MaKo ahí. Si lo dejas vacío, MaKo se comporta como hoy.</p>
      {fases.map((f) => (
        <div key={f.key} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>{f.label}</span>
            {saved === f.key && <span style={{ fontSize: 12, color: 'var(--good)', fontWeight: 600 }}>Guardado ✓</span>}
          </div>
          <textarea style={area} value={valores[f.key] ?? ''} placeholder={f.ejemplo} onChange={(e) => setValores((v) => ({ ...v, [f.key]: e.target.value }))} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button style={btnDark} onClick={() => guardar(f.key)}>Guardar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Prompts ──────────────────────────────────────────────────────────────────
function PromptsTab() {
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
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: 'var(--border)', color: 'var(--dim)' }}>editable en Configuraciones</span>
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

// ── Shell ────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'conocimiento', label: 'Conocimiento' },
  { key: 'fases', label: 'Fases' },
  { key: 'prompts', label: 'Prompts' },
  { key: 'config', label: 'Configuración' },
] as const;

export function ContextoTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('conocimiento');
  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="contexto" size={34} /></span>
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Contexto de MaKo</h1>
      </header>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 22px', maxWidth: 720 }}>Lo que MaKo sabe del negocio. Todo es aditivo: lo que dejes vacío no cambia su comportamiento actual.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 22, borderBottom: '1px solid var(--border)' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS, fontSize: 14.5, fontWeight: tab === t.key ? 600 : 500, color: tab === t.key ? 'var(--ink)' : 'var(--dim)', borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -1 }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 880 }}>
        {tab === 'conocimiento' && <KnowledgeTab />}
        {tab === 'fases' && <FasesTab />}
        {tab === 'prompts' && <PromptsTab />}
        {tab === 'config' && <Configuraciones embedded />}
      </div>
    </main>
  );
}
