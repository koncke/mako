'use client';

// =============================================================================
// «Instalar MaKo» en el lugar del micrófono, para las cajas con su propio motor (25/10/2026)
// =============================================================================
// El botón del bloqueo (./useAppDeEscritorio.tsx) para los chats con caja propia y las cajas de pedido: antes de descargar,
// «Instalar MaKo» (la descarga de IA del cliente, con la detección de Windows o Mac); después, «Ya lo instalé: conectar», que
// abre «Tus cuentas de IA» ahí mismo y, al cerrarlo, vuelve a preguntar (si la computadora ya se conectó, la caja se destraba).
// Es la misma pieza que dibuja la caja del chat común (./AppPrimero.tsx → useBloqueoApp), con el «ya lo descargó» compartido por
// todas las cajas de la página. Entra con `next/dynamic` (useAppDeEscritorio.tsx): trae CSS, y los motores que lo usan los cargan
// los tests en node.
// El modal va por PORTAL al body: la caja puede vivir en un panel flotante con `transform`, que volvería su marco el `fixed` del
// fondo del modal (lo dejaría del tamaño del panel).

import { useState } from 'react';
import { createPortal } from 'react-dom';
import './chat.css';
import { Modal } from '@/app/_ui/Modal';
import { Icon } from '@/app/_components/icons';
import { DescargarMaKo, avisoAlAbrir } from '@/app/integraciones/CuentasYDispositivos';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { marcarDescargado, mirarApp, useDescargado } from './app-de-escritorio';

export default function InstalarMaKo() {
  const descargado = useDescargado();
  const [conectando, setConectando] = useState(false);
  if (!descargado) {
    return (
      // La marca de la guía (lib/guia/, «Conectar tu IA») va en un envoltorio: DescargarMaKo es de IA del cliente.
      <span className="ch-ancla" data-recorrido="mk-instalar">
        <DescargarMaKo className="co-instalar" texto="Instalar MaKo" onClick={marcarDescargado}>
          <Icon name="descargar" size={16} />
        </DescargarMaKo>
      </span>
    );
  }
  return (
    <>
      <button type="button" className="co-instalar" onClick={() => setConectando(true)} title={avisoAlAbrir()} data-app-primero="conectar" data-recorrido="mk-conectar">
        <Icon name="check" size={16} />Ya lo instalé: conectar
      </button>
      {conectando && createPortal(
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { setConectando(false); void mirarApp(); }} ancho={640}>
          <TusCuentasIA sinCabecera conectar />
        </Modal>,
        document.body,
      )}
    </>
  );
}
