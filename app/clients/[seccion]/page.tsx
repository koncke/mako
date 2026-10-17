// =============================================================================
// /clients/<seccion> — Community, Calendar, Members, Leaderboards y About: la comunidad tipo Skool del programa
// =============================================================================
// UNA página para las cinco (D5 de docs/diseno-clients.md): la comunidad ya trae sus datos, así que cambiar
// entre ellas no viaja al server (la pestaña sale de la URL, `ComunidadEquipo`). Las rutas propias de Clients
// (`/clients`, `/clients/classroom`) son carpetas estáticas y le ganan a este segmento. Lo que no es una sección
// de la comunidad es un 404, no una comunidad con otro nombre.

import { notFound } from 'next/navigation';
import { PantallaComunidad } from '@/app/customer-success/comunidad/pantalla';
import { SECCIONES_CLIENTS, esSeccionComunidad } from '@/lib/clients-rutas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ seccion: string }> }) {
  const { seccion } = await params;
  const s = SECCIONES_CLIENTS.find((x) => x.id === seccion);
  return { title: s ? `${s.label} · Clients` : 'Clients' };
}

export default async function SeccionComunidad({ params, searchParams }: {
  params: Promise<{ seccion: string }>;
  searchParams: Promise<{ producto?: string; post?: string }>;
}) {
  const { seccion } = await params;
  if (!esSeccionComunidad(seccion)) notFound();
  return <PantallaComunidad searchParams={searchParams} />;
}
