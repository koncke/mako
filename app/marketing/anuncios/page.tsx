// =============================================================================
// /marketing/anuncios — todos los anuncios ganadores (vista completa)
// =============================================================================
// Respeta el filtro global de fecha (?desde&hasta) y lo mantiene en el link de
// regreso. Muestra el comparador de agendas (Meta vs CRM) y delega el filtro
// por campaña/adset, el orden y el modal de detalle a AnunciosBrowser (cliente).

import Link from 'next/link';
import { getSenalesRecon, getAgendasComparador, type SenalRecon, type AgendasComparador } from '@/lib/queries';
import { ayerEnTijuana, hoyEnTijuana, esFechaValida, primerDiaDelMesDeFecha } from '@/lib/date-utils';
import { FechaFiltro } from '../../_components/FechaFiltro';
import { tieneSenal } from '../AnuncioCard';
import { AnunciosBrowser } from './AnunciosBrowser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

function fmtPeriodoLabel(desde: string, hasta: string): string {
  const f = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  };
  return `${f(desde)} – ${f(hasta)}`;
}

export default async function AnunciosPage({
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
    !!desdeParam &&
    !!hastaParam &&
    esFechaValida(desdeParam) &&
    esFechaValida(hastaParam) &&
    desdeParam <= hastaParam &&
    hastaParam <= hoyReal;

  const rangoDesde = filtroActivo ? desdeParam! : primerDiaDelMesDeFecha(ayerReal);
  const rangoHasta = filtroActivo ? hastaParam! : ayerReal;
  const backHref = filtroActivo ? `/marketing?desde=${rangoDesde}&hasta=${rangoHasta}` : '/marketing';

  let senales: SenalRecon[] = [];
  let comparador: AgendasComparador | null = null;
  let errorMsg: string | null = null;
  try {
    [senales, comparador] = await Promise.all([
      getSenalesRecon(rangoDesde, rangoHasta),
      getAgendasComparador(rangoDesde, rangoHasta),
    ]);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }
  const conSenal = senales.filter(tieneSenal);

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <Link href={backHref} style={{ fontSize: 13.5, color: 'var(--dim)', textDecoration: 'none' }}>← Marketing</Link>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 8 }}>
            <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Anuncios ganadores</h1>
            <span style={{ fontSize: 15, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{conSenal.length} con señal · {fmtPeriodoLabel(rangoDesde, rangoHasta)}</span>
          </div>
        </div>
        <FechaFiltro hoyReal={hoyReal} />
      </header>

      {comparador && <ComparadorAgendas c={comparador} />}

      {errorMsg ? (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 16, padding: '24px 28px' }}>
          <p style={{ fontWeight: 600, fontSize: 18, margin: '0 0 4px', color: 'var(--bad)' }}>Error consultando datos</p>
          <p style={{ fontFamily: MONO, fontSize: 14, margin: 0, color: 'var(--dim)' }}>{errorMsg}</p>
        </div>
      ) : (
        <AnunciosBrowser senales={conSenal} />
      )}
    </main>
  );
}

// Comparador de agendas: Meta (Programaciones) vs CRM (agendas reales).
function ComparadorAgendas({ c }: { c: AgendasComparador }) {
  const gap = c.crm - c.meta;
  const cell: React.CSSProperties = { flex: 1, minWidth: 160, padding: '16px 18px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' };
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)', marginBottom: 22 }}>
      <h2 style={{ fontWeight: 600, fontSize: 18, letterSpacing: '-0.01em', margin: '0 0 4px', color: 'var(--ink)' }}>Agendas: Meta vs CRM</h2>
      <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: '0 0 16px' }}>
        Meta atribuye con su modelo (clic/vista). El CRM cuenta todas las agendas del período (incluye orgánico, directo y leads sin UTM). La brecha es esperable.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={cell}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Suma según Meta</div>
          <div style={{ fontWeight: 600, fontSize: 30, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{c.meta}</div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 4 }}>Programaciones atribuidas a anuncios</div>
        </div>
        <div style={cell}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Reales en el CRM</div>
          <div style={{ fontWeight: 600, fontSize: 30, color: 'var(--good)', fontVariantNumeric: 'tabular-nums' }}>{c.crm}</div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 4 }}>Leads con Junta 1 en el período</div>
        </div>
        <div style={cell}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Brecha (CRM − Meta)</div>
          <div style={{ fontWeight: 600, fontSize: 30, color: gap >= 0 ? 'var(--ink)' : 'var(--bad)', fontVariantNumeric: 'tabular-nums' }}>{gap >= 0 ? '+' : ''}{gap}</div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 4 }}>No atribuibles a un anuncio</div>
        </div>
      </div>
    </section>
  );
}
