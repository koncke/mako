'use client';

// =============================================================================
// ficha/pagos/bloques-seguimiento — tres bloques de Pagos que estaban en el catálogo sin componente (P28, 17/11/2026)
// =============================================================================
// `confirmacion-de-pago`, `recordatorios-de-cobro` y `excepciones` estaban en lib/ficha/catalogo.ts y en las plantillas,
// y la ficha los saltaba callada porque no tenían entrada en ../registro-pagos.tsx. Lo que dice cada uno sale de
// docs/diseno-ficha-bloques.md (la tabla de Pagos); lo que decide qué se dibuja es puro, en lib/pagos-bloques-lead.ts.
//
//   · Confirmación de pago: la fecha (se edita ahí, con el mismo campo que la R1 de Reuniones) y, sin el primer pago,
//     «Confirmó hace N días y no pagó» con «Cobrar con link» al lado.
//   · Recordatorios de cobro: qué cuota tiene un recordatorio corriendo y cuándo sale lo próximo, con «Cortarlo». Se
//     corta solo al marcar el pago (`marcarPago`). Sin ninguno corriendo, el bloque no se dibuja.
//   · Excepciones: lo que se eximió al mover la etapa, con su motivo, y «Quitar» (el dato se vuelve a pedir) con Deshacer.
// =============================================================================

import { useCallback, useEffect, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { Button, Toast, useToast } from '@/app/_ui';
import { Confirm } from '@/app/_ui/Confirm';
import { fechaEnPalabras } from '@/lib/date-utils';
import { nombreCuota } from '@/lib/pagos-campo';
import { usd } from '@/lib/pagos-vistazo';
import { VENTA_SIN_COBRO } from '@/lib/venta-tipo';
import {
  confirmacionDePago, deLaCuota, excepcionesDelLead, renglonDeRecordatorios, rotuloDeExcepcion,
  type ExcepcionDelLead, type IdExcepcion, type RecordatorioDeCuota,
} from '@/lib/pagos-bloques-lead';
import { CobrarConLink } from '@/app/crm/[id]/CobrarConLink';
import { cortarRecordatoriosCuotaAction } from '@/app/crm/[id]/pagos-campo-actions';
import { fechaCorta } from '@/app/crm/automatizacion-lead';
import { FechaEditable } from '../../CampoEditable';
import { useTzWorkspace } from '../../useTzWorkspace';
import type { PropsBloque } from '../tipos';
import { refrescarCobros, useCobrosDelLead } from './datos';
import { Aviso, MONO, Semaforo, Tarjeta, nada } from './piezas';
import { motivosDeExcepcionesAction, quitarExcepcionAction, recordatoriosDeCobroAction, volverExcepcionAction } from './seguimiento-actions';

const caja: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', minWidth: 0 };
const fila: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' };
const chips: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };

// ─────────────────────────────────────────────────────────────────────────────
// Confirmación de pago
// ─────────────────────────────────────────────────────────────────────────────

