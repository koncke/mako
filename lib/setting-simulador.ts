// =============================================================================
// setting-simulador — MaKo responde como SETTER en el simulador de /setting
// =============================================================================
// El dueño escribe COMO EL LEAD y MaKo contesta en el rol de setter del negocio,
// usando la ESTRATEGIA de la secuencia (objetivo + gancho + preguntas de
// cualificación), la voz destilada, el perfil y el funnel. Es el SANDBOX del
// Setter IA (fase 2): mismo cerebro, cero envíos reales, nada se persiste.

import 'server-only';
import { getActivePersona, MAKO_NUCLEO } from './mako-prompts';
import { getPromptText, renderPrompt } from './prompt-render';
import { perfilNegocioTexto } from './onboarding';
import { resumenFunnel } from './mako-context';
import { getVozGuia } from './nutricion-generator';
import { getSecuenciasConStats } from './nutricion';
import { parseEstrategia } from './setting-estrategia';
import { insisteConLoMismo } from './conversacion-repeticion';

export const SETTING_SIMULADOR_SYSTEM_TEMPLATE = `Sos MaKo actuando como el SETTER del negocio en una conversación de WhatsApp con un lead. Tu trabajo: cualificar y llevar al lead a dar el siguiente paso, como lo haría el mejor setter humano del equipo.

VOZ DEL NEGOCIO (así escribís):
{{voz}}

LA SECUENCIA (tu guion estratégico):
{{secuencia}}

REGLAS DEL SETTER:
- Mensajes CORTOS de WhatsApp: 1 a 4 líneas. Nunca un choclo.
- Cualificá con las preguntas de la secuencia de mensajes DE A UNA, hiladas con naturalidad en la charla — jamás como interrogatorio ni encuesta.
- Si el lead muestra interés o ya calificó, llevalo al objetivo de la secuencia de mensajes (agendar → ofrecé [tu link de agenda]; pago → [tu link de pago]). Los placeholders [tu link …] se dejan TAL CUAL.
- Objeciones: validá primero, respondé corto, retomá el hilo. Sin presionar ni mendigar ("¿sigues interesado?" está prohibido).
- LA MISMA objeción se rebate DOS veces como mucho. Si el lead insiste una tercera con lo mismo, ya está: no hay nada nuevo que decirle. Cerrá con respeto, dejá la puerta abierta y no vuelvas a ofrecer nada. Seguir rebatiendo no es insistir bien, es no escuchar.
- No repitas un argumento que ya usaste en esta conversación. Si tu idea es la misma, o la decís distinto o cerrás.
- Si el lead pide algo que no sabés (precio exacto, disponibilidad), no inventes: ofrecé resolverlo en la llamada o decí que lo confirmás.
- Salida digna siempre: si el lead no quiere, cerrás bien la puerta queda abierta.

CÓMO TERMINA ESTA CONVERSACIÓN: no es infinita, pero el final lo marca EL LEAD, no vos. El marcador va en una línea aparte al final, sin nada después, y solo en estos dos casos:

[FIN:BIEN] — SOLO si el ÚLTIMO mensaje del lead ACEPTA de verdad: dice que sí, elige un horario, confirma que va, o pide el link. Que vos hayas hecho una buena propuesta NO alcanza; proponer y marcar BIEN en el mismo mensaje está prohibido. Si todavía no contestó a tu propuesta, no hay marcador.

[FIN:MAL] — si el lead dice que no le interesa, pide que no le escriban más, o vuelve por TERCERA vez con la misma objeción que ya le respondiste dos veces. Ahí no hay nada nuevo que decirle: cerrá con respeto, dejá la puerta abierta y no ofrezcas nada más.

En cualquier otro caso NO escribas ningún marcador y seguí la conversación.

CONTEXTO: esto es un SIMULADOR — el "lead" es el dueño del negocio probando la secuencia de mensajes antes de prenderla. Respondé exactamente como responderías a un lead real (no rompas el personaje ni menciones que es una prueba). Devolvé SOLO el texto del mensaje de WhatsApp, sin comillas ni preámbulo.`;

export type TurnoSim = { de: 'lead' | 'negocio'; texto: string };

/**
 * ¿Este lead califica según el criterio de la secuencia de mensajes? (reunión 31/07: "si no
 * son calificadas en chat, ya tenemos que cancelar las llamadas"). Clasificación
 * simple → IA barata. Devuelve null si no hay criterio cargado o no alcanza la
 * evidencia: NUNCA descalifica por las dudas.
 */
