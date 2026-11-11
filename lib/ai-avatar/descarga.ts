// =============================================================================
// AI Avatar — con qué nombre se guarda lo que se descarga (módulo PURO)
// =============================================================================
// 10/11/2026, la prueba de punta a punta de la tab (docs/pruebas/ai-avatar-10-11.md): «Descargar» era un `<a download>` al
// archivo de Storage, que es OTRO origen, y ahí el navegador ignora `download` y ABRE la imagen en una pestaña. Ahora se baja
// con `descargarComo` (app/video-generator/descargar.ts, el del Video Generator): el archivo que guardó Flow, byte por byte, en
// su calidad original (memoria «descargar-calidad-original»), con un nombre que se entiende.
//
// SIN `server-only` y sin 'use client': lo usan app/ai-avatar/Estudio.tsx y app/m/ai-avatar/EstudioM.tsx.

/** «Avatar - Charla en el auto.jpg» o «Avatar - Charla en el auto - toma 2.mp4». */
export function nombreDeArchivo(nombre: string, cual: 'imagen' | 'toma', n?: number): string {
  const limpio = String(nombre || '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  const base = limpio ? `Avatar - ${limpio}` : 'Avatar';
  return cual === 'imagen' ? `${base}.jpg` : `${base}${n != null ? ` - toma ${n}` : ''}.mp4`;
}
