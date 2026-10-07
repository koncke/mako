// =============================================================================
// curso-propuesta-ia — el DISPARO del paso 5 de #665: la IA propone, el cliente decide
// =============================================================================
// «Paso 5: IA + aprobación» (Martín, 06/10/2026). Cuando el cron de las sesiones de entrega
// (lib/closing-entrega.ts, `drenarSesionesEntrega`) termina de analizar una sesión que tiene
// cliente, esto toma las respuestas que ese cliente ya ENVIÓ (antes de la sesión) y le pide a la IA
// gratis que las reescriba con lo que se habló. Lo que valida contra el formulario de su clase queda
// AL LADO de su respuesta (`valores_ia`, mig 0213); el cliente lo aprueba o lo corrige en su portal.
// Las reglas puras (qué se propone, qué valida, los prompts) viven en lib/curso-propuesta.ts.
//
// ⚠️ NADA DE ACÁ LE ESCRIBE A NADIE: no manda WhatsApp ni mail, y no toca `valores` (lo que escribió
// el cliente). Mauricio: «no quisiera automatizarlo al cien por ciento».
//
// ⚠️ LA COLA SE CALCULA, como la del análisis: sesiones de entrega analizadas, con cliente, que
// todavía no se miraron para proponer (`closing_analyses.curso_propuesta_at` NULL). Así una sesión
// analizada cuando ya no quedaba tiempo se propone en la corrida siguiente — no se pierde — y una que
// alguien ata a mano a su cliente después entra sola.
//
// ⚠️ SE MIRA UNA VEZ: la sesión se MARCA antes de llamar a la IA (compare-and-set sobre
// `curso_propuesta_at`, así dos corridas no proponen dos veces) y queda marcada pase lo que pase.
// Si la IA falla, no hay propuesta y no pasa nada más (la decisión de Martín) — queda escrito por qué
// en `curso_propuesta_nota`.
//
// IA: US$0. `cs-propuesta-curso` está en el catálogo con Gemini y `fallback: []`, sin fila en
// CLAUDE_PERMITIDO, y va por `chatClaude` con `sinRespaldoDeModelo` como `cs-sesion`: si Gemini no
// contesta, FALLA (no se degrada ni se paga). Nunca Claude.

import 'server-only';
import { getTenantDb } from './workspace';
import { chatClaude } from './anthropic';
import { contenidoNoConfiable, getPromptText, renderPrompt } from './prompt-render';
import { fetchMeetingContent, type FathomMeeting } from './fathom-api';
import { transcriptWithSeconds } from './closing';
import { modeloDeFeature } from './model-registry';
import { provsDe, type ProvName } from './ai-cheap';
import { conPlazo, VERSION_ENTREGA } from './closing-entrega-contrato';
import {
  clasesDelProducto, productosDelAlumno, etapaActualDe, respuestasParaPropuesta, guardarPropuestaIA,
} from './curso-datos';
import {
  candidatasDePropuesta, etapasDePropuesta, instanteDeSesion, validarPropuesta, leerPropuestas, bloqueRespuestas,
  PROPUESTA_SYSTEM_TEMPLATE, PROPUESTA_USER_TEMPLATE, TOPE_CANDIDATAS,
  type Candidata, type MotivoRechazo,
} from './curso-propuesta';

/** El tag de gasto: el que está en `CATALOGO_MODELOS` (lib/model-catalogo.ts). */
export const FEATURE_PROPUESTA = 'cs-propuesta-curso';

/** Bajar el transcript de Fathom, cuando la sesión no se analizó en esta misma corrida. */
const TOPE_FATHOM_MS = 20_000;
/** Leer lo del cliente y armar el prompt. */
const MARGEN_PREPARAR_MS = 5_000;
/** UN intento entero de la IA: el techo que `chatClaude` le pone a la cascada barata (120 s). */
const LLAMADA_IA_MS = 120_000;
/** Todo lo que la IA puede tardar con sus reintentos (lo mismo que el análisis). */
const PRESUPUESTO_IA_MS = 130_000;
/** Escribir las propuestas y la nota. */
const MARGEN_ESCRITURA_MS = 5_000;
/** Lo que se reserva antes de mirar UNA sesión que necesita la IA: si no entra entera, a la próxima. */
export const RESERVA_PROPUESTA_MS = TOPE_FATHOM_MS + MARGEN_PREPARAR_MS + LLAMADA_IA_MS + MARGEN_ESCRITURA_MS;
/** Lo que cuesta mirar una sesión SIN IA (sólo lecturas): para no empezar una con el corte encima. */
const MARGEN_LECTURA_MS = 10_000;

