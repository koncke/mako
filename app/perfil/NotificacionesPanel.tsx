'use client';

// =============================================================================
// NotificacionesPanel — preferencias de notificaciones (vive en /configuraciones)
// =============================================================================
// Autocontenido: lee/guarda /api/perfil (prefs) y gestiona la plantilla de
// WhatsApp vía /api/perfil/plantilla. Por reporte (horario/diario/semanal)
// elegís canales (WhatsApp/Email) y qué secciones incluir.

import { useEffect, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type CanalPrefs = { activo: boolean; wa: boolean; email: boolean };
type Secciones = { semaforo: boolean; ads: boolean; wins: boolean; pendientes: boolean };
type NotifPrefs = { horario: CanalPrefs; diario: CanalPrefs; semanal: CanalPrefs; secciones: Secciones };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };

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
            <Chip label="Email" on={canal.email} onChange={(v) => onChange({ ...canal, email: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

function NumeroDuenoCard() {
  const [numero, setNumero] = useState('');
  const [orig, setOrig] = useState('');
  const [tieneGrupo, setTieneGrupo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch('/api/perfil').then((r) => r.json()).then((j) => {
      if (j?.ok) { setNumero((j.numeroDueno as string) || ''); setOrig((j.numeroDueno as string) || ''); setTieneGrupo(Boolean(j.tieneGrupo)); }
    }).catch(() => {}).finally(() => setCargando(false));
  }, []);

  const soloDig = (s: string) => s.replace(/\D/g, '');
  const dirty = soloDig(numero) !== soloDig(orig) && soloDig(numero).length >= 8;

  const guardar = async () => {
    setBusy(true); setFlash(null);
    try {
      const j = await (await fetch('/api/perfil', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'numero_dueno', numero }),
      })).json();
      if (j.ok) {
        setOrig(numero); setTieneGrupo(true);
        setFlash(j.accion === 'grupo_creado' ? 'Grupo de MaKo creado ✓' : j.accion === 'numero_agregado' ? 'Número agregado al grupo ✓' : 'Guardado ✓');
        setTimeout(() => setFlash(null), 2600);
      } else setFlash(j.error || 'No se pudo guardar');
    } finally { setBusy(false); }
  };

  return (
    <div style={card}>
      <div style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>Tu WhatsApp (dueño)</div>
      <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4, lineHeight: 1.5, maxWidth: 560 }}>
        Es el número donde MaKo te arma el grupo y te deja los avisos (reuniones, semáforo, ads, pendientes).
        {tieneGrupo ? ' Ya tenés grupo: si cambiás el número, sumo el nuevo al grupo.' : ' Al guardarlo, MaKo crea el grupo y te manda la bienvenida.'}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="tel"
          placeholder="+54 9 3764 67-3479" disabled={cargando || busy}
          style={{ flex: 1, minWidth: 220, padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontFamily: SANS }} />
        <button style={{ ...btnDark, opacity: busy || !dirty ? 0.5 : 1 }} disabled={busy || !dirty} onClick={guardar}>
          {busy ? 'Guardando…' : tieneGrupo ? 'Actualizar' : 'Crear grupo'}
        </button>
      </div>
      {flash && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: flash.includes('✓') ? 'var(--good)' : 'var(--bad)' }}>{flash}</div>}
    </div>
  );
}

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

export function NotificacionesPanel() {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [draft, setDraft] = useState<NotifPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/perfil').then((r) => r.json()).then((j) => { if (j.ok) { setPrefs(j.prefs as NotifPrefs); setDraft(j.prefs as NotifPrefs); } }).catch(() => {});
  }, []);

  if (!prefs || !draft) return <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando…</div>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(prefs);
  const setSec = (k: keyof Secciones, v: boolean) => setDraft((d) => (d ? { ...d, secciones: { ...d.secciones, [k]: v } } : d));

  const guardar = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/perfil', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prefs', prefs: draft }) });
      const j = await r.json();
      if (j.ok) { setPrefs(draft); setFlash('Guardado ✓'); setTimeout(() => setFlash(null), 1800); }
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <NumeroDuenoCard />
      <PlantillaCard />

      <div>
        <div style={{ ...labelStyle, marginBottom: 10 }}>Reportes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BloqueReporte titulo="Lo urgente (cada hora)" sub="Semáforo en rojo, cuotas vencidas, fatiga de ads. Solo te aviso cuando hay algo, 8–21h." canal={draft.horario} onChange={(c) => setDraft((d) => (d ? { ...d, horario: c } : d))} />
          <BloqueReporte titulo="Resumen diario" sub="Digest de la mañana: semáforo, ads de ayer, wins y pendientes." canal={draft.diario} onChange={(c) => setDraft((d) => (d ? { ...d, diario: c } : d))} />
          <BloqueReporte titulo="Reporte semanal" sub="Los lunes: ads, wins y cobranza de la semana pasada." canal={draft.semanal} onChange={(c) => setDraft((d) => (d ? { ...d, semanal: c } : d))} />
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
