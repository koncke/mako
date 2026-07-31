'use client';

// =============================================================================
// AdminView — panel de administración de la AGENCIA
// =============================================================================
// Dos tabs:
//  · Clientes → cada cliente = un workspace. El alta crea el workspace + su
//    usuario admin-del-cliente de una. Cada fila se expande y muestra el EQUIPO
//    del cliente (admin / closer / setter) para visualizar y revocar; el alta de
//    equipo la hace el propio cliente desde su panel de Equipo. "Entrar como"
//    mete al admin de agencia en el dashboard del cliente.
//  · Super Admins → los admins de la APP (rol global 'admin'). Alta por email,
//    baja. Gestionan todos los clientes y no pertenecen a ninguno.
// Los guards duros (no dejar sin super admin ni sin admin de cliente) viven
// en el API; acá solo mostramos sus errores.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Icon } from '../_components/icons';
import { ConfirmDialog } from '../_components/ChatItemMenu';
import { Dropdown } from '../components/Dropdown';
import { CAPA_DEFAULT, CAPAS_LISTA, capaDef, type CapaId } from '@/lib/capas';
import type { Usuario } from '@/lib/usuarios';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Workspace = { id: number; nombre: string; slug: string | null; estado: 'activo' | 'pausado'; capa: CapaId; created_at: string; usuarios: number };
type Sesion = { email: string; legacy: boolean };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' };
const btnPrimary: CSSProperties = { padding: '9px 15px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' };
const chip = (bg: string, color: string): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', flex: 'none' });
const bannerError: CSSProperties = { background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '11px 15px', fontSize: 13, color: 'var(--bad)', fontWeight: 600, lineHeight: 1.5 };

const ROL_WS_OPTS = [
  { value: 'admin', label: 'Admin', sub: 'Ve todo el negocio' },
  { value: 'closer', label: 'Closer', sub: 'Cierra llamadas agendadas' },
  { value: 'setter', label: 'Setter', sub: 'Agenda y prospecta' },
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

function Cuadro({ texto, foto, size = 36 }: { texto: string; foto?: string | null; size?: number }) {
  return (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.36, color: '#171511', overflow: 'hidden' }}>
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
  const [tab, setTab] = useState<'clientes' | 'superadmins' | 'copy'>('clientes');

  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
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
      setSesion(ru.sesion as Sesion);
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  // La tab MaKo (copy) ahora vive en la sidebar → se abre con /admin?tab=copy.
  useEffect(() => { if (new URLSearchParams(window.location.search).get('tab') === 'copy') setTab('copy'); }, []);

  const header = (
    <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
      <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="admin" size={34} /></span>
      <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Admin</h1>
    </header>
  );

  const tabBtn = (id: 'clientes' | 'superadmins' | 'copy'): CSSProperties => ({
    padding: '10px 2px', marginRight: 26, background: 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: SANS, fontSize: 15, fontWeight: tab === id ? 600 : 500,
    color: tab === id ? 'var(--ink)' : 'var(--dim)',
    borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
  });

  const tabs = (
    <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
      <button style={tabBtn('clientes')} onClick={() => setTab('clientes')}>Clientes</button>
      <button style={tabBtn('superadmins')} onClick={() => setTab('superadmins')}>Super Admins</button>
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
        {tab === 'clientes' && <TabClientes workspaces={workspaces} usuarios={usuarios} recargar={cargar} />}
        {tab === 'superadmins' && <TabSuperAdmins usuarios={usuarios} sesion={sesion} recargar={cargar} />}
        {tab === 'copy' && <TabCopywriting />}
      </div>
    </main>
  );
}

