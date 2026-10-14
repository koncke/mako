// =============================================================================
// datos — lo que leen los bloques de General, en el server (lib/general-piezas.ts)
// =============================================================================
// Desde el 14/10/2026 la tab General es el editor del Dashboard con su propio informe. Sus bloques (el hero del
// objetivo con la acción del día, los OKRs, los KPIs, el semáforo, el Plan, el Calendario, el funnel, la cobranza, el
// mes) se leen ACÁ con las mismas lecturas de siempre y viajan al navegador como DATOS (./datos-tipos.ts), donde cada
// bloque se dibuja con sus opciones (./bloques/). Hasta la segunda vuelta de ese día viajaban ya dibujados y por eso no
// podían tener opciones: elegir «cuántas» o «cómo se ve» habría sido volver al server.
//
// ⚠️ CADA BLOQUE FALLA SOLO: una lectura caída deja ESE bloque diciendo que no pudo, nunca la pantalla en blanco.
// ⚠️ LA AGENDA DE GOOGLE («Mi día») SE DIBUJA Y NADA MÁS: no viaja a ningún modelo.
// ⚠️ TODO lo que pasa por acá viaja al navegador: lo liviano (las tareas sin su detalle ni su historial).
// =============================================================================

import 'server-only';
import {
  getAgendasBreakdown,
  getSenalesRecon,
  compareMTD,
  type AgendaItem,
  type SenalRecon,
} from '@/lib/queries';
import { fmtUSD } from '@/lib/format';
import { getRevenueBreakdowns, type RevItem, type RevenueBreakdowns } from '@/lib/pagos';
import { leerFunnelsDeGeneral, funnelsDeLeads, conteoDelFunnel, type ConteoFunnel, type FunnelDeGeneral } from '@/lib/general-alcance';
import { leerPlanHoyConTablero } from '@/lib/plan-hoy';
import { METRICA_LABEL } from '@/lib/objectives-modelo';
import { leerVistaGeneral } from '@/lib/vista-general';
import { fraccionDelObjetivo, type AlertaGeneral, type CuotaDeAlerta } from '@/lib/vista-general-modelo';
import { leerAQuienCobrar } from '@/lib/datos-comercial-server';
import { fmtValor } from '@/lib/graficos-agregar';
import { leerCalendario, zonaDelCalendario } from '@/lib/calendario';
import { diaDe, horaDe, sumarDias, type ItemCalendario } from '@/lib/calendario-modelo';
import { saludoDeHora, type ValoresVariables } from '@/lib/general-piezas';
import { esRecurrente } from '@/lib/plan-recurrentes';
import { getUsuarioActual } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase';
import { getWorkspaceActual } from '@/lib/workspace';
import { textoVence, type CobroM } from '@/app/m/dashboard/modelo';
import type { BoardTask, Label } from '@/app/plan/board/types';
import type { DesgloseItem, DesgloseData } from '../_components/Desglose';
import type { AlertaVista, DatosGeneral, Leido, OkrVista } from './datos-tipos';

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

function cuotaItems(arr: CuotaDeAlerta[]): DesgloseItem[] {
  return arr.map((c) => ({
    nombre: c.lead_nombre,
    valor: fmtUSD(c.monto_usd),
    detalle: `cuota ${c.numero === 0 ? 'inicial' : c.numero} · vence ${fmtDMY(c.fecha_esperada)} · ${c.dias < 0 ? `${Math.abs(c.dias)}d vencida` : c.dias === 0 ? 'vence hoy' : `en ${c.dias}d`}`,
    leadId: c.lead_id,
    focus: 'plan-pagos',
  }));
}

/**
 * De la alerta CRUDA (`armarAlertas`, lib/vista-general-modelo.ts) a la fila del escritorio. Las de cuotas traen sus
 * filas y su total; el desglose —que abre la ficha EDITABLE del lead— es cosa de esta pantalla.
 */
