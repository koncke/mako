'use client';

// =============================================================================
// ConfiguracionesM — el horario y el goteo de UNA automatización, en el teléfono
// =============================================================================
// Martín, 30/10/2026, de la llamada con Leila: «ella no sabia donde se configuraba el horario de oficina nada mas». El aviso
// (lib/ritmo-al-activar.ts) lo decía también en el teléfono, y de ahí no se podía llegar a ningún lado. Se abre desde el aviso
// mismo. Los ajustes son LOS MISMOS de la computadora (`AjustesDeLaAutomatizacion`), no una copia: guardan lo mismo, con la misma
// regla (quien no es admin los ve y no los edita, lo dice el server).
//
// ⚠️ POR `dynamic`, como LineasWhatsApp en app/m/configuraciones/integraciones/IntegracionesM.tsx: es una pieza de escritorio con
// sus acciones de server, y la lista del teléfono no tiene por qué cargarla si nadie la abre.
// ⚠️ NO SE CIERRA CON UN GUARDADO EN VUELO (`ocupado`), igual que el modal de la computadora.
// =============================================================================

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { SheetM } from '@/app/m/_ui';

const Ajustes = dynamic(() => import('@/app/automations/ConfigAutomatizacionPanel').then((m) => m.AjustesDeLaAutomatizacion), { ssr: false });

/** `secuenciaId` null = cerrada. */
export function ConfiguracionesM({ secuenciaId, onCerrar }: { secuenciaId: number | null; onCerrar: () => void }) {
  const [sucios, setSucios] = useState({ horario: false, antiban: false });
  // Identidades FIJAS: los paneles las tienen en las dependencias de un efecto.
  const alSucioHorario = useCallback((s: boolean) => setSucios((v) => ({ ...v, horario: s })), []);
  const alSucioAntiban = useCallback((s: boolean) => setSucios((v) => ({ ...v, antiban: s })), []);
  return (
    <SheetM id="configuraciones" abierto={secuenciaId != null} onCerrar={onCerrar} titulo="Configuraciones" snap="alto"
      ocupado={sucios.horario || sucios.antiban}>
      {secuenciaId != null && <Ajustes secuenciaId={secuenciaId} onSucioHorario={alSucioHorario} onSucioAntiban={alSucioAntiban} />}
    </SheetM>
  );
}
