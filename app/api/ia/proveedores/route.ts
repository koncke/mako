// =============================================================================
// /api/ia/proveedores — qué IA GRATIS tiene este workspace, y cuánto le queda
// =============================================================================
// Lo consume el cuadro de "no salió por la IA" (app/_components/ConectarIA.tsx):
// cuando una generación falla por cuota, lo que hay que ofrecer NO es "pegá tu key
// de Gemini" —que ya está pegada y agotada— sino las otras IA gratis que todavía
// no conectó, y la posibilidad de sumar otra cuenta de las que sí.
//
// No devuelve ningún secreto: nombre del proveedor, cuántas cuentas tiene cargadas
// y el % de cuota consumida hoy. La máscara y el valor siguen saliendo solo por
// /api/integraciones/credencial, con su propio guard.

import { NextResponse } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { cuentasDe, cuotasProveedores } from '@/lib/ia-cuotas';
import { MAX_KEYS, PROVS_MULTIKEY } from '@/lib/ia-keys';
import { servicioMetodo } from '@/lib/metodo-catalogo';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Cualquiera con sesión del workspace: esto no expone credenciales, y el cuadro
  // aparece en medio del onboarding (donde el que está sentado no siempre es admin).
  // Guardar sí sigue siendo solo-admin, del otro lado.
  if (!(await getUsuarioActual())) return NextResponse.json({ ok: false, error: 'sin sesión' }, { status: 403 });

  const cuotas = await cuotasProveedores().catch(() => []);
  const provs = await Promise.all(PROVS_MULTIKEY.map(async (key) => {
    const s = servicioMetodo(key);
    const cuota = cuotas.find((c) => c.provider === key);
    return {
      key,
      nombre: s?.nombre ?? key,
      paraQue: s?.paraQue ?? '',
      cuentas: await cuentasDe(key).catch(() => 0),
      max: MAX_KEYS,
      // % de la cuota de HOY ya consumida (0-1) y si lo tratamos como agotado.
      pct: cuota?.pct ?? 0,
      agotado: !!cuota?.agotado,
    };
  }));

  return NextResponse.json({ ok: true, provs }, { headers: { 'Cache-Control': 'no-store' } });
}
