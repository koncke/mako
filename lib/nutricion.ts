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
import { getTenantDb, getWorkspace, getWorkspaceActual } from '@/lib/workspace';
import { leerTodo, leerPorPaginas, type ConsultaPaginada } from '@/lib/supabase-paginado';
import { idsConAlMenosUnaFila, enTandas } from '@/lib/ids-con-filas';
import { getVslEngagementMap } from '@/lib/leads';
import { pipelineStageOf } from '@/lib/pipeline';
import { sendWhatsappTemplate } from '@/lib/chatwoot';
import { valoresVariablesLead, aplicarVariables } from '@/lib/template-vars';
import { sendEmail, renderEmailHtml, buildUnsubscribeUrl, remitenteEsSandbox, getEmailFrom, displayNameDe } from '@/lib/resend';
import { envioEmailHabilitado, envioWhatsappHabilitado } from '@/lib/envio-flags';
import { listarLineas, sondearSocket, type LineaRow } from '@/lib/evolution';
import { lineaPorDefault, elegirLinea } from '@/lib/lineas-whatsapp';
import { canalNoOficial, proveedorDelPaso, textoDelPaso, type CanalNoOficial } from '@/lib/nutricion-canal';
// Sólo el TIPO: el valor se importa dinámico adentro del motor (ciclo vía nutricion-generator).
import type { AutorTexto } from '@/lib/paso-ia';
import { parseEstrategia, dentroDeAntiguedad } from '@/lib/setting-estrategia';
import { conversacionAbierta, atiendeAlResponder, type InscCharla } from '@/lib/setter-conversacion';
import { ambitoDeSecuencia, filtroDeAmbito, type AmbitoFunnel } from '@/lib/nutricion-ambito';
import { secuenciasDeEtapa, secuenciasDeEntrega, TRIGGER_ETAPA, TRIGGER_ENTREGA } from '@/lib/nutricion-etapa';
import { TRIGGER_RESIDUO, RESIDUO_POR_CORRIDA } from '@/lib/nutricion-residuo';
import { cohorteResiduo, residuoVigente, horariosResiduo } from '@/lib/nutricion-residuo-cohorte';
import { sanearCron, type CronAviso } from '@/lib/cron-aviso';
import { decidirAgenda } from '@/lib/nutricion-agenda';
import { tzActual, TZ_DEFAULT } from '@/lib/timezone';
import { esLeadCliente, enviarYEspejar, enviarAudioYEspejar, crearBorrador, tieneBorradorNutriPendiente } from '@/lib/evolution-envio';
import { getAudio, audioBase64 } from '@/lib/setting-audios';
import { estaBloqueado } from '@/lib/evolution-block';
import { estadoDraftPorNombre } from '@/lib/meta-templates';
import {
  TZ_OFFSET_MX, reunionFuturaMs, reunionQuePreparaMs, inscripcionReusable, marcasPorInscripcion, reactivarInscripcion,
  ESTADOS_TERMINADOS, SIN_MARCAS, type JuntasLead, type FilaPrevia,
} from '@/lib/nutricion-reinscripcion';
import { decidirInscripcionManual, type PorQueNoSeInscribio } from '@/lib/nutricion-inscripcion-manual';
import { esPasoAccion, sanearAccion, correrPasoAccion, type AccionDelPaso } from '@/lib/nutricion-paso-accion';

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
  //
  // 'ia' (pedido de Martín, 05/10/2026: «haz el interruptor de IA»): el mensaje lo
  // reescribe MaKo para cada lead al mandarlo (lib/paso-ia.ts). El `cuerpo` sigue
  // siendo obligatorio: es la BASE que dice qué hay que lograr y el RESPALDO que sale
  // si el modelo falla. Es un campo del paso y no un nodo nuevo, a propósito — ver
  // AGENTS.md, «Un TIPO DE NODO nuevo son CINCO puertas». Sólo vive en el canal no
  // oficial: una plantilla aprobada por Meta no se puede reescribir.
  tipo?: 'texto' | 'audio' | 'ia';
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
  /**
   * EL PASO «⚡ ACCIÓN DE MAKO» (decisión de Martín, 08/10/2026: «que pueda hacer todo, sin
   * limitaciones»). Con este campo el paso NO manda un mensaje: corre una acción del
   * registro de la API por `ejecutarDesdeFlujo` (lib/api-mako/flujo.ts), con la misma
   * espera y programación que un mensaje. Ausente = mensaje, como siempre. Por qué es un
   * sub-objeto y no un `tipo` más, en lib/nutricion-paso-accion.ts.
   */
  accion?: AccionDelPaso;
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
  /**
   * De qué PRODUCTO es la entrega de la que cuelga (mig 0189, `trigger_tipo =
   * 'entrega_actual'`). `null` = la entrega de cualquier producto.
   *
   * No es `funnel_id` con otro nombre: la entrega de un servicio no tiene embudo, sus
   * etapas viven en `producto_entrega` y el cliente en `cliente_entrega`, las dos
   * keyeadas por producto. Lo decide el trigger, no la presencia del dato.
   */
  producto_id: number | null;
  /**
   * EL HORARIO con el que inscribe (mig 0192). `null` = se dispara por una ACCIÓN,
   * que es lo que hacen hoy las 62 filas de la base. Ver lib/nutricion-agenda.ts.
   */
  cron: CronAviso | null;
  /**
   * Por qué línea de WhatsApp sale (mig 0198, `evolution_instancias.instance_name`). `null` =
   * la de por default, que es lo que dicen todas las filas de antes del 06/10/2026. Lo
   * resuelve `elegirLinea` (lib/lineas-whatsapp.ts): una línea que no es del negocio no
   * manda nada.
   */
  instance_name: string | null;
  /** La próxima ocurrencia AGENDADA (mig 0192). El ancla, no «cuándo salió». */
  cron_proxima_at: string | null;
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
// La ventana horaria se evalúa en hora de México: `TZ_OFFSET_MX` vive en
// lib/nutricion-reinscripcion.ts, junto con la hora por defecto de una reunión sin hora.
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
    .select('id, clave, nombre, etapa, trigger_tipo, activa, pasos, estrategia, funnel_id, producto_id, cron, cron_proxima_at, instance_name')
    .eq('activa', true)
    // Archivada nunca enrola ni envía, aunque haya quedado con activa=true.
    .is('archivada_at', null);
  if (error) throw new Error(`getSecuenciasActivas: ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: number; clave: string; nombre: string; etapa: string;
    trigger_tipo: string; activa: boolean; pasos: unknown; estrategia: unknown; producto_id: number | null;
    funnel_id: number | null; cron: unknown; cron_proxima_at: string | null; instance_name: string | null;
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
    producto_id: r.producto_id == null ? null : Number(r.producto_id),
    // Por el MISMO saneador que la pantalla, como `envio_automatico`: la regla de
    // qué es un horario válido vive en un lugar (lib/cron-aviso.ts).
    cron: sanearCron(r.cron),
    cron_proxima_at: r.cron_proxima_at ?? null,
    instance_name: r.instance_name || null,
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
    .select('id, clave, nombre, etapa, trigger_tipo, activa, pasos, estrategia, funnel_id, producto_id, cron, cron_proxima_at, instance_name')
    // Las archivadas no se listan, no enrolan y no envían. No se borran porque
    // las inscripciones y los envíos las referencian: borrarlas se llevaría
    // puesto el historial de a quién se le escribió.
    .is('archivada_at', null)
    .order('id', { ascending: true });
  if (error) throw new Error(`getSecuenciasConStats: ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: number; clave: string; nombre: string; etapa: string;
    trigger_tipo: string; activa: boolean; pasos: unknown; estrategia: unknown; producto_id: number | null;
    funnel_id: number | null; cron: unknown; cron_proxima_at: string | null; instance_name: string | null;
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
    producto_id: r.producto_id == null ? null : Number(r.producto_id),
    // Por el MISMO saneador que la pantalla, como `envio_automatico`: la regla de
    // qué es un horario válido vive en un lugar (lib/cron-aviso.ts).
    cron: sanearCron(r.cron),
    cron_proxima_at: r.cron_proxima_at ?? null,
    instance_name: r.instance_name || null,
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
 * De qué línea de WhatsApp sale una secuencia (pedido de Martín, 06/10/2026: «dentro del
 * chatbot una opción para seleccionar de qué número sale esa automatización»). `null` = la
 * de por default.
 *
 * ⚠️ SE VALIDA AL GUARDAR Y SE VUELVE A VALIDAR AL MANDAR. Acá, para que una línea ajena no
 * llegue nunca a la fila (el valor viene del navegador); en el envío, porque entre los dos
 * momentos la línea puede haberse desvinculado. Las dos con `elegirLinea`.
 */
export async function setSecuenciaLinea(id: number, linea: string | null): Promise<void> {
  const supabase = (await getTenantDb());
  let valor: string | null = null;
  if (linea) {
    const ws = await getWorkspaceActual();
    if (ws == null) throw new Error('setSecuenciaLinea: sin workspace');
    const e = elegirLinea(await listarLineas(), linea, ws);
    if (!e.ok) throw new Error(e.motivo);
    valor = e.instance;
  }
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({ instance_name: valor, updated_at: ahoraISO() })
    .eq('id', id);
  if (error) throw new Error(`setSecuenciaLinea: ${error.message}`);
}

// `textoDelPaso` (qué texto sale en este envío, y el sorteo entre variantes) se mudó
// a lib/nutricion-canal.ts: es una decisión pura y acá, con `server-only` por
// `getTenantDb`, ningún test la podía ejecutar. Un paso de AUDIO no sortea: su
// cuerpo es el pie, y sus variantes son las del texto que había antes (#748).
export { textoDelPaso };

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

  // ⚠️ EL PASO «⚡ ACCIÓN» SE VALIDA ANTES DE ESCRIBIR NADA, y una acción inválida frena el
  // guardado ENTERO con un error que la pantalla muestra. Esta función reconstruye cada
  // paso campo por campo y borra lo que no conoce (AGENTS.md: la quinta puerta de un tipo
  // de nodo nuevo), así que `accion` tiene que pasar por acá o se pierde en el primer
  // guardado. Y no se descarta en silencio: un paso de acción sin elegir, o con una
  // operación que el registro no tiene, guardado como mensaje vacío sería un WhatsApp en
  // blanco al lead; guardado tal cual, un 'fallo' por corrida en un log que nadie lee.
  // El filtro es el MISMO de abajo, para que `acciones[i]` sea el paso `i` del `.map`.
  const esPaso = (p: PasoSecuencia): boolean => !!p && typeof p === 'object';
  const acciones = pasos.filter(esPaso).map((p) => sanearAccion((p as { accion?: unknown }).accion));
  const malas = acciones.flatMap((a, i) => (a && !a.ok ? [`el paso ${i + 1} ${a.motivo}`] : []));
  if (malas.length) throw new Error(`No se guardó: ${malas.join('; ')}.`);
  const operaciones = [...new Set(acciones.flatMap((a) => (a?.ok ? [a.accion.operacion] : [])))];
  if (operaciones.length) {
    // Import dinámico: el registro son ~500 definiciones y sólo hace falta si hay acciones.
    const [{ porId }, { esAccion }] = await Promise.all([import('@/lib/api-mako/registro'), import('@/lib/api-mako/tipos')]);
    const ajenas = operaciones.filter((op) => { const d = porId(op); return !d || !esAccion(d); });
    if (ajenas.length) throw new Error(`No se guardó: ${ajenas.map((op) => `«${op}»`).join(', ')} no es una acción de MaKo.`);
  }

  // Normaliza el orden (1..n) y descarta basura.
  const limpio = pasos
    .filter(esPaso)
    .map((p, i): PasoSecuencia => {
      const comun = {
        orden: i + 1,
        // Un paso de audio es de WhatsApp por definición (no hay nota de voz por email).
        canal: (p.canal === 'email' && p.tipo !== 'audio' ? 'email' : 'whatsapp') as CanalNutricion,
        delay_horas: Math.max(0, Math.round(Number(p.delay_horas) || 0)),
        ...(p.ancla === 'reunion' ? { ancla: 'reunion' as const } : {}),
        ...(p.requiere === 'respondio' || p.requiere === 'sin_respuesta' || p.requiere === 'ya_contactado' || p.requiere === 'primer_contacto'
          ? { requiere: p.requiere as PasoSecuencia['requiere'] }
          : {}),
      };
      // Un paso de ACCIÓN no lleva nada de un mensaje: ni tipo, ni audio, ni variantes, ni
      // cuerpo. Las variantes, sobre todo: el merge es por `orden`, y una acción insertada
      // en el lugar de un mensaje heredaría las suyas.
      const a = acciones[i];
      if (a?.ok) return { ...comun, asunto: null, preheader: null, cuerpo: '', template_wa: null, accion: a.accion };
      return {
        ...comun,
        // Paso de nota de voz: exige audio de la biblioteca (si no, degrada a texto).
        // Paso en modo IA: sólo por WhatsApp no oficial. Por la vía oficial sale una
        // plantilla que aprobó Meta, y reescribirla es mandar algo que nadie aprobó; por
        // email no hay ruta en el motor. En esos casos se guarda como texto, que es lo
        // que el motor iba a hacer igual — sin un `tipo` que prometa otra cosa.
        ...(p.tipo === 'audio' && Number(p.audio_id)
          ? { tipo: 'audio' as const, audio_id: Number(p.audio_id) }
          : p.tipo === 'ia' && p.canal !== 'email' && proveedorDelPaso(p) === 'no_oficial'
            ? { tipo: 'ia' as const }
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
      };
    });
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
  productoId?: number | null,
): Promise<number[]> {
  /**
   * La ENTREGA no pasa por el ámbito de embudo ni por las columnas del funnel: su
   * estado es un HECHO DECLARADO que vive en `cliente_entrega` (mig 0188), una fila por
   * (cliente, producto), y se pregunta directo.
   *
   * ⚠️ ESTO ES LA RED DEL EVENTO, NO SU REEMPLAZO. El movimiento real lo dispara
   * `moverClienteDeEtapa` en el acto; esto existe para dos casos que el evento no puede
   * cubrir: (a) el enrolamiento instantáneo es best-effort —si falla, sin esto el
   * cliente se queda sin la secuencia PARA SIEMPRE y en silencio— y (b) una secuencia
   * que se crea HOY tiene que alcanzar a los clientes que YA están parados en esa
   * etapa, que es exactamente lo que hace `etapa_actual` del lado de la venta.
   *
   * ⚠️ Y LA COHORTE ES LA DEL KANBAN, NO LA DE LAS FILAS. Un cliente sin fila está en la
   * PRIMERA etapa (`repartirEnEtapas`): hasta el 06/10/2026 esto leía sólo `cliente_entrega`
   * con esa etapa, así que a 13 de los 14 clientes del ws1 —los que nadie movió— no les
   * llegaba nunca una secuencia de la primera etapa: sin movimiento no hay evento, y sin
   * fila no estaban en la cohorte. La regla vive en UN lugar
   * (`clientesEnEtapa`, app/customer-success/pertenencia.ts) y se le pasa el UNIVERSO de
   * clientes, no las filas.
   *
   * Import diferido: app/customer-success/entrega.ts importa este módulo
   * (`secuenciasPorEtapaDeEntrega`), y un import de arriba sería un ciclo. Es el mismo
   * molde que `productosDelAlumno` (lib/curso-datos.ts).
   *
   * Y TIRA si no puede leer: un universo a medias le escribe a quien no corresponde.
   */
  if (triggerTipo === TRIGGER_ENTREGA) {
    const key = (etapa ?? '').trim();
    if (!key) return [];
    try {
      const { clientesEnEtapaDeEntrega } = await import('@/app/customer-success/entrega');
      // NULL = la entrega de cualquier producto (igual que `funnel_id` NULL). Un bigint puede
      // llegar como texto: se pasa a número. Y uno que no es número no cae a «cualquiera»:
      // eso le mandaría la secuencia a la entrega de todos los servicios.
      const prod = productoId == null ? null : Number(productoId);
      if (prod != null && !Number.isFinite(prod)) return [];
      return await clientesEnEtapaDeEntrega(prod, key);
    } catch (e) {
      throw new Error(`cohorte entrega_actual(${key}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }
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
  // entrar, y ningún envío posterior la puede dar vuelta. (La excepción es la
  // fila que se puede REUSAR porque el lead volvió a agendar: #789, ver
  // `leadsEnFamiliaPostAgenda`.)
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

  if (triggerTipo === TRIGGER_RESIDUO) {
    // El RESIDUO (#790): tuvieron reunión hace más de 45 días —asistieron sin comprar
    // o faltaron a la R1—, abiertos y sin pago. Ningún disparador de arriba los
    // alcanza: todos los de reunión miran 45 días. La decisión es pura y tiene test
    // (lib/nutricion-residuo.ts); el ámbito del embudo entra en la consulta, no
    // después, por el mismo techo de 1000 filas que el paginado vino a cerrar.
    return cohorteResiduo(supabase, (q) => conAmbito(q, ambito));
  }

  // trigger desconocido → sin cohorte (no rompe el cron)
  return [];
}

// ── Agenda de pasos ──────────────────────────────────────────────────────────
// `JuntasLead`, `parseFechaJunta` y `reunionFuturaMs` viven en lib/nutricion-reinscripcion.ts
// (sin `server-only`): el reuso de una inscripción (#789) y el evaluador de desenlaces
// necesitan la MISMA reunión que mira el motor, y una copia es la que se queda vieja.

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
export type PlanInscripcion = {
  secuencia: string; lead_id: number; proximo_envio_at: string;
  /** No es una fila nueva: se REUSA una inscripción que ya terminó (#789). */
  reactiva?: true;
};

/** Una inscripción que ya existe, con lo que decide si se puede reusar (#789). */
type FilaInsc = { id: number; lead_id: number; secuencia_id: number } & FilaPrevia;

/**
 * Las inscripciones de `leadIds` que cumplan `filtro`. En TANDAS de 200 y cada tanda
 * PAGINADA por `id`.
 *
 * Era `.in('lead_id', candidatos)` suelto, con dos formas de fallar en silencio:
 * con más de 1000 inscripciones que matchean, PostgREST cortaba y los que caían
 * afuera se tomaban por NO inscriptos → se reinsertaban, chocaban con el
 * `unique(lead_id, secuencia_id)` y el `throw` cortaba la inscripción ENTERA (de
 * todas las secuencias que venían después). Y desde que `etapa_actual` pagina
 * (17/09), la lista de candidatos puede ser de ~1000 ids: una URL de ese tamaño
 * es la otra forma de romperse.
 *
 * ⚠️ `reunion_at` (mig 0205) SE PIDE SÓLO CUANDO HACE FALTA (`conReunion`): sólo lo lee el
 * reuso de la familia que prepara una reunión. Un `select` con una columna que no existe
 * rechaza la consulta ENTERA, así que pedirla siempre haría que un deploy adelantado a la
 * migración frenara TODA la nutrición, y no sólo la post-agenda.
 */
async function inscripcionesDe(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  leadIds: readonly number[],
  filtro: (q: ConsultaPaginada) => unknown,
  conReunion: boolean,
): Promise<FilaInsc[]> {
  const out: FilaInsc[] = [];
  const cols = `id, lead_id, secuencia_id, estado, desenlace${conReunion ? ', reunion_at' : ''}`;
  for (const tanda of enTandas([...new Set(leadIds)], 200)) {
    const filas = await leerTodo<FilaInsc>(db, 'nutricion_inscripciones', cols, {
      orden: 'id',
      filtros: (q) => filtro(q.in('lead_id', tanda) as ConsultaPaginada) as ConsultaPaginada,
    });
    for (const f of filas) if (f.lead_id != null) out.push({ ...f, reunion_at: f.reunion_at ?? null });
  }
  return out;
}

/** La agenda de cada lead, en tandas y paginada: `ids` puede ser la cohorte entera. */
async function juntasDe(db: Awaited<ReturnType<typeof getTenantDb>>, ids: readonly number[]): Promise<Map<number, JuntasLead>> {
  const out = new Map<number, JuntasLead>();
  for (const tanda of enTandas([...new Set(ids)], 200)) {
    const jl = await leerTodo<{ id: number } & JuntasLead>(db, 'leads', 'id, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at', {
      orden: 'id', filtros: (q) => q.in('id', tanda) as ConsultaPaginada,
    });
    for (const l of jl) out.set(l.id, l);
  }
  return out;
}

/**
 * De estas filas, las que se pueden REUSAR (#789), con la reunión que van a preparar. La
 * regla es `inscripcionReusable` (lib/nutricion-reinscripcion.ts); acá sólo se junta lo que
 * pregunta.
 *
 * `prepara(secuenciaId)` dice qué filas entran a la pregunta: el reuso es sólo de las
 * secuencias que preparan una reunión, y de una secuencia SIN PASOS tampoco — se cerraría en
 * el acto y volvería a reusarse en cada corrida. Y sólo se lee algo para las filas que podrían
 * serlo (las de una corrida terminada): para el resto no hay pregunta y no se gasta una
 * consulta.
 */
async function reusablesDe(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  filas: readonly FilaInsc[],
  prepara: (secuenciaId: number) => boolean,
): Promise<Map<number, { fila: FilaInsc; reunionMs: number; porque: string }>> {
  const out = new Map<number, { fila: FilaInsc; reunionMs: number; porque: string }>();
  const posibles = filas.filter((f) => prepara(f.secuencia_id) && ESTADOS_TERMINADOS.includes(f.estado));
  if (!posibles.length) return out;
  const [marcas, juntas] = await Promise.all([
    marcasPorInscripcion(db, posibles.map((f) => f.id)),
    juntasDe(db, posibles.map((f) => f.lead_id)),
  ]);
  for (const fila of posibles) {
    // La R1, no «la más próxima»: la R2 no es volver a agendar (ver `reunionQuePreparaMs`).
    const reunionMs = reunionQuePreparaMs(juntas.get(fila.lead_id));
    const v = inscripcionReusable({ fila, marcas: marcas.get(fila.id) ?? SIN_MARCAS, reunionNuevaMs: reunionMs });
    if (v.reusable && reunionMs != null) out.set(fila.id, { fila, reunionMs, porque: v.porque });
  }
  return out;
}

/** ¿Esta secuencia puede reusar una inscripción vieja? Prepara una reunión y tiene algo que mandar. */
const reusaInscripciones = (s: Pick<Secuencia, 'trigger_tipo' | 'pasos'>): boolean =>
  preparaUnaReunion(s.trigger_tipo) && s.pasos.length > 0;

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
 *
 * ⚠️ SALVO LA QUE SE PUEDE REUSAR (#789): una corrida terminada para OTRA reunión, o una que
 * se quemó sin que le llegara nada, no bloquea a la familia. Si bloqueara, el reuso no
 * alcanzaría nunca a la post-agenda, que es justo para lo que existe. Y no reabre el
 * duplicado de arriba: la mitad que le toca se decide de nuevo con «¿ya le hablamos?», y
 * apenas una de las dos arranca, esa fila (activa) vuelve a bloquear a la otra.
 */
async function leadsEnFamiliaPostAgenda(leadIds: number[]): Promise<Set<number>> {
  const set = new Set<number>();
  if (leadIds.length === 0) return set;
  const supabase = await getTenantDb();
  // El error se LEE: una lectura caída dejaba a todos «fuera de la familia», que es la
  // dirección que le manda los dos audios de apertura al mismo lead.
  const { data: secs, error } = await supabase
    .from('nutricion_secuencias').select('id, pasos')
    .in('trigger_tipo', FAMILIA_POST_AGENDA);
  if (error) throw new Error(`leadsEnFamiliaPostAgenda: ${error.message}`);
  const familia = (secs ?? []) as Array<{ id: number; pasos: unknown }>;
  const ids = familia.map((r) => r.id);
  if (ids.length === 0) return set;
  const conPasos = new Set(familia.filter((s) => Array.isArray(s.pasos) && s.pasos.length > 0).map((s) => s.id));
  // En tandas y paginado (ver `inscripcionesDe`). Antes era un `.in()` suelto que
  // además IGNORABA el error: una lectura fallida dejaba a todos «fuera de la
  // familia» y el mismo lead entraba a las dos secuencias hermanas.
  const filas = await inscripcionesDe(supabase, leadIds, (q) => q.in('secuencia_id', ids), true);
  // Toda la familia prepara una reunión (`FAMILIA_POST_AGENDA` ⊂ `preparaUnaReunion`).
  const reusables = await reusablesDe(supabase, filas, (secId) => conPasos.has(secId));
  for (const f of filas) if (!reusables.has(f.id)) set.add(f.lead_id);
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

  const tz = await tzActual().catch(() => TZ_DEFAULT);
  const ahora = new Date();

  for (const sec of secuencias) {
    // ⚠️ LA MISMA PUERTA QUE EL COMMIT, o el preview miente sobre a quién va a
    // inscribir. Acá NO se escribe `cron_proxima_at`: un dry-run que avanza el ancla
    // deja al commit de al lado sin su ocurrencia.
    if (!decidirAgenda({ cron: sec.cron, cronProximaAt: sec.cron_proxima_at }, tz, ahora).toca) continue;
    const candidatos = await aTiempo(supabase, sec, await leadsDeCohorte(sec.trigger_tipo, sec.etapa, sec.funnel_id, sec.producto_id));
    if (candidatos.length === 0) continue;
    const { nuevas, reusar } = await aInscribir(supabase, sec, candidatos)
      .catch((e: unknown) => { throw new Error(`planificarInscripciones: ${e instanceof Error ? e.message : String(e)}`); });
    for (const n of nuevas) plan.push({ secuencia: sec.clave, lead_id: n.lead_id, proximo_envio_at: n.proximo_envio_at });
    for (const r of reusar) plan.push({ secuencia: sec.clave, lead_id: r.lead_id, proximo_envio_at: r.proximo_envio_at, reactiva: true });
  }
  return plan;
}

type AltaInscripcion = { lead_id: number; proximo_envio_at: string; reunion_at: string | null };
/** Una fila vieja que se va a reusar, con el instante en que se decidió (antes de leerla). */
type Reuso = AltaInscripcion & { fila: FilaInsc; porque: string; decididoAt: string };

/**
 * Qué pasa con los candidatos de UNA secuencia: a quiénes se inscribe de cero y qué filas
 * viejas se REUSAN (#789). Compartido por el dry-run y el commit, para que el preview no
 * mienta ni sobre a quién ni sobre el horario.
 *
 * · Un candidato SIN fila se inscribe, como siempre.
 * · Uno CON fila sale de acá, salvo que su fila se pueda reusar (`reusablesDe`): ésa no se
 *   inserta —el unique no deja— sino que se reactiva.
 * · `reunion_at` es la reunión que la inscripción prepara, y se escribe sólo en la familia que
 *   prepara una (`preparaUnaReunion`). Una reunión que ya pasó queda en null, que la regla del
 *   reuso lee como «no sé cuál era», no como otra.
 * · El horario del primer paso: con paso 0 anclado a la reunión (#18), desde la agenda del
 *   lead; sin ancla, el delay relativo de siempre.
 * · ⚠️ EL RESIDUO SE ESCALONA (#790). Sus leads llegan de a decenas en la primera corrida y
 *   la cola ordena por `proximo_envio_at`: todos juntos «ya» se ponían delante de la
 *   post-agenda durante días. Con el escalonado salen `RESIDUO_POR_DIA` mensajes por día,
 *   contando desde el último turno ya agendado. (Se injertó acá al integrar #789 y #790, que
 *   tocaban la misma función en paralelo: #789 reemplazó `horariosDeInscripcion` por esto.)
 */
async function aInscribir(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  sec: Secuencia,
  candidatos: number[],
): Promise<{ nuevas: AltaInscripcion[]; reusar: Reuso[] }> {
  const prepara = preparaUnaReunion(sec.trigger_tipo);
  // El instante de la decisión va ANTES de leer las filas: es el corte de lo que el reuso
  // desliga, y tomarlo al reactivar dejaba adentro lo que otra corrida mandó entre medio
  // (ver `Reactivacion.ahora` en lib/nutricion-reinscripcion.ts).
  const decididoAt = ahoraISO();
  const filas = await inscripcionesDe(db, candidatos, (q) => q.eq('secuencia_id', sec.id), prepara);
  const conFila = new Set(filas.map((f) => f.lead_id));
  const pendientes = candidatos.filter((id) => !conFila.has(id));
  const reusables = reusaInscripciones(sec) ? [...(await reusablesDe(db, filas, () => true)).values()] : [];

  const quienes = [...pendientes, ...reusables.map((r) => r.fila.lead_id)];
  // En tandas y paginado: con el `.in()` suelto, un lead que caía del corte se quedaba sin su
  // reunión y el paso anclado salía con delay relativo — un recordatorio a destiempo.
  const juntas = (prepara || sec.pasos[0]?.ancla === 'reunion') && quienes.length ? await juntasDe(db, quienes) : new Map<number, JuntasLead>();
  const escalonados = sec.trigger_tipo === TRIGGER_RESIDUO && pendientes.length
    ? await horariosResiduo(db, { pendientes, pasos: sec.pasos.length, delayHoras: sec.pasos[0]?.delay_horas ?? 0 })
    : null;
  const alta = (lead_id: number, reunionMs: number | null): AltaInscripcion => ({
    lead_id,
    proximo_envio_at: escalonados?.get(lead_id) ?? proximoEnvioDePaso(sec.pasos[0], juntas.get(lead_id)),
    reunion_at: prepara && reunionMs != null ? new Date(reunionMs).toISOString() : null,
  });
  return {
    nuevas: pendientes.map((id) => alta(id, reunionQuePreparaMs(juntas.get(id)))),
    reusar: reusables.map((r) => ({ ...alta(r.fila.lead_id, r.reunionMs), fila: r.fila, porque: r.porque, decididoAt })),
  };
}

// Persiste las inscripciones nuevas y reactiva las que se reusan (#789). Devuelve cuántas
// corridas ARRANCÓ: las dos cuentan, porque las dos son un lead que empieza la secuencia.
export async function comprometerInscripciones(): Promise<number> {
  const supabase = (await getTenantDb());
  const secuencias = await getSecuenciasActivas();
  let creadas = 0;

  const tz = await tzActual().catch(() => TZ_DEFAULT);
  const ahora = new Date();

  for (const sec of secuencias) {
    /**
     * ⚠️ LA PUERTA DEL HORARIO, Y EL AVANCE VA ANTES DE INSCRIBIR.
     *
     * Marcar primero es la regla de la casa, y está medida: dos invocaciones del
     * mismo tick inscribían dos veces (21 pares duplicados el 27/09 por los 7-10 s
     * que el envío por WhatsApp retiene el HTTP abierto). El costo de este orden es
     * el opuesto y es el correcto: si la inscripción falla se pierde UNA ocurrencia,
     * y eso se nota menos que dos mensajes iguales en el teléfono de un cliente.
     *
     * El `eq('cron_proxima_at', …)` es el compare-and-set: si otra invocación ya la
     * avanzó, el update toca 0 filas y esta corrida se abstiene.
     */
    const agenda = decidirAgenda({ cron: sec.cron, cronProximaAt: sec.cron_proxima_at }, tz, ahora);
    if (agenda.proxima) {
      const q = supabase.from('nutricion_secuencias').update({ cron_proxima_at: agenda.proxima }).eq('id', sec.id);
      const { data: reclamadas, error: eCron } = sec.cron_proxima_at == null
        ? await q.is('cron_proxima_at', null).select('id')
        : await q.eq('cron_proxima_at', sec.cron_proxima_at).select('id');
      if (eCron) throw new Error(`comprometerInscripciones (cron): ${eCron.message}`);
      // Sembrar NO dispara (ver lib/nutricion-agenda.ts), así que `toca` manda igual.
      if (agenda.toca && (reclamadas ?? []).length === 0) continue;
    }
    if (!agenda.toca) continue;
    const candidatos = await aTiempo(supabase, sec, await leadsDeCohorte(sec.trigger_tipo, sec.etapa, sec.funnel_id, sec.producto_id));
    if (candidatos.length === 0) continue;
    // Un error acá LANZA: antes se ignoraba, «nadie inscripto» reinsertaba a todos y
    // el insert moría contra el unique — o sea que igual cortaba, pero con un
    // mensaje que culpaba al insert y no a la lectura.
    const { nuevas, reusar } = await aInscribir(supabase, sec, candidatos)
      .catch((e: unknown) => { throw new Error(`comprometerInscripciones: ${e instanceof Error ? e.message : String(e)}`); });
    if (nuevas.length) {
      const { error } = await supabase.from('nutricion_inscripciones').insert(nuevas.map((n) => ({
        lead_id: n.lead_id,
        secuencia_id: sec.id,
        paso_actual: 0,
        estado: 'activa',
        proximo_envio_at: n.proximo_envio_at,
        // Sólo en la familia que prepara una reunión: fuera de ella la columna no dice nada,
        // y no mandarla deja a las demás secuencias andando aunque la 0205 todavía no esté.
        ...(preparaUnaReunion(sec.trigger_tipo) ? { reunion_at: n.reunion_at } : {}),
      })));
      if (error) throw new Error(`comprometerInscripciones: ${error.message}`);
      creadas += nuevas.length;
    }
    creadas += await reactivarReusables(supabase, sec, reusar);
  }
  return creadas;
}

/**
 * Reactiva las inscripciones que `aInscribir` decidió reusar (#789). Una por una y con
 * compare-and-set: si otra corrida del mismo tick ya la reclamó, ésta toca 0 filas y no la
 * cuenta. Devuelve cuántas reclamó.
 */
async function reactivarReusables(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  sec: Pick<Secuencia, 'clave'>,
  reusar: ReadonlyArray<Reuso>,
): Promise<number> {
  let n = 0;
  for (const r of reusar) {
    const reclamada = await reactivarInscripcion(db, {
      id: r.fila.id, leido: r.fila, proximoEnvioAt: r.proximo_envio_at, reunionAt: r.reunion_at, ahora: r.decididoAt,
    });
    if (!reclamada) continue;
    n += 1;
    console.log(`[nutricion] lead ${r.lead_id}: la inscripción ${r.fila.id} (${sec.clave}) vuelve a correr (${r.porque})`);
  }
  return n;
}

// ── Enrolamiento por EVENTO (inmediatez — reunión 31/07) ─────────────────────
// Regla del negocio: al lead que llena el formulario de Meta hay que escribirle
// casi al instante ("si pasan días, nos van a tratar como extraños"). El cron
// horario no alcanza: estos enganches enrolan y disparan el primer paso YA.
//
// La ventana horaria SÍ se respeta (no despertamos a nadie a las 3am): si el
// evento cae fuera de 9-21 MX, la inscripción queda vencida y la levanta la
// primera corrida del cron de la mañana.

export type EventoNutricion = 'lead_nuevo' | 'agenda_nueva' | 'etapa' | 'entrega';

/** Lo que el evento de ETAPA necesita saber, porque no se deduce del lead id. */
export type CtxEvento = {
  /** La etapa a la que ACABA de caer. Sin esto el evento de etapa no enrola a nadie. */
  etapa?: string | null;
  /** El embudo del lead. NULL = el del negocio. Es el ámbito de las etapas de VENTA. */
  funnelId?: number | string | null;
  /**
   * El PRODUCTO cuya entrega se movió. Es el ámbito del evento `'entrega'` y NO es lo
   * mismo que `funnelId`: del producto al embudo hay dos saltos, así que mandar uno
   * donde va el otro es un número correcto sobre la pregunta equivocada.
   */
  productoId?: number | string | null;
  /** De qué etapa SALIÓ. `null` = recién entra. Ver `cerrarEntregaDeEtapa`. */
  desde?: string | null;
};

// Qué triggers responden a cada evento. Los cohortes siguen siendo la fuente de
// verdad de A QUIÉN le toca: acá solo decidimos QUÉ secuencias mirar ya mismo.
const TRIGGERS_POR_EVENTO: Record<EventoNutricion, string[]> = {
  lead_nuevo: ['instant_form_sin_agenda', 'vio_vsl_sin_agendar', 'vio_poco_vsl'],
  agenda_nueva: ['agendado_sin_confirmar', TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_NUEVO],
  // ⚠️ ESTE NO ALCANZA SOLO, y es la diferencia con los dos de arriba: las secuencias de
  // etapa pueden ser muchas y cada una es de UNA etapa y de UN producto. El filtro fino
  // lo hace `secuenciasDeEtapa` unas líneas más abajo; esta lista sólo acota qué mirar.
  etapa: [TRIGGER_ETAPA],
  // La ENTREGA de un servicio (el kanban de Customer Success). Trigger propio: ver
  // `secuenciasDeEntrega`.
  entrega: [TRIGGER_ENTREGA],
};

/**
 * CUÁNTAS SECUENCIAS CUELGAN DE CADA ETAPA DE LA ENTREGA de un producto.
 *
 * Lo pidió la sesión de Customer Success para su editor de etapas, y el agujero que
 * tapa está escrito en AGENTS.md con todas las letras: «sacar algo de un catálogo no es
 * borrarlo: hay gente APUNTÁNDOLE… preguntá si hay algo apuntándole; es una query, no
 * una intuición». Su editor ya avisa cuántos CLIENTES quedan sin columna al borrar una
 * etapa; lo que no veía es el otro que apunta — una secuencia colgada de «Hito 1» que,
 * borrada la etapa, no dispara nunca más y sin un solo aviso.
 *
 * ⚠️ VIVE ACÁ Y NO ALLÁ, Y NO ES COMODIDAD: `trigger_tipo = 'entrega_actual'` es una
 * convención de la nutrición. Un `select` con esa constante escrito en otra pantalla es
 * el segundo lugar que la conoce, o sea el que se queda viejo el día que cambie.
 *
 * ⚠️ Y `null` SIGNIFICA «NO PUDE LEER», que no es «ninguna». Quien llama tiene que poder
 * distinguirlas: con la consulta caída, afirmar «no hay secuencias apuntando» deja
 * borrar una etapa sobre una afirmación que nadie midió. Las etapas sin secuencias NO
 * vienen en cero — vienen ausentes — porque el universo de etapas lo tiene el que
 * pregunta y no el motor (es su catálogo, no el mío).
 */
export async function secuenciasPorEtapaDeEntrega(productoId: number): Promise<Record<string, number> | null> {
  if (!Number.isFinite(productoId) || productoId <= 0) return null;
  try {
    const supabase = await getTenantDb();
    const { data, error } = await supabase
      .from('nutricion_secuencias')
      .select('etapa')
      .eq('trigger_tipo', TRIGGER_ENTREGA)
      .eq('producto_id', productoId);
    if (error) {
      console.error(`[nutricion] secuenciasPorEtapaDeEntrega(${productoId}): ${error.message}`);
      return null;
    }
    const out: Record<string, number> = {};
    for (const r of (data ?? []) as Array<{ etapa: string | null }>) {
      const key = (r.etapa ?? '').trim();
      if (!key) continue;
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  } catch (e) {
    console.error(`[nutricion] secuenciasPorEtapaDeEntrega(${productoId}):`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * CERRAR lo que la etapa anterior tenía pendiente.
 *
 * ⚠️ UNA SECUENCIA DE ETAPA HABLA DE UN MOMENTO, Y EL MOMENTO SE TERMINA. Un cliente
 * que estaba en «onboarding» con un mensaje agendado para dentro de tres días y que hoy
 * pasó a «hito 2» no puede recibir «¿cómo venís con el arranque?»: la condición que
 * hacía verdadero a ese mensaje dejó de valer. Es la misma regla que ya está escrita
 * para la post-agenda («un mensaje que habla de un MOMENTO se re-pregunta al salir»),
 * aplicada acá — y lo que la dispara no es una pantalla, es el movimiento.
 *
 * Y de paso resuelve el DESHACER, que es lo que avisó la sesión de Customer Success: el
 * toast del kanban vuelve a llamar al choke point con la etapa anterior, así que un
 * arrepentimiento a los tres segundos llega acá como un movimiento de vuelta. Cerrando
 * lo pendiente de la etapa que se deja, el mensaje de la etapa equivocada no sale —
 * **salvo que ya hubiera salido**, que es el caso de un primer paso con `delay_horas: 0`
 * y no tiene cura de este lado: un mensaje que ya está en el teléfono de alguien no se
 * deshace. Por eso esto NO necesita saber si fue un deshacer o un movimiento de verdad:
 * la regla es la misma para los dos, y meterle un dato de UI al modelo sería peor.
 *
 * Devuelve cuántas cerró. Nunca tira: cerrar de menos deja un mensaje de más, que es
 * malo, pero romper el movimiento del kanban es peor.
 */
export async function cerrarEntregaDeEtapa(
  leadId: number,
  etapaDesde: string | null | undefined,
  productoId: number | string | null | undefined,
): Promise<number> {
  try {
    const key = (etapaDesde ?? '').trim();
    if (!key) return 0;
    const supabase = await getTenantDb();
    // Las secuencias de LA ETAPA QUE SE DEJA, con el mismo criterio con el que se
    // enrolan las de la etapa nueva: una función, no dos.
    const deLaEtapa = secuenciasDeEntrega(await getSecuenciasActivas(), key, productoId);
    if (!deLaEtapa.length) return 0;
    const { data, error } = await supabase
      .from('nutricion_inscripciones')
      .update({ estado: 'completada', proximo_envio_at: null, updated_at: ahoraISO() })
      .eq('lead_id', leadId)
      .eq('estado', 'activa')
      .in('secuencia_id', deLaEtapa.map((x) => x.id))
      .select('id');
    if (error) { console.error(`[nutricion] cerrarEntregaDeEtapa(${leadId}, ${key}): ${error.message}`); return 0; }
    const n = (data ?? []).length;
    if (n) console.log(`[nutricion] lead ${leadId} salió de «${key}»: ${n} inscripción(es) cerrada(s)`);
    return n;
  } catch (e) {
    console.error(`[nutricion] cerrarEntregaDeEtapa(${leadId}):`, e instanceof Error ? e.message : String(e));
    return 0;
  }
}

/**
 * Enrola a UN lead en las secuencias activas del evento y dispara su primer
 * paso en el acto. Best-effort: nunca tira (lo llaman webhooks — si falla el
 * enrolamiento, el lead igual quedó creado y el cron lo levanta después).
 * Devuelve cuántas inscripciones creó.
 */
export async function enrolarPorEvento(leadId: number, evento: EventoNutricion, ctx?: CtxEvento): Promise<number> {
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
    let delEvento = hayFamilia
      ? secuenciasParaElLead(todas, (await leadsYaContactados([leadId])).has(leadId))
      : todas;

    // ⚠️ EL EVENTO DE ETAPA ES EL ÚNICO QUE PREGUNTA POR *CUÁL*. Los otros dos enrolan
    // en todas las secuencias de su trigger —son un puñado y le aplican a cualquier lead
    // nuevo— y acá eso sería mandarle a un lead que cayó en «Agenda» también el mensaje
    // de «Facturando», y el del producto de al lado. La etapa y el embudo van adentro de
    // la pregunta, y el ámbito se resuelve UNA vez por secuencia (`ambitoDeFunnel` ya
    // tolera el id que no existe cayendo a `propio`, que no junta a nadie de más).
    if (evento === 'etapa') {
      const conAmbito: Array<Secuencia & { ambito: AmbitoFunnel }> = [];
      for (const sec of delEvento) conAmbito.push({ ...sec, ambito: await ambitoDeFunnel(sec.funnel_id) });
      delEvento = secuenciasDeEtapa(conAmbito, ctx?.etapa, ctx?.funnelId);
    }
    // La ENTREGA no necesita resolver ningún ámbito contra la base: el producto es el
    // producto, sin default ni NULL que signifique otra cosa.
    if (evento === 'entrega') {
      // PRIMERO se cierra lo de la etapa que se deja y DESPUÉS se enrola en la nueva:
      // al revés, un movimiento de ida y vuelta dejaría viva la inscripción de la etapa
      // que el cliente ya no tiene.
      await cerrarEntregaDeEtapa(leadId, ctx?.desde, ctx?.productoId);
      delEvento = secuenciasDeEntrega(delEvento, ctx?.etapa, ctx?.productoId);
    }
    // El tope de antigüedad vale también acá: un evento de un lead viejo (una
    // agenda nueva, un lead re-importado) no lo mete a una secuencia que no le
    // escribe a leads de esa edad.
    const secuencias: Secuencia[] = [];
    for (const s of delEvento) {
      if ((await aTiempo(supabase, s, [leadId])).length) secuencias.push(s);
    }
    // ⚠️ LA EXCLUSIÓN DE FAMILIA TAMBIÉN VA ACÁ (#789). El cohorte la aplica
    // (`leadsEnFamiliaPostAgenda`) y este camino no la miraba: sólo preguntaba por las
    // secuencias que el evento elige, así que un lead con la mitad «primer contacto» todavía
    // corriendo —y que por eso ya cuenta como contactado— entraba a la otra mitad al
    // re-agendar, y recibía los dos audios de apertura. Con el reuso esa puerta además se
    // ensancha, porque una fila reusable deja de bloquear: la pregunta va en un solo lugar.
    let elegidas = secuencias;
    if (elegidas.some((s) => FAMILIA_POST_AGENDA.includes(s.trigger_tipo)) && (await leadsEnFamiliaPostAgenda([leadId])).has(leadId)) {
      elegidas = elegidas.filter((s) => !FAMILIA_POST_AGENDA.includes(s.trigger_tipo));
    }
    if (!elegidas.length) return 0;

    const preparan = elegidas.some((s) => preparaUnaReunion(s.trigger_tipo));
    // Antes de LEER las filas, como en `aInscribir`: es el corte de lo que el reuso desliga.
    const decididoAt = ahoraISO();
    const previas = await inscripcionesDe(supabase, [leadId], (q) => q.in('secuencia_id', elegidas.map((s) => s.id)), preparan);
    const previaDe = new Map(previas.map((f) => [f.secuencia_id, f]));
    const reusaSec = new Set(elegidas.filter(reusaInscripciones).map((s) => s.id));
    const reusables = await reusablesDe(supabase, previas, (secId) => reusaSec.has(secId));
    const juntas = (preparan || elegidas.some((s) => s.pasos[0]?.ancla === 'reunion')) ? (await juntasDe(supabase, [leadId])).get(leadId) ?? null : null;

    // ⚠️ DE A UNA, NO POR LOTE (refutador del relevo #789, (3)). El insert por lote chocaba
    // con el `unique (lead_id, secuencia_id)` apenas UNA fila ya existía —otra corrida, o el
    // cron en el mismo segundo— y el `return 0` dejaba al lead sin NINGUNA de las secuencias
    // del evento. Una fila que ya existe no se inserta: se reusa si se puede, y si no, se deja.
    let arrancadas = 0;
    for (const s of elegidas) {
      // El primer paso de una secuencia disparada por evento sale YA: el delay configurado
      // cuenta desde el evento, no desde el cron. Un paso anclado a la reunión, desde la agenda.
      const proximo = proximoEnvioDePaso(s.pasos[0], juntas);
      const previa = previaDe.get(s.id);
      if (previa) {
        const r = reusables.get(previa.id);
        if (!r) continue;
        const reclamada = await reactivarInscripcion(supabase, {
          id: previa.id, leido: previa, proximoEnvioAt: proximo, reunionAt: new Date(r.reunionMs).toISOString(), ahora: decididoAt,
        });
        if (!reclamada) continue;
        console.log(`[nutricion] lead ${leadId}: la inscripción ${previa.id} (${s.clave}) vuelve a correr (${r.porque})`);
        arrancadas += 1;
        continue;
      }
      const reunion = preparaUnaReunion(s.trigger_tipo) ? reunionQuePreparaMs(juntas) : null;
      const { error } = await supabase.from('nutricion_inscripciones').insert({
        lead_id: leadId,
        secuencia_id: s.id,
        paso_actual: 0,
        estado: 'activa',
        proximo_envio_at: proximo,
        ...(preparaUnaReunion(s.trigger_tipo) ? { reunion_at: reunion == null ? null : new Date(reunion).toISOString() } : {}),
      });
      if (error) { console.error(`[nutricion] enrolarPorEvento(${evento}) lead ${leadId} en ${s.clave}: ${error.message}`); continue; }
      arrancadas += 1;
    }
    if (!arrancadas) return 0;

    // Vía rápida: intentamos mandar el primer paso ahora mismo, solo de este lead.
    try { await procesarEnvios({ soloLeadId: leadId }); }
    catch (e) { console.error(`[nutricion] envío inmediato lead ${leadId} falló:`, e); }
    return arrancadas;
  } catch (e) {
    console.error(`[nutricion] enrolarPorEvento(${evento}) lead ${leadId} falló:`, e);
    return 0;
  }
}

// ── Inscripción MANUAL: un lead en UNA secuencia elegida (08/10/2026) ────────
// «Metelo en ESTA secuencia», por MaKo o por un paso «⚡ Acción» de un flujo. Las reglas
// están en lib/nutricion-inscripcion-manual.ts (puras, con test); acá se lee y se escribe.

export type InscripcionManual =
  | { inscribe: true; como: 'nueva' | 'reinicio'; secuencia: { id: number; nombre: string }; lead: { id: number; nombre: string }; proximoEnvioAt: string }
  | {
    inscribe: false;
    porque: PorQueNoSeInscribio;
    secuencia: { id: number; nombre: string } | null;
    lead: { id: number; nombre: string } | null;
  };

/**
 * Mete a UN lead en UNA secuencia, sin pasar por su cohorte ni por un evento. La decisión es
 * `decidirInscripcionManual`; acá se junta lo que pregunta —con las MISMAS funciones con las que
 * el motor lo vuelve a preguntar al mandar (`aTiempo`, `reunionFuturaMs`, `residuoVigente`)— y
 * se escribe con las MISMAS piezas que `enrolarPorEvento`:
 *   · nueva    → una fila, con el horario del primer paso (`proximoEnvioDePaso`) y la reunión que
 *                prepara sólo en la familia que prepara una (`preparaUnaReunion`);
 *   · reinicio → la fila que ya terminó se reactiva con compare-and-set, y lo de la corrida vieja
 *                deja de colgar de ella (lib/nutricion-reinscripcion.ts). La decisión se fecha
 *                ANTES de leer la fila (ver `Reactivacion.ahora`).
 * Después, la vía rápida de siempre: `procesarEnvios` de este lead, que respeta la ventana, el
 * tope diario y la pausa de 20 h (salvo `sinEnvioInmediato`: ver abajo).
 *
 * `soloVer` decide SIN escribir: lo llama el `preparar()` del registro, que no puede escribir. Sin
 * él vuelve a decidir contra la base, porque entre el «sí» y ahora pudo cambiar todo.
 *
 * ⚠️ El lead se lee con `getTenantDb`: un lead de OTRO negocio no existe acá. Sin esa lectura, el
 * insert aceptaría su id (la FK es global) y le escribiría la secuencia de este negocio a una
 * persona de otro. Y una lectura que falla TIRA: «no pude leer» no es «no existe».
 */
export async function inscribirEnSecuencia(
  leadId: number,
  secuenciaId: number,
  opts?: { soloVer?: boolean; sinEnvioInmediato?: boolean },
): Promise<InscripcionManual> {
  const supabase = await getTenantDb();
  // El ámbito (funnel_id, producto_id) viaja aunque acá no filtre —la secuencia la eligió una
  // persona, no una cohorte—: todo select de secuencias lo trae (tests/nutricion-ambito-embudo).
  const { data: filaSec, error: eSec } = await supabase.from('nutricion_secuencias')
    .select('id, nombre, trigger_tipo, activa, archivada_at, pasos, estrategia, funnel_id, producto_id').eq('id', secuenciaId).maybeSingle();
  if (eSec) throw new Error(`inscribirEnSecuencia (secuencia): ${eSec.message}`);
  const s = filaSec as { id: number; nombre: string; trigger_tipo: string; activa: boolean; archivada_at: string | null; pasos: unknown; estrategia: unknown } | null;
  const { data: filaLead, error: eLead } = await supabase.from('leads')
    .select('id, nombre, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at').eq('id', leadId).maybeSingle();
  if (eLead) throw new Error(`inscribirEnSecuencia (lead): ${eLead.message}`);
  const lead = filaLead as ({ id: number; nombre: string | null } & JuntasLead) | null;
  const quien = lead ? { id: Number(lead.id), nombre: lead.nombre?.trim() || `el lead #${lead.id}` } : null;
  if (!s) return { inscribe: false, porque: 'secuencia_no_existe', secuencia: null, lead: quien };
  const ref = { id: Number(s.id), nombre: s.nombre };
  if (!lead || !quien) return { inscribe: false, porque: 'lead_no_existe', secuencia: ref, lead: null };

  const pasos = Array.isArray(s.pasos) ? (s.pasos as PasoSecuencia[]) : [];
  const prepara = preparaUnaReunion(s.trigger_tipo);
  const decididoAt = ahoraISO();
  const previa = (await inscripcionesDe(supabase, [leadId], (q) => q.eq('secuencia_id', s.id), prepara))[0] ?? null;

  const aTiempoOk = (await aTiempo(supabase, { antiguedad_max_horas: parseEstrategia(s.estrategia)?.antiguedad_max_horas ?? null }, [leadId])).length > 0;
  const sinReunion = (pasos[0]?.ancla === 'reunion' || prepara) && reunionFuturaMs(lead) == null;
  const fueraDelResiduo = s.trigger_tipo === TRIGGER_RESIDUO && !(await residuoVigente(supabase, [leadId])).has(leadId);
  let enLaOtraMitad = false;
  if (FAMILIA_POST_AGENDA.includes(s.trigger_tipo)) {
    const { data: hermanas, error: eH } = await supabase.from('nutricion_secuencias').select('id')
      .in('trigger_tipo', FAMILIA_POST_AGENDA).neq('id', s.id);
    if (eH) throw new Error(`inscribirEnSecuencia (post-agenda): ${eH.message}`);
    const ids = ((hermanas ?? []) as Array<{ id: number }>).map((h) => h.id);
    if (ids.length) {
      const vivas = await inscripcionesDe(supabase, [leadId], (q) => q.in('secuencia_id', ids).in('estado', ['activa', 'pendiente', 'pausada']), false);
      enLaOtraMitad = vivas.length > 0;
    }
  }

  const v = decidirInscripcionManual({
    secuencia: { activa: s.activa === true, archivada: s.archivada_at != null, pasos: pasos.length },
    previa: previa ? { estado: previa.estado, desenlace: previa.desenlace } : null,
    motor: { aTiempo: aTiempoOk, sinReunion, fueraDelResiduo, enLaOtraMitad },
  });
  if (!v.inscribe) return { inscribe: false, porque: v.porque, secuencia: ref, lead: quien };

  const proximo = proximoEnvioDePaso(pasos[0], lead);
  const reunion = prepara ? reunionQuePreparaMs(lead) : null;
  const reunionAt = reunion == null ? null : new Date(reunion).toISOString();
  const hecho = { inscribe: true as const, como: v.como, secuencia: ref, lead: quien, proximoEnvioAt: proximo };
  if (opts?.soloVer) return hecho;

  if (v.como === 'reinicio' && previa) {
    const reclamada = await reactivarInscripcion(supabase, {
      id: previa.id, leido: previa, proximoEnvioAt: proximo, reunionAt, ahora: decididoAt,
    });
    if (!reclamada) return { inscribe: false, porque: 'carrera', secuencia: ref, lead: quien };
  } else {
    const { error } = await supabase.from('nutricion_inscripciones').insert({
      lead_id: leadId, secuencia_id: s.id, paso_actual: 0, estado: 'activa', proximo_envio_at: proximo,
      ...(prepara ? { reunion_at: reunionAt } : {}),
    });
    // 23505 = el unique (lead_id, secuencia_id): otra corrida lo inscribió entre la lectura y acá.
    if (error?.code === '23505') return { inscribe: false, porque: 'carrera', secuencia: ref, lead: quien };
    if (error) throw new Error(`inscribirEnSecuencia: ${error.message}`);
  }
  console.log(`[nutricion] lead ${leadId}: inscripción manual en la secuencia ${s.id} (${v.como})`);
  // ⚠️ SIN LA VÍA RÁPIDA DESDE UN FLUJO (`sinEnvioInmediato`). Un paso «⚡ Acción» de una secuencia
  // corre ADENTRO de procesarEnvios: volver a llamarlo para el mismo lead levantaría la inscripción
  // que todavía no avanzó de paso, y la acción correría dos veces. Ahí lo manda el cron.
  if (!opts?.sinEnvioInmediato) {
    try { await procesarEnvios({ soloLeadId: leadId }); }
    catch (e) { console.error(`[nutricion] envío inmediato lead ${leadId} falló:`, e); }
  }
  return hecho;
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
      // Un paso de acción no tiene texto: decir su operación es lo único que describe qué corre.
      detalle: !paso ? 'sin paso → se completaría'
        : esPasoAccion(paso) ? `acción: ${paso.accion?.operacion || 'sin elegir'}`
          : `${paso.canal}: ${paso.asunto ?? paso.cuerpo.slice(0, 40)}`,
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
  /** Mensajes Y acciones que fallaron. Una acción fallida queda en `nutricion_envios` con su motivo. */
  fallos: number;
  /** Pasos «⚡ Acción» que corrieron bien. No son mensajes: no cuentan para ningún cupo. */
  acciones: number;
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
  const res: ResultadoProceso = { enviados: 0, simulados: 0, omitidos: 0, esperando: 0, borradores: 0, fallos: 0, acciones: 0, detalle: [] };
  const [waOn, emailOn, sandbox, remitente, lineasEvo] = await Promise.all([
    envioWhatsappHabilitado(),
    envioEmailHabilitado(),
    remitenteEsSandbox(),
    getEmailFrom(),
    // `null` = no se pudo leer: ninguna línea se da por lista, y el motivo lo dice.
    listarLineas().catch((): LineaRow[] | null => null),
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
  // ⚠️ Y CON VARIAS LÍNEAS ES UNA SONDA POR LÍNEA (06/10/2026). Cada secuencia sale por la
  // suya, y la que está caída no puede decidir por las demás: con una sonda única —la de la
  // línea por default— una secuencia de la línea 2 viva se frenaba porque la 1 estaba caída,
  // o salía «lista» sobre una línea 2 muerta. Se memoiza por línea: la segunda secuencia de
  // la misma línea no vuelve a sondear.
  const canalPorLinea = new Map<string, Promise<CanalNoOficial>>();
  const canalDeLinea = (pedida: string | null): Promise<CanalNoOficial> => {
    const clave = pedida ?? '';
    let p = canalPorLinea.get(clave);
    if (!p) {
      p = (async (): Promise<CanalNoOficial> => {
        if (lineasEvo == null) return { listo: false, fuente: 'fila', motivo: 'No pude leer las líneas de WhatsApp de este negocio.' };
        const fila = pedida ? lineasEvo.find((l) => l.instance_name === pedida) ?? null : lineaPorDefault(lineasEvo);
        if (pedida && !fila) return { listo: false, fuente: 'fila', motivo: 'La línea de WhatsApp de esta secuencia ya no está vinculada.' };
        const sondeo = fila ? await sondearSocket(fila.instance_name, 8000).catch(() => 'sin_respuesta' as const) : null;
        return canalNoOficial(sondeo, fila?.estado);
      })();
      canalPorLinea.set(clave, p);
    }
    return p;
  };

  // ⚠️ LA VENTANA HORARIA VALE TAMBIÉN PARA LOS PASOS «⚡ ACCIÓN». Una acción puede mandar
  // algo (un WhatsApp de empresa, un email): «que pueda hacer todo» incluye lo que suena en
  // el teléfono de alguien a las 3 de la mañana, y la ventana existe para eso. Y no cuesta:
  // el cron corre sólo de 15 a 23 UTC (vercel.json), dentro de la ventana; esto frena la vía
  // rápida de un evento nocturno, que queda para la primera corrida de la mañana.
  if (!opts?.ignorarVentana && !dentroDeVentana()) {
    return { ...res, saltado: 'fuera-de-ventana-horaria' };
  }
  const presupuesto = MAX_POR_DIA - (await enviosUltimas24h());

  const supabase = (await getTenantDb());
  const secuencias = await getSecuenciasActivas();
  const porId = new Map(secuencias.map((s) => [s.id, s]));
  /**
   * LAS SECUENCIAS CON PASOS «⚡ ACCIÓN». El tope diario y el de la corrida son el
   * presupuesto ANTI-BAN de la línea de WhatsApp: cuentan mensajes. Una acción no es un
   * mensaje, así que no lo gasta ni lo respeta — con el tope cumplido, «mover al lead a
   * Contactado» no puede quedar congelado hasta mañana por WhatsApps que no tienen nada
   * que ver. Cuando el cupo de mensajes se acaba, el motor sigue mirando SÓLO estas.
   * Sin ninguna, todo es exactamente como antes (incluido el corte por tope diario).
   */
  const conAcciones = secuencias.filter((s) => s.pasos.some(esPasoAccion)).map((s) => s.id);
  if (presupuesto <= 0 && !conAcciones.length) return { ...res, saltado: 'tope-diario' };
  const cupo = Math.max(0, Math.min(MAX_POR_CORRIDA, presupuesto));
  const cupoLleno = (): boolean => res.enviados + res.simulados >= cupo;
  // El workspace de la corrida, UNA vez: lo usan el nombre del negocio y cada acción.
  const wsCorrida = await getWorkspaceActual();
  // El nombre del negocio, UNA vez por corrida y no por lead: es del workspace, no de
  // la fila. Si no se puede leer, `{{negocio}}` sale crudo (no vacío) — ver
  // `valoresVariablesLead`.
  const negocio = await getWorkspace(wsCorrida ?? 0).then((w) => w?.nombre ?? '').catch(() => '');

  /**
   * LA REUNIÓN QUE PREPARA ES LA DEL ÚLTIMO PASO QUE SALIÓ (#789). Se anota al inscribir,
   * y si el lead reprograma A MITAD de la corrida, los pasos que siguen ya hablan de la
   * nueva. Sin re-anotarla, la fila terminaba diciendo la reunión VIEJA, y la corrida
   * siguiente del cron leía «otra reunión» sobre la misma que acababa de preparar y le
   * mandaba toda la post-agenda de nuevo. La llaman los DOS avances: el de un mensaje y el
   * de un paso «⚡ Acción» — una acción también hace avanzar la misma corrida.
   *
   * ⚠️ VA APARTE DEL AVANCE, y no es prolijidad: el avance de un paso que YA SALIÓ no puede
   * depender de una columna nueva. Metida en el mismo update, una 0205 sin aplicar haría que
   * PostgREST rechazara el avance entero —un error que acá nadie lee— y el paso se volvería
   * a mandar en la corrida siguiente.
   *
   * ⚠️ LA R1, NO LA MÁS PRÓXIMA (`reunionQuePreparaMs`). Si la R1 ya pasó y el paso salió
   * porque hay una R2 por delante, anotar la R2 acá haría que una R2 cuente como «la reunión
   * que preparó»; sin R1 futura no se re-anota y queda la que había.
   */
  const anotarReunionDelPaso = async (inscId: number, sec: Secuencia, lead: JuntasLead | null | undefined): Promise<void> => {
    const reunionDelPaso = preparaUnaReunion(sec.trigger_tipo) ? reunionQuePreparaMs(lead) : null;
    if (reunionDelPaso != null) {
      const { error: eReunion } = await supabase.from('nutricion_inscripciones')
        .update({ reunion_at: new Date(reunionDelPaso).toISOString() }).eq('id', inscId);
      if (eReunion) console.error(`[nutricion] reunión del paso, inscripción ${inscId}: ${eReunion.message}`);
    }
  };

  /**
   * UN CIERRE SIN ENVÍO TAMBIÉN DEJA SU FILA (#789), en estado 'omitido' y con el motivo,
   * igual que «canal apagado» y «contacto bloqueado».
   *
   * Antes «la reunión ya pasó» y el tope de antigüedad cerraban la inscripción sin escribir
   * nada en nutricion_envios, así que desde afuera esa secuencia no le había hecho NADA al lead:
   * ni un intento, ni un motivo. Medido el 06/10/2026 en el ws1: las inscripciones 186 y 187
   * se cerraron así el 25/09 sin dejar una fila, y las 181-185 figuran como «no respondió» sin
   * que se les haya mandado nada (el evaluador viejo); para saber qué les pasó hubo que cruzar
   * fechas a mano. Un 'omitido' no cuenta como enviado para ningún lector (el anti-ban, el
   * silencio del desenlace, «¿ya le hablamos?», el reuso): es el rastro, no un mensaje.
   * Best-effort: el cierre ya se escribió, y un rastro que falla no puede reabrirlo.
   */
  const anotarCierreSinEnvio = async (
    insc: { id: number; lead_id: number; secuencia_id: number; paso_actual: number },
    paso: PasoSecuencia,
    lead: { telefono: string | null; email: string | null } | undefined,
    motivo: string,
  ): Promise<void> => {
    const { error } = await supabase.from('nutricion_envios').insert({
      inscripcion_id: insc.id,
      lead_id: insc.lead_id,
      secuencia_id: insc.secuencia_id,
      paso: insc.paso_actual + 1,
      canal: paso.canal,
      estado: 'omitido',
      destino: paso.canal === 'whatsapp' ? lead?.telefono ?? null : lead?.email ?? null,
      asunto: paso.asunto,
      error: motivo,
    });
    if (error) console.error(`[nutricion] rastro del cierre de la inscripción ${insc.id} (${motivo}): ${error.message}`);
  };

  // Cola PAGINADA: los 'omitido'/'saltado' no consumen cupo, así que una sola
  // ventana de cupo*3 podía llenarse de filas sin envío real y postergar los
  // envíos de verdad. Iteramos lotes (dedup por id de inscripción) hasta llenar
  // el cupo o drenar la cola de vencidas.
  // Con el cupo de mensajes ya en cero sólo quedan acciones por correr: el lote no puede
  // ser `0 × 3`, o el `.limit(0)` no traería ninguna.
  const LOTE = (cupo > 0 ? cupo : MAX_POR_CORRIDA) * 3;
  const vistos = new Set<number>();
  let rondas = 0;
  // Cuántas filas del residuo ya pasaron al envío en esta corrida (#790): ver
  // `RESIDUO_POR_CORRIDA` y su uso más abajo.
  let residuoEnCorrida = 0;

  while ((!cupoLleno() || conAcciones.length > 0) && rondas < 6) {
    rondas += 1;
    // Una acción de esta vuelta dejó su inscripción con el paso siguiente ya vencido.
    let otraVuelta = false;
    let q = supabase
      .from('nutricion_inscripciones')
      .select('id, lead_id, secuencia_id, paso_actual')
      .eq('estado', 'activa')
      .lte('proximo_envio_at', ahoraISO());
    // Vía rápida de UN lead (enrolamiento por evento): reusa TODO el motor
    // (anti-ban, audio, borradores, gates) sin esperar la corrida del cron.
    if (opts?.soloLeadId) q = q.eq('lead_id', opts.soloLeadId);
    // Sin cupo de mensajes, lo único que puede correr es un paso de acción: no se leen
    // las filas de las secuencias que no tienen ninguno.
    if (cupoLleno()) q = q.in('secuencia_id', conAcciones);
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
    // Quién del lote SIGUE siendo residuo (#790): una lectura por lote, y sólo si el
    // lote trae alguno. `null` = no se pudo leer, y entonces no sale ninguno.
    const delResiduo = due.filter((d) => porId.get(d.secuencia_id)?.trigger_tipo === TRIGGER_RESIDUO).map((d) => d.lead_id);
    const residuoDelLote: Set<number> | null = delResiduo.length
      ? await residuoVigente(supabase, delResiduo).catch((e: unknown) => {
        console.error('[nutricion] residuoVigente:', e instanceof Error ? e.message : String(e));
        return null;
      })
      : new Set<number>();

    for (const insc of due) {
      const sec = porId.get(insc.secuencia_id);
      const paso = sec?.pasos[insc.paso_actual];
      // Con el cupo de mensajes lleno, un MENSAJE queda para la corrida que viene, sin
      // tocarlo (era un `break`: lo mismo para los mensajes). Una ACCIÓN sigue: no gasta cupo.
      if (cupoLleno() && !(paso && esPasoAccion(paso))) continue;
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
          await anotarCierreSinEnvio(insc, paso, lead, 'la reunión ya pasó');
          continue;
        }
      }
      // ⚠️ EL RESIDUO SE VUELVE A PREGUNTAR AL MANDAR, en cada paso (#790). El
      // escalonado reparte los turnos en días y el lead puede pagar o agendar
      // mientras espera; si pagó, `esLeadCliente` haría que esto le saliera
      // AUTOMÁTICO: una reactivación a un cliente recién pagado. Si no se pudo leer,
      // no se avanza ni se cierra: se reintenta en la próxima corrida.
      if (sec.trigger_tipo === TRIGGER_RESIDUO) {
        if (residuoDelLote === null) {
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'no pude confirmar que siga sin cerrar' });
          continue;
        }
        if (!residuoDelLote.has(insc.lead_id)) {
          res.omitidos += 1;
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'omitido', nota: 'ya no está sin cerrar (pagó, agendó u otra secuencia le habla)' });
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
        await anotarCierreSinEnvio(insc, paso, lead, `llegó hace más de ${sec.antiguedad_max_horas} h`);
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

      // ── EL PASO «⚡ ACCIÓN DE MAKO» (decisión de Martín, 08/10/2026) ─────────────
      // En vez de mandar, corre una acción del registro de la API por `ejecutarDesdeFlujo`
      // (lib/api-mako/flujo.ts): la confirmó el dueño al CONFIGURAR el paso, así que acá se
      // ejecuta sin pedir un «sí». Y avanza como si hubiera salido el mensaje.
      //
      // Qué reglas de los mensajes le aplican, decidido una por una:
      //   · SÍ todo lo de arriba, que es de la INSCRIPCIÓN y no del mensaje: la reunión que
      //     ya pasó cierra la secuencia entera, el residuo que pagó también, el tope de
      //     antigüedad y las condiciones del paso (`requiere`) valen igual, y la espera
      //     (`delay_horas`, `ancla`) es la misma programación que la de un mensaje.
      //   · SÍ la PAUSA POR RESPUESTA: `pausarPorRespuesta` pausa la inscripción entera, y
      //     con ella sus acciones. Lo que tiene que pasar cuando el lead contesta es del
      //     desenlace (etapa y «sigue con»), no de un paso que corre a ciegas.
      //   · SÍ la VENTANA HORARIA (ver el corte del principio).
      //   · NO lo que es del MENSAJE, y por eso va ANTES de esas guardas: el [relleno] del
      //     copy, el canal apagado y el anti-ban de 20 h. Este último es el que importa: un
      //     paso «mover a Contactado» pegado a un mensaje quedaría frenado 20 horas por el
      //     mensaje que acaba de salir. Tampoco gasta el cupo de la corrida ni el diario.
      //
      // ⚠️ «NO DOS VECES»: el paso se RECLAMA con compare-and-set antes de correr
      // (`correrPasoAccion`, lib/nutricion-paso-accion.ts). Un mensaje se cuida con el
      // anti-ban; una acción no lo tiene, y el cron y la vía rápida de un evento corren el
      // mismo motor. Si falla, queda en `nutricion_envios` como 'fallo' con el motivo —
      // donde queda un envío fallido— y la secuencia SIGUE: una acción que falla igual cada
      // vez no se reintenta en bucle.
      if (esPasoAccion(paso)) {
        const n = insc.paso_actual + 1;
        const siguientePaso = sec.pasos[n];
        const proximo = siguientePaso ? proximoEnvioDePaso(siguientePaso, lead) : null;
        const r = await correrPasoAccion(
          {
            accion: { operacion: String(paso.accion?.operacion ?? ''), params: paso.accion?.params },
            ws: wsCorrida, secuenciaId: sec.id, nombre: sec.nombre, orden: n, leadId: insc.lead_id,
          },
          {
            reclamar: async () => {
              const { data, error } = await supabase.from('nutricion_inscripciones')
                .update({
                  paso_actual: n,
                  proximo_envio_at: proximo,
                  estado: siguientePaso ? 'activa' : 'completada',
                  // Sin `ultimo_paso_at`: es «el último MENSAJE», y una acción no le habló a nadie.
                  updated_at: ahoraISO(),
                })
                .eq('id', insc.id).eq('estado', 'activa').eq('paso_actual', insc.paso_actual)
                .select('id');
              if (error) throw new Error(error.message);
              return ((data ?? []) as unknown[]).length > 0;
            },
            // Import dinámico: lib/api-mako/flujo → ejecutar → los runners → chatbot.run →
            // este archivo es un ciclo (el mismo motivo que `escribirPasoIA`, más abajo).
            ejecutar: async (operacion, params, o) => (await import('@/lib/api-mako/flujo')).ejecutarDesdeFlujo(operacion, params, o),
            // ⚠️ ESTADO 'accion', NO 'enviado'. Todo lector de esta tabla cuenta mensajes por
            // estado —el anti-ban, el tope diario, «¿ya le hablamos?», el silencio del
            // desenlace, las métricas—: una acción como 'enviado' frenaría el próximo WhatsApp
            // del lead 20 horas y le comería el cupo al negocio. La operación va en `asunto`.
            registrar: async (x) => {
              const { error } = await supabase.from('nutricion_envios').insert({
                inscripcion_id: insc.id, lead_id: insc.lead_id, secuencia_id: insc.secuencia_id, paso: n,
                canal: paso.canal, estado: x.estado, destino: null, asunto: x.operacion,
                error: x.estado === 'fallo' ? x.resumen : null,
              });
              if (error) throw new Error(error.message);
            },
          },
        );
        if (r.estado !== 'saltado') await anotarReunionDelPaso(insc.id, sec, lead);
        // ⚠️ SI LO QUE SIGUE YA TOCA, SE MIRA EN ESTA MISMA CORRIDA. El lienzo dice «Enseguida»
        // sobre un paso a 0 h, y la fila ya está en `vistos`: sin esto, «mover de etapa» +
        // «crear la tarea» + el mensaje de después saldrían de a uno por hora de cron. Se
        // devuelve a la cola y el bucle da otra vuelta (con su tope de 6). Un mensaje que
        // siga pasa igual por TODAS sus guardas, anti-ban incluido, leídas de nuevo.
        if (r.estado !== 'saltado' && proximo != null && Date.parse(proximo) <= Date.now()) {
          vistos.delete(insc.id);
          otraVuelta = true;
        }
        if (r.estado === 'accion') res.acciones += 1;
        else if (r.estado === 'fallo') res.fallos += 1;
        res.detalle.push({ lead_id: insc.lead_id, canal: 'accion', estado: r.estado, nota: r.nota });
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
      // Un paso de ACCIÓN no cuenta como «enviable por un canal prendido»: no es un mensaje,
      // y contarlo haría que un WhatsApp con el canal apagado se omita (en vez de esperar)
      // sólo porque más adelante hay una acción.
      const canalOn = (p: PasoSecuencia) => !esPasoAccion(p) && (p.canal === 'whatsapp' ? waOn : emailOn);
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

      // ⚠️ EL RESIDUO SALE DE A UNO POR CORRIDA (#790), y es el techo que no depende de
      // la agenda: el escalonado se deshace con cualquier reprogramación (una línea caída
      // corre todas las filas vencidas al mismo minuto), y al volver saldrían juntas,
      // delante de la post-agenda. Va acá, después de las guardas que no mandan, para que
      // una fila frenada por «msg <20h» no le gaste el turno a la siguiente. La que no
      // pasa se saltea sin tocarla: sigue vencida para la corrida que viene.
      if (sec.trigger_tipo === TRIGGER_RESIDUO) {
        if (residuoEnCorrida >= RESIDUO_POR_CORRIDA) {
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'el residuo ya usó su turno de esta corrida' });
          continue;
        }
        residuoEnCorrida += 1;
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
      // Qué texto se despachó y quién lo escribió (mig 0197). Lo llenan las ramas que
      // mandan texto propio; una plantilla oficial queda en null, porque lo que sale
      // ahí lo arma Meta con sus parámetros. En un `fallo` es el texto que se INTENTÓ.
      let textoEnviado: string | null = null;
      let textoAutor: AutorTexto | null = null;

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
        const varsNO = valoresVariablesLead(lead ?? {}, { negocio });
        const cuerpoNO = aplicarVariables(textoDelPaso(paso), varsNO);
        // PASO EN MODO IA: el texto se escribe recién en la rama que lo manda, DESPUÉS
        // de cada guarda que corta el envío (sin teléfono, línea caída, bloqueado,
        // borrador pendiente). Escribirlo arriba gastaría una llamada por lead en
        // mensajes que no salen. El modelo recibe el `cuerpo` CRUDO —con sus
        // placeholders— y las variables se aplican a lo que devuelve: así la
        // validación de lib/texto-critico.ts puede ver si perdió un {{lead_nombre}}.
        // Si falla, sale `cuerpoNO`, que es lo que habría salido sin el interruptor.
        // Import dinámico: lib/paso-ia → nutricion-generator → este archivo es un ciclo.
        const escribirTexto = async (): Promise<{ texto: string; autor: AutorTexto; motivo?: string }> => {
          if (paso.tipo !== 'ia') return { texto: cuerpoNO, autor: 'fijo' };
          const { escribirPasoIA } = await import('@/lib/paso-ia');
          const r = await escribirPasoIA({ cuerpo: paso.cuerpo, leadId: lead?.id ?? null });
          return r.autor === 'ia'
            ? { texto: aplicarVariables(r.texto, varsNO), autor: 'ia' }
            : { texto: cuerpoNO, autor: 'fallback', motivo: r.motivo };
        };
        // Paso de NOTA DE VOZ (reunión 31/07): el binario sale de la biblioteca
        // del workspace. Si el audio no está o no se puede bajar, NO degradamos
        // a texto en silencio (mandaría un mensaje que nadie escribió): falla y
        // se reintenta al día siguiente.
        const esAudio = paso.tipo === 'audio' && Number(paso.audio_id) > 0;
        // La línea de ESTA secuencia (`null` = la de por default) y si puede mandar ahora.
        const lineaSec = sec.instance_name;
        const canalEvo = await canalDeLinea(lineaSec);
        const evoConectado = canalEvo.listo;
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
            const r = await enviarAudioYEspejar({ telefono: lead.telefono, base64: b64, mimetype: audio.media_mime, leadId: lead.id, linea: lineaSec });
            estado = r.ok ? 'enviado' : 'fallo';
            if (!r.ok) nota = r.error;
            // PIE DEL AUDIO: el `cuerpo` de un paso de audio se descartaba, así
            // que un audio que dice "te dejo el link abajo" prometía algo que
            // nunca llegaba. Sale como segundo mensaje inmediato, en el mismo
            // toque — no como paso aparte, que el guard anti-ban de 20h frenaría.
            if (r.ok && cuerpoNO.trim()) {
              textoEnviado = cuerpoNO; textoAutor = 'fijo';
              await enviarYEspejar({ telefono: lead.telefono, texto: cuerpoNO, leadId: lead.id, linea: lineaSec })
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
              linea: lineaSec,
            });
            estado = 'borrador';
          }
        } else if (sec.envio_automatico || await esLeadCliente(lead.id)) {
          // Misma excepción que la rama del audio, de arriba.
          const t = await escribirTexto();
          textoEnviado = t.texto; textoAutor = t.autor;
          // El respaldo NO es silencioso: el motivo queda en la fila aunque el envío
          // salga bien. Un error del envío lo pisa abajo, que es lo más urgente de leer.
          if (t.motivo) nota = `IA no usada: ${t.motivo}`;
          const r = await enviarYEspejar({ telefono: lead.telefono, texto: t.texto, leadId: lead.id, linea: lineaSec });
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
          // Lead caliente → BORRADOR (el setter lo manda con 1 clic). En modo IA el
          // borrador ya trae el texto adaptado: es la tercera capa de control, una
          // persona lo lee antes de que salga.
          const t = await escribirTexto();
          textoEnviado = t.texto; textoAutor = t.autor;
          if (t.motivo) nota = `IA no usada: ${t.motivo}`;
          await crearBorrador({ leadId: lead.id, telefono: lead.telefono, texto: t.texto, origen: 'nutricion', secuenciaId: insc.secuencia_id, paso: insc.paso_actual + 1, inscripcionId: insc.id, linea: lineaSec });
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
                bodyParams: valoresVariablesLead(lead, { negocio }),
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
          const vars = valoresVariablesLead(lead, { negocio });
          const cuerpo = aplicarVariables(paso.cuerpo, vars);
          textoEnviado = cuerpo; textoAutor = 'fijo';
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
        // Mig 0197 — ver la cabecera del .sql: sin esto no se puede saber qué le llegó
        // a un lead, y un respaldo usado se leería como un envío de la IA.
        texto_enviado: textoEnviado,
        texto_autor: textoAutor,
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
      // La reunión que preparó este paso, en un update APARTE del avance (ver la función).
      await anotarReunionDelPaso(insc.id, sec, lead);

      if (estado === 'enviado') res.enviados += 1;
      else if (estado === 'omitido') res.omitidos += 1;
      else if (estado === 'borrador') res.borradores += 1;
      else res.simulados += 1;
      res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado, ...(nota ? { nota } : {}) });
    }

    if (fetched.length < LOTE && !otraVuelta) break; // cola drenada: no quedan más vencidas
  }

  // Con el tope diario cumplido sólo corrieron acciones: el corte se sigue diciendo.
  return presupuesto <= 0 ? { ...res, saltado: 'tope-diario' } : res;
}

