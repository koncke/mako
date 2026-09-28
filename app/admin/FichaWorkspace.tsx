'use client';

// =============================================================================
// FichaWorkspace — el detalle de un cliente de la PLATAFORMA
// =============================================================================
// «El detail está mal, te había dicho que idéntico al del plan, solo que con más
// opciones para administrar al usuario» (28/09/2026).
//
// Lo que había era un `Modal` de 720 con el título «Equipo» y una lista adentro: no
// se parecía en nada al detalle de un proyecto del tablero, que es lo que el dueño
// tenía en la cabeza. Ahora es el MISMO contenedor y la MISMA cabecera —portada a
// sangre, marca cruzándola, cerrar como círculo oscuro, pastillas al hover, el
// nombre al lado de la marca—, y `CabeceraDetalle` es literalmente el mismo
// componente que monta el detalle del proyecto: no una copia de su diseño, que es lo
// que se queda viejo a la tercera edición.
//
// ⚠️ NO ES UN `Modal`, Y ESO ES PARTE DE «IDÉNTICO». El detalle del tablero no usa
// `app/_ui/Modal`: es su propio overlay, con la caja a 85vh, `overflow:hidden` y el
// filete de 4 px del color arriba. Montarlo adentro de `Modal` obligaba a pelearle el
// padding de la cabecera con un `:has()` —que es lo que hoy hace la ficha de un
// cliente en Customer Success— y el resultado nunca es el mismo píxel.
//
// ⚠️ `contenedor: true` EN LA PILA, y sin eso la pantalla queda en blanco. Adentro se
// abren el selector de portada y el de marca, que son DESCENDIENTES suyos en el DOM:
// sin declararlo, la pila apaga esta ficha con `display:none` en cuanto se abre uno y
// se lleva puesto al que se acaba de abrir. Está medido el 27/09 en la ficha de un
// cliente (ver `contenedores` en app/_components/pila-modales.ts).
//
// ⚠️ LO QUE SE ADMINISTRA NO SE INVENTÓ ACÁ: es exactamente lo que la pantalla ya
// ofrecía —el equipo con todos sus controles, el menú de acciones y «Inspeccionar»—
// más el nombre editable en el lugar, que reemplaza al diálogo de renombrar. El
// pedido decía «con MÁS opciones», así que perder una habría sido peor que no tocar
// nada.

import { useEffect, type ReactNode } from 'react';
import { CabeceraDetalle } from '@/app/_components/CabeceraDetalle';
import { EditableInline } from '@/app/_components/EditableInline';
import { useCapaModal } from '@/app/_components/pila-modales';
import { Icon } from '@/app/_components/icons';
import { Dropdown } from '@/app/components/Dropdown';
import { colorDe } from '@/app/_components/TarjetaEntidad';
import { capaDef } from '@/lib/capas';
import { MODAL_DETALLE } from '@/app/plan/board/piezas';
import { MONO, SANS, chip } from './estilos';
import type { Workspace } from './tipos';

export type CambioCara = {
  portada?: string | null;
  portadaY?: number | null;
  icono?: string | null;
  avatarY?: number | null;
};

