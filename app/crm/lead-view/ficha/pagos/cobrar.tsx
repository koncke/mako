'use client';

// =============================================================================
// ficha/pagos/cobrar — lo que abre cada botón de cobro (el «qué hago ahora» y los de cada cuota)
// =============================================================================
// Un solo lugar decide qué abre «Cobrar la cuota 2», «Registrar el pago» o «Agregar la cuota», lo apriete el
// estado de cuenta o el renglón de la cuota: el mismo botón no puede hacer dos cosas según dónde esté.
//   · cobrar una cuota: si hay pasarela, se elige (ya pagó → marcarla; todavía no → mandarle el link de ESA
//     cuota); sin pasarela, directo a marcarla.
//   · registrar un pago / la mensualidad: el modal de pago a mano (con su moneda y su método).
//   · agregar la cuota que falta / cargar el monto: un modal de un paso.
// Después de escribir: `refrescarCobros` (los bloques que leen la pasarela) y `ctx.releer()` (la cabecera recuenta
// «N sin marcar» y los bloques leen las cuotas nuevas). Deshacer escribe en el server, con la misma acción.
// =============================================================================

import { useState, useTransition, type ReactNode } from 'react';
import { Button, Field, Input, Modal, Toast, useToast } from '@/app/_ui';
import type { Pago } from '@/lib/pagos';
import { nombreCuota } from '@/lib/pagos-campo';
import { usd, type AccionDeCobro } from '@/lib/pagos-vistazo';
import { marcarPagoAction } from '@/app/crm/actions';
import { marcarPagoManualAction } from '@/app/crm/[id]/deal-actions';
import { guardarVentaAction } from '@/app/crm/[id]/pagos-campo-actions';
import { agregarCuotaAction } from './cuotas-actions';
import { CobrarCuotaConLink } from '@/app/crm/[id]/CobrarConLink';
import type { CtxFicha } from '../tipos';
import { refrescarCobros, useCobrosDelLead, useMonedaDelNegocio } from './datos';
import { Aviso, ElegirComoCobrar, MarcarPagada, RegistrarPago, VerComprobante } from './piezas';

type Abierto =
  | { que: 'elegir'; cuota: Pago }
  | { que: 'marcar'; cuota: Pago }
  | { que: 'link'; cuota: Pago }
  | { que: 'comprobante'; cuota: Pago }
  | { que: 'registrar'; modo: 'pago' | 'mensualidad'; sugeridoUsd: number | null }
  | { que: 'agregar'; faltaUsd: number | null }
  | { que: 'monto' };

const unMesDespues = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m, Math.min(d, 28))).toISOString().slice(0, 10);
};

