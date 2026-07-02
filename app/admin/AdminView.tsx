'use client';

// =============================================================================
// AdminView — panel de administración multi-cliente
// =============================================================================
// Dos tabs por estado local: "Clientes" (workspaces) y "Usuarios".
//  · Clientes → /api/admin/workspaces (crear, renombrar, pausar/activar) +
//    /api/admin/impersonate ("Entrar como" → cookie mako_ws → /general).
//  · Usuarios → /api/admin/usuarios (crear con workspace, rol, estado, reasignar
//    workspace, eliminar). El guard de "único admin activo" vive en el API; acá
//    solo mostramos sus errores.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Icon } from '../_components/icons';
import { ConfirmDialog } from '../_components/ChatItemMenu';
import { Dropdown } from '../components/Dropdown';
import type { Usuario } from '@/lib/usuarios';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Workspace = { id: number; nombre: string; slug: string | null; estado: 'activo' | 'pausado'; created_at: string; usuarios: number };
type WsMini = { id: number; nombre: string };
type Sesion = { email: string; legacy: boolean };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' };
const btnPrimary: CSSProperties = { padding: '9px 15px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' };
const chip = (bg: string, color: string): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', flex: 'none' });
const bannerError: CSSProperties = { background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '11px 15px', fontSize: 13, color: 'var(--bad)', fontWeight: 600, lineHeight: 1.5 };

const ROL_OPTS = [
  { value: 'usuario', label: 'Usuario', sub: 'Usa el dashboard de un cliente' },
  { value: 'admin', label: 'Admin', sub: 'Gestiona todo el panel' },
];

const fmtLogin = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
};

const inicialesTxt = (base: string) => {
  const partes = (base || '?').trim().split(/\s+/).filter(Boolean);
  return (partes.length >= 2 ? `${partes[0][0]}${partes[1][0]}` : (base || '?').slice(0, 1)).toUpperCase();
};

function Cuadro({ texto, foto }: { texto: string; foto?: string | null }) {
  return (
    <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#171511', overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {foto ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : texto}
    </div>
  );
}

function ChipEstadoUsuario({ estado }: { estado: Usuario['estado'] }) {
  if (estado === 'activo') return <span style={chip('var(--good-bg)', 'var(--good)')}>activo</span>;
  if (estado === 'suspendido') return <span style={chip('var(--bad-bg)', 'var(--bad)')}>suspendido</span>;
  return <span style={chip('var(--warn-bg)', 'var(--warn)')}>invitado — nunca entró</span>;
}

