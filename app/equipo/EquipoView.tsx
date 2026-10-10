'use client';

// =============================================================================
// EquipoView — alta y gestión del equipo del cliente (Closer / Setter / Admin)
// =============================================================================
// Consume /api/equipo (scopeado al workspace del request). El alta invita por
// email: cuando la persona entra con Google usando ese email, su cuenta se
// activa sola con el rol asignado.
//
// ⚠️ EL BOTÓN DECÍA «INVITAR» Y NO INVITABA A NADIE. Creaba la fila y ahí terminaba; el
// closer nunca se enteraba de que tenía cuenta, y el cliente no tenía cómo saber que
// faltaba avisarle — el botón ya le había dicho que la invitación estaba hecha. Ahora
// el mail sale solo (lib/invitaciones.ts) y la pantalla dice si salió o no.

import { useEffect, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { ConfirmDialog } from '../_components/ChatItemMenu';
import { avisoInvitacion, type AvisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso';

type Respuesta = { ok: boolean; error?: string; invitacion?: ResultadoInvitacion | null };

function Aviso({ aviso }: { aviso: AvisoInvitacion }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12, lineHeight: 1.5, color: aviso.tono === 'ok' ? 'var(--good)' : 'var(--warn)' }}>
      {aviso.texto}
    </div>
  );
}

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Miembro = {
  id: number; email: string; nombre: string; foto_url: string | null;
  estado: 'invitado' | 'activo' | 'suspendido'; rol_ws: 'admin' | 'closer' | 'setter' | null; ultimo_login: string | null;
  /** null = nunca se le mandó el acceso. No es lo mismo que «no entró». */
  invitacion_enviada_at: string | null;
};

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const chip = (bg: string, color: string): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', flex: 'none' });
const bannerError: CSSProperties = { background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '11px 15px', fontSize: 13, color: 'var(--bad)', fontWeight: 600, lineHeight: 1.5, marginBottom: 16 };

const ROL_OPTS = [
  { value: 'setter', label: 'Setter', sub: 'CRM, WhatsApp, Email' },
  { value: 'closer', label: 'Closer', sub: 'CRM, WhatsApp, Closing' },
  { value: 'admin', label: 'Admin', sub: 'Todo el negocio' },
];

const fmtLogin = (iso: string | null) => {
  if (!iso) return 'nunca entró';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
};
const inicialesTxt = (base: string) => {
  const p = (base || '?').trim().split(/\s+/).filter(Boolean);
  return (p.length >= 2 ? `${p[0][0]}${p[1][0]}` : (base || '?').slice(0, 1)).toUpperCase();
};

function ChipEstado({ u }: { u: Miembro }) {
  if (u.estado === 'activo') return <span style={chip('var(--good-bg)', 'var(--good)')}>activo</span>;
  if (u.estado === 'suspendido') return <span style={chip('var(--bad-bg)', 'var(--bad)')}>suspendido</span>;
  // «Invitado» a secas afirmaba algo que no había pasado. Si no se le avisó, lo dice.
  if (!u.invitacion_enviada_at) return <span style={chip('var(--bad-bg)', 'var(--bad)')}>sin avisar</span>;
  return <span style={chip('var(--warn-bg)', 'var(--warn)')}>invitado</span>;
}

