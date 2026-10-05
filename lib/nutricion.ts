// =============================================================================
// Motor de nutrición — VSL funnel (app = cerebro)
// =============================================================================
// La app decide a quién/qué/cuándo nutrir, leyendo el estado del lead + su
// comportamiento del VSL (Camino 1). Canales: email (Resend) y whatsapp
// (Chatwoot) — se enchufan en hitos siguientes.
//
// El envío REAL de cada canal se decide POR WORKSPACE (lib/envio-flags.ts).
// Un paso cuyo canal está apagado ESPERA (no se envía ni avanza): si el cliente
// prende el canal después, la cadencia sigue desde donde quedó. El ?commit=1
// histórico del cron simula los canales apagados ('simulado', avanza).
// =============================================================================

import { FAMILIA_POST_AGENDA, TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_NUEVO, preparaUnaReunion, secuenciasParaElLead } from '@/lib/nutricion-familias';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { leerTodo, leerPorPaginas, type ConsultaPaginada } from '@/lib/supabase-paginado';
import { idsConAlMenosUnaFila, enTandas } from '@/lib/ids-con-filas';
import { getVslEngagementMap } from '@/lib/leads';
import { pipelineStageOf } from '@/lib/pipeline';
import { sendWhatsappTemplate } from '@/lib/chatwoot';
import { valoresVariablesLead, aplicarVariables } from '@/lib/template-vars';
import { sendEmail, renderEmailHtml, buildUnsubscribeUrl, remitenteEsSandbox, getEmailFrom, displayNameDe } from '@/lib/resend';
import { envioEmailHabilitado, envioWhatsappHabilitado } from '@/lib/envio-flags';
import { getInstanciaRow, sondearSocket } from '@/lib/evolution';
import { canalNoOficial, proveedorDelPaso } from '@/lib/nutricion-canal';
import { parseEstrategia, dentroDeAntiguedad } from '@/lib/setting-estrategia';
import { ambitoDeSecuencia, filtroDeAmbito, type AmbitoFunnel } from '@/lib/nutricion-ambito';
import { esLeadCliente, enviarYEspejar, enviarAudioYEspejar, crearBorrador, tieneBorradorNutriPendiente } from '@/lib/evolution-envio';
import { getAudio, audioBase64 } from '@/lib/setting-audios';
import { estaBloqueado } from '@/lib/evolution-block';
import { estadoDraftPorNombre } from '@/lib/meta-templates';

export type CanalNutricion = 'email' | 'whatsapp';

export type ProveedorWa = 'oficial' | 'no_oficial';

export type PasoSecuencia = {
  orden: number;
  canal: CanalNutricion;
  delay_horas: number;
  // Anclaje del paso (#18, recordatorios de reunión): sin ancla, delay_horas
  // cuenta desde la inscripción/paso anterior; con ancla 'reunion', delay_horas
  // son horas ANTES de la próxima reunión del lead (R1; R2 si la R1 ya pasó).
  ancla?: 'reunion';
  // Tipo del paso (reunión 31/07: el vehículo del setting son NOTAS DE VOZ del
  // dueño). 'audio' exige audio_id de la biblioteca (lib/setting-audios.ts) y
  // sale SIEMPRE por el canal no oficial: un audio no cabe en una plantilla de
  // Meta. Sin tipo = 'texto' (todo lo anterior sigue igual).
  tipo?: 'texto' | 'audio';
  audio_id?: number | null;
  // Condición para que el paso salga (reunión 31/07). 'respondio' = el lead ya
  // contestó al menos una vez: es la regla del lead magnet ("¿lo querés? es
  // gratis" y recién si contesta se manda). 'sin_respuesta' = el rezagado que
  // nunca contestó — por ahí se degrada a email. Sin condición, siempre sale.
  /**
   * Condición para que este paso salga.
   *
   * `ya_contactado` / `primer_contacto` existen para un caso muy concreto: dos
   * leads que acaban de agendar caen en el MISMO cohorte, pero a uno ya le
   * hablaste (recibió tu audio de bienvenida) y al otro no lo saludaste nunca.
   * Mandarle "hola, soy Fulano" a alguien con quien ya venías conversando suena
   * a robot al instante. Con este par, la secuencia post-agenda lleva DOS pasos
   * de apertura mutuamente excluyentes y sale exactamente uno.
   */
  requiere?: 'respondio' | 'sin_respuesta' | 'ya_contactado' | 'primer_contacto';
  /**
   * Formas distintas de decir lo MISMO. Las escribe MaKo una sola vez, al armar
   * la secuencia, y el motor elige una al azar en cada envío.
   *
   * Existen por dos razones que empujan en la misma dirección: mandarle el mismo
   * texto palabra por palabra a cientos de personas es el patrón que WhatsApp
   * detecta para banear un número, y además se lee como un bot. Generarlas en
   * cada envío costaría una llamada de IA por lead; generarlas una vez y sortear
   * cuesta cero y evita las dos cosas.
   */
  variantes?: string[];
  asunto: string | null;
  preheader?: string | null;                  // email: texto de vista previa (preheader)
  cuerpo: string;
  proveedor?: ProveedorWa;                     // whatsapp: 'oficial' (plantilla/Chatwoot) | 'no_oficial' (Evolution)
  template_wa: string | null;                 // nombre del template aprobado (WhatsApp oficial)
  template_categoria?: 'marketing' | 'utility' | 'authentication';
  template_idioma?: string;                   // ej. 'es_MX'
  template_param?: string;                    // clave del body que recibe el nombre (default 'nombre')
};

export type Secuencia = {
  id: number;
  clave: string;
  nombre: string;
  etapa: string;
  trigger_tipo: string;
  activa: boolean;
  pasos: PasoSecuencia[];
  /** Sale sola aunque el lead no haya pagado (ver `Estrategia.envio_automatico`). */
  envio_automatico: boolean;
  /** Solo leads que llegaron hace menos de esto (ver `Estrategia.antiguedad_max_horas`). */
  antiguedad_max_horas: number | null;
  /**
   * A qué embudo le escribe (mig 0170). `null` = a TODOS, que es lo que dicen hoy
   * las 62 filas de la base. Lo lee `leadsDeCohorte` — ver lib/nutricion-ambito.ts.
   */
  funnel_id: number | null;
};

// % de retención del VSL a partir del cual consideramos "lo vio en serio".
export const UMBRAL_VSL_PCT = 50;
// No inscribir leads más viejos que esto (días) — evita revivir cohortes muertas.
const VENTANA_DIAS = 30;

// ── Rate-limiter / anti-baneo de WhatsApp (defaults conservadores; override por env) ──
// El envío REAL de cada canal se decide POR WORKSPACE (lib/envio-flags.ts): un
// canal apagado deja sus pasos ESPERANDO (reintento en 24h, sin enviar ni avanzar).
const MAX_POR_DIA = Number(process.env.NUTRICION_MAX_POR_DIA ?? '40');        // tope en 24h móviles (por workspace)
const MAX_POR_CORRIDA = Number(process.env.NUTRICION_MAX_POR_CORRIDA ?? '6'); // tope por corrida del cron
const HS_MIN_ENTRE_MSGS = 20;     // no mandar 2 mensajes al mismo lead en <20h (prospección fría)
// Excepción del guard anterior (reunión 31/07): con una reunión encima, la
// cadencia de preparación exige toques cercanos ("si chateo dos veces y le mando
// un audio, ya no falta"). El presupuesto anti-ban de una CONVERSACIÓN abierta o
// de un lead con reunión próxima no es el de la prospección fría.
const HS_MIN_PREPARACION = 3;
const HS_REUNION_CERCA = 48;      // reunión dentro de este plazo → cadencia de preparación
const TZ_OFFSET_MX = -6;          // ventana horaria evaluada en hora de México
const VENTANA_INICIO = 9;
const VENTANA_FIN = 21;

function ahoraISO(): string {
  return new Date().toISOString();
}
function enHorasISO(horas: number): string {
  return new Date(Date.now() + horas * 3600 * 1000).toISOString();
}
function haceDiasISO(dias: number): string {
  return new Date(Date.now() - dias * 86400 * 1000).toISOString();
}

// ── Secuencias ───────────────────────────────────────────────────────────────
export async function getSecuenciasActivas(): Promise<Secuencia[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    .select('id, clave, nombre, etapa, trigger_tipo, activa, pasos, estrategia, funnel_id')
    .eq('activa', true)
    // Archivada nunca enrola ni envía, aunque haya quedado con activa=true.
    .is('archivada_at', null);
  if (error) throw new Error(`getSecuenciasActivas: ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: number; clave: string; nombre: string; etapa: string;
    trigger_tipo: string; activa: boolean; pasos: unknown; estrategia: unknown;
    funnel_id: number | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    clave: r.clave,
    nombre: r.nombre,
    etapa: r.etapa,
    trigger_tipo: r.trigger_tipo,
    activa: r.activa,
    pasos: Array.isArray(r.pasos) ? (r.pasos as PasoSecuencia[]) : [],
    // Por el MISMO parser que la pantalla: la regla de qué cuenta como «sí»
    // (solo `true` literal) vive en un lugar.
    envio_automatico: parseEstrategia(r.estrategia)?.envio_automatico === true,
    antiguedad_max_horas: parseEstrategia(r.estrategia)?.antiguedad_max_horas ?? null,
    funnel_id: r.funnel_id == null ? null : Number(r.funnel_id),
  }));
}

export type SecuenciaConStats = Secuencia & { inscriptos: number; enviados: number; estrategia: unknown };

// Todas las secuencias (activas y pausadas) + conteo de inscriptos y enviados.
// Para la tab /whatsapp y /setting. Dos queries (no N+1): ids y cuenta en JS.
// `estrategia` (jsonb, mig 0107) viaja crudo: el parser vive en setting-estrategia.
export async function getSecuenciasConStats(): Promise<SecuenciaConStats[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    .select('id, clave, nombre, etapa, trigger_tipo, activa, pasos, estrategia, funnel_id')
    // Las archivadas no se listan, no enrolan y no envían. No se borran porque
    // las inscripciones y los envíos las referencian: borrarlas se llevaría
    // puesto el historial de a quién se le escribió.
    .is('archivada_at', null)
    .order('id', { ascending: true });
  if (error) throw new Error(`getSecuenciasConStats: ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: number; clave: string; nombre: string; etapa: string;
    trigger_tipo: string; activa: boolean; pasos: unknown; estrategia: unknown;
    funnel_id: number | null;
  }>;

  // Contados PÁGINA POR PÁGINA (se agrega al vuelo, no se materializa). Eran dos
  // `.select()` sueltos sobre las tablas enteras: nutricion_envios suma hasta 40
  // filas por día por workspace, así que en menos de un mes pasaba las 1000 y
  // PostgREST cortaba sin avisar — «inscriptos» y «enviados» por secuencia quedaban
  // contados sobre una muestra arbitraria, un número plausible y más chico. Un
  // error de lectura, además, se leía como «0 inscriptos»; ahora lanza.
  const inscMap = new Map<number, number>();
  const envMap = new Map<number, number>();
  const sumar = (m: Map<number, number>) => (filas: Array<{ secuencia_id: number | null }>) => {
    for (const r of filas) {
      if (r.secuencia_id == null) continue;
      m.set(r.secuencia_id, (m.get(r.secuencia_id) ?? 0) + 1);
    }
  };
  try {
    await Promise.all([
      leerPorPaginas<{ secuencia_id: number | null }>(supabase, 'nutricion_inscripciones', 'id, secuencia_id', sumar(inscMap), { orden: 'id' }),
      leerPorPaginas<{ secuencia_id: number | null }>(supabase, 'nutricion_envios', 'id, secuencia_id', sumar(envMap), {
        orden: 'id', filtros: (q) => q.in('estado', ['enviado', 'simulado']) as ConsultaPaginada,
      }),
    ]);
  } catch (e) {
    throw new Error(`getSecuenciasConStats: ${e instanceof Error ? e.message : String(e)}`);
  }

  return rows.map((r) => ({
    id: r.id,
    clave: r.clave,
    nombre: r.nombre,
    etapa: r.etapa,
    trigger_tipo: r.trigger_tipo,
    activa: r.activa,
    pasos: Array.isArray(r.pasos) ? (r.pasos as PasoSecuencia[]) : [],
    estrategia: r.estrategia ?? null,
    envio_automatico: parseEstrategia(r.estrategia)?.envio_automatico === true,
    antiguedad_max_horas: parseEstrategia(r.estrategia)?.antiguedad_max_horas ?? null,
    funnel_id: r.funnel_id == null ? null : Number(r.funnel_id),
    inscriptos: inscMap.get(r.id) ?? 0,
    enviados: envMap.get(r.id) ?? 0,
  }));
}

