// =============================================================================
// /api/admin/tablero?ws=N — el tablero de un cliente, para verlo desde la ficha
// =============================================================================
// GET → { ok, ws, trabajo } con TODAS las tareas y proyectos de ese workspace, ya
// mapeadas al modelo que dibuja el board.
//
// ⚠️ ES SÓLO GET, Y NO POR AHORA. Escribir en el tablero de otro inquilino desde acá
// no se arregla con un endpoint: el tablero escribe por `fetch` del navegador y el
// workspace de esos fetch sale de la URL de la PESTAÑA, no del componente. Son 24
// `fetch` en 11 archivos, y el de `/api/plan-board` hace upsert con
// `onConflict: 'workspace_id,id'` — o sea que arrastrar una tarjeta del cliente le
// CLONARÍA la fila al tablero del super admin, con 200 y sin un error. Editar es
// entrar al cliente («Inspeccionar»), que pone el `?ws=` y hace coherentes la lectura
// y la escritura. Ver lib/tablero-de-workspace.ts.
//
// ⚠️ EL `ws` DEL QUERY NO ES UN PERMISO: ES UNA PREGUNTA. Quién puede pedirlo lo
// contesta `getSesionAdmin()` contra la base, en este mismo request — el mismo guard
// que el resto de /api/admin. Y es el guard REAL: `proxy.ts` ya traduce un `?ws=` a
// contexto sólo para un admin firmado, pero esta ruta no depende de eso, porque lee el
// número del query a propósito y no del contexto de la pestaña: la ficha se abre desde
// /customer-success, que NO tiene `?ws=` (ponérselo apagaría el propio panel — mirá
// `estaImpersonando()` en el `page.tsx` de esa ruta).

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { esWsValido } from '@/lib/agencia-cartera';
import { getWorkspace } from '@/lib/workspace';
import { tableroDeOtroWorkspace } from '@/lib/tablero-de-workspace';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  const ws = Number(req.nextUrl.searchParams.get('ws'));
  if (!esWsValido(ws)) return NextResponse.json({ ok: false, error: 'workspace inválido' }, { status: 400 });
  // Sin workspace no hay tablero que leer, y decirlo es mejor que devolver uno vacío:
  // «no existe» y «no tiene trabajo» son dos respuestas distintas.
  if (!(await getWorkspace(ws))) return NextResponse.json({ ok: false, error: 'ese cliente no existe' }, { status: 404 });

  try {
    return NextResponse.json({ ok: true, ws, trabajo: await tableroDeOtroWorkspace(ws) });
  } catch (e) {
    // ⚠️ EL ERROR SE DICE. Un `[]` acá haría indistinguible «este cliente no tiene
    // trabajo» —que es el caso normal del día 1— de «no pude leer su tablero», y la
    // primera es la que la pantalla ya sabe mostrar.
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'No pude leer su tablero.' }, { status: 500 });
  }
}