export function ConfirmacionDePago({ ctx, titulo, diseno, editando, epico }: PropsBloque) {
  const { lead } = ctx;
  const c = confirmacionDePago({
    fechaConfirmacion: lead.fecha_confirmacion ?? null, fechaPrimerPago: lead.fecha_primer_pago ?? null,
    sinCobro: lead.venta_tipo === VENTA_SIN_COBRO, hoy: ctx.hoy,
  });
  // «Cobrar con link» sólo cuando hay que cobrarle y hay pasarela: sin ella, el botón no tendría a dónde llevar.
  const { opciones } = useCobrosDelLead(lead.id);
  const cobrar = c.cobrar && !editando && opciones?.ok && opciones.pasarelas.length > 0 && (
    <CobrarConLink lead={{ id: lead.id, nombre: lead.nombre, email: lead.email, telefono: lead.telefono }}
      pasarelas={opciones.pasarelas} cuentas={opciones.cuentas} productos={opciones.productos} onCreado={() => refrescarCobros(lead.id)} />
  );
  const fecha = (
    <FechaEditable leadId={lead.id} campo="fecha_confirmacion" valor={c.fecha} titulo="Fecha en que confirmó el pago" vacio="—" bloqueado={editando}
      estilo={{ fontSize: epico ? 26 : 18, fontWeight: 700, color: c.fecha ? 'var(--ink)' : 'var(--faint)' }} />
  );
  // «Alerta sin pago»: lo que importa es la alerta; la fecha va chica, abajo.
  if (diseno === 'alerta') {
    return (
      <Tarjeta titulo={titulo} derecha={cobrar}>
        {c.linea && (c.tono === 'rojo' || c.tono === 'ambar') ? <Aviso tono={c.tono}>{c.linea}</Aviso> : c.linea ? <Semaforo tono={c.tono}>{c.linea}</Semaforo> : <p style={nada}>Sin fecha de confirmación</p>}
        <span style={{ fontSize: 13, color: 'var(--dim)', display: 'flex', gap: 6, alignItems: 'baseline' }}>Confirmó: {fecha}</span>
      </Tarjeta>
    );
  }
  return (
    <Tarjeta titulo={titulo} derecha={cobrar}>
      <div style={caja}>
        {fecha}
        {c.linea && <Semaforo tono={c.tono}>{c.linea}</Semaforo>}
      </div>
    </Tarjeta>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recordatorios de cobro
// ─────────────────────────────────────────────────────────────────────────────

type Lectura<T> = { leido: false } | { leido: true; ok: true; valor: T } | { leido: true; ok: false; error: string };

export function RecordatoriosDeCobro({ ctx, titulo, diseno, editando }: PropsBloque) {
  const { lead } = ctx;
  const tz = useTzWorkspace();
  const { toast, show, clear } = useToast();
  const [pending, start] = useTransition();
  const [cortar, setCortar] = useState<RecordatorioDeCuota | null>(null);
  // Las cuotas sin cobrar cambian al cobrar o al editar el plan: con ellas cambia lo que hay que leer.
  const firma = ctx.data.pagos.filter((q) => !q.pagado).map((q) => q.id).join(',');
  const [lectura, setLectura] = useState<Lectura<RecordatorioDeCuota[]> & { de?: string }>({ leido: false });
  const leer = useCallback(() => {
    recordatoriosDeCobroAction(lead.id)
      .then((r) => setLectura(r.ok ? { leido: true, ok: true, valor: r.recordatorios, de: firma } : { leido: true, ok: false, error: r.error, de: firma }))
      .catch(() => setLectura({ leido: true, ok: false, error: 'No pude leer los recordatorios.', de: firma }));
  }, [lead.id, firma]);
  useEffect(() => { leer(); }, [leer]);

  if (!lectura.leido) return null;
  if (!lectura.ok) return <Tarjeta titulo={titulo}><Aviso tono="ambar">No pude leer los recordatorios de cobro: {lectura.error}</Aviso></Tarjeta>;
  const rs = lectura.valor;
  // `sinDatos: 'se-calla'`: sin ninguno corriendo, no hay bloque (el armador esconde la celda vacía).
  if (!rs.length) return null;

  const ahora = Date.now();
  const cuando = (iso: string | null) => (iso ? fechaCorta(iso, tz, ahora) : 'en unos minutos');
  const hecho = () => {
    const r = cortar;
    if (!r) return;
    start(async () => {
      const res = await cortarRecordatoriosCuotaAction(lead.id, r.pagoId);
      setCortar(null);
      if (!res.ok) { show(res.error, undefined, 'bad'); return; }
      show(res.cortados ? `Se cortó el recordatorio ${deLaCuota(r.numero)}` : 'Ya no tenía un recordatorio corriendo');
      refrescarCobros(lead.id);
      leer();
    });
  };
  return (
    <VistaRecordatorios titulo={titulo} diseno={diseno} editando={editando} hoy={ctx.hoy} rs={rs} cuando={cuando} ocupado={pending} onCortar={setCortar}>
      {cortar && (
        <Confirm title={`¿Cortar el recordatorio ${deLaCuota(cortar.numero)}?`}
          message="MaKo deja de avisar de esta cuota en el grupo. No se puede deshacer: lo que ya salió no se vuelve a mandar."
          confirmLabel="Cortarlo" tone="danger" loading={pending} onConfirm={hecho} onCancel={() => setCortar(null)} />
      )}
      <Toast state={toast} onClose={clear} />
    </VistaRecordatorios>
  );
}

/**
 * Lo que se DIBUJA de los recordatorios, sin leer nada: separado de la lectura para que se pueda mirar con datos de ejemplo
 * (el artefacto de la verificación, «Probar = MIRAR») sin una base detrás.
 */
export function VistaRecordatorios({ titulo, diseno, editando, hoy, rs, cuando, ocupado, onCortar, children }: {
  titulo: string; diseno: string; editando: boolean; hoy: string; rs: readonly RecordatorioDeCuota[];
  cuando: (iso: string | null) => string; ocupado: boolean; onCortar: (r: RecordatorioDeCuota) => void; children?: ReactNode;
}) {
  const botonCortar = (r: RecordatorioDeCuota) => !editando && (
    <Button size="sm" variant="tertiary" disabled={ocupado} onClick={() => onCortar(r)}>Cortarlo</Button>
  );
  return (
    <Tarjeta titulo={titulo} derecha={diseno === 'renglon' && rs.length === 1 ? botonCortar(rs[0]) : undefined}>
      {diseno === 'renglon'
        ? <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>{renglonDeRecordatorios(rs, cuando)}</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rs.map((r) => (
              <div key={r.pagoId} style={fila}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                    {nombreCuota(r.numero)}{r.montoUsd != null ? ` · ${usd(r.montoUsd)}` : ''}{r.vence ? ` · vence el ${fechaEnPalabras(r.vence, hoy)}` : ''}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                    MaKo avisa en el grupo {cuando(r.proximaAt)}{r.corridas[0]?.titulo ? ` · ${r.corridas[0].titulo}` : ''}{r.corridas.length > 1 ? ` · +${r.corridas.length - 1}` : ''}
                  </span>
                </div>
                {botonCortar(r)}
              </div>
            ))}
          </div>
        )}
      <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>Se corta solo al marcar la cuota cobrada.</span>
      {children}
    </Tarjeta>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Excepciones
// ─────────────────────────────────────────────────────────────────────────────

export function Excepciones({ ctx, titulo, diseno, editando }: PropsBloque) {
  const { lead } = ctx;
  const { toast, show, clear } = useToast();
  const [pending, start] = useTransition();
  const [motivos, setMotivos] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let vivo = true;
    // Sin motivos leídos, las excepciones se ven igual (sin motivo): el motivo adorna, no decide.
    motivosDeExcepcionesAction(lead.id).then((r) => { if (vivo) setMotivos(r.ok ? r.motivos : {}); }).catch(() => { if (vivo) setMotivos({}); });
    return () => { vivo = false; };
  }, [lead.id]);
  const lista = excepcionesDelLead(lead, motivos ?? {});
  if (!lista.length) return null;

  const quitar = (x: ExcepcionDelLead) => start(async () => {
    const r = await quitarExcepcionAction(lead.id, x.id);
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    ctx.releer();
    if (!r.cambio) { show('Ya estaba quitada'); return; }
    const antes = r.antes;
    show(`Se quitó «${x.rotulo}»: el dato se vuelve a pedir`, () => volver(x.id, antes));
  });
  const volver = (id: IdExcepcion, antes: boolean | string) => start(async () => {
    const r = await volverExcepcionAction(lead.id, id, antes);
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    ctx.releer();
    show(`Volvió «${rotuloDeExcepcion(id)}»`);
  });
  return (
    <VistaExcepciones titulo={titulo} diseno={diseno} editando={editando} lista={lista} motivosLeidos={motivos != null} ocupado={pending} onQuitar={quitar}>
      <Toast state={toast} onClose={clear} />
    </VistaExcepciones>
  );
}