export async function setSecuenciaActiva(id: number, activa: boolean): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({ activa, updated_at: ahoraISO() })
    .eq('id', id);
  if (error) throw new Error(`setSecuenciaActiva: ${error.message}`);
}

/**
 * El texto que sale en ESTE envío: una de las variantes del paso, al azar, o el
 * cuerpo original si no tiene. El sorteo va acá y no en el que llama para que
 * cualquier canal que mande texto lo herede sin acordarse.
 */
export function textoDelPaso(paso: Pick<PasoSecuencia, 'cuerpo' | 'variantes'>): string {
  const vs = (paso.variantes ?? []).filter((v) => typeof v === 'string' && v.trim());
  if (!vs.length) return paso.cuerpo;
  // El cuerpo original entra al sorteo: es la versión que el dueño aprobó.
  const pool = [paso.cuerpo, ...vs].filter((t) => t.trim());
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function setSecuenciaPasos(id: number, pasos: PasoSecuencia[]): Promise<void> {
  const supabase = (await getTenantDb());

  // Lo que ya está guardado, para MERGEAR los campos que ninguna pantalla edita.
  //
  // Esta función reconstruye cada paso campo por campo, así que lo que el cliente
  // no mande se BORRA. Las variantes las genera MaKo una sola vez al armar la
  // secuencia y no viven en ningún formulario: sin este merge, guardar el copy
  // desde el wizard o desde el editor las borraba todas en silencio, y el motor
  // volvía a mandar el mismo texto a todo el mundo sin que nadie se enterara.
  const { data: previo } = await supabase
    .from('nutricion_secuencias').select('pasos').eq('id', id).maybeSingle();
  const antes = Array.isArray((previo as { pasos?: unknown } | null)?.pasos)
    ? ((previo as { pasos: PasoSecuencia[] }).pasos)
    : [];
  const variantesPrevias = new Map<number, string[]>();
  for (const p of antes) {
    if (Array.isArray(p?.variantes) && p.variantes.length) variantesPrevias.set(Number(p.orden), p.variantes);
  }

  // Normaliza el orden (1..n) y descarta basura.
  const limpio = pasos
    .filter((p) => p && typeof p === 'object')
    .map((p, i) => ({
      orden: i + 1,
      // Un paso de audio es de WhatsApp por definición (no hay nota de voz por email).
      canal: p.canal === 'email' && p.tipo !== 'audio' ? 'email' : 'whatsapp',
      delay_horas: Math.max(0, Math.round(Number(p.delay_horas) || 0)),
      ...(p.ancla === 'reunion' ? { ancla: 'reunion' as const } : {}),
      // Paso de nota de voz: exige audio de la biblioteca (si no, degrada a texto).
      ...(p.tipo === 'audio' && Number(p.audio_id)
        ? { tipo: 'audio' as const, audio_id: Number(p.audio_id) }
        : {}),
      ...(p.requiere === 'respondio' || p.requiere === 'sin_respuesta' || p.requiere === 'ya_contactado' || p.requiere === 'primer_contacto'
        ? { requiere: p.requiere as PasoSecuencia['requiere'] }
        : {}),
      asunto: typeof p.asunto === 'string' ? p.asunto : null,
      preheader: typeof p.preheader === 'string' ? p.preheader : null,
      cuerpo: typeof p.cuerpo === 'string' ? p.cuerpo : '',
      // El oficial va DECLARADO; la ausencia del campo cae al no oficial, que es
      // el canal real del chatbot. El porqué, en `proveedorDelPaso`.
      proveedor: proveedorDelPaso(p),
      template_wa: p.template_wa ?? null,
      template_categoria: p.template_categoria,
      template_idioma: p.template_idioma ?? 'es_MX',
      template_param: p.template_param ?? 'nombre',
      // Las variantes las manda el cliente solo si las está editando; si no,
      // sobreviven las que ya había para ese orden.
      ...(() => {
        const vs = Array.isArray(p.variantes) && p.variantes.length ? p.variantes : variantesPrevias.get(i + 1);
        return vs?.length ? { variantes: vs.filter((v) => typeof v === 'string' && v.trim()).slice(0, 8) } : {};
      })(),
    }));
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({ pasos: limpio, updated_at: ahoraISO() })
    .eq('id', id);
  if (error) throw new Error(`setSecuenciaPasos: ${error.message}`);
}

// Las cohortes se leen PAGINADAS y ordenadas por `id` (lib/supabase-paginado.ts).
// Eran `.select()` sueltos sobre `leads`: hoy casi todas quedan bajo las 1000
// filas por su ventana, pero `instant_form_sin_agenda` sin su ventana ya daría 948
// en ws1 y la tabla crece sola. Pasado el techo, PostgREST devuelve 1000 y un 200, y
// los leads que caen del corte NUNCA se inscriben — en cada corrida, sin un log.
// Es exactamente cómo el CRM perdió 66 leads el 17/09.
async function filasCohorte<T>(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  etiqueta: string,
  ambito: AmbitoFunnel,
  cols: string,
  filtros: (q: ConsultaPaginada) => unknown,
): Promise<T[]> {
  try {
    return await leerTodo<T>(db, 'leads', cols, { orden: 'id', filtros: (q) => conAmbito(filtros(q) as ConsultaPaginada, ambito) });
  } catch (e) {
    throw new Error(`cohorte ${etiqueta}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
async function idsCohorte(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  etiqueta: string,
  ambito: AmbitoFunnel,
  filtros: (q: ConsultaPaginada) => unknown,
): Promise<number[]> {
  return (await filasCohorte<{ id: number }>(db, etiqueta, ambito, 'id', filtros)).map((r) => r.id);
}

/**
 * El filtro del ámbito, pegado a la consulta de la cohorte. La DECISIÓN (cuál de
 * los tres filtros, y con qué expresión) vive en lib/nutricion-ambito.ts, que no
 * tiene `server-only` y por eso se puede ejecutar en un test; acá sólo se encadena.
 */
function conAmbito(q: ConsultaPaginada, ambito: AmbitoFunnel): ConsultaPaginada {
  const f = filtroDeAmbito(ambito);
  if (f === null) return q;
  return ('or' in f ? q.or(f.or) : q.eq('funnel_id', f.eq)) as ConsultaPaginada;
}

/**
 * El ámbito de embudo de una secuencia, resuelto contra `funnels`.
 *
 * ⚠️ SÓLO LEE LA BASE SI LA SECUENCIA DECLARA UN EMBUDO. Hoy las 62 filas lo
 * tienen en NULL, así que esta consulta no corre ni una vez y el motor junta
 * EXACTAMENTE la misma cohorte que antes de este cambio.
 *
 * ⚠️ Y SI LA LECTURA FALLA, TIRA. Es la misma política que `filasCohorte` (una
 * cohorte que no se pudo leer corta la corrida y el cron vuelve en una hora) y es
 * la dirección correcta del error: dar por bueno un `todos` acá sería mandarle
 * WhatsApps y emails REALES a los leads de otro producto, que es justo lo que este
 * ámbito existe para evitar. Quién es el embudo del negocio no se deduce del
 * número: lo dice `funnels.es_default`.
 */
async function ambitoDeFunnel(funnelId: number | null | undefined): Promise<AmbitoFunnel> {
  if (funnelId == null) return { modo: 'todos' };
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('funnels').select('es_default').eq('id', funnelId).limit(1);
  if (error) throw new Error(`ambitoDeFunnel(${funnelId}): ${error.message}`);
  // Sin fila no se puede caer a `negocio`: eso enrolaría a los leads con
  // `funnel_id` NULL —o sea a todos— en una secuencia declarada para otro
  // producto. Queda `propio`, que junta sólo lo que apunte a ese id. No es
  // alcanzable mientras la columna sea `references funnels(id) on delete
  // cascade`: borrar el embudo se lleva la secuencia.
  const fila = ((data ?? []) as Array<{ es_default: boolean | null }>)[0];
  return ambitoDeSecuencia(funnelId, fila?.es_default === true);
}

// ── Cohortes: qué leads dispara cada secuencia ───────────────────────────────
// Los 13 triggers "legacy" consultan columnas del funnel estándar. El trigger
// 'etapa_actual' es el camino funnel-agnóstico (#34): la secuencia se cuelga de
// una etapa del funnel derivado (nutricion_secuencias.etapa = stage key) y
// enrola a los leads cuya etapa EFECTIVA (override manual o derivada) coincide —
// sirve para cualquier funnel, incluidas etapas custom del editor.
//
// ⚠️ Y TODOS SE ACOTAN AL EMBUDO QUE LA SECUENCIA DECLARA (#627, mig 0170). El
// `funnelId` es el de la secuencia, tal cual está en la fila, y el ámbito se
// resuelve UNA vez acá: con NULL —hoy, las 62 filas— la cohorte se arma como
// siempre, sin filtrar y sin leer nada. El porqué de los tres casos está en
// lib/nutricion-ambito.ts.
export async function leadsDeCohorte(
  triggerTipo: string,
  etapa?: string | null,
  funnelId?: number | null,
): Promise<number[]> {
  return cohorteDeTrigger(triggerTipo, etapa ?? null, await ambitoDeFunnel(funnelId));
}

// El ámbito viaja YA RESUELTO para que la rama de la post-agenda —que se llama a
// sí misma con otro trigger— no vuelva a consultar `funnels`, y sobre todo para
// que no pueda perderlo en el camino: el trigger hermano juntaría los leads de
// todos los embudos y la exclusión de familia no se enteraría.
async function cohorteDeTrigger(triggerTipo: string, etapa: string | null, ambito: AmbitoFunnel): Promise<number[]> {
  const supabase = (await getTenantDb());
  const desde = haceDiasISO(VENTANA_DIAS);          // timestamp ISO, para created_at
  const hoy = ahoraISO().slice(0, 10);              // YYYY-MM-DD (UTC), para fechas futuras
  const fechaDesde45 = haceDiasISO(45).slice(0, 10); // YYYY-MM-DD, ventana de hitos recientes

  if (triggerTipo === 'etapa_actual') {
    if (!etapa) return [];
    // Ventana anti-revival de 90 días sobre el ÚLTIMO HITO del lead (no sobre su
    // edad): un lead viejo con una transición fresca (agendó, tuvo reunión)
    // entra; uno sin actividad en 90 días queda afuera.
    // Paginado por `id`: los abiertos de ws1 ya son 1032 y el `.select()` suelto
    // devolvía 1000 sin avisar. El lead que caía del corte NUNCA se inscribía en
    // su secuencia, en cada pasada del motor, sin un log. El filtro de etapa y de
    // hito es en memoria (la etapa efectiva se deriva acá, no existe en la base).
    let data: unknown[];
    try {
      data = await leerTodo<unknown>(
        supabase, 'leads',
        'id, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, nutricion_realizada, created_at',
        // El ámbito del embudo entra acá y no en el filtro en memoria de abajo: una
        // cohorte de ~1000 ids que después se descarta es el mismo techo de PostgREST
        // que este paginado vino a cerrar.
        { eq: { estado_lead: 'abierto' }, filtros: (q) => conAmbito(q, ambito) },
      );
    } catch (e) {
      throw new Error(`cohorte etapa_actual(${etapa}): ${e instanceof Error ? e.message : String(e)}`);
    }
    type LeadEtapa = { id: number; estado_lead: 'abierto'; pipeline_stage: string | null; fecha_agenda: string | null; fecha_junta_1: string | null; fecha_junta_2: string | null; asistio_j1: boolean | null; asistio_j2: boolean | null; nutricion_realizada: boolean | null; created_at: string };
    const corte = Date.now() - 90 * 86400 * 1000;
    const ultimoHito = (l: LeadEtapa): number => Math.max(
      ...[l.created_at, l.fecha_agenda, l.fecha_junta_1, l.fecha_junta_2]
        .filter((x): x is string => Boolean(x))
        .map((x) => Date.parse(x))
        .filter((ms) => Number.isFinite(ms)),
      0,
    );
    return (data as LeadEtapa[])
      .filter((l) => ultimoHito(l) >= corte)
      .filter((l) => pipelineStageOf({ ...l, nutricion_realizada: l.nutricion_realizada ?? undefined }) === etapa)
      .map((l) => l.id);
  }

  if (triggerTipo === 'instant_form_sin_agenda') {
    return idsCohorte(supabase, 'form-sin-agenda', ambito, (q) => q
      .not('meta_lead_id', 'is', null)
      .is('fecha_agenda', null)
      .eq('estado_lead', 'abierto')
      .gte('created_at', desde));
  }

  if (triggerTipo === 'vio_vsl_sin_agendar') {
    const rows = await filasCohorte<{ id: number; visitor_id: string }>(supabase, 'vio-vsl', ambito, 'id, visitor_id', (q) => q
      .not('visitor_id', 'is', null)
      .is('fecha_agenda', null)
      .eq('estado_lead', 'abierto')
      .gte('created_at', desde));
    const eng = await getVslEngagementMap(rows.map((r) => r.visitor_id));
    return rows
      .filter((r) => (eng.get(r.visitor_id)?.max_pct ?? 0) >= UMBRAL_VSL_PCT)
      .map((r) => r.id);
  }

  if (triggerTipo === 'vio_poco_vsl') {
    // Tiene tracking de visitante (entró a la landing) pero NO alcanzó el umbral
    // de retención del VSL y no agendó. Complemento exacto de vio_vsl_sin_agendar.
    const rows = await filasCohorte<{ id: number; visitor_id: string }>(supabase, 'vio-poco-vsl', ambito, 'id, visitor_id', (q) => q
      .not('visitor_id', 'is', null)
      .is('fecha_agenda', null)
      .eq('estado_lead', 'abierto')
      .gte('created_at', desde));
    const eng = await getVslEngagementMap(rows.map((r) => r.visitor_id));
    return rows
      .filter((r) => (eng.get(r.visitor_id)?.max_pct ?? 0) < UMBRAL_VSL_PCT)
      .map((r) => r.id);
  }

  if (triggerTipo === 'agendado_sin_confirmar') {
    // J1 futura y todavía sin asistencia registrada. El modelo no tiene un campo
    // "confirmó asistencia" → usamos la J1 próxima como disparador del recordatorio.
    return idsCohorte(supabase, 'agendado-sin-confirmar', ambito, (q) => q
      .not('fecha_junta_1', 'is', null)
      .gte('fecha_junta_1', hoy)
      .is('asistio_j1', null)
      .eq('estado_lead', 'abierto'));
  }

  // ── Las DOS MITADES de la post-agenda ──────────────────────────────────────
  // Quien agenda después de tu bienvenida y quien agenda sin haberte hablado
  // nunca reciben lo mismo: al primero no se le puede decir «soy Fulano» otra
  // vez. Antes eran dos PASOS excluyentes de una sola secuencia; ahora son dos
  // secuencias, que es como el dueño las piensa y como se editan.
  //
  // ⚠️ PARTIR EL COHORTE EN DOS NO ALCANZA, Y ACÁ ESTÁ EL DUPLICADO QUE ESTO
  // EVITA. La condición «¿ya le hablamos?» NO es estable: mandarle el audio de
  // primer contacto lo convierte en «ya contactado», así que en la corrida
  // siguiente el mismo lead cae en el cohorte de la secuencia HERMANA y recibe
  // el segundo audio. Y la deduplicación de `comprometerInscripciones` no lo
  // ve: filtra por `secuencia_id`, o sea por UNA secuencia, no por la familia.
  //
  // Por eso la regla es de familia y no de secuencia: quien ya está inscripto
  // en CUALQUIERA de las dos queda fuera de las dos. Se decide una vez, al
  // entrar, y ningún envío posterior la puede dar vuelta.
  if (triggerTipo === TRIGGER_AGENDA_CONOCIDO || triggerTipo === TRIGGER_AGENDA_NUEVO) {
    const base = await cohorteDeTrigger('agendado_sin_confirmar', etapa, ambito);
    if (base.length === 0) return [];
    const yaEnLaFamilia = await leadsEnFamiliaPostAgenda(base);
    const libres = base.filter((id) => !yaEnLaFamilia.has(id));
    if (libres.length === 0) return [];
    const yaLesHablamos = await leadsYaContactados(libres);
    return libres.filter((id) => (triggerTipo === TRIGGER_AGENDA_CONOCIDO ? yaLesHablamos.has(id) : !yaLesHablamos.has(id)));
  }

  if (triggerTipo === 'no_show_j1') {
    // No asistió a J1 (asistio_j1 = false), todavía abierto, J1 reciente.
    return idsCohorte(supabase, 'no-show-j1', ambito, (q) => q
      .eq('asistio_j1', false)
      .eq('estado_lead', 'abierto')
      .gte('fecha_junta_1', fechaDesde45));
  }

  if (triggerTipo === 'post_j1_sin_avanzar') {
    // Asistió a J1 pero sigue sin calificar y sin J2 agendada.
    return idsCohorte(supabase, 'post-j1-sin-avanzar', ambito, (q) => q
      .eq('asistio_j1', true)
      .is('calificado', null)
      .is('fecha_junta_2', null)
      .eq('estado_lead', 'abierto')
      .gte('fecha_junta_1', fechaDesde45));
  }

  if (triggerTipo === 'post_j1_calificado_sin_j2') {
    // Calificado en J1 pero todavía no agendó la J2.
    return idsCohorte(supabase, 'calificado-sin-j2', ambito, (q) => q
      .eq('calificado', true)
      .is('fecha_junta_2', null)
      .is('asistio_j2', null)
      .eq('estado_lead', 'abierto')
      .gte('fecha_junta_1', fechaDesde45));
  }

  if (triggerTipo === 'no_show_j2') {
    return idsCohorte(supabase, 'no-show-j2', ambito, (q) => q
      .eq('asistio_j2', false)
      .eq('estado_lead', 'abierto')
      .gte('fecha_junta_2', fechaDesde45));
  }

  if (triggerTipo === 'post_j2_sin_cerrar') {
    // Asistió a J2 pero todavía no hay cierre.
    return idsCohorte(supabase, 'post-j2-sin-cerrar', ambito, (q) => q
      .eq('asistio_j2', true)
      .is('cerro', null)
      .is('fecha_cierre', null)
      .eq('estado_lead', 'abierto')
      .gte('fecha_junta_2', fechaDesde45));
  }

  if (triggerTipo === 'confirmado_sin_pago') {
    // Confirmó verbalmente (fecha_confirmacion) pero todavía no registró el primer pago.
    return idsCohorte(supabase, 'confirmado-sin-pago', ambito, (q) => q
      .not('fecha_confirmacion', 'is', null)
      .is('fecha_primer_pago', null)
      .in('estado_lead', ['abierto', 'ganado'])
      .gte('fecha_confirmacion', fechaDesde45));
  }

  if (triggerTipo === 'post_pago') {
    // Registró el primer pago hace poco → bienvenida (una sola vez por dedup de inscripción).
    return idsCohorte(supabase, 'post-pago', ambito, (q) => q
      .not('fecha_primer_pago', 'is', null)
      .gte('fecha_primer_pago', fechaDesde45)
      .in('estado_lead', ['abierto', 'ganado']));
  }

  if (triggerTipo === 'reactivacion_viejo') {
    // Frío: nunca agendó, abierto, creado entre 30 y 90 días atrás.
    return idsCohorte(supabase, 'reactivacion-viejo', ambito, (q) => q
      .is('fecha_agenda', null)
      .eq('estado_lead', 'abierto')
      .lt('created_at', desde)
      .gte('created_at', haceDiasISO(90)));
  }

  if (triggerTipo === 'ultimo_intento_antes_noresp') {
    // Último intento antes de marcar no-responde: nunca agendó, abierto, creado
    // entre 90 y 365 días atrás (más viejo que la reactivación).
    return idsCohorte(supabase, 'ultimo-intento', ambito, (q) => q
      .is('fecha_agenda', null)
      .eq('estado_lead', 'abierto')
      .lt('created_at', haceDiasISO(90))
      .gte('created_at', haceDiasISO(365)));
  }

  // trigger desconocido → sin cohorte (no rompe el cron)
  return [];
}

// ── Agenda de pasos ──────────────────────────────────────────────────────────
type JuntasLead = { fecha_junta_1?: string | null; junta_1_at?: string | null; fecha_junta_2?: string | null; junta_2_at?: string | null };

// Offset horario de México en formato ISO (derivado de TZ_OFFSET_MX).
const OFFSET_MX = `${TZ_OFFSET_MX < 0 ? '-' : '+'}${String(Math.abs(TZ_OFFSET_MX)).padStart(2, '0')}:00`;

// fecha_junta_* es DATE ('YYYY-MM-DD'): parsearla directo daría medianoche UTC
// (= la TARDE del día anterior en MX) y una reunión de hoy contaría como pasada.
// Sin hora exacta (junta_*_at, Calendly) asumimos mediodía MX como hora default.
function parseFechaJunta(x: string): number {
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(x) ? `${x}T12:00:00${OFFSET_MX}` : x);
}

/** Timestamp (ms) de la próxima reunión FUTURA del lead, o null si no tiene. */
function reunionFuturaMs(juntas: JuntasLead | null | undefined): number | null {
  const candidatos = [juntas?.junta_1_at ?? juntas?.fecha_junta_1, juntas?.junta_2_at ?? juntas?.fecha_junta_2]
    .filter((x): x is string => Boolean(x))
    .map(parseFechaJunta)
    .filter((ms) => Number.isFinite(ms) && ms > Date.now());
  return candidatos.length ? Math.min(...candidatos) : null;
}

/**
 * Cuándo toca un paso: delay relativo (default) o, si está anclado a la reunión
 * (#18), delay_horas ANTES de la próxima reunión futura del lead (prefiere la
 * hora exacta junta_*_at; una fecha sin hora cuenta como mediodía MX). Sin
 * reunión futura → ahora: procesarEnvios re-valida el ancla al enviar y cierra
 * la inscripción si la reunión ya pasó.
 */
function proximoEnvioDePaso(paso: PasoSecuencia | undefined, juntas: JuntasLead | null | undefined): string {
  if (paso?.ancla === 'reunion') {
    const reunion = reunionFuturaMs(juntas);
    if (reunion != null) {
      const objetivo = reunion - (paso.delay_horas || 0) * 3600 * 1000;
      return new Date(Math.max(objetivo, Date.now())).toISOString();
    }
    return ahoraISO();
  }
  return enHorasISO(paso?.delay_horas ?? 0);
}

// Copy que sigue con texto de relleno del seed ([tu problema], [resultado]…).
// Los [tu link …] son placeholders del SISTEMA (se reemplazan al enviar) y no
// cuentan. Espejo del heurístico de la UI (NutricionGenerar).
const RX_RELLENO = /\[(?!tu link)[^\]\n]{2,80}\]/i;
const pasoConRelleno = (p: PasoSecuencia): boolean =>
  RX_RELLENO.test(p.cuerpo) || RX_RELLENO.test(p.asunto ?? '');

// ── Inscripción ──────────────────────────────────────────────────────────────
export type PlanInscripcion = { secuencia: string; lead_id: number; proximo_envio_at: string };

/**
 * De `leadIds`, cuáles ya tienen una inscripción que cumpla `filtro`. En TANDAS de
 * 200 y cada tanda PAGINADA por `id`.
 *
 * Era `.in('lead_id', candidatos)` suelto, con dos formas de fallar en silencio:
 * con más de 1000 inscripciones que matchean, PostgREST cortaba y los que caían
 * afuera se tomaban por NO inscriptos → se reinsertaban, chocaban con el
 * `unique(lead_id, secuencia_id)` y el `throw` cortaba la inscripción ENTERA (de
 * todas las secuencias que venían después). Y desde que `etapa_actual` pagina
 * (17/09), la lista de candidatos puede ser de ~1000 ids: una URL de ese tamaño
 * es la otra forma de romperse.
 */
async function inscriptosDe(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  leadIds: readonly number[],
  filtro: (q: ConsultaPaginada) => unknown,
): Promise<Set<number>> {
  const out = new Set<number>();
  for (const tanda of enTandas([...new Set(leadIds)], 200)) {
    const filas = await leerTodo<{ lead_id: number | null }>(db, 'nutricion_inscripciones', 'id, lead_id', {
      orden: 'id',
      filtros: (q) => filtro(q.in('lead_id', tanda) as ConsultaPaginada) as ConsultaPaginada,
    });
    for (const r of filas) if (r.lead_id != null) out.add(r.lead_id);
  }
  return out;
}

/**
 * Leads que YA están inscriptos en alguna secuencia de la familia post-agenda.
 *
 * Es lo que mantiene excluyentes a las dos mitades después del primer envío:
 * sin esto, mandarle el audio a un lead de «primer contacto» lo mueve al
 * cohorte de «ya contactado» y la corrida siguiente le manda el otro audio.
 *
 * Mira TODAS las inscripciones, no solo las activas: una completada o
 * cancelada también significa que este lead ya pasó por acá, y volver a
 * meterlo por la otra mitad sería el mismo mensaje repetido.
 */
async function leadsEnFamiliaPostAgenda(leadIds: number[]): Promise<Set<number>> {
  const set = new Set<number>();
  if (leadIds.length === 0) return set;
  const supabase = await getTenantDb();
  const { data: secs } = await supabase
    .from('nutricion_secuencias').select('id')
    .in('trigger_tipo', FAMILIA_POST_AGENDA);
  const ids = ((secs ?? []) as Array<{ id: number }>).map((r) => r.id);
  if (ids.length === 0) return set;
  // En tandas y paginado (ver `inscriptosDe`). Antes era un `.in()` suelto que
  // además IGNORABA el error: una lectura fallida dejaba a todos «fuera de la
  // familia» y el mismo lead entraba a las dos secuencias hermanas.
  for (const id of await inscriptosDe(supabase, leadIds, (q) => q.in('secuencia_id', ids))) set.add(id);
  return set;
}

// Devuelve los leads que se inscribirían (no escribe). Para el dry-run.
/**
 * Deja solo a los leads que todavía están a tiempo de entrar a ESTA secuencia
 * (`Estrategia.antiguedad_max_horas`). Sin tope propio devuelve lo mismo, sin
 * leer nada.
 *
 * ⚠️ Va en el plan Y en el commit (y en `enrolarPorEvento`): si el dry-run no
 * filtrara, la vista previa prometería 126 inscripciones y la corrida haría 5.
 */
async function aTiempo(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  sec: Pick<Secuencia, 'antiguedad_max_horas'>,
  ids: number[],
): Promise<number[]> {
  if (sec.antiguedad_max_horas == null || ids.length === 0) return ids;
  const ahoraMs = Date.now();
  const creado = new Map<number, string | null>();
  // En tandas y paginado, como todo `.in()` sobre una cohorte (ver filasCohorte).
  for (const tanda of enTandas(ids, 200)) {
    const filas = await leerTodo<{ id: number; created_at: string | null }>(db, 'leads', 'id, created_at', {
      orden: 'id', filtros: (q) => q.in('id', tanda) as ConsultaPaginada,
    });
    for (const f of filas) creado.set(f.id, f.created_at);
  }
  return ids.filter((id) => dentroDeAntiguedad({ maxHoras: sec.antiguedad_max_horas, createdAt: creado.get(id) ?? null, ahoraMs }));
}

export async function planificarInscripciones(): Promise<PlanInscripcion[]> {
  const supabase = (await getTenantDb());
  const secuencias = await getSecuenciasActivas();
  const plan: PlanInscripcion[] = [];

  for (const sec of secuencias) {
    const candidatos = await aTiempo(supabase, sec, await leadsDeCohorte(sec.trigger_tipo, sec.etapa, sec.funnel_id));
    if (candidatos.length === 0) continue;
    const inscriptos = await inscriptosDe(supabase, candidatos, (q) => q.eq('secuencia_id', sec.id))
      .catch((e: unknown) => { throw new Error(`planificarInscripciones: ${e instanceof Error ? e.message : String(e)}`); });
    const pendientes = candidatos.filter((id) => !inscriptos.has(id));
    const horarios = await horariosDeInscripcion(sec.pasos[0], pendientes);
    for (const lead_id of pendientes) {
      plan.push({ secuencia: sec.clave, lead_id, proximo_envio_at: horarios.get(lead_id) ?? enHorasISO(sec.pasos[0]?.delay_horas ?? 0) });
    }
  }
  return plan;
}

/**
 * Horario del primer paso para cada lead pendiente de inscribir. Con paso 0
 * anclado a la reunión (#18), trae la agenda de cada lead en una query batch;
 * sin ancla, delay relativo. Compartido por el dry-run y el commit para que el
 * preview no mienta sobre el horario.
 */
async function horariosDeInscripcion(paso0: PasoSecuencia | undefined, pendientes: number[]): Promise<Map<number, string>> {
  let juntasMap = new Map<number, JuntasLead>();
  if (paso0?.ancla === 'reunion' && pendientes.length) {
    const supabase = (await getTenantDb());
    // En tandas y paginado: `pendientes` puede ser la cohorte entera. Con el `.in()`
    // suelto, un lead que caía del corte se quedaba sin su reunión y el paso
    // anclado salía con delay relativo — un recordatorio a destiempo.
    for (const tanda of enTandas(pendientes, 200)) {
      const jl = await leerTodo<{ id: number } & JuntasLead>(supabase, 'leads', 'id, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at', {
        orden: 'id', filtros: (q) => q.in('id', tanda) as ConsultaPaginada,
      });
      for (const l of jl) juntasMap.set(l.id, l);
    }
  }
  return new Map(pendientes.map((id) => [id, proximoEnvioDePaso(paso0, juntasMap.get(id))]));
}

// Persiste las inscripciones nuevas. Devuelve cuántas creó.
export async function comprometerInscripciones(): Promise<number> {
  const supabase = (await getTenantDb());
  const secuencias = await getSecuenciasActivas();
  let creadas = 0;

  for (const sec of secuencias) {
    const candidatos = await aTiempo(supabase, sec, await leadsDeCohorte(sec.trigger_tipo, sec.etapa, sec.funnel_id));
    if (candidatos.length === 0) continue;
    // Un error acá LANZA: antes se ignoraba, «nadie inscripto» reinsertaba a todos y
    // el insert moría contra el unique — o sea que igual cortaba, pero con un
    // mensaje que culpaba al insert y no a la lectura.
    const inscriptos = await inscriptosDe(supabase, candidatos, (q) => q.eq('secuencia_id', sec.id))
      .catch((e: unknown) => { throw new Error(`comprometerInscripciones: ${e instanceof Error ? e.message : String(e)}`); });
    const pendientes = candidatos.filter((id) => !inscriptos.has(id));
    const horarios = await horariosDeInscripcion(sec.pasos[0], pendientes);
    const nuevas = pendientes.map((lead_id) => ({
      lead_id,
      secuencia_id: sec.id,
      paso_actual: 0,
      estado: 'activa',
      proximo_envio_at: horarios.get(lead_id) ?? enHorasISO(sec.pasos[0]?.delay_horas ?? 0),
    }));
    if (nuevas.length === 0) continue;
    const { error } = await supabase.from('nutricion_inscripciones').insert(nuevas);
    if (error) throw new Error(`comprometerInscripciones: ${error.message}`);
    creadas += nuevas.length;
  }
  return creadas;
}

// ── Enrolamiento por EVENTO (inmediatez — reunión 31/07) ─────────────────────
// Regla del negocio: al lead que llena el formulario de Meta hay que escribirle
// casi al instante ("si pasan días, nos van a tratar como extraños"). El cron
// horario no alcanza: estos enganches enrolan y disparan el primer paso YA.
//
// La ventana horaria SÍ se respeta (no despertamos a nadie a las 3am): si el
// evento cae fuera de 9-21 MX, la inscripción queda vencida y la levanta la
// primera corrida del cron de la mañana.

export type EventoNutricion = 'lead_nuevo' | 'agenda_nueva';

// Qué triggers responden a cada evento. Los cohortes siguen siendo la fuente de
// verdad de A QUIÉN le toca: acá solo decidimos QUÉ secuencias mirar ya mismo.
const TRIGGERS_POR_EVENTO: Record<EventoNutricion, string[]> = {
  lead_nuevo: ['instant_form_sin_agenda', 'vio_vsl_sin_agendar', 'vio_poco_vsl'],
  agenda_nueva: ['agendado_sin_confirmar', TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_NUEVO],
};

/**
 * Enrola a UN lead en las secuencias activas del evento y dispara su primer
 * paso en el acto. Best-effort: nunca tira (lo llaman webhooks — si falla el
 * enrolamiento, el lead igual quedó creado y el cron lo levanta después).
 * Devuelve cuántas inscripciones creó.
 */
export async function enrolarPorEvento(leadId: number, evento: EventoNutricion): Promise<number> {
  try {
    const supabase = await getTenantDb();
    const claves = TRIGGERS_POR_EVENTO[evento] ?? [];
    if (!claves.length) return 0;
    const todas = (await getSecuenciasActivas()).filter((s) => claves.includes(s.trigger_tipo));
    if (!todas.length) return 0;
    // LAS DOS MITADES DE LA POST-AGENDA SON EXCLUYENTES, Y ACÁ ES DONDE MÁS
    // FÁCIL SE ROMPE: este camino no pasa por `leadsDeCohorte` —enrola en TODAS
    // las secuencias del evento— así que sin este filtro el mismo lead entraría
    // a las dos y recibiría los dos audios de apertura, uno presentándose y el
    // otro retomando una charla. Es exactamente el duplicado que separar las
    // secuencias vino a evitar.
    const hayFamilia = todas.filter((s) => FAMILIA_POST_AGENDA.includes(s.trigger_tipo)).length > 1;
    const delEvento = hayFamilia
      ? secuenciasParaElLead(todas, (await leadsYaContactados([leadId])).has(leadId))
      : todas;
    // El tope de antigüedad vale también acá: un evento de un lead viejo (una
    // agenda nueva, un lead re-importado) no lo mete a una secuencia que no le
    // escribe a leads de esa edad.
    const secuencias: Secuencia[] = [];
    for (const s of delEvento) {
      if ((await aTiempo(supabase, s, [leadId])).length) secuencias.push(s);
    }
    if (!secuencias.length) return 0;

    const { data: yaInsc } = await supabase
      .from('nutricion_inscripciones')
      .select('secuencia_id')
      .eq('lead_id', leadId)
      .in('secuencia_id', secuencias.map((s) => s.id));
    const inscripto = new Set(((yaInsc ?? []) as Array<{ secuencia_id: number }>).map((r) => r.secuencia_id));

    const nuevas = secuencias
      .filter((s) => !inscripto.has(s.id))
      .map((s) => ({
        lead_id: leadId,
        secuencia_id: s.id,
        paso_actual: 0,
        estado: 'activa',
        // El primer paso de una secuencia disparada por evento sale YA: el
        // delay configurado cuenta desde el evento, no desde el cron.
        proximo_envio_at: proximoEnvioDePaso(s.pasos[0], null),
      }));
    if (!nuevas.length) return 0;

    const { error } = await supabase.from('nutricion_inscripciones').insert(nuevas);
    if (error) { console.error(`[nutricion] enrolarPorEvento(${evento}) lead ${leadId}: ${error.message}`); return 0; }

    // Vía rápida: intentamos mandar el primer paso ahora mismo, solo de este lead.
    try { await procesarEnvios({ soloLeadId: leadId }); }
    catch (e) { console.error(`[nutricion] envío inmediato lead ${leadId} falló:`, e); }
    return nuevas.length;
  } catch (e) {
    console.error(`[nutricion] enrolarPorEvento(${evento}) lead ${leadId} falló:`, e);
    return 0;
  }
}

// ── Envíos vencidos ───────────────────────────────────────────────────────────
type InscripcionVencida = {
  id: number;
  lead_id: number;
  secuencia_id: number;
  paso_actual: number;
};

export type PlanEnvio = {
  inscripcion_id: number;
  lead_id: number;
  secuencia: string;
  paso: number;
  canal: CanalNutricion | null;
  detalle: string;
};

async function inscripcionesVencidas(): Promise<InscripcionVencida[]> {
  const supabase = (await getTenantDb());
  // Paginado (vista previa del dry-run): con más de 1000 vencidas, la vista previa
  // mostraba 1000 y afirmaba que eso era todo lo que salía.
  const ahora = ahoraISO();
  try {
    return await leerTodo<InscripcionVencida>(supabase, 'nutricion_inscripciones', 'id, lead_id, secuencia_id, paso_actual', {
      orden: 'id', eq: { estado: 'activa' }, filtros: (q) => q.lte('proximo_envio_at', ahora) as ConsultaPaginada,
    });
  } catch (e) {
    throw new Error(`inscripcionesVencidas: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Devuelve qué se enviaría ahora (no escribe). Para el dry-run.
export async function planificarEnvios(): Promise<PlanEnvio[]> {
  const secuencias = await getSecuenciasActivas();
  const porId = new Map(secuencias.map((s) => [s.id, s]));
  const due = await inscripcionesVencidas();
  return due.map((insc) => {
    const sec = porId.get(insc.secuencia_id);
    const paso = sec?.pasos[insc.paso_actual];
    return {
      inscripcion_id: insc.id,
      lead_id: insc.lead_id,
      secuencia: sec?.clave ?? `#${insc.secuencia_id}`,
      paso: insc.paso_actual + 1,
      canal: paso?.canal ?? null,
      detalle: paso ? `${paso.canal}: ${paso.asunto ?? paso.cuerpo.slice(0, 40)}` : 'sin paso → se completaría',
    };
  });
}