export function EquipoView() {
  const [equipo, setEquipo] = useState<Miembro[] | null>(null);
  const [errCarga, setErrCarga] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('setter');
  const [creando, setCreando] = useState(false);
  const [errCrear, setErrCrear] = useState<string | null>(null);
  const [hintCrear, setHintCrear] = useState<AvisoInvitacion | null>(null);

  const [errAccion, setErrAccion] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);
  const [aEliminar, setAEliminar] = useState<Miembro | null>(null);
  const [avisoReenvio, setAvisoReenvio] = useState<{ id: number; aviso: AvisoInvitacion } | null>(null);

  const cargar = async () => {
    setErrCarga(null);
    try {
      const j = await (await fetch('/api/equipo')).json();
      if (!j.ok) { setErrCarga(j.error ?? 'No se pudo cargar el equipo.'); return; }
      setEquipo(j.equipo as Miembro[]);
    } catch (e) { setErrCarga(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { cargar(); }, []);

  const post = async (body: Record<string, unknown>): Promise<Respuesta> => {
    try { return await (await fetch('/api/equipo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  };

  const invitar = async () => {
    if (creando) return;
    setErrCrear(null); setHintCrear(null); setCreando(true);
    try {
      const destino = email.trim();
      const j = await post({ action: 'invitar', email: destino, nombre: nombre.trim(), rol_ws: rol });
      if (!j.ok) { setErrCrear(j.error ?? 'No se pudo invitar.'); return; }
      setNombre(''); setEmail(''); setRol('setter');
      setHintCrear(avisoInvitacion(j.invitacion, destino));
      await cargar();
    } finally { setCreando(false); }
  };

  const reenviar = async (u: Miembro) => {
    if (accionando) return;
    setAvisoReenvio(null); setErrAccion(null); setAccionando(true);
    try {
      const j = await post({ action: 'reinvitar', id: u.id });
      if (!j.ok) { setErrAccion(j.error ?? 'No se pudo reenviar el acceso.'); return; }
      setAvisoReenvio({ id: u.id, aviso: avisoInvitacion(j.invitacion, u.email) });
      await cargar();
    } finally { setAccionando(false); }
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

  if (errCarga) return <div style={bannerError}>{errCarga}</div>;
  if (!equipo) return <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Invitar */}
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 16 }}>Sumar al equipo</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 150px auto', gap: 12, alignItems: 'end' }}>
          <div><label style={labelStyle}>Nombre</label><input style={input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" /></div>
          <div><label style={labelStyle}>Email</label><input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@email.com" onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) invitar(); }} /></div>
          <div><label style={labelStyle}>Rol</label><Dropdown value={rol} options={ROL_OPTS} onChange={setRol} width="100%" ariaLabel="Rol del miembro" /></div>
          <button style={{ ...btnDark, opacity: creando || !email.trim() ? 0.5 : 1 }} disabled={creando || !email.trim()} onClick={invitar}>{creando ? 'Invitando…' : 'Invitar'}</button>
        </div>
        {errCrear && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{errCrear}</div>}
        {hintCrear && <Aviso aviso={hintCrear} />}
      </div>

      {errAccion && <div style={bannerError}>{errAccion}</div>}

      {equipo.length === 0 ? (
        <div style={{ ...card, color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.5 }}>
          Todavía eres el único. Suma a tu Closer o Setter arriba.
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {equipo.map((u, i) => (
            <div key={u.id} style={{ padding: '0 18px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
              <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#171511', overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {u.foto_url ? <img src={u.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : inicialesTxt(u.nombre || u.email)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || '—'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
              </div>
              <ChipEstado u={u} />
              <div style={{ flex: 'none', width: 140 }} title="Rol en el negocio">
                <Dropdown
                  value={u.rol_ws ?? 'admin'} options={ROL_OPTS}
                  onChange={(v) => accion({ action: 'rolws', id: u.id, rol_ws: v })}
                  width="100%" align="right" disabled={accionando}
                  ariaLabel={`Rol de ${u.email}`} buttonStyle={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 9 }}
                />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', flex: 'none', width: 118, textAlign: 'right' }} title="Último login">{fmtLogin(u.ultimo_login)}</span>
              <Dropdown
                value="" resetAfterSelect align="right" placeholder="Acciones"
                ariaLabel={`Acciones sobre ${u.email}`} disabled={accionando}
                buttonStyle={{ padding: '7px 11px', fontSize: 12.5, borderRadius: 9 }}
                options={[
                  { value: 'reinvitar', label: u.invitacion_enviada_at ? 'Reenviar acceso' : 'Mandarle el acceso', icono: 'enviar' },
                  { value: 'estado', label: u.estado === 'suspendido' ? 'Reactivar' : 'Suspender', icono: u.estado === 'suspendido' ? 'activar' : 'pausar' },
                  { value: 'eliminar', label: 'Eliminar…', icono: 'borrar' },
                ]}
                onChange={(v) => {
                  if (v === 'reinvitar') reenviar(u);
                  else if (v === 'estado') accion({ action: 'estado', id: u.id, estado: u.estado === 'suspendido' ? 'activo' : 'suspendido' });
                  else if (v === 'eliminar') setAEliminar(u);
                }}
              />
            </div>
            {avisoReenvio?.id === u.id && <div style={{ paddingBottom: 12 }}><Aviso aviso={avisoReenvio.aviso} /></div>}
            </div>
          ))}
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
    </div>
  );
}
