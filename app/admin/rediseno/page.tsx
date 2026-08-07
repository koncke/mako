// =============================================================================
// /admin/rediseno — el registro vivo del rediseño
// =============================================================================
// Antes esto era un HTML publicado afuera. Vive acá porque es la app la que
// tiene la verdad: la barra y los íconos se leen del código en cada carga, así
// que no hay nada que regenerar ni que pueda quedar viejo sin que se note.
//
// Solo super-admin, como el catálogo: es un registro de construcción, no producto.
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { Rediseno } from './Rediseno';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RedisenoPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  return <Rediseno />;
}