function haceHorasISO(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

function dentroDeVentana(): boolean {
  const hLocal = (new Date().getUTCHours() + TZ_OFFSET_MX + 24) % 24;
  return hLocal >= VENTANA_INICIO && hLocal < VENTANA_FIN;
}

// Tope diario: cuenta SOLO envíos reales — una corrida de prueba (?commit=1,
// simulados) no debe consumir el presupuesto anti-baneo del workspace.
async function enviosUltimas24h(): Promise<number> {
  const supabase = (await getTenantDb());
  const { count, error } = await supabase
    .from('nutricion_envios')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'enviado')
    .gte('created_at', haceHorasISO(24));
  if (error) throw new Error(`enviosUltimas24h: ${error.message}`);
  return count ?? 0;
}

// Set de lead_ids que ya recibieron un envío (nutrición o broadcast) en las
// últimas HS_MIN_ENTRE_MSGS horas — calculado en 2 queries batch para TODOS los
// leads de la corrida (antes eran 2 count-queries POR lead dentro del loop: N+1).
/**
 * Leads a los que el negocio YA les habló alguna vez por nutrición.
 *
 * Sirve para el par `ya_contactado` / `primer_contacto`: a alguien que acaba de
 * agendar y ya recibió tu audio de bienvenida no se le manda "hola, soy Fulano"
 * de nuevo — suena a robot al instante.
 *
 * La imprecisión que hay que aceptar: "recibió ALGO" no es idéntico a "recibió
 * LA bienvenida". Cubre bien el caso real (el lead que entró por el formulario
 * y después agendó) y solo se equivoca si recibió otra nutrición distinta antes.
 * Distinguirlo de verdad exigiría rastrear qué secuencia mandó qué, y para la
 * decisión que hay que tomar acá —presentarse o no— no cambia el resultado.
 */
