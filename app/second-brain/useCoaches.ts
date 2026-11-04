'use client';

// Quién tiene al frente el coach, con qué oferta arranca (cuál, ticket #57) y si esta persona puede cambiarlo (1/11/2026).
// UN SOLO COACH desde el 4/11/2026 (Martín: «Junta a "Offer coach" con "Funnel Coach"»): el referente es uno, y el de fábrica es Hormozi.
// Aparte de ChatSecondBrain.tsx: esa pantalla no hace pedidos propios (tests/ops-center-cliente.test.ts).

import { useCallback, useEffect, useState } from 'react';
import { REFERENTE_DE_FABRICA, asesorPorId, type IdAsesor } from '@/lib/asesores/catalogo';
import type { GuruConCharla } from '@/lib/chat-mako-reglas';
import { sanearOfertaDelCoach, type OfertaDelCoach } from '@/lib/funnel-plan';

/** Lo que contesta el servidor: un id que no existe nunca rompe (null = MaKo; ausente = el de fábrica, hasta que conteste). */
const referenteDe = (v: unknown): IdAsesor | null => (v === null ? null : asesorPorId(v)?.id ?? REFERENTE_DE_FABRICA);

export function useCoaches() {
  const [referente, setReferente] = useState<IdAsesor | null>(REFERENTE_DE_FABRICA);
  // null = todavía no contestó (el saludo espera); si el pedido falla, «no se sabe»: nunca se afirma una oferta sin leerla.
  const [oferta, setOferta] = useState<OfertaDelCoach | null>(null);
  const [puedeElegir, setPuedeElegir] = useState(false);
  useEffect(() => {
    let vivo = true;
    void fetch('/api/mako/chat?coaches=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { referente?: unknown; oferta?: unknown; puedeElegir?: boolean } | null) => {
        if (!vivo) return;
        setOferta(sanearOfertaDelCoach(j?.oferta));
        if (!j) return;
        if ('referente' in j) setReferente(referenteDe(j.referente));
        setPuedeElegir(!!j.puedeElegir);
      });
    return () => { vivo = false; };
  }, []);
  /** Se ve en el acto; si el servidor no lo guarda, vuelve el de antes: el chat sigue aconsejando con lo guardado, y la cabecera no puede decir otra cosa. */
  const elegirReferente = useCallback((id: IdAsesor | null) => {
    let antes: IdAsesor | null | undefined;
    setReferente((r) => { antes = r; return id; });
    void fetch('/api/mako/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'referente', referente: id }) })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { referente?: unknown } | null) => {
        if (j && 'referente' in j) setReferente(referenteDe(j.referente));
        else if (antes !== undefined) setReferente(antes);
      });
  }, []);
  return { referente, oferta, puedeElegir, elegirReferente };
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
