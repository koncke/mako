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
import { avisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso';

// `colorDe` vivía acá y se fue con el molde, porque lo usan las dos pantallas. Se
// re-exporta para no tocar a los tres que ya lo importaban de este archivo (la
// tabla, la ficha y el picker de clientes del tablero).
export { colorDe };

export function ClienteCard({ c, n, trabajo, tableroOk, cuentas, chipExtra, accionExtra, onAbrir, onEquipo, onError }: {
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
  onAbrir: () => void;
  /** Abre la ficha directamente en la tab «Equipo». */
  onEquipo: () => void;
  onError: (m: string) => void;
}) {
  const nombre = c.nombre.trim() || 'Sin nombre';
  const ws = c.clienteWs ?? null;
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
  const opciones = [
    // Sólo con una cuenta abierta Y alguien adentro: reenviarle el acceso a nadie no es
    // una opción, es un botón que contesta un error.
    ...(ws && admin ? [{ value: 'reinvitar', label: `Reenviar el acceso a ${admin.nombre}` }] : []),
    ...(equipo?.length ? [{ value: 'equipo', label: `Ver su equipo (${equipo.length})` }] : []),
  ];

  const [reenviando, setReenviando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'warn'; texto: string } | null>(null);

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
    if (v === 'reinvitar') { void reinvitar(); return; }
    if (v === 'equipo') onEquipo();
  };

  return (
    <TarjetaEntidad
      nombre={nombre}
      bajada={c.empresa?.trim() || `Cliente ${n}`}
      portada={c.portada} portadaY={c.portadaY}
      icono={c.icono ?? c.avatarUrl} avatarY={c.avatarY}
      color={colorDe(nombre)}
      onAbrir={onAbrir}
      etiqueta={`Abrir la ficha de ${nombre}`}
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
        </>
      }
      /* ⚠️ SÓLO PARA QUIEN PUEDE HACER ALGO CON ELLOS. `cuentas.visible` lo decide el
         SERVER (page.tsx): una agencia habilitada y el super admin. Dibujarlos para un
         cliente común sería ofrecerle entrar a una cuenta que no existe. */
      acciones={cuentas?.visible || accionExtra ? (
        <>
          {cuentas?.visible && <CuentaDeMaKo c={c} cuentas={cuentas} onError={onError} variante="boton" />}
          <span style={{ flex: 1 }} />
          {/* ⚠️ SIN OPCIONES NO SE DIBUJA. `Dropdown` no tiene rama de lista vacía: con
              `options={[]}` igual pinta el botón y abre un popover en blanco, que se lee
              como una app rota. Pasa de verdad — un cliente sin cuenta y sin equipo no
              tiene ninguna. */}
          {cuentas?.visible && opciones.length > 0 && (
            <Dropdown
              value="" resetAfterSelect align="right" placeholder="Acciones"
              ariaLabel={`Acciones sobre ${nombre}`} disabled={reenviando}
              buttonStyle={{ padding: '7px 11px', fontSize: 12.5, borderRadius: 9 }}
              options={opciones}
              onChange={elegir}
            />
          )}
          {accionExtra}
        </>
      ) : undefined}
    />
  );
}
