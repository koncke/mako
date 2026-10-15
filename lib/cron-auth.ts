// =============================================================================
// cron-auth — verificación del Bearer de Vercel Cron (CRON_SECRET)
// =============================================================================
// Mismo patrón que los crons existentes: Vercel firma el request con
// `Authorization: Bearer ${CRON_SECRET}`. Sin el secret en env, fail-closed.
//
// ⚠️ ES LA ÚNICA PUERTA DE /api/cron, y por eso es UNA sola (auditoría 14/10/2026). /api/cron es
// público por prefijo (lib/rutas-publicas.ts) y está exento de la regla de host (proxy.ts): el proxy
// lo deja pasar sin sesión y lo único que separa a un anónimo de correr el job es esta función.
// Hasta esa fecha había diez copias locales del chequeo y una ruta sin ninguno (plan-recurvar);
// tests/seguridad-crons-y-publicas.test.ts exige que cada handler de app/api/cron EMPIECE llamando
// a ésta y que ninguna ruta vuelva a leer el header o el secreto por su cuenta.
//
// ⚠️ Y COMPARA EN TIEMPO CONSTANTE. Un `!==` corta en el primer carácter distinto: con muchas
// muestras de tiempo, el secreto se adivina por prefijo. Se comparan los sha256 de los dos lados y
// no los strings porque `timingSafeEqual` exige el mismo largo, y cortar antes por largo distinto le
// diría al que mide cuánto mide el secreto; los dos hashes miden 32 bytes siempre.
// =============================================================================

import { createHash, timingSafeEqual } from 'node:crypto';

const sha256 = (s: string): Buffer => createHash('sha256').update(s, 'utf8').digest();

/** `Pick<Request, 'headers'>` y no `NextRequest`: lo único que se lee es el header, y así lo pueden
 *  llamar un route handler (NextRequest es un Request) y un test con un `Request` pelado. */
export function checkCronAuth(req: Pick<Request, 'headers'>): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: 'CRON_SECRET no configurado en env' }, { status: 500 });
  }
  const recibido = req.headers.get('authorization') ?? '';
  if (!timingSafeEqual(sha256(recibido), sha256(`Bearer ${secret}`))) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
