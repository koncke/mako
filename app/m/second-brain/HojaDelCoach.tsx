'use client';

// =============================================================================
// El Funnel Coach en el teléfono (4/11/2026)
// =============================================================================
// Martín (4/11/2026): «Junta a "Offer coach" con "Funnel Coach", que se quede solo "Funnel coach" y que tenga ambas funcionalidades
// dentro... Por defecto, que esté la cara de hormozi». El de la computadora (app/second-brain/ChatDelCoach.tsx) en una hoja alta, con el
// motor de los dos (app/second-brain/useChatDelCoach.ts): su conversación, la cara de quien aconseja, la oferta y después el funnel.
// ⚠️ UNA SOLA HOJA (SheetM → «Una hoja sobre otra REEMPLAZA»): el plan, su Second Brain, la Info de un mensaje, «Tus cuentas de IA» y
// elegir quién aconseja se abren ADENTRO, con su «‹», como en HojaDelGuru.tsx.

import '@/app/admin/operaciones/centro.css';
import '@/app/m/operaciones/operaciones.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SheetM } from '@/app/m/_ui';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { HiloMako, esRespuestaDeMaKo } from '@/app/_chat/HiloMako';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from '@/app/second-brain/PiezasCliente';
import { BotonSecondBrainDe, CerebroDelGuru, rotuloSecondBrain } from '@/app/second-brain/SuSecondBrain';
import { VistaDelPlan } from '@/app/second-brain/VistaDelPlan';
import { useChatDelCoach } from '@/app/second-brain/useChatDelCoach';
import { ASPECTO_MAKO, aspectoDeReferente } from '@/lib/centro-munecos';
import { ORIGEN_FUNNEL_COACH } from '@/lib/chat-mako-reglas';
import { ASESORES, inspiradoEn, type IdAsesor } from '@/lib/asesores/catalogo';
import type { OfertaDelCoach } from '@/lib/funnel-plan';

