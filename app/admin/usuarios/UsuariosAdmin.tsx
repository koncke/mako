'use client';

// =============================================================================
// UsuariosAdmin — Admin › Users: las personas de todos los negocios, con su estado de alta (5/11/2026)
// =============================================================================
// Martín: «gestión de usuarios, estado de alta». Copiado de la tabla de usuarios de shadcn-admin (MIT, src/features/users):
// las columnas (persona, negocio, rol, estado), los cuatro estados con su color, los filtros por estado arriba y el menú de
// la fila; y de Clerk, las acciones del perfil (entrar como esa persona, suspender). Las reglas, en
// lib/admin-usuarios-reglas.ts; qué se copió de dónde, en docs/investigacion-admin.md.
//
// ⚠️ LAS ACCIONES VAN POR /api/admin/usuarios, la ruta de siempre: vuelve a preguntar `getSesionAdmin`, frena dejar a un
//    negocio sin su admin y, al suspender, apaga los tokens de la API de esa persona. Esta pantalla no decide nada.
// ⚠️ «Inspeccionar» es una RECARGA ENTERA a /inicio?ws=N (no un Link): el layout es el que dibuja la barra de «Viendo a X».
// ⚠️ NINGÚN BACKTICK EN EL CSS DE ABAJO.

import { useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Banner, Confirm, Toast, useToast } from '@/app/_ui';
import { Marca } from '@/app/_components/Marca';
import { colorDe } from '@/app/_components/TarjetaEntidad';
import { MenuContextual } from '@/app/_ui/MenuContextual';
import { useMenuContextual } from '@/app/_ui/useMenuContextual';
import {
  ESTADOS_ALTA, ROTULO_ESTADO_ALTA, accionesDe, conteosDeAlta, detalleDeAlta, estadoDeAlta, haceTxt, rolTxt, usuariosVisibles,
  type EstadoAlta, type FilaUsuario,
} from '@/lib/admin-usuarios-reglas';

const ROTULO_ACCION = { inspeccionar: 'Entrar a su negocio', reenviar: 'Reenviar el acceso', suspender: 'Suspender', reactivar: 'Reactivar' } as const;
type Accion = keyof typeof ROTULO_ACCION;
const ICONO_ACCION = { inspeccionar: 'ver', reenviar: 'enviar', suspender: 'candado', reactivar: 'activar' } as const;
const CHIP: Record<EstadoAlta | 'todos', string> = { todos: 'Todos', activo: 'Activos', inactivo: 'Inactivos', invitado: 'Invitados', suspendido: 'Suspendidos' };

