'use client';

// =============================================================================
// PerfilTabs — "Perfil" (datos del usuario) · "Notificaciones" (preferencias)
// =============================================================================
// Lee/guarda en /api/perfil. La tab Notificaciones también gestiona la plantilla
// de WhatsApp (reporte_mako) vía /api/perfil/plantilla.

import { useEffect, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { MakoLogo } from '../_components/MakoBrand';
import { Dropdown } from '../components/Dropdown';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Perfil = { nombre: string; email: string; telefono: string; cargo: string; timezone: string; avatarUrl: string };
type CanalPrefs = { activo: boolean; wa: boolean; telegram: boolean; email: boolean };
type Secciones = { semaforo: boolean; ads: boolean; wins: boolean; pendientes: boolean };
type NotifPrefs = { horario: CanalPrefs; diario: CanalPrefs; semanal: CanalPrefs; secciones: Secciones };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };

const TZ_OPTS = [
  { value: 'America/Tijuana', label: 'Tijuana (PT)' },
  { value: 'America/Hermosillo', label: 'Hermosillo (MST)' },
  { value: 'America/Mexico_City', label: 'CDMX / Monterrey (CT)' },
  { value: 'America/New_York', label: 'Nueva York (ET)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET)' },
];

// ── Controles ─────────────────────────────────────────────────────────────────
function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width: 44, height: 25, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 2, background: on ? 'var(--accent)' : 'var(--border-strong)', transition: 'background .15s', flex: 'none' }}>
      <span style={{ display: 'block', width: 21, height: 21, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(19px)' : 'none', transition: 'transform .15s' }} />
    </button>
  );
}

function ToggleRow({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <Switch on={on} onChange={onChange} />
    </div>
  );
}

