'use client';

// =============================================================================
// AngulosPanel — la tab "Ángulos y avatares" de /configuraciones
// =============================================================================
// Trae el vocabulario de ángulos + avatares y lo edita con el TaxonomyManager en
// modo inline (mismo editor que la modal de Ads Analyst). Al guardar, refresca.

import { useCallback, useEffect, useState } from 'react';
import { TaxonomyManager, type TaxItem } from '../components/TaxonomyManager';

export function AngulosPanel() {
  const [data, setData] = useState<{ angles: TaxItem[]; avatares: TaxItem[] } | null>(null);
  const [ver, setVer] = useState(0);

  const load = useCallback(async () => {
    const [a, v] = await Promise.all([
      fetch('/api/ads-analyst/angles').then((r) => r.json()).catch(() => ({})),
      fetch('/api/ads-analyst/avatares').then((r) => r.json()).catch(() => ({})),
    ]);
    setData({ angles: a?.ok ? a.angles : [], avatares: v?.ok ? v.avatares : [] });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: 'var(--faint)' }}>Cargando…</div>;

  // key={ver} remonta el editor tras guardar, para que reseedee con lo recién guardado.
  return <TaxonomyManager key={ver} inline angles={data.angles} avatares={data.avatares} onSaved={() => { load().then(() => setVer((n) => n + 1)); }} />;
}