export function HojaDelCoach({ referente, oferta, puedeElegir, onReferente, onCerrar }: {
  referente: IdAsesor | null;
  /** Con qué oferta abre (lib/funnel-plan.ts → `ofertaDelCoach`); null = todavía no se sabe. */
  oferta: OfertaDelCoach | null;
  /** Quién aconseja es del negocio: sólo su admin lo cambia. */
  puedeElegir: boolean;
  onReferente: (id: IdAsesor | null) => void;
  onCerrar: () => void;
}) {
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  const { k, r, aspecto, quien, vacio, saludo, plan } = useChatDelCoach({ referente, oferta, caja });
  const [vista, setVista] = useState<'plan' | 'cerebro' | 'elegir' | null>(null);
  // La hoja mide su cuerpo después del primer pintado: se baja en el cuadro siguiente (el mismo cuidado que HojaDelGuru.tsx).
  const seguirHoja = useCallback(() => hilo.current?.closest('.m-sheet__cuerpo') as HTMLElement | null, []);
  useEffect(() => {
    const t = setTimeout(() => { const el = seguirHoja(); if (el) el.scrollTop = el.scrollHeight; }, 80);
    return () => clearTimeout(t);
  }, [k.items.length, k.trabajo, vista, seguirHoja]);

  const panel = k.conectando ? 'conectar' : k.infoWA ? 'info' : vista === 'cerebro' && r ? 'cerebro' : vista === 'plan' && plan ? 'plan' : vista === 'elegir' ? 'elegir' : null;
  const volverDelPanel = () => { if (k.conectando) { k.setConectando(false); k.mirarSuIA(); } k.setInfoWA(null); setVista(null); };
  const estado = estadoDelCliente(k);
  const titulo = panel === 'conectar' ? 'Tus cuentas de IA' : panel === 'info' ? 'Info del mensaje' : panel === 'cerebro' && r ? rotuloSecondBrain(r, false)
    : panel === 'plan' ? 'Tu plan' : panel === 'elegir' ? 'Quién aconseja' : null;

  return (
    <>
      <SheetM abierto onCerrar={onCerrar} snap="alto" id="funnel-coach"
        titulo={titulo ?? (
          <span className="m-operaciones-titulo">
            <button type="button" className="m-operaciones-titulo__muneco" disabled={!puedeElegir} aria-label="Elegir quién aconseja" onClick={() => setVista('elegir')}>
              <Muneco titulo={r?.nombre ?? 'MaKo'} aspecto={aspecto} animo={k.enCurso ? 'trabajando' : 'despierto'} size={34} />
            </button>
            <span className="m-operaciones-titulo__texto"><span className="m-operaciones-titulo__nombre">{ORIGEN_FUNNEL_COACH}</span></span>
          </span>
        )}
        pie={panel ? undefined : (
          <div className="m-operaciones-caja">
            <CajaDelCliente k={k} campo={caja} seguir={seguirHoja} movil />
            {estado && <div className="m-operaciones-caja__fila m-operaciones-caja__fila--meta"><span className="m-operaciones-caja__estado">{estado}</span></div>}
          </div>
        )}>
        {panel && panel !== 'cerebro' && (
          <button type="button" className="m-operaciones-volver" onClick={volverDelPanel}>
            <span aria-hidden>‹</span> {ORIGEN_FUNNEL_COACH}
          </button>
        )}
        {panel === 'info' && k.infoWA && <InfoMensaje m={k.infoWA} />}
        {panel === 'conectar' && <TusCuentasIA sinCabecera conectar />}
        {panel === 'plan' && plan && <VistaDelPlan plan={plan} />}
        {panel === 'elegir' && (
          // Elegir quién aconseja, ADENTRO de la hoja (una sola hoja): la lista de la computadora (ElegirReferente.tsx), en filas.
          <div className="m-operaciones-elegir" role="radiogroup" aria-label="Quién aconseja">
            {[null, ...ASESORES.map((a) => a.id)].map((id) => {
              const a = ASESORES.find((x) => x.id === id) ?? null;
              return (
                <button key={id ?? 'mako'} type="button" role="radio" aria-checked={referente === id} className="co-elegir__mosaico co-elegir__mosaico--referente"
                  onClick={() => { onReferente(id); setVista(null); }}>
                  <Muneco titulo={a?.nombre ?? 'MaKo'} animo="despierto" size={40} aspecto={a ? aspectoDeReferente(a.id) : ASPECTO_MAKO} />
                  <span>{a?.nombre ?? 'MaKo'}{a && <small>{a.especialidad}</small>}</span>
                </button>
              );
            })}
          </div>
        )}
        {panel === 'cerebro' && r && (
          <>
            <div className="m-operaciones-guru">
              <span className="co-cab__inspirado">{inspiradoEn(r)}</span>
              <BotonSecondBrainDe referente={r} viendo onCambiar={() => setVista(null)} />
            </div>
            <div className="m-operaciones-cerebro"><CerebroDelGuru referente={r} movil /></div>
          </>
        )}
        {!panel && (
          <div className="m-operaciones-hilo" ref={hilo}>
            <div className="m-operaciones-cabeza">
              <div className="m-operaciones-guru">
                {r && <span className="co-cab__inspirado">{inspiradoEn(r)}</span>}
                {plan && <button type="button" className="co-chip" onClick={() => setVista('plan')}>Ver el plan</button>}
                {r && <BotonSecondBrainDe referente={r} viendo={false} onCambiar={(si) => setVista(si ? 'cerebro' : null)} />}
              </div>
              <div className="m-operaciones-fijados">
                <BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={ORIGEN_FUNNEL_COACH} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />
              </div>
            </div>
            {vacio ? (
              <HiloMako items={saludo} quien={quien} ahora={k.ahora} escribiendo={null} tarjeta={null}
                onTarjeta={() => {}} onReintentar={() => {}} onRecargar={k.recargar} onResponder={(t) => k.enviar(t)} />
            ) : <HiloDelCliente k={k} />}
          </div>
        )}
      </SheetM>
      <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} reportable={esRespuestaDeMaKo} />
    </>
  );
}
