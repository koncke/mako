// =============================================================================
// /general — FOCUS: qué hay que hacer ahora, y si vamos bien
// =============================================================================
// ⚠️ ESTA PANTALLA CAMBIÓ DE TRABAJO, y el orden de los bloques ES el cambio.
//
// Antes medía sólo RESULTADOS: el hero «Camino a los N cierres», el resumen del
// mes, el semáforo y los pendientes. Todo consecuencias — cosas que ya pasaron y
// sobre las que hoy no se puede actuar. Las seis reglas del Semáforo alertan sobre
// resultados; ninguna sobre una acción que se cumple o no día a día.
//
// Ahora, de arriba abajo:
//
//   1. TIRA DEL Q   el norte en UNA línea, con la capacidad instalada al lado
//   2. AHORA        LA acción prioritaria con sus seis campos y su origen
//   3. KPIs         lo que se hace o no se hace en el período   ← lo nuevo
//   4. lo de antes  semáforo, mes y pendientes, plegados
//
// Nada se borró: lo que medía resultados sigue entero, un escalón más abajo.
//
// La columna vertebral que lo sostiene (Q → Objective → KPI) vive en
// `lib/objectives*.ts`; la elección de LA acción, en `lib/focus.ts`, que es puro y
// testeable. Acá sólo se lee y se pinta.
// =============================================================================

import Link from '@/app/_ui/Link';
import type { CSSProperties } from 'react';
import {
  getResumenComparativo,
  getPendientesDeMarcar,
  getResumenComercialMaduras,
  getFatigaAdsets,
  getTramoJ1J2Reciente,
  getAgendasBreakdown,
  getSenalesRecon,
  compareMTD,
  type ResumenComparativo,
  type Pendientes,
  type MetricaMTD,
  type AgendaItem,
  type SenalRecon,
} from '@/lib/queries';
import { fmtUSD, fmtNum } from '@/lib/format';
import { DIAS_J1_J2_ALERTA } from '@/lib/config';
import { getCuotasPendientes, getRevenueBreakdowns, type RevItem, type RevenueBreakdowns } from '@/lib/pagos';
import { getMetaAccountHealth } from '@/lib/meta-health';
import { getDataSources } from '@/lib/sources';
import { listTareas } from '@/lib/todo';
import { getDiagnosticoFase } from '@/lib/fase-store';
import {
  quarterActual, listObjectives, avanceDeObjetivo, getTableroKpis, getCapacidad,
  proponerKpis, migrarSettingsAObjectives, type ObjectiveConAvance, type KpiEnTablero,
} from '@/lib/objectives';
import { elegirFoco, type AlertaParaFoco } from '@/lib/focus';
import { DesgloseTrigger, type DesgloseItem, type DesgloseData } from '../_components/Desglose';
import { Icon } from '../_components/icons';
import { requireRolWs } from '@/lib/tab-access';
import { pendientesOnboarding } from '@/lib/onboarding-pendientes';
import { TiraQ } from './TiraQ';
import { Ahora } from './Ahora';
import { KpisCard, type KpiVista, type CandidatoVista } from './KpisCard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function fmtDMY(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function revItemsToDesglose(items: RevItem[], fechaLabel: string, focus = 'plan-pagos'): DesgloseItem[] {
  return items.map((it) => ({
    nombre: it.nombre,
    valor: fmtUSD(it.monto),
    detalle: `${it.detalle ? `${it.detalle} · ` : ''}${fechaLabel} ${fmtDMY(it.fecha)}`,
    leadId: it.leadId,
    focus,
  }));
}

type Nivel = 'rojo' | 'ambar' | 'verde';
type Alerta = { nivel: Nivel; titulo: string; detalle: string; href: string; hrefLabel: string; desglose?: DesgloseData };

