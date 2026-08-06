'use client';

// =============================================================================
// NotificacionesPanel — todo lo que MaKo puede avisar, y por dónde
// =============================================================================
// Vive en /configuraciones. Tres bloques, en este orden:
//
//   1. DENTRO DE LA APP  — pop-up y sonido, cada uno por su lado. Es preferencia
//      de la PERSONA (pasa en su navegador): se guarda en su fila de usuarios.
//   2. POR WHATSAPP      — reportes + avisos sueltos. Es del NEGOCIO: la leen los
//      crons, que corren sin sesión, así que vive en app_settings del workspace.
//   3. POR EMAIL         — los reportes que salen por Resend.
//
// La lista de qué existe NO se escribe acá: viene de lib/notif-catalogo.ts, que
// es el único lugar donde está el mapa (ver AGENTS.md, "una cosa, un lugar").
//
// Los dos destinos se guardan con el mismo botón, pero son dos llamadas
// distintas: bajar el volumen no le baja el volumen a todo el equipo.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  NOTIF_IN_APP, REPORTES, AVISOS_WA_EN_VIVO, inAppActivo,
  type NotifInApp, type ReporteKey,
} from '@/lib/notif-catalogo';
import { EVENTO_PREFS_IN_APP } from '../_components/NotificationsProvider';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type CanalPrefs = { activo: boolean; wa: boolean; email: boolean };
type Secciones = { semaforo: boolean; ads: boolean; wins: boolean; pendientes: boolean };
type NotifPrefs = {
  horario: CanalPrefs; diario: CanalPrefs; semanal: CanalPrefs;
  secciones: Secciones; avisos: Record<string, boolean>;
};

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };

// ── Piezas ────────────────────────────────────────────────────────────────────
function Switch({ on, onChange, disabled, aria }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; aria?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on} aria-label={aria} disabled={disabled}
      style={{ width: 44, height: 25, borderRadius: 999, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', padding: 2, background: on ? 'var(--accent)' : 'var(--border-strong)', transition: 'background .15s', flex: 'none', opacity: disabled ? 0.4 : 1 }}>
      <span style={{ display: 'block', width: 21, height: 21, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(19px)' : 'none', transition: 'transform .15s' }} />
    </button>
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

function Titulo({ children }: { children: ReactNode }) {
  return <div style={{ ...labelStyle, marginBottom: 10 }}>{children}</div>;
}

/** Una fila con N interruptores a la derecha, alineados en columnas fijas. */
function Fila({ titulo, sub, cols, primera }: {
  titulo: string; sub?: string; cols: ReactNode[]; primera?: boolean;
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `1fr repeat(${cols.length}, 78px)`, alignItems: 'center', gap: 8,
      paddingTop: primera ? 0 : 13, marginTop: primera ? 0 : 13,
      borderTop: primera ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ minWidth: 0, paddingRight: 12 }}>
        <div style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 600 }}>{titulo}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      {cols.map((c, i) => <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>{c}</div>)}
    </div>
  );
}

/** Encabezado de columnas (Pop-up / Sonido), para no repetir la palabra en cada fila. */
function Encabezado({ cols }: { cols: string[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `1fr repeat(${cols.length}, 78px)`, gap: 8, marginBottom: 12 }}>
      <span />
      {cols.map((c) => (
        <span key={c} style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>{c}</span>
      ))}
    </div>
  );
}

// ── Cards de WhatsApp que ya existían ────────────────────────────────────────
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
      <div style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>Tu WhatsApp</div>
      <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4, lineHeight: 1.5, maxWidth: 560 }}>
        Es el número donde MaKo arma el grupo y deja los avisos.
        {tieneGrupo ? ' Ya hay grupo: si cambiás el número, se suma el nuevo al grupo.' : ' Al guardarlo, MaKo crea el grupo y manda la bienvenida.'}
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
            Meta pide una plantilla aprobada para escribir fuera de la ventana de 24 h. <b>reporte_mako</b> llega a la mañana con un botón: al tocarlo se abre la ventana y el resto del día los mensajes llegan como texto normal.
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

