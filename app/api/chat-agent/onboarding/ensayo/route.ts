// =============================================================================
// API: ensayo del onboarding del Chatbot — MaKo hace de CLIENTE
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
// Y ADEMÁS TERMINA. La conversación era un bucle eterno de objeciones porque
// nada la cerraba: el guion del lead entraba idéntico en cada turno y no existía
// ningún concepto de final. Ahora el turno se cuenta acá, el catálogo trae un
// renglón por turno, y el último turno CIERRA — con marcador del modelo si
// coopera, y por decisión del servidor si no. Un modelo de 20B no puede dejar
// colgada una conversación por olvidarse de una instrucción.
//
// OJO: es el INVERSO de lib/setting-simulador.ts (allá MaKo es el setter y el
// usuario el lead). Acá el mapeo es al revés: negocio=user, lead=assistant.
//
// POST { escenario, historial } → { mensaje, desenlace }      el turno del lead
// POST { action:'guardar', escenario, respuestas, desenlace }  cierra ese caso
// GET                                                          lo que ya se respondió
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
import { escenarioPorId, bloqueEscenario, maxTurnosDe, type Desenlace } from '@/lib/chat-agent-escenarios';
import { getAvatares, avataresTexto } from '@/lib/avatares';
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
- NUNCA repitas algo que ya escribiste en esta conversación, ni con las mismas palabras ni con otras. Si ya planteaste tu punto y te respondieron, eso quedó atrás: avanza.

CÓMO REACCIONAS:
- Haces EXACTAMENTE lo que dice el renglón "EN ESTE MENSAJE" de tu situación. Ese renglón manda sobre todo lo demás: es el turno que te toca del guion, y ya no vuelve.
- NO cambias de tema ni te conviertes en otro lead: eres ESTA persona en ESTA situación hasta que termine la conversación.
- Nunca dices que eres una IA ni rompes el personaje, pase lo que pase.

CÓMO TERMINA: esta conversación NO es infinita. Cuando llegues al final que describe tu situación —o cuando te lo pida el renglón de tu turno— cierras, y agregas al final, en una línea aparte, el marcador exacto [FIN:BIEN] si terminó bien para el negocio o [FIN:MAL] si terminó mal. El marcador va solo, sin explicarlo y sin escribir nada después.

CUANDO NO CONTESTARÍAS: el silencio es una respuesta posible, pero SOLO si tu situación de arriba lo dice explícitamente. Si es el caso y este mensaje concreto no te da un motivo para romperlo, responde EXACTAMENTE esto y nada más, sin adornarlo ni explicarlo:
(sin respuesta)
Si tu situación no menciona que te quedas callado, siempre contestas algo. Y aunque la mencione: cuando el mensaje SÍ cumple la condición que tu situación pide para contestar, contestas — quedarse en silencio ahí sería no seguir tu personaje.