function Chip({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      style={{ padding: '6px 13px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`, background: on ? 'var(--accent-soft)' : 'var(--surface)', color: on ? '#171511' : 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
      {on ? '✓ ' : ''}{label}
    </button>
  );
}

function BloqueReporte({ titulo, sub, canal, onChange }: { titulo: string; sub: string; canal: CanalPrefs; onChange: (c: CanalPrefs) => void }) {
  return (
    <div style={card}>
      <ToggleRow label={titulo} sub={sub} on={canal.activo} onChange={(v) => onChange({ ...canal, activo: v })} />
      {canal.activo && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Cómo te aviso</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip label="WhatsApp" on={canal.wa} onChange={(v) => onChange({ ...canal, wa: v })} />
            <Chip label="Telegram" on={canal.telegram} onChange={(v) => onChange({ ...canal, telegram: v })} />
            <Chip label="Email" on={canal.email} onChange={(v) => onChange({ ...canal, email: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Perfil ───────────────────────────────────────────────────────────────
function PerfilTab({ perfil, onSaved }: { perfil: Perfil; onSaved: (p: Perfil) => void }) {
  const [draft, setDraft] = useState<Perfil>(perfil);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => { setDraft(perfil); }, [perfil]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(perfil);
  const set = <K extends keyof Perfil>(k: K, v: Perfil[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const guardar = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/perfil', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'perfil', perfil: draft }) });
      const j = await r.json();
      if (j.ok) { onSaved(j.perfil as Perfil); setFlash('Guardado ✓'); setTimeout(() => setFlash(null), 1800); }
    } finally { setBusy(false); }
  };

  const inicial = (draft.nombre || 'M').trim().slice(0, 1).toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, flex: 'none', borderRadius: 16, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 26, color: '#171511', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {draft.avatarUrl ? <img src={draft.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : inicial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 19, color: 'var(--ink)' }}>{draft.nombre || 'Sin nombre'}</div>
            <div style={{ fontSize: 13.5, color: 'var(--dim)' }}>{draft.cargo || '—'}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label style={labelStyle}>Nombre</label><input style={input} value={draft.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Mauricio Bustos" /></div>
          <div><label style={labelStyle}>Cargo</label><input style={input} value={draft.cargo} onChange={(e) => set('cargo', e.target.value)} placeholder="Fundador" /></div>
          <div><label style={labelStyle}>Email (reportes)</label><input style={input} type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} placeholder="vos@empresa.com" /></div>
          <div><label style={labelStyle}>WhatsApp (reportes)</label><input style={input} value={draft.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="+5216861234567" /></div>
          <div>
            <label style={labelStyle}>Zona horaria</label>
            <Dropdown value={draft.timezone} options={TZ_OPTS} onChange={(v) => set('timezone', v)} width="100%" />
          </div>
          <div><label style={labelStyle}>Avatar (URL, opcional)</label><input style={input} value={draft.avatarUrl} onChange={(e) => set('avatarUrl', e.target.value)} placeholder="https://…" /></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          {flash && <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>{flash}</span>}
          <button style={{ ...btnDark, opacity: busy || !dirty ? 0.5 : 1 }} disabled={busy || !dirty} onClick={guardar}>Guardar cambios</button>
        </div>
      </div>

      <div style={{ ...card, background: 'var(--surface-2)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 18 }}>🔒</span>
        <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
          El acceso al dashboard usa una <b>contraseña compartida</b> (no hay usuarios individuales), por eso no se cambia desde acá. El teléfono y el email de arriba son a <b>dónde te llegan los reportes</b>.
        </div>
      </div>
    </div>
  );
}

// ── Tab: Notificaciones ───────────────────────────────────────────────────────
function PlantillaCard() {
  const [estado, setEstado] = useState<string>('…');
  const [motivo, setMotivo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cargar = async () => {
    try { const j = await (await fetch('/api/perfil/plantilla')).json(); setEstado(j.estado ?? 'error'); setMotivo(j.motivo ?? null); } catch { setEstado('error'); }
  };
  useEffect(() => { cargar(); }, []);

  const enviar = async () => {
    setBusy(true);
    try { const j = await (await fetch('/api/perfil/plantilla', { method: 'POST' })).json(); if (j.error) setMotivo(j.error); await cargar(); }
    finally { setBusy(false); }
  };

  const mapa: Record<string, { t: string; bg: string; fg: string }> = {
    approved: { t: 'Aprobada', bg: 'var(--good-bg)', fg: 'var(--good)' },
    pending: { t: 'En revisión de Meta', bg: 'var(--warn-bg)', fg: 'var(--warn)' },
    rejected: { t: 'Rechazada', bg: 'var(--bad-bg)', fg: 'var(--bad)' },
    ausente: { t: 'Sin crear', bg: 'var(--surface-2)', fg: 'var(--faint)' },
    error: { t: 'No se pudo consultar', bg: 'var(--bad-bg)', fg: 'var(--bad)' },
    '…': { t: 'Cargando…', bg: 'var(--surface-2)', fg: 'var(--faint)' },
  };
  const badge = mapa[estado] ?? mapa.error;
  const puedeEnviar = estado === 'ausente' || estado === 'rejected' || estado === 'error';

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>Plantilla de WhatsApp</div>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4, lineHeight: 1.5, maxWidth: 520 }}>
            Meta pide una plantilla aprobada para escribirte fuera de la ventana de 24h. <b>reporte_mako</b> te llega a la mañana con un botón: al tocarlo se abre la ventana y el resto del día los reportes te llegan como mensajes normales.
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 11px', borderRadius: 999, background: badge.bg, color: badge.fg, whiteSpace: 'nowrap' }}>{badge.t}</span>
      </div>
      {motivo && estado !== 'approved' && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--bad)' }}>{motivo}</div>}
      {puedeEnviar && (
        <div style={{ marginTop: 14 }}>
          <button style={{ ...btnDark, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={enviar}>{busy ? 'Enviando…' : 'Crear y enviar a Meta'}</button>
        </div>
      )}
    </div>
  );
}

function NotificacionesTab({ prefs, onSaved }: { prefs: NotifPrefs; onSaved: (p: NotifPrefs) => void }) {
  const [draft, setDraft] = useState<NotifPrefs>(prefs);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => { setDraft(prefs); }, [prefs]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(prefs);
  const setSec = (k: keyof Secciones, v: boolean) => setDraft((d) => ({ ...d, secciones: { ...d.secciones, [k]: v } }));

  const guardar = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/perfil', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prefs', prefs: draft }) });
      const j = await r.json();
      if (j.ok) { onSaved(draft); setFlash('Guardado ✓'); setTimeout(() => setFlash(null), 1800); }
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PlantillaCard />

      <div>
        <div style={{ ...labelStyle, marginBottom: 10 }}>Reportes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BloqueReporte titulo="Lo urgente (cada hora)" sub="Semáforo en rojo, cuotas vencidas, fatiga de ads. Solo te aviso cuando hay algo, 8–21h." canal={draft.horario} onChange={(c) => setDraft((d) => ({ ...d, horario: c }))} />
          <BloqueReporte titulo="Resumen diario" sub="Digest de la mañana: semáforo, ads de ayer, wins y pendientes." canal={draft.diario} onChange={(c) => setDraft((d) => ({ ...d, diario: c }))} />
          <BloqueReporte titulo="Reporte semanal" sub="Los lunes: ads, wins y cobranza de la semana pasada." canal={draft.semanal} onChange={(c) => setDraft((d) => ({ ...d, semanal: c }))} />
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)', marginBottom: 4 }}>Qué incluir en los reportes</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 12 }}>Aplica a todos los reportes de arriba.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip label="Semáforo" on={draft.secciones.semaforo} onChange={(v) => setSec('semaforo', v)} />
          <Chip label="Ads" on={draft.secciones.ads} onChange={(v) => setSec('ads', v)} />
          <Chip label="Wins" on={draft.secciones.wins} onChange={(v) => setSec('wins', v)} />
          <Chip label="Pendientes" on={draft.secciones.pendientes} onChange={(v) => setSec('pendientes', v)} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
        {flash && <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>{flash}</span>}
        <button style={{ ...btnDark, opacity: busy || !dirty ? 0.5 : 1 }} disabled={busy || !dirty} onClick={guardar}>Guardar preferencias</button>
      </div>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'perfil', label: 'Perfil' },
  { key: 'notificaciones', label: 'Notificaciones' },
] as const;

export function PerfilTabs() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>(sp.get('tab') === 'notificaciones' ? 'notificaciones' : 'perfil');
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);

  useEffect(() => {
    fetch('/api/perfil').then((r) => r.json()).then((j) => { if (j.ok) { setPerfil(j.perfil as Perfil); setPrefs(j.prefs as NotifPrefs); } }).catch(() => {});
  }, []);

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <MakoLogo size={36} />
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Perfil</h1>
      </header>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 22px', maxWidth: 720 }}>Tus datos y cómo querés que la app te avise lo que pasa: reportes por WhatsApp, email y en la campanita.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 22, borderBottom: '1px solid var(--border)' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS, fontSize: 14.5, fontWeight: tab === t.key ? 600 : 500, color: tab === t.key ? 'var(--ink)' : 'var(--dim)', borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 720 }}>
        {!perfil || !prefs ? (
          <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando…</div>
        ) : tab === 'perfil' ? (
          <PerfilTab perfil={perfil} onSaved={setPerfil} />
        ) : (
          <NotificacionesTab prefs={prefs} onSaved={setPrefs} />
        )}
      </div>
    </main>
  );
}
