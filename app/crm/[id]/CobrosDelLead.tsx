'use client';

// =============================================================================
// CobrosDelLead — los links de pago del lead (Stripe y Mercado Pago), en la tab Pagos
// =============================================================================
// Una fila por cobro: qué, cuánto (en la moneda REAL del cobro, `formatoMonto`), el estado, la fecha y
// si fue de prueba. Las acciones dependen del estado:
//   · pendiente o rechazado → «Copiar link» y anular (el tacho de la casa: el link deja de existir).
//   · pagado → «Devolver» (SÓLO un admin), y si es una suscripción activa, «Cancelar suscripción».
//
// ⚠️ DEVOLVER Y CANCELAR MUEVEN PLATA REAL Y NO SE DESHACEN: van con una confirmación que lo dice, y
// sólo se dibujan para un admin del negocio (el server lo vuelve a chequear: el botón escondido no es
// el permiso, es la cortesía). Un cobro de PRUEBA lo dice en la confirmación: ahí no hay plata real.
//
// ⚠️ La confirmación se registra en la pila de modales (`useCapaModal`, anidada): sin eso, el Escape lo
// agarraba primero la ficha en modal (app/crm/LeadSheet.tsx escucha en `window`, fase de captura) y
// cerraba la ficha entera en vez de la pregunta.
//
// La lista se lee por una action (`cobrosDelLeadAction`) porque esta tarjeta se monta en tres puertas
// y en dos el lead es estado de cliente: la trae y la relee `DealDetailsCard`.

import { useState, useTransition } from 'react';
import { Button, Confirm, Status, useOkFlash } from '@/app/_ui';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import type { Tono } from '@/app/_ui/tokens';
import { useCapaModal } from '@/app/_components/pila-modales';
import { NOMBRE_PASARELA, rotuloEstado, type CobroVisible, type EstadoCobro } from '@/lib/cobros-tipos';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { useTzWorkspace } from '../lead-view/useTzWorkspace';
import { anularCobroAction, cancelarSuscripcionAction, reembolsarCobroAction } from './cobros-actions';

const SANS = "'Geist', sans-serif";

const TONO_ESTADO: Readonly<Record<EstadoCobro, Tono>> = {
  pendiente: 'info',
  pagado: 'good',
  fallido: 'bad',
  reembolsado: 'warn',
  anulado: 'neutral',
};

function fecha(iso: string | null, tz: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz }).format(d);
}

type Pregunta = { tipo: 'devolver' | 'cancelar'; c: CobroVisible };

export function CobrosDelLead({ cobros, error, esAdmin, onCambio }: {
  /** null = todavía se está leyendo. */
  cobros: CobroVisible[] | null;
  /** true = no se pudo leer (no es «no hay»). */
  error: boolean;
  esAdmin: boolean;
  /** Algo cambió: la tarjeta relee la lista y la ficha. */
  onCambio: () => void;
}) {
  const tz = useTzWorkspace();
  const [pending, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);
  const [motivo, setMotivo] = useState('');
  const [corriendo, setCorriendo] = useState(false);

  if (error) return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>No pude leer los links de pago. Recarga para intentar de nuevo.</p>;
  if (!cobros) return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Leyendo los links de pago…</p>;
  if (!cobros.length && !aviso) return null;

  const anular = (c: CobroVisible) => {
    setAviso(null);
    startTransition(async () => {
      const r = await anularCobroAction(c.id).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      setAviso(r.ok ? { ok: true, msg: 'Link anulado.' } : { ok: false, msg: r.error ?? 'No pude anular el link.' });
      onCambio();
    });
  };

  const confirmar = async () => {
    if (!pregunta) return;
    setCorriendo(true);
    const { tipo, c } = pregunta;
    const r = await (tipo === 'devolver' ? reembolsarCobroAction(c.id, motivo.trim() || null) : cancelarSuscripcionAction(c.id))
      .catch((e: unknown) => ({ ok: false, resumen: e instanceof Error ? e.message : String(e) }));
    setCorriendo(false);
    setPregunta(null);
    setMotivo('');
    setAviso({ ok: r.ok, msg: r.resumen });
    onCambio();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {aviso && (
        <div role="status" style={{ borderRadius: 11, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, background: aviso.ok ? 'var(--good-bg)' : 'var(--bad-bg)', color: aviso.ok ? 'var(--good)' : 'var(--bad)' }}>{aviso.msg}</div>
      )}
      {cobros.map((c) => (
        <FilaCobro key={c.id} c={c} tz={tz} esAdmin={esAdmin} ocupado={pending || corriendo}
          onAnular={() => anular(c)}
          onDevolver={() => { setAviso(null); setMotivo(''); setPregunta({ tipo: 'devolver', c }); }}
          onCancelar={() => { setAviso(null); setPregunta({ tipo: 'cancelar', c }); }} />
      ))}
      {pregunta && (
        <PreguntaPlata pregunta={pregunta} motivo={motivo} setMotivo={setMotivo} corriendo={corriendo}
          onConfirmar={() => void confirmar()} onCancelar={() => { if (!corriendo) { setPregunta(null); setMotivo(''); } }} />
      )}
    </div>
  );
}

