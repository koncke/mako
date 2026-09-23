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
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { transcribirAudio } from '@/lib/ai-cheap';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    const texto = await transcribirAudio(base64, file.type || 'audio/webm', { motivo: 'Dictar una tarea del plan' });
    return Response.json({ ok: true, texto: texto.trim() });
  } catch (e) {
    // El error VIAJA tal cual: la cascada ya dice cuál falló y por qué («ninguna IA
    // pudo: …»), y acá el que lo lee es el dueño del tablero. Inventarle un remedio que
    // no se midió es peor que decirle lo que pasó.
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[plan-dictado]', msg);
    return Response.json({ ok: false, error: `No pude transcribir el audio. ${msg}`.slice(0, 300) }, { status: 200 });
  }
}
