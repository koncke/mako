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
import { LLENA_EL_FLUJO } from '@/lib/api-mako/flujo-params';
import { getVslEngagementMap } from '@/lib/leads';
import { pipelineStageOf } from '@/lib/pipeline';
import { sendWhatsappTemplate } from '@/lib/chatwoot';
import { valoresVariablesLead, aplicarVariables } from '@/lib/template-vars';
import { sanearHtmlEmail, textoDeHtmlEmail, aplicarVariablesHtml, cuerpoHtmlAGuardar, cuerpoHtmlEntrante, problemaDeCuerpoHtml } from '@/lib/email-html-seguro';
import { sendEmail, renderEmailHtml, buildUnsubscribeUrl, remitenteEsSandbox, getEmailFrom, displayNameDe } from '@/lib/resend';
import { envioEmailHabilitado, envioWhatsappHabilitado } from '@/lib/envio-flags';
import { listarLineas, sondearSocket, type LineaRow } from '@/lib/evolution';
import { lineaPorDefault, elegirLinea } from '@/lib/lineas-whatsapp';
import { canalNoOficial, proveedorDelPaso, textoDelPaso, type CanalNoOficial } from '@/lib/nutricion-canal';
// Sólo el TIPO: el valor se importa dinámico adentro del motor (ciclo vía nutricion-generator).
import type { AutorTexto } from '@/lib/paso-ia';
import { parseEstrategia, dentroDeAntiguedad, hitoYaHecho, type EscenarioSecuencia } from '@/lib/setting-estrategia';
import type { TurnoSim } from '@/lib/setting-simulador';
import { conversacionAbierta, atiendeAlResponder, charlaPasaAUnaPersona, type InscCharla } from '@/lib/setter-conversacion';
import { ambitoDeSecuencia, filtroDeAmbito, type AmbitoFunnel } from '@/lib/nutricion-ambito';
import { secuenciasDeEtapa, secuenciasDeEntrega, secuenciasDeEtiqueta, TRIGGER_ETAPA, TRIGGER_ENTREGA, TRIGGER_ETIQUETA } from '@/lib/nutricion-etapa';
import { TRIGGER_RESIDUO, RESIDUO_POR_CORRIDA } from '@/lib/nutricion-residuo';
import { cohorteResiduo, residuoVigente, horariosResiduo } from '@/lib/nutricion-residuo-cohorte';
import { sanearCron, type CronAviso } from '@/lib/cron-aviso';
import { decidirAgenda } from '@/lib/nutricion-agenda';
import { tzActual, TZ_DEFAULT, KEY_TIMEZONE } from '@/lib/timezone';
import { esLeadCliente, enviarYEspejar, enviarAudioYEspejar, enviarMediaYEspejar, crearBorrador, tieneBorradorNutriPendiente, tieneBorradorPendienteDePaso } from '@/lib/evolution-envio';
import { getAudio, audioBase64 } from '@/lib/setting-audios';
import { estaBloqueado } from '@/lib/evolution-block';
import { estadoDraftPorNombre } from '@/lib/meta-templates';
import {
  reunionFuturaMs, reunionQuePreparaMs, inscripcionReusable, marcasPorInscripcion, reactivarInscripcion,
  ESTADOS_TERMINADOS, SIN_MARCAS, type JuntasLead, type FilaPrevia,
} from '@/lib/nutricion-reinscripcion';
import { decidirInscripcionManual, type PorQueNoSeInscribio } from '@/lib/nutricion-inscripcion-manual';
import { esPasoAccion, sanearAccion, correrPasoAccion, type AccionDelPaso } from '@/lib/nutricion-paso-accion';
import {
  normalizar, validarGrafo, claseDe, idDe, indicePorId, raizRespuesta, raizSalida, antiguedadDeEntrada, elegirSalida,
  escenariosDeRespuesta, nodoPorId, siguienteDe, TOPE_NODOS, HILO_PRINCIPAL, TOPE_HILOS, raicesSalida,
  type Espera, type RamaCondicion, type CasoRespuesta, type DestinoIrA, type HechosLead, type PasoGrafo, type FilaCondicion,
} from '@/lib/flujo-grafo';
import { OP_AVISAR, puedePisarFlujo } from '@/lib/flujo-legado';
import {
  indiceActual, siguienteIndice, resolverControl, necesitaHechos, alcanzablesDesde, esPrimerPaso, minutosAntesDeReunion,
  saleSolo, siguienteSin, siguienteCon, hechosDeLead, esTablaInexistente, mediaDeAdjunto, camposDelFlujo, pasoDeEntrada,
  esNodoDeControl, RELLENO_CONTROL, TOPE_SALTOS, esColumnaInexistente, etiquetasQueCuentan, barridoInscribe, irAEstaMisma,
  avisoSalio, frenadoPorAntiBan, anotarEnCorrida, zonaDelMotor, dentroDeVentanaEn,
  filasDelFlujo, catalogoDeLead, resumenCursoDeAlumno, resumenPagos,
  type FilaHechos, type RecientesPorCanal, type EnviadoEnCorrida, type FilaLeadCatalogo,
} from '@/lib/nutricion-grafo-motor';
import { fuentesDeFilas, etapasEntregaDeFilas, normalizarTexto, type Fuente, type HechosCatalogo } from '@/lib/condiciones-catalogo';
import { hoyEnTz } from '@/lib/date-utils';
import { getSetting } from '@/lib/settings';
import {
  sanearHilos, planDePosicion, hiloSigueEn, hilosIniciales, aplicarAHilo, hilosVencidos, hilosNuevos, repartosDe,
  hayOtrosHilos, nodosDeLaFila, esFilaNueva, proximoDeEntrada, mensajeAnteriorDe, estadoDeCierrePermanente, vuelveALaCola,
  type Hilo, type LeidoPosicion,
} from '@/lib/nutricion-hilos';
import { getAdjunto, adjuntoBase64 } from '@/lib/setting-adjuntos';

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
  // 'media' (08/10/2026, punto 8: «que se pueda adjuntar archivos»): una foto, un video o un
  // documento de la biblioteca (`setting_adjuntos`, mig 0225), por REFERENCIA (`media_id`) y
  // con el `cuerpo` como pie. Sólo por el no oficial: una plantilla de Meta no lleva un
  // archivo arbitrario, y eso se rechaza al guardar, no se degrada a texto.
  tipo?: 'texto' | 'audio' | 'ia' | 'media';
  audio_id?: number | null;
  media_id?: number | null;
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
  /**
   * Sólo email (tercera tanda, 09/10/2026, decisión 12): el cuerpo escrito con el editor rico, en
   * HTML SANEADO (`sanearHtmlEmail`, lib/email-html-seguro.ts). Si está, el motor lo manda como el
   * cuerpo del correo y `cuerpo` es su TEXTO PLANO (`textoDeHtmlEmail`), que va como parte de texto
   * y es lo que leen la tarjeta y el resto de la app. Lo decide `setSecuenciaPasos`, nadie más. Un
   * email sin este campo (los de antes) sale como siempre, con `cuerpo` y sus marcas.
   */
  cuerpo_html?: string | null;
  proveedor?: ProveedorWa;                    // whatsapp: 'oficial' (plantilla/Chatwoot) | 'no_oficial' (Evolution)
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
  // ── EL FLUJO CON RAMAS (08/10/2026) ──────────────────────────────────────────
  // Cada paso es un NODO de un grafo. Todos opcionales: una secuencia de antes, sin ninguno,
  // ES un grafo lineal sin convertir nada. Qué significa cada uno, en lib/flujo-grafo.ts.
  /** Identidad estable del nodo. Sin ella, `o<índice>` (lo mismo que leía `paso_actual`). */
  id?: string;
  /** A qué nodo sigue. Ausente = el elemento siguiente del array; null = termina. */
  siguiente?: string | null;
  /**
   * La clase cuando no es un mensaje ni una acción. Sale del modelo (`PasoGrafo['nodo']`) y no se
   * copia a mano: la copia no conocía 'inicio' (el CRON con flechas en paralelo) y el tipo dejaba
   * de compilar en cuanto el modelo sumó una clase.
   */
  nodo?: PasoGrafo['nodo'];
  /** Mensaje, acción, espera e inicio: lo que arranca A LA VEZ cuando esta tarjeta termina (lib/flujo-grafo.ts). */
  paralelos?: string[];
  espera?: Espera;
  ramas?: RamaCondicion[];
  casos?: CasoRespuesta[];
  si_no?: string | null;
  /** Condición (cuarta tanda, punto 8): las flechas en paralelo del «Si no» (las de cada rama van en la rama). */
  paralelos_si_no?: string[];
  destino?: DestinoIrA | null;
  /** «Sale sola» POR MENSAJE: true = borrador, false = sale, ausente = lo de la secuencia. */
  revisar?: boolean;
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
  /**
   * Con `trigger_tipo = 'etiqueta_puesta'`: la etiqueta (`crm_etiquetas.id`) que la dispara
   * (mig 0223). `null` en todas las demás.
   */
  etiqueta_id: number | null;
};

/** Una fila de `nutricion_secuencias` como la leen las dos lecturas de abajo. */
type FilaSecuencia = {
  id: number; clave: string; nombre: string; etapa: string;
  trigger_tipo: string; activa: boolean; pasos: unknown; estrategia: unknown; producto_id: number | null;
  funnel_id: number | null; cron: unknown; cron_proxima_at: string | null; instance_name: string | null; etiqueta_id: number | string | null;
};

// % de retención del VSL a partir del cual consideramos "lo vio en serio".
export const UMBRAL_VSL_PCT = 50;
// No inscribir leads más viejos que esto (días) — evita revivir cohortes muertas.
const VENTANA_DIAS = 30;

// ── Rate-limiter / anti-baneo de WhatsApp (defaults conservadores; override por env) ──
// El envío REAL de cada canal se decide POR WORKSPACE (lib/envio-flags.ts): un
// canal apagado deja sus pasos ESPERANDO (reintento en 24h, sin enviar ni avanzar).
// ⚠️ LOS DOS TOPES SON DE WHATSAPP, NO DE «LOS MENSAJES» (decisión 5 de la segunda tanda,
// 08/10/2026). Son el presupuesto anti-ban de la LÍNEA: un email no la quema, y contándolos
// juntos, una secuencia de email en paralelo se comía el cupo del WhatsApp del mismo negocio.
const MAX_POR_DIA = Number(process.env.NUTRICION_MAX_POR_DIA ?? '40');        // tope en 24h móviles (por workspace)
const MAX_POR_CORRIDA = Number(process.env.NUTRICION_MAX_POR_CORRIDA ?? '6'); // tope por corrida del cron
// El tope DIARIO del email, aparte. Su porqué no es el ban de una línea: el email de nutrición
// sale por Resend con el remitente del negocio, y un envío masivo de golpe es lo que hunde la
// reputación de ese dominio (los mails empiezan a caer en spam, incluidos los transaccionales).
// 100 por día por negocio es holgado para una nutrición (medido el 08/10/2026: nunca salió un
// email por nutrición) y corta un bucle o una cohorte mal puesta antes de que dañe el dominio.
const MAX_EMAIL_POR_DIA = Number(process.env.NUTRICION_MAX_EMAIL_POR_DIA ?? '100');
const HS_MIN_ENTRE_MSGS = 20;     // no mandar 2 mensajes al mismo lead en <20h (prospección fría)
// Excepción del guard anterior (reunión 31/07): con una reunión encima, la
// cadencia de preparación exige toques cercanos ("si chateo dos veces y le mando
// un audio, ya no falta"). El presupuesto anti-ban de una CONVERSACIÓN abierta o
// de un lead con reunión próxima no es el de la prospección fría.
const HS_MIN_PREPARACION = 3;
const HS_REUNION_CERCA = 48;      // reunión dentro de este plazo → cadencia de preparación
// La ventana horaria se evalúa en la zona del NEGOCIO (`mako.timezone`, decisión 6 de la segunda
// tanda); sin zona, Ciudad de México, que es lo que hacía `TZ_OFFSET_MX` (`zonaDelMotor`).
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
    .select('id, clave, nombre, etapa, trigger_tipo, activa, pasos, estrategia, funnel_id, producto_id, cron, cron_proxima_at, instance_name, etiqueta_id')
    .eq('activa', true)
    // Archivada nunca enrola ni envía, aunque haya quedado con activa=true.
    .is('archivada_at', null);
  if (error) throw new Error(`getSecuenciasActivas: ${error.message}`);
  const rows = (data ?? []) as FilaSecuencia[];
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
    etiqueta_id: r.etiqueta_id == null ? null : Number(r.etiqueta_id),
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
    .select('id, clave, nombre, etapa, trigger_tipo, activa, pasos, estrategia, funnel_id, producto_id, cron, cron_proxima_at, instance_name, etiqueta_id')
    // Las archivadas no se listan, no enrolan y no envían. No se borran porque
    // las inscripciones y los envíos las referencian: borrarlas se llevaría
    // puesto el historial de a quién se le escribió.
    .is('archivada_at', null)
    .order('id', { ascending: true });
  if (error) throw new Error(`getSecuenciasConStats: ${error.message}`);
  const rows = (data ?? []) as FilaSecuencia[];

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
    etiqueta_id: r.etiqueta_id == null ? null : Number(r.etiqueta_id),
    inscriptos: inscMap.get(r.id) ?? 0,
    enviados: envMap.get(r.id) ?? 0,
  }));
}

/**
 * ¿Se puede ACTIVAR esta secuencia? Lo guardado pasa por las mismas validaciones que Publicar
 * (`setSecuenciaPasos` con `soloValidar`), sin escribir nada; si no pasa, tira `PasosInvalidosError`
 * con «No se activó:» y el primer error en palabras.
 *
 * ⚠️ EXPORTADA PARA QUE QUIEN PROPONE ACTIVAR LO SEPA ANTES DE DEJAR LA PENDIENTE
 * (`proponer_toggle_nutricion`, lib/mako-doer-acciones.ts: el doer de WhatsApp, la API y un paso
 * «⚡ Acción»). Validar sólo al ejecutar consumía el «sí» y después lo rechazaba: confirmar RECLAMA
 * la pendiente antes de correr, y lo reclamado no vuelve a 'pendiente' (regla 3 de la API de MaKo,
 * AGENTS.md; revisión del 09/10/2026).
 */
export async function validarActivacion(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { data, error: eLeer } = await supabase.from('nutricion_secuencias').select('pasos').eq('id', id).maybeSingle();
  if (eLeer) throw new Error(`validarActivacion: ${eLeer.message}`);
  const guardados = (data as { pasos?: unknown } | null)?.pasos;
  try {
    await setSecuenciaPasos(id, Array.isArray(guardados) ? (guardados as PasoSecuencia[]) : [], { soloValidar: true });
  } catch (e) {
    if (e instanceof PasosInvalidosError) throw new PasosInvalidosError(e.message.replace(/^No se guardó:/, 'No se activó:'));
    throw e;
  }
}

/**
 * Prende o apaga una secuencia.
 *
 * ⚠️ ACTIVAR VALIDA LO MISMO QUE PUBLICAR (decisión 15 de la segunda tanda, 08/10/2026): lo
 * guardado pasa por las mismas validaciones de `setSecuenciaPasos` —`validarGrafo`, la acción sin
 * elegir o incompleta, el archivo sin archivo, el «Ir a» a sí misma— sin escribir nada, y una que
 * no pasa se rechaza con el primer error en palabras (`PasosInvalidosError`: la ruta contesta 400).
 * Sin esto, «Activar» prendía un flujo que «Publicar» no habría dejado guardar (uno escrito por un
 * camino viejo, o anterior a una regla nueva), y el motor lo corría a ciegas. Apagar no valida.
 */
