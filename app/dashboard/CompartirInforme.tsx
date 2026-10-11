'use client';

// =============================================================================
// «Compartir» del Dashboard — el MISMO botón y el MISMO modal de Conocimientos
// =============================================================================
// Martín, 11/10/2026 (punto 9): «Agrega el botón de "Compartir" que funcione exactamente igual que lo que
// ya tenemos en "Compartir" en la vista de CONOCIMIENTOS de SuperAdmin, que se pueda crear un link de
// acceso a esos graficos y también invitar por email».
//
// Por eso NO es un modal nuevo: es `app/conocimientos/Compartir.tsx` con `recurso='dashboard'`. Los dos
// modos (cualquiera con el link / sólo los invitados, cada uno con su link personal y revocable), la
// lista de «quién tiene acceso», copiar sin rotar y el mail como MaKo son los de siempre. Una copia
// «CompartirInforme» con su propio modal sería la que se queda vieja.
//
// QUÉ se comparte lo decide el SERVER, no este botón (app/api/compartir/route.ts): el informe de quien
// tiene la sesión (todas sus hojas, sólo lectura), en el workspace de la pestaña. Lo único que manda la
// pantalla es la hoja abierta (`parametros.hoja`), que el server pega como `?hoja=` en cada link: quien lo
// abre empieza donde estaba quien compartió. La vista pública es /compartido/<token>
// (app/compartido/[token]/InformeCompartido.tsx).
//
// La firma (`hojaId`, `titulo`) es la del contrato con la topbar (app/dashboard/EditorInforme.tsx): no se
// cambia. `compacto` es opcional y es el tamaño chico del mismo botón.

import Compartir from '@/app/conocimientos/Compartir';
import { INFORME_SIN_NOMBRE, RECURSO_INFORME } from '@/lib/share-nombre';

/** El botón «Compartir» de la topbar: comparte el informe de quien lo mira; `hojaId` es la hoja abierta. */
export function BotonCompartir({ hojaId, titulo, compacto }: { hojaId: string; titulo: string; compacto?: boolean }) {
  return (
    <Compartir
      recurso={RECURSO_INFORME}
      etiqueta={titulo.trim() || INFORME_SIN_NOMBRE}
      nota="Todas las hojas, sin poder editar."
      parametros={{ hoja: hojaId }}
      compacto={compacto}
      claseBoton="lk-pill lk-pill--azul"
    />
  );
}
