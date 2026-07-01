'use client';

// =============================================================================
// Configuraciones — editar TODOS los prompts de MaKo en un solo lugar
// =============================================================================
// Lista los prompts agrupados por feature. Para cada uno: su contexto (qué hace
// y qué cuidar), las variables {{slot}} disponibles, el editor, historial y
// "restaurar default". Lee/guarda en /api/mako/config-prompts.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MakoLogo } from '../_components/MakoBrand';
import { ConfirmDialog } from '../_components/ChatItemMenu';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type PromptVar = { name: string; desc: string };
type Version = { ts: string; text: string };
type Prompt = {
  key: string;
  label: string;
  context: string;
  kind: string;
  dynamic: boolean;
  variables: PromptVar[];
  scope: 'full' | 'static-only';
  sensitive: boolean;
  source: string;
  hasHistory: boolean;
  placeholder?: string;
  current: string;
  isDefault: boolean;
  versions: Version[];
};
type Grupo = { group: string; icon: string; blurb: string; prompts: Prompt[] };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const area: CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: MONO, fontSize: 12.5, lineHeight: 1.55, outline: 'none', resize: 'vertical' };
const input: CSSProperties = { width: '100%', maxWidth: 420, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const btnDark: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: '#14161B', color: '#F3F5F8', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' };
const chip = (extra?: CSSProperties): CSSProperties => ({ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, fontFamily: MONO, ...extra });

function Badge({ text, bg, fg, title }: { text: string; bg: string; fg: string; title?: string }) {
  return <span title={title} style={chip({ background: bg, color: fg })}>{text}</span>;
}

function PromptCard({ p, onSaved }: { p: Prompt; onSaved: () => void }) {
  const [draft, setDraft] = useState(p.current);
  const [verHist, setVerHist] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Re-sincroniza el draft cuando llega data nueva del server (tras guardar/reset).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(p.current); }, [p.current]);

  const dirty = draft !== p.current;

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch('/api/mako/config-prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? 'error');
      onSaved();
    } finally { setBusy(false); }
  };

  const guardar = async () => { await post({ action: 'save', key: p.key, text: draft }); setFlash('Guardado ✓'); setTimeout(() => setFlash(null), 1800); };
  const restaurar = async (ts: string) => { await post({ action: 'restore', key: p.key, ts }); setVerHist(false); };
  const reset = async () => { setConfirmReset(false); await post({ action: 'reset', key: p.key }); setFlash('Volvió al default ✓'); setTimeout(() => setFlash(null), 1800); };

  // Inserta un slot {{nombre}} en la posición del cursor del textarea.
  const insertVar = (name: string) => {
    const el = ref.current;
    const token = `{{${name}}}`;
    if (!el) { setDraft((d) => d + token); return; }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + token + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => { el.focus(); const pos = start + token.length; el.setSelectionRange(pos, pos); });
  };

  const minH = Math.min(420, Math.max(90, Math.round((draft.length || 0) / 8) + 70));

  return (
    <div style={{ ...card, ...(p.sensitive ? { borderColor: 'var(--warn)' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>{p.label}</span>
            {p.isDefault
              ? <Badge text="en default" bg="var(--surface-2)" fg="var(--faint)" title="Sin cambios respecto al código" />
              : <Badge text="editado" bg="var(--accent-soft)" fg="#14161B" title="Tiene un override guardado" />}
            {p.sensitive && <Badge text="⚠ delicado" bg="var(--warn-bg)" fg="var(--warn)" title="Define un esquema JSON o es una baranda: editar con cuidado" />}
            {p.dynamic && <Badge text="dinámico" bg="var(--surface-2)" fg="var(--dim)" title="Inyecta datos en runtime en los slots {{...}}" />}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 5 }}>{p.key}</div>
        </div>
        <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
          {flash && <span style={{ fontSize: 12.5, color: 'var(--good)', fontWeight: 600, alignSelf: 'center' }}>{flash}</span>}
          {p.hasHistory && p.versions.length > 0 && <button style={btnGhost} onClick={() => setVerHist((v) => !v)}>Historial ({p.versions.length})</button>}
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55, margin: '12px 0 0' }}>{p.context}</p>

      {p.sensitive && (
        <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 9, background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 12.5, lineHeight: 1.5 }}>
          Editá con cuidado: este prompt define la forma de la respuesta (o es una regla dura). Si rompés el JSON o borrás un {'{{slot}}'}, la función puede dejar de andar en silencio. Tenés “Restaurar default” acá abajo.
        </div>
      )}

      {p.variables.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 }}>Variables disponibles (clic para insertar) — no las borres</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {p.variables.map((vr) => (
              <button key={vr.name} title={vr.desc} onClick={() => insertVar(vr.name)} style={{ ...chip({ background: 'var(--surface-2)', color: 'var(--primary)', border: '1px solid var(--border)', cursor: 'pointer' }) }}>
                {`{{${vr.name}}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        ref={ref}
        style={{ ...area, minHeight: minH, marginTop: 12 }}
        value={draft}
        placeholder={p.placeholder ? `Ejemplo: ${p.placeholder}` : 'Vacío = usa el comportamiento por defecto.'}
        onChange={(e) => setDraft(e.target.value)}
      />

      {verHist && (
        <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {p.versions.map((vv) => (
            <div key={vv.ts} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{vv.ts.slice(0, 16).replace('T', ' ')}</span>
              <span style={{ fontSize: 12.5, color: 'var(--dim)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vv.text.slice(0, 90)}</span>
              <button style={btnGhost} onClick={() => restaurar(vv.ts)}>Restaurar</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <button style={{ ...btnGhost, opacity: p.isDefault || busy ? 0.5 : 1 }} disabled={p.isDefault || busy} onClick={() => setConfirmReset(true)}>Restaurar default</button>
        <button style={{ ...btnDark, opacity: !dirty || busy ? 0.55 : 1 }} disabled={!dirty || busy} onClick={guardar}>Guardar</button>
      </div>

      {confirmReset && (
        <ConfirmDialog
          titulo="¿Volver al default?"
          detalle={`"${p.label}" vuelve al texto original del código. Tu versión editada se descarta.`}
          confirmLabel="Restaurar default"
          danger
          onCancel={() => setConfirmReset(false)}
          onConfirm={reset}
        />
      )}
    </div>
  );
}

export function Configuraciones() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState<Record<string, boolean>>({});

  const cargar = () => {
    fetch('/api/mako/config-prompts')
      .then((r) => r.json())
      .then((j) => setGrupos(j.grupos ?? []))
      .finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); }, []);

  const filtrados = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return grupos;
    return grupos
      .map((g) => ({ ...g, prompts: g.prompts.filter((p) => (p.label + ' ' + p.context + ' ' + p.key).toLowerCase().includes(needle)) }))
      .filter((g) => g.prompts.length > 0);
  }, [grupos, q]);

  const total = grupos.reduce((n, g) => n + g.prompts.length, 0);
  const editados = grupos.reduce((n, g) => n + g.prompts.filter((p) => !p.isDefault).length, 0);

  const toggle = (g: string) => setAbierto((s) => ({ ...s, [g]: !(s[g] ?? true) }));
  const isOpen = (g: string) => abierto[g] ?? true;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <MakoLogo size={36} />
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Configuraciones</h1>
      </header>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 20px', maxWidth: 760 }}>
        Configurá a MaKo: cada prompt que hoy vive en el código se puede editar acá. Cada uno trae su contexto (qué hace y qué cuidar) y, si es dinámico, las variables {'{{slot}}'} que se reemplazan con datos reales. Lo que dejes sin tocar se comporta exactamente como hoy. Siempre podés volver al default.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar prompt (closing, validador, hook…)" />
        {!cargando && <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>{total} prompts · {editados} editados</span>}
      </div>

      {cargando ? (
        <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13, maxWidth: 880 }}>Cargando…</div>
      ) : filtrados.length === 0 ? (
        <div style={{ ...card, color: 'var(--faint)', fontSize: 14, maxWidth: 880 }}>Nada coincide con “{q}”.</div>
      ) : (
        <div style={{ maxWidth: 880, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {filtrados.map((g) => (
            <section key={g.group}>
              <button
                onClick={() => toggle(g.group)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11, padding: 0, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 12 }}
              >
                <span style={{ fontSize: 22 }}>{g.icon}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ fontWeight: 600, fontSize: 19, color: 'var(--ink)' }}>{g.group}</span>
                    <span style={chip({ background: 'var(--surface-2)', color: 'var(--faint)' })}>{g.prompts.length}</span>
                    <span style={{ color: 'var(--faint)', fontSize: 12 }}>{isOpen(g.group) ? '▾' : '▸'}</span>
                  </span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>{g.blurb}</span>
                </span>
              </button>
              {isOpen(g.group) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {g.prompts.map((p) => <PromptCard key={p.key} p={p} onSaved={cargar} />)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
