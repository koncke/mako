'use client';

// =============================================================================
// HorarioLista — el botón del horario de envío y su panel, con el editor de Configuraciones adentro
// =============================================================================
// Pedido de Martín (10/10/2026): «El horario de oficina si se configura en la tab de
// configuraciones, pero haz que se pueda configurar allí mismo, sin redirigir.» El porqué del lugar
// y las reglas del panel, en HorarioBoton.tsx.
//
// UNA FUENTE: el mismo setting (`mako.horario_envio`), las mismas acciones
// (app/configuraciones/horario-actions.ts) y el MISMO editor (HorarioEnvioPanel, importado tal cual).
// Configuraciones › Horario se queda. El estado del botón sale de la misma lectura que el panel
// (`getHorarioEnvioAction`) y se vuelve a pedir al guardar (`onGuardado` del panel) y al cerrar.
//
// ⚠️ VIVE APARTE DE LA LISTA (SimuladorWhatsApp) Y SE LE PASA COMO `horario`, como el `pie`: las
// acciones arrastran `server-only`, y los tests que dibujan la lista la importan bajo tsx, donde ese
// paquete tira al importarse. La tab (ChatAgentApp) es la que lo monta: en el renglón de «Chatbot» de
// la lista y, sin ninguna automatización, al lado del «＋ Nueva» del cartel vacío.

import { useCallback, useEffect, useRef, useState } from 'react';
import { HorarioEnvioPanel } from '@/app/configuraciones/HorarioEnvioPanel';
import { getHorarioEnvioAction } from '@/app/configuraciones/horario-actions';
import { BotonHorario, PanelAnclado, type EstadoHorario } from './HorarioBoton';

export function HorarioLista({ rolAdmin }: { rolAdmin: boolean }) {
  const [estado, setEstado] = useState<EstadoHorario>({ t: 'cargando' });
  /** El botón que abrió el panel; `null` = cerrado. Es el NODO (el ancla), no un ref leído al dibujar. */
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  /** La última lectura pedida: una respuesta vieja que llega tarde no pisa a la nueva. */
  const pedido = useRef(0);
  /**
   * ¿El editor tiene cambios sin guardar? Lo avisa el propio panel (`onSucio`). En un REF y no en un
   * estado: lo lee el panel anclado en el momento del clic afuera o del Escape (`retener`), y no hace
   * falta redibujar nada cuando cambia.
   */
  const sucio = useRef(false);

  const leer = useCallback(() => {
    const n = ++pedido.current;
    getHorarioEnvioAction()
      .then((d) => { if (n === pedido.current) setEstado({ t: 'listo', horario: d.horario, zona: d.zona }); })
      .catch(() => { if (n === pedido.current) setEstado({ t: 'error' }); });
  }, []);

  useEffect(() => {
    leer();
    // Desmontado, ninguna respuesta en vuelo escribe.
    return () => { pedido.current += 1; };
  }, [leer]);

  /** Cerrar vuelve a leer: lo guardado adentro es lo que el botón tiene que decir. */
  const cerrar = useCallback(() => { sucio.current = false; setAncla(null); leer(); }, [leer]);
  const alternar = (boton: HTMLElement) => { if (ancla) cerrar(); else { sucio.current = false; setAncla(boton); } };
  /** Identidades FIJAS: el panel las tiene en las dependencias de un efecto. */
  const retener = useCallback(() => sucio.current, []);
  const alSucio = useCallback((s: boolean) => { sucio.current = s; }, []);

  return (
    <>
      <BotonHorario estado={estado} editable={rolAdmin} abierto={ancla != null} onAlternar={alternar} />
      {/* Sólo un admin: el panel de Configuraciones es sólo admin, y guardar lo exige en el server. */}
      {rolAdmin && ancla && (
        <PanelAnclado ancla={ancla} etiqueta="Horario de envío" onCerrar={cerrar} retener={retener}>
          <HorarioEnvioPanel onGuardado={leer} onSucio={alSucio} />
        </PanelAnclado>
      )}
    </>
  );
}
