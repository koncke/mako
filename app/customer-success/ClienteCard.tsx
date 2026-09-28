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

// `colorDe` vivía acá y se fue con el molde, porque lo usan las dos pantallas. Se
// re-exporta para no tocar a los tres que ya lo importaban de este archivo (la
// tabla, la ficha y el picker de clientes del tablero).
export { colorDe };

export function ClienteCard({ c, n, trabajo, tableroOk, onAbrir }: {
  c: ClienteCruce;
  /** Su número de cliente: «Cliente 1». No es el id del lead — ver `NumeroCliente`. */
  n: number;
  trabajo: ResumenTrabajo | null;
  tableroOk: boolean;
  onAbrir: () => void;
}) {
  const nombre = c.nombre.trim() || 'Sin nombre';
  return (
    <TarjetaEntidad
      nombre={nombre}
      bajada={c.empresa?.trim() || `Cliente ${n}`}
      portada={c.portada} portadaY={c.portadaY}
      icono={c.icono ?? c.avatarUrl} avatarY={c.avatarY}
      color={colorDe(nombre)}
      onAbrir={onAbrir}
      etiqueta={`Abrir la ficha de ${nombre}`}
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
    />
  );
}
