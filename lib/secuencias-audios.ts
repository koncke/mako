// =============================================================================
// Las secuencias que salen de los 3 audios del onboarding
// =============================================================================
// Al terminar de grabar, el dueño tiene 3 notas de voz sueltas en la biblioteca.
// Esto las convierte en las secuencias que de verdad las envían — que es lo que
// hace que grabarlas sirva para algo.
//
// Son TRES secuencias, una por audio, y cada una tiene su cohorte:
//
//   · BIENVENIDA          → dejó sus datos y no agendó.
//   · AGENDÓ CONOCIÉNDOTE → agendó DESPUÉS de tu bienvenida: ya te escuchó.
//   · AGENDÓ SIN HABLARTE → agendó sin haber recibido nada tuyo: te presentás.
//
// ⚠️ LAS DOS ÚLTIMAS ERAN UNA SOLA SECUENCIA CON DOS PASOS EXCLUYENTES
// (`requiere: 'ya_contactado' / 'primer_contacto'`), y el motor dejaba salir
// uno. Funcionaba, y aun así estaba mal para el que la EDITA: la pantalla
// mostraba dos audios en la misma secuencia y se leía como que salían los dos.
// El dueño lo reportó así — «no se deben enviar ambos, son situaciones
// diferentes». Que el motor lo resuelva bien no arregla que la pantalla lo
// cuente mal.
//
// Lo que hace que la separación no traiga el duplicado que evitaba el paso
// excluyente está en `lib/nutricion.ts`: los dos triggers son una FAMILIA y
// quien está inscripto en una queda fuera de la otra. Sin eso, mandarle el
// audio a un lead de «primer contacto» lo convertiría en «ya contactado» y la
// corrida siguiente le mandaría el otro audio.
//
// Nacen PAUSADAS siempre: nada sale a un lead real hasta que el dueño lo prenda.

import 'server-only';

import { getTenantDb } from './workspace';
import { getSetting } from './settings';
import { KEY_AUDIOS_CLAVE, type ClaveAudio } from './audios-paso';
import { TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_NUEVO } from './nutricion-familias';
import type { PasoSecuencia } from './nutricion';
import {
  DESENLACE_VACIO, HORAS_SIN_RESPUESTA,
  type Desenlace, type Estrategia, type Objetivo,
} from './setting-estrategia';

export type SecuenciaArmada = { clave: string; nombre: string; creada: boolean; audios: number };

