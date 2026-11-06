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
//   · `suscripcion`: desde el 5/11/2026 vive en ./suscripcion.tsx (la suscripción mes a mes).
//   · `venta`: cuánto, cuándo y de qué tipo, campo por campo (la escritura de b2; reemplaza a «Editar deal»).
// Lo que se relevó de la tarjeta de antes y por qué cambió: docs/hallazgos-pagos.md §1.
// =============================================================================

import { useEffect, useState, useTransition, type CSSProperties } from 'react';
import { Button, Confirm, Toast, useToast } from '@/app/_ui';
import { cobradoDelLead, esCuotaDeBaja, esCuotaDevuelta, noEsDeuda, type CuotaParaCobrado } from '@/lib/cobrado-lead';
import { estadoDeCuenta, movimientosDelLead, renglonDeCuota, usd } from '@/lib/pagos-vistazo';
import { cobrosDelTrato, cobrosSinLosDe } from '@/lib/pagos-crm';
import {
  aplicarCambios, armadaDe, cambiosContra, columnasDelPlan, cuotasDeTramos, cuotasDelPlanPorTramos, lugaresDelPlan, plataDeCuota, soloLoQueCambio, tramosDeCuotas, TOPE_CUOTAS_PLAN, TOPE_TRAMOS,
  type AnticipoPlan, type CadaPlan, type CambioDeCuota, type PlanUniforme, type TramoPlan,
} from '@/lib/pagos-campo';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { planEnLead } from '@/lib/muestra-pagos';
import { fechaEnPalabras } from '@/lib/date-utils';
import { marcaDato } from '@/lib/datos-aviso';
import type { VentaTipo } from '@/lib/venta-tipo';
import type { Pago } from '@/lib/pagos';
import { cortarRecordatoriosCuotaAction, editarCuotaAction, guardarCuotasAction, guardarVentaAction } from '@/app/crm/[id]/pagos-campo-actions';
import { bajaDelClienteAction, proteccionesDeCuotasAction, quitarCuotaAction } from './cuotas-actions';
import type { Proteccion } from '@/lib/pagos-campo';
import { quitarSinCobroAction } from '@/app/crm/[id]/deal-actions';
import { CobrarConLink } from '@/app/crm/[id]/CobrarConLink';
import { CobrosDelLead } from '@/app/crm/[id]/CobrosDelLead';
import type { CtxFicha, PropsBloque } from '../tipos';
import { refrescarCobros, useCobrosDelLead, useMonedaDelNegocio } from './datos';
import { sinTratoLeido } from './trato';
import { useCobrar } from './cobrar';
import { EnLinea } from './EnLinea';
import { Aviso, MONO, Semaforo, Tarjeta, TONO_UI, nada } from './piezas';

const ganado = (ctx: CtxFicha) => ctx.lead.estado_lead === 'ganado';
const canceladaAt = (ctx: CtxFicha): string | null => ((ctx.lead as unknown as Record<string, unknown>).suscripcion_cancelada_at as string | null | undefined) ?? null;
const error = (r: { ok: boolean; error?: string }): string | null => (r.ok ? null : r.error ?? 'No pude guardar.');

