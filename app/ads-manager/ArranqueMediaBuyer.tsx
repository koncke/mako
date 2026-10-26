'use client';

// =============================================================================
// Media Buyer — el arranque: una charla con MaKo, como Offer (25/10/2026)
// =============================================================================
// Martín, 25/10/2026 ~18:50: «en el onboarding, me imagino a la calculadora que hicimos para saber cuanto invertir, todo con
// el chat de MaKo, como Offer». Una cuenta nueva no ve tarjetas en cero: ve esta charla (la de AdAmigo-2, «What can I help
// you with today?», con la conversación de Offer). Las piezas son LAS de Offer y del Ops Center, no unas propias: el hilo es
// `HiloMako` con los mensajes pasados por `itemsDeOffer`, las respuestas rápidas son las pastillas de Offer (`.of-pill`, al
// final del hilo) y la caja es la única de la app (`CajaChat`; tests/chat-unico.test.ts). Lo que va DENTRO de un mensaje de
// MaKo (el botón de conectar, la tarjeta de la calculadora) va por `enMensaje`, como las tarjetas del onboarding. El marco
// es el panel único (PanelChat.tsx → PanelDeChat: la cabecera con la estrella de MaKo), y sin la app de escritorio la caja se
// bloquea como en todo chat (useAppDeEscritorio); las respuestas rápidas siguen andando, y alcanzan para terminar.
// La lógica (qué paso toca, qué se pregunta, qué se guarda) es pura: lib/media-buyer/arranque.ts.
// Lo que se escribe en la caja y no es la respuesta del paso (una pregunta suelta) va al Cerebro, como todo chat de la app.
// =============================================================================

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CajaChat } from '@/app/_chat/CajaChat';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import '@/app/admin/operaciones/centro.css';
import { HiloMako, type EnMensaje } from '@/app/_chat/HiloMako';
import { ConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import { CSS_OFFER } from '@/app/offer/estilos';
import { fmtDinero, fmtNum } from '@/lib/format';
import { itemsDeOffer } from '@/app/m/mako/chat-ui';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { calcularPresupuestoAds, titularDelPlan, type PlanCalculadora } from '@/lib/calculadora-presupuesto-ads';
import {
  TRAMOS, configDelArranque, entradaDelArranque, leerRespuesta, mensajesDeArranque, pasoDeArranque, tramoDe,
  type ProductoArranque, type RespuestasArranque,
} from '@/lib/media-buyer/arranque';
import type { ConfigMediaBuyer } from '@/lib/media-buyer/tipos';

const nada = () => {};
const us = (n: number) => fmtDinero(n);

export function ArranqueMediaBuyer({ nombre, conectada, cuenta, productos, costoMedido, cierreMedido, avatares, funcionalidades, inicial, pilotoPermitido, onConectado, onGuardar, onTerminar, onPreguntar }: {
  nombre: string;
  conectada: boolean;
  /** La cuenta publicitaria que ya se sabe (para el link de conectar). */
  cuenta: string | null;
  productos: ProductoArranque[];
  costoMedido: number | null;
  cierreMedido: number | null;
  avatares: number;
  funcionalidades: number;
  inicial: RespuestasArranque;
  onConectado: () => void;
  /** Guarda lo respondido (para seguir donde quedó si se va y vuelve). */
  onGuardar: (r: RespuestasArranque) => void;
  /** El último paso: la config del Media Buyer y mirar la cuenta. */
  /** Si el plan del negocio trae el piloto automático: sin él, el modo no se ofrece (cupoDe → piloto). */
  pilotoPermitido: boolean;
  /** Guarda la config del arranque; false = no se pudo (la charla vuelve a preguntar el modo, en vez de quedar en «listo»). */
  onTerminar: (cambio: Partial<ConfigMediaBuyer>) => Promise<boolean>;
  /** Lo que no es la respuesta del paso va al Cerebro (el chat de MaKo de la tab). */
  onPreguntar: (texto: string) => void;
}) {
  const [r, setR] = useState<RespuestasArranque>(inicial);
  const [texto, setTexto] = useState('');
  const [terminando, setTerminando] = useState(false);
  const [ahora] = useState(() => Date.now());
  const hilo = useRef<HTMLDivElement>(null);
  const appEscritorio = useAppDeEscritorio();
  const x = { nombre, conectada, r, productos, costoMedido, pilotoPermitido };
  const paso = pasoDeArranque(x);
  const mensajes = useMemo(() => mensajesDeArranque({ nombre, conectada, r, productos, costoMedido, pilotoPermitido }), [nombre, conectada, r, productos, costoMedido, pilotoPermitido]);
  const items = useMemo(() => itemsDeOffer(mensajes).filter((m) => m.k !== 'bloque'), [mensajes]);
  const ultimo = mensajes[mensajes.length - 1];
  const opciones = ultimo?.de === 'mako' ? ultimo.opciones ?? [] : [];
  // Lo último a la vista, como en Offer: cada respuesta trae la pregunta que sigue.
  useLayoutEffect(() => { const h = hilo.current; if (h) h.scrollTop = h.scrollHeight; }, [items.length, terminando]);
  const tramo = tramoDe(paso);

  const entrada = entradaDelArranque(r, costoMedido, cierreMedido, avatares, funcionalidades);
  const plan = useMemo<PlanCalculadora | null>(() => {
    if (!entrada) return null;
    const p = calcularPresupuestoAds(entrada);
    return p.ok ? p : null;
  }, [entrada?.presupuesto, entrada?.costoPorResultado, entrada?.ticket, entrada?.evento, entrada?.cierre, entrada?.avatares, entrada?.funcionalidades]); // eslint-disable-line react-hooks/exhaustive-deps

  const responder = (t: string): boolean => {
    const cambio = leerRespuesta(paso, t, { productos, r, costoMedido, pilotoPermitido });
    if (!cambio) return false;
    const sig: RespuestasArranque = { ...r, ...cambio };
    for (const [k, v] of Object.entries(cambio)) if (v === undefined) delete (sig as Record<string, unknown>)[k];
    setR(sig);
    onGuardar(sig);
    if (pasoDeArranque({ ...x, r: sig }) === 'listo') {
      setTerminando(true);
      void onTerminar(configDelArranque(sig, plan)).then((ok) => {
        if (ok) return;
        // No se guardó (el plan, la red): se saca el modo y vuelve su pregunta, con el aviso del error en pantalla.
        const sinModo: RespuestasArranque = { ...sig };
        delete sinModo.modo;
        setR(sinModo);
        onGuardar(sinModo);
      }).finally(() => setTerminando(false));
    }
    return true;
  };

  const enMensaje = (m: { id: string }): EnMensaje | null => {
    if (m.id === 'of-mb-cuenta' && !conectada) {
      return { abajo: <div style={{ marginTop: 10 }}><ConectarViaZernio red="metaads" volver="/ads-manager" adAccountId={cuenta} onConectado={onConectado}>Conectar con Facebook</ConectarViaZernio></div> };
    }
    if (m.id === 'of-mb-plan' && plan && entrada) return { abajo: <TarjetaPlan plan={plan} costo={entrada.costoPorResultado} supuesto={!!r.costo?.supuesto} kpi={r.kpi ?? 'lead'} /> };
    return null;
  };

  return (
    <div className="aa-arranque">
      <style>{CSS_OFFER}</style>
      {/* La bienvenida de AdAmigo («New Chat · What can I help you with today?») y los tramos que faltan. */}
      <header className="aa-arranque-cab">
        <h1>Tu media buyer</h1>
        <ol className="aa-tramos" aria-label="Para empezar">
          {TRAMOS.map((t, i) => <li key={t} data-estado={i < tramo ? 'hecho' : i === tramo ? 'ahora' : 'falta'}><span aria-hidden>{i < tramo ? '✓' : i + 1}</span>{t}</li>)}
        </ol>
      </header>
      <div className="aa-arranque-hilo">
        <PanelDeChat hilo={hilo} estado=""
          cabecera={{ clave: 'media-buyer-arranque', titulo: 'MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO, animo: terminando ? 'trabajando' : 'despierto' }}
          caja={
            <div className="co-caja">
              <CajaChat texto={texto} onTexto={setTexto} placeholder="Escríbele a MaKo" enterManda ocupado={terminando} bloqueo={appEscritorio.bloqueo}
                onMandar={() => {
                  const t = texto.trim();
                  if (!t) return;
                  if (!responder(t)) onPreguntar(t);
                  setTexto('');
                }} />
            </div>
          }>
          <HiloMako items={items} quien={{ nombre: 'MaKo', aspecto: ASPECTO_MAKO }} ahora={ahora} escribiendo={terminando ? { segs: 1 } : null}
            tarjeta={null} onTarjeta={nada} onReintentar={nada} onRecargar={nada} enMensaje={enMensaje} />
          {opciones.length > 0 && (
            <div role="group" aria-label="Respuestas rápidas" className="aa-rapidas">
              {opciones.map((t) => <button key={t} type="button" className="of-pill" disabled={terminando} onClick={() => responder(t)}>{t}</button>)}
            </div>
          )}
        </PanelDeChat>
      </div>
    </div>
  );
}

/** La tarjeta de la calculadora, adentro del mensaje de MaKo: lo que compra la inversión y cómo la reparte. */
function TarjetaPlan({ plan, costo, supuesto, kpi }: { plan: PlanCalculadora; costo: number; supuesto: boolean; kpi: 'lead' | 'agenda' | 'venta' }) {
  const res = kpi === 'venta' ? 'ventas' : kpi === 'agenda' ? 'agendas' : 'leads';
  const uno = kpi === 'venta' ? 'venta' : kpi === 'agenda' ? 'agenda' : 'lead';
  const diario = Math.round((plan.testeo.gasto + plan.escala.gasto) / Math.max(1, plan.testeo.dias + plan.escala.dias));
  const celdas: Array<[string, string]> = [
    ['Por día', us(diario)],
    [`${res[0].toUpperCase()}${res.slice(1)} al mes`, `~${fmtNum(plan.resultados)}`],
    ['Ventas', `~${fmtNum(plan.ventas)}`],
    ['Retorno', plan.roas > 0 ? `${plan.roas.toLocaleString('es-MX', { maximumFractionDigits: 1 })}x` : '—'],
  ];
  return (
    <div className="aa-calc">
      <div className="aa-calc-grid">{celdas.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
      <p><b>La primera semana:</b> pruebo {titularDelPlan(plan).toLowerCase()} y me quedo con lo que trae {res} más baratos.</p>
      <p className="aa-calc-nota">Con un {uno} a {us(costo)}{supuesto ? ' (supuesto: lo ajusto con tus datos)' : ''}.</p>
    </div>
  );
}
