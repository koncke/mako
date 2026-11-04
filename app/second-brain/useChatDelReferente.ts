'use client';

// El motor del chat con un gurú, el mismo en la computadora (./ChatDelReferente.tsx) y en el teléfono (app/m/second-brain/HojaDelGuru.tsx):
// busca SU conversación (una por persona, negocio y gurú), corre el chat único con SU cara y arma el saludo del chat vacío.

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useChatCliente } from './useChatCliente';
import { aspectoDeReferente } from '@/lib/centro-munecos';
import { tabDeReferente, type ElegidoChat } from '@/lib/chat-mako-reglas';
import type { Asesor } from '@/lib/asesores/catalogo';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { SesionChat } from '@/lib/mako-turno-app-reglas';

/** Lo que dice el chat vacío. No se guarda: es la portada. Es MaKo con sus marcos, nunca la persona. */
export const saludoDelReferente = (a: Pick<Asesor, 'completo' | 'curso'>): string =>
  `Te ayudo con lo que enseña ${a.completo} en «${a.curso}», llevado a tu negocio. ¿Qué quieres resolver?`;

export function useChatDelReferente(r: Asesor, caja: RefObject<HTMLTextAreaElement | null>) {
  const tab = tabDeReferente(r.id);
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/mako/chat?deTab=${encodeURIComponent(tab)}`, { cache: 'no-store' })
      .then((x) => (x.ok ? x.json() : null)).catch(() => null)
      .then((j: { sesion?: SesionChat | null } | null) => { if (vivo) setElegido(j?.sesion ? { antes: j.sesion.id } : { virtual: 'nuevo' }); });
    return () => { vivo = false; };
  }, [tab]);
  const aspecto = useMemo(() => aspectoDeReferente(r.id), [r.id]);
  const quien = useMemo(() => ({ nombre: r.nombre, aspecto }), [r.nombre, aspecto]);
  const k = useChatCliente({ elegido, setElegido, activo: false, entrarAlCerebro: false, chatInicial: null, opcionArmar: '', busca: '', caja, tab, quien });
  const mirar = useRef(k.mirarSuIA);
  mirar.current = k.mirarSuIA;
  useEffect(() => { mirar.current(); }, []);
  const vacio = elegido != null && k.cargado && !k.errorCarga && !k.items.length && !k.trabajo;
  const saludo = useMemo<ItemHilo[]>(() => [{ k: 'msg', id: `saludo-${r.id}`, role: 'assistant', texto: saludoDelReferente(r), at: new Date().toISOString() }], [r]);
  return { k, aspecto, quien, vacio, saludo };
}
