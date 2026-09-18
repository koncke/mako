// =============================================================================
// Cron: transcribe los videos de los anuncios cargados que aún no tienen texto
// =============================================================================
// Corre a diario después de la ingesta de Meta. Toma los ad_id recientes que no
// están en ad_transcripts y los transcribe (Meta mp4 → OpenAI whisper-1),
// guardando el resultado. Tope por corrida (cantidad + tiempo) para no exceder
// el timeout; lo pendiente se completa en corridas siguientes. El grueso
// histórico se siembra una vez con scripts/backfill-transcripts.mjs.

import type { NextRequest } from 'next/server';
import { getTenantDb } from '@/lib/workspace';
import { transcribeAd, STRUCTURE_SYSTEM_BASE, IMAGE_PROMPT_BASE } from '@/lib/transcribe';
import { getPromptText } from '@/lib/prompt-render';
import { diasAntes, ayerEnTijuana } from '@/lib/date-utils';
import { correrPorWorkspace } from '@/lib/cron-workspaces';
import { credWs } from '@/lib/credenciales';
import { leerTodo, leerPorPaginas, type ConsultaPaginada } from '@/lib/supabase-paginado';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_POR_CORRIDA = 8;
const TIME_BUDGET_MS = 240_000;

function checkAuth(request: NextRequest): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: 'CRON_SECRET no configurado' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  return null;
}

