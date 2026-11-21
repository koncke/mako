// =============================================================================
// RESET EN UN ESPACIO DE PRUEBA: qué chats se vacían, y EN CUÁLES (21/11/2026; puro, lo lee el test y lo usa ./reset-chats-prueba.ts)
// =============================================================================
// Martín, en el ws 3: «le di a reset y comenzamos de cero», y quedaban «Image Editor», «Prueba · contraste sobre blur» y Offer Coach con
// mensajes de «Ayer». En un espacio de PRUEBA, RESET deja los chats como en una cuenta recién creada. Los fijos del recorrido (Ops Center,
// Reto, Offer Coach, Funnel Coach) se crean solos al entrar; el grupo de avisos vive en sus tablas (`grupo_*`) y no se toca.
//
// ⚠️ EN CUÁLES: una lista CERRADA y escrita acá, NUNCA «los espacios de la revisión» ni otra lista que alguien amplíe (21/11, el Cerebro,
// URGENTE): el ws 9 también es de la revisión y es el espacio de Martín (su Ops Center con los chats de Claude, su Second Brain, sus
// leads); el 11 es Leila, una clienta. Un clic de RESET ahí no puede borrar nada.
// =============================================================================

/** Los ÚNICOS espacios donde RESET vacía los chats: el Cliente de Prueba (3) y el de Diseño (4). Ni el 9 (Martín) ni el 11 (Leila). */
export const WS_SE_VACIAN_LOS_CHATS: readonly number[] = [3, 4];
export const seVacianLosChats = (ws: number | null | undefined): boolean => typeof ws === 'number' && WS_SE_VACIAN_LOS_CHATS.includes(ws);

/**
 * Las tablas que se vacían, en orden: los mensajes antes que sus chats. Con los chats de los EDITORES (21/11, el Cerebro en producción:
 * después del RESET seguían «Image Editor» y «Prueba · contraste sobre blur»): la lista lateral los junta con los demás
 * (lib/chat-mako-indice.ts → chatsDeLosEditores), y viven en sus propias tablas.
 */
export const TABLAS_DE_LOS_CHATS = ['chart_chats', 'chart_sessions', 'offer_sesiones', 'image_editor_chats', 'video_editor_chats'] as const;

/**
 * Los chats que viven en `app_settings`, por el COMIENZO de su clave (se borran con `like 'clave%'`, por el workspace): las charlas del
 * lienzo de cada automatización (lib/automatizacion-chat.ts → claveChat). 21/11, el Cerebro: «una cuenta nueva no tiene chats de
 * automatizaciones». Se va la charla; la automatización en sí (nutricion_secuencias) queda. Sin `%` ni `_`: son comodines de LIKE.
 */
export const CLAVES_DE_LOS_CHATS = ['automatizacion.chat:'] as const;

/**
 * CADA FUENTE DE LA LISTA LATERAL (lo que pide con `${RUTA}?<fuente>=1`, app/second-brain/useChatCliente.ts) y dónde viven sus hilos: una
 * tabla de TABLAS_DE_LOS_CHATS o un comienzo de clave de CLAVES_DE_LOS_CHATS. El test (tests/reset-prueba-sin-chats.test.ts) cae si la
 * lista suma una fuente que no está acá, o si uno de estos lugares no se vacía: «cualquier otro tipo de hilo que la lista lateral junte con
 * los chats» (el Cerebro, 21/11) se va con el RESET.
 */
export const FUENTES_DE_LA_LISTA = {
  sesiones: ['chart_sessions', 'chart_chats'], // los chats de la persona (Ops Center, los sueltos), lib/mako-turno-app.ts
  antes: ['chart_sessions', 'chart_chats'], // los de antes y los de las tabs (CRM, la ficha, los gurús), lib/chat-mako-indice.ts
  offer: ['offer_sesiones'], // chatsDeOffer
  automations: ['automatizacion.chat:'], // chatsDeAutomations → lib/automatizacion-chat-db.ts (listarChats)
  editores: ['image_editor_chats', 'video_editor_chats'], // chatsDeLosEditores
} as const satisfies Record<string, readonly string[]>;

/** Lo que los coaches recuerdan fuera de sus chats: sin esto, Offer Coach daba la oferta por hecha con el chat vacío. */
export const SETTINGS_DE_LOS_COACHES = ['onboarding_v2.offer_coach', 'funnel_coach.plan'] as const;