function alertaDeEscritorio(a: AlertaGeneral): AlertaVista {
  const fila: AlertaVista = { nivel: a.nivel, titulo: a.titulo, href: a.href, hrefLabel: a.hrefLabel };
  if (!a.cuotas) return fila;
  const vencidas = a.tipo === 'cuotas-vencidas';
  return {
    ...fila,
    desglose: {
      label: vencidas ? 'Cuotas vencidas' : 'Cuotas por vencer',
      value: fmtUSD(a.totalUsd ?? 0),
      color: vencidas ? 'var(--bad)' : 'var(--warn-fill)',
      items: cuotaItems(a.cuotas),
      emptyText: vencidas ? 'Sin cuotas vencidas.' : 'Sin cuotas por vencer.',
    },
  };
}

/** Los desgloses de las cuatro tarjetas del mes. */
function desglosesDelMes(mtdBreak: RevenueBreakdowns, agendasMTD: AgendaItem[], senalesMTD: SenalRecon[]): Record<string, DesgloseData> {
  return {
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
}

type Vista = Awaited<ReturnType<typeof leerVistaGeneral>>;

/** El hero oscuro: el objetivo del Q, la facturación y LA acción del día (lo de siempre). */
function datosDeCabecera(v: Vista): DatosGeneral['cabecera'] {
  const { objetivoPrincipal, plata } = v;
  // El detalle lead por lead del número grande, y la OTRA métrica de plata del mismo período. `plata` sólo existe para
  // objetivos de plata y si la lectura salió: si falla, el hero muestra el número y esconde el desglose.
  let desglose: DesgloseData | null = null;
  let complemento: { label: string; valor: string; pie: string; desglose: DesgloseData | null } | null = null;
  if (objetivoPrincipal && plata) {
    const esCash = plata.esCash;
    desglose = {
      label: `${METRICA_LABEL[objetivoPrincipal.metrica]} del período`,
      value: fmtUSD(plata.totalPropios),
      color: esCash ? 'var(--good)' : 'var(--ink)',
      items: revItemsToDesglose(plata.propios, esCash ? 'pago' : 'cierre', 'plan-pagos'),
      emptyText: esCash ? 'Todavía no entró un pago en este período.' : 'Todavía no se firmó nada en este período.',
    };
    complemento = {
      label: esCash ? 'Firmado' : 'Cobrado',
      valor: fmtUSD(plata.totalOtros),
      pie: esCash ? 'comprometido en contratos, aún no cobrado' : 'lo que efectivamente entró',
      desglose: {
        label: esCash ? 'Firmado en el período' : 'Cobrado en el período',
        value: fmtUSD(plata.totalOtros),
        color: esCash ? 'var(--ink)' : 'var(--good)',
        items: revItemsToDesglose(plata.otros, esCash ? 'cierre' : 'pago', 'plan-pagos'),
        emptyText: esCash ? 'Sin cierres firmados en el período.' : 'Sin cobros en el período.',
      },
    };
  }
  return {
    ok: true,
    d: {
      objetivo: objetivoPrincipal, foco: v.foco, capacidad: v.capacidad, progreso: v.progreso, fraccion: v.fraccionObjetivo,
      anio: v.qt.anio, quarter: v.qt.q, desglose, complemento,
    },
  };
}

/** Los OKRs (los objetivos del trimestre y del año), cada uno con su marca del tiempo. */
function datosDeOkrs(v: Vista): DatosGeneral['okrs'] {
  const lista: OkrVista[] = v.objetivos.map((o) => ({
    id: o.id, titulo: o.titulo, metrica: o.metrica, metricaLabel: METRICA_LABEL[o.metrica], unidad: o.unidad,
    metaValor: o.metaValor, quarter: o.quarter, avanceManual: o.avanceManual, actual: o.actual,
    pct: o.pct == null ? null : Math.max(0, Math.min(100, Math.round(o.pct))),
    atrasado: o.ritmo ? o.ritmo.desvio < 0 : null,
    fraccion: fraccionDelObjetivo(o, v.progreso, v.hoy),
    principal: v.objetivoPrincipal?.id === o.id,
  }));
  return { ok: true, d: { anio: v.qt.anio, quarter: v.qt.q, lista } };
}

/** El Calendario de los próximos 14 días, leído UNA vez: lo usan Mi día, las llamadas y las publicaciones. */
async function leerCalendarioDeGeneral(): Promise<{ items: ItemCalendario[]; tz: string; hoy: string; falla: boolean }> {
  const tz = await zonaDelCalendario();
  const hoy = diaDe(new Date().toISOString(), tz);
  const r = await leerCalendario(hoy, sumarDias(hoy, 14), tz);
  const falla = !!(r.fallos.propios || r.fallos.crm);
  const items = [...r.items].sort((a, b) => (a.diaCompleto === b.diaCompleto ? a.inicio.localeCompare(b.inicio) : a.diaCompleto ? -1 : 1));
  return { items, tz, hoy, falla };
}

/** Una tarea sin lo que la tarjeta no dibuja: el detalle, las notas, la checklist y el historial viajan al navegador. */
const liviana = (t: BoardTask): BoardTask => ({ ...t, detalle: '', notas: undefined, checklist: [], historial: [] });
const livianoP = (l: Label): Label => ({ ...l, detalle: '', notas: undefined, historial: [] });

/** Cuántos proyectos se mandan (la opción más grande de «Proyectos del Plan» es 6, y el orden por deadline otros 6). */
const TOPE_PROYECTOS = 6;

async function datosDelPlan(): Promise<DatosGeneral['plan']> {
  const { plan, tareas, proyectos } = await leerPlanHoyConTablero();
  const porId = new Map<string, BoardTask>();
  for (const t of tareas) if (!porId.has(t.id)) porId.set(t.id, t);
  const prioridades = plan.prioridades.map((p) => porId.get(p.id)).filter((t): t is BoardTask => !!t);
  const labelPorId = new Map<string, Label>();
  for (const l of proyectos) if (!labelPorId.has(l.id)) labelPorId.set(l.id, l);
  const objetivo = plan.objetivo ? labelPorId.get(plan.objetivo.id) ?? null : null;
  // Los proyectos que compiten (no los que sólo se repiten) y que todavía tienen algo abierto.
  const abiertas = tareas.filter((t) => t.progress < 100 && !esRecurrente(t));
  const conAbiertas = new Set(abiertas.flatMap((t) => t.labels));
  const vivos = proyectos.filter((l) => !esRecurrente(l) && conAbiertas.has(l.id));
  const porScore = [...vivos].sort((a, b) => b.score - a.score).slice(0, TOPE_PROYECTOS);
  const porDeadline = vivos.filter((l) => l.deadline).sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '')).slice(0, TOPE_PROYECTOS);
  const mostrados = new Map<string, Label>();
  for (const l of [...porScore, ...porDeadline, ...(objetivo ? [objetivo] : [])]) mostrados.set(l.id, l);
  const etiquetas = new Map<string, Label>();
  for (const t of prioridades) for (const id of t.labels) { const l = labelPorId.get(id); if (l) etiquetas.set(id, l); }
  return {
    ok: true,
    d: {
      prioridades: prioridades.map(liviana),
      objetivo: objetivo ? livianoP(objetivo) : null,
      proyectos: [...mostrados.values()].map(livianoP),
      etiquetas: [...etiquetas.values()].map(livianoP),
      tareasDeProyectos: tareas.filter((t) => t.labels.some((id) => mostrados.has(id))).map(liviana),
      tablero: plan.tablero,
    },
  };
}

