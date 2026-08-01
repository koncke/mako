// =============================================================================
// /admin/guiones — la fábrica de guiones: ángulos + estructuras (solo admin)
// =============================================================================

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { GuionesAdminView } from './GuionesAdminView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GuionesAdminPage() {
  const sesion = await getUsuarioActual();
  if (!sesion || sesion.rol !== 'admin') redirect('/inicio');
  return <GuionesAdminView />;
}
