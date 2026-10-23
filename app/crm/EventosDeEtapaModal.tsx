'use client';

// =============================================================================
// EventosDeEtapaModal — «Vincular evento»: qué evento de Calendly o Cal.com cae en ESTA etapa de reunión
// =============================================================================
// Feedback de Martín del 16/10/2026 (punto 3 del CRM): «Falta la misma opción para las etapas de reunión "Asignar
// evento"... y que ahí se puedan seleccionar de la misma manera (en diseño) que la lista de campañas... Y que tenga la
// opción ahí mismo de crear un nuevo evento para asignarse a esa etapa». Se abre desde el «⋯» de la columna
// (app/crm/CrmBoard.tsx) y su clic derecho.
//
// El MOTOR (mig 0293, lib/agenda-evento-etapa*.ts, app/crm/agenda-evento-actions.ts): un evento va a UNA sola etapa, y
// quien se agenda en él cae en esa etapa de ese funnel. Acá sólo hay pantalla:
//   · Marcar un evento lo vincula a esta etapa; desmarcarlo lo desvincula. Uno que ya está en OTRA etapa dice dónde
//     («CRM › Etapa») y «Traer aquí» lo desvincula de allá y lo vincula acá.
//   · Se CREA y se EDITA acá (21/10/2026): lo creado nace vinculado a esta etapa.
//   · Sin Calendly ni Cal.com, se conectan AHÍ MISMO (`BotonIntegracion`, el modal de /integraciones arriba de éste).
//
// SEGUNDA VUELTA (22/10/2026, noche). Martín, con capturas del ws1:
//   · «Asignar evento» pasa a llamarse «Vincular evento», como «Vincular cobro».
//   · LENTO: abrir quedaba cargando (la lista le pregunta a Calendly y a Cal.com) y cada cambio la volvía a pedir entera.
//     Ahora (1) lo vinculado a ESTA etapa sale de la base y se ve al toque (`vinculadosDeEtapaAction`) mientras llega la
//     agenda, y (2) vincular, desvincular, crear y editar cambian la lista EN EL LUGAR con lo que contestó el server, sin
//     volver a pedirla. Lo del server (los proveedores en paralelo, la caché) en lib/agenda-evento-etapa-server.ts.
//   · En vez de «Esta etapa», el nombre de la etapa; y el del CRM, que faltaba.
//   · Fuera los textos largos: lo de Google Calendar es una ⓘ.
//   · Rediseñado: una lista de renglones (no una tabla), que en el teléfono apila el «dónde» debajo del nombre.
// =============================================================================

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Spinner, Toast, useToast, Button, SANS } from '@/app/_ui';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import {
  listarEventosAgendaAction, vincularEventoEtapaAction, desvincularEventoEtapaAction, crearEventoAgendaAction, editarEventoAgendaAction,
  vinculadosDeEtapaAction, type AgendaDelNegocio, type EventoDeAgenda,
} from './agenda-evento-actions';
import { DURACIONES_EVENTO, MAX_NOMBRE_EVENTO, type ProveedorAgenda } from '@/lib/agenda-evento-etapa';
import { AVISO_GOOGLE_AGENDA, CSS_VINCULAR, PASTILLA_CONECTAR, ordenarEventos, ubicacionDe } from './vincular-etapa';

const NOMBRE_PROVEEDOR: Record<EventoDeAgenda['proveedor'], string> = { calendly: 'Calendly', calcom: 'Cal.com' };
/** El servicio de /integraciones de cada agenda (lib/integraciones-catalogo.ts), para conectarla sin salir. */
const SERVICIO_INTEGRACION: Record<ProveedorAgenda, string> = { calendly: 'calendly', calcom: 'calcom' };
const CAMPO: CSSProperties = {
  height: 34, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, minWidth: 0,
};
type Borrador = { nombre: string; duracionMin: number; proveedor: ProveedorAgenda };
type Rapido = { proveedor: ProveedorAgenda; identificador: string; nombre: string };
const clave = (e: { proveedor: string; identificador: string }) => `${e.proveedor}:${e.identificador}`;