export function UsuariosAdmin({ filas, ahoraMs }: { filas: FilaUsuario[]; ahoraMs: number }) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoAlta | 'todos'>('todos');
  const [q, setQ] = useState('');
  const [pedir, setPedir] = useState<{ u: FilaUsuario; accion: 'suspender' | 'reactivar' } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, show, clear } = useToast();
  const menu = useMenuContextual<FilaUsuario>();
  const conteos = useMemo(() => conteosDeAlta(filas, ahoraMs), [filas, ahoraMs]);
  const visibles = useMemo(() => usuariosVisibles(filas, { estado, q }, ahoraMs), [filas, estado, q, ahoraMs]);

  async function llamar(cuerpo: Record<string, unknown>): Promise<boolean> {
    setOcupado(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) { setError(j.error || `No se pudo (HTTP ${r.status}).`); return false; }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar.');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function hacer(u: FilaUsuario, accion: Accion) {
    if (accion === 'inspeccionar') { if (u.workspaceId != null) window.location.href = `/inicio?ws=${u.workspaceId}`; return; }
    if (accion === 'reenviar') { if (await llamar({ action: 'reinvitar', id: u.id })) show(`Acceso reenviado a ${u.email}`); return; }
    setPedir({ u, accion });
  }

  async function confirmar() {
    if (!pedir) return;
    const { u, accion } = pedir;
    // Reactivar a quien nunca entró lo devuelve a «invitado», no a «activo»: no entró.
    const nuevo = accion === 'suspender' ? 'suspendido' : u.ultimoLogin ? 'activo' : 'invitado';
    if (await llamar({ action: 'estado', id: u.id, estado: nuevo })) {
      setPedir(null);
      show(accion === 'suspender' ? `${u.nombre || u.email} quedó suspendido` : `${u.nombre || u.email} puede volver a entrar`);
      router.refresh();
    }
  }

  return (
    <div className="usu">
      <style>{CSS}</style>
      {error && <Banner tono="bad" onCerrar={() => setError(null)}>{error}</Banner>}
      <div className="usu-barra">
        <div className="usu-chips" role="tablist" aria-label="Qué personas ver">
          {(['todos', ...ESTADOS_ALTA] as const).map((e) => (
            <button key={e} type="button" role="tab" aria-selected={estado === e} data-on={estado === e} className="usu-chip" onClick={() => setEstado(e)}>
              {CHIP[e]} <span>{conteos[e]}</span>
            </button>
          ))}
        </div>
        <input className="usu-buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, email o negocio" aria-label="Buscar personas" />
      </div>

      <div className="usu-tabla" role="table" aria-label="Personas">
        <div className="usu-fila usu-cab" role="row">
          <span role="columnheader">Persona</span><span role="columnheader">Negocio</span><span role="columnheader">Rol</span>
          <span role="columnheader">Estado</span><span role="columnheader">Alta</span><span role="columnheader" aria-label="Acciones" />
        </div>
        {visibles.length === 0 && <p className="usu-vacio">{q ? 'Nadie con esa búsqueda.' : 'Nadie en este grupo.'}</p>}
        {visibles.map((u) => {
          const e = ROTULO_ESTADO_ALTA[estadoDeAlta(u, ahoraMs)];
          return (
            <div key={u.id} className="usu-fila" role="row" {...menu.propsDe(u)}>
              <span className="usu-quien">
                <Marca icono={null} foto={u.foto} nombre={u.nombre || u.email} tam={32} color={colorDe(u.nombre || u.email)} />
                <span><b>{u.nombre || u.email}</b><small>{u.email}</small></span>
              </span>
              <span className="usu-gris usu-corta">{u.negocio ?? (u.rol === 'admin' ? 'Plataforma' : '—')}</span>
              <span>{rolTxt(u)}{u.mfa && <small className="usu-mfa" title="Tiene el segundo paso activo">2FA</small>}</span>
              <span className="usu-estado-celda"><span className="usu-estado" data-tono={e.tono}>{e.rotulo}</span><small>{detalleDeAlta(u, ahoraMs)}</small></span>
              <span className="usu-gris">{haceTxt(u.creado, ahoraMs)}</span>
              <span>
                <button type="button" className="usu-mas" aria-label={`Acciones de ${u.nombre || u.email}`} onClick={(ev) => { const r = ev.currentTarget.getBoundingClientRect(); menu.abrir(u, r.left, r.bottom); }}>⋯</button>
              </span>
            </div>
          );
        })}
      </div>

      {/* Lo elegido llega con el menú ya cerrado: la persona se toma ACÁ, mientras está abierto. */}
      {menu.abierto && ((de: FilaUsuario) => (
        <MenuContextual key={menu.abierto.n} punto={{ x: menu.abierto.x, y: menu.abierto.y }} porDedo={menu.abierto.porDedo}
          etiqueta={`Acciones de ${de.nombre || de.email}`} onCerrar={menu.cerrar}
          items={accionesDe(de, ahoraMs).map((a) => ({ id: a, label: ROTULO_ACCION[a], icono: ICONO_ACCION[a], peligro: a === 'suspender' }))}
          onElegir={(id) => void hacer(de, id as Accion)} />
      ))(menu.abierto.de)}

      {pedir && (
        <Confirm
          title={pedir.accion === 'suspender' ? `¿Suspender a ${pedir.u.nombre || pedir.u.email}?` : `¿Reactivar a ${pedir.u.nombre || pedir.u.email}?`}
          message={pedir.accion === 'suspender' ? 'No va a poder entrar a MaKo y se apagan sus tokens de la API. Se puede reactivar.' : 'Vuelve a poder entrar con su cuenta.'}
          confirmLabel={pedir.accion === 'suspender' ? 'Suspender su acceso' : 'Reactivar su acceso'}
          cancelLabel="No cambiar nada"
          tone={pedir.accion === 'suspender' ? 'danger' : 'primary'}
          loading={ocupado}
          onConfirm={() => void confirmar()}
          onCancel={() => setPedir(null)}
        />
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

const CSS = `
.usu{ display:flex; flex-direction:column; gap:14px; }
.usu-barra{ display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
.usu-chips{ display:flex; gap:8px; flex-wrap:wrap; }
.usu-chip{ border:1px solid var(--border); background:var(--surface); border-radius:999px; padding:7px 14px; font:inherit; font-size:13.5px; font-weight:600; color:var(--dim); cursor:pointer; }
.usu-chip span{ font-weight:700; color:var(--faint); margin-left:2px; }
.usu-chip[data-on="true"]{ background:var(--ink); border-color:var(--ink); color:var(--surface); }
.usu-chip[data-on="true"] span{ color:var(--surface); opacity:.75; }
.usu-buscar{ width:280px; max-width:100%; box-sizing:border-box; border:1px solid var(--border); border-radius:10px; padding:8px 12px; font:inherit; font-size:14px; background:var(--surface); color:var(--ink); }
.usu-tabla{ background:var(--surface); border:1px solid var(--border); border-radius:16px; overflow:hidden; }
.usu-fila{ display:grid; grid-template-columns:minmax(220px, 2.2fr) minmax(120px, 1.3fr) 120px minmax(170px, 1.4fr) 110px 44px; gap:14px; align-items:center;
  padding:10px 18px; border-bottom:1px solid var(--border); font-size:14px; }
.usu-fila > span{ min-width:0; }
.usu-fila:last-child{ border-bottom:0; }
.usu-fila:not(.usu-cab):hover{ background:var(--surface-2); }
.usu-cab{ background:var(--surface-2); font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--faint); font-weight:700; padding-block:9px; }
.usu-quien{ display:flex; align-items:center; gap:11px; min-width:0; }
.usu-quien > span{ display:flex; flex-direction:column; min-width:0; }
.usu-quien b{ font-size:14px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.usu-quien small{ font-size:12px; color:var(--faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.usu-gris{ color:var(--dim); font-size:13.5px; }
.usu-corta{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.usu-mfa{ margin-left:6px; font-size:10.5px; font-weight:700; color:var(--good); background:var(--good-bg); padding:1px 6px; border-radius:6px; }
.usu-estado-celda{ display:flex; flex-direction:column; align-items:flex-start; gap:3px; }
.usu-estado-celda small{ font-size:12px; color:var(--faint); }
.usu-estado{ display:inline-block; font-size:12px; font-weight:650; padding:3px 10px; border-radius:999px; white-space:nowrap; }
.usu-estado[data-tono="good"]{ background:var(--good-bg); color:var(--good); }
.usu-estado[data-tono="bad"]{ background:var(--bad-bg); color:var(--bad); }
.usu-estado[data-tono="info"]{ background:var(--primary-bg); color:var(--primary); }
.usu-estado[data-tono="neutral"]{ background:var(--surface-2); color:var(--dim); }
.usu-mas{ border:0; background:none; font:inherit; font-size:18px; line-height:1; color:var(--dim); cursor:pointer; padding:6px 10px; border-radius:8px; }
.usu-mas:hover{ background:var(--surface-2); }
.usu-vacio{ margin:0; padding:18px; color:var(--faint); font-size:13.5px; }
@media (max-width: 760px){
  .usu-cab{ display:none; }
  .usu-fila{ grid-template-columns:1fr auto auto; row-gap:4px; padding:12px 14px; }
  .usu-fila > span:nth-child(2), .usu-fila > span:nth-child(3), .usu-fila > span:nth-child(5){ display:none; }
  .usu-buscar{ width:100%; }
}
`;
