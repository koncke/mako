// =============================================================================
// ia-pc-ruta — la PC de un pedido, para las rutas de /api/ia-pc que se autentican con el token de la PC
// =============================================================================
// Un solo lugar para lo que las cuatro rutas de la PC (latido, turno, turno/<id>, soltar) tienen que contestar igual:
// sin PC para ese token, 401 con `revocado` (el programa se saca del arranque y sale); si la base no pudo leer, 503 (el
// programa reintenta). Antes era `.catch(() => null)` → 401 en las cuatro, y un error pasajero de la base apagaba el
// programa de Windows hasta el próximo inicio de sesión (revisión del Cerebro, 21/10/2026).
// =============================================================================

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { dispositivoDelToken, type Dispositivo } from './ia-pc';
import { bearer, respuestaSinPc } from './ia-pc-reglas';

export const respuestaDe = (fallo: 'revocado' | 'no-pude-leer'): NextResponse => {
  const r = respuestaSinPc(fallo);
  return NextResponse.json(r.cuerpo, { status: r.status, headers: { 'cache-control': 'no-store', ...(r.status === 503 ? { 'retry-after': '5' } : {}) } });
};

/**
 * `pendientesTambien`: sólo para lo que una PC puede hacer ANTES del «sí» (confirmarse o soltarse, mig 0322). Para latir y
 * tomar turnos, una PC pendiente es como si no existiera (401 `revocado`).
 */
export async function pcDelPedido(req: NextRequest, ruta: string, o: { pendientesTambien?: boolean } = {}): Promise<{ d: Dispositivo } | { respuesta: NextResponse }> {
  try {
    const d = await dispositivoDelToken(bearer(req.headers.get('authorization')), o);
    return d ? { d } : { respuesta: respuestaDe('revocado') };
  } catch (e) {
    console.error(`[ia-pc/${ruta}]`, e instanceof Error ? e.message : String(e));
    return { respuesta: respuestaDe('no-pude-leer') };
  }
}