/** «Tu funnel hoy» de cada funnel, contado ahora. Cada uno falla solo (null = no se pudo contar). */
async function contarFunnels(funnels: readonly FunnelDeGeneral[]): Promise<Map<number, ConteoFunnel | null>> {
  const conteos = await Promise.all(funnels.map((f) => conteoDelFunnel(f.id, f.nombre).catch((e) => {
    console.error('[general] funnel hoy:', f.id, e instanceof Error ? e.message : e);
    return null;
  })));
  return new Map(funnels.map((f, i) => [f.id, conteos[i]]));
}

/**
 * Hasta cuántos funnels se cuentan («Tu funnel hoy», «A quién cobrarle»). Se cuentan TODOS de entrada: elegir el funnel
 * en el panel cambia el bloque sin volver al server.
 */
const TOPE_FUNNELS = 8;

const fallo = (que: string): { ok: false; error: string } => ({ ok: false, error: `No pude leer ${que}.` });
const deVista = <T,>(v: Vista | null, que: string, f: (v: Vista) => Leido<T>): Leido<T> => (v ? f(v) : fallo(que));

/** Los datos de TODOS los bloques (no sólo los de la hoja abierta): se puede insertar cualquiera mientras se edita. */
export async function armarDatosGeneral(): Promise<DatosGeneral> {
  const cobranzaLeida = leerAQuienCobrar();
  const [v, plan, cobranza, funnels, calendario] = await Promise.all([
    leerVistaGeneral().catch((e) => { console.error('[general] vista:', e instanceof Error ? e.message : e); return null; }),
    datosDelPlan().catch((e): DatosGeneral['plan'] => { console.error('[general] plan:', e instanceof Error ? e.message : e); return fallo('el Plan'); }),
    cobranzaLeida,
    leerFunnelsDeGeneral(),
    leerCalendarioDeGeneral().catch((e) => { console.error('[general] calendario:', e instanceof Error ? e.message : e); return null; }),
  ]);

  // El mes: sus desgloses, sólo si la vista se leyó. Sin desgloses, las tarjetas muestran los números solos.
  let mes: DatosGeneral['mes'] = fallo('el resumen del mes');
  if (v) {
    const mtd = compareMTD(v.ayer);
    let mtdBreak: RevenueBreakdowns = { sold: [], cash: [], outstanding: [] };
    let agendasMTD: AgendaItem[] = [];
    let senalesMTD: SenalRecon[] = [];
    try {
      [mtdBreak, agendasMTD, senalesMTD] = await Promise.all([
        getRevenueBreakdowns(mtd.actualInicio, mtd.actualFin),
        getAgendasBreakdown(mtd.actualInicio, mtd.actualFin),
        getSenalesRecon(mtd.actualInicio, mtd.actualFin),
      ]);
    } catch { /* las tarjetas muestran los números sin desglose */ }
    mes = { ok: true, d: { comparativo: v.comparativo, desgloses: desglosesDelMes(mtdBreak, agendasMTD, senalesMTD) } };
  }

  // Sólo las filas con una cuota que marcar («Marcar cobrada» marca la PRÓXIMA), con el MISMO renglón que el teléfono
  // (app/m/dashboard/datos.ts: «US$500 · vence el jue»). Lo fija tests/general-cobranza.test.ts.
  const cobros: CobroM[] = cobranza.ok ? cobranza.datos.filas.flatMap((f) => (f.cuota ? [{
    leadId: f.leadId, pagoId: f.cuota.pagoId, nombre: f.nombre,
    linea: `${fmtValor(f.cuota.monto, 'usd')} · ${textoVence(f.cuota.vence, f.dias)}`,
    urgencia: f.urgencia,
  }] : [])) : [];

  // Los funnels que se pueden elegir en un bloque (lib/general-piezas.ts, `piezaPorFunnel`), hasta el tope, contados.
  const atables = (funnels ?? []).slice(0, TOPE_FUNNELS);
  const principal = atables.find((f) => f.esDefault) ?? atables[0] ?? null;
  const [conteos, deQuien] = await Promise.all([
    contarFunnels(atables),
    // De qué funnel es cada cliente con cuotas: sólo esos (la lista chica), no los leads del negocio entero. Un filtro
    // que no se pudo armar no es «nadie debe»: viaja null y el bloque de un funnel lo dice.
    atables.length && cobros.length
      ? funnelsDeLeads(cobros.map((c) => c.leadId)).catch((e) => { console.error('[general] cobranza por funnel:', e instanceof Error ? e.message : e); return null; })
      : Promise.resolve(new Map<number, Set<number>>()),
  ]);

  return {
    cabecera: deVista(v, 'el objetivo del trimestre', datosDeCabecera),
    okrs: deVista(v, 'los OKRs', datosDeOkrs),
    kpis: deVista(v, 'los KPIs', (x) => ({
      ok: true,
      d: {
        kpis: x.kpis.map((k) => ({
          id: k.id, nombre: k.nombre, cadencia: k.cadencia, compromiso: k.compromiso,
          unidad: k.unidad, fuente: k.fuente, fuenteId: k.fuenteId, objectiveId: k.objectiveId,
          valor: k.valor, error: k.error, estado: k.estado, pct: k.pct,
          umbralVerde: k.umbralVerde, umbralAmbar: k.umbralAmbar,
        })),
        candidatos: x.candidatos,
        objetivos: x.objetivos.map((o) => ({ id: o.id, titulo: o.titulo })),
        objetivoPrincipalId: x.objetivoPrincipal?.id ?? null,
      },
    })),
    // `objetivoAtrasado` sólo se afirma cuando el avance se pudo LEER (lib/vista-general-modelo.ts).
    semaforo: deVista(v, 'el semáforo', (x) => ({ ok: true, d: { alertas: x.alertas.map(alertaDeEscritorio), fuentes: x.fuentes, lampara: x.lampara.estado, objetivoAtrasado: x.objetivoAtrasado } })),
    pendientes: deVista(v, 'los pendientes del CRM', (x) => ({ ok: true, d: { total: x.pendientes.total, porTipo: x.pendientes.porTipo, aviso: x.pendientes.aviso } })),
    mes,
    plan,
    calendario: calendario ? { ok: true, d: calendario } : fallo('el Calendario'),
    funnels: funnels == null ? fallo('el CRM') : {
      ok: true,
      d: atables.map((f) => ({ id: f.id, nombre: f.nombre, principal: f.id === principal?.id, conteo: conteos.get(f.id) ?? null })),
    },
    cobranza: !cobranza.ok ? { ok: false, error: 'No pude leer la cobranza.' } : {
      ok: true,
      d: {
        cobros,
        tz: cobranza.datos.tz,
        deQuien: deQuien == null ? null : Object.fromEntries([...deQuien].map(([lead, fs]) => [lead, [...fs]])),
      },
    },
  };
}

