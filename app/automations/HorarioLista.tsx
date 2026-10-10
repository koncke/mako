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
// (`getHorarioEnvioAction`) y se vuelve a pedir al guardar y al cerrar.
//
// ⚠️ VIVE APARTE DE LA LISTA (SimuladorWhatsApp) Y SE LE PASA COMO `horario`, como el `pie`: las
// acciones arrastran `server-only`, y los tests que dibujan la lista la importan bajo tsx, donde ese
// paquete tira al importarse. La tab (ChatAgentApp) es la que lo monta.

import { useCallback, useEffect, useRef, useState } from 'react';
import { HorarioEnvioPanel } from '@/app/configuraciones/HorarioEnvioPanel';
import { getHorarioEnvioAction } from '@/app/configuraciones/horario-actions';
import { AVISO_GUARDADO, BotonHorario, PanelAnclado, type EstadoHorario } from './HorarioBoton';

export function HorarioLista({ rolAdmin }: { rolAdmin: boolean }) {
  const [estado, setEstado] = useState<EstadoHorario>({ t: 'cargando' });
  /** El botón que abrió el panel; `null` = cerrado. Es el NODO (el ancla), no un ref leído al dibujar. */
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  /** Lo que el panel tiene adentro, para ver cuándo confirma que guardó (ver `AVISO_GUARDADO`). */
  const [cuerpo, setCuerpo] = useState<HTMLDivElement | null>(null);
  /** La última lectura pedida: una respuesta vieja que llega tarde no pisa a la nueva. */
  const pedido = useRef(0);

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
  const cerrar = useCallback(() => { setAncla(null); leer(); }, [leer]);
  const alternar = (boton: HTMLElement) => { if (ancla) cerrar(); else setAncla(boton); };

  /**
   * ⚠️ PUENTE HASTA QUE EL PANEL TENGA `onGuardado`: cuando aparece «Guardado» adentro, se vuelve a
   * leer, y el botón cambia al guardar sin esperar a que se cierre el panel. Un `MutationObserver` y
   * no un efecto sobre `abierto`: el cuerpo vive en un portal, y se observa desde que EXISTE (callback
   * ref + estado), no desde que se pidió abrir. Lo que no ve esto (otra palabra en el panel) lo cubre
   * la lectura al cerrar.
   */
  useEffect(() => {
    if (!cuerpo) return;
    let visto = (cuerpo.textContent ?? '').includes(AVISO_GUARDADO);
    const mo = new MutationObserver(() => {
      const ahora = (cuerpo.textContent ?? '').includes(AVISO_GUARDADO);
      if (ahora && !visto) leer();
      visto = ahora;
    });
    mo.observe(cuerpo, { subtree: true, childList: true, characterData: true });
    return () => mo.disconnect();
  }, [cuerpo, leer]);

  return (
    <>
      <BotonHorario estado={estado} editable={rolAdmin} abierto={ancla != null} onAlternar={alternar} />
      {/* Sólo un admin: el panel de Configuraciones es sólo admin, y guardar lo exige en el server. */}
      {rolAdmin && ancla && (
        <PanelAnclado ancla={ancla} etiqueta="Horario de envío" onCerrar={cerrar}>
          <div ref={setCuerpo}>
            <HorarioEnvioPanel />
          </div>
        </PanelAnclado>
      )}
    </>
  );
}