// =============================================================================
// AdminView
// =============================================================================
export function AdminView() {
  const [tab, setTab] = useState<'clientes' | 'usuarios'>('clientes');

  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [wsMini, setWsMini] = useState<WsMini[]>([]);
  const [sesion, setSesion] = useState<Sesion | null>(null);

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setErrorCarga(null);
    try {
      const [rw, ru] = await Promise.all([
        fetch('/api/admin/workspaces').then((r) => r.json()),
        fetch('/api/admin/usuarios').then((r) => r.json()),
      ]);
      if (!rw.ok) { setErrorCarga(rw.error ?? 'No se pudieron cargar los clientes.'); return; }
      if (!ru.ok) { setErrorCarga(ru.error ?? 'No se pudo cargar la lista de usuarios.'); return; }
      setWorkspaces(rw.workspaces as Workspace[]);
      setUsuarios(ru.usuarios as Usuario[]);
      setWsMini((ru.workspaces as WsMini[]) ?? []);
      setSesion(ru.sesion as Sesion);
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const header = (
    <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
      <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="admin" size={34} /></span>
      <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Admin</h1>
    </header>
  );

  const tabBtn = (id: 'clientes' | 'usuarios', label: string): CSSProperties => ({
    padding: '10px 2px', marginRight: 26, background: 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: SANS, fontSize: 15, fontWeight: tab === id ? 600 : 500,
    color: tab === id ? 'var(--ink)' : 'var(--dim)',
    borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
  });

  const tabs = (
    <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
      <button style={tabBtn('clientes', 'Clientes')} onClick={() => setTab('clientes')}>Clientes</button>
      <button style={tabBtn('usuarios', 'Usuarios')} onClick={() => setTab('usuarios')}>Usuarios</button>
    </div>
  );

  if (cargando) {
    return (
      <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
        {header}
        <div style={{ marginTop: 18, ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13, maxWidth: 980 }}>Cargando…</div>
      </main>
    );
  }

  if (errorCarga || !workspaces || !usuarios || !sesion) {
    return (
      <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
        {header}
        <div style={{ marginTop: 18, ...bannerError, maxWidth: 980, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between' }}>
          <span>No se pudo cargar el panel de admin. {errorCarga ?? 'Sin datos.'}</span>
          <button style={{ ...btnDark, padding: '8px 14px', flex: 'none' }} onClick={() => { setCargando(true); cargar(); }}>Reintentar</button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      {header}
      <div style={{ maxWidth: 980, marginTop: 18 }}>
        {tabs}
        {tab === 'clientes'
          ? <TabClientes workspaces={workspaces} recargar={cargar} />
          : <TabUsuarios usuarios={usuarios} workspaces={wsMini} sesion={sesion} recargar={cargar} />}
      </div>
    </main>
  );
}

// =============================================================================
// TAB — Clientes (workspaces)
// =============================================================================
function TabClientes({ workspaces, recargar }: { workspaces: Workspace[]; recargar: () => Promise<void> }) {
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [errCrear, setErrCrear] = useState<string | null>(null);
  const [hintCrear, setHintCrear] = useState<string | null>(null);

  const [errAccion, setErrAccion] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);
  const [entrando, setEntrando] = useState<number | null>(null);
  const [renombrando, setRenombrando] = useState<Workspace | null>(null);
  const [nombreEdit, setNombreEdit] = useState('');

  const post = async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    try {
      return await (await fetch('/api/admin/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  const crear = async () => {
    if (creando) return;
    setErrCrear(null); setHintCrear(null); setCreando(true);
    try {
      const j = await post({ action: 'crear', nombre: nombre.trim() });
      if (!j.ok) { setErrCrear(j.error ?? 'No se pudo crear el workspace.'); return; }
      setNombre('');
      setHintCrear('Listo. Asigná un usuario a este cliente en la tab Usuarios (o entrá vos a configurarlo).');
      await recargar();
    } finally { setCreando(false); }
  };

  const accion = async (body: Record<string, unknown>) => {
    if (accionando) return;
    setErrAccion(null); setAccionando(true);
    try {
      const j = await post(body);
      if (!j.ok) { setErrAccion(j.error ?? 'No se pudo aplicar el cambio.'); return; }
      await recargar();
    } finally { setAccionando(false); }
  };

  const entrarComo = async (w: Workspace) => {
    if (entrando != null) return;
    setErrAccion(null); setEntrando(w.id);
    try {
      const j = await (await fetch('/api/admin/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ws: w.id }) })).json();
      if (!j.ok) { setErrAccion(j.error ?? 'No se pudo entrar como este cliente.'); setEntrando(null); return; }
      window.location.href = '/general';
    } catch (e) {
      setErrAccion(e instanceof Error ? e.message : String(e));
      setEntrando(null);
    }
  };

  const guardarNombre = async () => {
    const w = renombrando;
    if (!w) return;
    const nuevo = nombreEdit.trim();
    setRenombrando(null);
    if (nuevo && nuevo !== w.nombre) await accion({ action: 'nombre', id: w.id, nombre: nuevo });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Agregar cliente ──────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 16 }}>Agregar cliente</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Nombre del cliente</label>
            <input style={input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Elevate, Levanta Muertos…" onKeyDown={(e) => { if (e.key === 'Enter' && nombre.trim().length >= 2) crear(); }} />
          </div>
          <button style={{ ...btnDark, opacity: creando || nombre.trim().length < 2 ? 0.5 : 1 }} disabled={creando || nombre.trim().length < 2} onClick={crear}>{creando ? 'Creando…' : 'Crear workspace'}</button>
        </div>
        {errCrear && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{errCrear}</div>}
        {hintCrear && <div style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600, marginTop: 12 }}>{hintCrear}</div>}
      </div>

      {/* ── Lista de workspaces ──────────────────────────────────────────── */}
      {errAccion && <div style={bannerError}>{errAccion}</div>}

      {workspaces.length === 0 ? (
        <div style={{ ...card, color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.5 }}>
          Todavía no hay clientes. Creá el primero arriba y después asignále usuarios en la tab Usuarios.
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {workspaces.map((w, i) => {
            const esDueno = w.id === 1;
            return (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <Cuadro texto={inicialesTxt(w.nombre)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.nombre}</span>
                    {esDueno && <span style={chip('var(--accent-soft)', '#171511')}>Dueño</span>}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{w.slug ?? '—'}</div>
                </div>
                {w.estado === 'activo'
                  ? <span style={chip('var(--good-bg)', 'var(--good)')}>activo</span>
                  : <span style={chip('var(--surface-2)', 'var(--dim)')}>pausado</span>}
                <span style={{ fontSize: 12.5, color: 'var(--dim)', flex: 'none', width: 84, textAlign: 'right' }}>{w.usuarios} {w.usuarios === 1 ? 'usuario' : 'usuarios'}</span>
                <button style={{ ...btnPrimary, opacity: entrando != null ? 0.6 : 1 }} disabled={entrando != null} onClick={() => entrarComo(w)}>{entrando === w.id ? 'Entrando…' : 'Entrar como →'}</button>
                <Dropdown
                  value=""
                  resetAfterSelect
                  align="right"
                  placeholder="Acciones"
                  ariaLabel={`Acciones sobre ${w.nombre}`}
                  disabled={accionando}
                  buttonStyle={{ padding: '7px 11px', fontSize: 12.5, borderRadius: 9 }}
                  options={[
                    { value: 'renombrar', label: 'Renombrar…' },
                    esDueno
                      ? { value: 'nopausar', label: 'No se puede pausar al dueño', disabled: true }
                      : { value: 'estado', label: w.estado === 'pausado' ? 'Activar' : 'Pausar' },
                  ]}
                  onChange={(v) => {
                    if (v === 'renombrar') { setNombreEdit(w.nombre); setRenombrando(w); }
                    else if (v === 'estado') accion({ action: 'estado', id: w.id, estado: w.estado === 'pausado' ? 'activo' : 'pausado' });
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
        Cada cliente ve solo sus propios datos. &ldquo;Entrar como&rdquo; te mete en su dashboard para configurarlo o dar soporte.
      </div>

      {renombrando && (
        <NombreClienteDialog
          nombre={nombreEdit}
          onNombre={setNombreEdit}
          onCancel={() => setRenombrando(null)}
          onConfirm={guardarNombre}
        />
      )}
    </div>
  );
}

// Mini modal para nombrar un workspace (renombrar o crear uno nuevo).
function NombreClienteDialog({ nombre, onNombre, onCancel, onConfirm, titulo = 'Renombrar cliente', confirmLabel = 'Guardar' }: { nombre: string; onNombre: (v: string) => void; onCancel: () => void; onConfirm: () => void; titulo?: string; confirmLabel?: string }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.32)', padding: '20px 22px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>{titulo}</div>
        <input autoFocus style={input} value={nombre} onChange={(e) => onNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(); }} placeholder="Ej. Elevate, Levanta Muertos…" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onCancel} style={btnGhost}>Cancelar</button>
          <button type="button" onClick={onConfirm} style={{ ...btnPrimary, opacity: nombre.trim().length < 2 ? 0.5 : 1 }} disabled={nombre.trim().length < 2}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB — Usuarios
// =============================================================================
function TabUsuarios({ usuarios, workspaces, sesion, recargar }: { usuarios: Usuario[]; workspaces: WsMini[]; sesion: Sesion; recargar: () => Promise<void> }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rolNuevo, setRolNuevo] = useState('usuario');
  const [wsNuevo, setWsNuevo] = useState('');
  const [creando, setCreando] = useState(false);
  const [errCrear, setErrCrear] = useState<string | null>(null);
  const [hintCrear, setHintCrear] = useState<string | null>(null);

  const [errAccion, setErrAccion] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);
  const [aEliminar, setAEliminar] = useState<Usuario | null>(null);
  // Modal "crear cliente" disparado desde un selector. 'form' = viene del alta de
  // usuario (autoselecciona); número = id del usuario a reasignar al cliente nuevo.
  const [nuevoClientePara, setNuevoClientePara] = useState<'form' | number | null>(null);
  const [nombreCliente, setNombreCliente] = useState('');

  // Opciones de cliente para los selectores. Además de los workspaces reales,
  // un ítem para crear uno nuevo sin salir de la tab, y (en las filas) uno para
  // dejar al usuario SIN cliente (des-asignar).
  const wsOpts = workspaces.map((w) => ({ value: String(w.id), label: w.nombre }));
  const OPT_CREAR = { value: '__nuevo__', label: '+ Crear cliente nuevo…' };
  const wsOptsAlta = [...wsOpts, OPT_CREAR];
  const wsOptsFila = [{ value: '', label: 'Sin cliente', sub: 'Queda sin acceso a datos hasta reasignar' }, ...wsOpts, OPT_CREAR];

  const post = async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    try {
      return await (await fetch('/api/admin/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  // Crea un workspace nuevo (endpoint de workspaces) y lo usa según el disparador:
  // en el alta lo deja preseleccionado, en una fila reasigna a ese usuario.
  const crearClienteYUsar = async () => {
    const nom = nombreCliente.trim();
    const destino = nuevoClientePara;
    setNuevoClientePara(null); setNombreCliente('');
    if (nom.length < 2 || destino == null || accionando) return;
    setErrAccion(null); setAccionando(true);
    try {
      const rw = await fetch('/api/admin/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'crear', nombre: nom }) });
      const jw = await rw.json();
      if (!jw.ok) { setErrAccion(jw.error ?? 'No se pudo crear el cliente.'); return; }
      const nuevoId: number | undefined = jw.workspace?.id;
      await recargar();
      if (nuevoId == null) return;
      if (destino === 'form') { setWsNuevo(String(nuevoId)); return; }
      const ru = await post({ action: 'workspace', id: destino, workspace_id: nuevoId });
      if (!ru.ok) { setErrAccion(ru.error ?? 'Cliente creado, pero no se pudo asignar.'); return; }
      await recargar();
    } catch (e) {
      setErrAccion(e instanceof Error ? e.message : String(e));
    } finally { setAccionando(false); }
  };

  const crear = async () => {
    if (creando) return;
    setErrCrear(null); setHintCrear(null);
    if (rolNuevo === 'usuario' && !wsNuevo) { setErrCrear('Elegí a qué cliente pertenece este usuario.'); return; }
    setCreando(true);
    try {
      const body: Record<string, unknown> = { action: 'crear', email: email.trim(), nombre: nombre.trim(), rol: rolNuevo };
      if (rolNuevo === 'usuario') body.workspace_id = Number(wsNuevo);
      const j = await post(body);
      if (!j.ok) { setErrCrear(j.error ?? 'No se pudo crear el usuario.'); return; }
      setNombre(''); setEmail(''); setRolNuevo('usuario'); setWsNuevo('');
      setHintCrear('Listo. Cuando entre con Google usando ese email, la cuenta se activa sola.');
      await recargar();
    } finally { setCreando(false); }
  };

  const accion = async (body: Record<string, unknown>) => {
    if (accionando) return;
    setErrAccion(null); setAccionando(true);
    try {
      const j = await post(body);
      if (!j.ok) { setErrAccion(j.error ?? 'No se pudo aplicar el cambio.'); return; }
      await recargar();
    } finally { setAccionando(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Agregar usuario ──────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 16 }}>Agregar usuario</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 190px 200px auto', gap: 12, alignItems: 'end' }}>
          <div><label style={labelStyle}>Nombre</label><input style={input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" /></div>
          <div><label style={labelStyle}>Email</label><input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@empresa.com" /></div>
          <div>
            <label style={labelStyle}>Rol</label>
            <Dropdown value={rolNuevo} options={ROL_OPTS} onChange={setRolNuevo} width="100%" ariaLabel="Rol del usuario nuevo" />
          </div>
          <div>
            <label style={labelStyle}>Cliente (workspace)</label>
            <Dropdown
              value={rolNuevo === 'admin' ? '' : wsNuevo}
              options={wsOptsAlta}
              onChange={(v) => { if (v === '__nuevo__') { setNombreCliente(''); setNuevoClientePara('form'); } else setWsNuevo(v); }}
              width="100%"
              placeholder={rolNuevo === 'admin' ? 'No aplica' : 'Elegí un cliente'}
              disabled={rolNuevo === 'admin'}
              ariaLabel="Cliente del usuario nuevo"
            />
          </div>
          <button style={{ ...btnDark, opacity: creando || !email.trim() ? 0.5 : 1 }} disabled={creando || !email.trim()} onClick={crear}>{creando ? 'Agregando…' : 'Agregar'}</button>
        </div>
        {rolNuevo === 'admin' && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 10 }}>Los admin no pertenecen a un workspace — ven y gestionan todos los clientes.</div>}
        {errCrear && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{errCrear}</div>}
        {hintCrear && <div style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600, marginTop: 12 }}>{hintCrear}</div>}
      </div>

      {/* ── Lista de usuarios ────────────────────────────────────────────── */}
      {errAccion && <div style={bannerError}>{errAccion}</div>}

      {usuarios.length === 0 ? (
        <div style={{ ...card, color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.5 }}>
          Todavía no hay usuarios. Agregá el primero arriba — o entrá con Google y tu cuenta se crea sola como admin.
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {usuarios.map((u, i) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <Cuadro texto={inicialesTxt(u.nombre || u.email)} foto={u.foto_url} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || '—'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
              </div>
              {u.rol === 'admin'
                ? <span style={chip('var(--primary-bg)', 'var(--primary)')}>admin</span>
                : <span style={chip('var(--surface-2)', 'var(--dim)')}>usuario</span>}
              <ChipEstadoUsuario estado={u.estado} />
              {u.rol === 'admin' ? (
                <span style={{ fontSize: 12.5, color: 'var(--faint)', flex: 'none', width: 150, textAlign: 'right' }} title="Cliente">— (admin)</span>
              ) : (
                <div style={{ flex: 'none', width: 150 }} title="Cliente">
                  <Dropdown
                    value={u.workspace_id != null ? String(u.workspace_id) : ''}
                    options={wsOptsFila}
                    onChange={(v) => {
                      if (v === '__nuevo__') { setNombreCliente(''); setNuevoClientePara(u.id); }
                      else accion({ action: 'workspace', id: u.id, workspace_id: v ? Number(v) : null });
                    }}
                    width="100%"
                    align="right"
                    placeholder="Sin cliente"
                    disabled={accionando}
                    ariaLabel={`Cliente de ${u.email}`}
                    buttonStyle={{ padding: '7px 10px', fontSize: 12.5, borderRadius: 9 }}
                  />
                </div>
              )}
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', flex: 'none', width: 118, textAlign: 'right' }} title="Último login">{fmtLogin(u.ultimo_login)}</span>
              <Dropdown
                value=""
                resetAfterSelect
                align="right"
                placeholder="Acciones"
                ariaLabel={`Acciones sobre ${u.email}`}
                disabled={accionando}
                buttonStyle={{ padding: '7px 11px', fontSize: 12.5, borderRadius: 9 }}
                options={[
                  { value: 'rol', label: u.rol === 'admin' ? 'Hacer usuario' : 'Hacer admin' },
                  { value: 'estado', label: u.estado === 'suspendido' ? 'Reactivar' : 'Suspender' },
                  { value: 'eliminar', label: 'Eliminar…', color: 'var(--bad)' },
                ]}
                onChange={(v) => {
                  if (v === 'rol') accion({ action: 'rol', id: u.id, rol: u.rol === 'admin' ? 'usuario' : 'admin' });
                  else if (v === 'estado') accion({ action: 'estado', id: u.id, estado: u.estado === 'suspendido' ? 'activo' : 'suspendido' });
                  else if (v === 'eliminar') setAEliminar(u);
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
        El cliente de cada usuario decide qué datos ve. Los admin ven todo y no pertenecen a ningún cliente.
      </div>

      {/* ── Sesión legacy ────────────────────────────────────────────────── */}
      {sesion.legacy && (
        <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
          Estás con la sesión compartida vieja. Cerrá sesión y volvé a entrar con Google para que tu cuenta quede registrada.
        </div>
      )}

      {aEliminar && (
        <ConfirmDialog
          titulo={`¿Eliminar a ${aEliminar.nombre || aEliminar.email}?`}
          detalle="Pierde el acceso al dashboard. Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          danger
          onCancel={() => setAEliminar(null)}
          onConfirm={() => { const u = aEliminar; setAEliminar(null); accion({ action: 'eliminar', id: u.id }); }}
        />
      )}

      {nuevoClientePara != null && (
        <NombreClienteDialog
          titulo="Nuevo cliente"
          confirmLabel="Crear y asignar"
          nombre={nombreCliente}
          onNombre={setNombreCliente}
          onCancel={() => { setNuevoClientePara(null); setNombreCliente(''); }}
          onConfirm={crearClienteYUsar}
        />
      )}
    </div>
  );
}
