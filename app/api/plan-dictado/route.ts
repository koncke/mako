// =============================================================================
// /api/plan-dictado — dictar una tarea en vez de escribirla
// =============================================================================
// «Crear una tarea tiene que tener menos fricción… poder escribirse directo o mandar un
// audio» (22/09/2026). Esto recibe el audio del grabador del navegador y devuelve el texto.
// No crea nada: el alta la hace el formulario, con la persona mirando lo que se transcribió.
//
// Usa `transcribirAudio` (lib/ai-cheap), que es la MISMA cascada gratis que el resto de la
// app (Gemini → Groq → OpenAI) y ya aplica la gramática de la marca al texto que devuelve.
// Nada de `whisper-1` pago: acá se dicta una línea, no se transcribe una clase.
//
// ⛔ UNA NOTA DE VOZ ES UN DATO DE UN CLIENTE (revisión del Cerebro, 21/10/2026): la usa también el chat de MaKo del
// teléfono («¿qué le pasó a María González con el pago?»), así que va con `pii` —la red gratis de la plataforma no la
// escucha, como en WhatsApp (lib/mako-doer-in.ts)— y, en un negocio con su Claude o su GPT (D6b, lib/ia-del-negocio.ts),
// sólo con SU OpenAI: sin ella, se dice por qué, en vez de mandarla a Gemini.
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { provsDe, transcribirAudio } from '@/lib/ai-cheap';
import { getWorkspaceActual } from '@/lib/workspace';
import { negocioConSuIA } from '@/lib/ia-del-negocio';
import { PROVS_SU_IA, conSoloSuIA } from '@/lib/solo-su-ia';
import { errorDeDictado } from '@/lib/dictado-error';

/** Con su propio Claude y sin su OpenAI no hay con qué escuchar la nota sin la cascada gratis. */
const SIN_OIDO_SU_IA = 'Con tu propio Claude, las notas de voz las escucho con tu clave de OpenAI o de Gemini, y no tienes ninguna conectada. Escríbemelo.';


export const dynamic = 'force-dynamic';
// 300 y no 60 (27/10/2026): una nota de voz de varios minutos tarda más de 60 s en transcribirse y Vercel la cortaba con un 504
// de texto, que el chat leía como «unexpected JSON» (app/_components/useDictar.ts → porQueNoSeTranscribio).
export const maxDuration = 300;

export async function POST(req: Request) {
  // Cualquiera con sesión, no sólo el admin: el mismo botón de dictar vive en el alta del
  // tablero del CLIENTE, que monta el mismo componente. Un control que se dibuja y contesta
  // 403 se lee como que la app está rota. El gasto va contra las keys de ESE workspace
  // (lib/ai-cheap resuelve por inquilino), y sin sesión sigue siendo 401 — mismo gate que
  // /api/mako-guardian.
  if (!(await getUsuarioActual())) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get('audio');
    if (!(file instanceof File)) return Response.json({ ok: false, error: 'falta el audio' }, { status: 400 });
    // El grabador del navegador manda webm/opus (Chrome) o mp4 (Safari). Un tope chico a
    // propósito: esto es una nota de voz de segundos, no un archivo.
    if (file.size > 12 * 1024 * 1024) return Response.json({ ok: false, error: 'El audio es muy largo. Graba menos de un minuto.' }, { status: 400 });
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const ws = await getWorkspaceActual().catch(() => null);
    // Sin saber de qué negocio es, como si tuviera su IA (falla cerrada).
    const negocio = ws == null ? { suIA: true } : await negocioConSuIA(ws);
    const texto = await conSoloSuIA(negocio.suIA, async () => {
      // IA16: su OpenAI o su Gemini (`PROVS_SU_IA`); con sólo su Claude, no hay con qué escuchar.
      if (negocio.suIA && !(await Promise.all(PROVS_SU_IA.map((p) => provsDe(p as never)))).some((l) => l.length)) return null;
      // La nota de voz de una caja de chat (24/10/2026, app/_chat/nota-que-se-manda.ts) se anota con su motivo.
      const motivo = form.get('para') === 'chat' ? 'Nota de voz de un chat' : 'Dictar una tarea del plan';
      // Alguien está mirando «Enviando…»: Groq primero, Gemini de respaldo (`notaDeVozCorta`; de 11 a ~105 s medido con Gemini primero).
      return transcribirAudio(base64, file.type || 'audio/webm', { motivo, pii: true, notaDeVozCorta: true });
    });
    if (texto == null) return Response.json({ ok: false, error: SIN_OIDO_SU_IA }, { status: 200 });
    return Response.json({ ok: true, texto: texto.trim() });
  } catch (e) {
    // El detalle de la cascada va al log; la persona lee qué pasó y qué hacer (`errorDeDictado`).
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[plan-dictado]', msg);
    return Response.json({ ok: false, error: errorDeDictado(msg) }, { status: 200 });
  }
}
