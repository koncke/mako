// =============================================================================
// plantillas-automatizaciones — la GALERÍA de automatizaciones para arrancar de una hecha
// =============================================================================
// Pedido de Martín (10/10/2026), al preguntarle si quería las automatizaciones de los clientes
// como galería al crear o copiadas a su workspace: «Si, hagamos la galería de las más comunes...
// Pero entonces revisa las automatizaciones que hay en mi workspace, que estan viejas y no estan
// bien». Y después: «Pero no estan todas las plantillas de Mauricio y siguen habiendo cosas de
// versiones anteriores que estan mal..».
//
// ⚠️ «PLANTILLA» ACÁ NO ES UN MENSAJE DE MaKo EN WHATSAPP. En el código, `lib/plantillas.ts` y
// `lib/avisos-catalogo.ts` son los mensajes de MaKo (docs/hallazgos-chatbot.md, «"Las plantillas"
// son dos cosas»). Esto es la tercera cosa: una AUTOMATIZACIÓN de la tab Automations armada de
// antemano, que se copia al workspace de quien la elige y nace APAGADA.
//
// ── DE DÓNDE SALEN (medido en producción el 10/10/2026, sólo lectura) ─────────────────────────
// Las diez automatizaciones vivas de los clientes: las seis de ws1 (#198, #212, #213, #220, #221,
// #226), dos de ws4 (#209 y #210, copias de las del onboarding) y dos de ws13 (#223 y #224). Cada
// plantilla dice en `origen` de cuál salió. Se GENERALIZARON:
//   · sin nada del negocio de origen: ni nombres, ni sus audios (`audio_id`), ni su número, ni sus
//     etiquetas (`etiquetaId`), ni sus links (el video de confirmación, su agenda de Cal.com);
//   · los audios pasan a texto, y lo que dependía de un link («¿viste el video?») a una pregunta
//     que cualquier negocio puede hacer;
//   · el único dato del «{ }» es `{{nombre}}`: lo tiene todo lead. Uno de la reunión
//     (`{{lead_fecha_r1}}`, `{{lead_link_r1}}`) sale CRUDO al lead que no lo tiene cargado
//     (lib/variables-resolver.ts), y un CRON por etapa no garantiza que lo tenga.
//
// ── EL MODELO DE LA SEXTA TANDA, NADA DE ANTES ────────────────────────────────────────────────
//   · Tarjetas con ids, esperas, condiciones y «Si responde». NADA de «Ir a» (la sexta tanda lo
//     sacó: #198 tenía dos, a la #212) ni de los campos de la lista de antes (`delay_horas`,
//     `requiere`, `ancla`): lo que eran se escribe con una espera o una condición.
//   · EL CRON ES UNA ETAPA, NO UN EVENTO. Los eventos del catálogo de antes («Dejó el formulario sin
//     agendar», «Agendó pero no confirmó», «Tuvo reunión hace +45 días») ya no se ofrecen en el CRON
//     (tercera tanda, decisión 4: «todo eso debería ir dentro del editable del CONDICIONAL»). Cada
//     plantilla arranca cuando el lead LLEGA A UNA ETAPA, y lo que el evento decía va en la primera
//     condición: «No agendó», «Ya le escribiste», «Próxima reunión en ≤ 720 h».
//   · LA ETAPA ES DEL NEGOCIO, así que la plantilla no la trae (`cron.pide`): la pantalla la pide al
//     elegir (app/automations/GaleriaPlantillas.tsx) y, si no se elige, nace con el CRON a elegir
//     («Elige qué la dispara», lo que dice la tarjeta CRON de una recién creada).
//   · «Sale sola» va EXPLÍCITO en cada mensaje (`revisar`): sin `estrategia` (una nueva no la
//     tiene) lo ausente es «borrador», y eso no es una decisión de la plantilla sino un default.
//     Lo sensible —el precio, quien no compró, quien no le interesa— queda para que lo apruebe una
//     persona, como en las de origen.
//
// ⚠️ PURO Y SIN `server-only`: lo importan la pantalla (la galería), el server (lib/plantilla-crear.ts,
// que la crea) y el test (tests/plantillas-automatizaciones.test.ts, que valida CADA plantilla con
// `validarGrafo` y con el freno de Publicar, y que no traiga datos de un cliente real).
// =============================================================================

