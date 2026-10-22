'use client';

// =============================================================================
// MaKo en cada tab: la estrella abajo a la izquierda y, al tocarla, el Cerebro en un panel a la IZQUIERDA (21/10/2026)
// =============================================================================
// Martín (21/10, ~23:10), tres reglas para toda la app:
//   · «el chat de MaKo en las otras tabs se debe abrir siempre a la izquierda» (reemplaza lo del 18/10: «la barra fija a la
//     derecha, patrón Web Generator»);
//   · «los iconos de las criaturas siempre debe ser el icono de MaKo, se envía lo que sea que envíen al cerebro y ya el cerebro se
//     encarga de repartir»: el botón es la ESTRELLA y lo que se escribe cae en el chat «Cerebro» de la persona, el mismo del Ops
//     Center (lib/chat-mako-reglas.ts → JEFE_SECOND_BRAIN), que reparte. No abre un chat suelto por tab;
//   · «las criaturas, siempre, donde sea que estén deben tener su animación de movimiento, y parpadeo» (Muneco.tsx, centro.css).
// Es la conversación del Ops Center del cliente, con SUS piezas: el motor (app/second-brain/useChatCliente.ts), el panel
// (PanelChat.tsx), el hilo y la caja (app/second-brain/PiezasCliente.tsx). Cada tab la monta con `<MakoEnLaTab tab="CRM" />`.
// ⚠️ EL PANEL VA PEGADO A LA BARRA DE LA APP (app/_components/Sidebar.tsx, `[data-sidebar]`, 68 o 244 px), no al borde de la
//    pantalla: se mide al montar y cada vez que la barra cambia de ancho (se fija o se suelta).
// ⚠️ EL MOTOR SE MONTA SÓLO CON EL PANEL ABIERTO: una tab que nunca abre a MaKo no le pide nada al servidor.
// ⚠️ ABIERTO, LA TAB LE DEJA EL LUGAR: el panel publica su ancho en `--ancho-panel-mako` (en <html>) y la tab lo usa de margen
//    izquierdo (el CRM, en su <main>); cerrado vuelve a 0. Lo que cada tab suma arriba del hilo (las sugerencias del CRM) va
//    en `arriba`, y su número en la estrella plegada, en `aviso` (pedido del chat CRM, 22/10/2026).
// ⚠️ UN PEDIDO DE LA TAB (`pedido`, chat CRM, 22/10/2026): el «Hacerlo» de una sugerencia que se revisa con MaKo abre el
//    panel y lo manda al Cerebro como un mensaje más, UNA vez por `vez`, cuando el hilo está listo. Cerrar antes lo suelta.
// ⚠️ La caja es la única: este archivo no arma ninguna (tests/chat-unico.test.ts).

import '@/app/admin/operaciones/centro.css';
import './chat.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from '@/app/_ui';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { useChatCliente } from '@/app/second-brain/useChatCliente';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from '@/app/second-brain/PiezasCliente';
import { JEFE_SECOND_BRAIN, type ElegidoChat } from '@/lib/chat-mako-reglas';

/** El ancho de la barra de la app plegada: lo que se usa hasta medirla (y en el server). */
const BARRA_PLEGADA = 68;
/** El ancho del panel abierto (el de .ch-tab-panel, app/_chat/chat.css): lo que la tab le deja. */
const ANCHO_PANEL = 440;

/** Dónde empieza el contenido: el borde derecho de la barra de la app, medido; cambia cuando la barra se fija o se suelta. */
function useBordeDeLaBarra(): number {
  const [borde, setBorde] = useState(BARRA_PLEGADA);
  useLayoutEffect(() => {
    const barra = document.querySelector('[data-sidebar]');
    const medir = () => setBorde(Math.round(barra?.getBoundingClientRect().right ?? 0));
    medir();
    const ro = barra && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    if (barra) ro?.observe(barra);
    window.addEventListener('resize', medir);
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir); };
  }, []);
  return borde;
}

