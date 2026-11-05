// =============================================================================
// POST /api/actividad — el lote de uso del navegador (5/11/2026, Admin › Activity)
// =============================================================================
// Lo manda app/_components/MedidorDeUso.tsx cada minuto y al salir de la pestaña: { entradas: [{ ruta, pantallas, acciones }] }.
// Se sanea (`sanearLote`: la ruta pasa a su tab, los números con tope) y se suma DESPUÉS de contestar (`after`): la persona
// nunca espera a la medición, y si falla, falla callada (lib/actividad-registro.ts).
//
// ⚠️ NO ES PÚBLICA: sin sesión, el proxy corta antes. El usuario y el negocio salen de la SESIÓN (`getUsuarioActual`,
//    `getWorkspaceActual`), nunca del cuerpo. El super admin global no se mide (contesta 204 sin escribir).
// ⚠️ 204 siempre, también con un cuerpo malo: el navegador no hace nada con la respuesta, y un error no le sirve a nadie.

import { after } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { sanearLote } from '@/lib/actividad-reglas';
import { registrarActividad } from '@/lib/actividad-registro';

export const dynamic = 'force-dynamic';

const nada = () => new Response(null, { status: 204 });

export async function POST(req: Request) {
  const sesion = await getUsuarioActual();
  if (!sesion) return new Response(null, { status: 401 });
  if (sesion.rol === 'admin' || !/^\d+$/.test(sesion.sub)) return nada();
  const lote = sanearLote(await req.json().catch(() => null));
  if (lote.length === 0) return nada();
  const ws = await getWorkspaceActual();
  after(() => registrarActividad(Number(sesion.sub), ws, lote));
  return nada();
}