export default async function GeneralPage() {
  await requireRolWs([], { nav: 'general' });

  // ⚠️ LA MIGRACIÓN VA PRIMERO Y NO ROMPE NADA SI FALLA. Convierte los tres
  // settings viejos (`objetivo_cash_usd`, `objetivo_cierres`, `objetivo_desde`) en
  // los primeros objetivos del Q. Deja su propia marca y sale temprano, así que a
  // partir de la segunda visita es UNA lectura de setting.
  //
  // Corre en el render y no en un cron a propósito: sin objetivos esta pantalla no
  // tiene nada que decir, y el momento en que hace falta es exactamente cuando
  // alguien la abre. Va en su propio try porque una migración que falla no puede
  // dejar la pantalla en blanco.
  try { await migrarSettingsAObjectives(); } catch { /* la pantalla funciona igual, sin el objetivo migrado */ }

  const { qt, hoy, progreso } = await quarterActual();
  const ayer = (() => { const d = new Date(`${hoy}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();

  const [objR, kpisR, capR, compR, pendR, madR, fatR, tramoR, cuotasR, saludR, fuentesR, tareasR, faseR] =
    await Promise.allSettled([
      listObjectives(qt),
      getTableroKpis(hoy),
      getCapacidad(hoy),
      getResumenComparativo(ayer),
      getPendientesDeMarcar(hoy),
      getResumenComercialMaduras(),
      getFatigaAdsets(hoy),
      getTramoJ1J2Reciente(hoy, 60),
      getCuotasPendientes(hoy),
      getMetaAccountHealth(),
      getDataSources(),
      listTareas(),
      getDiagnosticoFase(),
    ]);

  const objetivosBase = objR.status === 'fulfilled' ? objR.value : [];
  const kpis: KpiEnTablero[] = kpisR.status === 'fulfilled' ? kpisR.value : [];
  const capacidad = capR.status === 'fulfilled' ? capR.value
    : { cupo: null, activos: 0, libres: null, ocupacionPct: null, mesesEntrega: 4, error: 'no pude leer la capacidad' };
  const comparativo = compR.status === 'fulfilled' ? compR.value : null;
  const pendientes: Pendientes = pendR.status === 'fulfilled' ? pendR.value : { items: [], total: 0, porTipo: { A: 0, B: 0, C: 0, M: 0, R: 0 } };
  const maduras = madR.status === 'fulfilled' ? madR.value : null;
  const fatiga = fatR.status === 'fulfilled' ? fatR.value : [];
  const tramo = tramoR.status === 'fulfilled' ? tramoR.value : { promedio: null, n: 0 };
  const cuotas = cuotasR.status === 'fulfilled' ? cuotasR.value : { vencidas: [], porVencer: [] };
  const saludMeta = saludR.status === 'fulfilled' ? saludR.value : null;
  const fuentes = fuentesR.status === 'fulfilled' ? fuentesR.value : [];
  const tareas = tareasR.status === 'fulfilled' ? tareasR.value : [];
  const fase = faseR.status === 'fulfilled' ? faseR.value : null;

  // El avance de cada objetivo se lee de los datos, nunca de una columna guardada.
  const objetivos: ObjectiveConAvance[] = await Promise.all(
    objetivosBase.map((o) => avanceDeObjetivo(o, hoy)),
  ).catch(() => [] as ObjectiveConAvance[]);

  // La propuesta de KPIs sólo se calcula si hace falta: con KPIs cargados es una
  // pantalla que nadie va a ver, y son dos lecturas (funnel + fase).
  let candidatos: CandidatoVista[] = [];
  if (kpis.length === 0) {
    try {
      candidatos = (await proponerKpis()).map((c) => ({
        nombre: c.nombre, porque: c.porque, cadencia: c.cadencia,
        compromiso: c.compromiso, unidad: c.unidad, fuente: c.fuente,
      }));
    } catch { /* sin propuesta, el vacío ofrece crear el primero a mano */ }
  }

  // Desgloses del bloque plegado, en una sola ola.
  const mtd = compareMTD(ayer);
  let mtdBreak: RevenueBreakdowns = { sold: [], cash: [], outstanding: [] };
  let agendasMTD: AgendaItem[] = [];
  let senalesMTD: SenalRecon[] = [];
  try {
    const [mtdB, agMTD, senMTD] = await Promise.all([
      getRevenueBreakdowns(mtd.actualInicio, mtd.actualFin),
      getAgendasBreakdown(mtd.actualInicio, mtd.actualFin),
      getSenalesRecon(mtd.actualInicio, mtd.actualFin),
    ]);
    mtdBreak = mtdB; agendasMTD = agMTD; senalesMTD = senMTD;
  } catch {
    // degradación elegante: las cards muestran los números sin desglose.
  }

  // ── Semáforo: las mismas seis reglas de siempre ──
  const alertas: Alerta[] = [];

  const pendArranque = await pendientesOnboarding().then((r) => ({ ok: true as const, r }), () => ({ ok: false as const, r: [] }));
  if (!pendArranque.ok) {
    alertas.push({
      nivel: 'ambar',
      titulo: 'No pude chequear qué te quedó pendiente del arranque',
      detalle: 'Puede que tengas una conexión sin terminar y no lo esté viendo. Revisa Integraciones.',
      href: '/integraciones', hrefLabel: 'Integraciones',
    });
  }
  for (const pend of pendArranque.r) {
    alertas.push({
      nivel: 'ambar',
      titulo: `Te quedó pendiente: ${pend.que.toLowerCase()}`,
      detalle: 'Lo dejaste para después durante tu arranque. Mientras no esté, MaKo trabaja con la mitad de los datos de tu negocio.',
      href: pend.ruta, hrefLabel: pend.donde,
    });
  }
  if (saludMeta && saludMeta.severidad !== 'verde') {
    const esRojo = saludMeta.severidad === 'rojo';
    const saldo = saludMeta.balanceMxn > 0
      ? `Adeudo ~${saludMeta.balanceMxn.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN${saludMeta.fundingCard ? ` (${saludMeta.fundingCard})` : ''}. `
      : '';
    alertas.push({
      nivel: esRojo ? 'rojo' : 'ambar',
      titulo: esRojo
        ? `Cuenta de Meta: ${saludMeta.statusLabel} — entrega frenada`
        : `Cuenta de Meta: ${saludMeta.statusLabel} — vigilar`,
      detalle: esRojo
        ? `${saldo}Los anuncios figuran ACTIVOS pero la cuenta no está entregando${saludMeta.disableReasonLabel ? ` (${saludMeta.disableReasonLabel})` : ''}. Regulariza el pago en Meta cuanto antes.`
        : `Estado de cuenta "${saludMeta.statusLabel}". La entrega puede estar limitada — revisa el Business Manager.`,
      href: '/marketing/salud', hrefLabel: 'Estado de Meta',
    });
  }
  const cuotaItems = (arr: typeof cuotas.vencidas): DesgloseItem[] => arr.map((c) => ({
    nombre: c.lead_nombre,
    valor: fmtUSD(c.monto_usd),
    detalle: `cuota ${c.numero === 0 ? 'inicial' : c.numero} · vence ${fmtDMY(c.fecha_esperada)} · ${c.dias < 0 ? `${Math.abs(c.dias)}d vencida` : c.dias === 0 ? 'vence hoy' : `en ${c.dias}d`}`,
    leadId: c.lead_id,
    focus: 'plan-pagos',
  }));
  if (cuotas.vencidas.length > 0) {
    const tot = cuotas.vencidas.reduce((s, c) => s + c.monto_usd, 0);
    const n = cuotas.vencidas.length;
    alertas.push({
      nivel: 'rojo',
      titulo: `${n} cuota${n === 1 ? '' : 's'} VENCIDA${n === 1 ? '' : 'S'} — cobrar URGENTE (${fmtUSD(tot)})`,
      detalle: `Pagos vencidos sin cobrar (ej: ${cuotas.vencidas[0].lead_nombre}, ${Math.abs(cuotas.vencidas[0].dias)}d de atraso). Cóbralos cuanto antes.`,
      href: '/comercial', hrefLabel: 'Comercial',
      desglose: { label: 'Cuotas vencidas', value: fmtUSD(tot), color: 'var(--bad)', items: cuotaItems(cuotas.vencidas), emptyText: 'Sin cuotas vencidas.' },
    });
  }
  if (cuotas.porVencer.length > 0) {
    const n = cuotas.porVencer.length;
    const tot = cuotas.porVencer.reduce((s, c) => s + c.monto_usd, 0);
    alertas.push({
      nivel: 'ambar',
      titulo: `${n} cuota${n === 1 ? '' : 's'} por cobrar pronto`,
      detalle: `Vencen en los próximos días (ej: ${cuotas.porVencer[0].lead_nombre}, en ${cuotas.porVencer[0].dias}d). Ten listo el seguimiento de cobro.`,
      href: '/comercial', hrefLabel: 'Comercial',
      desglose: { label: 'Cuotas por vencer', value: fmtUSD(tot), color: 'var(--warn-fill)', items: cuotaItems(cuotas.porVencer), emptyText: 'Sin cuotas por vencer.' },
    });
  }
  if (tramo.n >= 3 && tramo.promedio !== null && tramo.promedio > DIAS_J1_J2_ALERTA) {
    alertas.push({
      nivel: 'ambar',
      titulo: `Los deals se enfrían entre R1 y R2 (${tramo.promedio.toFixed(1)} días prom.)`,
      detalle: 'Cuanto más tarda la R2, más cae la intención. Agenda la R2 en la misma R1, en vivo.',
      href: '/comercial', hrefLabel: 'Comercial',
    });
  }
  for (const a of fatiga) {
    alertas.push({
      nivel: 'ambar',
      titulo: `Posible fatiga de creativo · ${a.adset_name}`,
      detalle: `Frecuencia 7d ${a.frequency_7d.toFixed(1)} y el costo por lead subió (${fmtUSD(a.cpl_7d_usd)} vs ${fmtUSD(a.cpl_28d_usd)} a 28 días). Rota el creativo.`,
      href: '/marketing', hrefLabel: 'Marketing',
    });
  }
  if (maduras && maduras.tasa_cierre_madura !== null && maduras.limpias >= 3) {
    if (maduras.tasa_cierre_madura >= 30) {
      alertas.push({
        nivel: 'verde',
        titulo: 'El sistema de venta está sano',
        detalle: 'El ratio de cierre maduro es saludable. Para más cierres, el foco es marketing: más volumen o mejor calidad.',
        href: '/comercial', hrefLabel: 'Comercial',
      });
    } else if (maduras.tasa_cierre_madura < 20) {
      alertas.push({
        nivel: 'rojo',
        titulo: `Tasa de cierre baja: ${maduras.tasa_cierre_madura.toFixed(0)}% en cohortes maduras`,
        detalle: 'Califican pero no cierran. Revisa la oferta y el manejo de objeciones en la R2.',
        href: '/comercial', hrefLabel: 'Comercial',
      });
    }
  }

  const peso: Record<Nivel, number> = { rojo: 0, ambar: 1, verde: 2 };
  alertas.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
  const urgentes = alertas.filter((a) => a.nivel === 'rojo').length;

  // ⚠️ TAREA #165 — el semáforo no puede certificar la salud de un negocio del que
  // no sabe nada. Con cero fuentes comerciales conectadas ninguna de las seis
  // reglas empuja una alerta, y el veredicto caía al verde final: «El negocio está
  // sano». Es el peor primer contacto posible — luz verde a alguien que todavía no
  // conectó nada, y eso se lleva puesta la credibilidad del resto del tablero.
  //
  // `lib/sources.ts` ya distingue «la fuente no está» de «la fuente dice cero»; lo
  // único que faltaba era que esta pantalla la mirara.
  // ⚠️ SE MIRA `lastSync`, NO `status`. Medido el 06/09/2026 sobre un workspace sin
  // un solo dato: la primera versión de esto preguntaba `status !== 'off'` y el
  // veredicto salió VERDE igual — el bug que venía a arreglar, otra vez.
  //
  // La causa: de las cinco fuentes, `calendly` y `vsl_beacon` devuelven `'stale'`
  // cuando NUNCA hubo un dato (`lib/sources.ts:101` y `:129`), no `'off'`. O sea que
  // «conectada pero sin datos recientes» y «nunca entregó nada» comparten valor en
  // dos de las cinco, y contarlas por el estado daba 2 conectadas sobre un
  // workspace vacío.
  //
  // `lastSync` no tiene esa ambigüedad: es la fecha del último dato real, o null
  // porque no hubo ninguno. La pregunta que hay que hacer es «¿alguna fuente entregó
  // algo alguna vez?», y ésa es la columna que la contesta.
  const conDatos = fuentes.filter((f) => f.lastSync !== null);
  const sinFuentes = fuentes.length > 0 && conDatos.length === 0;

  // ── LA acción prioritaria ──
  const tituloObjetivo = new Map(objetivos.map((o) => [o.id, o.titulo]));
  const foco = elegirFoco({
    kpis: kpis.map((k) => ({
      id: k.id, nombre: k.nombre, estado: k.estado, cadencia: k.cadencia,
      compromiso: k.compromiso, unidad: k.unidad, valor: k.valor,
      fuente: k.fuente, fuenteId: k.fuenteId,
      objetivoTitulo: k.objectiveId ? (tituloObjetivo.get(k.objectiveId) ?? null) : null,
      orden: k.orden,
    })),
    alertas: alertas as AlertaParaFoco[],
    tareas: tareas
      .filter((t) => t.estado !== 'hecho')
      .map((t) => ({ titulo: t.titulo, score: t.score, progreso: t.progreso, deadline: t.deadline, haceloEn: null })),
    objetivos: objetivos.length,
    cuello: fase?.cuello ?? null,
    hoy,
  });

  // Cuántas alertas quedan para el plegado, sacando la que ya es el titular.
  const restantes = alertas.length - (foco.alertaIdx === null ? 0 : 1);

  const mtdDesgloses: Record<string, DesgloseData> = {
    'Ad Spend': {
      label: 'Ad Spend del mes · por anuncio',
      value: fmtUSD(senalesMTD.reduce((s, a) => s + a.spend_usd, 0)),
      color: 'var(--ink)',
      items: senalesMTD.filter((s) => s.spend_usd > 0).sort((a, b) => b.spend_usd - a.spend_usd).map((s) => ({
        nombre: s.ad_name,
        valor: fmtUSD(s.spend_usd),
        detalle: [s.campana, s.adset_name].filter(Boolean).join(' · ') || undefined,
      })),
      emptyText: 'Sin gasto a nivel anuncio este mes.',
    },
    Cierres: {
      label: 'Cierres del mes',
      value: String(mtdBreak.sold.length),
      color: 'var(--ink)',
      items: revItemsToDesglose(mtdBreak.sold, 'cierre', 'plan-pagos'),
      emptyText: 'Sin cierres este mes.',
    },
    'Cash Collected': {
      label: 'Cash Collected del mes',
      value: fmtUSD(mtdBreak.cash.reduce((s, i) => s + i.monto, 0)),
      color: 'var(--good)',
      items: revItemsToDesglose(mtdBreak.cash, 'pago', 'plan-pagos'),
      emptyText: 'Sin cobros este mes.',
    },
    Agendas: {
      label: 'Agendas del mes · R1 en el período (CRM)',
      value: String(agendasMTD.length),
      color: 'var(--ink)',
      items: agendasMTD.map((a) => ({
        nombre: a.nombre, valor: fmtDMY(a.fecha), detalle: a.empresa ?? undefined,
        leadId: a.leadId, focus: 'datos-comerciales',
      })),
      emptyText: 'Sin agendas este mes.',
    },
  };

  const kpisVista: KpiVista[] = kpis.map((k) => ({
    id: k.id, nombre: k.nombre, cadencia: k.cadencia, compromiso: k.compromiso,
    unidad: k.unidad, fuente: k.fuente, fuenteId: k.fuenteId, objectiveId: k.objectiveId,
    valor: k.valor, error: k.error, estado: k.estado, pct: k.pct,
    umbralVerde: k.umbralVerde, umbralAmbar: k.umbralAmbar,
  }));

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 26 }}>
        <h1 style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12, fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>
          <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="general" size={34} /></span>
          General
        </h1>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)' }}>
        <TiraQ progreso={progreso} objetivos={objetivos} capacidad={capacidad} anio={qt.anio} quarter={qt.q} />

        <Ahora foco={foco} />

        <KpisCard
          kpis={kpisVista}
          candidatos={candidatos}
          objetivos={objetivos.map((o) => ({ id: o.id, titulo: o.titulo }))}
          objetivoPrincipalId={objetivos[0]?.id ?? null}
        />

        {/* ⚠️ EL RESUMEN CUENTA LO QUE SE VA A VER, no todas las alertas. La que ya
            es el titular no se lista adentro, así que anunciarla acá prometería una
            fila que no está — y el conteo de un plegable existe justamente para
            decidir si vale la pena abrirlo. */}
        <Plegable
          titulo="Semáforo"
          resumen={sinFuentes ? 'no puedo opinar todavía' : restantes === 0 ? 'nada más' : `${restantes}`}
          abiertoPorDefecto={false}
        >
          <Semaforo alertas={alertas} sinFuentes={sinFuentes} saltar={foco.alertaIdx} />
        </Plegable>

        {comparativo && (
          <Plegable titulo="El mes" resumen="">
            <ResumenMes c={comparativo} desgloses={mtdDesgloses} />
          </Plegable>
        )}

        <Plegable
          titulo="Pendientes"
          resumen={pendientes.total > 0 ? `${pendientes.total}` : 'al día'}
          abiertoPorDefecto={false}
        >
          <PendientesCard pendientes={pendientes} />
        </Plegable>

      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El plegable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que antes ocupaba la pantalla entera y ahora vive un escalón abajo.
 *
 * ⚠️ PLEGADO NO ES ESCONDIDO. La regla de la casa lo dice para la barra lateral y
 * vale igual acá: lo que se pliega lleva rótulo y una línea de RESUMEN con el dato
 * que importa, así se sabe si vale la pena abrirlo sin abrirlo. Y lo que tiene algo
 * urgente adentro nace abierto.
 *
 * `<details>` nativo y no un estado de React: funciona sin JS, lo maneja el
 * teclado solo, y no hay ningún `useState` que se pierda al refrescar.
 */
function Plegable({ titulo, resumen, abiertoPorDefecto = false, children }: {
  titulo: string;
  resumen: string;
  abiertoPorDefecto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={abiertoPorDefecto} style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <summary style={{
        cursor: 'pointer', listStyle: 'revert',
        display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
        padding: '4px 0', color: 'var(--ink)',
      }}>
        <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em' }}>{titulo}</span>
        {/* El resumen es un DATO («3 urgentes»), nunca un explicador de qué hay
            adentro. Un rótulo que parafrasea al título es el subtítulo que la
            regla de la casa prohíbe, y acá además ocupa el renglón que sirve
            para saber si vale la pena abrir. */}
        {resumen && <span style={{ fontSize: 13.5, color: 'var(--dim)' }}>{resumen}</span>}
      </summary>
      <div style={{ marginTop: 14 }}>{children}</div>
    </details>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Los bloques de siempre
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El mes, comparado — barras, no tres renglones de texto por métrica.
 *
 * ⚠️ CADA TARJETA TENÍA TRES NÚMEROS EN PROSA: el actual, «mismo período de
 * agosto: X» y «proyección: Y». Doce renglones de texto para cuatro métricas.
 * Ahora la comparación se VE: dos barras por métrica —este mes y el anterior— a
 * la misma escala. Cuál subió y cuál bajó se lee sin leer.
 *
 * La proyección se fue: es una estimación lineal sobre un mes a medio correr, y
 * ocupaba el mismo peso visual que un dato medido. Un número inventado no puede
 * verse igual que uno real.
 */
function ResumenMes({ c, desgloses }: { c: ResumenComparativo; desgloses: Record<string, DesgloseData> }) {
  const items: Array<{ label: string; m: MetricaMTD; f: (n: number) => string; invertir?: boolean }> = [
    { label: 'Ad Spend', m: c.inversion_usd, f: fmtUSD, invertir: true },
    { label: 'Agendas', m: c.agendas, f: fmtNum },
    { label: 'Cierres', m: c.cierres, f: fmtNum },
    { label: 'Cash Collected', m: c.cash_usd, f: fmtUSD },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 26 }}>
      {items.map((it) => {
        const dg = desgloses[it.label];
        // La escala la fija el MAYOR de los dos, así las dos barras de una misma
        // métrica se comparan entre sí. No se comparte escala entre métricas: el
        // spend y los cierres no viven en el mismo orden de magnitud.
        const tope = Math.max(it.m.actual, it.m.anterior, 1);
        const sube = it.m.actual > it.m.anterior;
        const igual = it.m.actual === it.m.anterior;
        const color = igual ? 'var(--faint)' : it.invertir ? 'var(--dim)' : sube ? 'var(--good)' : 'var(--bad)';
        const inner = (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 24, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{it.f(it.m.actual)}</span>
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>{it.label}</span>
            </div>
            {/* Dos barras: arriba este mes, abajo el anterior en gris. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ display: 'block', height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', borderRadius: 999, width: `${Math.min(100, (it.m.actual / tope) * 100)}%`, background: color }} />
              </span>
              <span style={{ display: 'block', height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', borderRadius: 999, width: `${Math.min(100, (it.m.anterior / tope) * 100)}%`, background: 'var(--border-strong)' }} />
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 7 }}>
              {c.etiqueta_anterior}: {it.f(it.m.anterior)}
            </div>
          </>
        );
        return dg
          ? <DesgloseTrigger key={it.label} data={dg} style={{ cursor: 'pointer' }}>{inner}</DesgloseTrigger>
          : <div key={it.label}>{inner}</div>;
      })}
    </div>
  );
}

function Semaforo({ alertas, sinFuentes, saltar }: {
  alertas: Alerta[];
  sinFuentes: boolean;
  /** El índice de la alerta que ya es el titular de la pantalla. */
  saltar: number | null;
}) {
  // ⚠️ El estado «no puedo opinar» (#165) va ANTES que cualquier alerta: cuando no
  // hay una sola fuente conectada, lo que sigue no se sostiene.
  if (sinFuentes) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, color: 'var(--dim)' }}>
          Sin fuentes conectadas no puedo opinar de tu negocio.
        </span>
        <Link href="/integraciones" style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
          Conectar →
        </Link>
      </div>
    );
  }

  const visibles = alertas.filter((_, i) => i !== saltar);
  if (visibles.length === 0) {
    return <span style={{ fontSize: 15, color: 'var(--dim)' }}>Nada más que atender.</span>;
  }

  return (
    <div>
      {visibles.map((a, i) => {
        const c = a.nivel === 'rojo' ? 'var(--bad)' : a.nivel === 'ambar' ? 'var(--warn-fill)' : 'var(--good)';
        const inner = (
          <>
            <span aria-hidden style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', background: c }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
            <span style={{ flex: 'none', color: 'var(--faint)', fontSize: 14 }}>→</span>
          </>
        );
        const fila: CSSProperties = {
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          padding: '11px 0', textDecoration: 'none',
          borderTop: i === 0 ? 'none' : '1px solid var(--border)',
        };
        return a.desglose
          ? <DesgloseTrigger key={i} data={a.desglose} style={fila}>{inner}</DesgloseTrigger>
          : <Link key={i} href={a.href} style={fila}>{inner}</Link>;
      })}
    </div>
  );
}

/**
 * Pendientes — una línea.
 *
 * ⚠️ Dibujaba CUATRO tarjetas fijas y en la pantalla real tres decían 0. Una
 * tarjeta que dice cero no informa: ocupa el lugar de la que sí. Se muestran sólo
 * los tipos con algo adentro, y si no hay ninguno el bloque es una sola frase.
 */
function PendientesCard({ pendientes }: { pendientes: Pendientes }) {
  const tipos = [
    { n: pendientes.porTipo.A, l: 'sin asistencia a R1' },
    { n: pendientes.porTipo.B, l: 'sin R2 ni resolución' },
    { n: pendientes.porTipo.C, l: 'sin asistencia a R2' },
    { n: pendientes.porTipo.M, l: 'nutrición manual vencida' },
  ].filter((x) => x.n > 0);

  if (pendientes.total === 0) {
    return <span style={{ fontSize: 15, color: 'var(--dim)' }}>Todo marcado — el tablero es confiable.</span>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 15, color: 'var(--dim)' }}>
        {tipos.map((t) => `${t.n} ${t.l}`).join(' · ')}
      </span>
      <Link href="/crm" style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
        Marcar →
      </Link>
    </div>
  );
}