export function FichaWorkspace({
  w, cara, opciones, accionando, onAccion, onNombre, onEncuadre,
  onAbrirPortada, onAbrirIcono, onCerrar, children,
}: {
  w: Workspace;
  /**
   * La cara de su ADMIN, como respaldo de la marca. `w.icono` le gana: es lo único
   * que alguien eligió a propósito para este cliente (mig 0179). Sin ninguna de las
   * dos van las iniciales sobre el color del nombre.
   */
  cara: string | null;
  opciones: { value: string; label: string; disabled?: boolean }[];
  accionando: boolean;
  onAccion: (v: string) => void;
  onNombre: (nombre: string) => void;
  /** Guardar el encuadre de la portada. Lo escribe el arrastre, no un selector. */
  onEncuadre: (y: number) => void;
  /**
   * Abrir cada selector. La ficha NO los monta: cuelgan de su ancla y su estado —qué
   * botón los abrió— vive en la pantalla, igual que en la ficha de un cliente. Si
   * vivieran acá adentro, cerrar la ficha los desmontaría a mitad de una elección.
   */
  onAbrirPortada: (ancla: HTMLElement) => void;
  onAbrirIcono: (ancla: HTMLElement) => void;
  onCerrar: () => void;
  /** El cuerpo: el equipo, que lo arma la pantalla porque es la que tiene sus datos. */
  children: ReactNode;
}) {
  // ⚠️ TODOS LOS HOOKS ARRIBA DE CUALQUIER RETURN. React #300 es la pantalla entera
  // en blanco, y el guard del pre-push existe justamente por eso.
  const capa = useCapaModal(true, { contenedor: true });
  const arriba = capa.esElDeArriba;

  // Se pregunta en el MOMENTO de la tecla (es una función, no un boolean): así el
  // handler no tiene dependencias y no se re-registra cada vez que algo se abre
  // encima. Mismo patrón que el detalle del tablero.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && arriba()) { (document.activeElement as HTMLElement)?.blur?.(); onCerrar(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCerrar, arriba]);

  const color = colorDe(w.nombre);
  const esDueno = w.id === 1;

  return (
    <div onClick={onCerrar} style={{
      position: 'fixed', inset: 0, zIndex: capa.z, background: 'rgba(18,21,27,.35)',
      backdropFilter: 'blur(2px)', display: capa.visible ? 'flex' : 'none',
      alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 16px 16px', fontFamily: SANS,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        // ⚠️ EL ANCHO SE IMPORTA, no se copia. Es `MODAL_DETALLE` (820), la misma
        // constante que usa el detalle de un proyecto: escribir el número acá sería
        // la cuarta copia de «idéntico al del plan», y la que se queda vieja.
        width: '100%', maxWidth: MODAL_DETALLE, height: '85vh', background: 'var(--surface)',
        border: '1px solid var(--border)', borderTop: `4px solid ${color}`, borderRadius: 16,
        boxShadow: '0 24px 60px rgba(18,21,27,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <CabeceraDetalle
          nombre={w.nombre}
          color={color}
          portada={w.portada} portadaY={w.portada_y}
          onPortada={onAbrirPortada}
          onEncuadre={onEncuadre}
          icono={w.icono} foto={cara} avatarY={w.avatar_y} cuadrado
          onIcono={onAbrirIcono}
          onCerrar={onCerrar}
          kicker={
            <>
              <span style={{ fontFamily: MONO, fontSize: 11, color, fontWeight: 700 }}>{w.slug ?? `ws-${w.id}`}</span>
              {esDueno && <span style={chip('var(--accent-soft)', '#171511')}>Dueño</span>}
              <span style={chip('var(--primary-bg)', 'var(--primary)')}>{capaDef(w.capa).nombre}</span>
              {w.estado === 'pausado' && <span style={chip('var(--surface-2)', 'var(--dim)')}>pausado</span>}
            </>
          }
          titulo={
            // ⚠️ EL NOMBRE SE EDITA ACÁ, EN EL LUGAR, y con eso se va el diálogo de
            // «Renombrar…»: dos caminos al mismo hecho es cómo uno de los dos se queda
            // viejo, y el otro además nunca se registró en la pila de modales.
            <EditableInline
              valor={w.nombre}
              placeholder="Sin nombre"
              titulo="Edita el nombre del cliente"
              className="fw-nom"
              onGuardar={onNombre} />
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

        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', padding: '20px 22px' }}>
          {children}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO: cierra la cadena a la mitad y la ruta contesta 200
// con el layout entero y sin cuerpo.
const CSS = `
/* El nombre: el mismo tamaño y peso que el título de un proyecto en su detalle, y sin
   ninguna caja — la regla ya escrita para la ficha de un cliente: «solo clickeando y
   escribiendo, que no parezca que haya un recuadro de texto». */
.fw-nom{ font-size:20px; font-weight:670; letter-spacing:-.02em; line-height:1.2;
  color:var(--ink); overflow-wrap:anywhere; }
.fw-entrar{ display:inline-flex; align-items:center; gap:6px; flex:none;
  background:var(--primary); color:#fff; border:0; border-radius:9px; padding:7px 12px;
  font:inherit; font-size:12.5px; font-weight:600; text-decoration:none; white-space:nowrap; }
.fw-entrar:hover{ filter:brightness(1.06); color:#fff; }
`;
