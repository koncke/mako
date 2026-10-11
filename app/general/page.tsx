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
import { estaPendiente } from '@/lib/todo-estados';
import { getDiagnosticoFase } from '@/lib/fase-store';
import {
  quarterActual, listObjectives, avanceDeObjetivo, getTableroKpis, getCapacidad,
  proponerKpis, migrarSettingsAObjectives, type ObjectiveConAvance, type KpiEnTablero,
} from '@/lib/objectives';
import { elegirObjetivoPrincipal, ES_PLATA, METRICA_LABEL } from '@/lib/objectives-modelo';
import { elegirFoco, type AlertaParaFoco } from '@/lib/focus';
import { DesgloseTrigger, type DesgloseItem, type DesgloseData } from '../_components/Desglose';
import { Icon } from '../_components/icons';
import { requireRolWs } from '@/lib/tab-access';
import { pendientesOnboarding } from '@/lib/onboarding-pendientes';
import { Cabecera } from './Cabecera';
import { KpisCard, type KpiVista, type CandidatoVista } from './KpisCard';

/** La fórmula de una sección de este producto. Literal, y la misma de /comercial y /marketing. */
const SECCION: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  padding: 'var(--card-pad)',
};

/** El título de una sección. 25px es el de las vecinas: /general se lee como hermana o no. */
const H2: CSSProperties = {
  fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)',
};

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
      href: '/dashboard?hoja=comercial', hrefLabel: 'Comercial',
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
      href: '/dashboard?hoja=comercial', hrefLabel: 'Comercial',
      desglose: { label: 'Cuotas por vencer', value: fmtUSD(tot), color: 'var(--warn-fill)', items: cuotaItems(cuotas.porVencer), emptyText: 'Sin cuotas por vencer.' },
    });
  }
  if (tramo.n >= 3 && tramo.promedio !== null && tramo.promedio > DIAS_J1_J2_ALERTA) {
    alertas.push({
      nivel: 'ambar',
      titulo: `Los deals se enfrían entre R1 y R2 (${tramo.promedio.toFixed(1)} días prom.)`,
      detalle: 'Cuanto más tarda la R2, más cae la intención. Agenda la R2 en la misma R1, en vivo.',
      href: '/dashboard?hoja=comercial', hrefLabel: 'Comercial',
    });
  }
  for (const a of fatiga) {
    alertas.push({
      nivel: 'ambar',
      titulo: `Posible fatiga de creativo · ${a.adset_name}`,
      detalle: `Frecuencia 7d ${a.frequency_7d.toFixed(1)} y el costo por lead subió (${fmtUSD(a.cpl_7d_usd)} vs ${fmtUSD(a.cpl_28d_usd)} a 28 días). Rota el creativo.`,
      href: '/dashboard?hoja=marketing', hrefLabel: 'Marketing',
    });
  }
  if (maduras && maduras.tasa_cierre_madura !== null && maduras.limpias >= 3) {
    if (maduras.tasa_cierre_madura >= 30) {
      alertas.push({
        nivel: 'verde',
        titulo: 'El sistema de venta está sano',
        detalle: 'El ratio de cierre maduro es saludable. Para más cierres, el foco es marketing: más volumen o mejor calidad.',
        href: '/dashboard?hoja=comercial', hrefLabel: 'Comercial',
      });
    } else if (maduras.tasa_cierre_madura < 20) {
      alertas.push({
        nivel: 'rojo',
        titulo: `Tasa de cierre baja: ${maduras.tasa_cierre_madura.toFixed(0)}% en cohortes maduras`,
        detalle: 'Califican pero no cierran. Revisa la oferta y el manejo de objeciones en la R2.',
        href: '/dashboard?hoja=comercial', hrefLabel: 'Comercial',
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

  // ── El objetivo que manda ──
  // ⚠️ NO es `objetivos[0]`: `listObjectives` mezcla a propósito los ANUALES con los
  // del Q, así que el primero por `orden` puede ser el del AÑO, y la cabecera estaría
  // mostrando el número del año arriba de una pantalla que habla del trimestre. La
  // regla de selección vive en el modelo, para que el hero y los KPIs nuevos elijan
  // el mismo — si eligen distinto, el compromiso cuelga de otra cosa que la meta.
  const objetivoPrincipal = elegirObjetivoPrincipal(objetivos);

  // El detalle lead por lead del número grande, y la OTRA métrica de plata del mismo
  // período. Sólo para objetivos de plata: `getRevenueBreakdowns` devuelve montos, y
  // colgarlo de un objetivo que cuenta reuniones abriría una lista de dinero debajo
  // de un número que no lo es. En su propio try: si falla, el hero muestra el número
  // y esconde el desglose — nunca se cae la pantalla por un detalle.
  let heroDesglose: DesgloseData | null = null;
  let heroComplemento: React.ComponentProps<typeof Cabecera>['complemento'] = null;
  if (objetivoPrincipal && ES_PLATA(objetivoPrincipal.metrica)) {
    try {
      const br = await getRevenueBreakdowns(objetivoPrincipal.desde, objetivoPrincipal.hasta);
      const esCash = objetivoPrincipal.metrica === 'cash_usd';
      const propios = esCash ? br.cash : br.sold;
      const otros = esCash ? br.sold : br.cash;
      heroDesglose = {
        label: `${METRICA_LABEL[objetivoPrincipal.metrica]} del período`,
        value: fmtUSD(propios.reduce((s, i) => s + i.monto, 0)),
        color: esCash ? 'var(--good)' : 'var(--ink)',
        items: revItemsToDesglose(propios, esCash ? 'pago' : 'cierre', 'plan-pagos'),
        emptyText: esCash ? 'Todavía no entró un pago en este período.' : 'Todavía no se firmó nada en este período.',
      };
      heroComplemento = {
        label: esCash ? 'Firmado' : 'Cobrado',
        valor: fmtUSD(otros.reduce((s, i) => s + i.monto, 0)),
        pie: esCash ? 'comprometido en contratos, aún no cobrado' : 'lo que efectivamente entró',
        desglose: {
          label: esCash ? 'Firmado en el período' : 'Cobrado en el período',
          value: fmtUSD(otros.reduce((s, i) => s + i.monto, 0)),
          color: esCash ? 'var(--ink)' : 'var(--good)',
          items: revItemsToDesglose(otros, esCash ? 'cierre' : 'pago', 'plan-pagos'),
          emptyText: esCash ? 'Sin cierres firmados en el período.' : 'Sin cobros en el período.',
        },
      };
    } catch {
      // El número grande no depende de esto: se pierde el detalle, no el dato.
    }
  }

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
      .filter((t) => estaPendiente(t.estado))
      .map((t) => ({ titulo: t.titulo, score: t.score, progreso: t.progreso, deadline: t.deadline, haceloEn: null })),
    objetivos: objetivos.length,
    cuello: fase?.cuello ?? null,
    // ⚠️ #165, la otra mitad. La guarda vivía sólo adentro del semáforo, así que con
    // objetivos y KPIs cargados sobre un workspace sin un solo dato el titular decía
    // «vas al día con todo lo que te comprometiste». Ahora el que elige también lo sabe.
    sinFuentes,
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

      {/* ⚠️ EL ORDEN ES EL DISEÑO, y sale de qué se puede HACER con cada bloque.
          Arriba lo que se decide hoy —el norte y la acción—; después el compromiso
          (KPIs); después el diagnóstico (semáforo); y al final la consecuencia (el
          mes, los pendientes), que describe lo que ya pasó.

          Los cuatro de abajo son SECCIONES EN TARJETA, como el resto del producto.
          El 07/09 esta pantalla quedó sin una sola superficie —la única de la app— y
          el dueño lo reportó como «se ve mucho peor, no se ve nada». El veto de la
          casa es contra apilar sub-tarjetas iguales ADENTRO de una sección, no contra
          la sección: la caja de afuera es lo que hace que /general se lea como una
          pantalla del mismo producto que /comercial. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)' }}>
        <Cabecera
          objetivo={objetivoPrincipal}
          foco={foco}
          capacidad={capacidad}
          progreso={progreso}
          anio={qt.anio}
          quarter={qt.q}
          desglose={heroDesglose}
          complemento={heroComplemento}
        />

        <section style={SECCION}>
          <KpisCard
            kpis={kpisVista}
            candidatos={candidatos}
            objetivos={objetivos.map((o) => ({ id: o.id, titulo: o.titulo }))}
            objetivoPrincipalId={objetivoPrincipal?.id ?? null}
          />
        </section>

        <section style={SECCION}>
          <h2 style={{ ...H2, marginBottom: 24 }}>Semáforo del negocio</h2>
          <Semaforo
            alertas={alertas}
            sinFuentes={sinFuentes}
            saltar={foco.alertaIdx}
            restantes={restantes}
            // `alDia === false` sólo se afirma cuando el avance se pudo LEER: con
            // `actual === null` no se sabe si va atrasado, y no saberlo no es ir mal.
            objetivoAtrasado={objetivoPrincipal?.actual !== null && objetivoPrincipal?.ritmo?.alDia === false}
          />
        </section>

        <section style={SECCION}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
            <h2 style={H2}>El mes</h2>
            {comparativo && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>vs. {comparativo.etiqueta_anterior}</span>}
          </div>
          {comparativo
            ? <ResumenMes c={comparativo} desgloses={mtdDesgloses} />
            // Esconder la sección escondería el fallo: el mes seguiría existiendo y la
            // pantalla no diría que no lo pudo leer.
            : <span style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)' }}>No pude leer el resumen del mes.</span>}
        </section>

        <section style={SECCION}>
          <PendientesCard pendientes={pendientes} />
        </section>
      </div>
    </main>
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
              {/* ⚠️ La barra recesiva va en `--faint`, no en `--border-strong`: medido,
                  --border-strong sobre --surface-2 da 1,23:1 — invisible. --faint da
                  2,46, que sigue abajo de 3, así que el valor del período anterior
                  TIENE que estar en texto acá abajo. El color nunca es el único
                  portador de un dato. */}
              <span style={{ display: 'block', height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', borderRadius: 999, width: `${Math.min(100, (it.m.anterior / tope) * 100)}%`, background: 'var(--faint)' }} />
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

/**
 * El semáforo — las tres lámparas y las alertas.
 *
 * ⚠️ LAS LÁMPARAS VOLVIERON EL 08/09/2026, POR PEDIDO DEL DUEÑO: «estaban bien
 * diseñadas». Son la síntesis gráfica —el nivel del negocio en un vistazo, que es el
 * test de la casa— y la pasada del 07/09 las sacó junto con lo que sí sobraba.
 *
 * ⚠️ Y LAS LÁMPARAS MIRAN `alertas`, LAS FILAS MIRAN `visibles`. Es la sutileza que
 * hace que esto no reintroduzca la mentira de la #165 por otra puerta: la lámpara
 * dice el estado del NEGOCIO, y las filas listan lo que queda por leer acá. Con una
 * sola alerta roja —que además es el titular de la cabecera— la lista queda vacía y
 * la lámpara tiene que seguir en ROJO: si contara sobre las visibles, saldría verde
 * mientras arriba dice «3 cuotas VENCIDAS». Por eso, cuando la lista queda corta
 * porque una subió al titular, se dice.
 *
 * Lo que NO volvió del semáforo viejo, y cada cosa por su motivo:
 *   · el párrafo de veredicto — repite lo que las lámparas ya dicen, y su rama verde
 *     es TEXTUALMENTE la mentira de la #165 («El negocio está sano») sobre un
 *     workspace sin un solo dato;
 *   · las tres píldoras de conteo — el mismo bit en un tercer lugar, al lado de las
 *     lámparas y de los puntos de cada fila;
 *   · el `detalle` de cada fila — medido el 07/09: el titular y la primera fila eran
 *     ~40 palabras idénticas;
 *   · el filete de 4 px de color por fila — veto duro de la casa, y la cuarta copia
 *     del mismo bit.
 */
function Semaforo({ alertas, sinFuentes, saltar, restantes, objetivoAtrasado }: {
  alertas: Alerta[];
  sinFuentes: boolean;
  /** El índice de la alerta que ya es el titular de la pantalla. */
  saltar: number | null;
  /** Cuántas alertas quedan para esta lista, sacando la que ya es titular. */
  restantes: number;
  /**
   * El objetivo del trimestre va por debajo de lo esperado a esta altura.
   *
   * ⚠️ NO ES UNA ALERTA MÁS —no agrega fila, porque el número ya está arriba en la
   * cabecera y repetirlo sería la duplicación que esta pantalla viene arrastrando—,
   * pero SÍ apaga el verde. Medido el 08/09/2026 sobre un workspace real: la cabecera
   * decía «Vas $15.217 abajo de lo esperado» y dos bloques más abajo la lámpara verde
   * certificaba que estaba todo bien. Las seis reglas del semáforo miran señales
   * operativas y ninguna mira el compromiso del trimestre, así que sin esto la
   * pantalla se contradice a sí misma en el mismo scroll.
   */
  objetivoAtrasado: boolean;
}) {
  const urgentes = alertas.filter((a) => a.nivel === 'rojo').length;
  const vigilar = alertas.filter((a) => a.nivel === 'ambar').length + (objetivoAtrasado ? 1 : 0);
  const visibles = alertas.filter((_, i) => i !== saltar);

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap' }}>
      {/* Las tres lámparas. `alignSelf: stretch` y NUNCA `height: 100%`: un porcentaje
          contra un alto indefinido no resuelve, Chrome lo tolera y Safari devuelve
          CERO — que con `overflow: hidden` es una caja en blanco. */}
      <div style={{
        flex: 'none', width: 88, alignSelf: 'stretch',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
        // El token, no el `#14161B` literal que tenía el viejo: la isla oscura de esta
        // pantalla y la de la cabecera tienen que ser el mismo material.
        background: 'var(--sidebar)', borderRadius: 18, padding: '18px 16px',
      }}>
        <Lampara color="var(--bad)" encendida={!sinFuentes && urgentes > 0} />
        <Lampara color="var(--warn-fill)" encendida={!sinFuentes && urgentes === 0 && vigilar > 0} />
        <Lampara color="var(--good)" encendida={!sinFuentes && urgentes === 0 && vigilar === 0} />
      </div>

      <div style={{ flex: 1, minWidth: 280 }}>
        {/* ⚠️ El estado «no puedo opinar» (#165) va ANTES que cualquier alerta: cuando
            ninguna fuente entregó jamás un dato, lo que sigue no se sostiene — y por
            eso arriba las TRES lámparas quedan apagadas, que es lo único honesto. */}
        {sinFuentes ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-card)', color: 'var(--dim)' }}>
              Sin fuentes conectadas no puedo opinar de tu negocio.
            </span>
            <Link href="/integraciones" style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
              Conectar →
            </Link>
          </div>
        ) : visibles.length === 0 ? (
          <span style={{ fontSize: 'var(--fs-card)', color: 'var(--dim)' }}>
            {restantes === 0 && saltar !== null
              ? 'Lo único que hay que atender ya está arriba.'
              : objetivoAtrasado
              ? 'Ninguna señal operativa en rojo, pero el trimestre va por debajo de lo esperado.'
              : 'Nada más que atender.'}
          </span>
        ) : (
          <div>
            {visibles.map((a, i) => {
              const c = a.nivel === 'rojo' ? 'var(--bad)' : a.nivel === 'ambar' ? 'var(--warn-fill)' : 'var(--good)';
              const inner = (
                <>
                  <span aria-hidden style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', background: c }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-card)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
                  <span style={{ flex: 'none', color: 'var(--faint)', fontSize: 'var(--fs-sm)' }}>
                    {a.desglose ? 'ver detalle →' : `${a.hrefLabel} →`}
                  </span>
                </>
              );
              const fila: CSSProperties = {
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '13px 0', textDecoration: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              };
              return a.desglose
                ? <DesgloseTrigger key={i} data={a.desglose} style={fila}>{inner}</DesgloseTrigger>
                : <Link key={i} href={a.href} style={fila}>{inner}</Link>;
            })}
            {saltar !== null && (
              <p style={{ margin: '14px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>
                La más urgente está arriba, en la cabecera.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Lampara({ color, encendida }: { color: string; encendida: boolean }) {
  return (
    <span aria-hidden style={{
      width: 48, height: 48, borderRadius: '50%', background: color,
      // El halo sale del MISMO token que la lámpara. El viejo escribía tres rgba() a
      // mano, así que el día que cambie el rojo del sistema quedan dos rojos.
      ...(encendida
        ? { boxShadow: `0 0 24px 4px color-mix(in srgb, ${color} 55%, transparent)` }
        : { opacity: 0.18 }),
    }} />
  );
}

/**
 * Pendientes de marcar — el número grande, y sólo los tipos que tienen algo.
 *
 * ⚠️ EL VIEJO DIBUJABA CUATRO SUB-TARJETAS FIJAS y en la pantalla real tres decían
 * 0. Una tarjeta que dice cero no informa: ocupa el lugar de la que sí, y es además
 * la regla escrita del dueño («estado vacío = mensaje que explica, nunca un cuadro
 * con los campos vacíos»). La superficie que volvió es la SECCIÓN, que la envuelve;
 * adentro va una lista con filete, que es lo que la casa pide para un grupo de cosas
 * del mismo tipo.
 *
 * Y el botón NO es el rojo lleno del viejo: el único relleno primario de la pantalla
 * es la acción del día. Dos primarios compitiendo es que no hay ninguno.
 */
function PendientesCard({ pendientes }: { pendientes: Pendientes }) {
  const tipos = [
    { n: pendientes.porTipo.A, l: 'sin asistencia a R1' },
    { n: pendientes.porTipo.B, l: 'sin R2 ni resolución' },
    { n: pendientes.porTipo.C, l: 'sin asistencia a R2' },
    { n: pendientes.porTipo.M, l: 'nutrición manual vencida' },
  ].filter((x) => x.n > 0);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          {/* El número grande sólo cuando HAY algo que marcar. Un «0» de 34 px al lado
              de «datos al día» es un titular sobre la nada: el cero ya lo dice la
              frase, y pintarlo grande le da a lo que no pasó el peso de lo que pasa. */}
          {pendientes.total > 0 && (
            <span style={{
              fontWeight: 700, fontSize: 'var(--fs-kpi)', letterSpacing: '-0.03em', lineHeight: 1,
              color: 'var(--bad)', fontVariantNumeric: 'tabular-nums',
            }}>
              {pendientes.total}
            </span>
          )}
          <h2 style={H2}>
            {pendientes.total > 0
              ? 'leads sin marcar bloquean la confiabilidad del tablero'
              : 'Datos al día — el tablero es confiable'}
          </h2>
        </div>
        {pendientes.total > 0 && (
          <Link href="/crm" style={{
            flex: 'none', alignSelf: 'center', padding: '9px 16px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-strong)', background: 'transparent',
            color: 'var(--dim)', fontSize: 'var(--fs-md)', fontWeight: 500, textDecoration: 'none',
          }}>
            Marcar en el CRM →
          </Link>
        )}
      </div>

      {tipos.length > 0 && (
        <div style={{ marginTop: 18 }}>
          {tipos.map((t, i) => (
            <div key={t.l} style={{
              display: 'flex', alignItems: 'baseline', gap: 12,
              padding: '11px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}>
              <span style={{ fontWeight: 600, fontSize: 18, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{t.n}</span>
              <span style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)' }}>{t.l}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
