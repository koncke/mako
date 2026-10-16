// =============================================================================
// plantillas-automatizaciones — la GALERÍA de automatizaciones para arrancar de una hecha
// =============================================================================
// Pedido de Martín (10/10/2026): «Si, hagamos la galería de las más comunes...». Y el de la undécima tanda
// (11/10/2026, punto 10), textual: «Revisa los templates, para complejizarlos con todo esto... Prefiero que los
// templates en lugar de crear muchos "pequeños flujos" creen uno que incluya todo la categoría... Si es "Un Lead Agendó
// Llamada", y así con los demás templates... Piensa en que se podría avisar por WhatsApp de MaKo, etc...».
//
// ⚠️ «PLANTILLA» ACÁ NO ES UN MENSAJE DE MaKo EN WHATSAPP. En el código, `lib/plantillas.ts` y
// `lib/avisos-catalogo.ts` son los mensajes de MaKo (docs/hallazgos-chatbot.md, «"Las plantillas"
// son dos cosas»). Esto es la tercera cosa: una AUTOMATIZACIÓN de la tab Automations armada de
// antemano, que se copia al workspace de quien la elige y nace APAGADA.
//
// ── UNA PLANTILLA POR CATEGORÍA (undécima tanda, docs/diseno-undecima-tanda.md §2 punto 10 y §7) ─────────────
// Son 13, en orden de embudo. Cada una junta TODO lo de su momento: lo que le llega al lead (WhatsApp, Email, DM), el
// aviso al equipo (la tarjeta «MaKo en WhatsApp») y UN AI Step con su objetivo. Las 25 que eran «pedacitos» de una
// categoría quedan en `PLANTILLAS_REEMPLAZADAS` (id viejo → la nueva): crear con un id viejo contesta 400 y nombra la
// nueva (lib/plantilla-crear.ts), nunca crea otra cosa en silencio.
//
// LA REGLA DE MARTÍN, PEDIDA CON ENOJO: «NUNCA una versión vieja ni nada inventado». Cada plantilla se arma SÓLO con las
// piezas del lienzo de hoy, y el test (tests/plantillas-automatizaciones.test.ts) lo mide con las MISMAS funciones que
// usa Publicar y el script de prod:
//   · `problemasDeForma` (lib/flujo-forma.ts) vacío: ni dos CONDITION pegadas, ni CONDITION → DELAY → CONDITION (entre
//     dos condiciones va siempre un mensaje o un aviso), ni `{{mensaje_mako}}`, ni más de un AI Step por medio;
//   · `problemasDeTokens` (lib/tokens-del-flujo.ts) vacío: cada dato se resuelve en SU tarjeta (los del equipo, sólo en
//     «MaKo en WhatsApp»);
//   · `validarGrafo` y el freno de Publicar del lienzo.
//
// LAS PIEZAS:
//   · EL CRON ES UNA ETAPA DEL EMBUDO (`cron.pide`): la etapa es del negocio, así que la pantalla la pide al elegir
//     (app/automations/GaleriaPlantillas.tsx) con las MISMAS opciones que el editor del CRON; sin elegir, nace con el
//     CRON a elegir. Las de un canal traen su CRON puesto con TODOS los eventos de la categoría en la MISMA fila
//     (`cron.fijo` + `eventos`: un disparador por evento). Las de un Evento de MaKo, con su evento (`cron.evento`).
//   · CADA CAMINO PREGUNTA SU CANAL EN LA CONDICIÓN DE ENTRADA: un email a quien no tiene email (o un WhatsApp a quien no
//     tiene teléfono) cancela la inscripción ENTERA (lib/nutricion.ts), no sólo ese mensaje.
//   · «Sale sola» va EXPLÍCITO en cada mensaje (`revisar`). La plata y lo sensible, para aprobar.
//   · «MaKo en WhatsApp» con `params.partes` (lib/mako-tarjeta.ts): sale TAL CUAL, así que lleva a la vista lo que el
//     equipo necesita (`{{nombre_completo}}`, `{{lead_telefono}}`, `{{link_lead}}`): una tarjeta nueva no agrega nada sola.
//     Un renglón cuyo dato no tiene valor se va entero (`sinRenglonesVacios`): por eso cada dato opcional va en su renglón.
//   · EL AI STEP (`aiStep`): UNO por plantilla, con el OBJETIVO en la tarjeta y sus escenarios del CATÁLOGO
//     (lib/ai-step-escenarios.ts, `ESCENARIOS_TIPICOS`: una sola copia de los textos). Sin tarjetas debajo. No va en las
//     de Evento de MaKo (no hay lead que conteste), ni en Instagram/Messenger (hoy un AI Step contesta por WhatsApp:
//     docs/diseno-ai-step-v2.md §6), ni en las de email.
//   · LO QUE PREPARA UNA REUNIÓN usa los datos «Próxima reunión» (`{{reunion_cuando}}`, `{{reunion_hora}}`…) y cada
//     mensaje cuelga de una espera «antes de la reunión» o de una condición «Próxima reunión en ≤ 720 h»: el motor
//     ancla los recordatorios en la próxima reunión (el carril, M3) y una reunión que ya pasó no recibe nada.
//
// ⚠️ PURO Y SIN `server-only`: lo importan la pantalla (la galería), el server (lib/plantilla-crear.ts), «Crear con IA»
// (lib/flujo-ia.ts: la plantilla más cercana es el ejemplo del modelo), la API (chatbot.run.ts) y los tests.
// =============================================================================

import { claseDe, ID_INICIO, type PasoGrafo, type FilaCondicion, type Espera } from './flujo-grafo';
import { LEAD_DEL_EVENTO } from './api-mako/flujo-params';
import { OP_AVISAR } from './flujo-legado';
import {
  pasosDisparo, pedidoDisparo, rotuloDisparo, PASO_PRODUCTOS, KANBAN_ADQUISICION, KANBAN_ENTREGA,
  type ProductoParaDisparo, type SeccionDisparo,
} from './flujo-conversacion';
import {
  EVENTOS_MAKO, TRIGGER_AVISO_MAKO, TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO, TRIGGER_PAGO,
  type Disparador, type SubtipoMako,
} from './disparadores';
import { TOPE_NOMBRE_SECUENCIA } from './setting-estrategia';
// Los escenarios del AI Step: UNA copia (undécima tanda), la galería los toma de ahí.
import { escenarioTipico } from './ai-step-escenarios';
// La tarjeta «MaKo en WhatsApp» con su lista (`partes`): la MISMA forma que escribe el editor.
import { paramsConPartes } from './mako-tarjeta';

// ── El dato ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Lo que la pantalla pide al crearla: una etapa de la VENTA (el embudo), una de la ENTREGA del servicio, o una
 * ETIQUETA del negocio («Se le puso [Suscriptor]», décima tanda).
 */
export type PideCron = 'etapa_venta' | 'etapa_entrega' | 'etiqueta';

/** El `trigger_tipo` de cada una (lib/nutricion-etapa.ts: `TRIGGER_ETAPA`, `TRIGGER_ENTREGA` y `TRIGGER_ETIQUETA`). */
export const TRIGGER_DE_PIDE: Readonly<Record<PideCron, string>> = {
  etapa_venta: 'etapa_actual',
  etapa_entrega: 'entrega_actual',
  etiqueta: 'etiqueta_puesta',
};

/**
 * Los CRON de un CANAL que una plantilla puede traer puestos: Instagram, Messenger, «Recibes un email» y «Pagos» (la
 * clase 'pagos', 11/10/2026). No son del emisor: se cambian después como cualquiera.
 */
export type FijoDeCanal = typeof TRIGGER_INSTAGRAM | typeof TRIGGER_MESSENGER | typeof TRIGGER_EMAIL_RECIBIDO | typeof TRIGGER_PAGO;

// ── El objetivo y el canal: el filtro de la galería (décima tanda) ──────────────────────────────────

/** Para qué sirve una plantilla. A MANO en cada una: no se deduce. */
export type ObjetivoPlantilla = 'captar' | 'agendar' | 'reunion' | 'recuperar' | 'vender' | 'clientes' | 'cobrar' | 'medir';

/** El grupo «Objetivo» del filtro, en este orden (el del embudo: de captar a cobrar). */
export const OBJETIVOS_PLANTILLA: ReadonlyArray<{ id: ObjetivoPlantilla; label: string }> = [
  { id: 'captar', label: 'Captar' },
  { id: 'agendar', label: 'Agendar' },
  { id: 'reunion', label: 'Reunión' },
  { id: 'recuperar', label: 'Recuperar' },
  { id: 'vender', label: 'Vender' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'cobrar', label: 'Cobrar' },
  { id: 'medir', label: 'Medir' },
];

/** Por dónde sale una plantilla. `mako` = «MaKo en WhatsApp» (el grupo del negocio). */
export type CanalPlantilla = 'whatsapp' | 'email' | 'instagram' | 'messenger' | 'mako';

export type CronDePlantilla =
  | {
    pide: PideCron;
    /** Qué etapa conviene elegir, dicho como la ve el negocio. Va debajo del desplegable. */
    ayuda: string;
    fijo?: undefined; evento?: undefined; eventos?: undefined;
  }
  /**
   * UN EVENTO DE MaKo (11/10/2026): el CRON «Evento de MaKo» con CUÁL evento (`disparadores[0].subtipo`). Nace en la
   * fila (`filaDePlantilla`) porque `setSecuenciaPasos` lee el evento para frenar lo que su emisor no sabe mandar
   * (`frenoDelEvento`, lib/aviso-evento.ts). Es del emisor: no se cambia.
   */
  | { fijo: typeof TRIGGER_AVISO_MAKO; evento: SubtipoMako; pide?: undefined; ayuda?: undefined; eventos?: undefined }
  /**
   * LOS EVENTOS DE UN CANAL (undécima tanda: «uno que incluya toda la categoría»): Instagram, Messenger, «Recibes un
   * email» o «Pagos», con TODOS los eventos de la categoría en la MISMA fila (un disparador por evento, d1…dN). Nace en
   * la fila como el de MaKo, pero NO es del emisor: el CRON se cambia después como cualquiera.
   */
  | { fijo: FijoDeCanal; eventos: readonly string[]; pide?: undefined; ayuda?: undefined; evento?: undefined };

