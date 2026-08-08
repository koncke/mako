// =============================================================================
// DashboardHeader — header compartido de las 3 tabs del dashboard
// =============================================================================

import Link from '@/app/_ui/Link';
import { getDataSources } from '@/lib/sources';
import { SourceStrip } from './SourceStrip';
import { FechaFiltroGlobal } from './FechaFiltroGlobal';

function fmtFechaCorta(yyyy_mm_dd: string): string {
  // Convención del proyecto: fecha completa en pantalla → dd/mm/aaaa.
  const [y, m, d] = yyyy_mm_dd.split('-');
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

export async function DashboardHeader({
  fechaAyer,
  hoyReal,
}: {
  fechaAyer: string;
  hoyReal: string;
}) {
  let sources: Awaited<ReturnType<typeof getDataSources>> = [];
  try {
    sources = await getDataSources();
  } catch {
    // si falla el chequeo de fuentes, no rompemos el header
  }

  return (
    <>
      <header className="mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-[46px] md:text-[62px] tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}
          >
            Dashboard Marketing
          </h1>
          <p className="mt-1 text-lg" style={{ color: 'var(--text-dim)' }}>
            Mauricio Bustos · Datos actualizados a {fmtFechaCorta(fechaAyer)}
          </p>
        </div>
        {/* Filtro de fecha global (Fase C) + acceso a Leads, arriba a la derecha */}
        <div className="flex items-center gap-3 flex-wrap">
          <FechaFiltroGlobal hoyReal={hoyReal} />
          <Link
            href="/crm"
            className="px-5 py-3 rounded-lg font-medium text-lg border"
            style={{
              background: 'transparent',
              borderColor: 'var(--primary)',
              color: 'var(--primary)',
            }}
          >
            Leads →
          </Link>
        </div>
      </header>
      {sources.length > 0 && <SourceStrip sources={sources} />}
    </>
  );
}
