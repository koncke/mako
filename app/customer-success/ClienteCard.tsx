'use client';

// =============================================================================
// ClienteCard — un cliente, sobre el molde compartido
// =============================================================================
// La FORMA de la tarjeta —banda, marca montada sobre ella, nombre con su bajada y
// los números al pie separados por filetes, todo salido de una referencia que pasó
// el dueño el 26/09/2026— se mudó a `app/_components/TarjetaEntidad.tsx` el
// 27/09, cuando pidió que la vista de /admin fuera «exactamente igual que la vista
// de clientes que construimos». Allá está el porqué de cada decisión de forma.
//
// Acá queda lo que es DE UN CLIENTE: de dónde sale cada dato y qué tres números
// van al pie.
//
// ⚠️ LOS TRES NÚMEROS SON LOS DEL TABLERO y no unos inventados para llenar la
// fila. Proyectos · Tareas · Recurrentes es exactamente lo que la ficha va a
// mostrar al abrirse, así que la tarjeta no puede prometer algo que adentro no
// está.
//
// ⚠️ «Tareas» CUENTA LAS ABIERTAS Y NO EL TOTAL, y el rótulo no lo dice. Es una
// decisión del dueño («cambia el "Abiertas" por "Tareas"», 29/09/2026) y se
// respeta en las tres superficies —tarjeta, tabla y CSV— porque el problema de
// que un rótulo mienta un poco es chico al lado del de que tres pantallas
// cuenten lo mismo con nombres distintos. El campo sigue siendo `abiertas`.
//
// ⚠️ SIN NADA DE LA CUENTA DE MaKo DESDE EL 17/10/2026 (el plan, «Inspeccionar», «Reenviar el acceso», «Ver su
// equipo», «Nadie puede entrar»): un cliente de la entrega no es un cliente de la agencia, «podrían serlo como no».
// Todo eso vive en MaKo Partners (app/partners/PartnersApp.tsx), que lo lee para la agencia que mira.

