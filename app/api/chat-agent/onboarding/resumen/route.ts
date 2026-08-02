// =============================================================================
// API: el paso final del onboarding — arma las secuencias y las resume
// =============================================================================
// Hasta acá el dueño grabó 3 audios y ensayó 9 escenarios. Este paso convierte
// eso en las secuencias que de verdad los envían, y le muestra QUÉ quedó armado.
// Antes el paso era texto fijo prometiendo unas secuencias que nadie creaba.
//
// GET → { secuencias: [...], huecos: [...] }  (armar + resumir, idempotente)
// Guard: admin del workspace.
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getSetting } from '@/lib/settings';
import { armarSecuenciasDeAudios } from '@/lib/secuencias-audios';
import { huecosDeSecuencias } from '@/lib/secuencias-huecos';
import { getSecuenciasConStats } from '@/lib/nutricion';
import { listAudios } from '@/lib/setting-audios';
import { KEY_LINK_VIDEO, AUDIOS_PASO } from '@/lib/audios-paso';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const fmtDelay = (h: number) => (h <= 1 ? 'apenas entra' : h < 24 ? `a las ${h} h` : `a los ${Math.round(h / 24)} días`);

export async function GET() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el administrador del workspace puede ver esto.' }, { status: 403 });
  }

  try {
    const linkVideo = await getSetting(KEY_LINK_VIDEO).catch(() => null);
    // Idempotente: si el dueño vuelve al paso después de re-grabar un audio, la
    // secuencia se actualiza con la versión nueva en vez de duplicarse.
    await armarSecuenciasDeAudios(linkVideo);

    const [secs, audios, huecos] = await Promise.all([
      getSecuenciasConStats(),
      listAudios().catch(() => []),
      huecosDeSecuencias().catch(() => []),
    ]);
    const porId = new Map(audios.map((a) => [a.id, a]));
    const tituloDe = (clave: string) => AUDIOS_PASO.find((a) => a.clave === clave)?.titulo ?? clave;

    // Solo las que salen de los audios: el resumen del paso habla de lo que el
    // dueño acaba de armar, no de todo lo que pueda existir en el workspace.
    const nuestras = secs.filter((s) => s.clave.startsWith('chat-agent-'));

    const secuencias = nuestras.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      activa: s.activa,
      pasos: s.pasos.map((p) => {
        const audio = p.audio_id ? porId.get(p.audio_id) : null;
        return {
          orden: p.orden,
          cuando: fmtDelay(p.delay_horas),
          // Qué se manda, en una línea que se entienda sin saber del motor.
          que: audio ? `Tu nota de voz «${audio.titulo}»` : (p.cuerpo || 'Mensaje de texto'),
          transcript: audio?.transcript ?? null,
          // La condición, dicha en castellano y no con la clave interna.
          condicion: p.requiere === 'ya_contactado' ? 'Solo si ya le habías escrito antes'
            : p.requiere === 'primer_contacto' ? 'Solo si es la primera vez que le escribes'
              : p.requiere === 'respondio' ? 'Solo si el lead respondió'
                : p.requiere === 'sin_respuesta' ? 'Solo si el lead no respondió'
                  : null,
          pie: audio && p.cuerpo?.trim() ? p.cuerpo.trim() : null,
        };
      }),
    }));

    // Qué audios grabó y cuáles no: si falta uno, su secuencia no existe y hay
    // que decirlo acá, no dejar que lo descubra cuando no salga nada.
    const sinGrabar = AUDIOS_PASO
      .filter((d) => !nuestras.some((s) => s.pasos.some((p) => porId.get(p.audio_id ?? 0)?.titulo === d.titulo)))
      .map((d) => tituloDe(d.clave));

    return Response.json({ ok: true, secuencias, huecos, sinGrabar });
  } catch (e) {
    console.error(`[api:chat-agent/onboarding/resumen] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
