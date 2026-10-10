'use client';

// =============================================================================
// FichaWorkspace — el detalle de un cliente de la PLATAFORMA
// =============================================================================
// «Se ve completamente diferente y más fea el detail de super admin… Tienes que
// COPIAR tal cual el diseño, solo agregarle la otra tab de equipo y los otros botones
// para administrar al usuario, solo eso» (28/09/2026).
//
// ⚠️ ES LA MISMA PANTALLA QUE `app/customer-success/FichaCliente.tsx`, y ahora es
// literal y no una intención: el mismo `Modal` con el mismo ancho, la misma cabecera
// (`CabeceraDetalle`, con la misma escala) y el MISMO tablero adentro —`PlanBoard` /
// `TodoBoard`, con sus cuatro vistas—. Lo único que esta ficha agrega es lo que el
// pedido dice: la tab de Equipo y los botones para administrar al cliente.
//
// Dos intentos anteriores fallaron por lo mismo, y conviene tenerlo escrito: el
// primero era un `Modal` de 720 con una lista adentro, el segundo una caja de 820 con
// una tabla de sólo lectura. Los dos se reportaron igual —«se ve diferente»—, porque
// lo eran: mientras la pieza no sea LA MISMA, «parecido» es lo máximo que se consigue.
//
// ⚠️ EL TABLERO ES EL DEL SUPER ADMIN, FILTRADO A ESE CLIENTE — no el del cliente.
// «Estás trayendo las tareas y proyectos de ese cliente, cuando tenés que traer los de
// SUPER ADMIN relacionados a ese cliente» (28/09/2026), y es lo mismo que hace la ficha
// de Customer Success: MI trabajo para ese cliente, no el suyo. Para ver el tablero del
// cliente está «Inspeccionar», que entra a su cuenta.
//
// Eso además hace que las escrituras sean triviales: el tablero es del workspace
// ACTUAL, así que no hay nada que rutear. Una versión anterior traía el board del otro
// inquilino y necesitaba mandarle el `?ws=` a cada llamada; eso se fue con el cambio.
//
// ⚠️ Y LAS TABS SON UNA SOLA FILA. «Pusiste 2 seleccionables de tabs, arriba tablero y
// equipo y abajo las otras cuatro… tienes que quitar lo de arriba, y simplemente
// agregar Equipo luego de Recurrentes» (28/09/2026). «Equipo» entra por `vistaExtra`
// del board: una fila, cinco destinos.

import { plural } from '@/lib/plural';
import type { ReactNode } from 'react';
import { Modal } from '@/app/_ui';
import { CabeceraDetalle } from '@/app/_components/CabeceraDetalle';
import { EditableInline } from '@/app/_components/EditableInline';
import { Icon } from '@/app/_components/icons';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { colorDe } from '@/app/_components/TarjetaEntidad';
import { capaDef } from '@/lib/capas';
import { MONO, chip } from './estilos';
import type { Workspace } from './tipos';

/**
 * El mismo ancho que la ficha de un cliente de Customer Success.
 *
 * ⚠️ NO ES UN NÚMERO ELEGIDO ACÁ: es el de allá, y el día que cambie tienen que
 * cambiar los dos.
 */
const ANCHO = 1560;

export type CambioCara = {
  portada?: string | null;
  portadaY?: number | null;
  icono?: string | null;
  avatarY?: number | null;
};

