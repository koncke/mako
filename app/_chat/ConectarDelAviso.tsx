'use client';

// =============================================================================
// El botón de un aviso con `conectar`: la integración que le falta al negocio, abierta AHÍ MISMO
// =============================================================================
// Tickets #5 y #6 (18/10/2026): un negocio sin una IA propia no es un bug, y MaKo le pide que conecte la suya
// (lib/mako-turno-app-reglas.ts → `faltaIADelNegocio`). El botón abre el MISMO modal de /integraciones en la pantalla
// del chat: para una integración jamás se sale de la tab (Martín, 14/10/2026). Lo usan los tres hilos que dibujan un
// turno de la app: app/_chat/HiloMako.tsx (Second Brain, CRM), app/m/mako/ChatMako.tsx y la ficha del lead.

import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { botonConectar } from '@/app/m/mako/chat-ui';

export function ConectarDelAviso({ servicio }: { servicio: string }) {
  return (
    <div style={{ marginTop: 6 }}>
      <BotonIntegracion servicio={servicio} style={{ color: 'var(--primary)', fontWeight: 600 }}>{botonConectar(servicio)}</BotonIntegracion>
    </div>
  );
}