// ── Las variables de un Texto ─────────────────────────────────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Los valores de las variables de un Texto para quien mira (lib/general-piezas.ts): su nombre, el negocio, hoy, el Q. */
export async function variablesDeQuienMira(): Promise<ValoresVariables> {
  const [s, ws, tz] = await Promise.all([
    getUsuarioActual().catch(() => null), getWorkspaceActual().catch(() => null), zonaDelCalendario().catch(() => 'UTC'),
  ]);
  let negocio = '';
  if (ws != null) {
    try {
      const { data } = await getSupabaseServer().from('workspaces').select('nombre').eq('id', ws).maybeSingle();
      negocio = ((data as { nombre?: string } | null)?.nombre ?? '').trim();
    } catch { /* sin nombre: la variable queda con sus llaves */ }
  }
  const ahora = new Date();
  const hoy = diaDe(ahora.toISOString(), tz);
  const [y, m, d] = hoy.split('-').map(Number);
  const hora = Number(horaDe(ahora.toISOString(), tz).slice(0, 2));
  const nombre = (s?.nombre ?? '').trim().split(/\s+/)[0] ?? '';
  return {
    saludo: saludoDeHora(hora),
    nombre,
    negocio,
    fecha: `${DIAS_LARGOS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} de ${MESES[m - 1]}`,
    trimestre: `Q${Math.floor((m - 1) / 3) + 1} ${y}`,
  };
}