/** Un paso de una plantilla: una tarjeta del lienzo, como la arma el ＋ (`nodoNuevo`). */
export type PasoDePlantilla = PasoGrafo & {
  accion?: { operacion: string; params: Record<string, unknown> };
  /** Sólo email: la vista previa. */
  preheader?: string | null;
};

export type PlantillaAutomatizacion = {
  /** Estable: es lo que manda la pantalla al elegirla (y la API: `crear_automatizacion_desde_plantilla`). */
  id: string;
  /** El nombre con que nace (tope `TOPE_NOMBRE_SECUENCIA`). */
  nombre: string;
  emoji: string;
  /** Para qué sirve, en una línea (`TOPE_LINEA`). */
  linea: string;
  /** De qué salió. Para el que la mantenga: no se dibuja. */
  origen: string;
  /** Para qué sirve (el filtro «Objetivo»). El canal NO va acá: se deriva (`canalesDe`). */
  objetivo: ObjetivoPlantilla;
  cron: CronDePlantilla;
  pasos: readonly PasoDePlantilla[];
  /**
   * SÓLO PARA LA PLATAFORMA (15/10/2026): una automatización de SuperAdmin (la de un evento de una PERSONA, que emite
   * sólo la plataforma en su ws). Un negocio no la ve en la galería ni la puede crear (`crearDesdePlantilla`).
   */
  soloPlataforma?: true;
};

/** El tope de la línea de una tarjeta: el de una fila de una lista de N (AGENTS.md, «La pantalla dice QUÉ pasó»). */
export const TOPE_LINEA = 110;

/**
 * EL NOMBRE DE «MaKo en WhatsApp» (el grupo del negocio): el canal del filtro de la galería. Undécima tanda (punto 9):
 * la lista ya no tiene una sección con este nombre; queda como el rótulo del canal.
 */
export const ROTULO_MENSAJES_MAKO = 'MaKo en WhatsApp';

/** ¿Es una plantilla de un Evento de MaKo? (nace con ese CRON, que no se cambia). */
export const esPlantillaMako = (p: Pick<PlantillaAutomatizacion, 'cron'>): boolean => p.cron.fijo === TRIGGER_AVISO_MAKO;

// ── Las piezas (lo mismo que nace del ＋ del lienzo, `nodoNuevo` en lib/flujo-conversacion.ts) ────

const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' } as const;

/** Un mensaje de WhatsApp. `ia` = ✦ «MaKo lo adapta» (el texto es la base y el respaldo, lib/paso-ia.ts). */
function whatsapp(id: string, cuerpo: string, siguiente: string | null, o: { revisar: boolean; ia?: boolean }): PasoDePlantilla {
  return { ...RELLENO, id, cuerpo, siguiente, revisar: o.revisar, ...(o.ia ? { tipo: 'ia' } : {}) };
}

function email(id: string, asunto: string, vistaPrevia: string, cuerpo: string, siguiente: string | null, o: { revisar: boolean }): PasoDePlantilla {
  return { ...RELLENO, id, canal: 'email', asunto, preheader: vistaPrevia, cuerpo, siguiente, revisar: o.revisar };
}

/**
 * Un DM de Instagram o un mensaje de Messenger: el mismo paso con su canal, como lo arma el ＋ (`nodoNuevo`). Sale por
 * Zernio y SÓLO texto: la respuesta privada a un comentario es una y sin archivos (lib/canal-social.ts).
 */
function social(canal: 'instagram' | 'messenger', id: string, cuerpo: string, siguiente: string | null, o: { revisar: boolean }): PasoDePlantilla {
  return { ...RELLENO, id, canal, cuerpo, siguiente, revisar: o.revisar };
}

function esperar(id: string, minutos: number, siguiente: string | null, modo: Espera['modo'] = 'tiempo'): PasoDePlantilla {
  return { ...RELLENO, id, nodo: 'esperar', espera: { modo, minutos }, siguiente };
}

/** «N antes de la reunión»: el DELAY que el motor ancla en la próxima reunión del lead (el carril de M3). */
const antesDeLaReunion = (id: string, minutos: number, siguiente: string | null) => esperar(id, minutos, siguiente, 'antes_reunion');

/** Una rama: sus filas unidas con «y», y a dónde sigue. */
type Rama = readonly [filas: readonly FilaCondicion[], siguiente: string | null];

/**
 * UNA CONDITION con VARIAS RAMAS en la MISMA tarjeta (gana la primera que se cumple) y «Si no» → `siNo`. Martín, punto 3:
 * «tenemos la opción de en una misma tarjeta de condition poner más de 1».
 */
function condicion(id: string, ramas: readonly Rama[], siNo: string | null): PasoDePlantilla {
  return {
    ...RELLENO, id, nodo: 'condicion', si_no: siNo,
    ramas: ramas.map(([filas, siguiente], k) => ({
      id: `${id}_${k === 0 ? 'si' : `r${k + 1}`}`, modo: 'todas' as const,
      filas: filas.map((f, j) => (j === 0 ? { ...f } : { ...f, union: 'y' as const })), siguiente,
    })),
  };
}

/**
 * LA TARJETA «MaKo EN WHATSAPP»: el aviso al grupo del negocio sobre el lead del evento (`avisar_al_equipo`), con su
 * lista explícita (`paramsConPartes`): sale TAL CUAL, sin título ni firma (lib/mako-tarjeta.ts).
 */
function mako(id: string, texto: string, siguiente: string | null): PasoDePlantilla {
  return { ...RELLENO, id, siguiente, accion: { operacion: OP_AVISAR, params: paramsConPartes({ leadId: LEAD_DEL_EVENTO }, [{ tipo: 'texto', cuerpo: texto }]) } };
}

/** LA MISMA TARJETA POR EMAIL («MaKo por email», 16/10/2026): un correo al equipo del negocio, con su asunto. */
function makoEmail(id: string, asunto: string, texto: string, siguiente: string | null): PasoDePlantilla {
  return { ...RELLENO, id, siguiente, accion: { operacion: OP_AVISAR, params: paramsConPartes({ leadId: LEAD_DEL_EVENTO, canal: 'email', asunto }, [{ tipo: 'texto', cuerpo: texto }]) } };
}

/**
 * EL AI STEP de la plantilla: UNA tarjeta con su OBJETIVO y los escenarios del CATÁLOGO (`escenarioTipico`, con su
 * libertad: la escribe `camposDeLibertad`). `casos`: la clave del catálogo y el id del caso. De WhatsApp (`medio`
 * ausente), colgada del CRON y sin tarjetas debajo; «Lo demás» avisa con el texto de siempre (`AVISO_OTRA_COSA`).
 * Una clave que no existe TIRA: es un error de quien arma la plantilla.
 */
function aiStep(id: string, o: { objetivo: string; casos: ReadonlyArray<readonly [clave: string, casoId: string]> }): PasoDePlantilla {
  if (!o.objetivo.trim()) throw new Error(`el AI Step ${id} de la galería no tiene objetivo`);
  return { ...RELLENO, id, nodo: 'respuesta', paso_ia: true, objetivo: o.objetivo, casos: o.casos.map(([clave, casoId]) => escenarioTipico(clave, casoId)), si_no: null };
}

/**
 * EL CRON CON VARIOS CAMINOS: la tarjeta de inicio (`ID_INICIO`, la misma que arma el ＋ del CRON), con la principal en
 * `siguiente` y los demás caminos en paralelo. Va AL FINAL del array, como la deja `insertarNodo`.
 */
function inicio(principal: string, paralelos: readonly string[]): PasoDePlantilla {
  return { ...RELLENO, id: ID_INICIO, nodo: 'inicio', siguiente: principal, paralelos: [...paralelos] };
}

// Las filas que se repiten (todas del catálogo de condiciones, lib/condiciones-catalogo.ts). Ninguna necesita un
// dato del negocio (ni una etiqueta ni una etapa).
const NO_AGENDO: FilaCondicion = { campo: 'agendo', no: true };
const YA_LE_ESCRIBISTE: FilaCondicion = { campo: 'ya_contactado' };
const NO_PAGO: FilaCondicion = { campo: 'pago', no: true };
/**
 * «No contestó desde que entró» (`contesto` negada, 14/10/2026). Que el lead conteste ya no corta nada por detrás: va
 * en la condición de cada seguimiento que da por hecho que no contestó («¿pudiste ver mi mensaje?», «agendó y no
 * confirmó»). Quien contestó lo atiende el AI Step.
 */
const NO_CONTESTO: FilaCondicion = { campo: 'contesto', no: true };
const CONTESTO: FilaCondicion = { campo: 'contesto' };
const TIENE_WHATSAPP: FilaCondicion = { campo: 'tiene_telefono' };
const TIENE_EMAIL: FilaCondicion = { campo: 'tiene_email' };
/**
 * «Llegó hace menos de 72 h»: en la PRIMERA tarjeta y en TODAS sus ramas, así el motor la mira también al inscribir
 * (`antiguedadDeEntrada`, lib/flujo-grafo.ts): prender la automatización no inscribe a los leads de hace un mes.
 */
const RECIENTE: FilaCondicion = { campo: 'antiguedad', valor: 72 };
/**
 * «Su reunión sigue en pie»: no se canceló, no tiene la asistencia marcada y no pasó (una fecha sin hora, hasta el final
 * de su día). Va antes de cada mensaje que habla de la reunión: al prender, el CRON inscribe a todos los que están en la
 * etapa, también al que la tuvo hace un mes (AGENTS.md, «Un mensaje que habla de un MOMENTO se re-pregunta al salir»).
 * Desde el 14/10/2026 reemplaza a «Próxima reunión en ≤ 720 h», que leía una fecha sin hora como el mediodía (el bug 5
 * de la guarda escondida) y no veía una cancelada; y es la condición VISIBLE de lo que el motor hacía por detrás.
 */
