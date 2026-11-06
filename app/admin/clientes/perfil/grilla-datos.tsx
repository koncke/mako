// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. La grilla de datos que repiten las pestañas del
// perfil de Studio (src/app/(main)/dashboard/profile/_components/profile-personal-details.tsx y sus hermanas: un `dl` de tres
// columnas, rótulo chico arriba y el dato abajo), escrita una vez porque acá la llenan cinco secciones.

import type { DatoFicha } from "../customers-vista";

/** Reparte los datos en tres columnas, de arriba abajo y de izquierda a derecha, como las de Studio. */
export function GrillaDatos({ datos }: { datos: DatoFicha[] }) {
  const porColumna = Math.ceil(datos.length / 3);
  const columnas = [0, 1, 2].map((i) => datos.slice(i * porColumna, (i + 1) * porColumna)).filter((c) => c.length);
  return (
    <dl className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3 xl:gap-12">
      {columnas.map((col, i) => (
        <div key={i} className="flex flex-col gap-5">
          {col.map((d) => (
            <div key={d.rotulo} className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs">{d.rotulo}</dt>
              <dd className="text-sm">{d.valor}</dd>
            </div>
          ))}
        </div>
      ))}
    </dl>
  );
}
