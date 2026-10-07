// =============================================================================
// closing-entrega — analizar las SESIONES DE ENTREGA en vez de tirarlas (#107)
// =============================================================================
// Hasta acá el Closing Analyst (lib/closing.ts) clasificaba una sesión de entrega
// —coaching, acompañamiento, la reunión semanal con un cliente que ya compró— y la
// guardaba como `status = 'descartada'`: sin transcript (la heurística por título nunca
// lo baja) o con un resumen de 1-2 frases (el prompt de venta lo pide así). Customer
// Success veía la sesión en la ficha del cliente y no podía saber qué había pasado en ella.
//
// Esto la analiza con su PROPIO contrato —resumen, riesgos con su cita y próximos pasos—
// y lo deja en la misma fila de `closing_analyses` (mig 0209). La forma de lo que se
// escribe, el saneo y la cola viven en `./closing-entrega-contrato.ts` (puro, con test).
//
// ⚠️⚠️ UN FALLO NUNCA ESCRIBE `status = 'error'`. `syncClosingCalls` reintenta TODA fila
// en 'error' con el analista de VENTA, que es Claude Sonnet PAGO (closing.ts → `retryable`).
// Una sesión de entrega que falla acá dejaría de costar US$0 y pasaría a pagarse en cada
// corrida del cron de closing. El fallo va a la columna `error` (`anotarFallo`) y el
// `status` queda como estaba; lo fija tests/closing-entrega.test.ts.
//
// IA: US$0. La feature `cs-sesion` está en el catálogo con Gemini y `fallback: []`, sin
// fila en CLAUDE_PERMITIDO, y va por `chatClaude` como `plan-fathom`: con `fallback: []` la
// cascada se queda en el proveedor del registro y, si no contesta, FALLA (no se degrada ni
// se paga). La cola se reintenta sola en la próxima corrida.
//
// ⚠️ `fallback: []` frena el eje PROVEEDOR y no el eje MODELO: dentro de Gemini la cascada
// caía a flash-lite igual (docs/hallazgos-ia.md). Acá se le pide `sinRespaldoDeModelo`, que
// es lo que hace verdad la nota del catálogo: un análisis que se guarda para siempre y nadie
// re-lee no se hace con el modelo flojo — se espera a la hora siguiente.
//
// ⏱ EL RELOJ: el cron corta a los 300 s, y una sesión arranca sólo si entra ENTERA
// (`RESERVA_SESION_MS`). Para que eso sea cierto, cada paso tiene su tope: Fathom con
// `conPlazo` y la IA con `hastaMs`, que acota la cascada ENTERA y no un intento. Sin eso,
// una sola key de Gemini pasaba los 5 minutos en reintentos, la plataforma mataba la
// función y la ronda no guardaba el cursor: el mismo workspace primero en cada corrida y
// el resto sin turno (lib/cron-workspaces.ts, `correrRonda`).
//
// Nada de esto le escribe a un cliente: lee Fathom, llama a la IA y escribe una fila.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import { chatClaude } from './anthropic';
import { contenidoNoConfiable, getPromptText, renderPrompt } from './prompt-render';
import { fetchMeetingContent, type FathomMeeting } from './fathom-api';
import { transcriptWithSeconds } from './closing';
import { resolverClienteDeReunion } from './reunion-cliente';
import { modeloDeFeature } from './model-registry';
import { provsDe, type ProvName } from './ai-cheap';
import {
  VERSION_ENTREGA,
  ENTREGA_SYSTEM_TEMPLATE,
  ENTREGA_USER_TEMPLATE,
  MOTIVO_CORTE,
  ordenarColaEntrega,
  parseAnalisisEntrega,
  verificarCitas,
  textoFalloEntrega,
  textoSinReintento,
  esSinReintento,
  esCortePorTope,
  esFalloSeguroDelProveedor,
  jsonCortado,
  conPlazo,
  clasificarFalloFathom,
  type CulpaFallo,
  type FilaColaEntrega,
  type AnalisisEntrega,
} from './closing-entrega-contrato';

/** El tag de gasto: el que está en `CATALOGO_MODELOS` (lib/model-catalogo.ts). */
export const FEATURE_ENTREGA = 'cs-sesion';

/**
 * Bajar transcript y resumen de Fathom: 2-5 s. `fathomGet` reintenta solo (0,7 + 1,4 + 2,1 s)
 * y su `fetch` no tiene timeout, así que una conexión colgada esperaba lo que quisiera: se
 * corta acá y cuenta como un fallo ajeno.
 */