// ── Normalización de los reportes ────────────────────────────────────────────
// `activo` es el interruptor que miran los crons y `wa`/`email` los canales. Acá
// se muestra un solo interruptor por canal, así que `activo` pasa a ser derivado:
// el reporte está prendido si sale por algún lado. Se normaliza al cargar para que
// un estado viejo (activo=false con wa=true) no muestre prendido algo que no sale.
function normalizarCanal(c: CanalPrefs): CanalPrefs {
  const wa = c.activo && c.wa;
  const email = c.activo && c.email;
  return { activo: wa || email, wa, email };
}
function normalizarPrefs(p: NotifPrefs): NotifPrefs {
  return {
    ...p,
    horario: normalizarCanal(p.horario),
    diario: normalizarCanal(p.diario),
    semanal: normalizarCanal(p.semanal),
    avisos: p.avisos ?? {},
  };
}
function conCanal(c: CanalPrefs, k: 'wa' | 'email', v: boolean): CanalPrefs {
  const next = { ...c, [k]: v };
  return { ...next, activo: next.wa || next.email };
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function NotificacionesPanel() {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [draft, setDraft] = useState<NotifPrefs | null>(null);
  const [inApp, setInApp] = useState<NotifInApp | null>(null);
  const [inAppDraft, setInAppDraft] = useState<NotifInApp | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/perfil').then((r) => r.json()).then((j) => {
      if (!j.ok) return;
      const p = normalizarPrefs(j.prefs as NotifPrefs);
      setPrefs(p); setDraft(p);
    }).catch(() => {});
    fetch('/api/perfil/notif-inapp').then((r) => r.json()).then((j) => {
      if (!j.ok) return;
      setInApp(j.inApp as NotifInApp); setInAppDraft(j.inApp as NotifInApp);
    }).catch(() => {});
  }, []);

  if (!prefs || !draft || !inApp || !inAppDraft) {
    return <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando…</div>;
  }

  const prefsDirty = JSON.stringify(draft) !== JSON.stringify(prefs);
  const inAppDirty = JSON.stringify(inAppDraft) !== JSON.stringify(inApp);
  const dirty = prefsDirty || inAppDirty;

  const setSec = (k: keyof Secciones, v: boolean) => setDraft((d) => (d ? { ...d, secciones: { ...d.secciones, [k]: v } } : d));
  const setReporte = (k: ReporteKey, canal: 'wa' | 'email', v: boolean) =>
    setDraft((d) => (d ? { ...d, [k]: conCanal(d[k], canal, v) } : d));
  const setAviso = (id: string, v: boolean) =>
    setDraft((d) => (d ? { ...d, avisos: { ...d.avisos, [id]: v } } : d));
  const setMaestro = (canal: 'popup' | 'sonido', v: boolean) =>
    setInAppDraft((p) => (p ? { ...p, [canal]: v } : p));
  const setItem = (id: string, canal: 'popup' | 'sonido', v: boolean) =>
    setInAppDraft((p) => (p ? { ...p, items: { ...p.items, [id]: { ...(p.items[id] ?? { popup: true, sonido: true }), [canal]: v } } } : p));

  const guardar = async () => {
    setBusy(true);
    try {
      if (prefsDirty) {
        const j = await (await fetch('/api/perfil', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'prefs', prefs: draft }),
        })).json();
        if (!j.ok) throw new Error(j.error || 'no se pudo guardar');
        setPrefs(draft);
      }
      if (inAppDirty) {
        const j = await (await fetch('/api/perfil/notif-inapp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inApp: inAppDraft }),
        })).json();
        if (!j.ok) throw new Error(j.error || 'no se pudo guardar');
        // Sesión sin cuenta propia (contraseña maestra, acceso de desarrollo): el
        // resto sí se guardó, pero esto no tiene dónde. Vale decirlo.
        if (j.guardado === false) {
          setFlash('Lo de WhatsApp y email quedó guardado. Pop-up y sonido no: esta sesión no tiene cuenta propia.');
          return;
        }
        setInApp(inAppDraft);
        // El provider está montado en el layout y ya cargó las preferencias:
        // sin este aviso el sonido que acabás de apagar sigue sonando hasta recargar.
        window.dispatchEvent(new Event(EVENTO_PREFS_IN_APP));
      }
      setFlash('Guardado ✓');
      setTimeout(() => setFlash(null), 1800);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── 1. Dentro de la app ─────────────────────────────────────────── */}
      <section>
        <Titulo>Dentro de la app</Titulo>
        <div style={{ ...card, paddingTop: 16 }}>
          <Encabezado cols={['Pop-up', 'Sonido']} />
          <Fila
            primera
            titulo="Todas las notificaciones de la app"
            sub="El interruptor general. Apagarlo silencia todo lo de abajo sin perder cada ajuste."
            cols={[
              <Switch key="p" aria="Todos los pop-up" on={inAppDraft.popup} onChange={(v) => setMaestro('popup', v)} />,
              <Switch key="s" aria="Todos los sonidos" on={inAppDraft.sonido} onChange={(v) => setMaestro('sonido', v)} />,
            ]}
          />
          {NOTIF_IN_APP.map((n) => (
            <Fila
              key={n.id}
              titulo={n.titulo}
              sub={n.sub}
              cols={[
                <Switch key="p" aria={`Pop-up de ${n.titulo}`}
                  disabled={!inAppDraft.popup}
                  on={inAppActivo(inAppDraft, n.id, 'popup')}
                  onChange={(v) => setItem(n.id, 'popup', v)} />,
                n.sonido ? (
                  <Switch key="s" aria={`Sonido de ${n.titulo}`}
                    disabled={!inAppDraft.sonido}
                    on={inAppActivo(inAppDraft, n.id, 'sonido')}
                    onChange={(v) => setItem(n.id, 'sonido', v)} />
                ) : (
                  <span key="s" aria-hidden style={{ color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>—</span>
                ),
              ]}
            />
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 8, lineHeight: 1.5 }}>
          Estas preferencias son tuyas: no cambian lo que ve el resto del equipo.
        </div>
      </section>

      {/* ── 2. Por WhatsApp ─────────────────────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Titulo>Por WhatsApp</Titulo>
        <NumeroDuenoCard />
        <PlantillaCard />

        <div style={{ ...card, paddingTop: 16 }}>
          <Encabezado cols={['Enviar']} />
          {REPORTES.map((r, i) => (
            <Fila key={r.key} primera={i === 0} titulo={r.titulo} sub={r.sub}
              cols={[
                <Switch key="w" aria={`${r.titulo} por WhatsApp`}
                  on={draft[r.key].wa} onChange={(v) => setReporte(r.key, 'wa', v)} />,
              ]} />
          ))}
        </div>

        <div style={{ ...card, paddingTop: 16 }}>
          <Encabezado cols={['Enviar']} />
          {AVISOS_WA_EN_VIVO.map((a, i) => (
            <Fila key={a.id} primera={i === 0} titulo={a.titulo} sub={a.sub}
              cols={[
                <Switch key="w" aria={a.titulo}
                  on={draft.avisos[a.id] !== false} onChange={(v) => setAviso(a.id, v)} />,
              ]} />
          ))}
        </div>
      </section>

      {/* ── 3. Por email ────────────────────────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Titulo>Por email</Titulo>
        <div style={{ ...card, paddingTop: 16 }}>
          <Encabezado cols={['Enviar']} />
          {REPORTES.map((r, i) => (
            <Fila key={r.key} primera={i === 0} titulo={r.titulo} sub={r.sub}
              cols={[
                <Switch key="e" aria={`${r.titulo} por email`}
                  on={draft[r.key].email} onChange={(v) => setReporte(r.key, 'email', v)} />,
              ]} />
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)', marginBottom: 4 }}>Qué incluir en los reportes</div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 12 }}>Aplica a los reportes de WhatsApp y de email.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip label="Semáforo" on={draft.secciones.semaforo} onChange={(v) => setSec('semaforo', v)} />
            <Chip label="Ads" on={draft.secciones.ads} onChange={(v) => setSec('ads', v)} />
            <Chip label="Wins" on={draft.secciones.wins} onChange={(v) => setSec('wins', v)} />
            <Chip label="Pendientes" on={draft.secciones.pendientes} onChange={(v) => setSec('pendientes', v)} />
          </div>
        </div>
      </section>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end',
        position: 'sticky', bottom: 0, padding: '12px 0',
        background: 'linear-gradient(to top, var(--bg) 55%, transparent)',
      }}>
        {flash && <span style={{ fontSize: 13, color: flash.includes('✓') ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>{flash}</span>}
        <button style={{ ...btnDark, opacity: busy || !dirty ? 0.5 : 1 }} disabled={busy || !dirty} onClick={guardar}>
          {busy ? 'Guardando…' : 'Guardar preferencias'}
        </button>
      </div>
    </div>
  );
}
