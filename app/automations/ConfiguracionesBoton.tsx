'use client';

// =============================================================================
// ConfiguracionesBoton — el «?» del tutorial de la lista y el modal de Configuraciones de UNA automatización
// =============================================================================
// Décima tanda (11/10/2026, GENERAL 4), textual: «Quiero agregar un botón de "Configuraciones", que se
// despliegue un modal, dentro se puede editar el horario de oficina... Pero también configuraciones sobre todo
// para limitaciones de todos los flujos». El diseño, en docs/diseno-automations-configuraciones.md §1.
//
// UNDÉCIMA TANDA (11/10/2026), textual:
//   · Punto 9: «Y que los botones de "Configuraciones" y "Tutorial" estén en otro botón desplegable al inicio
//     de la barra de busqueda, es decir, antes de la barra de busqueda.» → `MenuAutomations`: el Dropdown de
//     la casa (app/components/Dropdown.tsx), un botón cuadrado con el ícono `config`, del alto del buscador
//     (`LADO_FILTRO`, el del filtro de al lado). Reemplaza al botón «Configuraciones» y al «?» del recorrido.
//   · Punto 1: «En configuraciones elimina el divider de abajo del título y más abajo hay 2 divider sueltos,
//     eliminalos también.» → `ConfiguracionesModal`: el Modal con `sinFiletes` (sin el borde de la cabecera),
//     Tabs con `sinLinea` (sin su borde propio) y UN SOLO hijo en el cuerpo (el cuerpo le pone un borde arriba
//     al segundo hijo). Queda sólo el subrayado azul de la pestaña activa. Los dos separadores internos de
//     «Límites» (adentro de su tarjeta) se quedan (docs/diseno-undecima-tanda.md §9, 33).
// El archivo conserva su nombre: lo citan los «Vive en:» de docs/hallazgos-chatbot.md.
//
// 20/10/2026 (Martín, 16/10 punto 5 y 20/10 punto 5, textos en docs/relevo/chatbot.md): «"configuraciones" ya no viva
// para todo Automations, sino para cada chat en los 3 puntos... Y en el lugar donde hoy está el ícono de configuraciones
// que solo quede el "?" del tutorial». Desde ese día:
//   · `MenuAutomations` es SÓLO el «?» (un botón, sin desplegable), en el mismo lugar;
//   · `ConfiguracionesModal` es de UNA automatización (`secuenciaId`): lo abren la tuerca del título (SecuenciaPerfil) y
//     «Configuraciones» del «⋯» de la fila. Horario = el propio o el del negocio (`HorarioDeLaAutomatizacion`); Límites =
//     las horas entre dos mensajes a la misma persona de ESTA (`PersonaDeLaAutomatizacion`) y, abajo, los de la LÍNEA,
//     que son de todas (`LimitesEnvioPanel` con `personaPorDefecto`: ahí también las horas a la misma persona del NEGOCIO,
//     las que valen para las que no tienen las suyas). El horario del negocio sigue en Configuraciones › Horario.
//
// 22/10/2026 (Martín, por el Cerebro, con captura de #289): fuera el subtítulo con el nombre de la automatización y el aire
// de arriba; y fuera todo el texto suelto de las opciones («Jamás jamás pongas todo eso»): filas con nombre, número, unidad
// e interruptor (FilasOpciones.tsx), lo demás en su ⓘ.
//
// 23/10/2026 (Martín, por el Cerebro): «Todo vive en UNA sola pantalla, sin pestañas ni nombre de pestaña: sólo el título
// "Configuraciones"». Eran dos pestañas (Horario y «Anti-ban», antes «Límites»). Ahora el cuerpo es
// `AjustesDeLaAutomatizacion` (ConfigAutomatizacionPanel.tsx): «Horario de oficina» y «Todos los canales» (24/10). El modal tiene
// ALTO FIJO y el cuerpo scrollea. Y desde ese mismo día, nada «para todas» (los límites de la línea ya no se ven acá).
//
// ⚠️ EL `onCerrar` DEL MODAL TIENE IDENTIDAD FIJA (`useCerrarEstable`, AGENTS.md: «Todo `<Modal>` recibe un
// `onCerrar` de identidad FIJA»): una flecha nueva por render re-corre el efecto de foco del Modal y el
// número pierde el foco con cada tecla. Y no cierra con un guardado en vuelo (`ocupado`).
//
// ⚠️ POR PORTAL AL `body`: el menú vive en la lista, y un `fixed` adentro de un contexto de apilamiento
// (un `sticky` con z-index) queda debajo de lo que tenga un z mayor (AGENTS.md).
//
// ⚠️ EL `data-recorrido` VA EN UN <span> QUE ENVUELVE AL DROPDOWN: el Dropdown no deja pasar `data-*` a su
// botón (el mismo envoltorio que FiltroLista). Lo pone A MANO: el último paso del recorrido lo señala.
//
// Quien no es admin lo abre y lo VE sin editar: los dos paneles leen `puedeEditar` del server.
//
// ⚠️ ESTE ARCHIVO ARRASTRA LAS ACCIONES (`server-only`): no lo importa la lista (SimuladorWhatsApp) ni el lienzo
// (SecuenciaPerfil), que los tests dibujan bajo tsx. Lo monta la tab (ChatAgentApp) y se los pasa: el «?» como `menu` y el
// modal como `Configuraciones` (un componente).

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/app/_ui';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import { AjustesDeLaAutomatizacion } from './ConfigAutomatizacionPanel';
import { getConfigAutomatizacionAction } from './config-automatizacion-actions';
import { tieneRitmoPropio, type PropsConfiguraciones } from '@/lib/config-automatizacion';
import { LADO_FILTRO } from './FiltroLista';
import { OBJETIVO_AYUDA } from './recorrido-automations';