const TOPE_FATHOM_MS = 20_000;
/** Atar el cliente y armar el prompt: lecturas a la base entre Fathom y la IA. */
const MARGEN_PREPARAR_MS = 5_000;
/**
 * UN intento de la IA, entero: el techo que `chatClaude` le pone a la cascada barata
 * (`min(120 s, maxTokens × 12)`, lib/anthropic.ts). Con `MAX_TOKENS` ya se llega al techo.
 */
const LLAMADA_IA_MS = 120_000;
/**
 * Todo lo que la IA puede tardar con sus reintentos: una llamada entera y aire para UNO corto
 * (un 503 que rebota en segundos). Lo que pase de acá es de la próxima hora, no de esta.
 */
const PRESUPUESTO_IA_MS = 130_000;
/** Escribir la fila (o el fallo) y atar el cliente. */
const MARGEN_ESCRITURA_MS = 5_000;

/**
 * Lo que se reserva ANTES de arrancar otra sesión: Fathom, preparar, UNA llamada entera a la
 * IA y escribir — 150 s. Se arranca una sesión sólo si entra ENTERA antes del corte: acotar el
 * INICIO y no el fin es cómo una llamada termina muerta por la plataforma antes de escribir su
 * resultado.
 *
 * ⚠️ Y el número sólo es cierto porque cada paso tiene su tope (`conPlazo` en Fathom, `hastaMs`
 * en la IA). Antes era 100 s pensando en UNA llamada de 72 s, y con una sola key la cascada
 * hacía hasta 4 intentos por modelo más las esperas y el respaldo flash-lite: pasaba los 5
 * minutos y la plataforma mataba la función.
 */
export const RESERVA_SESION_MS = TOPE_FATHOM_MS + MARGEN_PREPARAR_MS + LLAMADA_IA_MS + MARGEN_ESCRITURA_MS;

/**
 * Cuántas sesiones se analizan por workspace y por corrida. Dos, a propósito: el cron es
 * HORARIO, así que el histórico (129 sesiones en el ws1) se drena en unos días sin
 * comerse en una mañana los 250 pedidos diarios de la key gratis de Gemini, que son los
 * mismos que usan la lectura de reuniones (`plan-fathom`) y MaKo por WhatsApp.
 */
export const MAX_SESIONES_POR_CORRIDA = 2;

/** Gemini come 1M de tokens: no hace falta cortar una sesión de dos horas (~100k caracteres). */
const TOPE_TRANSCRIPT = 150_000;
/**
 * El tope de SALIDA, con el razonamiento ADENTRO: Gemini piensa con los mismos tokens que
 * escribe (lib/ai-cheap.ts, el `reasoning_effort`), y `effort: 'high'` le llega como
 * 'medium': en la capa compatible de Google, para los 2.5, eso es un presupuesto de ~8k
 * tokens de pensamiento (lo que documenta Google; para la familia 3, a la que resuelve
 * `gemini-flash-latest`, no está medido). El JSON pedido son ~1-3k más.
 *
 * Era 6.000, y la feature hermana ya lo había medido sobre una entrada mucho más chica:
 * con 4.000 la respuesta se cortaba porque el modelo gastaba ~2.900 pensando, y por eso
 * `plan-fathom` usa 12.000 y 32.000 para leer un transcript (lib/plan-fathom.ts). Acá entra
 * una sesión de hasta 150k caracteres (~43k tokens), y el corte le pegaba justo a las más
 * largas: medio JSON contado como fallo de la sesión, o la respuesta entera ida en pensar.
 */
const MAX_TOKENS = 16_000;
/**
 * El de la vuelta siguiente a un corte por tope: el doble. Si con esto también se corta, ya
 * no es el tope (el modelo se fue por las ramas) y se cuenta como de la sesión.
 */
const MAX_TOKENS_TRAS_CORTE = 32_000;

const ESTADO_ANALIZADA = 'analizada';

type FilaCola = FilaColaEntrega & {
  lead_id: number | null;
  lead_nombre: string | null;
  lead_empresa: string | null;
  title: string | null;
  duration_min: number | null;
  invitee_email: string | null;
  closer: string | null;
};

const COLS_COLA =
  'recording_id, call_date, started_at, error, lead_id, lead_nombre, lead_empresa, title, duration_min, invitee_email, closer';

