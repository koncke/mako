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
//
// ⚠️ Y DESDE LA SEXTA TANDA (09/10/2026) NACEN COMO TARJETAS: el plan y la conversión viven en
// lib/setting-semillas.ts, que es puro y tiene test. Acá queda sólo lo que toca la base.

import 'server-only';

import { getTenantDb } from './workspace';
import { getSetting } from './settings';
import { KEY_AUDIOS_CLAVE, type ClaveAudio } from './audios-paso';
import type { PasoSecuencia } from './nutricion';
import { esFlujoExplicito, audiosDeLaListaEnElFlujo } from './flujo-legado';
import { planosDeAudios, comoNace } from './setting-semillas';

export type SecuenciaArmada = { clave: string; nombre: string; creada: boolean; audios: number };

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
  const planos = planosDeAudios(audios, linkVideo);

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
      .from('nutricion_secuencias').select('id, estrategia, pasos').eq('clave', plan.clave).maybeSingle();
    const fila = existente as { id: number; estrategia: unknown; pasos: unknown } | null;

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
      //
      // ⚠️ Y UN FLUJO DE TARJETAS NO SE REARMA (08/10/2026). Esto corre en CADA carga del paso del
      // onboarding (GET /api/chat-agent/onboarding/resumen) y escribía `pasos` directo, sin pasar
      // por setSecuenciaPasos: sobre la Bienvenida y las post-agenda ya convertidas a tarjetas, las
      // devolvía a una lista de dos pasos y se perdían «Si responde» con sus casos, las esperas y
      // las condiciones, sin un error. Sobre un flujo sólo se cambia el audio de su tarjeta.
      //
      // (Una LISTA de antes que ya estaba guardada se reescribe como lista, como siempre: una fila
      // que existe no se convierte acá —puede tener inscripciones paradas en un paso—; el lienzo la
      // convierte al abrirla.)
      //
      // ⚠️ Y LA ESTRATEGIA QUE SE SIEMBRA VA CON LA FORMA DE LOS PASOS (sexta tanda). Sobre un FLUJO
      // de tarjetas sin estrategia se sembraba la de la lista —modo asistido y un fallo por silencio—,
      // y con eso el motor viejo volvía a hacer por su lado lo que ya hacen las tarjetas (cerrar por
      // silencio, avisar «no confirmó» dos veces). Sobre un flujo va la estrategia LIMPIA.
      const actuales = Array.isArray(fila.pasos) ? (fila.pasos as PasoSecuencia[]) : [];
      const pasos = esFlujoExplicito(actuales) ? audiosDeLaListaEnElFlujo(actuales, plan.pasos) : plan.pasos;
      const sembrar = fila.estrategia ? null : (esFlujoExplicito(actuales) ? comoNace(plan).estrategia : plan.estrategia);
      await supabase.from('nutricion_secuencias')
        .update({
          pasos, archivada_at: null, updated_at: new Date().toISOString(),
          ...(sembrar ? { estrategia: sembrar } : {}),
        })
        .eq('id', fila.id);
      out.push({ clave: plan.clave, nombre: plan.nombre, creada: false, audios: plan.pasos.length });
      continue;
    }

    // ⚠️ NACE COMO TARJETAS (sexta tanda): los pasos y la estrategia de `comoNace`, no la lista.
    const nace = comoNace(plan);
    const { error } = await supabase.from('nutricion_secuencias').insert({
      clave: plan.clave, nombre: plan.nombre, etapa: plan.etapa,
      trigger_tipo: plan.trigger, activa: false, pasos: nace.pasos,
      estrategia: nace.estrategia,
    });
    if (error) { console.error(`[secuencias-audios] ${plan.clave}: ${error.message}`); continue; }
    out.push({ clave: plan.clave, nombre: plan.nombre, creada: true, audios: plan.pasos.length });
  }

  return out;
}