function FilaCobro({ c, tz, esAdmin, ocupado, onAnular, onDevolver, onCancelar }: {
  c: CobroVisible; tz: string; esAdmin: boolean; ocupado: boolean;
  onAnular: () => void; onDevolver: () => void; onCancelar: () => void;
}) {
  const { ok: copiado, flash } = useOkFlash();
  const [noCopio, setNoCopio] = useState(false);
  const pasarela = NOMBRE_PASARELA[c.proveedor] ?? c.proveedor;
  const mensual = c.tipo === 'suscripcion';
  const cancelada = c.suscripcion_estado === 'cancelada';
  const cuando = c.estado === 'pagado' ? `pagado el ${fecha(c.pagado_at, tz)}`
    : c.estado === 'reembolsado' ? `devuelto el ${fecha(c.reembolsado_at, tz)}`
      : `creado el ${fecha(c.created_at, tz)}`;
  const copiar = async () => {
    if (!c.link) return;
    try { await navigator.clipboard.writeText(c.link); setNoCopio(false); flash(); } catch { setNoCopio(true); }
  };
  const borde = c.estado === 'pagado' ? '#BFE6CD' : c.estado === 'fallido' ? 'var(--bad)' : 'var(--border-strong)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', border: `1px solid ${borde}`, borderRadius: 11, padding: '11px 14px', background: c.estado === 'pagado' ? 'var(--good-bg)' : 'var(--surface-2)', fontFamily: SANS }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: '1 1 260px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 14, overflowWrap: 'anywhere' }}>{c.concepto}</span>
          <span style={{ color: 'var(--dim)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{formatoMonto(c.monto, c.moneda)}{mensual ? ' al mes' : ''}</span>
          <Status tono={TONO_ESTADO[c.estado] ?? 'neutral'}>{rotuloEstado(c.estado)}</Status>
          {mensual && cancelada && <Status tono="neutral">Suscripción cancelada</Status>}
          {c.modo === 'prueba' && <Status tono="warn">Prueba</Status>}
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{pasarela} · {cuando}</span>
        {c.motivo && <span style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.45 }}>{c.motivo}</span>}
        {noCopio && c.link && <span style={{ fontSize: 12.5, color: 'var(--dim)', overflowWrap: 'anywhere' }}>Cópialo a mano: {c.link}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {c.link && (
          <>
            <Button variant="secondary" size="sm" ok={copiado} okLabel="Copiado" onClick={() => void copiar()}>Copiar link</Button>
            <BotonBorrar talla="sm" title="Anular este link" disabled={ocupado} onClick={onAnular} />
          </>
        )}
        {esAdmin && c.estado === 'pagado' && mensual && c.suscripcion_estado === 'activa' && (
          <Button variant="tertiary" size="sm" disabled={ocupado} onClick={onCancelar}>Cancelar suscripción</Button>
        )}
        {esAdmin && c.estado === 'pagado' && (
          <Button variant="danger" size="sm" disabled={ocupado} onClick={onDevolver}>Devolver</Button>
        )}
      </div>
    </div>
  );
}

/** La confirmación de lo que mueve plata. Registrada en la pila (ver el encabezado). */
function PreguntaPlata({ pregunta, motivo, setMotivo, corriendo, onConfirmar, onCancelar }: {
  pregunta: Pregunta; motivo: string; setMotivo: (v: string) => void; corriendo: boolean;
  onConfirmar: () => void; onCancelar: () => void;
}) {
  useCapaModal(true, { anidada: true });
  const { tipo, c } = pregunta;
  const pasarela = NOMBRE_PASARELA[c.proveedor] ?? c.proveedor;
  const prueba = c.modo === 'prueba';
  const plata = formatoMonto(c.monto, c.moneda);
  const advertencia = prueba
    ? <>Es un cobro de prueba: no mueve plata real.</>
    : <b style={{ color: 'var(--bad)' }}>Mueve plata real y no se puede deshacer.</b>;

  if (tipo === 'cancelar') {
    return (
      <Confirm
        title="¿Cancelar la suscripción?"
        message={<>«{c.concepto}» deja de cobrarse en {pasarela} desde hoy. {advertencia} Para volver a cobrarle hay que mandarle un link nuevo.</>}
        confirmLabel="Cancelar la suscripción"
        cancelLabel="Volver"
        loading={corriendo}
        onConfirm={onConfirmar}
        onCancel={onCancelar}
      />
    );
  }
  return (
    <Confirm
      title="¿Devolver este pago?"
      message={(
        <>
          Vas a devolver <b style={{ color: 'var(--ink)' }}>{plata}</b> de «{c.concepto}» por {pasarela}, completo. {advertencia}
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={280} placeholder="Motivo (opcional)" aria-label="Motivo de la devolución"
            className="lead-field" style={{ display: 'block', width: '100%', marginTop: 12 }} />
        </>
      )}
      confirmLabel="Devolver el pago"
      cancelLabel="Volver"
      loading={corriendo}
      onConfirm={onConfirmar}
      onCancel={onCancelar}
    />
  );
}
