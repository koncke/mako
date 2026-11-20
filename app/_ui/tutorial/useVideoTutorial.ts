'use client';
// El video chico de Martín de una key (una pestaña, un día del reto), del manifiesto de public/tutoriales (lib/tutoriales/videos.ts).
// El manifiesto se pide una vez por visita. Sin video para esa key: null (y nunca otro en su lugar).
import { useEffect, useState } from 'react';
import { RUTA_MANIFIESTO, videoDe, type VideoTutorial } from '@/lib/tutoriales/videos';

// `no-cache` y no `force-cache` (20/11, V10 de la auditoría): con `force-cache` un navegador que ya lo tenía seguía con la lista de
// antes de un deploy y no veía los videos nuevos (`onboarding-bienvenida-whatsapp`, las clases de los funnels). `no-cache`
// revalida con el servidor en cada visita (un 304 si no cambió).
let manifiesto: Promise<unknown> | null = null;
let manifiestoListo = false;
const pedirManifiesto = (): Promise<unknown> => (manifiesto ??= fetch(RUTA_MANIFIESTO, { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : [])).catch(() => []).then((m) => { manifiestoListo = true; return m; }));

/**
 * ¿Ya llegó el manifiesto? (20/11, F1 de la auditoría): mientras carga, `useVideoTutorial` da null igual que «no hay video», y la
 * placa «Todavía no está grabado» se veía un momento aunque el video existiera. Esa placa va sólo con el manifiesto ya leído.
 */
export function useManifiestoListo(): boolean {
  const [listo, setListo] = useState(manifiestoListo);
  useEffect(() => {
    if (listo) return;
    let vivo = true;
    void pedirManifiesto().then(() => { if (vivo) setListo(true); });
    return () => { vivo = false; };
  }, [listo]);
  return listo;
}

export function useVideoTutorial(key: string | null): VideoTutorial | null {
  const [v, setV] = useState<{ key: string; video: VideoTutorial | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    let vivo = true;
    void pedirManifiesto().then((m) => { if (vivo) setV({ key, video: videoDe(m, key) }); });
    return () => { vivo = false; };
  }, [key]);
  return v && v.key === key ? v.video : null;
}

/** El manifiesto entero (la misma lectura, una por visita): para la lista de videos de un chat (./VideosDelChat.tsx). */
export function useManifiesto(): unknown | null {
  const [m, setM] = useState<unknown | null>(null);
  useEffect(() => {
    let vivo = true;
    void pedirManifiesto().then((x) => { if (vivo) setM(x); });
    return () => { vivo = false; };
  }, []);
  return m;
}