export async function GET(request: NextRequest) {
  const authFail = checkAuth(request);
  if (authFail) return authFail;

  const tStart = Date.now();
  const desde = diasAntes(ayerEnTijuana(), 45);

  const resultados = await correrPorWorkspace('meta', async () => {
    const supabase = await getTenantDb();

    // Anuncios recientes con video potencial. Paginado (orden por `id`, única): es
    // una fila por anuncio POR DÍA, 583 en 45 días en ws1 al 17/09. Pasadas las
    // 1000, los anuncios que caían del corte nunca entraban a pendientes. Es el
    // gemelo de jobTranscripts (lib/onboarding-extract.ts), que ya se arregló.
    const adIdSet = new Set<string>();
    await leerPorPaginas<{ ad_id: string }>(
      supabase, 'marketing_metrics_daily', 'id, ad_id',
      (pag) => { for (const r of pag) adIdSet.add(r.ad_id); },
      { orden: 'id', eq: { plataforma: 'meta' }, filtros: (q) => q.not('ad_id', 'is', null).gte('fecha', desde) as unknown as ConsultaPaginada },
    );
    const adIds = [...adIdSet];

    // Ya resueltos → no reprocesar. 'error' NO cuenta como resuelto: la fila se
    // escribe igual cuando la transcripción falla, y si la excluyéramos también a
    // ella el anuncio quedaría marcado como hecho PARA SIEMPRE con transcript null.
    //
    // No es hipotético: una hidratación de credenciales fallida (ver lib/credenciales.ts
    // — corre best-effort en el cold start) dejaba a transcribeAd sin OPENAI_API_KEY,
    // y así se envenenaron 9 anuncios entre el 2026-07-29 y el 08-03, en ws1 y ws3,
    // sin ninguna señal. Un fallo transitorio no puede ser una condena permanente.
    //
    // 'muy_grande' sí es definitivo (el video excede lo que se puede transcribir):
    // reintentarlo gastaría en cada corrida para volver a fallar igual.
    //
    // ⚠️ Y ESTA LECTURA ES LA QUE EVITA PAGAR DOS VECES: el set de «ya resueltos».
    // Era un `.select()` suelto; con más de 1000 transcripciones (108 en ws1 hoy,
    // crece 1:1 con los anuncios) las que caían del corte volvían a pendientes y se
    // re-transcribían con OpenAI en cada corrida. Paginado por `ad_id`, que es único
    // dentro del workspace (unique workspace_id, ad_id). Un error lanza.
    const doneData = await leerTodo<{ ad_id: string; status: string }>(supabase, 'ad_transcripts', 'ad_id, status', { orden: 'ad_id' });
    const done = new Set(doneData.filter((r) => r.status !== 'error').map((r) => r.ad_id));

    const pendientes = adIds.filter((id) => !done.has(id));

    // Thumbnail por anuncio: fuente de imagen para los anuncios sin video.
    // Solo de los que esta corrida puede procesar (el bucle corta en
    // MAX_POR_CORRIDA): antes se pedían los de TODOS los pendientes, sin fecha —
    // 1.863 filas con miniatura en ws1 — ordenados por `fecha`, que se repite, y
    // el corte de 1000 dejaba sin imagen a los que quedaban afuera. Orden único
    // (fecha, ad_id, id) ASCENDENTE: cada fila pisa a la anterior, así que queda la
    // miniatura más reciente de cada anuncio.
    const thumbs = new Map<string, string>();
    const aProcesar = pendientes.slice(0, MAX_POR_CORRIDA);
    if (aProcesar.length > 0) {
      await leerPorPaginas<{ ad_id: string; ad_thumbnail_url: string }>(
        supabase, 'marketing_metrics_daily', 'id, fecha, ad_id, ad_thumbnail_url',
        (pag) => { for (const r of pag) thumbs.set(r.ad_id, r.ad_thumbnail_url); },
        {
          orden: ['fecha', 'ad_id', 'id'], eq: { plataforma: 'meta' },
          filtros: (q) => q.in('ad_id', aProcesar).not('ad_thumbnail_url', 'is', null) as unknown as ConsultaPaginada,
        },
      );
    }

    // Prompts editables de transcripción (override o default), una sola vez por corrida.
    const [structureSystem, imagePrompt, whisperGlossary] = await Promise.all([
      getPromptText('transcribe.structure.system', STRUCTURE_SYSTEM_BASE),
      getPromptText('transcribe.analyze_image.user', IMAGE_PROMPT_BASE),
      getPromptText('transcribe.whisper.prompt', ''),
    ]);
    const prompts = { structureSystem, imagePrompt, whisperGlossary };

    // Token de Meta del WORKSPACE actual (dueño → env). FAIL-CLOSED: sin token
    // propio se corta este workspace — transcribeAd sin metaToken caería al
    // token global del dueño para los ads de un cliente.
    const metaToken = await credWs('META_ACCESS_TOKEN');
    if (!metaToken) throw new Error('META_ACCESS_TOKEN no configurado para este workspace');

    let ok = 0, sinVideo = 0, grandes = 0, errores = 0, procesados = 0;
    for (const adId of pendientes) {
      if (procesados >= MAX_POR_CORRIDA || Date.now() - tStart > TIME_BUDGET_MS) break;
      procesados++;
      const res = await transcribeAd(adId, { imageUrl: thumbs.get(adId), prompts, metaToken });
      const { error: upErr } = await supabase.from('ad_transcripts').upsert({
        ad_id: res.ad_id, video_id: res.video_id, tipo: res.tipo, status: res.status, transcript: res.transcript,
        secciones: res.secciones, idioma: res.idioma, duracion_s: res.duracion_s, model: res.model, error: res.error, updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,ad_id' });
      if (upErr) { errores++; continue; }
      if (res.status === 'ok') ok++;
      else if (res.status === 'sin_video') sinVideo++;
      else if (res.status === 'muy_grande') grandes++;
      else errores++;
    }

    const ms = Date.now() - tStart;
    console.log(`[cron:transcribe-ads] pendientes=${pendientes.length} procesados=${procesados} ok=${ok} sin_video=${sinVideo} grandes=${grandes} err=${errores} ms=${ms}`);
    return { total_pendientes: pendientes.length, procesados, ok_count: ok, sin_video: sinVideo, muy_grande: grandes, errores, restantes: pendientes.length - procesados, ms };
  });

  return Response.json({ ok: true, workspaces: resultados });
}
