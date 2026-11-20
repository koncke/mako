'use client';

// =============================================================================
// El Funnel Coach en el teléfono (4/11/2026)
// =============================================================================
// Martín (4/11/2026): «Junta a "Offer coach" con "Funnel Coach", que se quede solo "Funnel coach" y que tenga ambas funcionalidades
// dentro... Por defecto, que esté la cara de hormozi». El de la computadora (app/second-brain/ChatDelCoach.tsx) en una hoja alta, con el
// motor de los dos (app/second-brain/useChatDelCoach.ts): su conversación, la cara de quien aconseja, la oferta y después el funnel.
// ⚠️ UNA SOLA HOJA (SheetM → «Una hoja sobre otra REEMPLAZA»): el plan, su Second Brain, la Info de un mensaje, «Tus cuentas de IA» y
// elegir quién aconseja se abren ADENTRO, con su «‹», como en HojaDelGuru.tsx.
// CON EL ONBOARDING V2 (18/11/2026, `dosCoaches`): la misma hoja es cualquiera de los dos coaches (`cual`), como en la computadora
// (app/second-brain/ChatDelCoach.tsx): el Offer Coach con quien aconseja, el Funnel Coach con su criatura y sin elegir referente.
// Y desde el 19/11/2026, lo mismo que la computadora: LA VOZ de los coaches debajo de cada mensaje (`vozDelCoach`) y el Offer Coach con
// el MOTOR DE OFFER (su conversación de Offer, su presentación arriba hasta que la persona escribe, y la oferta en UN mensaje).

import '@/app/admin/operaciones/centro.css';
import '@/app/m/operaciones/operaciones.css';
import { useCallback, useRef, useState } from 'react';
import { useBajarAlUltimo } from '@/app/_chat/useBajarAlUltimo';
import { CUERPO_CHAT, PantallaChatM } from '@/app/m/_chat/PantallaChatM';
import { AvisoDeIA } from '@/app/m/_chat/AvisoDeIA';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { CandadoSoloPro } from '@/app/_components/CandadoSoloPro';
import { useSoloPro } from '@/app/_components/solo-pro';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { HiloMako, esRespuestaDeMaKo } from '@/app/_chat/HiloMako';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from '@/app/second-brain/PiezasCliente';
import { BotonSecondBrainDe, CerebroDelGuru, rotuloSecondBrain } from '@/app/second-brain/SuSecondBrain';
import { VistaDelPlan } from '@/app/second-brain/VistaDelPlan';
import { useChatDelCoach } from '@/app/second-brain/useChatDelCoach';
import { ASPECTO_MAKO, aspectoDeReferente } from '@/lib/centro-munecos';
import type { CoachDelOps } from '@/lib/chat-mako-reglas';
import { useVideoDelCoach } from '@/app/second-brain/VideoDelCoach';
import { ASESORES, inspiradoEn, type IdAsesor } from '@/lib/asesores/catalogo';
import { ErrorDelOfferCoach, useHiloDelCoach, useOfertaEnMensaje, vozDelCoach } from '@/app/second-brain/coach-compartido';
import type { OfertaDelCoach } from '@/lib/funnel-plan';

