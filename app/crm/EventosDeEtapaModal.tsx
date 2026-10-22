'use client';

// =============================================================================
// EventosDeEtapaModal — «Asignar evento»: qué evento de Calendly o Cal.com cae en ESTA etapa de reunión
// =============================================================================
// Feedback de Martín del 16/10/2026 (punto 3 del CRM): «Falta la misma opción para las etapas de reunión "Asignar
// evento" con el logo de Meet, y que ahí se puedan seleccionar de la misma manera (en diseño) que la lista de
// campañas, la lista de eventos de Calendly o Cal o Calendar... Y que tenga la opción ahí mismo de crear un nuevo
// evento para asignarse a esa etapa». Se abre desde el «⋯» de la columna (app/crm/CrmBoard.tsx), como «Asignar
// campañas» desde «Lead entrante», y tiene el diseño de la tabla de campañas (app/crm/CampanasModal.tsx).
//
// El MOTOR ya estaba (mig 0293, lib/agenda-evento-etapa*.ts, app/crm/agenda-evento-actions.ts): un evento va a UNA
// sola etapa, y quien se agenda en él cae en esa etapa de ese funnel. Acá sólo hay pantalla:
//   · Marcar un evento lo vincula a esta etapa; desmarcarlo lo desvincula.
//   · Uno que ya está en OTRA etapa dice dónde, y «Traer aquí» lo desvincula de allá y lo vincula acá.
//   · ~~«Crear un evento» abre la página de Calendly o Cal.com en otra pestaña~~ Desde el 21/10/2026 se CREA y se EDITA
//     acá (Martín: «me gustaría que se pueda editar o crear eventos desde allí también»): el nombre y la duración, por
//     sus APIs (Calendly abrió `POST`/`PATCH /event_types` el 17/06/2025; Cal.com, `/v2/event-types`). Lo creado se
//     asigna a esta etapa en el mismo gesto. La disponibilidad y la ubicación siguen siendo las de la cuenta.
//   · Sin Calendly ni Cal.com conectados, se conectan AHÍ MISMO (21/10: «si no se conectó un calendly o cal se debería
//     poder hacer desde allí mismo»): el modal de /integraciones se abre arriba de éste (`BotonIntegracion`).
//   · Google Calendar NO está, y se dice abajo (17/10/2026): su API no lista las páginas de reserva («appointment
//     schedules») ni marca de cuál viene una reserva (llega como un evento común, `eventType: default`; developers.google.com,
//     «Event types»). Vincular una a una etapa pediría adivinar por el título y leer el calendario con un cron: no se hace
//     hasta que Google lo exponga (docs/hallazgos-crm.md, «Las tabs como HOJAS…» §6).
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Spinner, Toast, useToast, Button, SANS, MONO } from '@/app/_ui';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import {
  listarEventosAgendaAction, vincularEventoEtapaAction, desvincularEventoEtapaAction, crearEventoAgendaAction, editarEventoAgendaAction,
  type AgendaDelNegocio, type EventoDeAgenda,
} from './agenda-evento-actions';
import { DURACIONES_EVENTO, MAX_NOMBRE_EVENTO, type ProveedorAgenda } from '@/lib/agenda-evento-etapa';

const TH: CSSProperties = {
  fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
  color: 'var(--faint)', fontWeight: 600, whiteSpace: 'nowrap',
};
const CASILLA: CSSProperties = { width: 16, height: 16, margin: 0, cursor: 'pointer', accentColor: 'var(--primary)' };
const COLUMNAS = '28px minmax(0, 1fr) 110px 80px minmax(0, 170px) 30px';
const NOMBRE_PROVEEDOR: Record<EventoDeAgenda['proveedor'], string> = { calendly: 'Calendly', calcom: 'Cal.com' };
/** El servicio de /integraciones de cada agenda (lib/integraciones-catalogo.ts), para conectarla sin salir. */
const SERVICIO_INTEGRACION: Record<ProveedorAgenda, string> = { calendly: 'calendly', calcom: 'calcom' };
const CAMPO: CSSProperties = {
  height: 34, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, minWidth: 0,
};
type Borrador = { nombre: string; duracionMin: number; proveedor: ProveedorAgenda };
const clave = (e: EventoDeAgenda) => `${e.proveedor}:${e.identificador}`;

