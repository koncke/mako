// =============================================================================
// /admin/ui — el sistema de diseño: las piezas y el porqué de cada una
// =============================================================================
// No es documentación aparte: es la biblioteca REAL renderizada. Si un botón se
// ve mal acá, se ve mal en toda la app. Sirve para cuatro cosas concretas:
//   · ver los estados que en la app son difíciles de provocar (error, offline,
//     sin permiso, cargando),
//   · comprobar que un cambio de token se propaga a todo,
//   · que quien agrega una pieza tenga dónde mostrarla,
//   · y dejar por escrito qué se cambió del rediseño y por qué (sub-tabs
//     «Rediseño» y «La barra»).
//
// Solo super-admin: es una herramienta de construcción, no del producto.
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { CatalogoUI } from './CatalogoUI';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CatalogoUIPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  // La sub-tab se lee ACÁ y no con useSearchParams: ese hook hace que el
  // boundary se saltee el render del servidor y la primera pintura salga vacía.
  const { tab } = await searchParams;
  return <CatalogoUI tabInicial={tab} />;
}