import type { PasoGrafo, FilaCondicion, CasoRespuesta, Espera } from './flujo-grafo';
import { LEAD_DEL_EVENTO } from './api-mako/flujo-params';
import { OP_AVISAR } from './flujo-legado';
import {
  pasosDisparo, pedidoDisparo, rotuloDisparo, PASO_PRODUCTOS, KANBAN_ADQUISICION, KANBAN_ENTREGA,
  type ProductoParaDisparo, type SeccionDisparo,
} from './flujo-conversacion';
import type { Disparador } from './disparadores';
import { TOPE_NOMBRE_SECUENCIA } from './setting-estrategia';

// ── El dato ─────────────────────────────────────────────────────────────────────────────────────

/** De qué kanban es la etapa que arranca la plantilla: la VENTA (el embudo) o la ENTREGA del servicio. */
export type PideCron = 'etapa_venta' | 'etapa_entrega';

/** El `trigger_tipo` de cada una (lib/nutricion-etapa.ts: `TRIGGER_ETAPA` y `TRIGGER_ENTREGA`). */
export const TRIGGER_DE_PIDE: Readonly<Record<PideCron, string>> = {
  etapa_venta: 'etapa_actual',
  etapa_entrega: 'entrega_actual',
};

export type CronDePlantilla = {
  pide: PideCron;
  /** Qué etapa conviene elegir, dicho como la ve el negocio. Va debajo del desplegable. */
  ayuda: string;
};

/** Un paso de una plantilla: una tarjeta del lienzo, como la arma el ＋ (`nodoNuevo`). */
export type PasoDePlantilla = PasoGrafo & {
  accion?: { operacion: string; params: Record<string, unknown> };
  /** Sólo email: la vista previa. */
  preheader?: string | null;
};

export type PlantillaAutomatizacion = {
  /** Estable: es lo que manda la pantalla al elegirla. */
  id: string;
  /** El nombre con que nace (tope `TOPE_NOMBRE_SECUENCIA`). */
  nombre: string;
  emoji: string;
  /** Para qué sirve, en una línea (`TOPE_LINEA`). */
  linea: string;
  /** De qué automatización real salió. Para el que la mantenga: no se dibuja. */
  origen: string;
  cron: CronDePlantilla;
  pasos: readonly PasoDePlantilla[];
};

/** El tope de la línea de una tarjeta: el de una fila de una lista de N (AGENTS.md, «La pantalla dice QUÉ pasó»). */
export const TOPE_LINEA = 110;

// ── Las piezas (lo mismo que nace del ＋ del lienzo, `nodoNuevo` en lib/flujo-conversacion.ts) ────

const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' } as const;

/** Un mensaje de WhatsApp. `ia` = «MaKo lo adapta» (el texto es la base y el respaldo, lib/paso-ia.ts). */
function whatsapp(id: string, cuerpo: string, siguiente: string | null, o: { revisar: boolean; ia?: boolean }): PasoDePlantilla {
  return { ...RELLENO, id, cuerpo, siguiente, revisar: o.revisar, ...(o.ia ? { tipo: 'ia' } : {}) };
}

function email(id: string, asunto: string, vistaPrevia: string, cuerpo: string, siguiente: string | null, o: { revisar: boolean }): PasoDePlantilla {
  return { ...RELLENO, id, canal: 'email', asunto, preheader: vistaPrevia, cuerpo, siguiente, revisar: o.revisar };
}

function esperar(id: string, minutos: number, siguiente: string | null, modo: Espera['modo'] = 'tiempo'): PasoDePlantilla {
  return { ...RELLENO, id, nodo: 'esperar', espera: { modo, minutos }, siguiente };
}

