// =============================================================================
// api-mako/areas/general.run — los cuerpos del área `general`
// =============================================================================
// Un runner por id de general.def.ts. Lecturas: { leer }. Acciones: { preparar, ejecutar }.
// Todo corre adentro de runWithWorkspace(ctx.ws): las libs de objectives scopean
// solas con getTenantDb. Nunca se escribe desde leer() ni desde preparar().
//
// Tres cosas que no se ven leyendo las libs y que gobiernan este archivo:
//
//  1. «HOY» ES SIEMPRE hoyEnWorkspace(), NUNCA UN PARÁMETRO. Define el período de
//     un KPI y el trimestre; una fecha que mande el modelo registraría en un
//     período cerrado sin error (ya pasó con la pantalla, ver registrarKpiAction).
//  2. EL SANEO DE app/general/actions.ts NO ESTÁ EN LIB. upsertObjective/upsertKpi
//     guardan lo que reciben; se aplica el mismo saneo desde general.helpers.ts.
//  3. LAS ESCRITURAS DE LIB NO INVALIDAN CACHÉ: las server actions hacen bust()
//     con updateTag, que solo existe dentro de una server action. ejecutar() corre
//     también desde route handlers y desde el doer, así que usa revalidateTag con
//     `{ expire: 0 }` (expira ya, como updateTag; 'max' sería stale-while-revalidate
//     y la primera lectura después de escribir saldría vieja) + revalidatePath, en
//     try/catch porque la escritura ya ocurrió y la caché vence sola.
//  4. EDITAR ES COMPLETAR, NO REEMPLAZAR. upsertObjective/upsertKpi escriben la fila
//     ENTERA: lo que no viaja vuelve a su default (avance null, KPI suelto, umbrales
//     100/70, orden Date.now(), origen 'user'). Con id, preparar() parte de la fila
//     actual y solo pisa lo que vino, y el resumen muestra el antes → después.
// =============================================================================

import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import type { Runners, Preparado, Ejecutado } from '../tipos';
import { TAG } from '@/lib/cache';
import { hoyEnWorkspace } from '@/lib/timezone';
import { diasAntes } from '@/lib/date-utils';
import { DIAS_J1_J2_ALERTA } from '@/lib/config';
import {
  quarterActual, listObjectives, avanceDeObjetivo, objetivosContextoTexto,
  getTableroKpis, listKpis, proponerKpis, getCapacidad, upsertObjective, cerrarObjective,
  upsertKpi, apagarKpi, registrarKpi, sembrarKpis, setCapacidad, type ObjectiveConAvance,
} from '@/lib/objectives';
import { leerFuente, fuentesConLector } from '@/lib/objectives-fuentes';
import { elegirObjetivoPrincipal, fuenteKpi, fuentePorFunnel, metricaPorFunnel, periodoDe, quarterKey, progresoQuarter, type Cadencia, type Kpi } from '@/lib/objectives-modelo';
import { leerFunnelIds, rotuloDeFunnels, sanearFunnelIds } from '@/lib/funnels-elegidos';
import { getTramoJ1J2Reciente } from '@/lib/queries';
import { pendientesOnboarding } from '@/lib/onboarding-pendientes';
import { objetivoPorId, registroKpiExistente, sanearObjetivo, sanearKpi, type ObjetivoFila } from './general.helpers';
import { getSupabaseServer } from '@/lib/supabase';
import { leerTableroVisible, guardarTableroSi } from '@/lib/graficos-tablero';
import { instanciarPlantilla } from '@/lib/graficos-plantillas';
import { MAX_HOJAS, abajoDeTodo, esElemento, esGrafico, nuevoId, sanearElemento, sanearHoja, tituloDe } from '@/lib/graficos-catalogo';
import { ALCANCE_GENERAL, TOPE_PEDIDO_IA } from '@/lib/graficos-ia';
import { generarHojaIA } from '@/lib/graficos-ia-generar';
import { editarHojaIA } from '@/lib/graficos-ia-editar';
import { firmaDeHoja } from '@/lib/graficos-ia-edicion';
import { PIEZAS_GENERAL, atarFunnels, esPiezaGeneral, funnelsDeBloque, opcionesDePieza, piezaGeneral, piezaPorFunnel, piezaPorVariosFunnels, sanearOpciones, type OpcionesElegidas, type PiezaGeneral } from '@/lib/general-piezas';
import { leerFunnelsDeGeneral, type FunnelDeGeneral } from '@/lib/general-alcance';
import { PLANTILLAS_GENERAL, elegirPersona, type PersonaGeneral } from '@/lib/general-plantillas';
import { ETIQUETAS_GENERAL } from '@/lib/graficos-plantillas-etiquetas';
import { ordenarConSugeridas } from '@/lib/plantillas-sugeridas';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';

// ── utilidades ───────────────────────────────────────────────────────────────

/** Lo que tiene la IA por HTTP (/api/v1 corta a los 60 s): el mismo de la API del Dashboard. */
const PLAZO_IA_HTTP_MS = 40_000;