/**
 * Cuántas sesiones se miran por corrida. Las que no tienen nada que proponer cuestan sólo lecturas;
 * el tope existe por el histórico (129 sesiones del ws1 que el análisis va drenando): cada una entra
 * a esta cola una vez y sale marcada «sin respuestas», de a diez.
 */
export const TOPE_SESIONES_POR_CORRIDA = 10;

/**
 * El tope de SALIDA. Gemini piensa con los mismos tokens que escribe (lib/closing-entrega.ts lo
 * midió), y acá la salida son formularios enteros reescritos, tablas incluidas.
 */
const MAX_TOKENS = 16_000;
/** El transcript entero: Gemini come 1M de tokens (lo mismo que el análisis). */
const TOPE_TRANSCRIPT = 150_000;

/** Lo que el análisis de la sesión ya tenía en la mano: así no se le vuelve a pedir a Fathom. */
export type SesionEnMemoria = { items: NonNullable<FathomMeeting['transcript']>; resumenFathom: string | null };

export type ResultadoPropuestas = {
  /** Sesiones miradas (y marcadas) en esta corrida. */
  miradas: number;
  /** Propuestas escritas. */
  propuestas: number;
  /** Sesiones sin ninguna respuesta enviada antes de ellas: no hay nada que proponer. */
  sinRespuestas: number;
  /** Sesiones donde la IA (o Fathom) no contestó: sin propuesta, y no se reintenta. */
  fallidas: number;
  /** Por qué se cortó la pasada, si se cortó. */
  corto?: 'tiempo' | 'sin_ia';
  motivo?: string;
};

type FilaSesion = {
  recording_id: number;
  lead_id: number;
  title: string | null;
  call_date: string | null;
  started_at: string | null;
  duration_min: number | null;
  closer: string | null;
  summary: string | null;
};

const msgDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** ¿Hay con qué proponer en ESTE workspace? La misma pregunta que el análisis (`motivoSinIA`). */
async function motivoSinIA(): Promise<string | null> {
  const ref = await modeloDeFeature(FEATURE_PROPUESTA).catch(() => null);
  if (!ref) return `la feature ${FEATURE_PROPUESTA} no está en el catálogo de modelos`;
  if (ref.provider === 'anthropic') return `${FEATURE_PROPUESTA} apunta a Claude, y esta propuesta no se paga`;
  const keys = await provsDe(ref.provider as ProvName).catch(() => []);
  return keys.length ? null : `este negocio no tiene key de ${ref.provider} cargada`;
}

/**
 * Marca la sesión como mirada, sólo si nadie la marcó antes (compare-and-set). `true` = es nuestra.
 * La nota se puede reescribir después (`anotar`) con lo que salió.
 */
async function marcar(recordingId: number, nota: string): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db.from('closing_analyses')
    .update({ curso_propuesta_at: new Date().toISOString(), curso_propuesta_nota: nota.slice(0, 400) })
    .eq('recording_id', recordingId).is('curso_propuesta_at', null)
    .select('recording_id');
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** Deja escrito qué salió de una sesión ya marcada. No tira: la nota no puede tumbar lo que se escribió. */
async function anotar(recordingId: number, nota: string): Promise<void> {
  try {
    const db = await getTenantDb();
    const { error } = await db.from('closing_analyses').update({ curso_propuesta_nota: nota.slice(0, 400) }).eq('recording_id', recordingId);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error(`[curso-propuesta] no pude anotar la sesión ${recordingId}: ${msgDe(e)}`);
  }
}

/**
 * Las respuestas de este cliente sobre las que se propone, para una sesión que fue en `sesionAt`.
 * Por cada producto suyo con clases: las de la etapa ANTERIOR a la actual y las de la actual
 * (`etapasDePropuesta` dice por qué no sólo la actual). Tira si no puede leer: una lectura caída no
 * es «no hay nada que proponer», y la sesión se vuelve a mirar en la próxima corrida.
 */
