// =============================================================================
// api-mako/areas/experimentos.run — los cuerpos del área `experimentos`
// =============================================================================
// Un runner por id de experimentos.def.ts. Lecturas: { leer }. Acciones: { preparar,
// ejecutar }. Todo corre adentro de runWithWorkspace(ctx.ws): lib/experimentos,
// lib/retro y lib/retro-pipeline scopean solas con getTenantDb.
//
// ⚠️ EL ESTADO SE MIRA DOS VECES. iniciarExperimento / cerrarExperimento /
// descartarExperimento NO chequean el estado de la fila (iniciar un cerrado lo
// reactiva y pisa el baseline; cerrar un cerrado vuelve a pagar la IA y pisa el
// veredicto; descartar un cerrado lo saca de las verdades de MaKo). preparar() lo
// mira al proponer y ejecutar() lo vuelve a mirar al confirmar: entre los dos
// momentos pasan hasta 2 h y alguien pudo haberlo movido desde la tab.
//
// ⚠️ UNIDADES Y FECHAS. Toda métrica sale del funnel GLOBAL de la cuenta
// (getMarketingWindow), los montos en USD convertidos desde MXN con el tipo de cambio
// fijo de lib/config.ts, y los días se anclan a America/Tijuana (hoyEnTijuana), no a
// la zona del workspace. Se dice en cada salida en `nota_medicion`.
// =============================================================================

import 'server-only';
import type { Ejecutado, Preparado, Runners, SalidaLectura } from '../tipos';
import { runMakoTool } from '@/lib/mako-tools';
import {
  METRICAS, metricaDef, fmtMetrica, listExperimentos, getExperimento, getExperimentosView,
  crearExperimento, iniciarExperimento, cerrarExperimento, descartarExperimento,
  snapshotFunnelTexto, sugerirExperimento, idearExperimentos,
  type Experimento, type Medicion, type Direccion, type Origen,
} from '@/lib/experimentos';
import { listRetros, getRetro, borrarRetro, calcularDestacados, type Retro } from '@/lib/retro';
import { seguimientoUltimaRetro, aplicarPlan, type PlanOp } from '@/lib/retro-pipeline';
import { evaluarGate } from '@/lib/retro-gate';
import { deudaDeLaRetro } from '@/lib/retro-seguimiento';
import { recolectarDatos } from '@/lib/retro-datos';
import type { RetroPlanItem } from '@/lib/retro-reporte';
import { ayerEnTijuana } from '@/lib/date-utils';
import { medirExperimento } from './experimentos.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

const NOTA_MEDICION = 'Métricas del funnel GLOBAL de la cuenta (no por anuncio ni campaña). Montos en USD convertidos desde MXN con un tipo de cambio fijo. Días completos anclados a America/Tijuana. null = no se pudo calcular (fuente sin datos o división por cero), no es 0.';