/**
 * ¿A este lead YA le hablamos alguna vez?
 *
 * Decide cuál de los dos audios de apertura sale en la post-agenda: el que se
 * presenta («es la primera vez que nos escuchamos») o el que retoma la charla.
 * Equivocarse acá se nota al instante — presentarse de cero a alguien con quien
 * venías conversando suena a robot.
 *
 * MIRA LAS DOS FUENTES, y la segunda es la que faltaba: antes solo contaba lo
 * que había mandado la APP por la nutrición, y en una cuenta que recién la
 * prende esa tabla está vacía. Resultado: todo el mundo era «primer contacto»,
 * incluidos los leads a los que el dueño ya les había escrito a mano por
 * WhatsApp. Medido en la cuenta del dueño al prender: 0 envíos de la app y 7
 * leads con conversación real espejada — los 7 se habrían presentado de cero.
 */
async function leadsYaContactados(leadIds: number[]): Promise<Set<number>> {
  const set = new Set<number>();
  if (leadIds.length === 0) return set;
  const supabase = (await getTenantDb());
  // Solo importa SI hay al menos una fila por lead, no cuántas: se pregunta por
  // exclusión (ver lib/ids-con-filas.ts). El `.in()` suelto de antes sobre
  // wa_mensajes volvía cortado en 1000 filas — un solo lead de ws1 tiene 1.194
  // mensajes nuestros — y los leads que no entraban quedaban como «nunca
  // contactado»: el audio de apertura se presentaba de cero a gente con la que
  // ya se venía hablando.
  const [envios, espejo] = await Promise.all([
    idsConAlMenosUnaFila(leadIds, (pend) => leadIdsDe(supabase.from('nutricion_envios')
      .select('lead_id').in('lead_id', pend).in('estado', ['enviado', 'simulado']), 'nutricion_envios')),
    // `from_me` = lo mandamos NOSOTROS. Un mensaje entrante no cuenta: que el
    // lead escriba no significa que le hayamos hablado.
    idsConAlMenosUnaFila(leadIds, (pend) => leadIdsDe(supabase.from('wa_mensajes')
      .select('lead_id').in('lead_id', pend).eq('from_me', true), 'wa_mensajes')),
  ]);
  for (const id of envios) set.add(id);
  for (const id of espejo) set.add(id);
  return set;
}

