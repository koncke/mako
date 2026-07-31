// =============================================================================
// setting-simulador — MaKo responde como SETTER en el simulador de /setting
// =============================================================================
// El dueño escribe COMO EL LEAD y MaKo contesta en el rol de setter del negocio,
// usando la JUGADA de la secuencia (objetivo + gancho + preguntas de
// cualificación), la voz destilada, el perfil y el funnel. Es el SANDBOX del
// Setter IA (fase 2): mismo cerebro, cero envíos reales, nada se persiste.

import 'server-only';
import { chatClaude } from './anthropic';
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
    est?.gancho ? `Gancho para ofrecer: ${est.gancho}.` : 'Sin gancho definido — no inventes uno.',
    est?.preguntas.length
      ? `Preguntas de cualificación (en este orden, de a una): ${est.preguntas.map((p, i) => `${i + 1}) ${p}`).join(' ')}`
      : 'Sin preguntas de cualificación definidas.',
  ].join('\n');

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

  const respuesta = await chatClaude(system, turnos, { effort: 'medium', maxTokens: 500, feature: 'setting-simulador' });
  if (!respuesta || !respuesta.trim()) return { ok: false, error: 'MaKo no respondió. Probá de nuevo.' };
  return { ok: true, respuesta: respuesta.trim() };
}
