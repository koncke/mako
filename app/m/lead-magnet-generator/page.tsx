// =============================================================================
// /lead-magnet-generator en el teléfono (5/11/2026): la lista de lead magnets y las plantillas
// =============================================================================
// Destila la de escritorio (app/lead-magnet-generator/): la misma lista, las mismas plantillas y el mismo detalle de un lead
// magnet, con las piezas de app/m/_ui. Crear lleva a la pieza en su herramienta (en el teléfono, su pantalla de /m: las mismas
// rutas). Quién: la key de la sección y la puerta de escritorio (por ahora sólo la plataforma).
// =============================================================================

import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { CabeceraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { compartidosPorPieza, landingsDelNegocio, listarLeadMagnets } from '@/lib/lead-magnets/server';
import { getSesionAdmin } from '@/lib/auth';
import { esLaPlataforma } from '@/app/lead-magnet-generator/puerta';
import { vistaDeLeadMagnet, type LeadMagnetVista } from '@/app/lead-magnet-generator/reglas';
import { LeadMagnetsM } from './LeadMagnetsM';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function LeadMagnetsMovil({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireMovil({ navKey: 'lead-magnet-generator' });
  // La sección es del super admin (como su escritorio): `getSesionAdmin()` y su negocio, no mirando a un cliente.
  if (!(await getSesionAdmin()) || !(await esLaPlataforma())) redirect(await rutaConWs(HOME_MOVIL));
  const sp = await searchParams;
  const [r, landings, compartidos] = await Promise.all([listarLeadMagnets(), landingsDelNegocio(), compartidosPorPieza()]);
  const lista: LeadMagnetVista[] = r.ok ? r.lista.map((e) => vistaDeLeadMagnet(e, landings, compartidos)) : [];
  const abierto = typeof sp.lm === 'string' ? lista.find((x) => x.id === sp.lm) ?? null : null;
  return (
    <PantallaM>
      <CabeceraM titulo="Lead Magnet" />
      {r.ok
        ? <LeadMagnetsM lista={lista} abierto={abierto} />
        : <ErrorM frase={r.error} />}
    </PantallaM>
  );
}
