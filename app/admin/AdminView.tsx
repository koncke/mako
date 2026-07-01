'use client';

// =============================================================================
// AdminView — cuentas del dashboard: resumen, alta y gestión de usuarios
// =============================================================================
// Consume /api/admin/usuarios (GET lista + resumen, POST acciones). El guard de
// "único admin activo" vive en el API; acá solo mostramos sus errores.

import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Icon } from '../_components/icons';
import { ConfirmDialog } from '../_components/ChatItemMenu';
import { Dropdown } from '../components/Dropdown';
import type { Usuario } from '@/lib/usuarios';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Resumen = {
  integraciones: { conectadas: number; total: number; porServicio: { key: string; nombre: string; core: boolean; conectada: boolean }[] };
  perfilNegocio: { completados: number; total: number };
};
type Data = { usuarios: Usuario[]; resumen: Resumen; sesion: { email: string; legacy: boolean } };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const kpiLabel: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' };
const kpiNum: CSSProperties = { fontFamily: MONO, fontSize: 26, fontWeight: 700, color: 'var(--ink)', marginTop: 6 };
const linkStyle: CSSProperties = { fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' };
const chip = (bg: string, color: string): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', flex: 'none' });
const bannerError: CSSProperties = { background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '11px 15px', fontSize: 13, color: 'var(--bad)', fontWeight: 600, lineHeight: 1.5 };

const ROL_OPTS = [
  { value: 'usuario', label: 'Usuario', sub: 'Usa el dashboard' },
  { value: 'admin', label: 'Admin', sub: 'Gestiona usuarios y configuración' },
];

const fmtLogin = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
};

const iniciales = (u: Usuario) => {
  const base = (u.nombre || u.email).trim();
  const partes = base.split(/\s+/).filter(Boolean);
  return (partes.length >= 2 ? `${partes[0][0]}${partes[1][0]}` : base.slice(0, 1)).toUpperCase();
};

function Avatar({ u }: { u: Usuario }) {
  return (
    <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#171511', overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {u.foto_url ? <img src={u.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : iniciales(u)}
    </div>
  );
}

function ChipEstado({ estado }: { estado: Usuario['estado'] }) {
  if (estado === 'activo') return <span style={chip('var(--good-bg)', 'var(--good)')}>activo</span>;
  if (estado === 'suspendido') return <span style={chip('var(--bad-bg)', 'var(--bad)')}>suspendido</span>;
  return <span style={chip('var(--warn-bg)', 'var(--warn)')}>invitado — nunca entró</span>;
}