export type DrenajeEntrega = {
  /** Las sesiones que esperan análisis (sin contar las que ya no se reintentan). */
  pendientes: number;
  analizadas: number;
  /** Fallaron por algo de la sesión o del proveedor; se reintentan solas. */
  fallidas: number;
  /** Quedaron afuera para siempre en esta corrida (404 de Fathom o intentos agotados). */
  sinReintento: number;
  /** Las que se ataron a un cliente del CRM porque venían sin `lead_id`. */
  atadas: number;
  /** Las que no llegaron a correr en esta corrida. */
  sinTurno: number;
  corto_por: 'cola' | 'max' | 'tiempo' | 'sin_ia' | 'proveedor';
  /** Por qué no hay IA, cuando `corto_por = 'sin_ia'`. */
  motivo?: string;
};

type Desenlace = 'analizada' | 'ya' | 'fallo' | 'sin-reintento' | 'proveedor';

/** Cómo terminó UNA sesión. `iaContesto` = la IA devolvió texto (sirviera o no). */
type Resultado = { desenlace: Desenlace; atada: boolean; iaContesto: boolean };

const msgDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * ¿Hay con qué analizar en ESTE workspace? Se pregunta ANTES de tocar la cola: sin key,
 * cada corrida le escribiría un fallo a la primera sesión de la fila, para siempre. Y si
 * alguien ruteó la feature a Claude en /modelos-ia, tampoco se corre: el veto la cortaría
 * igual (no tiene permiso de gasto), pero así no se ensucia ninguna fila.
 */
async function motivoSinIA(): Promise<string | null> {
  const ref = await modeloDeFeature(FEATURE_ENTREGA).catch(() => null);
  if (!ref) return `la feature ${FEATURE_ENTREGA} no está en el catálogo de modelos`;
  if (ref.provider === 'anthropic') return `${FEATURE_ENTREGA} apunta a Claude, y este análisis no se paga`;
  const keys = await provsDe(ref.provider as ProvName).catch(() => []);
  return keys.length ? null : `este negocio no tiene key de ${ref.provider} cargada`;
}

/**
 * EL ÚNICO CAMINO POR EL QUE UN FALLO TOCA LA FILA: el motivo en `error`, y nada más.
 * Sin `status` a propósito —ver el encabezado— y sólo sobre una fila que todavía no está
 * analizada, para no pisar el resultado de una corrida que terminó en paralelo.
 */
async function anotarFallo(recordingId: number, texto: string): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db
    .from('closing_analyses')
    .update({ error: texto, updated_at: new Date().toISOString() })
    .eq('recording_id', recordingId)
    .lt('analysis_version', VERSION_ENTREGA);
  if (error) console.error(`[closing-entrega] no se pudo anotar el fallo de ${recordingId}: ${error.message}`);
}

/**
 * Anota un fallo con los contadores al día y dice cómo terminó. `corta` = la corrida no
 * sigue (lo que falló va a fallar igual para la próxima sesión). Si el fallo agotó los
 * intentos o los ajenos, la sesión sale de la cola y la corrida sigue.
 */
async function fallar(f: FilaCola, motivo: string, culpa: CulpaFallo, corta: boolean, iaContesto = false): Promise<Resultado> {
  const t = textoFalloEntrega(f.error, motivo, culpa);
  await anotarFallo(f.recording_id, t);
  if (esSinReintento(t)) return { desenlace: 'sin-reintento', atada: false, iaContesto };
  return { desenlace: corta ? 'proveedor' : 'fallo', atada: false, iaContesto };
}

/** Los emails de quienes estuvieron en la sesión: el invitado guardado y los que Fathom reconoció al hablar. */
function emailsDeLaSesion(f: FilaCola, m: FathomMeeting): string[] {
  const out = new Set<string>();
  const sumar = (e: string | null | undefined) => { const x = (e ?? '').trim().toLowerCase(); if (x.includes('@')) out.add(x); };
  sumar(f.invitee_email);
  for (const it of m.transcript ?? []) sumar(it.speaker?.matched_calendar_invitee_email);
  for (const i of m.calendar_invitees ?? []) if (i.is_external) sumar(i.email);
  return [...out];
}

/**
 * Analiza UNA sesión y escribe el resultado. Nunca tira: devuelve cómo terminó.
 *
 * `deadline` es el de la corrida (absoluto): nada de acá adentro lo pasa. `testigo` = en esta
 * misma corrida la IA ya contestó para otra sesión, o sea que el proveedor está vivo.
 */
