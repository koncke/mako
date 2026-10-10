// =============================================================================
// setting-semillas — las automatizaciones que SIEMBRA la plataforma, puras
// =============================================================================
// Dos semillas, y las dos nacen acá para que un test las pueda EJECUTAR (quienes las escriben en la
// base, lib/secuencias-audios.ts y lib/setting-secuencias.ts, importan lib/workspace.ts, que es
// `server-only`). Lo que vive acá decide qué le llega a un lead real de un cliente nuevo.
//
//   · `planosDeAudios` + `comoNace`: las tres del onboarding, con los audios del dueño (la
//     Bienvenida y las dos post-agenda). Las arma `armarSecuenciasDeAudios`.
//   · `pasosDeEsqueleto`: la que crea `crear_secuencia_mensajes` de la API de MaKo, colgada de una
//     etapa (`crearSecuenciaDesdeEtapa`).
//
// ── SEXTA TANDA (09/10/2026, General 15): NACEN COMO TARJETAS ───────────────────────────────────
// Pedido literal: «Hay plantillas que quedaron viejas con todos los cambios, incluso que no tienen
// sentido porque quedaron con configuraciones viejas obsoletas». Éstas eran dos: las dos escribían una
// LISTA de antes —la espera en `delay_horas`, la condición escondida en `requiere`, el modo asistido
// y un «sigue con» a otra automatización en `estrategia.desenlace`—, o sea el modelo que el 08/10 se
// pasó entero a tarjetas. Cada cliente nuevo arrancaba con automatizaciones que el lienzo abría
// CONVERTIDAS y marcadas «Sin publicar» sin que nadie hubiera tocado nada, y la Bienvenida con un
// «Ir a» (GO TO, que desde la sexta tanda no existe) hacia la post-agenda.
//
// La conversión es la MISMA que hace el lienzo al abrirlas (`abrirFlujo`: `legadoAGrafo` + sin
// «Ir a») y la estrategia lleva la MISMA limpieza que pone Publicar (`estrategiaConLimpieza`). Así
// lo que nace es exactamente lo que el lienzo habría guardado al publicarla, y el motor hace lo
// mismo que hacía con la lista: los mismos mensajes, a las mismas horas, a la misma gente.
//
// Lo de antes que se perdía en la conversión, dicho: el «sigue con la post-agenda del que ya te
// escuchó» al agendar. No hace falta: esa automatización arranca por SU CRON
// (`agendado_ya_contactado`) en cuanto el lead agenda, que es justo lo que el «Ir a» hacía a mano
// (punto 12 de General: «si tengo otra automatización que el CRON inicia con esa etiqueta o etapa del
// kanban, ya solo se dispara, no necesito "Go to"»).
// =============================================================================

import type { PasoSecuencia } from './nutricion';
import type { ClaveAudio } from './audios-paso';
import { TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_NUEVO } from './nutricion-familias';
import { abrirFlujo } from './flujo-legado';
import { estrategiaConLimpieza } from './flujo-conversacion';
import {
  DESENLACE_VACIO, HORAS_SIN_RESPUESTA,
  type Desenlace, type Estrategia, type Objetivo,
} from './setting-estrategia';

/** Una automatización del onboarding, como LISTA (la forma con la que se rearma al re-grabar un audio). */
export type PlanoAudios = {
  clave: string;
  nombre: string;
  etapa: string;
  trigger: string;
  /** La lista de antes. `audiosDeLaListaEnElFlujo` cruza su paso k con el `o<k>` del flujo. */
  pasos: PasoSecuencia[];
  estrategia: Estrategia;
};

const pasoAudio = (orden: number, delay_horas: number, audioId: number, cuerpo: string, requiere?: PasoSecuencia['requiere']): PasoSecuencia => ({
  orden, canal: 'whatsapp', delay_horas, asunto: null,
  // El `cuerpo` de un paso de audio es el PIE que se manda junto con la nota de
  // voz (por ejemplo el link del video). No es el mensaje: el mensaje es el audio.
  cuerpo,
  tipo: 'audio', audio_id: audioId,
  // Un audio solo puede salir por el WhatsApp de empresa (el no oficial).
  proveedor: 'no_oficial', template_wa: null,
  ...(requiere ? { requiere } : {}),
});

