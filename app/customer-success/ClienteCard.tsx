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
// fila. Proyectos · abiertas · se repiten es exactamente lo que la ficha va a
// mostrar al abrirse, así que la tarjeta no puede prometer algo que adentro no
// está.

import type { ClienteCruce } from './cruce';
import type { ResumenTrabajo } from './trabajo';
import { TarjetaEntidad, PieNumeros, PieTexto, colorDe } from '@/app/_components/TarjetaEntidad';
import { Dropdown } from '@/app/components/Dropdown';
import { CuentaDeMaKo, type CuentasProp } from './CuentaDeMaKo';

// `colorDe` vivía acá y se fue con el molde, porque lo usan las dos pantallas. Se
// re-exporta para no tocar a los tres que ya lo importaban de este archivo (la
// tabla, la ficha y el picker de clientes del tablero).
export { colorDe };

export function ClienteCard({ c, n, trabajo, tableroOk, cuentas, onAbrir, onEquipo, onError }: {
  c: ClienteCruce;
  /** Su número de cliente: «Cliente 1». No es el id del lead — ver `NumeroCliente`. */
  n: number;
  trabajo: ResumenTrabajo | null;
  tableroOk: boolean;
  /** Quién ve «Inspeccionar», el plan de cada cuenta y su equipo. Sin esto no hay
   *  botonera: un cliente común no tiene nada que inspeccionar. */
  cuentas?: CuentasProp;
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
   * Lo que «Acciones» ofrece, y NADA que la tarjeta ya conteste.
   *
   * ⚠️ NO HAY «Ver su ficha»: eso lo hace el click en la tarjeta, y un control nuevo
   * que contesta una pregunta ya contestada no suma una opción — parte la respuesta
   * en dos. Y no hay ninguna que lleve a una pantalla inventada: el CRM de este lead
   * existe (`/crm/<id>`, el mismo link que su ficha), y «su equipo» sólo aparece
   * cuando de verdad hay gente que mostrar.
   */
  const opciones = [
    { value: 'crm', label: 'Abrir en el CRM' },
    ...(equipo?.length ? [{ value: 'equipo', label: `Ver su equipo (${equipo.length})` }] : []),
  ];

  const elegir = (v: string) => {
    if (v === 'crm') { window.location.href = `/crm/${c.leadId}`; return; }
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
      chips={plan ? <span className="cl-plan">{plan}</span> : undefined}
      /* ⚠️ LOS TRES NÚMEROS O NINGUNO. Cuando el tablero no se pudo leer, poner
         ceros sería afirmar que no tiene trabajo — que es distinto de no haber
         podido mirar. */
      pie={tableroOk ? (
        <PieNumeros datos={[
          { v: trabajo?.proyectos ?? 0, k: 'Proyectos' },
          { v: trabajo?.abiertas ?? 0, k: 'Abiertas' },
          { v: trabajo?.recurrentes ?? 0, k: 'Se repiten' },
        ]} />
      ) : (
        <PieTexto mal>No pude leer el tablero</PieTexto>
      )}
      /* ⚠️ SÓLO PARA QUIEN PUEDE HACER ALGO CON ELLOS. `cuentas.visible` lo decide el
         SERVER (page.tsx): una agencia habilitada y el super admin. Dibujarlos para un
         cliente común sería ofrecerle entrar a una cuenta que no existe. */
      acciones={cuentas?.visible ? (
        <>
          <CuentaDeMaKo c={c} cuentas={cuentas} onError={onError} variante="boton" />
          <span style={{ flex: 1 }} />
          <Dropdown
            value="" resetAfterSelect align="right" placeholder="Acciones"
            ariaLabel={`Acciones sobre ${nombre}`}
            buttonStyle={{ padding: '7px 11px', fontSize: 12.5, borderRadius: 9 }}
            options={opciones}
            onChange={elegir}
          />
        </>
      ) : undefined}
    />
  );
}