export async function setSecuenciaActiva(id: number, activa: boolean): Promise<void> {
  const supabase = (await getTenantDb());
  // La red de seguridad: quien PROPONE activar ya validó (`validarActivacion`), pero entre la
  // propuesta y el «sí» los pasos pueden haber cambiado.
  if (activa) await validarActivacion(id);
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

/**
 * Lo que se intentó guardar no es un flujo válido (una acción sin elegir, un archivo sin el
 * archivo, una tarjeta suelta, un destino que no existe). Es un error del QUE GUARDA y no de la
 * base: las rutas lo contestan 400 con el mensaje, que es lo que la pantalla muestra.
 */
export class PasosInvalidosError extends Error {
  constructor(m: string) { super(m); this.name = 'PasosInvalidosError'; }
}

/**
 * Por qué un paso de ARCHIVO no se puede guardar, o null si se puede. Una combinación imposible
 * es una validación al guardar, no una degradación (AGENTS.md): un archivo por la vía oficial
 * necesitaría una plantilla de Meta que no existe, y guardado como texto saldría un mensaje que
 * nadie escribió.
 */
function problemaDeMedia(p: PasoSecuencia): string | null {
  if (p.tipo !== 'media' || esNodoDeControl(camposDelFlujo(p))) return null;
  if (!(Number(p.media_id) > 0)) return 'es un archivo y no tiene el archivo elegido';
  if (p.canal === 'email') return 'es un archivo y los archivos sólo salen por WhatsApp';
  if (proveedorDelPaso(p) !== 'no_oficial') return 'es un archivo y por el WhatsApp oficial no se manda un archivo suelto';
  return null;
}

export async function setSecuenciaPasos(id: number, pasos: PasoSecuencia[], o?: { soloValidar?: boolean }): Promise<void> {
  const supabase = (await getTenantDb());

  // Lo que ya está guardado, para MERGEAR los campos que ninguna pantalla edita.
  //
  // Esta función reconstruye cada paso campo por campo, así que lo que el cliente
  // no mande se BORRA. Las variantes las genera MaKo una sola vez al armar la
  // secuencia y no viven en ningún formulario: sin este merge, guardar el copy
  // desde el wizard o desde el editor las borraba todas en silencio, y el motor
  // volvía a mandar el mismo texto a todo el mundo sin que nadie se enterara.
  //
  // ⚠️ EL MERGE ES POR EL ID DEL NODO, NO POR `orden`. Con el flujo con ramas el lienzo inserta
  // tarjetas en el medio: por orden, la tarjeta nueva heredaba las variantes de la que estaba
  // en su lugar. Un paso sin id es `o<índice>` de los dos lados, que es exactamente el merge por
  // orden de siempre.
  const { data: previo } = await supabase
    .from('nutricion_secuencias').select('pasos').eq('id', id).maybeSingle();
  const antes = Array.isArray((previo as { pasos?: unknown } | null)?.pasos)
    ? ((previo as { pasos: PasoSecuencia[] }).pasos)
    : [];
  const variantesPrevias = new Map<string, string[]>();
  antes.forEach((p, i) => {
    if (p && Array.isArray(p.variantes) && p.variantes.length) variantesPrevias.set(idDe(p, i), p.variantes);
  });
  // El cuerpo HTML de un email (tercera tanda): lo conserva SÓLO el escritor que no lo manda y no
  // tocó el texto (`cuerpoHtmlEntrante`). Mismo merge por id del nodo que las variantes.
  const emailsPrevios = new Map<string, PasoSecuencia>();
  antes.forEach((p, i) => {
    if (p && p.canal === 'email' && typeof p.cuerpo_html === 'string' && p.cuerpo_html) emailsPrevios.set(idDe(p, i), p);
  });

  // ⚠️ EL PASO «⚡ ACCIÓN» SE VALIDA ANTES DE ESCRIBIR NADA, y una acción inválida frena el
  // guardado ENTERO con un error que la pantalla muestra. Esta función reconstruye cada
  // paso campo por campo y borra lo que no conoce (AGENTS.md: la quinta puerta de un tipo
  // de nodo nuevo), así que `accion` tiene que pasar por acá o se pierde en el primer
  // guardado. Y no se descarta en silencio: un paso de acción sin elegir, o con una
  // operación que el registro no tiene, guardado como mensaje vacío sería un WhatsApp en
  // blanco al lead; guardado tal cual, un 'fallo' por corrida en un log que nadie lee.
  // El filtro es el MISMO de abajo, para que `acciones[i]` sea el paso `i` del `.map`.
  const esPaso = (p: PasoSecuencia): boolean => !!p && typeof p === 'object';
  // Un nodo de CONTROL (condición, espera, «Si responde», «Ir a») no corre una acción aunque
  // traiga una pegada: `nodo` manda sobre `accion` (claseDe, lib/flujo-grafo.ts).
  const acciones = pasos.filter(esPaso).map((p) => sanearAccion(esNodoDeControl(camposDelFlujo(p)) ? null : (p as { accion?: unknown }).accion));
  const malas = acciones.flatMap((a, i) => (a && !a.ok ? [`el paso ${i + 1} ${a.motivo}`] : []));
  if (malas.length) throw new PasosInvalidosError(`No se guardó: ${malas.join('; ')}.`);
  const sinArchivo = pasos.filter(esPaso).flatMap((p, i) => { const m = problemaDeMedia(p); return m ? [`el paso ${i + 1} ${m}`] : []; });
  if (sinArchivo.length) throw new PasosInvalidosError(`No se guardó: ${sinArchivo.join('; ')}.`);
  // Un email que no entra no se recorta: un HTML cortado a la mitad deja etiquetas abiertas y el
  // final del mensaje afuera, sin que nadie lo vea.
  const largos = pasos.filter(esPaso).flatMap((p, i) => {
    const m = p.canal === 'email' && !esNodoDeControl(camposDelFlujo(p)) ? problemaDeCuerpoHtml(p.cuerpo_html) : null;
    return m ? [`el paso ${i + 1} ${m}`] : [];
  });
  if (largos.length) throw new PasosInvalidosError(`No se guardó: ${largos.join('; ')}.`);
  // Un «Ir a» a ESTA MISMA automatización (un «Sigue con» con la clave mal puesta) es un bucle
  // que le reenviaba la secuencia entera al lead en cada vuelta (revisión del 08/10/2026).
  // `validarGrafo` no sabe qué id tiene la secuencia: lo dice esto. Con los campos del flujo ya
  // saneados (`camposDelFlujo`: un id que llega como texto cuenta igual).
  const aSiMisma = irAEstaMisma(pasos.filter(esPaso).map((p) => camposDelFlujo(p)), id);
  if (aSiMisma.length) throw new PasosInvalidosError(`No se guardó: el «Ir a» del paso ${aSiMisma[0] + 1} apunta a esta misma automatización.`);
  // ⚠️ UNA LISTA SIN IDS NO PISA UN FLUJO DE TARJETAS (08/10/2026). Hay escritores que arman los
  // pasos de cero y no saben de ramas (el armado de las secuencias de audios del onboarding, la
  // API por orden, /email). Sobre un flujo, eso borraba en silencio las condiciones, las esperas
  // y «Si responde» con sus casos: guardar una lista válida no da error. El lienzo manda SIEMPRE
  // los ids de sus tarjetas; quien manda una lista sin ninguno no está editando ESTE flujo.
  if (puedePisarFlujo(antes, pasos) === false) {
    throw new PasosInvalidosError('No se guardó: esta automatización tiene tarjetas (condiciones, esperas o «Si responde»). Se edita en /chatbot.');
  }
  const operaciones = [...new Set(acciones.flatMap((a) => (a?.ok ? [a.accion.operacion] : [])))];
  if (operaciones.length) {
    // Import dinámico: el registro son ~500 definiciones y sólo hace falta si hay acciones.
    const [{ porId }, { esAccion }] = await Promise.all([import('@/lib/api-mako/registro'), import('@/lib/api-mako/tipos')]);
    const ajenas = operaciones.filter((op) => { const d = porId(op); return !d || !esAccion(d); });
    if (ajenas.length) throw new PasosInvalidosError(`No se guardó: ${ajenas.map((op) => `«${op}»`).join(', ')} no es una acción de MaKo.`);
    // Y lo OBLIGATORIO de cada acción tiene que estar: sin esto «Publicar» guardaba un paso al
    // que le faltaba un dato, el lienzo lo dibujaba como configurado y cada lead que llegaba
    // dejaba un 'fallo' que nadie lee. El lead del evento cuenta como puesto (una secuencia
    // siempre corre sobre un lead), y lo decide la MISMA función que usa el motor de avisos.
    const { faltanEnPaso } = await import('@/lib/api-mako/flujo-params');
    const incompletas = acciones.flatMap((a, i) => {
      if (!a?.ok) return [];
      const d = porId(a.accion.operacion);
      const faltan = d ? faltanEnPaso(d.parametros, a.accion.params, { leadId: 1 }) : [];
      return faltan.length ? [`al paso ${i + 1} («${d!.titulo}») le falta ${faltan.map((f) => `«${f}»`).join(', ')}`] : [];
    });
    if (incompletas.length) throw new PasosInvalidosError(`No se guardó: ${incompletas.join('; ')}.`);
  }

  // El cuerpo de un mensaje. Un EMAIL escrito con el editor rico guarda su HTML SANEADO, y su
  // `cuerpo` pasa a ser el texto plano DERIVADO de ese HTML: lo decide esta función y no la
  // pantalla, así el texto de respaldo nunca dice otra cosa que el correo (decisión 12 de la tercera
  // tanda). Sin HTML (un email de antes, un WhatsApp), el `cuerpo` es el que llegó, como siempre.
  const cuerpoDelPaso = (p: PasoSecuencia, flujo: ReturnType<typeof camposDelFlujo>, i: number, canal: CanalNutricion): { cuerpo: string; cuerpo_html?: string } => {
    const html = canal === 'email' ? cuerpoHtmlAGuardar(cuerpoHtmlEntrante(p, emailsPrevios.get(idDe(flujo, i)))) : null;
    return html ? { cuerpo: textoDeHtmlEmail(html), cuerpo_html: html } : { cuerpo: typeof p.cuerpo === 'string' ? p.cuerpo : '' };
  };

  // Normaliza el orden (1..n) y descarta basura. Los campos del FLUJO (id, siguiente, nodo,
  // espera, ramas, casos, si_no, destino, revisar) salen de `camposDelFlujo`, saneados uno por
  // uno: por acá pasan los diez escritores de `pasos`, y lo que no se reconstruye se borra.
  const limpio = pasos
    .filter(esPaso)
    .map((p, i): PasoSecuencia => {
      const flujo = camposDelFlujo(p);
      // Un nodo de CONTROL lleva sólo el relleno que todo paso tiene (canal, cuerpo vacío, sin
      // espera propia): lo que decide es su `nodo`, y un `delay_horas` acá sería una espera
      // que el lienzo no dibuja.
      if (esNodoDeControl(flujo)) return { orden: i + 1, ...RELLENO_CONTROL, ...flujo } as PasoSecuencia;
      const comun = {
        orden: i + 1,
        // Un paso de audio es de WhatsApp por definición (no hay nota de voz por email).
        canal: (p.canal === 'email' && p.tipo !== 'audio' ? 'email' : 'whatsapp') as CanalNutricion,
        delay_horas: Math.max(0, Math.round(Number(p.delay_horas) || 0)),
        ...(p.ancla === 'reunion' ? { ancla: 'reunion' as const } : {}),
        ...(p.requiere === 'respondio' || p.requiere === 'sin_respuesta' || p.requiere === 'ya_contactado' || p.requiere === 'primer_contacto'
          ? { requiere: p.requiere as PasoSecuencia['requiere'] }
          : {}),
        ...flujo,
      };
      // Un paso de ACCIÓN no lleva nada de un mensaje: ni tipo, ni audio, ni variantes, ni
      // cuerpo. Las variantes, sobre todo: el merge es por el id del nodo, y una acción que
      // quedó con el id de un mensaje de antes (un paso sin id es `o<índice>`) heredaría las suyas.
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
          : p.tipo === 'media'
            ? { tipo: 'media' as const, media_id: Number(p.media_id) }
            : p.tipo === 'ia' && p.canal !== 'email' && proveedorDelPaso(p) === 'no_oficial'
              ? { tipo: 'ia' as const }
              : {}),
        asunto: typeof p.asunto === 'string' ? p.asunto : null,
        preheader: typeof p.preheader === 'string' ? p.preheader : null,
        ...cuerpoDelPaso(p, flujo, i, comun.canal),
        // El oficial va DECLARADO; la ausencia del campo cae al no oficial, que es
        // el canal real del chatbot. El porqué, en `proveedorDelPaso`.
        proveedor: proveedorDelPaso(p),
        template_wa: p.template_wa ?? null,
        template_categoria: p.template_categoria,
        template_idioma: p.template_idioma ?? 'es_MX',
        template_param: p.template_param ?? 'nombre',
        // Las variantes las manda el cliente solo si las está editando; si no,
        // sobreviven las que ya había para ese nodo.
        ...(() => {
          const vs = Array.isArray(p.variantes) && p.variantes.length ? p.variantes : variantesPrevias.get(idDe(flujo, i));
          return vs?.length ? { variantes: vs.filter((v) => typeof v === 'string' && v.trim()).slice(0, 8) } : {};
        })(),
      };
    });
  // Ids y `siguiente` EXPLÍCITOS en cada guardado (insertar o borrar un elemento del array ya no
  // le cambia a nadie el paso siguiente), y lo que no es un flujo no se guarda.
  const grafo = normalizar(limpio);
  const errores = validarGrafo(grafo);
  if (errores.length) throw new PasosInvalidosError(`No se guardó: ${errores[0]}.`);
  // Activar valida lo mismo que Publicar, sin escribir (`setSecuenciaActiva`).
  if (o?.soloValidar) return;
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({ pasos: grafo, updated_at: ahoraISO() })
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
  etiquetaId?: number | null,
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
  return cohorteDeTrigger(triggerTipo, etapa ?? null, await ambitoDeFunnel(funnelId), etiquetaId ?? null);
}

/**
 * Los leads que TIENEN HOY la etiqueta `etiquetaId` (`crm_lead_etiquetas`, mig 0224), dentro del
 * ámbito de embudo de la secuencia. Es la red del evento «le pusieron la etiqueta» (que enrola
 * en el acto, `enrolarPorEvento`) y lo que alcanza a quien YA la tenía cuando se creó la
 * secuencia, igual que `etapa_actual` con la etapa.
 *
 * ⚠️ SIN FILTRO DE ESTADO NI DE ANTIGÜEDAD, a propósito: la etiqueta ES la decisión de alguien
 * (una persona o un paso de un flujo), y «Reactivar» puesta a un perdido tiene que disparar.
 * La inscripción única (lead, secuencia) hace que el barrido horario no repita a nadie.
 *
 * ⚠️ SÓLO CON HORARIO (revisión del 08/10/2026): sin horario el disparador es sólo el evento, y
 * el barrido ni llega acá (`barridoInscribe`, en `comprometerInscripciones`). Si barriera, una
 * etiqueta puesta en LOTE o por el espejo de una etapa —que a propósito no disparan— disparaba
 * igual en la corrida siguiente.
 *
 * ⚠️ UNA ETIQUETA ARCHIVADA NO DISPARA (decisión del 08/10/2026: archivar la apaga), y una que no
 * es de este negocio tampoco (`getTenantDb` la deja afuera): nadie.
 *
 * ⚠️ SI LA TABLA TODAVÍA NO EXISTE (la 0224 sin aplicar), NADIE: no se rompe la corrida de las
 * demás secuencias, y queda un log. Cualquier otro error tira, como toda cohorte.
 */
async function leadsConEtiqueta(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  etiquetaId: number | null,
  ambito: AmbitoFunnel,
): Promise<number[]> {
  if (etiquetaId == null || !Number.isInteger(etiquetaId) || etiquetaId <= 0) return [];
  let conEtiqueta: number[];
  try {
    const { data: et, error: eEt } = await db.from('crm_etiquetas').select('id, archivada_at').eq('id', etiquetaId).maybeSingle();
    if (eEt) throw new Error(eEt.message);
    const etiqueta = et as { id: number; archivada_at: string | null } | null;
    if (!etiqueta || etiqueta.archivada_at) return [];
    const filas = await leerTodo<{ id: number; lead_id: number | string | null }>(db, 'crm_lead_etiquetas', 'id, lead_id', {
      orden: 'id', filtros: (q) => q.eq('etiqueta_id', etiquetaId) as ConsultaPaginada,
    });
    conEtiqueta = [...new Set(filas.map((f) => Number(f.lead_id)).filter((n) => Number.isFinite(n) && n > 0))];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (esTablaInexistente({ message: msg })) {
      console.warn(`[nutricion] cohorte ${TRIGGER_ETIQUETA}: la tabla de etiquetas todavía no existe (${msg})`);
      return [];
    }
    throw new Error(`cohorte ${TRIGGER_ETIQUETA}(${etiquetaId}): ${msg}`);
  }
  if (!conEtiqueta.length) return [];
  // Sólo leads de ESTE negocio y de su embudo: la fila de la etiqueta apunta a un lead por id, y
  // es la tabla de leads (con su ámbito) la que dice de quién es.
  const out: number[] = [];
  for (const tanda of enTandas(conEtiqueta, 200)) {
    out.push(...await idsCohorte(db, `etiqueta-${etiquetaId}`, ambito, (q) => q.in('id', tanda)));
  }
  return out;
}