/**
 * EL MODAL DE CONFIGURACIONES DE UNA AUTOMATIZACIÓN (20/10/2026): su horario y sus límites. Lo montan la tuerca del título
 * y el «⋯» de la fila mientras está abierto; `onCerrar` lo desmonta.
 */
export function ConfiguracionesModal({ secuenciaId, onCerrar }: PropsConfiguraciones) {
  /** Guardados en vuelo, por panel: mientras haya uno, el modal no se cierra. */
  const [sucios, setSucios] = useState<{ horario: boolean; antiban: boolean }>({ horario: false, antiban: false });
  const ocupado = sucios.horario || sucios.antiban;
  const cerrar = useCerrarEstable(onCerrar, ocupado);
  // Identidades FIJAS: los paneles las tienen en las dependencias de un efecto.
  const alSucioHorario = useCallback((s: boolean) => setSucios((p) => (p.horario === s ? p : { ...p, horario: s })), []);
  const alSucioAntiban = useCallback((s: boolean) => setSucios((p) => (p.antiban === s ? p : { ...p, antiban: s })), []);

  return createPortal(
    <Modal titulo="Configuraciones" onCerrar={cerrar} ancho={600} alto="min(85vh, 680px)" sinFiletes>
      {/* UN SOLO HIJO (punto 1): el cuerpo del Modal le pone un filete arriba al segundo. Con `paddingTop: 0` (22/10/2026:
          «achicá el espacio»): el cuerpo le pone 18 px a su hijo. Una sola pantalla, sin pestañas (23/10/2026). */}
      <div data-config-automatizacion={secuenciaId} style={{ paddingTop: 0 }}>
        <AjustesDeLaAutomatizacion secuenciaId={secuenciaId} onSucioHorario={alSucioHorario} onSucioAntiban={alSucioAntiban} />
      </div>
    </Modal>,
    document.body,
  );
}

/** ¿Esa automatización ya tiene su ritmo (horario o goteo)? (el aviso de Prospección de Publicar y Probar: `tieneRitmoPropio`). */
export async function tieneConfigPropiaDe(secuenciaId: number): Promise<boolean> {
  return tieneRitmoPropio((await getConfigAutomatizacionAction(secuenciaId)).config);
}

/** El rótulo del «?». */
export const TITULO_TUTORIAL = 'Ver el tutorial';

/**
 * EL «?» DE LA LISTA, antes del buscador (20/10/2026, Martín: «en el lugar donde hoy está el ícono de configuraciones
 * que solo quede el "?" del tutorial»): vuelve a abrir el recorrido (`onTutorial`, el `reabrir` del gancho). Era un
 * desplegable con «Configuraciones» y «Tutorial» (undécima tanda, punto 9); Configuraciones pasó a cada automatización.
 */
export function MenuAutomations({ onTutorial }: { onTutorial: () => void }) {
  return (
    <span data-recorrido={OBJETIVO_AYUDA} style={{ display: 'inline-flex', flex: 'none' }}>
      <button type="button" data-boton-tutorial="" onClick={onTutorial} title={TITULO_TUTORIAL} aria-label={TITULO_TUTORIAL}
        style={{
          width: LADO_FILTRO, height: LADO_FILTRO, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)',
          fontFamily: "'Geist', sans-serif", fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>?</button>
    </span>
  );
}
