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

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown } from '../components/Dropdown';
import { ConfirmDialog } from '../_components/ChatItemMenu';
import { avisoInvitacion, type AvisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso';
import Link from '@/app/_ui/Link';
import { CuerpoGrupo, GrupoAjustes } from '@/app/_ui/Ajustes';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

/** `pasarAPro`: el tope de usuarios del plan (lib/tope-equipo-reglas.ts): el cartel lleva el link para pasar a Pro. */
type Respuesta = { ok: boolean; error?: string; invitacion?: ResultadoInvitacion | null; pasarAPro?: string };

function Aviso({ aviso }: { aviso: AvisoInvitacion }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12, lineHeight: 1.5, color: aviso.tono === 'ok' ? 'var(--good)' : 'var(--warn)' }}>
      {aviso.texto}
    </div>
  );
}


type Miembro = {
  id: number; email: string; nombre: string; foto_url: string | null;
  estado: 'invitado' | 'activo' | 'suspendido'; rol_ws: 'admin' | 'closer' | 'setter' | null; ultimo_login: string | null;
  /** null = nunca se le mandó el acceso. No es lo mismo que «no entró». */
  invitacion_enviada_at: string | null;
};

const chip = (bg: string, color: string): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', flex: 'none' });

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

/** `roles`: qué ve cada rol, en la línea de «Tu equipo» (lo escribe la página: tests/tabs-retiradas.test.ts lo fija ahí). */
export function EquipoView({ roles = null }: { roles?: ReactNode } = {}) {
  const [equipo, setEquipo] = useState<Miembro[] | null>(null);
  const [errCarga, setErrCarga] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('setter');
  const [creando, setCreando] = useState(false);
  const [errCrear, setErrCrear] = useState<string | null>(null);
  const [aPro, setAPro] = useState<string | null>(null);
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
    setErrCrear(null); setAPro(null); setHintCrear(null); setCreando(true);
    try {
      const destino = email.trim();
      const j = await post({ action: 'invitar', email: destino, nombre: nombre.trim(), rol_ws: rol });
      if (!j.ok) { setErrCrear(j.error ?? 'No se pudo invitar.'); setAPro(j.pasarAPro ?? null); return; }
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

  // EN SECCIONES DE SETTINGS (25/10/2026, Martín: «En settings no me gusta el diseño de "... Equipo..."... Fijate pagina por pagina
  // como lo hacen otras apps»). Eran dos tarjetas sueltas con estilos propios (los rótulos en mayúsculas de máquina, el botón
  // negro, el avatar cuadrado). Ahora, como Miembros de Vercel y Linear: «Sumar al equipo» con el formulario en una línea, y
  // «Tu equipo» con una fila por persona (la foto redonda, su nombre y correo, el estado, el rol, cuándo entró y las acciones).
  // Qué ve cada rol va en la línea de la sección, donde se elige.
  if (!equipo) {
    return (
      <GrupoAjustes titulo="Tu equipo" descripcion={roles}>
        <CuerpoGrupo>{errCarga ? <p className="aj-error" role="alert" style={{ margin: 0 }}>{errCarga}<ReportarASoporte /></p> : <p className="aj-texto" style={{ margin: 0 }}>Cargando…</p>}</CuerpoGrupo>
      </GrupoAjustes>
    );
  }

  return (
    <>
      <GrupoAjustes titulo="Sumar al equipo" descripcion="Le llega un correo con su acceso. El rol lo cambias cuando quieras.">
        <CuerpoGrupo>
          <div className="aj-invitar">
            <label className="aj-invitar__campo"><span className="aj-rotulo">Nombre</span><input className="aj-campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" /></label>
            <label className="aj-invitar__campo"><span className="aj-rotulo">Correo</span><input className="aj-campo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@email.com" onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) invitar(); }} /></label>
            <div className="aj-invitar__campo aj-invitar__rol"><span className="aj-rotulo">Rol</span><Dropdown value={rol} options={ROL_OPTS} onChange={setRol} width="100%" ariaLabel="Rol del miembro" buttonStyle={{ height: 44, borderRadius: 10 }} /></div>
            <button type="button" className="aj-boton" disabled={creando || !email.trim()} onClick={invitar}>{creando ? 'Invitando…' : 'Invitar'}</button>
          </div>
          {errCrear && <div className="aj-error" role="alert" style={{ margin: '14px 0 0' }}>{errCrear}{aPro && <> <Link href={aPro} style={{ color: 'var(--primary)' }}>Pasar a Pro</Link></>}<ReportarASoporte /></div>}
          {hintCrear && <Aviso aviso={hintCrear} />}
        </CuerpoGrupo>
      </GrupoAjustes>

      <GrupoAjustes titulo="Tu equipo" descripcion={roles} ancha>
        {errAccion && <CuerpoGrupo><p className="aj-error" role="alert" style={{ margin: 0 }}>{errAccion}<ReportarASoporte /></p></CuerpoGrupo>}
        {equipo.length === 0 ? (
          <CuerpoGrupo><p className="aj-texto" style={{ margin: 0 }}>Todavía eres el único. Suma a tu Closer o Setter arriba.</p></CuerpoGrupo>
        ) : equipo.map((u) => (
          <div key={u.id} className="aj-miembro">
            <div className="aj-miembro__fila">
              <span className="aj-miembro__foto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {u.foto_url ? <img src={u.foto_url} alt="" /> : inicialesTxt(u.nombre || u.email)}
              </span>
              <span className="aj-miembro__quien">
                <span className="aj-miembro__nombre">{u.nombre || '—'}</span>
                <span className="aj-miembro__correo">{u.email}</span>
              </span>
              <ChipEstado u={u} />
              <span className="aj-miembro__login" title="La última vez que entró">{fmtLogin(u.ultimo_login)}</span>
              <div className="aj-miembro__rol" title="Rol en el negocio">
                <Dropdown
                  value={u.rol_ws ?? 'admin'} options={ROL_OPTS}
                  onChange={(v) => accion({ action: 'rolws', id: u.id, rol_ws: v })}
                  width="100%" align="right" disabled={accionando}
                  ariaLabel={`Rol de ${u.email}`} buttonStyle={{ padding: '6px 10px', fontSize: 13, borderRadius: 9 }}
                />
              </div>
              <Dropdown
                value="" resetAfterSelect align="right" placeholder="Acciones"
                ariaLabel={`Acciones sobre ${u.email}`} disabled={accionando}
                buttonStyle={{ padding: '7px 11px', fontSize: 13, borderRadius: 9 }}
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
      </GrupoAjustes>

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
    </>
  );
}
