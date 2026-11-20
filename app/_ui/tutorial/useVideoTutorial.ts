'use client';
// El video chico de Martín de una key (una pestaña, un día del reto), del manifiesto de public/tutoriales (lib/tutoriales/videos.ts).
// El manifiesto se pide una vez por visita. Sin video para esa key: null (y nunca otro en su lugar).
import { useMemo, useSyncExternalStore } from 'react';
import { RUTA_MANIFIESTO, videoDe, type VideoTutorial } from '@/lib/tutoriales/videos';

// `no-cache` y no `force-cache` (20/11, V10 de la auditoría): con `force-cache` un navegador que ya lo tenía seguía con la lista de
// antes de un deploy y no veía los videos nuevos (`onboarding-bienvenida-whatsapp`, las clases de los funnels). `no-cache`
// revalida con el servidor en cada visita (un 304 si no cambió).
let manifiesto: Promise<unknown> | null = null;
let manifiestoListo = false;
/** Lo leído (o `[]` si falló): con esto, una vez leído, el video sale en el MISMO dibujo, sin un cuadro con null. */
let leido: unknown = null;
const oyentes = new Set<() => void>();
const pedirManifiesto = (): Promise<unknown> => (manifiesto ??= fetch(RUTA_MANIFIESTO, { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : [])).catch(() => []).then((m) => {
    manifiestoListo = true;
    leido = m;
    for (const f of oyentes) f();
    return m;
  }));
// Con `useSyncExternalStore` (20/11, la verificación de F1): `useVideoTutorial` arrancaba en null en CADA montaje, aunque el
// manifiesto ya estuviera leído, y el primer dibujo mostraba «Todavía no está grabado» un instante. Al hidratar usa lo del servidor
// (null: nada distinto del HTML); montado en el navegador, lo leído en el acto.
const suscribir = (f: () => void): (() => void) => {
  oyentes.add(f);
  void pedirManifiesto();
  return () => { oyentes.delete(f); };
};
const leidoAhora = (): unknown => leido;
const nadaEnElServidor = (): null => null;

/**
 * ¿Ya llegó el manifiesto? (20/11, F1 de la auditoría): mientras carga, `useVideoTutorial` da null igual que «no hay video», y la
 * placa «Todavía no está grabado» se veía un momento aunque el video existiera. Esa placa va sólo con el manifiesto ya leído.
 */
export function useManifiestoListo(): boolean {
  return useSyncExternalStore(suscribir, () => manifiestoListo, () => false);
}

export function useVideoTutorial(key: string | null): VideoTutorial | null {
  const m = useSyncExternalStore(suscribir, leidoAhora, nadaEnElServidor);
  return useMemo(() => (key && m != null ? videoDe(m, key) : null) || null, [key, m]);
}

/** El manifiesto entero (la misma lectura, una por visita): para la lista de videos de un chat (./VideosDelChat.tsx). */
export function useManifiesto(): unknown | null {
  return useSyncExternalStore(suscribir, leidoAhora, nadaEnElServidor);
}
