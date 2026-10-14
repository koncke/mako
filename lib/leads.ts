// =============================================================================
// Leads — types, queries y server actions
// =============================================================================
// Tabla `leads` ya creada en Fase 1. Esta capa concentra TODO el acceso al
// modelo: get, create, update, validaciones lógicas.
// =============================================================================

import { linkApp } from './app-url';
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buscarDuplicados, camposParaCompletar, elegirPorTelefono, emailComparable, LeadDuplicadoError, nombreComparable, patronesDeNombre, telefonoComparable,
  type CandidatoLead, type Coincidencia, type LeadExistente,
} from './leads-duplicados';
import { getTenantDb, getWorkspaceActual } from './workspace';
// Las columnas CRUDAS de Meta y el rastro del descarte: puro y sin `server-only`
// para que la decisión de "no pisar con vacío" tenga test. Ver lib/meta-leads-campos.ts.
import {
  columnasCrudasDeMeta,
  rastroDescartes,
  CAMPO_RESPUESTAS_META,
  type MetaFieldData,
} from './meta-leads-campos';
import { funnelDeCampana } from './campana-funnel';
import { leerTodo, type ConsultaPaginada } from './supabase-paginado';
// El apartado de insights de la llamada LEE closing_analyses; acá sólo se engancha
// a este lead el análisis que ya existe de la grabación recién cargada (gratis).
import { enlazarAnalisisDeGrabacion } from './insights-llamada';
import { enTandas } from './ids-con-filas';
import { getSupabaseServer } from './supabase';
import { OWNER_WS } from './auth-session';
import { getUsuarioActual } from './auth';
import { sendMetaCAPIEvent } from './meta-capi';
import { esSexo } from './resumen-ficha';
import { EVENTOS_CALIFICADO, eventIdCalificado } from './meta-capi-payload';
// Cuándo se descarta el «calificado»: puro y compartido con la ficha y con el
// canal de MaKo, para que los tres apliquen la MISMA regla.
import { calificadoSeDescarta } from './calificado-reunion';
// Qué deriva `updateLead` del desenlace (estado ↔ cerro, motivo, venta) y CUÁNDO:
// puro y con test (tests/updatelead-no-borra-venta.test.ts).
import { desenlaceAlGuardar } from './lead-desenlace';
import { yaGuardado } from './lead-respuestas';
import { pasaAGanado } from './crm-curso-al-ganar-reglas';
// Qué reunión anula una cancelación: puro y con test (tests/recordatorio-lead.test.ts).
import { juntaACancelar } from './recordatorio-lead';
// La undécima tanda (M1-b y M6), puras y con test (tests/motor-entrada-etapa.test.ts): cuándo una etapa DERIVADA
// inscribe al instante y cuándo una reserva limpia la etapa puesta a mano.
import { entraAEtapaDeReunion } from './nutricion-familias';
import { limpiaEtapaAlReservar } from './nutricion-etapa';
import type { Stage, StageDerivable } from './pipeline';
import { DEFAULT_PIPELINE, generateFunnel, terminalEstadoFor, NUTRI_KEYS, deriveStageKey, pipelineStageOf, MAKO_SETTER } from './pipeline';
// El funnel vive en lib/funnels.ts desde la mig 0170. Acá se usa el lector DEL
// LEAD (no el del negocio): lo que valida un movimiento son los requisitos del
// recorrido de ESE lead.
import { getPipelineStagesDeLead, idDelFunnelDefault } from './funnels';
import { AUTOR_SISTEMA, CAMPO_ETAPA, cambioDeEtapa, marcarEtapaVista } from './etapa-historial';
import { stepsForStage, funnelReqInfo, pasosResueltos, type Step, type StageReqValues } from './stage-requirements';
import type { VentaTipo } from './venta-tipo';
import type { EntradaSocial } from './canal-social';
import { faltaColumnaNuevaDelAlta, sinColumnasNuevas, traeColumnasNuevas } from './lead-alta-columnas';
// La etapa de ORIGEN de un movimiento se deriva con la MISMA función que usa la
// ficha (override chequeado contra el funnel vigente): con el override crudo, el
// validador y la pantalla discrepan justo en los leads con etapas huérfanas.
import { etapaVigenteDe } from './funnel-etapas';
import { avanceDe, esEventoDeVideo } from './vsl-retencion';
import { hoyEnTijuana } from './date-utils';
import { limpiaNoShow, textoNoShow } from './reagenda-no-show';
import { cachedRead, TAG, TTL } from './cache';
import { actualizarEtiquetaLead } from './evolution-labels';
import { idDeclaraHost } from './video-id';
import { esClicDelConstructor } from './clic-ruido';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

// Desenlace explícito del lead (Fase 8). Fuente de verdad del resultado:
//   - abierto:        en proceso, sin desenlace todavía
//   - ganado:         cerró (equivale a cerro=true)
//   - perdido:        lo trabajamos y no compró (cerro=false)
//   - descalificado:  no era buen fit (cerro=false)
// `cerro` se mantiene en sync (lo derivan las queries de Revenue).
export type EstadoLead = 'abierto' | 'ganado' | 'perdido' | 'descalificado' | 'no_responde';

export type Lead = {
  id: number;
  nombre: string;
  /**
   * En qué PRODUCTO vive. `null` = el del negocio.
   *
   * ⚠️ `null` NO ES «sin producto», y es la trampa de esta columna: el tablero del
   * embudo por defecto busca justamente los que la tienen en NULL, y medido contra
   * producción el 30/09/2026 **están las 1.530 filas de los 6 workspaces**. Cualquier
   * pantalla que dibuje «sin producto» para ese caso lo diría sobre todos los leads que
   * existen hoy.
   *
   * ⚠️ Y NO está en `LISTA_COLS`: el tablero filtra por esta columna en el SERVER, así
   * que no la baja. La trae `getLead` (que hace `select(*)`) y la búsqueda de duplicados,
   * que la pide explícita. Si algo en el navegador la lee sobre una fila del tablero, va
   * a recibir `undefined` — que no es lo mismo que `null`.
   */
  funnel_id?: number | null;
  /**
   * NO es una columna: lo pone `listLeadsDeFunnel` cuando el lead está en ese tablero como
   * AGREGADO (una fila de `lead_funnel`, mig 0207) y no porque sea su casa. Trae el id del
   * producto, y en ese caso `pipeline_stage` ya viene reemplazado por la etapa de la fila.
   * Mover su tarjeta escribe la fila, nunca la etapa de su casa.
   */
  de_fila?: number | null;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  /** La web del lead (mig 0194). Reemplazó a «Dirección» en la ficha el 06/10/2026. */
  web?: string | null;
  /**
   * Lo que alguien CREE que vale el lead mientras está abierto, en USD (mig 0258, punto 21 del
   * 12/10/2026). NO es una venta: Revenue y el dashboard siguen leyendo `monto_cierre_usd` /
   * `suscripcion_monto_usd`. El tablero lo suma por columna con la marca de estimado. Opcional
   * porque la migración puede no estar aplicada en una base vieja (con `select('*')` no llega).
   */
  ingreso_estimado?: number | null;
  /** Usuario de Instagram SIN la @ (mig 0258, punto 28). La foto del perfil no se guarda: vence. */
  instagram?: string | null;
  /** Lo que el Resumen personalizable puede mostrar (mig 0274, 14/10/2026). */
  youtube?: string | null;
  linkedin?: string | null;
  direccion?: string | null;
  sexo?: 'mujer' | 'hombre' | 'otro' | null;
  /** Lo que contestó en el formulario de la landing ([{ pregunta, respuesta }], lib/optin-respuestas.ts). */
  optin_respuestas?: unknown;
  /**
   * La página donde dejó sus datos (mig XXXX_lead_entrada, tanda B del CRM): la URL normalizada del
   * opt-in (`normalizarUrl`, sin UTM ni click-ids). Cuándo, es `created_at`. Lo escribe SÓLO el alta;
   * null = no entró por una landing, o entró antes de la migración.
   */
  pagina_registro?: string | null;
  /**
   * Cómo entró por Instagram o Messenger (mig XXXX_lead_entrada): el evento que lo creó, guardado UNA
   * vez. Se lee con `entradaSocialGuardada` (lib/canal-social.ts), nunca crudo.
   */
  entrada_social?: unknown;
  /** El link para entrar a la R1 y a la R2 (mig 0204, `join_url` de Calendly). Lo escribe `guardarLinkDeReunion`. */
  junta_1_url?: string | null;
  junta_2_url?: string | null;
  /** Se dio de baja de los emails (mig 0046): no recibe ningún email del negocio. */
  email_opt_out?: boolean | null;
  /** La oferta a la que entró (mig 0272). Se lee y se asigna por lib/oferta-lead.ts. */
  oferta_id?: number | null;
  /** La cara que ELIGIÓ una persona (mig 0173/0174), desde la ficha del cliente. Gana sobre
   *  la foto automática (WhatsApp / Gravatar), que se calcula al leer y nunca se escribe acá. */
  avatar_url?: string | null;
  icono?: string | null;
  /** La copia de su foto de WhatsApp en nuestro bucket (mig 0195, la escribe el cron
   *  fotos-contacto). Respaldo de las iniciales: lo elegido gana. */
  foto_auto_url?: string | null;

  fecha_agenda: string | null;        // YYYY-MM-DD
  fecha_junta_1: string | null;
  fecha_junta_2: string | null;
  junta_1_at: string | null;          // ISO con hora (Calendly start_time) — precisión del No Show
  junta_2_at: string | null;

  asistio_j1: boolean | null;
  asistio_j2: boolean | null;
  calificado: boolean | null;
  cerro: boolean | null;

  // Desenlace explícito (Fase 8) — coherente con `cerro`
  estado_lead: EstadoLead;
  motivo_perdida: string | null;      // solo aplica a perdido/descalificado

  monto_cierre_usd: number | null;
  fecha_cierre: string | null;

  // Confirmación verbal entre J2 y primer pago (opcional, para medir SCL)
  fecha_confirmacion: string | null;

  // Cobranza — ortogonal a cierre. Cierre = vendido. Estos = cobrado.
  // total_cobrado_usd y fecha_primer_pago se DERIVAN de los pagos (Fase 8-bis).
  fecha_primer_pago: string | null;
  monto_primer_pago: number | null;
  total_cobrado_usd: number | null;
  fecha_inicio_servicio: string | null;

  // Plan de pagos (Fase 8-bis) — genera las filas de `pagos`
  cobro_inicial_usd: number | null;
  monto_cuota_usd: number | null;
  total_cuotas: number | null;    // 1..6
  dia_de_pago: number | null;     // 1..28

  // Venta recurrente / suscripción (#363, mig 0115). 'unico' = pago único (default).
  // 'sin_cobro' = un becado (#747): la lista y lo que significa, en lib/venta-tipo.ts.
  venta_tipo?: VentaTipo | null;
  suscripcion_monto_usd?: number | null;   // importe MENSUAL (MRR)
  suscripcion_meses?: number | null;        // plazo fijo en meses; null = indefinida

  adset_id_origen: string | null;
  /** La campaña de Meta de la que vino (mig 0193). Decide el producto si está asignada. */
  meta_campaign_id?: string | null;

  // UTMs — vienen del webhook de Calendly (vía landing en Lovable)
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  /**
   * El identificador de clic de Facebook, tal como Meta lo pone en la URL de
   * aterrizaje. Se guarda literal: el `adid` que parece llevar adentro es un formato
   * opaco del proveedor y decodificarlo a ojo sería inventar un id.
   *
   * Sirve para la API de Conversiones: sin esto, avisarle a Meta que un lead se
   * cualificó le dice que pasó algo bueno y no DE QUÉ ANUNCIO, que es la mitad que
   * hace que la optimización sirva. Null = no vino de un clic de Meta.
   */
  fbclid: string | null;

  // Respuestas del formulario Calendly (calificación previa a J1)
  respuesta_facturacion: string | null;
  respuesta_colaboradores: string | null;
  respuesta_objetivo: string | null;
  respuesta_cuando_empezar: string | null;
  respuesta_inversion: string | null;   // Q3 (Fase B v3)
  respuesta_decisor: string | null;      // Q6 (Fase B v3)

  // Meta Lead Ads (instant form) — atribución del anuncio de origen
  meta_lead_id: string | null;
  meta_ad_id: string | null;
  meta_ad_name: string | null;
  meta_campaign_name: string | null;
  meta_adset_name: string | null;
  /**
   * Las respuestas CRUDAS del formulario, tal como las manda Meta (mig 0187).
   *
   * El parser saca cuatro campos por palabra clave y hasta el 04/10/2026 tiraba el
   * resto. Acá queda entero: el ws13 tiene cinco formularios con preguntas propias
   * («en qué plazo busca vender») y Meta borra el field_data a los 90 días. Opcional
   * y nullable: un lead que no vino de Meta no tiene nada que poner, y `null` (no
   * aplica) no es `[]` (vino vacío).
   */
  meta_field_data?: MetaFieldData | null;
  /** Cuándo creó Meta el lead — NO cuándo lo ingestamos nosotros (mig 0187). */
  meta_created_at?: string | null;
  origen_lead: string | null;            // 'instant_form' | 'calendly' | null
  telefono_normalizado: string | null;   // solo dígitos — llave de match

  // UUID anónimo de la landing (cookie nqe_visitor_id, llega como utm_term).
  // Cruza con vsl_events para saber si el lead vio el VSL.
  visitor_id: string | null;

  // Nutrición (v3 Fase G): true si se corrió la serie WhatsApp+email de 7 días
  // sobre un form que no agendó.
  nutricion_realizada: boolean;

  // Rediseño CRM (migración 0020) — opcionales por compatibilidad si la
  // migración aún no se aplicó.
  pipeline_stage?: string | null;   // override manual de la columna del Kanban
  // Última etapa efectiva que el historial YA registró (migración 0122). No es
  // la etapa del lead: es la memoria del historial, y existe porque la etapa que
  // ve el usuario es derivada y puede cambiar sin que nadie escriba nada. Ver
  // lib/etapa-historial.ts.
  etapa_vista?: string | null;
  closer?: string | null;           // closer asignado (Datos comerciales)
  setter?: string | null;           // setter asignado (Nutrición - Manual)
  fathom_links?: FathomLink[] | null;
  nutricion_manual_deadline?: string | null;   // deadline de la nutrición manual (migración 0044)

  // Excepciones declaradas (migración 0064): eximen requisitos de etapa de
  // forma PERSISTENTE (antes solo quedaban como eventos y se volvían a exigir).
  sin_r1?: boolean | null;          // cierre sin Reunión 1
  sin_r2?: boolean | null;          // cierre sin Reunión 2
  fathom_omitido?: boolean | null;  // la reunión no se grabó

  // Omisiones/excepciones del wizard "Solucionar" (migración 0069).
  deal_fiscal_doc_omitido?: boolean | null;  // no se sube el documento fiscal del cliente
  comprobante_omitido?: boolean | null;      // no se suben los comprobantes de pago
  empresa_omitido?: boolean | null;          // "Empresa" ignorada: no cuenta en el worklist del CRM
  pendientes_ignorados?: string | null;      // "Datos sin marcar" ignorados a nivel lead (mig 0109): no notifican ni cuentan; timestamp de cuándo se ignoró
  datos_ignorados?: string[] | null;         // los datos sin marcar ignorados UNO POR UNO (mig 0270): ids de paso (StepId); no avisan, siguen faltando
  r2_agenda_externa_motivo?: string | null;  // la R2 se agendó fuera de Calendly (motivo) → satisface respuestas R2

  // Contrato subido (migración 0029): archivo en Storage + nombre original.
  contrato_nombre?: string | null;
  contrato_path?: string | null;

  // Deal Details (migración 0060): secciones extraídas del contrato por IA
  // (resumen en lenguaje simple, editable) + identidad fiscal propia elegida.
  deal_fiscal?: { razon?: string | null; id_fiscal?: string | null; domicilio?: string | null; correo?: string | null; doc_path?: string | null; doc_nombre?: string | null } | null;
  deal_servicio?: { que_es?: string | null; fecha_inicio?: string | null; fecha_termino?: string | null; duracion?: string | null; frecuencia?: string | null; modalidad?: string | null; sesiones?: string | null } | null;
  deal_promesa?: { resultado?: string | null; garantia?: string | null } | null;
  deal_obligaciones?: { cliente?: string[]; prestador?: string[] } | null;
  facturado_por_id?: number | null;

  created_at: string;
  updated_at: string;
};

export type FathomLink = { label: string; url: string };

export type LeadCreateInput = {
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  empresa?: string | null;
  fecha_agenda?: string | null;
  fecha_junta_1?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  fbclid?: string | null;
  /**
   * A qué funnel entra. null/undefined = el del negocio.
   *
   * ⚠️ Lo pone el tablero desde el que se crea. Sin esto, un lead cargado mirando un
   * funnel secundario nacía en el del negocio y DESAPARECÍA de la pantalla donde se
   * acababa de crear — que es el peor final posible para un alta.
   */
  funnel_id?: number | null;
  respuesta_facturacion?: string | null;
  respuesta_colaboradores?: string | null;
  respuesta_objetivo?: string | null;
  respuesta_cuando_empezar?: string | null;
  respuesta_inversion?: string | null;
  respuesta_decisor?: string | null;
  meta_lead_id?: string | null;
  meta_ad_id?: string | null;
  meta_ad_name?: string | null;
  meta_campaign_name?: string | null;
  meta_adset_name?: string | null;
  origen_lead?: string | null;
  telefono_normalizado?: string | null;
  visitor_id?: string | null;
  /**
   * El usuario de Instagram, SIN la @ (mig 0258, punto 28 del 12/10/2026): lo elige el buscador
   * del alta (app/crm/new/InstagramBuscador.tsx) y llega normalizado por `usuarioInstagram`.
   */
  instagram?: string | null;
  /** Lo que contestó en el formulario de la landing (mig 0274), ya saneado por `respuestasDelOptin`. */
  optin_respuestas?: Array<{ pregunta: string; respuesta: string }> | null;
  /** La página donde dejó sus datos, ya normalizada (mig XXXX_lead_entrada). */
  pagina_registro?: string | null;
  /** Cómo entró por Instagram o Messenger (`entradaSocialDe`, mig XXXX_lead_entrada). */
  entrada_social?: EntradaSocial | null;
};

export type LeadUpdateInput = {
  // Identificación / contacto
  nombre?: string;
  email?: string | null;
  telefono?: string | null;
  empresa?: string | null;

  // Comercial
  fecha_agenda?: string | null;
  fecha_junta_1?: string | null;
  fecha_junta_2?: string | null;
  asistio_j1?: boolean | null;
  asistio_j2?: boolean | null;
  calificado?: boolean | null;
  cerro?: boolean | null;

  // Desenlace (Fase 8). Si viene estado_lead, manda él y deriva cerro.
  estado_lead?: EstadoLead;
  motivo_perdida?: string | null;

  // Nutrición (v3 Fase G)
  nutricion_realizada?: boolean;

  monto_cierre_usd?: number | null;
  fecha_cierre?: string | null;

  // Confirmación verbal entre J2 y primer pago
  fecha_confirmacion?: string | null;

  // Cobranza
  fecha_primer_pago?: string | null;
  monto_primer_pago?: number | null;
  total_cobrado_usd?: number | null;
  fecha_inicio_servicio?: string | null;
};

export type EstadoMadurez = 'madura' | 'madurando' | 'reciente' | 'sin_j1';

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista todos los leads ordenados por created_at desc (más nuevos primero).
 */
// Solo las columnas que consume el CRM (mapToCrmLead + pipelineStageOf +
// origenLegible + calendlyDe). Antes traía select('*') (~50 cols, incl. payloads
// crudos y campos de cobranza que el board no usa).
const LISTA_COLS =
  'id, nombre, email, empresa, telefono, telefono_normalizado, created_at, estado_lead, pipeline_stage, nutricion_realizada, nutricion_manual_deadline, ' +
  'fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, calificado, fecha_confirmacion, fecha_primer_pago, fecha_cierre, ' +
  'monto_cierre_usd, total_cobrado_usd, closer, setter, fathom_links, motivo_perdida, visitor_id, ' +
  'venta_tipo, suscripcion_monto_usd, suscripcion_meses, ' +
  // ⚠️ MIG 0258 ANTES DEL DEPLOY: el tablero suma `ingreso_estimado` por columna (punto 21) y
  // la ficha muestra `instagram` (punto 28). Una columna que no existe acá rechaza la consulta
  // ENTERA y el CRM abre vacío, sin un error que lo diga.
  'ingreso_estimado, instagram, ' +
  'meta_ad_name, meta_campaign_name, meta_lead_id, meta_ad_id, utm_campaign, ' +
  // ⚠️ Estas cuatro las LEEN los mappers y no se pedían: `origenAds` (el filtro por
  // campaña y por anuncio) necesita `utm_content`, que es donde la landing guarda el
  // anuncio, y `meta_campaign_id`/`adset_id_origen` para la campaña; `canalDeLead` y
  // `origenLegible` necesitan `origen_lead`. Sin ellas no fallaba nada: el filtro de
  // anuncios no se ofrecía nunca para un lead de landing, y la tarjeta decía «Sin
  // origen» sobre leads que sí tienen origen. Medido el 10/10/2026 en Código
  // Inmobiliario: 44 de 52 leads con el id del anuncio en `utm_content` y 50 de 52 con
  // `origen_lead`, y el tablero no veía ninguno de los dos. `funnel_id` sigue AFUERA a
  // propósito (ver su comentario en el tipo `Lead`).
  'utm_content, meta_campaign_id, adset_id_origen, origen_lead, ' +
  'respuesta_objetivo, respuesta_facturacion, respuesta_colaboradores, respuesta_cuando_empezar, respuesta_inversion, respuesta_decisor';

export const listLeads = cachedRead('listLeads', _listLeads, { tags: [TAG.leads], revalidate: TTL.user });
/**
 * Los leads de UN funnel, para el tablero del CRM.
 *
 * ⚠️ ES UNA FUNCIÓN APARTE, Y NO UN PARÁMETRO DE `listLeads()`. Medido el 28/09/2026:
 * `listLeads()` tiene SIETE llamadores y sólo uno —el tablero— tiene un funnel en la URL.
 * Los otros seis necesitan ver el negocio entero, y filtrarlos rompería en silencio:
 *
 *   · `crm.helpers` (MaKo contestando «cuántos leads tengo», el conteo por etapa y la
 *     lista de closers usados) pasaría a contestar por un funnel que nadie nombró;
 *   · `fathom-auto` engancha grabaciones por email y dejaría reuniones sin grabación;
 *   · `mako-tools` (`buscar_leads`) tiene que encontrar a una persona SIEMPRE — filtrar
 *     la haría invisible para la búsqueda.
 *
 * Ninguno de los seis falla: devuelven menos. Por eso el filtro vive donde hay un funnel
 * que filtrar y no en la lectura compartida, que es el lugar que parece más económico.
 *
 * ⚠️ Y `null` ES EL DEL NEGOCIO. Un lead sin funnel asignado —que hoy son todos— tiene que
 * seguir apareciendo en el tablero por defecto: si desapareciera, el CRM quedaría vacío
 * para todo el mundo el día del deploy. Con `funnelId` de un funnel secundario, en cambio,
 * se piden SÓLO los suyos: un tablero nuevo arranca sin un lead, que es lo que lo hace un
 * tablero propio y no otra vista del mismo.
 */