/**
 * La estrategia con la que NACE una secuencia de audios.
 *
 * ⚠️ ANTES NACÍAN SIN NINGUNA, y eso no era un detalle cosmético aunque lo
 * pareciera. La tab las marcaba con un chip «sin estrategia» —las tres, siempre,
 * apenas el dueño terminaba de grabar— y, peor, sin `desenlace` una secuencia
 * **no puede terminar ni encadenar**: `evaluarDesenlaces` no tiene con qué
 * decidir, así que manda sus pasos y se queda. Justo lo que el dueño pidió que
 * hicieran («las secuencias deberían saber cuándo finalizar, hacer hand-off o
 * comenzar otra»).
 *
 * Los valores no se inventan acá: el umbral de silencio sale de
 * `HORAS_SIN_RESPUESTA`, que es el catálogo, para que ajustarlo sea un lugar y
 * no tres. Lo que sí es propio de cada una es el OBJETIVO, que es lo único que
 * el armador sabe y el catálogo no.
 *
 * (Desde la sexta tanda esto es lo que se CONVIERTE: el desenlace pasa a tarjetas —la espera del
 * fallo, la condición de «agendó», el aviso de «no confirmó»— y la estrategia queda limpia.)
 */
function estrategiaDe(objetivo: Objetivo, opts?: { logrado?: Desenlace['logrado']; logradoSecuencia?: string | null }): Estrategia {
  return {
    objetivo,
    gancho: null, lead_magnet_id: null, usa_lead_magnet: false,
    // Vacíos y no inventados: las preguntas de cualificación y el criterio los
    // sabe el dueño, y rellenarlos con algo plausible es peor que dejarlos —
    // MaKo los usaría creyendo que son suyos.
    preguntas: [], criterio: { califica: [], descalifica: [] }, escenarios: [],
    desenlace: {
      ...DESENLACE_VACIO,
      logrado: opts?.logrado ?? 'respondio',
      logradoSecuencia: opts?.logradoSecuencia ?? null,
      falloHoras: HORAS_SIN_RESPUESTA[objetivo],
    },
    modo: 'asistido',
    // SALEN SOLAS (decisión de Martín, 17/09/2026). Son audios que el dueño
    // grabó con su voz para que se manden: dejarlos como borrador para que
    // alguien apriete «enviar» a mano es que la secuencia no exista. Nacen
    // PAUSADAS igual, así que nada sale hasta que el dueño las prenda — y el
    // interruptor se apaga desde la estrategia de cada una.
    envio_automatico: true,
    // Sin tope propio: la post-agenda entra por la AGENDA, no por la edad del lead.
    antiguedad_max_horas: null,
    notas: null, probada_at: null,
  };
}

/**
 * Las automatizaciones que se pueden armar con los audios grabados AHORA, como lista. Sólo arma lo
 * que tiene audio: si el dueño grabó dos de tres, sale la que se puede armar y la otra no se inventa.
 */
