'use client';

// =============================================================================
// /perfil — datos del usuario (editable) + foto de perfil
// =============================================================================
// Las preferencias de notificaciones se movieron a /configuraciones. Acá: datos
// del perfil + subida de foto (Supabase Storage vía /api/perfil/avatar).

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../_components/icons';
import { Dropdown } from '../components/Dropdown';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Perfil = { nombre: string; email: string; telefono: string; cargo: string; empresa: string; web: string; bio: string; timezone: string; avatarUrl: string };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const area: CSSProperties = { ...input, minHeight: 84, resize: 'vertical', lineHeight: 1.5 };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' };

const TZ_OPTS = [
  { value: 'America/Tijuana', label: 'Tijuana (PT)' },
  { value: 'America/Hermosillo', label: 'Hermosillo (MST)' },
  { value: 'America/Mexico_City', label: 'CDMX / Monterrey (CT)' },
  { value: 'America/New_York', label: 'Nueva York (ET)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET)' },
];

export function PerfilTabs() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [draft, setDraft] = useState<Perfil | null>(null);
  const [busy, setBusy] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch('/api/perfil').then((r) => r.json()).then((j) => { if (j.ok) { setPerfil(j.perfil as Perfil); setDraft(j.perfil as Perfil); } }).catch(() => {});
  }, []);

  if (!perfil || !draft) {
    return (
      <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
        <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13, maxWidth: 720 }}>Cargando…</div>
      </main>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(perfil);
  const set = <K extends keyof Perfil>(k: K, v: Perfil[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const persistir = async (p: Perfil) => {
    const r = await fetch('/api/perfil', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'perfil', perfil: p }) });
    const j = await r.json();
    if (j.ok) setPerfil(j.perfil as Perfil);
    return j.ok as boolean;
  };

  const guardar = async () => {
    setBusy(true);
    try { if (await persistir(draft)) { setFlash('Guardado ✓'); setTimeout(() => setFlash(null), 1800); } }
    finally { setBusy(false); }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(null); setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const j = await (await fetch('/api/perfil/avatar', { method: 'POST', body: fd })).json();
      if (!j.ok) { setErr(j.error ?? 'No se pudo subir la foto'); return; }
      const nuevo = { ...draft, avatarUrl: j.url as string };
      setDraft(nuevo);
      await persistir(nuevo); // persiste ya para que se vea en el sidebar
      setFlash('Foto actualizada ✓'); setTimeout(() => setFlash(null), 1800);
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); }
    finally { setSubiendo(false); }
  };

  const inicial = (draft.nombre || 'M').trim().slice(0, 1).toUpperCase();

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="perfil" size={34} /></span>
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Perfil</h1>
      </header>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 22px', maxWidth: 720 }}>Tu perfil personal (solo tuyo). Los reportes y las notificaciones se configuran en Configuraciones.</p>

      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
            <div style={{ width: 78, height: 78, flex: 'none', borderRadius: 18, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 30, color: '#171511', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {draft.avatarUrl ? <img src={draft.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : inicial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 19, color: 'var(--ink)' }}>{draft.nombre || 'Sin nombre'}</div>
              <div style={{ fontSize: 13.5, color: 'var(--dim)', marginBottom: 10 }}>{[draft.cargo, draft.empresa].filter(Boolean).join(' · ') || '—'}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
                <button style={{ ...btnGhost, opacity: subiendo ? 0.5 : 1 }} disabled={subiendo} onClick={() => fileRef.current?.click()}>{subiendo ? 'Subiendo…' : draft.avatarUrl ? 'Cambiar foto' : 'Subir foto'}</button>
                {draft.avatarUrl && !subiendo && <button style={btnGhost} onClick={async () => { const n = { ...draft, avatarUrl: '' }; setDraft(n); await persistir(n); }}>Quitar</button>}
                {err && <span style={{ fontSize: 12.5, color: 'var(--bad)' }}>{err}</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label style={labelStyle}>Nombre</label><input style={input} value={draft.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Mauricio Bustos" /></div>
            <div><label style={labelStyle}>Cargo</label><input style={input} value={draft.cargo} onChange={(e) => set('cargo', e.target.value)} placeholder="Fundador" /></div>
            <div><label style={labelStyle}>Empresa</label><input style={input} value={draft.empresa} onChange={(e) => set('empresa', e.target.value)} placeholder="Negocio que Escala" /></div>
            <div><label style={labelStyle}>Sitio web</label><input style={input} value={draft.web} onChange={(e) => set('web', e.target.value)} placeholder="https://…" /></div>
            <div><label style={labelStyle}>Email (acceso)</label><input style={{ ...input, background: 'var(--surface-2)', color: 'var(--dim)', cursor: 'not-allowed' }} type="email" value={draft.email} readOnly disabled placeholder="—" /></div>
            <div><label style={labelStyle}>Teléfono</label><input style={input} value={draft.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="+5216861234567" /></div>
            <div>
              <label style={labelStyle}>Zona horaria</label>
              <Dropdown value={draft.timezone} options={TZ_OPTS} onChange={(v) => set('timezone', v)} width="100%" />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Bio / notas</label>
            <textarea style={area} value={draft.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Algo sobre ti o el negocio (opcional)." />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
            {flash && <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>{flash}</span>}
            <button style={{ ...btnDark, opacity: busy || !dirty ? 0.5 : 1 }} disabled={busy || !dirty} onClick={guardar}>Guardar cambios</button>
          </div>
        </div>

        <div style={{ ...card, background: 'var(--surface-2)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
            Cada cuenta entra con su <b>Google</b> (los admins gestionan los accesos en Admin). La contraseña maestra queda como respaldo y se cambia en el server, no desde aquí.
          </div>
        </div>
      </div>
    </main>
  );
}