const EN_PIE: FilaCondicion = { campo: 'reunion_en_pie' };
/** «Sigue en la etapa del CRON»: la etapa la dice el CRON de la automatización (lib/condiciones-catalogo.ts). */
const SIGUE_EN_LA_ETAPA: FilaCondicion = { campo: 'sigue_en_etapa_cron' };

const HORA = 60;
const DIA = 24 * HORA;

// ── La galería: 13, en orden de embudo (docs/diseno-undecima-tanda.md §2, punto 10) ──────────────────

export const PLANTILLAS: readonly PlantillaAutomatizacion[] = [
  {
    // (1) Junta «Bienvenida — dejó sus datos y no agendó» (#198 ws1, #209 ws4) y «Último intento a un lead frío».
    // La antigüedad va en las DOS ramas de la entrada: `antiguedadDeEntrada` filtra a los viejos al inscribir.
    id: 'lead-entro',
    nombre: 'Un Lead Entró',
    emoji: '👋',
    linea: 'Saluda a quien deja sus datos, insiste si no agenda y te avisa si se enfría.',
    origen: 'undécima tanda: bienvenida-sin-agenda (#198, #209) + ultimo-intento',
    objetivo: 'agendar',
    cron: { pide: 'etapa_venta', ayuda: 'La etapa donde entran los leads nuevos.' },
    pasos: [
      condicion('le_entrada', [[[RECIENTE, NO_AGENDO, TIENE_WHATSAPP], 'le_w1'], [[RECIENTE, NO_AGENDO, TIENE_EMAIL], 'le_m1']], null),
      whatsapp('le_w1', 'Hola {{nombre}} 👋 Gracias por dejarnos tus datos. ¿Te gustaría agendar una llamada corta para ver cómo podemos ayudarte?', 'le_e1', { revisar: false }),
      esperar('le_e1', DIA, 'le_c1'),
      condicion('le_c1', [[[NO_AGENDO, NO_CONTESTO], 'le_w2']], null),
      whatsapp('le_w2', '{{nombre}}, ¿pudiste ver mi mensaje? Si quieres, respóndeme por aquí y te ayudo a encontrar un horario.', 'le_e2', { revisar: false, ia: true }),
      esperar('le_e2', 6 * DIA, 'le_c2'),
      condicion('le_c2', [[[NO_AGENDO, NO_CONTESTO], 'le_w3']], null),
      // A quien no contestó no se le manda solo ni el mismo texto a todos (AGENTS.md: lo que protege una línea no
      // oficial es el ritmo y el contenido): MaKo lo adapta y queda para aprobar.
      whatsapp('le_w3', '{{nombre}}, te escribo por última vez para no molestarte: ¿sigue en tus planes? Si quieres, respóndeme por aquí y lo vemos.', 'le_mk', { revisar: true, ia: true }),
      mako('le_mk', 'Pasó una semana y no agendó: {{nombre_completo}}. Te dejé un último mensaje para aprobar.\n👉 {{link_lead}}', null),
      email('le_m1', 'Gracias por tus datos', '¿Hablamos en una llamada corta?',
        'Hola {{nombre}}:\n\nGracias por dejarnos tus datos. Si quieres, agendamos una llamada corta para ver cómo podemos ayudarte: responde este correo y lo coordinamos.', 'le_e3', { revisar: false }),
      esperar('le_e3', 2 * DIA, 'le_c3'),
      condicion('le_c3', [[[NO_AGENDO, NO_CONTESTO], 'le_m2']], null),
      email('le_m2', '¿Lo vemos juntos?', 'Una llamada corta y lo vemos.',
        'Hola {{nombre}}:\n\n¿Pudiste ver mi correo? Si todavía te interesa, responde este correo y buscamos un horario para hablar.', null, { revisar: false }),
      aiStep('le_ia', { objetivo: 'Que agende una llamada', casos: [['quiere-agendar', 'le_c_agendar'], ['precio-llamada', 'le_c_precio'], ['no-le-interesa', 'le_c_no']] }),
    ],
  },
  {
    // (2) «UN LEAD AGENDÓ LLAMADA» (Martín, punto 8: «Debería estar todo en un mismo flujo»). Junta la preparación
    // (#212/#213, #221), el recordatorio de la reunión (#228: ahora son DELAY «antes de la reunión» del mismo flujo), el
    // aviso de nuevo agendado (#239/#240: ahora una «MaKo en WhatsApp» con datos citables) y los dos emails.
    // TRES CAMINOS desde el CRON (la tarjeta de inicio, 2 en paralelo):
    //   1. recordatorios y equipo — siguen aunque el lead conteste;
    //   2. confirmar — el aviso «no confirmó» lleva «No contestó desde que entró» (quien contesta lo atiende el AI Step);
    //   3. email.
    id: 'lead-agendo',
    nombre: 'Un Lead Agendó Llamada',
    emoji: '📅',
    linea: 'Confirma la reunión, se la recuerda antes y te avisa en el grupo cuando alguien agenda.',
    origen: 'undécima tanda: agendo-preparar, agendo-confirmar, recordatorio-reunion, email-recordatorio-reunion, mako-agendado, mako-reunion (#213, #228, #239)',
    objetivo: 'reunion',
    cron: { pide: 'etapa_venta', ayuda: 'La etapa de quien agendó una reunión.' },
    pasos: [
      // 1. Recordatorios y equipo (todos salen solos). Cada renglón con un dato sin valor se va solo.
      condicion('la_r', [[[EN_PIE, SIGUE_EN_LA_ETAPA, TIENE_WHATSAPP], 'la_mk1']], null),
      mako('la_mk1', '🎯 *Nuevo agendado*: {{nombre_completo}} reservó su {{reunion_cual}} para {{reunion_cuando}} a las {{reunion_hora}}.\nVino del anuncio "{{lead_utm_campaign}}".\n📱 {{lead_telefono}}\n✉️ {{lead_email}}\n{{lead_respuestas_agenda}}\n\n👉 {{link_lead}}', 'la_e24'),
      antesDeLaReunion('la_e24', DIA, 'la_w24'),
      whatsapp('la_w24', 'Hola {{nombre}}, te recuerdo tu reunión {{reunion_cuando}} a las {{reunion_hora}}.\nPara entrar: {{reunion_link}}', 'la_e60', { revisar: false }),
      antesDeLaReunion('la_e60', HORA, 'la_w60'),
      whatsapp('la_w60', 'Hola {{nombre}}, tu reunión empieza {{reunion_faltan}}, a las {{reunion_hora}}.\nPara entrar: {{reunion_link}}', 'la_e30', { revisar: false }),
      antesDeLaReunion('la_e30', 30, 'la_mk2'),
      mako('la_mk2', '⏰ Tu {{reunion_cual}} con {{nombre_completo}} empieza {{reunion_faltan}}.\n👉 {{link_lead}}', 'la_e15'),
      antesDeLaReunion('la_e15', 15, 'la_w15'),
      whatsapp('la_w15', 'Hola {{nombre}}, empezamos {{reunion_faltan}}.\nEntra aquí: {{reunion_link}}', null, { revisar: false }),
      // 2. Confirmar: a quien ya le escribiste no se le dice «te escribo por…». Las dos llegan a la MISMA espera.
      condicion('la_p', [
        [[EN_PIE, SIGUE_EN_LA_ETAPA, TIENE_WHATSAPP, YA_LE_ESCRIBISTE], 'la_wya'],
        [[EN_PIE, SIGUE_EN_LA_ETAPA, TIENE_WHATSAPP], 'la_wnuevo'],
      ], null),
      whatsapp('la_wya', 'Hola {{nombre}}, ¡gracias por agendar! 🙌 Nos vemos {{reunion_cuando}} a las {{reunion_hora}}. ¿Me confirmas que vas a poder estar?', 'la_e1d', { revisar: false }),
      whatsapp('la_wnuevo', 'Hola {{nombre}}, te escribo por la reunión que agendaste para {{reunion_cuando}} a las {{reunion_hora}} 🙌 ¿Me confirmas que vas a poder estar?', 'la_e1d', { revisar: false }),
      esperar('la_e1d', DIA, 'la_c'),
      condicion('la_c', [[[EN_PIE, SIGUE_EN_LA_ETAPA, NO_CONTESTO], 'la_mk3']], null),
      mako('la_mk3', 'Agendó y no confirmó: {{nombre_completo}}. Conviene que le marques tú.\n📱 {{lead_telefono}}\n👉 {{link_lead}}', null),
      // 3. Email.
      condicion('la_m', [[[EN_PIE, SIGUE_EN_LA_ETAPA, TIENE_EMAIL], 'la_m1']], null),
      email('la_m1', 'Tu reunión quedó agendada', 'Te esperamos.',
        'Hola {{nombre}}:\n\nTu reunión quedó agendada para {{reunion_cuando}} a las {{reunion_hora}}.\n\nSi necesitas cambiarla, responde este correo y lo coordinamos.', 'la_me24', { revisar: false }),
      antesDeLaReunion('la_me24', DIA, 'la_m2'),
      email('la_m2', 'Te recordamos tu reunión', 'Los datos para entrar.',
        'Hola {{nombre}}:\n\nTe recordamos tu reunión {{reunion_cuando}} a las {{reunion_hora}}.\n\nPara entrar: {{reunion_link}}\n\nSi necesitas cambiar el horario, responde este correo y lo coordinamos.', null, { revisar: false }),
      aiStep('la_ia', {
        objetivo: 'Que llegue a la reunión',
        casos: [['confirma', 'la_c_confirma'], ['cambiar-dia', 'la_c_cambiar'], ['pregunta-reunion', 'la_c_reunion'], ['precio-reunion', 'la_c_precio'], ['puede-no-calificar', 'la_c_califica']],
      }),
      inicio('la_r', ['la_p', 'la_m']),
    ],
  },
  {
    // (3) Junta «No asistió: reagendar» (#224 ws13) con el aviso al equipo.
    id: 'lead-no-asistio',
    nombre: 'Un Lead No Asistió',
    emoji: '🔁',
    linea: 'Le escribe a quien faltó a la reunión para buscar otro horario y te avisa en el grupo.',
    origen: 'undécima tanda: no-asistio (#224)',
    objetivo: 'recuperar',
    cron: { pide: 'etapa_venta', ayuda: 'La etapa de quien no asistió.' },
    pasos: [
      condicion('ln_entrada', [[[TIENE_WHATSAPP], 'ln_w1'], [[TIENE_EMAIL], 'ln_m1']], null),
      whatsapp('ln_w1', 'Hola {{nombre}}, te esperábamos en la reunión y no pudimos conectarnos. ¿Quieres que busquemos otro horario?', 'ln_mk', { revisar: false }),
      mako('ln_mk', 'No se conectó a la reunión: {{nombre_completo}}. Le escribí para reagendar; si prefieres, llámalo.\n📱 {{lead_telefono}}\n👉 {{link_lead}}', 'ln_e2d'),
      esperar('ln_e2d', 2 * DIA, 'ln_c'),
      // Si ya tiene otra reunión por delante, o contestó, no se le insiste («si se cumple» termina). «Agendó» no sirve
      // acá: la reunión a la que faltó también cuenta como agendada.
      condicion('ln_c', [[[EN_PIE], null], [[CONTESTO], null]], 'ln_w2'),
      whatsapp('ln_w2', '{{nombre}}, ¿lo reagendamos? Respóndeme por aquí y buscamos un horario que te quede bien.', null, { revisar: true }),
      email('ln_m1', '¿Reprogramamos tu reunión?', 'Buscamos otro horario en un minuto.',
        'Hola {{nombre}}:\n\nTe esperábamos en la reunión y no pudimos conectarnos.\n\nSi todavía te interesa, responde este correo y buscamos un nuevo horario.', null, { revisar: false }),
      aiStep('ln_ia', { objetivo: 'Que vuelva a agendar', casos: [['quiere-reagendar', 'ln_c_reagendar'], ['no-le-interesa', 'ln_c_no']] }),
    ],
  },
  {
    // (4) Junta «Seguimiento después de la reunión» y «Reactivar: tuvo reunión y no cerró» (#220 ws1). Quien no compró
    // es de lo sensible: todo para aprobar.
    id: 'lead-tuvo-reunion',
    nombre: 'Un Lead Tuvo la Reunión',
    emoji: '🤝',
    linea: 'Hace el seguimiento de quien tuvo la reunión y no compró, y te avisa si no avanza.',
    origen: 'undécima tanda: seguimiento-reunion + reactivar-sin-cierre (#220)',
    objetivo: 'vender',
    cron: { pide: 'etapa_venta', ayuda: 'La etapa de quien tuvo la reunión y no compró.' },
    pasos: [
      esperar('lt_e2h', 2 * HORA, 'lt_c1'),
      condicion('lt_c1', [[[NO_PAGO, TIENE_WHATSAPP], 'lt_w1']], null),
      whatsapp('lt_w1', 'Hola {{nombre}}, gracias por tu tiempo en la reunión 🙌 ¿Te quedó alguna duda para avanzar?', 'lt_e3d', { revisar: true, ia: true }),
      esperar('lt_e3d', 3 * DIA, 'lt_c2'),
      condicion('lt_c2', [[[NO_PAGO], 'lt_mk']], null),
      mako('lt_mk', 'Tuvo la reunión hace 3 días y todavía no compró: {{nombre_completo}}. Conviene que le escribas tú.\n👉 {{link_lead}}', 'lt_e42d'),
      esperar('lt_e42d', 42 * DIA, 'lt_c3'),
      condicion('lt_c3', [[[NO_PAGO, NO_CONTESTO], 'lt_w2']], null),
      whatsapp('lt_w2', 'Hola {{nombre}}, hace un tiempo tuvimos una reunión y quedó en pausa. ¿Sigue en tus planes? Si quieres, lo retomamos esta semana; si ya no es el momento, dímelo sin problema.', 'lt_e3d2', { revisar: true }),
      esperar('lt_e3d2', 3 * DIA, 'lt_c4'),
      condicion('lt_c4', [[[NO_PAGO, NO_CONTESTO], 'lt_w3']], null),
      whatsapp('lt_w3', '{{nombre}}, te dejo la puerta abierta: cuando quieras retomarlo, respóndeme por aquí y lo vemos.', null, { revisar: true }),
      aiStep('lt_ia', { objetivo: 'Que decida avanzar', casos: [['precio-llamada', 'lt_c_precio'], ['quiere-retomarlo', 'lt_c_retomar'], ['no-le-interesa', 'lt_c_no']] }),
    ],
  },
  {
    // (5) «Pago pendiente después de confirmar», con el aviso al equipo. La plata: para aprobar.
    id: 'lead-confirmo-compra',
    nombre: 'Un Lead Confirmó la Compra',
    emoji: '💳',
    linea: 'Le escribe a quien confirmó la compra y no pagó, y te avisa si sigue sin pagar.',
    origen: 'undécima tanda: pago-pendiente',
    objetivo: 'cobrar',
    cron: { pide: 'etapa_venta', ayuda: 'La etapa de quien confirmó y falta que pague.' },
    pasos: [
      esperar('lc_e24', DIA, 'lc_c1'),
      condicion('lc_c1', [[[NO_PAGO, TIENE_WHATSAPP, NO_CONTESTO], 'lc_w1']], null),
      whatsapp('lc_w1', 'Hola {{nombre}}, ¿pudiste completar el pago? Si tuviste algún problema, cuéntame y te ayudo.', 'lc_e2d', { revisar: true }),
      esperar('lc_e2d', 2 * DIA, 'lc_c2'),
      condicion('lc_c2', [[[NO_PAGO], 'lc_mk']], null),
      mako('lc_mk', 'Confirmó la compra hace 3 días y todavía no pagó: {{nombre_completo}}.\n👉 {{link_lead}}', null),
      aiStep('lc_ia', { objetivo: 'Que complete el pago', casos: [['ya-pago', 'lc_c_pago'], ['problema-pago', 'lc_c_problema'], ['no-quiere-comprar', 'lc_c_no']] }),
    ],
  },
  {
    // (5b) EL PLAZO DE UNA ETAPA (12/10/2026, pedido de Martín reenviado por el chat CRM: «Si, pasa a una automatización
    // eso de los plazos... Y ponlo como template en automations»). Era el plazo por etapa del CRM
    // (`funnels.data.umbrales.porEtapa` + el aviso de lib/lead-quieto-aviso.ts). Acá: entra a la etapa, espera el plazo,
    // y si SIGUE en esa etapa (la del CRON: cambiar el CRON no deja la condición vieja) avisa al equipo. Mover de etapa
    // se agrega con «⚡ Acción» (la etapa destino es del negocio: una plantilla no la puede saber). Sin AI Step: no le
    // escribe al lead.
    id: 'lead-no-avanzo',
    nombre: 'Un Lead No Avanzó',
    emoji: '⏳',
    linea: 'Si un lead sigue en la misma etapa cuando vence el plazo, te avisa en el grupo para que lo muevas.',
    origen: 'plazos de etapa del CRM (12/10/2026)',
    objetivo: 'recuperar',
    cron: { pide: 'etapa_venta', ayuda: 'La etapa a la que le pones plazo.' },
    pasos: [
      esperar('lq_e', 3 * DIA, 'lq_c'),
      condicion('lq_c', [[[SIGUE_EN_LA_ETAPA], 'lq_mk']], null),
      mako('lq_mk', '⏳ {{nombre_completo}} sigue en {{lead_etapa}} y ya pasó el plazo.\n📱 {{lead_telefono}}\n👉 {{link_lead}}', null),
    ],
  },
  {
    // (6) Junta «Bienvenida al cliente» y «Pedir un testimonio». «Felicitación al terminar una clase» se RETIRA: «cada vez
    // que avanza» es falso (un lead entra UNA vez a cada automatización: unique (lead_id, secuencia_id)).
    id: 'cliente-empezo',
    nombre: 'Un Cliente Empezó',
    emoji: '🎁',
    linea: 'Le da la bienvenida a quien compró, le pregunta cómo va y le pide un testimonio.',
    origen: 'undécima tanda: cliente-bienvenida + pedir-testimonio',
    objetivo: 'clientes',
    cron: { pide: 'etapa_entrega', ayuda: 'La primera etapa de la entrega.' },
    pasos: [
      condicion('ce_entrada', [[[TIENE_WHATSAPP], 'ce_w1'], [[TIENE_EMAIL], 'ce_m1']], null),
      whatsapp('ce_w1', '¡Te damos la bienvenida, {{nombre}}! 🎉 Gracias por confiar en nosotros. Cualquier duda que tengas, escríbeme por aquí.', 'ce_e7d', { revisar: false }),
      esperar('ce_e7d', 7 * DIA, 'ce_w2'),
      whatsapp('ce_w2', 'Hola {{nombre}}, ¿cómo vas? Si tienes alguna duda o algo no te funciona, escríbeme por aquí y lo vemos.', 'ce_e23d', { revisar: false }),
      esperar('ce_e23d', 23 * DIA, 'ce_w3'),
      whatsapp('ce_w3', 'Hola {{nombre}} 🙌 ¿Cómo te está yendo? Si te sirvió lo que hicimos juntos, ¿nos dejarías un testimonio corto? Nos ayuda muchísimo.', null, { revisar: false }),
      email('ce_m1', 'Todo listo para empezar', 'Tus accesos y cómo seguir.',
        'Hola {{nombre}}:\n\nTe escribimos para confirmar que ya tienes todo para empezar. Si no encuentras tus accesos o algo no te funciona, responde este correo y te ayudamos.', null, { revisar: false }),
      aiStep('ce_ia', { objetivo: 'Que avance en el programa', casos: [['tiene-queja', 'ce_c_queja'], ['acepta-testimonio', 'ce_c_testimonio'], ['no-puede-ahora', 'ce_c_ahora']] }),
    ],
  },
  {
    // (7) LA CADENCIA DE FÁBRICA DE `cuota-vencida`, con los textos LITERALES de antes (los fija el test). Al GRUPO y
    // nunca al cliente («C: nada al cliente», 06/10/2026), y sin `{{cuota_dias}}` después de una espera: es la foto del
    // día de la entrada. Al marcar el pago se corta sola (`cerrarCorridasDeCuota`, lib/flujo-corridas.ts). Undécima
    // tanda: las mismas tarjetas, con su lista (`partes`): salen tal cual se ven.
    id: 'mako-cobranza',
    nombre: 'Una Cuota Venció',
    emoji: '💸',
    linea: 'Te avisa cuando vence una cuota sin cobrar y te lo recuerda a las 48 h y 72 h. Se corta al marcar el pago.',
    origen: 'el aviso «Cuota vencida → cobrar» (cuota-vencida) y su cadencia de fábrica',
    objetivo: 'cobrar',
    cron: { fijo: TRIGGER_AVISO_MAKO, evento: 'cuota_vencida' },
    pasos: [
      mako('mk_entrada', '💸 *Cobranza*: la cuota {{cuota_numero}} de {{lead_nombre}} venció hace {{cuota_dias}} — *{{cuota_monto}} sin cobrar*. Si ya se cobró, márcalo en su ficha. — MaKo', 'mk_e48'),
      esperar('mk_e48', 48 * HORA, 'mk_48'),
      mako('mk_48', '💸 Sigue sin cobrarse la cuota {{cuota_numero}} de {{lead_nombre}} — {{cuota_monto}}, vencía el {{cuota_vence}}.\n\n👉 {{link_lead}} — MaKo', 'mk_e72'),
      esperar('mk_e72', 72 * HORA, 'mk_72'),
      mako('mk_72', '💸 Último recordatorio por la cuota {{cuota_numero}} de {{lead_nombre}} ({{cuota_monto}}): si ya se cobró, márcalo en su ficha y dejo de insistir.\n\n👉 {{link_lead}} — MaKo', null),
    ],
  },
  {
    // (8) «Entró un pago» (la pasarela de pagos): cada pago, también las renovaciones (un flujo del CRON «Pagos» corre una
    // vez por lead: decisión 35). Con los datos del pago que pasa `avisarPagoRecibido` (lib/cobros.ts), por código y
    // nunca por un modelo. Cada dato que puede faltar va en su renglón: «🧪 Prueba» sólo sale en un pago de prueba, y el
    // alta sólo en una venta de MaKo.
    id: 'mako-pago',
    nombre: 'Entró un Pago',
    emoji: '💰',
    linea: 'Te avisa en el grupo cuando entra un pago por Stripe o Mercado Pago.',
    origen: 'el aviso «Pago recibido» (pago-recibido), con los datos del pago',
    objetivo: 'cobrar',
    cron: { fijo: TRIGGER_AVISO_MAKO, evento: 'pago_recibido' },
    pasos: [
      mako('mp_aviso', '💰 *Entró un pago*: {{nombre_completo}} pagó *{{pago_monto}}* por {{pago_pasarela}}.\n🧾 {{pago_concepto}}\n{{pago_tipo}}\n🧪 {{pago_modo}}\n{{pago_alta}}\n\n👉 {{link_lead}}', null),
    ],
  },
  {
    // (8b) «El AI Analyst terminó» (13/10/2026, la tarea del Dashboard en Automations): el análisis de una hoja del
    // Dashboard, con sus datos citables (la hoja, el resumen, los hallazgos y el link), que pasa el Dashboard armados con
    // `valoresDelAnalisis`. No es de un lead: el análisis es del negocio. Cada dato en su renglón (sin valor, se va).
    id: 'mako-analisis',
    nombre: 'El AI Analyst Terminó',
    emoji: '📊',
    linea: 'Te avisa en el grupo cuando el AI Analyst termina de analizar una hoja del Dashboard.',
    origen: 'el aviso «Análisis del Dashboard listo» (dashboard-analisis-listo), con los datos del análisis',
    objetivo: 'medir',
    cron: { fijo: TRIGGER_AVISO_MAKO, evento: 'analisis_listo' },
    pasos: [
      mako('ma_aviso', '📊 *Análisis listo*: {{analisis_hoja}}\n\n{{analisis_resumen}}\n\n{{analisis_hallazgos}}\n\n👉 {{analisis_link}}', null),
    ],
  },
  {
    // (9) «Un lead te escribió y MaKo no le contestó»: lo que escribió, como dato (`{{lead_escribio}}`).
    id: 'mako-charla',
    nombre: 'Un Lead Te Escribió',
    emoji: '💬',
    linea: 'Te avisa en el grupo cuando un lead te escribe y MaKo no le contestó.',
    origen: 'el aviso «Mensaje de WhatsApp entrante» (wa-mensaje-entrante), con lo que escribió',
    objetivo: 'vender',
    cron: { fijo: TRIGGER_AVISO_MAKO, evento: 'lead_contesta' },
    pasos: [mako('mc_aviso', '💬 {{nombre_completo}} te escribió y no le contesté.\n«{{lead_escribio}}»\n👉 {{link_lead}}', null)],
  },
  // Instagram y Messenger: salen por Zernio, dentro de la ventana de 24 h o como la respuesta privada a un comentario.
  // SIN AI Step (ver la cabecera: hoy contestaría por WhatsApp). Los eventos apagados («Todavía no») no van.
  {
    id: 'instagram-te-escribieron',
    nombre: 'Te Escribieron por Instagram',
    emoji: '📸',
    linea: 'Le contesta por DM a quien te escribe, comenta o responde una historia, y te avisa.',
    origen: 'undécima tanda: ig-comentario-dm, ig-historia-dm, ig-bienvenida-dm, ig-ref-dm, ig-en-vivo-dm',
    objetivo: 'captar',
    cron: { fijo: TRIGGER_INSTAGRAM, eventos: ['comentario', 'historia', 'dm', 'ref', 'en_vivo'] },
    pasos: [
      social('instagram', 'ig_dm', '¡Hola {{nombre}}! 👋 Gracias por escribirnos. Cuéntame en qué te puedo ayudar y te respondo por aquí.', 'ig_mk', { revisar: false }),
      mako('ig_mk', '{{nombre_completo}} te escribió por Instagram. Contéstale desde Instagram.\n👉 {{link_lead}}', null),
    ],
  },
  {
    id: 'messenger-te-escribieron',
    nombre: 'Te Escribieron por Messenger',
    emoji: '💭',
    linea: 'Le contesta por Messenger a quien te escribe, comenta o escanea tu QR, y te avisa.',
    origen: 'undécima tanda: ms-bienvenida, ms-qr, ms-ref, ms-comentario',
    objetivo: 'captar',
    cron: { fijo: TRIGGER_MESSENGER, eventos: ['dm', 'qr', 'ref', 'comentario'] },
    pasos: [
      social('messenger', 'ms_dm', '¡Hola {{nombre}}! 👋 Gracias por escribirnos. Cuéntame en qué te puedo ayudar y te respondo por aquí.', 'ms_mk', { revisar: false }),
      mako('ms_mk', '{{nombre_completo}} te escribió por Messenger. Contéstale desde Messenger.\n👉 {{link_lead}}', null),
    ],
  },
  {
    id: 'email-recibido',
    nombre: 'Te Escribieron por Email',
    emoji: '↩️',
    linea: 'Le contesta solo a quien te escribe por email y te avisa en el grupo.',
    origen: 'undécima tanda: email-respuesta-auto',
    objetivo: 'captar',
    cron: { fijo: TRIGGER_EMAIL_RECIBIDO, eventos: ['recibido'] },
    pasos: [
      email('er_mail', 'Recibimos tu mensaje', 'Te respondemos a la brevedad.',
        'Hola {{nombre}}:\n\nGracias por escribirnos. Recibimos tu mensaje y te respondemos a la brevedad.', 'er_mk', { revisar: false }),
      mako('er_mk', 'Te escribieron por email: {{nombre_completo}}.\n👉 {{link_lead}}', null),
    ],
  },
  // El newsletter SEMANAL no está: un lead entra UNA vez a cada automatización (mig 0034), así que un Recurrente semanal
  // le llegaría una sola vez a cada suscriptor. Lo que existe es el envío masivo de /email.
  {
    id: 'email-newsletter',
    nombre: 'Alguien Se Suscribió',
    emoji: '📰',
    linea: 'Tres correos de bienvenida a quien se suscribe: el saludo, a los 2 días y a los 5.',
    origen: 'galería v2 (décima tanda)',
    objetivo: 'captar',
    cron: { pide: 'etiqueta', ayuda: 'La etiqueta que le pones a quien se suscribe.' },
    pasos: [
      email('nl_1', '¡Gracias por suscribirte!', 'Esto es lo que vas a recibir.',
        'Hola {{nombre}}:\n\nGracias por suscribirte. Cada tanto te vamos a escribir con ideas y novedades que te pueden servir.\n\nSi tienes una pregunta, responde este correo: lo leemos.', 'nl_espera_2d', { revisar: false }),
      esperar('nl_espera_2d', 2 * DIA, 'nl_2'),
      email('nl_2', 'Lo que más nos preguntan', 'Una respuesta corta a la duda más común.',
        'Hola {{nombre}}:\n\nLa pregunta que más nos hacen es por dónde empezar. Nuestra respuesta: con un paso chico y concreto, hoy.\n\n¿Cuál es el tuyo? Responde este correo y te leemos.', 'nl_espera_3d', { revisar: false }),
      esperar('nl_espera_3d', 3 * DIA, 'nl_3'),
      email('nl_3', '¿Hablamos?', 'Si quieres, lo vemos juntos.',
        'Hola {{nombre}}:\n\nSi quieres que veamos tu caso, responde este correo y coordinamos una llamada corta.', null, { revisar: false }),
    ],
  },
];

