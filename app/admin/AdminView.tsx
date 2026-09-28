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

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
// Los estilos de esta pantalla viven en su modulo desde que /admin/copywriting se
// llevo ocho de ellos: copiarlos alla era el segundo lugar donde vive el mismo boton.
import { MONO, SANS, card, input, labelStyle, btnDark, btnGhost, btnPrimary, chip, bannerError } from './estilos';
import type { Workspace, Sesion } from './tipos';
// ⚠️ LAS MISMAS PIEZAS QUE /customer-success, no unas parecidas. Es lo que hace
// que «exactamente igual» siga siendo cierto despues de la primera edicion.
import { GrillaTarjetas, TarjetaEntidad, TarjetaNueva, PieNumeros, PieTexto, colorDe } from '../_components/TarjetaEntidad';
// Los dos SIN `server-only` a propósito, para que los pueda contar el navegador con las
// filas que ya bajaron en vez de pedir otra vuelta al server.
import { sinRecurrentes, soloRecurrentes } from '@/lib/plan-recurrentes';
import { estaPendiente } from '@/lib/todo-estados';
import { plural } from '@/lib/plural';
import { avisoCambioPlan, type ResultadoAvisoPlan } from '@/lib/plan-aviso';
import { motivoNoEliminable } from '@/lib/borrado-workspace';
import { BarraClientes, entraEnVentana } from '../customer-success/BarraClientes';
import { Marca } from '../_components/Marca';
import { Modal } from '../_ui/Modal';
import { Icon } from '../_components/icons';
import { ConfirmDialog } from '../_components/ChatItemMenu';
import { useCapaModal } from '../_components/pila-modales';
import { PortadaPicker } from '../_components/PortadaPicker';
import { IdentidadPicker } from '../_components/IdentidadPicker';
import { FichaWorkspace } from './FichaWorkspace';
import { Dropdown } from '../components/Dropdown';
import { CAPA_DEFAULT, CAPAS_LISTA, CAPAS_VENDIBLES, capaDef, type CapaId } from '@/lib/capas';
import type { UsuarioConCara as Usuario } from './tipos';
import { avisoInvitacion, type AvisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso';
import { AprobacionesDeAgencia, useAgencias } from './AprobacionesDeAgencia';
import { ROLES_ALTA, ROTULO_ROL } from '@/lib/agencia-altas';
import { ROTULO_CARTERA, type EstadoCartera } from '@/lib/agencia-cartera';
import { PlanBoard } from '../plan/PlanBoard';
import { TodoBoard } from '../plan/TodoBoard';
import type { BoardUser } from '../plan/board/types';
import type { ClienteRef } from '@/lib/plan-clientes';
import type { TrabajoDeCliente } from '../customer-success/trabajo';

/** Lo que contestan /api/admin/workspaces y /api/admin/usuarios. */
type Respuesta = { ok: boolean; error?: string; invitacion?: ResultadoInvitacion | null };

/** El aviso de un alta o un reenvío. Verde si terminó, ámbar si falta un paso a mano. */
function Aviso({ aviso }: { aviso: AvisoInvitacion }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12, lineHeight: 1.5, color: aviso.tono === 'ok' ? 'var(--good)' : 'var(--warn)' }}>
      {aviso.texto}
    </div>
  );
}


/**
 * Los tres roles del negocio del cliente.
 *
 * ⚠️ EL RÓTULO SALE DE `ROTULO_ROL` (lib/agencia-altas.ts) y no se escribe acá: era la
 * tercera copia de las mismas tres palabras —ésta, la de la ficha de un cliente y la
 * del contrato de altas— y tres copias son tres momentos para divergir. Lo que SÍ es
 * de esta pantalla es el `sub`, que explica qué ve cada rol.
 */
const ROL_WS_OPTS = ROLES_ALTA.map((r) => ({
  value: r,
  label: ROTULO_ROL[r],
  sub: { admin: 'Ve todo el negocio', closer: 'Cierra llamadas agendadas', setter: 'Agenda y prospecta' }[r],
}));

const fmtLogin = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
};

const inicialesTxt = (base: string) => {
  const partes = (base || '?').trim().split(/\s+/).filter(Boolean);
  return (partes.length >= 2 ? `${partes[0][0]}${partes[1][0]}` : (base || '?').slice(0, 1)).toUpperCase();
};

/**
 * El girador de la espera.
 *
 * ⚠️ ES UN SVG QUE GIRA Y NO UN TEXTO, y respeta `prefers-reduced-motion`: para quien
 * pide menos movimiento se queda quieto en vez de desaparecer — sigue diciendo que
 * algo está pasando, que es lo único que tiene que decir.
 */
function Girando({ size = 34 }: { size?: number }) {
  return (
    <>
      <svg className="adm-girar" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="var(--border-strong)" strokeWidth="2.5" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <style dangerouslySetInnerHTML={{ __html: CSS_GIRAR }} />
    </>
  );
}

const CSS_GIRAR = `
.adm-girar{ animation: adm-giro .9s linear infinite; }
@keyframes adm-giro{ to{ transform: rotate(360deg); } }
@media(prefers-reduced-motion:reduce){ .adm-girar{ animation:none; } }
`;

function Cuadro({ texto, foto, size = 36 }: { texto: string; foto?: string | null; size?: number }) {
  return (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.36, color: '#171511', overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {foto ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : texto}
    </div>
  );
}

function ChipEstadoUsuario({ u }: { u: Usuario }) {
  if (u.estado === 'activo') return <span style={chip('var(--good-bg)', 'var(--good)')}>activo</span>;
  if (u.estado === 'suspendido') return <span style={chip('var(--bad-bg)', 'var(--bad)')}>suspendido</span>;
  // ⚠️ SON DOS ESTADOS, NO UNO. «Nunca entró» a secas se lee como «no le interesó», y
  // durante meses la mitad de las veces significaba lo contrario: nunca se le avisó que
  // la cuenta existía. Cada uno se arregla distinto —a uno se le reenvía, al otro se lo
  // llama— así que se dicen distinto.
  if (!u.invitacion_enviada_at) return <span style={chip('var(--bad-bg)', 'var(--bad)')}>nunca se le avisó</span>;
  return <span style={chip('var(--warn-bg)', 'var(--warn)')}>invitado — nunca entró</span>;
}

// =============================================================================
// AdminView
// =============================================================================
/**
 * El panel de clientes de la PLATAFORMA.
 *
 * ⚠️ VIVE EN /customer-success DESDE EL 28/09/2026, y /admin es un redirect. «Quiero
 * que la ruta de admin se elimine, y que yo vea esta tab en customer success de mi
 * cuenta de SuperAdmin.» Y tiene sentido mas alla del pedido: los clientes del super
 * admin SON los workspaces —Mauricio es el ws1, Leila el 11, Juanfran el 13—, asi que
 * «mis clientes» era la misma pregunta contestada en dos pantallas distintas.
 *
 * Quien decide cual de las dos listas se dibuja es el SERVER (app/customer-success/
 * page.tsx), por rol: un super admin sin impersonar ve workspaces; cualquier otro ve
 * sus leads ganados. Adentro de un cliente, el super admin ve los de ESE cliente,
 * que es lo correcto.
 */
