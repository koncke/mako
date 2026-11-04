'use client';

// =============================================================================
// El Funnel Coach: su chat adentro del Ops Center (1/11/2026)
// =============================================================================
// Martín: «primero el chat principal de Ops Center, que ya no se llama cerebro... segundo funnel coach y ahí adentro la calculadora».
// El detalle en docs/funnel-coach.md. ES EL CHAT ÚNICO DE LA APP (AGENTS.md), copiado de ChatDelSecondBrain.tsx:
//   · el PANEL, el HILO y la CAJA son los del Ops Center; el MOTOR es useChatCliente → /api/mako/chat → turnoApp;
//   · SU HILO ES SUYO: una conversación por persona y negocio (`mako-movil:<persona>:funnel-coach`, lib/chat-mako-reglas.ts);
//   · lo que lo hace coach es su CONTEXTO, que elige el servidor por `desde.tab` (lib/asesores/contexto.ts), y la calculadora es la
//     herramienta `calcular_presupuesto_anuncios`, no una pantalla;
//   · «VER EL PLAN» (docs/funnel-coach.md §3): deja de verse el chat y se ve lo GUARDADO. Sin plan guardado no hay botón.
// ARRANCA SEGÚN LA OFERTA (§8.1): con oferta, por el presupuesto; sin ella, deriva al Offer Coach en vez de preguntar qué vende.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/app/_ui';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { HiloMako } from '@/app/_chat/HiloMako';
import { useChatCliente } from './useChatCliente';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from './PiezasCliente';
import { ElegirReferente } from './ElegirReferente';
import { BotonSecondBrainDe, CerebroDelGuru } from './SuSecondBrain';
import { ASPECTO_MAKO, aspectoDeReferente } from '@/lib/centro-munecos';
import { ORIGEN_FUNNEL_COACH, TAB_FUNNEL_COACH, type ElegidoChat } from '@/lib/chat-mako-reglas';
import { asesorPorId, inspiradoEn, type IdAsesor } from '@/lib/asesores/catalogo';
import { lineasDelPlan, sanearPlan, type PlanFunnel } from '@/lib/funnel-plan';
import type { Desde } from '@/lib/chat-desde';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { SesionChat } from '@/lib/mako-turno-app-reglas';

const DESDE: Desde = { tab: ORIGEN_FUNNEL_COACH, entidad: null, modo: null };

/** Lo que dice el chat vacío, según haya oferta. No se guarda: es la portada. */
export function saludoDelFunnelCoach(hayOferta: boolean): string {
  return hayOferta
    ? 'Tu oferta ya está cargada. ¿Cuánto puedes invertir por mes para conseguir clientes?'
    : 'Antes de elegir un funnel conviene tener clara tu oferta. Empieza con el Offer Coach y vuelve con ella.';
}