// Pausa la nutrición de un lead cuando responde (webhook de Chatwoot y espejo
// del no oficial). Marca las inscripciones activas como 'respondio'.
//
// MODO ASISTIDO (reunión 31/07): si la secuencia de mensajes que venía corriendo está en modo
// 'asistido', además de pausar se avisa al dueño y MaKo deja un BORRADOR con la
// respuesta sugerida para aprobar con un clic. Es la fase 1 acordada: se
// automatizan los primeros audios y la conversación la sigue un humano.
// `opts.linea`: por qué línea de WhatsApp escribió el lead (la instancia del webhook). El borrador
// del modo asistido le contesta por ESA: es el número con el que venía hablando.
// `opts.origen`: por dónde llegó. Sólo importa para el aviso de una charla que el setter ya no
// sigue (#788): por el oficial, el webhook de Chatwoot avisa CADA mensaje por su cuenta, y un
// segundo aviso sería ruido; por el no oficial, ése es el único aviso que hay.
export async function pausarPorRespuesta(leadId: number, opts?: { texto?: string; linea?: string | null; origen?: 'no_oficial' | 'oficial' }): Promise<number> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('nutricion_inscripciones')
    .update({ estado: 'respondio', proximo_envio_at: null, updated_at: ahoraISO() })
    .eq('lead_id', leadId)
    .eq('estado', 'activa')
    .select('id, secuencia_id');
  if (error) throw new Error(`pausarPorRespuesta: ${error.message}`);
  const pausadas = (data ?? []) as Array<{ id: number; secuencia_id: number }>;

  // RESPUESTA A UNA SECUENCIA QUE YA TERMINÓ (#788). Una inscripción 'completada' sin
  // desenlace ya mandó todo y está esperando: o contesta o vence el silencio. Si contesta
  // y acá no se anota, doce horas después `evaluarDesenlaces` la da por fallida — la pasa
  // a no_responde, mueve al lead y le avisa al dueño «le escribí N veces y no contestó»
  // sobre alguien que SÍ contestó. Se anota como 'respondio', igual que una activa.
  //
  // ⚠️ SÓLO SI LE SALIÓ ALGO. Una 'completada' también puede ser una que se cerró SIN
  // mandar nada (la reunión ya pasó, el tope de antigüedad): ahí no hay nada que el lead
  // esté contestando, y marcarla 'respondio' la daría por lograda sin haber hecho nada.
  let tardias: Array<{ id: number; secuencia_id: number }> = [];
  try {
    const { data: comp } = await supabase
      .from('nutricion_inscripciones')
      .select('id, secuencia_id')
      .eq('lead_id', leadId).eq('estado', 'completada').is('desenlace', null);
    const completadas = (comp ?? []) as Array<{ id: number; secuencia_id: number }>;
    if (completadas.length) {
      const { enviosPorInscripcion } = await import('@/lib/nutricion-envios-resumen');
      const salio = await enviosPorInscripcion(supabase, completadas.map((c) => c.id));
      const conEnvio = completadas.filter((c) => salio.has(c.id));
      if (conEnvio.length) {
        const { data: upd } = await supabase
          .from('nutricion_inscripciones')
          .update({ estado: 'respondio', updated_at: ahoraISO() })
          .in('id', conEnvio.map((c) => c.id))
          .eq('estado', 'completada').is('desenlace', null)   // compare-and-set: nadie la movió entre medio
          .select('id, secuencia_id');
        tardias = (upd ?? []) as Array<{ id: number; secuencia_id: number }>;
      }
    }
  } catch (e) { console.error(`[nutricion] respuesta a secuencia terminada, lead ${leadId}:`, e); }

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

  // Best-effort y en segundo plano conceptual: que un fallo del asistido NUNCA
  // rompa el webhook (el lead ya quedó despausado, que es lo crítico).
  const respondidas = [...pausadas, ...tardias];
  try {
    const charla = await charlaDelLead(leadId);
    // LA PRIMERA RESPUESTA, con las mismas guardas que la charla abierta (#788): una
    // respuesta tardía a una secuencia cuya charla se cerró, o cuya reunión ya pasó, no
    // redacta con el guion de «preparar» para una llamada que no existe.
    const ids = new Set(respondidas.map((p) => p.id));
    const atendibles = charla.inscs.filter((i) => ids.has(i.id) && atiendeAlResponder(i));
    let atendida = false;
    if (atendibles.length) {
      atendida = await asistirRespuesta(leadId, atendibles.map((i) => i.secuencia_id), opts?.texto, opts?.linea ?? null);
    }
    // DEL SEGUNDO MENSAJE EN ADELANTE no hay inscripción activa: la charla se busca (#788).
    if (!atendida) await seguirCharla(leadId, charla, opts?.texto, opts?.linea ?? null, opts?.origen ?? 'oficial');
  } catch (e) { console.error(`[nutricion] modo asistido lead ${leadId} falló:`, e); }
  return respondidas.length;
}