export function AdminView() {
  const [data, setData] = useState<Data | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // alta de usuario
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rolNuevo, setRolNuevo] = useState('usuario');
  const [creando, setCreando] = useState(false);
  const [errCrear, setErrCrear] = useState<string | null>(null);
  const [hintCrear, setHintCrear] = useState<string | null>(null);

  // acciones sobre la lista
  const [errAccion, setErrAccion] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);
  const [aEliminar, setAEliminar] = useState<Usuario | null>(null);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/admin/usuarios')).json();
      if (!j.ok) { setErrorCarga(j.error ?? 'No se pudo cargar la lista.'); return; }
      setData({ usuarios: j.usuarios as Usuario[], resumen: j.resumen as Resumen, sesion: j.sesion as Data['sesion'] });
      setErrorCarga(null);
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const post = async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    try {
      return await (await fetch('/api/admin/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  const crear = async () => {
    if (creando) return;
    setErrCrear(null); setHintCrear(null); setCreando(true);
    try {
      const j = await post({ action: 'crear', email: email.trim(), nombre: nombre.trim(), rol: rolNuevo });
      if (!j.ok) { setErrCrear(j.error ?? 'No se pudo crear el usuario.'); return; }
      setNombre(''); setEmail(''); setRolNuevo('usuario');
      setHintCrear('Listo. Cuando entre con Google usando ese email, la cuenta se activa sola.');
      await cargar();
    } finally { setCreando(false); }
  };

  const accion = async (body: Record<string, unknown>) => {
    if (accionando) return;
    setErrAccion(null); setAccionando(true);
    try {
      const j = await post(body);
      if (!j.ok) { setErrAccion(j.error ?? 'No se pudo aplicar el cambio.'); return; }
      await cargar();
    } finally { setAccionando(false); }
  };

  const header = (
    <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
      <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="admin" size={34} /></span>
      <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Admin</h1>
    </header>
  );

  if (cargando) {
    return (
      <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
        {header}
        <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13, maxWidth: 980 }}>Cargando…</div>
      </main>
    );
  }

  if (errorCarga || !data) {
    return (
      <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
        {header}
        <div style={{ ...bannerError, maxWidth: 980, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between' }}>
          <span>No se pudo cargar la vista de admin. {errorCarga ?? 'Sin datos.'}</span>
          <button style={{ ...btnDark, padding: '8px 14px', flex: 'none' }} onClick={() => { setCargando(true); cargar(); }}>Reintentar</button>
        </div>
      </main>
    );
  }

  const { usuarios, resumen, sesion } = data;
  const activos = usuarios.filter((u) => u.estado === 'activo').length;
  const coresFaltan = resumen.integraciones.porServicio.filter((s) => s.core && !s.conectada);

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      {header}

      <div style={{ maxWidth: 980, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ── Resumen ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div style={card}>
            <div style={kpiLabel}>Usuarios</div>
            <div style={kpiNum}>{usuarios.length}</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>{activos} {activos === 1 ? 'activo' : 'activos'}</div>
          </div>
          <div style={card}>
            <div style={kpiLabel}>Integraciones</div>
            <div style={kpiNum}>{resumen.integraciones.conectadas}<span style={{ color: 'var(--faint)', fontWeight: 500 }}>/{resumen.integraciones.total}</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>conectadas · <Link href="/metodo" style={linkStyle}>Configurar →</Link></div>
            {coresFaltan.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 600, marginTop: 8 }}>Falta core: {coresFaltan.map((s) => s.nombre).join(', ')}</div>
            )}
          </div>
          <div style={card}>
            <div style={kpiLabel}>Perfil del negocio</div>
            <div style={kpiNum}>{resumen.perfilNegocio.completados}<span style={{ color: 'var(--faint)', fontWeight: 500 }}>/{resumen.perfilNegocio.total}</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>campos · <Link href="/onboarding" style={linkStyle}>Completar →</Link></div>
          </div>
        </div>

        {/* ── Agregar usuario ─────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 16 }}>Agregar usuario</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 230px auto', gap: 12, alignItems: 'end' }}>
            <div><label style={labelStyle}>Nombre</label><input style={input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" /></div>
            <div><label style={labelStyle}>Email</label><input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@empresa.com" /></div>
            <div>
              <label style={labelStyle}>Rol</label>
              <Dropdown value={rolNuevo} options={ROL_OPTS} onChange={setRolNuevo} width="100%" ariaLabel="Rol del usuario nuevo" />
            </div>
            <button style={{ ...btnDark, opacity: creando || !email.trim() ? 0.5 : 1 }} disabled={creando || !email.trim()} onClick={crear}>{creando ? 'Agregando…' : 'Agregar'}</button>
          </div>
          {errCrear && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{errCrear}</div>}
          {hintCrear && <div style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600, marginTop: 12 }}>{hintCrear}</div>}
        </div>

        {/* ── Lista de usuarios ───────────────────────────────────────────── */}
        {errAccion && <div style={bannerError}>{errAccion}</div>}

        {usuarios.length === 0 ? (
          <div style={{ ...card, color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.5 }}>
            Todavía no hay usuarios. Agregá el primero arriba — o entrá con Google y tu cuenta se crea sola como admin.
          </div>
        ) : (
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            {usuarios.map((u, i) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <Avatar u={u} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || '—'}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                </div>
                {u.rol === 'admin'
                  ? <span style={chip('var(--primary-bg)', 'var(--primary)')}>admin</span>
                  : <span style={chip('var(--surface-2)', 'var(--dim)')}>usuario</span>}
                <ChipEstado estado={u.estado} />
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

        {/* ── Sesión legacy ───────────────────────────────────────────────── */}
        {sesion.legacy && (
          <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
            Estás con la sesión compartida vieja. Cerrá sesión y volvé a entrar con Google para que tu cuenta quede registrada.
          </div>
        )}
      </div>

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
    </main>
  );
}
