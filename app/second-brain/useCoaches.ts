'use client';

// Quién tiene cada coach al frente, si hay oferta (con qué arranca el Funnel Coach) y si esta persona puede cambiarlo (1/11/2026).
// Aparte de ChatSecondBrain.tsx: esa pantalla no hace pedidos propios (tests/ops-center-cliente.test.ts).

import { useCallback, useEffect, useState } from 'react';
import { REFERENTES_DE_FABRICA, sanearReferentes, type IdAsesor, type IdCoach, type ReferentesElegidos } from '@/lib/asesores/catalogo';
import type { GuruConCharla } from '@/lib/chat-mako-reglas';

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

/**
 * Los gurús con los que la persona ya habló, para su historial en la barra (lib/chat-mako-indice.ts → `gurusConCharla`). Se relee al
 * cambiar de chat: el primer mensaje al gurú recién abierto crea su conversación. El super admin no tiene otra forma de volver a la
 * suya: su lista es la de Claude Code, y estos chats no salen en ella.
 */
export function useGurusConCharla(abierto: IdAsesor | null, activo = true): readonly GuruConCharla[] {
  const [gurus, setGurus] = useState<readonly GuruConCharla[]>([]);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    void fetch('/api/mako/chat?gurusConCharla=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { gurus?: GuruConCharla[] } | null) => { if (vivo && j?.gurus) setGurus(j.gurus); });
    return () => { vivo = false; };
  }, [abierto, activo]);
  return gurus;
}
