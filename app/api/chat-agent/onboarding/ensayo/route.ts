// =============================================================================
// API: ensayo del onboarding del Chat Agent — MaKo hace de CLIENTE
// =============================================================================
// El usuario no escribe su secuencia: la DESCUBRE respondiendo. MaKo se pone en
// el papel de un lead real y el dueño contesta como contestaría de verdad.
//
// Lo que cambió, y por qué: antes MaKo elegía la situación Y redactaba el primer
// mensaje, y salía siempre una frase que NARRABA el contexto ("vi tu video sobre
// lo del equipo pero no llegué a agendar"). Nadie escribe así por WhatsApp. Ahora
// el escenario viene dado (catálogo en lib/chat-agent-escenarios.ts), el primer
// mensaje es una semilla literal del catálogo, y el modelo solo toma el turno 2
// en adelante SIN cambiar de escenario.
//
// OJO: es el INVERSO de lib/setting-simulador.ts (allá MaKo es el setter y el
// usuario el lead). Acá el mapeo es al revés: negocio=user, lead=assistant.
//
// POST { escenario, historial: [{de:'lead'|'negocio', texto}] } → { mensaje }
// Sandbox: no envía ni persiste nada.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { chatClaude } from '@/lib/anthropic';
import { getPromptText, renderPrompt } from '@/lib/prompt-render';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { resumenFunnel } from '@/lib/mako-context';
import { escenarioPorId, bloqueEscenario } from '@/lib/chat-agent-escenarios';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const SETTING_ENSAYO_SYSTEM_TEMPLATE = `Eres un LEAD REAL de este negocio escribiéndole por WhatsApp. NO eres un asistente: eres la persona que dejó sus datos y ahora está del otro lado del chat.

EL NEGOCIO AL QUE LE ESCRIBES:
{{perfil}}

SU PROCESO COMERCIAL:
{{funnel}}

TU SITUACIÓN AHORA MISMO:
{{escenario}}

CÓMO ESCRIBES — esto es lo que más importa:
- Como escribe la gente de verdad por WhatsApp: corto, en minúsculas, muchas veces sin tildes y sin punto final. Una o dos líneas. A veces una sola palabra.
- NUNCA narres tu propia situación. Un lead real no explica de dónde te conoce ni resume lo que le pasó: escribe "cuanto sale?" y ya. Si te descubres escribiendo una frase que explica el contexto, bórrala y escribe lo que esa persona realmente tipearía.
- Nada de saludos formales, ni de "quedo atento", ni de estructura de correo.
- Un mensaje por turno. Nunca dos preguntas juntas.
- No eres educado por defecto: eres una persona ocupada. Puedes ser seco, desconfiado o cortante si la situación lo pide.

CÓMO REACCIONAS:
- Sigues la evolución descrita en tu situación. Si te convencen, aflojas; si te responden algo genérico o te presionan, te enfrías.
- NO cambias de tema ni te conviertes en otro lead: eres ESTA persona en ESTA situación hasta que termine la conversación.
- Nunca dices que eres una IA ni rompes el personaje, pase lo que pase.

CUANDO NO CONTESTARÍAS: el silencio es una respuesta posible, pero SOLO si tu situación de arriba lo dice explícitamente. Si es el caso y este mensaje concreto no te da un motivo para romperlo, responde EXACTAMENTE esto y nada más, sin adornarlo ni explicarlo:
(sin respuesta)
Si tu situación no menciona que te quedas callado, siempre contestas algo. Y aunque la mencione: cuando el mensaje SÍ cumple la condición que tu situación pide para contestar, contestas — quedarse en silencio ahí sería no seguir tu personaje.

Devuelve SOLO el texto del mensaje del lead, sin comillas, sin tu nombre y sin ninguna aclaración.`;

/** El modelo avisa que el lead no contesta. Se acepta con o sin adornos. */
const SIN_RESPUESTA = /^[([]?\s*(sin respuesta|no contesta|no responde|silencio)\s*[)\]]?\.?$/i;

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede hacer el ensayo.' }, { status: 403 });
  }
  let body: { historial?: unknown; escenario?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  // El escenario llega por ID y se resuelve contra el catálogo: si llegara como
  // texto, cualquiera podría reescribirle el personaje al modelo desde el
  // navegador. Sin id válido no hay ensayo.
  const esc = escenarioPorId(String(body.escenario ?? ''));
  if (!esc) return Response.json({ ok: false, error: 'Escenario desconocido.' }, { status: 400 });

  const historial = Array.isArray(body.historial)
    ? (body.historial as Array<Record<string, unknown>>)
        .filter((t) => (t?.de === 'lead' || t?.de === 'negocio') && typeof t?.texto === 'string' && (t.texto as string).trim())
        .map((t) => ({ de: t.de as 'lead' | 'negocio', texto: String(t.texto).slice(0, 1200) }))
    : [];

  try {
    const [perfil, funnel] = await Promise.all([
      perfilNegocioTexto().catch(() => ''),
      resumenFunnel().catch(() => ''),
    ]);
    // SIN MAKO_NUCLEO a propósito: el núcleo describe a MaKo, un asistente de
    // marketing que explica y ayuda. Acá el personaje es un lead desconfiado que
    // escribe en minúsculas — meterle el núcleo lo empuja a sonar servicial y
    // articulado, que es justo lo que hacía que el ensayo sonara a robot.
    const system = await renderPrompt('setting.ensayo', SETTING_ENSAYO_SYSTEM_TEMPLATE, {
      perfil: perfil || '(sin perfil cargado — improvisa un negocio plausible, pero no lo menciones)',
      funnel: funnel || '(sin funnel configurado)',
      escenario: bloqueEscenario(esc),
    });

    // MAPEO INVERTIDO respecto del simulador: acá el que "habla" es el LEAD, así
    // que sus turnos son del assistant y los del negocio, del user.
    const turnos = historial.slice(-24)
      .map((t) => ({ role: t.de === 'negocio' ? ('user' as const) : ('assistant' as const), content: t.texto }))
      .filter((t) => t.content.trim());
    // La API rechaza un historial que arranca con `assistant`, y el ensayo SIEMPRE
    // arranca con el audio del negocio y la semilla del lead. Sin esto, el primer
    // turno del modelo reventaba y el catch lo tapaba en silencio.
    while (turnos.length && turnos[0].role === 'assistant') turnos.shift();
    if (!turnos.length) {
      return Response.json({ ok: false, error: 'Escribe tu respuesta para que el lead conteste.' }, { status: 400 });
    }

    const mensaje = await chatClaude(system, turnos, { effort: 'medium', maxTokens: 200, feature: 'setting-ensayo' });
    if (!mensaje?.trim()) return Response.json({ ok: false, error: 'No salió el mensaje del lead. Vuelve a intentarlo.' }, { status: 400 });
    // El silencio no es una burbuja de chat: es la ausencia de una. Se devuelve
    // como estado para que la pantalla lo muestre como lo que es.
    if (SIN_RESPUESTA.test(mensaje.trim())) {
      return Response.json({ ok: true, mensaje: null, sinRespuesta: true });
    }
    return Response.json({ ok: true, mensaje: mensaje.trim(), sinRespuesta: false });
  } catch (e) {
    console.error(`[api:chat-agent/onboarding/ensayo] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
