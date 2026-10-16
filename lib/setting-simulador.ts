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
import { parseEstrategia, type EscenarioSecuencia } from './setting-estrategia';
import { insistenciaRebatida } from './conversacion-repeticion';
import {
  bloqueEscenario, bloqueFormulario, pedidoFinal, REGLA_NO_REPREGUNTAR, SEGURIDAD_FORMULARIO,
  type CierreConversacion,
} from './setter-conversacion';

export const SETTING_SIMULADOR_SYSTEM_TEMPLATE = `Eres MaKo actuando como el SETTER del negocio en una conversación de WhatsApp con un lead. Tu trabajo: cualificar y llevar al lead a dar el siguiente paso, como lo haría el mejor setter humano del equipo.

VOZ DEL NEGOCIO (así escribes):
{{voz}}

LA SECUENCIA (tu guion estratégico):
{{secuencia}}

REGLAS DEL SETTER:
- Mensajes CORTOS de WhatsApp: 1 a 4 líneas. Nunca un choclo.
- Cualifica con las preguntas de la secuencia de mensajes DE A UNA, hiladas con naturalidad en la charla — jamás como interrogatorio ni encuesta.
- Si el lead muestra interés o ya calificó, llévalo al objetivo de la secuencia de mensajes (agendar → ofrece [tu link de agenda]; pago → [tu link de pago]). Los placeholders [tu link …] se dejan TAL CUAL.
- Objeciones: valida primero, responde corto, retoma el hilo. Sin presionar ni mendigar ("¿sigues interesado?" está prohibido).
- LA MISMA objeción se rebate DOS veces como mucho. Si el lead insiste una tercera con lo mismo, ya está: no hay nada nuevo que decirle. Cierra con respeto, deja la puerta abierta y no vuelvas a ofrecer nada. Seguir rebatiendo no es insistir bien, es no escuchar.
- No repitas un argumento que ya usaste en esta conversación. Si tu idea es la misma, o la dices distinto o cierras.
- Si el lead pide algo que no sabes (precio exacto, disponibilidad), no inventes: ofrece resolverlo en la llamada o di que lo confirmas.
- Salida digna siempre: si el lead no quiere, cierras bien la puerta queda abierta.

CÓMO TERMINA ESTA CONVERSACIÓN: no es infinita, pero el final lo marca EL LEAD, no tú. El marcador va en una línea aparte al final, sin nada después, y solo en estos dos casos:

[FIN:BIEN] — SOLO si el ÚLTIMO mensaje del lead ACEPTA de verdad: dice que sí, elige un horario, confirma que va, o pide el link. Que tú hayas hecho una buena propuesta NO alcanza; proponer y marcar BIEN en el mismo mensaje está prohibido. Si todavía no contestó a tu propuesta, no hay marcador.

[FIN:MAL] — si el lead dice que no le interesa, pide que no le escriban más, o vuelve por TERCERA vez con la misma objeción que ya le respondiste dos veces. Ahí no hay nada nuevo que decirle: cierra con respeto, deja la puerta abierta y no ofrezcas nada más.

En cualquier otro caso NO escribas ningún marcador y sigue la conversación.

CONTEXTO: esto es un SIMULADOR — el "lead" es el dueño del negocio probando la secuencia de mensajes antes de prenderla. Responde exactamente como responderías a un lead real (no rompas el personaje ni menciones que es una prueba). Devuelve SOLO el texto del mensaje de WhatsApp, sin comillas ni preámbulo.`;

export type TurnoSim = { de: 'lead' | 'negocio'; texto: string };

/**
 * Lo que el lead contestó en el formulario de la agenda, como bloque para el prompt (#361).
 * Vacío si no hay lead, no contestó nada o la lectura falla: sin el bloque el setter
 * escribe igual, nunca deja de escribir por esto.
 */
async function formularioDelLead(leadId: number | null | undefined): Promise<string> {
  if (!leadId) return '';
  try {
    // Import dinámico: leads.ts es grande y este módulo lo carga el webhook de cada mensaje.
    const { getLead, getLeadRespuestas } = await import('./leads');
    const lead = await getLead(leadId);   // getTenantDb: un id de otro negocio devuelve null
    if (!lead) return '';
    return bloqueFormulario(await getLeadRespuestas(lead));
  } catch {
    return '';
  }
}

