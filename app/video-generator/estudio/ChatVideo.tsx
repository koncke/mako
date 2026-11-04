'use client';

// =============================================================================
// El chat de MaKo al costado del estudio de video (27/10/2026)
// =============================================================================
// Martín: «implementar Video Generator… que se parezca a una app que tomemos de referencia» y el chat al costado «como Web
// Generator». ES EL CHAT ÚNICO DE LA APP, sin una pieza propia (AGENTS.md, «EL CHAT DE MaKo SON TRES PIEZAS JUNTAS»):
//   · el PANEL (app/admin/operaciones/PanelChat.tsx → PanelDeChat), el HILO (HiloMako por HiloDelCliente) y la CAJA
//     (CajaDelCliente): los mismos que monta el chat del Second Brain (app/second-brain/ChatDelSecondBrain.tsx), de donde se
//     copió este archivo;
//   · el MOTOR es el del Ops Center (useChatCliente → /api/mako/chat → turnoApp): MaKo hace lo de esta tab con las
//     operaciones del registro (lib/api-mako/areas/video.def.ts y video-estudio.def.ts), las mismas que corren los botones;
//   · SU HILO ES SUYO: una conversación por persona y negocio (`mako-movil:<persona>:video-generator`, lib/chat-mako-reglas.ts
//     → TAB_VIDEO_GENERATOR), que el Ops Center lista en el grupo «Video Generator»;
//   · DESDE DÓNDE: la tab y el anuncio abierto (lib/chat-desde.ts → `anuncio`, con su `planId`): «filmá la toma 2» es de ÉSE.
// ⚠️ Trae CSS (las piezas del Ops Center): EstudioVideo.tsx lo carga con next/dynamic.
// =============================================================================

import '@/app/admin/operaciones/centro.css';
import '@/app/_chat/chat.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/app/_ui';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { HiloMako, esRespuestaDeMaKo } from '@/app/_chat/HiloMako';
import { useChatCliente } from '@/app/second-brain/useChatCliente';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from '@/app/second-brain/PiezasCliente';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { TAB_VIDEO_GENERATOR, type ElegidoChat } from '@/lib/chat-mako-reglas';
import type { Desde } from '@/lib/chat-desde';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { SesionChat } from '@/lib/mako-turno-app-reglas';
import { arranquesDelEstudio, desdeDelEstudio, saludoDelEstudio } from './chat-reglas';

export default function ChatVideo({ abierto, onTurno, onCerrar, movil = false }: {
  /** El anuncio abierto en el centro (null = el anuncio nuevo). */
  abierto: { id: string; titulo: string } | null;
  /** Terminó un turno o se confirmó una tarjeta: el centro vuelve a leer los proyectos (lo que hizo MaKo ya está guardado). */
  onTurno: () => void;
  /** En una ventana angosta el chat es un cajón: la «×» lo cierra. Sin esto, no se cierra nunca (como el Web Generator). */
  onCerrar?: () => void;
  movil?: boolean;
}) {
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  // SU conversación, si ya habló: se lee, no se crea (la crea el primer mensaje, `tab`).
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/mako/chat?deTab=${TAB_VIDEO_GENERATOR}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { sesion?: SesionChat | null } | null) => { if (vivo) setElegido(j?.sesion ? { antes: j.sesion.id } : { virtual: 'nuevo' }); });
    return () => { vivo = false; };
  }, []);
  const desde: Desde = useMemo(() => desdeDelEstudio(abierto), [abierto]);
  // El motor del Ops Center, sin la lista (`activo: false`): acá hay UNA conversación.
  const k = useChatCliente({ elegido, setElegido, activo: false, entrarAlCerebro: false, chatInicial: null, opcionArmar: '', busca: '', caja, desde, tab: TAB_VIDEO_GENERATOR });
  const { mirarSuIA } = k;
  useEffect(() => { mirarSuIA(); }, [mirarSuIA]);
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [k.items.length, k.trabajo]);
  const seguirHilo = useCallback(() => hilo.current, []);

  // Cuando MaKo termina (un turno, o una tarjeta confirmada), el centro relee: lo que hizo ya está guardado.
  const ocupadoAntes = useRef(false);
  const ocupado = k.enCurso || k.tarjeta != null;
  useEffect(() => {
    if (ocupadoAntes.current && !ocupado) onTurno();
    ocupadoAntes.current = ocupado;
  }, [ocupado, onTurno]);

  const vacio = elegido != null && k.cargado && !k.errorCarga && !k.items.length && !k.trabajo;
  const saludo = useMemo<ItemHilo[]>(() => [{ k: 'msg', id: 'saludo-vg', role: 'assistant', texto: saludoDelEstudio(abierto), at: new Date().toISOString() }], [abierto]);

  return (
    <>
      <PanelDeChat hilo={hilo} adjuntos={k.adjuntosCaja}
        cabecera={{
          clave: TAB_VIDEO_GENERATOR, titulo: 'MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO, animo: k.enCurso ? 'trabajando' : 'despierto',
          acciones: onCerrar
            ? <button type="button" className="vgs-chat__cerrar" onClick={onCerrar} aria-label="Cerrar el chat con MaKo" title="Cerrar">×</button>
            : undefined,
        }}
        arriba={<BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo="MaKo" onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />}
        despues={<>
          <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} reportable={esRespuestaDeMaKo} />
          {k.infoWA && <Modal titulo="Info del mensaje" onCerrar={() => k.setInfoWA(null)} ancho={460}><InfoMensaje m={k.infoWA} /></Modal>}
        </>}
        caja={<div className="co-caja"><CajaDelCliente k={k} campo={caja} seguir={seguirHilo} movil={movil} angosta /></div>}
        estado={estadoDelCliente(k)}>
        {vacio ? (
          <>
            <HiloMako items={saludo} quien={{ nombre: 'MaKo', aspecto: ASPECTO_MAKO }} ahora={k.ahora} escribiendo={null} tarjeta={null}
              onTarjeta={() => {}} onReintentar={() => {}} onRecargar={k.recargar} onResponder={(t) => k.enviar(t)} />
            <div className="ch-arranques">
              {arranquesDelEstudio(abierto).map((a) => <button key={a} type="button" className="co-chip" onClick={() => k.enviar(a)}>{a}</button>)}
            </div>
          </>
        ) : <HiloDelCliente k={k} />}
      </PanelDeChat>
      {k.conectando && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { k.setConectando(false); k.mirarSuIA(); }} ancho={640}>
          <TusCuentasIA sinCabecera conectar />
        </Modal>
      )}
    </>
  );
}
