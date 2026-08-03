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
// POST { escenario, historial } → { mensaje }        el turno del lead
// POST { action:'guardar', escenario, respuestas }    cierra ese caso y lo guarda
// GET                                                 lo que ya se respondió
//
// No manda NADA a ningún lead: es un sandbox de conversación. Pero lo que el
// dueño escribe SÍ se guarda — es la materia prima de sus secuencias, y perderlo
// porque cerró la pestaña es hacerle repetir el trabajo más caro del onboarding.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { chatCheapCascade, CASCADA_GRATIS } from '@/lib/ai-cheap';
import { renderPrompt } from '@/lib/prompt-render';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { resumenFunnel } from '@/lib/mako-context';
import { escenarioPorId, bloqueEscenario } from '@/lib/chat-agent-escenarios';
import { getSetting, setSetting } from '@/lib/settings';

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

/** Lo que el dueño ya respondió, por escenario. Vive por workspace. */
const KEY_ENSAYO = 'chat_agent.ensayo';

type EnsayoGuardado = { v: 1; hechos: Record<string, { respuestas: string[]; at: string }> };

async function leerEnsayo(): Promise<EnsayoGuardado> {
  const raw = await getSetting(KEY_ENSAYO);
  if (!raw) return { v: 1, hechos: {} };
  try {
    const p = JSON.parse(raw) as EnsayoGuardado;
    return p && typeof p.hechos === 'object' ? { v: 1, hechos: p.hechos } : { v: 1, hechos: {} };
  } catch { return { v: 1, hechos: {} }; }
}

export async function GET() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') return Response.json({ ok: true, hechos: {} });
  try {
    return Response.json({ ok: true, hechos: (await leerEnsayo()).hechos });
  } catch { return Response.json({ ok: true, hechos: {} }); }
}

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede hacer el ensayo.' }, { status: 403 });
  }
  let body: { historial?: unknown; escenario?: unknown; audioBase64?: unknown; audioMime?: unknown; action?: unknown; respuestas?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  // Cerrar un caso: se guarda lo que el dueño escribió. Es lo que hace que
  // salirse del onboarding no cueste rehacer el ensayo entero.
  if (body.action === 'guardar') {
    const id = String(body.escenario ?? '').trim();
    if (!escenarioPorId(id)) return Response.json({ ok: false, error: 'Escenario desconocido.' }, { status: 400 });
    const respuestas = Array.isArray(body.respuestas)
      ? (body.respuestas as unknown[]).map((r) => String(r ?? '').trim()).filter(Boolean).slice(0, 20)
      : [];
    try {
      const prev = await leerEnsayo();
      prev.hechos[id] = { respuestas, at: new Date().toISOString() };
      await setSetting(KEY_ENSAYO, JSON.stringify(prev));
      return Response.json({ ok: true, hechos: prev.hechos });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  }

  // El dueño puede contestar con una NOTA DE VOZ, que es como de verdad va a
  // responderle a un lead. El modelo no oye: se transcribe y se le pasa el texto,
  // y de paso la transcripción vuelve para pintarla bajo la burbuja.
  let transcripta: string | null = null;
  if (typeof body.audioBase64 === 'string' && body.audioBase64) {
    try {
      const { transcribirAudio } = await import('@/lib/ai-cheap');
      transcripta = (await transcribirAudio(body.audioBase64, typeof body.audioMime === 'string' ? body.audioMime : 'audio/mpeg')).trim() || null;
    } catch { transcripta = null; }
    if (!transcripta) {
      return Response.json({ ok: false, error: 'No se entendió el audio. Vuelve a grabarlo o escríbelo.' }, { status: 400 });
    }
  }

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

    // Si vino un audio, su transcripción ES el último turno del negocio.
    const turnos = historial.slice(-24).filter((t) => t.texto.trim());
    if (transcripta) turnos.push({ de: 'negocio', texto: transcripta });
    if (!turnos.length) {
      return Response.json({ ok: false, error: 'Escribe tu respuesta para que el lead conteste.' }, { status: 400 });
    }

    // La conversación va SERIALIZADA en el mensaje de usuario, no como turnos de
    // la API: un ensayo son ~9 escenarios por varios mensajes cada uno, y hacerlo
    // con el modelo caro costaba una fortuna por dueño. Un intercambio corto de
    // rol es justo lo que un modelo barato hace bien.
    const transcripcion = turnos
      .map((t) => `${t.de === 'negocio' ? 'NEGOCIO' : 'TÚ (el lead)'}: ${t.texto}`)
      .join('\n');

    const mensaje = await chatCheapCascade({
      system,
      user: `${transcripcion}\n\nEscribe tu próximo mensaje como el lead. Solo el texto, nada más.`,
      maxTokens: 200, feature: 'setting-ensayo', motivo: 'Ensayo del onboarding: MaKo hace de lead',
      provs: CASCADA_GRATIS,
    });
    if (!mensaje?.trim()) return Response.json({ ok: false, error: 'No salió el mensaje del lead. Vuelve a intentarlo.' }, { status: 400 });
    // El silencio no es una burbuja de chat: es la ausencia de una. Se devuelve
    // como estado para que la pantalla lo muestre como lo que es.
    if (SIN_RESPUESTA.test(mensaje.trim())) {
      return Response.json({ ok: true, mensaje: null, sinRespuesta: true, transcripta });
    }
    return Response.json({ ok: true, mensaje: mensaje.trim(), sinRespuesta: false, transcripta });
  } catch (e) {
    console.error(`[api:chat-agent/onboarding/ensayo] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