export function HojaDelCoach({ referente, oferta, puedeElegir, onReferente, onCerrar, cual = 'funnel', dosCoaches = false }: {
  referente: IdAsesor | null;
  /** Con qué oferta abre (lib/funnel-plan.ts → `ofertaDelCoach`); null = todavía no se sabe. */
  oferta: OfertaDelCoach | null;
  /** Quién aconseja es del negocio: sólo su admin lo cambia. */
  puedeElegir: boolean;
  onReferente: (id: IdAsesor | null) => void;
  onCerrar: () => void;
  /** Qué coach: sin el V2, siempre el Funnel Coach. */
  cual?: CoachDelOps;
  /** El onboarding V2: los dos coaches separados (lo dice el servidor, app/second-brain/useCoaches.ts → `dosCoaches`). */
  dosCoaches?: boolean;
}) {
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  const { k, r, aspecto, quien, vacio, saludo, plan, titulo: nombre, tab, motorOffer, errorOffer, reintentarOffer } = useChatDelCoach({ referente, oferta, caja, cual, dosCoaches });
  const portada = useVideoDelCoach(cual, dosCoaches, saludo);
  // La voz (sólo con los dos coaches, como en la computadora) y, con el motor de Offer, la portada arriba de su conversación y la
  // oferta armada en su mensaje (en el teléfono, «Descargar PDF» baja directo: ver app/second-brain/OfertaEnElChat.tsx).
  const conVoz = vozDelCoach(k.items);
  // El mismo hilo que la computadora (20/11, V7, V12, F4; app/second-brain/coach-compartido.tsx → useHiloDelCoach).
  const deLaOferta = useOfertaEnMensaje(motorOffer ? k.sesionOffer : null, () => caja.current?.focus(), true);
  const { hilo: hiloCoach, enMensaje: enMensajeDelHilo } = useHiloDelCoach({ k, cual, dosCoaches, plan, motorOffer, portada, conVoz, deLaOferta });
  // El Funnel Coach del V2 no tiene referente al frente: su criatura no elige.
  const eligeReferente = puedeElegir && !(dosCoaches && cual === 'funnel');
  // Hablar con un referente es de MaKo Pro (14/11/2026, 'chat-referentes'): acá sólo decide qué se ve al elegir quién aconseja. El
  // referente ya llega en null con el candado (app/second-brain/useCoaches.ts), así que `r` es null y no hay «Second Brain de X».
  const soloPro = useSoloPro('chat-referentes');
  const [vista, setVista] = useState<'plan' | 'cerebro' | 'elegir' | null>(null);
  // La hoja mide su cuerpo después del primer pintado (el mismo cuidado que HojaDelGuru.tsx): el hook se engancha cuando está.
  const seguirHoja = useCallback(() => hilo.current?.closest(CUERPO_CHAT) as HTMLElement | null, []);
  // SIEMPRE AL ÚLTIMO MENSAJE (Martín, 20/11): con cada mensaje y cuando lo último crece (un video, una imagen o una tarjeta que
  // cargan después); si subió a leer, lo que crece no la arrastra (app/_chat/useBajarAlUltimo.ts).
  useBajarAlUltimo(seguirHoja, `${hiloCoach.items[hiloCoach.items.length - 1]?.id ?? ''}|${k.trabajo ? 'trabaja' : ''}|${vista}`);

  const panel = k.conectando ? 'conectar' : k.infoWA ? 'info' : vista === 'cerebro' && r ? 'cerebro' : vista === 'plan' && plan ? 'plan' : vista === 'elegir' ? 'elegir' : null;
  const volverDelPanel = () => { if (k.conectando) { k.setConectando(false); k.mirarSuIA(); } k.setInfoWA(null); setVista(null); };
  const estado = estadoDelCliente(k);
  const titulo = panel === 'conectar' ? 'Tus cuentas de IA' : panel === 'info' ? 'Info del mensaje' : panel === 'cerebro' && r ? rotuloSecondBrain(r, false)
    : panel === 'plan' ? 'Tu plan' : panel === 'elegir' ? 'Quién aconseja' : null;

  return (
    <>
      <PantallaChatM abierto onCerrar={onCerrar} id={tab}
        aviso={panel ? undefined : <AvisoDeIA app={k.app} iaConectada={k.iaConectada} onConectar={() => k.setConectando(true)} />}
        titulo={titulo ?? (
          <span className="m-operaciones-titulo">
            <button type="button" className="m-operaciones-titulo__muneco" disabled={!eligeReferente} aria-label="Elegir quién aconseja" onClick={() => setVista('elegir')}>
              <Muneco titulo={quien.nombre} aspecto={aspecto} animo={k.enCurso ? 'trabajando' : 'despierto'} size={34} />
            </button>
            <span className="m-operaciones-titulo__texto"><span className="m-operaciones-titulo__nombre">{nombre}</span></span>
          </span>
        )}
        pie={panel ? undefined : (
          <div className="m-operaciones-caja">
            <CajaDelCliente k={k} campo={caja} seguir={seguirHoja} movil avisosArriba />
            {estado && <div className="m-operaciones-caja__fila m-operaciones-caja__fila--meta"><span className="m-operaciones-caja__estado">{estado}</span></div>}
          </div>
        )}>
        {panel && panel !== 'cerebro' && (
          <button type="button" className="m-operaciones-volver" onClick={volverDelPanel}>
            <span aria-hidden>‹</span> {nombre}
          </button>
        )}
        {panel === 'info' && k.infoWA && <InfoMensaje m={k.infoWA} />}
        {panel === 'conectar' && <TusCuentasIA sinCabecera conectar />}
        {panel === 'plan' && plan && <VistaDelPlan plan={plan} />}
        {/* SÓLO MaKo Pro poner a un referente al frente (14/11/2026, lib/asesores/candado.ts): el candado en lugar de la lista, como
            en la computadora (app/second-brain/ElegirReferente.tsx). El coach sigue abierto en los dos planes; el servidor ya lo corre
            sin la ficha de nadie (app/api/mako/chat/route.ts → `contextoDelChat`), y una lista que no cambia nada mentiría. */}
        {panel === 'elegir' && soloPro && <div className="m-operaciones-elegir"><CandadoSoloPro funcion="chat-referentes" /></div>}
        {panel === 'elegir' && !soloPro && (
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
                <BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={nombre} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />
              </div>
            </div>
            {motorOffer && errorOffer ? <ErrorDelOfferCoach error={errorOffer} onReintentar={reintentarOffer} />
              : vacio ? (
                <HiloMako items={portada.items} quien={quien} ahora={k.ahora} escribiendo={null} tarjeta={null} enMensaje={dosCoaches ? conVoz(true, portada.enMensaje as never) : portada.enMensaje}
                  onTarjeta={() => {}} onReintentar={() => {}} onRecargar={k.recargar} onResponder={(t) => k.enviar(t)} />
              ) : <HiloDelCliente k={hiloCoach} enMensaje={enMensajeDelHilo} />}
          </div>
        )}
      </PantallaChatM>
      <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} reportable={esRespuestaDeMaKo} />
    </>
  );
}