// ── Las que se fueron (undécima tanda) ──────────────────────────────────────────────────────────

/**
 * LAS 25 DE ANTES → LA DE SU CATEGORÍA (docs/diseno-undecima-tanda.md §2, punto 10). `null` = retirada sin reemplazo.
 * Conservan su id `mako-cobranza`, `mako-pago`, `mako-charla` y `email-newsletter`. Lo lee `crearDesdePlantilla`: un id
 * viejo contesta 400 y nombra la nueva, nunca crea otra cosa en silencio (una pantalla vieja en caché, una API).
 */
/**
 * LAS PLANTILLAS DE SUPERADMIN (15/10/2026): automatizaciones de la PLATAFORMA (`soloPlataforma`), aparte de la galería
 * de los negocios, que es una por categoría del embudo. Las ve y las crea sólo el ws de la plataforma (`plantillasPara`,
 * `crearDesdePlantilla`). Hoy, la de restablecer la contraseña: su evento lo emite Seguridad en ese ws.
 */
export const PLANTILLAS_PLATAFORMA: readonly PlantillaAutomatizacion[] = [
  {
    // «Restablecer la contraseña» (15/10/2026: la contraseña es obligatoria desde el 21/10, decisión de Martín).
    // SÓLO SuperAdmin: el evento lo emite la ruta de recuperación de Seguridad en el ws de la plataforma, y el mail sale
    // a la persona por el remitente de MaKo. El link es SECRETO (de un uso, vence en 30 minutos): va sólo en el cuerpo,
    // sin DELAY (`pasosDelEvento`). Docs: docs/diseno-2fa-obligatorio.md §8.
    id: 'seguridad-restablecer',
    nombre: 'Restablecer Contraseña',
    emoji: '🔑',
    linea: 'Le manda a quien la pide el link para crear su contraseña nueva de MaKo.',
    origen: 'Seguridad: «Olvidé mi contraseña» (seguridad-contrasena-restablecer)',
    objetivo: 'clientes',
    soloPlataforma: true,
    cron: { fijo: TRIGGER_AVISO_MAKO, evento: 'contrasena_restablecer' },
    pasos: [
      email(
        'sr_mail', 'Tu link para crear una contraseña nueva', 'Vence en 30 minutos y sirve una sola vez.',
        'Hola:\n\nPara crear tu contraseña nueva de MaKo, entra a este link. Vence en 30 minutos y sirve una sola vez:\n{{link_restablecer}}\n\nSi no lo pediste tú, ignora este correo: tu contraseña no cambia.',
        null, { revisar: false },
      ),
    ],
  },
  // LOS MENSAJES DE MaKo A SUS CLIENTES, mudados a automatizaciones de la plataforma (15/10/2026, el 2 de las doce de
  // Martín; docs/diseno-avisos-plataforma.md). El evento lo emite el NEGOCIO cuya línea se cayó (lib/lineas-vigilante.ts)
  // y la tarjeta le llega al grupo de ESE negocio (`negocioWs`, lib/flujos.ts). Cada dato en su renglón: un renglón con
  // un dato vacío se va entero (`textoConDatos`), y la línea sin número ni etiqueta no deja «()». Con la firma «— MaKo»
  // del texto de siempre: una tarjeta TAL CUAL no le suma envoltorio (16/10/2026, tests/avisos-plataforma.test.ts).
  {
    // ⚠️ TEXTO LITERAL (16/10/2026, Martín: «el mensaje NO es igual... esa automatización esta al pedo»): hasta ese día la
    // tarjeta citaba `{{linea_titulo}}` y `{{linea_motivo}}`, frases enteras escritas en el código. Ahora cada caso es su
    // evento y su texto: el corte acá, y «WhatsApp cerró la sesión» en `mako-whatsapp-desvinculado`. La fecha va en su
    // renglón: sin ella, se va sola y no se lleva la frase.
    id: 'mako-whatsapp-caido',
    nombre: 'Se Cortó el WhatsApp de un Negocio',
    emoji: '🔴',
    linea: 'Le avisa al grupo de un negocio que su WhatsApp se cortó, y qué hacer.',
    origen: 'el vigilante de líneas (wa-desconectado): dos pruebas seguidas con la línea caída, sin que WhatsApp haya cerrado la sesión',
    objetivo: 'clientes',
    soloPlataforma: true,
    cron: { fijo: TRIGGER_AVISO_MAKO, evento: 'whatsapp_caido' },
    pasos: [
      mako('wc_mk', '🔴 *Se cortó tu WhatsApp*\n📱 {{linea_numero}}\n🕐 Desde el {{linea_fecha}}\nPor ese número no entran ni salen mensajes. Puede volver solo; si sigue así, reconéctalo:\n{{linea_link}}\n\n— MaKo', null),
    ],
  },
  {
    id: 'mako-whatsapp-desvinculado',
    nombre: 'Se Desconectó el WhatsApp de un Negocio',
    emoji: '🔴',
    linea: 'Le avisa al grupo de un negocio que WhatsApp cerró la sesión de su línea, y que vuelva a escanear el QR.',
    origen: 'el vigilante de líneas (wa-desvinculado): WhatsApp cerró la sesión del dispositivo vinculado',
    objetivo: 'clientes',
    soloPlataforma: true,
    cron: { fijo: TRIGGER_AVISO_MAKO, evento: 'whatsapp_desvinculado' },
    pasos: [
      mako('wd_mk', '🔴 *Se desconectó tu WhatsApp*\n📱 {{linea_numero}}\n🕐 Desde el {{linea_fecha}}\nWhatsApp cerró la sesión del dispositivo vinculado: tu teléfono está bien, pero por ese número no entran ni salen mensajes. Vuelve a escanear el QR:\n{{linea_link}}\n\n— MaKo', null),
    ],
  },
  {
    id: 'mako-whatsapp-volvio',
    nombre: 'Volvió el WhatsApp de un Negocio',
    emoji: '🟢',
    linea: 'Le avisa al grupo de un negocio que su WhatsApp volvió (sólo si se había avisado la caída).',
    origen: 'el vigilante de líneas (wa-reconectado)',
    objetivo: 'clientes',
    soloPlataforma: true,
    cron: { fijo: TRIGGER_AVISO_MAKO, evento: 'whatsapp_volvio' },
    pasos: [
      mako('wv_mk', '🟢 *Volvió tu WhatsApp*\n📱 {{linea_numero}}\nPor ese número ya entran y salen mensajes otra vez. — MaKo', null),
    ],
  },
  {
    // La grabación de Fathom (`reunion-ocurrio-fathom`, 10/10/2026: «El de Fathom también debería ser algo que se configura
    // en SuperAdmin»). Sale DESPUÉS del Closing Analyst, con el link a la pantalla del resumen (`{{link_lead}}`). La
    // duración en su renglón: sin ella, se va sola y no se lleva la frase.
    id: 'mako-reunion-grabada',
    nombre: 'Terminó la Reunión de un Negocio',
    emoji: '✅',
    linea: 'Le avisa al grupo de un negocio que terminó una reunión con un lead, con el link al resumen de la llamada.',
    origen: 'el webhook de Fathom (reunion-ocurrio-fathom), después de que MaKo analiza la charla',
    objetivo: 'clientes',
    soloPlataforma: true,
    cron: { fijo: TRIGGER_AVISO_MAKO, evento: 'reunion_grabada' },
    pasos: [
      mako('rg_mk', '✅ Terminó la *{{grabacion_reunion}} con {{nombre_completo}}*.\n⏱️ {{grabacion_duracion}}\n\n👉 Mira el resumen de la llamada:\n{{link_lead}}\n\n— MaKo', null),
    ],
  },
  {
    // El reporte de los lunes (16/10/2026, docs/diseno-avisos-plataforma.md §6): lo arma el cron de cada negocio con sus
    // preferencias, y sale POR EMAIL al equipo del negocio, como hasta hoy (nunca por WhatsApp: `REPORTE_POR_WHATSAPP`).
    // El asunto y el cuerpo son los de `despacharReporte` (lib/notify.ts). Sin firma: el correo ya la lleva al pie.
    id: 'mako-reporte-semanal',
    nombre: 'Reporte Semanal de un Negocio',
    emoji: '🗓️',
    linea: 'Los lunes, le manda por email al equipo de cada negocio el reporte de su semana (Meta, ventas, cobranza).',
    origen: 'el cron de los lunes (reporte-semanal), en cada negocio al que le toca según sus preferencias',
    objetivo: 'clientes',
    soloPlataforma: true,
    cron: { fijo: TRIGGER_AVISO_MAKO, evento: 'reporte_semanal' },
    pasos: [
      makoEmail('rs_mk', '{{reporte_titulo}}', '{{reporte_texto}}', null),
    ],
  },
  {
    // La oferta que MaKo terminó de armar (16/10/2026, pedido de Martín en la llamada con Leila: «te mando una
    // notificación cuando esté listo»). La arma el servidor aunque la persona cierre la pestaña
    // (app/api/offer/route.ts, `armarPorDetras`). El nombre en su renglón: si la oferta no tiene uno que sirva, se va solo.
    id: 'mako-oferta-lista',
    nombre: 'Oferta Lista de un Negocio',
    emoji: '✨',
    linea: 'Le avisa al grupo de un negocio que MaKo terminó de armar su oferta, con el link para verla.',
    origen: 'el armado de la oferta en el servidor (tab Offer u onboarding), al terminar',
    objetivo: 'clientes',
    soloPlataforma: true,
    cron: { fijo: TRIGGER_AVISO_MAKO, evento: 'oferta_lista' },
    pasos: [
      mako('ol_mk', '✨ *Tu oferta está lista* (versión {{oferta_lista_version}}).\n📝 {{oferta_lista_nombre}}\n\n👉 Mírala aquí: {{oferta_lista_link}} — MaKo', null),
    ],
  },
];

