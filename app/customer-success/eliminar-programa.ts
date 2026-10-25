// =============================================================================
// eliminar-programa — QUÉ hace «Eliminar» un programa (un producto con su curso), y qué se pregunta antes (puro)
// =============================================================================
// f25 de la llamada con Leandro (24/10/2026, @49:10): «El curso sin nombre lo quiero eliminar. (...) ¿Existe todavía
// la opción de eliminar? (Martín: Eso lo tengo que poner.)». La opción ya existía en el editor de etapas del kanban
// (`eliminarServicioAction`, ./actions.ts) y nadie la encontraba desde el curso: ahora está en el menú de cada
// programa de la cabecera de Clients (su «…» y su clic derecho), con su «Deshacer».
//
// ⚠️ ARCHIVA, NO BORRA, y es la MISMA decisión que el «Eliminar» del CRM: con embudo vivo, se archivan sus embudos y
//    vuelve desde «Productos eliminados» del CRM; sin ningún embudo, se da de baja (`productos.activo = false`). Por eso
//    el «Deshacer» guarda QUÉ se hizo (`DeshacerEliminar`): restaurar es lo inverso exacto de eso, no adivinarlo después.
// ⚠️ EL PRINCIPAL NO SE ELIMINA (`archivarFunnel` lo frena): el menú no lo ofrece (lo que no se puede, no sale).
// ⚠️ SIN NADA QUE PERDER NO SE PREGUNTA: un programa sin alumnos ni clases se va con su «Deshacer» (AGENTS.md: «sin
//    nada que perder no hay fricción»). Con alumnos o clases se pregunta, con la CUENTA: los alumnos dejan de verlo.
//
// Sin `server-only` ni `'use client'`: lo usan la action y la cabecera, y tests/clients-eliminar-programa.test.ts lo
// ejecuta.

export type EmbudoDelProducto = { id: number; activo: boolean; esDefault: boolean };

/** Lo que hizo «Eliminar», para deshacerlo exacto. */
export type DeshacerEliminar = { tipo: 'embudos'; ids: number[] } | { tipo: 'baja' };

/** Qué hace «Eliminar» con este producto, según sus embudos. */
export function pasoParaEliminar(embudos: readonly EmbudoDelProducto[]):
  { tipo: 'no'; error: string } | { tipo: 'archivar'; ids: number[] } | { tipo: 'baja' } | { tipo: 'nada' } {
  const vivos = embudos.filter((f) => f.activo);
  if (vivos.some((f) => f.esDefault)) return { tipo: 'no', error: 'Es tu producto principal: no se puede eliminar. Puedes cambiarle el nombre.' };
  if (vivos.length) return { tipo: 'archivar', ids: vivos.map((f) => f.id) };
  // Sin ningún embudo: la baja del catálogo. Con todos archivados ya está en «Productos eliminados»: nada que hacer.
  return embudos.length ? { tipo: 'nada' } : { tipo: 'baja' };
}

/** ¿Los embudos a restaurar son de ESTE producto? Un «Deshacer» viaja por el navegador: no restaura uno ajeno. */
export function deshacerValido(d: DeshacerEliminar, embudos: readonly EmbudoDelProducto[]): boolean {
  if (d.tipo === 'baja') return true;
  const suyos = new Set(embudos.map((f) => f.id));
  return d.ids.length > 0 && d.ids.every((id) => Number.isInteger(id) && suyos.has(id));
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Lo que se dice antes de eliminar. `null` = no se pregunta (sin alumnos ni clases). El texto es corto y dice la
 * consecuencia antes del clic: cuántos alumnos dejan de verlo, y de dónde vuelve.
 */
export function preguntaAlEliminar(p: { nombre: string; alumnos: number; clases: number; conEmbudo: boolean }):
  { titulo: string; texto: string } | null {
  if (p.alumnos <= 0 && p.clases <= 0) return null;
  const partes = [
    p.alumnos > 0 ? `${plural(p.alumnos, 'alumno deja', 'alumnos dejan')} de verlo.` : null,
    p.clases > 0 ? `Tiene ${plural(p.clases, 'clase', 'clases')}.` : null,
    p.conEmbudo ? 'Lo recuperas en Productos eliminados del CRM.' : null,
  ].filter(Boolean);
  return { titulo: `¿Eliminar «${p.nombre}»?`, texto: partes.join(' ') };
}