/**
 * Todo lo que el setter necesita saber de las inscripciones de un lead para decidir si
 * contesta (#788): qué secuencias son asistidas, si están pausadas, si les salió algo, y
 * si la reunión que preparan sigue por delante. UNA lectura por cosa, compartida por la
 * primera respuesta y por la charla abierta.
 */
async function charlaDelLead(leadId: number): Promise<{ inscs: InscCharla[]; nombre: string | null }> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase
    .from('nutricion_inscripciones')
    .select('id, secuencia_id, estado, desenlace, updated_at, conversacion_ultima_at, conversacion_cerrada_at')
    .eq('lead_id', leadId);
  if (error) throw new Error(`charlaDelLead: ${error.message}`);
  const filas = (data ?? []) as Array<{
    id: number; secuencia_id: number; estado: string; desenlace: string | null;
    updated_at: string | null; conversacion_ultima_at: string | null; conversacion_cerrada_at: string | null;
  }>;
  if (!filas.length) return { inscs: [], nombre: null };

  const [{ parseEstrategia: parse }, { enviosPorInscripcion }] = await Promise.all([
    import('@/lib/setting-estrategia'),
    import('@/lib/nutricion-envios-resumen'),
  ]);
  const secs = new Map((await getSecuenciasConStats()).map((s) => [s.id, s]));
  const salio = await enviosPorInscripcion(supabase, filas.map((f) => f.id));
  const { data: leadRow } = await supabase
    .from('leads').select('nombre, junta_1_at, fecha_junta_1, junta_2_at, fecha_junta_2').eq('id', leadId).maybeSingle();
  const juntas = leadRow as (JuntasLead & { nombre?: string | null }) | null;
  const hayReunion = reunionFuturaMs(juntas) != null;
  return {
    nombre: juntas?.nombre ?? null,
    inscs: filas.map((f) => {
      const sec = secs.get(f.secuencia_id);
      return {
        ...f,
        tieneEnviado: salio.has(f.id),
        // Una archivada no está en `secs`: no es asistida de nadie.
        asistida: !!sec && parse(sec.estrategia)?.modo === 'asistido',
        pausada: !sec || !sec.activa,
        reunionFutura: sec && preparaUnaReunion(sec.trigger_tipo) ? hayReunion : null,
      };
    }),
  };
}