export const PLANTILLAS_REEMPLAZADAS: Readonly<Record<string, string | null>> = {
  'bienvenida-sin-agenda': 'lead-entro',
  'ultimo-intento': 'lead-entro',
  'recordatorio-reunion': 'lead-agendo',
  'agendo-preparar': 'lead-agendo',
  'agendo-confirmar': 'lead-agendo',
  'email-recordatorio-reunion': 'lead-agendo',
  'mako-agendado': 'lead-agendo',
  'mako-reunion': 'lead-agendo',
  'no-asistio': 'lead-no-asistio',
  'seguimiento-reunion': 'lead-tuvo-reunion',
  'reactivar-sin-cierre': 'lead-tuvo-reunion',
  'pago-pendiente': 'lead-confirmo-compra',
  'cliente-bienvenida': 'cliente-empezo',
  'pedir-testimonio': 'cliente-empezo',
  'ig-comentario-dm': 'instagram-te-escribieron',
  'ig-historia-dm': 'instagram-te-escribieron',
  'ig-bienvenida-dm': 'instagram-te-escribieron',
  'ig-ref-dm': 'instagram-te-escribieron',
  'ig-en-vivo-dm': 'instagram-te-escribieron',
  'ms-bienvenida': 'messenger-te-escribieron',
  'ms-qr': 'messenger-te-escribieron',
  'ms-ref': 'messenger-te-escribieron',
  'ms-comentario': 'messenger-te-escribieron',
  'email-respuesta-auto': 'email-recibido',
  // «cada vez que avanza» es falso con el unique de inscripciones (un lead entra UNA vez).
  'felicitacion-clase': null,
};

