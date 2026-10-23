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

/** Quien contesta en el hilo: la criatura de la tab (la misma que lo nombra en el Ops Center). */
const QUIEN = { nombre: 'Web Generator' };
const nada = () => {};

export function HiloAgente({ items, corriendo, enMensaje }: {
  items: readonly ItemHilo[];
  corriendo: boolean;
  enMensaje: (x: Extract<ItemHilo, { k: 'msg' }>) => EnMensaje | null;
}) {
  return (
    <HiloMako items={items} quien={QUIEN} ahora={Date.now()} escribiendo={corriendo ? { segs: 0 } : null}
      tarjeta={null} onTarjeta={nada} onReintentar={nada} onRecargar={nada} enMensaje={enMensaje} />
  );
}

/** La caja única, en su marco (`.co-caja`): lo que se escribe y se adjunta lo maneja el panel por props. */
export function CajaAgente(p: PropsCajaChat) {
  return <div className="co-caja"><CajaChat {...p} /></div>;
}
