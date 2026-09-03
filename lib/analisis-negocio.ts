// =============================================================================
// analisis-negocio — el análisis que Martín le hace a un cliente, hecho código
// =============================================================================
// Reconstruido de la reunión Mau <> Martín del 31/07/2026 (2.572 turnos), donde
// miraron los datos del negocio en vivo durante tres horas. NO es un dashboard:
// es la SECUENCIA DE PREGUNTAS que ordena esa conversación, con la aritmética
// resuelta de una vez (que allá se hizo con la calculadora del celular).
//
// LO QUE ESTE MÓDULO CONTESTA, en el orden en que se pregunta:
//   1. En este período: ¿cuánto gasté, cuántas agendé, cuántas asistieron,
//      cuántas calificaron, cuántas cerré? → la CASCADA
//   2. ¿Cuánto me cuesta cada escalón? → el costo unitario de cada uno
//   3. ¿Los números cuadran? → `cuadratura`, el chequeo que salvó la reunión
//   4. De los que asistieron, ¿cuántos ni siquiera calificaban? → la fuga barata
//   5. ¿Cuáles fueron los anuncios ganadores, y a qué costo? → los creativos
//   6. Para cerrar N al mes, ¿cuántas agendas y cuánta plata? → el plan inverso
//
// ⚠️ LAS DOS FUENTES DE «AGENDA» NO SON LA MISMA Y NO SE MEZCLAN.
//   · El CRM (`leads.fecha_agenda`) es la verdad del embudo: son las reuniones
//     que de verdad se pactaron. Con eso se arma la CASCADA.
//   · Meta (`marketing_metrics_daily.agendas_meta`, la conversión personalizada
//     del píxel) es lo que Meta SE ATRIBUYE, por anuncio y por día. Con eso se
//     arma el RANKING DE CREATIVOS, porque es la única fuente que sabe qué
//     anuncio trajo qué.
//   Medido en el ws1 al 03/09/2026: Meta se atribuye 152 agendas y el CRM tiene
//   114. Un 33% de diferencia. Usar el número de Meta en la cascada daría un
//   costo por agenda 33% optimista, y usar el del CRM por anuncio es imposible:
//   de 114 agendados, solo 9 traen `meta_ad_id` (los 933 leads que sí lo traen
//   son del formulario instantáneo, que no agenda). Por eso cada mitad usa su
//   fuente y el reporte lo dice con todas las letras.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { leerPorPaginas } from './supabase-paginado';
import { TIPO_DE_CAMBIO_USD_MXN } from './config';
import { reporteMetricas, resolverRango, type ReporteMetricas } from './metricas-negocio';
import {
  costoPor, tasa, cuadratura, planDesdeMeta, ordenarCreativos, creativosEscondidos,
  medianaCosto, type Cascada, type Escalon, type Cuadratura, type MetaPlan, type Creativo,
} from './analisis-modelo';

export type { Cascada, Escalon, Cuadratura, MetaPlan, Creativo } from './analisis-modelo';

export type {
  Calificacion, AnalisisCreativos, AnalisisNegocio,
} from './analisis-modelo';
import type { AnalisisNegocio, Calificacion, AnalisisCreativos } from './analisis-modelo';

const redondo = (v: number, d = 2): number => Math.round(v * 10 ** d) / 10 ** d;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Las preguntas del formulario de calificación, con el nombre que ve el dueño. */
const CAMPOS_CALIFICACION: Array<[string, string]> = [
  ['respuesta_facturacion', '¿Factura lo suficiente?'],
  ['respuesta_inversion', '¿Puede invertir?'],
  ['respuesta_colaboradores', '¿Cuántos colaboradores?'],
  ['respuesta_decisor', '¿Decide solo?'],
  ['respuesta_objetivo', '¿Qué quiere lograr?'],
];

/**
 * El análisis completo de un período.
 *
 * Corre DENTRO del workspace del que llama: todas las lecturas van por
 * `getTenantDb()`, que scopea sola. Este módulo no conoce inquilinos.
 */