// ── Lo que se lee de la galería ─────────────────────────────────────────────────────────────────

/** La plantilla VIGENTE con ese id, o null (un id de antes también es null: ver `plantillaQueLaReemplaza`). */
/** Las plantillas que ve ESTE workspace: sin las de SuperAdmin (`soloPlataforma`) en un negocio. */
export function plantillasPara(o: { plataforma: boolean }): readonly PlantillaAutomatizacion[] {
  return o.plataforma ? [...PLANTILLAS, ...PLANTILLAS_PLATAFORMA] : PLANTILLAS.filter((p) => !p.soloPlataforma);
}

export function plantillaPorId(id: unknown): PlantillaAutomatizacion | null {
  if (typeof id !== 'string') return null;
  // Las de SuperAdmin también se encuentran: quién puede CREARLA lo decide `crearDesdePlantilla` (`deps.plataforma`).
  return PLANTILLAS.find((p) => p.id === id) ?? PLANTILLAS_PLATAFORMA.find((p) => p.id === id) ?? null;
}

/**
 * Un id de ANTES: `{ reemplazo }` con la plantilla de su categoría, o `{ reemplazo: null }` si se retiró. null = no es un
 * id de antes (es una vigente, o no existió nunca).
 */
export function plantillaQueLaReemplaza(id: unknown): { reemplazo: PlantillaAutomatizacion | null } | null {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(PLANTILLAS_REEMPLAZADAS, id)) return null;
  const nueva = PLANTILLAS_REEMPLAZADAS[id];
  return { reemplazo: nueva ? plantillaPorId(nueva) : null };
}

