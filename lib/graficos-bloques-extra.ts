// =============================================================================
// graficos-bloques-extra — los datos de los bloques de las tabs de Analysts
// =============================================================================
// lib/graficos-bloques.ts le pasa los pedidos cuyo bloque está en BLOQUES_EXTRA
// (lib/graficos-bloques-extra-catalogo.ts). Cada bloque se lee con las MISMAS funciones que la tab que
// reemplaza, para que la hoja y la tab no cuenten distinto:
//   · patrones_guiones    → getScriptAnalystView + buildPatterns (lib/ads-analyst-patrones.ts). Es el
//                           HISTÓRICO COMPLETO, como la tab: las ScriptView no tienen ventana.
//   · cuadrante_retencion → getQuadrantData(desde, hasta), el filtro de fecha del cuadrante de la tab.
//   · mapa_calor          → nada: lo dibuja MapaDeCalor de la tab, que pide sus datos a sus rutas
//                           (/api/landing-analyst/mapa*, sólo admin como el Dashboard) y mira 30 días.
//   · curva_vsl           → curvaRetencion + histogramaAbandono (lib/vsl-retencion.ts), video por video.
//   · *_cierre            → getClosingViewData + embudoDe/factoresDe/closersDe, las métricas de la tab que
//                           usa también la API de MaKo (lib/api-mako/areas/closing.helpers.ts).
//   · llamadas_cierre     → getClosingViewData, la MISMA lectura: la lista de la tab (compacta: el detalle
//                           de una llamada lo pide su ficha a GET /api/closing/llamada) y los contadores.
//   · Productividad       → metricasProductividad (lib/productividad-metricas.ts), lo de la tab.
//
// ⚠️ Lo que se lee para varios bloques se lee UNA vez por pedido (`una`): los tres bloques de Closing
// son una sola lectura de closing_analyses, los tres de Productividad una sola del tablero.

import 'server-only';
import type { DatosBloque, PedidoBloque } from './graficos-bloques';
import { SinConexionError } from './graficos-agregar';
import { getQuadrantData, getScriptAnalystView, type ScriptView } from './ads-analyst';
import { getAngles } from './script-angles';
import {
  buildPatterns, confFromImpr, confidence, esMuestraChica, hold, verdictFromVals, verdictOf,
} from './ads-analyst-patrones';
import { curvaRetencion, histogramaAbandono } from './vsl-retencion';
import { getClosingViewData, type ClosingAnalysisRow } from './closing';
import { closersDe, embudoDe, enVentana, factoresDe } from './api-mako/areas/closing.helpers';
import { metricasProductividad } from './productividad-metricas';
import { exigirFathom, exigirMeta, leerTablero, videosDelPeriodo } from './graficos-datos-extra';
import type {
  DatosAtencion, DatosClosers, DatosCuadrante, DatosCurvaVsl, DatosEmbudoCierre, DatosFactores, DatosLlamadas, DatosMatriz,
  DatosPatrones, DatosPiramide, GuionResumen,
} from './graficos-bloques-extra-catalogo';
import { nombreDeLlamada } from '@/app/dashboard/bloques/extra/llamadas-modelo';

type Una = <T>(clave: string, leer: () => Promise<T>) => Promise<T>;

async function etiquetadorDeAngulos(una: Una): Promise<(k: string) => string> {
  const lista = await una('angulos', () => getAngles().catch(() => []));
  const m = new Map(lista.map((a) => [a.key, a.label] as const));
  return (k) => m.get(k) ?? (k ? k.charAt(0).toUpperCase() + k.slice(1) : k);
}

// ── Ads Analyst ─────────────────────────────────────────────────────────────────────────

async function patrones(una: Una): Promise<DatosPatrones> {
  await exigirMeta();
  const [vista, etiqueta] = await Promise.all([una('scripts', () => getScriptAnalystView()), etiquetadorDeAngulos(una)]);
  const ads = vista.scripts;
  const reliable = ads.filter((a) => confidence(a) !== 'baja');
  const resumen = (a: ScriptView): GuionResumen => ({
    id: a.id, nombre: a.short || a.name, angulo: etiqueta(a.angle), hook: a.hookRate, ret: hold(a), gasto: a.spend, agendas: a.agendas, veredicto: verdictOf(a),
  });
  return {
    total: ads.length, confiables: reliable.length,
    // Sin el color (`bigColor`): el dibujo del Dashboard pinta por la polaridad, con los tokens del tema.
    patrones: buildPatterns(ads, reliable, etiqueta).map((p) => ({
      key: p.key, polarity: p.polarity, chip: p.chip, big: p.big, tlabel: p.tlabel, stmt: p.stmt,
      aLabel: p.aLabel, aVal: p.aVal, a: p.a, bLabel: p.bLabel, bVal: p.bVal, b: p.b, max: p.max, ads: p.ads.map(resumen),
    })),
    muestraChica: ads.filter(esMuestraChica).sort((a, b) => b.spend - a.spend).map(resumen),
  };
}