async function candidatasDeLead(leadId: number, sesionAt: number): Promise<Candidata[]> {
  const { entregaDeProductoEstricta } = await import('./entrega-servicio');
  const [productos, resp] = await Promise.all([productosDelAlumno(leadId), respuestasParaPropuesta(leadId)]);
  if (!productos.length || !resp.filas.length) return [];
  const out: Candidata[] = [];
  for (const productoId of productos) {
    const clases = await clasesDelProducto(productoId);
    if (!clases.length) continue;
    // ⚠️ LA ESTRICTA: con la lectura caída, la otra contesta las etapas de FÁBRICA, y se decidiría
    // de qué etapa proponer sobre etapas que este producto no tiene (AGENTS.md, «Una lectura que
    // cae al DEFAULT sirve para dibujar, nunca para DECIDIR»).
    const [cfg, actual] = await Promise.all([entregaDeProductoEstricta(productoId), etapaActualDe(leadId, productoId, productos)]);
    if (!cfg) throw new Error(`no pude leer las etapas del producto ${productoId}`);
    const etapas = etapasDePropuesta(cfg.etapas.map((e) => e.key), actual);
    const orden = new Map(etapas.map((k, i) => [k, i]));
    const deEtapas = clases
      .filter((c) => orden.has(c.etapa))
      .sort((a, b) => orden.get(a.etapa)! - orden.get(b.etapa)! || a.orden - b.orden || a.id - b.id);
    out.push(...candidatasDePropuesta({ clases: deEtapas, filas: resp.filas, areas: resp.areas, sesionAt, tope: TOPE_CANDIDATAS - out.length }));
    if (out.length >= TOPE_CANDIDATAS) break;
  }
  return out;
}

/** El transcript y el resumen de Fathom: de la memoria del análisis, o bajados de nuevo. */
async function sesionDe(recordingId: number, cache: ReadonlyMap<number, SesionEnMemoria> | undefined): Promise<SesionEnMemoria> {
  const ya = cache?.get(recordingId);
  if (ya) return ya;
  const m = await conPlazo(fetchMeetingContent({ recording_id: recordingId }), TOPE_FATHOM_MS, 'Fathom');
  return { items: m.transcript ?? [], resumenFathom: m.default_summary?.markdown_formatted?.trim() || null };
}

/**
 * Propone sobre UNA sesión ya marcada. Devuelve cuántas propuestas escribió y la nota de qué pasó.
 * Tira si la IA o Fathom no contestan (el que llama lo anota).
 */
async function proponerSobre(s: FilaSesion, cands: Candidata[], deadline: number, cache: ReadonlyMap<number, SesionEnMemoria> | undefined): Promise<{ escritas: number; nota: string }> {
  const ses = await sesionDe(s.recording_id, cache);
  if (!ses.items.some((it) => (it.text ?? '').trim())) return { escritas: 0, nota: 'sin transcript: no hay de dónde proponer' };

  const metadatos = [
    `Título: ${s.title?.trim() || '(sin título)'}`,
    `Fecha: ${s.call_date ?? s.started_at?.slice(0, 10) ?? 'desconocida'}`,
    `Duración: ${s.duration_min ?? '?'} min`,
    `Quien dio la sesión: ${s.closer?.trim() || 'desconocido'}`,
  ].join('\n');
  const resumen = [s.summary?.trim(), ses.resumenFathom].filter(Boolean).join('\n\n') || '(sin resumen)';
  const system = await getPromptText('curso.propuesta.system', PROPUESTA_SYSTEM_TEMPLATE);
  const user = await renderPrompt('curso.propuesta.user', PROPUESTA_USER_TEMPLATE, {
    metadatos,
    // Lo que se dijo en la reunión y lo que escribió el cliente son contenido NO confiable.
    resumen: contenidoNoConfiable(resumen, 'resumen'),
    respuestas: contenidoNoConfiable(bloqueRespuestas(cands), 'respuestas'),
    transcript: contenidoNoConfiable(transcriptWithSeconds(ses.items, TOPE_TRANSCRIPT), 'transcript'),
  });
  const texto = await chatClaude(system, [{ role: 'user', content: user }], {
    feature: FEATURE_PROPUESTA,
    effort: 'high',
    maxTokens: MAX_TOKENS,
    motivo: `Curso: propuesta con lo hablado en ${s.title?.trim() || s.recording_id}`,
    // ⏱ La cascada ENTERA termina antes de esto: nunca la plataforma matando la función.
    hastaMs: Math.min(Date.now() + PRESUPUESTO_IA_MS, deadline - MARGEN_ESCRITURA_MS),
    // Una propuesta floja se ve igual que una buena: no se degrada de modelo.
    sinRespaldoDeModelo: true,
  });

  // ⚠️ CADA PROPUESTA SE VALIDA CONTRA SU CLASE Y SU ÁREA: una clase o un área que no estaba entre
  // las que se le pasaron se tira (el modelo no puede proponer sobre lo que el cliente no envió), y
  // lo que no cumple la forma del formulario tampoco se guarda (`validarPropuesta`).
  const porClave = new Map(cands.map((c) => [`${c.clase.id}|${c.area}`, c]));
  const rechazos: Partial<Record<MotivoRechazo | 'ajena' | 'cambio', number>> = {};
  const contar = (k: MotivoRechazo | 'ajena' | 'cambio') => { rechazos[k] = (rechazos[k] ?? 0) + 1; };
  let escritas = 0;
  for (const p of leerPropuestas(texto)) {
    const c = porClave.get(`${p.clase}|${p.area}`);
    if (!c) { contar('ajena'); continue; }
    const v = validarPropuesta(c.clase.campos, c.valores, p.valores);
    if (!v.ok) { contar(v.motivo); continue; }
    // El compare-and-set: si la respuesta cambió mientras la IA pensaba, no se escribe.
    if (await guardarPropuestaIA(s.lead_id, c.clase.id, c.area, v.valores, s.recording_id, c.updatedAt)) escritas++;
    else contar('cambio');
  }
  const descartes = Object.entries(rechazos).map(([k, n]) => `${n} ${k}`).join(', ');
  return { escritas, nota: `${escritas} de ${cands.length} con propuesta${descartes ? ` · descartadas: ${descartes}` : ''}` };
}

