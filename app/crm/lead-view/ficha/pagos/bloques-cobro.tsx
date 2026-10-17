'use client';

// =============================================================================
// ficha/pagos/bloques-cobro — los bloques de PLATA de la tab Pagos
// =============================================================================
// Pedido de Martín (16/10/2026): «que se entienda de un vistazo: qué debe este lead, qué pagó, qué hago ahora (un
// botón claro por acción)». Cada bloque contesta UNA de esas preguntas y lleva el botón de lo suyo:
//   · `cobrado` (Estado de cuenta): qué debe y qué pagó, y LA acción que toca (`estadoDeCuenta`, lib/pagos-vistazo.ts).
//   · `cuotas`: el plan cuota por cuota, cada una con su botón (marcar pagada, mandar el link, deshacer).
//   · `links-de-pago`: cobrar con link y los links con su estado (anular; devolver y cancelar, sólo el admin).
//   · `movimientos`: lo que ya pasó con la plata, y los avisos (contracargo, devolución que falló).
//   · `suscripcion`: la mensualidad, su estado y su plazo.
//   · `venta`: cuánto, cuándo y de qué tipo, campo por campo (la escritura de b2; reemplaza a «Editar deal»).
// Lo que se relevó de la tarjeta de antes y por qué cambió: docs/hallazgos-pagos.md §1.
// =============================================================================

import { useEffect, useState, useTransition, type CSSProperties } from 'react';
import { Button, Confirm, Toast, useToast } from '@/app/_ui';
import { cobradoDelLead, esCuotaDeBaja, esCuotaDevuelta, noEsDeuda, type CuotaParaCobrado } from '@/lib/cobrado-lead';
import { estadoDeCuenta, movimientosDelLead, renglonDeCuota, usd } from '@/lib/pagos-vistazo';
import { ajustarSobre, type PlanUniforme } from '@/lib/pagos-campo';
import { planEnLead } from '@/lib/muestra-pagos';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { marcaDato } from '@/lib/datos-aviso';
import type { VentaTipo } from '@/lib/venta-tipo';
import type { Pago } from '@/lib/pagos';
import { ajustarPlanAction, cambiarEstadoSuscripcionAction, cortarRecordatoriosCuotaAction, editarCuotaAction, guardarCuotasAction, guardarVentaAction } from '@/app/crm/[id]/pagos-campo-actions';
import { bajaDelClienteAction, proteccionesDeCuotasAction, quitarCuotaAction } from './cuotas-actions';
import type { Proteccion } from '@/lib/pagos-campo';
import { cancelarSuscripcionAction } from '@/app/crm/[id]/cobros-actions';
import { quitarSinCobroAction } from '@/app/crm/[id]/deal-actions';
import { CobrarConLink } from '@/app/crm/[id]/CobrarConLink';
import { CobrosDelLead } from '@/app/crm/[id]/CobrosDelLead';
import type { CtxFicha, PropsBloque } from '../tipos';
import { refrescarCobros, useCobrosDelLead } from './datos';
import { useCobrar } from './cobrar';
import { EnLinea } from './EnLinea';
import { Aviso, MONO, Semaforo, Tarjeta, TONO_UI, nada } from './piezas';

const ganado = (ctx: CtxFicha) => ctx.lead.estado_lead === 'ganado';
const canceladaAt = (ctx: CtxFicha): string | null => ((ctx.lead as unknown as Record<string, unknown>).suscripcion_cancelada_at as string | null | undefined) ?? null;
const error = (r: { ok: boolean; error?: string }): string | null => (r.ok ? null : r.error ?? 'No pude guardar.');

/** Lo cobrado del lead, con la MISMA cuenta que la API de MaKo (`cobradoDelLead`). */
function useCobrado(ctx: CtxFicha) {
  const { cobros, error: sinLeer } = useCobrosDelLead(ctx.lead.id);
  const { lead, data } = ctx;
  const cobrado = cobradoDelLead({
    ventaTipo: lead.venta_tipo ?? null, montoCierreUsd: lead.monto_cierre_usd ?? null, suscripcionMontoUsd: lead.suscripcion_monto_usd ?? null,
    suscripcionMeses: lead.suscripcion_meses ?? null, fechaCierre: lead.fecha_cierre ?? null, suscripcionCanceladaAt: canceladaAt(ctx),
    pagos: data.pagos as CuotaParaCobrado[], cobros: cobros ?? [], hoy: ctx.hoy,
  });
  // ⚠️ SIN LOS COBROS LEÍDOS NO SE SABE QUIÉN COBRA LA SUSCRIPCIÓN (revisión del 16/10/2026): con `cobros ?? []` la
  // fuente salía «manual», y una suscripción que cobra la pasarela ofrecía «Registrar el mes cobrado» (duplicaba lo
  // cobrado) y pintaba «Al día» una renovación que había fallado.
  return { cobrado, cobros, leidos: cobros !== null && !sinLeer, sinLeer };
}

