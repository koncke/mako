// =============================================================================
// items-edicion — el hilo de «Editar con MaKo» con las filas del Ops Center (22/10/2026, TB3; puro)
// =============================================================================
// Martín, 22/10: «quiero que todos los chats de MaKo en las tabs sean el del Ops Center: mismas funciones, mismo diseño».
// El panel (./PanelEditarMako.tsx) dibuja su hilo con `HiloMako` (app/_chat/HiloMako.tsx): lo de la persona a la derecha con
// su foto, lo de MaKo a la izquierda con el muñeco de la tab. Lo que es SÓLO de este chat —lo que cambió con su «Deshacer»,
// los avisos, un error con su link, los pedidos de otra hoja con sus botones— no lo sabe dibujar el hilo: va en su hueco
// `enMensaje`, que el panel arma por el índice que lleva el id (`indiceDe`).
//
// ⚠️ EL ID ES LA POSICIÓN EN EL HILO, a propósito: el hilo de este panel sólo crece o cambia un mensaje en su lugar (el
//    «Deshacer», una burbuja que avanza), nunca se reordena ni se borra del medio. Un id estable sin tocar el modelo.
// =============================================================================

import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { MensajeEdicion } from './PanelEditarMako';

const PREFIJO = 'e';

/** Los mensajes del panel como filas del hilo. Lo de MaKo sin texto propio (un error, un pedido) va vacío: su hueco lo llena. */
export function itemsDeEdicion(hilo: readonly MensajeEdicion[]): ItemHilo[] {
  return hilo.map((m, i): ItemHilo => ({
    k: 'msg', id: `${PREFIJO}${i}`, at: null,
    role: m.k === 'yo' ? 'user' : 'assistant',
    texto: m.k === 'yo' || m.k === 'el' ? m.texto : '',
  }));
}

/** El índice del mensaje del panel que dibuja esa fila (null si el id no es de este hilo). */
export function indiceDe(id: string): number | null {
  if (!id.startsWith(PREFIJO)) return null;
  const n = Number(id.slice(PREFIJO.length));
  return Number.isInteger(n) && n >= 0 ? n : null;
}