/**
 * Mira las sesiones analizadas que todavía no se miraron para proponer, y propone sobre las que
 * tienen respuestas. Corre adentro del workspace (la ronda del cron) y NUNCA tira por una sesión:
 * cada una termina en su nota.
 *
 * `deadline` es ABSOLUTO (el de la corrida). `cache` = lo que el análisis de esta misma corrida ya
 * bajó de Fathom.
 */
export async function proponerPendientes(opts: { deadline: number; cache?: ReadonlyMap<number, SesionEnMemoria> }): Promise<ResultadoPropuestas> {
  const r: ResultadoPropuestas = { miradas: 0, propuestas: 0, sinRespuestas: 0, fallidas: 0 };
  const db = await getTenantDb();
  // La cola, calculada. «Analizada» con la CATEGORÍA en la misma consulta: sólo, también la tienen
  // las ventas del Closing Analyst (tests/closing-entrega.test.ts lo exige a todo lector).
  const { data, error } = await db.from('closing_analyses')
    .select('recording_id, lead_id, title, call_date, started_at, duration_min, closer, summary')
    .eq('category', 'entrega_servicio').eq('status', 'analizada').gte('analysis_version', VERSION_ENTREGA)
    .not('lead_id', 'is', null).is('curso_propuesta_at', null)
    .order('analyzed_at', { ascending: false }).limit(TOPE_SESIONES_POR_CORRIDA);
  if (error) throw new Error(error.message);
  let sinIA: string | null | undefined;

  for (const s of (data ?? []) as FilaSesion[]) {
    if (Date.now() + MARGEN_LECTURA_MS > opts.deadline) { r.corto = 'tiempo'; break; }
    const sesionAt = instanteDeSesion(s.started_at, s.call_date);
    let cands: Candidata[];
    try {
      cands = Number.isFinite(sesionAt) ? await candidatasDeLead(Number(s.lead_id), sesionAt) : [];
    } catch (e) {
      // Una lectura caída no marca: la sesión se vuelve a mirar en la próxima corrida.
      console.error(`[curso-propuesta] no pude leer las respuestas de la sesión ${s.recording_id}: ${msgDe(e)}`);
      r.fallidas++;
      continue;
    }
    if (!cands.length) {
      const nota = Number.isFinite(sesionAt) ? 'sin respuestas enviadas antes de la sesión' : 'sin fecha de la sesión';
      if (await marcar(s.recording_id, nota).catch(() => false)) { r.miradas++; r.sinRespuestas++; }
      continue;
    }
    // Hay algo que proponer: hace falta la IA, y que entre ENTERA antes del corte.
    if (sinIA === undefined) sinIA = await motivoSinIA();
    if (sinIA) { r.corto = 'sin_ia'; r.motivo = sinIA; break; }
    if (Date.now() + RESERVA_PROPUESTA_MS > opts.deadline) { r.corto = 'tiempo'; break; }
    if (!(await marcar(s.recording_id, 'en curso').catch(() => false))) continue;
    r.miradas++;
    try {
      const { escritas, nota } = await proponerSobre(s, cands, opts.deadline, opts.cache);
      r.propuestas += escritas;
      await anotar(s.recording_id, nota);
    } catch (e) {
      // La decisión de Martín: si la IA falla, no hay propuesta y no pasa nada más. Queda escrito.
      r.fallidas++;
      await anotar(s.recording_id, `no salió: ${msgDe(e)}`);
    }
  }
  return r;
}
