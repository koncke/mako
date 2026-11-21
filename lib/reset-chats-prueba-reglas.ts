// =============================================================================
// RESET EN UN ESPACIO DE PRUEBA: qué chats se vacían (21/11/2026; puro, lo lee el test y lo usa ./reset-chats-prueba.ts)
// =============================================================================
// Martín, en el ws 3: «le di a reset y comenzamos de cero», y quedaban «Image Editor», «Prueba · contraste sobre blur» y Offer Coach con
// mensajes de «Ayer». En un espacio de PRUEBA, RESET deja los chats como en una cuenta recién creada. Los fijos del recorrido (Ops Center,
// Reto, Offer Coach, Funnel Coach) se crean solos al entrar; el grupo de avisos vive en sus tablas (`grupo_*`) y no se toca.
// =============================================================================

/** Las tablas que se vacían, en orden: los mensajes antes que sus chats. */
export const TABLAS_DE_LOS_CHATS = ['chart_chats', 'chart_sessions', 'offer_sesiones'] as const;

/** Lo que los coaches recuerdan fuera de sus chats: sin esto, Offer Coach daba la oferta por hecha con el chat vacío. */
export const SETTINGS_DE_LOS_COACHES = ['onboarding_v2.offer_coach', 'funnel_coach.plan'] as const;
