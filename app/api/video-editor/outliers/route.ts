// =============================================================================
// GET /api/video-editor/outliers — los outliers con criterio de edición, para la sección del editor (11/11/2026)
// =============================================================================
// Martín, 11/11/2026: «ya no depender de "Encuentra tu siguiente outlier", sino que sea directamente todo el sistema de edición
// primero, y que en alguna parte, por ejemplo del lado de Importar, estén estos outliers». El editor corre en el navegador: esta
// ruta le da lo MISMO que leía la portada (lib/video-outliers-servidor.ts → `leerOutliersVideo`), con la misma puerta que las
// demás rutas del editor (sesión, administrador del negocio, el Video Editor en su plan). No escribe nada ni gasta nada.
// =============================================================================

import { NextResponse } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { veEditorVideo } from '@/app/video-editor/acceso';
import { leerOutliersVideo } from '@/lib/video-outliers-servidor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const [sesion, rol] = await Promise.all([getUsuarioActual(), getRolWsEfectivo()]);
  if (!sesion || rol == null) return NextResponse.json({ error: 'Tu sesión venció. Vuelve a entrar.' }, { status: 401 });
  if (rol !== 'admin') return NextResponse.json({ error: 'Solo el administrador.' }, { status: 403 });
  if (!(await veEditorVideo())) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  if (!tabEnCapa('video-editor', await getCapaActual())) return NextResponse.json({ error: 'Tu plan no incluye el Video Editor.' }, { status: 403 });
  return NextResponse.json(await leerOutliersVideo(), { headers: { 'Cache-Control': 'no-store' } });
}
