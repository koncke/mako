// =============================================================================
// evolution-firma — un secreto POR LÍNEA para el webhook del WhatsApp no oficial
// =============================================================================
// El webhook de Evolution (app/api/webhooks/evolution) se autenticaba con `?secret=` igual a
// EVOLUTION_WEBHOOK_SECRET: UN secreto de plataforma para todas las líneas de todos los negocios,
// escrito en claro en la URL del webhook de cada instancia. Con él —y el `instance_name` es
// adivinable: `mako_ws<id>`— se inyectaban mensajes falsos en la bandeja de CUALQUIER negocio, o
// se le pausaba la nutrición a un lead ajeno (un entrante pausa las secuencias). Ya viajó una vez
// al navegador de los clientes (hallazgos-seguridad → «Webhooks y firmas»).
//
// Ahora la URL de cada línea lleva su PROPIA firma: HMAC-SHA256(secreto, nombre de la instancia).
// Quien tenga la URL de su línea sólo puede firmar eventos de esa línea; para firmar los de otra
// hace falta el secreto, que no sale del servidor. Sin columna nueva ni migración: la firma se
// recalcula. El webhook la verifica contra el `instance` del CUERPO, que es lo que decide a qué
// negocio va el evento.
//
// LA TRANSICIÓN: las líneas ya registradas tienen la URL vieja (`?secret=`). Hasta CORTE_LEGADO se
// aceptan y el propio webhook las vuelve a registrar con la URL nueva al primer evento (una línea
// viva manda eventos todo el tiempo); conectar o «Reparar espejo» también la escriben. Pasado el
// corte, `?secret=` contesta 401: una línea que no mandó nada en tres semanas se repara desde la
// pantalla (estadoWebhook la marca `no_registrado`).
//
// SIN `server-only`: puro, con test (tests/evolution-firma.test.ts).
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Hasta cuándo se acepta la URL vieja con el secreto de plataforma. Después, 401. */
export const CORTE_LEGADO = Date.parse('2026-11-07T00:00:00Z');

/** La firma de una línea: 64 hex. Depende del secreto y del nombre de la instancia, y de nada más. */
export function firmaDeInstancia(secreto: string, instancia: string): string {
  return createHmac('sha256', secreto).update(`evolution-webhook:${instancia}`).digest('hex');
}

/** La query de la URL del webhook de una línea (sin el `?`). */
export function queryDeWebhook(secreto: string, instancia: string): string {
  return `i=${encodeURIComponent(instancia)}&firma=${firmaDeInstancia(secreto, instancia)}`;
}

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type VeredictoFirma = 'ok' | 'legado' | 'rechazado';

/**
 * ¿Este pedido viene de la línea que dice ser? `ok` con la firma de la instancia del cuerpo;
 * `legado` con el secreto de plataforma antes del corte (se acepta y se re-registra la línea);
 * `rechazado` en cualquier otro caso, incluido el servidor sin secreto (fail-closed).
 */
export function verificarFirma(p: {
  secreto: string | undefined | null;
  query: URLSearchParams;
  instancia: string | undefined | null;
  ahora: number;
}): VeredictoFirma {
  const secreto = p.secreto ?? '';
  if (!secreto || !p.instancia) return 'rechazado';
  const firma = p.query.get('firma');
  if (firma) {
    const i = p.query.get('i');
    if (i != null && i !== p.instancia) return 'rechazado';
    return iguales(firma, firmaDeInstancia(secreto, p.instancia)) ? 'ok' : 'rechazado';
  }
  const legado = p.query.get('secret');
  if (legado && p.ahora < CORTE_LEGADO && iguales(legado, secreto)) return 'legado';
  return 'rechazado';
}
