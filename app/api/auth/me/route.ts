// =============================================================================
// /api/auth/me — identidad del usuario logueado (para el sidebar y las vistas)
// =============================================================================
// Devuelve email/nombre/rol de la sesión, sin tocar la base (la verificación
// contra usuarios la hacen las rutas admin). El sidebar lo usa para mostrar u
// ocultar la entrada Admin.

import { NextResponse } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sesion = await getUsuarioActual();
  if (!sesion) return NextResponse.json({ ok: true, autenticado: false });
  return NextResponse.json({
    ok: true,
    autenticado: true,
    email: sesion.email,
    nombre: sesion.nombre,
    rol: sesion.rol,
    legacy: sesion.legacy ?? false,
  });
}
