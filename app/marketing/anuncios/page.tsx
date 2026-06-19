// =============================================================================
// /marketing/anuncios — todos los anuncios ganadores (vista completa)
// =============================================================================
// El botón "Ver los N" de Marketing redirige acá. Misma data (getSenalesRecon)
// y misma tarjeta (AnuncioCard) que el panel resumido.

import Link from 'next/link';
import { getSenalesRecon, type SenalRecon } from '@/lib/queries';
import { ayerEnTijuana, diasAntes } from '@/lib/date-utils';
import { AnuncioCard, tieneSenal, compararCombo } from '../AnuncioCard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

export default async function AnunciosPage() {
  const ayer = ayerEnTijuana();
  const desde = diasAntes(ayer, 14);

  let senales: SenalRecon[] = [];
  let errorMsg: string | null = null;
  try {
    senales = await getSenalesRecon(desde, ayer);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }
  const conSenal = senales.filter(tieneSenal).sort(compararCombo);

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ marginBottom: 28 }}>
        <Link href="/marketing" style={{ fontSize: 13.5, color: 'var(--dim)', textDecoration: 'none' }}>← Marketing</Link>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 8 }}>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Anuncios ganadores</h1>
          <span style={{ fontSize: 15, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{conSenal.length} con señal · últimos 14 días</span>
        </div>
      </header>

      {errorMsg ? (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 16, padding: '24px 28px' }}>
          <p style={{ fontWeight: 600, fontSize: 18, margin: '0 0 4px', color: 'var(--bad)' }}>Error consultando datos</p>
          <p style={{ fontFamily: MONO, fontSize: 14, margin: 0, color: 'var(--dim)' }}>{errorMsg}</p>
        </div>
      ) : conSenal.length === 0 ? (
        <p style={{ fontSize: 14.5, color: 'var(--faint)' }}>Aún sin anuncios con gasto en el rango.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          {conSenal.map((s, i) => (
            <AnuncioCard key={s.ad_id} s={s} rank={i + 1} />
          ))}
        </div>
      )}
    </main>
  );
}
