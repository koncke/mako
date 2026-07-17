// =============================================================================
// /anuncio/<ad_id> — la página del anuncio SOLO (sin la tabla)
// =============================================================================
// La otra puerta al mismo detalle:
//   /ads-manager/<ad_id> → el anuncio abierto DENTRO del Ads Manager (con contexto)
//   /anuncio/<ad_id>     → el anuncio y nada más (para mandar, para leer)
//
// El id es el ad_id de META, igual que la otra ruta. Mismo guard que el Ads
// Manager (nav 'ads-manager'): es el mismo dato, así que no puede haber una
// puerta más permisiva que la otra.
// =============================================================================

import { getSenalesRecon, type SenalRecon } from '@/lib/queries';
import { ayerEnTijuana, hoyEnTijuana, esFechaValida, primerDiaDelMesDeFecha } from '@/lib/date-utils';
import { requireRolWs } from '@/lib/tab-access';
import { AnuncioSolo } from './AnuncioSolo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AnuncioPage({
  params,
  searchParams,
}: {
  params: Promise<{ adId: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireRolWs([], { nav: 'ads-manager' });
  const { adId } = await params;
  const p = await searchParams;

  // Mismo rango por default que el Ads Manager, para que el mismo anuncio muestre
  // los mismos números por las dos puertas.
  const ayer = ayerEnTijuana();
  const hoy = hoyEnTijuana();
  const rangoOk = !!p.desde && !!p.hasta && esFechaValida(p.desde) && esFechaValida(p.hasta) && p.desde <= p.hasta && p.hasta <= hoy;
  const desde = rangoOk ? p.desde! : primerDiaDelMesDeFecha(ayer);
  const hasta = rangoOk ? p.hasta! : ayer;

  // El rendimiento enriquece; si Supabase falla, el detalle igual abre con lo que
  // sabe Meta (mismo criterio que el Ads Manager: el estado en vivo es el núcleo).
  let senales: SenalRecon[] = [];
  try { senales = await getSenalesRecon(desde, hasta); } catch { /* degradado */ }

  return <AnuncioSolo adId={adId} senales={senales} desde={desde} hasta={hasta} />;
}
