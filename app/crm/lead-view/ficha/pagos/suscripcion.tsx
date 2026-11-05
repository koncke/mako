'use client';

// =============================================================================
// ficha/pagos/suscripcion — la tab Pagos de una venta de SUSCRIPCIÓN, mes a mes (5/11/2026)
// =============================================================================
// Martín: «la pestaña de pagos dentro de lo que sería una venta de suscripción es algo que quisiera cambiarlo
// completamente… es muy complejo lo que está hoy en día». La investigación y lo que se copió: docs/investigacion-
// suscripciones.md. Copiado de la página de una suscripción de CHARGEBEE (arriba el estado, cuánto paga, cuándo le toca y
// lo pagado; abajo un renglón por período con lo que tocaba, lo que entró y sus pagos, también varios y parciales;
// cambiar el monto desde una fecha, cortar y retomar), con las palabras de CHARTMOGUL para lo que se mueve (empezó, subió,
// bajó, se cortó, volvió). La cuenta es lib/suscripcion-meses.ts, la misma que leen el estado de cuenta, «A quién cobrar»,
// el MRR y la API de MaKo.
//
// ⚠️ Con este bloque en la hoja, el estado de cuenta, las cuotas y la venta se callan (`suscripcionAlLado`,
//    ../reglas-pagos.ts): todo eso está acá adentro.
// ⚠️ Lo que cambia el monto, corta o retoma es del ADMIN (como cancelarla, hoy); registrar un pago, de cualquiera. Una
//    suscripción que cobra la pasarela no se cambia desde acá.
// ⚠️ No se reescribe el pasado: cambiar el monto «desde» un mes deja los de antes como estaban, y el Deshacer borra sólo
//    lo que se acaba de agregar.
// =============================================================================

import { useRef, useState, useTransition, type CSSProperties } from 'react';
import { Button, Field, Input, Status, Toast, useToast } from '@/app/_ui';
import type { Tono as TonoUi } from '@/app/_ui/tokens';
import { fechaEnPalabras } from '@/lib/date-utils';
import { ROTULO_METODO, esMetodoPago, type MetodoPago } from '@/lib/pagos-campo';
import { usd } from '@/lib/pagos-vistazo';
import {
  mesDe, mesSugerido, nombreDelMes, ROTULO_CAMBIO, ROTULO_ESTADO_MES, sumarAlMes,
  type EstadoMes, type HistoriaSuscripcion, type MesSuscripcion, type PagoEnElMes,
} from '@/lib/suscripcion-meses';
import { marcarPagoAction } from '@/app/crm/actions';
import { guardarVentaAction } from '@/app/crm/[id]/pagos-campo-actions';
import { cambiarSuscripcionAction, deshacerCambioSuscripcionAction, registrarPagoSuscripcionAction } from '@/app/crm/[id]/suscripcion-actions';
import type { PropsBloque } from '../tipos';
import { useCobrado } from './bloques-cobro';
import { refrescarCobros, useMonedaDelNegocio } from './datos';
import {
  Aviso, Caja, CamposDeCuando, CamposDePlata, MONO, Tarjeta, VerComprobante, msg, nada, plataParaServer, useHoraDelNegocio, type Plata,
} from './piezas';