async function cuadrante(p: PedidoBloque, una: Una): Promise<DatosCuadrante> {
  await exigirMeta();
  const [puntos, etiqueta] = await Promise.all([una(`quad|${p.desde}|${p.hasta}`, () => getQuadrantData(p.desde, p.hasta)), etiquetadorDeAngulos(una)]);
  return {
    puntos: puntos.map((q) => ({
      id: q.id, nombre: q.short, angulo: etiqueta(q.angle), hook: q.hookRate, hold: q.hold, gasto: q.spend, impresiones: q.impressions, agendas: q.agendas,
      confianza: confFromImpr(q.impressions), veredicto: verdictFromVals(q.hookRate, q.hold, q.impressions),
    })),
  };
}

// ── Landing Analyst ─────────────────────────────────────────────────────────────────────

async function curvaVsl(p: PedidoBloque): Promise<DatosCurvaVsl> {
  const videos = await videosDelPeriodo({ desde: p.desde, hasta: p.hasta, sinRango: false });
  return {
    videos: videos.map((v) => {
      const r = curvaRetencion(v.eventos, v.duracion, null);
      return {
        id: v.id || 'sin-id', nombre: v.nombre, hayDatos: r.hayDatos, arrancaron: r.arrancaron, medidos: r.medidos, sinMedicion: r.sinMedicion,
        curva: r.curva, mayorCaida: r.mayorCaida, medianaPct: r.medianaPct, salidas: histogramaAbandono(v.eventos, v.duracion, null),
      };
    })
      // Primero el que más gente miró: es el VSL; los demás suelen ser testimonios o pruebas.
      .sort((a, b) => b.arrancaron - a.arrancaron),
  };
}

// ── Closing Analyst ─────────────────────────────────────────────────────────────────────

/** Lo que leen los cuatro bloques de Closing: UNA lectura de closing_analyses por pedido. Sin Fathom, «Conecta Fathom». */
async function vistaClosing(una: Una) {
  await exigirFathom();
  return una('closing', () => getClosingViewData());
}

async function llamadas(p: PedidoBloque, una: Una): Promise<ClosingAnalysisRow[]> {
  return enVentana((await vistaClosing(una)).calls, p.desde, p.hasta);
}

async function llamadasCierre(p: PedidoBloque, una: Una): Promise<DatosLlamadas> {
  const vista = await vistaClosing(una);
  return {
    llamadas: enVentana(vista.calls, p.desde, p.hasta).map((c) => ({
      id: c.recording_id, fecha: c.call_date, tipo: c.tipo, closer: c.closer, nombre: nombreDeLlamada(c), empresa: c.lead_empresa,
      email: c.invitee_email, titulo: c.title, puntaje: c.score, tono: c.outcome_tone, minutos: c.duration_min,
      // Como la tab: una llamada sin transcript se lista, atenuada (su puntaje no cuenta en los KPI).
      conTranscript: c.has_transcript !== false,
    })),
    counts: vista.counts,
    ultimaSync: vista.lastSync,
  };
}

async function embudoCierre(p: PedidoBloque, una: Una): Promise<DatosEmbudoCierre> {
  const e = embudoDe(await llamadas(p, una));
  return { r1: e.llamadas_r1, r2: e.llamadas_r2, ganadasR2: e.r2_ganadas, tasa: e.tasa_cierre_r2_pct };
}

async function factoresCierre(p: PedidoBloque, una: Una): Promise<DatosFactores> {
  const f = factoresDe(await llamadas(p, una));
  // Los ejemplos van SIN el nombre del lead (factoresDe ya no lo trae): la fecha y si fue R1 o R2.
  const ej = (xs: Array<{ recording_id: number; fecha: string | null; tipo: string | null; score_dimension_0a10: number }>) =>
    xs.map((x) => ({ id: x.recording_id, fecha: x.fecha, tipo: x.tipo, puntaje: x.score_dimension_0a10 }));
  return {
    ganadas: f.ganadas, perdidas: f.perdidas, enProceso: f.en_proceso_excluidas,
    dimensiones: f.dimensiones.map((d) => ({
      dimension: d.dimension, ganadas: d.promedio_ganadas, perdidas: d.promedio_perdidas, equipo: d.promedio_equipo, brecha: d.brecha,
      brillo: ej(d.ejemplos_donde_brillo), falto: ej(d.ejemplos_donde_falto),
    })),
  };
}

