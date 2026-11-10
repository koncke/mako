'use client';

// =============================================================================
// El Marketing CoPilot en el teléfono: la conversación del Cerebro con `desde.tab = 'Marketing CoPilot'` (6/11/2026)
// =============================================================================
// En la computadora, la tab le habla al Cerebro por la estrella (MakoEnLaTab → ConversacionCerebro, `tab="Marketing CoPilot"`), y el
// servidor arma el contexto del CoPilot cuando el mensaje trae ese `desde` (app/api/mako/chat/route.ts → contextoDelCopiloto). Hasta
// hoy, «Pídele algo a MaKo» del teléfono abría /m/mako, el Second Brain SIN `desde`: el mismo pedido caía en el contexto general y MaKo
// no hablaba como CoPilot. Esta hoja es la MISMA conversación que la estrella (el Cerebro, `entrarAlCerebro`), con el mismo `desde`.
// Las piezas son las del chat del cliente (PiezasCliente: el hilo y la caja únicos) dentro de la hoja de MaKo Mobile, como la del
// Funnel Coach (app/m/second-brain/HojaDelCoach.tsx).
// ⚠️ UNA SOLA HOJA (SheetM → «una hoja sobre otra REEMPLAZA»): la Info de un mensaje y «Tus cuentas de IA» se abren ADENTRO, con su «‹».
// =============================================================================

import '@/app/admin/operaciones/centro.css';
import '@/app/m/operaciones/operaciones.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SheetM } from '@/app/m/_ui';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { esRespuestaDeMaKo } from '@/app/_chat/HiloMako';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from '@/app/second-brain/PiezasCliente';
import { useChatCliente } from '@/app/second-brain/useChatCliente';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { ORIGEN_COPILOTO, desdeDelCopiloto } from '@/lib/media-buyer/copiloto';
import type { ElegidoChat } from '@/lib/chat-mako-reglas';
import { delHiloDeLaTab } from '@/lib/chat-desde';
import { origenDelItem } from '@/app/m/mako/chat-ui';

export function HojaDelCopiloto({ pantalla = null, pedido = null, onCerrar }: {
  /** Lo que la pantalla tiene a la vista («Hoy · 3 cambios»), para el turno (Desde.pantalla). */
  pantalla?: string | null;
  /** Lo que se pidió desde la pantalla (una tarjeta: «Explícame…»): sale solo apenas el Cerebro está abierto y libre. */
  pedido?: { texto: string; vez: number } | null;
  onCerrar: () => void;
}) {
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  const desde = useMemo(() => desdeDelCopiloto(pantalla), [pantalla]);
  // Siempre el Cerebro, como la estrella de la computadora: al llegar la lista lo elige solo. Se NOMBRA «MaKo» (como la tarjeta de
  // Create, ConversacionCerebro → `titulo`): la caja dice «Escribe a MaKo» y no «Escribe a Ops Center» adentro del CoPilot.
  const base = useChatCliente({ elegido, setElegido, activo: true, entrarAlCerebro: true, chatInicial: null, opcionArmar: '', busca: '', caja, desde });
  // Y sólo la charla del CoPilot (10/11/2026, lib/chat-desde.ts → delHiloDeLaTab): lo de Image o del CRM no va en esta hoja.
  const items = useMemo(() => delHiloDeLaTab(base.items, ORIGEN_COPILOTO, origenDelItem), [base.items]);
  const k = { ...base, items, nombre: 'MaKo' };
  // El pedido sale una vez, cuando el Cerebro está abierto, cargado y libre (`enviar` dice si salió), como ConversacionCerebro.
  const mandado = useRef<number | null>(null);
  useEffect(() => {
    if (!pedido || mandado.current === pedido.vez || !k.esJefe) return;
    if (k.enviar(pedido.texto)) mandado.current = pedido.vez;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, k.esJefe, k.cargado, k.trabajo]);

  // La hoja mide su cuerpo después del primer pintado: se baja en el cuadro siguiente (el mismo cuidado que HojaDelCoach.tsx).
  const seguirHoja = useCallback(() => hilo.current?.closest('.m-sheet__cuerpo') as HTMLElement | null, []);
  useEffect(() => {
    const t = setTimeout(() => { const el = seguirHoja(); if (el) el.scrollTop = el.scrollHeight; }, 80);
    return () => clearTimeout(t);
  }, [k.items.length, k.trabajo, seguirHoja]);

  const panel = k.conectando ? 'conectar' : k.infoWA ? 'info' : null;
  const volverDelPanel = () => { if (k.conectando) { k.setConectando(false); k.mirarSuIA(); } k.setInfoWA(null); };
  const estado = estadoDelCliente(k);

  return (
    <>
      <SheetM abierto onCerrar={onCerrar} snap="alto" id="marketing-copilot"
        titulo={panel === 'conectar' ? 'Tus cuentas de IA' : panel === 'info' ? 'Info del mensaje' : (
          <span className="m-operaciones-titulo">
            <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo={k.enCurso ? 'trabajando' : 'despierto'} size={34} />
            <span className="m-operaciones-titulo__texto"><span className="m-operaciones-titulo__nombre">{ORIGEN_COPILOTO}</span></span>
          </span>
        )}
        pie={panel ? undefined : (
          <div className="m-operaciones-caja">
            <CajaDelCliente k={k} campo={caja} seguir={seguirHoja} movil />
            {estado && <div className="m-operaciones-caja__fila m-operaciones-caja__fila--meta"><span className="m-operaciones-caja__estado">{estado}</span></div>}
          </div>
        )}>
        {panel && (
          <button type="button" className="m-operaciones-volver" onClick={volverDelPanel}>
            <span aria-hidden>‹</span> {ORIGEN_COPILOTO}
          </button>
        )}
        {panel === 'info' && k.infoWA && <InfoMensaje m={k.infoWA} />}
        {panel === 'conectar' && <TusCuentasIA sinCabecera conectar />}
        {!panel && (
          <div className="m-operaciones-hilo" ref={hilo}>
            <div className="m-operaciones-cabeza">
              <div className="m-operaciones-fijados">
                <BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={ORIGEN_COPILOTO} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />
              </div>
            </div>
            <HiloDelCliente k={k} />
          </div>
        )}
      </SheetM>
      <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} reportable={esRespuestaDeMaKo} />
    </>
  );
}