// El ámbito viaja YA RESUELTO para que la rama de la post-agenda —que se llama a
// sí misma con otro trigger— no vuelva a consultar `funnels`, y sobre todo para
// que no pueda perderlo en el camino: el trigger hermano juntaría los leads de
// todos los embudos y la exclusión de familia no se enteraría.
async function cohorteDeTrigger(triggerTipo: string, etapa: string | null, ambito: AmbitoFunnel, etiquetaId: number | null = null): Promise<number[]> {
  const supabase = (await getTenantDb());

  if (triggerTipo === TRIGGER_ETIQUETA) return leadsConEtiqueta(supabase, etiquetaId, ambito);
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
 *
 * ⚠️ Y EL TOPE TAMBIÉN SALE DEL FLUJO (`antiguedadDeEntrada`). Una secuencia convertida a
 * tarjetas ya no tiene `antiguedad_max_horas` (la LIMPIEZA lo pone en null): el tope pasó a ser
 * su primera tarjeta, una condición «Llegó hace menos de N h». Mirarla sólo al correr dejaba
 * entrar a toda la cohorte de 30 días —una fila trabada por el UNIQUE por cada lead viejo—,
 * que es lo que este filtro vino a cerrar el 17/09.
 */
function topeAntiguedad(sec: Pick<Secuencia, 'antiguedad_max_horas' | 'pasos'>): number | null {
  return sec.antiguedad_max_horas ?? antiguedadDeEntrada(sec.pasos);
}

async function aTiempo(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  sec: Pick<Secuencia, 'antiguedad_max_horas' | 'pasos'>,
  ids: number[],
): Promise<number[]> {
  const maxHoras = topeAntiguedad(sec);
  if (maxHoras == null || ids.length === 0) return ids;
  const ahoraMs = Date.now();
  const creado = new Map<number, string | null>();
  // En tandas y paginado, como todo `.in()` sobre una cohorte (ver filasCohorte).
  for (const tanda of enTandas(ids, 200)) {
    const filas = await leerTodo<{ id: number; created_at: string | null }>(db, 'leads', 'id, created_at', {
      orden: 'id', filtros: (q) => q.in('id', tanda) as ConsultaPaginada,
    });
    for (const f of filas) creado.set(f.id, f.created_at);
  }
  return ids.filter((id) => dentroDeAntiguedad({ maxHoras, createdAt: creado.get(id) ?? null, ahoraMs }));
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
    if (!barridoInscribe(sec)) continue;
    if (!decidirAgenda({ cron: sec.cron, cronProximaAt: sec.cron_proxima_at }, tz, ahora).toca) continue;
    const candidatos = await aTiempo(supabase, sec, await leadsDeCohorte(sec.trigger_tipo, sec.etapa, sec.funnel_id, sec.producto_id, sec.etiqueta_id));
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
  const entrada = pasoDeEntrada(sec.pasos);
  const juntas = (prepara || entrada?.ancla === 'reunion') && quienes.length ? await juntasDe(db, quienes) : new Map<number, JuntasLead>();
  const escalonados = sec.trigger_tipo === TRIGGER_RESIDUO && pendientes.length
    ? await horariosResiduo(db, { pendientes, pasos: sec.pasos.length, delayHoras: entrada?.delay_horas ?? 0 })
    : null;
  const alta = (lead_id: number, reunionMs: number | null): AltaInscripcion => ({
    lead_id,
    // El mínimo entre las raíces (`proximoDeEntrada`): con flechas en paralelo desde el CRON, un
    // camino «ya» no espera al principal. Con una sola raíz es la entrada, como siempre.
    proximo_envio_at: escalonados?.get(lead_id) ?? proximoDeEntrada(sec.pasos, (p) => proximoEnvioDePaso(p, juntas.get(lead_id))),
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
    // «Se le puso una etiqueta» SIN horario es sólo el evento: el barrido no inscribe por
    // etiqueta (decisión del 08/10/2026, `barridoInscribe`). Si barriera, el LOTE y el espejo de
    // una etapa —que a propósito no disparan— disparaban igual en esta corrida.
    if (!barridoInscribe(sec)) continue;
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
    const candidatos = await aTiempo(supabase, sec, await leadsDeCohorte(sec.trigger_tipo, sec.etapa, sec.funnel_id, sec.producto_id, sec.etiqueta_id));
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

export type EventoNutricion = 'lead_nuevo' | 'agenda_nueva' | 'etapa' | 'entrega' | 'etiqueta';

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
  /** La etiqueta (`crm_etiquetas.id`) que ACABAN de ponerle. Es la pregunta del evento `'etiqueta'`. */
  etiquetaId?: number | string | null;
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
  // Le PUSIERON una etiqueta (08/10/2026, punto 12: «debería también poder salir acciones y
  // CRON desde etiquetas»). Lo dispara el choke point de las etiquetas (lib/etiquetas.ts). Como
  // el de etapa, no alcanza solo: `secuenciasDeEtiqueta` filtra por CUÁL.
  etiqueta: [TRIGGER_ETIQUETA],
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
 * Un cliente que llega a una etapa de la entrega SIN que eso le dispare nada (el movimiento
 * silencioso de lib/cs-mover-etapa.ts: quitar una etapa del kanban desde el curso muda a sus
 * clientes a otra). No alcanza con no enrolar: la RED del cron (`leadsDeCohorte`, rama de la
 * entrega) junta a todo el que está parado en la etapa y lo enrola en la próxima corrida. Lo que
 * la frena es lo mismo que frena a cualquiera que ya pasó por una secuencia: una fila suya en
 * `nutricion_inscripciones` (`aInscribir` saltea a quien tiene fila, y una de entrega no se reusa).
 * Se escribe CERRADA de entrada —'cancelada' + desenlace 'cancelado', sin próximo envío—: nunca
 * mandó nada y el evaluador de desenlaces no la toca.
 *
 * ⚠️ DE A UNA, como `enrolarPorEvento`: una que ya existe (ya la recibió, o ya la tiene corriendo)
 * choca con el `unique (lead_id, secuencia_id)` y se deja como está. Tira si no puede leer las
 * secuencias o si alguna no quedó bloqueada: quien llama NO mueve al cliente (fail-closed).
 */
export async function silenciarEntregaDeEtapa(
  leadId: number,
  etapa: string | null | undefined,
  productoId: number | string | null | undefined,
): Promise<number> {
  const key = (etapa ?? '').trim();
  if (!key) return 0;
  const de = secuenciasDeEntrega(await getSecuenciasActivas(), key, productoId);
  if (!de.length) return 0;
  const supabase = await getTenantDb();
  const ahora = ahoraISO();
  let n = 0;
  const fallas: string[] = [];
  for (const s of de) {
    const { error } = await supabase.from('nutricion_inscripciones').insert({
      lead_id: leadId, secuencia_id: s.id, paso_actual: 0, estado: 'cancelada', proximo_envio_at: null,
      desenlace: 'cancelado', desenlace_at: ahora, updated_at: ahora,
    });
    if (!error) { n += 1; continue; }
    // Ya tiene fila de esa secuencia (la recibió, o la tiene corriendo): para la red ya está frenada.
    if (error.code === '23505') continue;
    console.error(`[nutricion] silenciarEntregaDeEtapa(${leadId}, ${key}) en ${s.clave}: ${error.message}`);
    fallas.push(s.clave);
  }
  if (n) console.log(`[nutricion] lead ${leadId} llegó a «${key}» en silencio: ${n} secuencia(s) bloqueada(s)`);
  // ⚠️ TIRA SI ALGUNA NO QUEDÓ BLOQUEADA (revisión final del 08/10/2026): quien llama mueve al cliente SÓLO
  // si esto no tira (lib/cs-mover-etapa.ts, paso 4b), y una secuencia sin su fila es justo la que la red
  // del cron enrola en la próxima corrida. Antes se anotaba y se seguía: el cliente se movía igual.
  if (fallas.length) throw new Error(`no pude bloquear ${fallas.join(', ')}`);
  return n;
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
    // ⚠️ LA ETIQUETA TAMBIÉN PREGUNTA POR *CUÁL*, como la etapa: sin esto, ponerle «Cualificado»
    // a un lead lo metía también en la secuencia de «Seguimiento».
    if (evento === 'etiqueta') delEvento = secuenciasDeEtiqueta(delEvento, ctx?.etiquetaId);
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
    const juntas = (preparan || elegidas.some((s) => pasoDeEntrada(s.pasos)?.ancla === 'reunion')) ? (await juntasDe(supabase, [leadId])).get(leadId) ?? null : null;

    // ⚠️ DE A UNA, NO POR LOTE (refutador del relevo #789, (3)). El insert por lote chocaba
    // con el `unique (lead_id, secuencia_id)` apenas UNA fila ya existía —otra corrida, o el
    // cron en el mismo segundo— y el `return 0` dejaba al lead sin NINGUNA de las secuencias
    // del evento. Una fila que ya existe no se inserta: se reusa si se puede, y si no, se deja.
    let arrancadas = 0;
    for (const s of elegidas) {
      // El primer paso de una secuencia disparada por evento sale YA: el delay configurado
      // cuenta desde el evento, no desde el cron. Un paso anclado a la reunión, desde la agenda.
      const proximo = proximoDeEntrada(s.pasos, (p) => proximoEnvioDePaso(p, juntas));
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
 *
 * `desdeFlujo`: lo pide un «Ir a otra automatización» (la salida o «Si responde»), no una persona.
 * Ahí NO se reinicia lo terminado y no se entra si el trabajo de la otra ya está hecho (regla 6 de
 * lib/nutricion-inscripcion-manual.ts): es lo que hacía `encadenar`, y sin eso el «Sigue con»
 * convertido le reenviaba la secuencia entera a quien ya la había terminado.
 */
export async function inscribirEnSecuencia(
  leadId: number,
  secuenciaId: number,
  opts?: { soloVer?: boolean; sinEnvioInmediato?: boolean; desdeFlujo?: boolean },
): Promise<InscripcionManual> {
  const supabase = await getTenantDb();
  // El ámbito (funnel_id, producto_id) viaja aunque acá no filtre —la secuencia la eligió una
  // persona, no una cohorte—: todo select de secuencias lo trae (tests/nutricion-ambito-embudo).
  const { data: filaSec, error: eSec } = await supabase.from('nutricion_secuencias')
    .select('id, nombre, trigger_tipo, activa, archivada_at, pasos, estrategia, funnel_id, producto_id').eq('id', secuenciaId).maybeSingle();
  if (eSec) throw new Error(`inscribirEnSecuencia (secuencia): ${eSec.message}`);
  const s = filaSec as { id: number; nombre: string; trigger_tipo: string; activa: boolean; archivada_at: string | null; pasos: unknown; estrategia: unknown } | null;
  // Lo de `hitoYaHecho` (calificado, agenda, pago) va en la misma lectura: lo pregunta un flujo.
  const { data: filaLead, error: eLead } = await supabase.from('leads')
    .select('id, nombre, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at, fecha_agenda, calificado, fecha_primer_pago, cerro').eq('id', leadId).maybeSingle();
  if (eLead) throw new Error(`inscribirEnSecuencia (lead): ${eLead.message}`);
  const lead = filaLead as ({ id: number; nombre: string | null } & JuntasLead & Record<string, unknown>) | null;
  const quien = lead ? { id: Number(lead.id), nombre: lead.nombre?.trim() || `el lead #${lead.id}` } : null;
  if (!s) return { inscribe: false, porque: 'secuencia_no_existe', secuencia: null, lead: quien };
  const ref = { id: Number(s.id), nombre: s.nombre };
  if (!lead || !quien) return { inscribe: false, porque: 'lead_no_existe', secuencia: ref, lead: null };

  const pasos = Array.isArray(s.pasos) ? (s.pasos as PasoSecuencia[]) : [];
  const prepara = preparaUnaReunion(s.trigger_tipo);
  const decididoAt = ahoraISO();
  const previa = (await inscripcionesDe(supabase, [leadId], (q) => q.eq('secuencia_id', s.id), prepara))[0] ?? null;

  const aTiempoOk = (await aTiempo(supabase, { antiguedad_max_horas: parseEstrategia(s.estrategia)?.antiguedad_max_horas ?? null, pasos }, [leadId])).length > 0;
  const sinReunion = (pasoDeEntrada(pasos)?.ancla === 'reunion' || prepara) && reunionFuturaMs(lead) == null;
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

  const objetivo = parseEstrategia(s.estrategia)?.objetivo ?? null;
  const v = decidirInscripcionManual({
    secuencia: { activa: s.activa === true, archivada: s.archivada_at != null, pasos: pasos.length },
    previa: previa ? { estado: previa.estado, desenlace: previa.desenlace } : null,
    motor: { aTiempo: aTiempoOk, sinReunion, fueraDelResiduo, enLaOtraMitad },
    desdeFlujo: opts?.desdeFlujo === true,
    objetivoHecho: opts?.desdeFlujo === true && objetivo != null && hitoYaHecho(objetivo, lead) === true,
  });
  if (!v.inscribe) return { inscribe: false, porque: v.porque, secuencia: ref, lead: quien };

  const proximo = proximoDeEntrada(pasos, (p) => proximoEnvioDePaso(p, lead));
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
  /** El nodo en el que está (mig 0223). NULL = una fila de antes: manda `paso_actual`. */
  nodo_actual: string | null;
};

/** Cómo se lee un nodo de control en el plan del dry-run y en el rastro del motor. */
const NOMBRE_CONTROL: Record<string, string> = { condicion: 'condición', esperar: 'espera', ir_a: '«ir a»', respuesta: '«si responde»' };

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
    return await leerTodo<InscripcionVencida>(supabase, 'nutricion_inscripciones', 'id, lead_id, secuencia_id, paso_actual, nodo_actual', {
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
    // El nodo como lo busca el motor: por `nodo_actual`, y si no, por `paso_actual`.
    const idx = sec ? indiceActual(sec.pasos, insc) : -1;
    const paso = sec && idx >= 0 ? sec.pasos[idx] : undefined;
    return {
      inscripcion_id: insc.id,
      lead_id: insc.lead_id,
      secuencia: sec?.clave ?? `#${insc.secuencia_id}`,
      paso: (idx >= 0 ? idx : insc.paso_actual) + 1,
      canal: paso?.canal ?? null,
      // Un paso de acción no tiene texto: decir su operación es lo único que describe qué corre.
      // Un nodo de control no manda nada por sí mismo: se resuelve y sigue.
      detalle: !paso ? 'sin paso → se completaría'
        : esNodoDeControl(paso) ? `${NOMBRE_CONTROL[claseDe(paso)] ?? claseDe(paso)}: se resuelve y sigue`
          : esPasoAccion(paso) ? `acción: ${paso.accion?.operacion || 'sin elegir'}`
            : `${paso.canal}: ${paso.asunto ?? paso.cuerpo.slice(0, 40)}`,
    };
  });
}

function haceHorasISO(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

/**
 * ¿Es hora de escribirle a alguien? Entre las 9 y las 21 de la zona del negocio. Era la hora de
 * México para todos (`TZ_OFFSET_MX`): a Código Inmobiliario, en Buenos Aires, le salía corrida
 * tres horas. La zona se lee UNA vez por corrida (`zonaDelMotor`, en `procesarEnvios`).
 */
function dentroDeVentana(tz: string): boolean {
  return dentroDeVentanaEn(Date.now(), tz, VENTANA_INICIO, VENTANA_FIN);
}

// Tope diario: cuenta SOLO envíos reales — una corrida de prueba (?commit=1,
// simulados) no debe consumir el presupuesto anti-baneo del workspace.
// POR CANAL (decisión 5): el de WhatsApp es el de la línea; el de email, el suyo.
async function enviosUltimas24h(canal: CanalNutricion): Promise<number> {
  const supabase = (await getTenantDb());
  const { count, error } = await supabase
    .from('nutricion_envios')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'enviado')
    .eq('canal', canal)
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

/**
 * El freno de 20 h, leído de la base, POR CANAL (decisión 5 de la segunda tanda, 08/10/2026).
 *
 * ⚠️ CONTABA TODOS LOS CANALES JUNTOS: un email frenaba al WhatsApp 20 h y al revés, así que el
 * ejemplo de Martín —WhatsApp y email desde el mismo CRON— salía con un día de diferencia. El de
 * WhatsApp cuenta lo que salió por WhatsApp (la nutrición y el espejo, con la excepción de la
 * reunión cercana); el de email, la nutrición por email y los envíos masivos.
 *
 * Se lee UNA vez por lote: lo que el lote acaba de mandar lo sabe `enviadoEnCorrida`, en memoria
 * (`frenadoPorAntiBan` mira las dos cosas).
 */
async function leadsConEnvioReciente(leadIds: number[]): Promise<RecientesPorCanal> {
  const set = new Set<number>();
  const email = new Set<number>();
  if (leadIds.length === 0) return { whatsapp: set, email };
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
  const qNutri = (canal: CanalNutricion) => (pend: number[], d: string) => supabase.from('nutricion_envios').select('lead_id')
    .in('lead_id', pend).in('estado', ['enviado', 'simulado']).eq('canal', canal).gte('created_at', d);
  const qEspejo = (pend: number[], d: string) => supabase.from('wa_mensajes').select('lead_id')
    .in('lead_id', pend).eq('from_me', true).gte('wa_timestamp', d);
  // EL EMAIL, CON SU PROPIO FRENO: la nutrición por email y el masivo, 20 h, sin la excepción de
  // la reunión cercana (esa es la cadencia de preparación de una conversación por WhatsApp).
  const [eNutri, eMasivo] = await Promise.all([
    porVentana(leadIds, desde, qNutri('email'), 'nutricion_envios'),
    porVentana(leadIds, desde, (pend, d) => supabase.from('email_broadcast_envios').select('lead_id')
      .in('lead_id', pend).in('estado', ['enviado', 'simulado']).gte('created_at', d), 'email_broadcast_envios'),
  ]);
  for (const r of [eNutri, eMasivo]) for (const id of r) email.add(id);
  const resultados = await Promise.all([
    porVentana(fuera, desde, qNutri('whatsapp'), 'nutricion_envios'),
    porVentana(enPrep, desdeCorto, qNutri('whatsapp'), 'nutricion_envios'),
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
  return { whatsapp: set, email };
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

/**
 * LOS HECHOS DEL LEAD con los que se evalúa una condición (`HechosLead`, lib/flujo-grafo.ts),
 * leídos en BATCH para todos los leads del lote. Sólo se llama si algún lead del lote está por
 * pasar por una condición (`necesitaHechos`): sin condiciones, el motor no lee nada de esto.
 *
 * ⚠️ SE LEE SÓLO LO QUE PIDEN LAS FILAS (tercera tanda, 09/10/2026). `filas` son las condiciones de
 * los flujos del lote (`filasDelFlujo`), y cada una dice de qué FUENTE sale (lib/condiciones-catalogo.ts,
 * `fuentesDeFilas`): UNA consulta por fuente para todo el lote, nunca una por lead. Sin `filas` se
 * leen las fuentes de antes del catálogo (las nueve condiciones de siempre), que es lo que pedía
 * todo llamador anterior.
 *
 * Cada hecho sale de la MISMA fuente que ya lo decide en otro lado, nunca de una cuenta nueva:
 *   · la etapa de la casa, con `pipelineStageOf` (el override manual o la derivada), y la de
 *     cada producto, de `lead_funnel` (mig 0207) con la casa resuelta por `casaReal`;
 *   · «agendó» y «pagó», con la regla del desenlace de antes (`agendoLead`, `pagoLead`);
 *   · «ya le escribiste», con `leadsYaContactados` (lo que decide el par de apertura);
 *   · «te escribió alguna vez»: un mensaje entrante suyo en el espejo de WhatsApp, o una
 *     inscripción que pausó porque contestó (por el oficial, el entrante no se espeja);
 *   · las etiquetas, de `crm_lead_etiquetas` (mig 0224), MENOS las archivadas
 *     (`etiquetasQueCuentan`: archivar la apaga). ⚠️ Si esa tabla todavía no existe,
 *     el conjunto vacío y un log: la condición «Tiene la etiqueta X» sale por «no», y la corrida
 *     de los demás no se rompe por una migración de otra parte;
 *   · el VSL con `getVslEngagementMap` (lo de la lista de leads y las cohortes de antes);
 *   · el curso con `progresoDeClientes` (el progreso EFECTIVO) y `claseCompleta` (la regla del
 *     portal), resumido por `resumenCursoDeAlumno`;
 *   · la etapa de entrega con `clientesEnEtapaDeEntrega` (la cohorte del kanban: sin fila = la
 *     primera etapa), una vez por etapa que el flujo nombra.
 * Cualquier otro error TIRA: decidir una rama sin el dato es mandarle al lead lo que no le toca.
 */
const FUENTES_DE_ANTES: ReadonlySet<Fuente> = new Set<Fuente>(['lead', 'etiquetas', 'productos', 'contacto', 'respondio']);

async function hechosDeLeads(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  leadIds: readonly number[],
  filas?: readonly FilaCondicion[],
): Promise<Map<number, HechosLead>> {
  const ids = [...new Set(leadIds)];
  const out = new Map<number, HechosLead>();
  if (!ids.length) return out;
  const fuentes = filas ? fuentesDeFilas(filas) : FUENTES_DE_ANTES;
  const pide = (x: Fuente) => fuentes.has(x);
  type FilaLeadHechos = FilaHechos & FilaLeadCatalogo & {
    estado_lead: 'abierto' | 'ganado' | 'perdido' | 'descalificado' | 'no_responde';
    pipeline_stage: string | null; fecha_agenda: string | null; asistio_j1: boolean | null; asistio_j2: boolean | null;
    nutricion_realizada: boolean | null; funnel_id: number | string | null;
    respuesta_facturacion?: string | null; respuesta_colaboradores?: string | null; respuesta_objetivo?: string | null;
    respuesta_cuando_empezar?: string | null; respuesta_inversion?: string | null; respuesta_decisor?: string | null;
    meta_field_data?: unknown;
  };
  const filasLead: FilaLeadHechos[] = [];
  const productos = new Map<number, Map<number, string>>();
  const etiquetas = new Map<number, Set<number>>();
  let sinTablaEtiquetas = !pide('etiquetas');
  // Las ARCHIVADAS no cuentan (decisión del 08/10/2026: archivar una etiqueta la APAGA). El lead
  // conserva la fila —es su historia—, pero «Tiene X» deja de cumplirse. Una lectura por lote.
  let archivadas = new Set<number>();
  if (pide('etiquetas')) {
    try {
      archivadas = new Set((await leerTodo<{ id: number | string }>(db, 'crm_etiquetas', 'id', {
        orden: 'id', filtros: (q) => q.not('archivada_at', 'is', null),
      })).map((f) => Number(f.id)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!esTablaInexistente({ message: msg })) throw e;
      sinTablaEtiquetas = true;
      console.warn(`[nutricion] condición por etiqueta: la tabla de etiquetas todavía no existe, se evalúa sin etiquetas (${msg})`);
    }
  }
  // Las columnas de la fila: las de siempre, y las del catálogo (origen, reuniones, compra…) sólo
  // si alguna fila las pide — más las respuestas viejas del formulario si se busca en ellas.
  const COLS_BASE = 'id, created_at, telefono, email, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at, fecha_primer_pago, cerro, estado_lead, pipeline_stage, fecha_agenda, asistio_j1, asistio_j2, nutricion_realizada, funnel_id';
  const COLS_CATALOGO = 'origen_lead, calificado, meta_lead_id, visitor_id, meta_campaign_name, email_opt_out, venta_tipo, fecha_cierre, fecha_confirmacion';
  const COLS_RESPUESTAS = 'respuesta_facturacion, respuesta_colaboradores, respuesta_objetivo, respuesta_cuando_empezar, respuesta_inversion, respuesta_decisor, meta_field_data';
  const catalogoLead = filas != null;
  const cols = [COLS_BASE, catalogoLead ? COLS_CATALOGO : '', pide('respuestas') ? COLS_RESPUESTAS : ''].filter(Boolean).join(', ');
  for (const tanda of enTandas(ids, 200)) {
    filasLead.push(...await leerTodo<FilaLeadHechos>(db, 'leads', cols, { orden: 'id', filtros: (q) => q.in('id', tanda) as ConsultaPaginada }));
    if (pide('productos')) {
      for (const f of await leerTodo<{ id: number; lead_id: number; funnel_id: number | string; etapa: string | null }>(db, 'lead_funnel', 'id, lead_id, funnel_id, etapa', {
        orden: 'id', filtros: (q) => q.in('lead_id', tanda) as ConsultaPaginada,
      })) {
        const fid = Number(f.funnel_id);
        if (!Number.isFinite(fid) || !f.etapa) continue;
        const m = productos.get(Number(f.lead_id)) ?? new Map<number, string>();
        m.set(fid, f.etapa);
        productos.set(Number(f.lead_id), m);
      }
    }
    if (!sinTablaEtiquetas) {
      try {
        for (const f of await leerTodo<{ id: number; lead_id: number; etiqueta_id: number | string }>(db, 'crm_lead_etiquetas', 'id, lead_id, etiqueta_id', {
          orden: 'id', filtros: (q) => q.in('lead_id', tanda) as ConsultaPaginada,
        })) {
          const s = etiquetas.get(Number(f.lead_id)) ?? new Set<number>();
          s.add(Number(f.etiqueta_id));
          etiquetas.set(Number(f.lead_id), s);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!esTablaInexistente({ message: msg })) throw e;
        sinTablaEtiquetas = true;
        console.warn(`[nutricion] condición por etiqueta: la tabla de etiquetas todavía no existe, se evalúa sin etiquetas (${msg})`);
      }
    }
  }
  const [{ idDelFunnelDefault }, { casaReal }] = await Promise.all([import('@/lib/funnels'), import('@/lib/lead-funnel-reglas')]);
  const [defaultId, contactados, escribieron, pausaron, catalogo] = await Promise.all([
    pide('productos') ? idDelFunnelDefault() : Promise.resolve(null),
    pide('contacto') ? leadsYaContactados(ids) : Promise.resolve(new Set<number>()),
    // `evento` y `otro` son reacciones y protocolo, no un mensaje del lead (lib/setter-conversacion.ts).
    // `tipo` admite NULL: un `not in` pelado lo dejaría afuera (NULL no es «distinto de»).
    pide('respondio') ? idsConAlMenosUnaFila(ids, (pend) => leadIdsDe(db.from('wa_mensajes').select('lead_id')
      .in('lead_id', pend).eq('from_me', false).or('tipo.is.null,tipo.not.in.(evento,otro)'), 'wa_mensajes')) : Promise.resolve(new Set<number>()),
    pide('respondio') ? idsConAlMenosUnaFila(ids, (pend) => leadIdsDe(db.from('nutricion_inscripciones').select('lead_id')
      .in('lead_id', pend).eq('estado', 'respondio'), 'nutricion_inscripciones')) : Promise.resolve(new Set<number>()),
    catalogoLead ? hechosDelCatalogo(db, ids, filasLead, fuentes, filas ?? []) : Promise.resolve(null),
  ]);
  const ahoraMs = Date.now();
  for (const f of filasLead) {
    const etapaCasa = pipelineStageOf({
      estado_lead: f.estado_lead, pipeline_stage: f.pipeline_stage, fecha_agenda: f.fecha_agenda,
      fecha_junta_1: f.fecha_junta_1 ?? null, fecha_junta_2: f.fecha_junta_2 ?? null,
      asistio_j1: f.asistio_j1, asistio_j2: f.asistio_j2, nutricion_realizada: f.nutricion_realizada ?? undefined,
    });
    const porProducto = new Map(productos.get(f.id) ?? []);
    const casa = pide('productos') ? casaReal(f.funnel_id == null ? null : Number(f.funnel_id), defaultId) : null;
    if (casa != null) porProducto.set(casa, etapaCasa);
    const delCatalogo = catalogo?.(f, ahoraMs);
    out.set(f.id, hechosDeLead(f, {
      etiquetas: etiquetasQueCuentan(etiquetas.get(f.id) ?? [], archivadas),
      etapaCasa,
      etapasPorProducto: porProducto,
      yaContactado: contactados.has(f.id),
      respondio: escribieron.has(f.id) || pausaron.has(f.id),
      ...(delCatalogo ? { catalogo: delCatalogo } : {}),
    }, ahoraMs));
  }
  return out;
}

/**
 * Las fuentes del CATÁLOGO (lib/condiciones-catalogo.ts), una lectura por fuente para todo el lote.
 * Devuelve la función que arma el bloque `catalogo` de cada lead con lo leído. Una fuente que
 * ninguna fila pide no se lee, y su bloque queda AUSENTE: la condición que lo necesitara devuelve
 * «no sé» y no se cumple.
 *
 * ⚠️ SIN LAS CLASES DE LA PAPELERA, NI LOS HILOS DE CLASE: `curso_clases` y `curso_modulos` van con
 * `borrada_at`/`borrado_at` nulo (tests/curso-papelera.test.ts) y `comunidad_posts` sin `clase_id`
 * (los comentarios de una clase no son publicar en la comunidad: tests/curso-comentarios-clase.test.ts).
 */
async function hechosDelCatalogo(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  ids: readonly number[],
  filasLead: ReadonlyArray<{ id: number; visitor_id?: string | null } & Record<string, unknown>>,
  fuentes: ReadonlySet<Fuente>,
  filas: readonly FilaCondicion[],
): Promise<(f: FilaLeadCatalogo & { id: number } & Record<string, unknown>, ahoraMs: number) => HechosCatalogo> {
  const pide = (x: Fuente) => fuentes.has(x);
  const visitantes = [...new Set(filasLead.map((f) => f.visitor_id).filter((v): v is string => !!v))];

  const leerVsl = async () => (pide('vsl') ? getVslEngagementMap(visitantes) : null);
  const leerClics = async (): Promise<Map<string, number> | null> => {
    if (!pide('clics')) return null;
    const m = new Map<string, number>();
    for (const tanda of enTandas(visitantes, 200)) {
      for (const r of await leerTodo<{ id: number; visitor_id: string }>(db, 'vsl_events', 'id, visitor_id', {
        orden: 'id', filtros: (q) => q.in('visitor_id', tanda).eq('tipo_evento', 'click') as ConsultaPaginada,
      })) m.set(r.visitor_id, (m.get(r.visitor_id) ?? 0) + 1);
    }
    return m;
  };
  const leerRespuestas = async (): Promise<Map<number, string[]> | null> => {
    if (!pide('respuestas')) return null;
    const m = new Map<number, string[]>();
    for (const tanda of enTandas(ids, 200)) {
      for (const r of await leerTodo<{ id: number; lead_id: number; respuestas: unknown }>(db, 'lead_respuestas', 'id, lead_id, respuestas', {
        orden: 'id', filtros: (q) => q.in('lead_id', tanda) as ConsultaPaginada,
      })) {
        const arr = m.get(Number(r.lead_id)) ?? [];
        for (const qa of Array.isArray(r.respuestas) ? r.respuestas : []) {
          const o = qa as { q?: unknown; a?: unknown };
          if (typeof o.a === 'string') arr.push(o.a);
        }
        m.set(Number(r.lead_id), arr);
      }
    }
    return m;
  };
  const leerPagos = async (): Promise<Map<number, Array<{ pagado: boolean | null; fecha_esperada: string | null }>> | null> => {
    if (!pide('pagos')) return null;
    const m = new Map<number, Array<{ pagado: boolean | null; fecha_esperada: string | null }>>();
    for (const tanda of enTandas(ids, 200)) {
      for (const r of await leerTodo<{ id: number; lead_id: number; pagado: boolean | null; fecha_esperada: string | null }>(db, 'pagos', 'id, lead_id, pagado, fecha_esperada', {
        orden: 'id', filtros: (q) => q.in('lead_id', tanda) as ConsultaPaginada,
      })) {
        const arr = m.get(Number(r.lead_id)) ?? [];
        arr.push({ pagado: r.pagado, fecha_esperada: r.fecha_esperada });
        m.set(Number(r.lead_id), arr);
      }
    }
    return m;
  };
  const leerCurso = async () => {
    if (!pide('curso')) return null;
    const [{ progresoDeClientes, aClase, COLUMNAS_CLASE }] = await Promise.all([import('@/lib/curso-datos')]);
    const [filasClase, progreso] = await Promise.all([
      leerTodo<Parameters<typeof aClase>[0] & { id: number }>(db, 'curso_clases', COLUMNAS_CLASE, {
        orden: 'id', filtros: (q) => q.is('borrada_at', null) as ConsultaPaginada,
      }),
      progresoDeClientes(ids),
    ]);
    return { clases: filasClase.map(aClase), progreso };
  };
  const leerAcceso = async (): Promise<Map<number, { ingresos: number; ultimoMs: number | null }> | null> => {
    if (!pide('acceso')) return null;
    // Un alias y no el tipo en línea: los guards que barren las consultas a la tabla cortan la
    // sentencia en el primer «;», y el de un tipo en línea les escondía el filtro (tests/curso-accesos-area.test.ts).
    type FilaAcceso = { id: number; lead_id: number; ingresos: number | null; ultimo_ingreso_at: string | null; area: string | null };
    const m = new Map<number, { ingresos: number; ultimoMs: number | null }>();
    for (const tanda of enTandas(ids, 200)) {
      // El acceso del CLIENTE (`area` nula): el de un líder de área es otra persona.
      for (const r of await leerTodo<FilaAcceso>(db, 'curso_accesos', 'id, lead_id, ingresos, ultimo_ingreso_at, area', {
        orden: 'id', filtros: (q) => q.in('lead_id', tanda).is('area', null) as ConsultaPaginada,
      })) {
        const ms = r.ultimo_ingreso_at ? Date.parse(r.ultimo_ingreso_at) : NaN;
        m.set(Number(r.lead_id), { ingresos: Number(r.ingresos ?? 0), ultimoMs: Number.isFinite(ms) ? ms : null });
      }
    }
    return m;
  };
  const leerComunidad = async () => {
    if (!pide('comunidad')) return null;
    const posts = new Map<number, number>();
    const comentarios = new Map<number, number>();
    const comento = new Map<number, Set<number>>();
    type FilaDeLead = { id: number; lead_id: number };   // alias: ver FilaAcceso (tests/curso-comentarios-clase.test.ts)
    for (const tanda of enTandas(ids, 200)) {
      for (const r of await leerTodo<FilaDeLead>(db, 'comunidad_posts', 'id, lead_id', {
        orden: 'id', filtros: (q) => q.in('lead_id', tanda).is('clase_id', null) as ConsultaPaginada,
      })) posts.set(Number(r.lead_id), (posts.get(Number(r.lead_id)) ?? 0) + 1);
      for (const r of await leerTodo<{ id: number; lead_id: number; post_id: number }>(db, 'comunidad_comentarios', 'id, lead_id, post_id', {
        orden: 'id', filtros: (q) => q.in('lead_id', tanda) as ConsultaPaginada,
      })) {
        const lead = Number(r.lead_id);
        comentarios.set(lead, (comentarios.get(lead) ?? 0) + 1);
        const s = comento.get(lead) ?? new Set<number>();
        s.add(Number(r.post_id));
        comento.set(lead, s);
      }
    }
    return { posts, comentarios, comento };
  };
  const leerEntrega = async (): Promise<Map<string, Set<number>> | null> => {
    if (!pide('entrega')) return null;
    const { clientesEnEtapaDeEntrega } = await import('@/app/customer-success/entrega');
    const m = new Map<string, Set<number>>();
    // Una lectura por etapa que el flujo NOMBRA (no por lead): la cohorte del kanban, con su regla
    // derivada (sin fila = la primera etapa) y el universo de clientes, no las filas.
    for (const { productoId, etapa } of etapasEntregaDeFilas(filas)) {
      m.set(`${productoId}:${etapa}`, new Set(await clientesEnEtapaDeEntrega(productoId, etapa)));
    }
    return m;
  };
  const leerCs = async (): Promise<Map<number, string> | null> => {
    if (!pide('cs')) return null;
    const m = new Map<number, string>();
    for (const tanda of enTandas(ids, 200)) {
      for (const r of await leerTodo<{ id: number; lead_id: number; estado: string | null }>(db, 'cs_clientes', 'id, lead_id, estado', {
        orden: 'id', filtros: (q) => q.in('lead_id', tanda) as ConsultaPaginada,
      })) if (r.estado) m.set(Number(r.lead_id), String(r.estado));
    }
    return m;
  };
  const leerHoy = async (): Promise<string> => (pide('pagos') ? hoyEnTz(await tzActual()) : '');

  const [vsl, clics, respuestas, pagos, curso, acceso, comunidad, entrega, cs, hoy] = await Promise.all([
    leerVsl(), leerClics(), leerRespuestas(), leerPagos(), leerCurso(), leerAcceso(), leerComunidad(), leerEntrega(), leerCs(), leerHoy(),
  ]);

  return (f, ahoraMs) => {
    const c: HechosCatalogo = { lead: catalogoDeLead(f, ahoraMs) };
    const vid = typeof f.visitor_id === 'string' && f.visitor_id ? f.visitor_id : null;
    if (vsl) {
      // Sin visitante no se lo pudo seguir: «no sé». Con visitante y sin eventos, 0 (no reprodujo).
      const e = vid ? vsl.get(vid) : undefined;
      c.vsl = vid ? { plays: e?.plays ?? 0, maxPct: e?.max_pct ?? null } : null;
    }
    if (clics) c.clics = vid ? clics.get(vid) ?? 0 : null;
    if (respuestas) {
      const viejas = [
        f.respuesta_facturacion, f.respuesta_colaboradores, f.respuesta_objetivo, f.respuesta_cuando_empezar,
        f.respuesta_inversion, f.respuesta_decisor,
      ].filter((x): x is string => typeof x === 'string');
      // El formulario de Meta llega como [{ name, values[] }]: las preguntas propias, sin los datos
      // de contacto (buscar «gmail» en «las respuestas» no es una pregunta del formulario).
      const CONTACTO = new Set(['full_name', 'first_name', 'last_name', 'phone_number', 'email']);
      const meta = Array.isArray(f.meta_field_data)
        ? (f.meta_field_data as Array<{ name?: unknown; values?: unknown }>)
          .filter((x) => !CONTACTO.has(String(x?.name ?? '')))
          .flatMap((x) => (Array.isArray(x?.values) ? x.values : []))
          .filter((x): x is string => typeof x === 'string')
        : [];
      c.respuestas = normalizarTexto([...(respuestas.get(f.id) ?? []), ...viejas, ...meta].join(' · '));
    }
    if (pagos) c.pagos = resumenPagos(pagos.get(f.id) ?? [], hoy);
    if (curso) c.curso = resumenCursoDeAlumno(curso.clases, curso.progreso.get(f.id));
    if (acceso) c.acceso = acceso.get(f.id) ?? null;
    if (comunidad) {
      c.comunidad = {
        posts: comunidad.posts.get(f.id) ?? 0,
        comentarios: comunidad.comentarios.get(f.id) ?? 0,
        comentoPosts: comunidad.comento.get(f.id) ?? new Set<number>(),
      };
    }
    if (entrega) c.entrega = new Set([...entrega].filter(([, leads]) => leads.has(f.id)).map(([k]) => k));
    if (cs) c.estadoCliente = cs.get(f.id) ?? 'activo';
    return c;
  };
}

// ── Los HILOS de una inscripción (segunda tanda, 08/10/2026) ───────────────────
// Varias flechas en paralelo = varios caminos A LA VEZ en UNA inscripción (`hilos`, mig 0228).
// Las decisiones viven en lib/nutricion-hilos.ts (puro, con test); acá sólo se lee y se escribe.

/** Una fila de la cola del motor. `h` es el hilo que se está moviendo en esta vuelta (si hay hilos). */
type FilaCola = {
  id: number; lead_id: number; secuencia_id: number; paso_actual: number; nodo_actual: string | null;
  proximo_envio_at?: string | null; hilos?: unknown; hilos_rev?: number | null; h?: string | null;
};

/** Lo que la puerta sabe de la posición de la fila: sus hilos, el hilo que se mueve y su tarjeta. */
function leidoDePosicion(insc: FilaCola, pasos: readonly PasoSecuencia[]): LeidoPosicion {
  const idx = insc.nodo_actual ? indicePorId(pasos, insc.nodo_actual) : indiceActual(pasos, insc);
  return {
    hilos: sanearHilos(insc.hilos), h: insc.h ?? null,
    nodo: insc.nodo_actual || (idx >= 0 ? idDe(pasos[idx], idx) : null),
    proximo_envio_at: insc.proximo_envio_at ?? null,
  };
}

/**
 * La escritura de la posición EN MODO HILOS, con compare-and-set por `hilos_rev`.
 *
 * ⚠️ PERDER EL COMPARE-AND-SET NO SIGNIFICA QUE OTRA CORRIDA MOVIÓ ESTE HILO: cualquier escritura de
 * la fila sube la revisión, incluida la de OTRO hilo. Se relee y el cambio se vuelve a aplicar sólo
 * si este hilo sigue en la tarjeta en la que se lo leyó (`hiloSigueEn`); si otra corrida ya lo movió,
 * el cambio es de ella y esto devuelve false (el «otra corrida ya movió esta inscripción» de siempre).
 * La primera conversión de un cursor exige además `hilos` NULL (y, en modo 'cas', el paso y el nodo
 * leídos, como `moverConCas`).
 */
async function escribirHilos(
  db: Awaited<ReturnType<typeof getTenantDb>>, insc: FilaCola, pasos: readonly PasoSecuencia[],
  campos: Record<string, unknown>, o: { modo: 'cas' | 'activa' | 'fila'; alcance?: 'hilo' | 'inscripcion'; nuevos?: readonly Hilo[] },
): Promise<boolean> {
  for (let intento = 0; intento < 3; intento++) {
    const leido = leidoDePosicion(insc, pasos);
    const plan = planDePosicion(pasos, leido, campos, o);
    const rev = Number(insc.hilos_rev) || 0;
    let q = db.from('nutricion_inscripciones')
      .update({ ...plan.update, hilos_rev: rev + 1, updated_at: ahoraISO() })
      .eq('id', insc.id).eq('estado', 'activa').eq('hilos_rev', rev);
    if (!leido.hilos) {
      q = q.is('hilos', null);
      if (o.modo === 'cas') q = insc.nodo_actual == null ? q.eq('paso_actual', insc.paso_actual).is('nodo_actual', null) : q.eq('paso_actual', insc.paso_actual).eq('nodo_actual', insc.nodo_actual);
    } else {
      // ⚠️ LO LEÍDO TENÍA HILOS: LA FILA TIENE QUE SEGUIR TENIÉNDOLOS. Las dos retomas —el «Ir a»
      // desde «Si responde» (`responderConGrafo`) y el destrabe de `requiere: 'respondio'`— dejan
      // `hilos` en NULL con la fila 'activa' y SIN subir `hilos_rev`, así que la revisión sola no
      // las ve: una escritura del motor leída antes (el lote se lee una vez y se recorre en serie,
      // mandando) ganaba el compare-and-set y escribía el array viejo encima, reviviendo los hilos
      // congelados y pisando la tarjeta a la que la persona lo mandó (decisión 4; revisión del
      // 09/10/2026). Así pierde, la relectura da `hiloSigueEn(null, …)` = false y no escribe.
      q = q.not('hilos', 'is', null);
    }
    const { data, error } = await q.select('id');
    if (error) {
      if (o.modo === 'cas') throw new Error(`procesarEnvios (hilos de la inscripción ${insc.id}): ${error.message}`);
      console.error(`[nutricion] hilos de la inscripción ${insc.id}: ${error.message}`);
      return false;
    }
    if (((data ?? []) as unknown[]).length > 0) {
      if (plan.modo === 'hilos') insc.hilos = plan.hilos;
      insc.hilos_rev = rev + 1;
      if (!leido.hilos) insc.h = HILO_PRINCIPAL;
      if (plan.modo === 'hilos' && plan.descartados) console.warn(`[nutricion] inscripción ${insc.id}: ${plan.descartados} flecha(s) en paralelo no arrancaron (ya corría ese hilo o el tope de ${TOPE_HILOS})`);
      return true;
    }
    const { data: f } = await db.from('nutricion_inscripciones')
      .select('estado, paso_actual, nodo_actual, proximo_envio_at, hilos, hilos_rev').eq('id', insc.id).maybeSingle();
    const fila = f as { estado: string; paso_actual: number; nodo_actual: string | null; proximo_envio_at: string | null; hilos: unknown; hilos_rev: number | null } | null;
    if (!fila || fila.estado !== 'activa') return false;
    const hs = sanearHilos(fila.hilos);
    const sigue = leido.hilos
      ? hiloSigueEn(hs, leido.h ?? HILO_PRINCIPAL, leido.nodo)
      : hs ? hiloSigueEn(hs, HILO_PRINCIPAL, leido.nodo) : !(o.modo === 'cas' && (fila.paso_actual !== insc.paso_actual || fila.nodo_actual !== insc.nodo_actual));
    if (!sigue) return false;
    insc.hilos = fila.hilos; insc.hilos_rev = fila.hilos_rev;
    if (hs && !leido.hilos) insc.h = HILO_PRINCIPAL;
  }
  return false;
}

/**
 * El REPARTO INICIAL: una fila nueva de un flujo con más de una raíz (el CRON con flechas en
 * paralelo) pasa a un hilo por raíz la primera vez que el motor la procesa. Sirve igual para la
 * inscripción por evento, la del cron, la manual y la reusada (todas dejan la fila igual). Con
 * compare-and-set contra la fila nueva: dos corridas no reparten dos veces.
 */
async function repartirAlEntrar(
  db: Awaited<ReturnType<typeof getTenantDb>>, insc: FilaCola, pasos: readonly PasoSecuencia[], proximoDe: (nodo: string) => string,
): Promise<Hilo[] | null> {
  const ini = hilosIniciales(pasos, proximoDe);
  if (!ini) return null;
  const { resumen } = aplicarAHilo(pasos, ini, ini[0].h, {});
  const rev = Number(insc.hilos_rev) || 0;
  const { data, error } = await db.from('nutricion_inscripciones')
    .update({ ...resumen, hilos: ini, hilos_rev: rev + 1, updated_at: ahoraISO() })
    .eq('id', insc.id).eq('estado', 'activa').eq('paso_actual', 0).is('nodo_actual', null).is('hilos', null).eq('hilos_rev', rev)
    .select('id');
  if (error) throw new Error(`procesarEnvios (reparto de la inscripción ${insc.id}): ${error.message}`);
  if (!((data ?? []) as unknown[]).length) return null;
  insc.hilos = ini;
  insc.hilos_rev = rev + 1;
  return ini;
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
  // La zona del NEGOCIO, una vez por corrida (decisión 6). Sin `mako.timezone`, o si no se pudo
  // leer, Ciudad de México: lo que el motor hacía siempre. No se AVERIGUA acá (`tzDeWorkspace`
  // sale a la red): el cron no puede colgarse por una zona.
  if (!opts?.ignorarVentana && !dentroDeVentana(zonaDelMotor(await getSetting(KEY_TIMEZONE).catch(() => null)))) {
    return { ...res, saltado: 'fuera-de-ventana-horaria' };
  }
  const presupuesto = MAX_POR_DIA - (await enviosUltimas24h('whatsapp'));

  const supabase = (await getTenantDb());
  const secuencias = await getSecuenciasActivas();
  const porId = new Map(secuencias.map((s) => [s.id, s]));
  // EL EMAIL, CON SU PROPIO TOPE (decisión 5): las secuencias que mandan algún email siguen con el
  // cupo de WhatsApp cumplido, como las acciones, mientras quede tope de email.
  const conEmail = secuencias.filter((s) => s.pasos.some((p) => claseDe(p) === 'mensaje' && !esPasoAccion(p) && p.canal === 'email')).map((s) => s.id);
  const presupuestoEmail = conEmail.length ? MAX_EMAIL_POR_DIA - (await enviosUltimas24h('email')) : 0;
  let emailsEnCorrida = 0;
  const emailLleno = (): boolean => emailsEnCorrida >= presupuestoEmail;
  /**
   * LAS SECUENCIAS CON PASOS «⚡ ACCIÓN». El tope diario y el de la corrida son el
   * presupuesto ANTI-BAN de la línea de WhatsApp: cuentan mensajes. Una acción no es un
   * mensaje, así que no lo gasta ni lo respeta — con el tope cumplido, «mover al lead a
   * Contactado» no puede quedar congelado hasta mañana por WhatsApps que no tienen nada
   * que ver. Cuando el cupo de mensajes se acaba, el motor sigue mirando SÓLO estas.
   * Sin ninguna, todo es exactamente como antes (incluido el corte por tope diario).
   */
  const conAcciones = secuencias.filter((s) => s.pasos.some(esPasoAccion)).map((s) => s.id);
  // Lo que puede seguir con el cupo de WHATSAPP cumplido: las acciones y, con tope de email, los emails.
  const sinTopeWa = [...new Set([...conAcciones, ...(presupuestoEmail > 0 ? conEmail : [])])];
  if (presupuesto <= 0 && !sinTopeWa.length) return { ...res, saltado: 'tope-diario' };
  const cupo = Math.max(0, Math.min(MAX_POR_CORRIDA, presupuesto));
  // El cupo cuenta SÓLO WhatsApp (decisión 5): `waEnCorrida`, no `res.enviados`, que suma el email.
  let waEnCorrida = 0;
  const cupoLleno = (): boolean => waEnCorrida >= cupo;
  /** ¿Este nodo puede correr con el cupo de WhatsApp lleno? Una acción sí; un email, si queda su tope. */
  const sigueSinCupoWa = (p: PasoSecuencia): boolean => esPasoAccion(p) || (claseDe(p) === 'mensaje' && p.canal === 'email' && !emailLleno());
  // LO QUE SALIÓ EN ESTA CORRIDA, por lead y por canal: el freno de la base se lee por lote y no
  // se entera de lo que el lote acaba de mandar (dos hilos del mismo lead en la misma vuelta).
  const enviadoEnCorrida: EnviadoEnCorrida = new Map();
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
      // El nodo que lo dejó (mig 0223): `paso` es una posición y con ramas no dice cuál.
      nodo_id: idDe(paso, insc.paso_actual),
      canal: paso.canal,
      estado: 'omitido',
      destino: paso.canal === 'whatsapp' ? lead?.telefono ?? null : lead?.email ?? null,
      asunto: paso.asunto,
      error: motivo,
    });
    if (error) console.error(`[nutricion] rastro del cierre de la inscripción ${insc.id} (${motivo}): ${error.message}`);
  };

  /**
   * LA POSICIÓN SE ESCRIBE CON COMPARE-AND-SET contra lo que se LEYÓ de la fila: sigue activa,
   * en el mismo `paso_actual` y el mismo `nodo_actual`. El cron y la vía rápida de un evento
   * corren el mismo motor; sin esto, los dos resolvían la misma condición y avanzaban dos
   * veces. `true` = la movió esta corrida.
   */
  const moverConCas = async (
    insc: { id: number; paso_actual: number; nodo_actual?: string | null },
    campos: Record<string, unknown>,
  ): Promise<boolean> => {
    const q = supabase.from('nutricion_inscripciones')
      .update({ ...campos, updated_at: ahoraISO() })
      .eq('id', insc.id).eq('estado', 'activa').eq('paso_actual', insc.paso_actual);
    const { data, error } = await (insc.nodo_actual == null ? q.is('nodo_actual', null) : q.eq('nodo_actual', insc.nodo_actual)).select('id');
    if (error) throw new Error(`procesarEnvios (posición de la inscripción ${insc.id}): ${error.message}`);
    return ((data ?? []) as unknown[]).length > 0;
  };

  /**
   * LA PUERTA DE LA POSICIÓN (segunda tanda, 08/10/2026). Toda escritura de dónde está una
   * inscripción —avanzar, esperar, cerrar, reprogramar— pasa por acá y por ningún otro lado:
   * eran 23 `update` sueltos, y con varios hilos en una inscripción cada uno tenía que saber de
   * hilos. Así lo sabe uno solo.
   *
   * `modo` es lo que cada escritura hacía antes, sin tocarle una coma:
   *   · 'cas'    — compare-and-set contra lo leído (`moverConCas`): sigue activa, en el mismo
   *                `paso_actual` y el mismo `nodo_actual`. Las que DECIDEN algo (resolver una
   *                condición, reclamar una acción): dos corridas no pueden decidir lo mismo.
   *   · 'activa' — sólo si sigue activa.
   *   · 'fila'   — por id, como siempre (reprogramar un reintento, el avance después de mandar).
   * `alcance` dice qué cierra un `estado: 'completada' | 'cancelada'`: el hilo (lo de siempre:
   * con un solo cursor, hilo e inscripción son lo mismo) o la inscripción entera (la reunión ya
   * pasó, el residuo ya no aplica, el tope de saltos). `nuevos`: los hilos que arrancan (las
   * flechas en paralelo de la tarjeta que terminó). Con hilos —o con el primer reparto— decide
   * `planDePosicion` y escribe `escribirHilos`; sin nada de eso, lo de siempre, tal cual.
   */
  type ModoEscritura = 'cas' | 'activa' | 'fila';
  const escribir = async (
    insc: FilaCola,
    campos: Record<string, unknown>,
    o: { modo: ModoEscritura; alcance?: 'hilo' | 'inscripcion'; nuevos?: readonly Hilo[] },
  ): Promise<boolean> => {
    const pasosInsc = porId.get(insc.secuencia_id)?.pasos ?? [];
    if (planDePosicion(pasosInsc, leidoDePosicion(insc, pasosInsc), campos, o).modo === 'hilos') return escribirHilos(supabase, insc, pasosInsc, campos, o);
    if (o.modo === 'cas') return moverConCas(insc, campos);
    let q = supabase.from('nutricion_inscripciones').update({ ...campos, updated_at: ahoraISO() }).eq('id', insc.id);
    if (o.modo === 'activa') q = q.eq('estado', 'activa');
    const { error } = await q;
    // Como antes, no tira: un reintento que no se reprogramó vuelve en la corrida que viene.
    if (error) { console.error(`[nutricion] posición de la inscripción ${insc.id}: ${error.message}`); return false; }
    return true;
  };

  /**
   * A dónde pasa la inscripción después de un nodo que salió (o se omitió): su `siguiente` por
   * el grafo, no el índice + 1. Devuelve los campos del avance y si lo que sigue YA toca, para
   * mirarlo en esta misma corrida (`otraVuelta`), como hace la acción.
   */
  /** Un hilo nuevo por flecha en paralelo, con su programación de siempre y no antes de `desdeMs`. */
  const nuevosDe = (sec: Secuencia, destinos: ReadonlyArray<{ destino: string; desdeMs: number }>, lead: JuntasLead | null | undefined): Hilo[] =>
    destinos.map((r) => ({ h: r.destino, nodo: r.destino, proximo: new Date(Math.max(r.desdeMs, Date.parse(proximoEnvioDePaso(nodoPorId(sec.pasos, r.destino) ?? undefined, lead)))).toISOString() }));
  const avanceDesde = (sec: Secuencia, idx: number, lead: JuntasLead | null | undefined): { campos: Record<string, unknown>; yaToca: boolean; nuevos: Hilo[] } => {
    // Las flechas en paralelo de la tarjeta que terminó arrancan ahora (vacío sin paralelos).
    const nuevos = nuevosDe(sec, repartosDe(sec.pasos, idx).map((destino) => ({ destino, desdeMs: Date.now() })), lead);
    // Un hilo que acaba de arrancar ya vencido se mira en esta misma corrida (otra vuelta).
    const nuevoYa = nuevos.some((n) => Date.parse(n.proximo) <= Date.now());
    const j = siguienteIndice(sec.pasos, idx);
    if (j < 0) return { campos: { paso_actual: idx + 1, nodo_actual: null, proximo_envio_at: null, estado: 'completada' }, yaToca: nuevoYa, nuevos };
    const proximo = proximoEnvioDePaso(sec.pasos[j], lead);
    return {
      nuevos,
      campos: { paso_actual: j, nodo_actual: idDe(sec.pasos[j], j), proximo_envio_at: proximo, estado: 'activa' },
      // Sólo lo que NO es un mensaje se mira en la misma corrida (una condición, una espera, una
      // acción): un segundo mensaje pegado al primero sale en la corrida que viene, como siempre
      // —el anti-ban de 20 h lo frenaría igual, y así no deja un «msg <20h» por cada envío—.
      yaToca: (claseDe(sec.pasos[j]) !== 'mensaje' && Date.parse(proximo) <= Date.now()) || nuevoYa,
    };
  };

  // Cola PAGINADA: los 'omitido'/'saltado' no consumen cupo, así que una sola
  // ventana de cupo*3 podía llenarse de filas sin envío real y postergar los
  // envíos de verdad. Iteramos lotes (dedup por id de inscripción) hasta llenar
  // el cupo o drenar la cola de vencidas.
  // Con el cupo de mensajes ya en cero sólo quedan acciones por correr: el lote no puede
  // ser `0 × 3`, o el `.limit(0)` no traería ninguna.
  const LOTE = (cupo > 0 ? cupo : MAX_POR_CORRIDA) * 3;
  const vistos = new Set<number>();
  // Los hilos ya mirados en esta corrida, por fila, hilo y TARJETA: uno que se movió a otra
  // tarjeta ya vencida (una condición, una espera) se vuelve a mirar; uno frenado, no.
  const hilosVistos = new Set<string>();
  let rondas = 0;
  // Cuántas filas del residuo ya pasaron al envío en esta corrida (#790): ver
  // `RESIDUO_POR_CORRIDA` y su uso más abajo.
  let residuoEnCorrida = 0;

  while ((!cupoLleno() || sinTopeWa.length > 0) && rondas < 6) {
    rondas += 1;
    // Una acción de esta vuelta dejó su inscripción con el paso siguiente ya vencido.
    let otraVuelta = false;
    let q = supabase
      .from('nutricion_inscripciones')
      // `hilos, hilos_rev` (mig 0228, ANTES del deploy): sin la columna PostgREST rechaza la consulta entera.
      .select('id, lead_id, secuencia_id, paso_actual, nodo_actual, proximo_envio_at, hilos, hilos_rev')
      .eq('estado', 'activa')
      .lte('proximo_envio_at', ahoraISO());
    // Vía rápida de UN lead (enrolamiento por evento): reusa TODO el motor
    // (anti-ban, audio, borradores, gates) sin esperar la corrida del cron.
    if (opts?.soloLeadId) q = q.eq('lead_id', opts.soloLeadId);
    // Sin cupo de mensajes, lo único que puede correr es un paso de acción: no se leen
    // las filas de las secuencias que no tienen ninguno.
    if (cupoLleno()) q = q.in('secuencia_id', sinTopeWa);
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
    const fetched = (dueRaw ?? []) as FilaCola[];
    const due = fetched.filter((d) => !vistos.has(d.id));
    if (due.length === 0) break;
    for (const d of due) vistos.add(d.id);

    // LOS HECHOS DEL LEAD, sólo si alguien del lote está por pasar por una condición, y en UNA
    // lectura para todos (`hechosDeLeads`). Se piden la primera vez que hacen falta. `null` = la
    // lectura falló: esa inscripción se saltea sin decidir nada y queda vencida para la próxima.
    // Con hilos, cualquiera de sus tarjetas (o de las raíces de una fila que se va a repartir).
    const quienesDeciden = due.filter((d) => {
      const s = porId.get(d.secuencia_id);
      return !!s && nodosDeLaFila(s.pasos, d, indiceActual(s.pasos, d)).some((i) => necesitaHechos(s.pasos, i));
    });
    const leadsQueDeciden = [...new Set(quienesDeciden.map((d) => d.lead_id))];
    // Las condiciones de esos flujos deciden QUÉ se lee (`fuentesDeFilas`): una lectura por fuente
    // para todo el lote, y ninguna de lo que nadie pregunta.
    const filasQueDeciden: FilaCondicion[] = [...new Set(quienesDeciden.map((d) => d.secuencia_id))]
      .flatMap((sid) => filasDelFlujo(porId.get(sid)?.pasos ?? []));
    let hechosLeidos: Promise<Map<number, HechosLead> | null> | null = null;
    const hechosDe = (leadId: number): Promise<HechosLead | null> => {
      if (!leadsQueDeciden.length) return Promise.resolve(null);
      hechosLeidos ??= hechosDeLeads(supabase, leadsQueDeciden, filasQueDeciden).catch((e: unknown) => {
        console.error('[nutricion] hechos del lead para las condiciones:', e instanceof Error ? e.message : String(e));
        return null;
      });
      return hechosLeidos.then((m) => m?.get(leadId) ?? null);
    };

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
      const lead = leadMap.get(insc.lead_id);
      // ── LOS HILOS (segunda tanda): una fila nueva con varias raíces se reparte; con hilos, se
      // toma UNO —el vencido más antiguo que no se miró en esta corrida en esa tarjeta— y se lo
      // trata como el cursor de siempre. Si quedan otros vencidos, la fila vuelve a la cola.
      let hs = sanearHilos(insc.hilos);
      if (sec && !hs && esFilaNueva(insc) && raicesSalida(sec.pasos).length > 1) {
        hs = await repartirAlEntrar(supabase, insc, sec.pasos, (n) => proximoEnvioDePaso(nodoPorId(sec.pasos, n) ?? undefined, lead));
        if (!hs) continue;
      }
      if (sec && hs) {
        const libres = hilosVencidos(hs, Date.now()).filter((x) => !hilosVistos.has(`${insc.id}:${x.h}:${x.nodo}`));
        if (!libres.length) continue;
        hilosVistos.add(`${insc.id}:${libres[0].h}:${libres[0].nodo}`);
        if (libres.length > 1) { vistos.delete(insc.id); otraVuelta = true; }
        insc.h = libres[0].h;
        insc.nodo_actual = libres[0].nodo;
        insc.paso_actual = indicePorId(sec.pasos, libres[0].nodo);
      }
      // EL NODO ACTUAL (diseño §2): por `nodo_actual`, y si no hay o ya no existe,
      // `pasos[paso_actual]`. Una fila que nunca avanzó está en la ENTRADA de la salida.
      const idxLeido = sec ? indiceActual(sec.pasos, insc) : -1;
      const pasoLeido = sec && idxLeido >= 0 ? sec.pasos[idxLeido] : undefined;
      // Con el cupo de mensajes lleno, un MENSAJE queda para la corrida que viene, sin
      // tocarlo (era un `break`: lo mismo para los mensajes). Una ACCIÓN sigue: no gasta cupo.
      if (cupoLleno() && !(pasoLeido && sigueSinCupoWa(pasoLeido))) continue;
      if (!sec || !pasoLeido) {
        // Una automatización SIN salida (sólo «Si responde») no tiene nada que mandar por su
        // cuenta: la inscripción queda ACTIVA y sin próximo envío, esperando que el lead
        // escriba (`pausarPorRespuesta` la toma de ahí). Cerrarla la dejaría sorda.
        if (sec && raizSalida(sec.pasos) == null && raizRespuesta(sec.pasos) != null) {
          await escribir(insc, { proximo_envio_at: null }, { modo: 'activa' });
          continue;
        }
        // Sin la secuencia se cierra la inscripción; sin la tarjeta, el camino en el que estaba.
        await escribir(insc, { estado: 'completada', proximo_envio_at: null }, { modo: 'fila', alcance: sec ? 'hilo' : 'inscripcion' });
        // La tarjeta en la que estaba se BORRÓ: no se cae a `pasos[paso_actual]`, que con ramas
        // puede ser otra rama (`indiceActual`, revisión del 08/10/2026). Se cierra y se dice.
        if (sec && insc.nodo_actual != null) {
          res.omitidos += 1;
          // Sin la tarjeta no hay canal que decir: no se inventa uno.
          res.detalle.push({ lead_id: insc.lead_id, canal: '—', estado: 'omitido', nota: `la tarjeta en la que estaba (${insc.nodo_actual}) ya no existe` });
        }
        continue;
      }

      // ── LOS NODOS DE CONTROL, ANTES DE LAS GUARDAS (diseño §2) ─────────────────────
      // Una condición, una espera o un «Ir a» no mandan nada: se RESUELVEN (`resolverControl`,
      // lib/nutricion-grafo-motor.ts), el resultado se escribe con compare-and-set y se sigue.
      // Las guardas de abajo (reunión, residuo, antigüedad, anti-ban…) son del mensaje o la
      // acción a la que se llega, no de la tarjeta que decide por dónde ir.
      if (esNodoDeControl(pasoLeido)) {
        const hechos = necesitaHechos(sec.pasos, idxLeido) ? await hechosDe(insc.lead_id) : null;
        const r = resolverControl(sec.pasos, idxLeido, { hechos, ahoraMs: Date.now(), reunionMs: reunionFuturaMs(lead) });
        const canalCtl = pasoLeido.canal;
        // Las flechas en paralelo que la resolución encontró (de una espera, del inicio o —cuarta
        // tanda, punto 8— del RESULTADO elegido de una condición) arrancan con cualquier desenlace
        // del camino, salvo un cierre de la inscripción entera. Un hilo por flecha, por la misma
        // puerta (`escribir`, con su compare-and-set de `hilos_rev`).
        const nuevos = r.tipo === 'faltan_hechos' ? [] : nuevosDe(sec, r.repartos, lead);
        if (nuevos.some((n) => Date.parse(n.proximo) <= Date.now())) { vistos.delete(insc.id); otraVuelta = true; }
        const cerrar = async (motivo: string, rastro: boolean, alcance: 'hilo' | 'inscripcion' = 'hilo'): Promise<void> => {
          if (!(await escribir(insc, { estado: 'completada', proximo_envio_at: null }, { modo: 'cas', alcance, nuevos }))) {
            res.detalle.push({ lead_id: insc.lead_id, canal: canalCtl, estado: 'saltado', nota: 'otra corrida ya movió esta inscripción' });
            return;
          }
          if (rastro) { res.omitidos += 1; await anotarCierreSinEnvio(insc, pasoLeido, lead, motivo); }
          res.detalle.push({ lead_id: insc.lead_id, canal: canalCtl, estado: rastro ? 'omitido' : 'completada', nota: motivo });
        };
        if (r.tipo === 'faltan_hechos') {
          res.detalle.push({ lead_id: insc.lead_id, canal: canalCtl, estado: 'saltado', nota: 'no pude leer lo que la condición necesita' });
          continue;
        }
        if (r.tipo === 'fin') {
          // Una condición que cierra ANTES de que salga nada (la «Llegó hace menos de N h» del
          // conversor) deja su rastro, como lo dejaba el tope de antigüedad de antes (#789).
          const porCondicion = r.via.some((id) => claseDe(sec.pasos[indicePorId(sec.pasos, id)] ?? {}) === 'condicion');
          // ⚠️ CON FLECHAS EN PARALELO ARRANCANDO (`nuevos`: las de una espera o, desde la cuarta tanda,
          // las del resultado elegido de una condición), ESTE camino termina pero el flujo NO: el rastro
          // de «la condición cerró el flujo sin mandar nada» mentiría sobre un lead al que le van a
          // llegar los mensajes de los otros hilos (y contaría un omitido).
          const cerroElFlujo = porCondicion && !nuevos.length;
          await cerrar(cerroElFlujo ? 'la condición cerró el flujo sin mandar nada' : r.motivo, cerroElFlujo && esPrimerPaso(sec.pasos, idxLeido));
          continue;
        }
        // Estos dos cierran la INSCRIPCIÓN entera: la condición que hacía verdadero al flujo dejó
        // de valer (la reunión), o el flujo está roto (el tope de saltos).
        if (r.tipo === 'sin_reunion') { await cerrar('la reunión ya pasó', true, 'inscripcion'); continue; }
        if (r.tipo === 'tope_saltos') { await cerrar(`el flujo da más de ${TOPE_SALTOS} saltos sin esperar: se cortó`, true, 'inscripcion'); continue; }
        if (r.tipo === 'ir_a_secuencia') {
          // A ESTA MISMA automatización: un bucle (la cierra, la reinicia y al terminar vuelve a
          // saltar). `setSecuenciaPasos` ya no lo deja guardar; si llega igual, se corta acá.
          if (r.secuenciaId === sec.id) { await cerrar('el «Ir a» apunta a esta misma automatización', true); continue; }
          // Se cierra PRIMERO (el reclamo) y recién ahí se inscribe en la otra: al revés, dos
          // corridas del mismo minuto inscribían dos veces. La otra respeta el UNIQUE y la
          // familia (`inscribirEnSecuencia`): si ya estaba, no pasa nada y esta igual termina.
          // `desdeFlujo`: lo terminado NO se reinicia (era reenviarle la secuencia entera).
          if (!(await escribir(insc, { estado: 'completada', proximo_envio_at: null }, { modo: 'cas', nuevos }))) continue;
          const v = await inscribirEnSecuencia(insc.lead_id, r.secuenciaId, { sinEnvioInmediato: true, desdeFlujo: true })
            .catch((e: unknown) => ({ inscribe: false as const, error: e instanceof Error ? e.message : String(e) }));
          res.detalle.push({
            lead_id: insc.lead_id, canal: canalCtl, estado: 'completada',
            nota: v.inscribe ? `sigue en la automatización #${r.secuenciaId}` : `no entró a la automatización #${r.secuenciaId} (${'porque' in v ? v.porque : v.error})`,
          });
          continue;
        }
        if (r.tipo === 'esperar') {
          const ok = await escribir(insc, {
            paso_actual: r.idx, nodo_actual: idDe(sec.pasos[r.idx], r.idx), proximo_envio_at: new Date(r.proximoMs).toISOString(),
          }, { modo: 'cas', nuevos });
          res.detalle.push({ lead_id: insc.lead_id, canal: canalCtl, estado: 'saltado', nota: ok ? 'espera' : 'otra corrida ya movió esta inscripción' });
          continue;
        }
        // Llegó a un mensaje o una acción. Si ESE nodo tiene su propia espera de antes
        // (`delay_horas`, `ancla`), se programa y se sigue en su hora.
        const destino = sec.pasos[r.idx];
        const suHora = proximoEnvioDePaso(destino, lead);
        const enSuHora = Date.parse(suHora) <= Date.now() + 60_000;
        const ok = await escribir(insc, {
          paso_actual: r.idx, nodo_actual: idDe(destino, r.idx), ...(enSuHora ? {} : { proximo_envio_at: suHora }),
        }, { modo: 'cas', nuevos });
        if (!ok) { res.detalle.push({ lead_id: insc.lead_id, canal: canalCtl, estado: 'saltado', nota: 'otra corrida ya movió esta inscripción' }); continue; }
        insc.paso_actual = r.idx;
        insc.nodo_actual = idDe(destino, r.idx);
        if (!enSuHora) { res.detalle.push({ lead_id: insc.lead_id, canal: destino.canal, estado: 'saltado', nota: 'espera su hora' }); continue; }
        if (cupoLleno() && !sigueSinCupoWa(destino)) continue;
      } else if (idxLeido !== insc.paso_actual || (insc.nodo_actual != null && insc.nodo_actual !== idDe(pasoLeido, idxLeido))) {
        // La fila decía otra posición que la del nodo (una fila que nunca avanzó, con la entrada
        // más abajo en el array; o un array reordenado): se alinea ANTES de seguir, porque todo
        // lo de abajo —el reclamo de una acción, el avance— compara contra `paso_actual`.
        if (!(await escribir(insc, { paso_actual: idxLeido, nodo_actual: idDe(pasoLeido, idxLeido) }, { modo: 'cas' }))) {
          res.detalle.push({ lead_id: insc.lead_id, canal: pasoLeido.canal, estado: 'saltado', nota: 'otra corrida ya movió esta inscripción' });
          continue;
        }
        insc.paso_actual = idxLeido;
        insc.nodo_actual = idDe(pasoLeido, idxLeido);
      }
      // El nodo que se manda o se corre: el que se leyó, o al que llegó la resolución de arriba
      // (las dos ramas dejaron `paso_actual` en su índice).
      const paso = sec.pasos[insc.paso_actual];
      // Si el nodo cuelga de una espera «N antes de la reunión», es un recordatorio: se trata como
      // el paso anclado de siempre (sin reunión por delante se cierra; si se movió, se re-ancla).
      const minAntes = minutosAntesDeReunion(sec.pasos, insc.paso_actual);
      const anclada = paso.ancla === 'reunion' || minAntes != null;

      // Pasos ANCLADOS a la reunión (#18): la agenda se re-valida AL MOMENTO de
      // enviar, no solo al programar. (1) Sin reunión futura → la inscripción se
      // cierra sin enviar (un recordatorio tardío es peor que ninguno). (2) Si el
      // objetivo re-calculado quedó en el futuro (reagenda, drift por espera de
      // canal), el paso se re-ancla y espera su hora.
      // Lo de «sin reunión futura no hay nada que mandar» vale para el paso anclado Y para
      // toda la post-agenda, cuyos pasos NO están anclados (salen 1 h y 24 h después de
      // agendarse). Ver `preparaUnaReunion`: con la línea caída, el reintento diario empujó a
      // dos leads reales de Mauricio hasta DESPUÉS de su reunión.
      if (anclada || preparaUnaReunion(sec.trigger_tipo)) {
        if (reunionFuturaMs(lead) == null) {
          res.omitidos += 1;
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'omitido', nota: 'la reunión ya pasó' });
          await escribir(insc, { estado: 'completada', proximo_envio_at: null }, { modo: 'fila', alcance: 'inscripcion' });
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
          await escribir(insc, { estado: 'completada', proximo_envio_at: null }, { modo: 'fila', alcance: 'inscripcion' });
          continue;
        }
      }
      if (anclada) {
        // El objetivo de un paso anclado sale de su `delay_horas`; el de uno que cuelga de una
        // espera «N antes de la reunión», de esos N minutos.
        const objetivo = paso.ancla === 'reunion'
          ? proximoEnvioDePaso(paso, lead)
          : new Date(Math.max((reunionFuturaMs(lead) ?? Date.now()) - (minAntes ?? 0) * 60_000, Date.now())).toISOString();
        if (Date.parse(objetivo) > Date.now() + 5 * 60 * 1000) {
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 're-anclado a la reunión' });
          await escribir(insc, { proximo_envio_at: objetivo }, { modo: 'fila' });
          continue;
        }
      }

      // Tope de antigüedad mirado AL MANDAR, no solo al inscribir. Una
      // inscripción puede quedar esperando días (la línea caída, el canal
      // apagado, el tope diario) y el tope es sobre cuándo le LLEGA el primer
      // mensaje: una bienvenida tardía es peor que ninguna, como el
      // recordatorio de una reunión que ya pasó. Solo el primer paso: los
      // seguimientos de quien ya recibió la bienvenida siguen su curso.
      // «El primer paso» es el primero del FLUJO (`esPrimerPaso`: nada que mande o haga algo
      // cuelga antes), no el índice 0; y el tope es el de la secuencia o el de su primera tarjeta.
      const topeAntig = topeAntiguedad(sec);
      if (esPrimerPaso(sec.pasos, insc.paso_actual) && topeAntig != null
          && !dentroDeAntiguedad({ maxHoras: topeAntig, createdAt: lead?.created_at ?? null, ahoraMs: Date.now() })) {
        res.omitidos += 1;
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'omitido', nota: `llegó hace más de ${topeAntig} h` });
        await escribir(insc, { estado: 'completada', proximo_envio_at: null }, { modo: 'fila' });
        await anotarCierreSinEnvio(insc, paso, lead, `llegó hace más de ${topeAntig} h`);
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
          // Lo que sigue, por el grafo (`siguiente`), no el índice + 1.
          const { campos, yaToca, nuevos } = avanceDesde(sec, insc.paso_actual, lead);
          const ok = await escribir(insc, campos, { modo: 'cas', nuevos });
          if (ok && yaToca) { vistos.delete(insc.id); otraVuelta = true; }
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: paso.requiere === 'ya_contactado' ? 'es primer contacto' : 'ya le habíamos escrito' });
          continue;
        }
      }

      // Paso condicional que espera una respuesta que todavía no llegó: se
      // saltea (la inscripción sigue activa; si el lead contesta, el destrabe de
      // pausarPorRespuesta lo trae de vuelta).
      if (paso.requiere === 'respondio') {
        // El primero que NO espera respuesta, siguiendo la cadena del grafo desde el que sigue.
        const siguienteLibre = siguienteSin(sec.pasos, siguienteIndice(sec.pasos, insc.paso_actual), 'respondio');
        await escribir(insc, siguienteLibre >= 0
          ? { paso_actual: siguienteLibre, nodo_actual: idDe(sec.pasos[siguienteLibre], siguienteLibre), proximo_envio_at: proximoEnvioDePaso(sec.pasos[siguienteLibre], lead) }
          : { estado: 'completada', proximo_envio_at: null }, { modo: 'cas' });
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
        // ⚠️ SI EL MENSAJE ANTERIOR QUEDÓ COMO BORRADOR SIN MANDAR, LA ACCIÓN ESPERA, igual que
        // esperaría el mensaje siguiente (ver «borrador pendiente» más abajo). Sin esto, en el
        // modo por defecto «le escribe y lo mueve a Contactado» lo movía sin que nadie le hubiera
        // escrito; y si el setter descartaba el borrador, la acción ya estaba hecha.
        // ⚠️ SIN MIRAR `envio_automatico`: con «Sale sola» por MENSAJE (`revisar`), el anterior
        // puede haber quedado como borrador aunque la secuencia diga que sale sola.
        // ⚠️ CON HILOS, EL BORRADOR DE *SU* MENSAJE ANTERIOR (`mensajeAnteriorDe`), no el de cualquier
        // hilo del lead: un borrador del hilo de WhatsApp no tiene por qué frenar la acción del otro.
        const delPadre = sanearHilos(insc.hilos) ? await tieneBorradorPendienteDePaso(insc.id, mensajeAnteriorDe(sec.pasos, insc.paso_actual) + 1) : null;
        if (lead && (delPadre ?? await tieneBorradorNutriPendiente(lead.id)) && !(await esLeadCliente(lead.id))) {
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'borrador pendiente' });
          await escribir(insc, { proximo_envio_at: enHorasISO(6) }, { modo: 'fila' });
          continue;
        }
        // `n` es el número de ESTE paso (contado desde 1, el de `nutricion_envios.paso` y el del
        // origen); lo que sigue sale del grafo, no del índice + 1.
        const n = insc.paso_actual + 1;
        const sigIdx = siguienteIndice(sec.pasos, insc.paso_actual);
        const siguientePaso = sigIdx >= 0 ? sec.pasos[sigIdx] : undefined;
        const proximo = siguientePaso ? proximoEnvioDePaso(siguientePaso, lead) : null;
        // Las flechas en paralelo de la acción arrancan cuando corre: se calculan UNA vez, porque las
        // usan el reclamo (que las suma) y el re-encolado de abajo (que tiene que verlas).
        const nuevosAccion = nuevosDe(sec, repartosDe(sec.pasos, insc.paso_actual).map((destino) => ({ destino, desdeMs: Date.now() })), lead);
        const r = await correrPasoAccion(
          {
            accion: { operacion: String(paso.accion?.operacion ?? ''), params: paso.accion?.params },
            ws: wsCorrida, secuenciaId: sec.id, nombre: sec.nombre, orden: n, leadId: insc.lead_id,
          },
          {
            // El reclamo es la puerta de la posición en modo compare-and-set: avanza SÓLO si la
            // fila sigue activa, en este paso y en este nodo (`moverConCas`).
            reclamar: () => escribir(insc, {
              paso_actual: siguientePaso ? sigIdx : n,
              nodo_actual: siguientePaso ? idDe(siguientePaso, sigIdx) : null,
              proximo_envio_at: proximo,
              estado: siguientePaso ? 'activa' : 'completada',
              // Sin `ultimo_paso_at`: es «el último MENSAJE», y una acción no le habló a nadie.
              // Y sus flechas en paralelo arrancan cuando la acción corre (el reclamo las suma).
            }, { modo: 'cas', nuevos: nuevosAccion }),
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
                nodo_id: idDe(paso, insc.paso_actual),
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
        // ⚠️ Y LOS HILOS QUE LA ACCIÓN ARRANCÓ TAMBIÉN (`vuelveALaCola`): sin siguiente, o con un
        // siguiente «en 2 h», un destino «Enseguida» de una flecha en paralelo esperaba al cron de
        // la hora siguiente (revisión del 09/10/2026).
        if (r.estado !== 'saltado' && vuelveALaCola(proximo, nuevosAccion, Date.now())) {
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
        await escribir(insc, { proximo_envio_at: enHorasISO(24) }, { modo: 'fila' });
        continue;
      }

      // ¿El canal de este paso está apagado para el workspace? Si a la secuencia
      // le queda algún paso posterior por un canal PRENDIDO, este paso se marca
      // 'omitido' y la cadencia sigue (el cliente eligió no usar este canal). Si
      // no queda nada enviable, el paso ESPERA (reintento 24h): prender el canal
      // después retoma desde acá, sin quemar la cadencia (tarea #5).
      // Un paso de ACCIÓN no cuenta como «enviable por un canal prendido»: no es un mensaje,
      // y contarlo haría que un WhatsApp con el canal apagado se omita (en vez de esperar)
      // sólo porque más adelante hay una acción. Ni un nodo de control, que tampoco manda nada.
      // ⚠️ «MÁS ADELANTE» ES LO ALCANZABLE POR EL GRAFO (`alcanzablesDesde`), no el resto del
      // array: con ramas, lo que está más abajo puede ser otra rama que este lead no recorre.
      const canalOn = (p: PasoSecuencia) => !esPasoAccion(p) && !esNodoDeControl(p) && (p.canal === 'whatsapp' ? waOn : emailOn);
      const canalApagado = !opts?.simularApagados && !canalOn(paso);
      if (canalApagado && !alcanzablesDesde(sec.pasos, insc.paso_actual).some((j) => canalOn(sec.pasos[j]))) {
        res.esperando += 1;
        // Decisión 7: un hilo de EMAIL con el email apagado y nada prendido adelante, con otros hilos
        // vivos, se CIERRA con su rastro (esperando 24 h para siempre, la inscripción no terminaba y
        // al dueño no le llegaba nunca el «no contestó»). Solo, espera como siempre.
        if (paso.canal === 'email' && hayOtrosHilos(sanearHilos(insc.hilos), insc.h ?? null)) {
          await escribir(insc, { estado: 'completada', proximo_envio_at: null }, { modo: 'fila' });
          await anotarCierreSinEnvio(insc, paso, lead, 'canal email apagado');
          res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'omitido', nota: 'canal email apagado: se cerró este hilo' });
          continue;
        }
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: `canal ${paso.canal} apagado` });
        await escribir(insc, { proximo_envio_at: enHorasISO(24) }, { modo: 'fila' });
        continue;
      }

      // El freno de 20 h POR CANAL, y mirando las DOS cosas: lo que dice la base (por lote) y lo
      // que ya salió en esta corrida (`frenadoPorAntiBan`, decisión 5).
      if (!canalApagado && frenadoPorAntiBan(insc.lead_id, paso.canal, conEnvioReciente, enviadoEnCorrida)) {
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'msg <20h' });
        continue; // no avanzar; se reintenta en otra corrida
      }
      if (!canalApagado && paso.canal === 'email' && emailLleno()) {
        res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'tope diario de email' });
        continue;
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
        // Paso de ARCHIVO (08/10/2026): la foto, el video o el documento de la biblioteca, con el
        // cuerpo como pie. Mismo criterio que el audio: si el archivo no está, falla y se
        // reintenta en 24 h, nunca sale el pie solo como si fuera el mensaje.
        const esMedia = paso.tipo === 'media' && Number(paso.media_id) > 0;
        // «Sale sola» POR MENSAJE (`revisar`); sin el campo, lo de la secuencia, como siempre.
        const saleSoloEste = saleSolo(paso, sec.envio_automatico);
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
          } else if (saleSoloEste || await esLeadCliente(lead.id)) {
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
            await escribir(insc, { proximo_envio_at: enHorasISO(6) }, { modo: 'fila' });
            continue;
          } else {
            // Lead caliente → el audio también pasa por el setter: queda como borrador.
            // ⚠️ EL BORRADOR LLEVA EL AUDIO (`audioId`, mig 0223) Y EL TEXTO ES EL PIE. Guardaba
            // el texto «🎙 Nota de voz: …» y nada más, así que al aprobarlo al lead le llegaba ESE
            // texto en vez del audio. `enviarBorrador` manda el audio y después el pie.
            await crearBorrador({
              leadId: lead.id, telefono: lead.telefono,
              texto: cuerpoNO, audioId: audio.id,
              origen: 'nutricion', secuenciaId: insc.secuencia_id, paso: insc.paso_actual + 1, inscripcionId: insc.id,
              linea: lineaSec,
            });
            estado = 'borrador';
          }
        } else if (esMedia) {
          const adj = await getAdjunto(Number(paso.media_id));
          const b64 = adj ? await adjuntoBase64(adj) : null;
          if (!adj || !b64) {
            estado = 'fallo';
            nota = adj ? 'no pude bajar el archivo del paso' : 'el archivo del paso ya no existe';
            backoffHoras = 24;
          } else if (saleSoloEste || await esLeadCliente(lead.id)) {
            textoEnviado = cuerpoNO.trim() ? cuerpoNO : null; textoAutor = cuerpoNO.trim() ? 'fijo' : null;
            const r = await enviarMediaYEspejar({
              telefono: lead.telefono, media: { ...mediaDeAdjunto(adj), base64: b64 },
              caption: cuerpoNO.trim() || undefined, leadId: lead.id, linea: lineaSec,
            });
            estado = r.ok ? 'enviado' : 'fallo';
            if (!r.ok) { nota = r.error; backoffHoras = 24; }
          } else if (await tieneBorradorNutriPendiente(lead.id)) {
            res.detalle.push({ lead_id: insc.lead_id, canal: paso.canal, estado: 'saltado', nota: 'borrador pendiente' });
            await escribir(insc, { proximo_envio_at: enHorasISO(6) }, { modo: 'fila' });
            continue;
          } else {
            // El borrador lleva el ARCHIVO por referencia y el pie como texto, como el audio.
            await crearBorrador({
              leadId: lead.id, telefono: lead.telefono,
              texto: cuerpoNO, adjuntoId: adj.id,
              origen: 'nutricion', secuenciaId: insc.secuencia_id, paso: insc.paso_actual + 1, inscripcionId: insc.id,
              linea: lineaSec,
            });
            estado = 'borrador';
          }
        } else if (saleSoloEste || await esLeadCliente(lead.id)) {
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
          await escribir(insc, { proximo_envio_at: enHorasISO(6) }, { modo: 'fila' });
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
          // Con otros hilos vivos, esto cierra SÓLO el hilo del email (decisión 7): un email que no
          // puede salir no mata el WhatsApp ni deja la inscripción sin terminar nunca.
          terminal = hayOtrosHilos(sanearHilos(insc.hilos), insc.h ?? null);
        } else {
          const vars = valoresVariablesLead(lead, { negocio });
          const cuerpo = aplicarVariables(paso.cuerpo, vars);
          // El cuerpo del editor rico (tercera tanda): se vuelve a SANEAR acá —lo guardó
          // `setSecuenciaPasos`, pero la fila la puede escribir otro— y las variables entran con
          // el valor ESCAPADO (`aplicarVariablesHtml`): un nombre con `<b>` llega como ese texto.
          // Sin HTML, el correo de siempre con `cuerpo`. La parte de texto es `cuerpo` igual.
          const html = typeof paso.cuerpo_html === 'string' && paso.cuerpo_html ? sanearHtmlEmail(paso.cuerpo_html) : '';
          textoEnviado = cuerpo; textoAutor = 'fijo';
          const asunto = aplicarVariables(paso.asunto ?? '', vars) || '(sin asunto)';
          const unsubUrl = buildUnsubscribeUrl(insc.lead_id);
          const r = await sendEmail({
            to: lead.email,
            subject: asunto,
            html: renderEmailHtml({
              subject: asunto,
              bodyText: cuerpo,
              ...(html ? { bodyHtml: aplicarVariablesHtml(html, vars) } : {}),
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
        // El nodo que salió (mig 0223): con ramas, `paso` es una posición del array y no dice cuál.
        nodo_id: idDe(paso, insc.paso_actual),
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
          // ⚠️ CON HILOS CIERRA COMO 'completada', no 'cancelada' (`estadoDeCierrePermanente`): si
          // el del email era el último hilo vivo, 'cancelada' terminaba la inscripción entera así y
          // el desenlace se salteaba el «no confirmó», la etapa de fallo y el encadenado.
          await escribir(insc, { estado: estadoDeCierrePermanente(sanearHilos(insc.hilos)), proximo_envio_at: null }, { modo: 'fila' });
        } else {
          // Backoff: corre el próximo intento para que la fila no bloquee la
          // cola ni genere una fila de 'fallo' por corrida.
          await escribir(insc, { proximo_envio_at: enHorasISO(backoffHoras) }, { modo: 'fila' });
        }
        continue;
      }

      // Lo que sigue, POR EL GRAFO (`siguiente`), y no el índice + 1: con ramas, el elemento de
      // abajo del array puede ser otra rama.
      const { campos: avance, yaToca, nuevos: nuevosAlSalir } = avanceDesde(sec, insc.paso_actual, lead);
      await escribir(insc, {
        ...avance,
        // El reloj del fallo por silencio se cuenta desde el ÚLTIMO mensaje,
        // no desde que el lead se inscribió: una secuencia con pasos a los 30
        // días se daría por fallida antes de terminar de mandarlos.
        ultimo_paso_at: ahoraISO(),
      }, { modo: 'fila', nuevos: nuevosAlSalir });
      // La reunión que preparó este paso, en un update APARTE del avance (ver la función).
      await anotarReunionDelPaso(insc.id, sec, lead);
      // ⚠️ SI LO QUE SIGUE YA TOCA, SE MIRA EN ESTA MISMA CORRIDA, como después de una acción:
      // una condición, una espera o una acción detrás de un mensaje se resuelven ya, no a la hora
      // siguiente. Otro mensaje, no (`avanceDesde`).
      if (yaToca) { vistos.delete(insc.id); otraVuelta = true; }

      if (estado === 'enviado') res.enviados += 1;
      else if (estado === 'omitido') res.omitidos += 1;
      else if (estado === 'borrador') res.borradores += 1;
      else res.simulados += 1;
      // Los topes y el freno de esta corrida, POR CANAL (decisión 5). Un borrador no gasta cupo
      // (no salió), pero frena: si se aprueba ya, son dos mensajes seguidos al mismo lead.
      if (estado === 'enviado' || estado === 'simulado') { if (paso.canal === 'email') emailsEnCorrida += 1; else waEnCorrida += 1; }
      if (estado === 'enviado' || estado === 'simulado' || estado === 'borrador') anotarEnCorrida(enviadoEnCorrida, insc.lead_id, paso.canal);
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
  // ⚠️ LAS SECUENCIAS SE LEEN ANTES DE MARCAR 'respondio' (revisión del 08/10/2026). Con el deploy
  // adelantado a una migración que agrega una columna que esta lectura pide (la 0223,
  // `etiqueta_id`), PostgREST rechaza la consulta ENTERA. Leyéndolas después, la inscripción ya
  // quedaba 'respondio', el catch de abajo se tragaba el error y la respuesta del lead se perdía
  // sin borrador, sin hand-off y sin aviso — y aplicar la migración no la recuperaba. Así, falta
  // una columna → no se toca nada y tira (los dos webhooks lo atrapan): el cron también falla
  // cerrado, así que la secuencia no avanza sobre alguien que contestó. Cualquier OTRO error de
  // lectura se pausa como siempre: no avanzarle la secuencia a quien contestó es lo crítico.
  let secsActivas: Secuencia[] | null = null;
  try {
    secsActivas = await getSecuenciasActivas();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (esColumnaInexistente({ message: msg })) throw new Error(`pausarPorRespuesta: no toqué al lead ${leadId}, falta una migración (${msg})`);
    console.error(`[nutricion] leer las secuencias antes de pausar al lead ${leadId}: ${msg}`);
  }
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
      const secs = secsActivas ?? await getSecuenciasActivas();
      const { data: detalle } = await supabase
        .from('nutricion_inscripciones')
        .select('id, secuencia_id, paso_actual, nodo_actual')
        .in('id', pausadas.map((p) => p.id));
      for (const insc of (detalle ?? []) as Array<{ id: number; secuencia_id: number; paso_actual: number; nodo_actual: string | null }>) {
        const sec = secs.find((s) => s.id === insc.secuencia_id);
        if (!sec) continue;
        // El paso que espera la respuesta, siguiendo la cadena del GRAFO desde donde está (con
        // ramas, «más abajo en el array» puede ser otra rama).
        const desde = indiceActual(sec.pasos, insc);
        const idx = desde >= 0 ? siguienteCon(sec.pasos, desde, 'respondio') : -1;
        if (idx < 0) continue;
        await supabase.from('nutricion_inscripciones').update({
          estado: 'activa',
          paso_actual: idx,
          nodo_actual: idDe(sec.pasos[idx], idx),
          proximo_envio_at: proximoEnvioDePaso(sec.pasos[idx], null),
          // Retoma UN camino: si la inscripción tenía hilos en paralelo, quedan descartados.
          hilos: null,
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
    // `conversacion_cierre`: con la fecha puesta y sin motivo, la cerró el hand-off
    // (`cerradaPorUnaPersona`, lib/setter-conversacion.ts).
    .select('id, secuencia_id, estado, desenlace, updated_at, conversacion_ultima_at, conversacion_cerrada_at, conversacion_cierre')
    .eq('lead_id', leadId);
  if (error) throw new Error(`charlaDelLead: ${error.message}`);
  const filas = (data ?? []) as Array<{
    id: number; secuencia_id: number; estado: string; desenlace: string | null;
    updated_at: string | null; conversacion_ultima_at: string | null; conversacion_cerrada_at: string | null;
    conversacion_cierre: string | null;
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
        // CONTESTA cuando el lead escribe: en modo asistido (lo de antes) o porque tiene la
        // tarjeta «Si responde» (el flujo con ramas). Una con 'automatico' y sin la tarjeta sólo pausa.
        asistida: !!sec && (parse(sec.estrategia)?.modo === 'asistido' || raizRespuesta(sec.pasos) != null),
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
 * Lo que comparten las dos formas de contestar (el modo asistido de antes y «Si responde» del
 * flujo con ramas): el lead, la línea por la que se le contesta, la charla real y cuándo entró el
 * mensaje que se contesta. Se lee UNA vez por respuesta.
 */
type CtxRespuesta = {
  leadId: number;
  secuencia: SecuenciaConStats;
  texto: string | undefined;
  lineaEntrante: string | null;
  supabase: Awaited<ReturnType<typeof getTenantDb>>;
  lead: { id: number; nombre: string | null; telefono: string | null; calificado: boolean | null; empresa?: string | null } | null;
  /** La línea a la que escribió el lead; si no se sabe (vino por el oficial), la de la secuencia. */
  linea: string | null;
  descartarViejo: () => Promise<number>;
  historial: TurnoSim[];
  /** Cuándo entró el mensaje que se contesta (ms). Si antes de guardar entró otro, éste ya no es lo último. */
  respondeA: number | null;
};

async function contextoDeRespuesta(leadId: number, secuencia: SecuenciaConStats, texto: string | undefined, lineaEntrante: string | null): Promise<CtxRespuesta> {
  const supabase = await getTenantDb();
  const { data: leadRow } = await supabase.from('leads').select('id, nombre, telefono, calificado, empresa').eq('id', leadId).maybeSingle();
  const lead = leadRow as CtxRespuesta['lead'];
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
  // otro más nuevo, esta redacción ya no contesta lo último (ver `redactarRespuesta`, paso 2).
  const respondeA = ultimoEntranteMs(filas);
  return { leadId, secuencia, texto, lineaEntrante, supabase, lead, linea, descartarViejo, historial, respondeA };
}

/** ¿Entró un mensaje del lead MÁS NUEVO que el que se está contestando? Lo atiende su propia corrida. */
async function hayMensajeMasNuevo(c: CtxRespuesta): Promise<boolean> {
  if (c.respondeA == null) return false;
  const [{ mensajesRecientesDelLead }, { ultimoEntranteMs }] = await Promise.all([import('@/lib/wa-historial'), import('@/lib/setter-conversacion')]);
  const masNuevo = ultimoEntranteMs(await mensajesRecientesDelLead(c.leadId, { limite: 3, linea: c.lineaEntrante }));
  return masNuevo != null && masNuevo > c.respondeA;
}

/**
 * El lead contestó: MaKo le prepara (o le manda) la respuesta y le avisa al dueño.
 *
 * Dos formas, y la secuencia dice cuál:
 *   · con la tarjeta «Si responde» (el flujo con ramas, 08/10/2026) → `responderConGrafo`;
 *   · en modo 'asistido' sin la tarjeta (lo de antes) → el clasificador contra
 *     `estrategia.escenarios`, el hand-off si no encaja, y `redactarRespuesta` si encaja.
 * Devuelve false (sin hacer nada) si ninguna de las secuencias contesta.
 */
async function asistirRespuesta(leadId: number, secuenciaIds: number[], texto?: string, lineaEntrante: string | null = null): Promise<boolean> {
  const { parseEstrategia } = await import('@/lib/setting-estrategia');
  const secs = await getSecuenciasConStats();
  // La secuencia que contesta: la que tiene «Si responde» o, si no, la asistida de antes.
  const secuencia = secs.find((s) => secuenciaIds.includes(s.id) && (raizRespuesta(s.pasos) != null || parseEstrategia(s.estrategia)?.modo === 'asistido'));
  if (!secuencia) return false;
  const c = await contextoDeRespuesta(leadId, secuencia, texto, lineaEntrante);
  if (raizRespuesta(secuencia.pasos) != null) return responderConGrafo(c);
  const { supabase, lead, descartarViejo } = c;

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
  return redactarRespuesta(c, clas);
}

/**
 * MaKo REDACTA la respuesta al lead con un caso (el que encajó, o la guía de una tarjeta «MaKo
 * contesta») y hace todo lo que viene con eso: el borrador (uno por lead), el cierre de la charla,
 * la calificación, si sale solo (`puedeContestarSolo`) y el aviso al dueño.
 *
 * La comparten el modo asistido de antes y «Si responde» del flujo con ramas: el MISMO redactor
 * (`responderSimulador`) y las MISMAS puertas, no una copia que se queda vieja.
 */
async function redactarRespuesta(c: CtxRespuesta, clas: { escenario: EscenarioSecuencia }): Promise<boolean> {
  const { leadId, secuencia, texto, supabase, lead, linea, descartarViejo, historial } = c;

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
  if (sugerida && await hayMensajeMasNuevo(c)) return true;

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

/**
 * «SI RESPONDE»: el lead contestó una secuencia que tiene la tarjeta (el flujo con ramas, diseño
 * §2). La salida ya quedó PAUSADA (`pausarPorRespuesta`, como siempre); esto decide qué rama
 * corre y la recorre.
 *
 *   · El caso lo elige el MISMO clasificador de siempre (`clasificarEscenario`) con los casos de
 *     la tarjeta (`escenariosDeRespuesta`). Si no encaja en ninguno, «Otra cosa» (`si_no`).
 *   · «MaKo contesta» (`tipo: 'ia'`) redacta con el MISMO redactor y las MISMAS puertas
 *     (`redactarRespuesta`): su `cuerpo` es la guía y `revisar === false` es «sale solo».
 *   · Un texto, un audio o un archivo salen SIN el anti-ban de 20 h: son una respuesta, no una
 *     prospección. «Sale sola» por mensaje, como en la salida.
 *   · Una acción corre UNA vez por respuesta (`correrAccionDeRespuesta`, con su reclamo).
 *   · Una condición se evalúa con los hechos del lead; «Ir a» una tarjeta RETOMA la salida ahí, y
 *     a otra automatización lo inscribe en ésa.
 *
 * ⚠️ NO CONGELA LA INSCRIPCIÓN EN 'handoff'. El hand-off de antes («MaKo se calla y te avisa»)
 * es ahora la rama «Otra cosa» con la acción `avisar_al_equipo`: una tarjeta más, no un estado
 * del que sólo sacaba un formulario. Lo que sí hace, como antes, es CALLARSE: si la rama no
 * produjo una respuesta de MaKo, cierra la CHARLA (`charlaPasaAUnaPersona`, revisión del
 * 08/10/2026) y los mensajes siguientes los contesta una persona.
 */
async function responderConGrafo(c: CtxRespuesta): Promise<boolean> {
  const { leadId, secuencia, texto, supabase, lead } = c;
  const pasos = secuencia.pasos;
  const escenarios = escenariosDeRespuesta(pasos);
  const lista: EscenarioSecuencia[] = escenarios.map((e) => ({
    titulo: e.titulo, cuando: e.cuando, comoResponder: e.comoResponder, ...(e.contestaSolo ? { contestaSolo: true } : {}),
  }));
  const { clasificarEscenario } = await import('@/lib/chat-agent-handoff');
  const clas = await clasificarEscenario(texto ?? '', lista);
  const k = clas.encaja ? lista.indexOf(clas.escenario) : -1;
  const caso = k >= 0 ? escenarios[k] : null;
  const desde = caso ? caso.siguiente : (nodoPorId(pasos, raizRespuesta(pasos))?.si_no ?? null);

  // Si mientras se clasificaba entró otro mensaje, ése tiene su propia corrida: ésta no hace nada.
  if (await hayMensajeMasNuevo(c)) return true;
  // Sin caso, el borrador que había quedado de un mensaje anterior ya no contesta lo último (#788).
  if (!caso) await c.descartarViejo();
  // El intercambio cuenta para la ventana de la charla (#788), haga lo que haga la rama.
  await supabase.from('nutricion_inscripciones')
    .update({ conversacion_ultima_at: ahoraISO() })
    .eq('lead_id', leadId).eq('secuencia_id', secuencia.id);
  const { data: inscRow } = await supabase.from('nutricion_inscripciones').select('id')
    .eq('lead_id', leadId).eq('secuencia_id', secuencia.id).maybeSingle();
  const inscId = (inscRow as { id: number } | null)?.id ?? null;

  const hecho: string[] = [];
  let redacto = false;
  // Sólo cuenta el aviso que SALIÓ (ni falló ni quedó deduplicado: `avisoSalio`). Se marcaba antes
  // de correr la acción: con el «no confirmó» de las 12 h anteriores, el aviso de «Otra cosa» se
  // deduplicaba, el de respaldo no salía y nadie se enteraba de lo que escribió el lead.
  let avisoDelFlujo = false;
  // Lo que decide si la charla PASA A UNA PERSONA (`charlaPasaAUnaPersona`).
  let contesto = false;
  let siguio = false;
  let noPudoDecidir = false;
  let hechos: HechosLead | null | undefined;
  let id: string | null = desde;
  for (let vuelta = 0; id && vuelta < TOPE_NODOS; vuelta++) {
    const i = indicePorId(pasos, id);
    if (i < 0) break;
    const p = pasos[i];
    const clase = claseDe(p);
    if (clase === 'condicion') {
      if (hechos === undefined) {
        hechos = (await hechosDeLeads(supabase, [leadId], filasDelFlujo(pasos)).catch((e: unknown) => {
          console.error(`[nutricion] «Si responde», hechos del lead ${leadId}:`, e instanceof Error ? e.message : String(e));
          return null;
        }))?.get(leadId) ?? null;
      }
      if (!hechos) { hecho.push('No pude leer lo que la condición necesita: me detuve ahí.'); noPudoDecidir = true; break; }
      id = elegirSalida(p, hechos).destino;
      continue;
    }
    if (clase === 'ir_a') {
      const d = p.destino;
      if (d && 'nodo' in d) {
        // RETOMA LA SALIDA en esa tarjeta: activa y para ya; la próxima vuelta del motor sigue.
        // ⚠️ RETOMA *UN* HILO Y DESCARTA LOS CONGELADOS (`hilos: null`, decisión 4 de la segunda
        // tanda): la rama de «Si responde» decide cómo sigue la charla, y despertar todos los hilos
        // le mandaría varios mensajes seguidos a alguien que acaba de escribir.
        const j = indicePorId(pasos, d.nodo);
        if (j >= 0) {
          const { error } = await supabase.from('nutricion_inscripciones')
            .update({ estado: 'activa', paso_actual: j, nodo_actual: d.nodo, proximo_envio_at: ahoraISO(), hilos: null, updated_at: ahoraISO() })
            .eq('lead_id', leadId).eq('secuencia_id', secuencia.id).in('estado', ['respondio', 'completada', 'activa']);
          hecho.push(error ? `No pude retomar la secuencia (${error.message.slice(0, 120)}).` : 'Retomé la secuencia.');
          if (!error) siguio = true;
        }
      } else if (d && 'secuencia_id' in d) {
        if (Number(d.secuencia_id) === secuencia.id) {
          // A ESTA MISMA: la previa está en 'respondio' y no entraría, pero no se intenta.
          hecho.push('El «Ir a» apunta a esta misma automatización: no lo seguí.');
        } else {
          // `desdeFlujo`: lo terminado no se reinicia (le reenviaba la otra secuencia entera).
          const v = await inscribirEnSecuencia(leadId, Number(d.secuencia_id), { sinEnvioInmediato: true, desdeFlujo: true })
            .catch((e: unknown) => ({ inscribe: false as const, error: e instanceof Error ? e.message : String(e) }));
          hecho.push(v.inscribe ? `Lo pasé a «${v.secuencia.nombre}».` : `No lo pude pasar a la automatización #${d.secuencia_id}.`);
          if (v.inscribe) siguio = true;
        }
      }
      break;
    }
    // `validarGrafo` no deja esperas en «Si responde» (se contesta en el momento): si llega una
    // escrita por otro lado, se corta ahí.
    if (clase === 'esperar' || clase === 'respuesta') break;
    if (clase === 'accion') {
      const r = await correrAccionDeRespuesta(c, p, i, inscId);
      if (r.resumen) hecho.push(r.resumen);
      if (r.avisoSalio) avisoDelFlujo = true;
      id = siguienteDe(pasos, i);
      continue;
    }
    if (p.tipo === 'ia') {
      redacto = true;
      contesto = true;
      await redactarRespuesta(c, {
        escenario: {
          titulo: caso?.titulo ?? 'Otra cosa', cuando: caso?.cuando ?? 'no encajó en ningún caso',
          comoResponder: p.cuerpo, ...(p.revisar === false ? { contestaSolo: true } : {}),
        },
      });
    } else {
      const m = await mandarMensajeDeRespuesta(c, p, i, inscId);
      hecho.push(m.texto);
      if (m.contesto) contesto = true;
    }
    id = siguienteDe(pasos, i);
  }

  // «OTRA COSA» ES EL HAND-OFF (decisión del 08/10/2026). Si la rama no produjo una respuesta de
  // MaKo, la charla pasa a una persona: se CIERRA (fecha sin motivo: `cerradaPorUnaPersona`) y
  // MaKo no contesta los mensajes que vengan —`conversacionAbierta` dice «la sigue una persona»—,
  // como hacía la inscripción en 'handoff'. Sin esto la charla seguía abierta y el próximo
  // mensaje que encajara en un caso «sale solo» lo contestaba MaKo encima de la persona.
  // No toca el estado: congelarla en 'handoff' la dejaba sin salida (no hay pantalla que la
  // resuelva) y fuera del reuso cuando el lead reagenda.
  if (charlaPasaAUnaPersona({ contesto, siguio, noPudoDecidir })) {
    const { error: eCierre } = await supabase.from('nutricion_inscripciones')
      .update({ conversacion_cerrada_at: ahoraISO(), conversacion_cierre: null })
      .eq('lead_id', leadId).eq('secuencia_id', secuencia.id);
    if (eCierre) console.error(`[nutricion] hand-off del lead ${leadId}: ${eCierre.message}`);
    // El borrador de un mensaje anterior ya no contesta lo último: ahora contesta una persona.
    if (caso) await c.descartarViejo();
    try {
      const { logLeadEvent } = await import('@/lib/leads');
      await logLeadEvent(leadId, 'Setting', `La charla pasó a una persona: MaKo no le contesta («${secuencia.nombre}»)`, 'MaKo');
    } catch { /* el historial es un extra: el cierre ya quedó */ }
    hecho.push('No le contesto más: la sigues tú.');
  }

  // EL AVISO AL DUEÑO («avisame si responden», el único que pidió Mauricio): lo da la redacción
  // de MaKo o la acción de avisar de la rama; si no corrió ninguna de las dos, va uno corto con
  // lo que se hizo. `ws` explícito: sin él cae al grupo de la agencia.
  if (!redacto && !avisoDelFlujo) {
    const { emitirDelCatalogo } = await import('@/lib/avisos');
    const quien = lead?.nombre?.trim() || `lead ${leadId}`;
    await emitirDelCatalogo('wa-mensaje-entrante', {
      ws: (await getWorkspaceActual()) ?? undefined,
      texto: `💬 *${quien} respondió* a «${secuencia.nombre}».${texto?.trim() ? `\n\n_"${texto.trim().slice(0, 180)}"_` : ''}\n\n${caso ? `Caso «${caso.titulo}».` : 'No encajó en ningún caso.'}${hecho.length ? `\n${hecho.join('\n')}` : ' No hice nada más.'}\n\n— MaKo`,
    });
  }
  return true;
}

/**
 * Un mensaje (texto, audio o archivo) de una rama de «Si responde». Sale SIN el anti-ban de 20 h
 * —es la respuesta a algo que el lead acaba de escribir— y con todo lo demás de un envío: el
 * interruptor del WhatsApp del negocio, el contacto bloqueado, la línea a la que escribió y
 * «Sale sola» por mensaje. Queda en `nutricion_envios` como cualquier envío (cuenta para el
 * anti-ban de lo que venga después). Devuelve lo que pasó, en una frase para el aviso, y si le
 * CONTESTÓ (salió, quedó como borrador o ya le había salido: lo pregunta el hand-off).
 *
 * ⚠️ UNA VEZ CADA 20 H POR TARJETA (revisión del 08/10/2026). Sin anti-ban, un texto fijo de una
 * rama —«¡Gracias! En un rato te respondo»— salía IGUAL con cada mensaje del lead durante los 7
 * días de la charla, por la línea no oficial: el patrón que el anti-ban existe para evitar. Se
 * reclama por (inscripción, nodo) con `reclamarEspaciado` justo antes de mandar o dejar el
 * borrador; si ya salió, no se repite.
 */
async function mandarMensajeDeRespuesta(c: CtxRespuesta, p: PasoSecuencia, i: number, inscId: number | null): Promise<{ texto: string; contesto: boolean }> {
  const { leadId, secuencia, supabase, lead, linea } = c;
  const no = (texto: string) => ({ texto, contesto: false });
  const si = (texto: string) => ({ texto, contesto: true });
  // El reclamo de esta tarjeta para esta inscripción, JUSTO antes de mandar o dejar el borrador
  // (antes de eso, un audio que no está consumiría la ventana sin que salga nada). Sin el reclamo
  // no sale: un error del store no puede abrir la puerta al mensaje repetido.
  const ws = await getWorkspaceActual();
  const reclamar = async (): Promise<boolean> => {
    if (ws == null) return true;
    const { reclamarEspaciado } = await import('@/lib/espaciado');
    return reclamarEspaciado(ws, `respuesta-mensaje:${secuencia.id}`, RECLAMO_MENSAJE_RESPUESTA_MIN, `${inscId ?? `lead${leadId}`}:${idDe(p, i)}`)
      .catch(() => false);
  };
  // «O se intentó»: el reclamo va antes de mandar (la regla de la casa), así que un envío que falló
  // también ocupa la ventana. No se afirma que salió.
  const yaSalio = si('Ese mensaje ya salió (o se intentó) hace poco: no lo repetí.');
  const registrar = async (estado: 'enviado' | 'borrador' | 'fallo' | 'omitido', nota: string | null, texto: string | null): Promise<void> => {
    const { error } = await supabase.from('nutricion_envios').insert({
      inscripcion_id: inscId, lead_id: leadId, secuencia_id: secuencia.id, paso: i + 1, nodo_id: idDe(p, i),
      canal: 'whatsapp', estado, destino: lead?.telefono ?? null, asunto: null, error: nota,
      texto_enviado: texto, texto_autor: texto ? 'fijo' : null,
    });
    if (error) console.error(`[nutricion] rastro de «Si responde», lead ${leadId}: ${error.message}`);
  };
  if (p.canal === 'email' || proveedorDelPaso(p) !== 'no_oficial') return no('Un mensaje de la rama no es de WhatsApp no oficial: no salió.');
  if (!lead?.telefono) { await registrar('fallo', 'lead sin teléfono', null); return no('No le contesté: no tiene teléfono.'); }
  if (!(await envioWhatsappHabilitado().catch(() => false))) { await registrar('fallo', 'el envío de WhatsApp está apagado', null); return no('No le contesté: el envío de WhatsApp está apagado.'); }
  if (await estaBloqueado(lead.telefono).catch(() => true)) { await registrar('omitido', 'contacto bloqueado', null); return no('No le contesté: el contacto está bloqueado.'); }
  const negocio = await getWorkspace(ws ?? 0).then((w) => w?.nombre ?? '').catch(() => '');
  const pie = aplicarVariables(textoDelPaso(p), valoresVariablesLead(lead, { negocio }));
  const sale = saleSolo(p, secuencia.envio_automatico) || await esLeadCliente(leadId);

  if (p.tipo === 'audio' && Number(p.audio_id) > 0) {
    const audio = await getAudio(Number(p.audio_id));
    const b64 = audio ? await audioBase64(audio) : null;
    if (!audio || !b64) { await registrar('fallo', audio ? 'no pude bajar el audio del paso' : 'el audio del paso ya no existe', null); return no('No salió la nota de voz: el audio no está.'); }
    if (!(await reclamar())) return yaSalio;
    if (!sale) {
      await crearBorrador({ leadId, telefono: lead.telefono, texto: pie, audioId: audio.id, origen: 'nutricion', secuenciaId: secuencia.id, paso: i + 1, inscripcionId: null, linea: c.linea });
      await registrar('borrador', null, pie || null);
      return si(`Te dejé la nota de voz «${audio.titulo}» para aprobar.`);
    }
    const r = await enviarAudioYEspejar({ telefono: lead.telefono, base64: b64, mimetype: audio.media_mime, leadId, linea });
    if (r.ok && pie.trim()) await enviarYEspejar({ telefono: lead.telefono, texto: pie, leadId, linea }).catch(() => { /* el audio ya salió */ });
    await registrar(r.ok ? 'enviado' : 'fallo', r.ok ? null : (r.error ?? 'no salió'), pie.trim() || null);
    return r.ok ? si(`Le mandé la nota de voz «${audio.titulo}».`) : no(`No salió la nota de voz (${(r.error ?? '').slice(0, 120)}).`);
  }

  if (p.tipo === 'media' && Number(p.media_id) > 0) {
    const adj = await getAdjunto(Number(p.media_id));
    const b64 = adj ? await adjuntoBase64(adj) : null;
    if (!adj || !b64) { await registrar('fallo', adj ? 'no pude bajar el archivo del paso' : 'el archivo del paso ya no existe', null); return no('No salió el archivo: no está.'); }
    if (!(await reclamar())) return yaSalio;
    if (!sale) {
      await crearBorrador({ leadId, telefono: lead.telefono, texto: pie, adjuntoId: adj.id, origen: 'nutricion', secuenciaId: secuencia.id, paso: i + 1, inscripcionId: null, linea: c.linea });
      await registrar('borrador', null, pie || null);
      return si(`Te dejé el archivo «${adj.titulo}» para aprobar.`);
    }
    const r = await enviarMediaYEspejar({ telefono: lead.telefono, media: { ...mediaDeAdjunto(adj), base64: b64 }, caption: pie.trim() || undefined, leadId, linea });
    await registrar(r.ok ? 'enviado' : 'fallo', r.ok ? null : (r.error ?? 'no salió'), pie.trim() || null);
    return r.ok ? si(`Le mandé el archivo «${adj.titulo}».`) : no(`No salió el archivo (${(r.error ?? '').slice(0, 120)}).`);
  }

  if (!pie.trim()) return no('Un mensaje de la rama estaba vacío: no salió.');
  if (!(await reclamar())) return yaSalio;
  if (!sale) {
    await crearBorrador({ leadId, telefono: lead.telefono, texto: pie, origen: 'nutricion', secuenciaId: secuencia.id, paso: i + 1, inscripcionId: null, linea: c.linea });
    await registrar('borrador', null, pie);
    return si(`Te dejé para aprobar: «${pie.slice(0, 120)}».`);
  }
  const r = await enviarYEspejar({ telefono: lead.telefono, texto: pie, leadId, linea });
  await registrar(r.ok ? 'enviado' : 'fallo', r.ok ? null : (r.error ?? 'no salió'), pie);
  return r.ok ? si(`Le contesté: «${pie.slice(0, 120)}».`) : no(`No salió la respuesta (${(r.error ?? '').slice(0, 120)}).`);
}

/** Ventana del reclamo de un mensaje fijo de «Si responde»: la misma del anti-ban de la salida. */
const RECLAMO_MENSAJE_RESPUESTA_MIN = 20 * 60;

/**
 * Una acción de una rama de «Si responde», UNA vez por respuesta.
 *
 * ⚠️ EL RECLAMO VA ANTES (`reclamarEspaciado`, con una clave por inscripción + nodo + mensaje).
 * La misma respuesta puede llegar dos veces —el webhook se reentrega, o el oficial y el espejo
 * avisan del mismo mensaje— y sin el reclamo «crear la tarea» o «mover de etapa» corrían dos
 * veces. Una respuesta NUEVA del lead es otra clave, y la acción vuelve a correr, que es lo que
 * la rama dice. Corre por la puerta de siempre (`ejecutarDesdeFlujo`) y deja su fila en
 * `nutricion_envios` con estado 'accion' o 'fallo', como el paso de la salida.
 *
 * ⚠️ EL AVISO AL EQUIPO LLEVA EL TEXTO DEL LEAD (`respuesta`, revisión del 08/10/2026). El de
 * «Otra cosa» decía «Te escribió algo que no sé contestar» sin decir qué, y se deduplicaba por
 * LEAD: con el «no confirmó» de las 12 h anteriores, no salía. Con `respuesta`, el aviso trae el
 * mensaje y se deduplica por RESPUESTA. Y `avisoSalio` dice si salió de verdad (ni falló ni quedó
 * deduplicado): si no, va el aviso de respaldo. Si ESTA respuesta ya corrió la acción (el
 * reclamo), lo que había que avisar ya se decidió en esa corrida: no se manda otro.
 */
async function correrAccionDeRespuesta(c: CtxRespuesta, p: PasoSecuencia, i: number, inscId: number | null): Promise<{ resumen: string | null; avisoSalio: boolean }> {
  const { leadId, secuencia, supabase, texto, respondeA } = c;
  const ws = await getWorkspaceActual();
  const operacion = String(p.accion?.operacion ?? '');
  const esAviso = operacion === OP_AVISAR;
  if (ws == null || !operacion) return { resumen: null, avisoSalio: false };
  const { reclamarEspaciado } = await import('@/lib/espaciado');
  const clave = `${inscId ?? `lead${leadId}`}:${idDe(p, i)}:${respondeA ?? (texto ?? '').trim().slice(0, 300)}`;
  if (!(await reclamarEspaciado(ws, `respuesta-accion:${secuencia.id}`, 7 * 24 * 60, clave).catch(() => false))) return { resumen: null, avisoSalio: esAviso };
  const respuesta = (texto ?? '').trim().slice(0, 1000);
  // Lo que llena el flujo sale de la MISMA lista que el editor esconde (LLENA_EL_FLUJO): el
  // editor no muestra «respuesta» del aviso porque acá se pisa con lo que escribió el lead.
  const delFlujo = Object.entries(LLENA_EL_FLUJO[operacion] ?? {}).filter(([, fuente]) => fuente === 'respuesta_del_lead');
  const params = respuesta && delFlujo.length
    ? { ...(p.accion?.params ?? {}), ...Object.fromEntries(delFlujo.map(([campo]) => [campo, respuesta])) }
    : p.accion?.params;
  const r = await (await import('@/lib/api-mako/flujo')).ejecutarDesdeFlujo(operacion, params, {
    ws, origen: `secuencia:${secuencia.id}:nodo:${idDe(p, i)}`, nombre: secuencia.nombre, leadId,
  });
  const { error } = await supabase.from('nutricion_envios').insert({
    inscripcion_id: inscId, lead_id: leadId, secuencia_id: secuencia.id, paso: i + 1, nodo_id: idDe(p, i),
    canal: p.canal, estado: r.ok ? 'accion' : 'fallo', destino: null, asunto: operacion, error: r.ok ? null : r.resumen,
  });
  if (error) console.error(`[nutricion] rastro de la acción de «Si responde» (${operacion}): ${error.message}`);
  return { resumen: r.ok ? r.resumen : `Falló una acción: ${r.resumen}`, avisoSalio: esAviso && avisoSalio(r) };
}