/** Una condición de UNA rama («si se cumple» → `siguiente`, «si no» → `siNo`). Las filas van unidas con «y». */
function condicion(id: string, filas: FilaCondicion[], siguiente: string | null, siNo: string | null): PasoDePlantilla {
  const unidas = filas.map((f, k) => (k === 0 ? f : { ...f, union: 'y' as const }));
  return { ...RELLENO, id, nodo: 'condicion', ramas: [{ id: `${id}_si`, modo: 'todas', filas: unidas, siguiente }], si_no: siNo };
}

/** La tarjeta MaKo: el aviso al grupo del negocio sobre el lead del evento (`avisar_al_equipo`). */
function mako(id: string, mensaje: string, siguiente: string | null, titulo?: string): PasoDePlantilla {
  return { ...RELLENO, id, siguiente, accion: { operacion: OP_AVISAR, params: { leadId: LEAD_DEL_EVENTO, ...(titulo ? { titulo } : {}), mensaje } } };
}

/** «Si responde»: los casos que busca el clasificador, y «otra cosa». */
function siResponde(id: string, casos: CasoRespuesta[], otraCosa: string | null): PasoDePlantilla {
  return { ...RELLENO, id, nodo: 'respuesta', casos, si_no: otraCosa };
}

/** Una respuesta de MaKo dentro de «Si responde»: el texto es CÓMO contestar (`comoResponder`). */
function respuesta(id: string, comoResponder: string, siguiente: string | null, o: { revisar: boolean }): PasoDePlantilla {
  return { ...RELLENO, id, tipo: 'ia', cuerpo: comoResponder, siguiente, revisar: o.revisar };
}

const caso = (id: string, titulo: string, cuando: string, siguiente: string): CasoRespuesta => ({ id, titulo, cuando, siguiente });

// Las filas que se repiten. Ninguna necesita un dato del negocio (ni una etiqueta ni una etapa).
const NO_AGENDO: FilaCondicion = { campo: 'agendo', no: true };
const YA_LE_ESCRIBISTE: FilaCondicion = { campo: 'ya_contactado' };
const NUNCA_LE_ESCRIBISTE: FilaCondicion = { campo: 'ya_contactado', no: true };
const NO_PAGO: FilaCondicion = { campo: 'pago', no: true };
const TIENE_WHATSAPP: FilaCondicion = { campo: 'tiene_telefono' };
/** «Llegó hace menos de 72 h» (el «Solo a leads recientes» de #198: la PRIMERA tarjeta, `antiguedadDeEntrada`). */
const RECIENTE: FilaCondicion = { campo: 'antiguedad', valor: 72 };
/**
 * «Próxima reunión en ≤ 720 h»: tiene una reunión POR DELANTE (en los próximos 30 días).
 *
 * ⚠️ VA ANTES DE CADA MENSAJE QUE HABLA DE LA REUNIÓN, NO SÓLO AL ENTRAR. En las de origen lo cuidaba
 * el MOTOR: «la reunión ya pasó» cierra sin mandar (`preparaUnaReunion`, lib/nutricion-familias.ts),
 * pero esa guarda decide por el `trigger_tipo` —la familia `agendado_*`, los eventos de antes— y una
 * plantilla arranca por una ETAPA (`etapa_actual`), que no es de la familia. Sin esta fila: al prender
 * la automatización, el CRON inscribe a TODOS los que están en «Agendado», también al que la tuvo hace
 * un mes; y a quien agendó para dentro de 20 h, el «¿me confirmas que nos vemos?» de las 25 h le
 * llegaría con la reunión ya pasada (AGENTS.md, «Un mensaje que habla de un MOMENTO se re-pregunta al
 * salir»).
 */
const REUNION_POR_DELANTE: FilaCondicion = { campo: 'reunion_en', op: 'menor_igual', valor: 720 };

/** Lo que dice el aviso de «otra cosa» en las de origen (#198, #212, #213, #220, #221, #223, #224). */
const NO_SE_CONTESTAR = 'Te escribió algo que no sé contestar';
const NO_CONFIRMO = { titulo: 'no confirmó la reunión', mensaje: 'Agendó y no confirmó. Conviene que le marques tú.' } as const;

