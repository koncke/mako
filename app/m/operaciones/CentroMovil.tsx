'use client';

// =============================================================================
// El cartero en el teléfono: qué cartero de cada cuenta está dando vueltas, y la clave de ESTE teléfono
// =============================================================================
// Lo mismo que el panel «Cartero» de la computadora (app/admin/operaciones/PanelCartero.tsx), destilado: los
// trabajos ya no van en una lista aparte —cada uno está en su chat, con su tick— y el token de los carteros se
// acuña en la computadora. El color va en el punto de la píldora, nunca en el texto (app/m/_ui/LEEME.md).
//
// ⚠️ La hora relativa se calcula con el `ahora` de afuera, no con Date.now() en el render: el HTML del server y
// la hidratación tienen que decir lo mismo.

import { FilaM, ListaM, PildoraM, SeccionM, VacioM } from '@/app/m/_ui';
import { carteroVivo } from '@/lib/operaciones-reglas';
import { nombreCuenta, type CarteroP } from '@/lib/centro-chats';
import { hace } from '@/lib/progreso-reglas';
import type { ClaveDispositivo } from '@/app/admin/operaciones/clave-dispositivo';

export function CarteroMovil({ carteros, clave, ahora, onCrearClave, onCopiarClave }: {
  carteros: CarteroP[] | null;
  clave: ClaveDispositivo | null | undefined;
  ahora: number;
  onCrearClave: () => void;
  onCopiarClave: () => void;
}) {
  const aceptada = !!clave && (carteros ?? []).some((k) => (k.claves ?? []).includes(clave.id));
  return (
    <>
      <SeccionM titulo="Carteros">
        {!carteros ? <VacioM frase="No pude leer los carteros." /> : carteros.length ? (
          <ListaM etiqueta="Carteros">
            {carteros.map((k) => {
              const vivo = carteroVivo(k, ahora);
              const abiertos = k.chats.filter((c) => c.vivo).length;
              return (
                <FilaM
                  key={k.cuenta}
                  icono="config"
                  titulo={nombreCuenta(k.cuenta) ?? k.cuenta}
                  segunda={`${k.vistoAt ? `Visto ${hace(Date.parse(k.vistoAt), ahora)}` : 'Nunca pasó'} · ${abiertos} ${abiertos === 1 ? 'chat abierto' : 'chats abiertos'}`}
                  pill={<PildoraM tono={vivo ? 'good' : 'bad'}>{vivo ? 'Andando' : 'Sin señal'}</PildoraM>}
                />
              );
            })}
          </ListaM>
        ) : <VacioM frase="Ningún cartero dio una vuelta todavía." />}
      </SeccionM>
      <SeccionM titulo="Este teléfono">
        <ListaM etiqueta="Este teléfono">
          {clave === null && <FilaM icono="config" titulo="Todavía no firma" segunda="Crear su clave" onClick={onCrearClave} />}
          {clave && (
            <FilaM
              icono="copy"
              titulo={aceptada ? 'La PC acepta su clave' : 'La PC todavía no acepta su clave'}
              segunda="Copiar la clave"
              pill={<PildoraM tono={aceptada ? 'good' : 'warn'}>{aceptada ? 'Lista' : 'Falta'}</PildoraM>}
              onClick={onCopiarClave}
            />
          )}
        </ListaM>
      </SeccionM>
    </>
  );
}