export function EventosDeEtapaModal({ funnelId, etapa, etapaNombre, onCerrar }: {
  funnelId: number;
  etapa: string;
  etapaNombre: string;
  onCerrar: () => void;
}) {
  const [montado, setMontado] = useState(false);
  const [agenda, setAgenda] = useState<AgendaDelNegocio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const { toast, show, clear } = useToast();
  useEffect(() => { setMontado(true); }, []);
  /** «Crear evento»: el renglón de arriba de la lista. */
  const [creando, setCreando] = useState<Borrador | null>(null);
  /** El evento que se está editando (por `clave`), con lo escrito. */
  const [editando, setEditando] = useState<{ k: string; nombre: string; duracionMin: number } | null>(null);

  const leer = useCallback(() => {
    setError(null);
    void listarEventosAgendaAction()
      .then((r) => { if (r.ok) setAgenda(r); else setError(r.error); })
      .catch(() => setError('No pude leer los eventos de tu agenda. Intenta de nuevo.'));
  }, []);
  useEffect(() => { leer(); }, [leer]);

  const enEsta = (e: EventoDeAgenda) => !!e.vinculo && e.vinculo.funnelId === funnelId && e.vinculo.etapa === etapa;

  const cambiar = async (e: EventoDeAgenda, accion: 'vincular' | 'desvincular' | 'traer') => {
    setOcupado(clave(e));
    try {
      if (accion !== 'vincular') {
        const d = await desvincularEventoEtapaAction({ proveedor: e.proveedor, identificador: e.identificador });
        if (!d.ok) { show(d.error, undefined, 'bad'); return; }
      }
      if (accion !== 'desvincular') {
        const v = await vincularEventoEtapaAction({ proveedor: e.proveedor, identificador: e.identificador, funnelId, etapa });
        if (!v.ok) { show(v.error, undefined, 'bad'); return; }
      }
      show(accion === 'desvincular' ? 'Evento quitado' : `Cae en «${etapaNombre}»`);
      leer();
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
      show(r.vinculado ? `Creado y asignado a «${etapaNombre}»` : (r.avisoVinculo ?? 'Creado'), undefined, r.vinculado ? undefined : 'bad');
      leer();
    } catch {
      show('No se pudo crear', undefined, 'bad');
    } finally {
      setOcupado(null);
    }
  };
  const guardarEdicion = async (e: EventoDeAgenda) => {
    if (!editando) return;
    setOcupado(clave(e));
    try {
      const r = await editarEventoAgendaAction({ proveedor: e.proveedor, identificador: e.identificador, nombre: editando.nombre, duracionMin: editando.duracionMin });
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      setEditando(null);
      show('Evento guardado');
      leer();
    } catch {
      show('No se pudo guardar', undefined, 'bad');
    } finally {
      setOcupado(null);
    }
  };
  /** Las duraciones de la lista, con la del evento si es otra (un evento de 20 min no se ofrece como 15). */
  const duraciones = (actual: number | null) => (actual != null && !DURACIONES_EVENTO.includes(actual) ? [...DURACIONES_EVENTO, actual].sort((a, b) => a - b) : DURACIONES_EVENTO);

  const conectados = agenda?.proveedores.filter((p) => p.conectado) ?? [];
  // Crear sólo donde hay con qué escribir (el token de Calendly o la API key de Cal.com). Lo cargado como R1/R2 sin
  // token cuenta como conectado para la lista, pero no alcanza para crear: lo dice el error de la API.
  const sinConectar = (['calendly', 'calcom'] as const).filter((p) => !conectados.some((c) => c.proveedor === p));
  const fila = (e: EventoDeAgenda) => {
    const enEstaEtapa = enEsta(e);
    const enOtra = !!e.vinculo && !enEstaEtapa;
    const k = clave(e);
    if (editando?.k === k) {
      return (
        <form key={k} role="row" onSubmit={(ev) => { ev.preventDefault(); void guardarEdicion(e); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '9px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <input autoFocus value={editando.nombre} maxLength={MAX_NOMBRE_EVENTO} aria-label="Nombre del evento"
            onChange={(ev) => setEditando({ ...editando, nombre: ev.target.value })} style={{ ...CAMPO, flex: '1 1 200px' }} />
          <select value={editando.duracionMin} aria-label="Duración" onChange={(ev) => setEditando({ ...editando, duracionMin: Number(ev.target.value) })} style={CAMPO}>
            {duraciones(e.duracionMin).map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
          <Button size="sm" type="submit" loading={ocupado === k} disabled={ocupado != null || !editando.nombre.trim()}>Guardar</Button>
          <Button size="sm" variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
        </form>
      );
    }
    return (
      <div key={k} role="row" style={{ display: 'grid', gridTemplateColumns: COLUMNAS, alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
        <span role="cell">
          <input type="checkbox" style={CASILLA} checked={enEstaEtapa} disabled={enOtra || ocupado != null || agenda?.sePuedeVincular === false}
            aria-label={enEstaEtapa ? `Quitar ${e.nombre} de ${etapaNombre}` : `Asignar ${e.nombre} a ${etapaNombre}`}
            onChange={() => { void cambiar(e, enEstaEtapa ? 'desvincular' : 'vincular'); }} />
        </span>
        <span role="cell" style={{ minWidth: 0, fontSize: 13.5, fontWeight: 600, color: e.enLaCuenta ? 'var(--ink)' : 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={e.enLaCuenta ? e.nombre : `${e.nombre} · ya no está en tu cuenta`}>
          {e.nombre}{e.credencial && <span style={{ marginLeft: 6, fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{e.credencial}</span>}
        </span>
        <span role="cell" style={{ fontSize: 12.5, color: 'var(--dim)' }}>{NOMBRE_PROVEEDOR[e.proveedor]}</span>
        <span role="cell" style={{ fontSize: 12.5, color: 'var(--dim)' }}>{e.duracionMin != null ? `${e.duracionMin} min` : '—'}</span>
        <span role="cell" style={{ minWidth: 0, fontSize: 12.5, color: enEstaEtapa ? 'var(--primary)' : 'var(--dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {ocupado === k ? <Spinner size={13} />
            : enEstaEtapa ? 'Esta etapa'
              : enOtra ? (
                <>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${e.vinculo!.funnel} › ${e.vinculo!.etapaNombre}`}>{e.vinculo!.etapaNombre}</span>
                  <button type="button" disabled={ocupado != null} onClick={() => { void cambiar(e, 'traer'); }}
                    style={{ flex: 'none', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}>
                    Traer aquí
                  </button>
                </>
              ) : '—'}
        </span>
        <span role="cell">
          {/* EDITAR (21/10/2026): el nombre y la duración, en el lugar. Lo que ya no está en la cuenta no se edita. */}
          {e.enLaCuenta && (
            <button type="button" disabled={ocupado != null} aria-label={`Editar ${e.nombre}`} title="Editar"
              onClick={() => setEditando({ k, nombre: e.nombre, duracionMin: e.duracionMin ?? 30 })}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: 'none', borderRadius: 7, background: 'transparent', color: 'var(--dim)', cursor: 'pointer', padding: 0 }}>
              <IconoMenu nombre="editar" size={15} />
            </button>
          )}
        </span>
      </div>
    );
  };

  const contenido = (
    <div style={{ fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 13.5, color: 'var(--dim)', flex: '1 1 260px' }}>
          Quien se agende en el evento que marques cae en «{etapaNombre}».
        </span>
        {conectados.length > 0 && !creando && (
          <Button size="sm" icon={<IconoMenu nombre="agregar" size={15} />} disabled={ocupado != null || agenda?.sePuedeVincular === false}
            onClick={() => setCreando({ nombre: '', duracionMin: 30, proveedor: conectados[0].proveedor })}>
            Crear evento
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={leer}>Actualizar</Button>
      </div>

      {/* CONECTAR SIN SALIR DE LA TAB (21/10/2026): la agenda que falta, con el modal de /integraciones acá arriba. */}
      {agenda && sinConectar.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 13, color: 'var(--dim)' }}>
          {sinConectar.map((p) => (
            <BotonIntegracion key={p} servicio={SERVICIO_INTEGRACION[p]} onConectado={() => leer()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 99, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontWeight: 600, fontSize: 13 }}>
              <IconoMenu nombre="link" size={14} /> Conectar {NOMBRE_PROVEEDOR[p]}
            </BotonIntegracion>
          ))}
        </div>
      )}

      {/* CREAR (21/10/2026): el nombre, la duración y en qué agenda; nace asignado a esta etapa. */}
      {creando && (
        <form onSubmit={(ev) => { ev.preventDefault(); void crear(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: 12, marginBottom: 12, borderRadius: 12, background: 'var(--surface-2)' }}>
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
          <Button size="sm" type="submit" loading={ocupado === 'crear'} disabled={ocupado != null || !creando.nombre.trim()}>Crear y asignar</Button>
          <Button size="sm" variant="secondary" onClick={() => setCreando(null)}>Cancelar</Button>
        </form>
      )}

      <div role="table" aria-label={`Eventos de agenda para ${etapaNombre}`} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: COLUMNAS, alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--surface-2)' }}>
          <span />
          <span style={TH}>Evento</span>
          <span style={TH}>Agenda</span>
          <span style={TH}>Duración</span>
          <span style={TH}>Etapa</span>
          <span />
        </div>
        {agenda?.eventos.map(fila)}
        {!agenda && !error && <div style={{ padding: '34px 0', display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border)' }}><Spinner size={18} /></div>}
        {!agenda && error && <p style={vacio('var(--bad)')}>{error}</p>}
        {agenda && agenda.eventos.length === 0 && (
          conectados.length === 0
            ? <p style={vacio()}>Conecta Calendly o Cal.com para ver tus eventos.</p>
            : <p style={vacio()}>Tu agenda no tiene eventos. Toca «Crear evento».</p>
        )}
      </div>
      {agenda?.proveedores.filter((p) => p.conectado && p.error).map((p) => (
        <p key={p.proveedor} style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--warn)' }}>{NOMBRE_PROVEEDOR[p.proveedor]}: {p.error}</p>
      ))}
      {/* GOOGLE CALENDAR (Martín, 21/10/2026: «puedo tener eventos en Calendly, Cal o Google Calendar»): su API no lista
          las páginas de reserva ni dice de cuál viene una reserva (docs/hallazgos-crm.md). Se dice en una línea, con su
          estado, y la decisión de cómo sumarlo quedó planteada a Martín. */}
      <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--faint)' }}>
        {agenda?.google.conectado ? 'Google Calendar está conectado, pero' : 'Google Calendar:'} Google no comparte sus páginas de reserva, así que no se pueden asignar.
      </p>
      {agenda && !agenda.sePuedeVincular && (
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--warn)' }}>Todavía no se pueden asignar eventos en esta cuenta.</p>
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );

  if (!montado) return null;
  return createPortal(
    <Modal titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconoMenu nombre="evento" size={18} /> Asignar evento</span>}
      encabezado={<span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{etapaNombre}</span>}
      onCerrar={onCerrar} ancho={820} alto="min(80vh, 640px)" sinFiletes>
      {contenido}
    </Modal>,
    document.body,
  );
}

const vacio = (color = 'var(--dim)'): CSSProperties => ({
  fontFamily: SANS, fontSize: 13.5, color, padding: '28px 12px', margin: 0, textAlign: 'center', borderTop: '1px solid var(--border)',
});
