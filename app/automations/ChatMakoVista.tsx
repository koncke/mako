'use client';

// =============================================================================
// ChatMakoVista — lo que se VE del chat de MaKo de Automations: el hilo y la caja únicos (23/10/2026, AU4)
// =============================================================================
// Martín, por el Cerebro: «La criatura es SIEMPRE la de MaKo, la estrella, en todos lados. La caja de escribir está pegada
// abajo de todo: tiene que tener aire. Falta el "+" para adjuntar archivos e imágenes. Pasá el chat a la caja y el hilo
// únicos (CajaChat y HiloMako)». Era el `ChatHilo` de WhatsApp con colores de MaKo y la criatura «Automations».
//
// ⚠️ VIVE APARTE Y ENTRA CON `next/dynamic` (ChatMako.tsx): las piezas únicas traen su CSS, y ChatMako lo importan
// SecuenciaPerfil y la galería, que muchos tests dibujan bajo tsx (Node no carga CSS). El molde del agente del Web
// Generator (ChatAgente.tsx). Esto sólo DIBUJA: el motor, el hilo y lo de cada mensaje los arma ChatMako.tsx.
// =============================================================================

import '@/app/admin/operaciones/centro.css';
import '@/app/_chat/chat.css';
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { PanelDeChat, type CabeceraChat } from '@/app/admin/operaciones/PanelChat';
import { HiloMako, type EnMensaje, type Quien } from '@/app/_chat/HiloMako';
import { CajaChat } from '@/app/_chat/CajaChat';
import type { PropsCajaChat } from '@/app/_chat/CajaChat';
import type { MensajeWA } from '@/lib/centro-mensajes';
import { RecomendacionesDeMako } from '@/app/_chat/RecomendacionesDeMako';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import { estaAbajo } from '@/lib/centro-caja';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';

/** La criatura de MaKo: la estrella, siempre (23/10/2026). */
export const QUIEN_MAKO: Quien = { nombre: 'MaKo', aspecto: ASPECTO_MAKO };

type ItemMsg = Extract<ItemHilo, { k: 'msg' }>;

/** La ➤ sin el verde de WhatsApp (como el MaKo Analyst del CRM, MakoAnalystLead.tsx). */
const SIN_VERDE = { '--good': 'var(--ink)', '--sobre-good': 'var(--surface)' } as CSSProperties;
/** La columna angosta: el hilo y la caja con el margen de una barra lateral, no el de la ventana (`clamp(16px, 4vw, 56px)`). */
const CSS_COLUMNA = '[data-chat-mako-panel] .co-hilo { padding-inline: 14px; } [data-chat-mako-panel] .co-caja-wrap { padding-inline: 12px; } [data-chat-mako-panel] > .co-panel { flex: 1; min-height: 0; background: transparent; } [data-chat-mako-panel] .co-cab { padding: 0 12px; min-height: 52px; }';

export type PropsVistaChatMako = {
  items: readonly ItemHilo[];
  /** Lo de ChatMako adentro de un mensaje de MaKo: «✓ Listo», lo que faltó, lo acomodado, la pregunta, los botones. */
  enMensaje: (x: ItemMsg) => EnMensaje | null;
  /** MaKo trabajando (los segundos que lleva), o null. */
  escribiendo: { segs: number } | null;
  /** Lo que se lee con el hilo vacío. */
  vacio: ReactNode;
  /** «Reintentar» de un mensaje que no salió. */
  onReintentar: (id: string) => void;
  /** Arriba de la caja: las fases con Cancelar, o Discutir / Editar y el error. */
  encima: ReactNode;
  caja: PropsCajaChat;
  /** «Responder» del clic derecho: pone la cita del mensaje en la caja (useCitaDelChat, en ChatMako). */
  onCitar?: (m: MensajeWA) => void;
  /** La cabecera única (PanelChat.tsx): la estrella, «MaKo», en línea o escribiendo, la «←» a la lista y el ✕. La arma ChatMako. */
  cabecera: CabeceraChat;
};

export default function ChatMakoVista(p: PropsVistaChatMako) {
  const hiloRef = useRef<HTMLDivElement | null>(null);
  /** ¿Se estaba mirando lo último? Entonces lo nuevo lo sigue (si se subió a leer algo de antes, no se lo mueve). */
  const abajo = useRef(true);
  const n = p.items.length + (p.escribiendo ? 1 : 0);
  useLayoutEffect(() => {
    const h = hiloRef.current;
    if (h && abajo.current) h.scrollTop = h.scrollHeight;
  }, [n]);
  // ¿Se está mirando lo último? Se escucha el scroll del hilo del panel (PanelDeChat no recibe `onScroll`).
  useEffect(() => {
    const h = hiloRef.current;
    if (!h) return;
    const alMover = () => { abajo.current = estaAbajo(h); };
    h.addEventListener('scroll', alMover, { passive: true });
    return () => h.removeEventListener('scroll', alMover);
  }, []);
  return (
    // EL CHAT DEL OPS CENTER (23/10/2026, Martín: «Tienes que UNIFICAR los chats con MaKo en toda la app»): el panel único
    // (PanelChat.tsx) con su cabecera y la estrella, su arrastrar y soltar (lo adjuntado de la caja), el hilo y la caja únicos.
    <div data-chat-mako-panel="" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', ...SIN_VERDE }}>
      <style>{CSS_COLUMNA}</style>
      <PanelDeChat hilo={hiloRef} adjuntos={p.caja.adjuntos} cabecera={p.cabecera}
        caja={<>
          {/* LA CAJA CON AIRE (23/10/2026: «está pegada abajo de todo: tiene que tener aire»): la del Ops Center, con su margen. */}
          {/* Lo que MaKo recomienda mientras se arma una automatización (26/10/2026): el bloque de preguntas, plegado en su tira. */}
          <RecomendacionesDeMako superficie="automations" alPedir={p.caja.onTexto} />
          {p.encima}
          <div className="co-caja" data-caja-mako="">
            <CajaChat {...p.caja} />
          </div>
        </>}
        estado="">
        {p.items.length || p.escribiendo
          ? <HiloMako items={p.items} quien={QUIEN_MAKO} ahora={Date.now()} escribiendo={p.escribiendo} tarjeta={null}
              onTarjeta={() => {}} onReintentar={p.onReintentar} onRecargar={() => {}} enMensaje={p.enMensaje} onCitar={p.onCitar} />
          : p.vacio}
      </PanelDeChat>
    </div>
  );
}