async function closersCierre(p: PedidoBloque, una: Una): Promise<DatosClosers> {
  return {
    closers: closersDe(await llamadas(p, una)).map((c) => ({
      closer: c.closer, llamadas: c.llamadas, puntaje: c.score_promedio_0a10, ganadas: c.ganadas,
      flojo: c.dimension_mas_floja ? { dimension: c.dimension_mas_floja.dimension, puntaje: c.dimension_mas_floja.score_0a10 } : null,
    })),
  };
}

// ── Productivity Analyst (la foto de hoy: no tienen período) ────────────────────────────

async function metricasDelTablero(una: Una) {
  return una('productividad', async () => {
    const { tasks, labels } = await leerTablero();
    return metricasProductividad(tasks, labels, Date.now());
  });
}

async function matriz(una: Una): Promise<DatosMatriz> {
  const m = await metricasDelTablero(una);
  return { proyectos: m.projMeta.map((p) => ({ id: p.l.id, nombre: p.l.name, emoji: p.l.emoji, impacto: p.l.impacto ?? null, esfuerzo: p.l.esfuerzo ?? null, tareas: p.total, completo: p.completo })) };
}

async function piramide(una: Una): Promise<DatosPiramide> {
  const m = await metricasDelTablero(una);
  return { piramide: m.piramide, activas: m.activas.length };
}

async function atencion(una: Una): Promise<DatosAtencion> {
  const m = await metricasDelTablero(una);
  return {
    estancadas: m.estancadas.map((x) => ({ id: x.t.id, titulo: x.t.title, score: x.t.score, extra: `${x.dias} d sin tocar` })),
    altaSinDeadline: m.sinDeadlineAlta.map((t) => ({ id: t.id, titulo: t.title, score: t.score, extra: 'sin fecha' })),
    corridos: m.corridos.map((x) => ({ id: x.t.id, titulo: x.t.title, score: x.t.score, extra: '', n: x.n })),
    proyectosSinDeadline: m.projSinDeadline.length,
    tareasSinDeadline: m.sinDeadlineTotal,
  };
}

// ── El reparto ───────────────────────────────────────────────────────────────────────────

function leerBloque(p: PedidoBloque, una: Una): Promise<unknown> {
  switch (p.bloque) {
    case 'patrones_guiones': return patrones(una);
    case 'cuadrante_retencion': return cuadrante(p, una);
    // El mapa pide sus datos él solo (la foto se baja cuando se monta, no en el primer pintado de la hoja).
    case 'mapa_calor': return Promise.resolve(null);
    case 'curva_vsl': return curvaVsl(p);
    case 'embudo_cierre': return embudoCierre(p, una);
    case 'factores_cierre': return factoresCierre(p, una);
    case 'closers_cierre': return closersCierre(p, una);
    case 'llamadas_cierre': return llamadasCierre(p, una);
    case 'matriz_proyectos': return matriz(una);
    case 'piramide_prioridad': return piramide(una);
    case 'tareas_atencion': return atencion(una);
    default: return Promise.reject(new Error(`bloque desconocido: ${p.bloque}`));
  }
}

export async function datosDeBloquesExtra(pedidos: PedidoBloque[]): Promise<Record<string, DatosBloque>> {
  const out: Record<string, DatosBloque> = {};
  const memo = new Map<string, Promise<unknown>>();
  const una: Una = <T>(clave: string, leer: () => Promise<T>) => {
    if (!memo.has(clave)) memo.set(clave, leer());
    return memo.get(clave)! as Promise<T>;
  };
  await Promise.all(pedidos.map(async (p) => {
    try {
      out[p.id] = { ok: true, datos: await leerBloque(p, una) };
    } catch (e) {
      // El mensaje de la base no es para la pantalla: va al log, y la tarjeta dice que no pudo. Lo que sí
      // llega tal cual es «conecta X»: es lo único que la persona puede arreglar.
      console.error(`[graficos-bloques-extra] ${p.bloque}: ${e instanceof Error ? e.message : String(e)}`);
      out[p.id] = { ok: false, error: e instanceof SinConexionError ? e.message : 'No pude leer los datos' };
    }
  }));
  return out;
}
