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
//   · «Crear un evento» abre la página de Calendly o Cal.com en otra pestaña (sus APIs no crean tipos de evento
//     desde acá); al volver, «Actualizar» lo trae a la lista.
//   · Google Calendar NO está: el motor sólo conoce Calendly y Cal.com (lib/agenda-evento-etapa.ts, ProveedorAgenda).
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Spinner, Toast, useToast, Button, SANS, MONO } from '@/app/_ui';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { LogoMeet } from '@/app/_components/ServicioVisual';
import {
  listarEventosAgendaAction, vincularEventoEtapaAction, desvincularEventoEtapaAction,
  type AgendaDelNegocio, type EventoDeAgenda,
} from './agenda-evento-actions';

const TH: CSSProperties = {
  fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
  color: 'var(--faint)', fontWeight: 600, whiteSpace: 'nowrap',
};
const CASILLA: CSSProperties = { width: 16, height: 16, margin: 0, cursor: 'pointer', accentColor: 'var(--primary)' };
const COLUMNAS = '28px minmax(0, 1fr) 110px 80px minmax(0, 170px)';
const NOMBRE_PROVEEDOR: Record<EventoDeAgenda['proveedor'], string> = { calendly: 'Calendly', calcom: 'Cal.com' };
/** Dónde se crea un tipo de evento en cada proveedor (se abre en otra pestaña). */
const CREAR_EN: Record<EventoDeAgenda['proveedor'], string> = {
  calendly: 'https://calendly.com/event_types/user/me',
  calcom: 'https://app.cal.com/event-types?dialog=new-eventtype',
};
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

  const conectados = agenda?.proveedores.filter((p) => p.conectado) ?? [];
  const fila = (e: EventoDeAgenda) => {
    const enEstaEtapa = enEsta(e);
    const enOtra = !!e.vinculo && !enEstaEtapa;
    const k = clave(e);
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
      </div>
    );
  };

  const contenido = (
    <div style={{ fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 13.5, color: 'var(--dim)', flex: '1 1 260px' }}>
          Quien se agende en el evento que marques cae en «{etapaNombre}».
        </span>
        {(conectados.length ? conectados.map((p) => p.proveedor) : (['calendly'] as const)).map((p) => (
          <a key={p} href={CREAR_EN[p]} target="_blank" rel="noreferrer"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Crear un evento en {NOMBRE_PROVEEDOR[p]} ↗
          </a>
        ))}
        <Button size="sm" variant="secondary" onClick={leer}>Actualizar</Button>
      </div>

      <div role="table" aria-label={`Eventos de agenda para ${etapaNombre}`} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: COLUMNAS, alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--surface-2)' }}>
          <span />
          <span style={TH}>Evento</span>
          <span style={TH}>Agenda</span>
          <span style={TH}>Duración</span>
          <span style={TH}>Etapa</span>
        </div>
        {agenda?.eventos.map(fila)}
        {!agenda && !error && <div style={{ padding: '34px 0', display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border)' }}><Spinner size={18} /></div>}
        {!agenda && error && <p style={vacio('var(--bad)')}>{error}</p>}
        {agenda && agenda.eventos.length === 0 && (
          conectados.length === 0
            ? <p style={vacio()}><BotonIntegracion servicio="calendly" style={{ color: 'var(--primary)', fontWeight: 600 }}>Conecta Calendly</BotonIntegracion> o Cal.com para ver tus eventos.</p>
            : <p style={vacio()}>Tu agenda no tiene eventos. Crea uno y toca «Actualizar».</p>
        )}
      </div>
      {agenda?.proveedores.filter((p) => p.conectado && p.error).map((p) => (
        <p key={p.proveedor} style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--warn)' }}>{NOMBRE_PROVEEDOR[p.proveedor]}: {p.error}</p>
      ))}
      {agenda && !agenda.sePuedeVincular && (
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--warn)' }}>Todavía no se pueden asignar eventos en esta cuenta.</p>
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );

  if (!montado) return null;
  return createPortal(
    <Modal titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><LogoMeet size={18} /> Asignar evento</span>}
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
