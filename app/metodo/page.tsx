// =============================================================================
// /metodo — ya no es una pantalla: redirige a /integraciones (26/10/2026)
// =============================================================================
// Martín, 26/10/2026: «Elimina "Método" no entiendo eso... Si para eso ya tenemos "Integraciones"». Era la lista de las
// credenciales con su tutorial, y cada una ya tenía su tarjeta en /integraciones con el MISMO formulario (las IA, en «Tus
// cuentas de IA»): no se pierde nada. Las rutas de guardar y probar (/api/metodo, /api/metodo/verificar) siguen, porque las usa
// el resto de la casa. Los links viejos (y el ?ws= de quien mira un cliente) caen en Integraciones.

import { redirect } from 'next/navigation';
import { conLaQuery } from '@/lib/ajustes-secciones';

export const dynamic = 'force-dynamic';

export default async function MetodoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(conLaQuery('/integraciones', await searchParams));
}
