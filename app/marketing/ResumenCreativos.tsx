'use client';

// =============================================================================
// ResumenCreativos — desgloses (edad/género, plataforma, mapa) de TODA la cuenta
// =============================================================================
// Mismos gráficos que el detalle de cada anuncio, pero agregando toda la cuenta
// del período. Datos en vivo de Meta vía /api/account-insights (fetch en cliente,
// debajo del fold → no bloquea el render de la tab).

import { useEffect, useState } from 'react';
import { BreakdownCharts, type Breakdowns } from './ad-charts';

const MONO = "'Geist Mono', monospace";

export function ResumenCreativos({ desde, hasta }: { desde: string; hasta: string }) {
  const [data, setData] = useState<Breakdowns | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null); setErr(null);
    fetch(`/api/account-insights?desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.error) setErr(j.error); else setData(j); })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [desde, hasta]);

  const vacio = !!data && data.demograficos.length === 0 && data.plataformas.length === 0 && data.regiones.length === 0;

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: '0 0 18px', color: 'var(--ink)' }}>Audiencia y alcance</h2>

      {err &&<div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px', color: 'var(--bad)', fontSize: 13 }}>No se pudo cargar de Meta: {err}</div>}
      {!data && !err && <div style={{ fontSize: 13.5, color: 'var(--faint)', fontFamily: MONO, padding: '8px 0' }}>Cargando desgloses de Meta…</div>}
      {vacio && <p style={{ fontSize: 14, color: 'var(--faint)', margin: 0 }}>Sin gasto a nivel cuenta en el período.</p>}

      {data && !vacio && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <BreakdownCharts demograficos={data.demograficos} plataformas={data.plataformas} regiones={data.regiones} />
        </div>
      )}
    </section>
  );
}