export function planosDeAudios(audios: Partial<Record<ClaveAudio, number>>, linkVideo?: string | null): PlanoAudios[] {
  const planos: PlanoAudios[] = [];
  const link = (linkVideo ?? '').trim();

  // El pie del audio de bienvenida: si hay video configurado, el link viaja por
  // escrito justo después de la nota de voz. Sin link no se manda nada — el
  // guion tampoco lo menciona.
  const pieBienvenida = link ? `Te dejo aquí el video: ${link}` : '';

  if (audios.bienvenida) {
    planos.push({
      clave: 'chat-agent-bienvenida',
      nombre: 'Bienvenida — dejó sus datos y no agendó',
      etapa: 'nutri',
      trigger: 'instant_form_sin_agenda',
      // Se logra cuando AGENDA, no cuando contesta: el trabajo de este audio es
      // que reserve, y alguien que responde «gracias» no lo cumplió. (El «sigue con la
      // post-agenda del que ya te escuchó» que llevaba se va en la conversión: ésa arranca
      // sola por su CRON.)
      estrategia: estrategiaDe('agendar', { logrado: 'agendo', logradoSecuencia: 'chat-agent-post-agenda-conocido' }),
      pasos: [pasoAudio(1, 1, audios.bienvenida, pieBienvenida)],
    });
  }

  // El pie de los audios de post-agenda. El audio pide algo para llegar
  // preparado, pero un audio NO admite variables ni links: el link del video y
  // el pedido de confirmación tienen que ir por escrito, pegados a la nota de
  // voz. Sin esto la secuencia mandaba el audio con el pie VACÍO y nadie
  // confirmaba nada.
  //
  // LA PREGUNTA VA «A RAÍZ DEL VIDEO» (reunión del 08/09, 20:48). Martín: «la
  // pregunta por ¿me confirmas que viste el video? O sea, que sea siempre a raíz
  // del video», y Mauricio: «Sí». Es la misma señal de confirmación —lo que
  // cuenta es que el lead conteste algo (08-T05), y `pausarPorRespuesta` lo
  // toma—, pero le pide lo que de verdad le sirve a la reunión: que llegue
  // habiendo visto el video.
  //
  // ⚠️ SOLO SI HAY VIDEO. Sin link no se le puede preguntar por un video que no
  // se le mandó: ahí queda la pregunta por el horario, que era la de antes.
  const piePostAgenda = link
    ? `Te dejo el video para que llegues con contexto: ${link}\n¿Me confirmas que viste el video?`
    : '¿Me confirmas por aquí que te queda bien el horario?';

  // Cada audio de post-agenda, su automatización. El recordatorio de 24h se repite
  // en las dos a propósito: es el mismo pedido de confirmación, y como el lead
  // entra a UNA sola de las dos (la familia lo garantiza), nunca lo recibe dos
  // veces.
  //
  // ESPERAR LA CONFIRMACIÓN antes de avanzar no necesita un temporizador
  // propio: el motor ya pausa la inscripción en cuanto el lead escribe
  // (pausarPorRespuesta la pasa a 'respondio' y borra el próximo envío). Así
  // que el segundo paso a 24h le llega SOLO a quien no contestó — que es
  // exactamente lo pedido.
  //
  // Va como TEXTO y no como audio: repetir la misma nota de voz al día
  // siguiente se lee como un bot, y acá lo único que falta es la confirmación.
  // Las variantes existen para no mandar la misma frase palabra por palabra a
  // cientos de personas (es el patrón que WhatsApp usa para banear).
  //
  // OJO CON EL REGISTRO: esto sale al lead, no a la app. Español NEUTRO y
  // tuteo — el avatar de este negocio está en México, y un "che" o un "decime"
  // suenan importados al instante.
  //
  // El recordatorio de 24 h sigue la misma regla —«siempre a raíz del video»— y
  // vuelve a dejar el link: a quien no contestó lo más probable es que no lo
  // haya abierto. El link lo pone el CÓDIGO en cada variante, nunca un modelo:
  // es un dato exacto.
  const recordatorio = (orden: number): PasoSecuencia => {
    const variantes = link
      ? [
        `Hola {{nombre}}, ¿alcanzaste a ver el video? Te lo dejo de nuevo por si acaso: ${link}`,
        `{{nombre}}, ¿pudiste ver el video antes de la reunión? Aquí lo tienes otra vez: ${link}`,
        `Hola {{nombre}}, ¿ya viste el video? Con eso aprovechamos mejor la reunión: ${link}`,
      ]
      : [
        'Hola {{nombre}}, ¿te sigue quedando bien el horario de la reunión? Con un sí me alcanza.',
        '{{nombre}}, ¿me confirmas la reunión? Si necesitas moverla, dime y lo acomodamos.',
        'Hola {{nombre}}, ¿queda en pie lo que agendamos? Avísame y quedo tranquilo.',
      ];
    return {
      orden, canal: 'whatsapp', delay_horas: 24,
      tipo: 'texto', audio_id: null, requiere: 'sin_respuesta',
      asunto: null,
      cuerpo: variantes[0],
      variantes,
      proveedor: 'no_oficial', template_wa: null,
    };
  };

  if (audios.agenda_con_bienvenida) {
    planos.push({
      clave: 'chat-agent-post-agenda-conocido',
      nombre: 'Agendó después de tu bienvenida',
      etapa: 'postagenda',
      trigger: TRIGGER_AGENDA_CONOCIDO,
      // Objetivo `preparar`: que llegue, y que llegue listo. Se logra con que
      // CONFIRME —o sea, con que responda cualquier cosa— y su fallo es el que
      // dispara el aviso al dueño de que nadie confirmó (en tarjetas: MaKo en WhatsApp).
      estrategia: estrategiaDe('preparar'),
      pasos: [pasoAudio(1, 1, audios.agenda_con_bienvenida, piePostAgenda), recordatorio(2)],
    });
  }
  if (audios.agenda_primer_contacto) {
    planos.push({
      clave: 'chat-agent-post-agenda-nuevo',
      nombre: 'Agendó sin haber hablado contigo',
      etapa: 'postagenda',
      trigger: TRIGGER_AGENDA_NUEVO,
      estrategia: estrategiaDe('preparar'),
      pasos: [pasoAudio(1, 1, audios.agenda_primer_contacto, piePostAgenda), recordatorio(2)],
    });
  }
  return planos;
}

