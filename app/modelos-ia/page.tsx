// =============================================================================
// /modelos-ia — SuperAdmin: modelo/IA por tarea (config-driven)
// =============================================================================
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { ModelosIA } from './ModelosIA';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ModelosIAPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/');
  return <ModelosIA />;
}
