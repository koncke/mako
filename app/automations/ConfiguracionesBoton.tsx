'use client';

// =============================================================================
// ConfiguracionesBoton — el menú de Automations (Configuraciones y Tutorial) y el modal de Configuraciones
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
// ⚠️ POR PORTAL AL `body`: el menú vive en la lista, y un `fixed` adentro de un contexto de apilamiento
// (un `sticky` con z-index) queda debajo de lo que tenga un z mayor (AGENTS.md).
//
// ⚠️ EL `data-recorrido` VA EN UN <span> QUE ENVUELVE AL DROPDOWN: el Dropdown no deja pasar `data-*` a su
// botón (el mismo envoltorio que FiltroLista). Lo pone A MANO: el último paso del recorrido lo señala.
//
// Quien no es admin lo abre y lo VE sin editar: los dos paneles leen `puedeEditar` del server.
//
// ⚠️ ESTE ARCHIVO ARRASTRA LAS ACCIONES (`server-only`): no lo importa la lista (SimuladorWhatsApp, que los
// tests dibujan bajo tsx). Lo monta la tab (ChatAgentApp) y se lo pasa a la lista como `menu`.

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/app/_components/icons';
import { Modal, Tabs } from '@/app/_ui';
import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { Dropdown } from '../components/Dropdown';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import { HorarioEnvioPanel } from '@/app/configuraciones/HorarioEnvioPanel';
import { useFijarHorarioOficina } from './horario-oficina';
import { LimitesEnvioPanel } from './LimitesEnvioPanel';
import { LADO_FILTRO } from './FiltroLista';
import { OBJETIVO_AYUDA } from './recorrido-automations';

/** Las dos pestañas, en orden. */
export const PESTANAS_CONFIGURACIONES = [{ id: 'horario', label: 'Horario' }, { id: 'limites', label: 'Límites' }] as const;
type Pestana = (typeof PESTANAS_CONFIGURACIONES)[number]['id'];

/** Lo que ofrece el menú, en orden, cada una con su ícono del set de la casa (app/_ui/iconos-menu.tsx). */
export const OPCIONES_MENU_AUTOMATIONS = [
  { value: 'configuraciones', label: 'Configuraciones', icono: 'configurar' },
  { value: 'tutorial', label: 'Tutorial', icono: 'pregunta' },
] as const satisfies ReadonlyArray<{ value: string; label: string; icono: NombreIconoMenu }>;

/**
 * El modal de Configuraciones: el horario de oficina y los límites. Lo monta `MenuAutomations` mientras está
 * abierto; `onCerrar` lo desmonta.
 */
export function ConfiguracionesModal({ onCerrar }: { onCerrar: () => void }) {
  const [pestana, setPestana] = useState<Pestana>('horario');
  /** Guardados en vuelo, por panel: mientras haya uno, el modal no se cierra. */
  const [sucios, setSucios] = useState<{ horario: boolean; limites: boolean }>({ horario: false, limites: false });
  const ocupado = sucios.horario || sucios.limites;
  const cerrar = useCerrarEstable(onCerrar, ocupado);
  // Identidades FIJAS: los paneles las tienen en las dependencias de un efecto.
  const alSucioHorario = useCallback((s: boolean) => setSucios((p) => (p.horario === s ? p : { ...p, horario: s })), []);
  const alSucioLimites = useCallback((s: boolean) => setSucios((p) => (p.limites === s ? p : { ...p, limites: s })), []);
  // Guardado el horario, el lienzo se pone al día (el chip «Espera a que abra» y la opción de la tarjeta MaKo).
  const fijarOficina = useFijarHorarioOficina();

  return createPortal(
    <Modal titulo="Configuraciones" onCerrar={cerrar} ancho={600} alto="min(85vh, 640px)" sinFiletes>
      {/* UN SOLO HIJO (punto 1): el cuerpo del Modal le pone un filete arriba al segundo. Los dos paneles
          montados; la pestaña sólo esconde (ver la cabecera). */}
      <div>
        <Tabs tabs={[...PESTANAS_CONFIGURACIONES]} activa={pestana} onCambio={(id) => setPestana(id as Pestana)} sinLinea />
        <div hidden={pestana !== 'horario'}><HorarioEnvioPanel onSucio={alSucioHorario} onGuardado={fijarOficina} /></div>
        <div hidden={pestana !== 'limites'}><LimitesEnvioPanel onSucio={alSucioLimites} /></div>
      </div>
    </Modal>,
    document.body,
  );
}

/**
 * EL MENÚ DE LA TAB, antes del buscador (punto 9): «Configuraciones» abre el modal y «Tutorial» vuelve a abrir
 * el recorrido (`onTutorial`, el `reabrir` del gancho). Al elegir, el Dropdown no le devuelve el foco a su botón
 * (sólo con Escape): abrir el Modal no compite con él.
 */
export function MenuAutomations({ onTutorial }: { onTutorial: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  return (
    <span data-recorrido={OBJETIVO_AYUDA} style={{ display: 'inline-flex', flex: 'none' }}>
      <Dropdown value="" resetAfterSelect sinFlecha search={false} align="left" ariaLabel="Configuraciones y tutorial"
        botonLabel={<span style={{ display: 'flex' }}><Icon name="config" size={16} /></span>}
        buttonStyle={{ width: LADO_FILTRO, height: LADO_FILTRO, padding: 0, justifyContent: 'center', borderRadius: 10, color: 'var(--dim)', borderColor: 'var(--border-strong)' }}
        options={[...OPCIONES_MENU_AUTOMATIONS]}
        onChange={(v) => { if (v === 'configuraciones') setAbierto(true); else if (v === 'tutorial') onTutorial(); }} />
      {abierto && <ConfiguracionesModal onCerrar={cerrar} />}
    </span>
  );
}
