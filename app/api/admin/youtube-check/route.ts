// =============================================================================
// Admin endpoint: youtube-check
// =============================================================================
// Hace fetch a YouTube Data API para los videos configurados SIN escribir
// nada en la DB. Útil para validar API Key y Video IDs antes del cron.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import {
  fetchYouTubeStats,
  YouTubeAuthError,
  YouTubeNotFoundError,
  YouTubeApiError,
} from '@/lib/youtube';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // El mismo chequeo que los crons: comparación en tiempo constante y fail-closed sin CRON_SECRET.
  const denied = checkCronAuth(request);
  if (denied) return denied;

  const videos: Array<{ id: string | undefined; type: 'vsl' | 'thanks' | 'thanks_prep' }> = [
    { id: process.env.YOUTUBE_VSL_VIDEO_ID, type: 'vsl' },
    { id: process.env.YOUTUBE_THANKS_VIDEO_ID, type: 'thanks' },
    { id: process.env.YOUTUBE_THANKS_PREP_VIDEO_ID, type: 'thanks_prep' },
  ];

  const results = await Promise.all(
    videos.map(async (v) => {
      if (!v.id || v.id.startsWith('PENDING')) {
        return { videoType: v.type, videoId: v.id ?? 'unset', status: 'skipped' as const };
      }
      try {
        const stats = await fetchYouTubeStats(v.id);
        return {
          videoType: v.type,
          videoId: v.id,
          status: 'ok' as const,
          title: stats.title,
          publishedAt: stats.publishedAt,
          viewCount: stats.viewCount,
          likeCount: stats.likeCount,
          commentCount: stats.commentCount,
        };
      } catch (err) {
        let errorCode = 'unknown';
        if (err instanceof YouTubeAuthError) errorCode = 'auth';
        else if (err instanceof YouTubeNotFoundError) errorCode = 'not_found';
        else if (err instanceof YouTubeApiError) errorCode = 'youtube_api';
        return {
          videoType: v.type,
          videoId: v.id,
          status: 'error' as const,
          error: errorCode,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return Response.json({ ok: true, videos: results });
}