async function analizarUna(f: FilaCola, ctx: { deadline: number; testigo: boolean }): Promise<Resultado> {
  const id = f.recording_id;

  // 1) El transcript, con las funciones que ya usa el Closing Analyst. El listado de
  //    metadata no hace falta: `fetchMeetingContent` baja transcript y resumen por id.
  let m: FathomMeeting;
  try {
    m = await conPlazo(fetchMeetingContent({ recording_id: id }), TOPE_FATHOM_MS, 'Fathom');
  } catch (e) {
    const msg = msgDe(e);
    const tipo = clasificarFalloFathom(msg);
    // Un 404 es una grabación que ya no existe (Fathom no la va a devolver nunca): se
    // anota y no se reintenta.
    if (tipo === 'no-existe') {
      await anotarFallo(id, textoSinReintento(`la grabación ya no está en Fathom (${msg})`));
      return { desenlace: 'sin-reintento', atada: false, iaContesto: false };
    }
    // Otro 4xx que no sea la key es de ESTA grabación: gasta un intento y la corrida sigue.
    if (tipo === 'de-la-sesion') return fallar(f, `Fathom: ${msg}`, 'sesion', false);
    // La key, un 5xx que no cedió, la red, el tope de arriba: no se sabe si es de la sesión.
    // No gasta intento y corta la corrida, porque la siguiente va a fallar por lo mismo; si
    // es la key o la cuota, ni siquiera suma un ajeno.
    return fallar(f, `Fathom: ${msg}`, esFalloSeguroDelProveedor(msg) ? 'proveedor' : 'ajena', true);
  }
  const items = m.transcript ?? [];
  if (!items.some((it) => (it.text ?? '').trim())) {
    // Sin transcript no hay nada que leer, y un análisis del resumen de Fathom solo no
    // tendría una cita que mostrar. Gasta un intento: puede ser una grabación todavía en
    // proceso, o una que nunca va a tener texto.
    return fallar(f, 'Fathom devolvió el transcript vacío', 'sesion', false);
  }

  // 2) De qué cliente es, si la fila no lo sabe. El resolver ya tiene la regla dura: con
  //    dos clientes posibles, o ninguno, devuelve null y NO se ata. Y `leadId: 0` es su
  //    respuesta para el super admin (un workspace, no un lead): tampoco se ata.
  let cliente: { id: number; nombre: string; empresa: string | null } | null =
    f.lead_id != null ? { id: f.lead_id, nombre: f.lead_nombre ?? '', empresa: f.lead_empresa } : null;
  let atar = false;
  if (!cliente) {
    const c = await resolverClienteDeReunion({ titulo: f.title, emails: emailsDeLaSesion(f, m) }).catch(() => null);
    if (c && c.leadId > 0) {
      cliente = { id: c.leadId, nombre: c.nombre, empresa: c.empresa };
      atar = true;
    }
  }

  // 3) El modelo.
  const metadatos = [
    `Título: ${f.title?.trim() || '(sin título)'}`,
    `Fecha: ${f.call_date ?? f.started_at?.slice(0, 10) ?? 'desconocida'}`,
    `Duración: ${f.duration_min ?? '?'} min`,
    `Quien dio la sesión: ${f.closer?.trim() || m.recorded_by?.name?.trim() || 'desconocido'}`,
  ].join('\n');
  const clienteTxt = cliente
    ? [`Nombre: ${cliente.nombre || '(sin nombre)'}`, cliente.empresa ? `Empresa: ${cliente.empresa}` : null].filter(Boolean).join('\n')
    : '(no identificado en el CRM)';
  // Si la vuelta anterior se cortó por el tope, ésta va con el doble (ver MAX_TOKENS_TRAS_CORTE).
  const maxTokens = esCortePorTope(f.error) ? MAX_TOKENS_TRAS_CORTE : MAX_TOKENS;
  let texto: string;
  let modelo = '';
  try {
    const system = await getPromptText('closing.entrega.system', ENTREGA_SYSTEM_TEMPLATE);
    const user = await renderPrompt('closing.entrega.user', ENTREGA_USER_TEMPLATE, {
      metadatos,
      cliente: clienteTxt,
      // Lo que se dijo en la reunión es contenido NO confiable: va delimitado.
      resumenFathom: contenidoNoConfiable(m.default_summary?.markdown_formatted?.trim() || '(sin resumen de Fathom)', 'resumen_fathom'),
      transcript: contenidoNoConfiable(transcriptWithSeconds(items, TOPE_TRANSCRIPT), 'transcript'),
    });
    texto = await chatClaude(system, [{ role: 'user', content: user }], {
      feature: FEATURE_ENTREGA,
      effort: 'high',
      maxTokens,
      motivo: `Sesión de entrega: ${f.title?.trim() || id}`,
      onUsage: (u) => { modelo = u.model; },
      // ⏱ La cascada ENTERA —reintentos y esperas— termina antes de esto. Lo que no entre
      // es de la próxima hora: nunca de la plataforma matando la función.
      hastaMs: Math.min(Date.now() + PRESUPUESTO_IA_MS, ctx.deadline - MARGEN_ESCRITURA_MS),
      // No se degrada de MODELO: ver el encabezado.
      sinRespaldoDeModelo: true,
    });
  } catch (e) {
    const msg = msgDe(e);
    // La cuota o la key: no es de la sesión, no suma nada y corta la corrida.
    if (esFalloSeguroDelProveedor(msg)) return fallar(f, `la IA no contestó: ${msg}`, 'proveedor', true);
    // ⚠️ Con un TESTIGO —la IA ya contestó para otra sesión en esta misma corrida— el
    // proveedor está vivo y lo que falla es ESTA sesión (la respuesta vacía porque se fue
    // todo en pensar, un timeout que se repite con una entrada enorme). Gasta un intento y
    // la corrida sigue. Sin esto, una sesión envenenada no gastaba nunca un intento, quedaba
    // primera entre las que fallaron y cortaba la corrida cada hora.
    if (ctx.testigo) return fallar(f, `la IA contestó para otra sesión de esta corrida y no para ésta: ${msg}`, 'sesion', false);
    // Sin testigo no se sabe: suma un ajeno (la sesión baja en la cola) y corta la corrida.
    return fallar(f, `la IA no contestó: ${msg}`, 'ajena', true);
  }

  let analisis: AnalisisEntrega;
  try {
    analisis = verificarCitas(parseAnalisisEntrega(texto), items);
  } catch (e) {
    // Medio JSON es el TOPE, no la sesión: no gasta intento, queda anotado y la próxima vuelta
    // va con el doble. Si se corta también con el doble, ya no es el tope.
    if (jsonCortado(texto)) {
      const motivo = `${MOTIVO_CORTE}: la respuesta llegó sin cerrar (${texto.length} caracteres con maxTokens ${maxTokens})`;
      console.warn(`[closing-entrega] ${id}: ${motivo}`);
      return fallar(f, motivo, maxTokens >= MAX_TOKENS_TRAS_CORTE ? 'sesion' : 'ajena', false, true);
    }
    // Contestó y no sirve (JSON imposible, sin resumen): esto sí gasta un intento.
    console.error(`[closing-entrega] ${id}: respuesta inválida — ${texto.slice(0, 300)}`);
    return fallar(f, `respuesta inválida: ${msgDe(e)}`, 'sesion', false, true);
  }

  // 4) Se escribe. El contrato: status 'analizada', analysis_version 3, la categoría no se
  //    toca (y se exige en el WHERE: si alguien la reclasificó en el medio, no se pisa).
  const ahora = new Date().toISOString();
  const db = await getTenantDb();
  const { data, error } = await db
    .from('closing_analyses')
    .update({
      summary: analisis.resumen,
      riesgos: analisis.riesgos,
      proximos_pasos: analisis.proximos_pasos,
      // `next_step` lo leen el CRM y la API de MaKo: el primer paso, para que no quede vacío.
      next_step: analisis.proximos_pasos[0]?.que ?? null,
      status: ESTADO_ANALIZADA,
      analysis_version: VERSION_ENTREGA,
      // ⚠️ Casi siempre NULL, y es lo honesto: `chatClaude` llama a `onUsage` sólo en el
      // camino de Anthropic, y por la cascada gratis nadie avisa cuál contestó. Escribir el
      // del catálogo sería afirmar algo que no se midió — que es lo que hace closing.ts con
      // su respaldo hardcodeado.
      model: modelo || null,
      analyzed_at: ahora,
      error: null,
      has_transcript: true,
      transcript_items: items.length,
      updated_at: ahora,
    })
    .eq('recording_id', id)
    .eq('category', 'entrega_servicio')
    .lt('analysis_version', VERSION_ENTREGA)
    .select('recording_id');
  if (error) {
    console.error(`[closing-entrega] no se pudo guardar el análisis de ${id}: ${error.message}`);
    return { desenlace: 'proveedor', atada: false, iaContesto: true };
  }
  if (!data?.length) return { desenlace: 'ya', atada: false, iaContesto: true };

  // El cliente va aparte y SÓLO sobre una fila que sigue sin lead: si alguien la ató a
  // mano entre la lectura y acá, gana la persona.
  let atada = false;
  if (atar && cliente) {
    const r = await db
      .from('closing_analyses')
      .update({ lead_id: cliente.id, lead_nombre: cliente.nombre || null, lead_empresa: cliente.empresa })
      .eq('recording_id', id)
      .is('lead_id', null)
      .select('recording_id');
    if (r.error) console.error(`[closing-entrega] no se pudo atar ${id} al lead ${cliente.id}: ${r.error.message}`);
    atada = !!r.data?.length;
  }
  return { desenlace: 'analizada', atada, iaContesto: true };
}