export async function evaluarCalificacion(secuenciaId: number, historial: TurnoSim[]): Promise<{ califica: boolean | null; razon: string }> {
  const secs = await getSecuenciasConStats();
  const sec = secs.find((s) => s.id === secuenciaId);
  const est = sec ? parseEstrategia(sec.estrategia) : null;
  if (!est || (!est.criterio.califica.length && !est.criterio.descalifica.length)) {
    return { califica: null, razon: 'la secuencia de mensajes todavía no tiene criterio de calificación' };
  }
  const charla = historial.slice(-14).map((t) => `${t.de === 'lead' ? 'LEAD' : 'NEGOCIO'}: ${t.texto}`).join('\n');
  const { chatCheap } = await import('./ai-cheap');
  const raw = await chatCheap({
    system: 'Clasificás si un lead califica según un criterio. Devolvés EXCLUSIVAMENTE un objeto JSON {"califica":"si"|"no"|"no_se","razon":"..."} sin markdown. Ante la duda, "no_se".',
    user: `CRITERIO DEL NEGOCIO
Califica si: ${est.criterio.califica.join(' · ') || '(sin reglas)'}
NO califica si: ${est.criterio.descalifica.join(' · ') || '(sin reglas)'}

CONVERSACIÓN
${charla}

¿El lead califica? Respondé "no" SOLO si hay evidencia explícita de una regla de descalificación en lo que DIJO el lead. Si no hay evidencia suficiente, "no_se".`,
    json: true, feature: 'setting-calificar', maxTokens: 300,
  });
  try {
    const o = JSON.parse(raw.replace(/```(?:json)?/gi, '').trim()) as { califica?: string; razon?: string };
    const v = String(o?.califica ?? '').toLowerCase();
    return { califica: v === 'si' ? true : v === 'no' ? false : null, razon: String(o?.razon ?? '').slice(0, 300) };
  } catch {
    return { califica: null, razon: 'no se pudo evaluar' };
  }
}

const LOGRADO_TEXTO: Record<string, string> = {
  respondio: 'el lead contesta cualquier cosa — con eso alcanza',
  agendo: 'el lead agenda la reunión',
  pago: 'el lead paga o confirma que va a pagar',
  ninguno: 'esta secuencia no cierra sola: seguí hasta que el lead se vaya',
};

/**
 * El marcador de cierre. Se saca del texto ANTES de devolverlo: esta función
 * NO la usa solo el simulador — `asistirRespuesta` la llama desde el webhook
 * de cada mensaje entrante para redactar el borrador que ve el dueño. Un
 * `[FIN:BIEN]` colado ahí terminaría pegado en un mensaje real.
 */
const MARCA_FIN = /\[\s*FIN\s*:\s*(BIEN|MAL)\s*\]/i;

export type DesenlaceSim = 'positivo' | 'negativo';
export type SimularResult =
  | { ok: true; respuesta: string; desenlace: DesenlaceSim | null }
  | { ok: false; error: string };

/** Respuesta de MaKo-setter al último mensaje del lead en el simulador. */
export async function responderSimulador(secuenciaId: number, historial: TurnoSim[]): Promise<SimularResult> {
  const secs = await getSecuenciasConStats();
  const sec = secs.find((s) => s.id === secuenciaId);
  if (!sec) return { ok: false, error: 'Esa secuencia no existe en este workspace.' };

  const est = parseEstrategia(sec.estrategia);
  const secuencia = [
    `Secuencia: ${sec.nombre} (etapa del lead: ${sec.etapa}).`,
    est ? `Objetivo: ${est.objetivo}.` : 'Objetivo: mover al lead a la siguiente etapa.',
    est?.objetivo === 'preparar'
      ? 'PREPARAR es el objetivo más importante: que el lead LLEGUE a la reunión y llegue listo. Confirmá que la tenga anotada y asegurate de que vea el video de preparación — sin el video no hay llamada.'
      : '',
    est?.gancho ? `Gancho para ofrecer: ${est.gancho}.` : 'Sin gancho definido — no inventes uno.',
    est?.preguntas.length
      ? `Preguntas de cualificación (en este orden, de a una): ${est.preguntas.map((p, i) => `${i + 1}) ${p}`).join(' ')}`
      : 'Sin preguntas de cualificación definidas.',
    // Criterio: lo que decide si esta charla termina en llamada o en despedida.
    est?.criterio.califica.length ? `CALIFICA si: ${est.criterio.califica.join(' · ')}` : '',
    est?.criterio.descalifica.length
      ? `NO CALIFICA si: ${est.criterio.descalifica.join(' · ')}. Ante una señal de estas, NO empujes la llamada: cerrá con respeto explicando que no es para él y que preferís no hacerle perder el tiempo.`
      : '',
    // El DESENLACE es lo que le dice al setter cuándo parar. Sin esto la
    // conversación no tiene final y MaKo rebate objeciones para siempre.
    est ? `SE CUMPLIÓ el objetivo cuando: ${LOGRADO_TEXTO[est.desenlace.logrado]}.` : '',
    est ? 'NO se va a cumplir cuando: el lead dice que no le interesa, pide que no le escriban más, o repite la misma objeción después de que ya se la respondiste dos veces.' : '',
  ].filter(Boolean).join('\n');

  const [persona, voz, perfil, funnel] = await Promise.all([
    getActivePersona().catch(() => ''),
    getVozGuia().catch(() => null),
    perfilNegocioTexto().catch(() => ''),
    resumenFunnel().catch(() => ''),
  ]);
  const nucleo = await getPromptText('mako.nucleo', MAKO_NUCLEO);
  const systemBase = await renderPrompt('setting.simulador', SETTING_SIMULADOR_SYSTEM_TEMPLATE, {
    voz: voz || '(sin guía de voz destilada: escribí cercano y profesional, sin sonar a bot)',
    secuencia,
  });
  let system = `${persona}\n\n${nucleo}\n\n${systemBase}`.trim();
  if (perfil) system += `\n\nPERFIL DEL NEGOCIO:\n${perfil}`;
  if (funnel) system += `\n\nFUNNEL DEL NEGOCIO:\n${funnel}`;

  // Historial → mensajes (lead = user, negocio = assistant). Tope defensivo.
  const turnos = historial.slice(-30).map((t) => ({
    role: t.de === 'lead' ? ('user' as const) : ('assistant' as const),
    content: t.texto.slice(0, 1200),
  }));
  if (!turnos.length || turnos[turnos.length - 1].role !== 'user') {
    return { ok: false, error: 'El último mensaje tiene que ser del lead.' };
  }

  // MODELO BARATO POR DEFAULT, y no es un detalle de costo menor: esta función
  // no la llama solo el simulador. La llama `asistirRespuesta` desde
  // `pausarPorRespuesta`, que corre en el webhook de CADA mensaje entrante de
  // CADA lead de CADA cliente — un bucle abierto contra el modelo caro. Para
  // redactar una respuesta de dos líneas en un registro ya destilado, un modelo
  // barato alcanza. La conversación va serializada porque es el contrato que
  // admite chatCheapCascade.
  const transcripcion = turnos
    .map((t) => `${t.role === 'user' ? 'LEAD' : 'NEGOCIO'}: ${t.content}`)
    .join('\n');
  const { chatCheapCascade, CASCADA_GRATIS } = await import('./ai-cheap');
  const respuesta = await chatCheapCascade({
    system,
    user: `${transcripcion}\n\nEscribe la respuesta del NEGOCIO al último mensaje del lead. Solo el texto del mensaje, nada más.`,
    maxTokens: 500, feature: 'setting-simulador', motivo: 'Respuesta del setter',
    provs: CASCADA_GRATIS,
  });
  if (!respuesta || !respuesta.trim()) return { ok: false, error: 'MaKo no respondió. Vuelve a intentarlo.' };
  const marca = respuesta.match(MARCA_FIN);
  const limpio = respuesta.replace(MARCA_FIN, '').trim();
  if (!limpio) return { ok: false, error: 'MaKo no respondió. Vuelve a intentarlo.' };

  // EL CORTE POR INSISTENCIA LO DECIDE EL SERVIDOR, no el modelo. Se le pidió en
  // el prompt que cerrara a la tercera repetición de la misma objeción y siguió
  // rebatiendo las cuatro: un modelo no lleva la cuenta de nada. Acá se cuenta.
  const delLead = historial.filter((t) => t.de === 'lead').map((t) => t.texto);
  const porInsistir = insisteConLoMismo(delLead);

  return {
    ok: true,
    respuesta: limpio,
    desenlace: marca
      ? (marca[1].toUpperCase() === 'BIEN' ? 'positivo' : 'negativo')
      : (porInsistir ? 'negativo' : null),
  };
}
