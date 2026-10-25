'use client';

// =============================================================================
// useExtensionFichas — ¿la extensión de MaKo lee las fichas de WhatsApp Web?, EN VIVO (25/10/2026)
// =============================================================================
// `extensionLeeFichas` (lib/wa-fichas-cliente.ts) lee el atributo que pone extension/mako-puente.js, una vez. Para «que ahí
// directamente comience» al instalarla (Martín, llamada con Leandro del 24/10, f12) la pantalla tiene que ENTERARSE cuando el
// atributo aparece: se mira con un MutationObserver sobre <html>, y al volver a la pestaña.
// ⚠️ Chrome no inyecta el content script en una pestaña que ya estaba abierta al instalar la extensión: hasta que la
// extensión lo reponga sola, en esa pestaña el atributo aparece recién al recargar (docs/hallazgos-crm.md).

import { useSyncExternalStore } from 'react';
import { extensionLeeFichas } from '@/lib/wa-fichas-cliente';

function suscribir(avisar: () => void): () => void {
  const mo = new MutationObserver(avisar);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mako-puente'] });
  window.addEventListener('focus', avisar);
  return () => { mo.disconnect(); window.removeEventListener('focus', avisar); };
}

/** 'si' | 'vieja' | 'no', y se actualiza solo. En el servidor, 'no' (no hay extensión que mirar). */
export function useExtensionFichas(): 'si' | 'vieja' | 'no' {
  return useSyncExternalStore(suscribir, extensionLeeFichas, () => 'no');
}