import { useState, type ReactNode } from 'react';
import type { ClienteCruce } from './cruce';
import type { ResumenTrabajo } from './trabajo';
import { TarjetaEntidad, PieNumeros, PieTexto, colorDe } from '@/app/_components/TarjetaEntidad';
import { Dropdown } from '@/app/components/Dropdown';
import { conIconos, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { useFotoCliente } from './foto-cliente';
import { ModalInvitar } from './curso/InvitarAlCurso';
import { opcionesDeCursoEnTarjeta, type AccesoFicha, type AccesoInvitacion } from './curso-ficha-lectura';

/** El ícono de cada acción del menú de la tarjeta (sexta tanda, general 10). Las listas las arma
 *  `opcionesDeCursoEnTarjeta` (pura, con test) y esta tarjeta; el ícono es cosa de la pantalla. */
const ICONOS_ACCIONES: Record<string, NombreIconoMenu> = {
  'curso-invitar': 'curso', 'curso-permisos': 'llave',
};

// `colorDe` vivía acá y se fue con el molde, porque lo usan las dos pantallas. Se
// re-exporta para no tocar a los tres que ya lo importaban de este archivo (la
// tabla, la ficha y el picker de clientes del tablero).
export { colorDe };

/**
 * El curso de ESTE cliente, como lo ofrece la tarjeta: su acceso y qué hacer cuando cambia.
 *
 * Lo arma la pantalla (ClientesApp) SÓLO si el producto que se mira tiene clases: sin curso no hay
 * a qué invitar, y una opción cuya única respuesta es «sus productos no tienen clases» se lee como
 * que la app está rota. `acceso: null` = no se pudo leer su acceso: se ofrecen los permisos pero NO
 * invitar (no se invita a ciegas: podría ser un segundo mail a alguien ya invitado).
 */
export type CursoDeTarjeta = {
  /** Su acceso, ya mirado desde el curso de este tablero (`accesoEnProducto`, ClientesApp). */
  acceso: AccesoInvitacion | null;
  /**
   * El producto del tablero (puntos 6 y 7 del audio del 08/10 a la noche): «Invitar al curso» invita a
   * ESTE curso — el mail nombra sólo éste y el acceso pasa a abrirlo. Sin él se invitaba a todos.
   */
  productoId: number;
  /** El acceso como quedó después de invitar (lo releyó el server). */
  onAcceso: (a: AccesoFicha) => void;
};

export function ClienteCard({ c, n, trabajo, tableroOk, chipExtra, accionExtra, antesDelNombre, onAbrir, curso, onPermisos }: {
  c: ClienteCruce;
  /** Su número de cliente: «Cliente 1». No es el id del lead — ver `NumeroCliente`. */
  n: number;
  trabajo: ResumenTrabajo | null;
  tableroOk: boolean;
  /**
   * Un chip más al lado del nombre, puesto por la pantalla que monta la tarjeta.
   *
   * Lo usa el kanban de la entrega para «hace 3 días» / «21 días sin moverse», que es
   * el dato que esa pantalla existe para mirar y que no es del cliente sino de DÓNDE
   * ESTÁ: la misma persona tiene un «hace cuánto» distinto en cada servicio.
   */
  chipExtra?: ReactNode;
  /**
   * Un control más en la fila de acciones.
   *
   * ⚠️ TIENE QUE IR EN ESA FILA Y NO EN CUALQUIER LADO. `TarjetaEntidad` pone todo su
   * contenido en `pointer-events: none` para que el click en cualquier parte abra la
   * ficha, y `.cl-acc` es lo ÚNICO que los vuelve a aceptar: un botón fuera de ahí se
   * dibuja y no se puede apretar. Medido en el navegador el 05/10/2026.
   *
   * ⚠️ Y ES `flex: none` Y CORTO: esa fila es `nowrap`, así que un hijo ancho la
   * desborda en vez de bajar a su renglón.
   */
  accionExtra?: ReactNode;
  /**
   * Algo pegado adelante del nombre, en su renglón: la casilla de selección del kanban.
   * Pasa derecho a `TarjetaEntidad`, que es la que sabe cómo hacerle lugar sin correr el
   * nombre en reposo y cómo devolverle los clicks (ver su `antesDelNombre`).
   */
  antesDelNombre?: ReactNode;
  onAbrir: () => void;
  /**
   * El curso del cliente (item 9, 07/10/2026): «En cada cliente del kanban se debería poder invitar
   * al curso». Con esto el menú suma «Invitar al curso» (o «Reenviar invitación») y «Permisos del
   * curso». Ausente = el producto no tiene curso: el menú no ofrece nada del curso.
   */
  curso?: CursoDeTarjeta | null;
  /** «Permisos del curso»: abre la ficha en su pestaña Curso, donde viven (FichaCurso). */
  onPermisos?: () => void;
}) {
  const nombre = c.nombre.trim() || 'Sin nombre';
  /** Su WhatsApp o su email, si nadie le eligió una foto (./foto-cliente.ts). */
  const fotoAuto = useFotoCliente(c);
  /**
   * Lo que «Acciones» ofrece: lo del CURSO (07/10/2026), que tiene cualquier negocio con la tab, agencia o no: invitar
   * no crea cuenta ni workspace (lib/curso-invitar.ts). La regla (cortado no ofrece invitar, sin leer tampoco) vive en
   * `opcionesDeCursoEnTarjeta`, que tiene test.
   *
   * ⚠️ ACÁ ESTABA «Abrir en el CRM» Y SE FUE (29/09/2026): el mismo link vive adentro de la ficha que abre el click en
   * la tarjeta, y un menú que se llama «Acciones» y sólo sabe navegar no ofrece ninguna. Tampoco hay «Ver su ficha»:
   * eso lo hace el click.
   */
  const opciones: Array<{ value: string; label: string }> = [
    ...opcionesDeCursoEnTarjeta(curso, Boolean(onPermisos)),
  ];

  const [aviso, setAviso] = useState<{ tono: 'ok' | 'warn'; texto: string } | null>(null);
  /** El modal de invitar al curso, abierto desde el menú. Se monta al abrirse (cada apertura arranca de cero). */
  const [invitando, setInvitando] = useState(false);

  const elegir = (v: string) => {
    if (v === 'curso-invitar') { setAviso(null); setInvitando(true); return; }
    if (v === 'curso-permisos') { onPermisos?.(); return; }
  };

  return (
    <>
    <TarjetaEntidad
      nombre={nombre}
      bajada={c.empresa?.trim() || `Cliente ${n}`}
      portada={c.portada} portadaY={c.portadaY}
      icono={c.icono ?? c.avatarUrl} avatarY={c.avatarY} foto={fotoAuto}
      color={colorDe(nombre)}
      onAbrir={onAbrir}
      etiqueta={`Abrir la ficha de ${nombre}`}
      antesDelNombre={antesDelNombre}
      chips={chipExtra}
      /* ⚠️ LOS TRES NÚMEROS O NINGUNO. Cuando el tablero no se pudo leer, poner
         ceros sería afirmar que no tiene trabajo — que es distinto de no haber
         podido mirar. */
      pie={
        <>
          {tableroOk ? (
            <PieNumeros datos={[
              { v: trabajo?.proyectos ?? 0, k: 'Proyectos' },
              { v: trabajo?.abiertas ?? 0, k: 'Tareas' },
              { v: trabajo?.recurrentes ?? 0, k: 'Recurrentes' },
            ]} />
          ) : (
            <PieTexto mal>No pude leer el tablero</PieTexto>
          )}
          {/* El resultado del reenvío, adentro de la tarjeta desde la que se pidió: un
              aviso global obligaría a acordarse de sobre cuál se hizo click. Y va acá y
              no en `acciones` porque esa fila es nowrap — un tercer hijo ancho la
              desborda en vez de bajar a su renglón. */}
          {aviso && <PieTexto mal={aviso.tono === 'warn'}>{aviso.texto}</PieTexto>}
        </>
      }
      /* ⚠️ SÓLO SI HAY ALGO QUE HACER: lo del curso (que el producto tenga curso) o lo que pone la pantalla. Sin
         ninguna, una fila vacía con un menú sin opciones es una tarjeta que ofrece algo que no tiene. */
      acciones={accionExtra || opciones.length > 0 ? (
        <>
          <span style={{ flex: 1 }} />
          {/* ⚠️ SIN OPCIONES NO SE DIBUJA. `Dropdown` no tiene rama de lista vacía: con
              `options={[]}` igual pinta el botón y abre un popover en blanco, que se lee
              como una app rota. Pasa de verdad — un cliente sin curso no tiene ninguna. */}
          {/* ⚠️ EL MENÚ NO ARRASTRA: en el kanban la tarjeta entera es `draggable`, y apretar
              «Acciones» y correr un poco el mouse se llevaba la tarjeta. Lo corta `data-nodrag`,
              que mira `agarrar` (KanbanEntrega) con el nodo donde nació el gesto. ⛔ Acá había un
              `onDragStart` que lo cancelaba y no corría NUNCA: el `dragstart` sale del nodo
              arrastrable (el envoltorio), no de un hijo (revisión del 08/10/2026).
              `onPointerDown` frenado como la casilla de selección. `display: contents` para no
              meter una caja en la fila `nowrap`, que desbordaría. */}
          {opciones.length > 0 && (
            <span style={{ display: 'contents' }} data-nodrag
              onPointerDown={(e) => e.stopPropagation()}>
              <Dropdown
                value="" resetAfterSelect align="right" placeholder="Acciones"
                ariaLabel={`Acciones sobre ${nombre}`}
                buttonStyle={{ padding: '7px 11px', fontSize: 12.5, borderRadius: 9 }}
                options={conIconos(opciones, ICONOS_ACCIONES)}
                onChange={elegir}
              />
            </span>
          )}
          {accionExtra}
        </>
      ) : undefined}
    />
    {/* EL MODAL DE INVITAR va AFUERA de la tarjeta en el árbol y por portal en el DOM
        (`ModalInvitar` se portalea solo al body): adentro de la tarjeta heredaría su
        `pointer-events: none` y, en el kanban, su `overflow: hidden`. */}
    {invitando && curso && (
      <ModalInvitar leadId={c.leadId} nombre={nombre} emailCrm={c.email} acceso={curso.acceso} productoId={curso.productoId}
        onCerrar={() => setInvitando(false)}
        onEnviada={() => setAviso({ tono: 'ok', texto: 'Invitación enviada.' })}
        onListo={(a, av) => { if (a) curso.onAcceso(a); if (av) setAviso(av); }} />
    )}
    </>
  );
}
