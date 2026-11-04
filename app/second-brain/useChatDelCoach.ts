'use client';

// =============================================================================
// El motor del coach, el mismo en la computadora (./ChatDelCoach.tsx) y en el teléfono (app/m/second-brain/HojaDelCoach.tsx)
// =============================================================================
// UN SOLO COACH desde el 4/11/2026. Martín: «Junta a "Offer coach" con "Funnel Coach", que se quede solo "Funnel coach" y que tenga
// ambas funcionalidades dentro... Por defecto, que esté la cara de hormozi». El Funnel Coach trabaja primero la oferta y después el
// funnel, en UN chat (lib/asesores/contexto.ts → las fases, y sus herramientas fijas). Lo que hace este motor:
//   · busca SU conversación (una por persona y negocio, `mako-movil:<persona>:funnel-coach`) y corre el chat único con la cara del
//     referente que tiene al frente (Hormozi de fábrica; MaKo si eligió MaKo);
//   · arma el saludo del chat vacío según haya oferta (guardada o armada en una conversación de oferta);
//   · relee el plan guardado al entrar y cada vez que MaKo termina (una tarjeta confirmada pudo guardarlo).
// ⚠️ LO QUE LO HACE COACH NO ES ESTA PANTALLA: lo elige el servidor por `desde.tab` (app/api/mako/chat/route.ts → `contextoDelChat`).

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useChatCliente } from './useChatCliente';
import { ASPECTO_MAKO, aspectoDeReferente } from '@/lib/centro-munecos';
import { ORIGEN_FUNNEL_COACH, TAB_FUNNEL_COACH, type ElegidoChat } from '@/lib/chat-mako-reglas';
import { asesorPorId, type IdAsesor } from '@/lib/asesores/catalogo';
import { saludoDelFunnelCoach, sanearPlan, type PlanFunnel } from '@/lib/funnel-plan';
import type { Desde } from '@/lib/chat-desde';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { SesionChat } from '@/lib/mako-turno-app-reglas';

const DESDE: Desde = { tab: ORIGEN_FUNNEL_COACH, entidad: null, modo: null };

export function useChatDelCoach({ referente, hayOferta, caja }: { referente: IdAsesor | null; hayOferta: boolean; caja: RefObject<HTMLTextAreaElement | null> }) {
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/mako/chat?deTab=${TAB_FUNNEL_COACH}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { sesion?: SesionChat | null } | null) => { if (vivo) setElegido(j?.sesion ? { antes: j.sesion.id } : { virtual: 'nuevo' }); });
    return () => { vivo = false; };
  }, []);
  const r = asesorPorId(referente);
  const aspecto = r ? aspectoDeReferente(r.id) : ASPECTO_MAKO;
  const quien = useMemo(() => ({ nombre: r?.nombre ?? 'MaKo', aspecto }), [r?.nombre, aspecto]);
  const k = useChatCliente({ elegido, setElegido, activo: false, entrarAlCerebro: false, chatInicial: null, opcionArmar: '', busca: '', caja, desde: DESDE, tab: TAB_FUNNEL_COACH, quien });
  const mirar = useRef(k.mirarSuIA);
  mirar.current = k.mirarSuIA;
  useEffect(() => { mirar.current(); }, []);

  // El plan guardado: se relee al entrar y cada vez que MaKo termina (una tarjeta confirmada pudo guardarlo).
  const [plan, setPlan] = useState<PlanFunnel | null>(null);
  const ocupado = k.enCurso || k.tarjeta != null;
  useEffect(() => {
    if (ocupado) return;
    let vivo = true;
    void fetch('/api/mako/chat?planFunnel=1', { cache: 'no-store' })
      .then((x) => (x.ok ? x.json() : null)).catch(() => null)
      .then((j: { plan?: unknown } | null) => { if (vivo && j) setPlan(sanearPlan(j.plan)); });
    return () => { vivo = false; };
  }, [ocupado]);

  const vacio = elegido != null && k.cargado && !k.errorCarga && !k.items.length && !k.trabajo;
  const saludo = useMemo<ItemHilo[]>(() => [{ k: 'msg', id: 'saludo-fc', role: 'assistant', texto: saludoDelFunnelCoach(hayOferta), at: new Date().toISOString() }], [hayOferta]);
  return { k, r, aspecto, quien, vacio, saludo, plan };
}
