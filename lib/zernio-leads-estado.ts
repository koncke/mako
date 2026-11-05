// =============================================================================
// zernio-leads-estado — qué se le dice al negocio sobre los leads de sus formularios de Meta (los que llegan por Zernio)
// =============================================================================
// PURO: lo usan `leadsEnElWebhook` y `avisoDeLeadsZernio` (lib/zernio.ts), el modal «Anuncios de Meta»
// (app/integraciones/ConectarMetaZernio.tsx, por lib/meta-conexion-zernio.ts) y tests/zernio-leads-estado.test.ts, que lo EJECUTA.
//
// ⚠️ EL AVISO SALÍA EN FALSO (Código Inmobiliario, 30/10/2026: «todavía no recibe leads» estando conectado). El arreglo del 29/10
// miró si el webhook está registrado, y quedaron tres formas de afirmar algo que no se midió (medido el 5/11/2026 leyendo el código):
//   1. SIN WEBHOOK los leads LLEGAN IGUAL: el barrido de cada 30 minutos (app/api/cron/meta-leads-poll, lib/zernio-leads-barrido.ts)
//      los lee por la API de Zernio. Decir «MaKo todavía no recibe los leads» era falso: llegan con hasta media hora de atraso.
//   2. UN WEBHOOK SIN `lead.received` NO ES SIEMPRE «falta el complemento»: uno registrado antes de que MaKo escuchara los leads
//      tampoco lo tiene (lo arregla la pasada diaria o «Volver a conectar», que llaman a `asegurarWebhook`). Y uno PAUSADO
//      (`isActive: false`) decía «falta el complemento», con la causa equivocada.
//   3. SIN EL SECRETO MAESTRO no se puede armar la URL del webhook: devolvía «no hay webhook» y salía el aviso.
// La regla de ahora: el webhook sólo dice «llegan al instante». Cuando no escucha, lo que decide es si la API de Zernio entrega
// los leads (`leadsPorLaApi`: un pedido de uno, el mismo del barrido): si los entrega, llegan cada media hora; si contesta 403,
// falta el complemento y no llegan; si no se sabe, no se dice nada.
// =============================================================================

/** Un webhook como lo devuelve `GET /webhooks/settings` de Zernio. */
export type WebhookZernio = { _id?: string; url?: string; events?: string[]; isActive?: boolean };

/** El webhook de MaKo en esa cuenta de Zernio: escucha los leads, está pero no los escucha, está pausado, o no está. */
export type EscuchaWebhook = 'escucha' | 'no-escucha' | 'inactivo' | 'no-esta';

export function escuchaDelWebhook(webhooks: readonly WebhookZernio[], url: string, evento: string): EscuchaWebhook {
  const nuestro = webhooks.find((w) => (w.url ?? '').trim() === url);
  if (!nuestro) return 'no-esta';
  if (nuestro.isActive === false) return 'inactivo';
  return (nuestro.events ?? []).includes(evento) ? 'escucha' : 'no-escucha';
}

/** Lo que contestó la API de Zernio al pedir los leads: los entrega, 403 (sin el complemento de anuncios), o no se sabe. */
export type LecturaLeads = 'anda' | 'sin-complemento' | 'no-se';

/**
 * Lo que dice el modal: `si` llegan al instante (nada que decir); `tarde` llegan cada media hora (el barrido) y «Volver a
 * conectar» los trae al instante; `sin-permiso` no llegan: falta el complemento de anuncios; null no se sabe (no se afirma nada).
 */
export type AvisoLeads = 'si' | 'tarde' | 'sin-permiso' | null;

export function avisoDeLeads(p: { hayMaestro: boolean; webhook: EscuchaWebhook | null; lectura: LecturaLeads | null }): AvisoLeads {
  if (p.hayMaestro && p.webhook === 'escucha') return 'si';
  if (p.lectura === 'sin-complemento') return 'sin-permiso';
  // Sin el secreto maestro, «Volver a conectar» no registra ningún webhook: decirle que lo toque sería un consejo que no arregla.
  if (p.lectura === 'anda') return p.hayMaestro ? 'tarde' : null;
  return null;
}

/** Lo que devuelve `leadsEnElWebhook` (lo usa el cron diario para decidir si asegura el webhook): true sólo si escucha. */
export function escuchaComoBooleano(e: EscuchaWebhook): boolean | null {
  return e === 'escucha' ? true : e === 'no-esta' ? null : false;
}
