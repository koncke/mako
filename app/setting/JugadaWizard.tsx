'use client';

// =============================================================================
// JugadaWizard — "Nueva jugada" de la tab /setting (7 pasos, preguntas cerradas)
// =============================================================================
// ① a quién (etapa del funnel o secuencia existente) → ② objetivo → ③ gancho
// (lead magnet del Entregable primero, sugerencias de MaKo, o libre) →
// ④ preguntas de cualificación (las hereda el Setter IA) → ⑤ MaKo redacta →
// ⑥ prueba en vivo al admin → ⑦ aprobar y activar. Admin-only (la API rechaza
// al resto). Regla del repo: la IA facilita — opciones cerradas, nunca abierto.

import { useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import type { JugadaDto, Opcion, PasoJugada } from './SettingApp';
import type { Estrategia, Objetivo } from '@/lib/setting-estrategia';

const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 11, border: 'none', background: 'var(--ink)', color: 'var(--on-sidebar)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' };
const btnAccent: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const inp: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', lineHeight: 1.5, outline: 'none', boxSizing: 'border-box' };
const chipSel = (active: boolean): CSSProperties => ({ padding: '9px 15px', borderRadius: 11, cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border-strong)'), background: active ? 'var(--ink)' : 'var(--surface-2)', color: active ? 'var(--on-sidebar)' : 'var(--dim)' });

async function jpost<T>(b: unknown): Promise<T> {
  const r = await fetch('/api/setting/jugadas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  return r.json() as Promise<T>;
}

const TITULOS = ['', '¿A quién le hablamos?', '¿Qué buscamos?', '¿Con qué gancho?', 'Preguntas de cualificación', 'MaKo redacta', 'Probala en vivo', 'Aprobar y activar'];

export function JugadaWizard({ secuenciaId: secInicial, jugadas, objetivos, etapas, leadMagnets, onClose, onDone }: {
  secuenciaId: number | null;
  jugadas: JugadaDto[];
  objetivos: Opcion[];
  etapas: Opcion[];
  leadMagnets: Array<{ id: string; nombre: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const existente = secInicial != null ? jugadas.find((j) => j.id === secInicial) ?? null : null;
  const [paso, setPaso] = useState(existente ? 2 : 1);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Estrategia en construcción
  const [secuenciaId, setSecuenciaId] = useState<number | null>(secInicial);
  const [etapa, setEtapa] = useState(existente?.etapa ?? '');
  const [objetivo, setObjetivo] = useState<Objetivo | null>(existente?.estrategia?.objetivo ?? null);
  const [gancho, setGancho] = useState(existente?.estrategia?.gancho ?? '');
  const [leadMagnetId, setLeadMagnetId] = useState<string | null>(existente?.estrategia?.lead_magnet_id ?? null);
  const [preguntas, setPreguntas] = useState<string[]>(existente?.estrategia?.preguntas ?? []);
  const [pregNueva, setPregNueva] = useState('');
  const [sugerencias, setSugerencias] = useState<string[]>([]);

  // Redacción
  const [draft, setDraft] = useState<PasoJugada[] | null>(null);
  const [prueba, setPrueba] = useState<{ enviadosWa: number; enviadosEmail: number; avisos: string[] } | null>(null);

  const estrategia = (): Estrategia => ({
    objetivo: objetivo ?? 'agendar',
    gancho: gancho.trim() || null,
    lead_magnet_id: leadMagnetId,
    preguntas,
    notas: null,
    probada_at: existente?.estrategia?.probada_at ?? null,
  });

  // Asegura secuencia + estrategia persistidas (pasos ①-④ → antes de redactar).
  async function persistir(): Promise<number | null> {
    setErr(null);
    let id = secuenciaId;
    if (id == null) {
      const label = etapas.find((e) => e.value === etapa)?.label ?? etapa;
      const j = await jpost<{ ok: boolean; error?: string; secuenciaId?: number }>({ action: 'crear', etapa, nombre: `Jugada — ${label}` });
      if (!j.ok || !j.secuenciaId) { setErr(j.error || 'No se pudo crear la secuencia.'); return null; }
      id = j.secuenciaId; setSecuenciaId(id);
    }
    const g = await jpost<{ ok: boolean; error?: string }>({ action: 'guardar-estrategia', secuenciaId: id, estrategia: estrategia() });
    if (!g.ok) { setErr(g.error || 'No se pudo guardar la estrategia.'); return null; }
    return id;
  }

  async function sugerir(tipo: 'sugerir-gancho' | 'sugerir-preguntas') {
    setBusy(tipo); setErr(null);
    try {
      const etiqueta = etapas.find((e) => e.value === etapa)?.label ?? etapa;
      const j = await jpost<{ ok: boolean; error?: string; sugerencias?: string[] }>({ action: tipo, objetivo: objetivo ?? '', etapa: etiqueta });
      if (!j.ok) setErr(j.error || 'MaKo no pudo sugerir.');
      else setSugerencias(j.sugerencias ?? []);
    } finally { setBusy(null); }
  }

  async function redactar() {
    setBusy('redactar'); setErr(null);
    try {
      const id = await persistir();
      if (id == null) return;
      const r = await fetch('/api/mako/nutricion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar', secuenciaId: id }) });
      const j = await r.json();
      if (!j.ok) { setErr(j.error || 'MaKo no pudo redactar.'); return; }
      setDraft(j.pasos as PasoJugada[]);
    } finally { setBusy(null); }
  }

  // Guarda el copy que estás viendo (aplicar) — probar y activar parten de acá.
  async function guardarCopy(id: number): Promise<boolean> {
    const r = await fetch('/api/mako/nutricion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'aplicar', secuenciaId: id, pasos: draft }) });
    const j = await r.json();
    if (!j.ok) { setErr(j.error || 'No se pudo guardar el copy.'); return false; }
    return true;
  }

  async function probar() {
    if (secuenciaId == null || !draft) return;
    setBusy('probar'); setErr(null);
    try {
      if (!(await guardarCopy(secuenciaId))) return;
      const j = await jpost<{ ok: boolean; error?: string; enviadosWa?: number; enviadosEmail?: number; avisos?: string[] }>({ action: 'probar', secuenciaId });
      if (!j.ok) { setErr(j.error || 'La prueba no salió.'); return; }
      setPrueba({ enviadosWa: j.enviadosWa ?? 0, enviadosEmail: j.enviadosEmail ?? 0, avisos: j.avisos ?? [] });
    } finally { setBusy(null); }
  }

  async function activar() {
    if (secuenciaId == null || !draft) return;
    setBusy('activar'); setErr(null);
    try {
      if (!(await guardarCopy(secuenciaId))) return;
      const r = await fetch('/api/whatsapp/secuencias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: secuenciaId, activa: true }) });
      const j = await r.json();
      if (!j.ok) { setErr(j.error || 'El copy quedó guardado pero no se pudo activar. Probá de nuevo.'); return; }
      onDone();
    } finally { setBusy(null); }
  }

  const puedeSeguir =
    (paso === 1 && (etapa !== '' || secuenciaId != null)) ||
    (paso === 2 && objetivo != null) ||
    (paso === 3) || // gancho es opcional
    (paso === 4) || // preguntas opcionales
    (paso === 5 && draft != null) ||
    (paso === 6); // probar es recomendable, no obligatorio

  function editPaso(i: number, campo: 'asunto' | 'cuerpo', val: string) {
    setDraft((prev) => prev?.map((p, idx) => (idx === i ? { ...p, [campo]: val } : p)) ?? prev);
  }

  return (
    <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: '12px', color: 'var(--faint)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Jugada — paso {paso} de 7</div>
          <button onClick={onClose} disabled={busy != null} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--faint)', cursor: 'pointer', opacity: busy ? 0.4 : 1 }}>✕</button>
        </div>
        <div style={{ fontSize: '19px', fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>{TITULOS[paso]}</div>

        {err && <div style={{ margin: '0 0 12px', padding: '9px 12px', borderRadius: 9, fontSize: '13px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>}

        {/* ① a quién */}
        {paso === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '13px', color: 'var(--dim)' }}>La jugada se cuelga de una etapa de TU funnel: entra todo lead que esté parado ahí.</div>
            <Dropdown value={etapa} onChange={setEtapa} width="100%" ariaLabel="Etapa del funnel"
              options={[{ value: '', label: 'Elegí la etapa…' }, ...etapas]} />
          </div>
        )}

        {/* ② objetivo */}
        {paso === 2 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {objetivos.map((o) => (
              <button key={o.value} onClick={() => setObjetivo(o.value as Objetivo)} style={chipSel(objetivo === o.value)}>{o.label}</button>
            ))}
          </div>
        )}

        {/* ③ gancho */}
        {paso === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {leadMagnets.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--faint)', marginBottom: 8 }}>Tus lead magnets (de la fábrica de creativos):</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {leadMagnets.map((l) => (
                    <button key={l.id} onClick={() => { setLeadMagnetId(l.id); setGancho(l.nombre); }} style={chipSel(leadMagnetId === l.id)}>🧲 {l.nombre}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => void sugerir('sugerir-gancho')} disabled={busy != null} style={btnAccent}>{busy === 'sugerir-gancho' ? 'Pensando…' : '✨ MaKo sugiere ganchos'}</button>
              <span style={{ fontSize: '12px', color: 'var(--faint)' }}>o escribilo abajo (opcional)</span>
            </div>
            {sugerencias.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sugerencias.map((s, i) => (
                  <button key={i} onClick={() => { setGancho(s); setLeadMagnetId(null); }} style={chipSel(gancho === s)}>{s}</button>
                ))}
              </div>
            )}
            <input value={gancho} onChange={(e) => { setGancho(e.target.value); setLeadMagnetId(null); }} placeholder="Gancho de la jugada (ej: guía gratuita de 5 pasos)" style={inp} />
          </div>
        )}

        {/* ④ preguntas */}
        {paso === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '13px', color: 'var(--dim)' }}>Las preguntas cualifican al lead por mensajes. MaKo las siembra en el copy — y son la base del Setter IA que viene.</div>
            <button onClick={() => void sugerir('sugerir-preguntas')} disabled={busy != null} style={{ ...btnAccent, alignSelf: 'flex-start' }}>{busy === 'sugerir-preguntas' ? 'Pensando…' : '✨ MaKo sugiere preguntas'}</button>
            {sugerencias.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sugerencias.filter((s) => !preguntas.includes(s)).map((s, i) => (
                  <button key={i} onClick={() => setPreguntas((p) => [...p, s])} style={{ ...btnGhost, textAlign: 'left' }}>+ {s}</button>
                ))}
              </div>
            )}
            {preguntas.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {preguntas.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <span style={{ flex: 1, fontSize: '13px', color: 'var(--ink)' }}>{i + 1}. {p}</span>
                    <button onClick={() => setPreguntas((prev) => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={pregNueva} onChange={(e) => setPregNueva(e.target.value)} placeholder="Agregar una pregunta propia…" style={{ ...inp, flex: 1 }}
                onKeyDown={(e) => { if (e.key === 'Enter' && pregNueva.trim()) { setPreguntas((p) => [...p, pregNueva.trim()]); setPregNueva(''); } }} />
              <button onClick={() => { if (pregNueva.trim()) { setPreguntas((p) => [...p, pregNueva.trim()]); setPregNueva(''); } }} style={btnGhost}>Agregar</button>
            </div>
          </div>
        )}

        {/* ⑤ redacción */}
        {paso === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!draft && (
              <button onClick={() => void redactar()} disabled={busy != null} style={{ ...btnDark, alignSelf: 'flex-start' }}>
                {busy === 'redactar' ? 'MaKo está escribiendo…' : '✍️ MaKo redacta los mensajes'}
              </button>
            )}
            {draft?.map((p, i) => (
              <div key={i} style={{ padding: 13, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--faint)', marginBottom: 8 }}>
                  {p.canal === 'email' ? '✉️ Email' : `💬 WhatsApp${p.proveedor === 'no_oficial' ? ' (no oficial)' : ''}`} · mensaje {p.orden}
                </div>
                {p.canal === 'email' && (
                  <input value={p.asunto ?? ''} onChange={(e) => editPaso(i, 'asunto', e.target.value)} placeholder="Asunto" style={{ ...inp, fontWeight: 600, marginBottom: 8 }} />
                )}
                <textarea value={p.cuerpo} onChange={(e) => editPaso(i, 'cuerpo', e.target.value)} rows={p.canal === 'email' ? 5 : 3} style={{ ...inp, resize: 'vertical' }} />
              </div>
            ))}
            {draft && (
              <button onClick={() => void redactar()} disabled={busy != null} style={{ ...btnGhost, alignSelf: 'flex-start' }}>{busy === 'redactar' ? 'Reescribiendo…' : '↻ Reescribir'}</button>
            )}
          </div>
        )}

        {/* ⑥ prueba en vivo */}
        {paso === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '13px', color: 'var(--dim)' }}>Te mando la secuencia completa a TU teléfono y mail (los de Perfil), marcada [PRUEBA]. No toca ningún lead ni cuenta en las métricas.</div>
            <button onClick={() => void probar()} disabled={busy != null} style={{ ...btnDark, alignSelf: 'flex-start' }}>{busy === 'probar' ? 'Enviando la prueba…' : '📲 Probame la secuencia'}</button>
            {prueba && (
              <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--good)', background: 'var(--good-bg)', color: 'var(--good)', fontSize: '13px' }}>
                Prueba enviada: {prueba.enviadosWa} WhatsApp · {prueba.enviadosEmail} email. Revisá tu teléfono/mail.
                {prueba.avisos.length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--dim)' }}>
                    {prueba.avisos.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* ⑦ activar */}
        {paso === 7 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '13.5px', color: 'var(--dim)', lineHeight: 1.6 }}>
              Al activar, la jugada queda viva: el motor inscribe a los leads de la etapa y manda con el anti-ban de siempre.
              Los pasos de WhatsApp oficial no salen hasta que Meta apruebe su plantilla, y nada sale si el «Envío real» del canal está apagado.
            </div>
            <button onClick={() => void activar()} disabled={busy != null} style={{ ...btnDark, alignSelf: 'flex-start' }}>{busy === 'activar' ? 'Activando…' : '✓ Aprobar y activar la jugada'}</button>
          </div>
        )}

        {/* Navegación */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button onClick={() => { setSugerencias([]); setPaso((p) => Math.max(existente ? 2 : 1, p - 1)); }} disabled={busy != null || paso === (existente ? 2 : 1)} style={{ ...btnGhost, opacity: paso === (existente ? 2 : 1) ? 0.4 : 1 }}>← Atrás</button>
          {paso < 7 && (
            <button onClick={() => { setSugerencias([]); setPaso((p) => p + 1); }} disabled={busy != null || !puedeSeguir} style={{ ...btnDark, opacity: puedeSeguir ? 1 : 0.4 }}>Seguir →</button>
          )}
        </div>
      </div>
    </div>
  );
}