// Las respuestas que se repiten entre las post-agenda (de #212, #213 y #221, sin el video ni el link).
const R_CONFIRMA = 'Agradece en una línea y confírmale que nos vemos en la reunión. No le hagas más preguntas.';
const R_PRECIO_REUNION = 'Dile que el precio se ve en la reunión, una vez que se entiende su caso. Invítalo a llegar con sus dudas anotadas. No des cifras.';
const R_PREGUNTA_REUNION = 'Contesta lo que pregunta con lo que se sabe de su reunión. Si no tienes el dato, dile que se lo confirmas en un rato.';
const R_CAMBIAR = 'Dile que no hay problema y pregúntale qué día y horario le quedan mejor. No propongas horarios ni mandes links.';
const R_NO_INTERESA = 'Agradece que te avise, en una línea, sin insistir. Déjale la puerta abierta.';
const R_PRECIO_LLAMADA = 'Dile que el precio depende de lo que necesite y que lo ven en una llamada corta. Invítalo a agendarla. No des cifras.';

const C_CONFIRMA = (id: string, sig: string) => caso(id, 'Confirma', 'Confirma que va a estar, o contesta solo con un sí, ok, gracias o un emoji.', sig);
const C_PRECIO = (id: string, sig: string) => caso(id, 'Pregunta el precio', 'Pregunta cuánto cuesta, las formas de pago o si hay descuento.', sig);
const C_REUNION = (id: string, sig: string) => caso(id, 'Pregunta por la reunión', 'Pregunta a qué hora es, qué día, cuánto dura, de qué se trata o dónde está el link.', sig);
const C_CAMBIAR = (id: string, sig: string) => caso(id, 'Quiere cambiar el día', 'Dice que no puede en el horario que agendó, pide cambiar el día o la hora, o pregunta cómo reagendar.', sig);
const C_NO_INTERESA = (id: string, sig: string) => caso(id, 'No le interesa', 'Dice que no le interesa, que no es el momento o pide que no le escriban.', sig);

/**
 * LA POST-AGENDA DE #212 Y #213, generalizada. Las dos son el MISMO flujo con otra primera fila
 * («Ya le escribiste» / «Nunca le escribiste») y otro primer mensaje: en las de origen, eran dos
 * eventos del catálogo de antes y dos audios distintos.
 */
function postAgenda(pre: string, primera: FilaCondicion, primerMensaje: string): PasoDePlantilla[] {
  const id = (s: string) => `${pre}_${s}`;
  return [
    esperar(id('espera_1h'), 60, id('filtro')),
    condicion(id('filtro'), [primera, REUNION_POR_DELANTE], id('prepara'), null),
    whatsapp(id('prepara'), primerMensaje, id('espera_1d'), { revisar: false }),
    esperar(id('espera_1d'), 1440, id('sigue_1')),
    condicion(id('sigue_1'), [REUNION_POR_DELANTE], id('confirma'), null),
    whatsapp(id('confirma'), 'Hola {{nombre}}, ¿me confirmas que nos vemos en la reunión?', id('espera_12h'), { revisar: false, ia: true }),
    esperar(id('espera_12h'), 720, id('sigue_2')),
    condicion(id('sigue_2'), [REUNION_POR_DELANTE], id('aviso'), null),
    mako(id('aviso'), NO_CONFIRMO.mensaje, null, NO_CONFIRMO.titulo),
    siResponde(id('si_responde'), [
      C_CONFIRMA(id('c_confirma'), id('r_confirma')),
      C_PRECIO(id('c_precio'), id('r_precio')),
      C_REUNION(id('c_reunion'), id('r_reunion')),
      C_CAMBIAR(id('c_cambiar'), id('r_cambiar')),
    ], id('r_otra')),
    respuesta(id('r_confirma'), R_CONFIRMA, null, { revisar: false }),
    respuesta(id('r_precio'), R_PRECIO_REUNION, null, { revisar: true }),
    respuesta(id('r_reunion'), R_PREGUNTA_REUNION, null, { revisar: true }),
    respuesta(id('r_cambiar'), R_CAMBIAR, id('r_cambiar_aviso'), { revisar: false }),
    mako(id('r_cambiar_aviso'), 'Quiere cambiar el día de la reunión: coordina el nuevo horario.', null, 'quiere cambiar el día'),
    mako(id('r_otra'), NO_SE_CONTESTAR, null),
  ];
}