async function leadsConEnvioReciente(leadIds: number[]): Promise<Set<number>> {
  const set = new Set<number>();
  if (leadIds.length === 0) return set;
  const supabase = (await getTenantDb());
  const desde = haceHorasISO(HS_MIN_ENTRE_MSGS);
  const desdeCorto = haceHorasISO(HS_MIN_PREPARACION);
  // Leads con reunión FUTURA cercana: están en cadencia de preparación. Va
  // PRIMERO porque parte a los leads en dos ventanas distintas (abajo).
  const { data: prepData } = await supabase.from('leads')
    .select('id, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at').in('id', leadIds);
  const prep = new Set<number>();
  for (const l of (prepData ?? []) as Array<{ id: number } & JuntasLead>) {
    const ms = reunionFuturaMs(l);
    if (ms != null && ms - Date.now() <= HS_REUNION_CERCA * 3600 * 1000) prep.add(l.id);
  }
  // Con reunión encima, el guard baja de 20h a HS_MIN_PREPARACION: los toques
  // de preparación son lo que baja el no-show y no son prospección fría. Antes
  // se traían todas las filas de la ventana larga y se descartaban en memoria
  // las viejas de los leads en preparación; ahora cada grupo pregunta con SU
  // ventana, que es lo mismo pero sin bajar filas de más.
  const enPrep = leadIds.filter((id) => prep.has(id));
  const fuera = leadIds.filter((id) => !prep.has(id));
  // Todas preguntan «¿hay al menos una?» por exclusión (lib/ids-con-filas.ts):
  // los `.in()` sueltos de antes volvían cortados en 1000 filas sobre
  // wa_mensajes, y el guard creía que a un lead no le habíamos mandado nada
  // hace poco cuando sí.
  const porVentana = (
    ids: number[],
    desdeISO: string,
    q: (pend: number[], desdeISO: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
    tabla: string,
  ) => (ids.length === 0 ? Promise.resolve(new Set<number>()) : idsConAlMenosUnaFila(ids, (pend) => leadIdsDe(q(pend, desdeISO), tabla)));
  const qNutri = (pend: number[], d: string) => supabase.from('nutricion_envios').select('lead_id')
    .in('lead_id', pend).in('estado', ['enviado', 'simulado']).gte('created_at', d);
  const qEspejo = (pend: number[], d: string) => supabase.from('wa_mensajes').select('lead_id')
    .in('lead_id', pend).eq('from_me', true).gte('wa_timestamp', d);
  const resultados = await Promise.all([
    porVentana(fuera, desde, qNutri, 'nutricion_envios'),
    porVentana(enPrep, desdeCorto, qNutri, 'nutricion_envios'),
    // El broadcast no tiene excepción de preparación: un email masivo cuenta
    // igual con o sin reunión.
    porVentana(leadIds, desde, (pend, d) => supabase.from('email_broadcast_envios').select('lead_id')
      .in('lead_id', pend).in('estado', ['enviado', 'simulado']).gte('created_at', d), 'email_broadcast_envios'),
    // LO QUE SALIÓ DE VERDAD, no solo lo que mandó la app. El guard anti-ban
    // pregunta «¿este lead ya recibió algo hace poco?», y las dos tablas de
    // arriba solo saben de la nutrición: un mensaje que el dueño escribió a
    // mano desde su propio teléfono era invisible, así que la máquina le
    // encimaba el suyo minutos después. Es el mismo punto ciego que
    // `leadsYaContactados` tenía y que se cerró el 08/09/2026 — estaban a una
    // función de distancia y solo se arregló una.
    //
    // ⚠️ LO QUE ESTO SIGUE SIN VER: el canal OFICIAL. El espejo es de Evolution
    // (el no oficial); lo que sale por Meta/n8n no toca ninguna de las tres
    // tablas. Mientras una automatización de afuera le hable a los mismos
    // leads, ningún guard nuestro puede saberlo. No es un descuido de acá: es
    // el límite de lo que se puede medir, y por eso está escrito.
    //
    // El espejo entra con la MISMA excepción de preparación que la nutrición: con
    // una reunión encima la cadencia baja a HS_MIN_PREPARACION, y si no valiera
    // acá, un lead que contestó y al que el dueño le respondió a mano quedaría
    // congelado 20h justo en los días en que hay que confirmarle la reunión.
    porVentana(fuera, desde, qEspejo, 'wa_mensajes'),
    porVentana(enPrep, desdeCorto, qEspejo, 'wa_mensajes'),
  ]);
  for (const r of resultados) for (const id of r) set.add(id);
  return set;
}

/**
 * Los `lead_id` de una consulta de existencia. Un error LANZA: antes estas
 * guardas ignoraban el `error` y lo leían como «no hay filas», o sea «nunca le
 * escribimos», que es la dirección que manda mensajes de más.
 */
async function leadIdsDe(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  tabla: string,
): Promise<Array<number | null>> {
  const { data, error } = await q;
  if (error) throw new Error(`guard de envío (${tabla}): ${error.message}`);
  return ((data ?? []) as Array<{ lead_id: number | null }>).map((r) => r.lead_id);
}

export type ResultadoProceso = {
  saltado?: string;
  enviados: number;
  simulados: number;
  omitidos: number;
  esperando: number;
  borradores: number;
  fallos: number;
  detalle: Array<{ lead_id: number; canal: string; estado: string; nota?: string }>;
};

// Procesa los envíos vencidos con rate-limiting anti-baneo: ventana horaria,
// tope diario (24h móviles), tope por corrida y guard de 20h por lead.
// El envío REAL de cada canal se decide por workspace (envio-flags):
//   · canal habilitado  → envío real (WhatsApp exige template aprobado).
//   · canal apagado     → el paso ESPERA: reintento en 24h, sin enviar ni
//     avanzar. Antes se marcaba 'omitido' y avanzaba — quemaba la cadencia si
//     el cliente prendía el canal después, sin reinscripción posible por el
//     unique(lead, secuencia) (tarea #5).
//   · opts.simularApagados → los canales apagados se marcan 'simulado' (modo
//     prueba de la máquina, el ?commit=1 histórico).
// Un 'fallo' NO avanza el paso (se reintenta), salvo condición terminal.
export async function procesarEnvios(opts?: { ignorarVentana?: boolean; simularApagados?: boolean; soloLeadId?: number }): Promise<ResultadoProceso> {
  const res: ResultadoProceso = { enviados: 0, simulados: 0, omitidos: 0, esperando: 0, borradores: 0, fallos: 0, detalle: [] };
  const [waOn, emailOn, sandbox, remitente, instEvo] = await Promise.all([
    envioWhatsappHabilitado(),
    envioEmailHabilitado(),
    remitenteEsSandbox(),
    getEmailFrom(),
    getInstanciaRow(),
  ]);
  // Firma del footer de los emails = display name del remitente DEL WORKSPACE.
  const fromNameWs = displayNameDe(remitente);
  // ¿El número no oficial (Evolution) puede mandar AHORA?
  //
  // ⚠️ DECIDÍA CON LA FILA, que miente en las dos direcciones. Con la línea de
  // Mauricio caída desde el 3/09, la post-agenda se prendió el 8/09 y los 4 envíos
  // terminaron en `fallo` — correcto por casualidad: la fila y la sesión
  // coincidían. El día que discrepen, una fila vieja en «desconectado» apaga un
  // canal que anda, sin que nada lo diga. Decide la sonda; la fila queda para
  // cuando la sonda no contesta. El porqué entero, en lib/nutricion-canal.ts.
  //
  // UNA sonda por corrida, no por envío (~250 ms). Con tope de 8 s: el cron no
  // puede quedar colgado de un Evolution que no responde.
  const sondeoEvo = instEvo
    ? await sondearSocket(instEvo.instance_name, 8000).catch(() => 'sin_respuesta' as const)
    : null;
  const canalEvo = canalNoOficial(sondeoEvo, instEvo?.estado);
  const evoConectado = canalEvo.listo;

  if (!opts?.ignorarVentana && !dentroDeVentana()) {
    return { ...res, saltado: 'fuera-de-ventana-horaria' };
  }
  const presupuesto = MAX_POR_DIA - (await enviosUltimas24h());
  if (presupuesto <= 0) return { ...res, saltado: 'tope-diario' };
  const cupo = Math.min(MAX_POR_CORRIDA, presupuesto);

  const supabase = (await getTenantDb());
  const secuencias = await getSecuenciasActivas();
  const porId = new Map(secuencias.map((s) => [s.id, s]));

  // Cola PAGINADA: los 'omitido'/'saltado' no consumen cupo, así que una sola
  // ventana de cupo*3 podía llenarse de filas sin envío real y postergar los
  // envíos de verdad. Iteramos lotes (dedup por id de inscripción) hasta llenar
  // el cupo o drenar la cola de vencidas.
  const LOTE = cupo * 3;
  const vistos = new Set<number>();
  let rondas = 0;

  while (res.enviados + res.simulados < cupo && rondas < 6) {
    rondas += 1;
    let q = supabase
      .from('nutricion_inscripciones')
      .select('id, lead_id, secuencia_id, paso_actual')
      .eq('estado', 'activa')
      .lte('proximo_envio_at', ahoraISO());
    // Vía rápida de UN lead (enrolamiento por evento): reusa TODO el motor
    // (anti-ban, audio, borradores, gates) sin esperar la corrida del cron.
    if (opts?.soloLeadId) q = q.eq('lead_id', opts.soloLeadId);
    // LOS YA VISTOS SE EXCLUYEN EN EL SERVER, y el orden desempata por `id`. Antes se
    // filtraban en memoria después del `.limit(LOTE)`: las filas salteadas por «msg
    // <20h» no se actualizan, así que la vuelta siguiente releía LAS MISMAS LOTE
    // filas, todas ya vistas → `due` vacío → el bucle cortaba. Si las más viejas
    // estaban frenadas por el guard, no salía nada en esa corrida ni en las
    // siguientes: la cola entera trabada detrás de un puñado. Y `proximo_envio_at`
    // se repite, así que sin el `id` qué filas entraban al lote no estaba definido.
    if (vistos.size) q = q.not('id', 'in', `(${[...vistos].join(',')})`);
    const { data: dueRaw, error } = await q
      .order('proximo_envio_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(LOTE);
    if (error) throw new Error(`procesarEnvios: ${error.message}`);
    const fetched = (dueRaw ?? []) as Array<{ id: number; lead_id: number; secuencia_id: number; paso_actual: number }>;
    const due = fetched.filter((d) => !vistos.has(d.id));
    if (due.length === 0) break;
    for (const d of due) vistos.add(d.id);

    const leadIds = [...new Set(due.map((d) => d.lead_id))];
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, nombre, telefono, empresa, email, email_opt_out, created_at, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at')
      .in('id', leadIds);
    const leadMap = new Map(
      ((leadsData ?? []) as Array<{ id: number; nombre: string | null; telefono: string | null; empresa: string | null; email: string | null; email_opt_out: boolean | null; created_at: string | null } & JuntasLead>).map((l) => [l.id, l]),
    );
    // Ventana anti-baneo de 20h resuelta en batch (no 2 counts por lead en el loop).
    const conEnvioReciente = await leadsConEnvioReciente(leadIds);
    // Quién ya recibió algo alguna vez → decide cuál de los dos pasos de
    // apertura sale (presentarse o retomar). También en batch.
    const yaContactados = await leadsYaContactados(leadIds);

    for (const insc of due) {
      if (res.enviados + res.simulados >= cupo) break;

      const sec = porId.get(insc.secuencia_id);
      const paso = sec?.pasos[insc.paso_actual];
      if (!sec || !paso) {
        await supabase
          .from('nutricion_inscripciones')
          .update({ estado: 'completada', proximo_envio_at: null, updated_at: ahoraISO() })
          .eq('id', insc.id);
        continue;
      }

      const lead = leadMap.get(insc.lead_id);

      // Pasos ANCLADOS a la reunión (#18): la agenda se re-valida AL MOMENTO de
      // enviar, no solo al programar. (1) Sin reunión futura → la inscripción se
      // cierra sin enviar (un recordatorio tardío es peor que ninguno). (2) Si el
      // objetivo re-calculado quedó en el futuro (reagenda, drift por espera de
      // canal), el paso se re-ancla y espera su hora.
      // Lo de «sin reunión futura no hay nada que mandar» vale para el paso anclado Y para
      // toda la post-agenda, cuyos pasos NO están anclados (salen 1 h y 24 h después de
      // agendarse). Ver `preparaUnaReunion`: con la línea caída, el reintento diario empujó a
      // dos leads reales de Mauricio hasta DESPUÉS de su reunión.
      if (paso.ancla === 'reunion' || preparaUnaReunion(sec.trigger_tipo)) {
        if (reunionFuturaMs(lead) == null) {
          res.omitidos += 1;
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'omitido', nota: 'la reunión ya pasó' });
          await supabase.from('nutricion_inscripciones')
            .update({ estado: 'completada', proximo_envio_at: null, updated_at: ahoraISO() }).eq('id', insc.id);
          continue;
        }
      }
      if (paso.ancla === 'reunion') {
        const objetivo = proximoEnvioDePaso(paso, lead);
        if (Date.parse(objetivo) > Date.now() + 5 * 60 * 1000) {
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 're-anclado a la reunión' });
          await supabase.from('nutricion_inscripciones')
            .update({ proximo_envio_at: objetivo, updated_at: ahoraISO() }).eq('id', insc.id);
          continue;
        }
      }

      // Tope de antigüedad mirado AL MANDAR, no solo al inscribir. Una
      // inscripción puede quedar esperando días (la línea caída, el canal
      // apagado, el tope diario) y el tope es sobre cuándo le LLEGA el primer
      // mensaje: una bienvenida tardía es peor que ninguna, como el
      // recordatorio de una reunión que ya pasó. Solo el primer paso: los
      // seguimientos de quien ya recibió la bienvenida siguen su curso.
      if (insc.paso_actual === 0 && sec.antiguedad_max_horas != null
          && !dentroDeAntiguedad({ maxHoras: sec.antiguedad_max_horas, createdAt: lead?.created_at ?? null, ahoraMs: Date.now() })) {
        res.omitidos += 1;
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'omitido', nota: `llegó hace más de ${sec.antiguedad_max_horas} h` });
        await supabase.from('nutricion_inscripciones')
          .update({ estado: 'completada', proximo_envio_at: null, updated_at: ahoraISO() }).eq('id', insc.id);
        continue;
      }

      // Los dos pasos de APERTURA de la secuencia post-agenda son mutuamente
      // excluyentes: uno se presenta (nunca le hablamos) y el otro retoma la
      // conversación (ya recibió la bienvenida). Sale exactamente uno; el otro
      // se saltea y la inscripción sigue de largo — a diferencia de
      // `requiere:'respondio'`, acá NO hay nada que esperar: la condición ya
      // está decidida y no va a cambiar.
      if (paso.requiere === 'ya_contactado' || paso.requiere === 'primer_contacto') {
        const yaLeHablamos = yaContactados.has(insc.lead_id);
        const corresponde = paso.requiere === 'ya_contactado' ? yaLeHablamos : !yaLeHablamos;
        if (!corresponde) {
          const siguiente = insc.paso_actual + 1;
          await supabase.from('nutricion_inscripciones').update(
            siguiente < sec.pasos.length
              ? { paso_actual: siguiente, proximo_envio_at: proximoEnvioDePaso(sec.pasos[siguiente], lead), updated_at: ahoraISO() }
              : { estado: 'completada', proximo_envio_at: null, updated_at: ahoraISO() },
          ).eq('id', insc.id);
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: paso.requiere === 'ya_contactado' ? 'es primer contacto' : 'ya le habíamos escrito' });
          continue;
        }
      }

      // Paso condicional que espera una respuesta que todavía no llegó: se
      // saltea (la inscripción sigue activa; si el lead contesta, el destrabe de
      // pausarPorRespuesta lo trae de vuelta).
      if (paso.requiere === 'respondio') {
        const siguienteLibre = sec.pasos.findIndex((p, i) => i > insc.paso_actual && p.requiere !== 'respondio');
        await supabase.from('nutricion_inscripciones').update(
          siguienteLibre >= 0
            ? { paso_actual: siguienteLibre, proximo_envio_at: proximoEnvioDePaso(sec.pasos[siguienteLibre], lead), updated_at: ahoraISO() }
            : { estado: 'completada', proximo_envio_at: null, updated_at: ahoraISO() },
        ).eq('id', insc.id);
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'espera que el lead responda' });
        continue;
      }

      // Copy que sigue con texto de relleno del seed → NUNCA sale automático:
      // espera (reintento 24h) a que MaKo lo escriba y alguien lo apruebe.
      if (!opts?.simularApagados && pasoConRelleno(paso)) {
        res.esperando += 1;
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'copy con [relleno] — escríbelo con MaKo' });
        await supabase.from('nutricion_inscripciones')
          .update({ proximo_envio_at: enHorasISO(24), updated_at: ahoraISO() }).eq('id', insc.id);
        continue;
      }

      // ¿El canal de este paso está apagado para el workspace? Si a la secuencia
      // le queda algún paso posterior por un canal PRENDIDO, este paso se marca
      // 'omitido' y la cadencia sigue (el cliente eligió no usar este canal). Si
      // no queda nada enviable, el paso ESPERA (reintento 24h): prender el canal
      // después retoma desde acá, sin quemar la cadencia (tarea #5).
      const canalOn = (p: PasoSecuencia) => (p.canal === 'whatsapp' ? waOn : emailOn);
      const canalApagado = !opts?.simularApagados && !canalOn(paso);
      if (canalApagado && !sec.pasos.slice(insc.paso_actual + 1).some(canalOn)) {
        res.esperando += 1;
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: `canal ${paso.canal} apagado` });
        await supabase.from('nutricion_inscripciones')
          .update({ proximo_envio_at: enHorasISO(24), updated_at: ahoraISO() }).eq('id', insc.id);
        continue;
      }

      if (!canalApagado && conEnvioReciente.has(insc.lead_id)) {
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'msg <20h' });
        continue; // no avanzar; se reintenta en otra corrida
      }

      let estado: 'enviado' | 'simulado' | 'omitido' | 'borrador' | 'fallo' = 'simulado';
      let nota: string | undefined;
      let proveedorId: string | null = null;
      // terminal = la condición no se resuelve reintentando (opt-out, sin email):
      // se cierra la inscripción en vez de dejarla reintentando para siempre.
      let terminal = false;
      // Horas hasta el próximo intento de un fallo NO terminal. Sin backoff, una
      // inscripción fallada conserva el proximo_envio_at MÁS viejo y monopoliza
      // la cabeza del ORDER BY para siempre (starvation + una fila de fallo por
      // corrida). 4h para fallos transitorios; 24h para los casi-permanentes.
      let backoffHoras = 4;

      if (canalApagado) {
        // Queda un paso posterior enviable → este se omite y la cadencia sigue.
        estado = 'omitido';
        nota = `canal ${paso.canal} apagado`;
      } else if (waOn && paso.canal === 'whatsapp' && paso.proveedor === 'no_oficial') {
        // Canal EMPRESA (no oficial, Evolution). Regla dura del PDF: a leads
        // CALIENTES nunca automático directo → borrador para el setter; a CLIENTES
        // (ya pagaron, riesgo bajo) → envío automático con anti-ban.
        // Se sortea entre las variantes que MaKo escribió al armar la secuencia.
        // Mandar el MISMO texto palabra por palabra a cientos de personas es el
        // patrón que WhatsApp detecta para restringir un número — y además se
        // lee como un bot. Sortear no cuesta nada; redactar por lead costaría
        // una llamada de IA por mensaje.
        const cuerpoNO = aplicarVariables(textoDelPaso(paso), valoresVariablesLead(lead ?? {}));
        // Paso de NOTA DE VOZ (reunión 31/07): el binario sale de la biblioteca
        // del workspace. Si el audio no está o no se puede bajar, NO degradamos
        // a texto en silencio (mandaría un mensaje que nadie escribió): falla y
        // se reintenta al día siguiente.
        const esAudio = paso.tipo === 'audio' && Number(paso.audio_id) > 0;
        if (!lead?.telefono) {
          estado = 'fallo'; nota = 'lead sin teléfono'; backoffHoras = 24;
        } else if (!evoConectado) {
          estado = 'fallo'; nota = canalEvo.motivo ?? 'WhatsApp de empresa no conectado'; backoffHoras = 24;
        } else if (await estaBloqueado(lead.telefono)) {
          estado = 'omitido'; nota = 'contacto bloqueado'; // no le mandamos por el no oficial
        } else if (esAudio) {
          const audio = await getAudio(Number(paso.audio_id));
          const b64 = audio ? await audioBase64(audio) : null;
          if (!audio || !b64) {
            estado = 'fallo';
            nota = audio ? 'no pude bajar el audio del paso' : 'el audio del paso ya no existe';
            backoffHoras = 24;
          } else if (sec.envio_automatico || await esLeadCliente(lead.id)) {
            // ⚠️ SIN `envio_automatico` A UN LEAD QUE NO PAGÓ NO LE SALÍA NADA SOLO:
            // la rama de abajo le deja un borrador. La post-agenda de ws1 se prendió
            // el 8/09 y, con la línea conectada, habría dejado borradores que nadie
            // mira — 0 de sus 4 inscriptos tenían pago. La excepción la prende
            // quien decide que ESA secuencia sale sola (decisión del 17/09/2026).
            const r = await enviarAudioYEspejar({ telefono: lead.telefono, base64: b64, mimetype: audio.media_mime, leadId: lead.id });
            estado = r.ok ? 'enviado' : 'fallo';
            if (!r.ok) nota = r.error;
            // PIE DEL AUDIO: el `cuerpo` de un paso de audio se descartaba, así
            // que un audio que dice "te dejo el link abajo" prometía algo que
            // nunca llegaba. Sale como segundo mensaje inmediato, en el mismo
            // toque — no como paso aparte, que el guard anti-ban de 20h frenaría.
            if (r.ok && cuerpoNO.trim()) {
              await enviarYEspejar({ telefono: lead.telefono, texto: cuerpoNO, leadId: lead.id })
                .catch(() => { /* el audio ya salió: el pie es un extra, no puede tumbar el envío */ });
            }
          } else if (await tieneBorradorNutriPendiente(lead.id)) {
            res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'borrador pendiente' });
            await supabase.from('nutricion_inscripciones')
              .update({ proximo_envio_at: enHorasISO(6), updated_at: ahoraISO() }).eq('id', insc.id);
            continue;
          } else {
            // Lead caliente → el audio también pasa por el setter: queda como
            // borrador con la transcripción para que sepa qué se manda.
            await crearBorrador({
              leadId: lead.id, telefono: lead.telefono,
              texto: `🎙 Nota de voz: «${audio.titulo}»${audio.transcript ? `\n\n${audio.transcript}` : ''}`,
              origen: 'nutricion', secuenciaId: insc.secuencia_id, paso: insc.paso_actual + 1, inscripcionId: insc.id,
            });
            estado = 'borrador';
          }
        } else if (sec.envio_automatico || await esLeadCliente(lead.id)) {
          // Misma excepción que la rama del audio, de arriba.
          const r = await enviarYEspejar({ telefono: lead.telefono, texto: cuerpoNO, leadId: lead.id });
          estado = r.ok ? 'enviado' : 'fallo';
          if (!r.ok) nota = r.error;
        } else if (await tieneBorradorNutriPendiente(lead.id)) {
          // Ya hay un borrador de nutrición pendiente para este lead → NO apilamos
          // otro y NO avanzamos: la cadencia espera a que el setter lo mande o
          // descarte. Reintentamos en 6h (no en cada corrida).
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'borrador pendiente' });
          await supabase.from('nutricion_inscripciones')
            .update({ proximo_envio_at: enHorasISO(6), updated_at: ahoraISO() }).eq('id', insc.id);
          continue;
        } else {
          // Lead caliente → BORRADOR (el setter lo manda con 1 clic).
          await crearBorrador({ leadId: lead.id, telefono: lead.telefono, texto: cuerpoNO, origen: 'nutricion', secuenciaId: insc.secuencia_id, paso: insc.paso_actual + 1, inscripcionId: insc.id });
          estado = 'borrador';
        }
      } else if (waOn && paso.canal === 'whatsapp') {
        if (!lead?.telefono) {
          estado = 'fallo';
          nota = 'lead sin teléfono';
          backoffHoras = 24; // casi-permanente: 1 reintento/día por si le cargan el teléfono
        } else if (!paso.template_wa) {
          estado = 'fallo';
          nota = 'paso sin template_wa';
          backoffHoras = 24; // error de config: 1 reintento/día hasta que lo arreglen
        } else {
          // Guard de aprobación: si la plantilla es NUESTRA (borrador de la app)
          // pero Meta aún no la aprobó (pending) o la rechazó, NO la mandamos.
          // Si la mandáramos, Chatwoot acepta el POST y Meta la rechaza async →
          // quedaría contada como 'enviado' sin llegar nunca. Plantillas legacy
          // sin borrador en la app (estadoDraftPorNombre=null) NO se bloquean.
          // FALLA CERRADO: si no podemos verificar el estado (error de DB), NO
          // enviamos (backoff corto) en vez de arriesgar el phantom-send.
          let bloqueo: { nota: string; horas: number } | null = null;
          try {
            const stTpl = await estadoDraftPorNombre(paso.template_wa, paso.template_idioma ?? 'es_MX');
            if (stTpl && stTpl !== 'approved') {
              bloqueo = stTpl === 'rejected'
                ? { nota: 'plantilla rechazada por Meta', horas: 24 }               // permanente hasta re-editar
                : { nota: 'plantilla aún no aprobada por Meta', horas: 1 };          // Meta aprueba en minutos → recheck en 1h
            }
          } catch {
            bloqueo = { nota: 'no pude verificar el estado de la plantilla', horas: 1 }; // fail-closed transitorio
          }
          if (bloqueo) {
            estado = 'fallo';
            nota = bloqueo.nota;
            backoffHoras = bloqueo.horas;
          } else {
            const r = await sendWhatsappTemplate({
              phone: lead.telefono,
              name: lead.nombre ?? '',
              content: paso.cuerpo,
              template: {
                name: paso.template_wa,
                category: paso.template_categoria ?? 'marketing',
                language: paso.template_idioma ?? 'es_MX',
                // Rellena TODAS las variables del catálogo (nombre, apellido, empresa…);
                // la plantilla usa las que necesite.
                bodyParams: valoresVariablesLead(lead),
              },
            });
            estado = r.ok ? 'enviado' : 'fallo';
            if (!r.ok) nota = r.error;
          }
        }
      } else if (emailOn && paso.canal === 'email') {
        if (lead?.email_opt_out) {
          estado = 'fallo'; terminal = true;
          nota = 'lead dado de baja del email';
        } else if (!lead?.email) {
          estado = 'fallo'; terminal = true;
          nota = 'lead sin email';
        } else if (sandbox) {
          // Remitente sandbox (resend.dev) NO entrega a terceros: abortamos con un
          // error claro en vez de quemar el paso. Se resuelve al verificar dominio.
          estado = 'fallo';
          nota = 'remitente sandbox: verifica tu dominio de envío';
          backoffHoras = 24; // config pendiente: 1 reintento/día
        } else {
          const vars = valoresVariablesLead(lead);
          const cuerpo = aplicarVariables(paso.cuerpo, vars);
          const asunto = aplicarVariables(paso.asunto ?? '', vars) || '(sin asunto)';
          const unsubUrl = buildUnsubscribeUrl(insc.lead_id);
          const r = await sendEmail({
            to: lead.email,
            subject: asunto,
            html: renderEmailHtml({
              subject: asunto,
              bodyText: cuerpo,
              preheader: aplicarVariables(paso.preheader ?? '', vars) || undefined,
              unsubscribeUrl: unsubUrl,
              fromName: fromNameWs,
            }),
            text: cuerpo,
            headers: unsubUrl ? { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined,
            tags: [{ name: 'tipo', value: 'nutricion' }, { name: 'secuencia_id', value: String(insc.secuencia_id) }],
          });
          estado = r.ok ? 'enviado' : 'fallo';
          if (r.ok) proveedorId = r.id; else nota = r.error;
        }
      }
      // (con simularApagados, un paso de canal apagado cae acá como 'simulado')

      await supabase.from('nutricion_envios').insert({
        inscripcion_id: insc.id,
        lead_id: insc.lead_id,
        secuencia_id: insc.secuencia_id,
        paso: insc.paso_actual + 1,
        canal: paso.canal,
        estado,
        destino: paso.canal === 'whatsapp' ? lead?.telefono ?? null : lead?.email ?? null,
        asunto: paso.asunto,
        proveedor_id: proveedorId,
        // EL MOTIVO SE CALCULABA Y SE TIRABA. Cada rama de arriba llena `nota`
        // («WhatsApp de empresa no conectado», «el audio del paso ya no existe»,
        // el error del proveedor) y ninguna llegaba a la fila: la columna
        // quedaba en null y desde afuera un fallo no se distinguía de otro.
        // Medido el 08/09/2026 en el ws1, con la secuencia recién prendida: el
        // PRIMER envío real a un lead de verdad falló, y reconstruir por qué
        // costó cinco consultas y un chequeo cruzado entre workspaces — cuando
        // la causa («el número está desconectado desde el 3/09») estaba escrita
        // en una variable a diez líneas del insert.
        error: nota ?? null,
      });

      if (estado === 'fallo') {
        res.fallos += 1;
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado, nota });
        if (terminal) {
          // Condición permanente (opt-out / sin email): cerramos la inscripción para
          // que no se reintente eternamente y no acumule filas 'fallo' por corrida.
          await supabase
            .from('nutricion_inscripciones')
            .update({ estado: 'cancelada', proximo_envio_at: null, updated_at: ahoraISO() })
            .eq('id', insc.id);
        } else {
          // Backoff: corre el próximo intento para que la fila no bloquee la
          // cola ni genere una fila de 'fallo' por corrida.
          await supabase
            .from('nutricion_inscripciones')
            .update({ proximo_envio_at: enHorasISO(backoffHoras), updated_at: ahoraISO() })
            .eq('id', insc.id);
        }
        continue;
      }

      const siguiente = sec.pasos[insc.paso_actual + 1];
      await supabase
        .from('nutricion_inscripciones')
        .update({
          paso_actual: insc.paso_actual + 1,
          proximo_envio_at: siguiente ? proximoEnvioDePaso(siguiente, lead) : null,
          estado: siguiente ? 'activa' : 'completada',
          // El reloj del fallo por silencio se cuenta desde el ÚLTIMO mensaje,
          // no desde que el lead se inscribió: una secuencia con pasos a los 30
          // días se daría por fallida antes de terminar de mandarlos.
          ultimo_paso_at: ahoraISO(),
          updated_at: ahoraISO(),
        })
        .eq('id', insc.id);

      if (estado === 'enviado') res.enviados += 1;
      else if (estado === 'omitido') res.omitidos += 1;
      else if (estado === 'borrador') res.borradores += 1;
      else res.simulados += 1;
      res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado, ...(nota ? { nota } : {}) });
    }

    if (fetched.length < LOTE) break; // cola drenada: no quedan más vencidas
  }

  return res;
}

