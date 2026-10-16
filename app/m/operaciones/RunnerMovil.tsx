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
import { carteroVivo } from '@/lib/operaciones-reglas';
import { nombreCuenta, type CarteroP } from '@/lib/centro-chats';
import type { ClaveDispositivo } from '@/app/admin/operaciones/clave-dispositivo';

export function RunnerMovil({ carteros, clave, ahora, onCrearClave, onCopiarClave }: {
  carteros: CarteroP[] | null;
  clave: ClaveDispositivo | null | undefined;
  ahora: number;
  onCrearClave: () => void;
  onCopiarClave: () => void;
}) {
  const aceptada = !!clave && (carteros ?? []).some((k) => (k.claves ?? []).includes(clave.id));
  const activos = (carteros ?? []).filter((k) => carteroVivo(k, ahora)).length;
  return (
    <>
      {/* La hoja ya se llama «Runners»: la sección dice el número, como la cabecera de la computadora. */}
      <SeccionM titulo={carteros?.length ? `${activos} de ${carteros.length} activos` : 'Runners'}>
        {!carteros ? <VacioM frase="No pude leer los Runners: reintenta en un momento." /> : carteros.length ? (
          <ListaM etiqueta="Runners">
            {carteros.map((k) => {
              const vivo = carteroVivo(k, ahora);
              const abiertos = k.chats.filter((c) => c.vivo).length;
              return (
                <FilaM
                  key={k.cuenta}
                  icono="config"
                  titulo={nombreCuenta(k.cuenta) ?? k.cuenta}
                  segunda={vivo
                    ? `${abiertos} ${abiertos === 1 ? 'chat abierto' : 'chats abiertos'}`
                    : 'Abre su chat en la PC para conectarlo'}
                  pill={<PildoraM tono={vivo ? 'good' : 'bad'}>{vivo ? 'Activo' : 'Sin conexión'}</PildoraM>}
                />
              );
            })}
          </ListaM>
        ) : <VacioM frase="Conecta un Runner desde la computadora para ver tus chats aquí." />}
      </SeccionM>
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
