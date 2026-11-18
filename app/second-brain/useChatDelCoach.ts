'use client';

// =============================================================================
// El motor del coach, el mismo en la computadora (./ChatDelCoach.tsx) y en el teléfono (app/m/second-brain/HojaDelCoach.tsx)
// =============================================================================
// UN SOLO COACH desde el 4/11/2026. Martín: «Junta a "Offer coach" con "Funnel Coach", que se quede solo "Funnel coach" y que tenga
// ambas funcionalidades dentro... Por defecto, que esté la cara de hormozi». El Funnel Coach trabaja primero la oferta y después el
// funnel, en UN chat (lib/asesores/contexto.ts → las fases, y sus herramientas fijas). Lo que hace este motor:
//   · busca SU conversación (una por persona y negocio, `mako-movil:<persona>:funnel-coach`) y corre el chat único con la cara del
//     referente que tiene al frente (Hormozi de fábrica; MaKo si eligió MaKo);
//   · arma el saludo del chat vacío con la oferta con la que abre, diciendo cuál (guardada o armada; ticket #57);
//   · relee el plan guardado al entrar y cada vez que MaKo termina (una tarjeta confirmada pudo guardarlo).
// Y CON EL ONBOARDING V2 (18/11/2026, `dosCoaches`; Martín, 15/11: «Oferta y Funnel Coach en DOS chats separados»), el MISMO motor
// corre cualquiera de los dos (`cual`): el Offer Coach con SU conversación (`…:offer-coach`), la cara de quien aconseja y su saludo;
// el Funnel Coach con la de siempre, su propia criatura y el saludo «con tu oferta ya hecha». Sin el V2, `cual` es siempre 'funnel'.
// ⚠️ LO QUE LO HACE COACH NO ES ESTA PANTALLA: lo elige el servidor por `desde.tab` y el interruptor (app/api/mako/chat/route.ts →
//    `contextoDelChat`).

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useChatCliente } from './useChatCliente';
import { ASPECTO_MAKO, aspectoDe, aspectoDeReferente } from '@/lib/centro-munecos';
import { ORIGEN_FUNNEL_COACH, ORIGEN_OFFER_COACH, TAB_FUNNEL_COACH, TAB_OFFER_COACH, type CoachDelOps, type ElegidoChat } from '@/lib/chat-mako-reglas';
import { asesorPorId, type IdAsesor } from '@/lib/asesores/catalogo';
import { saludoDelFunnelCoach, saludoDelFunnelCoachV2, saludoDelOfferCoach, sanearOfertaDelCoach, sanearPlan, type OfertaDelCoach, type PlanFunnel } from '@/lib/funnel-plan';
import { ofertaRecienEntregada } from '@/lib/reto/dias';
import type { Desde } from '@/lib/chat-desde';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { SesionChat } from '@/lib/mako-turno-app-reglas';

/** El título, la conversación y desde dónde escribe cada coach. */
export const DEL_COACH: Record<CoachDelOps, { titulo: string; tab: string; desde: Desde }> = {
  funnel: { titulo: ORIGEN_FUNNEL_COACH, tab: TAB_FUNNEL_COACH, desde: { tab: ORIGEN_FUNNEL_COACH, entidad: null, modo: null } },
  offer: { titulo: ORIGEN_OFFER_COACH, tab: TAB_OFFER_COACH, desde: { tab: ORIGEN_OFFER_COACH, entidad: null, modo: null } },
};

/** La criatura del Funnel Coach del V2: la suya, sacada de su nombre (la maqueta: «Funnel Coach con su propia criatura»). */
export const ASPECTO_FUNNEL_COACH_V2 = aspectoDe(ORIGEN_FUNNEL_COACH);