export function AdminView({ titulo = 'Admin', icono = 'admin', trabajo, clientes = [], user }: {
  titulo?: string;
  icono?: string;
  /**
   * EL TRABAJO DEL SUPER ADMIN, agrupado por cliente. Viene del SERVER con el HTML —
   * no se pide al abrir la ficha— y por eso el detalle no tiene estado de carga. Es la
   * misma lectura y la misma forma que usa la ficha de un cliente en Customer Success.
   * `null` = no se pudo leer, que NO es lo mismo que «no tiene trabajo».
   */
  trabajo?: { dueno: boolean; porCliente: Record<number, TrabajoDeCliente> } | null;
  /** Los clientes del CRM del super admin. De acá sale qué lead es cada workspace. */
  clientes?: ClienteRef[];
  user?: BoardUser;
} = {}) {
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

  const header = (
    <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
      <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name={icono} size={34} /></span>
      <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>{titulo}</h1>
    </header>
  );

  if (cargando) {
    return (
      <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
        {header}
        {/* ⚠️ UN LOADER AL MEDIO, NO UNA CAJA CON TEXTO. «Al entrar a la tab aparece
            ese cuadro, no debería, en todo caso un loader grande en el medio de la
            tab» (28/09/2026). La caja se leía como CONTENIDO —un panel vacío que
            alguien acababa de romper— en vez de como una espera; y encima empujaba la
            grilla hacia abajo, así que al llegar los datos todo saltaba de lugar. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, minHeight: '52vh', color: 'var(--faint)' }}>
          <Girando />
          <span style={{ fontSize: 13.5 }}>Cargando tus clientes…</span>
        </div>
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
    // ⚠️ `--cartera-max: none` = ESTA pantalla usa TODO el ancho. «No ocupa el
    // ancho total de la pantalla» (27/09/2026): la cartera de un cliente topa en
    // 1180 porque son hasta treinta tarjetas y una medida de lectura ayuda; el
    // panel de la plataforma son nueve y el tope solo dejaba una franja muerta a
    // la derecha. Se redefine la variable en vez de tocar los tres archivos.
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px', ['--cartera-max' as string]: 'none' } as CSSProperties}>
      {header}
      {/* ⚠️ SIN TOPE ACA: el que manda es el de la grilla, y ponerle otro encima
          hacia que la pantalla se cortara antes sin que nada lo explicara. El
          `--cartera-max` de abajo es el unico lugar donde vive ese numero. */}
      <div style={{ marginTop: 18 }}>
        {/* ⚠️ SIN SUB-TABS. Eran tres —Clientes, Super Admins, Copywriting— y las
            tres se fueron el 27/09/2026: «elimina la sub tab de super admin, que
            esté todo junto, y lo de copywriting ni siquiera debería estar allí».
            Copywriting es ahora una ruta (/admin/copywriting) con su fila en la
            barra; los super admins son una sección más de esta misma pantalla,
            que es lo que siempre fueron — un puñado de personas, no un área. */}
        <PanelClientes workspaces={workspaces} usuarios={usuarios} sesion={sesion} recargar={cargar}
          trabajo={trabajo ?? null} clientes={clientes} user={user} />
      </div>
    </main>
  );
}

// =============================================================================
// TAB — Clientes (workspaces + equipo de cada uno)
// =============================================================================
// Filtrar, ordenar y exportar la lista de clientes
// =============================================================================
// Los rótulos viajan a la barra como parámetro, porque la barra es LA MISMA que
// la de Customer Success y lo único que cambia entre las dos son sus datos: un
// workspace no tiene «tareas abiertas» y un lead ganado no tiene «plan».

const FILTRO_WS: Record<string, string> = {
  todos: 'Todos',
  activos: 'Activos',
  pausados: 'Pausados',
  'sin-equipo': 'Sin nadie adentro',
  // ⚠️ POR PLAN, Y SALEN DEL CATALOGO, no de una lista escrita a mano: un plan
  // nuevo aparece en el filtro solo. Escribirlos daria un filtro que se queda
  // viejo el dia que alguien agrega uno — y nadie se entera, porque un filtro que
  // falta no da error, da una lista incompleta.
  ...Object.fromEntries(CAPAS_LISTA.map((c) => [`plan:${c.id}`, c.nombre])),
};

/** La ventana mira `workspaces.created_at`, que es CUANDO SE DIO DE ALTA — otra
 *  fecha que la de la cartera, que mira cuándo se ganó al cliente. Por eso los
 *  rótulos los pone cada pantalla y no viven adentro de la barra. */
const CUANDO_WS: Record<string, string> = {
  siempre: 'Siempre',
  d30: 'Últimos 30 días',
  d90: 'Últimos 90 días',
  d365: 'Último año',
  viejos: 'Hace más de un año',
};

const ORDEN_WS: Record<string, string> = {
  nombre: 'Nombre',
  miembros: 'Miembros',
  // La fecha REAL de alta del workspace, que ya viajaba y nadie usaba.
  nuevos: 'Cuándo se dio de alta',
};

/**
 * Exporta lo que la pantalla está mostrando, con los filtros puestos.
 *
 * ⚠️ `;` Y BOM, como el de la cartera: Excel en español parte por punto y coma, y
 * sin el BOM se come los acentos. Y se exporta lo VISIBLE, no todo: el menú dice
 * «lo que estás viendo».
 */
function exportarWorkspaces(filas: Workspace[]) {
  const esc = (v: unknown) => {
    const t = String(v ?? '');
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const cab = ['Cliente', 'Slug', 'Plan', 'Estado', 'Miembros', 'Alta'];
  const cuerpo = filas.map((w) => [w.nombre, w.slug ?? '', capaDef(w.capa).nombre, w.estado, w.usuarios, w.created_at.slice(0, 10)]);
  const csv = '﻿' + [cab, ...cuerpo].map((f) => f.map(esc).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * La misma cartera, para barrerla de un vistazo — la otra mitad del interruptor
 * tarjetas/tabla, con el mismo criterio que la de Customer Success: la tarjeta es
 * para RECONOCER y la tabla para COMPARAR.
 */
function TablaWorkspaces({ filas, onAbrir, onNuevo, opcionesDe, elegirAccion, accionando, caraDe, wsPlataforma }: {
  filas: Workspace[];
  onAbrir: (id: number) => void;
  onNuevo: () => void;
  opcionesDe: (w: Workspace) => { value: string; label: string; disabled?: boolean; color?: string }[];
  /** Quién lleva el chip «Dueño». Ver `wsPlataforma` en PanelClientes. */
  wsPlataforma: number | null;
  elegirAccion: (w: Workspace, v: string) => void;
  accionando: boolean;
  caraDe: (w: Workspace) => string | null;
}) {
  return (
    <>
      {/* En tabla, crear es un botón arriba: un renglón de acción al final de una
          lista se lee como un dato más, y con la tabla scrolleada ni siquiera está
          en pantalla. Mismo criterio y mismo lugar que en la cartera. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', maxWidth: 1180, margin: '0 auto 12px' }}>
        <button type="button" style={{ ...btnGhost, fontWeight: 600 }} onClick={onNuevo}>＋ Nuevo cliente</button>
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden', maxWidth: 1180, margin: '0 auto' }}>
        <table className="adm-tabla">
          <thead>
            <tr>
              <th>Cliente</th><th>Plan</th><th>Estado</th>
              <th className="num">Miembros</th><th />
            </tr>
          </thead>
          <tbody>
            {filas.map((w) => (
              <tr key={w.id} onClick={() => onAbrir(w.id)} tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(w.id); }}>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <Marca nombre={w.nombre} tam={26} color={colorDe(w.nombre)} foto={caraDe(w)} />
                    <span style={{ fontWeight: 600 }}>{w.nombre}</span>
                    {w.id === wsPlataforma && <span style={chip('var(--accent-soft)', '#171511')}>Dueño</span>}
                    <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{w.slug ?? '—'}</span>
                  </span>
                </td>
                <td>{capaDef(w.capa).nombre}</td>
                <td>{w.estado === 'activo'
                  ? <span style={chip('var(--good-bg)', 'var(--good)')}>activo</span>
                  : <span style={chip('var(--surface-2)', 'var(--dim)')}>pausado</span>}</td>
                <td className="num">{w.usuarios}</td>
                <td className="num" onClick={(e) => e.stopPropagation()}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <a href={`/general?ws=${w.id}`} title={`Entrar a ${w.nombre}`}
                      style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '6px 11px', fontSize: 12.5 }}>
                      <Icon name="eye" size={13} />Inspeccionar
                    </a>
                    <Dropdown value="" resetAfterSelect align="right" placeholder="⋯"
                      ariaLabel={`Acciones sobre ${w.nombre}`} disabled={accionando}
                      buttonStyle={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 9 }}
                      options={opcionesDe(w)} onChange={(v) => elegirAccion(w, v)} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <style dangerouslySetInnerHTML={{ __html: CSS_TABLA }} />
      </div>
    </>
  );
}

// Sin backticks acá adentro: cierran la cadena a la mitad.
const CSS_TABLA = `
.adm-tabla{ width:100%; border-collapse:collapse; font-size:13.5px; }
.adm-tabla th{ text-align:left; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--faint); font-weight:700; padding:11px 14px; border-bottom:1px solid var(--border);
  background:var(--surface-2); white-space:nowrap; }
.adm-tabla td{ padding:11px 14px; border-bottom:1px solid var(--border); color:var(--ink); vertical-align:middle; }
.adm-tabla tbody tr{ cursor:pointer; }
.adm-tabla tbody tr:hover td{ background:var(--surface-2); }
.adm-tabla tbody tr:last-child td{ border-bottom:0; }
.adm-tabla .num{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
`;

// =============================================================================
function PanelClientes({ workspaces, usuarios, sesion, recargar, trabajo, clientes = [], user }: {
  workspaces: Workspace[]; usuarios: Usuario[]; sesion: Sesion; recargar: () => Promise<void>;
  /**
   * El trabajo del SUPER ADMIN agrupado por cliente, y su CRM. Bajan desde el server
   * a través de `AdminView` — acá es donde vive el estado de la pantalla, así que es
   * acá donde hacen falta.
   */
  trabajo?: { dueno: boolean; porCliente: Record<number, TrabajoDeCliente> } | null;
  clientes?: ClienteRef[];
  user?: BoardUser;
}) {
  const [nombre, setNombre] = useState('');
  const [capa, setCapa] = useState<CapaId>(CAPA_DEFAULT);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [errCrear, setErrCrear] = useState<string | null>(null);
  const [hintCrear, setHintCrear] = useState<AvisoInvitacion | null>(null);

  const [errAccion, setErrAccion] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);
  const [abierto, setAbierto] = useState<number | null>(null);
  /** El alta dejo de ser un formulario clavado arriba de la lista y pasó a ser
   *  la primera tarjeta + un modal, igual que en la cartera. */
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [renombrando, setRenombrando] = useState<Workspace | null>(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [aEliminar, setAEliminar] = useState<Usuario | null>(null);
  /** El resultado del último reenvío, pegado a la fila de esa persona. */
  const [avisoReenvio, setAvisoReenvio] = useState<{ id: number; aviso: AvisoInvitacion } | null>(null);

  const postWs = async (body: Record<string, unknown>): Promise<Respuesta> => {
    try { return await (await fetch('/api/admin/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  };
  const postUser = async (body: Record<string, unknown>): Promise<Respuesta> => {
    try { return await (await fetch('/api/admin/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  };

  const reenviar = async (u: Usuario) => {
    if (accionando) return;
    setAvisoReenvio(null); setErrAccion(null); setAccionando(true);
    try {
      const j = await postUser({ action: 'reinvitar', id: u.id });
      if (!j.ok) { setErrAccion(j.error ?? 'No se pudo reenviar el acceso.'); return; }
      setAvisoReenvio({ id: u.id, aviso: avisoInvitacion(j.invitacion, u.email) });
      await recargar();
    } finally { setAccionando(false); }
  };

  const crear = async () => {
    if (creando) return;
    setErrCrear(null); setHintCrear(null); setCreando(true);
    try {
      const j = await postWs({ action: 'crear', nombre: nombre.trim(), capa, adminEmail: adminEmail.trim(), adminNombre: adminNombre.trim() });
      if (!j.ok) { setErrCrear(j.error ?? 'No se pudo crear el cliente.'); return; }
      const email = adminEmail.trim();
      setNombre(''); setAdminEmail(''); setAdminNombre('');
      // El texto sale de `avisoInvitacion`, que es el mismo que usa /equipo. Antes acá
      // decía en verde «cuando su admin entre con Google, la cuenta se activa sola» —
      // cierto, y falso como mensaje: nadie le había pasado la URL.
      setHintCrear(email ? avisoInvitacion(j.invitacion, email) : { tono: 'ok', texto: 'Cliente creado. Entra como el cliente para configurarlo, o asígnale un admin más tarde.' });
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

  // Entrar a un cliente NO necesita JavaScript: es un `<a href="/general?ws=N">`
  // (ver la fila de cada cliente, más abajo). Un ancla común ya hace exactamente
  // lo que hace falta —navegación dura en ESTA pestaña— y de paso deja intactos
  // el ctrl+click y el botón del medio, que abren el cliente en otra. Escribir un
  // handler solo servía para romper esos dos gestos.
  //
  // Que el contexto sea por pestaña y que se entre en la pestaña actual no se
  // contradicen: el aislamiento lo da que el workspace viaje en la URL, no que se
  // abra una ventana. Cada pestaña se queda con el `?ws=` de su barra de
  // direcciones.

  const guardarNombre = async () => {
    const w = renombrando;
    if (!w) return;
    const nuevo = nombreEdit.trim();
    setRenombrando(null);
    if (nuevo && nuevo !== w.nombre) await accionWs({ action: 'nombre', id: w.id, nombre: nuevo });
  };

  // Las agencias y sus pedidos, en UNA lectura compartida por el bloque de
  // aprobaciones y por el menu de cada workspace.
  const agenciasEstado = useAgencias();


  // ── Buscar, filtrar y ordenar, con la misma barra que Clientes ──────────
  // ⚠️ LOS DICCIONARIOS SON DE ESTA PANTALLA y por eso viajan como parámetro: un
  // workspace no tiene «tareas abiertas» y un lead ganado no tiene «plan». La
  // barra es la misma pieza; lo que cambia son sus datos.
  const [q, setQ] = useState('');
  const [tabla, setTabla] = useState(false);
  const [filtro, setFiltro] = useState<string>('todos');
  const [orden, setOrden] = useState<string>('nombre');
  const [cuando, setCuando] = useState('siempre');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  /**
   * LOS CLIENTES DE UNA AGENCIA NO SON CLIENTES DE MAKO.
   *
   * «Los clientes de agencia deberían aparecer dentro de la tab de EQUIPO de esa
   * agencia como una card de cliente. No como un cliente más de MaKo» (28/09/2026).
   * Y tiene sentido más allá de la pantalla: a ese negocio no le factura MaKo, le
   * factura la agencia. Mezclarlos en la grilla contaba de más y dejaba creer que
   * MaKo tiene un cliente donde tiene medio.
   *
   * ⚠️ `pendiente` CUENTA Y `revocado` NO, y la diferencia se vio en pantalla. Un
   * pendiente ya es de esa agencia —sólo falta la firma— así que va adentro de su
   * ficha; un revocado es la afirmación CONTRARIA: «este workspace NO es (o dejó de
   * ser) cliente de esa agencia». Contándolo, el Cliente de Prueba desaparecía de la
   * grilla de MaKo por una fila revocada que decía justamente que no era de Código.
   */
  const agenciaDe = useMemo(() => {
    const m = new Map<number, number>();
    for (const f of agenciasEstado.carteras) {
      if (f.estado === 'revocado') continue;
      m.set(f.cliente_ws, f.agencia_ws);
    }
    return m;
  }, [agenciasEstado.carteras]);

  /**
   * Lo que la grilla dibuja: los clientes de MaKo, sin los de las agencias.
   *
   * ⚠️ SE FILTRA ACÁ Y NO EN `visibles`, que es lo que la barra cuenta: si se filtrara
   * después, el contador diría «9 de 9» sobre una grilla de 8 y el que busca al que
   * falta no tendría dónde mirar. Acá el total ya es el correcto.
   */
  const deMaKo = useMemo(() => workspaces.filter((w) => !agenciaDe.has(w.id)), [workspaces, agenciaDe]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    // ⚠️ DESDE `deMaKo`, no desde `workspaces`: los clientes de una agencia no son
    // tarjetas de esta grilla — viven adentro de la ficha de su agencia.
    let l = deMaKo.filter((w) =>
      !t || w.nombre.toLowerCase().includes(t) || (w.slug ?? '').toLowerCase().includes(t));
    if (filtro === 'activos') l = l.filter((w) => w.estado === 'activo');
    else if (filtro === 'pausados') l = l.filter((w) => w.estado === 'pausado');
    else if (filtro === 'sin-equipo') l = l.filter((w) => w.usuarios === 0);
    else if (filtro.startsWith('plan:')) l = l.filter((w) => w.capa === filtro.slice(5));
    // La ventana de tiempo va APARTE del filtro: «cuáles» y «de cuándo» son dos
    // preguntas, y mezclarlas obliga a escribir el producto de las dos listas.
    l = l.filter((w) => entraEnVentana(w.created_at, cuando));
    // El criterio se calcula «mayor primero» y la dirección lo da vuelta al final:
    // así el sentido es UNA decisión y no hay que invertir cada rama a mano.
    const por = [...l];
    if (orden === 'miembros') por.sort((a, b) => b.usuarios - a.usuarios);
    else if (orden === 'nuevos') por.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else por.sort((a, b) => b.nombre.localeCompare(a.nombre, 'es'));
    if (dir === 'asc') por.reverse();
    return por;
  }, [deMaKo, q, filtro, orden, cuando, dir]);

  // ⚠️ EL EMAIL ENTRA EN LA CONDICION. Antes el boton se habilitaba con el
  // nombre solo, asi que se podia crear un cliente sin admin: un workspace al que
  // nadie podia entrar y que no recibia nada. El server tambien lo exige —
  // esconder el boton no protege— pero dejarlo habilitado sobre algo que el server
  // va a rechazar es peor que no tenerlo.
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail.trim());
  /**
   * La cara de un cliente es la de SU ADMIN. «Si agrego el email, seria bueno que
   * ya ponga la foto de perfil de ese email automaticamente en la card»
   * (27/09/2026).
   *
   * ⚠️ `workspaces` NO TIENE COLUMNA DE FOTO y no hizo falta agregarla: la cara
   * que interesa es la de la persona, y esa ya esta en `usuarios`. Se deriva en
   * vez de guardarse — asi cambia sola cuando la persona cambia su foto de Google,
   * que es justo lo que se espera de «su foto de perfil».
   *
   * El orden es honesto: la real (Google, al primer login) → Gravatar del email →
   * las iniciales. Antes del primer login no existe ninguna foto de nadie, y eso
   * no se puede arreglar: lo que se puede es no dejar un hueco.
   */
  const caraDe = (w: Workspace): string | null => {
    const admin = usuarios.find((u) => u.workspace_id === w.id && (u.rol_ws ?? 'admin') === 'admin')
      ?? usuarios.find((u) => u.workspace_id === w.id)
      // El workspace de la plataforma no tiene `workspace_id` en sus usuarios: sus
      // super admins son globales, asi que se lo busca por rol.
      ?? (w.capa === 'superadmin' ? usuarios.find((u) => u.rol === 'admin') : undefined);
    // ⚠️ `cara` YA VIENE RESUELTA por el server (`caraDeUsuario`, lib/gravatar.ts).
    // Repetir acá el `foto_url || gravatar` era la segunda copia de la precedencia, y
    // la segunda copia es la que se queda vieja. El `??` de abajo es para una respuesta
    // de una version anterior de la API, no una regla.
    return admin?.cara ?? admin?.foto_url ?? null;
  };


  const puedeCrear = nombre.trim().length >= 2 && emailOk && !creando;
  const wAbierto = abierto != null ? workspaces.find((w) => w.id === abierto) ?? null : null;

  /**
   * En qué estado está el acceso de la agencia a ese cliente. Es lo que va al pie de su
   * tarjeta: «aprobado» no aporta nada —es el caso normal— pero «esperando tu
   * aprobación» o «revocado» son justamente lo que hay que ver de un vistazo.
   */
  const estadoCartera = (clienteWs: number): string => {
    const f = agenciasEstado.carteras.find((x) => x.cliente_ws === clienteWs);
    return ROTULO_CARTERA[(f?.estado ?? 'pendiente') as EstadoCartera] ?? (f?.estado ?? '—');
  };

  /**
   * QUÉ LEAD DEL CRM ES CADA WORKSPACE.
   *
   * ⚠️ POR `cliente_ws`, QUE ES UNA CLAVE, y nunca por el nombre. Los tres clientes del
   * super admin se llaman parecido a su workspace pero no igual —«Juanfran» es el ws13
   * «Codigo Inmobiliario»—, así que un match por texto acertaría dos de tres y le
   * mostraría a alguien el trabajo de otro. La columna existe desde la mig 0175 para
   * exactamente esto.
   *
   * Sin fila, el workspace no está ligado a ningún cliente del CRM y la ficha lo dice:
   * no hay tablero que mostrar, y eso es un dato, no un error.
   */
  const leadDeWs = useMemo(() => {
    const m = new Map<number, ClienteRef>();
    for (const c of clientes) if (c.clienteWs) m.set(c.clienteWs, c);
    return m;
  }, [clientes]);

  /** Los clientes de ESTA agencia, para dibujarlos adentro de su ficha. */
  const clientesDeAgencia = (agenciaWs: number): Workspace[] =>
    workspaces.filter((w) => agenciaDe.get(w.id) === agenciaWs);

  /**
   * LA PLATAFORMA: quién lleva el chip «Dueño» y a quién no se le puede tocar nada.
   *
   * ⚠️ ERA `w.id === 1`, Y ESE ES MAURICIO — que es un CLIENTE. El dueño lo reportó
   * mirándolo: «quitale el tag de Dueño a Mauricio, eso lo debería tener Martin Koncke,
   * que es el dueño y SuperAdmin» (29/09/2026). El workspace de la plataforma es el de
   * capa `superadmin`.
   *
   * ⚠️ Y ES EL DE MENOR id, no «cualquiera con esa capa», porque eso es exactamente lo
   * que hace `wsSuperAdmin()` en el server (`.order('id').limit(1)`, lib/workspace.ts).
   * Si algún día hubiera dos filas con esa capa, la plataforma sigue siendo UNA: con
   * `w.capa === 'superadmin'` a secas la pantalla diría «Dueño» dos veces y una sería
   * mentira. Hoy hay exactamente uno (ws9), medido.
   */
  const wsPlataforma = useMemo(() => {
    const ids = workspaces.filter((w) => w.capa === 'superadmin').map((w) => w.id);
    return ids.length ? Math.min(...ids) : null;
  }, [workspaces]);

  /**
   * EL PIE DE UNA TARJETA: los mismos tres números que su ficha va a mostrar al abrirse.
   * «En Super Admin en la preview de la card falta lo de Proyectos - Abiertas - Se
   * repiten» (29/09/2026), con los rótulos nuevos.
   *
   * ⚠️ SALE DE `trabajo` Y NO DE `tableroDeLaCartera`. Son dos fuentes distintas y no
   * cuentan lo mismo: la de /customer-success cruza además por NOMBRE, y esta ficha
   * dibuja `trabajo.porCliente[lead.leadId]`, o sea sólo lo que tiene la clave escrita.
   * Con la otra, la tarjeta prometería trabajo que adentro no está — que es justo lo que
   * el comentario de `ClienteCard` prohíbe.
   *
   * ⚠️ LOS TRES NÚMEROS O NINGUNO, también acá: sin tablero leído o sin cliente ligado no
   * se ponen ceros. «No tiene trabajo» y «no pude mirar» son dos cosas, y de los 10
   * workspaces de hoy sólo 3 están ligados a un cliente del CRM.
   */
  const pieDe = (w: Workspace) => {
    if (!trabajo) return <PieTexto mal>No pude leer tu tablero</PieTexto>;
    const lead = leadDeWs.get(w.id);
    if (!lead) return <PieTexto>Sin cliente en tu CRM</PieTexto>;
    const t = trabajo.porCliente[lead.leadId];
    if (!t) return <PieNumeros datos={[{ v: 0, k: 'Proyectos' }, { v: 0, k: 'Tareas' }, { v: 0, k: 'Recurrentes' }]} />;
    /**
     * ⚠️ SE DISCRIMINA POR `t.dueno` ANTES DE CONTAR, y no es sólo para que compile: son
     * DOS modelos de tarea distintos y «abierta» se pregunta distinto en cada uno. En el
     * tablero del dueño es `progress < 100` —el mismo criterio con el que `trabajo.ts`
     * deriva su estado— y en el del cliente es `estaPendiente(estado)`. Contar los dos
     * con la misma expresión haría que la tarjeta y la ficha digan números distintos
     * sobre las mismas filas.
     */
    const tres = t.dueno
      ? {
        proyectos: t.proyectos.length,
        abiertas: sinRecurrentes(t.tareas).filter((x) => x.progress < 100).length,
        recurrentes: soloRecurrentes(t.tareas).length,
      }
      : {
        proyectos: t.categorias.length,
        abiertas: sinRecurrentes(t.tareas).filter((x) => estaPendiente(x.estado)).length,
        recurrentes: soloRecurrentes(t.tareas).length,
      };
    return (
      <PieNumeros datos={[
        { v: tres.proyectos, k: 'Proyectos' },
        { v: tres.abiertas, k: 'Tareas' },
        { v: tres.recurrentes, k: 'Recurrentes' },
      ]} />
    );
  };


  /**
   * EL BOTÓN que abrió cada selector, no un booleano: el popover cuelga de su ancla y
   * se vuelve a medir en cada scroll. Y vive ACÁ y no adentro de la ficha porque los
   * dos se montan como HERMANOS suyos y se portalean a `document.body` — adentro, la
   * pila los apagaría junto con ella (ver `contenedores` en pila-modales.ts).
   */
  const [anclaPortada, setAnclaPortada] = useState<HTMLElement | null>(null);
  const [anclaIcono, setAnclaIcono] = useState<HTMLElement | null>(null);

  /** La cara del cliente (mig 0179): portada, marca y los dos encuadres. */
  const accionCara = (id: number, cambio: Record<string, unknown>) =>
    accionWs({ action: 'cara', id, ...cambio });

  /** Lo que el menú de acciones ofrece sobre un cliente. Es la MISMA lista que
   *  había en la fila de la tabla: el rediseño no puede perder ninguna. */
  const opcionesDe = (w: Workspace) => {
    // ⚠️ ERA `w.id === 1` Y ESTABA APARTE del de la tarjeta, así que cuando el chip
    // «Dueño» se mudó al workspace de la plataforma, este quedó protegiendo a Mauricio
    // —un cliente— y ofreciéndole a la PLATAFORMA «Pausar» y «Eliminar…». El server los
    // rechaza igual (medido: 400 en los dos), pero una pantalla que ofrece algo que
    // siempre falla es una pantalla que miente. Es el mismo booleano y ahora es la
    // misma expresión.
    const esDueno = w.id === wsPlataforma;
    return [
      { value: 'renombrar', label: 'Renombrar…' },
      /**
       * ⚠️ UN ÍTEM Y UN MODAL, NO UN ÍTEM POR PLAN. Acá había un «Pasar a <Plan>» por
       * cada capa vendible: «en lugar de muchos "Pasar a…" que sea "Cambiar permisos" y
       * que salte un modal para cambiarlo» (29/09/2026). El menú crecía con el catálogo
       * y, sobre todo, obligaba a elegir un plan sin poder leer qué incluye — la
       * descripción de cada uno existe desde siempre y no se veía en ningún lado.
       *
       * ⚠️ Y AHORA EL CAMBIO MANDA UN MAIL. Eso es lo que hace que «Guardar» no alcance
       * como rótulo y que la decisión no pueda vivir en un menú: lo que sigue le escribe
       * a una persona.
       */
      ...(esDueno ? [] : [{ value: 'permisos', label: 'Cambiar permisos…' }]),
      esDueno
        ? { value: 'nopausar', label: 'No se puede pausar a la plataforma', disabled: true }
        : { value: 'estado', label: w.estado === 'pausado' ? 'Activar' : 'Pausar' },
      /* ⚠️ ROJO Y CON PUNTOS SUSPENSIVOS: los puntos dicen que abre algo y el color que
         es de otra clase que las de arriba. `DropdownOption` ya soporta `color`.
         Y para la plataforma no se ofrece siquiera deshabilitado: un ítem apagado
         invita a preguntarse cómo encenderlo, y acá la respuesta es «nunca». */
      ...(esDueno ? [] : [{ value: 'eliminar', label: 'Eliminar…', color: 'var(--bad)' }]),
      // ⛔ ACA ESTABA «Convertir en agencia», y se fue el 27/09/2026: ser agencia
      // ES EL PLAN, asi que ya esta arriba como «Pasar a Agencia», con el mismo
      // control que cualquier otro plan. Dos caminos para el mismo hecho es como
      // uno de los dos se queda viejo.
    ];
  };
  const elegirAccion = (w: Workspace, v: string) => {
    if (v === 'renombrar') { setNombreEdit(w.nombre); setRenombrando(w); }
    else if (v === 'permisos') setCambiandoPlan(w);
    else if (v === 'eliminar') setBorrando(w);
    else if (v === 'estado') accionWs({ action: 'estado', id: w.id, estado: w.estado === 'pausado' ? 'activo' : 'pausado' });
  };

  /**
   * EL CAMBIO DE PLAN, con su mail.
   *
   * ⚠️ NO USA `accionWs`: ése recarga y descarta la respuesta, y acá la respuesta trae
   * el resultado del ENVÍO. Un «listo» mudo no distingue «se le avisó» de «se cambió y
   * nadie se enteró», que es exactamente el bug que se arregló el 28/09 en el alta.
   */
  const [cambiandoPlan, setCambiandoPlan] = useState<Workspace | null>(null);
  const [avisoPlan, setAvisoPlan] = useState<{ tono: 'ok' | 'warn'; texto: string } | null>(null);
  const [borrando, setBorrando] = useState<Workspace | null>(null);

  /**
   * BORRAR UN CLIENTE. No usa `accionWs` porque la respuesta trae LO QUE SE LLEVÓ, y
   * eso se muestra: un «listo» sobre la operación más destructiva de la app no deja
   * comprobar nada.
   */
  const borrar = async (w: Workspace, nombre: string) => {
    if (accionando) return;
    setErrAccion(null); setAccionando(true); setAvisoPlan(null);
    try {
      const j = await postWs({ action: 'eliminar', id: w.id, nombre }) as {
        ok?: boolean; error?: string;
        borrado?: Record<string, number>; usuarios?: number; leadsDesligados?: number; avisos?: string[];
      };
      if (!j.ok) { setErrAccion(j.error ?? 'No se pudo eliminar.'); return; }
      const filas = Object.values(j.borrado ?? {}).reduce((a, b) => a + b, 0);
      const tablas = Object.keys(j.borrado ?? {}).length;
      setAvisoPlan({
        tono: (j.avisos ?? []).length ? 'warn' : 'ok',
        texto: [
          `Se eliminó ${w.nombre}: ${plural(filas, 'fila')} en ${plural(tablas, 'tabla')}, ${plural(j.usuarios ?? 0, 'persona')}`,
          j.leadsDesligados ? ` y ${plural(j.leadsDesligados, 'lead')} de tu CRM que quedaron sin cuenta` : '',
          '.',
          (j.avisos ?? []).length ? ` ${(j.avisos ?? []).join(' ')}` : '',
        ].join(''),
      });
      setBorrando(null);
      if (abierto === w.id) setAbierto(null);
      await recargar();
    } finally { setAccionando(false); }
  };

  const cambiarPlan = async (w: Workspace, capa: string) => {
    if (accionando) return;
    setErrAccion(null); setAccionando(true); setAvisoPlan(null);
    try {
      const j = await postWs({ action: 'capa', id: w.id, capa }) as
        { ok?: boolean; error?: string; aviso?: ResultadoAvisoPlan | null };
      if (!j.ok) { setErrAccion(j.error ?? 'No se pudo cambiar el plan.'); return; }
      setAvisoPlan(avisoCambioPlan(j.aviso, capaDef(capa as Workspace['capa']).nombre));
      setCambiandoPlan(null);
      await recargar();
    } finally { setAccionando(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Lo que una agencia pidió mirar, y todavía no firmaste ──────────── */}
      <AprobacionesDeAgencia workspaces={workspaces} recargar={recargar} estado={agenciasEstado} />

      {errAccion && <div style={bannerError}>{errAccion}</div>}

      {/* ⚠️ ES LA MISMA VISTA QUE /customer-success, no una parecida (27/09/2026):
          «que sea exactamente igual que la vista de clientes que construimos, solo
          que con los botones extras». La barra, la grilla, la tarjeta y la primera
          tarjeta punteada de crear son LAS MISMAS PIEZAS —app/_components/
          TarjetaEntidad.tsx y BarraClientes—, no una copia del diseño: copiar un
          diseño es escribir el segundo, que es el que se queda viejo. */}
      <BarraClientes
        q={q} onQ={setQ} tabla={tabla} onTabla={setTabla}
        filtro={filtro} onFiltro={setFiltro} orden={orden} onOrden={setOrden}
        nVisibles={visibles.length} nTotal={deMaKo.length}
        placeholder="Buscar un cliente por nombre o slug…"
        filtros={FILTRO_WS} ordenes={ORDEN_WS}
        cuandos={CUANDO_WS} cuando={cuando} onCuando={setCuando} dir={dir} onDir={setDir}
        /* Sin `progreso`: una lista de workspaces no tiene ningún porcentaje
           análogo al «con trabajo abierto» de la cartera, y el prop es opcional
           justamente para no obligar a inventarle un número. */
        onExportar={() => exportarWorkspaces(visibles)}
      />

      {deMaKo.length === 0 ? (
        <div style={{ ...card, color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.5 }}>
          Todavía no hay clientes. Crea el primero con la tarjeta de arriba.
        </div>
      ) : tabla ? (
        <TablaWorkspaces filas={visibles} onAbrir={setAbierto} caraDe={caraDe}
          onNuevo={() => setAltaAbierta(true)} opcionesDe={opcionesDe} elegirAccion={elegirAccion}
          accionando={accionando} wsPlataforma={wsPlataforma} />
      ) : (
        <GrillaTarjetas>
          <li><TarjetaNueva label="Nuevo cliente" onClick={() => setAltaAbierta(true)} /></li>
          {visibles.map((w) => {
            const esDueno = w.id === wsPlataforma;
            return (
              <li key={w.id}>
                <TarjetaEntidad
                  nombre={w.nombre}
                  /* Su cara, la que alguien le eligió (mig 0179). `foto` es el
                     respaldo: la del admin del cliente, que gana sobre las iniciales
                     y pierde contra el ícono propio. */
                  portada={w.portada} portadaY={w.portada_y}
                  icono={w.icono} avatarY={w.avatar_y}
                  foto={caraDe(w)}
                  color={colorDe(w.nombre)}
                  onAbrir={() => setAbierto(w.id)}
                  etiqueta={`Ver el equipo de ${w.nombre}`}
                  chips={
                    <>
                      {esDueno && <span style={chip('var(--accent-soft)', '#171511')}>Dueño</span>}
                      <span style={chip('var(--primary-bg)', 'var(--primary)')}>{capaDef(w.capa).nombre}</span>
                      {/* ⛔ ACA HABIA UN CHIP «Agencia» APARTE, y desde que ser agencia
                          es el PLAN decia «Agencia» DOS VECES en la misma linea. El chip
                          del plan ya lo dice. Es lo que pasa cuando un hecho se muda de
                          lugar y la marca vieja se queda: no da error, se ve repetido. */}
                      {w.estado === 'pausado' && <span style={chip('var(--surface-2)', 'var(--dim)')}>pausado</span>}
                    </>
                  }
                  /* El slug y el equipo en el mismo renglón: son los dos datos que
                     distinguen a un workspace de otro de un vistazo, y los dos
                     caben. El pie queda libre para los botones, que es lo que esta
                     pantalla vino a ofrecer. */
                  /* ⚠️ SIN EL SLUG: «quita lo del id de usuario, no sé porqué pones
                     codigo-inmobiliario, ese dato no lo quiero» (29/09/2026). Es de la
                     base y no le dice nada a quien mira. En su lugar, el otro número que
                     sí distingue a un cliente de otro: cuántos clientes tiene. El slug
                     sigue vivo en el BUSCADOR, que es donde sirve. */
                  bajada={<>{plural(w.usuarios, 'miembro')} · {plural(w.clientes, 'cliente')}</>}
                  pie={pieDe(w)}
                  acciones={
                    <>
                      {/* Es un <a> de verdad, no un <button> con onClick: así el
                          click normal entra en esta pestaña —que es lo pedido— y
                          ctrl+click o el botón del medio abren el cliente en otra,
                          gratis y sin que la app tenga que decidir nada. Un botón
                          se come esos gestos, y son justo los que hacen falta para
                          mirar dos clientes a la vez. */}
                      <a href={`/general?ws=${w.id}`} title={`Entrar a ${w.nombre}`}
                        style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '7px 12px', fontSize: 12.5 }}>
                        <Icon name="eye" size={13} />Inspeccionar
                      </a>
                      <span style={{ flex: 1 }} />
                      <Dropdown
                        value="" resetAfterSelect align="right" placeholder="Acciones"
                        ariaLabel={`Acciones sobre ${w.nombre}`} disabled={accionando}
                        buttonStyle={{ padding: '7px 11px', fontSize: 12.5, borderRadius: 9 }}
                        options={opcionesDe(w)}
                        onChange={(v) => elegirAccion(w, v)}
                      />
                    </>
                  }
                />
              </li>
            );
          })}
        </GrillaTarjetas>
      )}

      {/* ⚠️ «NO ENCONTRÉ» NO ES «NO HAY». Sin este renglón, buscar algo que no existe
          deja la grilla con una sola tarjeta de crear, y eso se lee como que se
          borró la lista de clientes. */}
      {deMaKo.length > 0 && visibles.length === 0 && (
        <p className="cl-nada">Ningún cliente coincide con lo que buscaste.</p>
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
                <div key={u.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Cuadro texto={inicialesTxt(u.nombre || u.email)} foto={u.cara ?? u.foto_url} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                  </div>
                  <ChipEstadoUsuario u={u} />
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
                    options={[
                      { value: 'reinvitar', label: u.invitacion_enviada_at ? 'Reenviar acceso' : 'Mandarle el acceso' },
                      { value: 'eliminar', label: 'Eliminar…', color: 'var(--bad)' },
                    ]}
                    onChange={(v) => {
                      if (v === 'reinvitar') reenviar(u);
                      else if (v === 'eliminar') setAEliminar(u);
                    }}
                  />
                </div>
                {avisoReenvio?.id === u.id && <Aviso aviso={avisoReenvio.aviso} />}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {/* ⛔ Y ACA EL OTRO, al pie de la lista: «Cada cliente ve solo sus propios
          datos…». Narraba lo que la pantalla ya hace y ocupaba el lugar del
          contenido. */}

      {/* ── Los super admins, que eran una sub-tab ──────────────────────────── */}
      {/* «Elimina la sub tab de super admin, que esté todo junto» (27/09/2026).
          Y es lo que siempre fueron: un puñado de personas, no un área. Debajo de
          los clientes porque se consultan mucho menos. */}
      {/* ⛔ ACA VIVIA LA SECCION «Super Admins», con su propio formulario de alta y
          su propia lista. Se fue el 28/09/2026: «el super admin no debe ni tener un
          form diferente ni una vista diferente abajo de todo, simplemente un usuario
          mas, como super admin».
          Y es lo que siempre fue: los super admins son el EQUIPO del workspace de la
          plataforma, que ya esta en esta grilla como una tarjeta mas. Se dan de alta
          abriendo su ficha, igual que se suma a alguien a cualquier otro cliente —
          un alta que se hace en dos lugares distintos es la que se queda vieja.
          El aviso de sesion legacy vivia SOLO ahi adentro y se mudo arriba, que es lo
          unico que le dice a alguien que su cuenta no queda registrada. */}
      {sesion.legacy && (
        <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
          Estás con la sesión compartida vieja. Cierra sesión y vuelve a entrar con Google para que tu cuenta quede registrada.
        </div>
      )}

      {/* ── El alta, en un modal ─────────────────────────────────────────────── */}
      {/* Era un formulario de cinco campos clavado ARRIBA de la lista, o sea que
          ocupaba la primera pantalla siempre para algo que se hace cada varias
          semanas. Ahora entra por la tarjeta punteada, igual que en la cartera. */}
      {altaAbierta && (
        <Modal titulo="Nuevo cliente" ancho={660} etiqueta="Crear un cliente"
          onCerrar={() => { setAltaAbierta(false); setErrCrear(null); setHintCrear(null); }}
          pie={
            <>
              <button style={btnGhost} onClick={() => setAltaAbierta(false)}>Cancelar</button>
              <button style={{ ...btnDark, opacity: puedeCrear ? 1 : 0.5 }} disabled={!puedeCrear} onClick={crear}>
                {creando ? 'Creando…' : 'Crear cliente'}
              </button>
            </>
          }>
          {/* ⛔ ACA HABIA UN PARRAFO DE CUATRO RENGLONES explicando que es un
              workspace, que hace el tipo y que el email era opcional. Se fue
              (27/09/2026): «elimina todos los textos innecesarios». Lo que
              explicaba un criterio vive en el comentario del codigo; lo que
              decia el tipo ya lo dice la descripcion de abajo, que cambia con
              lo que elegis. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Nombre del cliente</label>
              <input style={input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Elevate"
                onKeyDown={(e) => { if (e.key === 'Enter' && puedeCrear) crear(); }} />
            </div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <Dropdown value={capa} ariaLabel="Tipo de cliente"
                buttonStyle={{ padding: '10px 12px', fontSize: 14, borderRadius: 11, width: '100%' }}
                options={CAPAS_VENDIBLES.map((c) => ({ value: c.id, label: c.nombre }))}
                onChange={(v) => setCapa(v as CapaId)} />
            </div>
            <div>
              <label style={labelStyle}>Email del admin</label>
              <input style={input} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="dueño@cliente.com"
                onKeyDown={(e) => { if (e.key === 'Enter' && puedeCrear) crear(); }} />
            </div>
            <div>
              <label style={labelStyle}>Nombre del admin</label>
              <input style={input} value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} placeholder="Nombre y apellido" />
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 10, lineHeight: 1.5 }}>{capaDef(capa).descripcion}</div>
          {errCrear && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{errCrear}</div>}
          {hintCrear && <Aviso aviso={hintCrear} />}
        </Modal>
      )}

      {/* ── El equipo de un cliente, en su ficha ─────────────────────────────── */}
      {/* Era una fila que se expandía con un chevron. Con tarjetas eso no existe, y
          además el equipo es el DETALLE de un cliente: va donde va todo detalle en
          esta app, que es un modal — igual que la ficha de la cartera. */}
      {/* ⚠️ ES LA MISMA PIEZA QUE EL DETALLE DE UN PROYECTO, no una parecida. «El
          detail está mal, te había dicho que idéntico al del plan, solo que con más
          opciones para administrar al usuario» (28/09/2026). Antes era un `Modal` de
          720 titulado «Equipo»: ni portada, ni marca, ni nada de lo que el dueño tenía
          en la cabeza. Ahora `FichaWorkspace` monta `CabeceraDetalle`, que es
          literalmente el mismo componente que monta el tablero. */}
      {wAbierto && (
        <FichaWorkspace
          w={wAbierto}
          cara={caraDe(wAbierto)}
          esPlataforma={wAbierto.id === wsPlataforma}
          /* ⚠️ SIN «Renombrar…»: acá el nombre se edita EN EL TÍTULO. Dejar las dos
             sería el tercer camino al mismo hecho — y encima el diálogo se abriría
             sobre una ficha que ya ofrece hacerlo mejor. En la TARJETA sigue, porque
             ahí no hay dónde escribir. */
          opciones={opcionesDe(wAbierto).filter((o) => o.value !== 'renombrar')}
          accionando={accionando}
          onAccion={(v) => elegirAccion(wAbierto, v)}
          onNombre={(nombre) => { if (nombre.trim()) accionWs({ action: 'nombre', id: wAbierto.id, nombre: nombre.trim() }); }}
          onEncuadre={(y) => accionCara(wAbierto.id, { portadaY: y })}
          onAbrirPortada={(a) => setAnclaPortada((x) => (x ? null : a))}
          onAbrirIcono={(a) => setAnclaIcono((x) => (x ? null : a))}
          onCerrar={() => { setAbierto(null); setAnclaPortada(null); setAnclaIcono(null); }}
          tablero={
            <TableroDelCliente
              w={wAbierto}
              lead={leadDeWs.get(wAbierto.id) ?? null}
              trabajo={trabajo ?? null}
              clientes={clientes}
              user={user ?? { nombre: sesion?.email ?? 'Super admin', avatarUrl: '' }}
              onRecargar={recargar}
              equipo={
                <div style={{ padding: '4px 30px 24px' }}>
                  {clientesDeAgencia(wAbierto.id).length > 0 && (
                    <div style={{ marginBottom: 26 }}>
                      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 10 }}>
                        Sus clientes · {clientesDeAgencia(wAbierto.id).length}
                      </div>
                      <GrillaTarjetas sinEstirar>
                        {clientesDeAgencia(wAbierto.id).map((c) => (
                          <li key={c.id}>
                            <TarjetaEntidad
                              nombre={c.nombre}
                              portada={c.portada} portadaY={c.portada_y}
                              icono={c.icono} avatarY={c.avatar_y}
                              foto={caraDe(c)}
                              color={colorDe(c.nombre)}
                              /* Abre SU ficha en lugar de ésta. Es una navegación y no
                                 una pila: apilar dos fichas de 1560 deja la de atrás
                                 invisible y sin forma de volver que no sea cerrar las
                                 dos. */
                              onAbrir={() => setAbierto(c.id)}
                              etiqueta={`Abrir la ficha de ${c.nombre}`}
                              chips={<span style={chip('var(--primary-bg)', 'var(--primary)')}>{capaDef(c.capa).nombre}</span>}
                              /* El mismo molde que la tarjeta de afuera, o son dos
                                 tarjetas iguales diciendo cosas distintas. */
                              bajada={<>{plural(c.usuarios, 'miembro')} · {plural(c.clientes, 'cliente')}</>}
                              pie={<PieTexto>{estadoCartera(c.id)}</PieTexto>}
                            />
                          </li>
                        ))}
                      </GrillaTarjetas>
                    </div>
                  )}
                  <EquipoDelCliente
                    w={wAbierto}
                    equipo={usuarios.filter((u) => u.workspace_id === wAbierto.id)}
                    accionando={accionando} accionUser={accionUser} reenviar={reenviar}
                    onEliminar={setAEliminar} avisoReenvio={avisoReenvio} onRecargar={recargar} />
                </div>
              }
            />
          }
        />
      )}

      {/* Los dos selectores, HERMANOS de la ficha y no hijos suyos: se portalean a
          `document.body` y se registran en la pila como `anidada`, así la ficha se
          sigue viendo detrás y el Escape cierra sólo el panel. */}
      {wAbierto && anclaPortada && (
        <PortadaPicker
          valor={wAbierto.portada}
          colorBase={colorDe(wAbierto.nombre)}
          ancla={anclaPortada}
          titulo={`Portada de ${wAbierto.nombre}`}
          onElegir={(v) => accionCara(wAbierto.id, { portada: v })}
          onCerrar={() => setAnclaPortada(null)} />
      )}

      {wAbierto && anclaIcono && (
        <IdentidadPicker
          icono={wAbierto.icono}
          y={wAbierto.avatar_y}
          ancla={anclaIcono}
          titulo={`Imagen de ${wAbierto.nombre}`}
          /* ⚠️ SIN EMOJI: un workspace no tiene columna `emoji` donde guardarlo, y el
             picker escribiría en `icono` un glifo que `saneaIcono` descarta — o sea un
             control que se ve, se usa y no guarda nada. La regla de dónde va cada cosa
             es del CALL SITE, no del picker. */
          conEmoji={false}
          onElegir={(cambio) => {
            if (cambio.icono !== undefined) accionCara(wAbierto.id, { icono: cambio.icono, ...(cambio.y !== undefined ? { avatarY: cambio.y } : {}) });
            else if (cambio.y !== undefined) accionCara(wAbierto.id, { avatarY: cambio.y });
          }}
          onCerrar={() => setAnclaIcono(null)} />
      )}

      {renombrando && (
        <NombreClienteDialog
          nombre={nombreEdit}
          onNombre={setNombreEdit}
          onCancel={() => setRenombrando(null)}
          onConfirm={guardarNombre}
        />
      )}

      {/* ⚠️ HERMANO DE LA FICHA Y NO HIJO SUYO. Los dos se portalean a `document.body`,
          y adentro de la ficha la pila de modales lo apagaría junto con ella — el mismo
          motivo por el que los selectores de portada viven acá arriba. Y con esto, el
          único menú que hay (`opcionesDe`) le sirve a la tarjeta Y a la ficha: «recuerda
          cambiar esas acciones en la preview de la card como en el botón dentro del
          detail» se cumple sin escribir nada dos veces. */}
      {cambiandoPlan && (
        <PermisosDialog
          w={cambiandoPlan}
          nClientes={clientesDeAgencia(cambiandoPlan.id).length}
          ocupado={accionando}
          onCancel={() => setCambiandoPlan(null)}
          onConfirm={(capa) => { void cambiarPlan(cambiandoPlan, capa); }}
        />
      )}

      {/* El resultado del cambio de plan, con el del ENVÍO adentro. Va al pie del panel
          y no adentro del modal: el modal se cierra al confirmar, y un aviso que se va
          con la pantalla que lo produjo no lo lee nadie. */}
      {avisoPlan && (
        <div style={{ ...card, borderColor: avisoPlan.tono === 'ok' ? 'var(--good)' : 'var(--warn)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5, color: avisoPlan.tono === 'ok' ? 'var(--good)' : 'var(--warn)', fontWeight: 600 }}>
            {avisoPlan.texto}
          </span>
          <button type="button" onClick={() => setAvisoPlan(null)} style={{ ...btnGhost, padding: '4px 10px', fontSize: 12.5 }}>Cerrar</button>
        </div>
      )}

      {borrando && (
        <BorrarClienteDialog
          w={borrando}
          motivo={(nombre) => motivoNoEliminable(
            { id: borrando.id, nombre: borrando.nombre, capa: borrando.capa },
            /* Lo que la PANTALLA puede saber. El server vuelve a correr EL MISMO guard
               con la cartera leída de la base y con el ws de la sesión: acá sólo alcanza
               para explicar, nunca para autorizar.
               ⚠️ LA CARTERA HAY QUE PASARLA. Con `[]` cableado, la pantalla le ofrecía a
               una agencia con clientes el campo para escribir el nombre y recién el
               server la frenaba — o sea el peor orden posible: primero tipeás el nombre
               de tu cliente y después te dicen que no. Medido en el navegador. */
            {
              wsDelQueLlama: null,
              clientesEnCartera: clientesDeAgencia(borrando.id).map((c) => c.id),
              nombreEscrito: nombre,
              wsPlataforma,
            },
          )}
          usuarios={borrando.usuarios}
          ocupado={accionando}
          onCancel={() => setBorrando(null)}
          onConfirm={(nombre) => { void borrar(borrando, nombre); }}
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

/**
 * EL TABLERO DE UN CLIENTE: el trabajo del SUPER ADMIN atribuido a ese cliente.
 *
 * ⚠️ NO ES EL TABLERO DEL CLIENTE, y confundirlo fue el reporte: «estás trayendo las
 * tareas y proyectos de ese cliente, cuando tenés que traer los de SUPER ADMIN
 * relacionados a ese cliente». Es exactamente lo que hace la ficha de un cliente en
 * Customer Success —MI trabajo para él— y para ver el suyo está «Inspeccionar».
 *
 * ⚠️ LAS FILAS YA ESTÁN: vienen del server con el HTML. Por eso no hay fetch ni estado
 * de carga, que era el otro reporte del mismo día («ya habíamos dicho que debe quedar
 * registro y ser automático»).
 *
 * ⚠️ Y «EQUIPO» ENTRA COMO UNA VISTA MÁS DEL BOARD, no como una segunda fila de tabs:
 * «tienes que quitar lo de arriba, y simplemente agregar Equipo luego de Recurrentes».
 */
function TableroDelCliente({ w, lead, trabajo, clientes, user, equipo, onRecargar }: {
  w: Workspace;
  /** El cliente del CRM que corresponde a este workspace, por `cliente_ws`. */
  lead: ClienteRef | null;
  trabajo: { dueno: boolean; porCliente: Record<number, TrabajoDeCliente> } | null;
  clientes: ClienteRef[];
  user: BoardUser;
  equipo: React.ReactNode;
  onRecargar: () => void | Promise<void>;
}) {
  const vistaExtra = { id: 'equipo', label: 'Equipo', contenido: equipo };

  // ⚠️ «No pude leer» y «no está ligado a ningún cliente» son dos cosas, y ninguna es
  // «no tiene trabajo». Cada una se dice con su frase, y el EQUIPO se muestra igual
  // porque no depende del tablero.
  if (!trabajo || !lead) {
    return (
      <div style={{ padding: '4px 30px 24px' }}>
        <p style={{ fontSize: 13.5, color: 'var(--faint)', margin: '4px 0 18px' }}>
          {!trabajo
            ? 'No pude leer tu tablero. Vuelve a entrar a Clientes.'
            : `${w.nombre} todavía no está ligado a ningún cliente de tu CRM, así que no hay trabajo suyo que mostrar.`}
        </p>
        {equipo}
      </div>
    );
  }

  const clienteFijo = { leadId: lead.leadId, nombre: lead.nombre };
  const suyo = trabajo.porCliente[lead.leadId];
  // Sin trabajo asignado no hay entrada en el mapa, y eso NO es un error: es el caso
  // normal del día 1. Se le arma su tablero vacío, con la forma que le toca.
  const t = suyo ?? (trabajo.dueno
    ? { dueno: true as const, tareas: [], proyectos: [] }
    : { dueno: false as const, tareas: [], categorias: [] });

  return t.dueno
    ? (
      <PlanBoard user={user} tareas={t.tareas} proyectos={t.proyectos}
        vacio={false} clientes={clientes} clienteFijo={clienteFijo} embebido
        vistaExtra={vistaExtra} onRecargar={() => { void onRecargar(); }} />
    ) : (
      <TodoBoard tareas={t.tareas} categorias={t.categorias} demo={false}
        user={user} clientes={clientes} clienteFijo={clienteFijo} embebido
        vistaExtra={vistaExtra} onRecargar={() => { void onRecargar(); }} />
    );
}

/**
 * El equipo de un cliente: quien es, que rol tiene adentro del negocio, cuando
 * entro por ultima vez y que se puede hacer con el.
 *
 * ⚠️ ES EL MISMO BLOQUE QUE SE EXPANDIA EN LA FILA, pieza por pieza — el rol, el
 * ultimo login, reenviar el acceso, suspender y eliminar. El rediseno cambia
 * DONDE vive (un modal en vez de un acordeon), no lo que ofrece: perder una
 * accion en una mudanza de presentacion no da error y no lo ve nadie hasta que
 * alguien la necesita.
 */
function EquipoDelCliente({ w, equipo, accionando, accionUser, reenviar, onEliminar, avisoReenvio, onRecargar }: {
  w: Workspace;
  equipo: Usuario[];
  accionando: boolean;
  accionUser: (body: Record<string, unknown>) => void;
  reenviar: (u: Usuario) => void;
  onEliminar: (u: Usuario) => void;
  avisoReenvio: { id: number; aviso: AvisoInvitacion } | null;
  onRecargar: () => Promise<void>;
}) {
  const [sumando, setSumando] = useState(false);
  const [sumandoYa, setSumandoYa] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [errSumar, setErrSumar] = useState<string | null>(null);
  const [avisoSumar, setAvisoSumar] = useState<AvisoInvitacion | null>(null);
  const puedeSumar = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nuevoEmail.trim()) && !sumandoYa;
  /** El input de archivo es UNO y se reusa: a quién le toca lo guarda `fotoDe`. */
  const fotoRef = useRef<HTMLInputElement>(null);
  const [fotoDe, setFotoDe] = useState<number | null>(null);

  /**
   * Cambiarle la foto a alguien del equipo. «Si agrego el email, que ya ponga la foto
   * de perfil de ese email automáticamente en la card, y en todo caso que yo la pueda
   * modificar» (27/09/2026) — esto es la segunda mitad.
   *
   * ⚠️ SUBE POR EL ROUTE MULTIPART (`/api/portadas`) y no por una server action: el
   * cuerpo de una action topea en 1 MB y cualquier foto de celular lo pasa. Es el mismo
   * camino que usa la ficha del cliente.
   */
  const pedirFoto = (u: Usuario) => { setFotoDe(u.id); fotoRef.current?.click(); };
  const subirFoto = async (f: File) => {
    const id = fotoDe;
    if (id == null) return;
    setErrSumar(null);
    const fd = new FormData();
    fd.append('file', f);
    try {
      const r = await fetch('/api/portadas', { method: 'POST', body: fd });
      const j: { ok: boolean; url?: string; error?: string } = await r.json();
      if (!j.ok || !j.url) { setErrSumar(j.error || 'No pude subir la foto.'); return; }
      accionUser({ action: 'foto', id, foto_url: j.url });
    } catch (e) {
      setErrSumar(e instanceof Error ? e.message : String(e));
    } finally {
      setFotoDe(null);
    }
  };

  /**
   * Sumar a alguien a ESTE workspace.
   *
   * ⚠️ EL ROL GLOBAL SALE DE DONDE SE SUMA, no de un campo: en el workspace de la
   * plataforma (capa `superadmin`) la persona es un SUPER ADMIN; en cualquier otro
   * es un usuario del cliente. Eso es lo que hace que «un super admin es un usuario
   * mas» sea verdad y no una frase — antes habia un formulario aparte que pasaba
   * `rol: 'admin'` a mano, y era el unico lugar donde se podia crear uno.
   */
  const sumar = async () => {
    if (!puedeSumar) return;
    setErrSumar(null); setAvisoSumar(null); setSumandoYa(true);
    try {
      const email = nuevoEmail.trim();
      const esPlataforma = w.capa === 'superadmin';
      const r = await fetch('/api/admin/usuarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'crear', email, nombre: nuevoNombre.trim(),
          rol: esPlataforma ? 'admin' : 'usuario',
          ...(esPlataforma ? {} : { workspace_id: w.id, rol_ws: 'admin' }),
        }),
      });
      const j = (await r.json()) as Respuesta;
      if (!j.ok) { setErrSumar(j.error ?? 'No se pudo sumar a esa persona.'); return; }
      setNuevoNombre(''); setNuevoEmail(''); setSumando(false);
      setAvisoSumar(avisoInvitacion(j.invitacion, email));
      await onRecargar();
    } finally { setSumandoYa(false); }
  };

  return (
    <div>
      {/* ⛔ ACÁ ESTABA «slug · plan · estado», y se fue el 28/09/2026 con la cabecera
          nueva: los tres ya están arriba, en el renglón chico al lado del nombre. Era
          el mismo dato dicho dos veces a dos centímetros de distancia — lo que pasa
          cuando un panel que era TODO el modal se vuelve el cuerpo de uno. */}
      {/* ⚠️ EL ALTA VIVE ACA, Y ES LA UNICA. Habia un formulario aparte, abajo de todo,
          solo para super admins — y un super admin es un usuario mas del workspace de la
          plataforma, que es una tarjeta mas de esta grilla. Dos altas para la misma cosa
          es como una de las dos se queda vieja: la de super admins no pedia rol_ws, no
          mostraba el aviso de invitacion y no chequeaba lo mismo. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 8px' }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>Equipo</span>
        <span style={{ flex: 1 }} />
        {!sumando && <button type="button" style={{ ...btnGhost, padding: '5px 11px', fontSize: 12.5, fontWeight: 600 }} onClick={() => setSumando(true)}>＋ Sumar a alguien</button>}
      </div>
      {sumando && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr auto auto', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <input style={input} value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Nombre y apellido" />
          <input style={input} type="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} placeholder="persona@empresa.com"
            onKeyDown={(e) => { if (e.key === 'Enter' && puedeSumar) sumar(); }} />
          <button type="button" style={{ ...btnDark, padding: '9px 14px', opacity: puedeSumar ? 1 : 0.5 }} disabled={!puedeSumar} onClick={sumar}>
            {sumandoYa ? 'Sumando…' : 'Sumar'}
          </button>
          <button type="button" style={{ ...btnGhost, padding: '9px 12px' }} onClick={() => { setSumando(false); setErrSumar(null); }}>Cancelar</button>
        </div>
      )}
      {errSumar && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginBottom: 10 }}>{errSumar}</div>}
      {avisoSumar && <div style={{ marginBottom: 10 }}><Aviso aviso={avisoSumar} /></div>}
      {equipo.length === 0 && !sumando ? (
        <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5, paddingBottom: 6 }}>
          Sin miembros todavía. El admin de este cliente los suma desde su panel de Equipo (Configuraciones → Equipo), o entra como el cliente para configurarlo.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {equipo.map((u) => (
            <div key={u.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              {/* ⚠️ `u.cara` Y NO `u.foto_url`: la precedencia (foto elegida > Gravatar >
                  iniciales) la resuelve el server en un solo lugar. Acá había quedado
                  el campo pelado — la tabla de al lado ya usaba `cara`, así que la
                  misma persona se dibujaba distinta según por dónde se la mirara. */}
              <Cuadro texto={inicialesTxt(u.nombre || u.email)} foto={u.cara ?? u.foto_url} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
              </div>
              <ChipEstadoUsuario u={u} />
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
                  { value: 'reinvitar', label: u.invitacion_enviada_at ? 'Reenviar acceso' : 'Mandarle el acceso' },
                  { value: 'foto', label: u.foto_url ? 'Cambiar la foto…' : 'Ponerle una foto…' },
                  // ⚠️ SÓLO SI ELIGIÓ UNA. Quitar la de su Gravatar es imposible —no es
                  // nuestra— y un botón que no puede hacer nada se lee como que la app
                  // está rota. Es la misma regla que «Reposicionar» de la portada.
                  ...(u.foto_url ? [{ value: 'quitarfoto', label: 'Quitar la foto' }] : []),
                  { value: 'estado', label: u.estado === 'suspendido' ? 'Reactivar' : 'Suspender' },
                  { value: 'eliminar', label: 'Eliminar…', color: 'var(--bad)' },
                ]}
                onChange={(v) => {
                  if (v === 'reinvitar') reenviar(u);
                  else if (v === 'foto') pedirFoto(u);
                  else if (v === 'quitarfoto') accionUser({ action: 'foto', id: u.id, foto_url: '' });
                  else if (v === 'estado') accionUser({ action: 'estado', id: u.id, estado: u.estado === 'suspendido' ? 'activo' : 'suspendido' });
                  else if (v === 'eliminar') onEliminar(u);
                }}
              />
            </div>
            {/* Pegado a SU fila, no arriba de todo: con diez miembros, un
                aviso global no dice a cuál de los diez se le mandó. */}
            {avisoReenvio?.id === u.id && <Aviso aviso={avisoReenvio.aviso} />}
            </div>
          ))}
        </div>
      )}
      <input ref={fotoRef} type="file" accept="image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void subirFoto(f); }} />
    </div>
  );
}

/**
 * Mini modal para renombrar un workspace.
 *
 * ⚠️ SU z SALE DE LA PILA, igual que el de `ConfirmDialog` y por el mismo motivo: con
 * el 90 cableado quedaba DEBAJO de cualquier modal de la casa (arrancan en 130), así
 * que «Renombrar…» desde adentro del detalle de un cliente no dibujaba nada.
 */
function NombreClienteDialog({ nombre, onNombre, onCancel, onConfirm, titulo = 'Renombrar cliente', confirmLabel = 'Guardar' }: { nombre: string; onNombre: (v: string) => void; onCancel: () => void; onConfirm: () => void; titulo?: string; confirmLabel?: string }) {
  const capa = useCapaModal(true, { anidada: true });
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: capa.z, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
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
// =============================================================================
// TAB — Ángulos de guion (la biblioteca que alimenta "Nuevo guion" en la Matriz)

/**
 * CAMBIAR PERMISOS: elegir el plan de un cliente, leyendo qué incluye cada uno.
 *
 * ⚠️ REEMPLAZA A N ÍTEMS DE MENÚ, y el porqué no es estético: elegir entre «Pasar a
 * Project Manager» y «Pasar a Completo» desde un desplegable obliga a saberse de memoria
 * qué trae cada plan. La `descripcion` de cada capa existe desde siempre en `lib/capas.ts`
 * y no se veía en ninguna pantalla.
 *
 * ⚠️ Y EL BOTÓN DICE QUE SALE UN MAIL. «Guardar» no cuenta que se le va a escribir a una
 * persona, y eso no se deshace. Es la misma regla que «Abrir la cuenta» en el alta.
 */
function PermisosDialog({ w, nClientes, ocupado, onCancel, onConfirm }: {
  w: Workspace;
  /** Cuántos clientes tiene en su cartera. Sólo importa si HOY es agencia. */
  nClientes: number;
  ocupado: boolean;
  onCancel: () => void;
  onConfirm: (capa: string) => void;
}) {
  // ⚠️ ACÁ NO VA `useCapaModal`: LO LLAMA `Modal`, con el `anidada` que se le pasa
  // abajo. Llamarlo también acá registra DOS capas para un solo modal, y el Escape deja
  // de cerrar — el handler de `Modal` sólo actúa si su propia capa es la de arriba, y la
  // de arriba pasa a ser la mía. Medido en el navegador: el diálogo se abría y Escape no
  // hacía nada. Lo que sí hace falta es el `anidada` del `Modal`: sin él, la ficha de
  // atrás se apaga y parece que el menú la cerró.
  const [elegida, setElegida] = useState<string>(w.capa);
  const pierdeCartera = w.capa === 'agencia' && elegida !== 'agencia' && nClientes > 0;

  return (
    <Modal
      titulo={`Permisos de ${w.nombre}`}
      encabezado="Plan del cliente"
      ancho={520}
      anidada
      onCerrar={onCancel}
      pie={
        <>
          <button type="button" style={btnGhost} onClick={onCancel}>Cancelar</button>
          <button type="button" style={{ ...btnPrimary, opacity: elegida === w.capa || ocupado ? 0.5 : 1 }}
            disabled={elegida === w.capa || ocupado}
            onClick={() => onConfirm(elegida)}>
            {ocupado ? 'Cambiando…' : 'Cambiar el plan y avisarle'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CAPAS_VENDIBLES.map((c) => (
          <label key={c.id} className={`pm-op${elegida === c.id ? ' pm-on' : ''}`}>
            <input type="radio" name="plan" value={c.id} checked={elegida === c.id}
              onChange={() => setElegida(c.id)} />
            <span>
              <b>{c.nombre}</b>
              {c.id === w.capa && <em> · el que tiene hoy</em>}
              <span>{c.descripcion}</span>
            </span>
          </label>
        ))}
      </div>

      {/* ⚠️ LA CONSECUENCIA QUE NO SE VE, pegada al botón y ANTES del click. Sacarle
          «Agencia» a quien tiene cartera le apaga el acceso a clientes que hoy atiende:
          decirlo después sería una sorpresa, y es la única de estas que no se puede
          deshacer sola volviendo a cambiar el plan. */}
      {pierdeCartera && (
        <p className="pm-ojo">
          Deja de ver a {plural(nClientes, 'cliente')} de su cartera.
        </p>
      )}
      <p className="pm-pie">Se le avisa por mail al dueño de la cuenta.</p>

      <style dangerouslySetInnerHTML={{ __html: CSS_PERMISOS }} />
    </Modal>
  );
}

// Ningun backtick acá adentro: adentro de un template literal cierra la hoja a la mitad
// y la ruta contesta 200 con el layout entero y sin cuerpo.
const CSS_PERMISOS = `
.pm-op{ display:flex; gap:10px; align-items:flex-start; padding:11px 13px;
  border:1px solid var(--border); border-radius:11px; cursor:pointer; }
.pm-op:hover{ background:var(--surface-2); }
.pm-on{ border-color:var(--primary); background:var(--primary-bg); }
.pm-op input{ margin-top:2px; accent-color:var(--primary); }
.pm-op > span{ display:flex; flex-direction:column; gap:3px; min-width:0; }
.pm-op b{ font-size:14px; font-weight:650; color:var(--ink); }
.pm-op em{ font-style:normal; font-size:12px; color:var(--faint); font-weight:600; }
.pm-op > span > span{ font-size:12.5px; color:var(--dim); line-height:1.45; }
.pm-ojo{ margin:12px 2px 0; font-size:12.5px; font-weight:600; color:var(--warn); line-height:1.5; }
.pm-pie{ margin:10px 2px 0; font-size:12.5px; color:var(--faint); line-height:1.5; }
`;

/**
 * BORRAR UN CLIENTE: el diálogo que pide escribir su nombre.
 *
 * ⚠️ NO ES `ConfirmDialog`. Ése alcanza para lo que se puede rehacer; esto se lleva 89
 * tablas, los archivos y las personas, y no tiene vuelta atrás ni auditoría. Escribir
 * el nombre es lo único que un click distraído no puede acertar.
 *
 * ⚠️ Y LO QUE SE PIERDE SE DICE CON NÚMEROS, ANTES. «Esta acción no se puede deshacer»
 * es una frase que todos aprendimos a saltear; «se van 12 personas y 3.400 filas» no.
 */
function BorrarClienteDialog({ w, motivo, usuarios, ocupado, onCancel, onConfirm }: {
  w: Workspace;
  /** El mismo guard que corre el server, para apagar el botón. Nunca para autorizar. */
  motivo: (nombre: string) => string | null;
  usuarios: number;
  ocupado: boolean;
  onCancel: () => void;
  onConfirm: (nombre: string) => void;
}) {
  // Sin `useCapaModal` acá: lo llama `Modal`. Ver el porqué en `PermisosDialog`.
  const [nombre, setNombre] = useState('');
  const porQueNo = motivo(nombre);
  // Un motivo que NO es el del nombre no se arregla tipeando: el campo sobra.
  const bloqueado = porQueNo != null && !/nombre/i.test(porQueNo);

  return (
    <Modal
      titulo={`Eliminar a ${w.nombre}`}
      encabezado="Esto no se puede deshacer"
      ancho={520}
      anidada
      onCerrar={onCancel}
      pie={
        <>
          <button type="button" style={btnGhost} onClick={onCancel}>Cancelar</button>
          <button type="button"
            style={{ ...btnPrimary, background: 'var(--bad)', opacity: porQueNo || ocupado ? 0.5 : 1 }}
            disabled={!!porQueNo || ocupado}
            onClick={() => onConfirm(nombre)}>
            {ocupado ? 'Eliminando…' : 'Eliminar para siempre'}
          </button>
        </>
      }
    >
      {bloqueado ? (
        <p className="bc-no">{porQueNo}</p>
      ) : (
        <>
          <p className="bc-txt">
            Se van <b>{plural(usuarios, 'persona')}</b> y todo lo que este cliente tenga cargado:
            sus leads, sus conversaciones, su tablero, sus archivos y sus credenciales.
          </p>
          {/* Sin promesa de respaldo: no hay. Decir «puedes recuperarlo» sería mentir. */}
          <p className="bc-txt">No queda copia. Escribe <b>{w.nombre}</b> para confirmar.</p>
          <input className="bc-in" autoFocus value={nombre} placeholder={w.nombre}
            aria-label={`Escribe ${w.nombre} para confirmar`}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !porQueNo && !ocupado) onConfirm(nombre); }} />
        </>
      )}
      <style dangerouslySetInnerHTML={{ __html: CSS_BORRAR }} />
    </Modal>
  );
}

// Ningun backtick acá adentro: cierra la hoja a la mitad y la ruta contesta 200 sin cuerpo.
const CSS_BORRAR = `
.bc-txt{ margin:0 0 12px; font-size:13.5px; line-height:1.55; color:var(--ink); }
.bc-txt b{ font-weight:650; }
.bc-in{ width:100%; border:1px solid var(--border-strong); border-radius:10px; padding:10px 12px;
  font:inherit; font-size:14px; background:var(--surface); color:var(--ink); }
.bc-in:focus{ outline:2px solid var(--bad); outline-offset:1px; }
.bc-no{ margin:0; font-size:13.5px; line-height:1.55; color:var(--warn); font-weight:600; }
`;

