// =============================================================================
// /marketing/campanas — navegador estilo Meta: Campañas · Conjuntos · Anuncios
// =============================================================================
// Cruza el ESTADO de entrega en vivo (Meta, vía /api/meta-health en el cliente)
// con el RENDIMIENTO almacenado (getSenalesRecon) + CRM (cierres/cash) — el cruce
// que Meta no tiene. El detalle de anuncio reusa el modal AdDetalle existente;
// campañas y conjuntos abren su modal de gráficos (EntityDetalle).

import Link from 'next/link';
import { getSenalesRecon, type SenalRecon } from '@/lib/queries';
import { ayerEnTijuana, hoyEnTijuana, esFechaValida, primerDiaDelMesDeFecha, fmtDDMMYYYY } from '@/lib/date-utils';
import { FechaFiltro } from '../../_components/FechaFiltro';
import { CampanasBrowser } from './CampanasBrowser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
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

  // El núcleo de la vista es el ESTADO en vivo de Meta (lo trae el browser por
  // /api/meta-health). El rendimiento (senales, Supabase) es enriquecimiento: si
  // falla (p.ej. sin Supabase), degradamos a columnas "—" en vez de romper.
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
          <Link href="/marketing" style={{ fontSize: 13.5, color: 'var(--dim)', textDecoration: 'none' }}>← Marketing</Link>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', margin: '10px 0 8px' }}>
            Estado + rendimiento · {fmtDDMMYYYY(rangoDesde)} – {fmtDDMMYYYY(rangoHasta)}
          </div>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Campañas, conjuntos y anuncios</h1>
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