export function ChatDelCoach({ referente, hayOferta, puedeElegir, onReferente, onVolver }: {
  referente: IdAsesor | null;
  hayOferta: boolean;
  /** Quién tiene al frente es del negocio: sólo su admin toca la criatura. */
  puedeElegir: boolean;
  onReferente: (id: IdAsesor | null) => void;
  onVolver: () => void;
}) {
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
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
  const { mirarSuIA } = k;
  useEffect(() => { mirarSuIA(); }, [mirarSuIA]);
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [k.items.length, k.trabajo]);
  const seguirHilo = useCallback(() => hilo.current, []);

  // El plan guardado: se relee al entrar y cada vez que MaKo termina (una tarjeta confirmada pudo guardarlo).
  const [plan, setPlan] = useState<PlanFunnel | null>(null);
  const [viendoPlan, setViendoPlan] = useState(false);
  const ocupado = k.enCurso || k.tarjeta != null;
  useEffect(() => {
    if (ocupado) return;
    let vivo = true;
    void fetch('/api/mako/chat?planFunnel=1', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { plan?: unknown } | null) => { if (vivo && j) setPlan(sanearPlan(j.plan)); });
    return () => { vivo = false; };
  }, [ocupado]);

  // El plan y el Second Brain del gurú van en el lugar de la conversación, de a uno: abrir uno cierra el otro.
  const [viendoCerebro, setViendoCerebro] = useState(false);
  const mostrandoCerebro = viendoCerebro && r != null;
  const mostrandoPlan = viendoPlan && plan != null && !mostrandoCerebro;
  const [eligiendo, setEligiendo] = useState(false);
  const vacio = elegido != null && k.cargado && !k.errorCarga && !k.items.length && !k.trabajo;
  const saludo = useMemo<ItemHilo[]>(() => [{ k: 'msg', id: 'saludo-fc', role: 'assistant', texto: saludoDelFunnelCoach(hayOferta), at: new Date().toISOString() }], [hayOferta]);

  return (
    <>
      <PanelDeChat hilo={hilo} adjuntos={k.adjuntosCaja}
        cabecera={{
          clave: TAB_FUNNEL_COACH, titulo: ORIGEN_FUNNEL_COACH, aspecto, animo: k.enCurso ? 'trabajando' : 'despierto', onMuneco: puedeElegir ? () => setEligiendo(true) : undefined, onVolver,
          acciones: (
            <>
              {r && <span className="co-cab__inspirado">{inspiradoEn(r)}</span>}
              {plan && !mostrandoCerebro && <button type="button" className="co-chip" aria-pressed={mostrandoPlan} onClick={() => setViendoPlan((v) => !v)}>{mostrandoPlan ? 'Ver el chat' : 'Ver el plan'}</button>}
              {r && <BotonSecondBrainDe referente={r} viendo={mostrandoCerebro} onCambiar={(si) => { setViendoCerebro(si); if (si) setViendoPlan(false); }} />}
            </>
          ),
        }}
        reemplazo={mostrandoCerebro && r ? <CerebroDelGuru referente={r} /> : undefined}
        arriba={<BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={ORIGEN_FUNNEL_COACH} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />}
        despues={<>
          <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} />
          {k.infoWA && <Modal titulo="Info del mensaje" onCerrar={() => k.setInfoWA(null)} ancho={460}><InfoMensaje m={k.infoWA} /></Modal>}
        </>}
        caja={mostrandoPlan ? null : <div className="co-caja"><CajaDelCliente k={k} campo={caja} seguir={seguirHilo} /></div>}
        estado={estadoDelCliente(k)}>
        {mostrandoPlan ? <VistaDelPlan plan={plan} />
          : vacio ? (
            <HiloMako items={saludo} quien={quien} ahora={k.ahora} escribiendo={null} tarjeta={null}
              onTarjeta={() => {}} onReintentar={() => {}} onRecargar={k.recargar} onResponder={(t) => k.enviar(t)} />
          ) : <HiloDelCliente k={k} />}
      </PanelDeChat>
      {eligiendo && <ElegirReferente titulo={ORIGEN_FUNNEL_COACH} elegido={referente} onCerrar={() => setEligiendo(false)} onElegir={(id) => { setEligiendo(false); onReferente(id); }} />}
      {k.conectando && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { k.setConectando(false); k.mirarSuIA(); }} ancho={640}>
          <TusCuentasIA sinCabecera conectar />
        </Modal>
      )}
    </>
  );
}

/** Lo guardado, en vez del chat: lo que el CRM o el Dashboard pueden leer, y lo que la persona retoma en tres semanas. */
function VistaDelPlan({ plan }: { plan: PlanFunnel }) {
  return (
    <article className="fc-plan">
      <dl className="fc-plan__datos">
        {lineasDelPlan(plan).map((l) => <div key={l.rotulo}><dt>{l.rotulo}</dt><dd>{l.valor}</dd></div>)}
      </dl>
      {plan.porque && <p className="fc-plan__porque">{plan.porque}</p>}
      {plan.pasos.length > 0 && <ol className="fc-plan__pasos">{plan.pasos.map((p) => <li key={p}>{p}</li>)}</ol>}
    </article>
  );
}
