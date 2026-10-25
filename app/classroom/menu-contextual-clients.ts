// =============================================================================
// menu-contextual-clients — QUÉ ofrece el menú de un PROGRAMA de Clients (puro)
// =============================================================================
// f26 de la llamada con Leandro (24/10/2026, @38:00): «Tengo que implementar el click derecho en toda la app (...)
// En este caso en particular, Leandro lo estaba usando en Classroom, en la sección de curso, y no funciona». Y f25
// (@49:10): «El curso sin nombre lo quiero eliminar. (...) ¿Existe todavía la opción de eliminar?».
//
// Molde: app/crm/menu-contextual-crm.ts. Acá se decide sólo QUÉ sale y en qué orden (`opcionesPrograma`) y cómo se
// arma cada renglón (`itemsPrograma`). CÓMO se abre es de la pieza de la casa (app/_ui/MenuContextual.tsx) y QUÉ HACE
// cada opción es de la cabecera (`elegirEnPrograma`, app/classroom/ClientsShell.tsx). Lo abren el «…» de cada programa
// de la lista de la cabecera y su clic derecho. ⚠️ NO el título de la barra negra del Classroom: es texto (Martín,
// 25/10/2026: «no debe ser un desplegable»).
//
// ⚠️ LO QUE NO SE PUEDE, NO SALE: «si no se puede eliminar, no pongas directamente esa opción, no la dejes en gris»
//    (Martín, 29/09/2026). El principal no se elimina (`archivarFunnel` lo frena). «Eliminar» va al final, separado y
//    en rojo.
// ⚠️ SÓLO UN ADMIN (como «Personalizar» y «+ Nuevo producto»): el server lo vuelve a preguntar. Sin nada que ofrecer,
//    no hay menú (y el clic derecho es el del navegador).
// ⚠️ SIN «ABRIR»: abrir un programa es su link en la lista, que la guarda de la lección sin guardar ataja; desde un
//    menú sería un `router.push` que se la salta (docs/hallazgos-customer-success.md, «Dos selectores…»).
// ⚠️ LOS MÓDULOS Y LAS CLASES NO PASAN POR ACÁ: su clic derecho abre SU menú «…» (app/_cursos/CursoUgc.tsx), que ya
//    tiene renombrar, portada, mover, acceso y eliminar. Dos listas para lo mismo dirían dos cosas.
// =============================================================================
import type { EntradaMenuContextual } from '@/app/_ui/MenuContextual';

export type IdOpcionPrograma = 'renombrar' | 'duplicar' | 'eliminar';

/** Las opciones del menú de un programa, en orden. `null` = separador. Vacío = no hay menú. */
export function opcionesPrograma(p: { admin: boolean; principal: boolean }): Array<IdOpcionPrograma | null> {
  if (!p.admin) return [];
  // Duplicar (25/10/2026) va con Renombrar: no destruye nada. El principal también se duplica (la copia no lo es).
  return p.principal ? ['renombrar', 'duplicar'] : ['renombrar', 'duplicar', null, 'eliminar'];
}

/** Los renglones del menú. */
export function itemsPrograma(ids: ReadonlyArray<IdOpcionPrograma | null>): EntradaMenuContextual[] {
  return ids.map((id) => {
    if (id === null) return null;
    if (id === 'renombrar') return { id, label: 'Renombrar', icono: 'renombrar' };
    if (id === 'duplicar') return { id, label: 'Duplicar', icono: 'duplicar' };
    return { id, label: 'Eliminar', icono: 'borrar', peligro: true };
  });
}

/** ¿Este id es una opción del menú? (`onElegir` recibe un texto). */
export const esOpcionPrograma = (id: string): id is IdOpcionPrograma => id === 'renombrar' || id === 'duplicar' || id === 'eliminar';
