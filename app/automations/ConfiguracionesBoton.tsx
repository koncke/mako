'use client';

// =============================================================================
// ConfiguracionesBoton — «Configuraciones» de Automations: el horario de oficina y los límites
// =============================================================================
// Décima tanda (11/10/2026, GENERAL 4), textual: «Quiero agregar un botón de "Configuraciones", que se
// despliegue un modal, dentro se puede editar el horario de oficina... Pero también configuraciones sobre todo
// para limitaciones de todos los flujos». El diseño, en docs/diseno-automations-configuraciones.md §1.
//
// REEMPLAZA AL BOTÓN DEL HORARIO (HorarioLista + HorarioBoton, con su panel anclado), en los mismos dos
// lugares: el renglón de «Chatbot» de la lista (como `horario`, SimuladorWhatsApp) y el cartel vacío de
// ChatAgentApp. El horario sigue siendo «allí mismo, sin redirigir» (10/10/2026): adentro del modal.
//
// Un `Modal` de la casa con dos pestañas (`Tabs`):
//   · Horario = HorarioEnvioPanel TAL CUAL (el mismo de Configuraciones › Horario, con sus acciones).
//   · Límites = LimitesEnvioPanel (lib/limites-envio.ts).
// Los dos paneles quedan MONTADOS y la pestaña sólo esconde: cambiar de pestaña con un guardado en su
// respiro lo perdía (el panel lo cancela al desmontarse). Y el modal tiene ALTO FIJO: no salta al cambiar.
//
// ⚠️ EL `onCerrar` DEL MODAL TIENE IDENTIDAD FIJA (`useCerrarEstable`, AGENTS.md: «Todo `<Modal>` recibe un
// `onCerrar` de identidad FIJA»): una flecha nueva por render re-corre el efecto de foco del Modal y el
// número pierde el foco con cada tecla. Y no cierra con un guardado en vuelo (`ocupado`).
//
// ⚠️ POR PORTAL AL `body`: el botón vive en la lista, y un `fixed` adentro de un contexto de apilamiento
// (un `sticky` con z-index) queda debajo de lo que tenga un z mayor (AGENTS.md).
//
// Quien no es admin lo abre y lo VE sin editar: los dos paneles leen `puedeEditar` del server.
//
// ⚠️ ESTE ARCHIVO ARRASTRA LAS ACCIONES (`server-only`): no lo importa la lista (SimuladorWhatsApp, que los
// tests dibujan bajo tsx). Lo monta la tab (ChatAgentApp) y se lo pasa a la lista como `horario`.

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/app/_components/icons';
import { Modal, Tabs } from '@/app/_ui';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import { HorarioEnvioPanel } from '@/app/configuraciones/HorarioEnvioPanel';
import { LimitesEnvioPanel } from './LimitesEnvioPanel';

/** Las dos pestañas, en orden. */
export const PESTANAS_CONFIGURACIONES = [{ id: 'horario', label: 'Horario' }, { id: 'limites', label: 'Límites' }] as const;
type Pestana = (typeof PESTANAS_CONFIGURACIONES)[number]['id'];

/**
 * El hover va en la CLASE: un `style` en línea le gana a cualquier `:hover` (la regla del botón del horario,
 * tests/automations-horario.test.ts). Sin backticks acá adentro: es un template literal.
 */
const CSS_CONFIG = `
.chb-config{border:1px solid var(--border);background:transparent;color:var(--dim);transition:background .14s ease,color .14s ease,border-color .14s ease}
button.chb-config:hover,button.chb-config:focus-visible,button.chb-config[aria-expanded="true"]{background:var(--surface-2);color:var(--ink);border-color:var(--border-strong)}
`;

export function ConfiguracionesBoton() {
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState<Pestana>('horario');
  /** Guardados en vuelo, por panel: mientras haya uno, el modal no se cierra. */
  const [sucios, setSucios] = useState<{ horario: boolean; limites: boolean }>({ horario: false, limites: false });
  const ocupado = sucios.horario || sucios.limites;
  const cerrar = useCerrarEstable(() => setAbierto(false), ocupado);
  // Identidades FIJAS: los paneles las tienen en las dependencias de un efecto.
  const alSucioHorario = useCallback((s: boolean) => setSucios((p) => (p.horario === s ? p : { ...p, horario: s })), []);
  const alSucioLimites = useCallback((s: boolean) => setSucios((p) => (p.limites === s ? p : { ...p, limites: s })), []);

  return (
    <>
      <style>{CSS_CONFIG}</style>
      <button type="button" data-configuraciones className="chb-config" title="Configuraciones" aria-haspopup="dialog" aria-expanded={abierto}
        onClick={() => setAbierto(true)}
        style={{
          flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, boxSizing: 'border-box', padding: '0 9px 0 7px',
          borderRadius: 999, fontFamily: "'Geist', sans-serif", fontSize: 11.5, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap', cursor: 'pointer',
        }}>
        <Icon name="config" size={14} />
        <span>Configuraciones</span>
      </button>
      {abierto && createPortal(
        <Modal titulo="Configuraciones" onCerrar={cerrar} ancho={600} alto="min(85vh, 640px)">
          <Tabs tabs={[...PESTANAS_CONFIGURACIONES]} activa={pestana} onCambio={(id) => setPestana(id as Pestana)} />
          {/* Los dos montados; la pestaña sólo esconde (ver la cabecera). */}
          <div hidden={pestana !== 'horario'}><HorarioEnvioPanel onSucio={alSucioHorario} /></div>
          <div hidden={pestana !== 'limites'}><LimitesEnvioPanel onSucio={alSucioLimites} /></div>
        </Modal>,
        document.body,
      )}
    </>
  );
}