/**
 * El lead escribió y no hubo primera respuesta que atender: ¿hay una charla del setter que
 * seguir? (#788). La decisión es `conversacionAbierta` (lib/setter-conversacion.ts).
 *
 * Si la charla está cerrada (la sigue una persona, terminó, venció, la secuencia está
 * pausada o la reunión pasó), el setter no contesta, el borrador que había quedado de un
 * mensaje anterior se descarta —ya no contesta lo último—, y se le EXPLICA al dueño por
 * qué: una vez por lead cada 12 h, no una por mensaje. Sin ese aviso, por el no oficial el
 * lead escribía y nadie se enteraba.
 */
async function seguirCharla(
  leadId: number, charla: { inscs: InscCharla[]; nombre: string | null },
  texto: string | undefined, linea: string | null, origen: 'no_oficial' | 'oficial',
): Promise<void> {
  if (!charla.inscs.length) return;
  const v = conversacionAbierta(charla.inscs, Date.now());
  if (v.abierta) {
    await asistirRespuesta(leadId, [v.insc.secuencia_id], texto, linea);
    return;
  }
  if (!v.motivo) return;
  const { descartarBorradorSetter } = await import('@/lib/evolution-envio');
  await descartarBorradorSetter(leadId).catch((e) => console.error(`[nutricion] descartar el borrador del lead ${leadId}:`, e));
  if (origen !== 'no_oficial') return;
  const { emitirDelCatalogo } = await import('@/lib/avisos');
  const quien = charla.nombre?.trim() || `lead ${leadId}`;
  await emitirDelCatalogo('wa-mensaje-entrante', {
    ws: (await getWorkspaceActual()) ?? undefined,
    dedupKey: `lead:${leadId}:charla-cerrada`,
    dedupTtlMin: 60 * 12,
    texto: `💬 *${quien} te escribió.*${texto?.trim() ? `\n\n_"${texto.trim().slice(0, 180)}"_` : ''}\n\nNo le preparé respuesta: ${v.motivo}. Contéstale tú.\n\n— MaKo`,
  });
}

