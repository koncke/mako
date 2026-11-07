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
import { CtaPasarAPro } from '../_components/CtaPasarAPro';
import { avisoInvitacion, type AvisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso';
import Link from '@/app/_ui/Link';
import { CuerpoGrupo, FilaAjustes, GrupoAjustes, SELECT_AJUSTES, TituloAjustes } from '@/app/_ui/Ajustes';
import { Modal } from '@/app/_ui/Modal';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { iniciales } from '@/lib/unicode-seguro';

/** `pasarAPro`: el tope de usuarios del plan (lib/tope-equipo-reglas.ts): el cartel lleva el link para pasar a Pro. */
type Respuesta = { ok: boolean; error?: string; invitacion?: ResultadoInvitacion | null; pasarAPro?: string };

function Aviso({ aviso }: { aviso: AvisoInvitacion }) {
  return (
    <div role="status" style={{ fontSize: 13, fontWeight: 600, margin: '0 0 16px', lineHeight: 1.5, color: aviso.tono === 'ok' ? 'var(--good)' : 'var(--warn)' }}>
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
const inicialesTxt = (base: string) => iniciales(base);

function ChipEstado({ u }: { u: Miembro }) {
  if (u.estado === 'activo') return null;
  if (u.estado === 'suspendido') return <span className="aj-miembro__estado" style={chip('var(--bad-bg)', 'var(--bad)')}>suspendido</span>;
  // «Invitado» a secas afirmaba algo que no había pasado. Si no se le avisó, lo dice.
  if (!u.invitacion_enviada_at) return <span className="aj-miembro__estado" style={chip('var(--bad-bg)', 'var(--bad)')}>sin avisar</span>;
  return <span className="aj-miembro__estado" style={chip('var(--warn-bg)', 'var(--warn)')}>invitación enviada</span>;
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
  const [invitando, setInvitando] = useState(false);
  const [buscar, setBuscar] = useState('');

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
      setInvitando(false);
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

  // COMO MEMBERS DE LINEAR (25/10/2026, Settings copiada de Linear, docs/settings/referencia.md; Martín: «Pusiste textos previo a
  // la configuración que están muy de sobra»). Arriba el título con «Invitar», que abre un modal (nombre, correo y rol, con qué
  // ve cada rol al lado del rol, donde se elige); debajo, una fila por persona: la foto, su nombre y correo, su estado sólo si NO
  // está activa, cuándo entró, el rol en un select y el «⋯» con lo demás. Se fue la tarjeta «Sumar al equipo» siempre abierta
  // y su línea, y la línea larga de los roles arriba de la lista.
  const titulo = (
    <TituloAjustes titulo="Equipo" accion={<button type="button" className="aj-boton" onClick={() => { setInvitando(true); setErrCrear(null); setAPro(null); }}>Invitar</button>} />
  );
  if (!equipo) {
    return (
      <>
        {titulo}
        <GrupoAjustes>
          {errCarga ? <CuerpoGrupo><p className="aj-error" role="alert" style={{ margin: 0 }}>{errCarga}<ReportarASoporte /></p></CuerpoGrupo> : <FilaAjustes titulo="Cargando…" />}
        </GrupoAjustes>
      </>
    );
  }

  const q = buscar.trim().toLowerCase();
  const visibles = q ? equipo.filter((u) => `${u.nombre} ${u.email}`.toLowerCase().includes(q)) : equipo;

  return (
    <>
      {titulo}
      {hintCrear && <Aviso aviso={hintCrear} />}

      {/* Vacío, sin «0 personas» ni un segundo «Invitar» (30/10/2026, visto en producción): el de arriba alcanza. */}
      <GrupoAjustes titulo={equipo.length === 0 ? undefined : equipo.length === 1 ? '1 persona' : `${equipo.length} personas`}
        accion={equipo.length > 5 && <input className="aj-en-linea" style={{ width: 220 }} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar" aria-label="Buscar en el equipo" />}>
        {errAccion && <CuerpoGrupo><p className="aj-error" role="alert" style={{ margin: 0 }}>{errAccion}<ReportarASoporte /></p></CuerpoGrupo>}
        {equipo.length === 0 ? (
          <FilaAjustes titulo="Todavía no hay nadie más en tu equipo" />
        ) : visibles.map((u) => (
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
                  ariaLabel={`Rol de ${u.email}`} buttonStyle={SELECT_AJUSTES}
                />
              </div>
              <span className="aj-miembro__mas"><Dropdown
                value="" resetAfterSelect align="right" placeholder="⋯" sinFlecha
                ariaLabel={`Acciones sobre ${u.email}`} disabled={accionando} width={40}
                buttonStyle={{ ...SELECT_AJUSTES, justifyContent: 'center', padding: 0, fontSize: 18, border: 'none', background: 'transparent' }}
                options={[
                  { value: 'reinvitar', label: u.invitacion_enviada_at ? 'Reenviar acceso' : 'Mandarle el acceso', icono: 'enviar' },
                  { value: 'estado', label: u.estado === 'suspendido' ? 'Reactivar' : 'Suspender', icono: u.estado === 'suspendido' ? 'activar' : 'pausar' },
                  { value: 'eliminar', label: 'Quitar del equipo…', icono: 'borrar' },
                ]}
                onChange={(v) => {
                  if (v === 'reinvitar') reenviar(u);
                  else if (v === 'estado') accion({ action: 'estado', id: u.id, estado: u.estado === 'suspendido' ? 'activo' : 'suspendido' });
                  else if (v === 'eliminar') setAEliminar(u);
                }}
              /></span>
            </div>
            {avisoReenvio?.id === u.id && <div style={{ paddingBottom: 12 }}><Aviso aviso={avisoReenvio.aviso} /></div>}
          </div>
        ))}
        {equipo.length > 0 && visibles.length === 0 && <FilaAjustes titulo="Nadie con ese nombre o correo" />}
      </GrupoAjustes>

      {invitando && (
        <Modal titulo="Invitar al equipo" ancho={480} onCerrar={() => setInvitando(false)}
          pie={(
            <>
              <button type="button" className="aj-boton" data-variante="texto" onClick={() => setInvitando(false)}>Cancelar</button>
              <button type="button" className="aj-boton" disabled={creando || !email.trim()} onClick={invitar}>{creando ? 'Invitando…' : 'Invitar'}</button>
            </>
          )}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="aj-invitar__campo"><span className="aj-rotulo">Correo</span><input className="aj-campo" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@email.com" onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) invitar(); }} /></label>
            <label className="aj-invitar__campo"><span className="aj-rotulo">Nombre</span><input className="aj-campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" /></label>
            <div className="aj-invitar__campo"><span className="aj-rotulo">Rol</span><Dropdown value={rol} options={ROL_OPTS} onChange={setRol} width="100%" ariaLabel="Rol del miembro" buttonStyle={{ ...SELECT_AJUSTES, height: 40 }} /></div>
            {roles && <p className="aj-texto" style={{ margin: 0, fontSize: 13 }}>{roles}</p>}
            {/* El tope de usuarios del plan: el cliente de una agencia no sube de plan acá (6/11/2026, #494), se lo pide a ella. */}
            {errCrear && <div className="aj-error" role="alert" style={{ margin: 0 }}>{errCrear}{aPro && <> <CtaPasarAPro><Link href={aPro} style={{ color: 'var(--primary)' }}>Pasar a Pro</Link></CtaPasarAPro></>}<ReportarASoporte /></div>}
          </div>
        </Modal>
      )}

      {aEliminar && (
        <ConfirmDialog
          titulo={`¿Quitar a ${aEliminar.nombre || aEliminar.email} del equipo?`}
          detalle="Pierde el acceso a MaKo. Esta acción no se puede deshacer."
          confirmLabel="Quitar"
          danger
          onCancel={() => setAEliminar(null)}
          onConfirm={() => { const u = aEliminar; setAEliminar(null); accion({ action: 'eliminar', id: u.id }); }}
        />
      )}
    </>
  );
}
