'use client';

// =============================================================================
// «Compartir» del Dashboard — el MISMO modal de Conocimientos, abierto desde el ⋮
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
// Tanda v5 (12/10/2026):
//   · Punto 3: «Compartir» va ADENTRO del ⋮ (un renglón con su ícono, `RenglonCompartir`) y «Editar» vuelve
//     a ser el azul. El modal se abre desde afuera: `BotonCompartir` con `abierto` + `onCerrar` es el modo
//     CONTROLADO de Compartir (no dibuja botón), y va montado AFUERA de los menús: adentro del ⋮, cerrar el
//     menú lo desmontaría junto con el modal.
//   · Punto 16: con el estilo del Dashboard (`variante="app"`), no el verde de Conocimientos.
//
// QUÉ se comparte lo decide el SERVER, no este botón (app/api/compartir/route.ts): el informe de quien
// tiene la sesión (todas sus hojas, sólo lectura), en el workspace de la pestaña. Lo único que manda la
// pantalla es la hoja abierta (`parametros.hoja`), que el server pega como `?hoja=` en cada link: quien lo
// abre empieza donde estaba quien compartió. La vista pública es /compartido/<token>
// (app/compartido/[token]/InformeCompartido.tsx).
//
// La firma (`hojaId`, `titulo`) es la del contrato con la topbar (app/dashboard/EditorInforme.tsx); `compacto`
// es el tamaño chico del botón propio; `abierto` / `onCerrar`, el modo controlado.

import Compartir from '@/app/conocimientos/Compartir';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { INFORME_SIN_NOMBRE, RECURSO_INFORME } from '@/lib/share-nombre';

/**
 * El modal «Compartir» del informe: comparte el informe de quien lo mira; `hojaId` es la hoja abierta. Con
 * `abierto` definido no dibuja botón (lo abre el renglón del ⋮); sin él, el botón azul de siempre.
 */
export function BotonCompartir({ hojaId, titulo, compacto, abierto, onCerrar }: { hojaId: string; titulo: string; compacto?: boolean; abierto?: boolean; onCerrar?: () => void }) {
  return (
    <Compartir
      recurso={RECURSO_INFORME}
      etiqueta={titulo.trim() || INFORME_SIN_NOMBRE}
      nota="Todas las hojas, sin poder editar."
      parametros={{ hoja: hojaId }}
      compacto={compacto}
      claseBoton="lk-pill lk-pill--azul"
      abierto={abierto}
      onCerrar={onCerrar}
      variante="app"
    />
  );
}

/** El renglón «Compartir» del ⋮ de la topbar (con su ícono, como los demás renglones del menú). */
export function RenglonCompartir({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="lk-opcion" onClick={onClick}>
      <IconoMenu nombre="link" size={17} /> <span>Compartir</span>
    </button>
  );
}