export async function listLeadsDeFunnel(funnelId: number | null): Promise<Lead[]> {
  const supabase = await getTenantDb();
  const filas = await leerTodo<Lead>(supabase, 'leads', LISTA_COLS, {
    orden: 'id',
    filtros: (q) => (funnelId == null ? q.is('funnel_id', null) : q.eq('funnel_id', funnelId)),
  });
  // ⚠️ Y LOS AGREGADOS (mig 0207): los leads cuya casa es OTRO producto pero que están acá por
  // una fila de `lead_funnel`. Van con la etapa de ESA fila puesta en `pipeline_stage` y la
  // marca `de_fila`, para que el tablero los dibuje en su columna de acá y mover su tarjeta
  // escriba la fila y no la casa. El producto del negocio, en la tabla, va con su id.
  const agregados = await agregadosDelTablero(supabase, funnelId, new Set(filas.map((l) => l.id)));
  return [...filas, ...agregados].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

/**
 * Los leads que están en este tablero por una fila de `lead_funnel` (no por su casa), con la
 * etapa de la fila. Nunca tira: si la tabla no está (deploy sin la 0207) o la lectura falla,
 * el tablero muestra lo de siempre — de menos, nunca algo inventado.
 */
async function agregadosDelTablero(supabase: SupabaseClient, funnelId: number | null, yaEstan: Set<number>): Promise<Lead[]> {
  try {
    const id = funnelId ?? (await idDelFunnelDefault());
    if (id == null) return [];
    const { data, error } = await supabase.from('lead_funnel').select('lead_id, etapa').eq('funnel_id', id);
    if (error) throw new Error(error.message);
    const etapa = new Map<number, string>();
    for (const f of (data ?? []) as Array<{ lead_id: number | string; etapa: string }>) {
      const lid = Number(f.lead_id);
      if (!yaEstan.has(lid)) etapa.set(lid, f.etapa);
    }
    if (!etapa.size) return [];
    const ids = [...etapa.keys()];
    const leads: Lead[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const tanda = await leerTodo<Lead>(supabase, 'leads', LISTA_COLS, { orden: 'id', filtros: (q) => q.in('id', ids.slice(i, i + 200)) });
      leads.push(...tanda);
    }
    return leads.map((l) => ({ ...l, pipeline_stage: etapa.get(l.id) ?? l.pipeline_stage, de_fila: id }));
  } catch (e) {
    console.warn('[leads] no pude leer los agregados del tablero:', e instanceof Error ? e.message : e);
    return [];
  }
}
/**
 * CUÁNTOS leads tiene un funnel. Sin traerlos.
 *
 * Lo pide el pop-up del CRM antes de ofrecer eliminar un embudo: «con mucho cuidado si
 * un funnel tiene leads». El número es lo que convierte «Eliminar» en una decisión — sin
 * él la pantalla pregunta a ciegas y la persona contesta a ciegas.
 *
 * ⚠️ `head: true` + `count: 'exact'`: no baja ni una fila, así que no toca el techo de 1000
 * de PostgREST. Contar con `listLeadsDeFunnel().length` sí lo tocaría, y devolvería 1000
 * redondo sobre un funnel de 1.145 — un número plausible, que es la peor forma de mentir.
 */
export async function contarLeadsDeFunnel(funnelId: number | null): Promise<number> {
  const supabase = await getTenantDb();
  const base = supabase.from('leads').select('id', { count: 'exact', head: true });
  const { count, error } = await (funnelId == null ? base.is('funnel_id', null) : base.eq('funnel_id', funnelId));
  // ⚠️ Un error NO es «cero leads». Devolver 0 acá haría que la pantalla dijera «este
  // embudo no tiene leads» sobre uno lleno, y con eso alguien lo archiva tranquilo.
  if (error) throw new Error('No se pudo contar los leads del funnel: ' + error.message);
  // Y los AGREGADOS (mig 0207): también están en ese tablero. Contarlos de menos haría que un
  // embudo con gente pareciera vacío justo antes de archivarlo.
  const id = funnelId ?? (await idDelFunnelDefault());
  if (id == null) return count ?? 0;
  const ag = await supabase.from('lead_funnel').select('id', { count: 'exact', head: true }).eq('funnel_id', id);
  if (ag.error) throw new Error('No se pudo contar los leads agregados al funnel: ' + ag.error.message);
  return (count ?? 0) + (ag.count ?? 0);
}
async function _listLeads(): Promise<Lead[]> {
  const supabase = (await getTenantDb());
  // PAGINADO OBLIGATORIO. Esto era un `.select()` suelto y PostgREST corta en
  // 1000 filas sin avisar: devuelve 1000 y un 200, no un error. Con `created_at
  // desc` los que se caían eran los leads MÁS VIEJOS — o sea los clientes que ya
  // cerraron. El día que ws1 pasó los 1000 leads (1066), el CRM de Mauricio pasó
  // a mostrar 4 ganados de 13: US$52.700 de facturación desaparecida del tablero,
  // sin un solo error en ningún log. Es la lectura más importante de la app.
  //
  // El orden de paginado va por `id` (único) y el de presentación se aplica
  // después, en memoria: ordenar las páginas por `created_at` —que se repite—
  // reparte los empates distinto en cada página y saltea filas. Ver
  // docs/hallazgos-infra.md §1.
  const filas = await leerTodo<Lead>(supabase, 'leads', LISTA_COLS, { orden: 'id' });
  return filas.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

/**
 * Obtiene UN lead por su id.
 */
/**
 * En qué workspace vive un lead, MIRANDO POR ENCIMA DEL SCOPE. Solo el super
 * admin, y fail-closed: cualquier otra sesión —o ninguna— recibe null antes de
 * que la consulta corra.
 *
 * ⚠️ ESTO CRUZA INQUILINOS A PROPÓSITO, que es la cosa que el resto del archivo
 * evita. Existe por un caso concreto: el super admin abre desde WhatsApp el link
 * del lead de un cliente estando parado en otro workspace, y `getLead` —que
 * scopea— devuelve null como si el lead no existiera. La alternativa era que él
 * tuviera que adivinar el `?ws=` a mano.
 *
 * Devuelve SOLO el número de workspace, nunca datos del lead: con eso alcanza
 * para mandarlo a `?ws=N`, y de ahí en adelante manda el camino de siempre
 * (proxy.ts valida que la sesión firmada sea admin y recién ahí lo deja pasar).
 * Así esta función no se convierte en una segunda puerta a los datos ajenos.
 */
export async function workspaceDeLeadParaAdmin(id: number): Promise<number | null> {
  const { getSesionAdmin } = await import('./auth');
  if (!(await getSesionAdmin())) return null;
  const { data } = await getSupabaseServer()
    .from('leads')
    .select('workspace_id')
    .eq('id', id)
    .maybeSingle();
  const ws = (data as { workspace_id: number | null } | null)?.workspace_id;
  return typeof ws === 'number' ? ws : null;
}

export async function getLead(id: number): Promise<Lead | null> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Error obteniendo lead ${id}: ${error.message}`);
  return data as Lead | null;
}

/**
 * El lead más viejo con ESE email.
 *
 *
 * ⚠️ `.maybeSingle()` SOBRE UNA COLUMNA NO ÚNICA TIRA EL WEBHOOK ENTERO. En `leads`
 * la única columna con índice único es `meta_lead_id` (mig 0007): ni
 * `telefono_normalizado` ni `email` lo tienen. Con DOS filas, PostgREST no devuelve
 * la primera — contesta **PGRST116** («JSON object requested, multiple (or no) rows
 * returned»), y los tres lectores de ingesta lo convierten en `throw`. Río arriba eso
 * es un HTTP 500 del webhook de Calendly, o sea que la reunión que un lead acaba de
 * reservar NO entra al CRM y ninguna pantalla lo dice. Lo mismo el instant form de
 * Meta y el ruteo de la R2.
 *
 * Hoy no hay emails repetidos en la base, así que el bug está LATENTE y lo dispara el
 * primer duplicado — justo lo que trae una importación de listas que se solapan.
 *
 * ⚠️ EL TELÉFONO YA NO PASA POR ACÁ: tiene su propia puerta (`primerLeadPorTelefono`),
 * porque el mismo número escrito con y sin código de país es el mismo número y un
 * `.eq` no lo ve. El email, en cambio, se compara entero: no hay un «sufijo de un
 * email» que signifique lo mismo.
 *
 * Se pide `limit(2)` en lugar de `limit(1)` a propósito: con el MISMO viaje a la base
 * se sabe si había más de una fila, así que la ambigüedad no se elige en silencio.
 * Y no se abstiene —abstenerse acá es perder la reunión—: se elige el más VIEJO, que
 * es un dato (la ficha original, la que viene trabajando el equipo) y no un desempate
 * inventado. Fundir dos fichas es la decisión de `duplicadosDeLead`, que es donde
 * alguien la mira.
 *
 * El VALOR no va al log: es el teléfono o el email de una persona. Van los ids, que
 * es lo único que hace falta para ir a mirar cuáles son.
 */
async function primerLeadPor(
  supabase: SupabaseClient,
  columna: 'email',
  valor: string,
  donde: string,
): Promise<Lead | null> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq(columna, valor)
    .order('id', { ascending: true })
    .limit(2);
  if (error) throw new Error(`Error buscando lead por email: ${error.message}`);
  const filas = (data ?? []) as Lead[];
  if (filas.length > 1) {
    console.warn(`[leads] ${donde}: hay más de un lead con el mismo ${columna} (ids ${filas.map((l) => l.id).join(', ')}, puede haber más) — se usa el más viejo`);
  }
  return filas[0] ?? null;
}

/**
 * El lead de ESE teléfono, para las ingestas por las que el lead entra SOLO (#626).
 *
 * ⚠️ EL CRITERIO YA ESTABA TOMADO Y SE APLICABA EN LA MITAD DE LAS PUERTAS. «El mismo
 * número con y sin código de país es el mismo número» es textual de
 * `telefonoComparable`, y es lo que usan el alta manual (`duplicadosDeLead`, que FRENA
 * con eso) y el inbox de WhatsApp (`lib/evolution-mensajes.ts`). Las ingestas —instant
 * form de Meta, webhook de Calendly, ruteo de la R2— comparaban con `.eq`, o sea que al
 * lead que entra SOLO se le aplicaba un criterio MÁS ESTRICTO que al que carga una
 * persona: uno llega desde WhatsApp como `5219981234567` y el otro tipeado
 * `9981234567`, y para el webhook eran dos personas. Resultado: una ficha nueva, y las
 * DOS inalcanzables desde ahí en adelante — dos filas con el mismo
 * `telefono_normalizado` rompen con PGRST116 el `.maybeSingle()` de la ingesta
 * siguiente.
 *
 * Son DOS consultas y en este orden, igual que en el inbox y en el webhook de Chatwoot:
 *
 *   1. **Exacta.** Si hay, el sufijo no opina: así este cambio no puede volver ambiguo
 *      ningún match que antes era limpio, y el tope de filas de la segunda no puede
 *      esconder al exacto detrás de veinte parecidos.
 *   2. **Sufijo de 10 dígitos**, sólo si la exacta no trajo nada. Un patrón trae
 *      CANDIDATOS: quién es quién lo decide `elegirPorTelefono`, que vive sin
 *      `server-only` en lib/leads-duplicados.ts para que tenga test.
 *
 * El email viaja para DESEMPATAR, no para matchear: con dos leads que terminan en los
 * mismos diez dígitos (el teléfono de la recepción, un número reciclado por la
 * operadora), el email del que entra es el único dato que dice cuál de los dos es. Sin
 * él no se elige ninguno, y el lead entra como nuevo.
 */
async function primerLeadPorTelefono(
  supabase: SupabaseClient,
  telNorm: string,
  donde: string,
  emailDelQueEntra?: string | null,
): Promise<Lead | null> {
  // El patrón se arma con DÍGITOS y nada más. `normalizarTelefono` ya los deja así,
  // pero `_` es comodín de un carácter en `like` y el teléfono es justo el campo donde
  // entra texto tipeado a mano: si alguna vez llega con uno, el patrón dejaría de
  // preguntar lo que dice preguntar.
  const digitos = (telNorm || '').replace(/[^0-9]/g, '');
  if (!digitos) return null;

  const exacta = await supabase
    .from('leads')
    .select('*')
    .eq('telefono_normalizado', digitos)
    .order('id', { ascending: true })
    .limit(2);
  if (exacta.error) throw new Error(`Error buscando lead por teléfono: ${exacta.error.message}`);
  let candidatos = (exacta.data ?? []) as Lead[];

  const suf = telefonoComparable(digitos);
  if (!candidatos.length && suf) {
    const porSufijo = await supabase
      .from('leads')
      .select('*')
      .like('telefono_normalizado', `%${suf}`)
      .order('id', { ascending: true })
      .limit(20);
    if (porSufijo.error) throw new Error(`Error buscando lead por teléfono: ${porSufijo.error.message}`);
    candidatos = (porSufijo.data ?? []) as Lead[];
  }

  const { elegido, ambiguos } = elegirPorTelefono(candidatos, digitos, emailDelQueEntra);
  // El VALOR no va al log: es el teléfono de una persona. Van los ids, que es lo único
  // que hace falta para ir a mirar cuáles son — y el veredicto, porque «se usa el más
  // viejo» y «no se elige ninguno» mandan a mirar cosas distintas.
  if (ambiguos.length) {
    const veredicto = elegido ? `se usa el más viejo (${elegido.id})` : 'no se elige ninguno: entra como lead nuevo y se funden a mano';
    console.warn(`[leads] ${donde}: hay más de un lead que termina en los mismos dígitos (ids ${ambiguos.join(', ')}) — ${veredicto}`);
  }
  return elegido;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nombre de la persona a la que se le auto-asignan setter y closer al crear un lead,
 * o null si no se puede decidir sin preguntar (#2). Corre en el workspace actual
 * (webhook o sesión).
 *
 * Son DOS preguntas, en este orden:
 *   1) ¿hay UN solo vendedor (rol distinto de admin)? → ése.
 *   2) si no, ¿hay UNA sola persona en el workspace? → ésa, aunque sea admin.
 *
 * ⚠️ EL FILTRO DE ADMIN NO PUEDE SER LO ÚLTIMO QUE DECIDE. Lo que ese filtro quería
 * evitar sigue valiendo: que el admin de una agencia con varios vendedores se lleve
 * los leads de todos. Pero decidía también el caso opuesto — en un workspace cuya
 * ÚNICA persona ES admin devolvía null, y entonces `createLead` no escribía ni setter
 * ni closer y el lead nacía sin nadie. Ése es exactamente el workspace propio de
 * Martín (medido en producción: una fila, rol admin), y es donde el 17/10 entran
 * +1.000 leads importados por CSV, que pasan por este mismo `createLead`
 * (app/crm/actions.ts). Nacer sin vendedor no da ningún error: el lead sale del
 * primer tramo del embudo y ahí recién empieza a pedir «setter» de a uno, o sea mil
 * avisos sobre la cartera con la que hay que prospectar.
 *
 * Con UNA sola persona no hay a quién más asignarle, así que acá no se adivina: se
 * nombra al único candidato. Con dos o más —vendedores o admins— sigue devolviendo
 * null, que es lo correcto: ahí hay una decisión y no es nuestra.
 *
 * MaKo se saca de las DOS listas: `MAKO_SETTER` es la firma de la IA, no una persona
 * a la que repartirle leads. Un workspace cuya única fila es MaKo sigue dando null.
 */
export async function vendedorUnicoDelWorkspace(): Promise<string | null> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return null;
    const { data, error } = await getSupabaseServer()
      .from('usuarios')
      .select('nombre, email, rol, estado, workspace_id')
      .eq('workspace_id', ws)
      .neq('estado', 'suspendido');
    // «No pude leer» no es «no hay nadie». Con la consulta caída no se inventa un
    // vendedor ni se concluye que el workspace está vacío: se deja sin asignar, que
    // es lo único reversible y lo que una persona arregla después en lote.
    if (error) return null;
    const personas = ((data ?? []) as Array<{ nombre: string | null; email: string; rol: string; workspace_id: number | null }>)
      .filter((u) => u.workspace_id === ws && (u.nombre?.trim() || u.email))
      .map((u) => ({ nombre: (u.nombre?.trim() || u.email) as string, esAdmin: u.rol === 'admin' }))
      .filter((p) => p.nombre && p.nombre !== MAKO_SETTER);
    const vendedores = personas.filter((p) => !p.esAdmin);
    if (vendedores.length === 1) return vendedores[0].nombre;
    if (personas.length === 1) return personas[0].nombre;
    return null;
  } catch { return null; }
}

/**
 * Busca leads que parezcan el mismo que el candidato, en ESTE workspace.
 *
 * La comparación vive en `lib/leads-duplicados.ts` (sin `server-only`, para poder
 * testearla); acá queda solo traer con qué comparar. Se acota a lo que puede
 * matchear —email, teléfono o, si no hay ninguno, nombre— en vez de bajar la
 * tabla entera: un CRM con 20.000 leads no entra en memoria por cada alta.
 */
export async function duplicadosDeLead(cand: CandidatoLead): Promise<Coincidencia[]> {
  const email = emailComparable(cand.email);
  const tel = telefonoComparable(cand.telefonoNormalizado ?? cand.telefono);
  const nombre = nombreComparable(cand.nombre);
  if (!email && !tel && !nombre) return [];
  try {
    const db = await getTenantDb();
    // ⚠️ `funnel_id` VIAJA PARA QUE EL AVISO PUEDA NOMBRAR EL PRODUCTO. «Ya lo tienes» y
    // «ya lo tienes en otro producto» llevan a decisiones distintas: la segunda ofrece
    // moverlo, que es lo que pidió Martín («que le advierta que el lead ya existe y que
    // le pregunte si lo quiere traer»). Sin la columna, la pantalla no puede distinguirlas.
    const cols = 'id, nombre, email, telefono_normalizado, funnel_id';
    const [porEmail, porTel, porNombre] = await Promise.all([
      email ? db.from('leads').select(cols).ilike('email', email).limit(20) : { data: [] },
      tel ? db.from('leads').select(cols).ilike('telefono_normalizado', `%${tel}`).limit(20) : { data: [] },
      // El nombre solo se consulta cuando NO hay dato fuerte, igual que la regla
      // de `buscarDuplicados`: pedirlo siempre sería una query por cada alta para
      // un criterio que en ese caso ni se mira.
      //
      // ⚠️ Antes era `.limit(500)` SIN filtro: con 1066 leads en ws1 comparaba
      // contra 500 arbitrarios y el duplicado existía y no se encontraba. Ahora
      // se filtra en el server por cada palabra del nombre (ver
      // `patronesDeNombre`), que es un superconjunto de lo que `buscarDuplicados`
      // acepta, y se lee TODO lo que pasa el filtro. Hubo un paso intermedio con
      // `.limit(100)` que reintroducía el mismo bug por otra puerta: para «Ana» el
      // patrón no filtraba nada y el tope volvía a elegir 100 leads al azar.
      // Ahora las palabras que no filtran se descartan, y si el nombre no tiene
      // ninguna que filtre se lee la tabla entera: es el caso raro (sin email, sin
      // teléfono y con un nombre de pila corto) y es la única respuesta correcta.
      !email && !tel && nombre
        ? leerTodo<LeadExistente>(db, 'leads', cols, {
            orden: 'id',
            filtros: (q) => {
              let f = q;
              for (const pat of patronesDeNombre(nombre)) f = f.ilike('nombre', pat) as unknown as ConsultaPaginada;
              return f;
            },
          }).then((data) => ({ data }))
        : { data: [] },
    ]);
    const todos = [...(porEmail.data ?? []), ...(porTel.data ?? []), ...(porNombre.data ?? [])] as LeadExistente[];
    const unicos = new Map<number, LeadExistente>();
    for (const l of todos) unicos.set(l.id, l);
    return buscarDuplicados(cand, [...unicos.values()]);
  } catch (e) {
    // ⚠️ Si no se puede comprobar, NO se bloquea el alta: el lead es el hecho y
    // el chequeo es una comodidad. Degradar hacia «no dejo entrar a nadie» por
    // una consulta caída pierde clientes reales.
    console.error('[duplicadosDeLead] falló:', e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Crea un lead nuevo. Solo requiere nombre.
 *
 * ⚠️ AVISA SI YA LO TENÉS, y no decide por nadie. El pedido, textual: «avisar al
 * usuario que es duplicado. Si el usuario lo quiere duplicar bueno, que lo pueda
 * hacer, pero no cargarlo automáticamente. Y tampoco rechazarlo sin avisar.»
 *
 * Son tres cosas distintas y el repo no cumplía ninguna pareja: esta función no
 * chequeaba NADA (el alta manual y la de WhatsApp insertaban a ciegas), los
 * webhooks de Meta y Calendly matchean pero hacen merge en SILENCIO, y el
 * importador descarta la fila duplicada aunque la persona la tilde.
 *
 * Acá se tira `LeadDuplicadoError` con las coincidencias adentro. Quien llama
 * decide: mostrarlas y ofrecer `permitirDuplicado: true`, o dejar la propuesta
 * para que una persona mire. Lo que NO puede pasar es que se cree en silencio ni
 * que se descarte en silencio.
 */
/**
 * Un webhook FUNDIÓ dos contactos. Que se sepa.
 *
 * ⚠️ Meta y Calendly matchean por teléfono o email y hacen `update` sobre el lead
 * que ya estaba. Eso está BIEN —es la misma persona volviendo, y crear una
 * tarjeta nueva partiría su historial en dos— pero hasta ahora pasaba en absoluto
 * SILENCIO: no había forma de enterarse de que dos entradas se juntaron, ni de
 * revisar si el match fue correcto.
 *
 * Y un match por teléfono puede equivocarse: dos personas de la misma empresa
 * cargadas con el número de la recepción, o un número reciclado por la operadora.
 * Cuando eso pasa, el segundo lead se escribe ENCIMA del primero y no queda
 * rastro. Este aviso es lo único que lo hace visible.
 *
 * No se frena la fusión: frenarla convertiría un webhook —que corre sin nadie
 * mirando— en una cola de decisiones, y el resultado sería el de los ocho leads
 * esperando. Se hace, y se cuenta.
 */
// El canal es el NOMBRE VISIBLE del origen, no una key: va tal cual al aviso que
// lee el dueño. La union se amplía cuando entra una agenda nueva.
async function avisarFusion(canal: 'Meta' | 'Calendly' | 'Cal.com', lead: Lead, porQue: string): Promise<void> {
  try {
    const { emitirDelCatalogo } = await import('./avisos');
    const { linkApp } = await import('./app-url');
    const { getWorkspaceActual } = await import('./workspace');
    const ws = await getWorkspaceActual();
    await emitirDelCatalogo('lead-fusionado', {
      texto: `Entró un contacto por *${canal}* y lo sumé a *${lead.nombre}*, que ya tenías (${porQue}). Si no era la misma persona, avísame y lo separo 👉 ${linkApp(`/crm/${lead.id}`, ws)}`,
      // Una fusión por hora del mismo canal no son diez avisos: es un patrón, y
      // diez mensajes por el mismo patrón se leen como ruido y se silencian.
      dedupTtlMin: 60,
    });
  } catch (e) {
    // El aviso no puede tumbar la ingesta: el lead ya se actualizó y eso es el
    // hecho. Lo que se pierde es la notificación, no el dato.
    console.error('[avisarFusion] falló:', e instanceof Error ? e.message : e);
  }
}

/**
 * Mueve un lead de un embudo a otro.
 *
 * ⚠️ ES EL ÚNICO CAMINO QUE ESCRIBE `funnel_id` DESPUÉS DEL ALTA. `LeadUpdateInput` no
 * declara la columna a propósito —no es un campo que se edite en un formulario— y los
 * otros dos escritores del repo son el alta manual y el importador, los dos al CREAR.
 * Si mañana hay un segundo camino, este comentario deja de ser cierto y hay que mirar
 * por qué: mover un lead de producto cambia en qué tablero lo ve la gente.
 *
 * ⚠️ Y `null` NO ES «sacarlo de todos los productos»: es el embudo DEL NEGOCIO, que es
 * donde `listLeadsDeFunnel(null)` los busca. No hay forma de dejar un lead sin tablero,
 * y está bien que no la haya.
 */
export async function moverLeadDeFunnel(leadId: number, funnelId: number | null): Promise<void> {
  const supabase = await getTenantDb();
  const { error } = await supabase.from('leads').update({ funnel_id: funnelId }).eq('id', leadId);
  // Un error acá NO se traga: la pantalla de arriba tiene que poder decir que el lead
  // sigue donde estaba. Un «listo» sobre un movimiento que no pasó manda a buscarlo a un
  // tablero donde no está.
  if (error) throw new Error('No se pudo mover el lead de funnel: ' + error.message);
  // ⚠️ El caché lo invalida la ACTION, no esta función: `lib/leads.ts` no importa `bust`
  // y meterlo acá sumaría una dependencia de Next a un módulo que hoy es sólo datos.
}
export async function createLead(input: LeadCreateInput & { permitirDuplicado?: boolean }): Promise<Lead> {
  if (!input.nombre || !input.nombre.trim()) {
    throw new Error('Nombre es requerido');
  }
  if (!input.permitirDuplicado) {
    const dup = await duplicadosDeLead(input);
    if (dup.length) throw new LeadDuplicadoError(dup);
  }
  const supabase = (await getTenantDb());
  const solo = await vendedorUnicoDelWorkspace(); // #2: auto-asignar si hay 1 vendedor
  const fila: Record<string, unknown> = {
      nombre: input.nombre.trim(),
      email: input.email?.trim() || null,
      telefono: input.telefono?.trim() || null,
      // Sin esto el lead manual nunca matchea su chat de WhatsApp ni el
      // instant form / Calendly (la llave de match es telefono_normalizado).
      telefono_normalizado: normalizarTelefono(input.telefono),
      empresa: input.empresa?.trim() || null,
      fecha_agenda: input.fecha_agenda || null,
      fecha_junta_1: input.fecha_junta_1 || null,
      // ⚠️ EL visitor_id NO SE TIRA. Estaba en `LeadCreateInput` y no llegaba
      // nunca al insert, así que un lead creado desde la landing nacía sin el
      // identificador de la visita — y la tab Tracking de su ficha, que se busca
      // POR visitor_id, quedaba vacía. Toda la medición (visitas, video, clicks)
      // existía en la base y no se podía atar a la persona: exactamente lo que el
      // tracking existe para hacer.
      visitor_id: input.visitor_id?.trim() || null,
      // Lo mismo con de dónde vino: sin esto, un lead de landing es
      // indistinguible de uno cargado a mano.
      origen_lead: input.origen_lead?.trim() || null,
      utm_source: input.utm_source?.trim() || null,
      utm_medium: input.utm_medium?.trim() || null,
      utm_campaign: input.utm_campaign?.trim() || null,
      utm_content: input.utm_content?.trim() || null,
      fbclid: input.fbclid?.trim() || null,
      funnel_id: input.funnel_id ?? null,
      // ⚠️ SÓLO SI VINO: un insert que NOMBRA una columna que no existe se rechaza ENTERO. Sin
      // la mig 0258 aplicada, un alta sin Instagram tiene que seguir entrando; con Instagram,
      // el error dice qué columna falta en vez de perder el lead en silencio.
      ...(input.instagram?.trim() ? { instagram: input.instagram.trim() } : {}),
      // Igual que Instagram: SÓLO SI VINO, así un alta sin respuestas entra sin la mig 0274.
      ...(input.optin_respuestas?.length ? { optin_respuestas: input.optin_respuestas } : {}),
      // ⚠️ EL ANUNCIO SE ESCRIBE (tanda B del CRM, 14/10/2026). Estaba en `LeadCreateInput` y no
      // llegaba al insert —el mismo caso que el `visitor_id` de arriba—, así que el lead de un DM
      // pagado nacía sin anuncio y la atribución por anuncio no lo contaba. Lo pasa el alta de Zernio
      // (lib/zernio-entrante.ts); ningún otro alta lo manda. Sólo si vino: un alta sin anuncio no lo nombra.
      ...(input.meta_ad_id?.trim() ? { meta_ad_id: input.meta_ad_id.trim() } : {}),
      // Lo nuevo de la tanda B (mig XXXX_lead_entrada): la página del opt-in y cómo entró por
      // Instagram o Messenger. Sólo si vino, y con el reintento de abajo si la migración no llegó.
      ...(input.pagina_registro?.trim() ? { pagina_registro: input.pagina_registro.trim() } : {}),
      ...(input.entrada_social ? { entrada_social: input.entrada_social } : {}),
      ...(solo ? { setter: solo, closer: solo } : {}),
  };
  const insertar = (f: Record<string, unknown>) => supabase.from('leads').insert(f).select('*').single();
  let { data, error } = await insertar(fila);
  // ⚠️ SIN LA MIGRACIÓN, EL LEAD ENTRA IGUAL (lib/lead-alta-columnas.ts): un deploy que llega antes que
  // la XXXX_lead_entrada no puede mandar cada opt-in a propuesta ni perder el lead de un DM. Una sola
  // vez, y sólo si lo que falta es una de ESAS columnas.
  if (error && traeColumnasNuevas(fila) && faltaColumnaNuevaDelAlta(error)) {
    console.warn(`[leads] falta la migración XXXX_lead_entrada: el lead entra sin la página de registro ni la entrada social (${error.message})`);
    ({ data, error } = await insertar(sinColumnasNuevas(fila)));
  }
  if (error) throw new Error(`Error creando lead: ${error.message}`);
  return data as Lead;
}

/**
 * Actualiza un lead con validaciones lógicas.
 *
 * Reglas:
 * - Si fecha_junta_1 es null → asistio_j1 se fuerza a null.
 * - Si consta que NO asistió a una R1 con fecha → calificado se fuerza a null.
 *   Sin reunión, «calificado» se conserva: ver lib/calificado-reunion.ts.
 * - El desenlace (estado_lead ↔ cerro, motivo y venta) lo decide
 *   lib/lead-desenlace.ts, y SÓLO si el caller tocó un campo que lo decide:
 *   · con estado_lead / cerro / monto_cierre_usd / fecha_cierre: si cerro != true,
 *     monto_cierre_usd y fecha_cierre se fuerzan a null; si cerro = true, el monto
 *     (opcional) tiene que ser positivo y la fecha de cierre se completa con hoy.
 *   · con estado_lead / cerro / motivo_perdida: el motivo sólo sobrevive en
 *     perdido o descalificado.
 *   Corregir cualquier otro campo (una asistencia, la fecha de una reunión) no
 *   toca la venta.
 */
export async function updateLead(
  id: number,
  input: LeadUpdateInput,
  /**
   * `disparoDeEtapa: false` = no inscribe por la etapa derivada (M1-b, abajo). Lo pasa quien deja la etapa
   * definitiva después y dispara él (`setMeetingManual`: limpia el override al final). Ausente = dispara.
   */
  opts?: { disparoDeEtapa?: boolean },
): Promise<Lead> {
  const supabase = (await getTenantDb());

  // Trae el lead actual para mergear estado y validar transiciones
  const actual = await getLead(id);
  if (!actual) throw new Error(`Lead ${id} no existe`);

  // Estado fusionado: lo que viene del input gana, lo demás se mantiene
  const merged = { ...actual, ...input };

  // ───────────────────────────────────────────────────────────────────
  // El desenlace: estado_lead <-> cerro, motivo y venta (Fase 8)
  // ───────────────────────────────────────────────────────────────────
  // estado_lead es la fuente de verdad del desenlace; cerro se deriva para no
  // romper las queries de Revenue que todavía leen cerro. La regla entera vive en
  // un módulo puro con test (lib/lead-desenlace.ts) y se aplica acá UNA vez.
  //
  // ⚠️ CADA COERCIÓN SE APLICA SÓLO SI EL CALLER TOCÓ UN CAMPO QUE LA DECIDE. Antes
  // `cerro != true` vaciaba monto y fecha de cierre en CADA guardado: corregirle
  // «asistió a R1» a un lead en «Facturando» (venta cargada directo por
  // lib/pagos.ts o por el editor del deal, con `cerro` en null) le borraba la venta
  // en silencio, y lo mismo el «Deshacer» del historial. Un movimiento de etapa
  // (`setPipelineStage`) manda siempre `estado_lead`, así que ése sí la sigue
  // limpiando al pasar un Ganado a una etapa abierta. Puede tirar
  // («monto_cierre_usd debe ser positivo»), y tira ANTES de escribir nada.
  // El tipo de venta va aparte: con 'sin_cobro' (un becado) un monto 0 se guarda null.
  Object.assign(merged, desenlaceAlGuardar(actual, input, new Date().toISOString().slice(0, 10), actual.venta_tipo));

  // Aplicar reglas de coherencia
  if (!merged.fecha_junta_1) {
    merged.asistio_j1 = null;
  }
  // ⚠️ «Calificado» YA NO EXIGE UNA REUNIÓN. Antes se forzaba a null sin fecha de
  // R1 y sin `asistio_j1 === true`, así que los funnels sin reuniones no podían
  // cargarlo nunca — y es una de las dos señales que viajan a Meta. La regla (y el
  // único caso que sí lo descarta: consta que no vino) vive en un módulo puro para
  // que la ficha y el canal de MaKo no escriban su propia copia.
  if (calificadoSeDescarta(merged)) {
    merged.calificado = null;
  }

  // ───────────────────────────────────────────────────────────────────
  // Detección de transiciones para Meta CAPI
  // ───────────────────────────────────────────────────────────────────
  // La ÚNICA que sale de acá: `calificado` pasa a true (no lo era antes). Se
  // detecta ANTES del save (actual vs merged ya validado) y se dispara DESPUÉS del
  // save exitoso. CAPI nunca rompe el flujo.
  //
  // ⚠️ ANTES ERAN DOS Y LAS DOS DECÍAN MAL QUÉ ETAPA SON (05/10/2026):
  //
  //   · `calificado` disparaba **`Lead`**, que es el evento del lead CRUDO. Con eso,
  //     el embudo que Meta necesita —lead que entra, lead que califica— quedaba
  //     conflacionado en un nombre y no se podía distinguir. `Lead` se mudó al único
  //     lugar que sabe cuándo ENTRA un lead de Meta: el webhook de formularios
  //     (app/api/webhooks/meta-leads/route.ts).
  //   · `asistio_j1 && calificado` disparaba `QualifiedLead`. Era un PROXY de
  //     «califica» de cuando calificar exigía una reunión; desde que `calificado` se
  //     marca en cualquier embudo (lib/calificado-reunion.ts) la etapa es la misma, y
  //     mandar un segundo evento con el mismo nombre la contaba dos veces. La
  //     asistencia sigue moviendo la etapa del CRM; lo que ya no hace es ser una
  //     etapa aparte para Meta. Si hace falta una tercera, necesita su propio nombre
  //     y su conversión personalizada declarada (ver docs/hallazgos-ads.md).
  // ───────────────────────────────────────────────────────────────────
  const fireCalificado =
    actual.calificado !== true && merged.calificado === true;

  // Solo enviamos los campos editables (no id, created_at, updated_at)
  const payload = {
    nombre: merged.nombre,
    email: merged.email,
    telefono: merged.telefono,
    // Si el caller editó el teléfono, recalculamos su forma normalizada (llave de
    // match de webhooks Calendly/Meta). Sin esto, editar el teléfono a
    // mano dejaba la llave vieja y el próximo webhook creaba un lead duplicado.
    ...(input.telefono !== undefined ? { telefono_normalizado: normalizarTelefono(merged.telefono) } : {}),
    empresa: merged.empresa,
    fecha_agenda: merged.fecha_agenda,
    fecha_junta_1: merged.fecha_junta_1,
    fecha_junta_2: merged.fecha_junta_2,
    asistio_j1: merged.asistio_j1,
    asistio_j2: merged.asistio_j2,
    calificado: merged.calificado,
    cerro: merged.cerro,
    estado_lead: merged.estado_lead,
    motivo_perdida: merged.motivo_perdida,
    nutricion_realizada: merged.nutricion_realizada,
    monto_cierre_usd: merged.monto_cierre_usd,
    fecha_cierre: merged.fecha_cierre,
    fecha_confirmacion: merged.fecha_confirmacion,
    fecha_primer_pago: merged.fecha_primer_pago,
    monto_primer_pago: merged.monto_primer_pago,
    total_cobrado_usd: merged.total_cobrado_usd,
    fecha_inicio_servicio: merged.fecha_inicio_servicio,
  };

  const { data, error } = await supabase
    .from('leads')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`Error actualizando lead ${id}: ${error.message}`);

  // ───────────────────────────────────────────────────────────────────
  // Disparar eventos CAPI POST-save (con guardia defensiva extra)
  // ───────────────────────────────────────────────────────────────────
  if (fireCalificado) {
    // Los dos nombres de la calificación, con el MISMO event_id: el estándar para
    // que Meta pueda optimizar sin que nadie declare nada, el propio para medirlo
    // con su nombre. El id es estable por lead, así que marcar → desmarcar → marcar
    // deja de mandar dos conversiones.
    const eventId = eventIdCalificado(id);
    for (const eventName of EVENTOS_CALIFICADO) {
      try {
        const r = await sendMetaCAPIEvent({
          eventName,
          email: merged.email,
          phone: merged.telefono,
          // El identificador de más prioridad de Meta, y lo único que mueve la
          // Cobertura de leads. Un lead que no vino de un formulario no lo tiene:
          // `leadIdDeMeta` lo filtra, porque uno inválido hace que Meta rechace.
          metaLeadId: merged.meta_lead_id,
          // El hecho es ESTE cambio de etapa, no la hora de otra cosa.
          eventTime: new Date(),
          eventId,
          customData: { lead_type: 'calificado', value: 1 },
        });
        // ⚠️ Lo que Meta rechaza no puede fallar en silencio. El log de Vercel no lo
        // lee nadie y a los 60 minutos no existe: la línea va al historial de la
        // ficha, que es donde el dueño mira. Y sólo el rechazo real — que al lead le
        // falte el píxel o el token no es noticia de ESTE lead.
        if (!r.ok && (r.motivo === 'rechazado' || r.motivo === 'http' || r.motivo === 'red')) {
          await logLeadEvent(id, 'Meta', `No entró la conversión ${eventName}: ${r.detalle}`.slice(0, 300), 'MaKo');
        }
      } catch (err) {
        console.error(`[updateLead] error firing ${eventName} CAPI event:`, err);
      }
    }
  }

  // Auto-etiqueta de WhatsApp: si cambió la etapa derivada del lead, ajustamos la
  // etiqueta en el número. Sólo si hay mapeo configurado. Se ESPERA (nunca tira): lanzada con
  // `void`, la función serverless puede cortarse al responder y el pedido no sale, sin rastro.
  await actualizarEtiquetaLead(id);

  // ───────────────────────────────────────────────────────────────────
  // Las etiquetas del CRM vinculadas a una etapa (mig 0224): la etapa DERIVADA
  // ───────────────────────────────────────────────────────────────────
  // Revisión del 08/10/2026 (etiquetas-3, datos-2): cargar la fecha de la reunión, marcar la
  // asistencia o ganar desde la ficha cambia la etapa EFECTIVA del lead (`pipelineStageOf`) sin
  // escribir `pipeline_stage`, y el espejo sólo corría en los movimientos explícitos: «Agendó» no
  // se ponía nunca y la etiqueta de la etapa anterior quedaba para siempre. Acá pasan todos esos
  // caminos. Contra la etapa que SE VEÍA antes de este guardado, y sólo si cambió.
  // `setPipelineStage` manda el desenlace por acá y después espeja él mismo contra la misma etapa
  // de antes: la segunda pasada encuentra todo puesto (idempotencia) y no deja ni historial ni
  // sincronización de más. Un lote (moverLeadsDeEtapaAction) llega acá con su contexto de lote y
  // tampoco sincroniza adentro de la vuelta (lib/etiquetas.ts, `conLoteDeEtiquetas`).
  {
    const antes = pipelineStageOf(actual);
    const despues = pipelineStageOf(data as Lead);
    if (antes !== despues) await espejarEtiquetasDeEtapa(id, actual.funnel_id ?? null, antes, despues);
    // ⚠️ Y SI ENTRÓ A UNA REUNIÓN, SU AUTOMATIZACIÓN ARRANCA YA (undécima tanda, M1-b; decisión §9.5). Una reunión
    // cargada a mano cambia la etapa DERIVADA sin escribir `pipeline_stage`, y esto lo descubría sólo el barrido de
    // la hora: «Un Lead Agendó Llamada» (CRON «Agenda R1») avisaba hasta una hora tarde. Es el MISMO evento que el
    // movimiento explícito (`setBoardStageOverride`), y sólo hacia una etapa de reunión (`entraAEtapaDeReunion`: el
    // porqué, ahí). NO con un cambio de ESTADO (ganar, perder, reabrir): ése es el desenlace, y la etapa que sigue
    // la escribe quien lo cambió (`setPipelineStage`). Nunca tira.
    const cambioDeEstado = input.estado_lead !== undefined && input.estado_lead !== actual.estado_lead;
    if (opts?.disparoDeEtapa !== false && !cambioDeEstado && entraAEtapaDeReunion(antes, despues)) {
      await enrolarPorEtapaDerivada(id, despues, actual.funnel_id ?? null);
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Al GANAR: la invitación al curso, si su embudo la tiene prendida
  // ───────────────────────────────────────────────────────────────────
  // Pedido de Martín (07/10/2026): «automatizar la invitación al curso cuando un lead cae a
  // Ganado... Pero que sea opcional». Va ACÁ porque es por donde pasan todos los que ganan en
  // su casa: el tablero, el wizard, MaKo, Customer Success y la página de gracias (los tres
  // últimos vía setPipelineStage). Los dos caminos que no pasan por acá llaman lo mismo:
  // `saveLeadPlanManual` (lib/pagos.ts) y `moverEtapaEnProducto` (lib/lead-funnel.ts).
  // ⚠️ SÓLO LA TRANSICIÓN: re-guardar un ganado no es una venta nueva. Import dinámico: el
  // módulo importa a éste.
  if (pasaAGanado(actual.estado_lead, merged.estado_lead)) {
    try {
      const { alGanarInvitarAlCurso } = await import('./crm-curso-al-ganar');
      await alGanarInvitarAlCurso({ leadId: id, funnelId: actual.funnel_id == null ? null : Number(actual.funnel_id) });
    } catch (e) {
      console.error(`[updateLead] lead ${id}: el enganche al ganar falló:`, e instanceof Error ? e.message : e);
    }
  }

  return data as Lead;
}

/**
 * COMPLETA un lead que ya existe con los campos que tiene VACÍOS (#623).
 *
 * Es el tercer destino de una fila repetida en el importador, además de saltearla y de
 * duplicarla: reimportar la misma lista con una columna nueva —el teléfono que faltaba,
 * la empresa— tenía que poder sumarle ese dato a la ficha que ya está en vez de crear
 * una segunda.
 *
 * ⚠️ NO PISA NUNCA. Lo cargado gana sobre lo importado, siempre, y no es una preferencia
 * de estilo: lo que hay en la ficha lo escribió una persona o lo trajo el proveedor
 * (Calendly, Meta), y una lista en frío de 1.000 contactos es el dato MENOS fresco del
 * repo. Un campo que se pisa desde un CSV no da error, no deja rastro en ninguna
 * pantalla, y el teléfono que se perdió era la llave con la que ese lead matcheaba su
 * chat de WhatsApp.
 *
 * ⚠️ EL TELÉFONO Y SU FORMA NORMALIZADA VIAJAN JUNTOS, y por eso no se preguntan por
 * separado: `telefono_normalizado` es la llave de match de los webhooks, así que
 * escribir uno sin el otro deja el número a la vista de la persona y al lead
 * inencontrable para Calendly, Meta y el inbox. Se exige que los DOS estén vacíos.
 *
 * Devuelve los RÓTULOS de lo que llenó —vacío si no había nada que llenar—, porque el
 * llamador tiene que poder contar la diferencia: «completé 3 fichas» y «no había nada
 * que completar» son dos resultados distintos, y con un booleano se ven iguales.
 *
 * El cambio queda en el HISTORIAL del lead con su autor, como cualquier otra edición:
 * una escritura sobre una ficha que alguien viene trabajando sin una línea que diga de
 * dónde salió es exactamente la fusión en silencio que `avisarFusion` vino a cerrar.
 */
export async function enriquecerLead(
  id: number,
  datos: { nombre?: string | null; email?: string | null; telefono?: string | null; empresa?: string | null },
  autor = 'Importación',
): Promise<string[]> {
  const supabase = (await getTenantDb());
  // El estado contra el que se decide se RELEE de la base: el índice de duplicados se
  // armó antes de empezar el bucle, y entre eso y esta escritura pudo entrar un webhook.
  const actual = await getLead(id);
  if (!actual) throw new Error(`Lead ${id} no existe`);

  // QUÉ se completa lo decide `camposParaCompletar` (lib/leads-duplicados.ts, sin
  // `server-only`): la regla «lo cargado gana, solo se rellena lo vacío» es lo único
  // que se puede equivocar acá, así que vive donde un test la puede EJECUTAR. De este
  // lado queda sólo escribirla.
  const campos = camposParaCompletar(actual, datos);
  if (!campos.length) return [];

  const payload: Record<string, unknown> = {};
  for (const c of campos) {
    payload[c.columna] = c.valor;
    // La llave de match viaja con el teléfono o no viaja: un lead con el número a la
    // vista y sin `telefono_normalizado` es invisible para Calendly, Meta y el inbox.
    if (c.columna === 'telefono') payload.telefono_normalizado = normalizarTelefono(c.valor);
  }
  const llenados = campos.map((c) => c.label);

  const { data, error } = await supabase
    .from('leads')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`Error completando el lead ${id}: ${error.message}`);
  await logLeadChanges(id, actual, data as Lead, autor);
  return llenados;
}

/**
 * Borra un lead. Hard delete — no hay soft delete en el esquema actual.
 */
export async function deleteLead(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw new Error(`Error borrando lead ${id}: ${error.message}`);
}

/**
 * Normaliza un teléfono a solo dígitos (sin +, espacios, guiones, paréntesis).
 * Llave de match entre instant form (Meta) y Calendly.
 * @returns null si no quedan dígitos.
 */
export function normalizarTelefono(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, '');
  return digits || null;
}

/**
 * Upsert desde Meta Lead Ads (instant form) — hermana de upsertLeadFromCalendly.
 *
 * Match por teléfono O email: una persona puede usar un email en el instant
 * form y otro al agendar en Calendly. El teléfono del instant form está
 * verificado por SMS — es la llave más confiable.
 *
 * Reglas:
 * - Idempotente por meta_lead_id: si ya existe un lead con ese leadgen_id,
 *   es un reintento del webhook → retorna el existente sin tocar nada.
 * - Si matchea lead existente (tel O email): actualiza SOLO campos de Meta +
 *   origen_lead. Completa nombre/telefono/empresa solo si estaban vacíos.
 *   NUNCA toca campos manuales (asistio_j1, calificado, cerro, montos, cobranza).
 * - Si no existe: crea con origen_lead='instant_form'. fecha_agenda y
 *   fecha_junta_1 quedan NULL — las completa Calendly cuando agende.
 */
export async function upsertLeadFromMeta(input: {
  email: string | null;
  nombre: string;
  telefono?: string | null;
  empresa?: string | null;
  meta_lead_id: string;
  meta_ad_id?: string | null;
  meta_ad_name?: string | null;
  meta_campaign_name?: string | null;
  meta_adset_name?: string | null;
  /**
   * Los IDS de la campaña y el conjunto. Los nombres de arriba se muestran; estos
   * DECIDEN: si la campaña o el conjunto están asignados a un producto
   * (`lib/campana-funnel.ts`), el lead NUEVO nace en el tablero de ese producto.
   */
  meta_campaign_id?: string | null;
  meta_adset_id?: string | null;
  /** Las respuestas crudas del formulario. Vacío NO borra lo guardado (ver abajo). */
  meta_field_data?: MetaFieldData | null;
  /** El `created_time` de Meta: ISO de Graph o el entero en segundos del webhook. */
  meta_created_at?: string | number | null;
  /** Los `name` que el parser no reconoció. Van al historial del lead, no a una pantalla nueva. */
  meta_campos_no_reconocidos?: string[];
}): Promise<{ created: boolean; lead: Lead }> {
  if (!input.meta_lead_id) {
    throw new Error('meta_lead_id es requerido');
  }
  if (!input.nombre || !input.nombre.trim()) {
    throw new Error('Nombre es requerido en lead de Meta');
  }

  const supabase = (await getTenantDb());

  // 1) Idempotencia: ¿ya procesamos este leadgen_id? (reintento de Meta)
  const { data: porLeadId, error: leadIdErr } = await supabase
    .from('leads')
    .select('*')
    .eq('meta_lead_id', input.meta_lead_id)
    .maybeSingle();
  if (leadIdErr) throw new Error(`Error buscando por meta_lead_id: ${leadIdErr.message}`);
  if (porLeadId) {
    return { created: false, lead: porLeadId as Lead };
  }

  // 2) Normalizar señales de identidad
  const emailNorm = input.email?.trim().toLowerCase() || null;
  const telNorm = normalizarTelefono(input.telefono);

  // 3) Buscar existente por teléfono O email
  let existing: Lead | null = null;
  if (telNorm) existing = await primerLeadPorTelefono(supabase, telNorm, 'instant form de Meta', emailNorm);
  if (!existing && emailNorm) existing = await primerLeadPor(supabase, 'email', emailNorm, 'instant form de Meta');

  // Campos de Meta — siempre se escriben (es info nueva de atribución)
  //
  // ⚠️ LAS DOS COLUMNAS CRUDAS NO LLEVAN `?? null`, Y ESO ES EL MECANISMO.
  // `columnasCrudasDeMeta` devuelve la clave SÓLO si esta ingesta trae el dato, así
  // que en el UPDATE de un lead que ya existía una ingesta sin respuestas deja la
  // columna como estaba y gana lo guardado. Escritas como las cinco de arriba, una
  // ingesta posterior le BORRARÍA al lead el field_data que Meta ya no tiene: lo
  // borra a los 90 días y no se recupera de ningún lado. La condición vive en
  // lib/meta-leads-campos.ts —sin `server-only`— para que se pueda ejecutar en un test.
  const metaFields = {
    meta_lead_id: input.meta_lead_id,
    meta_ad_id: input.meta_ad_id ?? null,
    meta_ad_name: input.meta_ad_name ?? null,
    meta_campaign_name: input.meta_campaign_name ?? null,
    meta_adset_name: input.meta_adset_name ?? null,
    origen_lead: 'instant_form',
    // ⚠️ LOS DOS IDS VAN SÓLO SI VIENEN, igual que las columnas crudas de abajo y por
    // la misma razón: este objeto se escribe también en el UPDATE de un lead que ya
    // existía, y un `?? null` haría que una ingesta sin el id (una respuesta de Graph
    // incompleta) le BORRARA la campaña al lead. El conjunto va a `adset_id_origen`,
    // la columna que existe desde la 0001 y que nadie escribía (ver la mig 0193).
    ...(input.meta_campaign_id?.trim() ? { meta_campaign_id: input.meta_campaign_id.trim() } : {}),
    ...(input.meta_adset_id?.trim() ? { adset_id_origen: input.meta_adset_id.trim() } : {}),
    ...columnasCrudasDeMeta({ fieldData: input.meta_field_data, createdTime: input.meta_created_at }),
  };

  /**
   * Lo que el parser NO reconoció queda escrito en el historial del lead, que es
   * donde alguien lo lee. Las respuestas enteras ya están en `meta_field_data`; esta
   * línea es la que hace que «no llegó» y «lo tiramos nosotros» dejen de verse
   * iguales. Queda DESPUÉS de la idempotencia de arriba a propósito: un reintento de
   * Meta sobre el mismo leadgen_id no vuelve a estampar la misma línea.
   */
  const dejarRastroDeDescartes = async (leadId: number) => {
    const rastro = rastroDescartes(input.meta_campos_no_reconocidos ?? []);
    if (rastro) await logLeadEvent(leadId, CAMPO_RESPUESTAS_META, rastro, 'Meta');
  };

  // ── A QUÉ PRODUCTO VA, según la campaña o el conjunto ─────────────────────
  // Se resuelve UNA vez y lo usan las dos ramas: el INSERT para decidir el tablero, el
  // UPDATE para dejar rastro si la persona volvió por un producto distinto. Tolerante:
  // sin poder leer la asignación devuelve `asignada: false` y todo sigue como hoy.
  const porCampana = await funnelDeCampana({ campaignId: input.meta_campaign_id, adsetId: input.meta_adset_id });

  if (existing) {
    // Completar contacto solo si estaba vacío — no pisar datos existentes
    const fillIfEmpty: Record<string, string> = {};
    if (!existing.nombre?.trim() && input.nombre.trim()) {
      fillIfEmpty.nombre = input.nombre.trim();
    }
    if (!existing.email && emailNorm) fillIfEmpty.email = emailNorm;
    if (!existing.telefono && input.telefono?.trim()) {
      fillIfEmpty.telefono = input.telefono.trim();
    }
    if (!existing.empresa && input.empresa?.trim()) {
      fillIfEmpty.empresa = input.empresa.trim();
    }
    if (!existing.telefono_normalizado && telNorm) {
      fillIfEmpty.telefono_normalizado = telNorm;
    }

    const { data, error } = await supabase
      .from('leads')
      .update({ ...metaFields, ...fillIfEmpty })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(`Error actualizando lead ${existing.id} desde Meta: ${error.message}`);
    await avisarFusion('Meta', data as Lead, existing.email ? 'mismo email' : 'mismo teléfono');
    await dejarRastroDeDescartes(existing.id);
    // ⚠️ LA PERSONA VOLVIÓ POR UNA CAMPAÑA DE OTRO PRODUCTO: NO SE LA MUEVE. Sacarla del
    // tablero donde la están trabajando —con su etapa, su closer, quizás ya Ganada—
    // porque vio otro anuncio es destructivo y nadie lo pidió. Pero que pasó es un
    // DATO, y sin esta línea se pierde: el lead quedaría con la campaña nueva escrita
    // arriba y ninguna pista de que esa campaña es de otro producto.
    const funnelActual = existing.funnel_id ?? null;
    if (porCampana.asignada && porCampana.funnelId !== funnelActual) {
      await logLeadEvent(
        existing.id,
        'Funnel',
        `Volvió a entrar por «${porCampana.nombre}», que es de ${porCampana.producto}. Sigue en su tablero.`,
        'Meta',
      ).catch(() => { /* el rastro no puede tumbar la ingesta */ });
    }
    return { created: false, lead: data as Lead };
  }

  // INSERT nuevo — fechas de agenda/J1 NULL (las pone Calendly al agendar)
  const soloMeta = await vendedorUnicoDelWorkspace(); // #2: auto-asignar si hay 1 vendedor
  const { data, error } = await supabase
    .from('leads')
    .insert({
      nombre: input.nombre.trim(),
      email: emailNorm,
      telefono: input.telefono?.trim() || null,
      empresa: input.empresa?.trim() || null,
      telefono_normalizado: telNorm,
      ...(soloMeta ? { setter: soloMeta, closer: soloMeta } : {}),
      ...metaFields,
      // Sólo con un embudo CONCRETO: el del negocio es `null`, que es lo que la fila ya
      // tiene sin escribir nada. Ver `lib/campana-funnel.ts`.
      ...(porCampana.asignada && porCampana.funnelId != null ? { funnel_id: porCampana.funnelId } : {}),
    })
    .select('*')
    .single();
  if (error) throw new Error(`Error creando lead desde Meta: ${error.message}`);
  await dejarRastroDeDescartes((data as Lead).id);
  return { created: true, lead: data as Lead };
}

/**
 * Busca un lead por teléfono normalizado O email — misma lógica de match que
 * upsertLeadFromMeta. Usado por el ruteo de J2 y las cancelaciones (Fase 10).
 */
export async function findLeadByContacto(
  email: string | null,
  telefono: string | null,
): Promise<Lead | null> {
  const supabase = (await getTenantDb());
  const telNorm = normalizarTelefono(telefono);
  if (telNorm) {
    const porTel = await primerLeadPorTelefono(supabase, telNorm, 'findLeadByContacto', email);
    if (porTel) return porTel;
  }
  const emailNorm = email?.trim().toLowerCase();
  if (emailNorm) {
    const porEmail = await primerLeadPor(supabase, 'email', emailNorm, 'findLeadByContacto');
    if (porEmail) return porEmail;
  }
  return null;
}

/**
 * Setea SOLO fecha_junta_2 en un lead (J2 entrante de Calendly, Fase 10).
 * No toca otros campos, salvo uno: si la R2 estaba marcada «no asistió» y esta reserva es OTRA
 * reunión, la marca vuelve a null y el no-show queda en el historial (`limpiaNoShow`,
 * lib/reagenda-no-show.ts; decisión de Martín del 06/10/2026). Si la lectura previa falla no se
 * limpia nada: «no pude leer» no autoriza a borrar una marca.
 */
export async function setFechaJunta2(
  leadId: number,
  fechaJ2: string,
  juntaAtIso?: string | null,
  canal: string = 'Calendly',
): Promise<void> {
  const supabase = (await getTenantDb());
  const { data: antes } = await supabase
    .from('leads')
    .select('fecha_junta_2, junta_2_at, asistio_j2')
    .eq('id', leadId)
    .maybeSingle();
  const fila = antes as { fecha_junta_2: string | null; junta_2_at: string | null; asistio_j2: boolean | null } | null;
  const limpia = !!fila && limpiaNoShow(
    { asistio: fila.asistio_j2, fecha: fila.fecha_junta_2, at: fila.junta_2_at },
    { fecha: fechaJ2, at: juntaAtIso },
  );
  // El no-show se anota ANTES del update: hay un solo par de campos por reunión, y si no queda acá
  // el hecho de que faltó desaparece (lo mismo que `reagendarReunionAction` en el CRM).
  if (limpia) await logLeadEvent(leadId, 'Reunión 2 — no asistió', textoNoShow(fila!.fecha_junta_2, canal), canal).catch(() => {});
  const { error } = await supabase
    .from('leads')
    .update({
      fecha_junta_2: fechaJ2,
      ...(juntaAtIso ? { junta_2_at: juntaAtIso } : {}),
      ...(limpia ? { asistio_j2: null } : {}),
    })
    .eq('id', leadId);
  if (error) throw new Error(`Error seteando fecha_junta_2 en lead ${leadId}: ${error.message}`);
}

/**
 * Marca una reunión (R1/R2) a mano, SIN Calendly — para casos viejos donde la
 * reunión ya ocurrió. Setea la fecha (+ asistencia si se sabe) y limpia el
 * override de etapa para que el lead avance por derivación (p.ej. R2 asistida → Facturando).
 */
export async function setMeetingManual(leadId: number, which: 'agenda' | 'agendaj2', fecha: string, asistio: boolean | null): Promise<void> {
  // La fecha + asistencia pasan por updateLead para respetar invariantes y
  // disparar Meta CAPI (Lead/QualifiedLead) igual que cualquier edición humana.
  // Antes era un UPDATE directo que bypaseaba el CAPI.
  const input: LeadUpdateInput = {};
  if (which === 'agenda') { input.fecha_junta_1 = fecha; if (asistio != null) input.asistio_j1 = asistio; }
  else { input.fecha_junta_2 = fecha; if (asistio != null) input.asistio_j2 = asistio; }
  // Esta función solo se invoca desde flujos de MOVIMIENTO (Kanban/worklist):
  // si el lead estaba en un desenlace terminal (p.ej. Ganado) hay que REABRIRLO,
  // si no la derivación lo devuelve a la columna terminal y el movimiento "no
  // hace nada" (bug: Ganado → R2 no cambiaba el status).
  const actual = await getLead(leadId);
  if (actual && actual.estado_lead !== 'abierto') input.estado_lead = 'abierto';
  // El disparo de la etapa DERIVADA va al final (M1-b), cuando el override ya se limpió: la etapa de la mitad no
  // es la que queda.
  await updateLead(leadId, input, { disparoDeEtapa: false });
  // Limpiar el override para que el lead avance por derivación (p.ej. R2 asistida
  // → Facturando). No lo toca updateLead (pipeline_stage no es campo editable ahí).
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('leads').update({ pipeline_stage: null }).eq('id', leadId);
  if (error) throw new Error(`Error limpiando override del lead ${leadId}: ${error.message}`);
  // «Agendada fuera de Calendly» desde el Kanban: si quedó en una reunión, su automatización arranca ya (M1-b).
  const despues = await getLead(leadId).catch(() => null);
  if (actual && despues && entraAEtapaDeReunion(pipelineStageOf(actual), pipelineStageOf(despues))) {
    await enrolarPorEtapaDerivada(leadId, pipelineStageOf(despues), despues.funnel_id ?? null);
  }
}

/**
 * Aplica una grabación de Fathom a un lead: marca asistencia a R1/R2 (solo si
 * estaba sin marcar — nunca pisa una decisión humana) y agrega el link de la
 * grabación a fathom_links. `attended` puede venir confirmado por el transcript
 * (true/false) o desconocido (null → asumimos que asistió, porque hubo grabación
 * con el invitado externo presente).
 *
 * `opts.marcarAsistencia: false` engancha SOLO el link y deja la asistencia como
 * estaba. Es para los enganches que no prueban que la persona estuvo —hoy, el match
 * por NOMBRE de lib/fathom-auto.ts—: ahí el link es una pista para que alguien la
 * confirme en un click, y afirmar la asistencia sería inferirla. No alcanzaba con
 * pasar `attended: null`, porque null significa «no sé, hubo grabación» y cae en
 * `?? true`: son dos preguntas distintas y necesitan dos campos.
 *
 * ⚠️ EL ESTADO CONTRA EL QUE SE DECIDE SE RELEE DE LA BASE, NO SALE DEL `lead` QUE
 * LLEGÓ. `fathom_links` se escribe como el array COMPLETO, así que armarlo desde un
 * objeto leído hace rato BORRA lo que entró en el medio. Pasaba con las dos
 * grabaciones del mismo lead: lib/fathom-auto.ts lee los leads una vez, recorre
 * ['j1','j2'] y pasa el MISMO objeto las dos veces, así que la vuelta de la R2
 * reescribía la lista entera y el link de la R1 desaparecía — con el contador
 * informando «adjuntados: 2» igual, que es lo que lo hizo invisible. Se dispara
 * cuando las dos reuniones caen en la misma corrida sin ningún link cargado (el
 * botón de admin con ventana de 30 días, o la corrida throttleada del cron).
 *
 * La relectura va acá y no en el bucle del caller a propósito: es el CHOKE POINT por
 * donde pasan los tres caminos que enganchan una grabación (el webhook de Fathom, el
 * CRM automático y el barrido de fathom-auto), así que el que se escriba mañana lo
 * hereda sin que nadie se acuerde. Lo que esto NO cubre es que dos procesos escriban
 * el mismo lead a la vez: sigue siendo leer-modificar-escribir, y para cerrarlo haría
 * falta un append del lado de Postgres.
 */
export async function applyFathomRecording(
  lead: Lead,
  which: 'j1' | 'j2',
  shareUrl: string | null,
  attended: boolean | null,
  opts?: { marcarAsistencia?: boolean },
): Promise<{ markedAsistencia: boolean; addedLink: boolean }> {
  const supabase = (await getTenantDb());
  const asistField = which === 'j1' ? 'asistio_j1' : 'asistio_j2';

  // `id` SÍ es único, así que acá `.maybeSingle()` es correcto (ver `primerLeadPor`).
  const { data: fresco, error: errFresco } = await supabase
    .from('leads')
    .select('fathom_links, asistio_j1, asistio_j2')
    .eq('id', lead.id)
    .maybeSingle();
  if (errFresco) throw new Error(`Error releyendo el lead ${lead.id} para aplicar la grabación: ${errFresco.message}`);
  // Sin fila no se inventa nada: queda el `lead` que llegó y `updateLead` falla con
  // «no existe», que es el mismo final que antes de esta relectura.
  const antes = (fresco ? { ...lead, ...(fresco as Partial<Lead>) } : lead) as Lead;

  const yaMarcado = which === 'j1' ? antes.asistio_j1 : antes.asistio_j2;
  const asistValue = attended ?? true;

  const markedAsistencia = (opts?.marcarAsistencia ?? true) && yaMarcado == null;

  let addedLink = false;
  let newLinks: FathomLink[] | null = null;
  if (shareUrl) {
    const links = antes.fathom_links ?? [];
    if (!links.some((l) => l.url === shareUrl)) {
      newLinks = [...links, { label: which === 'j1' ? 'Reunión 1' : 'Reunión 2', url: shareUrl }];
      addedLink = true;
    }
  }

  if (!markedAsistencia && !addedLink) return { markedAsistencia: false, addedLink: false };

  // La asistencia pasa por updateLead → dispara Meta CAPI QualifiedLead si el lead
  // ya estaba calificado (antes el UPDATE directo bypaseaba el CAPI). Los links no
  // son campo de updateLead, así que van por update directo.
  if (markedAsistencia) {
    await updateLead(lead.id, which === 'j1' ? { asistio_j1: asistValue } : { asistio_j2: asistValue });
  }
  if (newLinks) {
    const { error } = await supabase.from('leads').update({ fathom_links: newLinks }).eq('id', lead.id);
    if (error) throw new Error(`Error aplicando grabación Fathom a lead ${lead.id}: ${error.message}`);
  }
  // ── EL ANÁLISIS DE ESA LLAMADA, ENGANCHADO A ESTE LEAD ────────────────────
  // Acá pasan los TRES caminos que enganchan una grabación (el webhook de Fathom,
  // el barrido de fathom-auto y el link que alguien pega a mano en la ficha), así
  // que el disparo va acá y no en cada uno: puesto en los tres, el cuarto que se
  // escriba mañana nace sin esto.
  //
  // Lo que se hace es la mitad GRATIS: el Closing Analyst le pone `lead_id` a su
  // fila sólo cuando el email del invitado matchea un lead, así que una grabación
  // matcheada por NOMBRE o pegada a mano queda analizada y nunca llega a la ficha.
  // Enlazarla es un SELECT por `embed_token` y un UPDATE.
  //
  // ⚠️ LO QUE CUESTA PLATA NO VA ACÁ. Analizar una grabación nueva es una llamada
  // al modelo de 90-120 s, y este camino lo dispara también el render del CRM con
  // un `void` (lib/fathom-auto.ts): ahí la plataforma mata la función y el análisis
  // se paga y se pierde. Eso vive en el cron, que es el único con presupuesto
  // (lib/insights-llamada.ts → drenarInsightsDeLlamada).
  if (addedLink && shareUrl) {
    const { enlazado, motivo } = await enlazarAnalisisDeGrabacion(lead.id, shareUrl, { nombre: antes.nombre, empresa: antes.empresa });
    console.log(`[fathom] lead ${lead.id}: insights de la llamada — ${enlazado ? 'enlazados' : `sin enlazar (${motivo})`}`);
  }

  const after = { ...antes, ...(markedAsistencia ? { [asistField]: asistValue } : {}), ...(newLinks ? { fathom_links: newLinks } : {}) } as Lead;
  // El diff va contra lo RELEÍDO: con el objeto viejo el historial estampaba cambios
  // que no pasaron (una lista de links «vacía → dos» sobre un lead que ya tenía uno).
  await logLeadChanges(lead.id, antes, after, 'Fathom');
  return { markedAsistencia, addedLink };
}

// ── Audit log (historial real de cambios por lead) ──────────────────────────
export type LeadAuditRow = {
  id: number; campo: string; valor_anterior: string | null; valor_nuevo: string | null; autor: string; created_at: string;
  /** El adjunto de una NOTA (mig 0267). La ruta del bucket NO viaja: se abre por el id de la nota. */
  archivo_nombre?: string | null; archivo_mime?: string | null; archivo_bytes?: number | null;
};

// OJO: 'pipeline_stage' NO está en esta lista. La etapa se audita aparte (campo
// 'Etapa', ver más abajo) porque lo que le importa al usuario es la etapa
// EFECTIVA — el override si lo hay, y si no la derivada. Diffear la columna
// cruda registraba "— → ganado" cuando el lead venía de "agenda", y no registraba
// NADA cuando la etapa cambiaba por derivación (el caso del lead 1395).
const AUDIT_FIELDS: Array<{ k: keyof Lead; label: string }> = [
  { k: 'nombre', label: 'Nombre' },
  { k: 'email', label: 'Email' },
  { k: 'telefono', label: 'Teléfono' },
  { k: 'empresa', label: 'Empresa' },
  { k: 'web', label: 'Web' },
  // Los dos de la mig 0258 (12/10/2026). Revertibles: app/crm/actions.ts, REVERTIBLES y los
  // dos switch de revertir.
  { k: 'ingreso_estimado', label: 'Ingreso estimado' },
  { k: 'instagram', label: 'Instagram' },
  // Los del Resumen personalizable (mig 0274). Revertibles por los mismos dos switch.
  { k: 'youtube', label: 'YouTube' },
  { k: 'linkedin', label: 'LinkedIn' },
  { k: 'direccion', label: 'Dirección' },
  { k: 'sexo', label: 'Sexo' },
  { k: 'estado_lead', label: 'Estado' },
  { k: 'fecha_agenda', label: 'Fecha de agendamiento' },
  { k: 'asistio_j1', label: 'Asistió R1' },
  { k: 'asistio_j2', label: 'Asistió R2' },
  { k: 'calificado', label: 'Calificado' },
  { k: 'fecha_junta_1', label: 'Fecha R1' },
  { k: 'fecha_junta_2', label: 'Fecha R2' },
  { k: 'closer', label: 'Closer' },
  { k: 'setter', label: 'Setter' },
  { k: 'monto_cierre_usd', label: 'Monto de cierre' },
  // ⚠️ La plata de una SUSCRIPCIÓN vive en estas dos, no en el monto de cierre (que queda
  // NULL a propósito). Faltaban (08/10/2026): cargar o corregir una mensualidad no dejaba
  // NINGUNA línea, y la última del historial de plata seguía diciendo «Datos pendientes: …
  // Monto de cierre» con el monto ya guardado. Las dos son revertibles (app/crm/actions.ts,
  // REVERTIBLES y los dos switch de revertir).
  //
  // `venta_tipo` NO entra, a sabiendas: pasar a/desde «sin cobro» ya escribe su propio
  // evento («Tipo de venta», completeStageMoveAction y quitarSinCobroAction) y acá saldría
  // DOS veces; y pasar de pago único a suscripción ya se lee en estas líneas («Suscripción
  // (USD/mes): — → 444», y el monto de cierre que se va). Lo único que queda mudo es
  // cambiar el tipo sin ningún importe cargado.
  { k: 'suscripcion_monto_usd', label: 'Suscripción (USD/mes)' },
  { k: 'suscripcion_meses', label: 'Plazo de la suscripción' },
  { k: 'motivo_perdida', label: 'Motivo' },
  { k: 'fecha_confirmacion', label: 'Confirmación de pago' },
  { k: 'nutricion_manual_deadline', label: 'Deadline de nutrición manual' },
  { k: 'fathom_links', label: 'Links de Fathom' },
];

function auditVal(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (Array.isArray(v)) return v.length ? `${v.length} link(s)` : null;
  return String(v);
}

// Ventana del anti-duplicado. Un mismo movimiento pasa hoy por DOS capas que
// auditan (setPipelineStage escribe su diff y el caller vuelve a llamar a
// logLeadChanges con un `before` anterior a todo), así que la misma línea llega
// dos veces con milisegundos de diferencia. 60s cubre de sobra un request y es
// demasiado corto para tapar un cambio real repetido a mano.
const DEDUP_MS = 60_000;

/**
 * Inserta en lead_audit una fila por cada campo trackeado que cambió. No rompe la
 * mutación si falla.
 *
 * Dos cosas que no son obvias:
 *  · La ETAPA se calcula, no se diffea: se compara la etapa efectiva (override o
 *    derivada) contra `etapa_vista`, la última que el historial dio por
 *    registrada. Así la línea sale una sola vez aunque la escritura pase por dos
 *    capas, y sale con el valor anterior REAL en vez de un "—".
 *  · Todas las filas entran en UN insert para que compartan created_at: la ficha
 *    agrupa por instante para mostrar (y revertir) un movimiento completo —
 *    Etapa + Estado + Monto juntos. Partirlo rompe el "Deshacer".
 */
export async function logLeadChanges(leadId: number, before: Lead | null, after: Lead | null, autor: string): Promise<void> {
  if (!before || !after) return;
  const rows = AUDIT_FIELDS.flatMap(({ k, label }) => {
    const a = auditVal(before[k]);
    const b = auditVal(after[k]);
    return a === b ? [] : [{ lead_id: leadId, campo: label, valor_anterior: a, valor_nuevo: b, autor }];
  });
  if (!rows.length && !cambioDeEtapa(after, pipelineStageOf(before))) return;
  try {
    const db = await getTenantDb();
    // La etapa NO pasa por el anti-duplicado por ventana: ya tiene el suyo, exacto
    // (etapa_vista). Si pasara, un lead movido A→B→A→B en el mismo minuto perdería
    // la tercera línea por parecerse a la primera.
    const nuevas = await sinRepetidas(db, leadId, rows);
    // `after` viene de getLead (select *), así que trae la etapa_vista que ya
    // escribió una capa anterior de esta misma mutación; si no la trae (lead
    // armado a mano, o migración 0122 sin aplicar), cae a la etapa del `before`.
    const etapa = cambioDeEtapa(after, pipelineStageOf(before));
    if (etapa) nuevas.push({ lead_id: leadId, campo: CAMPO_ETAPA, valor_anterior: etapa.desde, valor_nuevo: etapa.hacia, autor });
    if (!nuevas.length) return;
    const { error } = await db.from('lead_audit').insert(nuevas);
    if (error) { console.error(`[audit] insert falló: ${error.message}`); return; }
    // La columna se mueve DESPUÉS de la línea: si esto falla, el peor caso es que
    // la pasada de los pendientes vuelva a detectar el cambio (una línea de más),
    // no que el cambio se pierda.
    if (etapa) await marcarEtapaVista([leadId], etapa.hacia);
  } catch (e) {
    console.error('[audit] insert excepción', e);
  }
}

type FilaAudit = { lead_id: number; campo: string; valor_anterior: string | null; valor_nuevo: string | null; autor: string };

/** Descarta las filas idénticas a una ya escrita hace segundos (mismo movimiento auditado dos veces). */
async function sinRepetidas(db: Awaited<ReturnType<typeof getTenantDb>>, leadId: number, rows: FilaAudit[]): Promise<FilaAudit[]> {
  if (!rows.length) return rows;
  const clave = (r: { campo: string; valor_anterior: string | null; valor_nuevo: string | null }) =>
    `${r.campo}|${r.valor_anterior ?? ''}|${r.valor_nuevo ?? ''}`;
  try {
    const { data, error } = await db
      .from('lead_audit')
      .select('campo, valor_anterior, valor_nuevo')
      .eq('lead_id', leadId)
      .gte('created_at', new Date(Date.now() - DEDUP_MS).toISOString());
    if (error) return rows; // ante la duda, mejor una línea de más que perder el rastro
    const ya = new Set((data ?? []).map((r) => clave(r as FilaAudit)));
    return rows.filter((r) => !ya.has(clave(r)));
  } catch {
    return rows;
  }
}

/** Registra un evento suelto en el historial (ej. el motivo de una nutrición manual). */
export async function logLeadEvent(leadId: number, campo: string, valor: string, autor = 'CRM'): Promise<void> {
  try {
    const { error } = await (await getTenantDb()).from('lead_audit').insert([{ lead_id: leadId, campo, valor_anterior: null, valor_nuevo: valor, autor }]);
    if (error) console.error(`[audit] event falló: ${error.message}`);
  } catch (e) {
    console.error('[audit] event excepción', e);
  }
}

/** Historial de cambios de un lead (más reciente primero). Vacío si la tabla no existe. */
export async function getLeadAudit(leadId: number): Promise<LeadAuditRow[]> {
  try {
    const { data, error } = await (await getTenantDb())
      .from('lead_audit')
      .select('id, campo, valor_anterior, valor_nuevo, autor, created_at, archivo_nombre, archivo_mime, archivo_bytes')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return [];
    return (data ?? []) as LeadAuditRow[];
  } catch {
    return [];
  }
}

/**
 * Aplica una cancelación de Calendly al lead (Fase 10).
 * - Si la fecha cancelada es la fecha_junta_2 y NO pasó → fecha_junta_2 = NULL.
 * - Si es la fecha_junta_1 y NO pasó → fecha_junta_1 = NULL (fecha_agenda se
 *   conserva: es el ancla histórica de cuándo agendó).
 * - Si la junta ya pasó (o no matchea ninguna fecha) → no toca nada.
 * Un reagendamiento llega como canceled + created, así que la fecha nueva la
 * vuelve a llenar el created.
 *
 * ⚠️ PERO EL ORDEN NO ESTÁ GARANTIZADO, y por eso `inicioCancelado`: con la reserva nueva
 * llegada primero y la reagenda en el MISMO día, comparar sólo la fecha borraba la reunión
 * nueva (el porqué y la decisión, en `juntaACancelar`, lib/recordatorio-lead.ts, con test).
 * Y el UPDATE exige en su WHERE la fecha (y la hora, si se conoce) que se acaba de comparar:
 * si la reserva nueva escribió entre la lectura del lead y esto, no se toca nada.
 * `junta_X_at` NO se escribe (corrección del refutador del #17: en null, la regla T1 del CRM
 * propone No Show sobre la reunión cancelada).
 * @returns descripción de lo que cambió, para el log.
 */
export async function cancelarJuntaEnLead(
  lead: Lead,
  fechaCancelada: string,
  hoy: string,
  inicioCancelado?: string | null,
): Promise<string> {
  const d = juntaACancelar(lead, fechaCancelada, hoy, inicioCancelado);
  if ('motivo' in d) return d.motivo;
  const campo = d.cual === 'R2' ? 'fecha_junta_2' : 'fecha_junta_1';
  const campoHora = d.cual === 'R2' ? 'junta_2_at' : 'junta_1_at';

  const supabase = (await getTenantDb());
  let q = supabase
    .from('leads')
    .update({ [campo]: null })
    .eq('id', lead.id)
    .eq(campo, fechaCancelada);
  if (d.inicio) q = q.eq(campoHora, d.inicio);
  const { data, error } = await q.select('id');
  if (error) throw new Error(`Error cancelando ${campo} en lead ${lead.id}: ${error.message}`);
  if (!data?.length) return `${campo}: la reunión cambió entre medio (reagenda) — sin cambios`;
  return `${campo} = NULL (cancelación de reunión futura)`;
}

/**
 * Guarda (o borra, con `url: null`) el link para ENTRAR a la R1/R2 (mig 0204). Lo usa el
 * recordatorio al lead (lib/reunion-recordatorio.ts) para mandar el link de la reunión.
 *
 * ⚠️ ES UN UPDATE APARTE Y NUNCA TIRA, a propósito. PostgREST rechaza el update ENTERO si una
 * columna no existe: metido en el payload de `upsertLeadFromCalendly`, un deploy que llegue antes
 * que la migración haría que NINGUNA reserva entre al CRM, para guardar un link. Separado, lo peor
 * que pasa sin la migración es que el recordatorio salga sin link.
 *
 * Y se escribe SIEMPRE que entra una reserva, también en null: una reserva nueva sin link (una
 * llamada por teléfono) no puede heredar el link de la reunión anterior de ese lead.
 *
 * `soloSiInicio` (la cancelación): borra el link sólo si la reunión de la fila SIGUE siendo la
 * cancelada. Si la reserva nueva de una reagenda escribió su hora y su link a la vez que esto,
 * el WHERE no calza y el link nuevo se queda.
 */
export async function guardarLinkDeReunion(
  leadId: number,
  cual: 'R1' | 'R2',
  url: string | null,
  opts: { soloSiInicio?: string | null } = {},
): Promise<boolean> {
  try {
    const col = cual === 'R2' ? 'junta_2_url' : 'junta_1_url';
    let q = (await getTenantDb()).from('leads').update({ [col]: url }).eq('id', leadId);
    if (opts.soloSiInicio) q = q.eq(cual === 'R2' ? 'junta_2_at' : 'junta_1_at', opts.soloSiInicio);
    const { error } = await q;
    if (error) {
      console.error(`[leads] no pude guardar el link de la ${cual} del lead ${leadId}: ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[leads] no pude guardar el link de la ${cual} del lead ${leadId}: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

/**
 * Upsert por teléfono O email — usado por el webhook de Calendly.
 *
 * - Match (4B-bis): busca primero por telefono_normalizado, después por
 *   email. Así un lead que entró por instant form (teléfono verificado por
 *   SMS) se completa con su fecha de J1 cuando agenda en Calendly, aunque
 *   use un email distinto.
 * - Si existe: actualiza SOLO los campos que vienen de Calendly (nombre,
 *   email, fechas, empresa, telefono). NUNCA toca los campos manuales
 *   (asistio_j1, calificado, cerro, monto, fecha_cierre) ni los meta_*.
 * - UTMs y respuestas en UPDATE: solo sobrescribe si viene con valor.
 * - Si no existe: crea uno nuevo con el `origen_lead` que le pasen (default 'calendly').
 *
 * @returns { created: true } si fue insert, { created: false } si fue update.
 */
export async function upsertLeadFromCalendly(
  input: {
    email: string;
    nombre: string;
    fecha_agenda: string;
    fecha_junta_1: string;
    junta_1_at?: string | null;         // ISO con hora del start_time de Calendly
    empresa?: string | null;
    telefono?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    fbclid?: string | null;
    respuesta_facturacion?: string | null;
    respuesta_colaboradores?: string | null;
    respuesta_objetivo?: string | null;
    respuesta_cuando_empezar?: string | null;
    respuesta_inversion?: string | null;
    respuesta_decisor?: string | null;
    visitor_id?: string | null;
    /**
     * De qué agenda vino. Default 'calendly' porque es quien llamaba a esto hasta
     * hoy, y cambiarlo sin avisar re-etiquetaría leads históricos.
     *
     * ⚠️ NO ES COSMÉTICO. El 24/08/2026 la primera reserva que entró por Cal.com
     * quedó guardada como `origen_lead: 'calendly'`: la ficha del lead decía
     * «Calendly» y el reporte de origen le atribuía la venta a una herramienta que
     * ese cliente no usa. Un origen inventado no se nota nunca y no se puede
     * corregir después, porque nada distingue las filas mal etiquetadas.
     */
    origen_lead?: string;
  },
  opts?: {
    // Backfill histórico (Fase 2-bis): backdatea created_at del lead SOLO
    // al crearlo, para que la fila refleje cuándo agendó realmente.
    fechaCreacion?: string;
    // Backfill histórico: en UPDATE solo completa campos vacíos del lead
    // existente — NUNCA pisa datos ya cargados (fechas más recientes,
    // empresa puesta a mano, etc.). El webhook en vivo usa false (default):
    // refresca fechas porque Calendly es la fuente fresca.
    soloCompletarVacios?: boolean;
  },
): Promise<{ created: boolean; lead: Lead }> {
  if (!input.email || !input.email.includes('@')) {
    throw new Error('Email inválido en payload de Calendly');
  }
  const emailNorm = input.email.trim().toLowerCase();
  const telNorm = normalizarTelefono(input.telefono);
  const soloVacios = opts?.soloCompletarVacios ?? false;

  const supabase = (await getTenantDb());

  // Match 4B-bis: primero por teléfono normalizado (la señal más confiable
  // — la comparte con el instant form de Meta), después por email.
  let existing: Lead | null = null;
  if (telNorm) existing = await primerLeadPorTelefono(supabase, telNorm, 'webhook de Calendly', emailNorm);
  if (!existing) existing = await primerLeadPor(supabase, 'email', emailNorm, 'webhook de Calendly');

  // Base de payload — campos de contacto / agenda.
  const basePayload = {
    nombre: input.nombre.trim(),
    email: emailNorm,
    fecha_agenda: input.fecha_agenda,
    fecha_junta_1: input.fecha_junta_1,
    ...(input.junta_1_at ? { junta_1_at: input.junta_1_at } : {}),
    empresa: input.empresa?.trim() || null,
    telefono: input.telefono?.trim() || null,
    ...(telNorm ? { telefono_normalizado: telNorm } : {}),
  };

  if (existing) {
    let updatePayload: Record<string, unknown>;

    if (soloVacios) {
      // BACKFILL: solo rellena lo que está vacío en el lead existente.
      // Nunca pisa fechas, empresa, ni atribución ya cargada.
      updatePayload = {};
      const setIfEmpty = (campo: keyof Lead, valor: string | null | undefined) => {
        const actual = existing![campo];
        if ((actual === null || actual === undefined || actual === '') && valor) {
          updatePayload[campo] = valor;
        }
      };
      setIfEmpty('email', emailNorm);
      setIfEmpty('telefono', input.telefono?.trim() || null);
      setIfEmpty('telefono_normalizado', telNorm);
      setIfEmpty('empresa', input.empresa?.trim() || null);
      setIfEmpty('fecha_agenda', input.fecha_agenda);
      setIfEmpty('fecha_junta_1', input.fecha_junta_1);
      setIfEmpty('junta_1_at', input.junta_1_at);
      setIfEmpty('utm_source', input.utm_source);
      setIfEmpty('utm_medium', input.utm_medium);
      setIfEmpty('utm_campaign', input.utm_campaign);
      setIfEmpty('utm_content', input.utm_content);
      setIfEmpty('fbclid', input.fbclid);
      setIfEmpty('respuesta_facturacion', input.respuesta_facturacion);
      setIfEmpty('respuesta_colaboradores', input.respuesta_colaboradores);
      setIfEmpty('respuesta_objetivo', input.respuesta_objetivo);
      setIfEmpty('respuesta_cuando_empezar', input.respuesta_cuando_empezar);
      setIfEmpty('respuesta_inversion', input.respuesta_inversion);
      setIfEmpty('respuesta_decisor', input.respuesta_decisor);
      setIfEmpty('visitor_id', input.visitor_id);

      // Nada que completar → no escribir
      if (Object.keys(updatePayload).length === 0) {
        return { created: false, lead: existing };
      }
    } else {
      // WEBHOOK EN VIVO: refresca contacto/agenda; UTMs y respuestas solo
      // si vienen con valor (no borrar lo que ya estaba).
      const extraUpdates: Record<string, string> = {};
      if (input.utm_source)               extraUpdates.utm_source               = input.utm_source;
      if (input.utm_medium)               extraUpdates.utm_medium               = input.utm_medium;
      if (input.utm_campaign)             extraUpdates.utm_campaign             = input.utm_campaign;
      if (input.utm_content)              extraUpdates.utm_content              = input.utm_content;
      if (input.fbclid)                   extraUpdates.fbclid                   = input.fbclid;
      if (input.respuesta_facturacion)    extraUpdates.respuesta_facturacion    = input.respuesta_facturacion;
      if (input.respuesta_colaboradores)  extraUpdates.respuesta_colaboradores  = input.respuesta_colaboradores;
      if (input.respuesta_objetivo)       extraUpdates.respuesta_objetivo       = input.respuesta_objetivo;
      if (input.respuesta_cuando_empezar) extraUpdates.respuesta_cuando_empezar = input.respuesta_cuando_empezar;
      if (input.respuesta_inversion)      extraUpdates.respuesta_inversion      = input.respuesta_inversion;
      if (input.respuesta_decisor)        extraUpdates.respuesta_decisor        = input.respuesta_decisor;
      if (input.visitor_id)               extraUpdates.visitor_id               = input.visitor_id;
      updatePayload = { ...basePayload, ...extraUpdates };
      // ⚠️ UNA REUNIÓN NUEVA LIMPIA LA MARCA DE «NO ASISTIÓ» (decisión de Martín, 06/10/2026). Sólo
      // acá, en el webhook en vivo: el backfill (`soloVacios`) no reagenda a nadie. El no-show se
      // anota ANTES del update, como en el «reagendar» del CRM (lib/reagenda-no-show.ts).
      if (limpiaNoShow(
        { asistio: existing.asistio_j1, fecha: existing.fecha_junta_1, at: existing.junta_1_at },
        { fecha: input.fecha_junta_1, at: input.junta_1_at },
      )) {
        const canal = input.origen_lead === 'calcom' ? 'Cal.com' : 'Calendly';
        await logLeadEvent(existing.id, 'Reunión 1 — no asistió', textoNoShow(existing.fecha_junta_1, canal), canal).catch(() => {});
        updatePayload.asistio_j1 = null;
      }
      // ⚠️ RESERVAR LIMPIA LA ETAPA DE «NO AGENDÓ» PUESTA A MANO (undécima tanda, M6; decisión §9.4). La regla T2
      // del CRM deja en `nutri` (a mano) a quien no agendó en 2 días, y después en `reactivacion`; si después reserva,
      // `pipelineStageOf` seguía devolviendo esa etapa y «Un Lead Agendó Llamada» (CRON «Agenda R1») no lo veía:
      // ni el aviso, ni la preparación, ni los recordatorios (4 de 54 leads del ws1 en 90 días). Sólo si sin el
      // override quedaría en «Agenda R1» (`limpiaEtapaAlReservar`); lo audita abajo, y la inscripción la dispara el
      // webhook con el evento de la reserva (M1).
      const derivadaDespues = deriveStageKey({ ...existing, ...(updatePayload as Partial<StageDerivable>), pipeline_stage: null });
      if (limpiaEtapaAlReservar(existing.pipeline_stage ?? null, derivadaDespues)) updatePayload.pipeline_stage = null;
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(`Error actualizando lead ${existing.id}: ${error.message}`);
    await avisarFusion(input.origen_lead === 'calcom' ? 'Cal.com' : 'Calendly', data as Lead, 'coincide el contacto');
    // La reserva cambia la etapa DERIVADA («Agenda R1» sale de la fecha) sin pasar por
    // updateLead: el espejo de las etiquetas vinculadas va acá (revisión del 08/10/2026,
    // etiquetas-3). No en el backfill histórico: ahí no hay una transición de HOY, y si hiciera
    // falta la levanta el barrido horario con su tope (lib/etiquetas.ts, conciliarEspejoEtapas).
    if (!soloVacios) {
      const antes = pipelineStageOf(existing);
      const despues = pipelineStageOf(data as Lead);
      if (antes !== despues) await espejarEtiquetasDeEtapa(existing.id, existing.funnel_id ?? null, antes, despues);
      // La etapa que la reserva limpió (M6), al historial: campo 'Etapa', firmada por la agenda, con la de antes.
      if ('pipeline_stage' in updatePayload && antes !== despues) await auditarEtapaDeLaReserva(existing.id, antes, data as Lead, input.origen_lead === 'calcom' ? 'Cal.com' : 'Calendly');
    }
    return { created: false, lead: data as Lead };
  }

  // #2: auto-asignar setter/closer al único vendedor (el que agendó/cerrará es él).
  const soloCal = await vendedorUnicoDelWorkspace();
  // INSERT: incluimos todo aunque sean null (lead nuevo, no hay nada que pisar)
  const insertPayload = {
    ...basePayload,
    origen_lead:              input.origen_lead ?? 'calendly',
    utm_source:               input.utm_source               ?? null,
    utm_medium:               input.utm_medium               ?? null,
    utm_campaign:             input.utm_campaign             ?? null,
    utm_content:              input.utm_content              ?? null,
    fbclid:                   input.fbclid                   ?? null,
    respuesta_facturacion:    input.respuesta_facturacion    ?? null,
    respuesta_colaboradores:  input.respuesta_colaboradores  ?? null,
    respuesta_objetivo:       input.respuesta_objetivo       ?? null,
    respuesta_cuando_empezar: input.respuesta_cuando_empezar ?? null,
    respuesta_inversion:      input.respuesta_inversion      ?? null,
    respuesta_decisor:        input.respuesta_decisor        ?? null,
    visitor_id:               input.visitor_id               ?? null,
    setter:                   soloCal ?? null,
    closer:                   soloCal ?? null,
    // Backdatear created_at SOLO en backfill, para reflejar cuándo agendó
    ...(opts?.fechaCreacion ? { created_at: opts.fechaCreacion } : {}),
  };

  const { data, error } = await supabase
    .from('leads')
    .insert(insertPayload)
    .select('*')
    .single();
  if (error) throw new Error(`Error creando lead desde Calendly: ${error.message}`);
  // Un lead que NACE agendado entra a su etapa: se le pone la etiqueta vinculada (si la hay).
  if (!soloVacios) await espejarEtiquetasDeEtapa((data as Lead).id, (data as Lead).funnel_id ?? null, null, pipelineStageOf(data as Lead));
  return { created: true, lead: data as Lead };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de presentación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el estado de madurez de la cohorte de UN lead según su fecha_junta_1.
 * Mismos thresholds que la vista v_cohortes_semanales.
 */
export function estadoMadurezLead(lead: Lead, hoy: Date = new Date()): EstadoMadurez {
  if (!lead.fecha_junta_1) return 'sin_j1';
  const dias = diasDesdeJ1(lead.fecha_junta_1, hoy);
  if (dias === null) return 'sin_j1';
  // J1 en el futuro (dias < 0): la cohorte recién arranca → 'reciente', nunca
  // 'madura'. Evita el bug de "−9 días desde J1" / madurez falsa (Fase 8).
  if (dias < 0) return 'reciente';
  if (dias >= 14) return 'madura';
  if (dias >= 5) return 'madurando';
  return 'reciente';
}

/**
 * Días (enteros) entre la J1 y hoy. Negativo si la J1 es futura.
 * @returns null si no hay fecha_junta_1.
 */
export function diasDesdeJ1(fechaJ1: string | null, hoy: Date = new Date()): number | null {
  if (!fechaJ1) return null;
  const [y, m, d] = fechaJ1.split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  const hoyUTC = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
  return Math.floor((hoyUTC.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Texto humano de la cohorte para la ficha del lead (Fase 8).
 * J1 futura → "faltan X días para J1"; J1 pasada → "X días desde J1".
 * @returns null si no hay J1.
 */
/**
 * La cohorte que dibuja la ficha del lead («Madura · 48 días desde R1»), o null sin R1. UNA función
 * para las dos puertas de la ficha: la ruta /crm/[id] y el panel del tablero (LeadSheet, que la
 * recibe resuelta de getLeadFullAction porque es 'use client' y no puede importar este archivo).
 * Hasta el 13/10/2026 sólo la calculaba la ruta, y el panel no la mostraba.
 */
export function cohorteDeLead(lead: Lead, hoy: Date = new Date()): { label: string; color: string; texto: string | null } | null {
  if (!lead.fecha_junta_1) return null;
  const { label, color } = labelMadurez(estadoMadurezLead(lead));
  return { label, color, texto: textoCohorteJ1(lead.fecha_junta_1, hoy) };
}

export function textoCohorteJ1(fechaJ1: string | null, hoy: Date = new Date()): string | null {
  const dias = diasDesdeJ1(fechaJ1, hoy);
  if (dias === null) return null;
  if (dias < 0) {
    const faltan = Math.abs(dias);
    return `faltan ${faltan} ${faltan === 1 ? 'día' : 'días'} para R1`;
  }
  if (dias === 0) return 'R1 es hoy';
  return `${dias} ${dias === 1 ? 'día' : 'días'} desde R1`;
}

/**
 * Devuelve emoji + label para el estado de madurez.
 */
export function labelMadurez(estado: EstadoMadurez): { emoji: string; label: string; color: string } {
  switch (estado) {
    case 'madura':
      return { emoji: '🟢', label: 'Madura', color: 'var(--accent-green)' };
    case 'madurando':
      return { emoji: '🟡', label: 'Madurando', color: 'var(--accent-yellow)' };
    case 'reciente':
      return { emoji: '⚪', label: 'Reciente', color: 'var(--text-dim)' };
    case 'sin_j1':
      return { emoji: '—', label: 'Sin R1', color: 'var(--text-pending)' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VSL tracking (Fase 6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cuenta cuántos eventos vsl_play tiene un visitor_id en vsl_events.
 * Para la ficha del lead (Fase 7): "vio el VSL N veces".
 * @returns 0 si visitorId es null o no hay eventos.
 */
export async function contarVslPlays(visitorId: string | null): Promise<number> {
  if (!visitorId) return 0;
  const supabase = (await getTenantDb());
  const { count, error } = await supabase
    .from('vsl_events')
    .select('id', { count: 'exact', head: true })
    .eq('visitor_id', visitorId)
    .eq('event', 'vsl_play');
  if (error) {
    console.error(`[contarVslPlays] falló: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

/**
 * Engagement del VSL por persona (v3 Fase A): plays + el % MÁXIMO alcanzado.
 * Reemplaza el conteo simple en la ficha, las cards de juntas y la cola.
 *   - plays: eventos de tipo 'play' (compat: event='vsl_play').
 *   - max_pct: mayor `porcentaje` de los milestones de watchtime (null si no hay).
 *   - sin_datos: true si el visitor_id es null (no afirmar que no vio).
 * @returns { plays:0, max_pct:null, sin_datos:true } si visitorId es null.
 */
export type VslEngagement = {
  plays: number;
  /** El mayor avance sobre CUALQUIER video. Sirve para ordenar y filtrar la
   *  lista; para la ficha del lead lo que vale es `porVideo`, porque «vio el
   *  80%» sin decir de QUÉ no significa nada cuando hay más de uno. */
  max_pct: number | null;
  sin_datos: boolean;
  porVideo: VideoEngagement[];
};

/**
 * Duración de cada VSL en segundos, según lo que el cron de Panda ya guarda en
 * marketing_metrics_daily (plataforma 'panda', raw_payload.duration_seconds).
 *
 * Es la pieza que faltaba para cerrar la mig 0121: el navegador manda `segundos`
 * (el dato crudo, siempre disponible) y el % se deriva ACÁ. Sin esto, un evento
 * medido en segundos no tenía con qué porcentuarse y la ficha mostraba "—".
 */
export async function getDuracionesVsl(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const supabase = await getTenantDb();
    const { data } = await supabase
      .from('marketing_metrics_daily')
      .select('video_id, raw_payload, fecha')
      .eq('plataforma', 'panda')
      .not('video_id', 'is', null)
      .order('fecha', { ascending: false })
      .limit(400);
    for (const r of (data ?? []) as Array<{ video_id: string | null; raw_payload: { duration_seconds?: number } | null }>) {
      const vid = r.video_id?.trim();
      const dur = Number(r.raw_payload?.duration_seconds);
      if (vid && !out.has(vid) && Number.isFinite(dur) && dur > 0) out.set(vid, dur);
    }
  } catch (e) {
    console.error('[getDuracionesVsl] falló:', e instanceof Error ? e.message : e);
  }
  return out;
}

/**
 * Cómo se resuelve la duración de cada evento, sabiendo QUÉ VIDEOS hay en juego.
 *
 * ⚠️ El respaldo de «la única duración conocida» era incondicional:
 *
 *     return durs.size === 1 ? [...durs.values()][0] : null;
 *
 * Con un solo video eso es correcto y resuelve un caso real (el `video_id` de
 * `vsl_events` no siempre coincide con el que reporta el cron de Panda). Con dos,
 * es un porcentaje INVENTADO: al testimonio de 40 s se le aplica la duración del
 * VSL de 20 minutos y su avance sale ~0% para siempre. Y se ve exactamente igual
 * que uno correcto — nadie lo revisa, ninguna pantalla lo dice.
 *
 * La regla: un respaldo que asume «hay uno solo» tiene que CHEQUEAR que haya uno
 * solo. Si no se sabe de qué video es la duración, se devuelve null y la pantalla
 * muestra «—», que es la verdad.
 */
/**
 * Un `video_id` con prefijo de host dice de dónde salió: `v:` un video de la propia
 * página, `w:`/`wistia:` Wistia, `yt:` YouTube, `vimeo:` Vimeo, `drive:` Drive. Un
 * UUID pelado es de Panda, y `iframeN` es un player que no se identificó.
 */
// ⚠️ ERA UN REGEX, Y CONTESTABA MAL. `/^[a-z]{1,6}:/i` daba **false** para
// `wistia-player:`, `mux-player:` y `lite-youtube:` —medido el 27/09/2026— porque el
// guion no es `[a-z]` y el prefijo pasa de 6 caracteres. Con la respuesta en false,
// esos ids caían al respaldo de abajo («la única duración conocida», que es de Panda)
// y se les calculaba el avance con la duración de OTRO video: exactamente lo que el
// comentario de acá al lado dice que no puede pasar. Ahora lo contesta
// `lib/video-id.ts`, que es el que conoce los prefijos que el repo escribe.

function resolverDuracion(videosEnJuego: Set<string>, durs: Map<string, number>): (videoId: string | null | undefined) => number | null {
  const unica = durs.size === 1 ? [...durs.values()][0] : null;
  const hayUnoSolo = videosEnJuego.size <= 1;
  return (videoId) => {
    const v = videoId?.trim();
    if (v && durs.has(v)) return durs.get(v)!;
    // ⚠️ «LA ÚNICA DURACIÓN CONOCIDA» ES DE PANDA Y NO SE LE PRESTA A OTRO HOST.
    // El respaldo existe porque los hitos `sNN` de Panda llegan sin porcentaje y
    // sin él no se podría calcular nada (en ws1 son 8.071 eventos), así que no se
    // puede borrar. Pero aplicado a un video de otra parte inventa el avance: un
    // `<video>` de 11 segundos medido contra los 1.419 de un VSL de Panda da
    // cualquier cosa. Desde la v16 llegan ids de cinco hosts nuevos, así que esto
    // pasó de ser un riesgo teórico a uno con fecha.
    if (v && idDeclaraHost(v)) return null;
    return hayUnoSolo ? unica : null;
  };
}

/** Los video_id distintos que aparecen en un lote de eventos (ignora los vacíos). */
function videosDe(rows: Array<{ video_id: string | null }>): Set<string> {
  const s = new Set<string>();
  for (const r of rows) { const v = r.video_id?.trim(); if (v) s.add(v); }
  return s;
}

/** Lo que se midió de UN video, para poder mostrarlo aparte de los otros. */
export type VideoEngagement = {
  /** null = eventos que no se pudieron atribuir a ningún video (datos viejos). */
  videoId: string | null;
  /** El título que reportó el player, si lo había. El nombre que puso la persona
   *  lo resuelve la pantalla contra el catálogo `landing.videos`. */
  titulo: string | null;
  plays: number;
  maxPct: number | null;
};

export async function getVslEngagement(visitorId: string | null): Promise<VslEngagement> {
  if (!visitorId) return { plays: 0, max_pct: null, sin_datos: true, porVideo: [] };
  const supabase = (await getTenantDb());
  const [{ data, error }, durs] = await Promise.all([
    supabase.from('vsl_events').select('tipo_evento, porcentaje, event, segundos, video_id, vsl_titulo').eq('visitor_id', visitorId),
    getDuracionesVsl(),
  ]);
  if (error) {
    console.error(`[getVslEngagement] falló: ${error.message}`);
    return { plays: 0, max_pct: null, sin_datos: true, porVideo: [] };
  }
  const rows = (data ?? []) as Array<{ tipo_evento: string | null; porcentaje: number | null; event: string | null; segundos: number | null; video_id: string | null; vsl_titulo: string | null }>;
  const dur = resolverDuracion(videosDe(rows), durs);
  const esPlay = (r: { tipo_evento: string | null; event: string | null }) => r.tipo_evento === 'play' || r.event === 'vsl_play';

  // Un acumulador POR VIDEO. La clave es el id, con un balde aparte para lo que no
  // se pudo atribuir: esos eventos NO se tiran —son mediciones reales, de datos
  // anteriores a la v5 del snippet— pero tampoco se le suman a un video concreto,
  // que es como se contamina una curva sin que se note.
  const porVideo = new Map<string, VideoEngagement>();
  const balde = (r: { video_id: string | null; vsl_titulo: string | null }): VideoEngagement => {
    const id = r.video_id?.trim() || null;
    const k = id ?? '';
    let e = porVideo.get(k);
    if (!e) { e = { videoId: id, titulo: null, plays: 0, maxPct: null }; porVideo.set(k, e); }
    // El título del player puede venir en unos eventos y no en otros: se queda el
    // primero que llegue, en vez de pisarlo con null a mitad de camino.
    if (!e.titulo && r.vsl_titulo?.trim()) e.titulo = r.vsl_titulo.trim();
    return e;
  };

  for (const r of rows) {
    const e = balde(r);
    if (esPlay(r)) { e.plays++; continue; }
    // El avance sale de avanceDe(): usa el % si vino positivo y, si no, DERIVA el %
    // con los segundos + la duración de Panda (mig 0121). El 'play' se excluye: su
    // porcentaje 0 / segundos 0 es el centinela de "arrancó", no una medición.
    const p = avanceDe({ visitor_id: visitorId, tipo_evento: r.tipo_evento, porcentaje: r.porcentaje, segundos: r.segundos, video_id: r.video_id }, dur(r.video_id));
    if (typeof p === 'number' && p > 0) e.maxPct = Math.max(e.maxPct ?? 0, p);
  }

  const lista = [...porVideo.values()]
    // Los que tienen algo medido primero; entre esos, el que más se vio. Un video
    // que nadie reprodujo no puede encabezar la lista de lo que esta persona vio.
    .sort((a, b) => (b.maxPct ?? -1) - (a.maxPct ?? -1) || b.plays - a.plays);

  const plays = lista.reduce((n, e) => n + e.plays, 0);
  const avances = lista.map((e) => e.maxPct).filter((p): p is number => typeof p === 'number');
  return { plays, max_pct: avances.length > 0 ? Math.max(...avances) : null, sin_datos: false, porVideo: lista };
}

/**
 * Engagement del VSL para VARIOS visitors en UNA sola query (evita el N+1 de
 * llamar getVslEngagement por lead en un loop). Devuelve un Map por visitor_id;
 * los visitors sin filas no aparecen (el caller los trata como 'sin_datos').
 */
export async function getVslEngagementMap(
  visitorIds: Array<string | null>,
): Promise<Map<string, VslEngagement>> {
  const ids = [...new Set(visitorIds.filter((v): v is string => !!v))];
  const map = new Map<string, VslEngagement>();
  if (ids.length === 0) return map;
  const supabase = (await getTenantDb());
  // Paginado por `id` y en tandas de visitantes. Un `.in('visitor_id', ids)`
  // suelto volvía cortado en 1000 filas: hay visitantes con 540 eventos, así que
  // con un par de ellos en el lote los del final quedaban como «no vio el VSL»
  // habiéndolo visto. Las tandas de 200 son para que el `.in()` no reviente la
  // URL (mismo corte que lib/landing-analyst.ts); el cálculo necesita TODAS las
  // filas de cada visitante (cuenta plays y toma el máximo), así que no se acota.
  let data: Array<{ visitor_id: string; tipo_evento: string | null; porcentaje: number | null; event: string | null; segundos: number | null; video_id: string | null }>;
  let durs: Awaited<ReturnType<typeof getDuracionesVsl>>;
  try {
    const [tandas, d] = await Promise.all([
      Promise.all(enTandas(ids, 200).map((tanda) => leerTodo<{ visitor_id: string; tipo_evento: string | null; porcentaje: number | null; event: string | null; segundos: number | null; video_id: string | null }>(
        supabase, 'vsl_events', 'id, visitor_id, tipo_evento, porcentaje, event, segundos, video_id',
        { filtros: (q) => q.in('visitor_id', tanda) },
      ))),
      getDuracionesVsl(),
    ]);
    data = tandas.flat();
    durs = d;
  } catch (e) {
    console.error(`[getVslEngagementMap] falló: ${e instanceof Error ? e.message : String(e)}`);
    return map;
  }
  type Fila = { tipo_evento: string | null; porcentaje: number | null; event: string | null; segundos: number | null; video_id: string | null };
  const porVisitor = new Map<string, Fila[]>();
  for (const r of (data ?? []) as Array<Fila & { visitor_id: string }>) {
    const arr = porVisitor.get(r.visitor_id) ?? [];
    arr.push(r);
    porVisitor.set(r.visitor_id, arr);
  }
  // ⚠️ Los videos en juego se cuentan sobre el LOTE ENTERO, no sobre las filas de
  // cada visitor. Es la mejor señal que hay acá de cuántos videos tiene este
  // negocio: si un visitor miró uno solo pero el workspace tiene dos, aplicarle
  // «la única duración conocida» sigue siendo inventar un porcentaje.
  const dur = resolverDuracion(videosDe((data ?? []) as Array<{ video_id: string | null }>), durs);
  for (const [vid, rows] of porVisitor) {
    const plays = rows.filter((r) => r.tipo_evento === 'play' || r.event === 'vsl_play').length;
    // Igual que getVslEngagement: % directo si vino positivo, o derivado de los
    // segundos con la duración de Panda. El play y el exit-en-0 no son medición.
    // Acá NO se desglosa por video: esta función alimenta la lista de leads, donde
    // la columna es un número por fila. El desglose vive en la ficha.
    const avances = rows
      .filter((r) => r.tipo_evento !== 'play' && r.event !== 'vsl_play')
      .map((r) => avanceDe({ visitor_id: vid, tipo_evento: r.tipo_evento, porcentaje: r.porcentaje, segundos: r.segundos, video_id: r.video_id }, dur(r.video_id)))
      .filter((p): p is number => typeof p === 'number' && p > 0);
    map.set(vid, { plays, max_pct: avances.length > 0 ? Math.max(...avances) : null, sin_datos: false, porVideo: [] });
  }
  return map;
}

// ── Respuestas del form de Calendly POR REUNIÓN (migración 0062) ────────────
// R1 y R2 tienen formularios propios: se guarda el set crudo por reunión y la
// ficha muestra el más reciente de cada una. Las columnas respuesta_* del lead
// quedan como fallback legacy para R1 (leads anteriores a la tabla).

export type RespuestaQA = { q: string; a: string };

export async function saveLeadRespuestas(
  leadId: number,
  reunion: 'R1' | 'R2',
  qa: Array<{ question?: string; answer?: string }> | undefined | null,
  eventoInicio: string | null,
): Promise<void> {
  const respuestas: RespuestaQA[] = (qa ?? [])
    .filter((x) => x?.question?.trim() && x?.answer?.trim())
    .map((x) => ({ q: x.question!.trim(), a: x.answer!.trim() }));
  if (!respuestas.length) return;
  try {
    const db = await getTenantDb();
    // Idempotencia (backfill / reintentos del webhook): no duplicar si ya hay una
    // fila para el mismo (lead, reunión, día) CON EL MISMO CONTENIDO. Un set distinto
    // el mismo día es un reagendado (o cancelar y volver a reservar) y se guarda:
    // getLeadRespuestas se queda con la más nueva. Por qué se compara campo por campo
    // y no como texto, en `yaGuardado` (lib/lead-respuestas.ts).
    if (eventoInicio) {
      const { data: ya } = await db
        .from('lead_respuestas')
        .select('respuestas')
        .eq('lead_id', leadId)
        .eq('reunion', reunion)
        .eq('evento_inicio', eventoInicio)
        .limit(20);
      if (yaGuardado((ya ?? []) as Array<{ respuestas: unknown }>, respuestas)) return;
    }
    const { error } = await db
      .from('lead_respuestas')
      .insert({ lead_id: leadId, reunion, respuestas, evento_inicio: eventoInicio });
    if (error) console.error(`[lead_respuestas] insert falló: ${error.message}`);
  } catch (e) {
    console.error('[lead_respuestas] excepción', e);
  }
}

/** Último set de respuestas por reunión. R1 cae a las columnas legacy si no hay fila. */
export async function getLeadRespuestas(lead: Lead): Promise<{ R1: RespuestaQA[]; R2: RespuestaQA[] }> {
  const out: { R1: RespuestaQA[]; R2: RespuestaQA[] } = { R1: [], R2: [] };
  try {
    const { data } = await (await getTenantDb())
      .from('lead_respuestas')
      .select('reunion, respuestas, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(20);
    for (const r of (data ?? []) as Array<{ reunion: 'R1' | 'R2'; respuestas: RespuestaQA[] }>) {
      if (!out[r.reunion].length && Array.isArray(r.respuestas)) out[r.reunion] = r.respuestas;
    }
  } catch { /* fallback legacy abajo */ }
  if (!out.R1.length) {
    const legacy: Array<[string, string | null]> = [
      ['¿Qué quiere lograr?', lead.respuesta_objetivo],
      ['¿Puede invertir?', lead.respuesta_inversion],
      ['¿Cuántos colaboradores?', lead.respuesta_colaboradores],
      ['¿Factura +$20M MXN?', lead.respuesta_facturacion],
      ['¿Alguien más decide?', lead.respuesta_decisor],
      ['¿Cuándo quiere empezar?', lead.respuesta_cuando_empezar],
    ];
    out.R1 = legacy.filter(([, a]) => a?.trim()).map(([q, a]) => ({ q, a: a! }));
  }
  return out;
}

// ── Timeline de comportamiento por lead (tab Tracking) ──────────────────────
// Merge cronológico de landing_visits + vsl_events del visitor: cada visita a
// la landing (con URL si la manda el beacon nuevo), cada play del VSL, los
// hitos de retención/abandono y cada CLIC en un botón o un link (con qué se
// apretó), todos con fecha y hora reales (created_at).

export type TrackingEvent = {
  ts: string;                                   // ISO
  tipo: 'pageview' | 'play' | 'retencion' | 'exit' | 'click' | 'scroll';
  /**
   * Retención/abandono DEL VIDEO — y, en un `scroll`, hasta dónde bajó la persona
   * en la PÁGINA (snippet v19). Son dos unidades distintas en la misma columna
   * porque en la base también lo son: lo que las separa es `tipo`, y por eso la
   * tarjeta nunca escribe un % sin decir de qué es.
   */
  porcentaje: number | null;
  landing_url: string | null;
  referrer: string | null;
  video_id: string | null;
  vsl_titulo: string | null;
  /**
   * QUÉ se clickeó, para `tipo: 'click'`. Sale tal cual de `vsl_events.detalle`
   * (mig 0133), que el snippet escribe con el destino PRIMERO y el texto del botón
   * después: `ancla #registro — Ver precios`, `https://wa.me/52… — Escríbenos`, o
   * `boton: Agendar ahora` cuando el elemento no tiene href.
   *
   * `null` en todos los demás tipos, y eso es información: un evento de video no
   * tiene detalle. Por eso la columna nació aparte de `vsl_titulo` en vez de
   * reusarla — son dos preguntas («cómo se llama el video» vs «qué se clickeó») y
   * meterlas en el mismo campo es cómo se pierde una de las dos.
   */
  detalle: string | null;
};

export async function getTrackingEvents(visitorId: string | null, limit = 120): Promise<TrackingEvent[]> {
  if (!visitorId) return [];
  try {
    const supabase = (await getTenantDb());
    const [visitas, eventos] = await Promise.all([
      supabase.from('landing_visits')
        .select('created_at, landing_url, referrer')
        .eq('visitor_id', visitorId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase.from('vsl_events')
        .select('created_at, tipo_evento, porcentaje, event, video_id, vsl_titulo, detalle')
        .eq('visitor_id', visitorId)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);
    const out: TrackingEvent[] = [];
    for (const v of (visitas.data ?? []) as Array<{ created_at: string; landing_url: string | null; referrer: string | null }>) {
      out.push({ ts: v.created_at, tipo: 'pageview', porcentaje: null, landing_url: v.landing_url, referrer: v.referrer, video_id: null, vsl_titulo: null, detalle: null });
    }
    for (const e of (eventos.data ?? []) as Array<{ created_at: string; tipo_evento: string | null; porcentaje: number | null; event: string | null; video_id: string | null; vsl_titulo: string | null; detalle: string | null }>) {
      const esPlay = e.tipo_evento === 'play' || e.event === 'vsl_play';
      // ⚠️ LO QUE NO ES DE VIDEO NO ENTRA. Esta línea de tiempo tiene cuatro tipos
      // y todo lo que no era play ni exit caía en 'retencion', que la tarjeta del
      // lead escribe como «Siguió mirando el VSL». Desde la v14 el snippet manda
      // también el tiempo en la PÁGINA —salio, volvio, cierre— más los clics y los
      // agendados, así que la ficha afirmaba que la persona seguía mirando un video
      // del que nunca llegó un evento. Medido en los últimos 7 días: el ws13 tiene
      // 115 salio, 68 volvio, 50 cierre, 20 click y 6 agendo, y CERO de video.
      //
      // Es el mismo choke point de `avanceDe`: la regla se aplicó allá y quedó sin
      // aplicar acá. Los eventos de página no se pierden —están en la base y en el
      // panel de la prueba—; lo que no se hace es disfrazarlos de retención. El día
      // que la tarjeta tenga un renglón propio para ellos, se agregan con su tipo.
      //
      // ── EL CLIC YA TIENE SU RENGLÓN (tarea #701) ──────────────────────────────
      // Los clics eran lo único de esa lista que ya estaba GUARDADO con el dato
      // adentro: `vsl_events.detalle` dice qué se apretó desde la mig 0133, y el
      // snippet lo manda desde la v6. O sea que no faltaba capturar nada — faltaba
      // dejarlos pasar y que `TrackingTimelineCard` les diera su propia frase. Para
      // una landing cuyo CTA es un ancla o un link de WhatsApp, el clic ES el
      // embudo: entre «entró» y «dejó sus datos» no había ningún punto intermedio.
      //
      // `salio`, `volvio`, `cierre` y `agendo` siguen afuera, y siguen afuera por lo
      // mismo que dice el párrafo de arriba: no tienen renglón propio todavía.
      const esClick = e.tipo_evento === 'click';
      // ── Y EL SCROLL TAMBIÉN TIENE EL SUYO (tarea #701) ─────────────────────
      // Lo manda el snippet desde la v19 y es la otra mitad de la visita: cuánto
      // LEYÓ, no solo qué apretó. Entra con su `porcentaje`, que acá es de la PÁGINA
      // y no del video — por eso el tipo es propio y no 'retencion': con el tipo
      // compartido la ficha escribiría «Llegó al 50% del VSL» sobre una página sin
      // un solo video, que es exactamente el disfraz que el párrafo de arriba corta.
      const esScroll = e.tipo_evento === 'scroll';
      if (!esPlay && !esClick && !esScroll && !esEventoDeVideo(e.tipo_evento)) continue;
      // ⚠️ EL SELLO DEL CONSTRUCTOR NO ES UN CLIC DE LA PERSONA. Una landing hecha con
      // un constructor lleva pegado su propio badge, y el Pixel lo captura como
      // cualquier otro clic. Medido el 05/10/2026: 208 de los 441 clics del ws1 son
      // el «Edit with Lovable», y el primer renglón del recorrido de un lead era el
      // cartelito del editor. El evento NO se borra de la base — se saca del renglón.
      if (esClick && esClicDelConstructor(e.detalle)) continue;
      const tipo: TrackingEvent['tipo'] = esPlay ? 'play' : esClick ? 'click' : esScroll ? 'scroll' : e.tipo_evento === 'exit' ? 'exit' : 'retencion';
      out.push({
        ts: e.created_at, tipo,
        // Un clic no tiene porcentaje y el snippet no lo manda, así que en la base es
        // NULL. Se fuerza igual: si algún día alguien escribe un 0 ahí, la tarjeta no
        // puede ponerse a escribir «0%» sobre un clic — es la misma mezcla de unidades
        // que `avanceDe` ya tuvo que cortar (segundos de PÁGINA como % de VIDEO).
        porcentaje: esClick ? null : e.porcentaje,
        landing_url: null, referrer: null,
        // Un scroll no habla de ningún video: si llegara con `video_id`, `videosDe`
        // lo contaría como un video EN JUEGO y el avance de esa persona pasaría a
        // «—» (es la misma trampa que el 'toque_video' del snippet documenta).
        video_id: esClick || esScroll ? null : e.video_id,
        vsl_titulo: esClick || esScroll ? null : e.vsl_titulo,
        detalle: esClick ? e.detalle : null,
      });
    }
    out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    // ⚠️ EL TOPE ES POR TABLA Y SE APLICA EN LA BASE, ANTES DE ESTE FILTRO: las dos
    // consultas de arriba piden `limit` filas cada una y acá se descarta lo que no
    // tiene renglón. Así que un visitante con más de `limit` filas en `vsl_events`
    // puede quedarse sin los clics aunque los tenga, porque los `salio`/`volvio`/
    // `cierre` más recientes se comieron la cuota — y el corte no deja rastro: la
    // ficha muestra menos eventos y se lee igual que un lead poco activo.
    //
    // No se puede acotar por tipo en la consulta: los hitos son `pNN`/`sNN` con NN
    // abierto (los segundos de Panda no tienen techo), así que no hay lista que
    // enumerarle al `.in()`, y el `play` viejo viene con `tipo_evento` NULL y la
    // marca en `event`. Queda medido y escrito acá; el arreglo es otra consulta.
    //
    // Y este `slice` final recorta la MEZCLA: con los clics adentro, un lead que
    // apretó muchos botones puede empujar sus visitas a la landing fuera de los
    // `limit` que se devuelven. El caller que necesita más pide más (la API de MaKo
    // pide 200 y corta a 60 ella misma, lib/api-mako/areas/crm.run.ts).
    return out.slice(0, limit);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline del CRM — etapas editables + Closer/Setter/Fathom (migración 0020)
// ─────────────────────────────────────────────────────────────────────────────
//
// El funnel se MUDÓ a `lib/funnels.ts` (mig 0170): dejó de ser una fila JSON por
// workspace y pasó a ser N filas en `funnels`. Acá no quedó ni un wrapper a
// propósito — un `getFunnel()` sin argumentos MIENTE en cuanto hay dos funnels, y
// dejarlo como alias habría dejado los 33 call-sites sin decidir cuál de los dos
// preguntan. Los dos lectores son `getFunnelDefault()` (el del negocio) y
// `getFunnelDeLead(lead)` (el del recorrido de ESE lead).

/**
 * Quién firma un movimiento que no trae autor explícito: la persona logueada si
 * hay sesión, y si no MaKo — porque entonces lo movió el sistema (cron, webhook,
 * WhatsApp). Nunca lanza: en un cron no hay cookies que leer.
 */
export async function autorDelMovimiento(explicito?: string): Promise<string> {
  if (explicito?.trim()) return explicito.trim();
  try {
    const s = await getUsuarioActual();
    return s?.email?.trim() || AUTOR_SISTEMA;
  } catch {
    return AUTOR_SISTEMA;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Requisitos de un movimiento SIN formulario (MaKo, motor automático)
// ─────────────────────────────────────────────────────────────────────────────
// El wizard del CRM no deja mover un lead a una etapa cuyos requisitos no están
// cargados. Los callers que mueven sin pantalla (MaKo por WhatsApp, el motor del
// CRM automático, las opciones del modal de confirmaciones) no pasaban por ahí:
// dejaban leads en etapas con datos incompletos que la UI jamás habría permitido
// —un "Ganado" sin monto, un "Perdido" sin motivo— y esos leads reaparecían en el
// worklist sin que nadie supiera quién los movió.
//
// Acá vive lo que necesita ese caller: los faltantes calculados SOLO con el lead.

/** Datos que el caller aporta EN ESTE movimiento (los que todavía no están en la fila). */
export type AportadoAlMover = {
  monto?: number | null;
  /** Motivo de ESTE movimiento (el `motivo_perdida` guardado puede ser de una pérdida anterior). */
  motivo?: string | null;
  asistioJ1?: boolean | null;
  asistioJ2?: boolean | null;
  hoyISO?: string;
  /** ¿Se espera grabación de este encuentro? De `encuentroGrabable()`. Sin esto,
   *  quien cierra en persona no puede mover un lead sin inventar un link de Fathom. */
  grabable?: boolean;
};

/**
 * Qué le falta a este lead para poder MOVERSE a `stageKey`.
 *
 * Misma fuente que el CRM (`stepsForStage`), evaluada con la etapa DESTINO y la
 * etapa de origen VIGENTE — no con la etapa actual, que es lo que mira
 * `faltantesDeLead`. La higiene (setter/closer/empresa/teléfono) va en undefined
 * a propósito: nunca gatea un movimiento, ni acá ni en el wizard.
 *
 * `pipeline` son las etapas GENERADAS del workspace (getPipelineStages / los
 * `stages` del funnel), no el pipeline crudo: el nivel de requisitos se deriva de
 * `kind`, y una lista de etapas sin kind hace pasar cualquier movimiento.
 *
 * PENDIENTE (una cosa, un lugar): `valoresDeRequisitos` en app/crm/actions.ts es
 * el superset de esto —los mismos valores más lo que el wizard acaba de tipear y
 * los pagos ya cargados— y debería construirse sobre esta función. Quedó fuera
 * del alcance de este cambio: tocarla es tocar el camino que usa toda la UI.
 */
export function faltantesParaMover(
  lead: Lead,
  stageKey: string,
  pipeline?: readonly Stage[] | null,
  aportado: AportadoAlMover = {},
): Step[] {
  const stages = pipeline && pipeline.length ? pipeline : undefined;
  const info = stages ? funnelReqInfo(stages as Stage[], stageKey) : undefined;
  const links = ((lead.fathom_links ?? []) as FathomLink[]).filter((f) => f.url?.trim());
  return stepsForStage(stageKey, {
    nivel: info?.nivel,
    numReuniones: info?.numReuniones,
    esVenta: info?.esVenta,
    fechaJ1: lead.fecha_junta_1,
    fechaJ2: lead.fecha_junta_2,
    asistioJ1: aportado.asistioJ1 ?? lead.asistio_j1,
    asistioJ2: aportado.asistioJ2 ?? lead.asistio_j2,
    calificado: lead.calificado,
    hasFathomUrl: links.length > 0,
    grabable: aportado.grabable,
    monto: aportado.monto ?? lead.monto_cierre_usd,
    // Venta recurrente: el importe vive en el MRR y `monto_cierre_usd` queda null.
    suscripcionMonto: lead.venta_tipo === 'suscripcion' ? (lead.suscripcion_monto_usd ?? null) : null,
    // Un becado («sin cobro», #747): monto, plan y comprobante quedan contestados.
    ventaTipo: lead.venta_tipo,
    // Partido en dos: el guardado puede ser de una pérdida ANTERIOR y no da por
    // contestada la de ahora. Quien decide es stepsForStage con `etapaActual`.
    motivo: lead.motivo_perdida,
    motivoNuevo: aportado.motivo ?? null,
    // De dónde viene: la etapa EFECTIVA (override chequeado contra el funnel),
    // la misma que usa la ficha. Con el override crudo, los cientos de leads
    // apuntando a etapas que su funnel ya no tiene se evalúan contra un fantasma.
    etapaActual: etapaVigenteDe(lead, stages),
    hoyISO: aportado.hoyISO ?? hoyEnTijuana(),
    atJ1: lead.junta_1_at,
    atJ2: lead.junta_2_at,
    sinR1: !!lead.sin_r1,
    sinR2: !!lead.sin_r2,
    fathomOmitido: !!lead.fathom_omitido,
    // `tienePlan` queda undefined (= no se exige): las cuotas viven en otro
    // módulo y este camino no las lee. El gate duro de una venta es el monto.
  });
}

/**
 * El movimiento no se hizo porque faltan datos. NO es un fallo del sistema: es una
 * respuesta esperable del negocio, y por eso viaja tipada (con la lista de pasos)
 * en vez de como un Error genérico que el caller solo puede loguear.
 */
export class RequisitosFaltantesError extends Error {
  readonly leadId: number;
  readonly stageKey: string;
  readonly faltan: Step[];
  constructor(leadId: number, stageKey: string, faltan: Step[]) {
    super(`Faltan datos para mover el lead ${leadId} a "${stageKey}": ${faltan.map((f) => f.label).join(', ')}.`);
    this.name = 'RequisitosFaltantesError';
    this.leadId = leadId;
    this.stageKey = stageKey;
    this.faltan = faltan;
  }
}

export const esRequisitosFaltantes = (e: unknown): e is RequisitosFaltantesError => e instanceof RequisitosFaltantesError;

/**
 * Mueve un lead a una etapa del tablero. Persiste el override `pipeline_stage`
 * y, en desenlaces terminales, sincroniza estado_lead (vía updateLead) para que
 * Revenue/CAPI sigan correctos. Para "ganado" exige monto.
 *
 * TODO movimiento queda en el historial, lo haga quien lo haga: antes esto era un
 * UPDATE mudo y los ocho callers (el motor automático, MaKo por WhatsApp, el
 * desenlace de las nutriciones, el bloqueo de un contacto…) movían leads sin
 * dejar una línea. Ahora audita acá, en el choke point, y no en cada caller.
 */
export async function setPipelineStage(
  id: number,
  stageKey: string,
  opts?: {
    monto?: number | null; motivo?: string | null;
    asistio_j1?: boolean | null; asistio_j2?: boolean | null; deadline?: string | null;
    /**
     * ¿Era un lead calificado? Viaja con el movimiento porque es una de las DOS
     * señales que le llegan a Meta (con asistio_j1=true dispara QualifiedLead): se
     * ofrece como un toque opcional al mover, en vez de esperar a que alguien
     * complete la ficha una semana después. updateLead lo anula solo si no hubo
     * asistencia, así que mandarlo de más no ensucia nada.
     */
    calificado?: boolean | null;
    /** Quién lo movió. Sin esto se resuelve solo: sesión → persona, sin sesión → MaKo. */
    autor?: string;
    /**
     * Qué hacer con los requisitos de la etapa destino. Los movimientos que vienen
     * de un formulario NO lo mandan: el wizard del CRM ya validó con los datos que
     * la persona acaba de tipear (y revalidar acá pediría de nuevo lo que todavía
     * no está persistido). Un movimiento SIN formulario tiene que elegir:
     *   · 'validar'          → si falta algo, NO mueve: lanza RequisitosFaltantesError.
     *   · { omitir: motivo } → mueve igual y el motivo queda en el historial. Es para
     *     los movimientos automáticos legítimos (nadie a quien preguntarle), nunca
     *     para tapar un requisito: si se saltea, se saltea DICIÉNDOLO.
     */
    requisitos?: 'validar' | { omitir: string };
  },
): Promise<void> {
  const supabase = (await getTenantDb());
  const estado = terminalEstadoFor(stageKey);
  const antes = await getLead(id);

  // 0) Requisitos. Va ANTES de cualquier escritura: un movimiento rechazado no
  //    puede dejar el estado_lead ya sincronizado con la etapa a la que no llegó.
  // Un salteo SIN motivo no es un salteo declarado: se valida igual (fail closed).
  // Si no, `{ omitir: '' }` sería el mismo agujero de antes, pero con tipos.
  const omitido = typeof opts?.requisitos === 'object' ? opts.requisitos.omitir.trim() : '';
  if (opts?.requisitos && !omitido) {
    // Sin poder leer el lead no hay nada contra qué validar: cortamos. Mover a
    // ciegas es justamente lo que este parámetro existe para impedir.
    if (!antes) throw new Error(`No se pudo leer el lead ${id} para validar los requisitos de "${stageKey}".`);
    // Las etapas GENERADAS (las mismas que mira el wizard): son las que traen
    // `kind`, y sin kind no hay nivel de requisitos — una lista pelada dejaría
    // pasar cualquier movimiento sin que nada avise.
    // DEL LEAD: lo que se valida son los requisitos de SU recorrido, no los del
    // funnel que el negocio tenga por defecto.
    const stages = await getPipelineStagesDeLead(antes).catch(() => generateFunnel(DEFAULT_PIPELINE, []).stages);
    const faltan = faltantesParaMover(antes, stageKey, stages, {
      monto: opts.monto, motivo: opts.motivo,
      asistioJ1: opts.asistio_j1, asistioJ2: opts.asistio_j2,
    });
    if (faltan.length) throw new RequisitosFaltantesError(id, stageKey, faltan);
  }

  // 1) Sincronizar PRIMERO el desenlace canónico (invariantes + Meta CAPI). Si
  //    falla (p.ej. monto inválido), propagamos el error y NO tocamos el override:
  //    antes el error se tragaba y el tablero quedaba mostrando una etapa cuyo
  //    estado_lead nunca cambió (Revenue/CAPI divergían en silencio).
  const sync: LeadUpdateInput = { estado_lead: estado };
  if (estado === 'ganado' && opts?.monto != null) sync.monto_cierre_usd = opts.monto;
  if ((estado === 'perdido' || estado === 'descalificado') && opts?.motivo != null) {
    sync.motivo_perdida = opts.motivo;
  }
  // Asistencia a J1/J2 — la setean las resoluciones de "Datos sin marcar" (tipos
  // A y C), que existen justamente porque asistio_j1/j2 está en null.
  if (opts?.asistio_j1 !== undefined) sync.asistio_j1 = opts.asistio_j1;
  if (opts?.asistio_j2 !== undefined) sync.asistio_j2 = opts.asistio_j2;
  if (opts?.calificado !== undefined && opts.calificado !== null) sync.calificado = opts.calificado;
  // En etapas de nutrición marcamos la bandera para los pendientes/tab Nutrición.
  if (NUTRI_KEYS.includes(stageKey)) {
    sync.nutricion_realizada = true;
  }
  // (El disparo de la etapa DERIVADA de `updateLead`, M1-b, no se cruza con este movimiento: `sync` siempre trae
  // `estado_lead`, y un cambio de estado no dispara; sin cambio de estado, sólo una asistencia que se limpia —el
  // «Reagenda R1»— lo deja en «Agenda R1», que es justo la etapa que se escribe abajo.)
  await updateLead(id, sync);

  // 2) Guardar el override de la columna del tablero. El deadline de nutrición
  //    manual solo vive mientras el lead está en 'manual'; al moverlo a cualquier
  //    otra etapa se limpia (el lead dejó de estar aparcado).
  const patch: Record<string, unknown> = {
    pipeline_stage: stageKey,
    nutricion_manual_deadline: stageKey === 'manual' ? (opts?.deadline ?? null) : null,
  };
  const { error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(`Error moviendo lead ${id} a ${stageKey}: ${error.message}`);

  // 3) El rastro. Va el diff COMPLETO (etapa + estado + monto + motivo +
  //    asistencias) en una sola escritura para que la ficha lo muestre —y lo
  //    revierta— como un movimiento único. Si el caller vuelve a auditar después
  //    con su propio `before`, logLeadChanges descarta lo repetido.
  const autor = await autorDelMovimiento(opts?.autor);
  await logLeadChanges(id, antes, await getLead(id), autor);

  // 4) Si el movimiento se salteó los requisitos, el POR QUÉ va al historial junto
  //    al movimiento. Sin esta línea el salteo es indistinguible de un movimiento
  //    validado y el lead reaparece incompleto sin que nadie sepa por qué.
  if (omitido) {
    await logLeadEvent(id, 'Etapa sin validar', `Movido a "${stageKey}" sin validar los requisitos: ${omitido}`, autor);
  }

  // La etiqueta de WhatsApp por etapa del INBOX (evolution_stage_labels, 0 filas al 08/10/2026). Se
  // ESPERA: lanzada con `void`, una función serverless puede cortarse al responder y el pedido a
  // Evolution no sale nunca, sin rastro. Nunca tira (su try es interno).
  await actualizarEtiquetaLead(id);
  // Y el espejo de las etiquetas del CRM vinculadas a una etapa (mig 0224, lib/etiquetas.ts). Contra
  // la etapa que SE VEÍA antes del movimiento, como el resto de esta función.
  if (antes && pipelineStageOf(antes) !== stageKey) {
    await espejarEtiquetasDeEtapa(id, antes.funnel_id ?? null, pipelineStageOf(antes), stageKey, autor);
    // Y la automatización de la etapa a la que llegó, como `setBoardStageOverride` (14/10/2026, inventario de
    // Automations): el kanban, el ⚡ y las confirmaciones mueven por ACÁ, y su CRON esperaba al barrido de la hora.
    // Contra la etapa que SE VEÍA (moverlo a la misma no vuelve a inscribir), y `enrolarPorEvento` no duplica una
    // inscripción viva. Nunca tira: el movimiento ya se escribió.
    await enrolarPorEtapaDerivada(id, stageKey, antes.funnel_id ?? null);
  }
}

/**
 * Mover un lead desde un proceso AUTOMÁTICO — el motor del CRM (`lib/crm-auto`)
 * y el desenlace de las nutriciones (`lib/nutricion-desenlace`). Los dos son
 * crons: nadie está mirando y no hay a quién preguntarle si falta un dato.
 *
 * La regla es UNA sola para los dos, y por eso vive acá y no copiada en cada
 * cron: si falta algo, NO se mueve y el porqué queda escrito en el historial del
 * lead. Un movimiento automático que falla en silencio es lo peor de los dos
 * mundos — el desenlace se registró (la inscripción quedó sellada como
 * lograda/fallida) pero el lead se quedó en una etapa que ya no describe su
 * situación, y no hay una línea que lo explique. En el desenlace ese error se
 * iba a un `console.error` que no lee nadie.
 *
 * Se valida aunque hoy casi ningún destino automático tenga requisitos: el
 * funnel es configurable por workspace, y el día que un cliente le ponga un
 * requisito a una de esas etapas, el cron no puede ser el único camino que los
 * ignora.
 *
 * Devuelve false = no se movió, y el caller NO puede anunciar el cambio.
 */
export async function moverLeadAuto(
  leadId: number,
  to: string,
  opts: {
    /** Con qué nombre aparece el proceso en la línea del historial ("CRM automático", "Nutrición"). */
    canal: string;
    /** Autor del movimiento. Sin esto se resuelve solo (sin sesión → MaKo). */
    autor?: string;
    motivo?: string | null;
    asistio_j1?: boolean | null;
    asistio_j2?: boolean | null;
  },
): Promise<boolean> {
  const { canal, ...resto } = opts;
  try {
    await setPipelineStage(leadId, to, { ...resto, requisitos: 'validar' });
    return true;
  } catch (e) {
    // Solo "faltan datos" es un desenlace esperable del negocio. Cualquier otro
    // error (red, permisos, invariante rota) se propaga: confundirlos dejaría un
    // fallo real disfrazado de "le faltaba el monto".
    if (!esRequisitosFaltantes(e)) throw e;
    await logLeadEvent(leadId, canal, `No lo moví a "${to}": falta cargar ${e.faltan.map((f) => f.label).join(', ')}`, opts.autor);
    return false;
  }
}

/** Campos editables desde la ficha del rediseño (Closer/Setter/Fathom/motivo/fechas). */
export type LeadMetaInput = {
  closer?: string | null;
  setter?: string | null;
  fathom_links?: FathomLink[];
  motivo_perdida?: string | null;
  fecha_junta_1?: string | null;   // fecha de la J1, editable al mover a Agenda J1
  fecha_junta_2?: string | null;   // fecha de la J2, editable al mover a Agenda J2 / Facturando
  /**
   * Fecha límite de la nutrición manual, corregible desde la ficha.
   *
   * ⚠️ NO LIMPIA NADA AL CAMBIAR DE ETAPA, y por eso sólo se manda desde un lugar
   * donde el lead YA está en «Nutrición - Manual». El que sí la limpia es
   * `setBoardStageOverride` (la nulea en cuanto la etapa deja de ser `manual`):
   * ése es el camino del cambio de etapa, éste es el de corregir el plazo.
   */
  nutricion_manual_deadline?: string | null;
  // Contacto (editable a mano desde la ficha, con confirmación en la UI).
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  empresa?: string | null;
  web?: string | null;
  /** Ingreso ESTIMADO en USD (mig 0258). Llega ya validado (≥ 0) por `valorDeCampo`. */
  ingreso_estimado?: number | null;
  /** Usuario de Instagram sin la @ (mig 0258). Llega ya normalizado por `valorDeCampo`. */
  instagram?: string | null;
  /** Los del Resumen personalizable (mig 0274). Se sanean en `saveLeadMeta`. */
  youtube?: string | null;
  linkedin?: string | null;
  direccion?: string | null;
  sexo?: string | null;
};

/** Lo que `setBoardStageOverride` lee del lead ANTES de escribir: su etapa y su producto, y lo que
 *  hace falta para la etapa DERIVADA (la que se veía en el tablero si no había override). */
const COLS_ETAPA_PREVIA = 'pipeline_stage, funnel_id, estado_lead, fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, nutricion_realizada';

/**
 * El gancho de las etiquetas vinculadas a una etapa (lib/etiquetas.ts, `espejarEtapa`): sale de
 * la que deja, entra a la que llega (mig 0224). Sigue a la etapa EFECTIVA —la que dibuja el
 * tablero, `pipelineStageOf`—, comparando contra la que SE VEÍA antes de escribir.
 * ⚠️ A DIFERENCIA DEL DISPARO DE LA SECUENCIA DE ETAPA, corre también al «volver a la derivación»
 * (`setBoardStageOverride` con null): el espejo no AFIRMA una etapa, sigue la que el tablero va a
 * dibujar, y ésa se calcula con los campos del lead (revisión del 08/10/2026, etiquetas-3). Sin
 * esto, deshacer un movimiento dejaba puesta la etiqueta de la etapa que se deshizo. Lo llaman
 * `setPipelineStage`, `setBoardStageOverride` (también al «volver a la derivación»), `updateLead`
 * (la etapa derivada: fechas, asistencias, desenlace) y `upsertLeadFromCalendly`; lo que escriba
 * la etapa por otro camino lo levanta el barrido horario (lib/etiquetas.ts, conciliarEspejoEtapas).
 * Va por import dinámico por la misma razón que `enrolarPorEvento`: lib/etiquetas.ts importa este
 * módulo. Nunca tira, y se ESPERA: en una función serverless, lo que se lanza sin esperar puede
 * cortarse al responder (el patrón del `void actualizarEtiquetaLead` que esto reemplaza).
 * Adentro de un lote (`conLoteDeEtiquetas`) escribe la base y deja la sincronización para el final.
 */
/**
 * El rastro de la etapa que LIMPIÓ una reserva (undécima tanda, M6): una línea 'Etapa' del historial, firmada por
 * la AGENDA que la hizo (Calendly o Cal.com), con la etapa de antes y la de ahora. Hasta el 14/10/2026 la firmaba
 * MaKo, y ese «MaKo lo movió» desvió un diagnóstico: el que movió fue la reserva. La misma forma que `logLeadChanges` y el mismo `etapa_vista` (así la
 * pasada de los pendientes no la vuelve a escribir). Nunca tira: la reserva ya entró.
 */
async function auditarEtapaDeLaReserva(leadId: number, antes: string, despues: Lead, autor: string): Promise<void> {
  try {
    const cambio = cambioDeEtapa(despues, antes);
    if (!cambio) return;
    const { error } = await (await getTenantDb()).from('lead_audit')
      .insert([{ lead_id: leadId, campo: CAMPO_ETAPA, valor_anterior: cambio.desde, valor_nuevo: cambio.hacia, autor }]);
    if (error) { console.error(`[leads] el historial de la etapa que limpió la reserva del lead ${leadId}: ${error.message}`); return; }
    await marcarEtapaVista([leadId], cambio.hacia);
  } catch (e) {
    console.error(`[leads] el historial de la etapa que limpió la reserva del lead ${leadId}:`, e instanceof Error ? e.message : String(e));
  }
}

/**
 * Inscribe al lead en las automatizaciones de la etapa a la que acaba de llegar por DERIVACIÓN (undécima tanda,
 * M1-b): el MISMO evento que el movimiento explícito (`setBoardStageOverride` → `enrolarPorEvento('etapa')`). Desde
 * el 14/10/2026 también lo usa `setPipelineStage`, que hasta ese día no inscribía. Import
 * dinámico (lib/nutricion.ts importa este módulo) y nunca tira: el guardado del lead no puede fallar por la
 * nutrición; lo que no entre, lo levanta el barrido de la hora.
 */
async function enrolarPorEtapaDerivada(leadId: number, etapa: string, funnelId: number | null): Promise<void> {
  try {
    const { enrolarPorEvento } = await import('./nutricion');
    await enrolarPorEvento(leadId, 'etapa', { etapa, funnelId });
  } catch (e) {
    console.error(`[leads] no pude enrolar al lead ${leadId} por llegar a «${etapa}»:`, e instanceof Error ? e.message : String(e));
  }
}

async function espejarEtiquetasDeEtapa(leadId: number, funnelId: number | null, desde: string | null, hacia: string, autor?: string): Promise<void> {
  try {
    const { espejarEtapa } = await import('./etiquetas');
    await espejarEtapa(leadId, funnelId, desde, hacia, { autor });
  } catch (e) {
    console.error(`[leads] el espejo de etiquetas del lead ${leadId} falló:`, e instanceof Error ? e.message : String(e));
  }
}

/**
 * Persiste SOLO el override de la columna del tablero (pipeline_stage) y el
 * deadline de nutrición manual, sin tocar estado_lead (el editor ya lo sincroniza
 * vía updateLead). El deadline solo vive en 'manual'; en otra etapa se limpia.
 * stageKey=null limpia el override (vuelve a la derivación automática).
 */
export async function setBoardStageOverride(id: number, stageKey: string | null, deadline: string | null): Promise<void> {
  const supabase = await getTenantDb();
  // La etapa ANTERIOR y el embudo del lead, antes de escribir. Las dos cosas son para el
  // disparo de abajo: una secuencia de etapa se dispara cuando el lead CAE en la etapa,
  // no cada vez que alguien guarda la ficha con la misma etapa puesta.
  // (+ los campos de la etapa DERIVADA, para el espejo de etiquetas de abajo)
  const { data: previo } = await supabase.from('leads').select(COLS_ETAPA_PREVIA).eq('id', id).limit(1);
  const antes = ((previo ?? []) as Array<{ pipeline_stage: string | null; funnel_id: number | null } & StageDerivable>)[0];

  const patch: Record<string, unknown> = {
    pipeline_stage: stageKey,
    nutricion_manual_deadline: stageKey === 'manual' ? (deadline ?? null) : null,
  };
  if (stageKey && NUTRI_KEYS.includes(stageKey)) patch.nutricion_realizada = true;
  const { error } = await supabase.from('leads').update(patch).eq('id', id);
  if (error) throw new Error(`Error guardando etapa del lead ${id}: ${error.message}`);

  /**
   * ⚠️ EL DISPARO DE UNA SECUENCIA DE ETAPA VA ACÁ, QUE ES EL CHOKE POINT.
   *
   * Pedido de Martín (05/10/2026): «un CRON que se active mediante que un lead caiga en X
   * etapa de X producto». El dato existía —`trigger_tipo='etapa_actual'` + `etapa` +
   * `funnel_id`— y lo descubría sólo el barrido horario del cron, así que mover un lead y
   * que le llegue el mensaje estaban separados por hasta una hora.
   *
   * Va en esta función y no en los call sites porque por acá pasan TODOS los caminos que
   * escriben la columna del tablero: la ficha (`saveLeadEditorAction`), el arrastre del
   * kanban, la confirmación de MaKo y el «volver a derivación». Es la regla de la casa:
   * lo que vale para todos los cambios se escribe donde pasan todos — puesto en cada
   * camino, el quinto nace sin disparar y nadie se entera.
   *
   * Tres cosas que NO hace, a propósito:
   * · NO dispara si la etapa no cambió. Guardar la ficha reescribe la misma etapa, y un
   *   mensaje por guardado es cómo se quema una línea de WhatsApp.
   * · NO dispara con `stageKey = null` («volver a la derivación automática»): ahí la
   *   etapa efectiva la calcula el funnel a partir de las fechas, y afirmar una acá sería
   *   inventarla. Esos casos los sigue levantando el cron, que deriva de verdad.
   * · NO tira nunca. Mover un lead tiene que funcionar aunque la nutrición falle; el
   *   fallo queda en el log y el cron lo levanta en la próxima corrida.
   *
   * ⚠️ Y LA ETAPA DERIVADA NO PASA POR ACÁ. Un lead al que le cargan la fecha de la J1
   * cambia de etapa EFECTIVA sin que nadie escriba `pipeline_stage`. Ese camino sigue
   * siendo del cron (`leadsDeCohorte('etapa_actual', …)`, que deriva la etapa en memoria):
   * lo que esto agrega es el disparo instantáneo del movimiento EXPLÍCITO, que es el que
   * la persona hace con la mano y el que espera ver salir.
   */
  if (stageKey && antes && antes.pipeline_stage !== stageKey) {
    try {
      // Import dinámico: `lib/nutricion.ts` importa este módulo, y un import estático de
      // vuelta es un ciclo que rompe según quién se cargue primero — y falla distinto en
      // el server, en el cliente y en los tests.
      const { enrolarPorEvento } = await import('./nutricion');
      await enrolarPorEvento(id, 'etapa', { etapa: stageKey, funnelId: antes.funnel_id ?? null });
    } catch (e) {
      console.error(`[leads] no pude enrolar al lead ${id} por caer en «${stageKey}»:`, e instanceof Error ? e.message : String(e));
    }
  }

  // Las etiquetas vinculadas, contra la etapa que SE VEÍA (también al volver a la derivación).
  const nueva = stageKey ?? (antes ? deriveStageKey({ ...antes, pipeline_stage: null }) : null);
  if (antes && nueva && pipelineStageOf(antes) !== nueva) await espejarEtiquetasDeEtapa(id, antes.funnel_id ?? null, pipelineStageOf(antes), nueva);
}

export async function saveLeadMeta(id: number, meta: LeadMetaInput): Promise<void> {
  const supabase = (await getTenantDb());
  const payload: Record<string, unknown> = {};
  if (meta.closer !== undefined) payload.closer = meta.closer;
  if (meta.setter !== undefined) payload.setter = meta.setter;
  if (meta.fathom_links !== undefined) payload.fathom_links = meta.fathom_links;
  if (meta.motivo_perdida !== undefined) payload.motivo_perdida = meta.motivo_perdida;
  if (meta.fecha_junta_1 !== undefined) payload.fecha_junta_1 = meta.fecha_junta_1;
  if (meta.fecha_junta_2 !== undefined) payload.fecha_junta_2 = meta.fecha_junta_2;
  if (meta.nutricion_manual_deadline !== undefined) payload.nutricion_manual_deadline = meta.nutricion_manual_deadline;
  if (meta.nombre !== undefined && meta.nombre) payload.nombre = meta.nombre;
  if (meta.email !== undefined) payload.email = meta.email;
  if (meta.empresa !== undefined) payload.empresa = meta.empresa;
  if (meta.web !== undefined) payload.web = meta.web;
  if (meta.ingreso_estimado !== undefined) payload.ingreso_estimado = meta.ingreso_estimado;
  if (meta.instagram !== undefined) payload.instagram = meta.instagram;
  // ⚠️ VIENEN DEL NAVEGADOR (`saveLeadMetaAction` es una server action): se recortan, y el sexo
  // sólo acepta los tres valores del check de la mig 0274 — otro valor rechazaría el update entero.
  for (const k of ['youtube', 'linkedin', 'direccion'] as const) {
    if (meta[k] !== undefined) payload[k] = String(meta[k] ?? '').trim().slice(0, 300) || null;
  }
  if (meta.sexo !== undefined) {
    if (meta.sexo !== null && meta.sexo !== '' && !esSexo(meta.sexo)) throw new Error('Ese sexo no es una opción.');
    payload.sexo = meta.sexo || null;
  }
  if (meta.telefono !== undefined) { payload.telefono = meta.telefono; payload.telefono_normalizado = normalizarTelefono(meta.telefono); }
  if (Object.keys(payload).length === 0) return;
  // Una FECHA DE REUNIÓN cargada acá cambia la etapa derivada como en `updateLead` (M1-b): se lee la etapa de antes
  // sólo si viene una fecha, y nunca tira (sin leerla, lo levanta el barrido de la hora).
  const conFecha = meta.fecha_junta_1 !== undefined || meta.fecha_junta_2 !== undefined;
  const antes = conFecha
    ? (((await supabase.from('leads').select(COLS_ETAPA_PREVIA).eq('id', id).limit(1)).data ?? []) as Array<{ funnel_id: number | null } & StageDerivable>)[0]
    : undefined;
  const { error } = await supabase.from('leads').update(payload).eq('id', id);
  if (error) throw new Error(`Error guardando datos del lead ${id}: ${error.message}`);
  if (antes) {
    const despues = pipelineStageOf({ ...antes, ...(payload as Partial<StageDerivable>) });
    if (entraAEtapaDeReunion(pipelineStageOf(antes), despues)) await enrolarPorEtapaDerivada(id, despues, antes.funnel_id ?? null);
  }
}

/**
 * "Datos sin marcar": TODOS los datos completables que la etapa ACTUAL del lead
 * adeuda (asistencia, calificado, Fathom de reuniones pasadas, monto, plan,
 * motivo, setter…), respetando las excepciones persistidas (sin_r1/sin_r2/
 * fathom_omitido). Fuente única para la ficha, el badge del Kanban y el worklist.
 * Solo pide lo POSIBLE de conseguir (el Fathom de una reunión futura no cuenta).
 */
export function faltantesDeLead(
  lead: Lead,
  tienePlan?: boolean,
  extra?: ExtraRequisitos,
): Step[] {
  const { stage, v } = requisitosDeLead(lead, tienePlan, extra);
  return stepsForStage(stage, v);
}

/**
 * Lo que la etapa del lead pide y YA está cargado (los «resueltos» del desplegable de la ficha).
 * Sale de los MISMOS valores que `faltantesDeLead` y de la misma regla (`pasosResueltos`).
 */
export function resueltosDeLead(lead: Lead, tienePlan?: boolean, extra?: ExtraRequisitos): Step[] {
  const { stage, v } = requisitosDeLead(lead, tienePlan, extra);
  return pasosResueltos(stage, v);
}

type ExtraRequisitos = { comprobantesFaltantes?: number; r2RespuestasOk?: boolean; pipeline?: Stage[]; grabable?: boolean };

/** La etapa vigente del lead y los valores con que se evalúan sus requisitos. UNA sola vez. */
function requisitosDeLead(lead: Lead, tienePlan?: boolean, extra?: ExtraRequisitos): { stage: string; v: StageReqValues } {
  // El override manual (pipeline_stage) vale SOLO si esa etapa sigue existiendo en
  // el funnel del workspace; si no, se deriva del estado del lead — la misma regla
  // que usa el board (crm-map). Sin este chequeo, un lead parado en una etapa que
  // ya no existe se evaluaba contra una etapa fantasma y NO se le exigía nada:
  // medido en ws1, 686 leads en 'reactivacion' / 'noshow_r1' (etapas que su funnel
  // no tiene) quedaban fuera de "datos sin marcar" aunque el Kanban los mostrara.
  const override = lead.pipeline_stage?.trim();
  const vigente = !override || !extra?.pipeline || extra.pipeline.some((s) => s.key === override);
  const stage = override && vigente ? override : deriveStageKey(lead);
  // Si el caller pasa el funnel del workspace, derivamos nivel/reuniones/venta de
  // SU pipeline (funnels no-default); si no, stepsForStage cae al funnel default.
  const info = extra?.pipeline ? funnelReqInfo(extra.pipeline, stage) : undefined;
  const links = ((lead.fathom_links ?? []) as FathomLink[]).filter((f) => f.url);
  const oblig = lead.deal_obligaciones;
  const tieneR2 = !!lead.fecha_junta_2 || lead.asistio_j2 != null;
  // Un lead en NUTRICIÓN (no agendó / se enfrió / manual) es un contacto frío: no
  // tiene sentido exigirle "Empresa" como dato sin marcar. undefined → se saltea.
  const enNutricion = NUTRI_KEYS.includes(stage);
  return { stage, v: {
    fechaJ1: lead.fecha_junta_1,
    asistioJ1: lead.asistio_j1,
    calificado: lead.calificado,
    fechaJ2: lead.fecha_junta_2,
    asistioJ2: lead.asistio_j2,
    hasFathomUrl: links.length > 0,
    grabable: extra?.grabable,
    monto: lead.monto_cierre_usd,
    // Venta recurrente: el importe vive en el MRR y `monto_cierre_usd` queda null.
    suscripcionMonto: lead.venta_tipo === 'suscripcion' ? (lead.suscripcion_monto_usd ?? null) : null,
    // Un becado («sin cobro», #747): sin esto quedaba para siempre en «Datos sin marcar».
    ventaTipo: lead.venta_tipo,
    motivo: lead.motivo_perdida,
    setter: lead.setter,
    closer: lead.closer,
    telefono: lead.telefono,
    empresa: enNutricion ? undefined : lead.empresa,
    // Deal Details desglosado (solo se evalúa en ganado).
    dealServicioOk: !!(lead.deal_servicio?.que_es?.trim()),
    dealPromesaOk: !!(lead.deal_promesa?.resultado?.trim()),
    dealFiscalOk: !!(lead.deal_fiscal?.razon?.trim()),
    // Documento fiscal: presente O declarado omitido (no se vuelve a exigir).
    dealFiscalDocOk: !!(lead.deal_fiscal?.doc_path?.trim()) || !!lead.deal_fiscal_doc_omitido,
    dealObligacionesOk: !!((oblig?.cliente?.length ?? 0) > 0 || (oblig?.prestador?.length ?? 0) > 0),
    // Comprobantes: si se declararon omitidos, no faltan.
    comprobantesFaltantes: lead.comprobante_omitido ? 0 : extra?.comprobantesFaltantes,
    tieneR2,
    // Respuestas R2: las de Calendly O el motivo de haberse agendado fuera de Calendly.
    r2RespuestasOk: (extra?.r2RespuestasOk ?? false) || !!lead.r2_agenda_externa_motivo?.trim(),
    // Una suscripción ES su plan (el monto mensual), aunque no tenga ni una cuota
    // cargada: el mismo criterio que el wizard (`valoresDeRequisitos`). Sin esto,
    // un cierre recurrente movido con éxito reaparecía al toque en "Datos sin
    // marcar" pidiendo un plan de pagos que no existe para esa venta.
    tienePlan: lead.venta_tipo === 'suscripcion' ? undefined : tienePlan,
    hoyISO: hoyEnTijuana(),
    // Timestamps con hora (Calendly): "ya pasó" mira la hora real, no solo el día,
    // así una reunión de HOY que ya terminó exige cargar el Fathom.
    atJ1: lead.junta_1_at,
    atJ2: lead.junta_2_at,
    sinR1: !!lead.sin_r1,
    sinR2: !!lead.sin_r2,
    fathomOmitido: !!lead.fathom_omitido,
    nivel: info?.nivel,
    numReuniones: info?.numReuniones,
    esVenta: info?.esVenta,
  } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing visits (migración 0021) — pageviews de la landing, aparte del VSL
// ─────────────────────────────────────────────────────────────────────────────

export type VisitasLanding = {
  total_visitas: number;
  dias_distintos: number;
  primera_visita: string | null;
  ultima_visita: string | null;
  fechas: string[]; // YYYY-MM-DD distintas, ascendente
};

const SIN_VISITAS: VisitasLanding = {
  total_visitas: 0, dias_distintos: 0, primera_visita: null, ultima_visita: null, fechas: [],
};

function resumirVisitas(rows: Array<{ created_at: string }>): VisitasLanding {
  if (rows.length === 0) return { ...SIN_VISITAS };
  const ordenadas = rows.map((r) => r.created_at).sort();
  const fechas = [...new Set(ordenadas.map((c) => c.slice(0, 10)))].sort();
  return {
    total_visitas: rows.length,
    dias_distintos: fechas.length,
    primera_visita: ordenadas[0],
    ultima_visita: ordenadas[ordenadas.length - 1],
    fechas,
  };
}

/**
 * Resumen de visitas a la landing de UN visitor_id. No toca vsl_events.
 */
export async function contarVisitasLanding(visitorId: string | null): Promise<VisitasLanding> {
  if (!visitorId) return { ...SIN_VISITAS };
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('landing_visits')
    .select('created_at')
    .eq('visitor_id', visitorId);
  if (error) {
    console.error(`[contarVisitasLanding] falló: ${error.message}`);
    return { ...SIN_VISITAS };
  }
  return resumirVisitas((data ?? []) as Array<{ created_at: string }>);
}

/**
 * Versión por lote: visitas por visitor_id para una lista (evita N queries en
 * la tabla del CRM). Devuelve un Map visitor_id → VisitasLanding.
 */
export async function getVisitasLandingMap(
  visitorIds: Array<string | null | undefined>,
): Promise<Map<string, VisitasLanding>> {
  const ids = [...new Set(visitorIds.filter((v): v is string => !!v))];
  const out = new Map<string, VisitasLanding>();
  if (ids.length === 0) return out;
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('landing_visits')
    .select('visitor_id, created_at')
    .in('visitor_id', ids);
  if (error) {
    console.error(`[getVisitasLandingMap] falló: ${error.message}`);
    return out;
  }
  const porVisitor = new Map<string, Array<{ created_at: string }>>();
  for (const r of (data ?? []) as Array<{ visitor_id: string; created_at: string }>) {
    const arr = porVisitor.get(r.visitor_id) ?? [];
    arr.push({ created_at: r.created_at });
    porVisitor.set(r.visitor_id, arr);
  }
  for (const [vid, rows] of porVisitor) out.set(vid, resumirVisitas(rows));
  return out;
}