export function EventosDeEtapaModal({ funnelId, etapa, etapaNombre, crmNombre, onCerrar }: {
  funnelId: number;
  etapa: string;
  etapaNombre: string;
  /** El nombre del CRM, para decir dónde cae («Sprint 3 días › Agenda R1»). */
  crmNombre: string;
  onCerrar: () => void;
}) {
  const [montado, setMontado] = useState(false);
  const [agenda, setAgenda] = useState<AgendaDelNegocio | null>(null);
  /** Lo vinculado a esta etapa, de la base: se ve mientras llega la agenda. */
  const [rapidos, setRapidos] = useState<Rapido[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const { toast, show, clear } = useToast();
  useEffect(() => { setMontado(true); }, []);
  const [creando, setCreando] = useState<Borrador | null>(null);
  const [editando, setEditando] = useState<{ k: string; nombre: string; duracionMin: number } | null>(null);

  /** `fresco`: sin el minuto de caché de las APIs (lib/agenda-cache.ts). Lo pide sólo «Volver a leer»: conectar otra cuenta
   *  ya cambia la llave de la caché, y abrir el pop-up la aprovecha. */
  const leer = useCallback((fresco = false) => {
    setError(null);
    void listarEventosAgendaAction(fresco ? { fresco: true } : undefined)
      .then((r) => { if (r.ok) setAgenda(r); else setError(r.error); })
      .catch(() => setError('No pude leer tu agenda. Intenta de nuevo.'));
  }, []);
  useEffect(() => {
    void vinculadosDeEtapaAction(funnelId, etapa).then((r) => { if (r.ok) setRapidos(r.eventos); }).catch(() => {});
    leer();
  }, [funnelId, etapa, leer]);

  const aqui = { funnelId, funnel: crmNombre, etapa, etapaNombre };
  const enEsta = (e: EventoDeAgenda) => !!e.vinculo && e.vinculo.funnelId === funnelId && e.vinculo.etapa === etapa;
  /** La lista cambia EN EL LUGAR con lo que contestó el server: no se vuelve a pedir la agenda entera. */
  const ponerVinculo = (k: string, vinculo: EventoDeAgenda['vinculo']) =>
    setAgenda((a) => (a ? { ...a, eventos: a.eventos.map((x) => (clave(x) === k ? { ...x, vinculo } : x)) } : a));

  const cambiar = async (e: EventoDeAgenda, accion: 'vincular' | 'desvincular' | 'traer') => {
    const k = clave(e);
    setOcupado(k);
    try {
      if (accion !== 'vincular') {
        const d = await desvincularEventoEtapaAction({ proveedor: e.proveedor, identificador: e.identificador });
        if (!d.ok) { show(d.error, undefined, 'bad'); return; }
        ponerVinculo(k, null);
      }
      if (accion !== 'desvincular') {
        const v = await vincularEventoEtapaAction({ proveedor: e.proveedor, identificador: e.identificador, funnelId, etapa });
        if (!v.ok) { show(v.error, undefined, 'bad'); return; }
        ponerVinculo(k, { ...aqui, funnel: v.funnel || crmNombre, etapaNombre: v.etapaNombre || etapaNombre, reunion: v.reunion });
      }
      show(accion === 'desvincular' ? 'Evento quitado' : `Cae en «${etapaNombre}»`);
    } catch {
      show('No se pudo guardar', undefined, 'bad');
    } finally {
      setOcupado(null);
    }
  };

  const crear = async () => {
    if (!creando) return;
    setOcupado('crear');
    try {
      const r = await crearEventoAgendaAction({ ...creando, vincularA: { funnelId, etapa } });
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      setCreando(null);
      const nuevo: EventoDeAgenda = {
        proveedor: r.evento.proveedor, identificador: r.evento.identificador, nombre: r.evento.nombre, duracionMin: r.evento.duracionMin,
        credencial: null, enLaCuenta: true, vinculo: r.vinculado ? { ...aqui, reunion: null } : null,
      } as EventoDeAgenda;
      setAgenda((a) => (a ? { ...a, eventos: [nuevo, ...a.eventos.filter((x) => clave(x) !== clave(nuevo))] } : a));
      show(r.vinculado ? `Creado y vinculado a «${etapaNombre}»` : (r.avisoVinculo ?? 'Creado'), undefined, r.vinculado ? undefined : 'bad');
    } catch {
      show('No se pudo crear', undefined, 'bad');
    } finally {
      setOcupado(null);
    }
  };
  const guardarEdicion = async (e: EventoDeAgenda) => {
    if (!editando) return;
    const k = clave(e);
    setOcupado(k);
    try {
      const r = await editarEventoAgendaAction({ proveedor: e.proveedor, identificador: e.identificador, nombre: editando.nombre, duracionMin: editando.duracionMin });
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      setEditando(null);
      setAgenda((a) => (a ? { ...a, eventos: a.eventos.map((x) => (clave(x) === k ? { ...x, nombre: r.evento.nombre, duracionMin: r.evento.duracionMin } : x)) } : a));
      show('Evento guardado');
    } catch {
      show('No se pudo guardar', undefined, 'bad');
    } finally {
      setOcupado(null);
    }
  };
  /** Las duraciones de la lista, con la del evento si es otra (un evento de 20 min no se ofrece como 15). */
  const duraciones = (actual: number | null) => (actual != null && !DURACIONES_EVENTO.includes(actual) ? [...DURACIONES_EVENTO, actual].sort((a, b) => a - b) : DURACIONES_EVENTO);

  const conectados = agenda?.proveedores.filter((p) => p.conectado) ?? [];
  const sinConectar = (['calendly', 'calcom'] as const).filter((p) => !conectados.some((c) => c.proveedor === p));
  const eventos = useMemo(() => (agenda ? ordenarEventos(agenda.eventos, funnelId, etapa) : []), [agenda, funnelId, etapa]);

  const fila = (e: EventoDeAgenda) => {
    const k = clave(e);
    const enEstaEtapa = enEsta(e);
    const donde = ubicacionDe(e.vinculo);
    if (editando?.k === k) {
      return (
        <li key={k} className="vx-fila vx-fila--abierta">
          <form className="vx-form" onSubmit={(ev) => { ev.preventDefault(); void guardarEdicion(e); }}>
            <input autoFocus value={editando.nombre} maxLength={MAX_NOMBRE_EVENTO} aria-label="Nombre del evento"
              onChange={(ev) => setEditando({ ...editando, nombre: ev.target.value })} style={{ ...CAMPO, flex: '1 1 200px' }} />
            <select value={editando.duracionMin} aria-label="Duración" onChange={(ev) => setEditando({ ...editando, duracionMin: Number(ev.target.value) })} style={CAMPO}>
              {duraciones(e.duracionMin).map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
            <Button size="sm" type="submit" loading={ocupado === k} disabled={ocupado != null || !editando.nombre.trim()}>Guardar</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
          </form>
        </li>
      );
    }
    return (
      <li key={k} className="vx-fila" data-aqui={enEstaEtapa || undefined}>
        <input type="checkbox" className="vx-sel" checked={enEstaEtapa} disabled={(!!donde && !enEstaEtapa) || ocupado != null || agenda?.sePuedeVincular === false}
          aria-label={enEstaEtapa ? `Quitar ${e.nombre} de ${etapaNombre}` : `Vincular ${e.nombre} a ${etapaNombre}`}
          onChange={() => { void cambiar(e, enEstaEtapa ? 'desvincular' : 'vincular'); }} />
        <div className="vx-txt">
          <span className="vx-nombre" title={e.enLaCuenta ? e.nombre : `${e.nombre} · ya no está en tu cuenta`} data-fuera={!e.enLaCuenta || undefined}>{e.nombre}</span>
          <span className="vx-meta">{[NOMBRE_PROVEEDOR[e.proveedor], e.duracionMin != null ? `${e.duracionMin} min` : null, e.credencial].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="vx-donde">
          {ocupado === k ? <Spinner size={13} />
            : enEstaEtapa ? <span className="vx-chip vx-chip--aqui">{etapaNombre}</span>
              : donde ? (
                <>
                  <span className="vx-chip" title={donde}>{donde}</span>
                  <button type="button" className="vx-link" disabled={ocupado != null} onClick={() => { void cambiar(e, 'traer'); }}>Traer aquí</button>
                </>
              ) : null}
        </div>
        {e.enLaCuenta ? (
          <button type="button" className="vx-icono" disabled={ocupado != null} aria-label={`Editar ${e.nombre}`} title="Editar"
            onClick={() => setEditando({ k, nombre: e.nombre, duracionMin: e.duracionMin ?? 30 })}>
            <IconoMenu nombre="editar" size={15} />
          </button>
        ) : <span />}
      </li>
    );
  };

  // Mientras llega la agenda: lo vinculado a esta etapa (de la base), marcado, y unas filas grises.
  const mientras = !agenda && !error ? (
    <>
      {(rapidos ?? []).map((r) => (
        <li key={clave(r)} className="vx-fila" data-aqui>
          <input type="checkbox" className="vx-sel" checked readOnly disabled aria-label={`${r.nombre}, vinculado a ${etapaNombre}`} />
          <div className="vx-txt"><span className="vx-nombre">{r.nombre}</span><span className="vx-meta">{NOMBRE_PROVEEDOR[r.proveedor]}</span></div>
          <div className="vx-donde"><span className="vx-chip vx-chip--aqui">{etapaNombre}</span></div>
          <span />
        </li>
      ))}
      {[0, 1].map((i) => <li key={`g${i}`} className="vx-fila vx-gris" aria-hidden><span /><span /><span /><span /></li>)}
    </>
  ) : null;

  const contenido = (
    <div className="vx" style={{ fontFamily: SANS }}>
      <style>{CSS_VINCULAR}</style>
      <div className="vx-barra">
        {agenda && sinConectar.map((p) => (
          <BotonIntegracion key={p} servicio={SERVICIO_INTEGRACION[p]} onConectado={() => leer()} style={PASTILLA_CONECTAR}>
            <IconoMenu nombre="link" size={14} /> Conectar {NOMBRE_PROVEEDOR[p]}
          </BotonIntegracion>
        ))}
        <span className="vx-elastico" />
        <span className="vx-info" role="img" aria-label={AVISO_GOOGLE_AGENDA} title={AVISO_GOOGLE_AGENDA}>ⓘ</span>
        <button type="button" className="vx-icono" aria-label="Volver a leer tu agenda" title="Volver a leer" onClick={() => leer(true)} disabled={!agenda && !error}>
          <IconoMenu nombre="restaurar" size={15} />
        </button>
        {conectados.length > 0 && !creando && (
          <Button size="sm" icon={<IconoMenu nombre="agregar" size={15} />} disabled={ocupado != null || agenda?.sePuedeVincular === false}
            onClick={() => setCreando({ nombre: '', duracionMin: 30, proveedor: conectados[0].proveedor })}>
            Crear evento
          </Button>
        )}
      </div>

      {creando && (
        <form className="vx-form vx-form--crear" onSubmit={(ev) => { ev.preventDefault(); void crear(); }}>
          <input autoFocus value={creando.nombre} maxLength={MAX_NOMBRE_EVENTO} placeholder="Nombre del evento" aria-label="Nombre del evento"
            onChange={(ev) => setCreando({ ...creando, nombre: ev.target.value })} style={{ ...CAMPO, flex: '1 1 220px' }} />
          <select value={creando.duracionMin} aria-label="Duración" onChange={(ev) => setCreando({ ...creando, duracionMin: Number(ev.target.value) })} style={CAMPO}>
            {DURACIONES_EVENTO.map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
          {conectados.length > 1 && (
            <select value={creando.proveedor} aria-label="Agenda" onChange={(ev) => setCreando({ ...creando, proveedor: ev.target.value as ProveedorAgenda })} style={CAMPO}>
              {conectados.map((p) => <option key={p.proveedor} value={p.proveedor}>{NOMBRE_PROVEEDOR[p.proveedor]}</option>)}
            </select>
          )}
          <Button size="sm" type="submit" loading={ocupado === 'crear'} disabled={ocupado != null || !creando.nombre.trim()}>Crear</Button>
          <Button size="sm" variant="secondary" onClick={() => setCreando(null)}>Cancelar</Button>
        </form>
      )}

      <ul className="vx-lista" aria-label={`Eventos para ${etapaNombre}`} aria-busy={!agenda && !error}>
        {eventos.map(fila)}
        {mientras}
      </ul>
      {!agenda && error && <p className="vx-vacio" data-mal>{error}</p>}
      {agenda && agenda.eventos.length === 0 && (
        <p className="vx-vacio">{conectados.length === 0 ? 'Conecta Calendly o Cal.com.' : 'Tu agenda no tiene eventos.'}</p>
      )}
      {agenda?.proveedores.filter((p) => p.conectado && p.error).map((p) => (
        <p key={p.proveedor} className="vx-nota" data-mal>{NOMBRE_PROVEEDOR[p.proveedor]}: {p.error}</p>
      ))}
      {agenda && !agenda.sePuedeVincular && <p className="vx-nota" data-mal>Todavía no se pueden vincular eventos en esta cuenta.</p>}
      <Toast state={toast} onClose={clear} />
    </div>
  );

  if (!montado) return null;
  return createPortal(
    <Modal titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconoMenu nombre="evento" size={18} /> Vincular evento</span>}
      encabezado={<span className="vx-donde-titulo">{crmNombre} › {etapaNombre}</span>}
      onCerrar={onCerrar} ancho={640} alto="min(80vh, 620px)" sinFiletes>
      {contenido}
    </Modal>,
    document.body,
  );
}
