'use client';

// =============================================================================
// AnuncioSolo — el detalle de UN anuncio como página, sin la tabla
// =============================================================================
// El árbol de Meta se baja igual que en el Ads Manager (/api/meta-health, en el
// cliente): es la única fuente que conoce TODOS los anuncios, incluso los que no
// gastaron en el rango y por lo tanto no están en `senales`. Se resuelve con el
// mismo resolverAd que usa la tabla, así las dos puertas abren idéntico.
// =============================================================================

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from '@/app/_ui/Link';
import type { SenalRecon } from '@/lib/queries';
import type { MetaHealth } from '@/lib/meta-health-ui';
import { resolverAd } from '../../ads-manager/ad-resolver';

const AdDetailTabs = dynamic(() => import('../../marketing/ad-charts').then((m) => m.AdDetailTabs), { ssr: false });

const MONO = "'Geist Mono', monospace";

export function AnuncioSolo({ adId, senales, desde, hasta }: { adId: string; senales: SenalRecon[]; desde: string; hasta: string }) {
  const [health, setHealth] = useState<MetaHealth | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let vivo = true;
    fetch('/api/meta-health')
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        if (j.error) { setError(String(j.error)); setEstado('error'); return; }
        setHealth(j);
        setEstado('listo');
      })
      .catch((e) => { if (vivo) { setError(String(e)); setEstado('error'); } });
    return () => { vivo = false; };
  }, []);

  const senal = estado === 'listo' ? resolverAd(adId, senales, health) : null;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1040, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/ads-manager" style={{ fontSize: 13.5, color: 'var(--dim)', textDecoration: 'none', fontWeight: 600 }}>← Ads Manager</Link>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{adId}</span>
      </div>

      {estado === 'cargando' && <Aviso texto="Buscando el anuncio en Meta…" />}
      {estado === 'error' && <Aviso texto={`No se pudo consultar Meta: ${error}`} tono="bad" />}
      {estado === 'listo' && !senal && (
        <Aviso
          tono="bad"
          texto={`No existe el anuncio ${adId} en esta cuenta de Meta. Puede ser de otra cuenta, o lo borraron.`}
        />
      )}
      {senal && <AdDetailTabs key={senal.ad_id} senal={senal} desde={desde} hasta={hasta} defaultTab="rendimiento" inline />}
    </main>
  );
}

function Aviso({ texto, tono = 'dim' }: { texto: string; tono?: 'dim' | 'bad' }) {
  return (
    <div style={{
      width: '100%', maxWidth: 1040, padding: '18px 20px', borderRadius: 14,
      border: `1px solid ${tono === 'bad' ? 'var(--bad-fill, var(--border-strong))' : 'var(--border)'}`,
      background: tono === 'bad' ? 'var(--bad-bg)' : 'var(--surface-2)',
      color: tono === 'bad' ? 'var(--bad)' : 'var(--dim)', fontSize: 13.5,
    }}>
      {texto}
    </div>
  );
}