/**
 * El Deshacer de un cambio de la venta, paso por paso y con el compare-and-set del tipo: si otra pantalla cambió el
 * tipo en los segundos del aviso, no se escribe una mensualidad vieja como monto de un pago único (revisión del
 * 16/10/2026). Cada paso sabe el tipo que dejó el anterior.
 */
async function deshacerVenta(leadId: number, pasos: Parameters<typeof guardarVentaAction>[1][], tipo: VentaTipo) {
  let visto: VentaTipo = tipo;
  for (const d of pasos) {
    const r = await guardarVentaAction(leadId, d, { tipoVisto: visto });
    if (!r.ok) return;
    visto = r.ventaTipo;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado de cuenta (`cobrado`)
// ─────────────────────────────────────────────────────────────────────────────

const COLOR: Record<'verde' | 'ambar' | 'rojo' | 'gris', string> = { verde: 'var(--good)', ambar: 'var(--warn)', rojo: 'var(--bad)', gris: 'var(--ink)' };

export function EstadoDeCuenta(props: PropsBloque) {
  const { ctx, diseno, titulo } = props;
  const { cobrado, leidos } = useCobrado(ctx);
  const cobrar = useCobrar(ctx);
  const leido = estadoDeCuenta({ cobrado, pagos: ctx.data.pagos, ganado: ganado(ctx), hoy: ctx.hoy });
  const e = leido && !leidos && leido.accion?.tipo === 'registrar-mes' ? { ...leido, accion: null } : leido;
  if (!e) return null;
  // La vista épica (el criterio de General): la prende la TAB y llega en PropsBloque (../tipos.ts).
  const { epico } = props;
  const boton = e.accion && (
    <Button variant={e.tono === 'rojo' ? 'primary' : 'secondary'} size={epico ? 'lg' : 'md'} disabled={props.editando} onClick={() => e.accion && cobrar.abrir(e.accion)}>{e.accion.boton}</Button>
  );

  if (diseno === 'chip') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <Semaforo tono={e.tono}>{e.titular}</Semaforo>
        {e.detalle && <span style={{ fontSize: 13, color: 'var(--dim)' }}>{e.detalle}</span>}
        {cobrar.modales}
      </div>
    );
  }

  return (
    <Tarjeta titulo={titulo}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: epico ? 'clamp(40px, 7vw, 72px)' : 30, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-.02em', color: COLOR[e.tono], fontVariantNumeric: 'tabular-nums' }}>{e.titular}</div>
          {e.detalle && <div style={{ marginTop: 6, fontSize: epico ? 16 : 14, color: 'var(--dim)' }}>{e.detalle}</div>}
        </div>
        {boton}
      </div>
      {!epico && e.barra && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {e.barra.pct != null && (
            <div aria-hidden style={{ height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ width: `${e.barra.pct}%`, height: '100%', background: 'var(--good)' }} />
            </div>
          )}
          <span style={{ fontSize: 13, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>
            {e.barra.texto}{e.faltaUsd > 0 ? ` · falta ${usd(e.faltaUsd)}` : ''}{e.monedas.length ? ` · ${e.monedas.join(' · ')}` : ''}
          </span>
        </div>
      )}
      {cobrar.modales}
    </Tarjeta>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cuotas
// ─────────────────────────────────────────────────────────────────────────────

const renglon: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '11px 14px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface-2)' };
const BORDE: Record<string, string> = { cobrada: 'var(--good)', vencida: 'var(--bad)', 'por-vencer': 'var(--warn-fill)' };

export function Cuotas(props: PropsBloque) {
  const { ctx, diseno, titulo, editando } = props;
  const { lead, data } = ctx;
  const cobrar = useCobrar(ctx);
  const { toast, show, clear } = useToast();
  const [, start] = useTransition();
  const [armando, setArmando] = useState(false);
  const pagos = [...data.pagos].sort((a, b) => a.numero - b.numero);
  const vivas = pagos.filter((q) => !noEsDeuda(q));
  const devueltas = pagos.filter((q) => esCuotaDevuelta(q));
  // Las de un cliente que se dio de baja (#871): se ven, sin botón, y no son deuda.
  const deBaja = pagos.filter((q) => esCuotaDeBaja(q));
  const conPlan = planEnLead(lead);
  // Lo que protege a cada impaga (un link sin pagar, un recordatorio corriendo): el server no deja editarla, y el
  // renglón lo dice antes y ofrece cortar el recordatorio. Se relee cuando cambian las cuotas.
  const [protegidas, setProtegidas] = useState<Record<number, Proteccion[]>>({});
  const firma = vivas.filter((q) => !q.pagado).map((q) => `${q.id}:${q.monto_usd}:${q.fecha_esperada}`).join('|');
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    let vivo = true;
    if (!firma) { setProtegidas({}); return; }
    proteccionesDeCuotasAction(lead.id).then((p) => { if (vivo) setProtegidas(p); }).catch(() => {});
    return () => { vivo = false; };
  }, [lead.id, firma, vuelta]);
  const cortar = (q: Pago) => start(async () => {
    const r = await cortarRecordatoriosCuotaAction(lead.id, q.id);
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    setVuelta((v) => v + 1);
    ctx.releer();
    show(r.cortados ? 'Recordatorio cortado' : 'No había recordatorio');
  });

  const editar = (q: Pago, cambio: { monto?: number; fecha?: string | null }) =>
    editarCuotaAction(lead.id, q.id, cambio).then((r) => {
      if (!r.ok) return r.error;
      ctx.releer();
      show('Cuota cambiada', () => start(async () => { await editarCuotaAction(lead.id, q.id, { monto: r.antes.monto, fecha: r.antes.fecha }); ctx.releer(); }));
      return null;
    });
  // ⚠️ QUITAR VA SOLA Y CON CONFIRMACIÓN, SIN DESHACER (revisión del 16/10/2026). Sola: mandar la lista entera le
  // reescribía su valor viejo a una cuota que otra pestaña había cambiado. Sin Deshacer: volver a insertarla le daba
  // otro id y otro número (el inicial volvía como «Cuota N», y su recordatorio se volvía a mandar), así que no era
  // la misma cuota. Lo que tiene un link sin pagar o un recordatorio corriendo no se quita: el server lo dice.
  const [aQuitar, setAQuitar] = useState<Pago | null>(null);
  const quitar = (q: Pago) => start(async () => {
    const r = await quitarCuotaAction(lead.id, q.id);
    setAQuitar(null);
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    ctx.releer();
    show(r.quitada ? 'Cuota quitada' : `No se quitó: ${r.motivo ?? 'cambió en otra pantalla'}`);
  });
  const becado = lead.venta_tipo === 'sin_cobro';

  // «Baja del cliente» (#871): lo que no pagó deja de ser deuda y lo cobrado queda. Con confirmación, y se deshace.
  // Una suscripción no: se cancela en su bloque.
  const impagasVivas = vivas.filter((q) => !q.pagado);
  const puedeDarDeBaja = !becado && lead.venta_tipo !== 'suscripcion' && impagasVivas.length > 0;
  const [preguntarBaja, setPreguntarBaja] = useState(false);
  const [enBaja, setEnBaja] = useState(false);
  const baja = (deshacer: boolean) => start(async () => {
    setEnBaja(true);
    const r = await bajaDelClienteAction(lead.id, deshacer);
    setEnBaja(false);
    setPreguntarBaja(false);
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    refrescarCobros(lead.id);
    ctx.releer();
    show(deshacer ? 'Baja deshecha' : 'Cliente dado de baja', deshacer ? undefined : () => baja(true));
  });

  // «Sólo la próxima»: la vencida más vieja o la que vence primero, y cuántas más hay.
  const proxima = vivas.filter((q) => !q.pagado && q.fecha_esperada).sort((a, b) => String(a.fecha_esperada).localeCompare(String(b.fecha_esperada)))[0] ?? null;
  const lista = diseno === 'proxima' ? (proxima ? [proxima] : []) : [...vivas, ...deBaja, ...devueltas];

  return (
    <Tarjeta titulo={titulo} marca={marcaDato('plan')}
      derecha={!editando && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!becado && <Button variant="secondary" size="sm" onClick={cobrar.registrarPago}>Registrar un pago</Button>}
        </div>
      )}>
      {lista.length === 0 && !armando && (
        <p style={nada}>{vivas.length ? 'No queda nada por cobrar.' : 'Sin cuotas. Arma el plan o registra lo que pagó.'}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-recorrido={marcaDato('comprobante')}>
        {lista.map((q) => {
          const r = renglonDeCuota(q, ctx.hoy);
          const prot = protegidas[q.id] ?? [];
          // Con un recordatorio corriendo no se edita nada; con un link vivo, el monto no (el link cobra ese monto).
          const montoEditable = r.editable && !prot.includes('link') && !prot.includes('recordatorio');
          const fechaEditable = r.editable && !prot.includes('recordatorio');
          return (
            <div key={q.id} style={{ ...renglon, borderColor: BORDE[r.estado] ?? 'var(--border)', opacity: r.estado === 'devuelta' || r.estado === 'baja' ? 0.7 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{r.nombre}</span>
                <span style={{ fontSize: 14, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', minWidth: 70 }}>
                  {montoEditable && !editando
                    ? <EnLinea valor={String(Number(q.monto_usd))} tipo="numero" prefijo="$" titulo={`Edita el monto de ${r.nombre.toLowerCase()}`}
                      onGuardar={(v) => editar(q, { monto: Number(v) })} />
                    : r.montoTexto}
                </span>
                <span style={{ fontSize: 13, color: TONO_UI[r.tono] === 'bad' ? 'var(--bad)' : TONO_UI[r.tono] === 'warn' ? 'var(--warn)' : 'var(--dim)' }}>
                  {fechaEditable && !editando
                    ? <EnLinea valor={q.fecha_esperada ?? ''} tipo="fecha" vacio="sin fecha" titulo={`Edita el vencimiento de ${r.nombre.toLowerCase()}`}
                      estilo={{ fontSize: 13, color: 'inherit' }} onGuardar={(v) => editar(q, { fecha: v || null })} />
                    : r.cuando}
                </span>
                {fechaEditable && r.estado !== 'futura' && r.estado !== 'sin-fecha' && <span style={{ fontSize: 12.5, color: r.estado === 'vencida' ? 'var(--bad)' : 'var(--warn)' }}>{r.cuando.split(' · ')[1]}</span>}
                {prot.includes('link') && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>Link enviado</span>}
                {prot.includes('recordatorio') && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)' }}>Recordatorio en curso</span>}
              </div>
              {!editando && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {r.accion === 'marcar' && <Button variant={r.estado === 'vencida' ? 'primary' : 'secondary'} size="sm" onClick={() => cobrar.marcar(q)}>Marcar pagada</Button>}
                  {r.accion === 'marcar' && cobrar.hayPasarela && !becado && <Button variant="tertiary" size="sm" onClick={() => cobrar.mandarLink(q)}>Mandar link</Button>}
                  {r.accion === 'marcar' && prot.includes('recordatorio') && <Button variant="tertiary" size="sm" onClick={() => cortar(q)}>Cortar el recordatorio</Button>}
                  {r.accion === 'marcar' && <Button variant="tertiary" size="sm" onClick={() => setAQuitar(q)}>Quitar</Button>}
                  {q.pagado && q.comprobante_path && <Button variant="tertiary" size="sm" onClick={() => cobrar.verComprobante(q)}>Ver comprobante</Button>}
                  {r.accion === 'deshacer' && <Button variant="tertiary" size="sm" onClick={() => cobrar.desmarcar(q)}>Deshacer</Button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {diseno === 'proxima' && vivas.filter((q) => !q.pagado).length > 1 && <p style={nada}>Y {vivas.filter((q) => !q.pagado).length - 1} cuota(s) más.</p>}
      {deBaja.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>
            Se dio de baja{deBaja[0].baja_at ? ` el ${fmtDDMMYYYY(deBaja[0].baja_at.slice(0, 10))}` : ''} · quedó sin cobrar {usd(deBaja.reduce((s, q) => s + Number(q.monto_usd), 0))}
          </span>
          {!editando && <Button variant="tertiary" size="sm" loading={enBaja} onClick={() => baja(true)}>Deshacer la baja</Button>}
        </div>
      )}
      {preguntarBaja && (
        <div onClick={(e) => e.stopPropagation()}>
          <Confirm title="¿Se dio de baja?" confirmLabel="Dar de baja" cancelLabel="No" loading={enBaja}
            message={`Lo que no pagó (${usd(impagasVivas.reduce((s, q) => s + Number(q.monto_usd), 0))}) deja de ser deuda y no se le recuerda. Lo cobrado queda.`}
            onCancel={() => setPreguntarBaja(false)} onConfirm={() => baja(false)} />
        </div>
      )}
      {aQuitar && (
        <div onClick={(e) => e.stopPropagation()}>
          <Confirm title={`¿Quitar ${renglonDeCuota(aQuitar, ctx.hoy).nombre.toLowerCase()}?`} confirmLabel="Quitarla" cancelLabel="No"
            message={`${usd(Number(aQuitar.monto_usd))}${aQuitar.fecha_esperada ? ` · vence el ${fmtDDMMYYYY(aQuitar.fecha_esperada)}` : ''}. Deja de contarse como deuda.`}
            onCancel={() => setAQuitar(null)} onConfirm={() => quitar(aQuitar)} />
        </div>
      )}
      {!editando && diseno !== 'proxima' && !becado && (
        armando
          ? <ArmarPlan ctx={ctx} onListo={(m) => { setArmando(false); if (m) show(m.texto, m.deshacer); }} />
          : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(conPlan || vivas.filter((q) => !q.pagado).length === 0) && lead.venta_tipo !== 'suscripcion' && (
                <Button variant="secondary" size="sm" onClick={() => setArmando(true)}>{conPlan ? 'Cambiar el plan' : 'Armar el plan'}</Button>
              )}
              <Button variant="tertiary" size="sm" onClick={cobrar.agregarCuota}>+ Agregar una cuota</Button>
              {puedeDarDeBaja && <Button variant="tertiary" size="sm" onClick={() => setPreguntarBaja(true)}>Baja del cliente</Button>}
            </div>
          )
      )}
      {cobrar.modales}
      <Toast state={toast} onClose={clear} />
    </Tarjeta>
  );
}

/**
 * El plan uniforme: cobro inicial, cuota, cuántas (1 a 6) y qué día del mes (1 a 28). Va por `ajustarPlanAction`:
 * la cuota que existe se actualiza POR ID, la que falta se agrega y la que sobra se quita sólo si no tiene link ni
 * recordatorio; las cobradas no se tocan, y NO gana el lead. Deshacer devuelve las cuotas y el plan de antes.
 */
function ArmarPlan({ ctx, onListo }: { ctx: CtxFicha; onListo: (m: { texto: string; deshacer?: () => void } | null) => void }) {
  const l = ctx.lead;
  // El plan como estaba AL ABRIR (no se recalcula si la ficha se relee mientras se escribe): se manda SÓLO lo que la
  // persona cambió contra esto, y el server lo escribe encima de lo que tiene (`ajustarSobre`). Mandar los cuatro
  // campos volvía a escribir un valor que otra pantalla había cambiado en el medio (revisión del 16/10/2026).
  const [antes] = useState<PlanUniforme>(() => ({ cobro_inicial_usd: l.cobro_inicial_usd, monto_cuota_usd: l.monto_cuota_usd, total_cuotas: l.total_cuotas, dia_de_pago: l.dia_de_pago }));
  const [plan, setPlan] = useState({ inicial: l.cobro_inicial_usd ? String(l.cobro_inicial_usd) : '', cuota: l.monto_cuota_usd ? String(l.monto_cuota_usd) : '', cantidad: l.total_cuotas ? String(l.total_cuotas) : '', dia: l.dia_de_pago ? String(l.dia_de_pago) : '' });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(',', '.')));
  const nuevo: Partial<PlanUniforme> = { cobro_inicial_usd: n(plan.inicial), monto_cuota_usd: n(plan.cuota), total_cuotas: n(plan.cantidad), dia_de_pago: n(plan.dia) };
  const cambiado = Object.fromEntries((Object.keys(nuevo) as Array<keyof PlanUniforme>).filter((k) => (nuevo[k] ?? null) !== (antes[k] ?? null)).map((k) => [k, nuevo[k]])) as Partial<PlanUniforme>;
  const v = ajustarSobre(antes, nuevo);
  const guardar = () => {
    if (!v.ok) { setErr(v.error); return; }
    if (!Object.keys(cambiado).length) { onListo(null); return; }
    start(async () => {
      const r = await ajustarPlanAction(l.id, cambiado);
      if (!r.ok) { setErr(r.error); return; }
      ctx.releer();
      const d = r.deshacer;
      onListo({
        texto: r.sinTocar ? `Plan guardado · no se tocó: ${r.sinTocar}` : 'Plan guardado',
        deshacer: () => { void guardarCuotasAction(l.id, d.cuotas, d.plan, d.vistos).then(() => ctx.releer()); },
      });
    });
  };
  const campo = (k: keyof typeof plan, rot: string, ayuda?: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--dim)' }}>
      {rot}
      <input className="mk-input" type="number" inputMode="decimal" min={0} value={plan[k]} onChange={(e) => setPlan({ ...plan, [k]: e.target.value })} placeholder={ayuda} />
    </label>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {campo('inicial', 'Cobro inicial (USD)')}
        {campo('cuota', 'Cada cuota (USD)')}
        {campo('cantidad', 'Cuántas cuotas', '1 a 6')}
        {campo('dia', 'Día de pago', '1 a 28')}
      </div>
      {v.ok && <span style={{ fontSize: 13, color: 'var(--dim)' }}>Total del plan: {usd((v.plan.cobro_inicial_usd ?? 0) + (v.plan.monto_cuota_usd ?? 0) * (v.plan.total_cuotas ?? 0))}</span>}
      {err && <Aviso tono="rojo">{err}</Aviso>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={() => onListo(null)} disabled={pending}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={guardar} loading={pending}>Guardar el plan</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Links de pago
// ─────────────────────────────────────────────────────────────────────────────

export function LinksDePago({ ctx, titulo, diseno, editando }: PropsBloque) {
  const { lead } = ctx;
  const { cobros, error: errLeer, opciones } = useCobrosDelLead(lead.id);
  const cambio = () => { refrescarCobros(lead.id); ctx.releer(); };
  // «Sólo el pendiente más nuevo»: el link que todavía se puede pagar.
  const lista = cobros && diseno === 'pendiente' ? cobros.filter((c) => c.link).slice(0, 1) : cobros;
  return (
    <Tarjeta titulo={titulo}
      derecha={!editando && opciones?.ok && (
        <CobrarConLink lead={{ id: lead.id, nombre: lead.nombre, email: lead.email, telefono: lead.telefono }}
          pasarelas={opciones.pasarelas} productos={opciones.productos} onCreado={() => refrescarCobros(lead.id)} />
      )}>
      {opciones && !opciones.ok && <p style={nada}>{opciones.error}</p>}
      <CobrosDelLead cobros={lista} error={errLeer} esAdmin={!!opciones?.ok && opciones.esAdmin} onCambio={cambio} />
    </Tarjeta>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Movimientos
// ─────────────────────────────────────────────────────────────────────────────

export function Movimientos({ ctx, titulo, diseno }: PropsBloque) {
  const { cobros } = useCobrosDelLead(ctx.lead.id);
  const [todos, setTodos] = useState(false);
  const { movimientos, avisos } = movimientosDelLead({ pagos: ctx.data.pagos, cobros: cobros ?? [] });
  const corte = diseno === 'ultimos' && !todos ? 5 : Infinity;
  return (
    <Tarjeta titulo={titulo}>
      {avisos.map((a) => <Aviso key={`a${a.cobroId}`} tono={a.tono}>{a.texto}</Aviso>)}
      {movimientos.length === 0
        ? <p style={nada}>{cobros === null ? 'Leyendo…' : 'Todavía no hubo movimientos de plata.'}</p>
        : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {movimientos.slice(0, corte).map((m) => (
              <li key={m.clave} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', alignItems: 'baseline', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>{fmtDDMMYYYY(m.fecha)}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: m.tipo === 'rechazo' ? 'var(--bad)' : m.tipo === 'devolucion' ? 'var(--warn)' : 'var(--ink)' }}>{m.titulo}</span>
                  <span style={{ fontSize: 13, color: 'var(--dim)' }}> · {m.via}</span>
                  {m.detalle && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)' }}>{m.detalle}</span>}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: m.tipo === 'devolucion' ? 'var(--warn)' : m.tipo === 'rechazo' ? 'var(--faint)' : 'var(--ink)', textDecoration: m.tipo === 'rechazo' ? 'line-through' : undefined }}>
                  {m.tipo === 'devolucion' ? `−${m.montoTexto}` : m.montoTexto}
                </span>
              </li>
            ))}
          </ol>
        )}
      {movimientos.length > corte && <Button variant="tertiary" size="sm" onClick={() => setTodos(true)}>Ver los {movimientos.length}</Button>}
    </Tarjeta>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Suscripción
// ─────────────────────────────────────────────────────────────────────────────

export function Suscripcion(props: PropsBloque) {
  const { ctx, titulo, editando } = props;
  const { lead } = ctx;
  const { cobrado, cobros, leidos, sinLeer } = useCobrado(ctx);
  const cobrar = useCobrar(ctx);
  const { toast, show, clear } = useToast();
  const [preguntar, setPreguntar] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const s = cobrado.suscripcion;
  if (!s) return null;
  const activaPasarela = (cobros ?? []).find((c) => c.tipo === 'suscripcion' && c.estado === 'pagado' && c.suscripcion_estado !== 'cancelada') ?? null;

  const venta = (c: Parameters<typeof guardarVentaAction>[1], patch: Record<string, unknown>) =>
    guardarVentaAction(lead.id, c, { tipoVisto: 'suscripcion' }).then((r) => {
      if (!r.ok) return r.error;
      ctx.parchear(patch);
      const atras = r.deshacer;
      if (r.cambio) show('Guardado', () => { void deshacerVenta(lead.id, atras, r.ventaTipo).then(() => ctx.releer()); });
      return null;
    });
  const cancelar = async () => {
    setCorriendo(true);
    const r = activaPasarela
      ? await cancelarSuscripcionAction(activaPasarela.id).then((x) => (x.ok ? null : x.resumen)).catch((e: unknown) => String(e))
      : await cambiarEstadoSuscripcionAction(lead.id, 'cancelada').then(error);
    setCorriendo(false);
    setPreguntar(false);
    if (r) { show(r, undefined, 'bad'); return; }
    refrescarCobros(lead.id);
    ctx.releer();
    show('Suscripción cancelada');
  };
  const reactivar = async () => {
    const r = await cambiarEstadoSuscripcionAction(lead.id, 'activa');
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    ctx.releer();
    show('Suscripción reactivada');
  };
  const estado = s.estado === 'activa' ? { tono: 'verde' as const, txt: 'Activa' } : s.estado === 'cancelada' ? { tono: 'gris' as const, txt: 'Cancelada' } : { tono: 'gris' as const, txt: 'Terminó' };

  return (
    <Tarjeta titulo={titulo} marca={marcaDato('monto')} derecha={<Semaforo tono={s.renovacionFallida ? 'rojo' : estado.tono}>{s.renovacionFallida ? 'Falló la renovación' : estado.txt}</Semaforo>}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: props.epico ? 56 : 30, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', minWidth: 80 }}>
          <EnLinea valor={lead.suscripcion_monto_usd != null ? String(lead.suscripcion_monto_usd) : ''} tipo="numero" prefijo="$" vacio="$—" titulo="Edita la mensualidad" bloqueado={editando}
            estilo={{ fontSize: 'inherit', fontWeight: 'inherit' }} onGuardar={(v) => venta({ campo: 'monto', valor: v ? Number(v) : null }, { suscripcion_monto_usd: v ? Number(v) : null })} />
        </span>
        <span style={{ fontSize: 15, color: 'var(--dim)' }}>/mes</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, color: 'var(--dim)' }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
          Plazo:
          <span style={{ minWidth: 60 }}>
            <EnLinea valor={lead.suscripcion_meses != null ? String(lead.suscripcion_meses) : ''} tipo="numero" vacio="mes a mes" titulo="Edita el plazo en meses (vacío: mes a mes)"
              bloqueado={editando || s.estado === 'cancelada'} estilo={{ fontSize: 13.5, color: 'var(--ink)' }}
              onGuardar={(v) => venta({ campo: 'plazo', valor: v ? Math.round(Number(v)) : null }, { suscripcion_meses: v ? Math.round(Number(v)) : null })} />
          </span>
          {s.meses ? <span>meses{s.finPlazo ? ` · termina el ${fmtDDMMYYYY(s.finPlazo)}` : ''}</span> : null}
        </span>
        {s.proximaRenovacion && s.estado === 'activa' && <span>Próxima el {fmtDDMMYYYY(s.proximaRenovacion)} · {cobrado.cuotas.cobradas} cobrada(s){s.fuente === 'pasarela' ? ' · la cobra la pasarela' : ''}</span>}
      </div>
      {s.renovacionFallida && <Aviso tono="rojo">{s.renovacionFallida}</Aviso>}
      {sinLeer && <Aviso tono="ambar">No pude leer los cobros de la pasarela: no se sabe si la cobra ella.</Aviso>}
      {leidos && s.sinRegistrar > 0 && <Aviso tono="ambar">{s.sinRegistrar === 1 ? 'Falta registrar 1 mes cobrado.' : `Faltan registrar ${s.sinRegistrar} meses cobrados.`}</Aviso>}
      {!editando && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {leidos && s.fuente === 'manual' && s.estado === 'activa' && <Button variant="secondary" size="sm" onClick={cobrar.registrarMes}>Registrar el mes cobrado</Button>}
          {ctx.esAdmin && s.estado === 'activa' && <Button variant="tertiary" size="sm" onClick={() => setPreguntar(true)}>Cancelar la suscripción</Button>}
          {ctx.esAdmin && s.estado === 'cancelada' && s.fuente === 'manual' && <Button variant="tertiary" size="sm" onClick={() => void reactivar()}>Reactivarla</Button>}
        </div>
      )}
      {preguntar && (
        <div onClick={(e) => e.stopPropagation()}>
          <Confirm title="¿Cancelar la suscripción?" loading={corriendo} confirmLabel="Cancelarla" cancelLabel="No" onCancel={() => setPreguntar(false)} onConfirm={() => void cancelar()}
            message={activaPasarela ? 'La pasarela deja de cobrarla. No se deshace: para volver hay que suscribirse de nuevo.' : 'Deja de contar como activa. Lo ya cobrado no cambia.'} />
        </div>
      )}
      {cobrar.modales}
      <Toast state={toast} onClose={clear} />
    </Tarjeta>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Venta
// ─────────────────────────────────────────────────────────────────────────────

const TIPOS: ReadonlyArray<{ id: VentaTipo; nombre: string }> = [
  { id: 'unico', nombre: 'Pago único' }, { id: 'suscripcion', nombre: 'Suscripción' }, { id: 'sin_cobro', nombre: 'Sin cobro' },
];
const caja: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, padding: '11px 14px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', minWidth: 0 };
const etiqueta: CSSProperties = { fontSize: 12, color: 'var(--dim)' };

export function Venta({ ctx, titulo, diseno, editando }: PropsBloque) {
  const { lead } = ctx;
  const { toast, show, clear } = useToast();
  const [pending, start] = useTransition();
  const tipo: VentaTipo = (lead.venta_tipo as VentaTipo | null) ?? 'unico';
  const esSus = tipo === 'suscripcion';

  const guardar = (c: Parameters<typeof guardarVentaAction>[1], patch: Record<string, unknown>) =>
    guardarVentaAction(lead.id, c, { tipoVisto: tipo }).then((r) => {
      if (!r.ok) return r.error;
      ctx.parchear({ ...patch, venta_tipo: r.ventaTipo });
      const atras = r.deshacer;
      if (r.cambio) show('Guardado', () => { void deshacerVenta(lead.id, atras, r.ventaTipo).then(() => ctx.releer()); });
      return null;
    });
  /** Cambiar el tipo. DESDE «Sin cobro» se sale por su propia acción (compare-and-set), y después al tipo elegido. */
  const cambiarTipo = (nuevo: VentaTipo) => start(async () => {
    if (nuevo === tipo) return;
    if (tipo === 'sin_cobro') {
      const r = await quitarSinCobroAction(lead.id).catch((e: unknown) => ({ error: String(e) }) as const);
      if ('error' in r) { show(r.error, undefined, 'bad'); return; }
      if (!r.cambio) show('Ya no era «Sin cobro».');
      ctx.parchear({ venta_tipo: r.ventaTipo });
      if (nuevo === 'suscripcion' && r.ventaTipo !== 'suscripcion') {
        const r2 = await guardarVentaAction(lead.id, { campo: 'tipo', valor: 'suscripcion' }, { tipoVisto: r.ventaTipo });
        if (!r2.ok) { show(r2.error, undefined, 'bad'); return; }
        ctx.parchear({ venta_tipo: r2.ventaTipo });
      }
      return;
    }
    const e = await guardar({ campo: 'tipo', valor: nuevo }, {});
    if (e) show(e, undefined, 'bad');
  });

  const monto = esSus ? lead.suscripcion_monto_usd : lead.monto_cierre_usd;
  const montoCampo = tipo === 'sin_cobro'
    ? <span style={{ fontSize: diseno === 'numero' ? 34 : 18, fontWeight: 700, color: 'var(--dim)' }}>Sin cobro</span>
    : <EnLinea valor={monto != null ? String(monto) : ''} tipo="numero" prefijo="$" vacio={ganado(ctx) ? 'sin monto' : '—'} titulo={esSus ? 'Edita la mensualidad' : 'Edita el monto de la venta'} bloqueado={editando}
        estilo={{ fontSize: diseno === 'numero' ? 34 : 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
        onGuardar={(v) => guardar({ campo: 'monto', valor: v ? Number(v) : null }, esSus ? { suscripcion_monto_usd: v ? Number(v) : null } : { monto_cierre_usd: v ? Number(v) : null })} />;
  const fecha = <EnLinea valor={lead.fecha_cierre ?? ''} tipo="fecha" vacio="sin fecha" titulo="Edita la fecha de cierre" bloqueado={editando}
    estilo={{ fontSize: 14.5 }} onGuardar={(v) => guardar({ campo: 'fecha', valor: v || null }, { fecha_cierre: v || null })} />;
  const tipos = (
    <div role="group" aria-label="Tipo de venta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {TIPOS.map((t) => (
        <Button key={t.id} size="sm" variant={tipo === t.id ? 'primary' : 'secondary'} disabled={editando || pending} onClick={() => cambiarTipo(t.id)}>{t.nombre}</Button>
      ))}
    </div>
  );

  return (
    <Tarjeta titulo={titulo} marca={marcaDato('monto')}>
      {diseno === 'renglon' ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', fontSize: 14 }}>
          <span style={{ minWidth: 80 }}>{montoCampo}</span>{esSus && <span style={{ color: 'var(--dim)' }}>/mes</span>}
          <span style={{ color: 'var(--dim)' }}>·</span><span style={{ minWidth: 90 }}>{fecha}</span>
          <span style={{ color: 'var(--dim)' }}>·</span><span>{TIPOS.find((t) => t.id === tipo)?.nombre}</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <div style={caja}><span style={etiqueta}>{esSus ? 'Mensualidad' : 'Monto'}</span>{montoCampo}</div>
          <div style={caja}><span style={etiqueta}>Fecha de cierre</span>{fecha}</div>
        </div>
      )}
      {tipos}
      <Toast state={toast} onClose={clear} />
    </Tarjeta>
  );
}
