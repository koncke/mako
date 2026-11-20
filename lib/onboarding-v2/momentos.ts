// =============================================================================
// LOS MENSAJES DEL ONBOARDING V2 QUE NOMBRAN ALGO DE UN VIDEO (20/11/2026, tarde)
// =============================================================================
// Cada uno sale cuando la voz del video llega ahí, no antes (el Cerebro, con lo que vio Martín en producción): el mensaje espera el
// t_inicio de la frase que lo nombra (`dice`, buscado en el texto de las frases del manifiesto: public/tutoriales/manifiesto.json).
// Lo usa app/onboarding/ChatArranqueV2.tsx con app/_ui/tutorial/useMensajeDelVideo.ts. Si una frase se regraba y deja de decirlo,
// tests/onboarding-mensaje-del-video.test.ts lo marca (el mensaje saldría recién al terminar el video).
// Puro y sin React.
// =============================================================================

export type MomentoDelOnboarding = { mensaje: string; video: string; dice: string };

/** «¡Hola! Para empezar, ¿cómo te llamas?»: la bienvenida dice «Primero, unas preguntas cortas para conocerte…». */
export const MOMENTO_NOMBRE: MomentoDelOnboarding = { mensaje: 'arr-nombre', video: 'onboarding-bienvenida', dice: 'unas preguntas cortas' };
/** El mensaje del código, con «Abrir WhatsApp»: el video del WhatsApp dice «Para confirmarlo, toca Abrir WhatsApp…». */
export const MOMENTO_CODIGO: MomentoDelOnboarding = { mensaje: 'arr-codigo', video: 'onboarding-bienvenida-whatsapp', dice: 'Abrir WhatsApp' };
/** «¿Guardaste el contacto de MaKo?»: el mismo video dice «Y guarda el contacto de MaKo en tu teléfono…». */
export const MOMENTO_AGENDADO: MomentoDelOnboarding = { mensaje: 'arr-agendado', video: 'onboarding-bienvenida-whatsapp', dice: 'guarda el contacto' };

export const MOMENTOS_DEL_ONBOARDING: readonly MomentoDelOnboarding[] = [MOMENTO_NOMBRE, MOMENTO_CODIGO, MOMENTO_AGENDADO];
