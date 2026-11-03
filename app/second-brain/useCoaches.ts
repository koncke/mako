'use client';

// Quién tiene cada coach al frente, si hay oferta (con qué arranca el Funnel Coach) y si esta persona puede cambiarlo (1/11/2026).
// Aparte de ChatSecondBrain.tsx: esa pantalla no hace pedidos propios (tests/ops-center-cliente.test.ts).

import { useCallback, useEffect, useState } from 'react';
import { REFERENTES_DE_FABRICA, sanearReferentes, type IdAsesor, type IdCoach, type ReferentesElegidos } from '@/lib/asesores/catalogo';

export function useCoaches() {
  const [referentes, setReferentes] = useState<ReferentesElegidos>(REFERENTES_DE_FABRICA);
  const [hayOferta, setHayOferta] = useState(false);
  const [puedeElegir, setPuedeElegir] = useState(false);
  useEffect(() => {
    let vivo = true;
    void fetch('/api/mako/chat?coaches=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { referentes?: unknown; hayOferta?: boolean; puedeElegir?: boolean } | null) => {
        if (!vivo || !j) return;
        setReferentes(sanearReferentes(j.referentes));
        setHayOferta(!!j.hayOferta);
        setPuedeElegir(!!j.puedeElegir);
      });
    return () => { vivo = false; };
  }, []);
  /** Se ve en el acto; si el servidor no lo guarda, vuelve el de antes: el chat sigue aconsejando con lo guardado, y la cabecera no puede decir otra cosa. */
  const elegirReferente = useCallback((coach: IdCoach, id: IdAsesor | null) => {
    let antes: ReferentesElegidos | null = null;
    setReferentes((r) => { antes = r; return { ...r, [coach]: id }; });
    void fetch('/api/mako/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'referente', referentes: { [coach]: id } }) })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { referentes?: unknown } | null) => {
        if (j?.referentes) setReferentes(sanearReferentes(j.referentes));
        else if (antes) setReferentes(antes);
      });
  }, []);
  return { referentes, hayOferta, puedeElegir, elegirReferente };
}
