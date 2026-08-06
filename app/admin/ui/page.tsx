// =============================================================================
// /admin/ui — el catálogo vivo de la biblioteca de primitives
// =============================================================================
// No es documentación aparte: es la biblioteca REAL renderizada. Si un botón se
// ve mal acá, se ve mal en toda la app. Sirve para tres cosas concretas:
//   · ver los estados que en la app son difíciles de provocar (error, offline,
//     sin permiso, cargando),
//   · comprobar que un cambio de token se propaga a todo,
//   · y que quien agrega una pieza tenga dónde mostrarla.
//
// Solo super-admin: es una herramienta de construcción, no del producto.
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { CatalogoUI } from './CatalogoUI';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CatalogoUIPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  return <CatalogoUI />;
}
