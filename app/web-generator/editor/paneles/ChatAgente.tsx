'use client';

// =============================================================================
// ChatAgente — el hilo y la caja del agente del Web Generator, con las piezas del Ops Center (22/10/2026, TB3)
// =============================================================================
// Martín, 22/10: «quiero que todos los chats de MaKo en las tabs sean el del Ops Center: mismas funciones, mismo diseño».
// El agente (./PanelAgente.tsx) dibuja su conversación con `HiloMako` (con la criatura «Web Generator», la que lo nombra en el
// Ops Center) y escribe con `CajaChat`, que ya trae el «+», las miniaturas, pegar, los emojis y el micrófono. Lo que es SÓLO
// del agente —la propuesta con «Original | Modificado», las burbujas de pedidos de otra landing, un error— lo arma el panel y
// entra por el hueco `enMensaje` del hilo.
//
// ⚠️ ARCHIVO APARTE A PROPÓSITO, y el panel lo carga con `next/dynamic`: PanelAgente.tsx lo importan módulos que cargan los
//    tests (DialogoAnalitica → PanelAgente, tests/editor-landing-agente.test.ts) y estas piezas traen CSS, que en node no
//    carga (lo mismo que obligó a cargar así el «+» el 20/10).
// =============================================================================

import '@/app/admin/operaciones/centro.css';
import { CajaChat } from '@/app/_chat/CajaChat';
import type { PropsCajaChat } from '@/app/_chat/CajaChat';
import { HiloMako, type EnMensaje } from '@/app/_chat/HiloMako';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import { useEffect, type ReactNode, type RefObject } from 'react';
import { PanelDeChat, type CabeceraChat } from '@/app/admin/operaciones/PanelChat';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { AperturaMako, useApertura } from '@/app/_chat/AperturaMako';
import { SUPERFICIE_WEB, type HechosWeb } from '@/lib/aperturas/web';
import { CitaCaja } from '@/app/admin/operaciones/MensajeWA';
import type { MensajeWA } from '@/lib/centro-mensajes';

/** Quien contesta en el hilo: la estrella de MaKo (23/10/2026; antes, la criatura de la tab). */
const QUIEN = { nombre: 'MaKo', aspecto: ASPECTO_MAKO };

/**
 * EL PANEL DEL OPS CENTER (23/10/2026, Martín: «Tienes que UNIFICAR los chats con MaKo en toda la app»): la cabecera única con
 * la estrella, el arrastrar y soltar (lo adjuntado de la caja), la columna del hilo y el lugar de la caja. Vive acá, junto al
 * hilo y la caja, porque trae CSS y el panel del agente lo carga con next/dynamic.
 */
export function PanelAgenteChat({ cabecera, hilo, adjuntos, caja, children }: {
  cabecera: CabeceraChat; hilo: RefObject<HTMLDivElement | null>; adjuntos?: AdjuntosDeCaja; caja: ReactNode; children: ReactNode;
}) {
  return <PanelDeChat hilo={hilo} adjuntos={adjuntos} cabecera={cabecera} caja={caja} estado="">{children}</PanelDeChat>;
}
const nada = () => {};

export function HiloAgente({ items, corriendo, enMensaje, onCitar, onReintentar = nada, onDescartar }: {
  items: readonly ItemHilo[];
  corriendo: boolean;
  /** Una nota de voz que no se entendió (la nota en el acto, app/_chat/useNotaEnElActo.ts): otra vez, o fuera. */
  onReintentar?: (id: string) => void;
  onDescartar?: (id: string) => void;
  enMensaje: (x: Extract<ItemHilo, { k: 'msg' }>) => EnMensaje | null;
  /** «Responder» del clic derecho (24/10/2026, P5): la cita va arriba de la caja del agente. */
  onCitar?: (m: MensajeWA) => void;
}) {
  return (
    <HiloMako items={items} quien={QUIEN} ahora={Date.now()} escribiendo={corriendo ? { segs: 0 } : null}
      tarjeta={null} onTarjeta={nada} onReintentar={onReintentar} onDescartar={onDescartar} onRecargar={nada} enMensaje={enMensaje} onCitar={onCitar} />
  );
}

/** La cita de «Responder» arriba de la caja: la del Ops Center (tocarla lleva al mensaje; la ✕ la saca). */
export const CitaAgente = CitaCaja;

/** La caja única, en su marco (`.co-caja`): lo que se escribe y se adjunta lo maneja el panel por props. */
export function CajaAgente(p: PropsCajaChat) {
  return <div className="co-caja"><CajaChat {...p} /></div>;
}

/**
 * MaKo toma la iniciativa en el editor (5/11/2026, lib/aperturas/web.ts): con la página sin publicar, «¿Ya está lista para que la
 * vean?». Vive acá y no en el panel porque `AperturaMako` trae el hilo (y su CSS): el panel la carga con `next/dynamic` y sólo
 * se entera, por `onHabla`, de si está hablando (para esconder el saludo y las sugerencias).
 */
export function AperturaAgente({ hechos, libre, onPublicar, onHabla }: {
  hechos: HechosWeb; libre: boolean; onPublicar: () => void; onHabla: (habla: boolean) => void;
}) {
  const estado = useApertura({ superficie: SUPERFICIE_WEB, hechos, libre });
  const habla = !!estado.apertura;
  useEffect(() => { onHabla(habla); return () => onHabla(false); }, [habla, onHabla]);
  if (!estado.apertura) return null;
  return <AperturaMako estado={estado} quien={{ nombre: 'MaKo', aspecto: ASPECTO_MAKO }} acciones={{ publicar: onPublicar }} />;
}