// ── La galería ──────────────────────────────────────────────────────────────────────────────────

export const PLANTILLAS: readonly PlantillaAutomatizacion[] = [
  {
    id: 'bienvenida-sin-agenda',
    nombre: 'Bienvenida — dejó sus datos y no agendó',
    emoji: '👋',
    linea: 'Saluda a quien dejó sus datos y lo invita a agendar una llamada.',
    origen: '#198 (ws1) y #209 (ws4)',
    cron: { pide: 'etapa_venta', ayuda: 'La etapa donde entran los leads nuevos.' },
    pasos: [
      condicion('bv_reciente', [RECIENTE], 'bv_espera_1h', null),
      esperar('bv_espera_1h', 60, 'bv_sin_agenda'),
      condicion('bv_sin_agenda', [NO_AGENDO], 'bv_hola', null),
      whatsapp('bv_hola', 'Hola {{nombre}} 👋 Gracias por dejarnos tus datos. ¿Te gustaría agendar una llamada corta para ver cómo podemos ayudarte?', 'bv_espera_1d', { revisar: false }),
      esperar('bv_espera_1d', 1440, 'bv_sigue_sin_agenda'),
      condicion('bv_sigue_sin_agenda', [NO_AGENDO], 'bv_recordatorio', null),
      whatsapp('bv_recordatorio', '{{nombre}}, ¿pudiste ver mi mensaje? Si quieres, respóndeme por aquí y te ayudo a encontrar un horario.', null, { revisar: false, ia: true }),
      siResponde('bv_si_responde', [
        caso('bv_c_agendar', 'Quiere agendar', 'Dice que sí, que quiere agendar, pide horarios o pregunta cómo seguimos.', 'bv_r_agendar'),
        C_PRECIO('bv_c_precio', 'bv_r_precio'),
        C_NO_INTERESA('bv_c_no', 'bv_r_no'),
      ], 'bv_r_otra'),
      respuesta('bv_r_agendar', 'Agradece en una línea y dile que con gusto lo ayudamos a agendar. Pregúntale qué día y horario le quedan mejor. No propongas horarios ni mandes links.', 'bv_r_agendar_aviso', { revisar: false }),
      mako('bv_r_agendar_aviso', 'Quiere agendar una llamada: ayúdalo a elegir el horario.', null, 'quiere agendar'),
      respuesta('bv_r_precio', R_PRECIO_LLAMADA, null, { revisar: true }),
      respuesta('bv_r_no', R_NO_INTERESA, null, { revisar: true }),
      mako('bv_r_otra', NO_SE_CONTESTAR, null),
    ],
  },
  {
    id: 'agendo-con-bienvenida',
    nombre: 'Agendó después de tu bienvenida',
    emoji: '🤝',
    linea: 'Prepara la reunión de quien agendó y ya había recibido tu bienvenida.',
    origen: '#212 (ws1)',
    cron: { pide: 'etapa_venta', ayuda: 'La etapa de quien agendó una reunión.' },
    pasos: postAgenda('ab', YA_LE_ESCRIBISTE, 'Hola {{nombre}}, gracias por agendar 🙌 Para aprovechar la reunión, ¿me cuentas en una línea qué te gustaría resolver?'),
  },
  {
    id: 'agendo-sin-hablar',
    nombre: 'Agendó sin haber hablado contigo',
    emoji: '🙋',
    linea: 'Se presenta y prepara la reunión de quien agendó sin hablar antes contigo.',
    origen: '#213 (ws1)',
    cron: { pide: 'etapa_venta', ayuda: 'La etapa de quien agendó una reunión.' },
    pasos: postAgenda('as', NUNCA_LE_ESCRIBISTE, 'Hola {{nombre}}, te escribo por la reunión que agendaste con nosotros 🙌 Para aprovecharla, ¿me cuentas en una línea qué te gustaría resolver?'),
  },
  {
    id: 'agendo-confirmar',
    nombre: 'Agendó: confirmar y preparar',
    emoji: '📅',
    linea: 'Confirma la reunión, insiste antes del día y te avisa si no confirma.',
    origen: '#221 (ws1), #210 (ws4) y #223 (ws13)',
    cron: { pide: 'etapa_venta', ayuda: 'La etapa de quien agendó una reunión.' },
    pasos: [
      esperar('cp_espera_1h', 60, 'cp_filtro'),
      condicion('cp_filtro', [REUNION_POR_DELANTE], 'cp_hablamos', null),
      // Las dos aperturas de #221 (y de #210): a quien ya le escribiste no se le dice «te escribo por…».
      condicion('cp_hablamos', [YA_LE_ESCRIBISTE], 'cp_ya', 'cp_nuevo'),
      whatsapp('cp_ya', 'Hola {{nombre}}, gracias por agendar 🙌 ¿Me confirmas que nos vemos en la reunión?', 'cp_espera_1d', { revisar: false }),
      whatsapp('cp_nuevo', 'Hola {{nombre}}, te escribo por la reunión que agendaste con nosotros. ¿Me confirmas que vas a poder estar?', 'cp_espera_1d', { revisar: false }),
      // Las dos flechas llegan a la MISMA espera (sexta tanda: varios padres). En #221 era un «Ir a».
      esperar('cp_espera_1d', 1440, 'cp_sigue_1'),
      condicion('cp_sigue_1', [REUNION_POR_DELANTE], 'cp_recordatorio', null),
      whatsapp('cp_recordatorio', '{{nombre}}, ¿pudiste ver mi mensaje? Confírmame por aquí si nos vemos en la reunión.', 'cp_espera_12h', { revisar: false, ia: true }),
      esperar('cp_espera_12h', 720, 'cp_sigue_2'),
      condicion('cp_sigue_2', [REUNION_POR_DELANTE], 'cp_aviso', null),
      mako('cp_aviso', NO_CONFIRMO.mensaje, 'cp_antes_4h', NO_CONFIRMO.titulo),
      // Sin reunión por delante, esta espera corta sola (el motor: `sin_reunion`).
      esperar('cp_antes_4h', 240, 'cp_ultimo', 'antes_reunion'),
      whatsapp('cp_ultimo', '{{nombre}}, todavía no tengo tu confirmación para la reunión de hoy. ¿Sigue en pie? Si no puedes, la cambiamos para cuando te quede mejor.', null, { revisar: true }),
      siResponde('cp_si_responde', [
        C_CONFIRMA('cp_c_confirma', 'cp_r_confirma'),
        C_PRECIO('cp_c_precio', 'cp_r_precio'),
        C_REUNION('cp_c_reunion', 'cp_r_reunion'),
        C_CAMBIAR('cp_c_cambiar', 'cp_r_cambiar'),
        caso('cp_c_no_califica', 'Puede no calificar', 'Cuenta que no es quien decide o que no puede invertir en este momento.', 'cp_r_no_califica'),
      ], 'cp_r_otra'),
      respuesta('cp_r_confirma', R_CONFIRMA, null, { revisar: false }),
      respuesta('cp_r_precio', R_PRECIO_REUNION, null, { revisar: true }),
      respuesta('cp_r_reunion', R_PREGUNTA_REUNION, null, { revisar: true }),
      respuesta('cp_r_cambiar', R_CAMBIAR, 'cp_r_cambiar_aviso', { revisar: false }),
      mako('cp_r_cambiar_aviso', 'Quiere cambiar el día de la reunión: coordina el nuevo horario.', null, 'quiere cambiar el día'),
      mako('cp_r_no_califica', 'Lo que contestó sugiere que no califica. Revisa antes de la reunión si la mantienes.', null, 'puede no calificar'),
      mako('cp_r_otra', NO_SE_CONTESTAR, null),
    ],
  },
  {
    id: 'no-asistio',
    nombre: 'No asistió: reagendar',
    emoji: '🔁',
    linea: 'Le escribe a quien faltó a la reunión para buscar otro horario.',
    origen: '#224 (ws13)',
    cron: { pide: 'etapa_venta', ayuda: 'La etapa de quien no asistió a la reunión.' },
    pasos: [
      condicion('na_canal', [TIENE_WHATSAPP], 'na_wa', 'na_mail'),
      whatsapp('na_wa', 'Hola {{nombre}}, te esperábamos en la reunión y no pudimos conectarnos. ¿Quieres que busquemos otro horario?', 'na_espera_2d', { revisar: false }),
      esperar('na_espera_2d', 2880, 'na_reagendo'),
      // Si ya tiene otra reunión por delante, no se le insiste («si se cumple» termina). «Agendó» no
      // sirve acá: la reunión a la que faltó también cuenta como agendada.
      condicion('na_reagendo', [REUNION_POR_DELANTE], null, 'na_wa_2'),
      whatsapp('na_wa_2', '{{nombre}}, ¿lo reagendamos? Respóndeme por aquí y buscamos un horario que te quede bien.', null, { revisar: true }),
      email('na_mail', '¿Reprogramamos tu reunión?', 'Buscamos otro horario en un minuto.',
        'Hola {{nombre}}:\n\nTe esperábamos en la reunión y no pudimos conectarnos.\n\nSi todavía te interesa, responde este correo y buscamos un nuevo horario.', null, { revisar: false }),
      siResponde('na_si_responde', [
        caso('na_c_reagendar', 'Quiere reagendar', 'Pide disculpas, cuenta por qué no pudo, dice que quiere reprogramar o pregunta por otro horario.', 'na_r_reagendar'),
        C_NO_INTERESA('na_c_no', 'na_r_no'),
      ], 'na_r_otra'),
      respuesta('na_r_reagendar', R_CAMBIAR, 'na_r_reagendar_aviso', { revisar: false }),
      mako('na_r_reagendar_aviso', 'Quiere reagendar la reunión: coordina el nuevo horario.', null, 'quiere reagendar'),
      respuesta('na_r_no', R_NO_INTERESA, null, { revisar: true }),
      mako('na_r_otra', NO_SE_CONTESTAR, null),
    ],
  },
  {
    id: 'reactivar-sin-cierre',
    nombre: 'Reactivar: tuvo reunión y no cerró',
    emoji: '🔥',
    linea: 'Retoma la charla 45 días después con quien tuvo la reunión y no compró.',
    origen: '#220 (ws1)',
    cron: { pide: 'etapa_venta', ayuda: 'La etapa de quien tuvo la reunión y no compró.' },
    pasos: [
      // Los 45 días del evento de origen («Tuvo reunión hace +45 días y no cerró»), contados desde que
      // llega a la etapa. Y al final se vuelve a mirar que no haya pagado en el medio.
      esperar('rc_espera_45d', 45 * 1440, 'rc_sin_pago'),
      condicion('rc_sin_pago', [NO_PAGO], 'rc_retomar', null),
      whatsapp('rc_retomar', 'Hola {{nombre}}, hace un tiempo tuvimos una reunión y quedó en pausa. ¿Sigue en tus planes? Si quieres, lo retomamos esta semana; si ya no es el momento, dímelo sin problema.', 'rc_espera_3d', { revisar: true }),
      esperar('rc_espera_3d', 3 * 1440, 'rc_puerta'),
      whatsapp('rc_puerta', '{{nombre}}, te dejo la puerta abierta: cuando quieras retomarlo, respóndeme por aquí y lo vemos.', null, { revisar: true }),
      siResponde('rc_si_responde', [
        caso('rc_c_retomar', 'Quiere retomarlo', 'Dice que sí, que le interesa retomarlo, pregunta cómo seguimos o pide horarios.', 'rc_r_retomar'),
        C_PRECIO('rc_c_precio', 'rc_r_precio'),
        C_NO_INTERESA('rc_c_no', 'rc_r_no'),
      ], 'rc_r_otra'),
      respuesta('rc_r_retomar', 'Agradece en una línea y dile que con gusto lo retoman. Pregúntale qué día y horario le quedan mejor esta semana. No menciones precios.', 'rc_r_retomar_aviso', { revisar: true }),
      mako('rc_r_retomar_aviso', 'Quiere retomarlo: coordina una nueva reunión.', null, 'quiere retomarlo'),
      respuesta('rc_r_precio', R_PRECIO_LLAMADA, null, { revisar: true }),
      respuesta('rc_r_no', R_NO_INTERESA, null, { revisar: true }),
      mako('rc_r_otra', NO_SE_CONTESTAR, null),
    ],
  },
  {
    id: 'felicitacion-clase',
    nombre: 'Felicitación al terminar una clase',
    emoji: '🎉',
    linea: 'Felicita al alumno cada vez que avanza a la próxima etapa de su curso.',
    origen: '#226 (ws1)',
    cron: { pide: 'etapa_entrega', ayuda: 'Las etapas de la entrega que marcan una clase terminada.' },
    pasos: [
      condicion('fc_canal', [TIENE_WHATSAPP], 'fc_wa', 'fc_mail'),
      whatsapp('fc_wa', '¡Felicitaciones, {{nombre}}! 🎉 Terminaste una clase más. Sigue así: cada paso cuenta.', null, { revisar: false }),
      email('fc_mail', '¡Felicitaciones por tu avance!', 'Terminaste una clase más.',
        'Hola {{nombre}}:\n\n¡Felicitaciones por terminar la clase! Cada paso que das te acerca a tu objetivo.\n\nSigue así.', null, { revisar: false }),
    ],
  },
];

