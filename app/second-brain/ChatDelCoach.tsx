'use client';

// =============================================================================
// El Funnel Coach: su chat adentro del Ops Center (1/11/2026; el ÚNICO coach desde el 4/11/2026)
// =============================================================================
// Martín: «primero el chat principal de Ops Center, que ya no se llama cerebro... segundo funnel coach y ahí adentro la calculadora».
// Y el 4/11/2026: «Junta a "Offer coach" con "Funnel Coach", que se quede solo "Funnel coach" y que tenga ambas funcionalidades
// dentro... Por defecto, que esté la cara de hormozi». El detalle en docs/funnel-coach.md. ES EL CHAT ÚNICO DE LA APP (AGENTS.md):
//   · el PANEL, el HILO y la CAJA son los del Ops Center; el MOTOR es ./useChatDelCoach.ts (el mismo del teléfono) → useChatCliente →
//     /api/mako/chat → turnoApp;
//   · lo que lo hace coach es su CONTEXTO y sus HERRAMIENTAS FIJAS, que elige el servidor por `desde.tab` (lib/asesores/contexto.ts):
//     primero la oferta (lo que hacía el Offer Coach) y después el funnel, la calculadora y el plan, en UN solo chat, sin modos;
//   · «VER EL PLAN» (docs/funnel-coach.md §3): deja de verse el chat y se ve lo GUARDADO. Sin plan guardado no hay botón.
// ARRANCA SEGÚN LA OFERTA: con oferta (guardada o armada en una conversación de oferta), por el presupuesto; sin ella, por la oferta,
// ahí mismo. Las conversaciones de oferta de antes cuelgan de su fila en la barra (ChatSecondBrain.tsx).
//
// CON EL ONBOARDING V2 (18/11/2026, `dosCoaches`; Martín, 15/11: «Oferta y Funnel Coach en DOS chats separados»): esta MISMA pantalla
// es cualquiera de los dos (`cual`). El Offer Coach, con la cara de quien aconseja (se elige tocándola) y sin plan; el Funnel Coach,
// con su propia criatura, sin elegir referente y con «Ver el plan». Los dos abren con su video la primera vez (./VideoDelCoach.tsx).

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Modal } from '@/app/_ui';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { HiloMako, esRespuestaDeMaKo } from '@/app/_chat/HiloMako';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from './PiezasCliente';
import { ElegirReferente } from './ElegirReferente';
import { BotonSecondBrainDe, CerebroDelGuru } from './SuSecondBrain';
import { useChatDelCoach } from './useChatDelCoach';
import { useVideoDelCoach } from './VideoDelCoach';
import { VistaDelPlan } from './VistaDelPlan';
import type { CoachDelOps } from '@/lib/chat-mako-reglas';
import { inspiradoEn, type IdAsesor } from '@/lib/asesores/catalogo';
import type { OfertaDelCoach } from '@/lib/funnel-plan';

export function ChatDelCoach({ referente, oferta, puedeElegir, onReferente, onVolver, cual = 'funnel', dosCoaches = false }: {
  referente: IdAsesor | null;
  /** Con qué oferta abre (lib/funnel-plan.ts → `ofertaDelCoach`); null = todavía no se sabe. */
  oferta: OfertaDelCoach | null;
  /** Quién tiene al frente es del negocio: sólo su admin toca la criatura. */
  puedeElegir: boolean;
  onReferente: (id: IdAsesor | null) => void;
  onVolver: () => void;
  /** Qué coach: sin el V2, siempre el Funnel Coach. */
  cual?: CoachDelOps;
  /** El onboarding V2: los dos coaches separados (lo decide el servidor, app/second-brain/page.tsx → `retoV2`). */
  dosCoaches?: boolean;
}) {
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  const { k, r, aspecto, quien, vacio, saludo, plan, titulo, tab } = useChatDelCoach({ referente, oferta, caja, cual, dosCoaches });
  const portada = useVideoDelCoach(cual, dosCoaches, saludo);
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [k.items.length, k.trabajo]);
  const seguirHilo = useCallback(() => hilo.current, []);
  // Quién aconseja se elige en el coach único y, con el V2, en el Offer Coach: el Funnel Coach del V2 no tiene referente al frente.
  const eligeReferente = puedeElegir && !(dosCoaches && cual === 'funnel');

  // El plan y el Second Brain del gurú van en el lugar de la conversación, de a uno: abrir uno cierra el otro.
  const [viendoPlan, setViendoPlan] = useState(false);
  const [viendoCerebro, setViendoCerebro] = useState(false);
  const mostrandoCerebro = viendoCerebro && r != null;
  const mostrandoPlan = viendoPlan && plan != null && !mostrandoCerebro;
  const [eligiendo, setEligiendo] = useState(false);

  return (
    <>
      <PanelDeChat hilo={hilo} adjuntos={k.adjuntosCaja}
        cabecera={{
          clave: tab, titulo, aspecto, animo: k.enCurso ? 'trabajando' : 'despierto', onMuneco: eligeReferente ? () => setEligiendo(true) : undefined, onVolver,
          acciones: (
            <>
              {r && <span className="co-cab__inspirado">{inspiradoEn(r)}</span>}
              {plan && !mostrandoCerebro && <button type="button" className="co-chip" aria-pressed={mostrandoPlan} onClick={() => setViendoPlan((v) => !v)}>{mostrandoPlan ? 'Ver el chat' : 'Ver el plan'}</button>}
              {r && <BotonSecondBrainDe referente={r} viendo={mostrandoCerebro} onCambiar={(si) => { setViendoCerebro(si); if (si) setViendoPlan(false); }} />}
            </>
          ),
        }}
        reemplazo={mostrandoCerebro && r ? <CerebroDelGuru referente={r} /> : undefined}
        arriba={<BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={titulo} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />}
        despues={<>
          <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} reportable={esRespuestaDeMaKo} />
          {k.infoWA && <Modal titulo="Info del mensaje" onCerrar={() => k.setInfoWA(null)} ancho={460}><InfoMensaje m={k.infoWA} /></Modal>}
        </>}
        caja={mostrandoPlan ? null : <div className="co-caja"><CajaDelCliente k={k} campo={caja} seguir={seguirHilo} /></div>}
        estado={estadoDelCliente(k)}>
        {mostrandoPlan ? <VistaDelPlan plan={plan} />
          : vacio ? (
            <HiloMako items={portada.items} quien={quien} ahora={k.ahora} escribiendo={null} tarjeta={null} enMensaje={portada.enMensaje}
              onTarjeta={() => {}} onReintentar={() => {}} onRecargar={k.recargar} onResponder={(t) => k.enviar(t)} />
          ) : <HiloDelCliente k={k} />}
      </PanelDeChat>
      {eligiendo && <ElegirReferente titulo={titulo} elegido={referente} onCerrar={() => setEligiendo(false)} onElegir={(id) => { setEligiendo(false); onReferente(id); }} />}
      {k.conectando && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { k.setConectando(false); k.mirarSuIA(); }} ancho={640}>
          <TusCuentasIA sinCabecera conectar />
        </Modal>
      )}
    </>
  );
}