/** Los botones de cobro de la tab: qué abre cada uno y los modales, ya montados. */
export function useCobrar(ctx: CtxFicha) {
  const { lead, data } = ctx;
  const { opciones } = useCobrosDelLead(lead.id);
  const moneda = useMonedaDelNegocio();
  const [abierto, setAbierto] = useState<Abierto | null>(null);
  const { toast, show, clear } = useToast();
  const [, start] = useTransition();
  const pasarelas = opciones?.ok ? opciones.pasarelas : [];
  const cuotaPorId = (id: number) => data.pagos.find((p) => p.id === id) ?? null;

  const cambio = () => { refrescarCobros(lead.id); ctx.releer(); };
  const cerrar = () => setAbierto(null);

  /** Abre lo que corresponde a la acción del estado de cuenta. */
  const abrir = (a: AccionDeCobro) => {
    if (a.tipo === 'cobrar-cuota') { const q = cuotaPorId(a.pagoId); if (q) cobrarCuota(q); return; }
    if (a.tipo === 'registrar-pago') setAbierto({ que: 'registrar', modo: 'pago', sugeridoUsd: null });
    if (a.tipo === 'registrar-mes') setAbierto({ que: 'registrar', modo: 'mensualidad', sugeridoUsd: lead.suscripcion_monto_usd ?? null });
    if (a.tipo === 'agregar-cuota') setAbierto({ que: 'agregar', faltaUsd: a.faltaUsd });
    if (a.tipo === 'cargar-venta') setAbierto({ que: 'monto' });
  };
  const cobrarCuota = (q: Pago) => setAbierto(pasarelas.length ? { que: 'elegir', cuota: q } : { que: 'marcar', cuota: q });

  const deshacerMarca = (q: Pago) => start(async () => {
    try { await marcarPagoAction(q.id, lead.id, false, null); cambio(); }
    catch (e) { show(e instanceof Error ? e.message : String(e), undefined, 'bad'); }
  });
  /** Desmarcar una cuota cobrada a mano, con Deshacer que la vuelve a marcar con su fecha y hora. */
  const desmarcar = (q: Pago) => start(async () => {
    try {
      await marcarPagoAction(q.id, lead.id, false, null);
      cambio();
      show(`${nombreCuota(q.numero)} desmarcada`, () => start(async () => {
        // Con lo que tenía: la moneda, lo cobrado en ella, el concepto y el método (lo que no viene, el server lo limpia).
        await marcarPagoManualAction(q.id, lead.id, {
          monto: Number(q.monto_usd), fecha: q.fecha_pago ?? new Date().toISOString().slice(0, 10), hora: q.pago_hora ?? null,
          moneda: q.moneda ?? null, montoOriginal: q.monto_original ?? null, concepto: q.concepto ?? null, metodo: q.metodo ?? null,
        }).catch(() => {});
        cambio();
      }));
    } catch (e) { show(e instanceof Error ? e.message : String(e), undefined, 'bad'); }
  });

  const leadCobro = { id: lead.id, nombre: lead.nombre, email: lead.email, telefono: lead.telefono };
  let modal: ReactNode = null;
  if (abierto?.que === 'elegir') {
    const q = abierto.cuota;
    modal = <ElegirComoCobrar nombre={nombreCuota(q.numero)} montoUsd={Number(q.monto_usd)} conLink={pasarelas.length > 0} onCerrar={cerrar}
      onMarcar={() => setAbierto({ que: 'marcar', cuota: q })} onLink={() => setAbierto({ que: 'link', cuota: q })} />;
  } else if (abierto?.que === 'marcar') {
    const q = abierto.cuota;
    modal = <MarcarPagada cuota={q} leadId={lead.id} monedaNegocio={moneda} onCerrar={cerrar}
      onHecho={(m, deshacer) => { cerrar(); cambio(); show(m, deshacer ? () => deshacerMarca(q) : undefined); }} />;
  } else if (abierto?.que === 'link') {
    const q = abierto.cuota;
    modal = <CobrarCuotaConLink lead={leadCobro} pasarelas={pasarelas} cuota={{ pagoId: q.id, nombre: nombreCuota(q.numero), montoUsd: Number(q.monto_usd) }}
      onCreado={() => refrescarCobros(lead.id)} onCerrar={cerrar} />;
  } else if (abierto?.que === 'comprobante') {
    modal = <VerComprobante cuota={abierto.cuota} leadId={lead.id} onCerrar={cerrar} />;
  } else if (abierto?.que === 'registrar') {
    modal = <RegistrarPago leadId={lead.id} monedaNegocio={moneda} modo={abierto.modo} sugeridoUsd={abierto.sugeridoUsd} onCerrar={cerrar}
      onHecho={(m) => { cerrar(); cambio(); show(m); }} />;
  } else if (abierto?.que === 'agregar') {
    modal = <AgregarCuota ctx={ctx} faltaUsd={abierto.faltaUsd} onCerrar={cerrar} onHecho={(m) => { cerrar(); cambio(); show(m); }} />;
  } else if (abierto?.que === 'monto') {
    modal = <CargarMonto ctx={ctx} onCerrar={cerrar} onHecho={(m) => { cerrar(); show(m); }} />;
  }

  return {
    abrir,
    cobrarCuota,
    marcar: (q: Pago) => setAbierto({ que: 'marcar', cuota: q }),
    mandarLink: (q: Pago) => setAbierto({ que: 'link', cuota: q }),
    verComprobante: (q: Pago) => setAbierto({ que: 'comprobante', cuota: q }),
    registrarPago: () => setAbierto({ que: 'registrar', modo: 'pago', sugeridoUsd: null }),
    registrarMes: () => setAbierto({ que: 'registrar', modo: 'mensualidad', sugeridoUsd: lead.suscripcion_monto_usd ?? null }),
    agregarCuota: () => setAbierto({ que: 'agregar', faltaUsd: null }),
    desmarcar,
    hayPasarela: pasarelas.length > 0,
    modales: <>{modal}<Toast state={toast} onClose={clear} /></>,
  };
}