export function MakoEnLaTab({ tab, arriba = null, aviso = 0, pedido = null }: {
  /** El nombre de la tab («CRM», «Automations»): para el `aria-label`. Lo que se escribe va igual al Cerebro, que reparte. */
  tab: string;
  /** Lo de la tab arriba del hilo (las sugerencias de MaKo del CRM, con «Hacerlo» y «Ahora no»). */
  arriba?: ReactNode;
  /** Cuánto espera a la persona en esta tab (las sugerencias): el globito de la estrella plegada. */
  aviso?: number;
  /** Lo que la tab le manda al Cerebro (el «Hacerlo» de una sugerencia): abre el panel y sale UNA vez por `vez`. */
  pedido?: { texto: string; vez: number } | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const borde = useBordeDeLaBarra();
  // El pedido vive acá y no en el panel: el panel se desmonta al cerrar, y uno ya mandado no puede volver a salir al reabrir.
  const [porMandar, setPorMandar] = useState<{ texto: string; vez: number } | null>(null);
  const ultimaVez = useRef<number | null>(null);
  useEffect(() => {
    if (!pedido || ultimaVez.current === pedido.vez) return;
    ultimaVez.current = pedido.vez;
    setPorMandar(pedido);
    setAbierto(true);
  }, [pedido]);
  const cerrar = useCallback(() => { setAbierto(false); setPorMandar(null); }, []);
  // Abierto, la tab le deja el lugar (su margen izquierdo lee `--ancho-panel-mako`).
  useEffect(() => {
    const raiz = document.documentElement.style;
    raiz.setProperty('--ancho-panel-mako', abierto ? `${ANCHO_PANEL}px` : '0px');
    return () => { raiz.removeProperty('--ancho-panel-mako'); };
  }, [abierto]);
  return abierto
    ? <PanelDelCerebro tab={tab} izquierda={borde} arriba={arriba} pedido={porMandar} onMandado={() => setPorMandar(null)} onCerrar={cerrar} />
    : (
      <button type="button" className="ch-tab-mako" style={{ left: borde + 16 }} aria-label={aviso > 0 ? `Escríbele a MaKo desde ${tab} (${aviso} para ver)` : `Escríbele a MaKo desde ${tab}`}
        title="MaKo" onClick={() => setAbierto(true)}>
        <Muneco titulo={JEFE_SECOND_BRAIN} animo="despierto" size={40} espera={aviso} />
      </button>
    );
}

/** El panel abierto: la conversación «Cerebro» de la persona, con el motor del Ops Center. */
function PanelDelCerebro({ tab, izquierda, arriba, pedido, onMandado, onCerrar }: {
  tab: string; izquierda: number; arriba: ReactNode;
  pedido: { texto: string; vez: number } | null; onMandado: () => void; onCerrar: () => void;
}) {
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  // Siempre el Cerebro: al llegar la lista lo elige solo (`entrarAlCerebro`).
  const k = useChatCliente({ elegido, setElegido, activo: true, entrarAlCerebro: true, chatInicial: null, opcionArmar: '', busca: '', caja });
  // El pedido de la tab sale al Cerebro (no a otro chat) y cuando el hilo está listo y libre: `enviar` dice si salió.
  useEffect(() => {
    if (!pedido || !k.esJefe) return;
    if (k.enviar(pedido.texto)) onMandado();
    // `enviar` cambia en cada render; lo que decide es el pedido y que el Cerebro esté abierto, cargado y libre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, k.esJefe, k.cargado, k.trabajo]);
  // Escape lo cierra, como un panel de la casa (si no hay un menú o un modal arriba).
  const { menuWA, infoWA, conectando } = k;
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !menuWA && !infoWA && !conectando) onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [menuWA, infoWA, conectando, onCerrar]);
  // Como un chat: abre en lo último y baja con lo nuevo.
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [k.items.length, k.trabajo]);
  const seguirHilo = useCallback(() => hilo.current, []);

  return (
    <>
      <div className="ch-tab-panel" style={{ left: izquierda }} role="dialog" aria-label={`MaKo en ${tab}`}>
        <PanelDeChat hilo={hilo} adjuntos={k.adjuntosCaja}
          cabecera={{ clave: 'cerebro', titulo: k.nombre, criatura: k.nombreMuneco, animo: k.enCurso ? 'trabajando' : 'despierto', onVolver: onCerrar }}
          arriba={<>{arriba}<BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={k.nombre} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} /></>}
          despues={<>
            <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} />
            {k.infoWA && <Modal titulo="Info del mensaje" onCerrar={() => k.setInfoWA(null)} ancho={460}><InfoMensaje m={k.infoWA} /></Modal>}
          </>}
          caja={<div className="co-caja"><CajaDelCliente k={k} campo={caja} seguir={seguirHilo} /></div>}
          estado={estadoDelCliente(k)}>
          <HiloDelCliente k={k} />
        </PanelDeChat>
        <button type="button" className="ch-tab-panel__cerrar" aria-label="Cerrar MaKo" title="Cerrar (Esc)" onClick={onCerrar}>×</button>
      </div>
      {k.conectando && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { k.setConectando(false); k.mirarSuIA(); }} ancho={640}>
          <TusCuentasIA sinCabecera conectar />
        </Modal>
      )}
    </>
  );
}