export async function analisisNegocio(opts: {
  desde?: string | null;
  hasta?: string | null;
  /** Meta de cierres por mes, para la calculadora inversa. Sin esto no hay plan:
   *  cuántos cierres querer es una decisión del dueño, no una deducción. */
  cierresObjetivo?: number | null;
  /** El presupuesto que se está proponiendo, para poder marcar la contradicción. */
  presupuestoPropuesto?: number | null;
}): Promise<AnalisisNegocio> {
  const { desde, hasta, zona } = await resolverRango(opts.desde, opts.hasta);
  const db = await getTenantDb();

  // La serie ya resuelve las trampas (paginado, zona horaria, tráfico de prueba,
  // preview del editor, autoplay). No se vuelve a leer lo mismo por otro camino.
  const rep = await reporteMetricas({ desde, hasta, grano: 'mes' });
  const t = rep.totales;

  const chequeos: Array<{ que: string } & Cuadratura> = [];

  // ── El chequeo de integridad ────────────────────────────────────────────────
  // ⚠️ NO es circular: se compara lo que AGREGAMOS contra un `count` exacto que
  // pide la base por su cuenta. Si el paginado se cortó, los dos difieren. Es la
  // versión ejecutable del «sumá los meses y fijate si da el total» que en la
  // reunión encontró que el histórico arrastraba meses de otro rango.
  const contarLeads = async (col: string): Promise<number> => {
    const { count } = await db.from('leads').select('id', { count: 'exact', head: true })
      .gte(col, desde).lte(col, hasta);
    return count ?? 0;
  };
  const agendasExact = await contarLeads('fecha_agenda');
  chequeos.push({
    que: 'agendas creadas en el rango',
    ...cuadratura(agendasExact, rep.filas.map((f) => f.agendas_creadas), 0),
  });
  const j1Exact = await contarLeads('fecha_junta_1');
  chequeos.push({
    que: 'reuniones 1 con fecha en el rango',
    ...cuadratura(j1Exact, rep.filas.map((f) => f.j1_programadas), 0),
  });

  // ── La cascada ──────────────────────────────────────────────────────────────
  const inversion = t.meta_inversion;
  /** El mismo costo, legible. Tipo de cambio FIJO de lib/config.ts: es derivado. */
  const usd = (v: number | null): number | null =>
    v == null ? null : redondo(v / TIPO_DE_CAMBIO_USD_MXN);
  const agendas = t.agendas_creadas;
  const asistencias = t.j1_realizadas;
  const cierres = t.ganados;

  // Calificación: se lee aparte porque necesita el corte tri-estado y las
  // respuestas del formulario, que la serie no trae.
  const calif = await leerCalificacion(desde, hasta);

  const escalones: Escalon[] = [
    {
      nombre: 'Agendas',
      cantidad: agendas,
      costo_unitario: costoPor(inversion, agendas),
      costo_unitario_usd: usd(costoPor(inversion, agendas)),
      conversion_desde_anterior: null,
      fuente: 'CRM · leads.fecha_agenda (cuándo reservó)',
    },
    {
      nombre: 'Asistencias (R1 realizada)',
      cantidad: asistencias,
      costo_unitario: costoPor(inversion, asistencias),
      costo_unitario_usd: usd(costoPor(inversion, asistencias)),
      conversion_desde_anterior: tasa(agendas, asistencias),
      fuente: 'CRM · asistio_j1 = true',
    },
    {
      nombre: 'Calificados',
      cantidad: calif.calificados,
      costo_unitario: costoPor(inversion, calif.calificados),
      costo_unitario_usd: usd(costoPor(inversion, calif.calificados)),
      conversion_desde_anterior: tasa(asistencias, calif.calificados),
      fuente: 'CRM · calificado = true, sobre los que asistieron',
    },
    {
      nombre: 'Cierres',
      cantidad: cierres,
      costo_unitario: costoPor(inversion, cierres),
      costo_unitario_usd: usd(costoPor(inversion, cierres)),
      conversion_desde_anterior: tasa(calif.calificados, cierres),
      fuente: 'CRM · cerro = true con fecha_cierre en el rango',
    },
  ];

  const ingreso = t.ingreso_usd;
  const inversionUsd = inversion != null ? inversion / TIPO_DE_CAMBIO_USD_MXN : null;
  const roas = ingreso != null && inversionUsd != null && inversionUsd > 0
    ? redondo(ingreso / inversionUsd) : null;

  const cascada: Cascada = {
    periodo: { desde, hasta },
    inversion,
    inversion_usd: inversionUsd == null ? null : redondo(inversionUsd),
    moneda: rep.moneda.meta,
    escalones,
    ingreso_usd: ingreso,
    roas,
    advertencias: [],
  };

  // ── Los creativos ───────────────────────────────────────────────────────────
  const creativos = await leerCreativos(desde, hasta);

  // ── El plan inverso ─────────────────────────────────────────────────────────
  const showRate = tasa(agendas, asistencias);
  const tasaCierre = tasa(asistencias, cierres);
  const plan = opts.cierresObjetivo && opts.cierresObjetivo > 0
    ? planDesdeMeta({
      cierresObjetivo: opts.cierresObjetivo,
      showRate,
      tasaCierre,
      costoPorAgenda: costoPor(inversion, agendas),
      presupuestoPropuesto: opts.presupuestoPropuesto ?? null,
    })
    : null;

  // ── Advertencias ────────────────────────────────────────────────────────────
  const advertencias: string[] = [
    `Todos los números de este informe son del rango ${desde} → ${hasta}, calendario ${zona}. Ningún número es un «histórico» sin fecha de inicio: eso fue lo que hizo que en la reunión del 31/07 los costos unitarios salieran 33% abajo.`,
    'La CASCADA usa las agendas del CRM (las que de verdad se pactaron). El RANKING DE CREATIVOS usa las que Meta se atribuye por anuncio, que es la única fuente que sabe qué anuncio trajo qué. Son dos números distintos y no se suman entre sí.',
  ];
  for (const c of chequeos) if (!c.cuadra) advertencias.push(`⚠️ ${c.que}: ${c.nota}`);
  if (calif.sin_marcar > 0) {
    const pct = Math.round((100 * calif.sin_marcar) / Math.max(1, calif.asistieron));
    advertencias.push(
      `⚠️ ${calif.sin_marcar} de ${calif.asistieron} asistentes (${pct}%) NO tienen la calificación marcada. «Calificados» es un piso, no el número real, y el escalón de abajo hereda ese error. La marca automática necesita la grabación de Fathom; si no está conectada, alguien tiene que cargarla a mano.`,
    );
  }
  if (ingreso === 0 || ingreso == null) {
    advertencias.push(
      'No hay ingreso cargado en el período (`monto_cierre_usd`), así que NO hay ROAS. Sin eso no se puede juzgar si el costo por cliente es bueno o malo: un CAC de 840 es excelente contra un ticket de 7.500 y ruinoso contra uno de 900.',
    );
  }
  if (plan?.contradiccion) advertencias.push(`⚠️ ${plan.contradiccion}`);

  return {
    periodo: { desde, hasta, zona },
    cascada,
    chequeos,
    tasas: {
      show_rate: showRate,
      no_show: showRate != null ? redondo(1 - showRate, 4) : null,
      tasa_cierre_sobre_asistencias: tasaCierre,
      tasa_cierre_sobre_calificados: tasa(calif.calificados, cierres),
      agendas_por_cierre: cierres > 0 ? redondo(agendas / cierres, 1) : null,
    },
    calificacion: calif,
    creativos,
    plan,
    serie: rep.filas,
    advertencias,
  };
}

