// =============================================================================
// /admin/copywriting
// =============================================================================
// El gate ya la cierra por prefijo (`SOLO_ADMIN` en proxy.ts incluye '/admin' y
// matchea '/admin/*'), y aun asi lleva su propio guard: esconder o depender de
// una capa de arriba no protege nada, y es lo que hace app/admin/page.tsx.

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { Copywriting } from './Copywriting';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Copywriting · Admin' };

export default async function CopywritingPage() {
  const sesion = await getUsuarioActual();
  if (!sesion) redirect('/login');
  if (sesion.rol !== 'admin') redirect('/inicio');
  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <div style={{ maxWidth: 980 }}>
        <Copywriting />
      </div>
    </main>
  );
}
