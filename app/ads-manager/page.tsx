// =============================================================================
// /ads-manager — réplica de Meta Ads Manager (Campañas · Conjuntos · Anuncios)
// =============================================================================
// Tabla estilo Meta: ordenable por columna, multiselección, columnas
// configurables, primera columna fija, encender/apagar y editar presupuesto
// (CBO/ABO) en la celda. El estado de entrega es live (Meta vía /api/meta-health);
// el rendimiento (senales) + CRM enriquecen las columnas.

import { getSenalesRecon, type SenalRecon } from '@/lib/queries';
import { ayerEnTijuana, hoyEnTijuana, esFechaValida, primerDiaDelMesDeFecha, fmtDDMMYYYY } from '@/lib/date-utils';
import { FechaFiltro } from '../_components/FechaFiltro';
import { Icon } from '../_components/icons';
import { CampanasBrowser } from './CampanasBrowser';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

export default async function AdsManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireRolWs([]);
  const ayerReal = ayerEnTijuana();
  const hoyReal = hoyEnTijuana();
  const params = await searchParams;
  const desdeParam = params.desde;
  const hastaParam = params.hasta;
  const filtroActivo =
    !!desdeParam && !!hastaParam && esFechaValida(desdeParam) && esFechaValida(hastaParam) &&
    desdeParam <= hastaParam && hastaParam <= hoyReal;
  const rangoDesde = filtroActivo ? desdeParam! : primerDiaDelMesDeFecha(ayerReal);
  const rangoHasta = filtroActivo ? hastaParam! : ayerReal;

  // El núcleo es el ESTADO en vivo (browser → /api/meta-health). El rendimiento
  // (senales/Supabase) enriquece; si falla, degradamos a columnas "—".
  let senales: SenalRecon[] = [];
  let perfError: string | null = null;
  try {
    senales = await getSenalesRecon(rangoDesde, rangoHasta);
  } catch (err) {
    perfError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
            Estado + rendimiento · {fmtDDMMYYYY(rangoDesde)} – {fmtDDMMYYYY(rangoHasta)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="grid" size={34} /></span>
            <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Ads Manager</h1>
          </div>
        </div>
        <FechaFiltro hoyReal={hoyReal} />
      </header>

      {perfError && (
        <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 13.5, color: 'var(--warn)', fontWeight: 600 }}>Sin datos de rendimiento.</span>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}> Mostrando solo el estado de entrega en vivo; las columnas de gasto/agendas/cierres quedan en “—”.</span>
        </div>
      )}
      <CampanasBrowser senales={senales} desde={rangoDesde} hasta={rangoHasta} />
    </main>
  );
}