const str = (input: Record<string, unknown>, k: string): string | null => {
  const v = input[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const num = (input: Record<string, unknown>, k: string): number | null => {
  const v = input[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const redondo = (n: number | null | undefined, dec = 2): number | null =>
  n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** dec) / 10 ** dec;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const esFecha = (s: string): boolean => FECHA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const diasEntre = (desde: string, hasta: string): number =>
  Math.floor((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000) + 1;
const json = (x: unknown): string => JSON.stringify(x);

/** El equivalente de bust() de app/general/actions.ts fuera de una server action
 *  (updateTag no corre en route handlers). Nunca tumba una escritura. */
function invalidar(): void {
  try { revalidateTag(TAG.settings, { expire: 0 }); } catch { /* vence por TTL */ }
  try { revalidatePath('/general'); } catch { /* fuera de un request: vence sola */ }
}

/** Una escritura que no lanza: el contrato de Ejecutado. */
async function escribir(fn: () => Promise<string>): Promise<Ejecutado> {
  try {
    const resumen = await fn();
    invalidar();
    return { ok: true, resumen };
  } catch (e) {
    return { ok: false, resumen: `No se pudo guardar (${e instanceof Error ? e.message : 'error'}).` };
  }
}

/** Un renglón del resumen de una edición: «meta 20000 → 30000» o «meta 20000 (se conserva)». */
const diff = (campo: string, antes: string, despues: string): string =>
  antes === despues ? `${campo} ${despues} (se conserva)` : `${campo} ${antes} → ${despues}`;

const periodoTxt = (o: { quarter: number | null; anio: number }): string =>
  o.quarter === null ? `anual ${o.anio}` : quarterKey({ anio: o.anio, q: o.quarter });

/**
 * `funnels` de guardar_objetivo y guardar_kpi (mig 0306): «todos» o ids separados por coma, que tienen que ser funnels
 * activos del negocio (los lista listar_objetivos en `funnels_del_negocio`). `null` = no vino: al editar queda el que
 * estaba. Con la lista de funnels caída no se puede elegir: se dice, no se adivina.
 */
async function funnelsDelPedido(input: Record<string, unknown>): Promise<{ ids: number[]; nombres: FunnelDeGeneral[] } | { error: string } | null> {
  const crudo = str(input, 'funnels');
  if (crudo == null) return null;
  const disponibles = await leerFunnelsDeGeneral();
  if (/^tod[oa]s?$/i.test(crudo)) return { ids: [], nombres: disponibles ?? [] };
  const partes = crudo.split(/[,\s]+/).filter(Boolean);
  const ids = sanearFunnelIds(partes);
  if (!ids.length || ids.length !== new Set(partes).size) return { error: `funnels: «${crudo}» no es «todos» ni una lista de ids de funnels separados por coma.` };
  if (!disponibles) return { error: 'No se pudieron leer los funnels del negocio: ahora no se puede elegir de cuáles suma.' };
  const faltan = ids.filter((id) => !disponibles.some((f) => f.id === id));
  if (faltan.length) return { error: `No hay un funnel activo con id ${faltan.join(', ')}. Los del negocio están en listar_objetivos (funnels_del_negocio).` };
  return { ids, nombres: disponibles };
}

/** «todo el negocio» o los nombres, para el resumen que se confirma en pantalla. */
const funnelsTxt = (ids: readonly number[], nombres: readonly FunnelDeGeneral[]): string =>
  (ids.length ? rotuloDeFunnels(ids, nombres) : 'todo el negocio');

/** Un objetivo con avance, en la forma que lee el modelo: null ≠ 0, unidad y ventana dichas. */
const objetivoParaModelo = (o: ObjectiveConAvance) => ({
  id: o.id,
  titulo: o.titulo,
  periodo: periodoTxt(o),
  // planos a propósito: el test de paridad lee cualquier `  clave: {` a dos espacios como un runner
  desde: o.desde, hasta: o.hasta,
  metrica: o.metrica,
  unidad: o.unidad,
  meta: o.metaValor,
  // Vacío = suma todo el negocio. Con ids, cada pago o cierre cuenta en el funnel donde estaba el lead ese día.
  funnel_ids: o.funnelIds,
  actual: redondo(o.actual),
  ...(o.actual === null ? { error: o.error ?? 'no se pudo leer' } : {}),
  pct_de_la_meta: redondo(o.pct, 1),
  ritmo_lineal: o.ritmo
    ? {
      esperado_a_hoy: redondo(o.ritmo.esperado),
      desvio: redondo(o.ritmo.desvio),
      desvio_pct: redondo(o.ritmo.desvioPct, 1),
      al_dia: o.ritmo.alDia,
      llegada_estimada: o.ritmo.llegadaEstimada,
    }
    : null,
  origen: o.origen,
});

const kpiDef = (k: Kpi) => ({
  id: k.id, nombre: k.nombre, cadencia: k.cadencia, compromiso: k.compromiso, unidad: k.unidad,
  umbral_verde_pct: k.umbralVerde, umbral_ambar_pct: k.umbralAmbar,
  fuente: k.fuente, fuente_id: k.fuenteId, objetivo_id: k.objectiveId, activo: k.activo, origen: k.origen,
  funnel_ids: k.funnelIds,
});

const ADVERTENCIA_TC = 'Convertido a USD desde la moneda de la cuenta de Meta con un tipo de cambio fijo: es una aproximación.';

/** getTableroKpis escribe el error pensando en la pantalla («todavía no lo cargaste»,
 *  en segunda persona). Por HTTP o en un resumen el modelo se lo repetiría a cualquiera. */
const errorKpiParaModelo = (e: string): string =>
  e === 'todavía no lo cargaste' ? 'no se registró el valor manual de este período' : e;

/** Fuentes que comparan un timestamp contra `${desde}` / `${hasta}T23:59:59.999Z`: el
 *  borde del día es el de UTC, no el de la zona del negocio (lib/objectives-fuentes.ts). */
const FUENTES_BORDE_UTC = new Set(['leads_nuevos', 'vsl_plays']);
/** cashUsd y soldUsd no paginan (lib/objectives-fuentes.ts): con más de 1000 filas en el
 *  rango PostgREST corta sin error y la suma sale de menos. Un trimestre no llega. */
const FUENTES_SIN_PAGINAR = new Set(['cash_usd', 'sold_usd']);
const MAX_DIAS_SIN_PAGINAR = 92;

async function kpiPorId(id: string): Promise<Kpi | null> {
  return (await listKpis(false)).find((k) => k.id === id) ?? null;
}

// ── runners ──────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  leer_resumen_objetivos: {
    leer: async () => {
      const texto = await objetivosContextoTexto();
      if (texto) return texto;
      // objetivosContextoTexto devuelve '' TAMBIÉN cuando algo lanza: se distingue
      // «no declaró objetivos» de «no se pudo leer» preguntando a la lista.
      const { qt, hoy } = await quarterActual();
      let objs;
      try {
        objs = await listObjectives(qt);
      } catch {
        return { content: 'No se pudieron leer los objetivos del negocio en este momento.', isError: true };
      }
      if (objs.length > 0) return { content: 'No se pudo armar el resumen de objetivos. Usa listar_objetivos para ver cada uno con su motivo.', isError: true };
      // Sin objetivos. objetivosContextoTexto también se calla cuando la lectura de
      // KPIs o el conteo de activos FALLAN (los traga con catch), así que KPIs y cupo
      // se preguntan aparte y se dice solo lo verificado: «no pude leer» ≠ «no hay».
      const partes = [`No hay objetivos activos para ${quarterKey(qt)} ni anuales de ${qt.anio}. No es un error: el negocio todavía no declaró a qué se compromete.`];
      try {
        const kpis = await listKpis(true);
        partes.push(kpis.length === 0
          ? 'Tampoco hay KPIs activos.'
          : `Hay ${kpis.length} KPI${kpis.length === 1 ? '' : 's'} activo${kpis.length === 1 ? '' : 's'}, pero no se pudo leer su tablero ahora: usa ver_tablero_kpis.`);
      } catch {
        partes.push('No se pudieron leer los KPIs: no afirmes si hay o no.');
      }
      try {
        const cap = await getCapacidad(hoy);
        if (cap.cupo === null) partes.push('No hay cupo de clientes declarado.');
        else if (cap.error) partes.push(`Hay un cupo declarado de ${cap.cupo} clientes, pero no se pudieron contar los activos: no afirmes si hay lugar.`);
      } catch {
        partes.push('No se pudo leer la capacidad instalada: no afirmes si hay cupo.');
      }
      return partes.join(' ');
    },
  },

  ver_trimestre_actual: {
    leer: async () => {
      const { qt, hoy, progreso } = await quarterActual();
      return json({
        trimestre: quarterKey(qt), hoy, desde: progreso.desde, hasta: progreso.hasta,
        dias_totales: progreso.diasTotales, dias_transcurridos: progreso.diasTranscurridos,
        dias_restantes: progreso.diasRestantes, consumido_pct: redondo(progreso.fraccion * 100, 1),
        zona: 'calendario del negocio (zona horaria del workspace)',
      });
    },
  },

  listar_objetivos: {
    leer: async (input) => {
      const actual = await quarterActual();
      const qt = { anio: num(input, 'anio') ?? actual.qt.anio, q: num(input, 'quarter') ?? actual.qt.q };
      const objs = await listObjectives(qt);
      const [con, funnels] = await Promise.all([Promise.all(objs.map((o) => avanceDeObjetivo(o, actual.hoy))), leerFunnelsDeGeneral()]);
      return json({
        trimestre: quarterKey(qt), hoy: actual.hoy,
        dias_restantes_del_trimestre: progresoQuarter(qt, actual.hoy).diasRestantes,
        nota: 'actual: null = no se pudo leer (motivo en error), NO es cero. El ritmo es un prorrateo lineal: di «a esta altura debería ir por», no «vas a llegar». unidad usd = dólares; cantidad = conteo. funnel_ids vacío = suma todo el negocio.',
        total: con.length,
        objetivos: con.map(objetivoParaModelo),
        // null = no se pudieron leer (no es «no hay»).
        funnels_del_negocio: funnels?.map((f) => ({ id: f.id, nombre: f.nombre })) ?? null,
      });
    },
  },

  ver_objetivo_principal: {
    leer: async () => {
      const { qt, hoy } = await quarterActual();
      const objs = await listObjectives(qt);
      const principal = elegirObjetivoPrincipal(objs);
      if (!principal) return json({ trimestre: quarterKey(qt), objetivo: null, motivo: `No hay objetivos activos para ${quarterKey(qt)} ni anuales de ${qt.anio}.` });
      const con = await avanceDeObjetivo(principal, hoy);
      return json({
        trimestre: quarterKey(qt), hoy,
        criterio: 'cobrado del trimestre → firmado del trimestre → cualquiera del trimestre → anual',
        otros_objetivos_activos: objs.length - 1,
        objetivo: objetivoParaModelo(con),
      });
    },
  },

  ver_tablero_kpis: {
    leer: async () => {
      const hoy = await hoyEnWorkspace();
      const filas = await getTableroKpis(hoy);
      if (filas.length === 0) return json({ hoy, kpis: [], nota: 'No hay KPIs activos. Usa sugerir_kpis para proponer algunos.' });
      return json({
        hoy,
        nota: 'valor: null = sin dato (no se pudo leer, o el manual todavía no se cargó), NO es cero. Ordenado de peor a mejor. pct_compromiso es sobre el período indicado.',
        kpis: filas.map((k) => ({
          id: k.id, nombre: k.nombre, estado: k.estado, cadencia: k.cadencia,
          periodo: { desde: k.periodoDesde, hasta: k.periodoHasta },
          valor: redondo(k.valor), ...(k.valor === null && k.error ? { error: errorKpiParaModelo(k.error) } : {}),
          compromiso: k.compromiso, unidad: k.unidad, pct_compromiso: redondo(k.pct, 1),
          fuente: k.fuente, fuente_id: k.fuenteId, objetivo_id: k.objectiveId,
          ...(k.fuente === 'auto' && k.fuenteId === 'inversion_usd' ? { advertencia: ADVERTENCIA_TC } : {}),
        })),
      });
    },
  },

  listar_kpis: {
    leer: async (input) => {
      const soloActivos = input.soloActivos === false ? false : true;
      const kpis = await listKpis(soloActivos);
      return json({ solo_activos: soloActivos, total: kpis.length, kpis: kpis.map(kpiDef) });
    },
  },

  sugerir_kpis: {
    leer: async () => {
      const cands = await proponerKpis();
      return json({
        nota: 'Sugerencias: no se creó nada. Los compromisos son valores por defecto del catálogo; para crearlos usa sembrar_kpis_sugeridos con los nombres exactos.',
        candidatos: cands.map((c) => ({
          nombre: c.nombre, cadencia: c.cadencia, compromiso: c.compromiso, unidad: c.unidad,
          fuente: c.fuente, fuente_id: c.fuenteId ?? null, porque: c.porque,
        })),
      });
    },
  },

  listar_fuentes_kpi: {
    leer: async () => json({ fuentes: fuentesConLector().map((f) => ({ id: f.id, nombre: f.label, unidad: f.unidad, que_mide: f.que })) }),
  },

  medir_fuente_kpi: {
    leer: async (input) => {
      const fuenteId = str(input, 'fuenteId') ?? '';
      const desde = str(input, 'desde') ?? '';
      const hasta = str(input, 'hasta') ?? '';
      if (!esFecha(desde) || !esFecha(hasta)) return { content: 'desde y hasta tienen que ser fechas YYYY-MM-DD.', isError: true };
      if (desde > hasta) return { content: 'desde no puede ser posterior a hasta.', isError: true };
      const dias = diasEntre(desde, hasta);
      if (dias > 366) return { content: `El rango pedido tiene ${dias} días; el máximo es 366.`, isError: true };
      if (FUENTES_SIN_PAGINAR.has(fuenteId) && dias > MAX_DIAS_SIN_PAGINAR) {
        return { content: `El rango pedido tiene ${dias} días; para ${fuenteId} el máximo es ${MAX_DIAS_SIN_PAGINAR} (la lectura no pagina y un rango mayor podría sumar de menos sin avisar). Pártelo en trimestres y suma.`, isError: true };
      }
      const def = fuenteKpi(fuenteId);
      const l = await leerFuente(fuenteId, desde, hasta);
      return json({
        fuente_id: fuenteId, nombre: def?.label ?? null, unidad: def?.unidad ?? null,
        ventana: { desde, hasta, dias },
        valor: redondo(l.valor), ...(l.valor === null ? { error: l.error ?? 'no se pudo leer' } : {}),
        ...(fuenteId === 'inversion_usd' ? { advertencia: ADVERTENCIA_TC } : {}),
        ...(FUENTES_BORDE_UTC.has(fuenteId) ? { advertencia: 'Los bordes del día se cortan en UTC, no en la zona horaria del negocio: lo que pasó cerca de la medianoche puede caer en el día vecino.' } : {}),
      });
    },
  },

  ver_capacidad_instalada: {
    leer: async () => {
      const hoy = await hoyEnWorkspace();
      const c = await getCapacidad(hoy);
      return json({
        hoy,
        cupo: c.cupo,
        // getCapacidad deja activos en 0 cuando no pudo contar: acá va null.
        activos: c.error ? null : c.activos,
        libres: c.libres,
        ocupacion_pct: redondo(c.ocupacionPct, 1),
        meses_entrega_pago_unico: c.mesesEntrega,
        ...(c.error ? { error: `No se pudieron contar los clientes activos: ${c.error}` } : {}),
        nota: c.cupo === null ? 'cupo null = el dueño no declaró su cupo: no afirmes si tiene lugar.' : 'activos se cuentan del CRM (ganados dentro de plazo).',
      });
    },
  },

  medir_tramo_r1_r2: {
    leer: async (input) => {
      const hoy = await hoyEnWorkspace();
      const dias = num(input, 'dias') ?? 60;
      const t = await getTramoJ1J2Reciente(hoy, dias);
      return json({
        ventana_r1: { desde: diasAntes(hoy, dias), hasta: hoy, dias },
        promedio_dias: redondo(t.promedio, 1),
        casos: t.n,
        alerta_se_enfrian: t.promedio !== null && t.n >= 3 && t.promedio > DIAS_J1_J2_ALERTA,
        umbral_alerta: { dias: DIAS_J1_J2_ALERTA, casos_minimos: 3 },
        nota: t.n === 0
          ? 'Sin casos con R1 y R2 en la ventana: promedio_dias null no es cero.'
          : 'Solo cuenta leads que ya tienen R2 cargada, INCLUIDAS las R2 agendadas a futuro (la lectura no las separa): una R2 lejana infla el promedio.',
        // getTramoJ1J2Reciente no pagina: PostgREST corta en 1000 filas sin error.
        ...(t.n >= 1000 ? { advertencia: 'La lectura llegó al tope de 1000 leads: puede haber casos afuera. Pide una ventana más corta.' } : {}),
      });
    },
  },

  listar_pendientes_arranque: {
    leer: async () => {
      const p = await pendientesOnboarding();
      return json({ total: p.length, pendientes: p.map((x) => ({ paso: x.paso, que_falta: x.que, donde: x.donde, ruta: x.ruta })) });
    },
  },

  // ── acciones por chat ──────────────────────────────────────────────────────

  registrar_valor_kpi: {
    preparar: async (input): Promise<Preparado> => {
      const kpiId = str(input, 'kpiId');
      const valor = num(input, 'valor');
      if (!kpiId) return { error: 'Falta el id del KPI.', faltan: ['kpiId'] };
      if (valor === null || valor < 0) return { error: 'Falta el valor (un número mayor o igual a 0).', faltan: ['valor'] };
      const k = await kpiPorId(kpiId);
      if (!k) return { error: `No existe un KPI con id «${kpiId}» en este negocio. Pide el id con ver_tablero_kpis.` };
      if (!k.activo) return { error: `El KPI «${k.nombre}» está apagado: no se registran valores en un KPI apagado.` };
      if (k.fuente === 'auto') return { error: `El KPI «${k.nombre}» es automático (lo mide MaKo desde ${k.fuenteId ?? 'su fuente'}): no se registra a mano.` };
      // La fecha se fija AL PROPONER: si el «sí» llega pasada la medianoche, el
      // número va al período del que habló la persona, no al siguiente.
      const fecha = await hoyEnWorkspace();
      const p = periodoDe(k.cadencia, fecha);
      const previo = await registroKpiExistente(k.id, p.clave);
      const nota = str(input, 'nota');
      const cuando = k.cadencia === 'diaria' ? `hoy (${p.desde})` : `la semana del ${p.desde} al ${p.hasta}`;
      const u = k.unidad === 'usd' ? 'USD ' : '';
      return {
        payload: { kpiId: k.id, cadencia: k.cadencia, fecha, valor, ...(nota ? { nota } : {}) },
        resumen: `Registrar ${u}${valor} en el KPI «${k.nombre}» para ${cuando}${previo !== null ? ` (reemplaza el valor anterior: ${u}${previo})` : ''}. Compromiso: ${u}${k.compromiso}.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const kpiId = String(payload.kpiId);
      // La pendiente vive 2 h: en ese lapso pueden haber apagado el KPI o pasarlo a
      // automático. Escribir igual deja una fila en kpi_registros que nadie lee.
      let k: Kpi | null;
      try {
        k = await kpiPorId(kpiId);
      } catch (e) {
        return { ok: false, resumen: `No se pudo verificar el KPI antes de registrar (${e instanceof Error ? e.message : 'error'}).` };
      }
      if (!k) return { ok: false, resumen: 'El KPI ya no existe: no se registró nada.' };
      if (!k.activo) return { ok: false, resumen: `El KPI «${k.nombre}» se apagó desde que se propuso: no se registró nada.` };
      if (k.fuente !== 'manual') return { ok: false, resumen: `El KPI «${k.nombre}» pasó a ser automático desde que se propuso: no se registra a mano.` };
      const kpi = k;
      return escribir(async () => {
        const cadencia: Cadencia = payload.cadencia === 'diaria' ? 'diaria' : 'semanal';
        const fecha = String(payload.fecha);
        const valor = Math.max(0, Number(payload.valor) || 0);
        await registrarKpi(kpi.id, cadencia, fecha, valor, typeof payload.nota === 'string' ? payload.nota : undefined);
        const p = periodoDe(cadencia, fecha);
        const cuando = cadencia === 'diaria' ? `el día ${p.desde}` : `la semana del ${p.desde} al ${p.hasta}`;
        return `Valor ${kpi.unidad === 'usd' ? 'USD ' : ''}${valor} registrado en el KPI «${kpi.nombre}» para ${cuando}.`;
      });
    },
  },

  cerrar_objetivo: {
    preparar: async (input): Promise<Preparado> => {
      const id = str(input, 'id');
      if (!id) return { error: 'Falta el id del objetivo.', faltan: ['id'] };
      const o = await objetivoPorId(id);
      if (!o) return { error: `No existe un objetivo con id «${id}» en este negocio. Pide el id con listar_objetivos.` };
      if (o.estado !== 'activo') return { error: `El objetivo «${o.titulo}» ya está cerrado.` };
      return {
        payload: { id: o.id, titulo: o.titulo },
        resumen: `Cerrar el objetivo «${o.titulo}» (${periodoTxt(o)}, meta ${o.meta_valor}). Deja de mandar en /general; sus KPIs quedan. No se puede reabrir desde MaKo.`,
      };
    },
    ejecutar: async (payload) => escribir(async () => {
      await cerrarObjective(String(payload.id));
      return `Objetivo «${String(payload.titulo ?? payload.id)}» cerrado.`;
    }),
  },

  apagar_kpi: {
    preparar: async (input): Promise<Preparado> => {
      const id = str(input, 'id');
      if (!id) return { error: 'Falta el id del KPI.', faltan: ['id'] };
      const k = await kpiPorId(id);
      if (!k) return { error: `No existe un KPI con id «${id}» en este negocio. Pide el id con listar_kpis.` };
      if (!k.activo) return { error: `El KPI «${k.nombre}» ya está apagado.` };
      return {
        payload: { id: k.id, nombre: k.nombre },
        resumen: `Apagar el KPI «${k.nombre}» (${k.cadencia}, compromiso ${k.compromiso}). Sale del tablero; sus registros quedan. No se puede reactivar desde MaKo.`,
      };
    },
    ejecutar: async (payload) => escribir(async () => {
      await apagarKpi(String(payload.id));
      return `KPI «${String(payload.nombre ?? payload.id)}» apagado.`;
    }),
  },

  guardar_capacidad: {
    preparar: async (input): Promise<Preparado> => {
      const cupo = num(input, 'cupo');
      if (cupo === null || cupo < 1) return { error: 'Falta el cupo (un entero mayor a 0).', faltan: ['cupo'] };
      const meses = num(input, 'mesesEntrega');
      const actual = await getCapacidad(await hoyEnWorkspace());
      const antes = actual.cupo === null ? 'sin cupo declarado' : `cupo actual ${actual.cupo}`;
      const activos = actual.error ? 'no se pudieron contar los activos' : `${actual.activos} clientes activos hoy`;
      return {
        payload: { cupo: Math.trunc(cupo), ...(meses !== null ? { mesesEntrega: Math.trunc(meses) } : {}) },
        resumen: `Declarar un cupo de ${Math.trunc(cupo)} clientes a la vez (${antes}; ${activos})${meses !== null ? ` y ${Math.trunc(meses)} meses de entrega para pagos únicos (hoy ${actual.mesesEntrega})` : ''}.`,
      };
    },
    ejecutar: async (payload) => escribir(async () => {
      const cupo = String(Math.trunc(Number(payload.cupo)));
      const meses = payload.mesesEntrega != null ? String(Math.trunc(Number(payload.mesesEntrega))) : undefined;
      await setCapacidad(cupo, meses);
      return `Cupo guardado: ${cupo} clientes${meses ? `, ${meses} meses de entrega` : ''}.`;
    }),
  },

  // ── acciones por pantalla (genérica /mako/revisar) ─────────────────────────
  // preparar() recibe EXACTAMENTE los `parametros` declarados: la pantalla guarda
  // el input validado y lo vuelve a preparar al confirmar.

  guardar_objetivo: {
    preparar: async (input): Promise<Preparado> => {
      const id = str(input, 'id');
      const anioIn = num(input, 'anio');
      const quarterIn = num(input, 'quarter');
      const tituloIn = str(input, 'titulo');
      const metricaIn = str(input, 'metrica');
      const metaIn = num(input, 'metaValor');
      const avanceIn = num(input, 'avanceManual');
      const funnelsIn = await funnelsDelPedido(input);
      if (funnelsIn && 'error' in funnelsIn) return { error: funnelsIn.error };

      // Con id se parte de la fila ACTUAL y se pisa solo lo que vino: la pantalla
      // genérica pinta el formulario con lo que mandó el modelo, así que un campo
      // omitido (o vaciado, que viaja como null) no puede volver a su default.
      let previo: ObjetivoFila | null = null;
      if (id) {
        previo = await objetivoPorId(id);
        // Sin esto, el upsert CREA una fila con el id que mandó el caller.
        if (!previo) return { error: `No existe un objetivo con id «${id}» en este negocio. Para crear uno nuevo, omite el id.` };
        if (previo.estado !== 'activo') return { error: `El objetivo «${previo.titulo}» está cerrado y no se edita ni se reabre desde MaKo.` };
      } else {
        const faltan = [anioIn === null && 'anio', quarterIn === null && 'quarter', !tituloIn && 'titulo', !metricaIn && 'metrica', metaIn === null && 'metaValor'].filter(Boolean) as string[];
        if (faltan.length) return { error: 'Faltan datos para crear el objetivo.', faltan };
      }

      const titulo = tituloIn ?? previo!.titulo;
      const s = sanearObjetivo({
        anio: anioIn ?? previo!.anio,
        quarter: quarterIn ?? (previo!.quarter ?? 0),
        metrica: metricaIn ?? previo!.metrica,
        metaValor: metaIn ?? Number(previo!.meta_valor),
        avanceManual: avanceIn ?? (previo?.avance_manual == null ? null : Number(previo.avance_manual)),
      });

      // No hay unique (ws, anio, quarter, metrica): crear dos veces —o mudar uno
      // existente a un período y métrica ya ocupados— duplica.
      const mudaDeLugar = !previo || previo.anio !== s.anio || previo.quarter !== s.quarter || previo.metrica !== s.metrica;
      if (mudaDeLugar) {
        const qt = { anio: s.anio, q: s.quarter ?? 1 };
        const mismos = (await listObjectives(qt)).filter((o) => o.id !== id && o.quarter === s.quarter && o.metrica === s.metrica
          && (s.metrica !== 'libre' || o.titulo.trim().toLowerCase() === titulo.toLowerCase()));
        if (mismos.length) {
          return {
            error: `Ya hay un objetivo activo «${mismos[0].titulo}» con esa métrica para ${periodoTxt({ anio: s.anio, quarter: s.quarter })}. Para cambiar su meta, pasa su id.`,
            disponibles: mismos.map((o) => ({ id: o.id, titulo: o.titulo, meta: o.metaValor })),
          };
        }
      }

      const u = s.unidad === 'usd' ? 'USD ' : '';
      // Los funnels: omitidos = los que tenía (o todos, al crear); «libre» no suma funnels (la carga la persona).
      const funnelsPrev = leerFunnelIds(previo?.funnel_ids);
      const funnelIds = metricaPorFunnel(s.metrica) ? (funnelsIn ? funnelsIn.ids : funnelsPrev) : [];
      const nombresFunnels = funnelsIn?.nombres ?? (funnelIds.length || funnelsPrev.length ? await leerFunnelsDeGeneral() ?? [] : []);
      const payload = {
        ...(id ? { id } : {}), anio: s.anio, quarter: s.quarter, titulo, metrica: s.metrica, unidad: s.unidad,
        metaValor: s.metaValor, avanceManual: s.avanceManual, funnelIds,
        // upsertObjective pisa orden con Date.now() y origen con 'user' si no viajan:
        // editar mandaría el objetivo al final (y cambiaría cuál manda en la cabecera).
        ...(previo ? { orden: previo.orden, origen: previo.origen } : {}),
      };
      if (!previo) {
        return {
          payload,
          resumen: `Crear el objetivo «${titulo}» (${periodoTxt({ anio: s.anio, quarter: s.quarter })}): meta ${u}${s.metaValor} de ${s.metrica}${s.metrica === 'libre' && s.avanceManual !== null ? `, avance cargado ${s.avanceManual}` : ''}${metricaPorFunnel(s.metrica) ? `, suma ${funnelsTxt(funnelIds, nombresFunnels)}` : ''}.`,
        };
      }
      const uPrev = previo.unidad === 'usd' ? 'USD ' : '';
      const avancePrev = previo.avance_manual == null ? null : Number(previo.avance_manual);
      const partes = [
        diff('título', `«${previo.titulo}»`, `«${titulo}»`),
        diff('período', periodoTxt(previo), periodoTxt({ anio: s.anio, quarter: s.quarter })),
        diff('métrica', previo.metrica, s.metrica),
        diff('meta', `${uPrev}${Number(previo.meta_valor)}`, `${u}${s.metaValor}`),
        diff('suma', funnelsTxt(funnelsPrev, nombresFunnels), funnelsTxt(funnelIds, nombresFunnels)),
      ];
      if (previo.metrica === 'libre' || s.metrica === 'libre') {
        const txt = (v: number | null) => (v === null ? 'sin cargar' : String(v));
        partes.push(s.metrica !== 'libre'
          ? `avance manual ${txt(avancePrev)} → se descarta (la métrica ya no es libre)`
          : diff('avance manual', previo.metrica === 'libre' ? txt(avancePrev) : 'sin cargar', txt(s.avanceManual)));
      }
      return { payload, resumen: `Editar el objetivo «${previo.titulo}»: ${partes.join('; ')}.` };
    },
    ejecutar: async (payload) => escribir(async () => {
      const id = await upsertObjective({
        id: typeof payload.id === 'string' ? payload.id : undefined,
        anio: Number(payload.anio),
        quarter: payload.quarter == null ? null : Number(payload.quarter),
        titulo: String(payload.titulo),
        metrica: payload.metrica as ObjectiveConAvance['metrica'],
        unidad: payload.unidad as ObjectiveConAvance['unidad'],
        metaValor: Number(payload.metaValor),
        avanceManual: payload.avanceManual == null ? null : Number(payload.avanceManual),
        funnelIds: sanearFunnelIds(payload.funnelIds),
        ...(typeof payload.orden === 'number' ? { orden: payload.orden } : {}),
        ...(typeof payload.origen === 'string' ? { origen: payload.origen } : {}),
      });
      return `Objetivo «${String(payload.titulo)}» guardado (id ${id}).`;
    }),
  },

  guardar_kpi: {
    preparar: async (input): Promise<Preparado> => {
      const id = str(input, 'id');
      const nombreIn = str(input, 'nombre');
      const cadenciaIn = str(input, 'cadencia');
      const compromisoIn = num(input, 'compromiso');
      const fuenteIn = str(input, 'fuente');
      const fuenteIdIn = str(input, 'fuenteId');
      const unidadIn = str(input, 'unidad');
      const objectiveIn = str(input, 'objectiveId');
      const verdeIn = num(input, 'umbralVerde');
      const ambarIn = num(input, 'umbralAmbar');
      const funnelsIn = await funnelsDelPedido(input);
      if (funnelsIn && 'error' in funnelsIn) return { error: funnelsIn.error };

      const todos = await listKpis(false);
      // Con id se parte del KPI ACTUAL: upsertKpi escribe la fila entera, y lo que no
      // viaja vuelve a su default (suelto, cantidad, 100/70, orden y origen nuevos).
      let previo: Kpi | null = null;
      if (id) {
        previo = todos.find((x) => x.id === id) ?? null;
        if (!previo) return { error: `No existe un KPI con id «${id}» en este negocio. Para crear uno nuevo, omite el id.` };
        if (!previo.activo) return { error: `El KPI «${previo.nombre}» está apagado y no se reactiva desde MaKo.` };
      } else {
        const faltan = [!nombreIn && 'nombre', !cadenciaIn && 'cadencia', compromisoIn === null && 'compromiso', !fuenteIn && 'fuente'].filter(Boolean) as string[];
        if (faltan.length) return { error: 'Faltan datos para crear el KPI.', faltan };
        const igual = todos.find((x) => x.activo && x.nombre.trim().toLowerCase() === nombreIn!.toLowerCase());
        if (igual) return { error: `Ya hay un KPI activo llamado «${igual.nombre}». Para cambiarlo, pasa su id.`, disponibles: [{ id: igual.id, nombre: igual.nombre }] };
      }

      const nombre = nombreIn ?? previo!.nombre;
      const fuente = fuenteIn ?? previo!.fuente;
      // Pasar de manual a auto exige la fuente; seguir en auto sin nombrarla conserva la actual.
      const fuenteId = fuente === 'auto' ? (fuenteIdIn ?? (previo?.fuente === 'auto' ? previo.fuenteId : null)) : null;
      if (fuente === 'auto' && !fuenteId) return { error: 'Un KPI automático necesita fuenteId (de listar_fuentes_kpi).', faltan: ['fuenteId'] };
      const s = sanearKpi({
        cadencia: cadenciaIn ?? previo!.cadencia,
        fuente,
        fuenteId,
        unidad: unidadIn ?? previo?.unidad,
        compromiso: compromisoIn ?? previo!.compromiso,
        umbralVerde: verdeIn ?? previo?.umbralVerde,
        umbralAmbar: ambarIn ?? previo?.umbralAmbar,
      });

      // objectiveId: omitido = queda donde estaba (sin revalidar: un KPI colgado de un
      // objetivo cerrado es historia); «ninguno» lo descuelga a propósito; un id nuevo
      // tiene que ser un objetivo activo.
      let objectiveId: string | null;
      let objTxt: string;
      if (objectiveIn && objectiveIn.toLowerCase() === 'ninguno') {
        objectiveId = null;
        objTxt = 'suelto (sin objetivo)';
      } else if (objectiveIn) {
        const o = await objetivoPorId(objectiveIn);
        if (!o || o.estado !== 'activo') return { error: `No hay un objetivo activo con id «${objectiveIn}». Pide el id con listar_objetivos (o «ninguno» para dejarlo suelto).` };
        objectiveId = o.id;
        objTxt = `«${o.titulo}»`;
      } else {
        objectiveId = previo?.objectiveId ?? null;
        objTxt = objectiveId ? `el objetivo ${objectiveId}` : 'suelto (sin objetivo)';
        if (objectiveId) {
          const o = await objetivoPorId(objectiveId).catch(() => null);
          if (o) objTxt = `«${o.titulo}»`;
        }
      }

      // Los funnels: sólo un KPI automático del CRM los cuenta; omitidos = los que tenía.
      const porFunnel = s.fuente === 'auto' && fuentePorFunnel(s.fuenteId);
      if (funnelsIn?.ids.length && !porFunnel) return { error: 'Sólo un KPI automático que sale del CRM (agendas, leads nuevos, cierres, cobrado o firmado) se cuenta por funnel.' };
      const funnelIds = porFunnel ? (funnelsIn ? funnelsIn.ids : previo?.funnelIds ?? []) : [];
      const nombresFunnels = funnelsIn?.nombres ?? (funnelIds.length || previo?.funnelIds.length ? await leerFunnelsDeGeneral() ?? [] : []);
      const payload = {
        ...(id ? { id } : {}), objectiveId, nombre, cadencia: s.cadencia,
        compromiso: s.compromiso, unidad: s.unidad, fuente: s.fuente, fuenteId: s.fuenteId,
        umbralVerde: s.umbralVerde, umbralAmbar: s.umbralAmbar, funnelIds,
        // upsertKpi pisa orden con Date.now() y origen con 'user': un KPI sembrado
        // perdería su origen 'seed' y se iría al final del tablero.
        ...(previo ? { orden: previo.orden, origen: previo.origen } : {}),
      };
      const u = s.unidad === 'usd' ? 'USD ' : '';
      const porTxt = (c: Cadencia) => (c === 'diaria' ? 'día' : 'semana');
      const fuenteTxt = (f: string, fid: string | null) => (f === 'auto' ? `automático (${fid})` : 'manual');
      if (!previo) {
        return {
          payload,
          resumen: `Crear el KPI «${nombre}»: ${u}${s.compromiso} por ${porTxt(s.cadencia)}, ${fuenteTxt(s.fuente, s.fuenteId)}${porFunnel ? ` de ${funnelsTxt(funnelIds, nombresFunnels)}` : ''}, verde desde ${s.umbralVerde}% y ámbar desde ${s.umbralAmbar}%, ${objectiveId ? `cuelga de ${objTxt}` : objTxt}.`,
        };
      }
      const uPrev = previo.unidad === 'usd' ? 'USD ' : '';
      let objPrevTxt = previo.objectiveId ? `el objetivo ${previo.objectiveId}` : 'suelto (sin objetivo)';
      if (previo.objectiveId && previo.objectiveId === objectiveId) objPrevTxt = objTxt;
      else if (previo.objectiveId) {
        const o = await objetivoPorId(previo.objectiveId).catch(() => null);
        if (o) objPrevTxt = `«${o.titulo}»`;
      }
      const partes = [
        diff('nombre', `«${previo.nombre}»`, `«${nombre}»`),
        diff('compromiso', `${uPrev}${previo.compromiso} por ${porTxt(previo.cadencia)}`, `${u}${s.compromiso} por ${porTxt(s.cadencia)}`),
        diff('fuente', fuenteTxt(previo.fuente, previo.fuenteId), fuenteTxt(s.fuente, s.fuenteId)),
        diff('umbrales', `verde ${previo.umbralVerde}% / ámbar ${previo.umbralAmbar}%`, `verde ${s.umbralVerde}% / ámbar ${s.umbralAmbar}%`),
        diff('objetivo', objPrevTxt, objTxt),
        ...(porFunnel || previo.funnelIds.length ? [diff('cuenta', funnelsTxt(previo.funnelIds, nombresFunnels), funnelsTxt(funnelIds, nombresFunnels))] : []),
      ];
      return { payload, resumen: `Editar el KPI «${previo.nombre}»: ${partes.join('; ')}.` };
    },
    ejecutar: async (payload) => escribir(async () => {
      const id = await upsertKpi({
        id: typeof payload.id === 'string' ? payload.id : undefined,
        objectiveId: typeof payload.objectiveId === 'string' ? payload.objectiveId : null,
        nombre: String(payload.nombre),
        cadencia: payload.cadencia === 'diaria' ? 'diaria' : 'semanal',
        compromiso: Number(payload.compromiso),
        unidad: payload.unidad === 'usd' ? 'usd' : 'cantidad',
        fuente: payload.fuente === 'auto' ? 'auto' : 'manual',
        fuenteId: typeof payload.fuenteId === 'string' ? payload.fuenteId : null,
        umbralVerde: Number(payload.umbralVerde),
        umbralAmbar: Number(payload.umbralAmbar),
        funnelIds: sanearFunnelIds(payload.funnelIds),
        ...(typeof payload.orden === 'number' ? { orden: payload.orden } : {}),
        ...(typeof payload.origen === 'string' ? { origen: payload.origen } : {}),
      });
      return `KPI «${String(payload.nombre)}» guardado (id ${id}).`;
    }),
  },

  sembrar_kpis_sugeridos: {
    preparar: async (input): Promise<Preparado> => {
      const nombres = Array.isArray(input.nombres) ? input.nombres.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()) : [];
      if (!nombres.length) return { error: 'Faltan los nombres de los KPIs a crear (de sugerir_kpis).', faltan: ['nombres'] };
      // Se resuelven contra la sugerencia REAL: nunca viaja una fuente ni un compromiso.
      const propuestos = await proponerKpis();
      const pedidos = new Set(nombres);
      const elegidos = propuestos.filter((c) => pedidos.has(c.nombre));
      const desconocidos = nombres.filter((n) => !propuestos.some((c) => c.nombre === n));
      if (!elegidos.length) return { error: 'Ninguno de esos nombres está entre las sugerencias actuales.', disponibles: propuestos.map((c) => c.nombre) };
      const activos = new Set((await listKpis(true)).map((k) => k.nombre.trim().toLowerCase()));
      const nuevos = elegidos.filter((c) => !activos.has(c.nombre.toLowerCase()));
      if (!nuevos.length) return { error: 'Todos esos KPIs ya existen activos: no se crea nada.' };
      let objectiveId = str(input, 'objectiveId');
      let objTxt: string;
      if (objectiveId) {
        const o = await objetivoPorId(objectiveId);
        if (!o || o.estado !== 'activo') return { error: `No hay un objetivo activo con id «${objectiveId}». Pide el id con listar_objetivos.` };
        objTxt = `colgados de «${o.titulo}»`;
      } else {
        const { qt } = await quarterActual();
        const principal = elegirObjetivoPrincipal(await listObjectives(qt));
        objectiveId = principal?.id ?? null;
        objTxt = principal ? `colgados del objetivo principal «${principal.titulo}»` : 'sueltos (no hay objetivo principal)';
      }
      const omitidos = elegidos.length - nuevos.length;
      return {
        payload: { nombres: nuevos.map((c) => c.nombre), objectiveId },
        resumen: `Crear ${nuevos.length} KPI${nuevos.length === 1 ? '' : 's'} sugeridos, ${objTxt}: ${nuevos.map((c) => `«${c.nombre}» (${c.compromiso} por ${c.cadencia === 'diaria' ? 'día' : 'semana'})`).join(', ')}.${omitidos ? ` ${omitidos} ya existían y se omiten.` : ''}${desconocidos.length ? ` No están entre las sugerencias: ${desconocidos.join(', ')}.` : ''}`,
      };
    },
    ejecutar: async (payload) => escribir(async () => {
      const pedidos = new Set(Array.isArray(payload.nombres) ? payload.nombres.map(String) : []);
      const elegidos = (await proponerKpis()).filter((c) => pedidos.has(c.nombre));
      if (!elegidos.length) throw new Error('las sugerencias cambiaron y ya no incluyen esos nombres');
      const n = await sembrarKpis(elegidos, typeof payload.objectiveId === 'string' ? payload.objectiveId : null);
      return `${n} KPI${n === 1 ? '' : 's'} creados.`;
    }),
  },
  // ── El informe de /general (14/10/2026): el editor del Dashboard con su propio informe ─────────────────────────
  // Por persona (`general.informe.<sub>`, lib/graficos-tablero.ts). ⚠️ Por HTTP no se escribe el email de una persona que
  // quien llama no nombró: son datos del equipo, y un token vive en la máquina de un tercero (la regla de la API del Dashboard).
  listar_hojas_general: {
    leer: async (input, ctx) => {
      const [admins, funnels, senales] = await Promise.all([
        adminsDeLaCuenta(ctx.ws), leerFunnelsDeGeneral(),
        // Las plantillas, con las sugeridas para ESTE negocio primero, como en la galería (lib/plantillas-sugeridas.ts).
        senalesDelNegocio().catch(() => null),
      ]);
      const base = {
        bloques: PIEZAS_GENERAL.map((b) => ({
          id: b.id, nombre: b.nombre, que_muestra: b.linea,
          ...(piezaPorFunnel(b.id) ? { se_ata_a_un_funnel: true, ...(piezaPorVariosFunnels(b.id) ? { acepta_varios_funnels: true } : {}) } : {}),
          opciones: opcionesDePieza(b.id).map((o) => ({ id: o.id, nombre: o.nombre, valores: o.valores.map((v) => ({ id: v.id, nombre: v.nombre })), por_defecto: o.def })),
        })),
        plantillas: ordenarConSugeridas(PLANTILLAS_GENERAL, ETIQUETAS_GENERAL, senales)
          .map(({ plantilla: p, porque }) => ({ id: p.id, nombre: p.nombre, que_trae: p.linea, ...(porque ? { sugerida: porque } : {}) })),
        funnels: funnels ? funnels.map((f) => ({ id: f.id, nombre: f.nombre, principal: f.esDefault })) : 'no se pudieron leer',
      };
      const pedido = str(input, 'persona');
      const e = elegirPersona(admins, pedido);
      if (!e.ok) return json({ ...base, error: e.error });
      const l = await informeDe(e.persona.sub);
      const quien = ctx.canal === 'http' && !pedido ? 'la única persona admin de la cuenta' : `${e.persona.nombre || e.persona.email} (${e.persona.email})`;
      return json({
        ...base, persona: quien, guardado: l.estado === 'propio',
        hojas: l.tablero.hojas.map((h) => ({
          id: h.id, nombre: h.nombre, plantilla: h.plantilla ?? null,
          bloques: h.componentes.flatMap((c) => (esElemento(c) && c.tipo === 'general' && c.general
            ? [{ id: c.id, bloque: c.general.pieza, ...(c.texto ? { titulo: c.texto } : {}), ...(funnelsDeBloque(c.general).length ? { funnels: funnelsDeBloque(c.general) } : {}), ...(c.general.opciones ? { opciones: c.general.opciones } : {}) }] : [])),
          graficos: h.componentes.filter(esGrafico).map((g) => tituloDe(g)),
          textos: h.componentes.filter((c) => esElemento(c) && c.tipo === 'texto').map((c) => (esElemento(c) ? c.texto.slice(0, 80) : '')),
        })),
      });
    },
  },

  crear_hoja_general: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const admins = await adminsDeLaCuenta(ctx.ws);
      const e = elegirPersona(admins, str(input, 'persona'));
      if (!e.ok) return { error: e.error };
      const id = str(input, 'plantilla') ?? '';
      const pedido = str(input, 'pedido') ?? '';
      if (id && pedido) return { error: 'Usa una plantilla o un pedido, no los dos.' };
      if (!id && !pedido) return { error: `Falta la plantilla o el pedido. Las plantillas son: ${PLANTILLAS_GENERAL.map((x) => x.id).join(', ')}.` };
      const l = await informeDe(e.persona.sub);
      if (l.tablero.hojas.length >= MAX_HOJAS) return { error: `Esa persona ya tiene ${MAX_HOJAS} hojas en General, el tope: que borre una antes.` };
      // 16/10/2026: con un pedido, MaKo la arma ANTES de proponerla, con lo que General ofrece y sus bloques (la misma
      // cascada que «¿Qué vas a crear hoy?» en General). Lo que se confirma es la hoja que se va a guardar.
      if (pedido) {
        const g = await generarHojaIA(pedido.slice(0, TOPE_PEDIDO_IA), Date.now(), { alcance: ALCANCE_GENERAL, ...(ctx.canal === 'http' ? { plazoMs: PLAZO_IA_HTTP_MS } : {}) });
        if ('error' in g) return { error: g.error };
        const nombre = (str(input, 'nombre') ?? g.hoja.nombre).slice(0, 60);
        const piezas = g.hoja.componentes.length;
        return { payload: { sub: e.persona.sub, hoja: g.hoja, nombre }, resumen: `Crear la hoja «${nombre}» en General, que armó MaKo con tu pedido (${piezas} ${piezas === 1 ? 'pieza' : 'piezas'}).` };
      }
      const p = PLANTILLAS_GENERAL.find((x) => x.id === id);
      if (!p) return { error: `La plantilla «${id}» no existe. Son: ${PLANTILLAS_GENERAL.map((x) => x.id).join(', ')}.` };
      const nombre = (str(input, 'nombre') ?? p.nombre).slice(0, 60);
      return { payload: { sub: e.persona.sub, plantilla: p.id, nombre }, resumen: `Crear la hoja «${nombre}» en General (plantilla ${p.nombre}).` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      try {
        const sub = String(payload.sub);
        // La hoja que armó MaKo con el pedido viaja ARMADA en la propuesta (se vuelve a sanear); si no, la plantilla.
        const p = payload.hoja ? null : PLANTILLAS_GENERAL.find((x) => x.id === payload.plantilla);
        if (!payload.hoja && !p) return { ok: false, resumen: 'Esa plantilla ya no existe: no se creó.' };
        // Se relee al ejecutar: entre la propuesta y el «sí» la persona pudo cambiar su General en la pantalla.
        const actual = await informeDe(sub);
        if (actual.tablero.hojas.length >= MAX_HOJAS) return { ok: false, resumen: `Ya tiene ${MAX_HOJAS} hojas en General: no se creó.` };
        const base = p ? instanciarPlantilla(p) : sanearHoja(payload.hoja, actual.tablero.hojas.length);
        if (!base) return { ok: false, resumen: 'La hoja que armó MaKo no se pudo leer: no se creó.' };
        const hoja = { ...base, nombre: String(payload.nombre ?? base.nombre).slice(0, 60) };
        const g = await guardarTableroSi(sub, { ...actual.tablero, hojas: [...actual.tablero.hojas, hoja] }, actual.version, 'general');
        if (!g.ok) return { ok: false, resumen: 'General cambió en el medio (alguien la editó): vuelve a pedirlo.' };
        try { revalidatePath('/general'); } catch { /* fuera de un request: vence sola */ }
        return { ok: true, resumen: `Hoja «${hoja.nombre}» creada en General.`, datos: { hojaId: hoja.id } };
      } catch (e) {
        return { ok: false, resumen: `No se pudo crear la hoja (${e instanceof Error ? e.message : 'error'}).` };
      }
    },
  },

  // «Editar con MaKo» por la API (16/10/2026): la MISMA cascada que el panel de la hoja de General
  // (lib/graficos-ia-editar.ts), con lo que General ofrece. MaKo arma el cambio ANTES de proponerlo, y al confirmar se
  // aplica sólo si nadie tocó la hoja en el medio (`firmaDeHoja`).
  editar_hoja_general_con_ia: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const admins = await adminsDeLaCuenta(ctx.ws);
      const e = elegirPersona(admins, str(input, 'persona'));
      if (!e.ok) return { error: e.error };
      const l = await informeDe(e.persona.sub);
      if (!l.tablero.hojas.length) return { error: 'Esa persona todavía no armó su General: crea una hoja primero con crear_hoja_general.' };
      const hojaId = str(input, 'hoja');
      const hoja = hojaId ? l.tablero.hojas.find((h) => h.id === hojaId) : l.tablero.hojas[0];
      if (!hoja) return { error: `No hay una hoja «${hojaId}» en su General. Pide los ids con listar_hojas_general.` };
      const pedido = str(input, 'pedido');
      if (!pedido) return { error: 'Falta el pedido: qué cambiar en la hoja, en palabras.' };
      const r = await editarHojaIA({ hoja, pedido: pedido.slice(0, TOPE_PEDIDO_IA), alcance: ALCANCE_GENERAL, inicio: Date.now(), ...(ctx.canal === 'http' ? { plazoMs: PLAZO_IA_HTTP_MS } : {}) });
      if ('error' in r) return { error: r.error };
      if (!r.cambios.length) return { error: r.respuesta || 'MaKo no encontró qué cambiar con ese pedido.' };
      return {
        payload: { sub: e.persona.sub, hojaId: hoja.id, antes: firmaDeHoja(hoja), hoja: r.hoja },
        resumen: `Cambiar la hoja «${hoja.nombre}» de General: ${r.cambios.join('; ')}.${r.avisos.length ? ` (${r.avisos.join(' · ')})` : ''}`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      try {
        const sub = String(payload.sub);
        const actual = await informeDe(sub);
        const i = actual.tablero.hojas.findIndex((h) => h.id === payload.hojaId);
        if (i < 0) return { ok: false, resumen: 'Esa hoja ya no está en su General: no se cambió.' };
        if (firmaDeHoja(actual.tablero.hojas[i]) !== payload.antes) return { ok: false, resumen: 'La hoja cambió desde que MaKo la leyó: vuelve a pedirlo.' };
        const nueva = sanearHoja({ ...(payload.hoja && typeof payload.hoja === 'object' ? payload.hoja : {}), id: payload.hojaId }, i);
        if (!nueva) return { ok: false, resumen: 'La hoja que armó MaKo no se pudo leer: no se cambió.' };
        const hojas = [...actual.tablero.hojas];
        hojas[i] = nueva;
        const g = await guardarTableroSi(sub, { ...actual.tablero, hojas }, actual.version, 'general');
        if (!g.ok) return { ok: false, resumen: 'General cambió en el medio (alguien la editó): vuelve a pedirlo.' };
        try { revalidatePath('/general'); } catch { /* fuera de un request: vence sola */ }
        return { ok: true, resumen: `Hoja «${nueva.nombre}» de General cambiada.`, datos: { hojaId: nueva.id } };
      } catch (e) {
        return { ok: false, resumen: `No se pudo cambiar la hoja (${e instanceof Error ? e.message : 'error'}).` };
      }
    },
  },

  agregar_bloque_general: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const admins = await adminsDeLaCuenta(ctx.ws);
      const e = elegirPersona(admins, str(input, 'persona'));
      if (!e.ok) return { error: e.error };
      const pieza = str(input, 'bloque');
      if (!esPiezaGeneral(pieza)) return { error: `El bloque «${pieza ?? ''}» no existe. Son: ${PIEZAS_GENERAL.map((x) => x.id).join(', ')}.` };
      const l = await informeDe(e.persona.sub);
      const hojaId = str(input, 'hoja');
      const hoja = hojaId ? l.tablero.hojas.find((h) => h.id === hojaId) : l.tablero.hojas[0];
      if (!l.tablero.hojas.length) return { error: 'Esa persona todavía no armó su General: crea una hoja primero con crear_hoja_general.' };
      if (!hoja) return { error: `No hay una hoja «${hojaId}» en su General. Pide los ids con listar_hojas_general.` };
      const titulo = (str(input, 'titulo') ?? '').slice(0, 80);
      // El funnel: sólo en los bloques que saben atarse a uno, y uno que EXISTE (por id o por nombre exacto).
      const pedidoFunnel = str(input, 'funnel');
      let elegidos: FunnelDeGeneral[] = [];
      if (pedidoFunnel) {
        const f = await funnelPedido(pieza, pedidoFunnel);
        if ('error' in f) return f;
        elegidos = f.funnels;
      }
      const op = opcionesPedidas(pieza, input.opciones);
      if ('error' in op) return op;
      return {
        payload: { sub: e.persona.sub, hojaId: hoja.id, pieza, titulo, ...(elegidos.length ? { funnels: elegidos.map((f) => f.id) } : {}), ...(op.opciones ? { opciones: op.opciones } : {}) },
        resumen: `Agregar «${piezaGeneral(pieza).nombre}»${elegidos.length ? ` de ${elegidos.length > 1 ? 'los funnels' : 'el funnel'} ${nombresTxt(elegidos)}` : ''} al final de la hoja «${hoja.nombre}» de General${titulo ? `, con el título «${titulo}»` : ''}.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      try {
        const sub = String(payload.sub);
        const pieza = payload.pieza;
        if (!esPiezaGeneral(pieza)) return { ok: false, resumen: 'Ese bloque ya no existe: no se agregó.' };
        const actual = await informeDe(sub);
        const hoja = actual.tablero.hojas.find((h) => h.id === payload.hojaId);
        if (!hoja) return { ok: false, resumen: 'Esa hoja ya no está en su General: no se agregó.' };
        const info = piezaGeneral(pieza);
        const elemento = sanearElemento({
          id: nuevoId(), clase: 'elemento', tipo: 'general', texto: String(payload.titulo ?? ''),
          // `funnels` (desde el 17/10) o `funnel` (una propuesta de antes, todavía sin confirmar): los dos, como lista.
          general: { pieza, ...atarFunnels(pieza, funnelsDeBloque(payload)), ...(payload.opciones ? { opciones: sanearOpciones(pieza, payload.opciones) } : {}) },
          x: 0, y: abajoDeTodo(hoja.componentes), w: info.w, h: info.h,
        });
        if (!elemento) return { ok: false, resumen: 'El bloque no es válido: no se agregó.' };
        const hojas = actual.tablero.hojas.map((h) => (h.id === hoja.id ? { ...h, componentes: [...h.componentes, elemento] } : h));
        const g = await guardarTableroSi(sub, { ...actual.tablero, hojas }, actual.version, 'general');
        if (!g.ok) return { ok: false, resumen: 'General cambió en el medio (alguien la editó): vuelve a pedirlo.' };
        try { revalidatePath('/general'); } catch { /* fuera de un request: vence sola */ }
        return { ok: true, resumen: `«${info.nombre}» agregado a «${hoja.nombre}».`, datos: { elementoId: elemento.id } };
      } catch (e) {
        return { ok: false, resumen: `No se pudo agregar el bloque (${e instanceof Error ? e.message : 'error'}).` };
      }
    },
  },

  // Las opciones de un bloque que ya está (14/10/2026: el panel del bloque las ofrece, y la API tiene que poder lo mismo).
  configurar_bloque_general: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const admins = await adminsDeLaCuenta(ctx.ws);
      const e = elegirPersona(admins, str(input, 'persona'));
      if (!e.ok) return { error: e.error };
      const l = await informeDe(e.persona.sub);
      const hoja = l.tablero.hojas.find((h) => h.id === str(input, 'hoja'));
      if (!hoja) return { error: 'No hay esa hoja en su General. Pide los ids con listar_hojas_general.' };
      const c = hoja.componentes.find((x) => x.id === str(input, 'elemento'));
      if (!c || !esElemento(c) || c.tipo !== 'general' || !c.general) return { error: `No hay ese bloque en «${hoja.nombre}». Pide los ids con listar_hojas_general.` };
      const pieza = c.general.pieza;
      const cambios: Record<string, unknown> = {};
      const partes: string[] = [];
      if (input.opciones != null) {
        const op = opcionesPedidas(pieza, input.opciones);
        if ('error' in op) return op;
        cambios.opciones = { ...(c.general.opciones ?? {}), ...(op.crudas ?? {}) };
        partes.push(`las opciones (${Object.entries(op.crudas ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ')})`);
      }
      const titulo = str(input, 'titulo');
      if (titulo != null) { cambios.titulo = titulo.slice(0, 80); partes.push(titulo ? `el título a «${titulo.slice(0, 80)}»` : 'el título al de siempre'); }
      const pedidoFunnel = str(input, 'funnel');
      if (pedidoFunnel != null) {
        if (/^ningun[oa]?$/i.test(pedidoFunnel.trim())) { cambios.funnels = null; partes.push('el funnel al de siempre'); }
        else {
          const f = await funnelPedido(pieza, pedidoFunnel);
          if ('error' in f) return f;
          cambios.funnels = f.funnels.map((x) => x.id);
          partes.push(`${f.funnels.length > 1 ? 'los funnels' : 'el funnel'} a ${nombresTxt(f.funnels)}`);
        }
      }
      if (!partes.length) return { error: 'No pasaste nada para cambiar (opciones, título o funnel).' };
      return {
        payload: { sub: e.persona.sub, hojaId: hoja.id, elementoId: c.id, ...cambios },
        resumen: `Cambiar en «${piezaGeneral(pieza).nombre}» (hoja «${hoja.nombre}» de General) ${partes.join(', ')}.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      try {
        const sub = String(payload.sub);
        const actual = await informeDe(sub);
        const hoja = actual.tablero.hojas.find((h) => h.id === payload.hojaId);
        const c = hoja?.componentes.find((x) => x.id === payload.elementoId);
        if (!hoja || !c || !esElemento(c) || c.tipo !== 'general' || !c.general) return { ok: false, resumen: 'Ese bloque ya no está en su General: no se cambió.' };
        const g = c.general;
        // null = «ninguno»; sin el campo, los que tenía. Una propuesta de antes del 17/10 trae `funnel` (uno).
        const ids = payload.funnels === null || payload.funnel === null ? []
          : 'funnels' in payload || 'funnel' in payload ? funnelsDeBloque(payload) : funnelsDeBloque(g);
        const crudo = {
          ...c,
          texto: typeof payload.titulo === 'string' ? payload.titulo : c.texto,
          general: { pieza: g.pieza, ...atarFunnels(g.pieza, ids), opciones: payload.opciones ?? g.opciones },
        };
        const nuevo = sanearElemento(crudo);
        if (!nuevo) return { ok: false, resumen: 'El bloque no quedó válido: no se cambió.' };
        const hojas = actual.tablero.hojas.map((h) => (h.id === hoja.id ? { ...h, componentes: h.componentes.map((x) => (x.id === c.id ? nuevo : x)) } : h));
        const r = await guardarTableroSi(sub, { ...actual.tablero, hojas }, actual.version, 'general');
        if (!r.ok) return { ok: false, resumen: 'General cambió en el medio (alguien la editó): vuelve a pedirlo.' };
        try { revalidatePath('/general'); } catch { /* fuera de un request: vence sola */ }
        return { ok: true, resumen: `«${piezaGeneral(g.pieza).nombre}» cambiado.`, datos: { elementoId: c.id } };
      } catch (e) {
        return { ok: false, resumen: `No se pudo cambiar el bloque (${e instanceof Error ? e.message : 'error'}).` };
      }
    },
  },
};

/**
 * El funnel (o los funnels) que se pidió para un bloque: sólo en los que saben atarse, y que EXISTAN (por id o por
 * nombre exacto). «A quién cobrarle» acepta varios separados por coma (17/10/2026); «Tu funnel hoy», uno.
 */
async function funnelPedido(pieza: PiezaGeneral, pedido: string): Promise<{ funnels: FunnelDeGeneral[] } | { error: string }> {
  if (!piezaPorFunnel(pieza)) return { error: `«${piezaGeneral(pieza).nombre}» mide el negocio entero: no se ata a un funnel.` };
  const funnels = await leerFunnelsDeGeneral();
  if (!funnels) return { error: 'No pude leer los funnels del negocio: vuelve a pedirlo en un rato.' };
  const partes = pedido.split(',').map((x) => x.trim()).filter(Boolean);
  if (partes.length > 1 && !piezaPorVariosFunnels(pieza)) return { error: `«${piezaGeneral(pieza).nombre}» cuenta las etapas de UN funnel: pasa uno solo.` };
  const elegidos: FunnelDeGeneral[] = [];
  for (const p of partes) {
    const n = p.toLowerCase();
    const hay = funnels.filter((f) => String(f.id) === n || f.nombre.trim().toLowerCase() === n);
    if (hay.length !== 1) return { error: hay.length ? `Hay ${hay.length} funnels que se llaman «${p}»: pasa su id.` : `No hay un funnel «${p}». Son: ${funnels.map((f) => `${f.id} · ${f.nombre}`).join(', ')}.` };
    if (!elegidos.includes(hay[0])) elegidos.push(hay[0]);
  }
  if (!elegidos.length) return { error: 'No pasaste ningún funnel.' };
  return { funnels: elegidos };
}

const nombresTxt = (fs: readonly FunnelDeGeneral[]) => fs.map((f) => `«${f.nombre}»`).join(' y ');

/**
 * Las opciones que se pidieron para un bloque: un valor que no existe es un error (dice cuáles hay), no se tira en
 * silencio. `crudas` son las pedidas tal cual (válidas); `opciones`, las que quedan distintas de las de entrada.
 */
function opcionesPedidas(pieza: PiezaGeneral, crudo: unknown): { opciones?: OpcionesElegidas; crudas?: Record<string, string> } | { error: string } {
  if (crudo == null) return {};
  let obj: unknown = crudo;
  if (typeof crudo === 'string') { try { obj = JSON.parse(crudo); } catch { obj = null; } }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { error: 'Las opciones van como {opción: valor}.' };
  const ofrecidas = opcionesDePieza(pieza);
  const crudas: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const o = ofrecidas.find((x) => x.id === k);
    if (!o) return { error: `«${piezaGeneral(pieza).nombre}» no tiene la opción «${k}». ${ofrecidas.length ? `Tiene: ${ofrecidas.map((x) => x.id).join(', ')}.` : 'No tiene opciones.'}` };
    if (typeof v !== 'string' || !o.valores.some((x) => x.id === v)) return { error: `«${k}» va con uno de: ${o.valores.map((x) => x.id).join(', ')}.` };
    crudas[k] = v;
  }
  const opciones = sanearOpciones(pieza, crudas);
  return { crudas, ...(opciones ? { opciones } : {}) };
}

/**
 * El informe de General de una persona como lo ve SU pantalla (14/10/2026): quien nunca armó el suyo, SIN hojas. La General
 * de siempre viaja por dentro de la pantalla en blanco y no se guarda, así que crear la primera hoja por la API deja ésa
 * sola, igual que crearla en la pantalla.
 */
async function informeDe(sub: string) {
  const l = await leerTableroVisible(sub, 'general');
  return l.estado === 'inicial' ? { ...l, tablero: { ...l.tablero, hojas: [] } } : l;
}

/** Las personas ADMIN de la cuenta (General es sólo del admin): no suspendidas y con email. */
async function adminsDeLaCuenta(ws: number): Promise<PersonaGeneral[]> {
  const { data, error } = await getSupabaseServer().from('usuarios').select('id, email, nombre, rol, rol_ws, estado')
    .eq('workspace_id', ws).neq('estado', 'suspendido').limit(500);
  if (error) throw new Error(`No pude leer las personas de la cuenta: ${error.message}`);
  type Fila = { id: number | string; email: string | null; nombre: string | null; rol: string | null; rol_ws: string | null };
  return ((data ?? []) as Fila[])
    .filter((x) => x.email && x.rol_ws !== 'closer' && x.rol_ws !== 'setter')
    .map((x) => ({ sub: String(x.id), email: (x.email ?? '').toLowerCase(), nombre: x.nombre ?? '' }));
}