/**
 * CÓMO NACE una automatización del plan: como TARJETAS (ver arriba). Los pasos son los que el lienzo
 * mostraría al abrir la lista (`abrirFlujo`, sin «Ir a») y la estrategia la que Publicar guardaría
 * (`estrategiaConLimpieza`). Los mensajes de la lista CONSERVAN su id (`o<k>`): es lo que permite
 * cambiarle el audio a su tarjeta cuando el dueño lo re-graba (`audiosDeLaListaEnElFlujo`).
 */
export function comoNace(p: PlanoAudios, rnd?: () => number): { pasos: PasoSecuencia[]; estrategia: Estrategia } {
  const r = abrirFlujo(p.pasos, p.estrategia, rnd ? { rnd } : {});
  const estrategia = r.limpiarEstrategia
    ? ((estrategiaConLimpieza(p.estrategia) as Estrategia | null) ?? p.estrategia)
    : p.estrategia;
  return { pasos: r.pasos, estrategia };
}

/**
 * El relleno de un mensaje de esqueleto. Un `[…]` en el cuerpo hace que el paso NO SALGA NUNCA
 * (`RX_RELLENO`, lib/nutricion.ts): es lo que impide que una automatización activada antes de
 * escribirse le mande el esqueleto a un lead. Decía «[MaKo lo escribe en el paso de redacción]», el
 * paso 5 de un wizard que ya no existe: la persona buscaba un paso que no estaba.
 */
export const RELLENO_ESQUELETO = '[Escribe este mensaje en el lienzo]';

/**
 * LOS PASOS CON LOS QUE NACE una automatización colgada de una etapa (`crearSecuenciaDesdeEtapa`):
 * un email al entrar y, 48 h después, un WhatsApp, los dos sin escribir — como TARJETAS: el email,
 * la DELAY de 48 h y el WhatsApp (ver arriba). Sin estrategia (la crea la API sin una), así que no
 * hay nada que limpiar.
 *
 * ⚠️ EL PRIMERO SIN ESPERA (08/10/2026, punto 7: «Por defecto entre el CRON y la siguiente tarjeta
 * ponés siempre un delay, cuando no debe ser así»). Una espera la pone quien arma el flujo.
 */
export function pasosDeEsqueleto(rnd?: () => number): PasoSecuencia[] {
  const lista: PasoSecuencia[] = [
    { orden: 1, canal: 'email', delay_horas: 0, asunto: '[Escribe el asunto]', cuerpo: RELLENO_ESQUELETO, template_wa: null },
    { orden: 2, canal: 'whatsapp', delay_horas: 48, asunto: null, cuerpo: RELLENO_ESQUELETO, proveedor: 'no_oficial', template_wa: null },
  ];
  return abrirFlujo(lista, null, rnd ? { rnd } : {}).pasos;
}