/**
 * El corte de calificación sobre los que ASISTIERON, con las respuestas de los
 * que no calificaban.
 *
 * Es el paso 16 del método y fue la sorpresa de la reunión: **21 de 41
 * asistentes no calificaban**, o sea que más de la mitad de las llamadas pagadas
 * eran con gente que no podía comprar. Es la fuga más barata de tapar del embudo
 * entero, y el dato ya estaba en la base sin que nadie lo mirara.
 *
 * ⚠️ Tres estados, no dos: `calificado` es `true` / `false` / NULL, y el NULL no
 * es un «no calificaba» — es «nadie lo marcó». Contarlo como no calificado
 * inventa una fuga que no existe; contarlo como calificado la esconde.
 */
async function leerCalificacion(desde: string, hasta: string): Promise<Calificacion> {
  const db = await getTenantDb();
  type Fila = {
    calificado: boolean | null;
    respuesta_facturacion: string | null; respuesta_inversion: string | null;
    respuesta_colaboradores: string | null; respuesta_decisor: string | null;
    respuesta_objetivo: string | null;
  };
  const filas: Fila[] = [];
  await leerPorPaginas<Fila>(
    db, 'leads',
    'id, calificado, respuesta_facturacion, respuesta_inversion, respuesta_colaboradores, respuesta_decisor, respuesta_objetivo',
    (page) => { filas.push(...page); },
    {
      orden: 'id',
      // Solo los que ASISTIERON: calificar a quien no vino no significa nada.
      eq: { asistio_j1: true },
      filtros: (q) => q.gte('fecha_junta_1', desde).lte('fecha_junta_1', hasta),
    },
  );

  const noCal = filas.filter((f) => f.calificado === false);
  const respuestas = CAMPOS_CALIFICACION.map(([col, pregunta]) => {
    const conteo: Record<string, number> = {};
    for (const f of noCal) {
      const v = (f[col as keyof Fila] as string | null)?.trim();
      if (v) conteo[v] = (conteo[v] ?? 0) + 1;
    }
    return { pregunta, respuestas: conteo };
  }).filter((r) => Object.keys(r.respuestas).length > 0);

  return {
    asistieron: filas.length,
    calificados: filas.filter((f) => f.calificado === true).length,
    no_calificados: noCal.length,
    sin_marcar: filas.filter((f) => f.calificado == null).length,
    respuestas_no_calificados: respuestas,
  };
}

