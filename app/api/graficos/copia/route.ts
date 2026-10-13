// POST /api/graficos/copia — «Copiar dashboard» y pegarlo con su TOKEN (lib/graficos-copia.ts, mig 0266)
//        { action: 'copiar', hoja }   → guarda la hoja (sin los filtros sobre personas) → { token, nombre, vaciados }
//        { action: 'leer', copia }    → el dashboard detrás del token, listo para ESTE negocio → { nombre, hoja, vaciados }
//                                        (`copia`: el token, o un texto que lo trae)
//        503 con `falta` si la tabla no está (la migración 0266 todavía no se aplicó).
//
// Pedido de Martín (12/10/2026): «los dashboards también deberían poder copiarse y enviarse con ese token». El molde es
// «Copiar flujo» de Automations (`copiar_flujo` / `leer_copia` en POST /api/chat-agent/secuencias).
//
// QUIÉN: el admin del negocio, con la tab en su capa (lo mismo que «Pídeselo a MaKo», app/api/graficos/ia/route.ts:
// sólo el admin arma hojas; el closer y el setter miran la suya). La tabla no es de un inquilino (la lee cualquiera que
// tenga el token), así que lo que entra se sanea acá: `hojaDeCopia` (el saneo de siempre) y `hojaParaCopiar` (sin
// personas). Al leer, si el negocio que pega no es el que copió, `hojaParaOtroNegocio` vacía los filtros sobre cosas
// del otro negocio. No se escribe nada en el informe de nadie: lo agrega la pantalla, con su guardado de siempre.

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { hojaDeCopia, hojaParaCopiar, hojaParaOtroNegocio, nombreDeHoja } from '@/lib/graficos-copia';
import { copiaDashDeToken, guardarCopiaDash, FaltaTablaDashError } from '@/lib/graficos-copia-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Una hoja entera (60 componentes, pop-ups de 24) pesa decenas de KB: lo que pase de esto no es una hoja. */
const TOPE_CUERPO = 1_500_000;

const err = (status: number, error: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status });

export async function POST(req: Request) {
  const [rol, ws] = await Promise.all([getRolWsEfectivo(), getWorkspaceActual()]);
  if (rol == null || ws == null) return err(401, 'no autenticado');
  if (rol !== 'admin') return err(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('graphics', await getCapaActual())) return err(404, 'No existe');

  const crudo = await req.text().catch(() => '');
  if (crudo.length > TOPE_CUERPO) return err(413, 'Esa hoja es demasiado grande.');
  let body: Record<string, unknown>;
  try { body = JSON.parse(crudo) as Record<string, unknown>; } catch { return err(400, 'JSON inválido'); }

  try {
    if (body?.action === 'copiar') {
      const leida = hojaDeCopia(body.hoja);
      if (!leida) return err(400, 'Esa hoja no tiene nada para copiar.');
      const { hoja, vaciados } = hojaParaCopiar(leida);
      const token = await guardarCopiaDash(hoja, { ws, vaciados });
      return NextResponse.json({ ok: true, token, nombre: nombreDeHoja(hoja), vaciados });
    }
    if (body?.action === 'leer') {
      const copia = await copiaDashDeToken(body.copia);
      if (!copia) return err(404, 'No encontré ese dashboard.');
      const enOtro = copia.wsOrigen !== ws ? hojaParaOtroNegocio(copia.hoja) : { hoja: copia.hoja, vaciados: 0 };
      return NextResponse.json({ ok: true, nombre: nombreDeHoja(enOtro.hoja), hoja: enOtro.hoja, vaciados: copia.vaciados + enOtro.vaciados });
    }
  } catch (e) {
    if (e instanceof FaltaTablaDashError) return err(503, e.message, { falta: 'dashboard_copias' });
    console.error('[graficos/copia]', e);
    return err(500, 'No se pudo. Prueba de nuevo.');
  }
  return err(400, 'Acción desconocida');
}