// Pausa la nutrición de un lead cuando responde (webhook de Chatwoot y espejo
// del no oficial). Marca las inscripciones activas como 'respondio'.
//
// MODO ASISTIDO (reunión 31/07): si la secuencia de mensajes que venía corriendo está en modo
// 'asistido', además de pausar se avisa al dueño y MaKo deja un BORRADOR con la
// respuesta sugerida para aprobar con un clic. Es la fase 1 acordada: se
// automatizan los primeros audios y la conversación la sigue un humano.
export async function pausarPorRespuesta(leadId: number, opts?: { texto?: string }): Promise<number> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('nutricion_inscripciones')
    .update({ estado: 'respondio', proximo_envio_at: null, updated_at: ahoraISO() })
    .eq('lead_id', leadId)
    .eq('estado', 'activa')
    .select('id, secuencia_id');
  if (error) throw new Error(`pausarPorRespuesta: ${error.message}`);
  const pausadas = (data ?? []) as Array<{ id: number; secuencia_id: number }>;

  // PASOS CONDICIONALES (reunión 31/07): un paso con requiere='respondio' está
  // esperando justamente esto — el caso del lead magnet ("¿lo querés? es gratis"
  // y recién si contesta se manda). La respuesta lo DESTRABA: la inscripción
  // vuelve a 'activa' apuntando a ese paso, en vez de quedar pausada para
  // siempre. Los demás pasos condicionales se saltean al llegar el turno.
  if (pausadas.length) {
    try {
      const secs = await getSecuenciasActivas();
      const { data: detalle } = await supabase
        .from('nutricion_inscripciones')
        .select('id, secuencia_id, paso_actual')
        .in('id', pausadas.map((p) => p.id));
      for (const insc of (detalle ?? []) as Array<{ id: number; secuencia_id: number; paso_actual: number }>) {
        const sec = secs.find((s) => s.id === insc.secuencia_id);
        if (!sec) continue;
        const idx = sec.pasos.findIndex((p, i) => i >= insc.paso_actual && p.requiere === 'respondio');
        if (idx < 0) continue;
        await supabase.from('nutricion_inscripciones').update({
          estado: 'activa',
          paso_actual: idx,
          proximo_envio_at: proximoEnvioDePaso(sec.pasos[idx], null),
          updated_at: ahoraISO(),
        }).eq('id', insc.id);
      }
    } catch (e) { console.error('[nutricion] destrabe de pasos condicionales falló:', e); }
  }

  if (pausadas.length) {
    // Best-effort y en segundo plano conceptual: que un fallo del asistido NUNCA
    // rompa el webhook (el lead ya quedó despausado, que es lo crítico).
    try { await asistirRespuesta(leadId, pausadas.map((p) => p.secuencia_id), opts?.texto); }
    catch (e) { console.error(`[nutricion] modo asistido lead ${leadId} falló:`, e); }
  }
  return pausadas.length;
}

