// =============================================================================
// setting-simulador — MaKo responde como SETTER en el simulador de /setting
// =============================================================================
// El dueño escribe COMO EL LEAD y MaKo contesta en el rol de setter del negocio,
// usando la JUGADA de la secuencia (objetivo + gancho + preguntas de
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

export const SETTING_SIMULADOR_SYSTEM_TEMPLATE = `Sos MaKo actuando como el SETTER del negocio en una conversación de WhatsApp con un lead. Tu trabajo: cualificar y llevar al lead a dar el siguiente paso, como lo haría el mejor setter humano del equipo.

VOZ DEL NEGOCIO (así escribís):
{{voz}}

LA JUGADA (tu guion estratégico):
{{jugada}}

REGLAS DEL SETTER:
- Mensajes CORTOS de WhatsApp: 1 a 4 líneas. Nunca un choclo.
- Cualificá con las preguntas de la jugada DE A UNA, hiladas con naturalidad en la charla — jamás como interrogatorio ni encuesta.
- Si el lead muestra interés o ya calificó, llevalo al objetivo de la jugada (agendar → ofrecé [tu link de agenda]; pago → [tu link de pago]). Los placeholders [tu link …] se dejan TAL CUAL.
- Objeciones: validá primero, respondé corto, retomá el hilo. Sin presionar ni mendigar ("¿sigues interesado?" está prohibido).
- Si el lead pide algo que no sabés (precio exacto, disponibilidad), no inventes: ofrecé resolverlo en la llamada o decí que lo confirmás.
- Salida digna siempre: si el lead no quiere, cerrás bien la puerta queda abierta.

CONTEXTO: esto es un SIMULADOR — el "lead" es el dueño del negocio probando la jugada antes de prenderla. Respondé exactamente como responderías a un lead real (no rompas el personaje ni menciones que es una prueba). Devolvé SOLO el texto del mensaje de WhatsApp, sin comillas ni preámbulo.`;

export type TurnoSim = { de: 'lead' | 'negocio'; texto: string };

/**
 * ¿Este lead califica según el criterio de la jugada? (reunión 31/07: "si no
 * son calificadas en chat, ya tenemos que cancelar las llamadas"). Clasificación
 * simple → IA barata. Devuelve null si no hay criterio cargado o no alcanza la
 * evidencia: NUNCA descalifica por las dudas.
 */
export async function evaluarCalificacion(secuenciaId: number, historial: TurnoSim[]): Promise<{ califica: boolean | null; razon: string }> {
  const secs = await getSecuenciasConStats();
  const sec = secs.find((s) => s.id === secuenciaId);
  const est = sec ? parseEstrategia(sec.estrategia) : null;
  if (!est || (!est.criterio.califica.length && !est.criterio.descalifica.length)) {
    return { califica: null, razon: 'la jugada todavía no tiene criterio de calificación' };
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

export type SimularResult = { ok: true; respuesta: string } | { ok: false; error: string };

/** Respuesta de MaKo-setter al último mensaje del lead en el simulador. */
export async function responderSimulador(secuenciaId: number, historial: TurnoSim[]): Promise<SimularResult> {
  const secs = await getSecuenciasConStats();
  const sec = secs.find((s) => s.id === secuenciaId);
  if (!sec) return { ok: false, error: 'Esa secuencia no existe en este workspace.' };

  const est = parseEstrategia(sec.estrategia);
  const jugada = [
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
    jugada,
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
  return { ok: true, respuesta: respuesta.trim() };
}