export function useChatDelCoach({ referente, oferta, caja, cual = 'funnel', dosCoaches = false }: {
  referente: IdAsesor | null; oferta: OfertaDelCoach | null; caja: RefObject<HTMLTextAreaElement | null>;
  /** Qué coach (sólo con el V2 puede ser 'offer'). */
  cual?: CoachDelOps;
  /** El onboarding V2: los dos coaches separados. */
  dosCoaches?: boolean;
}) {
  const de = DEL_COACH[cual];
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/mako/chat?deTab=${de.tab}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { sesion?: SesionChat | null } | null) => { if (vivo) setElegido(j?.sesion ? { antes: j.sesion.id } : { virtual: 'nuevo' }); });
    return () => { vivo = false; };
  }, [de.tab]);
  // El Funnel Coach del V2 no tiene referente al frente: el elegido es el del Offer Coach (lib/asesores/contexto.ts).
  const sinReferente = dosCoaches && cual === 'funnel';
  const r = sinReferente ? null : asesorPorId(referente);
  const aspecto = r ? aspectoDeReferente(r.id) : sinReferente ? ASPECTO_FUNNEL_COACH_V2 : ASPECTO_MAKO;
  const quien = useMemo(() => ({ nombre: r?.nombre ?? (sinReferente ? ORIGEN_FUNNEL_COACH : 'MaKo'), aspecto }), [r?.nombre, sinReferente, aspecto]);
  const k = useChatCliente({ elegido, setElegido, activo: false, entrarAlCerebro: false, chatInicial: null, opcionArmar: '', busca: '', caja, desde: de.desde, tab: de.tab, quien });
  const mirar = useRef(k.mirarSuIA);
  mirar.current = k.mirarSuIA;
  useEffect(() => { mirar.current(); }, []);

  // El plan guardado: se relee al entrar y cada vez que MaKo termina (una tarjeta confirmada pudo guardarlo). Es del Funnel Coach.
  const [plan, setPlan] = useState<PlanFunnel | null>(null);
  const ocupado = k.enCurso || k.tarjeta != null;
  useEffect(() => {
    if (ocupado || cual !== 'funnel') return;
    let vivo = true;
    void fetch('/api/mako/chat?planFunnel=1', { cache: 'no-store' })
      .then((x) => (x.ok ? x.json() : null)).catch(() => null)
      .then((j: { plan?: unknown } | null) => { if (vivo && j) setPlan(sanearPlan(j.plan)); });
    return () => { vivo = false; };
  }, [ocupado, cual]);

  // EL OFFER COACH DEL V2 RELEE LA OFERTA AL TERMINAR CADA TURNO (18/11/2026): si apareció una (o cambió), se acaba de ENTREGAR, y
  // eso abre el paso a Funnel Coach (app/second-brain/reto/usePasoAlFunnel.ts), que espera a que la persona la vea. Lo que había al
  // abrir es la base: una oferta de antes no es una entrega.
  const [entregadaEn, setEntregadaEn] = useState<number | null>(null);
  const base = useRef<OfertaDelCoach | null>(null);
  useEffect(() => { if (base.current == null && oferta != null) base.current = oferta; }, [oferta]);
  useEffect(() => {
    if (ocupado || cual !== 'offer' || !dosCoaches) return;
    let vivo = true;
    void fetch('/api/mako/chat?coaches=1', { cache: 'no-store' })
      .then((x) => (x.ok ? x.json() : null)).catch(() => null)
      .then((j: { oferta?: unknown } | null) => {
        if (!vivo || !j) return;
        const nueva = sanearOfertaDelCoach(j.oferta);
        if (base.current != null && ofertaRecienEntregada(base.current, nueva)) setEntregadaEn(Date.now());
        if (base.current == null || nueva.estado !== 'no-se') base.current = nueva;
      });
    return () => { vivo = false; };
  }, [ocupado, cual, dosCoaches]);

  // El saludo espera a saber con qué oferta abre (`oferta` null): antes, abría diciendo que no había y medio segundo después que sí.
  const vacio = elegido != null && oferta != null && k.cargado && !k.errorCarga && !k.items.length && !k.trabajo;
  const texto = oferta == null ? null
    : cual === 'offer' ? saludoDelOfferCoach(oferta, r?.completo ?? null)
      : dosCoaches ? saludoDelFunnelCoachV2(oferta) : saludoDelFunnelCoach(oferta);
  const saludo = useMemo<ItemHilo[]>(() => (texto ? [{ k: 'msg', id: `saludo-${de.tab}`, role: 'assistant', texto, at: new Date().toISOString() }] : []), [texto, de.tab]);
  return { k, r, aspecto, quien, vacio, saludo, plan, titulo: de.titulo, tab: de.tab, entregadaEn, ocupado };
}