/**
 * Modo asistido: avisa al dueño que el lead respondió y le deja el borrador de
 * respuesta que redactó MaKo con la secuencia de mensajes (mismo cerebro del simulador).
 * Silencioso si ninguna de las secuencias pausadas es 'asistido'.
 */
async function asistirRespuesta(leadId: number, secuenciaIds: number[], texto?: string): Promise<void> {
  const { parseEstrategia } = await import('@/lib/setting-estrategia');
  const secs = await getSecuenciasConStats();
  // La secuencia de mensajes asistida más específica que venía corriendo para este lead.
  const secuencia = secs.find((s) => secuenciaIds.includes(s.id) && parseEstrategia(s.estrategia)?.modo === 'asistido');
  if (!secuencia) return;

  const supabase = await getTenantDb();
  const { data: leadRow } = await supabase.from('leads').select('id, nombre, telefono').eq('id', leadId).maybeSingle();
  const lead = leadRow as { id: number; nombre: string | null; telefono: string | null } | null;

  // 0) HAND-OFF, y va PRIMERO: antes de redactar nada hay que saber si esto es
  //    un caso que la secuencia sabe manejar. Si el lead planteó algo que no
  //    está previsto, MaKo NO contesta — ni siquiera un borrador, porque un
  //    borrador plausible es justo lo que alguien aprueba sin leer.
  const estrategia = parseEstrategia(secuencia.estrategia);
  const { clasificarEscenario, registrarHandoff } = await import('@/lib/chat-agent-handoff');
  const clas = await clasificarEscenario(texto ?? '', estrategia?.escenarios ?? []);
  if (!clas.encaja) {
    // La inscripción queda en 'handoff': ni activa (no puede seguir mandando
    // pasos encima de una conversación que no entiende) ni cerrada (ver el
    // comentario del UNIQUE en lib/chat-agent-handoff.ts).
    await supabase.from('nutricion_inscripciones')
      .update({ estado: 'handoff', proximo_envio_at: null, updated_at: ahoraISO() })
      .eq('lead_id', leadId).eq('secuencia_id', secuencia.id);
    await registrarHandoff({
      leadId, secuenciaId: secuencia.id,
      mensaje: texto?.trim() || '(el lead respondió sin texto)',
      motivo: clas.motivo,
      leadNombre: lead?.nombre, secuenciaNombre: secuencia.nombre,
    });
    return;
  }

  // 1) MaKo redacta la respuesta (import dinámico: setting-simulador importa
  //    este módulo, un import estático cerraría el ciclo).
  let sugerida: string | null = null;
  try {
    const { responderSimulador } = await import('@/lib/setting-simulador');
    const r = await responderSimulador(secuencia.id, [{ de: 'lead', texto: texto?.trim() || '(el lead respondió sin texto)' }]);
    if (r.ok) sugerida = r.respuesta;
  } catch { /* sin sugerencia: igual avisamos */ }

  // 2) Borrador para aprobar con un clic (misma bandeja que el resto).
  if (sugerida && lead?.telefono) {
    const { crearBorrador } = await import('@/lib/evolution-envio');
    await crearBorrador({
      leadId, telefono: lead.telefono, texto: sugerida,
      origen: 'setter-asistido', secuenciaId: secuencia.id, paso: null, inscripcionId: null,
    });
  }

  // 3) ¿Califica? (reunión 31/07: ninguna llamada con no calificados). Si hay
  //    evidencia de descalificación, se marca el lead y se AVISA para cancelar
  //    la reunión — cancelarla sola sería una acción externa irreversible.
  let alertaDescalifica = '';
  try {
    const { evaluarCalificacion } = await import('@/lib/setting-simulador');
    const ev = await evaluarCalificacion(secuencia.id, [{ de: 'lead', texto: texto?.trim() || '' }]);
    if (ev.califica === false) {
      await supabase.from('leads').update({ calificado: false, updated_at: ahoraISO() }).eq('id', leadId);
      const { logLeadEvent } = await import('@/lib/leads');
      await logLeadEvent(leadId, 'Setting', `MaKo lo marcó NO calificado por la charla: ${ev.razon}`, 'MaKo');
      alertaDescalifica = `\n\n⚠️ *No califica* (${ev.razon}). Lo marqué en el CRM. Si tiene reunión agendada, conviene cancelarla — te dejo la decisión a ti.`;
    }
  } catch { /* la calificación es un extra: nunca bloquea el aviso */ }

  // 4) Aviso al dueño — el único que pidió Mauricio: "avisame si responden".
  //
  // El `ws` va EXPLÍCITO. Sin él, emitirAviso cae a OWNER_WS: el lead de un
  // cliente respondía y el aviso le llegaba al grupo de la AGENCIA en vez de al
  // del cliente — que además no se entera de que le contestaron.
  const { emitirDelCatalogo } = await import('@/lib/avisos');
  const quien = lead?.nombre?.trim() || `lead ${leadId}`;
  await emitirDelCatalogo('wa-mensaje-entrante', {
    ws: (await getWorkspaceActual()) ?? undefined,
    texto: `💬 *${quien} respondió* a la secuencia de mensajes «${secuencia.nombre}».${texto?.trim() ? `\n\n_"${texto.trim().slice(0, 180)}"_` : ''}${sugerida ? `\n\nTe dejé un borrador listo para aprobar:\n${sugerida.slice(0, 300)}` : ''}${alertaDescalifica}\n\n— MaKo`,
  });
}
