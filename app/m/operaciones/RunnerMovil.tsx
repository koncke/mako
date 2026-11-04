'use client';

// =============================================================================
// Los Runners en el teléfono: cuál está activo, y el Token de ESTE teléfono (15/10/2026)
// =============================================================================
// Lo mismo que el modal «Runners» de la computadora (app/admin/operaciones/PanelRunner.tsx, copiado de GitHub →
// Actions → Runners), destilado: un renglón por Runner con su estado, y el Token de este teléfono. El alta de un
// Runner (su chat y su token) se hace en la computadora, donde está la app de Claude. El color va en el punto de
// la píldora, nunca en el texto (app/m/_ui/LEEME.md).
//
// ⚠️ Cada texto dice qué hacer y para qué (Martín, 15/10/2026: «Jamás pongas mensajes no claros»).
// ⚠️ La hora relativa se calcula con el `ahora` de afuera, no con Date.now() en el render: el HTML del server y
// la hidratación tienen que decir lo mismo.

import { FilaM, ListaM, PildoraM, SeccionM, VacioM } from '@/app/m/_ui';
import type { CarteroP } from '@/lib/centro-chats';
import type { ClaveDispositivo } from '@/app/admin/operaciones/clave-dispositivo';
import { ListaUso, type CuentaUso, type RenombrarCuenta } from '@/app/admin/operaciones/Uso';
import { SeccionCredito, type CambiarCredito, type LeerCredito } from '@/app/admin/operaciones/UsoCredito';
import { cuentasDeUso } from '@/lib/centro-uso';
import type { EstadoPc } from '@/lib/centro-chats';

export function RunnerMovil({ carteros, clave, ahora, onCrearClave, onCopiarClave, cuentas, pc, onRenombrar, onLeerCredito, onCambiarCredito }: {
  carteros: CarteroP[] | null;
  /** El crédito de API de los planes (la sección «API» de la computadora, UsoCredito.tsx): se pide al abrir la hoja. */
  onLeerCredito?: LeerCredito;
  /** El interruptor del crédito asignado a un negocio (el ws1), como en la computadora. */
  onCambiarCredito?: CambiarCredito;
  /** Las cuentas del Uso con su nombre y su email (la G); sin esto, las de los Runners con «Cuenta N». */
  cuentas?: readonly CuentaUso[];
  /** El estado de la PC (31/10/2026, `estadoDeLaPc`): adentro del Uso, como en la computadora. */
  pc?: EstadoPc | null;
  onRenombrar?: RenombrarCuenta;
  clave: ClaveDispositivo | null | undefined;
  ahora: number;
  onCrearClave: () => void;
  onCopiarClave: () => void;
}) {
  const aceptada = !!clave && (carteros ?? []).some((k) => (k.claves ?? []).includes(clave.id));
  return (
    <>
      {/* El Uso de las CUATRO cuentas, lo primero (Martín: «Falta el poder visualizar el USO», «Tampoco sale el uso de las
          otras 2 cuentas»): la misma pieza que la computadora; la cuenta sin Runner sale igual, diciendo «Sin Runner todavía». */}
      {carteros && (
        <SeccionM titulo="Cuentas de Claude Code">
          <ListaUso cuentas={cuentas ?? cuentasDeUso(carteros)} ahora={ahora} pc={pc} onRenombrar={onRenombrar} />
        </SeccionM>
      )}
      {!carteros && <VacioM frase="No pude leer el Uso: reintenta en un momento." />}
      {/* La API (22/10/2026, Martín: «En USO de SuperAdmin quiero ver también el USO de la API»): la misma pieza que la
          computadora, debajo de las cuentas. */}
      {onLeerCredito && <SeccionCredito leer={onLeerCredito} cambiar={onCambiarCredito} cuentas={cuentas ?? cuentasDeUso(carteros ?? [])} />}
      {/* Sin las computadoras de los CLIENTES desde el 23/10/2026 (Martín: «estas cruzando workspace»): van en su ficha. */}
      {/* Sin la sección «N de N activos» desde el 17/10/2026 (Martín: aparecía duplicado; el número ya está en la fila «Uso y
          Runners» de arriba, y cada cuenta del Uso dice «Runner activo» o «Runner sin conexión»). */}
      <SeccionM titulo="Este teléfono">
        <ListaM etiqueta="Este teléfono">
          {clave === null && <FilaM icono="config" titulo="Crea tu Token para comenzar a chatear" segunda="Crear Token" onClick={onCrearClave} />}
          {clave && (
            <FilaM
              icono="copy"
              titulo={aceptada ? 'Tu Token' : 'Pégale tu Token al Runner para comenzar a chatear'}
              segunda="Copiar Token"
              pill={aceptada ? <PildoraM tono="good">Activo</PildoraM> : undefined}
              onClick={onCopiarClave}
            />
          )}
        </ListaM>
      </SeccionM>
    </>
  );
}