const pasoAudio = (orden: number, delay_horas: number, audioId: number, cuerpo: string, requiere?: PasoSecuencia['requiere']): PasoSecuencia => ({
  orden, canal: 'whatsapp', delay_horas, asunto: null,
  // El `cuerpo` de un paso de audio es el PIE que se manda junto con la nota de
  // voz (por ejemplo el link del video). No es el mensaje: el mensaje es el audio.
  cuerpo,
  tipo: 'audio', audio_id: audioId,
  // Un audio solo puede salir por el canal no oficial: Meta no aprueba
  // plantillas con nota de voz.
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

async function mapaAudios(): Promise<Partial<Record<ClaveAudio, number>>> {
  const raw = await getSetting(KEY_AUDIOS_CLAVE);
  if (!raw) return {};
  try { return JSON.parse(raw) as Partial<Record<ClaveAudio, number>>; } catch { return {}; }
}

/**
 * Crea (o actualiza) las secuencias que envían los audios del onboarding.
 * Idempotente por `clave`: volver a correrla reescribe los pasos con los audios
 * que estén grabados AHORA, sin duplicar secuencias.
 *
 * Solo arma lo que tiene audio. Si el dueño grabó dos de tres, sale la secuencia
 * que se puede armar y la otra no se inventa.
 */
export async function armarSecuenciasDeAudios(linkVideo?: string | null): Promise<SecuenciaArmada[]> {
  const supabase = await getTenantDb();
  const audios = await mapaAudios();
  const out: SecuenciaArmada[] = [];

  // El pie del audio de bienvenida: si hay video configurado, el link viaja por
  // escrito justo después de la nota de voz. Sin link no se manda nada — el
  // guion tampoco lo menciona.
  const pieBienvenida = (linkVideo ?? '').trim()
    ? `Te dejo aquí el video: ${(linkVideo ?? '').trim()}`
    : '';

  const planos: Array<{ clave: string; nombre: string; etapa: string; trigger: string; pasos: PasoSecuencia[]; estrategia: Estrategia }> = [];

  if (audios.bienvenida) {
    planos.push({
      clave: 'chat-agent-bienvenida',
      nombre: 'Bienvenida — dejó sus datos y no agendó',
      etapa: 'nutri',
      trigger: 'instant_form_sin_agenda',
      // Se logra cuando AGENDA, no cuando contesta: el trabajo de este audio es
      // que reserve, y alguien que responde «gracias» no lo cumplió. Al lograrlo
      // encadena con la post-agenda del que YA te escuchó — que es exactamente
      // quien acaba de recibir esta bienvenida.
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
  const link = (linkVideo ?? '').trim();
  const piePostAgenda = link
    ? `Te dejo el video para que llegues con contexto: ${link}\n¿Me confirmas que viste el video?`
    : '¿Me confirmas por aquí que te queda bien el horario?';

  // Cada audio de post-agenda, su secuencia. El recordatorio de 24h se repite
  // en las dos a propósito: es el mismo pedido de confirmación, y como el lead
  // entra a UNA sola de las dos (la familia lo garantiza), nunca lo recibe dos
  // veces.
  //
  // ESPERAR LA CONFIRMACIÓN antes de avanzar no necesita un temporizador
  // propio: el motor ya pausa la inscripción en cuanto el lead escribe
  // (pausarPorRespuesta la pasa a 'respondio' y borra el próximo envío). Así
  // que el segundo paso a 24h le llega SOLO a quien no contestó — que es
  // exactamente lo pedido. Con `sin_respuesta` queda dicho dos veces, y la
  // segunda es la que sobrevive si alguien cambia el motor.
  //
  // Va como TEXTO y no como audio: repetir la misma nota de voz al día
  // siguiente se lee como un bot, y acá lo único que falta es la confirmación.
  // Las variantes existen para no mandar la misma frase palabra por palabra a
  // cientos de personas (es el patrón que WhatsApp usa para banear).
  //
  // OJO CON EL REGISTRO: esto sale al lead, no a la app. Español NEUTRO y
  // tuteo — el avatar de este negocio está en México, y un "che" o un "decime"
  // suenan importados al instante. Es lo mismo que ya cuidan los escenarios
  // del ensayo y el copy de la tab.
  //
  // El recordatorio de 24 h sigue la misma regla —«siempre a raíz del video»— y
  // vuelve a dejar el link: a quien no contestó lo más probable es que no lo
  // haya abierto, y pedirle que vea algo sin dárselo de nuevo es mandarlo a
  // buscar un mensaje de ayer. El link lo pone el CÓDIGO en cada variante, nunca
  // un modelo: es un dato exacto.
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

  // Ya NO llevan `requiere` en el paso: la condición se mudó al cohorte de la
  // secuencia. Dejarla acá además la haría redundante y engañosa — la pantalla
  // diría «solo si ya le habías escrito» sobre una secuencia a la que, por
  // definición, solo entra esa gente.
  if (audios.agenda_con_bienvenida) {
    planos.push({
      clave: 'chat-agent-post-agenda-conocido',
      nombre: 'Agendó después de tu bienvenida',
      etapa: 'postagenda',
      trigger: TRIGGER_AGENDA_CONOCIDO,
      // Objetivo `preparar`: que llegue, y que llegue listo. Se logra con que
      // CONFIRME —o sea, con que responda cualquier cosa— y su fallo es el que
      // dispara el aviso al dueño de que nadie confirmó.
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

  // ── La que reemplazan las dos nuevas ───────────────────────────────────────
  // `chat-agent-post-agenda` era la secuencia ÚNICA de post-agenda, con trigger
  // `agendado_sin_confirmar`. Las dos que la reemplazan tienen claves nuevas, o
  // sea que sin esto la vieja sobrevive ACTIVA — y su cohorte se solapa con el
  // de las dos: el mismo lead entra a la vieja y a la que le toca, y recibe el
  // audio dos veces. La exclusión de familia no la puede atajar porque su
  // trigger no es de la familia.
  //
  // Se ARCHIVA, no se borra: las inscripciones y los envíos la referencian, y
  // el historial de lo que ya salió tiene que sobrevivir. Archivada, el motor
  // no la enrola ni la envía (`getSecuenciasActivas` filtra por
  // `archivada_at IS NULL`), así que la inscripción que tenga adentro queda
  // quieta — y el lead vuelve a entrar, ahora por la mitad que le corresponde.
  //
  // Solo si de verdad se armó alguna de las dos: archivar la vieja cuando el
  // dueño todavía no grabó ningún audio de post-agenda lo dejaría sin nada.
  if (planos.some((p) => p.clave.startsWith('chat-agent-post-agenda-'))) {
    const { error } = await supabase.from('nutricion_secuencias')
      .update({ activa: false, archivada_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('clave', 'chat-agent-post-agenda').is('archivada_at', null);
    if (error) console.error(`[secuencias-audios] no se pudo archivar la post-agenda vieja: ${error.message}`);
  }

  for (const plan of planos) {
    const { data: existente } = await supabase
      .from('nutricion_secuencias').select('id, estrategia').eq('clave', plan.clave).maybeSingle();
    const fila = existente as { id: number; estrategia: unknown } | null;

    if (fila) {
      // Re-grabar un audio tiene que actualizar la secuencia que lo manda, o el
      // dueño estaría enviando la versión vieja sin enterarse. Se desarchiva por
      // si la había archivado en la limpieza.
      //
      // ⚠️ LA ESTRATEGIA SOLO SE SIEMBRA SI FALTA. Es lo único de acá que el
      // dueño edita a mano —su objetivo, sus preguntas, su criterio— y volver a
      // grabar un audio no puede borrarle eso. La regla es la misma que la del
      // puente a Flow: una siembra pisa lo local únicamente cuando lo local no
      // tiene nada.
      await supabase.from('nutricion_secuencias')
        .update({
          pasos: plan.pasos, archivada_at: null, updated_at: new Date().toISOString(),
          ...(fila.estrategia ? {} : { estrategia: plan.estrategia }),
        })
        .eq('id', fila.id);
      out.push({ clave: plan.clave, nombre: plan.nombre, creada: false, audios: plan.pasos.length });
      continue;
    }

    const { error } = await supabase.from('nutricion_secuencias').insert({
      clave: plan.clave, nombre: plan.nombre, etapa: plan.etapa,
      trigger_tipo: plan.trigger, activa: false, pasos: plan.pasos,
      estrategia: plan.estrategia,
    });
    if (error) { console.error(`[secuencias-audios] ${plan.clave}: ${error.message}`); continue; }
    out.push({ clave: plan.clave, nombre: plan.nombre, creada: true, audios: plan.pasos.length });
  }

  return out;
}
