// =============================================================================
// Tab Vista General — panel de salud tipo semáforo (Fase 8A + 8E)
// =============================================================================
// En vez de repetir métricas de otros tabs:
//   a) Veredicto arriba (verde/ámbar/rojo) según el peor problema activo
//   b) Alertas ordenadas por urgencia — CONCLUSIÓN + qué revisar + atajo al tab
//   c) Estado del pipeline (distribución por madurez)
//   d) Resumen del mes: 4 números con tendencia vs mes anterior
// =============================================================================

import Link from 'next/link';
import {
  getFunnelEtapas,
  getResumenComercialMaduras,
  getDistribucionPipeline,
  getRevenuePeriod,
  getResumenComparativo,
  getPendientesDeMarcar,
  getObjetivoProgreso,
  getFatigaAdsets,
  getTramoJ1J2Reciente,
  type ResumenComercialMaduras,
  type DistribucionPipeline,
  type FunnelMes,
  type ResumenComparativo,
  type Pendientes,
  type ObjetivoProgreso,
  type AdsetFatiga,
  type TramoJ1J2,
} from '@/lib/queries';
import { DIAS_J1_J2_ALERTA } from '@/lib/config';
import { getDataSources, sourcesToMap } from '@/lib/sources';
import { getCuotasPendientes, type CuotaPendiente } from '@/lib/pagos';
import { ayerEnTijuana, hoyEnTijuana, primerDiaDelMesDeFecha } from '@/lib/date-utils';
import { DashboardHeader } from '../_components/DashboardHeader';
import { DashboardTabs } from '../_components/DashboardTabs';
import { ObjetivoBloque } from './ObjetivoBloque';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-MX').format(Math.round(n));
}

