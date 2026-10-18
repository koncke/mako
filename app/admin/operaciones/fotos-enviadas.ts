// =============================================================================
// Las fotos de los mensajes enviados, en este navegador (17/10/2026): por qué y cómo, en FotosEnviadas.tsx
// =============================================================================
// ⚠️ SIN 'use client' a propósito: lo llama el motor (useCentro.ts), que no lleva la directiva, y un valor de un módulo
//    'use client' no se importa desde uno que no la tiene (tests/frontera-use-client.test.ts). Corre sólo en el navegador.

import { guardarAdjuntos, leerAdjuntosGuardados } from './adjuntos-guardados';

export type Foto = { url: string; nombre: string };
/** Lo ya leído de cada trabajo (por su id): la burbuja se vuelve a dibujar con cada refresco y no relee IndexedDB. */
const leidas = new Map<string, Foto[]>();
const direccionDe = (id: string) => `enviado:${id}`;
const LADO_MINIATURA = 640;

async function miniatura(f: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, LADO_MINIATURA / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(bmp.width * k));
    lienzo.height = Math.max(1, Math.round(bmp.height * k));
    lienzo.getContext('2d')?.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.78));
    return blob ? new File([blob], f.name, { type: 'image/jpeg' }) : f;
  } catch { return f; }
}

/** Lo llama el motor (useCentro.ts → mandar) apenas el trabajo salió: la foto se ve en el acto y queda para después. */
export function recordarEnviadas(id: string, archivos: readonly File[]) {
  const fotos = archivos.filter((f) => f.type.startsWith('image/'));
  if (!fotos.length) return;
  leidas.set(id, fotos.map((f) => ({ url: URL.createObjectURL(f), nombre: f.name })));
  void Promise.all(fotos.map(miniatura)).then((ms) => guardarAdjuntos(direccionDe(id), ms));
}

/** Las fotos de un trabajo que este navegador ya leyó (null = todavía no). */
export const fotosYaLeidas = (id: string): Foto[] | null => leidas.get(id) ?? null;

/** Las fotos de un trabajo: de memoria, o de IndexedDB (la miniatura) la primera vez. */
export async function leerFotosEnviadas(id: string): Promise<Foto[]> {
  const ya = leidas.get(id);
  if (ya) return ya;
  const lista = (await leerAdjuntosGuardados(direccionDe(id))).map((f) => ({ url: URL.createObjectURL(f), nombre: f.name }));
  leidas.set(id, lista);
  return lista;
}
