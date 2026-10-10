// =============================================================================
// chatbot-mensajes-mako — los Mensajes de MaKo (los flujos de «Notificaciones») en /automations
// =============================================================================
// Quinta tanda, punto 5 (pedido de Martín, 09/10/2026, textual): «quiero que elimines el lienzo en
// la tab de "Notificaciones", pero que dejes un enlace para editarlo aquí. Y claro, que traigas
// todos los flujos de "Notificaciones" a la tab de chatbot».
//
// El CONTRATO entre las dos puntas vive acá, en un lugar:
//   · el endpoint que lista y edita esos mensajes — el MISMO de la tab de Notificaciones
//     (`/api/perfil/plantillas`, guard: admin del workspace). No se abre ningún endpoint nuevo;
//   · el parámetro del link que manda Notificaciones (`?aviso=<id>`) y que /automations lee al cargar.
//     Con el link armado en un archivo y el parámetro leído en otro, el día que uno cambie el otro
//     abre /automations en la primera automatización sin decir nada (tests/chatbot-mensajes-mako.test.ts
//     cruza las dos puntas);
//   · cómo se ve cada mensaje como FILA de la lista (emoji y prendido).
//
// SIN 'use client' y sin `server-only`: lo leen la lista de /automations, la tab de Notificaciones y los
// tests. El tipo `PlantillaVista` se trae con `import type`, que se borra al compilar. Y no importa
// el filtro de la lista (lib/chatbot-lista-filtro.ts): la tab de Notificaciones sólo necesita el
// link, y no tiene por qué cargar el modelo del flujo para armarlo.
// =============================================================================

import type { PlantillaVista } from './plantillas';
import { EMOJI_CATEGORIA } from './avisos-catalogo';

/** El endpoint de la tab de Configuraciones › Notificaciones: lista, edita y publica, con guard de admin. */
export const ENDPOINT_MENSAJES_MAKO = '/api/perfil/plantillas';

/** El parámetro del deep link de /automations que abre el lienzo de UN mensaje de MaKo. */
export const PARAM_AVISO = 'aviso';

/** El link a /automations que abre ESE mensaje. Va por `app/_ui/Link`, que le pega el `?ws=` de la pestaña. */
export const enlaceAMensajeMako = (id: string): string => `/automations?${PARAM_AVISO}=${encodeURIComponent(id)}`;

/** El emoji de la fila: el de su categoría, el mismo que pinta la tab de Notificaciones. */
export const emojiDeMensaje = (p: Pick<PlantillaVista, 'categoria'>): string => EMOJI_CATEGORIA[p.categoria] ?? '🔔';

/** Prendido: el interruptor, o «siempre» (un mensaje fijo no se puede apagar, así que sale siempre). */
export const mensajeActivo = (p: Pick<PlantillaVista, 'enabled' | 'fijo'>): boolean => p.fijo || p.enabled;

/** El mensaje que pide abrir el link, si está entre los que esta persona puede ver; si no, null. */
export function mensajePedido(avisos: readonly Pick<PlantillaVista, 'id'>[] | null, pedido: string | null): string | null {
  if (!pedido || !avisos) return null;
  return avisos.some((a) => a.id === pedido) ? pedido : null;
}
