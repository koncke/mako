'use client';

// «Tus cuentas de IA» ahí mismo, para el «Conectar tu IA» de una apertura (./AperturaMako.tsx) en una pantalla que no tiene el
// suyo (el Cerebro sí: le pasa `onConectar`). Al cerrar vuelve a preguntar por la app (./app-de-escritorio.ts → mirarApp): si la
// computadora ya se conectó, las cajas se destraban y la apertura deja de pedirlo. Entra con `next/dynamic`: trae CSS.

import './chat.css';
import { Modal } from '@/app/_ui/Modal';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { mirarApp } from './app-de-escritorio';

export default function ModalCuentasIA({ onCerrar }: { onCerrar: () => void }) {
  return (
    <Modal titulo="Tus cuentas de IA" onCerrar={() => { onCerrar(); void mirarApp(); }} ancho={640}>
      <TusCuentasIA sinCabecera conectar />
    </Modal>
  );
}
