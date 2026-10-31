// Competitor Spy — antes se llamaba «Market Analyst» y vivía entre los Analysts.
// Salió de ahí: no analiza un activo propio como los otros seis (una oferta, un
// anuncio, una landing), sino que VIGILA lo que hacen los demás. La `nav` key
// sigue siendo 'market-an' porque está escrita en la base.
//
// Dejó de ser `ComingSoon` el 31/10/2026 con la Etapa 1 del plan
// (docs/diseno-competitors-spy.md §6): la lista, la ficha por bloques y el onboarding, con
// Instagram, YouTube y la landing del competidor leídos de verdad. Los anuncios entran por la vía
// que no tiene problema de términos —los pega la persona—, porque la API de Meta no entrega
// anuncios comerciales fuera de la Unión Europea y el Reino Unido.
//
// ⚠️ EL GATE DEL ONBOARDING VA CON `.catch(() => false)`: un hipo de la base no puede esconder la
// tab. Y el «salir» del wizard lo decide `PuertaSpy` del lado del cliente, nunca un
// `router.refresh()`, que vuelve a correr este mismo guard y devuelve el wizard otra vez.

import { PuertaSpy } from './PuertaSpy';
import { SpyApp } from './SpyApp';
import { listarCompetidores } from '@/lib/spy';
import { requireRolWs } from '@/lib/tab-access';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';

export const dynamic = 'force-dynamic';

export default async function CompetitorSpyPage() {
  await requireRolWs([], { nav: 'market-an' });
  // La migración 0358 la aplica una sesión local: mientras no esté, `listarCompetidores` devuelve
  // su motivo y la pantalla abre vacía con el onboarding, sin romperse.
  const r = await listarCompetidores().catch(() => ({ ok: false as const, error: '' }));
  const competidores = r.ok ? r.competidores : [];
  const falta = await onboardingTabPendiente('market-an').catch(() => false);
  const app = <SpyApp iniciales={competidores} />;
  return falta ? <PuertaSpy>{app}</PuertaSpy> : app;
}
