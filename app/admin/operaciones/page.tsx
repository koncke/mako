import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { Pagina, PermissionState } from '@/app/_ui';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { esAdminDeTab } from '@/lib/puerta-admin-tab';
import { datosDelCentroSiOpera } from './datos';
import { PantallaSecondBrain, mapaDelSecondBrain, pideElMapa, type QuerySecondBrain } from '@/app/second-brain/pagina';

// =============================================================================
// /admin/operaciones — «Ops Center», la MISMA pantalla que /second-brain para el super admin (17/10/2026)
// =============================================================================
// Martín, mirando producción: «El Second Brain y el Centro deberían ser exactamente lo mismo en SuperAdmin» y «Me
// gustaría que quede el nombre de "Ops Center"». Esta página es una PUERTA: su guarda y, después, lo que arma
// app/second-brain/pagina.tsx (la pantalla es app/second-brain/ChatSecondBrain.tsx). Abre en el Cerebro; un `?chat=` con
// la clave de un chat (los links de siempre) abre ése, y `?ticketera=` la Ticketera entera. CentroApp.tsx se borró.
//
// ⚠️ La guarda va antes de leer nada (tests/operaciones.test.ts): `puedeOperar` acá, y otra vez adentro de
//    `datosDelCentroSiOpera`, que es la que lee la cola, los Runners, la Ticketera y los muñecos.
// ⚠️ NO SE ESPERA A VERCEL: su API tarda hasta 8 s («tarda mucho en aparecer», Martín, 15/10). Los pushes los pide la
//    pantalla después de dibujarse (useCentro.ts).

export const dynamic = 'force-dynamic';

export default async function OperacionesPage({ searchParams }: { searchParams: Promise<QuerySecondBrain> }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  if (!puedeOperar(admin, await wsSuperAdmin())) {
    return <Pagina><PermissionState motivo="rol" que="Ops Center" /></Pagina>;
  }
  const q = await searchParams;
  const [centro, veMapa] = await Promise.all([datosDelCentroSiOpera(), esAdminDeTab('second-brain')]);

  let mapa: ReactNode = null;
  if (veMapa && pideElMapa(q)) {
    mapa = await mapaDelSecondBrain();
  }

  return <PantallaSecondBrain veMapa={veMapa} mapa={mapa} centro={centro} q={q} inicio="centro" />;
}