Devuelve SOLO el texto del mensaje del lead, sin comillas, sin tu nombre y sin ninguna aclaración.`;

/**
 * El modelo avisa que el lead no contesta. Se acepta con o sin adornos y con
 * varias redacciones: pide "(sin respuesta)" y devuelve "(no respuesta)" o "no
 * contesta nada" tan seguido como la forma exacta. Lo que no entra acá se pinta
 * como un mensaje del lead, y el dueño lee una burbuja que dice «(no respuesta)».
 */
const SIN_RESPUESTA = /^[([]?\s*(sin (respuesta|contestar)|no (respuesta|contesta|responde|contesto)( nada)?|silencio)\s*[)\]]?\.?$/i;

/**
 * El marcador de cierre. El prompt lo pide en su propia línea, pero se busca en
 * cualquier lado del texto: los modelos chicos lo pegan al final de la última
 * frase tan seguido como lo ponen aparte.
 */
const MARCA_FIN = /\[\s*FIN\s*:\s*(BIEN|MAL)\s*\]/i;

/** Lo que el dueño ya respondió, por escenario. Vive por workspace. */
const KEY_ENSAYO = 'chat_agent.ensayo';

type CasoHecho = { respuestas: string[]; at: string; desenlace?: Desenlace | null };
type EnsayoGuardado = { v: 1; hechos: Record<string, CasoHecho> };

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
  let body: { historial?: unknown; escenario?: unknown; audioBase64?: unknown; audioMime?: unknown; action?: unknown; respuestas?: unknown; desenlace?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  // Cerrar un caso: se guarda lo que el dueño escribió. Es lo que hace que
  // salirse del onboarding no cueste rehacer el ensayo entero.
  if (body.action === 'guardar') {
    const id = String(body.escenario ?? '').trim();
    if (!escenarioPorId(id)) return Response.json({ ok: false, error: 'Escenario desconocido.' }, { status: 400 });
    const respuestas = Array.isArray(body.respuestas)
      ? (body.respuestas as unknown[]).map((r) => String(r ?? '').trim()).filter(Boolean).slice(0, 20)
      : [];
    const d = String(body.desenlace ?? '');
    const desenlace: Desenlace | null = d === 'positivo' || d === 'negativo' || d === 'abierto' ? d : null;
    try {
      const prev = await leerEnsayo();
      prev.hechos[id] = { respuestas, at: new Date().toISOString(), desenlace };
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
    // Si vino un audio, su transcripción ES el último turno del negocio.
    const turnos = historial.slice(-24);
    if (transcripta) turnos.push({ de: 'negocio', texto: transcripta });
    if (!turnos.length) {
      return Response.json({ ok: false, error: 'Escribe tu respuesta para que el lead conteste.' }, { status: 400 });
    }

    // EL TURNO SE CUENTA ACÁ, no en el navegador, y se cuenta por mensajes del
    // NEGOCIO: cada uno provoca exactamente un turno del lead, haya contestado o
    // se haya quedado callado. Contar los del lead no sirve — en el caso de
    // silencio no escribe ninguno y el guion no avanzaría nunca.
    const turno = Math.max(0, turnos.filter((t) => t.de === 'negocio').length - 1);
    const maxTurnos = maxTurnosDe(esc);
    const esUltimoTurno = turno >= maxTurnos - 1;

    const [perfil, funnel, avatares] = await Promise.all([
      perfilNegocioTexto().catch(() => ''),
      resumenFunnel().catch(() => ''),
      getAvatares().catch(() => []),
    ]);
    // El avatar ancla las CIFRAS del lead. Sin él el modelo inventaba una
    // facturación cualquiera —salió un lead de 3.000 USD al mes para un negocio
    // cuyo cliente factura millones al año— y el ensayo dejaba de parecerse a los
    // leads que de verdad le escriben al dueño. Va DENTRO del bloque del
    // escenario y no como slot suelto, porque el encuadre cambia según el caso:
    // en casi todos el lead ES el avatar, y en el de "no califica" es lo contrario.
    const avatar = avataresTexto(avatares.slice(0, 3));

    // SIN MAKO_NUCLEO a propósito: el núcleo describe a MaKo, un asistente de
    // marketing que explica y ayuda. Acá el personaje es un lead desconfiado que
    // escribe en minúsculas — meterle el núcleo lo empuja a sonar servicial y
    // articulado, que es justo lo que hacía que el ensayo sonara a robot.
    const system = await renderPrompt('setting.ensayo', SETTING_ENSAYO_SYSTEM_TEMPLATE, {
      perfil: perfil || '(sin perfil cargado — improvisa un negocio plausible, pero no lo menciones)',
      funnel: funnel || '(sin funnel configurado)',
      escenario: bloqueEscenario(esc, turno, avatar),
    });

    // La conversación va SERIALIZADA en el mensaje de usuario, no como turnos de
    // la API: un ensayo son ~9 escenarios por varios mensajes cada uno, y hacerlo
    // con el modelo caro costaba una fortuna por dueño. Un intercambio corto de
    // rol es justo lo que un modelo barato hace bien.
    //
    // Los SILENCIOS no viajan en el historial: no hay burbuja que mandar. El
    // modelo veía dos mensajes del negocio pegados, se quedaba sin una sola
    // línea propia de la que agarrarse y perdía de qué lado estaba — en el caso
    // de silencio llegó a contestar CON LA VOZ DEL NEGOCIO ("checa este caso de
    // éxito de una firma de 40 personas"). Se reconstruyen acá: dos turnos del
    // negocio seguidos significan que en el medio te quedaste callado.
    const lineas: string[] = [];
    turnos.forEach((t, i) => {
      if (t.de === 'negocio' && i > 0 && turnos[i - 1].de === 'negocio') {
        lineas.push('TÚ (el lead): (no contestaste nada)');
      }
      lineas.push(`${t.de === 'negocio' ? 'NEGOCIO' : 'TÚ (el lead)'}: ${t.texto}`);
    });
    if (!turnos.some((t) => t.de === 'lead')) {
      lineas.unshift('(Todavía no escribiste ni un mensaje: los de abajo te los mandaron a ti.)');
    }
    const transcripcion = lineas.join('\n');

    // La orden de cerrar se repite acá, en el mensaje de USUARIO, y no solo en el
    // system: un modelo de 20B pesa mucho más lo último que lee. Con la
    // instrucción solo arriba cerraba igual (el corte es del servidor) pero se
    // olvidaba del marcador, y el caso quedaba sin veredicto una y otra vez.
    const pedido = esUltimoTurno
      ? [
        'Escribe tu ÚLTIMO mensaje. Eres el LEAD, nunca el negocio. Cierra la conversación.',
        'OBLIGATORIO: la última línea de tu respuesta es exactamente [FIN:BIEN] o exactamente [FIN:MAL]. Sin esa línea la respuesta no sirve.',
        `[FIN:BIEN] = ${esc.desenlace.positivo}.`,
        `[FIN:MAL] = ${esc.desenlace.negativo}.`,
      ].join('\n')
      : 'Escribe tu próximo mensaje. Eres el LEAD que recibió esos mensajes, nunca el negocio: no ofrezcas nada ni intentes vender. Solo el texto, nada más.';

    const bruto = await chatCheapCascade({
      system,
      user: `${transcripcion}\n\n${pedido}`,
      // 200 parecía de sobra para dos renglones de WhatsApp y NO lo era: el
      // modelo por default (gpt-oss-20b) razona antes de responder y ese
      // razonamiento oculto sale del MISMO tope. Cada llamada terminaba por
      // "length" y el mensaje del lead llegaba cortado a mitad de palabra
      // («sí escuché el audio ¿t»). El texto visible sigue siendo corto: lo que
      // sube es el margen para pensar.
      maxTokens: 700, feature: 'setting-ensayo', motivo: 'Ensayo del onboarding: MaKo hace de lead',
      provs: CASCADA_GRATIS,
      // Roleplay, no extracción: con la temperatura de siempre (0.2) el modelo se
      // pegaba a la salida más probable y repetía la misma objeción turno tras
      // turno. Es la otra mitad del bucle que reportó el dueño.
      temperature: 0.85,
    });
    if (!bruto?.trim()) return Response.json({ ok: false, error: 'No salió el mensaje del lead. Vuelve a intentarlo.' }, { status: 400 });

    // El marcador se saca del texto ANTES de mostrarlo: es una señal para la app,
    // no algo que un lead escribiría por WhatsApp.
    const marca = bruto.match(MARCA_FIN);
    // El marcador SOLO vale en el último turno. El modelo lo ponía en el primero
    // —«ok, no me interesa» [FIN:MAL]— y el caso moría antes de que el dueño
    // llegara a hacer nada. El arco se juega entero; el veredicto es del final.
    let desenlace: Desenlace | null = marca && esUltimoTurno
      ? (marca[1].toUpperCase() === 'BIEN' ? 'positivo' : 'negativo')
      : null;
    const mensaje = bruto.replace(MARCA_FIN, '').trim();

    // El silencio no es una burbuja de chat: es la ausencia de una.
    const calla = !mensaje || SIN_RESPUESTA.test(mensaje);

    // EL CORTE ES DEL SERVIDOR, no del modelo. Llegado el último turno el caso se
    // cierra igual: el bucle infinito no puede depender de que un modelo chico se
    // acuerde de poner un marcador. Si no dejó veredicto queda 'abierto' —
    // decirle al dueño "salió mal" sin saberlo sería inventarle un resultado.
    if (!desenlace && esUltimoTurno) desenlace = calla ? 'negativo' : 'abierto';

    return Response.json({
      ok: true,
      mensaje: calla ? null : mensaje,
      sinRespuesta: calla,
      transcripta,
      desenlace,
      turno,
      maxTurnos,
    });
  } catch (e) {
    console.error(`[api:chat-agent/onboarding/ensayo] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