// ── Lo que se lee de la galería ─────────────────────────────────────────────────────────────────

export function plantillaPorId(id: unknown): PlantillaAutomatizacion | null {
  return typeof id === 'string' ? PLANTILLAS.find((p) => p.id === id) ?? null : null;
}

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
const KANBAN_DE_PIDE: Readonly<Record<PideCron, string>> = { etapa_venta: KANBAN_ADQUISICION, etapa_entrega: KANBAN_ENTREGA };

/** Lo que dice el botón del desplegable mientras no se eligió nada. */
export const SIN_ETAPA = 'Elige la etapa';

/**
 * LAS ETAPAS QUE SE PUEDEN ELEGIR para una plantilla: las del desplegable del CRON (`pasosDisparo`,
 * la MISMA función que usa el editor del CRON) sin las etiquetas y sólo del kanban que la plantilla
 * pide. Con varios productos, un paso por producto y adentro sus etapas; con uno, las etapas directo
 * (el paso del kanban se saltea: hay uno solo). Vacío = el negocio no tiene productos con ese kanban,
 * y la plantilla nace con el CRON a elegir.
 */
export function seccionesParaCron(pide: PideCron, productos: readonly ProductoParaDisparo[]): SeccionDisparo[] {
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
  const etapa = typeof p.etapa === 'string' && p.etapa ? p.etapa : null;
  if (!etapa) return null;
  const etapas = Array.isArray(p.etapas) ? (p.etapas as unknown[]).map(String) : null;
  const d: Disparador = { id: 'd1', trigger_tipo: String(p.trigger_tipo), etapa, etapas: etapas && etapas.length > 1 ? etapas : null };
  if (pide === 'etapa_venta') d.funnel_id = p.funnel_id == null ? null : Number(p.funnel_id);
  else d.producto_id = Number(p.producto_id);
  return d;
}