/**
 * LOS CRON QUE TRAE PUESTOS una plantilla de CRON fijo (`filaDePlantilla` los escribe en la fila): el del Evento de MaKo
 * con su evento, o los de un canal, UNO POR EVENTO (d1…dN). Vacío = el CRON lo elige la persona (una etapa o una etiqueta).
 */
export function disparadoresDePlantilla(p: Pick<PlantillaAutomatizacion, 'cron'>): Disparador[] {
  const c = p.cron;
  if (c.fijo === TRIGGER_AVISO_MAKO) return [{ id: 'd1', trigger_tipo: c.fijo, subtipo: c.evento }];
  if (c.fijo) return c.eventos.map((e, i) => ({ id: `d${i + 1}`, trigger_tipo: c.fijo, subtipo: e }));
  return [];
}

/** El grupo «Canal» del filtro, en este orden. «MaKo en WhatsApp» es el grupo del negocio. */
export const CANALES_PLANTILLA: ReadonlyArray<{ id: CanalPlantilla; label: string }> = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'Email' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'mako', label: ROTULO_MENSAJES_MAKO },
];

/**
 * POR DÓNDE SALE UNA PLANTILLA, DERIVADO (décima tanda, §1): el `canal` de cada MENSAJE que trae, el CRON de un canal
 * (Instagram, Messenger, «Recibes un email»), y `mako` si es un evento de MaKo o trae una tarjeta «MaKo en WhatsApp»
 * (undécima tanda: el aviso al equipo es parte de la categoría). Escrito a mano al lado de las tarjetas, el día que
 * alguien cambia un mensaje de canal la galería lo filtraría por el de antes.
 *
 * Sólo los MENSAJES y la tarjeta MaKo: el relleno de una tarjeta de control (una espera, una condición) dice
 * `canal: 'whatsapp'` y no sale por ningún lado. En el orden de `CANALES_PLANTILLA`.
 */
export function canalesDe(p: Pick<PlantillaAutomatizacion, 'cron' | 'pasos'>): CanalPlantilla[] {
  const hay = new Set<CanalPlantilla>();
  if (p.cron.fijo === TRIGGER_AVISO_MAKO && !EVENTOS_MAKO.find((e) => e.subtipo === p.cron.evento)?.persona) hay.add('mako');
  if (p.cron.fijo === TRIGGER_INSTAGRAM) hay.add('instagram');
  if (p.cron.fijo === TRIGGER_MESSENGER) hay.add('messenger');
  if (p.cron.fijo === TRIGGER_EMAIL_RECIBIDO) hay.add('email');
  for (const x of p.pasos) {
    const c = claseDe(x);
    if (c === 'accion' && x.accion?.operacion === OP_AVISAR) { hay.add('mako'); continue; }
    if (c !== 'mensaje') continue;
    const k = x.canal;
    hay.add(k === 'email' || k === 'instagram' || k === 'messenger' ? k : 'whatsapp');
  }
  return CANALES_PLANTILLA.map((c) => c.id).filter((c) => hay.has(c));
}

/** Sin acentos ni mayúsculas, con los espacios colapsados: así se compara lo que se busca. */
const plano = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * LA BÚSQUEDA Y EL FILTRO DE LA GALERÍA (décima tanda, punto 5), puros y con test. `texto` busca en el nombre y la línea
 * sin acentos ni mayúsculas, y CADA palabra tiene que estar; `canal` y `objetivo` se suman (las dos a la vez). Devuelve
 * las que pasan en el orden del catálogo. «Lienzo en blanco» no es una plantilla: lo pone primero la pantalla.
 */
export function filtrarPlantillas<P extends Pick<PlantillaAutomatizacion, 'nombre' | 'linea' | 'objetivo' | 'cron' | 'pasos'>>(
  lista: readonly P[], f: { texto?: string | null; canal?: CanalPlantilla | null; objetivo?: ObjetivoPlantilla | null },
): P[] {
  const palabras = plano(f.texto ?? '').split(' ').filter(Boolean);
  return lista.filter((p) => {
    if (f.canal && !canalesDe(p).includes(f.canal)) return false;
    if (f.objetivo && p.objetivo !== f.objetivo) return false;
    if (!palabras.length) return true;
    const donde = plano(`${p.nombre} ${p.linea}`);
    return palabras.every((w) => donde.includes(w));
  });
}

// ── El desplegable del filtro (dos grupos, uno de cada) ──────────────────────────────────────────

const PRE_CANAL = 'canal:';
const PRE_OBJETIVO = 'objetivo:';

/** Los dos grupos del filtro de la galería, «Canal» y «Objetivo», con el valor de cada opción (`canal:…`, `objetivo:…`). */
export function gruposDelFiltroGaleria(): Array<{ title: string; options: Array<{ value: string; label: string }> }> {
  return [
    { title: 'Canal', options: CANALES_PLANTILLA.map((c) => ({ value: `${PRE_CANAL}${c.id}`, label: c.label })) },
    { title: 'Objetivo', options: OBJETIVOS_PLANTILLA.map((o) => ({ value: `${PRE_OBJETIVO}${o.id}`, label: o.label })) },
  ];
}

/** Lo marcado en el desplegable, como lo lee `filtrarPlantillas`. Un valor que no es de la tabla no filtra nada. */
export function filtroDeValores(valores: readonly string[]): { canal: CanalPlantilla | null; objetivo: ObjetivoPlantilla | null } {
  const canal = CANALES_PLANTILLA.find((c) => valores.includes(`${PRE_CANAL}${c.id}`))?.id ?? null;
  const objetivo = OBJETIVOS_PLANTILLA.find((o) => valores.includes(`${PRE_OBJETIVO}${o.id}`))?.id ?? null;
  return { canal, objetivo };
}

/**
 * Tocar una opción: la prende o la apaga, y prender una SACA la otra de su grupo (un canal y un objetivo a la vez, no
 * dos canales: «WhatsApp o Email» mezclaría dos preguntas en un filtro que las suma).
 */
export function alternarFiltroGaleria(valores: readonly string[], v: string): string[] {
  if (valores.includes(v)) return valores.filter((x) => x !== v);
  const grupo = v.startsWith(PRE_CANAL) ? PRE_CANAL : v.startsWith(PRE_OBJETIVO) ? PRE_OBJETIVO : null;
  if (!grupo) return [...valores];
  return [...valores.filter((x) => !x.startsWith(grupo)), v];
}

// ⛔ ACÁ VIVÍA `filtroDeSeccion` («＋ Nuevo mensaje» abría la galería con Canal = MaKo). Se fue con la undécima tanda
// (punto 9): la barra es una sola y la galería se abre siempre por «＋ Nueva», sin filtro.

/**
 * Los pasos que se GUARDAN: una copia (nadie toca el catálogo) con el `orden` de lectura. Los ids son
 * los de la plantilla: son por automatización, así que dos creadas de la misma no se pisan.
 */
export function pasosDePlantilla(p: PlantillaAutomatizacion): PasoDePlantilla[] {
  return (JSON.parse(JSON.stringify(p.pasos)) as PasoDePlantilla[]).map((x, i) => ({ ...x, orden: i + 1 }));
}

/**
 * EL NOMBRE CON QUE NACE: el de la plantilla, y si ya hay una automatización con ese nombre, con un
 * número («… 2»). Dos filas iguales en la lista se leen como un error. El tope es el de siempre
 * (`TOPE_NOMBRE_SECUENCIA`): se corta el nombre, nunca el número.
 */