export function FichaWorkspace({
  w, cara, esPlataforma, opciones, accionando, onAccion, onNombre, onEncuadre,
  onAbrirPortada, onAbrirIcono, onCerrar, tablero,
}: {
  w: Workspace;
  /**
   * Si este workspace ES la plataforma. Entra por prop y no se deduce acá: quién es la
   * plataforma lo decide la pantalla, que tiene la lista entera y puede tomar el de
   * MENOR id con capa `superadmin` — exactamente lo que hace `wsSuperAdmin()` en el
   * server. Deducirlo de `w.capa` sola pondría el chip dos veces si algún día hay dos.
   */
  esPlataforma: boolean;
  /**
   * La cara de su ADMIN, como respaldo de la marca. `w.icono` le gana: es lo único
   * que alguien eligió a propósito para este cliente (mig 0179).
   */
  cara: string | null;
  opciones: DropdownOption[];
  accionando: boolean;
  onAccion: (v: string) => void;
  onNombre: (nombre: string) => void;
  /** Guardar el encuadre de la portada. Lo escribe el arrastre, no un selector. */
  onEncuadre: (y: number) => void;
  /**
   * Abrir cada selector. La ficha NO los monta: cuelgan de su ancla y su estado —qué
   * botón los abrió— vive en la pantalla, igual que en la ficha de un cliente.
   */
  onAbrirPortada: (ancla: HTMLElement) => void;
  onAbrirIcono: (ancla: HTMLElement) => void;
  onCerrar: () => void;
  /**
   * El tablero, ya montado por la pantalla — que es la que tiene las filas y sabe cuál
   * de los dos boards le toca. Acá entra entero, con su selector de vistas y con la de
   * «Equipo» ya adentro.
   */
  tablero: ReactNode;
}) {
  const color = colorDe(w.nombre);
  // ⚠️ ERA `w.id === 1`, que es MAURICIO — un cliente. «Quitale el tag de Dueño a
  // Mauricio, eso lo debería tener Martin Koncke, que es el dueño y SuperAdmin»
  // (29/09/2026). Lo decide la pantalla; ver `wsPlataforma` en AdminView.
  const esDueno = esPlataforma;

  return (
    <Modal
      titulo={
        <CabeceraDetalle
          nombre={w.nombre}
          color={color}
          portada={w.portada} portadaY={w.portada_y}
          onPortada={onAbrirPortada} onEncuadre={onEncuadre}
          icono={w.icono} foto={cara} avatarY={w.avatar_y}
          onIcono={onAbrirIcono}
          /* La misma escala que la ficha de un cliente: banda de 160 y marca REDONDA
             de 88 con anillo de 4. Sobre 1560 de ancho, la de 124/54 del detalle de un
             proyecto se ve perdida — y es el mismo motivo por el que allá es otra. */
          alto={160} tam={88} anillo={4}
          /* Sin `onCerrar`: la × la pone el `Modal` y la hoja de la pieza la
             reposiciona sobre la portada. Dos serían dos cruces en la misma esquina. */
          titulo={
            <EditableInline
              valor={w.nombre}
              placeholder="Sin nombre"
              titulo="Edita el nombre del cliente"
              className="fw-nom"
              onGuardar={onNombre} />
          }
          bajada={
            <>
              {/* ⛔ ACÁ ESTABA EL SLUG, y se fue con el de la tarjeta: «quita lo del id de
                  usuario, no sé porqué pones codigo-inmobiliario, ese dato no lo quiero»
                  (29/09/2026). Sigue vivo en el buscador de la grilla, que es donde
                  sirve para algo. */}
              {esDueno && <span style={chip('var(--accent-soft)', '#171511')}>Dueño</span>}
              <span style={chip('var(--primary-bg)', 'var(--primary)')}>{capaDef(w.capa).nombre}</span>
              {w.estado === 'pausado' && <span style={chip('var(--surface-2)', 'var(--dim)')}>pausado</span>}
              <span style={{ color: 'var(--faint)' }}>{plural(w.usuarios, 'miembro')} · {plural(w.clientes, 'cliente')}</span>
            </>
          }
          acciones={
            <>
              {/* Un ancla de verdad y no un botón: el click normal entra en esta
                  pestaña —que es lo pedido— y ctrl+click abre el cliente en otra,
                  gratis. Un botón se come esos gestos, y son justo los que hacen
                  falta para mirar dos clientes a la vez. */}
              <a href={`/general?ws=${w.id}`} title={`Entrar a ${w.nombre}`} className="fw-entrar">
                <Icon name="eye" size={13} />Inspeccionar
              </a>
              <Dropdown
                value="" resetAfterSelect align="right" placeholder="Acciones"
                ariaLabel={`Acciones sobre ${w.nombre}`} disabled={accionando}
                buttonStyle={{ padding: '7px 11px', fontSize: 12.5, borderRadius: 9 }}
                options={opciones}
                onChange={onAccion}
              />
            </>
          }
        />
      }
      etiqueta={w.nombre}
      ancho={ANCHO}
      /* El MISMO alto fijo que la ficha de un cliente: son la misma pieza vista por dos
         roles, y una que encoja y la otra no sería la tercera forma de que estas dos
         pantallas se contradigan. Ver el prop `alto` de `Modal`. */
      alto="min(85vh, 720px)"
      /* ⚠️ ADENTRO VIVE EL TABLERO, Y EL TABLERO ABRE SUS PROPIOS MODALES. Sin esto la
         pila apaga esta ficha con `display:none` en cuanto se abre uno —y como ese
         modal es un DESCENDIENTE suyo, se apaga con ella: click en una tarea =
         pantalla en blanco. Es el mismo motivo por el que lo lleva la ficha de un
         cliente (ver `contenedores` en app/_components/pila-modales.ts). */
      contenedor
      onCerrar={onCerrar}
    >
      {tablero}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Modal>
  );
}

// ⚠️ Ningún backtick acá adentro: cierra la cadena a la mitad y la ruta contesta 200
// con el layout entero y sin cuerpo.
const CSS = `
/* El nombre: el mismo tamaño y peso que el de la ficha de un cliente, y sin ninguna
   caja — solo clickeando y escribiendo, que no parezca que haya un recuadro. */
.fw-nom{ font-size:20px; font-weight:670; letter-spacing:-.02em; line-height:1.2;
  color:var(--ink); overflow-wrap:anywhere; }
.fw-entrar{ display:inline-flex; align-items:center; gap:6px; flex:none;
  background:var(--primary); color:#fff; border:0; border-radius:9px; padding:7px 12px;
  font:inherit; font-size:12.5px; font-weight:600; text-decoration:none; white-space:nowrap; }
.fw-entrar:hover{ filter:brightness(1.06); color:#fff; }
`;