/** Lo cobrado del lead, con la MISMA cuenta que la API de MaKo (`cobradoDelLead`). */
export function useCobrado(ctx: CtxFicha) {
  const { cobros, error: sinLeer } = useCobrosDelLead(ctx.lead.id);
  const { lead, data } = ctx;
  const cobrado = cobradoDelLead({
    ventaTipo: lead.venta_tipo ?? null, montoCierreUsd: lead.monto_cierre_usd ?? null, suscripcionMontoUsd: lead.suscripcion_monto_usd ?? null,
    suscripcionMeses: lead.suscripcion_meses ?? null, fechaCierre: lead.fecha_cierre ?? null, suscripcionCanceladaAt: canceladaAt(ctx),
    pagos: data.pagos as CuotaParaCobrado[], cobros: cobros ?? [], hoy: ctx.hoy, movimientos: data.suscripcion?.movimientos ?? [],
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
async function deshacerVenta(leadId: number, pasos: Parameters<typeof guardarVentaAction>[1][], tipo: VentaTipo, crm: number | null = null) {
  let visto: VentaTipo = tipo;
  for (const d of pasos) {
    const r = await guardarVentaAction(leadId, d, { tipoVisto: visto, crm });
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
  const bloqueado = props.editando || sinTratoLeido(ctx);
  const { cobrado, leidos } = useCobrado(ctx);
  const cobrar = useCobrar(ctx);
  const leido = estadoDeCuenta({ cobrado, pagos: ctx.data.pagos, ganado: ganado(ctx), hoy: ctx.hoy });
  const e = leido && !leidos && leido.accion?.tipo === 'registrar-mes' ? { ...leido, accion: null } : leido;
  if (!e) return null;
  // La vista épica (el criterio de General): la prende la TAB y llega en PropsBloque (../tipos.ts).
  const { epico } = props;
  const boton = e.accion && (
    <Button variant={e.tono === 'rojo' ? 'primary' : 'secondary'} size={epico ? 'lg' : 'md'} disabled={bloqueado} onClick={() => e.accion && cobrar.abrir(e.accion)}>{e.accion.boton}</Button>
  );
  // El comprobante del chat con MaKo (la 2.28): se promete leerlo sólo si el botón es cobrar SU cuota (21/10/2026).
  const delChat = cobrar.comprobanteDe(e.accion);
  const leera = delChat && <span style={{ fontSize: 13, color: 'var(--dim)' }}>Al cobrar la cuota leo {delChat.nombre}: queda listo para revisar y guardar.</span>;

  if (diseno === 'chip') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <Semaforo tono={e.tono}>{e.titular}</Semaforo>
        {e.detalle && <span style={{ fontSize: 13, color: 'var(--dim)' }}>{e.detalle}</span>}
        {leera}
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
      {leera}
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
  const { ctx, diseno, titulo } = props;
  const { lead, data } = ctx;
  // Mirando un CRM agregado (una renovación, ./trato.ts): estas son SUS cuotas, y lo que se escribe es de su trato. Si ese
  // trato no se pudo leer, no se escribe nada (`sinTratoLeido`): se ve como si se estuviera personalizando.
  const crm = ctx.crm?.id ?? null;
  const sinTrato = sinTratoLeido(ctx);
  const editando = props.editando || sinTrato;
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

  // `espera`: el estado del renglón que se dibujó (la fecha de una impaga es el vencimiento; la de una cobrada, el día del
  // pago). Si la cuota cambió en el medio (se cobró, se desmarcó), el server tira en vez de escribir la otra columna.
  // El Deshacer manda SÓLO lo que cambió (una cobrada sin día del pago no se puede «volver» a sin día), y dice si falló.
  const editar = (q: Pago, cambio: { monto?: number; montoOriginal?: number; fecha?: string | null }) => {
    const espera = q.pagado ? 'cobrada' as const : 'impaga' as const;
    return editarCuotaAction(lead.id, q.id, { ...cambio, espera }).then((r) => {
      if (!r.ok) return r.error;
      ctx.releer();
      const volver = {
        ...(r.antes.monto !== r.despues.monto ? { monto: r.antes.monto } : {}),
        ...(r.antes.montoOriginal != null && r.antes.montoOriginal !== r.despues.montoOriginal ? { montoOriginal: r.antes.montoOriginal } : {}),
        ...(r.antes.fecha !== r.despues.fecha ? { fecha: r.antes.fecha } : {}),
        espera,
      };
      // El link anulado no vuelve con el Deshacer (revisión de 0b6d5b754): se dice en los dos.
      const aviso = r.linkAnulado ? 'Cuota cambiada · el link anterior se anuló: manda uno nuevo'
        : r.recordatorioCortado ? 'Cuota cambiada · el recordatorio arranca de nuevo' : 'Cuota cambiada';
      show(aviso, () => start(async () => {
        const d = await editarCuotaAction(lead.id, q.id, volver);
        if (!d.ok) show(`No se deshizo: ${d.error}`, undefined, 'bad');
        else if (r.linkAnulado) show('Monto devuelto · el link quedó anulado: manda uno nuevo');
        ctx.releer();
      }));
      return null;
    });
  };
  // ⚠️ QUITAR VA SOLA Y CON CONFIRMACIÓN, SIN DESHACER (revisión del 16/10/2026). Sola: mandar la lista entera le
  // reescribía su valor viejo a una cuota que otra pestaña había cambiado. Sin Deshacer: volver a insertarla le daba
  // otro id y otro número (el inicial volvía como «Cuota N», y su recordatorio se volvía a mandar), así que no era
  // la misma cuota. Lo que tiene un link sin pagar o un recordatorio corriendo no se quita: el server lo dice.
  const [aQuitar, setAQuitar] = useState<Pago | null>(null);
  // ⚠️ «QUITAR» SE VE EN EL ACTO (#891, llamada con Mauricio del 16/10: «Se me hace que no la quitaste... Eso es un
  // error», y al rato «ahí sí se quitó»). La confirmación se cerraba DESPUÉS de la acción, y la acción revalida cinco
  // pantallas y después se relee la ficha: segundos con el diálogo abierto y sin una señal. En el ws1 quedó UNA sola
  // baja registrada (16/10 20:41), así que el primer clic no falló: tardó. Ahora la confirmación se cierra al
  // confirmar, el renglón dice «Quitando…» sin botones, y desaparece apenas el server dice que se quitó (sin esperar a
  // que la ficha se relea). Si no se quitó, vuelve y lo dice.
  // ⚠️ Y LOS ESTADOS VAN AFUERA DE `start`: un setState adentro de una transición puede no dibujarse hasta que termina.
  const [quitando, setQuitando] = useState<ReadonlySet<number>>(() => new Set());
  const [quitadas, setQuitadas] = useState<ReadonlySet<number>>(() => new Set());
  const conId = (s: ReadonlySet<number>, id: number, si: boolean) => { const n = new Set(s); if (si) n.add(id); else n.delete(id); return n; };
  const quitar = (q: Pago) => {
    setAQuitar(null);
    setQuitando((s) => conId(s, q.id, true));
    start(async () => {
      const r = await quitarCuotaAction(lead.id, q.id, crm);
      setQuitando((s) => conId(s, q.id, false));
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      if (r.quitada) setQuitadas((s) => conId(s, q.id, true));
      ctx.releer();
      show(r.quitada ? 'Cuota quitada' : `No se quitó: ${r.motivo ?? 'cambió en otra pantalla'}`);
    });
  };
  const becado = lead.venta_tipo === 'sin_cobro';

  // «Baja del cliente» (#871): lo que no pagó deja de ser deuda y lo cobrado queda. Con confirmación, y se deshace.
  // Una suscripción no: se cancela en su bloque.
  const impagasVivas = vivas.filter((q) => !q.pagado);
  const puedeDarDeBaja = !becado && lead.venta_tipo !== 'suscripcion' && impagasVivas.length > 0;
  const [preguntarBaja, setPreguntarBaja] = useState(false);
  const [enBaja, setEnBaja] = useState(false);
  const baja = (deshacer: boolean) => {
    // Afuera de `start`, como en «Quitar»: el «guardando» se tiene que ver mientras corre, no al final.
    setEnBaja(true);
    start(() => bajaEnCurso(deshacer));
  };
  const bajaEnCurso = async (deshacer: boolean) => {
    const r = await bajaDelClienteAction(lead.id, deshacer, crm);
    setEnBaja(false);
    setPreguntarBaja(false);
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    refrescarCobros(lead.id);
    ctx.releer();
    show(deshacer ? 'Baja deshecha' : 'Cliente dado de baja', deshacer ? undefined : () => baja(true));
  };

  // «Sólo la próxima»: la vencida más vieja o la que vence primero, y cuántas más hay.
  // Lo que el server ya quitó no se dibuja, aunque la ficha todavía no se haya releído (#891).
  const proxima = vivas.filter((q) => !q.pagado && q.fecha_esperada && !quitadas.has(q.id)).sort((a, b) => String(a.fecha_esperada).localeCompare(String(b.fecha_esperada)))[0] ?? null;
  const lista = (diseno === 'proxima' ? (proxima ? [proxima] : []) : [...vivas, ...deBaja, ...devueltas]).filter((q) => !quitadas.has(q.id));

  return (
    <Tarjeta titulo={titulo} marca={marcaDato('plan')}
      derecha={!editando && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!becado && <Button variant="secondary" size="sm" onClick={cobrar.registrarPago}>Registrar un pago</Button>}
        </div>
      )}>
      {sinTrato && <Aviso tono="ambar">No pude leer el plan de {ctx.crm?.nombre || 'este CRM'}: recarga la ficha para cambiarlo.</Aviso>}
      {lista.length === 0 && !armando && (
        <p style={nada}>{vivas.length ? 'No queda nada por cobrar.' : ctx.crm ? `Sin cuotas en ${ctx.crm.nombre || 'este CRM'}: el plan arranca de cero. Arma el plan o registra lo que pagó.` : 'Sin cuotas. Arma el plan o registra lo que pagó.'}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-recorrido={marcaDato('comprobante')}>
        {lista.map((q) => {
          const r = renglonDeCuota(q, ctx.hoy);
          const prot = protegidas[q.id] ?? [];
          // ⚠️ TODO SE EDITA EN EL LUGAR (27/10/2026, Martín: «Los pagos funcionan mal, no tiene LIBERTAD»). Antes, con un
          // recordatorio corriendo no se editaba nada, con un link vivo el monto no, y una cobrada había que desmarcarla
          // primero. Ahora el server corta el recordatorio, anula el link si cambia el monto y corrige la cobrada a mano en
          // el lugar (`editarCuota`, lib/pagos.ts). Lo que cobró la pasarela no: es lo que entró.
          const cobradaAMano = r.estado === 'cobrada' && r.accion === 'deshacer';
          // Una cobrada en otra moneda muestra «MX$8.600 · US$500»: editarla como «$500» se leía en pesos. Su monto se corrige
          // desmarcándola y cobrándola otra vez en su moneda; el día del pago sí se edita en el lugar.
          const enOtraMoneda = !!q.moneda && q.moneda.toUpperCase() !== 'USD';
          const montoEditable = r.editable || (cobradaAMano && !enOtraMoneda);
          // Una impaga pactada en otra moneda (un tramo en pesos, 29/10/2026): sus dos montos, cada uno en el lugar.
          const impagaEnOtra = r.editable && enOtraMoneda && q.monto_original != null;
          const fechaEditable = r.editable || cobradaAMano;
          const saliendo = quitando.has(q.id);
          return (
            <div key={q.id} aria-busy={saliendo || undefined} style={{ ...renglon, borderColor: BORDE[r.estado] ?? 'var(--border)', opacity: saliendo ? 0.55 : r.estado === 'devuelta' || r.estado === 'baja' ? 0.7 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{r.nombre}</span>
                <span style={{ fontSize: 14, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', minWidth: 70 }}>
                  {impagaEnOtra && !editando
                    ? <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <EnLinea valor={String(Number(q.monto_original))} tipo="numero" prefijo={`${String(q.moneda).toUpperCase()} `} titulo={`Edita el monto de ${r.nombre.toLowerCase()} en ${String(q.moneda).toUpperCase()}`}
                          onGuardar={(v) => editar(q, { montoOriginal: Number(v) })} />
                        <span style={{ color: 'var(--dim)' }}>·</span>
                        <EnLinea valor={String(Number(q.monto_usd))} tipo="numero" prefijo="US$" titulo={`Edita cuánto es ${r.nombre.toLowerCase()} en dólares`}
                          estilo={{ fontSize: 13, color: 'var(--dim)' }} onGuardar={(v) => editar(q, { monto: Number(v) })} />
                      </span>
                    : montoEditable && !editando
                    ? <EnLinea valor={String(Number(q.monto_usd))} tipo="numero" prefijo="$" titulo={`Edita el monto de ${r.nombre.toLowerCase()}`}
                      onGuardar={(v) => editar(q, { monto: Number(v) })} />
                    : r.montoTexto}
                </span>
                <span style={{ fontSize: 13, color: TONO_UI[r.tono] === 'bad' ? 'var(--bad)' : TONO_UI[r.tono] === 'warn' ? 'var(--warn)' : 'var(--dim)' }}>
                  {fechaEditable && !editando && cobradaAMano
                    // La cobrada: el día del pago («cobrada el …»), y lo demás del renglón como estaba.
                    ? <>cobrada el <EnLinea valor={(q.fecha_pago ?? '').slice(0, 10)} tipo="fecha" vacio="sin fecha" titulo={`Edita el día del pago de ${r.nombre.toLowerCase()}`}
                      estilo={{ fontSize: 13, color: 'inherit' }} onGuardar={(v) => editar(q, { fecha: v || null })} />{r.cuando.includes(' · ') ? ` · ${r.cuando.split(' · ').slice(1).join(' · ')}` : ''}</>
                    : fechaEditable && !editando
                    ? <EnLinea valor={q.fecha_esperada ?? ''} tipo="fecha" vacio="sin fecha" titulo={`Edita el vencimiento de ${r.nombre.toLowerCase()}`}
                      estilo={{ fontSize: 13, color: 'inherit' }} onGuardar={(v) => editar(q, { fecha: v || null })} />
                    : r.cuando}
                </span>
                {r.editable && r.estado !== 'futura' && r.estado !== 'sin-fecha' && <span style={{ fontSize: 12.5, color: r.estado === 'vencida' ? 'var(--bad)' : 'var(--warn)' }}>{r.cuando.split(' · ')[1]}</span>}
                {prot.includes('link') && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>Link enviado</span>}
                {prot.includes('recordatorio') && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)' }}>Recordatorio en curso</span>}
              </div>
              {saliendo && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)' }}>Quitando…</span>}
              {!editando && !saliendo && (
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
            Se dio de baja{deBaja[0].baja_at ? ` el ${fechaEnPalabras(deBaja[0].baja_at.slice(0, 10), ctx.hoy)}` : ''} · quedó sin cobrar {usd(deBaja.reduce((s, q) => s + Number(q.monto_usd), 0))}
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
            message={`${usd(Number(aQuitar.monto_usd))}${aQuitar.fecha_esperada ? ` · vence el ${fechaEnPalabras(aQuitar.fecha_esperada, ctx.hoy)}` : ''}. Deja de contarse como deuda.`}
            onCancel={() => setAQuitar(null)} onConfirm={() => quitar(aQuitar)} />
        </div>
      )}
      {!editando && diseno !== 'proxima' && !becado && (
        armando
          ? <ArmarPlan ctx={ctx} protegidas={protegidas} onListo={(m) => { setArmando(false); if (m) show(m.texto, m.deshacer); }} />
          : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Siempre a mano (27/10/2026: «no tiene LIBERTAD»): con cuotas sueltas sin plan el botón se escondía; si el
                  plan no se puede armar encima de lo que hay, el server lo dice en el mismo lugar. Y también en una suscripción
                  (29/10, Nadia, lead 2605): el plan por tramos la pasa a «Pago único» al guardar, y lo dice antes. */}
              <Button variant="secondary" size="sm" onClick={() => setArmando(true)}>{conPlan || vivas.some((q) => !q.nacio_cobrada) ? 'Cambiar el plan' : 'Armar el plan'}</Button>
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
 * El plan POR TRAMOS (29/10/2026, ticket #13 de Leila: «$300 cada quincena, los días 1 y 15», «6 meses de 12.000 y luego 10.000»;
 * Martín: «No tiene libertad o diversidad de tipos de cobros»). Copiado de las fases de un «subscription schedule» de Stripe
 * (tramos seguidos, cada uno con su monto, su moneda, cada cuánto y cuántas cuotas o hasta cuándo; «+ Agregar un tramo» es su
 * «+ Add phase») y del plan de pagos de Kajabi (el anticipo es su «setup fee»; el orden de los campos, el suyo: monto, moneda,
 * cuántas, cada cuánto). Debajo, las cuotas que salen, y cada una se toca a mano antes de guardar. Las reglas: lib/pagos-campo.ts.
 *
 * Abre con el plan que el lead YA tiene (`tramosDeCuotas`): lo que no encaja en un tramo aparece como cuota tocada a mano, así que
 * guardar sin cambiar nada no cambia nada. Se guarda POR ID encima de lo que hay (`cuotasDelPlanPorTramos` → `guardarCuotasAction`),
 * con Deshacer. Reemplaza al plan uniforme y al libre en la ficha: los dos son un tramo solo. Una suscripción pasa a «Pago único».
 */
type TramoForm = { monto: string; moneda: string; usd: string; cada: CadaPlan; dia: string; dia2: string; fin: 'cantidad' | 'hasta'; cantidad: string; hasta: string };
type AnticipoForm = { monto: string; moneda: string; usd: string; fecha: string; cobrado: boolean };

const numero = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(',', '.')));
const tramoVacio = (): TramoForm => ({ monto: '', moneda: 'USD', usd: '', cada: 'mes', dia: '', dia2: '15', fin: 'cantidad', cantidad: '', hasta: '' });
const formDeTramo = (t: TramoPlan): TramoForm => ({
  monto: String(t.monto), moneda: t.moneda ?? 'USD', usd: t.montoUsd != null ? String(t.montoUsd) : '', cada: t.cada,
  dia: t.dias?.[0] != null ? String(t.dias[0]) : '', dia2: t.dias?.[1] != null ? String(t.dias[1]) : '15',
  fin: t.hasta ? 'hasta' : 'cantidad', cantidad: t.cantidad != null ? String(t.cantidad) : '', hasta: t.hasta ?? '',
});
const tramoDeForm = (f: TramoForm): TramoPlan => {
  const d1 = numero(f.dia);
  return {
    monto: numero(f.monto) ?? 0, moneda: f.moneda, montoUsd: numero(f.usd), cada: f.cada,
    dias: f.cada === 'semana' ? undefined : f.cada === 'quincena' ? [d1 ?? 1, numero(f.dia2) ?? 15] : d1 != null ? [d1] : undefined,
    cantidad: f.fin === 'cantidad' ? numero(f.cantidad) : null, hasta: f.fin === 'hasta' ? f.hasta || null : null,
  };
};
/** «US$ 300» o «$ 12.000 MXN (US$ 600)»: una cuota del plan, dicha. */
const plataDe = (c: { monto_usd: number; moneda: string | null; monto_original: number | null }): string =>
  (c.moneda && c.monto_original != null ? `${formatoMonto(c.monto_original, c.moneda)} (${formatoMonto(c.monto_usd, 'USD')})` : formatoMonto(c.monto_usd, 'USD'));

export function ArmarPlan({ ctx, protegidas, onListo }: { ctx: CtxFicha; protegidas: Record<number, Proteccion[]>; onListo: (m: { texto: string; deshacer?: () => void } | null) => void }) {
  const l = ctx.lead;
  const crm = ctx.crm?.id ?? null;
  const esSus = l.venta_tipo === 'suscripcion';
  const monedaNegocio = useMonedaDelNegocio();
  // ¿El #0 es el anticipo? Sí si el plan guardado tiene cobro inicial (revisión de 1f02dd813: si no, es una cuota más).
  const [planConInicial] = useState(() => (l.cobro_inicial_usd ?? 0) > 0);
  // Las cuotas como se vieron AL ABRIR: los lugares, los `vistos` y lo que la persona no cambia (`soloLoQueCambio`) salen de acá.
  // Si la ficha se relee en el medio (otra pestaña agregó una cuota), lo nuevo no toma una fila: el server lo conserva («nueva»).
  const [abiertas] = useState(() => ctx.data.pagos);
  const lugares = lugaresDelPlan(abiertas, planConInicial);
  // Lo que el lead YA tiene, leído UNA vez al abrir (si la ficha se relee mientras se escribe, el formulario no se pisa).
  const [inicio] = useState(() => {
    const leido = tramosDeCuotas(lugares, ctx.hoy);
    let cambios: Record<number, CambioDeCuota> = {};
    if (leido) {
      const a = cuotasDeTramos(leido);
      // Sólo las impagas: una cobrada cubre su lugar, y lo que se cobró (un descuento) no es un cambio del plan.
      if (a.ok) cambios = Object.fromEntries(Object.entries(cambiosContra(a.cuotas, lugares.map(armadaDe))).filter(([k]) => !lugares[Number(k)]?.pagado));
    }
    const delLead: TramoForm = { ...tramoVacio(), monto: l.monto_cuota_usd ? String(l.monto_cuota_usd) : '', cantidad: l.total_cuotas ? String(l.total_cuotas) : '', dia: l.dia_de_pago ? String(l.dia_de_pago) : '' };
    // ⚠️ EL ANTICIPO SALE DE UNA FILA #0 VIVA, NUNCA DE LA COLUMNA (revisión de 9fc4030dd, alta): «Quitar» no limpia
    // `cobro_inicial_usd`, y una devolución tampoco. Con la columna, el anticipo quitado o devuelto volvía al abrir el editor, y
    // guardarlo sin tocar nada lo cobraba HOY otra vez (la deuda de US$1.500 pasaba a 2.500). Sin #0 vivo, vacío.
    const cero = planConInicial ? abiertas.find((q) => q.numero === 0 && !noEsDeuda(q)) ?? null : null;
    const c0 = cero ? armadaDe(cero) : null;
    const anticipo: AnticipoForm = cero && c0
      ? { monto: String(c0.moneda ? c0.monto_original : c0.monto_usd), moneda: c0.moneda ?? 'USD', usd: c0.moneda ? String(c0.monto_usd) : '', fecha: cero.fecha_esperada ?? ctx.hoy, cobrado: cero.pagado }
      : { monto: '', moneda: 'USD', usd: '', fecha: ctx.hoy, cobrado: false };
    return { desde: leido?.desde ?? ctx.hoy, tramos: leido ? leido.tramos.map(formDeTramo) : [delLead], cambios, anticipo };
  });
  const [desde, setDesde] = useState(inicio.desde);
  const [tramos, setTramos] = useState<TramoForm[]>(inicio.tramos);
  const [cambios, setCambios] = useState<Record<number, CambioDeCuota>>(inicio.cambios);
  const [anticipo, setAnticipo] = useState<AnticipoForm>(inicio.anticipo);
  const [rehechas, setRehechas] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const monedas = [...new Set(['USD', ...(monedaNegocio ? [monedaNegocio.toUpperCase()] : []), ...tramos.map((t) => t.moneda), anticipo.moneda])];

  // Cambiar un tramo (o la primera fecha) rehace la lista: lo tocado a mano se pierde, y se dice.
  const rehacer = () => { if (Object.keys(cambios).length) { setCambios({}); setRehechas(true); } };
  const tramo = (i: number, cambio: Partial<TramoForm>) => { rehacer(); setTramos((ts) => ts.map((t, k) => (k === i ? { ...t, ...cambio } : t))); };

  const armado = cuotasDeTramos({ desde, tramos: tramos.map(tramoDeForm) });
  const lista = armado.ok ? aplicarCambios(armado.cuotas, cambios) : [];
  const plataAnticipo = numero(anticipo.monto) ? plataDeCuota({ monto: numero(anticipo.monto), moneda: anticipo.moneda, montoUsd: numero(anticipo.usd) }) : null;
  const anticipoPlan: AnticipoPlan | null = plataAnticipo?.ok ? { monto_usd: plataAnticipo.monto_usd, moneda: plataAnticipo.moneda, monto_original: plataAnticipo.monto_original, fecha: anticipo.fecha || ctx.hoy } : null;
  const encima = armado.ok ? cuotasDelPlanPorTramos({
    pagos: abiertas, protegidas: new Set(Object.entries(protegidas).filter(([, p]) => p.length).map(([id]) => Number(id))),
    anticipo: anticipoPlan, lista, planConInicial,
  }) : null;
  const firma = JSON.stringify([desde, tramos]);

  // Lo que se va a cobrar (lo cubierto por lo ya cobrado no): por moneda, y en dólares.
  const aCobrar = [...(anticipoPlan && !anticipo.cobrado ? [anticipoPlan] : []), ...lista.filter((_, i) => !lugares[i]?.pagado)];
  const porMoneda = new Map<string, number>();
  for (const c of aCobrar) if (c.moneda && c.monto_original != null) porMoneda.set(c.moneda, (porMoneda.get(c.moneda) ?? 0) + c.monto_original);
  const totalUsd = aCobrar.reduce((s, c) => s + c.monto_usd, 0);
  // «US$ 600 + $ 24.000 MXN (US$ 1.800 en total)»: con «· US$ 1.800» al lado de los pesos, se leía como si sumara dos veces.
  const soloUsd = aCobrar.filter((c) => !c.moneda || c.monto_original == null).reduce((s, c) => s + c.monto_usd, 0);
  const total = porMoneda.size
    ? `${[...(soloUsd > 0 ? [formatoMonto(soloUsd, 'USD')] : []), ...[...porMoneda].map(([m, v]) => formatoMonto(v, m))].join(' + ')} (${formatoMonto(totalUsd, 'USD')} en total)`
    : formatoMonto(totalUsd, 'USD');

  const guardar = () => {
    setErr(null);
    if (!armado.ok) { setErr(armado.error); return; }
    if (plataAnticipo && !plataAnticipo.ok && !anticipo.cobrado) { setErr(`Anticipo: ${plataAnticipo.error}`); return; }
    if (!encima) return;
    if (!encima.ok) { setErr(encima.error); return; }
    // Las columnas del plan (de UN monto, con sus CHECK): las mismas que arma la API (lib/pagos-campo.ts).
    const columnas: PlanUniforme = columnasDelPlan({ tramos: tramos.map(tramoDeForm), cuotas: lista.length, anticipoUsd: anticipo.cobrado ? l.cobro_inicial_usd ?? null : anticipoPlan?.monto_usd ?? null });
    const { aparte, vistos, nuevas } = encima;
    const cuotas = soloLoQueCambio(encima.cuotas, abiertas);
    start(async () => {
      // Una suscripción con un plan de cuotas es un pago único en cuotas: primero la venta, con su compare-and-set.
      let ventaAtras: Parameters<typeof guardarVentaAction>[1][] = [];
      if (esSus) {
        const v = await guardarVentaAction(l.id, { campo: 'tipo', valor: 'unico' }, { tipoVisto: 'suscripcion', crm });
        if (!v.ok) { setErr(v.error); return; }
        ventaAtras = v.deshacer;
        ctx.parchear({ venta_tipo: v.ventaTipo, suscripcion_monto_usd: null, suscripcion_meses: null });
      }
      const r = await guardarCuotasAction(l.id, [...cuotas, ...aparte], columnas, vistos, crm, { protegidasPrimero: true, conDeshacer: true, sobreLoVisto: true });
      // Sin las cuotas, la venta vuelve a ser la suscripción que era: un «Pago único» sin su plan no es lo que se pidió.
      if (!r.ok) { setErr(r.error); if (ventaAtras.length) await deshacerVenta(l.id, ventaAtras, 'unico', crm); ctx.releer(); return; }
      ctx.releer();
      const d = r.deshacer;
      const conAnticipo = cuotas.some((c) => c.numero === 0);
      onListo({
        texto: r.sinTocar ? `Plan guardado · no se tocó: ${r.sinTocar}` : `Plan guardado: ${nuevas} cuota${nuevas === 1 ? '' : 's'}${conAnticipo ? ' y el anticipo' : ''}`,
        deshacer: d ? () => {
          void guardarCuotasAction(l.id, d.cuotas, d.plan, d.vistos, crm)
            .then(() => (ventaAtras.length ? deshacerVenta(l.id, ventaAtras, 'unico', crm) : undefined))
            .then(() => ctx.releer());
        } : undefined,
      });
    });
  };

  const etiqueta: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--dim)', minWidth: 0 };
  const grilla: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 10 };
  const caja: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)' };
  const entrada = (rot: string, valor: string, cambiar: (v: string) => void, o: { tipo?: 'number' | 'date'; ayuda?: string } = {}) => (
    <label style={etiqueta}>
      {rot}
      <input className="mk-input" type={o.tipo ?? 'number'} inputMode={o.tipo === 'date' ? undefined : 'decimal'} min={o.tipo === 'date' ? undefined : 0} value={valor} placeholder={o.ayuda} onChange={(e) => cambiar(e.target.value)} />
    </label>
  );
  const selectMoneda = (valor: string, cambiar: (v: string) => void) => (
    <label style={etiqueta}>
      Moneda
      <select className="mk-input" value={valor} onChange={(e) => cambiar(e.target.value)}>
        {monedas.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </label>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      {esSus && <Aviso tono="ambar">Es una suscripción: al guardar el plan pasa a «Pago único».</Aviso>}

      <div style={grilla}>
        {anticipo.cobrado
          ? <span style={{ ...etiqueta, justifyContent: 'flex-end' }}>Anticipo<span style={{ fontSize: 14, color: 'var(--ink)' }}>Cobrado</span></span>
          : <>
              {entrada(`Anticipo (${anticipo.moneda})`, anticipo.monto, (v) => setAnticipo({ ...anticipo, monto: v }), { ayuda: 'Sin anticipo' })}
              {monedas.length > 1 && selectMoneda(anticipo.moneda, (v) => setAnticipo({ ...anticipo, moneda: v }))}
              {anticipo.moneda !== 'USD' && entrada('En dólares', anticipo.usd, (v) => setAnticipo({ ...anticipo, usd: v }), { ayuda: 'US$' })}
              {numero(anticipo.monto) ? entrada('Se cobra el', anticipo.fecha, (v) => setAnticipo({ ...anticipo, fecha: v }), { tipo: 'date' }) : null}
            </>}
        {entrada('Primera cuota', desde, (v) => { rehacer(); setDesde(v); }, { tipo: 'date' })}
      </div>

      {tramos.map((t, i) => (
        <div key={i} style={caja}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{tramos.length > 1 ? `Tramo ${i + 1}` : 'Cuotas'}</span>
            {tramos.length > 1 && <Button variant="tertiary" size="sm" onClick={() => { rehacer(); setTramos((ts) => ts.filter((_, k) => k !== i)); }}>Quitar</Button>}
          </div>
          <div style={grilla}>
            {entrada(`Monto (${t.moneda})`, t.monto, (v) => tramo(i, { monto: v }))}
            {monedas.length > 1 && selectMoneda(t.moneda, (v) => tramo(i, { moneda: v }))}
            {t.moneda !== 'USD' && entrada('En dólares', t.usd, (v) => tramo(i, { usd: v }), { ayuda: 'US$ c/u' })}
            <label style={etiqueta}>
              Dura
              <select className="mk-input" value={t.fin} onChange={(e) => tramo(i, { fin: e.target.value as TramoForm['fin'] })}>
                <option value="cantidad">Cuántas cuotas</option>
                <option value="hasta">Hasta una fecha</option>
              </select>
            </label>
            {t.fin === 'cantidad'
              ? entrada('Cuotas', t.cantidad, (v) => tramo(i, { cantidad: v }), { ayuda: `1 a ${TOPE_CUOTAS_PLAN}` })
              : entrada('Hasta', t.hasta, (v) => tramo(i, { hasta: v }), { tipo: 'date' })}
            <label style={etiqueta}>
              Cada
              <select className="mk-input" value={t.cada} onChange={(e) => tramo(i, { cada: e.target.value as CadaPlan })}>
                <option value="mes">Mes</option>
                <option value="quincena">Quincena</option>
                <option value="semana">Semana</option>
              </select>
            </label>
            {t.cada === 'mes' && entrada('Día de pago', t.dia, (v) => tramo(i, { dia: v }), { ayuda: '1 a 31' })}
            {t.cada === 'quincena' && entrada('Primer día', t.dia, (v) => tramo(i, { dia: v }), { ayuda: '1' })}
            {t.cada === 'quincena' && entrada('Segundo día', t.dia2, (v) => tramo(i, { dia2: v }), { ayuda: '15' })}
          </div>
        </div>
      ))}
      {tramos.length < TOPE_TRAMOS && (
        <div>
          <Button variant="tertiary" size="sm" onClick={() => { rehacer(); setTramos((ts) => [...ts, { ...tramoVacio(), moneda: ts[ts.length - 1]?.moneda ?? 'USD', cada: ts[ts.length - 1]?.cada ?? 'mes', dia: ts[ts.length - 1]?.dia ?? '', dia2: ts[ts.length - 1]?.dia2 ?? '15' }]); }}>+ Agregar un tramo</Button>
        </div>
      )}

      {!armado.ok && tramos.some((t) => t.monto.trim()) && <span style={{ fontSize: 13, color: 'var(--warn)' }}>{armado.error}</span>}
      {lista.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>
            {lista.length} cuota{lista.length === 1 ? '' : 's'}{aCobrar.length ? ` · se cobran ${total}` : ''}
            {encima?.ok && encima.cubiertas ? ` · ${encima.cubiertas} ya cobrada${encima.cubiertas === 1 ? '' : 's'}` : ''}
          </span>
          {rehechas && <span style={{ fontSize: 12.5, color: 'var(--warn)' }}>Cambiaste los tramos: las cuotas tocadas a mano se rehicieron.</span>}
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
            {lista.map((c, i) => {
              const cobrada = lugares[i]?.pagado ? lugares[i] : null;
              const aMano = !!cambios[i];
              const fila: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13 };
              const celda = (campo: 'fecha' | 'monto' | 'usd', valor: string, ancho: number) => (
                <input key={`${firma}:${i}:${campo}`} className="mk-input" type={campo === 'fecha' ? 'date' : 'number'} inputMode={campo === 'fecha' ? undefined : 'decimal'} min={campo === 'fecha' ? undefined : 0}
                  defaultValue={valor} aria-label={`${campo === 'fecha' ? 'Vencimiento' : campo === 'usd' ? 'En dólares' : 'Monto'} de la cuota ${i + 1}`}
                  style={{ width: ancho, padding: '4px 8px', fontSize: 13 }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (campo === 'fecha') { if ((v || null) !== (c.fecha ?? null)) setCambios((x) => ({ ...x, [i]: { ...x[i], fecha: v || null } })); return; }
                    const n = numero(v);
                    if (n == null || !(n > 0)) { e.target.value = valor; return; }
                    const clave = campo === 'usd' || !c.moneda ? 'monto_usd' : 'monto_original';
                    setCambios((x) => ({ ...x, [i]: { ...x[i], [clave]: n } }));
                  }} />
              );
              return (
                <li key={i} style={{ ...fila, opacity: cobrada ? 0.65 : 1 }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', minWidth: 22 }}>{i + 1}</span>
                  {cobrada
                    ? <span style={{ color: 'var(--dim)' }}>Cobrada · {plataDe(armadaDe(cobrada))}</span>
                    : <>
                        {celda('fecha', c.fecha ?? '', 150)}
                        {c.moneda ? <>{celda('monto', String(c.monto_original ?? ''), 110)}<span style={{ color: 'var(--dim)' }}>{c.moneda} ·</span>{celda('usd', String(c.monto_usd), 90)}<span style={{ color: 'var(--dim)' }}>USD</span></>
                          : <>{celda('monto', String(c.monto_usd), 110)}<span style={{ color: 'var(--dim)' }}>USD</span></>}
                        {aMano && <span style={{ fontSize: 12, color: 'var(--primary)' }}>a mano</span>}
                      </>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {encima && !encima.ok && <span style={{ fontSize: 13, color: 'var(--warn)' }}>{encima.error}</span>}
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
          pasarelas={opciones.pasarelas} cuentas={opciones.cuentas} productos={opciones.productos} onCreado={() => refrescarCobros(lead.id)} />
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
  // Mirando un CRM agregado (./trato.ts), sólo los cobros de la pasarela de SUS cuotas: los de la venta de la casa (o un link
  // suelto, que entra a la casa) no son movimientos de la renovación. Y mirando la casa, sin los de las cuotas de sus
  // renovaciones (revisión del 22/10/2026).
  const deEste = ctx.crm ? cobrosDelTrato(cobros ?? [], ctx.data.pagos) : cobrosSinLosDe(cobros ?? [], (ctx.data.tratos ?? []).flatMap((t) => t.pagos));
  const { movimientos, avisos } = movimientosDelLead({ pagos: ctx.data.pagos, cobros: deEste });
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
                <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>{fechaEnPalabras(m.fecha, ctx.hoy)}</span>
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
// Venta
// ─────────────────────────────────────────────────────────────────────────────

const TIPOS: ReadonlyArray<{ id: VentaTipo; nombre: string }> = [
  { id: 'unico', nombre: 'Pago único' }, { id: 'suscripcion', nombre: 'Suscripción' }, { id: 'sin_cobro', nombre: 'Sin cobro' },
];
const caja: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, padding: '11px 14px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', minWidth: 0 };
const etiqueta: CSSProperties = { fontSize: 12, color: 'var(--dim)' };

export function Venta({ ctx, titulo, diseno, editando: personalizando }: PropsBloque) {
  const { lead } = ctx;
  // Sin el trato del CRM leído, la venta se ve y no se edita (`sinTratoLeido`).
  const editando = personalizando || sinTratoLeido(ctx);
  const { toast, show, clear } = useToast();
  const [pending, start] = useTransition();
  const tipo: VentaTipo = (lead.venta_tipo as VentaTipo | null) ?? 'unico';
  const esSus = tipo === 'suscripcion';
  // Mirando un CRM agregado (./trato.ts): la venta es la de ESE CRM, y sin suscripción (una mensualidad es de la casa).
  const crm = ctx.crm?.id ?? null;
  const tipos = crm != null ? TIPOS.filter((t) => t.id !== 'suscripcion') : TIPOS;

  const guardar = (c: Parameters<typeof guardarVentaAction>[1], patch: Record<string, unknown>) =>
    guardarVentaAction(lead.id, c, { tipoVisto: tipo, crm }).then((r) => {
      if (!r.ok) return r.error;
      ctx.parchear({ ...patch, venta_tipo: r.ventaTipo });
      const atras = r.deshacer;
      if (r.cambio) show('Guardado', () => { void deshacerVenta(lead.id, atras, r.ventaTipo, crm).then(() => ctx.releer()); });
      return null;
    });
  /** Cambiar el tipo. DESDE «Sin cobro» se sale por su propia acción (compare-and-set), y después al tipo elegido. */
  const cambiarTipo = (nuevo: VentaTipo) => start(async () => {
    if (nuevo === tipo) return;
    // En un CRM agregado, salir de «Sin cobro» también es la venta de ese CRM: el server lo hace con su compare-and-set.
    if (tipo === 'sin_cobro' && crm == null) {
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
  const botonesTipo = (
    <div role="group" aria-label="Tipo de venta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {tipos.map((t) => (
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
      {botonesTipo}
      <Toast state={toast} onClose={clear} />
    </Tarjeta>
  );
}
