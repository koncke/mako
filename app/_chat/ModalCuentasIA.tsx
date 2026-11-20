'use client';

// «Tus cuentas de IA» ahí mismo, para el «Conectar tu IA» de una apertura (./AperturaMako.tsx) en una pantalla que no tiene el
// suyo (el Cerebro sí: le pasa `onConectar`). Entra con `next/dynamic`: trae CSS. Hasta el 20/11/2026, al cerrar volvía a preguntar
// por la app de escritorio para destrabar las cajas; ya ninguna caja la pide (./app-de-escritorio.ts).

import './chat.css';
import { Modal } from '@/app/_ui/Modal';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';

export default function ModalCuentasIA({ onCerrar }: { onCerrar: () => void }) {
  return (
    <Modal titulo="Tus cuentas de IA" onCerrar={onCerrar} ancho={640}>
      <TusCuentasIA sinCabecera conectar />
    </Modal>
  );
}