/**
 * El ranking de creativos, desde `marketing_metrics_daily`.
 *
 * ⚠️ POR QUÉ NO SALE DE `leads`: el ranking necesita saber qué anuncio trajo qué
 * agenda, y esa atribución en el CRM prácticamente no existe. Medido en el ws1:
 * de 114 agendados, **9** traen `meta_ad_id`. Los 933 leads que sí lo traen son
 * del formulario instantáneo de Meta, que es otro camino y no agenda. Así que la
 * única fuente que puede rankear anuncios es la atribución del propio Meta.
 */
async function leerCreativos(desde: string, hasta: string): Promise<AnalisisCreativos> {
  const db = await getTenantDb();
  type Fila = {
    fecha: string; ad_id: string | null; ad_name: string | null;
    spend: number | null; impressions: number | null; agendas_meta: number | null;
  };
  const acc = new Map<string, Creativo & { _dias: Set<string> }>();

  await leerPorPaginas<Fila>(
    db, 'marketing_metrics_daily',
    'id, fecha, ad_id, ad_name, spend, impressions, agendas_meta',
    (page) => {
      for (const r of page) {
        if (!r.ad_id) continue;
        let c = acc.get(r.ad_id);
        if (!c) {
          c = {
            ad_id: r.ad_id, nombre: r.ad_name ?? '(sin nombre)',
            agendas: 0, inversion: 0, costo_por_agenda: null, impresiones: 0,
            dias_al_aire: 0, primera_fecha: r.fecha, ultima_fecha: r.fecha,
            _dias: new Set(),
          };
          acc.set(r.ad_id, c);
        }
        c.agendas += num(r.agendas_meta);
        c.inversion += num(r.spend);
        c.impresiones += num(r.impressions);
        c._dias.add(r.fecha);
        if (r.ad_name) c.nombre = r.ad_name;
        if (r.fecha < c.primera_fecha) c.primera_fecha = r.fecha;
        if (r.fecha > c.ultima_fecha) c.ultima_fecha = r.fecha;
      }
    },
    {
      // Mismo orden estable de tres columnas que el resto de las lecturas de esta
      // tabla: ni `fecha` ni `ad_id` son únicos por separado.
      orden: [{ col: 'fecha' }, { col: 'ad_id' }, { col: 'id' }],
      eq: { plataforma: 'meta' },
      filtros: (q) => q.gte('fecha', desde).lte('fecha', hasta),
    },
  );

  const creativos: Creativo[] = [...acc.values()].map((c) => ({
    ad_id: c.ad_id, nombre: c.nombre,
    agendas: c.agendas, inversion: redondo(c.inversion),
    costo_por_agenda: costoPor(c.inversion, c.agendas),
    impresiones: c.impresiones,
    dias_al_aire: c._dias.size,
    primera_fecha: c.primera_fecha, ultima_fecha: c.ultima_fecha,
  }));

  return {
    total_anuncios: creativos.length,
    con_agendas: creativos.filter((c) => c.agendas > 0).length,
    mediana_costo_por_agenda: medianaCosto(creativos),
    top_volumen: ordenarCreativos(creativos, 'volumen').slice(0, 10),
    top_costo: ordenarCreativos(creativos, 'costo', 2).slice(0, 10),
    escondidos: creativosEscondidos(creativos).slice(0, 5),
    nota_fuente:
      'Agendas SEGÚN META (conversión del píxel), por anuncio. No coinciden con las del CRM —Meta se atribuye de más— así que este costo por agenda es OPTIMISTA contra el de la cascada. Sirve para COMPARAR anuncios entre sí, que es para lo que está; no para calcular el costo real de una agenda.',
  };
}