/**
 * Drena la cola de sesiones de entrega del workspace actual.
 *
 * La cola NO se escribe en ningún lado: se CALCULA —`category = 'entrega_servicio'` con
 * `analysis_version < 3`—, así que entran solas las 129 viejas, las nuevas que deja el
 * cron de closing y las que se reclasifiquen mañana. Las más nuevas primero; las que ya
 * fallaron, al final (`ordenarColaEntrega`).
 *
 * `deadline` es ABSOLUTO (epoch ms), como en `syncClosingCalls`: el que sabe cuánto queda
 * de verdad es el cron que reparte la ronda, no esta función.
 */
export async function drenarSesionesEntrega(opts: { deadline: number; max?: number }): Promise<DrenajeEntrega> {
  // Un presupuesto RELATIVO pasado por costumbre (100000) es una fecha de 1970: el bucle no
  // correría nunca, en silencio y con ok:true. Se corta en positivo.
  if (!(opts.deadline > 1_000_000_000_000)) {
    throw new Error(`closing-entrega: deadline ${opts.deadline} no es una fecha absoluta (Date.now() + ms)`);
  }
  const max = opts.max ?? MAX_SESIONES_POR_CORRIDA;
  const db = await getTenantDb();
  // Paginado: la tabla pasa las 1000 filas por workspace en meses, y un corte en silencio
  // dejaría sesiones fuera de la cola para siempre.
  const filas = await leerTodo<FilaCola>(db, 'closing_analyses', COLS_COLA, {
    orden: 'recording_id',
    eq: { category: 'entrega_servicio' },
    filtros: (q) => q.lt('analysis_version', VERSION_ENTREGA),
  });
  const cola = ordenarColaEntrega(filas);
  const r: DrenajeEntrega = {
    pendientes: cola.length, analizadas: 0, fallidas: 0, sinReintento: 0, atadas: 0, sinTurno: 0, corto_por: 'cola',
  };
  if (!cola.length) return r;

  const sinIA = await motivoSinIA();
  if (sinIA) {
    r.corto_por = 'sin_ia';
    r.motivo = sinIA;
    r.sinTurno = cola.length;
    return r;
  }

  let tomadas = 0;
  // ¿La IA ya contestó para alguna sesión de esta corrida? Es el testigo de que el proveedor
  // está vivo: con él, que no conteste para otra es de esa otra (ver `analizarUna`).
  let iaViva = false;
  for (const f of cola) {
    if (tomadas >= max) { r.corto_por = 'max'; break; }
    if (Date.now() + RESERVA_SESION_MS > opts.deadline) { r.corto_por = 'tiempo'; break; }
    tomadas++;
    const { desenlace, atada, iaContesto } = await analizarUna(f, { deadline: opts.deadline, testigo: iaViva });
    if (iaContesto) iaViva = true;
    if (atada) r.atadas++;
    if (desenlace === 'analizada') r.analizadas++;
    else if (desenlace === 'sin-reintento') r.sinReintento++;
    else if (desenlace === 'fallo' || desenlace === 'proveedor') r.fallidas++;
    // Fathom o la IA no contestaron: la próxima sesión va a fallar por lo mismo. Se corta
    // acá en vez de gastar la corrida (y otra fila con su fallo anotado) en confirmarlo.
    if (desenlace === 'proveedor') { r.corto_por = 'proveedor'; break; }
  }
  r.sinTurno = cola.length - tomadas;
  return r;
}
