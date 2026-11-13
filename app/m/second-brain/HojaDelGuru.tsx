'use client';

// =============================================================================
// El chat con un gurú en el teléfono (3/11/2026)
// =============================================================================
// El de la computadora (app/second-brain/ChatDelReferente.tsx) en una hoja alta, con el motor de los dos (useChatDelReferente.ts): su
// conversación, su cara y su nombre en el título y en cada burbuja. ⚠️ UNA SOLA HOJA (SheetM → «Una hoja sobre otra REEMPLAZA»): su
// Second Brain, la Info de un mensaje y «Tus cuentas de IA» se abren ADENTRO, como en ChatClienteM.tsx.
// «Second Brain de <gurú>» (4/11/2026, como en la computadora): el botón va a la derecha, en la fila de «Inspirado en», el grafo ocupa
// el lugar del hilo y el mismo botón dice «Volver al chat».

import '@/app/admin/operaciones/centro.css';
import '@/app/m/operaciones/operaciones.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CUERPO_CHAT, PantallaChatM } from '@/app/m/_chat/PantallaChatM';
import { AvisoDeIA } from '@/app/m/_chat/AvisoDeIA';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { HiloMako, esRespuestaDeMaKo } from '@/app/_chat/HiloMako';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from '@/app/second-brain/PiezasCliente';
import { BotonSecondBrainDe, CerebroDelGuru, rotuloSecondBrain } from '@/app/second-brain/SuSecondBrain';
import { useChatDelReferente } from '@/app/second-brain/useChatDelReferente';
import { inspiradoEn, type Asesor } from '@/lib/asesores/catalogo';

export function HojaDelGuru({ referente: r, onCerrar }: { referente: Asesor; onCerrar: () => void }) {
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  const { k, aspecto, quien, vacio, saludo } = useChatDelReferente(r, caja);
  const [viendoCerebro, setViendoCerebro] = useState(false);
  // La hoja mide su cuerpo después del primer pintado: se baja en el cuadro siguiente (el mismo cuidado que ChatClienteM.tsx).
  const seguirHoja = useCallback(() => hilo.current?.closest(CUERPO_CHAT) as HTMLElement | null, []);
  useEffect(() => {
    const t = setTimeout(() => { const el = seguirHoja(); if (el) el.scrollTop = el.scrollHeight; }, 80);
    return () => clearTimeout(t);
  }, [k.items.length, k.trabajo, viendoCerebro, seguirHoja]);

  const panel = k.conectando ? 'conectar' : k.infoWA ? 'info' : viendoCerebro ? 'cerebro' : null;
  const volverDelPanel = () => { if (k.conectando) { k.setConectando(false); k.mirarSuIA(); } k.setInfoWA(null); setViendoCerebro(false); };
  const estado = estadoDelCliente(k);

  return (
    <>
      <PantallaChatM abierto onCerrar={onCerrar} id={`guru-${r.id}`}
        aviso={panel ? undefined : <AvisoDeIA app={k.app} iaConectada={k.iaConectada} onConectar={() => k.setConectando(true)} />}
        titulo={panel === 'conectar' ? 'Tus cuentas de IA' : panel === 'info' ? 'Info del mensaje' : panel === 'cerebro' ? rotuloSecondBrain(r, false) : (
          <span className="m-operaciones-titulo">
            <span className="m-operaciones-titulo__muneco"><Muneco titulo={r.nombre} aspecto={aspecto} animo={k.enCurso ? 'trabajando' : 'despierto'} size={34} /></span>
            <span className="m-operaciones-titulo__texto"><span className="m-operaciones-titulo__nombre">{r.nombre}</span></span>
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
            <span aria-hidden>‹</span> {r.nombre}
          </button>
        )}
        {panel === 'info' && k.infoWA && <InfoMensaje m={k.infoWA} />}
        {panel === 'conectar' && <TusCuentasIA sinCabecera conectar />}
        {panel === 'cerebro' && (
          <>
            <div className="m-operaciones-guru">
              <span className="co-cab__inspirado">{inspiradoEn(r)}</span>
              <BotonSecondBrainDe referente={r} viendo onCambiar={() => setViendoCerebro(false)} />
            </div>
            <div className="m-operaciones-cerebro"><CerebroDelGuru referente={r} movil /></div>
          </>
        )}
        {!panel && (
          <div className="m-operaciones-hilo" ref={hilo}>
            <div className="m-operaciones-cabeza">
              <div className="m-operaciones-guru">
                <span className="co-cab__inspirado">{inspiradoEn(r)}</span>
                <BotonSecondBrainDe referente={r} viendo={false} onCambiar={setViendoCerebro} />
              </div>
              <div className="m-operaciones-fijados">
                <BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={r.nombre} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />
              </div>
            </div>
            {vacio ? (
              <HiloMako items={saludo} quien={quien} ahora={k.ahora} escribiendo={null} tarjeta={null}
                onTarjeta={() => {}} onReintentar={() => {}} onRecargar={k.recargar} onResponder={(t) => k.enviar(t)} />
            ) : <HiloDelCliente k={k} />}
          </div>
        )}
      </PantallaChatM>
      <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} reportable={esRespuestaDeMaKo} />
    </>
  );
}
