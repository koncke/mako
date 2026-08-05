// =============================================================================
// Las secuencias que salen de los 3 audios del onboarding
// =============================================================================
// Al terminar de grabar, el dueño tiene 3 notas de voz sueltas en la biblioteca.
// Esto las convierte en las secuencias que de verdad las envían — que es lo que
// hace que grabarlas sirva para algo.
//
// Son DOS secuencias, no tres, y el motivo es el que manda todo el diseño:
//
//   · El audio de BIENVENIDA le llega a quien dejó sus datos y no agendó.
//     Cohorte propio, secuencia propia.
//   · Los otros dos le llegan a quien ACABA DE AGENDAR, que es el MISMO cohorte.
//     La diferencia no está en cuándo entran sino en si ya le hablamos: a quien
//     recibió tu bienvenida no le podés decir "hola, soy Fulano" otra vez.
//     Por eso van como dos pasos de apertura mutuamente excluyentes dentro de la
//     misma secuencia (requiere: 'ya_contactado' / 'primer_contacto'), y el
//     motor deja salir exactamente uno.
//
// Nacen PAUSADAS siempre: nada sale a un lead real hasta que el dueño lo prenda.

import 'server-only';

import { getTenantDb } from './workspace';
import { getSetting } from './settings';
import { KEY_AUDIOS_CLAVE, type ClaveAudio } from './audios-paso';
import type { PasoSecuencia } from './nutricion';

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
    ? `Te dejo acá el video: ${(linkVideo ?? '').trim()}`
    : '';

  const planos: Array<{ clave: string; nombre: string; etapa: string; trigger: string; pasos: PasoSecuencia[] }> = [];

  if (audios.bienvenida) {
    planos.push({
      clave: 'chat-agent-bienvenida',
      nombre: 'Bienvenida — dejó sus datos y no agendó',
      etapa: 'nutri',
      trigger: 'instant_form_sin_agenda',
      pasos: [pasoAudio(1, 1, audios.bienvenida, pieBienvenida)],
    });
  }

  // El pie de los audios de post-agenda. El audio pide algo para llegar
  // preparado, pero un audio NO admite variables ni links: el link del video y
  // el pedido de confirmación tienen que ir por escrito, pegados a la nota de
  // voz. Sin esto la secuencia mandaba el audio con el pie VACÍO y nadie
  // confirmaba nada.
  const piePostAgenda = [
    (linkVideo ?? '').trim() ? `Te dejo el video para que llegues con contexto: ${(linkVideo ?? '').trim()}` : '',
    '¿Me confirmas por acá que te queda bien el horario?',
  ].filter(Boolean).join('\n');

  // Los dos de post-agenda comparten secuencia. El orden importa: si el primero
  // no corresponde, el motor pasa al segundo en la misma corrida.
  const pasosAgenda: PasoSecuencia[] = [];
  if (audios.agenda_con_bienvenida) pasosAgenda.push(pasoAudio(1, 1, audios.agenda_con_bienvenida, piePostAgenda, 'ya_contactado'));
  if (audios.agenda_primer_contacto) pasosAgenda.push(pasoAudio(pasosAgenda.length + 1, 1, audios.agenda_primer_contacto, piePostAgenda, 'primer_contacto'));
  if (pasosAgenda.length) {
    // ESPERAR LA CONFIRMACIÓN antes de avanzar no necesita un temporizador
    // propio: el motor ya pausa la inscripción en cuanto el lead escribe
    // (pausarPorRespuesta la pasa a 'respondio' y borra el próximo envío). Así
    // que un segundo paso a 24h le llega SOLO a quien no contestó — que es
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
    const recordatorio: PasoSecuencia = {
      orden: pasosAgenda.length + 1, canal: 'whatsapp', delay_horas: 24,
      tipo: 'texto', audio_id: null, requiere: 'sin_respuesta',
      asunto: null,
      cuerpo: 'Hola {{nombre}}, ¿te sigue quedando bien el horario de la reunión? Con un sí me alcanza.',
      variantes: [
        'Hola {{nombre}}, ¿te sigue quedando bien el horario de la reunión? Con un sí me alcanza.',
        '{{nombre}}, ¿me confirmas la reunión? Si necesitas moverla, dime y lo acomodamos.',
        'Hola {{nombre}}, ¿queda en pie lo que agendamos? Avísame y quedo tranquilo.',
      ],
      proveedor: 'no_oficial', template_wa: null,
    };
    planos.push({
      clave: 'chat-agent-post-agenda',
      nombre: 'Agendó — confirmación y preparación',
      etapa: 'postagenda',
      trigger: 'agendado_sin_confirmar',
      pasos: [...pasosAgenda, recordatorio].map((p, i) => ({ ...p, orden: i + 1 })),
    });
  }

  for (const plan of planos) {
    const { data: existente } = await supabase
      .from('nutricion_secuencias').select('id').eq('clave', plan.clave).maybeSingle();
    const fila = existente as { id: number } | null;

    if (fila) {
      // Re-grabar un audio tiene que actualizar la secuencia que lo manda, o el
      // dueño estaría enviando la versión vieja sin enterarse. Se desarchiva por
      // si la había archivado en la limpieza.
      await supabase.from('nutricion_secuencias')
        .update({ pasos: plan.pasos, archivada_at: null, updated_at: new Date().toISOString() })
        .eq('id', fila.id);
      out.push({ clave: plan.clave, nombre: plan.nombre, creada: false, audios: plan.pasos.length });
      continue;
    }

    const { error } = await supabase.from('nutricion_secuencias').insert({
      clave: plan.clave, nombre: plan.nombre, etapa: plan.etapa,
      trigger_tipo: plan.trigger, activa: false, pasos: plan.pasos,
    });
    if (error) { console.error(`[secuencias-audios] ${plan.clave}: ${error.message}`); continue; }
    out.push({ clave: plan.clave, nombre: plan.nombre, creada: true, audios: plan.pasos.length });
  }

  return out;
}