// =============================================================================
// TAB — Clientes (workspaces + equipo de cada uno)
// =============================================================================
function TabClientes({ workspaces, usuarios, recargar }: { workspaces: Workspace[]; usuarios: Usuario[]; recargar: () => Promise<void> }) {
  const [nombre, setNombre] = useState('');
  const [capa, setCapa] = useState<CapaId>(CAPA_DEFAULT);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [errCrear, setErrCrear] = useState<string | null>(null);
  const [hintCrear, setHintCrear] = useState<string | null>(null);

  const [errAccion, setErrAccion] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);
  const [entrando, setEntrando] = useState<number | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [renombrando, setRenombrando] = useState<Workspace | null>(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [aEliminar, setAEliminar] = useState<Usuario | null>(null);

  const postWs = async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    try { return await (await fetch('/api/admin/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  };
  const postUser = async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    try { return await (await fetch('/api/admin/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  };

  const crear = async () => {
    if (creando) return;
    setErrCrear(null); setHintCrear(null); setCreando(true);
    try {
      const j = await postWs({ action: 'crear', nombre: nombre.trim(), capa, adminEmail: adminEmail.trim(), adminNombre: adminNombre.trim() });
      if (!j.ok) { setErrCrear(j.error ?? 'No se pudo crear el cliente.'); return; }
      setNombre(''); setAdminEmail(''); setAdminNombre('');
      setHintCrear(adminEmail.trim()
        ? 'Cliente creado. Cuando su admin entre con Google usando ese email, la cuenta se activa sola y arma su equipo.'
        : 'Cliente creado. Entrá como el cliente para configurarlo, o asignale un admin más tarde.');
      await recargar();
    } finally { setCreando(false); }
  };

  const accionUser = async (body: Record<string, unknown>) => {
    if (accionando) return;
    setErrAccion(null); setAccionando(true);
    try {
      const j = await postUser(body);
      if (!j.ok) { setErrAccion(j.error ?? 'No se pudo aplicar el cambio.'); return; }
      await recargar();
    } finally { setAccionando(false); }
  };

  const accionWs = async (body: Record<string, unknown>) => {
    if (accionando) return;
    setErrAccion(null); setAccionando(true);
    try {
      const j = await postWs(body);
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
    if (nuevo && nuevo !== w.nombre) await accionWs({ action: 'nombre', id: w.id, nombre: nuevo });
  };

  const puedeCrear = nombre.trim().length >= 2 && !creando;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Agregar cliente (crea workspace + su admin) ─────────────────────── */}
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 4 }}>Agregar cliente</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 16 }}>Cada cliente es un espacio de datos aislado. El <b>tipo</b> define qué compró: de él salen las tabs que ve, qué le pide el onboarding y qué se le siembra. El email del admin es opcional: si lo ponés, esa persona entra con Google y arma su equipo (Closer/Setter); si no, lo configurás vos con &ldquo;Entrar como&rdquo;.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.4fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Nombre del cliente</label>
            <input style={input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Elevate" onKeyDown={(e) => { if (e.key === 'Enter' && puedeCrear) crear(); }} />
          </div>
          <div>
            <label style={labelStyle}>Tipo</label>
            <Dropdown
              value={capa} ariaLabel="Tipo de cliente"
              buttonStyle={{ padding: '10px 12px', fontSize: 14, borderRadius: 11, width: '100%' }}
              options={CAPAS_LISTA.map((c) => ({ value: c.id, label: c.nombre }))}
              onChange={(v) => setCapa(v as CapaId)}
            />
          </div>
          <div>
            <label style={labelStyle}>Email del admin <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--faint)' }}>(opcional)</span></label>
            <input style={input} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="dueño@cliente.com" onKeyDown={(e) => { if (e.key === 'Enter' && puedeCrear) crear(); }} />
          </div>
          <div>
            <label style={labelStyle}>Nombre del admin</label>
            <input style={input} value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} placeholder="Nombre y apellido" />
          </div>
          <button style={{ ...btnDark, opacity: puedeCrear ? 1 : 0.5 }} disabled={!puedeCrear} onClick={crear}>{creando ? 'Creando…' : 'Crear cliente'}</button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 10, lineHeight: 1.5 }}>{capaDef(capa).descripcion}</div>
        {errCrear && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{errCrear}</div>}
        {hintCrear && <div style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600, marginTop: 12 }}>{hintCrear}</div>}
      </div>

      {/* ── Lista de clientes ────────────────────────────────────────────────── */}
      {errAccion && <div style={bannerError}>{errAccion}</div>}

      {workspaces.length === 0 ? (
        <div style={{ ...card, color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.5 }}>
          Todavía no hay clientes. Creá el primero arriba.
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {workspaces.map((w, i) => {
            const esDueno = w.id === 1;
            const equipo = usuarios.filter((u) => u.workspace_id === w.id);
            const expandido = abierto === w.id;
            return (
              <div key={w.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px' }}>
                  <button type="button" onClick={() => setAbierto(expandido ? null : w.id)} aria-label={expandido ? 'Contraer' : 'Expandir'}
                    style={{ flex: 'none', width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dim)', transform: expandido ? 'rotate(90deg)' : 'none', transition: 'transform .15s', fontSize: 13 }}>▸</button>
                  <Cuadro texto={inicialesTxt(w.nombre)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.nombre}</span>
                      {esDueno && <span style={chip('var(--accent-soft)', '#171511')}>Dueño</span>}
                      <span style={chip('var(--primary-bg)', 'var(--primary)')}>{capaDef(w.capa).nombre}</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{w.slug ?? '—'}</div>
                  </div>
                  {w.estado === 'activo'
                    ? <span style={chip('var(--good-bg)', 'var(--good)')}>activo</span>
                    : <span style={chip('var(--surface-2)', 'var(--dim)')}>pausado</span>}
                  <span style={{ fontSize: 12.5, color: 'var(--dim)', flex: 'none', width: 84, textAlign: 'right' }}>{w.usuarios} {w.usuarios === 1 ? 'miembro' : 'miembros'}</span>
                  <button style={{ ...btnPrimary, opacity: entrando != null ? 0.6 : 1 }} disabled={entrando != null} onClick={() => entrarComo(w)}>{entrando === w.id ? 'Entrando…' : 'Entrar como →'}</button>
                  <Dropdown
                    value="" resetAfterSelect align="right" placeholder="Acciones"
                    ariaLabel={`Acciones sobre ${w.nombre}`} disabled={accionando}
                    buttonStyle={{ padding: '7px 11px', fontSize: 12.5, borderRadius: 9 }}
                    options={[
                      { value: 'renombrar', label: 'Renombrar…' },
                      // Cambiar de capa = mover al cliente a otra oferta. Al dueño
                      // no: ws1 es la agencia y corre siempre con todo.
                      ...(esDueno ? [] : CAPAS_LISTA
                        .filter((c) => c.id !== w.capa)
                        .map((c) => ({ value: `capa:${c.id}`, label: `Pasar a ${c.nombre}` }))),
                      esDueno
                        ? { value: 'nopausar', label: 'No se puede pausar al dueño', disabled: true }
                        : { value: 'estado', label: w.estado === 'pausado' ? 'Activar' : 'Pausar' },
                    ]}
                    onChange={(v) => {
                      if (v === 'renombrar') { setNombreEdit(w.nombre); setRenombrando(w); }
                      else if (v.startsWith('capa:')) accionWs({ action: 'capa', id: w.id, capa: v.slice(5) });
                      else if (v === 'estado') accionWs({ action: 'estado', id: w.id, estado: w.estado === 'pausado' ? 'activo' : 'pausado' });
                    }}
                  />
                </div>

                {/* Equipo del cliente */}
                {expandido && (
                  <div style={{ padding: '4px 18px 16px 52px', background: 'var(--surface-2)' }}>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', padding: '10px 0 8px' }}>Equipo</div>
                    {equipo.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5, paddingBottom: 6 }}>
                        Sin miembros todavía. El admin de este cliente los suma desde su panel de Equipo (Configuraciones → Equipo), o entrá como el cliente para configurarlo.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {equipo.map((u) => (
                          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            <Cuadro texto={inicialesTxt(u.nombre || u.email)} foto={u.foto_url} size={32} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || '—'}</div>
                              <div style={{ fontSize: 12, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                            </div>
                            <ChipEstadoUsuario estado={u.estado} />
                            <div style={{ flex: 'none', width: 130 }} title="Rol en el negocio">
                              <Dropdown
                                value={u.rol_ws ?? 'admin'}
                                options={ROL_WS_OPTS}
                                onChange={(v) => accionUser({ action: 'rolws', id: u.id, rol_ws: v })}
                                width="100%" align="right"
                                disabled={accionando}
                                ariaLabel={`Rol de ${u.email}`}
                                buttonStyle={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 9 }}
                              />
                            </div>
                            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none', width: 110, textAlign: 'right' }} title="Último login">{fmtLogin(u.ultimo_login)}</span>
                            <Dropdown
                              value="" resetAfterSelect align="right" placeholder="⋯"
                              ariaLabel={`Acciones sobre ${u.email}`} disabled={accionando}
                              buttonStyle={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 9 }}
                              options={[
                                { value: 'estado', label: u.estado === 'suspendido' ? 'Reactivar' : 'Suspender' },
                                { value: 'eliminar', label: 'Eliminar…', color: 'var(--bad)' },
                              ]}
                              onChange={(v) => {
                                if (v === 'estado') accionUser({ action: 'estado', id: u.id, estado: u.estado === 'suspendido' ? 'activo' : 'suspendido' });
                                else if (v === 'eliminar') setAEliminar(u);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Usuarios sin cliente (huérfanos) ─────────────────────────────────── */}
      {(() => {
        const huerfanos = usuarios.filter((u) => u.rol === 'usuario' && u.workspace_id == null);
        if (huerfanos.length === 0) return null;
        const wsOpts = workspaces.map((w) => ({ value: String(w.id), label: w.nombre }));
        return (
          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 4 }}>Sin cliente</div>
            <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 14 }}>Cuentas que no pertenecen a ningún cliente: no ven datos hasta que las asignes.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {huerfanos.map((u) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Cuadro texto={inicialesTxt(u.nombre || u.email)} foto={u.foto_url} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                  </div>
                  <ChipEstadoUsuario estado={u.estado} />
                  <div style={{ flex: 'none', width: 180 }}>
                    <Dropdown
                      value="" options={wsOpts}
                      onChange={(v) => accionUser({ action: 'workspace', id: u.id, workspace_id: Number(v) })}
                      width="100%" align="right" placeholder="Asignar a cliente…"
                      disabled={accionando || workspaces.length === 0}
                      ariaLabel={`Asignar cliente a ${u.email}`}
                      buttonStyle={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 9 }}
                    />
                  </div>
                  <Dropdown
                    value="" resetAfterSelect align="right" placeholder="⋯"
                    ariaLabel={`Acciones sobre ${u.email}`} disabled={accionando}
                    buttonStyle={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 9 }}
                    options={[{ value: 'eliminar', label: 'Eliminar…', color: 'var(--bad)' }]}
                    onChange={(v) => { if (v === 'eliminar') setAEliminar(u); }}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
        Cada cliente ve solo sus propios datos. El <b>Admin</b> del cliente ve todas las tabs de su negocio; <b>Closer</b> y <b>Setter</b> ven solo las suyas. &ldquo;Entrar como&rdquo; te mete en su dashboard para configurarlo o dar soporte.
      </div>

      {renombrando && (
        <NombreClienteDialog
          nombre={nombreEdit}
          onNombre={setNombreEdit}
          onCancel={() => setRenombrando(null)}
          onConfirm={guardarNombre}
        />
      )}

      {aEliminar && (
        <ConfirmDialog
          titulo={`¿Eliminar a ${aEliminar.nombre || aEliminar.email}?`}
          detalle="Pierde el acceso al dashboard de este cliente. Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          danger
          onCancel={() => setAEliminar(null)}
          onConfirm={() => { const u = aEliminar; setAEliminar(null); accionUser({ action: 'eliminar', id: u.id }); }}
        />
      )}
    </div>
  );
}

// Mini modal para renombrar un workspace.
function NombreClienteDialog({ nombre, onNombre, onCancel, onConfirm, titulo = 'Renombrar cliente', confirmLabel = 'Guardar' }: { nombre: string; onNombre: (v: string) => void; onCancel: () => void; onConfirm: () => void; titulo?: string; confirmLabel?: string }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.32)', padding: '20px 22px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>{titulo}</div>
        <input autoFocus style={input} value={nombre} onChange={(e) => onNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(); }} placeholder="Nombre del cliente" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onCancel} style={btnGhost}>Cancelar</button>
          <button type="button" onClick={onConfirm} style={{ ...btnPrimary, opacity: nombre.trim().length < 2 ? 0.5 : 1 }} disabled={nombre.trim().length < 2}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB — Super Admins (admins de la app)
// =============================================================================
function TabSuperAdmins({ usuarios, sesion, recargar }: { usuarios: Usuario[]; sesion: Sesion; recargar: () => Promise<void> }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [creando, setCreando] = useState(false);
  const [errCrear, setErrCrear] = useState<string | null>(null);
  const [hintCrear, setHintCrear] = useState<string | null>(null);

  const [errAccion, setErrAccion] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);
  const [aEliminar, setAEliminar] = useState<Usuario | null>(null);

  const admins = usuarios.filter((u) => u.rol === 'admin');

  const post = async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    try { return await (await fetch('/api/admin/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  };

  const crear = async () => {
    if (creando) return;
    setErrCrear(null); setHintCrear(null); setCreando(true);
    try {
      const j = await post({ action: 'crear', email: email.trim(), nombre: nombre.trim(), rol: 'admin' });
      if (!j.ok) { setErrCrear(j.error ?? 'No se pudo crear el admin.'); return; }
      setNombre(''); setEmail('');
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
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 4 }}>Agregar super admin</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 16 }}>Los super admins gestionan todos los clientes y no pertenecen a ninguno. No son lo mismo que el &ldquo;admin&rdquo; de un cliente.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr auto', gap: 12, alignItems: 'end' }}>
          <div><label style={labelStyle}>Nombre</label><input style={input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" /></div>
          <div><label style={labelStyle}>Email</label><input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@empresa.com" onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) crear(); }} /></div>
          <button style={{ ...btnDark, opacity: creando || !email.trim() ? 0.5 : 1 }} disabled={creando || !email.trim()} onClick={crear}>{creando ? 'Agregando…' : 'Agregar'}</button>
        </div>
        {errCrear && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{errCrear}</div>}
        {hintCrear && <div style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600, marginTop: 12 }}>{hintCrear}</div>}
      </div>

      {errAccion && <div style={bannerError}>{errAccion}</div>}

      {admins.length === 0 ? (
        <div style={{ ...card, color: 'var(--dim)', fontSize: 13.5 }}>No hay super admins.</div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {admins.map((u, i) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <Cuadro texto={inicialesTxt(u.nombre || u.email)} foto={u.foto_url} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || '—'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
              </div>
              <span style={chip('var(--primary-bg)', 'var(--primary)')}>super admin</span>
              <ChipEstadoUsuario estado={u.estado} />
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', flex: 'none', width: 118, textAlign: 'right' }} title="Último login">{fmtLogin(u.ultimo_login)}</span>
              <Dropdown
                value="" resetAfterSelect align="right" placeholder="Acciones"
                ariaLabel={`Acciones sobre ${u.email}`} disabled={accionando}
                buttonStyle={{ padding: '7px 11px', fontSize: 12.5, borderRadius: 9 }}
                options={[
                  { value: 'estado', label: u.estado === 'suspendido' ? 'Reactivar' : 'Suspender' },
                  { value: 'eliminar', label: 'Eliminar…', color: 'var(--bad)' },
                ]}
                onChange={(v) => {
                  if (v === 'estado') accion({ action: 'estado', id: u.id, estado: u.estado === 'suspendido' ? 'activo' : 'suspendido' });
                  else if (v === 'eliminar') setAEliminar(u);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {sesion.legacy && (
        <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
          Estás con la sesión compartida vieja. Cerrá sesión y volvé a entrar con Google para que tu cuenta quede registrada.
        </div>
      )}

      {aEliminar && (
        <ConfirmDialog
          titulo={`¿Eliminar a ${aEliminar.nombre || aEliminar.email}?`}
          detalle="Pierde el acceso como super admin. Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          danger
          onCancel={() => setAEliminar(null)}
          onConfirm={() => { const u = aEliminar; setAEliminar(null); accion({ action: 'eliminar', id: u.id }); }}
        />
      )}
    </div>
  );
}

// =============================================================================
// TAB — MaKo (cerebro de copywriting: metodología curada + swipe de ejemplos)
// =============================================================================
// Owner-only. La metodología eleva TODA la redacción de MaKo (nutrición, asesor
// de WhatsApp, plantillas). Los ejemplos son emails reales que cargás como
// referencia; MaKo los usa de few-shot al escribir. Ambos se guardan en el
// workspace del dueño y se comparten (read-only) a la IA de todos los clientes.

type EjemploSwipe = { id: number; titulo: string; fuente: string | null; cuerpo: string; created_at: string };

function TabCopywriting() {
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [metodo, setMetodo] = useState(false);
  const [ejemplos, setEjemplos] = useState<EjemploSwipe[]>([]);

  const [sembrando, setSembrando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [nota, setNota] = useState('');
  const [fuente, setFuente] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errEj, setErrEj] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<EjemploSwipe | null>(null);

  const cargar = useCallback(async () => {
    setErr(null);
    try {
      const j = await (await fetch('/api/mako/copywriting', { cache: 'no-store' })).json();
      if (!j.ok) { setErr(j.error ?? 'No se pudo cargar.'); return; }
      setMetodo(Boolean(j.metodoSembrado));
      setEjemplos((j.ejemplos ?? []) as EjemploSwipe[]);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const post = async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; creadas?: number }> => {
    try { return await (await fetch('/api/mako/copywriting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  };

  const sembrar = async () => {
    if (sembrando) return;
    setSembrando(true); setAviso(null);
    try {
      const j = await post({ action: 'seed' });
      if (!j.ok) { setAviso(j.error ?? 'No se pudo sembrar.'); return; }
      setMetodo(true);
      setAviso(j.creadas ? `Listo — MaKo aprendió ${j.creadas} marcos de copywriting.` : 'La metodología ya estaba cargada.');
    } finally { setSembrando(false); }
  };

  const agregar = async () => {
    if (guardando || !cuerpo.trim()) return;
    setGuardando(true); setErrEj(null);
    try {
      const j = await post({ action: 'add-ejemplo', asunto: asunto.trim(), cuerpo: cuerpo.trim(), nota: nota.trim(), fuente: fuente.trim() });
      if (!j.ok) { setErrEj(j.error ?? 'No se pudo guardar el ejemplo.'); return; }
      setAsunto(''); setCuerpo(''); setNota(''); setFuente('');
      await cargar();
    } finally { setGuardando(false); }
  };

  const borrar = async (id: number) => {
    const j = await post({ action: 'del-ejemplo', id });
    if (!j.ok) { setErrEj(j.error ?? 'No se pudo borrar.'); return; }
    await cargar();
  };

  if (cargando) return <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando…</div>;
  if (err) {
    return (
      <div style={{ ...bannerError, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between' }}>
        <span>{err}</span>
        <button style={{ ...btnDark, padding: '8px 14px', flex: 'none' }} onClick={() => { setCargando(true); cargar(); }}>Reintentar</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Metodología curada ─────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>Metodología de copywriting</div>
          {metodo
            ? <span style={chip('var(--good-bg)', 'var(--good)')}>cargada ✓</span>
            : <span style={chip('var(--warn-bg)', 'var(--warn)')}>sin cargar</span>}
        </div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 16, lineHeight: 1.55 }}>
          Marcos probados (AIDA, PAS, gatillos de psicología, anatomía de secuencias, asuntos, CTA, qué nunca hacer). Se cargan como conocimiento del área <b>mensajes</b> y elevan <b>toda</b> la redacción de MaKo: la nutrición, el asesor de WhatsApp y las plantillas. Se edita después en <b>Conocimiento</b>.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...btnDark, opacity: sembrando ? 0.5 : 1 }} disabled={sembrando} onClick={sembrar}>
            {sembrando ? 'Cargando…' : metodo ? 'Volver a sembrar' : 'Cargar metodología'}
          </button>
          {aviso && <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>{aviso}</span>}
        </div>
      </div>

      {/* ── Swipe de ejemplos ──────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 4 }}>Ejemplos reales (swipe)</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 16, lineHeight: 1.55 }}>
          Pegá emails o mensajes que te lleguen y te parezcan buenos. MaKo los usa de referencia (few-shot) al escribir. No hace falta que sean tuyos: sirven como muestra de estructura y tono.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Asunto <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--faint)' }}>(opcional)</span></label>
            <input style={input} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="El asunto del email" />
          </div>
          <div>
            <label style={labelStyle}>De quién / fuente <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--faint)' }}>(opcional)</span></label>
            <input style={input} value={fuente} onChange={(e) => setFuente(e.target.value)} placeholder="Ej. Newsletter de X" />
          </div>
        </div>
        <label style={labelStyle}>Mensaje</label>
        <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={6} placeholder="Pegá acá el cuerpo del email / mensaje."
          style={{ ...input, resize: 'vertical', lineHeight: 1.5, marginBottom: 12 }} />
        <label style={labelStyle}>Por qué te gustó <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--faint)' }}>(opcional, pero ayuda a MaKo)</span></label>
        <input style={{ ...input, marginBottom: 14 }} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. El asunto genera curiosidad y el cierre no presiona." />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...btnDark, opacity: guardando || !cuerpo.trim() ? 0.5 : 1 }} disabled={guardando || !cuerpo.trim()} onClick={agregar}>{guardando ? 'Guardando…' : 'Guardar ejemplo'}</button>
          {errEj && <span style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{errEj}</span>}
        </div>
      </div>

      {ejemplos.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '13px 18px', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', borderBottom: '1px solid var(--border)' }}>{ejemplos.length} {ejemplos.length === 1 ? 'ejemplo' : 'ejemplos'} cargados</div>
          {ejemplos.map((ej, i) => (
            <div key={ej.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ej.titulo || '(sin asunto)'}</div>
                {ej.fuente && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 1 }}>{ej.fuente}</div>}
                <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ej.cuerpo}</div>
              </div>
              <button style={{ ...btnGhost, padding: '6px 10px', fontSize: 12.5, color: 'var(--bad)', flex: 'none' }} onClick={() => setABorrar(ej)}>Borrar</button>
            </div>
          ))}
        </div>
      )}

      {aBorrar && (
        <ConfirmDialog
          titulo="¿Borrar este ejemplo?"
          detalle="MaKo deja de usarlo como referencia. Esta acción no se puede deshacer."
          confirmLabel="Borrar"
          danger
          onCancel={() => setABorrar(null)}
          onConfirm={() => { const ej = aBorrar; setABorrar(null); borrar(ej.id); }}
        />
      )}
    </div>
  );
}

// =============================================================================
// TAB — Ángulos de guion (la biblioteca que alimenta "Nuevo guion" en la Matriz)
