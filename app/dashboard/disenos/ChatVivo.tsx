'use client';

// =============================================================================
// ChatVivo — la hoja Chat Analyst con su diseño (./HojaChat.tsx) y los datos de VERDAD
// =============================================================================
// HojaChat sólo dibuja (la usa también la miniatura de «Nueva hoja», con datos de ejemplo). Acá se arma lo vivo: los datos de
// los componentes de la hoja (`datos`, los que la página ya leyó) y quién mira (el saludo, que trae la página aparte).
// lib/chat-diseno.ts arma lo que dibuja cada parte, con test. Lo carga EditorInforme con next/dynamic.
// =============================================================================

import { useMemo } from 'react';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import { vistaChat, type DatosPieza } from '@/lib/chat-diseno';
import type { QuienMira } from './HojaClosing';
import { HojaChat } from './HojaChat';

export type ExtrasChat = { quien: QuienMira | null };

export default function ChatVivo({ hoja, hoy, datos, extras, periodo, onGrilla, onPeriodo, onFila, compartido }: {
  hoja: Hoja; hoy: string; datos: Record<string, DatosPieza>; extras: ExtrasChat | null; periodo: string;
  onGrilla?: () => void; onPeriodo?: () => void; onFila?: (g: Grafico, clave: string) => void; compartido?: boolean;
}) {
  const vista = useMemo(() => vistaChat(hoja, datos, hoy), [hoja, datos, hoy]);
  const quien = extras?.quien ?? null;
  const titulo = quien?.nombre ? `${quien.saludo}, ${quien.nombre}` : hoja.nombre;
  return <HojaChat hoja={hoja} vista={vista} titulo={titulo} periodo={periodo} onGrilla={onGrilla} onPeriodo={onPeriodo} onFila={onFila} compartido={compartido} />;
}