function fmtFechaCorta(yyyy_mm_dd: string | null): string {
  if (!yyyy_mm_dd) return '—';
  const [y, m, d] = yyyy_mm_dd.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Motor de alertas (8E) — conclusiones accionables, no datos crudos
// ─────────────────────────────────────────────────────────────────────────────

type Nivel = 'rojo' | 'ambar' | 'verde';

type Alerta = {
  nivel: Nivel;
  titulo: string;
  detalle: string;
  href: string;
  hrefLabel: string;
};

function etiquetaCuota(numero: number): string {
  return numero === 0 ? 'Cobro inicial' : `Cuota ${numero}`;
}

function construirAlertas(
  funnel: FunnelMes,
  maduras: ResumenComercialMaduras,
  pipeline: DistribucionPipeline,
  cuotas: { vencidas: CuotaPendiente[]; porVencer: CuotaPendiente[] },
  pendientes: Pendientes,
  fatiga: AdsetFatiga[],
  tramoJ1J2: TramoJ1J2,
): Alerta[] {
  const alertas: Alerta[] = [];

  // ── Fatiga de creativo por adset (ámbar) — Fase 16 ──
  for (const a of fatiga) {
    alertas.push({
      nivel: 'ambar',
      titulo: `Posible fatiga de creativo en ${a.adset_name}`,
      detalle: `Frecuencia 7d ${a.frequency_7d.toFixed(1)} y el costo por lead subió (${fmtUSD(a.cpl_7d_usd)} vs ${fmtUSD(a.cpl_28d_usd)} a 28 días). Rotá el creativo.`,
      href: '/',
      hrefLabel: 'Ver Marketing',
    });
  }

  // ── Tramo J1 → J2 lento (ámbar) — Fase 16 (guardia: n >= 3) ──
  if (tramoJ1J2.n >= 3 && tramoJ1J2.promedio !== null && tramoJ1J2.promedio > DIAS_J1_J2_ALERTA) {
    alertas.push({
      nivel: 'ambar',
      titulo: `Los deals se enfrían entre J1 y J2 (promedio ${tramoJ1J2.promedio.toFixed(1)} días)`,
      detalle: 'Cuanto más tarda la J2, más cae la intención. Agendá la J2 en la misma J1, en vivo.',
      href: '/comercial',
      hrefLabel: 'Ver Comercial',
    });
  }

  // ── Pendientes de marcar (Fase 9): ROJA, arriba de TODO ──
  // Si hay datos manuales sin cargar, el resto del tablero lee datos viejos.
  // Se empuja PRIMERO y, como el sort es estable y es 'rojo', queda arriba.
  if (pendientes.total > 0) {
    const partes: string[] = [];
    if (pendientes.porTipo.A > 0) partes.push(`${pendientes.porTipo.A} sin asistencia a J1`);
    if (pendientes.porTipo.B > 0) partes.push(`${pendientes.porTipo.B} sin J2 ni resolución`);
    if (pendientes.porTipo.C > 0) partes.push(`${pendientes.porTipo.C} sin asistencia a J2`);
    alertas.push({
      nivel: 'rojo',
      titulo: `Tenés ${pendientes.total} dato${pendientes.total === 1 ? '' : 's'} sin marcar — el tablero está leyendo datos viejos`,
      detalle: `${partes.join(' · ')}. Marcalos para que los números vuelvan a ser confiables.`,
      href: '/pendientes',
      hrefLabel: 'Ir a Pendientes',
    });
  }

  // ── Etapas del CAMINO PRINCIPAL de marketing (8E + v3 Fase D) ──
  // Solo el camino real Impresión→Click→Formulario→Agenda dispara alertas. Las
  // etapas de contexto (landing/VSL) son informativas y NO se diagnostican
  // como cuello — por eso no están en este mapa.
  const diagnosticos: Record<string, string> = {
    imp_click:
      'CTR de link bajo: pocos clicks por impresión. Revisá el creativo, el copy y la segmentación.',
    click_form:
      'Clickean pero pocos completan el instant form. Revisá que el form no sea largo y que el anuncio prometa lo mismo que pide el formulario.',
    form_agenda:
      'Completan el formulario pero no agendan la J1. Revisá el seguimiento tras el form (WhatsApp/email) y el CTA del VSL para agendar.',
  };

  for (const etapa of funnel.etapas) {
    if (etapa.contexto) continue; // contexto (landing/VSL) nunca es cuello (v3 Fase D)
    if (!(etapa.key in diagnosticos)) continue; // comerciales se evalúan con maduras
    if (etapa.salud !== 'rojo' && etapa.salud !== 'ambar') continue;
    const esCuello = funnel.cuelloKey === etapa.key;
    alertas.push({
      nivel: esCuello ? 'rojo' : etapa.salud === 'rojo' ? 'rojo' : 'ambar',
      titulo: `${esCuello ? 'Cuello de botella: ' : ''}${etapa.label} en ${etapa.pct !== null ? etapa.pct.toFixed(1) + '%' : '—'}`,
      detalle: diagnosticos[etapa.key],
      href: '/',
      hrefLabel: 'Ver Marketing',
    });
  }

  // ── No-show en cohortes maduras ── (guardia Fase 7: n >= 3)
  if (maduras.total_j1 >= 3) {
    const noShow = ((maduras.total_j1 - maduras.asistencias) / maduras.total_j1) * 100;
    if (noShow > 35) {
      alertas.push({
        nivel: noShow > 50 ? 'rojo' : 'ambar',
        titulo: `No-show de ${noShow.toFixed(0)}% en cohortes maduras`,
        detalle:
          'Muchos agendan y no llegan a J1. Revisá recordatorios automáticos (WhatsApp/email 24h y 1h antes) y la calificación previa del formulario.',
        href: '/leads?noshow=1',
        hrefLabel: 'Ver no-shows',
      });
    }
  }

  // ── Tasa de cierre en maduras ──
  if (maduras.tasa_cierre_madura !== null && maduras.limpias >= 3) {
    if (maduras.tasa_cierre_madura >= 30) {
      alertas.push({
        nivel: 'verde',
        titulo: `Tu venta funciona: ${maduras.tasa_cierre_madura.toFixed(0)}% de cierre sobre limpias`,
        detalle:
          'El sistema de venta está sano. Si querés más cierres, el foco es marketing: más volumen o mejor calidad de lead.',
        href: '/comercial',
        hrefLabel: 'Ver Comercial',
      });
    } else if (maduras.tasa_cierre_madura < 20) {
      alertas.push({
        nivel: 'rojo',
        titulo: `Tasa de cierre baja: ${maduras.tasa_cierre_madura.toFixed(0)}% en cohortes maduras`,
        detalle:
          'Califican pero no cierran. Revisá la oferta y el manejo de objeciones en la J2 — y si el monto/forma de pago es el correcto para tu perfil de cliente.',
        href: '/comercial',
        hrefLabel: 'Ver Comercial',
      });
    }
  }

  // ── Cuotas VENCIDAS (rojo) — una línea por cuota (Fase 8-bis) ──
  for (const c of cuotas.vencidas) {
    const diasVencida = Math.abs(c.dias);
    alertas.push({
      nivel: 'rojo',
      titulo: `${etiquetaCuota(c.numero)} de ${c.lead_nombre} venció el ${fmtFechaCorta(c.fecha_esperada)}: ${fmtUSD(c.monto_usd)}`,
      detalle: `Vencida hace ${diasVencida} ${diasVencida === 1 ? 'día' : 'días'}. Contactá al cliente y registrá el cobro cuando entre.`,
      href: `/leads/${c.lead_id}`,
      hrefLabel: 'Ver lead',
    });
  }

  // ── Cuotas por vencer en ≤3 días (ámbar) ──
  for (const c of cuotas.porVencer) {
    alertas.push({
      nivel: 'ambar',
      titulo: `${etiquetaCuota(c.numero)} de ${c.lead_nombre} vence ${c.dias === 0 ? 'hoy' : `en ${c.dias} ${c.dias === 1 ? 'día' : 'días'}`}: ${fmtUSD(c.monto_usd)}`,
      detalle: 'Anticipá el cobro: confirmá con el cliente antes de la fecha.',
      href: `/leads/${c.lead_id}`,
      hrefLabel: 'Ver lead',
    });
  }

  // ── Pipeline maduro ──
  if (pipeline.total > 0 && pipeline.pct_madura > 60) {
    alertas.push({
      nivel: 'verde',
      titulo: 'Pipeline mayormente maduro',
      detalle: 'La tasa de cierre que ves ya es confiable como predictor del negocio.',
      href: '/comercial',
      hrefLabel: 'Ver Comercial',
    });
  }

  // Orden: rojas → ámbar → verdes
  const peso: Record<Nivel, number> = { rojo: 0, ambar: 1, verde: 2 };
  alertas.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
  return alertas;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function GeneralPage() {
  const ayerReal = ayerEnTijuana();
  const mesInicio = primerDiaDelMesDeFecha(ayerReal);

  let funnel: FunnelMes | null = null;
  let maduras: ResumenComercialMaduras | null = null;
  let pipeline: DistribucionPipeline | null = null;
  let cuotas: { vencidas: CuotaPendiente[]; porVencer: CuotaPendiente[] } = {
    vencidas: [],
    porVencer: [],
  };
  let pendientes: Pendientes = { items: [], total: 0, porTipo: { A: 0, B: 0, C: 0 } };
  let objetivo: ObjetivoProgreso | null = null;
  let comparativo: ResumenComparativo | null = null;
  let fatiga: AdsetFatiga[] = [];
  let tramoJ1J2: TramoJ1J2 = { promedio: null, n: 0 };
  let errorMsg: string | null = null;

  const hoyReal = hoyEnTijuana();

  try {
    const sourceMap = sourcesToMap(await getDataSources());
    const [f, m, p, cuo, pend, obj, comp, fat, tj] = await Promise.all([
      getFunnelEtapas(mesInicio, ayerReal, sourceMap),
      getResumenComercialMaduras(),
      getDistribucionPipeline(),
      getCuotasPendientes(ayerReal),
      getPendientesDeMarcar(hoyReal),
      getObjetivoProgreso(hoyReal),
      getResumenComparativo(ayerReal),
      getFatigaAdsets(hoyReal),
      getTramoJ1J2Reciente(hoyReal, 60),
    ]);
    funnel = f;
    maduras = m;
    pipeline = p;
    cuotas = cuo;
    pendientes = pend;
    objetivo = obj;
    comparativo = comp;
    fatiga = fat;
    tramoJ1J2 = tj;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="min-h-screen w-full px-6 py-8 md:px-12 md:py-12 bg-[var(--bg)] text-[var(--text)]">
      <DashboardHeader fechaAyer={ayerReal} hoyReal={hoyReal} />
      <DashboardTabs active="general" />

      {errorMsg || !funnel || !maduras || !pipeline || !comparativo ? (
        <div
          className="rounded-lg p-6 border"
          style={{ borderColor: 'var(--accent-orange)', background: '#2a1410' }}
        >
          <p className="text-lg font-semibold mb-1" style={{ color: 'var(--accent-orange)' }}>
            Error consultando datos
          </p>
          <p className="text-base font-mono" style={{ color: 'var(--text-dim)' }}>
            {errorMsg ?? 'Sin datos'}
          </p>
        </div>
      ) : (
        <GeneralContent
          alertas={construirAlertas(funnel, maduras, pipeline, cuotas, pendientes, fatiga, tramoJ1J2)}
          objetivo={objetivo}
          pipeline={pipeline}
          comparativo={comparativo}
          notaConfiabilidad={
            pendientes.total > 0
              ? 'Confiabilidad limitada hasta marcar pendientes'
              : null
          }
        />
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contenido (veredicto + alertas + pipeline + resumen)
// ─────────────────────────────────────────────────────────────────────────────

function GeneralContent({
  alertas,
  objetivo,
  pipeline,
  comparativo,
  notaConfiabilidad,
}: {
  alertas: Alerta[];
  objetivo: ObjetivoProgreso | null;
  pipeline: DistribucionPipeline;
  comparativo: ResumenComparativo;
  notaConfiabilidad: string | null;
}) {
  const urgentes = alertas.filter((a) => a.nivel === 'rojo').length;
  const vigilar = alertas.filter((a) => a.nivel === 'ambar').length;
  const enOrden = alertas.filter((a) => a.nivel === 'verde').length;

  // La alerta de pendientes va arriba de todo; al actuar se abre el tab
  // Pendientes (v3 Fase G). El resto del semáforo diagnóstico queda debajo.
  const alertaPendientes = alertas.find((a) => a.href === '/pendientes') ?? null;
  const alertasResto = alertas.filter((a) => a.href !== '/pendientes');

  const veredicto =
    urgentes > 0
      ? { texto: 'Hay algo urgente que atender', color: 'var(--accent-orange)', emoji: '🔴' }
      : vigilar > 0
      ? { texto: 'En general bien — hay cosas que vigilar', color: 'var(--accent-yellow)', emoji: '🟡' }
      : { texto: 'El negocio está sano', color: 'var(--accent-green)', emoji: '🟢' };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* 1) PENDIENTES (alerta, arriba de todo — lleva al tab Pendientes) */}
      {alertaPendientes && <AlertaCard alerta={alertaPendientes} />}

      {/* 2) OBJETIVO GLOBAL (acumulado, no atado al filtro) */}
      {objetivo && <ObjetivoBloque progreso={objetivo} />}

      {/* 5) VEREDICTO + diagnóstico */}
      <section
        className="rounded-xl border p-6 md:p-8 flex flex-wrap items-center justify-between gap-4"
        style={{ background: 'var(--card-bg)', borderColor: veredicto.color, borderWidth: 2 }}
      >
        <div className="flex items-center gap-4">
          <span className="text-5xl leading-none">{veredicto.emoji}</span>
          <div>
            <h2
              className="text-[34px] leading-tight"
              style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, color: veredicto.color }}
            >
              {veredicto.texto}
            </h2>
            {notaConfiabilidad && (
              <p className="text-base mt-1" style={{ color: 'var(--accent-orange)' }}>
                ⚠ {notaConfiabilidad}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-5 text-base" style={{ color: 'var(--text-dim)' }}>
          <span>🔴 <strong style={{ color: 'var(--text)' }}>{urgentes}</strong> urgente{urgentes === 1 ? '' : 's'}</span>
          <span>🟡 <strong style={{ color: 'var(--text)' }}>{vigilar}</strong> vigilar</span>
          <span>🟢 <strong style={{ color: 'var(--text)' }}>{enOrden}</strong> en orden</span>
        </div>
      </section>

      {/* ALERTAS diagnósticas (sin la de pendientes, ya mostrada arriba) */}
      {alertasResto.length > 0 && (
        <div className="space-y-4">
          {alertasResto.map((a, i) => (
            <AlertaCard key={i} alerta={a} />
          ))}
        </div>
      )}

      {/* PIPELINE */}
      <PipelineCard data={pipeline} />

      {/* RESUMEN DEL MES */}
      <ResumenMes comparativo={comparativo} />
    </div>
  );
}


function colorDe(nivel: Nivel): string {
  return nivel === 'rojo'
    ? 'var(--accent-orange)'
    : nivel === 'ambar'
    ? 'var(--accent-yellow)'
    : 'var(--accent-green)';
}

function AlertaCard({ alerta }: { alerta: Alerta }) {
  const color = colorDe(alerta.nivel);
  return (
    <section
      className="rounded-xl border p-5 md:p-6"
      style={{
        background: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[260px]">
          <h3 className="text-xl mb-1" style={{ color, fontWeight: 600 }}>
            {alerta.titulo}
          </h3>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            {alerta.detalle}
          </p>
        </div>
        <Link
          href={alerta.href}
          className="shrink-0 px-4 py-2 rounded-lg border text-base"
          style={{ borderColor: 'var(--card-border)', color: 'var(--text-dim)' }}
        >
          {alerta.hrefLabel} →
        </Link>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PipelineCard — distribución de leads activos por madurez
// ─────────────────────────────────────────────────────────────────────────────

function PipelineCard({ data }: { data: DistribucionPipeline }) {
  let interpretacion: { texto: string; color: string };
  if (data.total === 0) {
    interpretacion = {
      texto: 'No hay leads activos (asistieron a J1 y aún no cierran).',
      color: 'var(--text-dim)',
    };
  } else if (data.pct_madura > 60) {
    interpretacion = {
      texto: 'Pipeline maduro, tasa de cierre confiable.',
      color: 'var(--accent-green)',
    };
  } else if (data.pct_reciente > 60) {
    interpretacion = {
      texto: 'Pipeline nuevo, esperá 2 semanas para evaluar.',
      color: 'var(--text-pending)',
    };
  } else {
    interpretacion = {
      texto: 'Pipeline mixto, confiabilidad parcial.',
      color: 'var(--accent-yellow)',
    };
  }

  return (
    <section
      className="rounded-xl border p-6 md:p-8"
      style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
    >
      <h2
        className="text-[28px]"
        style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}
      >
        Estado del pipeline
      </h2>
      <p className="text-base mt-1 mb-5" style={{ color: 'var(--text-dim)' }}>
        {data.total} lead{data.total === 1 ? '' : 's'} activo{data.total === 1 ? '' : 's'} (asistió a J1, no ha cerrado).
      </p>

      {data.total > 0 && (
        <>
          <div
            className="flex w-full h-8 rounded-md overflow-hidden border"
            style={{ borderColor: 'var(--card-border)' }}
          >
            {data.reciente > 0 && (
              <div
                title={`Reciente: ${data.reciente}`}
                style={{ width: `${data.pct_reciente}%`, background: 'var(--text-dim)' }}
              />
            )}
            {data.madurando > 0 && (
              <div
                title={`Madurando: ${data.madurando}`}
                style={{ width: `${data.pct_madurando}%`, background: 'var(--accent-yellow)' }}
              />
            )}
            {data.madura > 0 && (
              <div
                title={`Madura: ${data.madura}`}
                style={{ width: `${data.pct_madura}%`, background: 'var(--accent-green)' }}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-base">
            <span style={{ color: 'var(--text-dim)' }}>
              ⚪ Reciente: <strong>{data.reciente}</strong> ({data.pct_reciente.toFixed(0)}%)
            </span>
            <span style={{ color: 'var(--accent-yellow)' }}>
              🟡 Madurando: <strong>{data.madurando}</strong> ({data.pct_madurando.toFixed(0)}%)
            </span>
            <span style={{ color: 'var(--accent-green)' }}>
              🟢 Madura: <strong>{data.madura}</strong> ({data.pct_madura.toFixed(0)}%)
            </span>
          </div>
        </>
      )}

      <p className="mt-5 text-lg" style={{ color: interpretacion.color }}>
        {interpretacion.texto}
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen del mes — 4 números con flecha de tendencia vs mes anterior
// ─────────────────────────────────────────────────────────────────────────────

function Tendencia({ actual, anterior, invertir = false }: { actual: number; anterior: number; invertir?: boolean }) {
  if (anterior === 0 && actual === 0) {
    return <span style={{ color: 'var(--text-pending)' }}>→</span>;
  }
  const sube = actual > anterior;
  const igual = actual === anterior;
  if (igual) return <span style={{ color: 'var(--text-pending)' }}>→</span>;
  // invertir=true → subir es "malo" (ej: inversión) → color neutro
  const color = invertir
    ? 'var(--text-dim)'
    : sube
    ? 'var(--accent-green)'
    : 'var(--accent-orange)';
  return <span style={{ color }}>{sube ? '↑' : '↓'}</span>;
}

function ResumenMes({ comparativo }: { comparativo: ResumenComparativo }) {
  const items = [
    {
      label: 'Inversión',
      m: comparativo.inversion_usd,
      fmt: (n: number) => fmtUSD(n),
      nodo: <Tendencia actual={comparativo.inversion_usd.actual} anterior={comparativo.inversion_usd.anterior} invertir />,
    },
    {
      label: 'Agendas',
      m: comparativo.agendas,
      fmt: (n: number) => fmtNumber(n),
      nodo: <Tendencia actual={comparativo.agendas.actual} anterior={comparativo.agendas.anterior} />,
    },
    {
      label: 'Cash collected',
      m: comparativo.cash_usd,
      fmt: (n: number) => fmtUSD(n),
      nodo: <Tendencia actual={comparativo.cash_usd.actual} anterior={comparativo.cash_usd.anterior} />,
    },
    {
      label: 'Cierres',
      m: comparativo.cierres,
      fmt: (n: number) => fmtNumber(n),
      nodo: <Tendencia actual={comparativo.cierres.actual} anterior={comparativo.cierres.anterior} />,
    },
  ];

  return (
    <section
      className="rounded-xl border p-6 md:p-8"
      style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
    >
      <h2
        className="text-[28px] mb-1"
        style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}
      >
        Resumen del mes
      </h2>
      <p className="text-base mb-5" style={{ color: 'var(--text-dim)' }}>
        Mes en curso vs {comparativo.etiqueta_anterior} (mismo rango de días, comparación justa).
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border p-4"
            style={{ borderColor: 'var(--card-border)', background: '#0f0f0f' }}
          >
            <div className="text-sm uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
              {item.label}
            </div>
            <div className="text-[26px] font-semibold tabular-nums flex items-center gap-2">
              {item.fmt(item.m.actual)} {item.nodo}
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-pending)' }}>
              {comparativo.etiqueta_anterior}: {item.fmt(item.m.anterior)}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-pending)' }}>
              proyección fin de mes: {item.fmt(item.m.proyeccion)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