/**
 * ¿Este lead califica según el criterio de la secuencia de mensajes? (reunión 31/07: "si no
 * son calificadas en chat, ya tenemos que cancelar las llamadas"). Clasificación
 * simple → IA barata. Devuelve null si no hay criterio cargado o no alcanza la
 * evidencia: NUNCA descalifica por las dudas.
 *
 * `opts.leadId` suma lo que contestó en el formulario como evidencia DICHA por el lead
 * (#361): «factura menos de lo que pide el programa» está ahí, no en la charla.
 */
export async function evaluarCalificacion(secuenciaId: number, historial: TurnoSim[], opts?: { leadId?: number | null } & EnVivo): Promise<{ califica: boolean | null; razon: string }> {
  const secs = await getSecuenciasConStats();
  const sec = secs.find((s) => s.id === secuenciaId);
  const est = sec ? parseEstrategia(sec.estrategia) : null;
  if (!est || (!est.criterio.califica.length && !est.criterio.descalifica.length)) {
    return { califica: null, razon: 'la secuencia de mensajes todavía no tiene criterio de calificación' };
  }
  const formulario = await formularioDelLead(opts?.leadId);
  const charla = historial.slice(-14).map((t) => `${t.de === 'lead' ? 'LEAD' : 'NEGOCIO'}: ${t.texto}`).join('\n');
  // Cascada, no `chatCheap`: con un solo proveedor, un 429 tiraba el error para
  // arriba y la calificación no se hacía teniendo otras cuatro IA gratis cargadas.
  const { chatCheapCascade } = await import('./ai-cheap');
  const raw = await chatCheapCascade({
    system: `Clasificas si un lead califica según un criterio. Devuelves EXCLUSIVAMENTE un objeto JSON {"califica":"si"|"no"|"no_se","razon":"..."} sin markdown. Ante la duda, "no_se".${formulario ? `\n\n${SEGURIDAD_FORMULARIO}` : ''}`,
    user: `CRITERIO DEL NEGOCIO
Califica si: ${est.criterio.califica.join(' · ') || '(sin reglas)'}
NO califica si: ${est.criterio.descalifica.join(' · ') || '(sin reglas)'}

CONVERSACIÓN
${charla}
${formulario ? `\n${formulario}\n` : ''}
¿El lead califica? Responde "no" SOLO si hay evidencia explícita de una regla de descalificación en lo que DIJO el lead (en la charla o en el formulario). Si no hay evidencia suficiente, "no_se".`,
    // En vivo, con la red de plataforma (16/10/2026, `EnVivo`): corre con cada respuesta del AI Step, y sin ella un
    // negocio sin key propia no calificaba nunca. Nunca descalifica por las dudas, con la key que sea.
    json: true, feature: 'setting-calificar', maxTokens: 300, ...enVivo(opts),
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
  ninguno: 'esta secuencia no cierra sola: sigue hasta que el lead se vaya',
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
  /** `cierre` dice POR QUÉ terminó cuando hay desenlace: lo guarda el modo asistido (#360). */
  | { ok: true; respuesta: string; desenlace: DesenlaceSim | null; cierre: CierreConversacion | null }
  | { ok: false; error: string };

export type OpcionesSetter = {
  /**
   * El lead de verdad (modo asistido). Con él entra lo que contestó en el
   * formulario de la agenda (#361). El simulador no lo pasa: ahí el «lead» es el dueño.
   */
  leadId?: number | null;
  /** El caso en el que encajó el mensaje: su `comoResponder` guía el borrador (#358). */
  escenario?: EscenarioSecuencia | null;
  /**
   * Qué estaba haciendo MaKo, para el mensaje de error (#380). El default es el del
   * simulador; en producción es un lead real y decir «el ensayo» ahí era mentirle al dueño.
   */
  tema?: string;
} & EnVivo;

/**
 * LA RED DE PLATAFORMA Y EL PLAZO, COMO OPCIÓN DEL QUE LLAMA (16/10/2026, docs/mapa-ia-24h.md, decisión A de Martín:
 * «lo que responde en vivo, con API»). Nunca fija en la función: la comparten caminos con reglas distintas.
 *   · `redDePlataforma`: si las keys del negocio no pueden (o no tiene), las gratis de la agencia, otro proveedor
 *     primero, con el motivo «⚠ red de plataforma». La piden el MOTOR (`asistirRespuesta`: sin ella, un negocio sin key
 *     propia dejaba al lead sin respuesta) y el PROBAR (el simulador y el ensayo: AGENTS.md, «todo camino de IA que use
 *     un cliente necesita su red»). NO la piden las lecturas de la API (`simular_respuesta_setter`,
 *     `evaluar_calificacion_charla`): un agente externo las puede llamar en bucle, y gastaría la cuota gratis de la
 *     agencia de la que viven las respuestas en vivo de todos.
 *   · `hastaMs`: el plazo del pedido. El motor corre adentro del webhook (`maxDuration` 420 s): sin plazo, una red que
 *     no contesta lo mataba a la mitad, sin borrador ni aviso.
 *   · ⛔ `pii`: el pedido lleva lo que escribió o dijo un LEAD REAL (el motor). Entonces la red va SÓLO por lo que no
 *     entrena —el crédito de Claude de la plataforma—, y si no contesta, se corta: nunca las keys gratis (el plan gratis
 *     de Gemini entrena con lo que recibe; AGENTS.md, 16/10/2026). El Probar no lo pasa: ahí el «lead» es el dueño.
 */
export type EnVivo = { redDePlataforma?: boolean; hastaMs?: number; pii?: boolean };

/** Lo que el que llama pidió de `EnVivo`, como lo toma `chatCheapCascade`. */
const enVivo = (o: EnVivo | undefined): EnVivo => ({
  ...(o?.redDePlataforma ? { redDePlataforma: true } : {}),
  ...(o?.hastaMs ? { hastaMs: o.hastaMs } : {}),
  ...(o?.pii ? { pii: true } : {}),
});

/** Respuesta de MaKo-setter al último mensaje del lead (el simulador y el modo asistido). */
export async function responderSimulador(secuenciaId: number, historial: TurnoSim[], opts: OpcionesSetter = {}): Promise<SimularResult> {
  const tema = opts.tema ?? 'contestar en el ensayo';
  const secs = await getSecuenciasConStats();
  const sec = secs.find((s) => s.id === secuenciaId);
  if (!sec) return { ok: false, error: 'Esa secuencia no existe en este workspace.' };

  const est = parseEstrategia(sec.estrategia);
  const secuencia = [
    `Secuencia: ${sec.nombre} (etapa del lead: ${sec.etapa}).`,
    est ? `Objetivo: ${est.objetivo}.` : 'Objetivo: mover al lead a la siguiente etapa.',
    est?.objetivo === 'preparar'
      ? 'PREPARAR es el objetivo más importante: que el lead LLEGUE a la reunión y llegue listo. Confirma que la tenga anotada y asegurate de que vea el video de preparación — sin el video no hay llamada.'
      : '',
    est?.gancho ? `Gancho para ofrecer: ${est.gancho}.` : 'Sin gancho definido — no inventes uno.',
    est?.preguntas.length
      ? `Preguntas de cualificación (en este orden, de a una): ${est.preguntas.map((p, i) => `${i + 1}) ${p}`).join(' ')}\n${REGLA_NO_REPREGUNTAR}`
      : 'Sin preguntas de cualificación definidas.',
    // Criterio: lo que decide si esta charla termina en llamada o en despedida.
    est?.criterio.califica.length ? `CALIFICA si: ${est.criterio.califica.join(' · ')}` : '',
    est?.criterio.descalifica.length
      ? `NO CALIFICA si: ${est.criterio.descalifica.join(' · ')}. Ante una señal de estas, NO empujes la llamada: cierra con respeto explicando que no es para él y que prefieres no hacerle perder el tiempo.`
      : '',
    // El DESENLACE es lo que le dice al setter cuándo parar. Sin esto la
    // conversación no tiene final y MaKo rebate objeciones para siempre.
    est ? `SE CUMPLIÓ el objetivo cuando: ${LOGRADO_TEXTO[est.desenlace.logrado]}.` : '',
    est ? 'NO se va a cumplir cuando: el lead dice que no le interesa, pide que no le escriban más, o repite la misma objeción después de que ya se la respondiste dos veces.' : '',
  ].filter(Boolean).join('\n');

  const [persona, voz, perfil, funnel, formulario] = await Promise.all([
    getActivePersona().catch(() => ''),
    getVozGuia().catch(() => null),
    perfilNegocioTexto().catch(() => ''),
    resumenFunnel().catch(() => ''),
    formularioDelLead(opts.leadId),
  ]);
  const nucleo = await getPromptText('mako.nucleo', MAKO_NUCLEO);
  const systemBase = await renderPrompt('setting.simulador', SETTING_SIMULADOR_SYSTEM_TEMPLATE, {
    voz: voz || '(sin guía de voz destilada: escribe cercano y profesional, sin sonar a bot)',
    secuencia,
  });
  let system = `${persona}\n\n${nucleo}\n\n${systemBase}`.trim();
  if (perfil) system += `\n\nPERFIL DEL NEGOCIO:\n${perfil}`;
  if (funnel) system += `\n\nFUNNEL DEL NEGOCIO:\n${funnel}`;
  // Los tres bloques del lead van DESPUÉS del render y no como slots del template
  // registrado: un override guardado de 'setting.simulador' no tiene esos slots, y los
  // perdería en silencio. Mismo criterio que el perfil y el funnel de arriba. (La regla de
  // no repreguntar va pegada a la línea de las preguntas, arriba, por la misma razón.)
  if (formulario) system += `\n\n${formulario}\n\n${SEGURIDAD_FORMULARIO}`;
  const caso = bloqueEscenario(opts.escenario);
  if (caso) system += `\n\n${caso}`;

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

  // EL CORTE POR INSISTENCIA LO DECIDE EL SERVIDOR, no el modelo. Se le pidió en
  // el prompt que cerrara a la tercera repetición de la misma objeción y siguió
  // rebatiendo las cuatro: un modelo no lleva la cuenta de nada. Acá se cuenta.
  //
  // ⚠️ Y SE CUENTA ANTES DE LLAMAR AL MODELO (#360). Se contaba después: el desenlace
  // salía 'negativo' y el texto que volvía era igual la cuarta rebatida, también en el
  // simulador. Con la cuenta adelante, lo que se le pide ES la despedida.
  //
  // ⚠️ Y SE CUENTA POR RONDAS (`insistenciaRebatida`): tres mensajes seguidos del lead que
  // nadie contestó no son «la tercera vez»; tienen que haber dos respuestas en el medio.
  const porInsistir = insistenciaRebatida(historial);

  const { chatCheapCascade, CASCADA_GRATIS, errorDeCascada } = await import('./ai-cheap');
  const errores: string[] = [];
  // ⚠️ EN VIVO, CON LA RED DE PLATAFORMA (16/10/2026, `EnVivo`): la respuesta del AI Step a un lead REAL. Sin la red, un
  // negocio sin key propia (o con su única key caída) dejaba al lead sin respuesta y el aviso decía «No pude dejarte un
  // borrador». Los errores de la red van aparte: no eligen el texto que lee el cliente (`errorDeCascada` mira los suyos).
  const erroresRed: string[] = [];
  const respuesta = await chatCheapCascade({
    system,
    user: `${transcripcion}\n\n${pedidoFinal(porInsistir)}`,
    maxTokens: 500, feature: 'setting-simulador', motivo: 'Respuesta del setter',
    provs: CASCADA_GRATIS, erroresOut: errores, erroresPlataformaOut: erroresRed, ...enVivo(opts),
  });
  // «MaKo no respondió. Vuelve a intentarlo.» era verdad y no servía para nada: si lo
  // que pasó es que se acabó la cuota, reintentar no arregla nada y el usuario lo
  // descubre reintentando diez veces.
  // Sin red POR LLEVAR DATOS DEL LEAD (16/10/2026): el remedio no es otra key gratis, es su Claude (`CONECTA_TU_CLAUDE`).
  if (!respuesta || !respuesta.trim()) {
    const { sinRedPorDatos, CONECTA_TU_CLAUDE } = await import('./fallo-ia-texto');
    return { ok: false, error: sinRedPorDatos(erroresRed) ? CONECTA_TU_CLAUDE : await errorDeCascada(errores, tema) };
  }
  const marca = respuesta.match(MARCA_FIN);
  const limpio = respuesta.replace(MARCA_FIN, '').trim();
  // El modelo contestó SÓLO el marcador de cierre: entendió que la charla terminó y no
  // escribió el mensaje. Es otro caso que «no respondió» y reintentar no lo cambia (#380).
  if (!limpio) return { ok: false, error: 'MaKo dio la charla por terminada sin escribir el mensaje.' };

  const desenlace: DesenlaceSim | null = marca
    ? (marca[1].toUpperCase() === 'BIEN' ? 'positivo' : 'negativo')
    : (porInsistir ? 'negativo' : null);
  const cierre: CierreConversacion | null = marca
    ? (desenlace === 'positivo' ? 'fin_bien' : 'fin_mal')
    : (porInsistir ? 'insistencia' : null);
  return { ok: true, respuesta: limpio, desenlace, cierre };
}