export function nombreLibre(base: string, usados: Iterable<string>): string {
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const ya = new Set([...usados].map(norm));
  const limpio = base.trim().replace(/\s+/g, ' ').slice(0, TOPE_NOMBRE_SECUENCIA).trim();
  if (!ya.has(norm(limpio))) return limpio;
  for (let n = 2; n < 100; n++) {
    const sufijo = ` ${n}`;
    const cand = `${limpio.slice(0, TOPE_NOMBRE_SECUENCIA - sufijo.length).trim()}${sufijo}`;
    if (!ya.has(norm(cand))) return cand;
  }
  return limpio;
}

// ── El CRON que la pantalla pide ────────────────────────────────────────────────────────────────

/** El kanban de cada `pide`, con el nombre con que lo ofrece el CRON (lib/flujo-conversacion.ts). */
const KANBAN_DE_PIDE: Readonly<Record<Exclude<PideCron, 'etiqueta'>, string>> = { etapa_venta: KANBAN_ADQUISICION, etapa_entrega: KANBAN_ENTREGA };

/** Lo que dice el botón del desplegable mientras no se eligió nada. */
export const SIN_ETAPA = 'Elige la etapa';
/** Lo mismo, cuando lo que se pide es una etiqueta (`pide: 'etiqueta'`). */
export const SIN_ETIQUETA = 'Elige la etiqueta';

/** Una etiqueta del negocio, como la ofrece el CRON (`EtiquetaParaDisparo`, lib/flujo-conversacion.ts). */
export type EtiquetaParaPlantilla = { id: number; nombre: string; archivada_at?: string | null };

/**
 * LAS ETIQUETAS QUE SE PUEDEN ELEGIR para una plantilla que arranca con una (`pide: 'etiqueta'`): las vivas, con el
 * MISMO valor y rótulo que el desplegable del CRON (`etiqueta:<id>`, «Se le puso «X»»). Vacío = el negocio no tiene
 * etiquetas, y nace con el CRON a elegir.
 */
export function seccionesDeEtiquetas(etiquetas: readonly EtiquetaParaPlantilla[]): SeccionDisparo[] {
  const pasos = pasosDisparo({ disparadores: [], productos: [], etiquetas, actual: { trigger_tipo: 'manual' }, textoActual: '' });
  const s = pasos.find((x) => x.options.some((o) => o.value.startsWith('etiqueta:')));
  return s ? [{ title: s.title, options: s.options.filter((o) => o.value.startsWith('etiqueta:')) }] : [];
}

/**
 * LAS ETAPAS QUE SE PUEDEN ELEGIR para una plantilla: las del desplegable del CRON (`pasosDisparo`,
 * la MISMA función que usa el editor del CRON) sin las etiquetas y sólo del kanban que la plantilla
 * pide. Con varios productos, un paso por producto y adentro sus etapas; con uno, las etapas directo
 * (el paso del kanban se saltea: hay uno solo). Vacío = el negocio no tiene productos con ese kanban,
 * y la plantilla nace con el CRON a elegir.
 */
export function seccionesParaCron(pide: PideCron, productos: readonly ProductoParaDisparo[]): SeccionDisparo[] {
  // Una etiqueta no es una etapa: sus opciones salen de `seccionesDeEtiquetas`.
  if (pide === 'etiqueta') return [];
  const pasos = pasosDisparo({ disparadores: [], productos, etiquetas: [], actual: { trigger_tipo: 'manual' }, textoActual: '' });
  const deProductos = pasos.find((s) => s.title === PASO_PRODUCTOS)?.grupos ?? [];
  const kanban = KANBAN_DE_PIDE[pide];
  const esKanban = (g: SeccionDisparo) => g.title === KANBAN_ADQUISICION || g.title === KANBAN_ENTREGA;
  // Con UN producto, `deProductos` son sus kanbans; con varios, un grupo por producto con sus kanbans.
  if (deProductos.some(esKanban)) {
    const k = deProductos.find((g) => g.title === kanban);
    return k?.options.length ? [{ title: k.title, options: k.options }] : [];
  }
  const out: SeccionDisparo[] = [];
  for (const pr of deProductos) {
    const k = (pr.grupos ?? []).find((g) => g.title === kanban);
    if (k?.options.length) out.push({ title: pr.title, options: k.options });
  }
  return out;
}

/**
 * CÓMO SE DICE LA ETAPA ELEGIDA en el botón: el mismo rótulo que el editor del CRON
 * (`rotuloDisparo`), que lee el camino ENTERO (productos → producto → kanban → etapa). Acá el paso del
 * kanban no se dibuja (hay uno solo), así que se le devuelve antes de preguntar.
 */
export function rotuloDeEleccion(pide: PideCron, secciones: readonly SeccionDisparo[], valor: string): string {
  if (pide === 'etiqueta') return secciones.flatMap((s) => s.options).find((o) => o.value === valor)?.label ?? SIN_ETIQUETA;
  if (!valor) return SIN_ETAPA;
  const kanban = KANBAN_DE_PIDE[pide];
  const unSolo = secciones.length === 1 && secciones[0].title === kanban;
  const grupos: SeccionDisparo[] = unSolo
    ? [...secciones]
    : secciones.map((s) => ({ title: s.title, options: [], grupos: [{ title: kanban, options: s.options }] }));
  return rotuloDisparo([{ title: PASO_PRODUCTOS, options: [], grupos }], valor, SIN_ETAPA);
}

/**
 * EL CRON QUE SE GUARDA a partir de lo que eligió la pantalla (`venta:<embudo>:<etapa>` o
 * `entrega:<producto>:<etapa>`, el valor del desplegable del CRON). null = no se entiende, o es de
 * OTRO kanban que el que la plantilla pide: una post-agenda colgada de una etapa de la entrega no
 * dispararía nunca para un lead que todavía no compró. Que la etapa EXISTA en el negocio lo mira quien
 * guarda (`guardarDisparadores`, lib/disparadores-guardar.ts).
 */
export function disparadorDeEleccion(pide: PideCron, valor: unknown): Disparador | null {
  if (typeof valor !== 'string' || !valor) return null;
  const p = pedidoDisparo(valor, 0);
  if (!p || p.trigger_tipo !== TRIGGER_DE_PIDE[pide]) return null;
  // «Se le puso [la etiqueta]» (décima tanda): el CRON de la etiqueta, como lo arma el desplegable del CRON.
  if (pide === 'etiqueta') {
    const etiqueta = Number(p.etiqueta_id);
    return Number.isInteger(etiqueta) && etiqueta > 0 ? { id: 'd1', trigger_tipo: String(p.trigger_tipo), etiqueta_id: etiqueta } : null;
  }
  const etapa = typeof p.etapa === 'string' && p.etapa ? p.etapa : null;
  if (!etapa) return null;
  const etapas = Array.isArray(p.etapas) ? (p.etapas as unknown[]).map(String) : null;
  const d: Disparador = { id: 'd1', trigger_tipo: String(p.trigger_tipo), etapa, etapas: etapas && etapas.length > 1 ? etapas : null };
  if (pide === 'etapa_venta') d.funnel_id = p.funnel_id == null ? null : Number(p.funnel_id);
  else d.producto_id = Number(p.producto_id);
  return d;
}

// ── La etapa dicha en palabras (la API: `crear_automatizacion_desde_plantilla`) ───────────────────

/** Lo que se eligió en palabras: el valor del desplegable del CRON y cómo se dice, o por qué no y entre qué elegir. */
export type EleccionEnPalabras =
  | { ok: true; valor: string; rotulo: string }
  | { ok: false; motivo: string; opciones: string[] };

/**
 * LA ETAPA (o la etiqueta) DICHA EN PALABRAS → el valor del desplegable del CRON, con LAS MISMAS opciones que la galería
 * (`seccionesParaCron`, `seccionesDeEtiquetas`). Sin acentos ni mayúsculas; también vale la clave de la etapa. Con dos
 * que calzan (dos productos con una etapa «Agendado»), `producto` decide; si no alcanza, contesta con las opciones. Nunca
 * elige al azar: una automatización colgada de la etapa equivocada le escribe a otra gente.
 */
export function eleccionEnPalabras(
  pide: PideCron,
  d: { productos: readonly ProductoParaDisparo[]; etiquetas?: readonly EtiquetaParaPlantilla[] },
  etapa: string,
  producto?: string | null,
): EleccionEnPalabras {
  const quiere = plano(etapa);
  if (pide === 'etiqueta') {
    const opciones = seccionesDeEtiquetas(d.etiquetas ?? []).flatMap((x) => x.options);
    const vivas = (d.etiquetas ?? []).filter((e) => !e.archivada_at && opciones.some((o) => o.value === `etiqueta:${e.id}`));
    const calza = vivas.filter((e) => plano(e.nombre) === quiere);
    if (calza.length === 1) return { ok: true, valor: `etiqueta:${calza[0].id}`, rotulo: calza[0].nombre };
    return { ok: false, motivo: `No hay una etiqueta «${etapa}».`, opciones: vivas.map((e) => e.nombre).slice(0, 15) };
  }
  const secs = seccionesParaCron(pide, d.productos);
  const unSolo = secs.length === 1 && secs[0].title === KANBAN_DE_PIDE[pide];
  const todas = secs.flatMap((x) => x.options.map((o) => ({ valor: o.value, etapa: o.label, producto: unSolo ? null : x.title })));
  const nombre = (o: { etapa: string; producto: string | null }) => (o.producto ? `${o.etapa} (${o.producto})` : o.etapa);
  let calzan = todas.filter((o) => plano(o.etapa) === quiere || plano(o.valor.split(':').pop() ?? '') === quiere);
  if (calzan.length > 1 && producto) calzan = calzan.filter((o) => o.producto != null && plano(o.producto) === plano(producto));
  if (calzan.length === 1) return { ok: true, valor: calzan[0].valor, rotulo: nombre(calzan[0]) };
  if (calzan.length > 1) return { ok: false, motivo: `Hay ${calzan.length} etapas «${etapa}»: dime de qué producto.`, opciones: calzan.map(nombre) };
  return { ok: false, motivo: `No hay una etapa «${etapa}» para esta plantilla.`, opciones: todas.map(nombre).slice(0, 15) };
}
