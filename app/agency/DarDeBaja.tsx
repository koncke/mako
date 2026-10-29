'use client';

// «Dar de baja» la cuenta de un cliente de la agencia (29/10/2026, lib/agencia-baja.ts): dos pasos, el botón y una
// confirmación que dice qué pasa. Lo usan la computadora (AgencyApp) y el teléfono (AgencyM).

import { useState } from 'react';
import { ConfirmDialog } from '@/app/_components/ChatItemMenu';
import { darDeBajaClienteAction } from './actions';

export function DarDeBaja({ clienteWs, nombre, onListo, onError, className }: {
  clienteWs: number; nombre: string; onListo: (texto: string) => void; onError: (texto: string) => void; className?: string;
}) {
  const [preguntar, setPreguntar] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const confirmar = async () => {
    setPreguntar(false); setCorriendo(true);
    const r = await darDeBajaClienteAction(clienteWs).catch(() => ({ ok: false as const, error: 'No se pudo dar de baja.' }));
    setCorriendo(false);
    if (r.ok) onListo(r.resumen); else onError(r.error);
  };
  return (
    <>
      <button type="button" className={className ?? 'ad-acc'} disabled={corriendo} onClick={() => setPreguntar(true)}>
        {corriendo ? 'Dando de baja…' : 'Dar de baja'}
      </button>
      {preguntar && (
        <ConfirmDialog titulo={`¿Dar de baja a ${nombre}?`}
          detalle="Dejas de entrar a su cuenta y le avisamos; sus datos quedan guardados. Si la pagas tú, se cancela su cobro y, si quiere seguir, paga él su plan. Si la paga él, su plan sigue."
          confirmLabel="Dar de baja" danger onCancel={() => setPreguntar(false)} onConfirm={confirmar} />
      )}
    </>
  );
}