function Caja({ titulo, onCerrar, pie, children }: { titulo: string; onCerrar: () => void; pie: ReactNode; children: ReactNode }) {
  return <div onClick={(e) => e.stopPropagation()}><Modal titulo={titulo} onCerrar={onCerrar} pie={pie} ancho={440} anidada>{children}</Modal></div>;
}

/**
 * Una cuota FUTURA más, al final del plan: «Agregar la cuota» (lo que falta para llegar a la venta) o «+ Agregar
 * una cuota». Va SOLA (`agregarCuotaAction`): mandar todas las impagas con lo que tenía la pantalla le volvía a
 * escribir su valor viejo a una que otra pestaña había cambiado (revisión del 16/10/2026).
 */
function AgregarCuota({ ctx, faltaUsd, onCerrar, onHecho }: { ctx: CtxFicha; faltaUsd: number | null; onCerrar: () => void; onHecho: (m: string) => void }) {
  const ultima = [...ctx.data.pagos].map((q) => q.fecha_esperada).filter((f): f is string => !!f).sort().pop() ?? ctx.hoy;
  const [monto, setMonto] = useState(faltaUsd ? String(faltaUsd) : '');
  const [fecha, setFecha] = useState(unMesDespues(ultima < ctx.hoy ? ctx.hoy : ultima));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const guardar = () => {
    const m = Number(String(monto).replace(',', '.'));
    if (!Number.isFinite(m) || m <= 0) { setError('El monto tiene que ser mayor a cero.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { setError('Falta la fecha.'); return; }
    start(async () => {
      const r = await agregarCuotaAction(ctx.lead.id, { monto: m, fecha });
      if (!r.ok) { setError(r.error); return; }
      onHecho(`Cuota de ${usd(m)} agregada`);
    });
  };
  return (
    <Caja titulo="Agregar una cuota" onCerrar={onCerrar}
      pie={<><Button variant="secondary" onClick={onCerrar} disabled={pending}>Cancelar</Button><Button variant="primary" onClick={guardar} loading={pending}>Agregar</Button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <Field label="Monto (USD)"><Input type="number" inputMode="decimal" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus /></Field>
        <Field label="Vence el"><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
      </div>
      {error && <div style={{ marginTop: 12 }}><Aviso tono="rojo">{error}</Aviso></div>}
    </Caja>
  );
}

/** «Cargar el monto» de un ganado sin monto (la página de gracias gana sin monto): el de la venta, con su acción. */
function CargarMonto({ ctx, onCerrar, onHecho }: { ctx: CtxFicha; onCerrar: () => void; onHecho: (m: string) => void }) {
  const [monto, setMonto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const guardar = () => {
    const m = Number(String(monto).replace(',', '.'));
    if (!Number.isFinite(m) || m <= 0) { setError('El monto tiene que ser mayor a cero.'); return; }
    start(async () => {
      const r = await guardarVentaAction(ctx.lead.id, { campo: 'monto', valor: m }, { tipoVisto: ctx.lead.venta_tipo ?? null });
      if (!r.ok) { setError(r.error); return; }
      ctx.parchear(ctx.lead.venta_tipo === 'suscripcion' ? { suscripcion_monto_usd: m } : { monto_cierre_usd: m });
      onHecho(`Venta de ${usd(m)} cargada`);
    });
  };
  return (
    <Caja titulo="Cargar el monto de la venta" onCerrar={onCerrar}
      pie={<><Button variant="secondary" onClick={onCerrar} disabled={pending}>Cancelar</Button><Button variant="primary" onClick={guardar} loading={pending}>Guardar</Button></>}>
      <Field label={ctx.lead.venta_tipo === 'suscripcion' ? 'Mensualidad (USD)' : 'Monto (USD)'}>
        <Input type="number" inputMode="decimal" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
      </Field>
      {error && <div style={{ marginTop: 12 }}><Aviso tono="rojo">{error}</Aviso></div>}
    </Caja>
  );
}