/** Lo que se DIBUJA de las excepciones, sin leer nada (como `VistaRecordatorios`: para mirarlo con datos de ejemplo). */
export function VistaExcepciones({ titulo, diseno, editando, lista, motivosLeidos, ocupado, onQuitar, children }: {
  titulo: string; diseno: string; editando: boolean; lista: readonly ExcepcionDelLead[]; motivosLeidos: boolean;
  ocupado: boolean; onQuitar: (x: ExcepcionDelLead) => void; children?: ReactNode;
}) {
  const boton = (x: ExcepcionDelLead) => !editando && (
    <Button size="sm" variant="tertiary" disabled={ocupado} onClick={() => onQuitar(x)} aria-label={`Quitar «${x.rotulo}»`}>Quitar</Button>
  );
  return (
    <Tarjeta titulo={titulo}>
      {diseno === 'lista'
        ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {lista.map((x) => (
              <div key={x.id} style={fila}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{x.rotulo}</span>
                  <span style={{ fontSize: 13, color: x.motivo ? 'var(--dim)' : 'var(--faint)' }}>{x.motivo ?? (motivosLeidos ? 'Sin motivo escrito' : '…')}</span>
                </div>
                {boton(x)}
              </div>
            ))}
          </div>
        )
        : (
          <div style={chips}>
            {lista.map((x) => (
              <span key={x.id} title={x.motivo ?? undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Semaforo tono="gris">{x.rotulo}</Semaforo>
                {!editando && (
                  <button type="button" className="fr-x" aria-label={`Quitar «${x.rotulo}»`} disabled={ocupado} onClick={() => onQuitar(x)}
                    style={{ border: 0, background: 'transparent', color: 'var(--dim)', cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      {!editando && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Quitar una hace que el dato se vuelva a pedir.</span>}
      {children}
    </Tarjeta>
  );
}