/**
 * Modo asistido: avisa al dueño que el lead respondió y le deja el borrador de
 * respuesta que redactó MaKo con la secuencia de mensajes (mismo cerebro del simulador).
 * Devuelve false (sin hacer nada) si ninguna de las secuencias es 'asistido'.
 */
async function asistirRespuesta(leadId: number, secuenciaIds: number[], texto?: string, lineaEntrante: string | null = null): Promise<boolean> {
  const { parseEstrategia } = await import('@/lib/setting-estrategia');
  const secs = await getSecuenciasConStats();
  // La secuencia de mensajes asistida más específica que venía corriendo para este lead.
  const secuencia = secs.find((s) => secuenciaIds.includes(s.id) && parseEstrategia(s.estrategia)?.modo === 'asistido');
  if (!secuencia) return false;

  const supabase = await getTenantDb();
  const { data: leadRow } = await supabase.from('leads').select('id, nombre, telefono, calificado').eq('id', leadId).maybeSingle();
  const lead = leadRow as { id: number; nombre: string | null; telefono: string | null; calificado: boolean | null } | null;
  const linea = lineaEntrante ?? secuencia.instance_name;
  const { descartarBorradorSetter } = await import('@/lib/evolution-envio');
  const descartarViejo = () => descartarBorradorSetter(leadId).catch((e) => { console.error(`[nutricion] descartar el borrador del lead ${leadId}:`, e); return 0; });

  // LA CHARLA DE VERDAD, no un turno suelto (#360, #361). Con un solo turno el corte por
  // insistencia no podía dar nunca (exige tres mensajes del lead) y el setter repreguntaba
  // lo que ya le habían contestado. Se lee la charla por la línea a la que escribió; si la
  // lectura falla, se sigue con el mensaje de hoy, como antes.
  const { historialDeMensajes, conTurnoActual, ultimoEntranteMs, TURNOS_DE_CONTEXTO } = await import('@/lib/setter-conversacion');
  const { mensajesRecientesDelLead } = await import('@/lib/wa-historial');
  const filas = await mensajesRecientesDelLead(leadId, { limite: TURNOS_DE_CONTEXTO + 5, linea: lineaEntrante });
  const historial = conTurnoActual(historialDeMensajes(filas ?? []), texto);
  // Cuándo entró el mensaje que se está contestando: si antes de guardar el borrador entró
  // otro más nuevo, esta redacción ya no contesta lo último (ver abajo, paso 2).
  const respondeA = ultimoEntranteMs(filas);

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
    // El borrador que había quedado de un mensaje anterior ya no contesta lo último: ahora
    // contesta una persona, y aprobarlo sería mandarle algo fuera de tiempo (#788).
    await descartarViejo();
    await registrarHandoff({
      leadId, secuenciaId: secuencia.id,
      mensaje: texto?.trim() || '(el lead respondió sin texto)',
      motivo: clas.motivo,
      leadNombre: lead?.nombre, secuenciaNombre: secuencia.nombre,
    });
    return true;
  }

  // El intercambio cuenta para la ventana de la charla (#788): siete días desde ACÁ.
  await supabase.from('nutricion_inscripciones')
    .update({ conversacion_ultima_at: ahoraISO() })
    .eq('lead_id', leadId).eq('secuencia_id', secuencia.id);

  // 1) MaKo redacta la respuesta (import dinámico: setting-simulador importa
  //    este módulo, un import estático cerraría el ciclo). Con el caso en el que encajó
  //    (#358: su `comoResponder` guía el borrador) y el lead (#361: su formulario).
  let sugerida: string | null = null;
  let cierre: 'fin_bien' | 'fin_mal' | 'insistencia' | null = null;
  // Por qué NO hay borrador, para decirlo en el aviso (#380). Antes el fallo se tragaba
  // en un `catch {}` y el dueño recibía «respondió» sin borrador y sin saber por qué.
  let sinBorrador = '';
  try {
    const { responderSimulador } = await import('@/lib/setting-simulador');
    const r = await responderSimulador(secuencia.id, historial, {
      leadId, escenario: clas.escenario, tema: 'redactar la respuesta a tu lead',
    });
    if (r.ok) { sugerida = r.respuesta; cierre = r.cierre; }
    else sinBorrador = r.error;
  } catch (e) {
    sinBorrador = e instanceof Error ? e.message.slice(0, 200) : 'falló la redacción';
  }
  // Sin redacción nueva, el borrador de un mensaje anterior queda contestando otra cosa.
  if (!sugerida) await descartarViejo();

  // ¿ENTRÓ UN MENSAJE MÁS NUEVO MIENTRAS SE REDACTABA? (#788) Dos mensajes seguidos disparan
  // dos redacciones en paralelo, y la del primero podía guardar su borrador DESPUÉS de la del
  // segundo: quedaba la respuesta al mensaje viejo. Se relee antes de guardar, y si hay algo
  // más nuevo se sale sin tocar nada — la redacción de ese mensaje se encarga, y avisa ella.
  if (sugerida && respondeA != null) {
    const ahora = await mensajesRecientesDelLead(leadId, { limite: 3, linea: lineaEntrante });
    const masNuevo = ultimoEntranteMs(ahora);
    if (masNuevo != null && masNuevo > respondeA) return true;
  }

  // 2) UN borrador por lead para aprobar con un clic (misma bandeja que el resto): si ya
  //    había uno pendiente, se reemplaza (#788).
  let borradorOk = false;
  let borradorId: number | null = null;
  if (sugerida && lead?.telefono) {
    const { guardarBorradorSetter } = await import('@/lib/evolution-envio');
    const g = await guardarBorradorSetter({
      leadId, telefono: lead.telefono, texto: sugerida, secuenciaId: secuencia.id,
      // Por la línea a la que escribió el lead; si no se sabe (vino por el oficial), la de la
      // secuencia. Sin esto salía por la de por default: un número que ese lead no conoce.
      linea,
    });
    borradorOk = g.ok;
    if (g.ok) borradorId = g.id;
    else sinBorrador = `no se guardó el borrador (${g.error.slice(0, 120)})`;
  } else if (sugerida && !lead?.telefono) {
    sinBorrador = 'el lead no tiene teléfono cargado';
  }

  // 3) LA CHARLA TERMINÓ (#360): el lead aceptó, dijo que no, o repitió por tercera vez la
  //    misma objeción. Se anota y no se vuelve a abrir sola: el próximo mensaje de este lead
  //    lo contesta una persona (y el aviso lo explica).
  if (cierre) {
    await supabase.from('nutricion_inscripciones')
      .update({ conversacion_cierre: cierre, conversacion_cerrada_at: ahoraISO() })
      .eq('lead_id', leadId).eq('secuencia_id', secuencia.id);
    try {
      const { logLeadEvent } = await import('@/lib/leads');
      const porque = cierre === 'fin_bien' ? 'el lead aceptó' : cierre === 'fin_mal' ? 'el lead dijo que no' : 'repitió la misma objeción por tercera vez';
      await logLeadEvent(leadId, 'Setting', `MaKo cerró la charla: ${porque}`, 'MaKo');
    } catch { /* el historial es un extra: el cierre ya quedó */ }
  }

  // 4) ¿Califica? (reunión 31/07: ninguna llamada con no calificados). Si hay
  //    evidencia de descalificación, se marca el lead y se AVISA para cancelar
  //    la reunión — cancelarla sola sería una acción externa irreversible.
  //
  // ⚠️ SÓLO SI NADIE LO DECIDIÓ TODAVÍA. Con la charla abierta esto corre en CADA mensaje, y
  // pisaba el «calificado» que una persona fijó en el CRM. Si ya tiene valor no se evalúa, y
  // el update es compare-and-set sobre el null por si alguien lo fijó entre medio.
  let alertaDescalifica = '';
  try {
    const { evaluarCalificacion } = await import('@/lib/setting-simulador');
    const ev = lead?.calificado == null ? await evaluarCalificacion(secuencia.id, historial, { leadId }) : { califica: null, razon: '' };
    const { data: marcado } = ev.califica === false
      ? await supabase.from('leads').update({ calificado: false, updated_at: ahoraISO() }).eq('id', leadId).is('calificado', null).select('id')
      : { data: [] };
    if (ev.califica === false && (marcado ?? []).length) {
      const { logLeadEvent } = await import('@/lib/leads');
      await logLeadEvent(leadId, 'Setting', `MaKo lo marcó NO calificado por la charla: ${ev.razon}`, 'MaKo');
      alertaDescalifica = `\n\n⚠️ *No califica* (${ev.razon}). Lo marqué en el CRM. Si tiene reunión agendada, conviene cancelarla — te dejo la decisión a ti.`;
    }
  } catch { /* la calificación es un extra: nunca bloquea el aviso */ }

  // 5) Aviso al dueño — el único que pidió Mauricio: "avisame si responden".
  //
  // El `ws` va EXPLÍCITO. Sin él, emitirAviso cae a OWNER_WS: el lead de un
  // cliente respondía y el aviso le llegaba al grupo de la AGENCIA en vez de al
  // del cliente — que además no se entera de que le contestaron.
  const { emitirDelCatalogo } = await import('@/lib/avisos');
  const quien = lead?.nombre?.trim() || `lead ${leadId}`;
  // 4.5) ¿SALE SOLA? (#787) Sólo en los casos que lo tienen prendido y si pasa cada puerta de
  //      `puedeContestarSolo`. Va DESPUÉS de la calificación: a un lead que la charla acaba
  //      de descalificar no se le contesta solo. Se manda el MISMO borrador (enviarBorrador lo
  //      reclama de forma atómica): si el setter lo aprueba a mano en paralelo, sale uno solo.
  let contestado = false;
  let porQueNoSolo: string | null = null;
  if (borradorOk && borradorId != null && sugerida && lead?.telefono && clas.escenario.contestaSolo === true && !alertaDescalifica) {
    try {
      const { puedeContestarSolo } = await import('@/lib/setter-conversacion');
      const desde = new Date(Date.now() - 24 * 3_600_000).toISOString();
      const [envioOn, bloqueado, automaticas, tz] = await Promise.all([
        envioWhatsappHabilitado().catch(() => false),
        estaBloqueado(lead.telefono).catch(() => true),
        supabase.from('wa_borradores').select('id', { count: 'exact', head: true })
          .eq('lead_id', leadId).eq('enviado_por', 'mako-auto').gte('enviado_at', desde)
          .then((r) => (r.error ? Number.POSITIVE_INFINITY : (r.count ?? 0))),
        tzActual().catch(() => TZ_DEFAULT),
      ]);
      const hora = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()));
      const d = puedeContestarSolo({
        escenario: clas.escenario, texto: sugerida, cierre, envioHabilitado: envioOn,
        automaticasUltimas24h: automaticas, horaLocal: hora, bloqueado,
      });
      if (d.ok) {
        const { enviarBorrador } = await import('@/lib/evolution-envio');
        const env = await enviarBorrador(borradorId, 'mako-auto');
        contestado = env.ok;
        if (!env.ok) porQueNoSolo = `no salió (${(env.error ?? '').slice(0, 120)})`;
      } else {
        porQueNoSolo = d.motivo;
      }
    } catch (e) {
      porQueNoSolo = `no pude decidir si salía solo (${e instanceof Error ? e.message.slice(0, 120) : 'error'})`;
    }
  }

  const borrador = contestado && sugerida
    ? `\n\nLe contesté solo (caso «${clas.escenario.titulo}»):\n${sugerida.slice(0, 300)}`
    : borradorOk && sugerida
      ? `\n\n${cierre === 'insistencia' || cierre === 'fin_mal' ? 'Te dejé la despedida lista para aprobar' : 'Te dejé un borrador listo para aprobar'}${porQueNoSolo ? ` (no lo mandé solo: ${porQueNoSolo})` : ''}:\n${sugerida.slice(0, 300)}`
      : sinBorrador ? `\n\nNo pude dejarte un borrador: ${sinBorrador}` : '';
  await emitirDelCatalogo('wa-mensaje-entrante', {
    ws: (await getWorkspaceActual()) ?? undefined,
    texto: `💬 *${quien} respondió* a la secuencia de mensajes «${secuencia.nombre}».${texto?.trim() ? `\n\n_"${texto.trim().slice(0, 180)}"_` : ''}${borrador}${alertaDescalifica}\n\n— MaKo`,
  });
  return true;
}
