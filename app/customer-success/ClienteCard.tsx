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

import { useState, type ReactNode } from 'react';
import type { ClienteCruce } from './cruce';
import type { ResumenTrabajo } from './trabajo';
import { TarjetaEntidad, PieNumeros, PieTexto, colorDe } from '@/app/_components/TarjetaEntidad';
import { Dropdown } from '@/app/components/Dropdown';
import { CuentaDeMaKo, type CuentasProp } from './CuentaDeMaKo';
import { useFotoCliente } from './foto-cliente';
import { avisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso';
import { ModalInvitar } from './curso/InvitarAlCurso';
import { opcionesDeCursoEnTarjeta, type AccesoFicha, type AccesoInvitacion } from './curso-ficha-lectura';

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

export function ClienteCard({ c, n, trabajo, tableroOk, cuentas, chipExtra, accionExtra, antesDelNombre, onAbrir, onEquipo, onError, curso, onPermisos }: {
  c: ClienteCruce;
  /** Su número de cliente: «Cliente 1». No es el id del lead — ver `NumeroCliente`. */
  n: number;
  trabajo: ResumenTrabajo | null;
  tableroOk: boolean;
  /** Quién ve «Inspeccionar», el plan de cada cuenta y su equipo. Sin esto no hay
   *  botonera: un cliente común no tiene nada que inspeccionar. */
  cuentas?: CuentasProp;
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
  /** Abre la ficha directamente en la tab «Equipo». */
  onEquipo: () => void;
  onError: (m: string) => void;
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
   * ⚠️ TODO LO DE LA CUENTA DE MaKo CUELGA DE `cuentas.visible`, Y DE NADA MÁS. «La tab de
   * "Equipo" y en general todo lo que tenga que ver con invitar a MaKo, debería solo verse
   * si la cuenta es AGENCIA, sino, no deberían estar esas opciones» (Martín, 05/10/2026).
   * Quién es agencia lo decide el SERVER (`cuentas.visible`, app/customer-success/page.tsx);
   * acá se aplica en UN lugar: sin él no hay cuenta del cliente que mirar, así que no hay
   * plan, ni equipo, ni «Reenviar el acceso», ni «Ver su equipo», ni el control de la
   * cuenta.
   *
   * ⛔ ANTES el chip del PLAN y el equipo se leían de `planPorWs`/`equipoPorWs` sin mirar
   * `visible`: el menú sí lo miraba, el chip no. Hoy esos mapas llegan vacíos cuando no hay
   * cartera aprobada, así que no se veía — pero eso es cómo los arma el server, no una regla
   * de la tarjeta. El día que un mapa llegue con algo sin `visible`, el chip aparecía solo.
   */
  const conCuentas = cuentas?.visible === true;
  const ws = conCuentas ? (c.clienteWs ?? null) : null;
  const plan = ws ? cuentas?.planPorWs?.[ws] : undefined;
  const equipo = ws ? cuentas?.equipoPorWs?.[ws] : undefined;

  /**
   * Lo que «Acciones» ofrece: GESTIONAR LA CUENTA, y nada que ya esté a un click.
   *
   * ⚠️ ACÁ ESTABA «Abrir en el CRM» Y SE FUE (29/09/2026). El reporte fue textual: «no
   * entiendo que en las acciones de Agencia pusiste Abrir el CRM, no tiene sentido eso…
   * ¿qué tiene que ver con abrir CRM? Si eso está dentro del detail». Tenía razón dos
   * veces: el mismo link vive adentro de la ficha que abre el click en la tarjeta, y un
   * menú que se llama «Acciones» y sólo sabe navegar no ofrece ninguna.
   *
   * ⚠️ NO HAY «Ver su ficha» por el mismo motivo: eso lo hace el click en la tarjeta, y
   * un control que contesta una pregunta ya contestada no suma una opción, parte la
   * respuesta en dos.
   *
   * ⚠️ Y NO HAY «Pausar la cuenta», que él nombró como ejemplo. No es que falte el
   * endpoint —falta, `workspaces.estado` sólo lo escribe /api/admin/workspaces bajo
   * super admin— sino que antes hay una decisión de producto: pausar es la palanca de
   * COBRO de la plataforma. Si la agencia paga por su cartera, puede; si paga el
   * cliente, dársela a la agencia es dejar que un tercero le corte el acceso a alguien
   * que le paga a MaKo. Queda sin hacer y dicho, no hecho a medias.
   */
  const admin = equipo?.find((u) => u.rol === 'admin') ?? equipo?.[0];
  /**
   * ⚠️ UNA CUENTA ABIERTA A LA QUE NO PUEDE ENTRAR NADIE (09/10/2026). «No se le envió la
   * invitación a Brigitte, ella no puede acceder a su propio workspace» (Joan, vía Martín).
   * Medido: el ws15 tiene CERO usuarios desde el 28/09 —nació antes de que abrir una cuenta
   * pidiera el email— así que no había a quién mandarle nada. Y la tarjeta no lo decía: con
   * nadie adentro no hay «Reenviar el acceso» ni «Ver su equipo», y lo único que quedaba era
   * «Inspeccionar», que se lee como «está todo bien».
   *
   * `equipo` es `[]` SÓLO si la lectura anduvo (page.tsx siembra la lista vacía); sin
   * entrada es «no pude mirar», y ahí no se afirma nada.
   */
  const sinNadie = Boolean(ws && equipo && equipo.length === 0);
  /** Quién puede hacer algo al respecto desde la tab Equipo: la agencia PIDE, el super admin SUMA. */
  const puedeSumarAlguien = Boolean(cuentas?.superAdmin || cuentas?.puedePedirAltas);
  /**
   * ⚠️ LAS DEL CURSO NO CUELGAN DE `conCuentas` (07/10/2026). Hasta acá el menú —y la fila de
   * acciones entera— existía sólo para una AGENCIA, porque lo único que ofrecía era gestionar una
   * cuenta de MaKo. Invitar al curso es otra cosa: no crea cuenta ni workspace (lib/curso-invitar.ts),
   * así que lo tiene cualquier negocio con la tab, agencia o no. Las de cuenta siguen atadas a
   * `conCuentas`; éstas, a que el producto tenga curso (`curso`). La regla (cortado no ofrece
   * invitar, sin leer tampoco) vive en `opcionesDeCursoEnTarjeta`, que tiene test.
   */
  const opciones: Array<{ value: string; label: string }> = [
    ...opcionesDeCursoEnTarjeta(curso, Boolean(onPermisos)),
    // Sólo con una cuenta abierta Y alguien adentro: reenviarle el acceso a nadie no es
    // una opción, es un botón que contesta un error.
    ...(ws && admin ? [{ value: 'reinvitar', label: `Reenviar el acceso a ${admin.nombre}` }] : []),
    ...(equipo?.length ? [{ value: 'equipo', label: `Ver su equipo (${equipo.length})` }] : []),
    // Sin nadie adentro, la acción que falta: abre la tab Equipo, donde está el formulario
    // (el mismo rótulo que su botón, porque no pasa lo mismo: la agencia pide, él suma).
    ...(sinNadie && puedeSumarAlguien
      ? [{ value: 'equipo', label: cuentas?.superAdmin ? 'Sumar a alguien' : 'Pedir sumar a alguien' }]
      : []),
  ];

  const [reenviando, setReenviando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'warn'; texto: string } | null>(null);
  /** El modal de invitar al curso, abierto desde el menú. Se monta al abrirse (cada apertura arranca de cero). */
  const [invitando, setInvitando] = useState(false);

  const reinvitar = async () => {
    if (!ws || !admin || reenviando) return;
    setReenviando(true); setAviso(null);
    try {
      const r = await fetch('/api/agencia/reinvitar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteWs: ws, usuarioId: admin.id }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; invitacion?: ResultadoInvitacion };
      if (!j.ok) { onError(j.error ?? 'No se pudo reenviar el acceso.'); return; }
      // El resultado del ENVÍO, que no es el de la llamada: `invitarPorEmail` nunca tira
      // y devuelve si salió. Un «listo» mudo no distingue «se le mandó» de «no salió».
      setAviso(avisoInvitacion(j.invitacion, admin.email));
    } catch {
      onError('No se pudo reenviar el acceso.');
    } finally { setReenviando(false); }
  };

  const elegir = (v: string) => {
    if (v === 'curso-invitar') { setAviso(null); setInvitando(true); return; }
    if (v === 'curso-permisos') { onPermisos?.(); return; }
    if (v === 'reinvitar') { void reinvitar(); return; }
    if (v === 'equipo') onEquipo();
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
      /* El PLAN de su cuenta de MaKo, cuando tiene una. «Estas tarjetas de clientes
         también deben tener el plan, cada uno, con normalidad» (27/09/2026) — es el
         mismo chip que la grilla de la plataforma, sacado de la misma `capaDef`. */
      chips={plan || chipExtra ? (
        <>
          {plan && <span className="cl-plan">{plan}</span>}
          {chipExtra}
        </>
      ) : undefined}
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
          {sinNadie && !aviso && <PieTexto mal>Nadie puede entrar todavía</PieTexto>}
        </>
      }
      /* ⚠️ SÓLO PARA QUIEN PUEDE HACER ALGO CON ELLOS. Lo de la CUENTA cuelga de `cuentas.visible`
         (lo decide el SERVER, page.tsx: que este workspace sea una AGENCIA); lo del CURSO, de que el
         producto tenga curso. La fila existe si hay alguna de las dos — sin ninguna, una fila vacía
         con un menú sin opciones es una tarjeta que ofrece algo que no tiene. */
      acciones={conCuentas || accionExtra || opciones.length > 0 ? (
        <>
          {conCuentas && cuentas && <CuentaDeMaKo c={c} cuentas={cuentas} onError={onError} variante="boton" />}
          <span style={{ flex: 1 }} />
          {/* ⚠️ SIN OPCIONES NO SE DIBUJA. `Dropdown` no tiene rama de lista vacía: con
              `options={[]}` igual pinta el botón y abre un popover en blanco, que se lee
              como una app rota. Pasa de verdad — un cliente sin cuenta, sin equipo y sin
              curso no tiene ninguna. */}
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
                ariaLabel={`Acciones sobre ${nombre}`} disabled={reenviando}
                buttonStyle={{ padding: '7px 11px', fontSize: 12.5, borderRadius: 9 }}
                options={opciones}
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