const num = (input: Record<string, unknown>, k: string): number | null => {
  const v = input[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const str = (input: Record<string, unknown>, k: string): string => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');
const error = (content: string): SalidaLectura => ({ content, isError: true });
const json = (v: unknown): string => JSON.stringify(v);
const corta = (s: string | null | undefined, n: number): string | null => (s == null ? null : s.length > n ? `${s.slice(0, n)}…` : s);
const fallo = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const fechaValida = (s: string): boolean => FECHA_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const diasEntre = (desde: string, hasta: string): number => Math.floor((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000) + 1;

/** Valida un par desde/hasta; devuelve el error legible o null. */
function rangoInvalido(desde: string, hasta: string, maxDias: number): string | null {
  if (!fechaValida(desde) || !fechaValida(hasta)) return 'Las fechas van en formato YYYY-MM-DD (por ejemplo 2026-08-01).';
  if (desde > hasta) return `«desde» (${desde}) es posterior a «hasta» (${hasta}).`;
  const dias = diasEntre(desde, hasta);
  if (dias > maxDias) return `El período tiene ${dias} días; el máximo es ${maxDias}.`;
  return null;
}

const unidadDe = (key: string): string => metricaDef(key)?.formato ?? 'num';

/** Lo que el modelo necesita de un experimento para listar y elegir. */
function compacto(e: Experimento) {
  return {
    id: e.id, titulo: e.titulo, estado: e.estado, origen: e.origen,
    metrica: e.metrica, metrica_nombre: e.metrica_label ?? metricaDef(e.metrica)?.label ?? e.metrica, unidad: unidadDe(e.metrica),
    direccion: e.direccion, ventana_dias: e.ventana_dias,
    fecha_inicio: e.fecha_inicio, fecha_fin: e.fecha_fin, creado_at: e.created_at,
    veredicto: e.veredicto, aprendizaje: corta(e.aprendizaje, 400),
  };
}

function medicionCompacta(m: Medicion | null, metrica: string, conSerie: boolean) {
  if (!m) return null;
  return {
    valor_actual: m.actual, valor_actual_fmt: fmtMetrica(m.actual, metrica),
    baseline_comparable: m.baseline, baseline_comparable_fmt: fmtMetrica(m.baseline, metrica),
    objetivo: m.objetivo, delta_pct: m.delta_pct == null ? null : Math.round(m.delta_pct * 10) / 10, va_bien: m.va_bien,
    dias_corridos: m.dias_corridos, dias_total: m.dias_total,
    ventana_medida: { desde: m.desde, hasta: m.hasta },
    ventana_baseline: { desde: m.baseline_desde, hasta: m.baseline_hasta },
    ...(conSerie ? { serie: m.serie.map((p) => ({ hasta: p.fecha, valor: p.valor })) } : {}),
  };
}

// ── Retro: proyecciones ──────────────────────────────────────────────────────

function itemCompacto(i: RetroPlanItem) {
  return {
    itemId: i.id, tipo: i.kind === 'exp' ? 'experimento' : 'tarea', destacado: i.destacado ?? false, prioridad: i.prio ?? null,
    titulo: i.titulo, por_que: i.why, impacto_estimado: i.impacto, nace_de: i.origen,
    cadena_tareas: i.chain ?? [],
    ...(i.experimento ? { experimento: { ...i.experimento, unidad: unidadDe(i.experimento.metrica) } } : {}),
    ...(i.tarea ? { tarea: i.tarea } : {}),
    estado: i.status
      ? { estado: i.status.estado, motivo: i.status.motivo ?? null, experimento_id: i.status.experimento_id ?? null, tarea_id: i.status.tarea_id ?? null, at: i.status.at }
      : { estado: 'sin_tocar' },
  };
}

async function retroConPlan(retroId: number, itemId: string): Promise<{ retro: Retro; item: RetroPlanItem } | { error: string }> {
  const retro = await getRetro(retroId);
  if (!retro) return { error: `No existe la Retro #${retroId} en este negocio.` };
  if (!retro.reporte) return { error: `La Retro #${retroId} es de un formato viejo (sin reporte v3): su plan no se puede operar.` };
  const item = retro.reporte.plan.find((p) => p.id === itemId);
  if (!item) return { error: `La Retro #${retroId} no tiene el item «${itemId}». Items: ${retro.reporte.plan.map((p) => p.id).join(', ') || '(plan vacío)'}.` };
  return { retro, item };
}

const etiquetaItem = (retroId: number, i: RetroPlanItem): string => `${i.id} de la Retro #${retroId} («${i.titulo}», ${i.kind === 'exp' ? 'experimento' : 'tarea'})`;

const ESTADO_ESPERADO: Record<PlanOp, string> = { aceptar: 'aceptada', posponer: 'pospuesta', descartar: 'descartada', deshacer: 'sin_tocar' };
const estadoDe = (i: RetroPlanItem | undefined): string => i?.status?.estado ?? 'sin_tocar';

/** Las cuatro operaciones sobre un item del plan comparten forma.
 *  ⚠️ aplicarPlan (lib/retro-pipeline.ts) lee retros.reporte ENTERO, lo cambia en
 *  memoria y lo reescribe sin lock ni control de versión: dos decisiones cruzadas
 *  sobre la misma Retro se pisan. Desde acá no se puede cerrar; lo que sí se hace es
 *  mirar el item ANTES (¿cambió desde que se propuso?) y DESPUÉS, releído de la base
 *  (¿quedó como se pidió?), y contestar ok:false si no, para que nadie re-acepte a
 *  ciegas un item cuyo experimento ya existe. */
function accionPlan(op: PlanOp) {
  return {
    preparar: async (input: Record<string, unknown>): Promise<Preparado> => {
      const retroId = num(input, 'retroId');
      const itemId = str(input, 'itemId');
      if (retroId == null || !itemId) return { error: 'Faltan retroId e itemId (de plan_retro).', faltan: ['retroId', 'itemId'] };
      const r = await retroConPlan(retroId, itemId);
      if ('error' in r) return { error: r.error };
      const { item } = r;
      const actual = estadoDe(item);
      if (op === 'aceptar' && actual === 'aceptada') return { error: `El item ${itemId} ya está aceptado.` };
      if (op === 'posponer' && actual === 'pospuesta') return { error: `El item ${itemId} ya está pospuesto.` };
      if (op === 'deshacer' && !item.status) return { error: `El item ${itemId} está sin tocar: no hay nada que deshacer.` };
      const motivo = op === 'descartar' ? (str(input, 'motivo') || 'sin motivo').slice(0, 60) : undefined;
      const eraAceptado = actual === 'aceptada'
        ? ` Ojo: ya estaba aceptado${item.status?.experimento_id ? ` y el experimento #${item.status.experimento_id} sigue existiendo` : ' y lo que se creó sigue existiendo'}; deja de contar como deuda para el gate del Perro.`
        : '';
      let resumen: string;
      if (op === 'aceptar') {
        if (item.kind === 'exp' && item.experimento) {
          const e = item.experimento;
          if (item.expCreado && item.expCreado > 0) {
            const prev = await getExperimento(item.expCreado);
            if (!prev) return { error: `El experimento #${item.expCreado} que se había creado al aceptar este item ya no existe, y aceptar lo reusaría igual. Crea uno nuevo con crear_experimento o acéptalo desde la tab Experiments.` };
            if (prev.estado === 'descartado') return { error: `El experimento #${prev.id} que se había creado al aceptar este item está «descartado», y aceptar lo reusaría: quedaría contando como «en curso» para siempre y trabaría el gate del Perro. Crea uno nuevo con crear_experimento o acéptalo desde la tab Experiments.` };
            resumen = `Aceptar ${etiquetaItem(retroId, item)}: vuelve a marcarlo aceptado y reusa el experimento #${prev.id} que ya se había creado (hoy «${prev.estado}»). No crea nada nuevo.`;
          } else {
            resumen = `Aceptar ${etiquetaItem(retroId, item)}: crea y arranca hoy un experimento que mide ${metricaDef(e.metrica)?.label ?? e.metrica} (${e.direccion}) durante ${e.ventana_dias} días${item.chain?.length ? `, y ${item.chain.length} tarea(s) en el tablero: ${item.chain.join('; ')}` : ''}.`;
          }
        } else {
          resumen = item.expCreado
            ? `Aceptar ${etiquetaItem(retroId, item)}: la tarea ya se había creado antes; solo vuelve a marcarlo aceptado.`
            : `Aceptar ${etiquetaItem(retroId, item)}: crea la tarea en el tablero con origen «retro».`;
        }
      } else if (op === 'posponer') {
        resumen = `Posponer ${etiquetaItem(retroId, item)}. No cuenta como deuda para el gate.${eraAceptado}`;
      } else if (op === 'descartar') {
        resumen = `Descartar ${etiquetaItem(retroId, item)} con motivo «${motivo}».${eraAceptado}`;
      } else {
        resumen = `Deshacer el estado «${actual}» de ${etiquetaItem(retroId, item)}; vuelve a «sin tocar»${item.expCreado ? ' (lo que ya se creó queda)' : ''}.${actual === 'aceptada' ? ' Deja de contar como deuda para el gate del Perro.' : ''}`;
      }
      return { payload: { retroId, itemId, estado_previo: actual, ...(motivo ? { motivo } : {}) }, resumen };
    },
    ejecutar: async (payload: Record<string, unknown>): Promise<Ejecutado> => {
      const retroId = num(payload, 'retroId');
      const itemId = str(payload, 'itemId');
      if (retroId == null || !itemId) return { ok: false, resumen: 'La acción quedó sin retroId o itemId.' };
      try {
        // ANTES: entre proponer y confirmar pasan hasta 2 h; alguien pudo decidir desde la tab.
        const antes = await retroConPlan(retroId, itemId);
        if ('error' in antes) return { ok: false, resumen: antes.error };
        const previo = str(payload, 'estado_previo');
        const ahora = estadoDe(antes.item);
        if (previo && previo !== ahora) {
          return { ok: false, resumen: `No se aplicó: el item ${itemId} de la Retro #${retroId} cambió desde que se propuso (estaba «${previo}», ahora está «${ahora}»). Revisa plan_retro y vuelve a pedirlo si sigue haciendo falta.` };
        }
        const escrito = await aplicarPlan(retroId, itemId, op, op === 'descartar' ? str(payload, 'motivo') || undefined : undefined);
        const creado = escrito.plan.find((p) => p.id === itemId)?.expCreado;

        // DESPUÉS: se relee de la base, no del reporte en memoria que devolvió aplicarPlan.
        const despues = await getRetro(retroId);
        const item = despues?.reporte?.plan.find((p) => p.id === itemId);
        const quedo = estadoDe(item);
        const esperado = ESTADO_ESPERADO[op];
        if (quedo !== esperado) {
          const huella = op === 'aceptar' && creado
            ? creado > 0
              ? ` El experimento #${creado} (y sus tareas, si tenía cadena) YA se creó: no lo vuelvas a aceptar sin revisar listar_experimentos, porque re-aceptar puede duplicarlo.`
              : ' La tarea YA se creó en el tablero: no lo vuelvas a aceptar sin revisarlo, porque re-aceptar puede duplicarla.'
            : '';
          return { ok: false, resumen: `Otra decisión sobre la misma Retro pisó esta escritura: el item ${itemId} quedó «${quedo}» en vez de «${esperado}».${huella}`, datos: { retroId, itemId, estado: quedo, experimento_creado: creado && creado > 0 ? creado : null } };
        }
        const st = item?.status;
        const verbo = { aceptar: 'Aceptado', posponer: 'Pospuesto', descartar: 'Descartado', deshacer: 'Deshecho' }[op];
        let extra = '';
        if (st?.experimento_id) {
          const exp = await getExperimento(st.experimento_id).catch(() => null);
          extra = exp ? ` Experimento #${exp.id}, hoy «${exp.estado}».` : ` Experimento #${st.experimento_id} (no se pudo leer su estado).`;
        } else if (st?.tarea_id) {
          extra = ` Tarea #${st.tarea_id} en el tablero.`;
        }
        return { ok: true, resumen: `${verbo}: ${itemId} de la Retro #${retroId}${item ? ` («${item.titulo}»)` : ''}.${extra}`, datos: { retroId, itemId, estado: quedo, experimento_id: st?.experimento_id ?? null, tarea_id: st?.tarea_id ?? null } };
      } catch (err) {
        return { ok: false, resumen: `No se pudo aplicar sobre ${itemId} de la Retro #${retroId}: ${fallo(err)}.` };
      }
    },
  };
}

/** Relee el experimento al confirmar y exige uno de los estados permitidos. */
async function experimentoEn(id: number | null, permitidos: readonly Experimento['estado'][], verbo: string): Promise<{ exp: Experimento } | { error: string }> {
  if (id == null) return { error: 'Falta el id del experimento.' };
  const exp = await getExperimento(id);
  if (!exp) return { error: `No existe el experimento #${id} en este negocio.` };
  if (!permitidos.includes(exp.estado)) return { error: `No se puede ${verbo} el experimento #${id} («${exp.titulo}»): está «${exp.estado}» y solo aplica a ${permitidos.join(' o ')}.` };
  return { exp };
}

// ── runners ──────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // Heredada de MAKO_TOOLS: mismo cuerpo, mismo nombre.
  estado_experimentos: { leer: (input) => runMakoTool('estado_experimentos', input) },

  listar_experimentos: {
    leer: async (input) => {
      const estado = str(input, 'estado');
      const limite = num(input, 'limite') ?? 50;
      const todos = await listExperimentos();
      const filtrados = estado ? todos.filter((e) => e.estado === estado) : todos;
      const dev = filtrados.slice(0, limite);
      return json({
        total: filtrados.length, devueltos: dev.length, quedaron_afuera: filtrados.length - dev.length,
        ...(estado ? { filtro_estado: estado } : {}),
        experimentos: dev.map(compacto),
        nota: 'Ordenados del más reciente al más viejo. Sin medición en vivo.',
      });
    },
  },

  ficha_experimento: {
    leer: async (input) => {
      const id = num(input, 'id');
      const e = id == null ? null : await getExperimento(id);
      if (!e) return error(`No existe el experimento #${id} en este negocio.`);
      const cfg = e.config ?? {};
      return json({
        ...compacto(e),
        aprendizaje: e.aprendizaje,
        hipotesis: e.hipotesis, cambio: e.cambio, criterio_exito: e.criterio_exito, racional: e.racional,
        objetivo_valor: e.objetivo_valor, objetivo_fmt: e.objetivo_valor == null ? null : fmtMetrica(e.objetivo_valor, e.metrica),
        presupuesto_usd: e.presupuesto_usd,
        baseline_guardado: { valor: e.baseline_valor, valor_fmt: fmtMetrica(e.baseline_valor, e.metrica), desde: e.baseline_desde, hasta: e.baseline_hasta },
        resultado_valor: e.resultado_valor, resultado_fmt: e.resultado_valor == null ? null : fmtMetrica(e.resultado_valor, e.metrica),
        cerrado_at: e.cerrado_at,
        nacio_de_retro: typeof cfg.retro_id === 'number' ? cfg.retro_id : null,
        ...(e.estado === 'activo' ? { advertencia: 'Activo: el baseline guardado es el de la ventana COMPLETA previa al inicio y no es el que se compara mientras corre. Para la comparación honesta usa medicion_experimento.' } : {}),
        nota_medicion: NOTA_MEDICION,
      });
    },
  },

  vista_experimentos: {
    leer: async () => {
      const v = await getExperimentosView();
      return json({
        contadores: v.counts,
        activos: v.activos.map((e) => ({ ...compacto(e), medicion: medicionCompacta(e.medicion, e.metrica, false) ?? 'no se pudo medir' })),
        propuestos: v.propuestos.map(compacto),
        cerrados: v.aprendizajes.map((e) => ({ ...compacto(e), baseline_valor: e.baseline_valor, resultado_valor: e.resultado_valor })),
        descartados: v.descartados.map((e) => ({ id: e.id, titulo: e.titulo, metrica: e.metrica })),
        nota_medicion: NOTA_MEDICION,
      });
    },
  },

  medicion_experimento: {
    leer: async (input) => {
      const id = num(input, 'id');
      const e = id == null ? null : await getExperimento(id);
      if (!e) return error(`No existe el experimento #${id} en este negocio.`);
      if (e.estado === 'cerrado') {
        const serie = Array.isArray(e.config?.serie_cierre) ? (e.config!.serie_cierre as Array<{ fecha: string; valor: number | null }>) : [];
        return json({
          ...compacto(e), aprendizaje: e.aprendizaje,
          medicion_al_cierre: {
            resultado: e.resultado_valor, resultado_fmt: fmtMetrica(e.resultado_valor, e.metrica),
            baseline_comparable: e.baseline_valor, baseline_comparable_fmt: fmtMetrica(e.baseline_valor, e.metrica),
            ventana_baseline: { desde: e.baseline_desde, hasta: e.baseline_hasta },
            cerrado_at: e.cerrado_at,
            serie: serie.map((p) => ({ hasta: p.fecha, valor: p.valor })),
          },
          nota_medicion: NOTA_MEDICION,
        });
      }
      if (e.estado !== 'activo') return error(`El experimento #${e.id} está «${e.estado}»: solo los activos (en vivo) y los cerrados (al cierre) tienen medición.`);
      // Mide SOLO este (experimentos.helpers: medir() no está exportada en la lib).
      const med = await medirExperimento(e, true);
      if (!med) return error(`El experimento #${e.id} figura activo pero no tiene fecha de inicio: no se puede medir.`);
      return json({
        ...compacto(e), objetivo_fmt: e.objetivo_valor == null ? null : fmtMetrica(e.objetivo_valor, e.metrica),
        medicion: medicionCompacta(med, e.metrica, true),
        ...(med.actual == null || med.baseline == null ? { advertencia: 'Uno de los dos valores salió null: la fuente no tuvo datos en esa ventana, la cuenta dio división por cero o la lectura falló por dentro (la lib no distingue esos casos). No es 0.' } : {}),
        nota_medicion: NOTA_MEDICION,
      });
    },
  },

  listar_conclusiones_experimentos: {
    leer: async (input) => {
      const veredicto = str(input, 'veredicto');
      const limite = num(input, 'limite') ?? 50;
      const cerrados = (await listExperimentos()).filter((e) => e.estado === 'cerrado' && (!veredicto || e.veredicto === veredicto));
      const dev = cerrados.slice(0, limite);
      return json({
        total: cerrados.length, devueltos: dev.length, quedaron_afuera: cerrados.length - dev.length,
        ...(veredicto ? { filtro_veredicto: veredicto } : {}),
        conclusiones: dev.map((e) => ({
          id: e.id, titulo: e.titulo, veredicto: e.veredicto, aprendizaje: e.aprendizaje,
          metrica: e.metrica, metrica_nombre: e.metrica_label ?? e.metrica, unidad: unidadDe(e.metrica), direccion: e.direccion,
          baseline_valor: e.baseline_valor, resultado_valor: e.resultado_valor,
          cambio_fmt: `${fmtMetrica(e.baseline_valor, e.metrica)} → ${fmtMetrica(e.resultado_valor, e.metrica)}`,
          fecha_inicio: e.fecha_inicio, cerrado_at: e.cerrado_at,
        })),
        nota_medicion: NOTA_MEDICION,
      });
    },
  },

  catalogo_metricas_experimento: {
    leer: async () => json({
      metricas: METRICAS.map((m) => ({ key: m.key, nombre: m.label, unidad: m.formato, mejora_natural: m.mejor, calculo: m.desc })),
      nota: 'unidad: usd = dólares, pct = porcentaje (0 a 100), num = cantidad. ' + NOTA_MEDICION,
    }),
  },

  snapshot_funnel_experimentos: {
    leer: async (input) => {
      const t = await snapshotFunnelTexto(num(input, 'dias') ?? 30);
      return `${t}\n\n${NOTA_MEDICION} «—» = no se pudo calcular.`;
    },
  },

  sugerir_experimento: {
    leer: async (input) => {
      const hipotesis = str(input, 'hipotesis');
      if (!hipotesis) return error('Falta la hipótesis.');
      const p = await sugerirExperimento(hipotesis, str(input, 'contexto') || undefined);
      return json({ propuesta: { ...p, unidad: unidadDe(p.metrica) }, guardado: false, siguiente: 'Muéstrasela a la persona; si la quiere, pásala a crear_experimento.', nota_medicion: NOTA_MEDICION });
    },
  },

  idear_experimentos: {
    leer: async (input) => {
      const n = Math.max(1, Math.min(5, num(input, 'n') ?? 3));
      const ideas = await idearExperimentos(n);
      return json({ ideas: ideas.map((p) => ({ ...p, unidad: unidadDe(p.metrica) })), guardado: false, siguiente: 'La persona elige cuáles crear con crear_experimento.', nota_medicion: NOTA_MEDICION });
    },
  },

  listar_retros: {
    leer: async (input) => {
      const limite = num(input, 'limite') ?? 10;
      const todas = await listRetros();
      const dev = todas.slice(0, limite);
      return json({
        total: todas.length, devueltas: dev.length, quedaron_afuera: todas.length - dev.length,
        retros: dev.map((r) => ({
          id: r.id, corrida_at: r.created_at, periodo: { desde: r.periodo_desde, hasta: r.periodo_hasta },
          titulo: r.titulo, resumen: corta(r.resumen, 500),
          destacados: (r.destacados ?? []).map((d) => ({ metrica: d.metrica, nombre: d.label, valor: d.valor, valor_periodo_anterior: d.valor_prev, delta_pct: d.delta == null ? null : Math.round(d.delta * 10) / 10 })),
          reporte_v3: !!r.reporte,
          items_plan: r.reporte?.plan.length ?? 0,
          items_aceptados: r.reporte?.plan.filter((p) => p.status?.estado === 'aceptada').length ?? 0,
        })),
        nota: 'Más recientes primero. Los valores destacados vienen ya formateados (USD o cantidad); «—» = no se pudo calcular.',
      });
    },
  },

  ficha_retro: {
    leer: async (input) => {
      const id = num(input, 'retroId');
      const r = id == null ? null : await getRetro(id);
      if (!r) return error(`No existe la Retro #${id} en este negocio.`);
      const base = { id: r.id, corrida_at: r.created_at, periodo: { desde: r.periodo_desde, hasta: r.periodo_hasta }, titulo: r.titulo, destacados: r.destacados ?? [] };
      if (!r.reporte) return json({ ...base, formato: 'viejo (sin reporte v3)', resumen: r.resumen, recomendaciones: r.recomendaciones ?? [], nota: 'Retro de formato viejo: su plan no se puede aceptar ni descartar.' });
      const rep = r.reporte;
      const sinVerificar = rep.proceso.some((p) => p.fase === 'verificacion' && /sin margen/i.test(p.label));
      return json({
        ...base, formato: 'v3',
        tesis: rep.tesis.texto, fuga: rep.fuga ?? null,
        areas: rep.areas.map((a) => ({ area: a.id, nombre: a.name, salud: a.st, linea: a.line })),
        hallazgos: rep.findings.map((f) => ({ id: f.id, tipo: f.tipo, area: f.area, cruce: f.cross ?? null, corto: f.short, insight: f.insight, fuente: f.source, tab: f.tab, evidencia: f.ev, item_plan: f.recId ?? null })),
        plan: rep.plan.map(itemCompacto),
        seguimiento_retro_anterior: rep.seguimiento,
        cobertura: rep.cobertura,
        verificacion_salteada: sinVerificar,
        ...(sinVerificar ? { advertencia: 'La fase de verificación de números se salteó por tiempo: la tesis y la fuga en plata son el borrador sin verificar.' } : {}),
      });
    },
  },

  plan_retro: {
    leer: async (input) => {
      const id = num(input, 'retroId');
      const r = id == null ? null : await getRetro(id);
      if (!r) return error(`No existe la Retro #${id} en este negocio.`);
      if (!r.reporte) return error(`La Retro #${id} es de formato viejo (sin reporte v3): no tiene plan operable. Usa ficha_retro para leer sus recomendaciones.`);
      return json({ retroId: r.id, periodo: { desde: r.periodo_desde, hasta: r.periodo_hasta }, items: r.reporte.plan.map(itemCompacto) });
    },
  },

  seguimiento_ultima_retro: {
    leer: async () => {
      const s = await seguimientoUltimaRetro();
      if (!s.items.length) return json({ items: [], corrida_at: s.corridaISO, nota: 'Sin items: no hay Retro con plan, el plan está vacío, o la lectura falló por dentro (la lib no distingue esos casos).' });
      return json({
        corrida_at: s.corridaISO,
        items: s.items.map((i) => ({ titulo: i.title, estado: i.estado, avance: i.st === 'done' ? 'hecho' : i.st === 'curso' ? 'en_curso' : 'no', efecto: i.fx })),
        deuda: deudaDeLaRetro(s.items),
        nota: 'Solo lo ACEPTADO es deuda; pospuesto, descartado y sin tocar no cuentan.',
      });
    },
  },

  estado_gate_retro: {
    leer: async () => {
      const s = await seguimientoUltimaRetro();
      const g = await evaluarGate(s.items, s.corridaISO);
      return json({
        bloquea: g.bloquea, modo: g.modo, deuda: g.deuda, pendientes: g.pendientes,
        ultima_corrida_at: g.ultimaCorridaISO, dias_desde_ultima: g.diasDesde,
        ...(s.items.length ? {} : { advertencia: 'Sin items: no hay Retro con plan, el plan está vacío, o la lectura falló por dentro (la lib no distingue esos casos). «No bloquea» puede ser falta de dato: no lo afirmes como un hecho.' }),
        nota: g.bloquea
          ? 'Bloquea: antes de una Retro nueva hay que terminar lo aceptado, o dar un motivo que el Perro evalúa al correrla desde la tab Experiments.'
          : 'No bloquea. La Retro se corre desde la tab Experiments.',
      });
    },
  },

  destacados_periodo_retro: {
    leer: async (input) => {
      const desde = str(input, 'desde');
      const pedido = str(input, 'hasta');
      // Hoy está incompleto: un período que lo incluye se compara contra uno completo
      // y marca «empeoró» en conteos y gasto. Se recorta a ayer (Tijuana) y se dice.
      const ayer = ayerEnTijuana();
      const hasta = fechaValida(pedido) && pedido > ayer ? ayer : pedido;
      const mal = rangoInvalido(desde, hasta, 730);
      if (mal) return error(hasta !== pedido ? `${mal} («hasta» se recortó de ${pedido} a ${ayer}: hoy está incompleto).` : mal);
      const { destacados, snapshot } = await calcularDestacados(desde, hasta);
      const { desde: _d, hasta: _h, prevDesde, prevHasta, ...valores } = snapshot as Record<string, unknown>;
      void _d; void _h;
      return json({
        periodo: { desde, hasta, dias: diasEntre(desde, hasta) },
        ...(hasta !== pedido ? { hasta_ajustado: { pedido, usado: hasta, motivo: 'hoy está incompleto: se usa ayer como máximo (America/Tijuana)' } } : {}),
        periodo_anterior: { desde: prevDesde, hasta: prevHasta },
        destacados: destacados.map((d) => ({ metrica: d.metrica, nombre: d.label, unidad: unidadDe(d.metrica), valor: d.valor, valor_periodo_anterior: d.valor_prev, delta_pct: d.delta == null ? null : Math.round(d.delta * 10) / 10, lectura: d.tono === 'good' ? 'mejoró' : d.tono === 'bad' ? 'empeoró' : 'estable o sin dato' })),
        metricas_periodo: Object.keys(valores).length ? Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, { valor: v, unidad: unidadDe(k) }])) : 'sin datos del período',
        nota_medicion: `${NOTA_MEDICION} «mejoró/empeoró» usa la dirección natural de cada métrica y un umbral de 3 %.`,
      });
    },
  },

  cobertura_datos_retro: {
    leer: async (input) => {
      const desde = str(input, 'desde');
      const hasta = str(input, 'hasta');
      const mal = rangoInvalido(desde, hasta, 730);
      if (mal) return error(mal);
      const d = await recolectarDatos(desde, hasta);
      return json({
        periodo: { desde, hasta },
        huecos: d.cobertura.map((c) => ({ que_falta: c.label, gravedad: c.tone === 'warn' ? 'alerta' : 'informativo', accion_sugerida: c.accion ?? null })),
        nota: 'Una fuente que falla al consultarse se omite sin aviso: una lista vacía no garantiza cobertura completa.',
      });
    },
  },

  // ── acciones chat ──────────────────────────────────────────────────────────

  iniciar_experimento: {
    preparar: async (input) => {
      const r = await experimentoEn(num(input, 'id'), ['propuesto'], 'arrancar');
      if ('error' in r) return { error: r.error };
      const e = r.exp;
      return {
        payload: { id: e.id },
        resumen: `Arrancar el experimento #${e.id} «${e.titulo}»: desde hoy mide ${e.metrica_label ?? e.metrica} (${e.direccion}) durante ${e.ventana_dias} días, con el baseline de los ${e.ventana_dias} días previos.`,
      };
    },
    ejecutar: async (payload) => {
      const r = await experimentoEn(num(payload, 'id'), ['propuesto'], 'arrancar');
      if ('error' in r) return { ok: false, resumen: r.error };
      try {
        const e = await iniciarExperimento(r.exp.id);
        return { ok: true, resumen: `Experimento #${e.id} «${e.titulo}» activo del ${e.fecha_inicio} al ${e.fecha_fin}; baseline ${fmtMetrica(e.baseline_valor, e.metrica)} (${e.baseline_desde} a ${e.baseline_hasta}).`, datos: { experimento_id: e.id } };
      } catch (err) {
        return { ok: false, resumen: `No se pudo arrancar el experimento #${r.exp.id}: ${fallo(err)}.` };
      }
    },
  },

  cerrar_experimento: {
    preparar: async (input) => {
      const r = await experimentoEn(num(input, 'id'), ['activo'], 'cerrar');
      if ('error' in r) return { error: r.error };
      const e = r.exp;
      if (!e.fecha_inicio) return { error: `El experimento #${e.id} figura activo pero no tiene fecha de inicio: no se puede medir.` };
      // La persona confirma algo irreversible que se vuelve verdad citada: ve el número ANTES.
      const med = await medirExperimento(e, false);
      const delta = med?.delta_pct == null ? 'Δ sin calcular' : `Δ ${med.delta_pct > 0 ? '+' : ''}${med.delta_pct.toFixed(1)} %`;
      const numero = med
        ? `baseline ${fmtMetrica(med.baseline, e.metrica)} → actual ${fmtMetrica(med.actual, e.metrica)} (${delta}), ${med.dias_corridos} de ${med.dias_total} días corridos`
        : 'no se pudo medir ahora';
      const faltan = med ? med.dias_total - med.dias_corridos : 0;
      const antesDeTiempo = faltan > 0 ? ` Cierra ANTES de que termine la ventana (faltan ${faltan} días).` : '';
      return {
        payload: { id: e.id },
        resumen: `Cerrar el experimento #${e.id} «${e.titulo}» (${e.metrica_label ?? e.metrica}, ${e.direccion}): ${numero}.${antesDeTiempo} Al confirmar se vuelve a medir y MaKo dicta el veredicto con ese número. Es irreversible.`,
      };
    },
    ejecutar: async (payload) => {
      const r = await experimentoEn(num(payload, 'id'), ['activo'], 'cerrar');
      if ('error' in r) return { ok: false, resumen: r.error };
      try {
        const e = await cerrarExperimento(r.exp.id);
        return { ok: true, resumen: `Experimento #${e.id} «${e.titulo}» cerrado: ${e.veredicto ?? 'sin veredicto'} (${fmtMetrica(e.baseline_valor, e.metrica)} → ${fmtMetrica(e.resultado_valor, e.metrica)}). ${e.aprendizaje ?? ''}`.trim(), datos: { experimento_id: e.id, veredicto: e.veredicto } };
      } catch (err) {
        return { ok: false, resumen: `No se pudo cerrar el experimento #${r.exp.id}: ${fallo(err)}.` };
      }
    },
  },

  descartar_experimento: {
    preparar: async (input) => {
      const r = await experimentoEn(num(input, 'id'), ['propuesto', 'activo'], 'descartar');
      if ('error' in r) return { error: r.error };
      return { payload: { id: r.exp.id }, resumen: `Descartar el experimento #${r.exp.id} «${r.exp.titulo}» (hoy ${r.exp.estado}): se abandona sin veredicto.` };
    },
    ejecutar: async (payload) => {
      const r = await experimentoEn(num(payload, 'id'), ['propuesto', 'activo'], 'descartar');
      if ('error' in r) return { ok: false, resumen: r.error };
      try {
        await descartarExperimento(r.exp.id);
        return { ok: true, resumen: `Experimento #${r.exp.id} «${r.exp.titulo}» descartado.`, datos: { experimento_id: r.exp.id } };
      } catch (err) {
        return { ok: false, resumen: `No se pudo descartar el experimento #${r.exp.id}: ${fallo(err)}.` };
      }
    },
  },

  aceptar_item_plan_retro: { ...accionPlan('aceptar') },
  posponer_item_plan_retro: { ...accionPlan('posponer') },
  descartar_item_plan_retro: { ...accionPlan('descartar') },
  deshacer_item_plan_retro: { ...accionPlan('deshacer') },

  // ── acciones pantalla (genérica /mako/revisar: preparar recibe los `parametros`) ──

  crear_experimento: {
    preparar: async (input) => {
      const metrica = str(input, 'metrica');
      const def = metricaDef(metrica);
      if (!def) return { error: `La métrica «${metrica}» no está en el catálogo.`, disponibles: METRICAS.map((m) => m.key) };
      const titulo = str(input, 'titulo');
      const hipotesis = str(input, 'hipotesis');
      const direccion = str(input, 'direccion');
      const ventana = num(input, 'ventana_dias');
      const faltan = [!titulo && 'titulo', !hipotesis && 'hipotesis', !['subir', 'bajar'].includes(direccion) && 'direccion', ventana == null && 'ventana_dias'].filter(Boolean) as string[];
      if (faltan.length) return { error: `Faltan datos para crear el experimento: ${faltan.join(', ')}.`, faltan };
      const arrancar = input.arrancar !== false;
      const objetivo = num(input, 'objetivo_valor');
      const payload: Record<string, unknown> = {
        titulo, hipotesis, metrica: def.key, direccion, ventana_dias: Math.max(3, Math.min(90, Math.round(ventana!))), arrancar,
        cambio: str(input, 'cambio') || null, objetivo_valor: objetivo, criterio_exito: str(input, 'criterio_exito') || null,
        presupuesto_usd: num(input, 'presupuesto_usd'), racional: str(input, 'racional') || null,
        origen: str(input, 'origen') === 'manual' ? 'manual' : 'mako',
      };
      const resumen = `Crear el experimento «${titulo}»: ${direccion} ${def.label} (${def.formato}) en ${payload.ventana_dias} días${objetivo != null ? `, objetivo ${fmtMetrica(objetivo, def.key)}` : ''}. ${arrancar ? 'Arranca hoy con el baseline de la ventana previa.' : 'Queda propuesto, sin arrancar.'}`;
      return { payload, resumen };
    },
    ejecutar: async (payload) => {
      try {
        const e = await crearExperimento({
          titulo: String(payload.titulo ?? ''), hipotesis: String(payload.hipotesis ?? ''),
          metrica: String(payload.metrica ?? ''), direccion: payload.direccion as Direccion,
          ventana_dias: Number(payload.ventana_dias), arrancar: payload.arrancar !== false,
          cambio: (payload.cambio as string | null) ?? null, objetivo_valor: (payload.objetivo_valor as number | null) ?? null,
          criterio_exito: (payload.criterio_exito as string | null) ?? null, presupuesto_usd: (payload.presupuesto_usd as number | null) ?? null,
          racional: (payload.racional as string | null) ?? null, origen: (payload.origen as Origen) ?? 'mako',
        });
        const arranque = e.estado === 'activo' ? ` Activo del ${e.fecha_inicio} al ${e.fecha_fin}; baseline ${fmtMetrica(e.baseline_valor, e.metrica)}.` : ' Quedó propuesto, sin arrancar.';
        return { ok: true, resumen: `Experimento #${e.id} «${e.titulo}» creado.${arranque}`, datos: { experimento_id: e.id } };
      } catch (err) {
        return { ok: false, resumen: `No se pudo crear el experimento: ${fallo(err)}.` };
      }
    },
  },

  borrar_retro: {
    preparar: async (input) => {
      const id = num(input, 'retroId');
      if (id == null) return { error: 'Falta el retroId de la Retro.', faltan: ['retroId'] };
      const r = await getRetro(id);
      if (!r) return { error: `No existe la Retro #${id} en este negocio.` };
      const ultima = r.reporte ? (await listRetros()).find((x) => x.reporte) : undefined;
      const esUltima = ultima?.id === r.id;
      return {
        payload: { retroId: id },
        resumen: `Borrar la Retro #${id} «${r.titulo}» (${r.periodo_desde} a ${r.periodo_hasta}, corrida ${r.created_at.slice(0, 10)}).${esUltima ? ' Es la última con reporte: cambia la memoria y el gate del Perro de la próxima Retro.' : ''} No se puede deshacer.`,
      };
    },
    ejecutar: async (payload) => {
      const id = num(payload, 'retroId');
      if (id == null) return { ok: false, resumen: 'La acción quedó sin retroId.' };
      const r = await getRetro(id);
      if (!r) return { ok: false, resumen: `La Retro #${id} ya no existe.` };
      try {
        await borrarRetro(id);
        return { ok: true, resumen: `Retro #${id} «${r.titulo}» borrada.`, datos: { retro_id: id } };
      } catch (err) {
        return { ok: false, resumen: `No se pudo borrar la Retro #${id}: ${fallo(err)}.` };
      }
    },
  },
};

