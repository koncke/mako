'use client';
// El video chico de Martín de una key (una pestaña, un día del reto), del manifiesto de public/tutoriales (lib/tutoriales/videos.ts).
// El manifiesto se pide una vez por visita. Sin video para esa key: null (y nunca otro en su lugar).
import { useEffect, useState } from 'react';
import { RUTA_MANIFIESTO, videoDe, type VideoTutorial } from '@/lib/tutoriales/videos';

let manifiesto: Promise<unknown> | null = null;
export function useVideoTutorial(key: string | null): VideoTutorial | null {
  const [v, setV] = useState<{ key: string; video: VideoTutorial | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    let vivo = true;
    manifiesto ??= fetch(RUTA_MANIFIESTO, { cache: 'force-cache' }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    void manifiesto.then((m) => { if (vivo) setV({ key, video: videoDe(m, key) }); });
    return () => { vivo = false; };
  }, [key]);
  return v && v.key === key ? v.video : null;
}
