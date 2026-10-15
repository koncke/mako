// =============================================================================
// /perfil/seguridad — el segundo paso al entrar
// =============================================================================
// Agregar y sacar métodos, ver y regenerar los códigos de recuperación, y olvidar los
// dispositivos recordados. Todo lo hace /api/perfil/seguridad con la sesión completa.

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { SeguridadPanel } from './SeguridadPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SeguridadPage() {
  // Es de la PERSONA, sea cual sea su rol: `requireRolWs([])` echaba a closers y setters,
  // que también pueden (y les conviene) activar el segundo paso.
  const s = await getUsuarioActual();
  if (!s) redirect('/login?next=%2Fperfil%2Fseguridad');
  return <SeguridadPanel />;
}