const TONO_MES: Readonly<Record<EstadoMes, TonoUi>> = {
  pagado: 'good', parcial: 'warn', vencido: 'bad', 'vence-hoy': 'warn', 'por-cobrar': 'neutral', proximo: 'neutral', cortado: 'neutral',
};
const num: CSSProperties = { fontVariantNumeric: 'tabular-nums' };
const kpi: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', minWidth: 0 };
const kpiRotulo: CSSProperties = { fontSize: 12, color: 'var(--dim)' };
const kpiValor: CSSProperties = { fontSize: 20, fontWeight: 700, color: 'var(--ink)', ...num, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const kpiPie: CSSProperties = { fontSize: 12.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

/** «4 y 5 de noviembre» · «Cripto» de los pagos de un mes, en una línea. */
function resumenDePagos(pagos: readonly PagoEnElMes[], hoy: string): string {
  if (!pagos.length) return '';
  const medios = [...new Set(pagos.map((p) => (esMetodoPago(p.metodo) ? ROTULO_METODO[p.metodo as MetodoPago].split(' (')[0] : p.proveedor ? 'Pasarela' : null)).filter(Boolean))];
  const cuantos = pagos.length === 1 ? '1 pago' : `${pagos.length} pagos`;
  const cuando = pagos.length === 1 && pagos[0].fecha ? ` el ${fechaEnPalabras(pagos[0].fecha, hoy)}` : '';
  return [cuantos + cuando, medios.join(', ')].filter(Boolean).join(' · ');
}

/** Los meses que se ofrecen para un cambio: de `atras` meses antes a `adelante` después de este, sin pasar del inicio. */
function mesesParaElegir(hoy: string, inicio: string | null, atras: number, adelante: number): string[] {
  const actual = mesDe(hoy);
  const desde = inicio ? mesDe(inicio) : null;
  const out: string[] = [];
  for (let i = -atras; i <= adelante; i++) {
    const m = sumarAlMes(actual, i);
    if (!desde || m >= desde) out.push(m);
  }
  return out;
}

/** Una fila de botones para elegir un mes. */
function ElegirMes({ meses, elegido, set, hoy, detalle }: { meses: readonly string[]; elegido: string; set: (m: string) => void; hoy: string; detalle?: (m: string) => string | null }) {
  return (
    <div role="radiogroup" aria-label="Mes" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {meses.map((m) => {
        const d = detalle?.(m);
        return (
          <Button key={m} size="sm" variant={m === elegido ? 'primary' : 'secondary'} onClick={() => set(m)} aria-pressed={m === elegido}>
            {nombreDelMes(m, hoy)}{d ? ` · ${d}` : ''}
          </Button>
        );
      })}
    </div>
  );
}

type Abierto = null | { que: 'pagar' } | { que: 'monto'; cargar?: boolean } | { que: 'cortar' } | { que: 'retomar' } | { que: 'comprobante'; pagoId: number };

export function SuscripcionMesAMes(props: PropsBloque) {
  const { ctx, titulo, editando, epico } = props;
  const { lead } = ctx;
  const { cobrado, leidos, sinLeer } = useCobrado(ctx);
  const moneda = useMonedaDelNegocio();
  const { toast, show, clear } = useToast();
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [todos, setTodos] = useState(false);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const adjuntar = useRef<HTMLInputElement | null>(null);
  const [adjuntarA, setAdjuntarA] = useState<number | null>(null);
  const s = cobrado.suscripcion;
  if (!s) return null;
  const h: HistoriaSuscripcion = s.historia;
  const susData = ctx.data.suscripcion;
  const faltaMigracion = !!susData?.faltaMigracion;
  const manual = s.fuente === 'manual';
  const admin = ctx.esAdmin;
  const inicio = lead.fecha_cierre ? String(lead.fecha_cierre).slice(0, 10) : null;
  const cambio = () => { refrescarCobros(lead.id); ctx.releer(); };

  const deshacerCambio = (ids: number[]) => start(async () => {
    const r = await deshacerCambioSuscripcionAction(lead.id, ids);
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    cambio();
  });
  const alCambiar = (r: { ok: true; ids: number[]; resumen: string; yaEstaba: boolean }) => {
    setAbierto(null);
    cambio();
    show(r.resumen, r.ids.length ? () => deshacerCambio(r.ids) : undefined);
  };

  const subirComprobante = async (pagoId: number, file: File): Promise<string | null> => {
    const fd = new FormData(); fd.append('file', file); fd.append('leadId', String(lead.id)); fd.append('pagoId', String(pagoId));
    const r = await fetch('/api/crm/comprobante-pago', { method: 'POST', body: fd }).catch(() => null);
    if (!r) return 'No pude subir el comprobante: revisa la conexión.';
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    return r.ok ? null : j.error ?? `No pude subir el comprobante (${r.status}).`;
  };

  // ── Lo de arriba: estado, cuánto paga hoy, cuándo le toca y lo pagado ──
  const estado = s.estado === 'cancelada'
    ? { tono: 'neutral' as TonoUi, txt: h.cortadaDesde ? `Cortada desde ${nombreDelMes(h.cortadaDesde, ctx.hoy)}` : 'Cancelada' }
    : s.estado === 'terminada' ? { tono: 'neutral' as TonoUi, txt: 'Terminó el plazo' }
    : s.renovacionFallida ? { tono: 'bad' as TonoUi, txt: 'Falló la renovación' }
    : h.mesesSinPagar + h.mesesParciales > 0 ? { tono: (h.proximo?.vencido ? 'bad' : 'warn') as TonoUi, txt: h.mesesSinPagar + h.mesesParciales === 1 ? 'Debe 1 mes' : `Debe ${h.mesesSinPagar + h.mesesParciales} meses` }
    : { tono: 'good' as TonoUi, txt: 'Al día' };
  const pagaHoy = s.mensualidadUsd;
  const proximo = h.proximo;

  // ── Los meses: del más nuevo al más viejo, con los cortados seguidos en un renglón ──
  type Renglon = { tipo: 'mes'; m: MesSuscripcion } | { tipo: 'corte'; desde: string; hasta: string };
  // (Sin `useMemo`: va después del `return null` de arriba, y un hook ahí rompe el orden de los hooks.)
  const renglones: Renglon[] = [];
  for (const m of [...h.meses].reverse()) {
    const ult = renglones.at(-1);
    if (m.estado === 'cortado' && !m.pagos.length && !m.ajustes.length) {
      if (ult?.tipo === 'corte') ult.desde = m.mes; else renglones.push({ tipo: 'corte', desde: m.mes, hasta: m.mes });
    } else renglones.push({ tipo: 'mes', m });
  }
  const visibles = todos ? renglones : renglones.slice(0, 6);
  const pagoPorId = (id: number | null) => (id == null ? null : ctx.data.pagos.find((p) => p.id === id) ?? null);

  const acciones = !editando && (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {manual && s.estado !== 'terminada' && <Button size="sm" variant="primary" onClick={() => setAbierto({ que: 'pagar' })}>Registrar un pago</Button>}
      {admin && manual && s.estado === 'activa' && <Button size="sm" variant="secondary" onClick={() => setAbierto({ que: 'monto' })}>Cambiar el monto</Button>}
      {admin && manual && s.estado === 'activa' && <Button size="sm" variant="tertiary" onClick={() => setAbierto({ que: 'cortar' })}>Cortar</Button>}
      {admin && manual && s.estado === 'cancelada' && <Button size="sm" variant="secondary" onClick={() => setAbierto({ que: 'retomar' })}>Retomar</Button>}
    </div>
  );

  return (
    <Tarjeta titulo={titulo} marca="monto" derecha={<Status tono={estado.tono}>{estado.txt}</Status>}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${epico ? 180 : 150}px, 1fr))`, gap: 10 }}>
        <div style={kpi}>
          <span style={kpiRotulo}>Paga hoy</span>
          <span style={{ ...kpiValor, fontSize: epico ? 30 : 20 }}>{pagaHoy != null && s.estado === 'activa' ? `${usd(pagaHoy)}/mes` : '—'}</span>
          <span style={kpiPie}>{s.mensualidadInferida ? 'Estimado: lo que pagó el último mes' : h.diaDeCobro && s.estado === 'activa' ? `Cobra el día ${h.diaDeCobro}` : s.estado === 'activa' ? 'Sin monto cargado' : ' '}</span>
        </div>
        <div style={kpi}>
          <span style={kpiRotulo}>{proximo?.vencido ? 'Venció' : 'Le toca'}</span>
          <span style={{ ...kpiValor, color: proximo?.vencido ? 'var(--bad)' : 'var(--ink)' }}>{proximo ? fechaEnPalabras(proximo.vence, ctx.hoy) : '—'}</span>
          <span style={kpiPie}>{proximo ? (proximo.faltaUsd != null ? `Falta ${usd(proximo.faltaUsd)} de ${nombreDelMes(proximo.mes, ctx.hoy)}` : nombreDelMes(proximo.mes, ctx.hoy)) : s.estado === 'activa' ? 'Nada pendiente' : ' '}</span>
        </div>
        <div style={kpi}>
          <span style={kpiRotulo}>Pagó en total</span>
          <span style={kpiValor}>{usd(h.totalPagadoUsd)}</span>
          <span style={kpiPie}>{h.mesesPagados === 1 ? '1 mes pagado' : `${h.mesesPagados} meses pagados`}{h.ajustesUsd > 0 ? ` · ${usd(h.ajustesUsd)} en ajustes` : ''}</span>
        </div>
        {h.deudaUsd > 0 && (
          <div style={kpi}>
            <span style={kpiRotulo}>Debe</span>
            <span style={{ ...kpiValor, color: 'var(--bad)' }}>{usd(h.deudaUsd)}</span>
            <span style={kpiPie}>{h.mesesParciales ? `${h.mesesParciales} con pago parcial` : 'Meses vencidos'}</span>
          </div>
        )}
      </div>

      {s.renovacionFallida && <Aviso tono="rojo">{s.renovacionFallida}</Aviso>}
      {sinLeer && <Aviso tono="ambar">No pude leer los cobros de la pasarela: no se sabe si la cobra ella.</Aviso>}
      {susData && !susData.leido && <Aviso tono="ambar">No pude leer los cambios de monto: los meses usan la mensualidad de hoy.</Aviso>}
      {s.mensualidadInferida && admin && !editando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13.5, color: 'var(--dim)' }}>
          La mensualidad no está cargada.
          <Button size="sm" variant="secondary" onClick={() => setAbierto({ que: 'monto', cargar: true })}>Cargarla</Button>
        </div>
      )}
      {!manual && <p style={nada}>La cobra la pasarela: cada mes entra solo.</p>}
      {leidos && acciones}

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 0 2px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Mes a mes</span>
          {s.meses ? <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{s.meses} meses de plazo{s.finPlazo ? ` · hasta ${fechaEnPalabras(s.finPlazo, ctx.hoy)}` : ''}</span> : null}
        </div>
        {!renglones.length && <p style={nada}>{s.sinCierre ? 'Sin fecha de inicio: carga la fecha de cierre de la venta.' : 'Todavía no hay meses.'}</p>}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {visibles.map((r) => {
            if (r.tipo === 'corte') {
              return (
                <li key={`c${r.desde}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', color: 'var(--dim)', fontSize: 13.5 }}>
                  <span>{r.desde === r.hasta ? nombreDelMes(r.desde, ctx.hoy) : `${nombreDelMes(r.desde, ctx.hoy)} – ${nombreDelMes(r.hasta, ctx.hoy)}`}</span>
                  <Status tono="neutral">Cortada</Status>
                </li>
              );
            }
            const m = r.m;
            const abiertoMes = abiertos.has(m.mes);
            const pct = m.esperadoUsd ? Math.min(100, Math.round((m.pagadoUsd / m.esperadoUsd) * 100)) : m.pagadoUsd > 0 ? 100 : 0;
            const tieneDetalle = m.pagos.length + m.ajustes.length + m.programado.length > 0;
            return (
              <li key={m.mes} style={{ borderBottom: '1px solid var(--border)' }}>
                <button type="button" onClick={() => tieneDetalle && setAbiertos((x) => { const n = new Set(x); if (n.has(m.mes)) n.delete(m.mes); else n.add(m.mes); return n; })}
                  aria-expanded={tieneDetalle ? abiertoMes : undefined}
                  style={{ all: 'unset', boxSizing: 'border-box', width: '100%', display: 'grid', gridTemplateColumns: 'minmax(96px, 1.1fr) minmax(0, 2fr) auto', alignItems: 'center', gap: 12, padding: '11px 0', cursor: tieneDetalle ? 'pointer' : 'default', textAlign: 'left' }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize' }}>{nombreDelMes(m.mes, ctx.hoy)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>vence {fechaEnPalabras(m.vence, ctx.hoy)}</span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', fontSize: 13.5, color: 'var(--dim)' }}>
                      <span style={{ ...num, color: 'var(--ink)', fontWeight: 600 }}>{usd(m.pagadoUsd)}</span>
                      {m.esperadoUsd != null && <span style={num}>de {usd(m.esperadoUsd)}</span>}
                      {m.cambio && <span style={{ fontSize: 12, color: m.cambio === 'bajo' || m.cambio === 'se-corto' ? 'var(--warn)' : 'var(--dim)' }}>{ROTULO_CAMBIO[m.cambio]}{m.antesUsd != null ? ` de ${usd(m.antesUsd)}` : ''}</span>}
                      {m.ajustes.length > 0 && <span style={{ fontSize: 12 }}>+ {usd(m.ajustes.reduce((t, a) => t + a.montoUsd, 0))} de ajuste</span>}
                    </span>
                    {m.estado !== 'cortado' && (
                      <span aria-hidden style={{ display: 'block', height: 3, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: m.estado === 'pagado' ? 'var(--good)' : m.estado === 'vencido' ? 'var(--bad)' : 'var(--warn)' }} />
                      </span>
                    )}
                    {m.pagos.length > 0 && <span style={{ fontSize: 12, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumenDePagos(m.pagos, ctx.hoy)}</span>}
                  </span>
                  <Status tono={TONO_MES[m.estado]}>{ROTULO_ESTADO_MES[m.estado]}</Status>
                </button>
                {abiertoMes && (
                  <ul style={{ listStyle: 'none', margin: '0 0 10px', padding: '8px 12px', borderRadius: 10, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[...m.pagos.map((p) => ({ p, ajuste: false })), ...m.ajustes.map((p) => ({ p, ajuste: true }))].map(({ p, ajuste }) => {
                      const fila = pagoPorId(p.id);
                      return (
                        <li key={`${ajuste ? 'a' : 'p'}${p.id}-${p.montoUsd}`} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
                          <span style={{ ...num, fontWeight: 600, color: 'var(--ink)' }}>{usd(p.montoUsd)}</span>
                          {p.totalUsd != null && <span style={{ color: 'var(--dim)' }}>(de un pago de {usd(p.totalUsd)})</span>}
                          <span style={{ color: 'var(--dim)' }}>{[p.fecha ? fechaEnPalabras(p.fecha, ctx.hoy) : null, esMetodoPago(p.metodo) ? ROTULO_METODO[p.metodo as MetodoPago] : p.proveedor ? 'Pasarela' : null, ajuste ? (p.concepto ?? 'Ajuste') : p.concepto].filter(Boolean).join(' · ')}</span>
                          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                            {p.comprobante && p.id != null && <Button size="sm" variant="tertiary" onClick={() => setAbierto({ que: 'comprobante', pagoId: p.id as number })}>Ver comprobante</Button>}
                            {!p.comprobante && p.id != null && fila && !editando && (
                              <Button size="sm" variant="tertiary" onClick={() => { setAdjuntarA(p.id); adjuntar.current?.click(); }}>Adjuntar comprobante</Button>
                            )}
                          </span>
                        </li>
                      );
                    })}
                    {m.programado.map((q) => (
                      <li key={`q${q.id}`} style={{ fontSize: 13, color: 'var(--dim)' }}>Cuota programada: {usd(q.montoUsd)}{q.vence ? ` el ${fechaEnPalabras(q.vence, ctx.hoy)}` : ''}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
        {renglones.length > visibles.length && <Button variant="tertiary" size="sm" onClick={() => setTodos(true)}>Ver los {h.meses.length} meses</Button>}
      </div>

      {admin && !editando && s.estado !== 'terminada' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="sm" variant="tertiary" onClick={() => start(async () => {
            const r = await guardarVentaAction(lead.id, { campo: 'tipo', valor: 'unico' }, { tipoVisto: 'suscripcion' });
            if (!r.ok) { show(r.error, undefined, 'bad'); return; }
            ctx.parchear({ venta_tipo: r.ventaTipo });
            show('Ahora es un pago único');
          })}>Pasar a pago único</Button>
        </div>
      )}

      <input ref={adjuntar} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => {
        const f = e.target.files?.[0]; const id = adjuntarA;
        if (adjuntar.current) adjuntar.current.value = '';
        if (!f || id == null) return;
        start(async () => { const err = await subirComprobante(id, f); if (err) show(err, undefined, 'bad'); else { show('Comprobante adjuntado'); cambio(); } });
      }} />

      {abierto?.que === 'pagar' && (
        <RegistrarPagoDelMes leadId={lead.id} historia={h} hoy={ctx.hoy} monedaNegocio={moneda ?? 'USD'} sugerido={pagaHoy}
          subirComprobante={subirComprobante} onCerrar={() => setAbierto(null)}
          onHecho={(texto, pagoId, aviso) => {
            setAbierto(null);
            cambio();
            show(aviso ?? `${texto} registrado`, () => start(async () => {
              try { await marcarPagoAction(pagoId, lead.id, false, null); cambio(); } catch (e) { show(msg(e), undefined, 'bad'); }
            }));
          }} />
      )}
      {abierto?.que === 'monto' && (
        <CambiarMonto leadId={lead.id} hoy={ctx.hoy} inicio={inicio} actual={pagaHoy} cargar={!!abierto.cargar} faltaMigracion={faltaMigracion}
          onCerrar={() => setAbierto(null)} onHecho={alCambiar} />
      )}
      {(abierto?.que === 'cortar' || abierto?.que === 'retomar') && (
        <CortarORetomar tipo={abierto.que === 'cortar' ? 'corte' : 'vuelta'} leadId={lead.id} hoy={ctx.hoy} inicio={inicio} faltaMigracion={faltaMigracion}
          onCerrar={() => setAbierto(null)} onHecho={alCambiar} />
      )}
      {abierto?.que === 'comprobante' && (() => {
        const q = pagoPorId(abierto.pagoId);
        return q ? <VerComprobante cuota={q} leadId={lead.id} onCerrar={() => setAbierto(null)} /> : null;
      })()}
      <Toast state={toast} onClose={clear} />
    </Tarjeta>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Registrar un pago: primero QUÉ paga (un mes o un ajuste), después cuánto, cuándo y cómo
// ─────────────────────────────────────────────────────────────────────────────

function RegistrarPagoDelMes({ leadId, historia, hoy, monedaNegocio, sugerido, subirComprobante, onCerrar, onHecho }: {
  leadId: number; historia: HistoriaSuscripcion; hoy: string; monedaNegocio: string; sugerido: number | null;
  subirComprobante: (pagoId: number, f: File) => Promise<string | null>;
  onCerrar: () => void; onHecho: (texto: string, pagoId: number, aviso?: string) => void;
}) {
  const abiertos = historia.meses.filter((m) => m.estado !== 'cortado');
  // Los que se pueden pagar: los que faltan completar y el que viene; del más viejo al más nuevo.
  const ofrecidos = abiertos.filter((m) => m.estado !== 'pagado').map((m) => m.mes);
  const [paso, setPaso] = useState<'que' | 'datos'>('que');
  const [mes, setMes] = useState<string>(mesSugerido(historia, hoy));
  const [ajuste, setAjuste] = useState(false);
  const elegido = abiertos.find((m) => m.mes === mes) ?? null;
  const falta = elegido?.faltaUsd ?? elegido?.esperadoUsd ?? sugerido;
  const [plata, setPlata] = useState<Plata>({ moneda: 'USD', monto: '', usd: '' });
  const [fecha, setFecha] = useState(hoy);
  const horaNegocio = useHoraDelNegocio();
  const [hora, setHora] = useState(horaNegocio);
  const [metodo, setMetodo] = useState<MetodoPago | ''>('');
  const [concepto, setConcepto] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const seguir = (comoAjuste: boolean) => {
    setAjuste(comoAjuste);
    setPlata({ moneda: 'USD', monto: !comoAjuste && falta ? String(falta) : '', usd: '' });
    setPaso('datos');
  };
  const guardar = () => {
    const p = plataParaServer(plata, null);
    if (!p.ok || p.monto == null) { setError(p.ok ? 'Falta el monto.' : p.error); return; }
    setError(null);
    start(async () => {
      try {
        const r = await registrarPagoSuscripcionAction(leadId, {
          monto: p.monto as number, fecha, hora: hora || null, moneda: p.moneda, montoOriginal: p.montoOriginal, metodo: metodo || null,
          concepto: concepto.trim() || null, mes: ajuste ? null : mes, ajuste,
        });
        if (!r.ok) { setError(r.error); return; }
        const avisos: string[] = [];
        if (!r.mesGuardado) avisos.push('el mes se calcula solo hasta que se aplique la migración 0398');
        if (archivo) { const e = await subirComprobante(r.pagoId, archivo); if (e) avisos.push(`el comprobante no subió (${e})`); }
        onHecho(r.texto, r.pagoId, avisos.length ? `${r.texto} registrado · ${avisos.join(' · ')}` : undefined);
      } catch (e) { setError(msg(e)); }
    });
  };
  return (
    <Caja titulo={paso === 'que' ? '¿Qué paga?' : ajuste ? 'Registrar un ajuste' : `Pago de ${nombreDelMes(mes, hoy)}`} onCerrar={onCerrar}
      pie={paso === 'datos' ? (
        <><Button variant="secondary" onClick={() => setPaso('que')} disabled={pending}>Volver</Button><Button variant="primary" onClick={guardar} loading={pending} disabled={!fecha}>Registrar</Button></>
      ) : <Button variant="secondary" onClick={onCerrar}>Cancelar</Button>}>
      {paso === 'que' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ElegirMes meses={ofrecidos.length ? ofrecidos : [mes]} elegido={mes} set={setMes} hoy={hoy}
            detalle={(m) => { const x = abiertos.find((y) => y.mes === m); return x?.faltaUsd != null && x.faltaUsd > 0 ? `falta ${usd(x.faltaUsd)}` : null; }} />
          <Button variant="primary" full onClick={() => seguir(false)}>Seguir con {nombreDelMes(mes, hoy)}</Button>
          <Button variant="secondary" full onClick={() => seguir(true)}>Es otro cobro (un ajuste o un diferencial)</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ajuste && <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)' }}>Suma a lo cobrado y no paga ningún mes.</p>}
          <CamposDePlata plata={plata} set={setPlata} monedaNegocio={monedaNegocio} usdPorDefecto={null} />
          <CamposDeCuando fecha={fecha} hora={hora} metodo={metodo} setFecha={setFecha} setHora={setHora} setMetodo={setMetodo} />
          <Field label="Concepto (opcional)"><Input value={concepto} maxLength={200} onChange={(e) => setConcepto(e.target.value)} placeholder={ajuste ? 'Diferencial, prorrateo…' : `Mensualidad de ${nombreDelMes(mes, hoy)}`} /></Field>
          <Field label="Comprobante (opcional)">
            <Input type="file" accept=".pdf,image/*" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </Field>
        </div>
      )}
      {error && <div style={{ marginTop: 12 }}><Aviso tono="rojo">{error}</Aviso></div>}
    </Caja>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cambiar el monto desde un mes (sube, baja), o cargarlo si no estaba
// ─────────────────────────────────────────────────────────────────────────────

type Hecho = { ok: true; ids: number[]; resumen: string; yaEstaba: boolean };

function CambiarMonto({ leadId, hoy, inicio, actual, cargar, faltaMigracion, onCerrar, onHecho }: {
  leadId: number; hoy: string; inicio: string | null; actual: number | null; cargar: boolean; faltaMigracion: boolean; onCerrar: () => void; onHecho: (r: Hecho) => void;
}) {
  const meses = cargar && inicio ? [mesDe(inicio)] : mesesParaElegir(hoy, inicio, 2, 3);
  const [mes, setMes] = useState(cargar && inicio ? mesDe(inicio) : sumarAlMes(mesDe(hoy), 1));
  const [monto, setMonto] = useState(actual != null ? String(actual) : '');
  const [dia, setDia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const guardar = () => {
    const m = Number(String(monto).replace(',', '.'));
    if (!(m > 0)) { setError('Falta la mensualidad, en dólares.'); return; }
    const d = dia.trim() ? Number(dia) : null;
    if (d != null && !(Number.isInteger(d) && d >= 1 && d <= 31)) { setError('El día de cobro va del 1 al 31.'); return; }
    setError(null);
    start(async () => {
      const r = await cambiarSuscripcionAction(leadId, { tipo: 'monto', desde: mes, montoUsd: m, dia: d });
      if (!r.ok) { setError(r.error); return; }
      onHecho(r);
    });
  };
  return (
    <Caja titulo={cargar ? 'Cargar la mensualidad' : 'Cambiar el monto'} onCerrar={onCerrar}
      pie={<><Button variant="secondary" onClick={onCerrar} disabled={pending}>Cancelar</Button><Button variant="primary" onClick={guardar} loading={pending}>Guardar</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {faltaMigracion && <Aviso tono="ambar">Todavía no se puede guardar: falta aplicar una actualización de la base.</Aviso>}
        {!cargar && (
          <Field label="Desde qué mes">
            <ElegirMes meses={meses} elegido={mes} set={setMes} hoy={hoy} />
          </Field>
        )}
        <Field label="Mensualidad (USD)" hint={cargar ? undefined : 'Los meses de antes quedan como estaban.'}>
          <Input type="number" inputMode="decimal" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </Field>
        <Field label="Día de cobro (opcional)" hint="Vacío, el de siempre.">
          <Input type="number" inputMode="numeric" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} placeholder="5" />
        </Field>
      </div>
      {error && <div style={{ marginTop: 12 }}><Aviso tono="rojo">{error}</Aviso></div>}
    </Caja>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cortar desde un mes, o retomar (con otro monto, si vuelve distinto)
// ─────────────────────────────────────────────────────────────────────────────

function CortarORetomar({ tipo, leadId, hoy, inicio, faltaMigracion, onCerrar, onHecho }: {
  tipo: 'corte' | 'vuelta'; leadId: number; hoy: string; inicio: string | null; faltaMigracion: boolean; onCerrar: () => void; onHecho: (r: Hecho) => void;
}) {
  const meses = mesesParaElegir(hoy, inicio, tipo === 'corte' ? 1 : 0, 3);
  const [mes, setMes] = useState(tipo === 'corte' ? sumarAlMes(mesDe(hoy), 1) : mesDe(hoy));
  const [monto, setMonto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const guardar = () => {
    const m = monto.trim() ? Number(monto.replace(',', '.')) : null;
    if (m != null && !(m > 0)) { setError('La mensualidad tiene que ser mayor a cero.'); return; }
    setError(null);
    start(async () => {
      const r = await cambiarSuscripcionAction(leadId, { tipo, desde: mes, montoUsd: m });
      if (!r.ok) { setError(r.error); return; }
      onHecho(r);
    });
  };
  return (
    <Caja titulo={tipo === 'corte' ? 'Cortar la suscripción' : 'Retomar la suscripción'} onCerrar={onCerrar}
      pie={<><Button variant="secondary" onClick={onCerrar} disabled={pending}>Cancelar</Button><Button variant={tipo === 'corte' ? 'danger' : 'primary'} onClick={guardar} loading={pending}>{tipo === 'corte' ? `Cortar desde ${nombreDelMes(mes, hoy)}` : `Retomar desde ${nombreDelMes(mes, hoy)}`}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {faltaMigracion && <Aviso tono="ambar">Todavía no se puede guardar: falta aplicar una actualización de la base.</Aviso>}
        <Field label={tipo === 'corte' ? 'Desde qué mes deja de pagar' : 'Desde qué mes vuelve'}>
          <ElegirMes meses={meses} elegido={mes} set={setMes} hoy={hoy} />
        </Field>
        {tipo === 'vuelta' && (
          <Field label="Mensualidad (opcional)" hint="Vacío, la de antes del corte.">
            <Input type="number" inputMode="decimal" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </Field>
        )}
        <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)' }}>{tipo === 'corte' ? 'Lo de antes sigue como está, y se puede retomar.' : 'Los meses del corte no se cobran.'}</p>
      </div>
      {error && <div style={{ marginTop: 12 }}><Aviso tono="rojo">{error}</Aviso></div>}
    </Caja>
  );
}
