// =============================================================================
// /api/ai-avatar/cubos/alinear — un video del personaje en cubos con un AUDIO que sube la persona (19/11/2026)
// =============================================================================
// POST multipart: file (el audio), frases (JSON: el guion, una frase por escena), formato, personaje (JSON), datos (JSON,
// opcional), segundos (lo que dura el audio, medido en el navegador).
//   → { ok, proyecto } — el audio alineado con su guion (ElevenLabs forced alignment) y el proyecto guardado.
// Es la voz grabada de la persona, y es también cómo se replica EXACTO un video de la galería: su voz con su guion da los
// mismos tiempos (docs/editor-video/ai-avatar-por-codigo.md, «Cómo se prueba»).
//
// Ruta y no server action: una server action topea el cuerpo en 1 MB y un audio lo pasa. ⚠️ 4 MB y no más: Vercel rechaza
// los POST de más de ~4,5 MB antes de llegar acá (lo mismo que /api/onboarding/voz).
// =============================================================================

import { puertaCubos, marcaDelNegocio } from '@/app/ai-avatar/cubos/puerta';
import { runWithWorkspace } from '@/lib/workspace';
import { formatoCubos, normalizarGuion, normalizarDatos, datosAutomaticos } from '@/lib/ai-avatar/cubos-formatos';
import { normalizarPersonaje } from '@/lib/ai-avatar/cubos-personaje';
import { alinearAudio, urlsDeVoces } from '@/lib/ai-avatar/cubos-voz';
import { guardarProyectoCubos, proyectoNuevo } from '@/lib/ai-avatar/cubos-proyectos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_BYTES = 4 * 1024 * 1024;
const TIPOS = /^audio\/(mpeg|mp3|mp4|x-m4a|aac|wav|x-wav|webm|ogg)$/;
const json = (o: unknown, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store' } });
const leerJson = (v: FormDataEntryValue | null): unknown => { try { return typeof v === 'string' ? JSON.parse(v) : null; } catch { return null; } };

export async function POST(req: Request) {
  const g = await puertaCubos(true);
  if (!g.ok) return json(g, 403);
  return runWithWorkspace(g.ws, async () => {
    const fd = await req.formData().catch(() => null);
    const file = fd?.get('file');
    if (!fd || !(file instanceof File)) return json({ ok: false, error: 'Sube un audio.' }, 400);
    if (file.size > MAX_BYTES) return json({ ok: false, error: 'El audio pasa de 4 MB: súbelo en MP3.' }, 413);
    const tipo = (file.type || 'audio/mpeg').split(';')[0];
    if (!TIPOS.test(tipo)) return json({ ok: false, error: 'Sube el audio en MP3, M4A o WAV.' }, 415);
    const f = formatoCubos(fd.get('formato'));
    if (!f) return json({ ok: false, error: 'Elige un formato.' }, 400);
    const gu = normalizarGuion(leerJson(fd.get('frases')));
    if (!gu.ok) return json(gu, 400);
    const marca = await marcaDelNegocio();
    const datosCrudos = leerJson(fd.get('datos'));
    const datos = datosCrudos ? normalizarDatos(f.id, datosCrudos, gu.escenas, marca) : datosAutomaticos(f.id, gu.escenas, marca);
    // lo que dura: lo que dice el navegador, y nunca menos de lo que dan sus bytes a 128 kbps (no se cobra de menos)
    const segundos = Math.max(Number(fd.get('segundos')) || 0, file.size / 16_000);
    const audio = new Uint8Array(await file.arrayBuffer());
    const v = await alinearAudio(g.ws, gu.escenas, audio, tipo, segundos);
    if (!v.ok) return json(v, 422);
    const p = proyectoNuevo({ formato: f.id, escenas: gu.escenas, datos, personaje: normalizarPersonaje(leerJson(fd.get('personaje'))), voz: { tipo: 'audio', nombre: 'Tu audio' }, audio: v.ruta, tiempos: v.tiempos });
    await guardarProyectoCubos(p);
    const urls = await urlsDeVoces([p.audio]).catch(() => ({} as Record<string, string>));
    return json({ ok: true, proyecto: { ...p, url: urls[p.audio] ?? null }, mt: v.mt });
  });
}
