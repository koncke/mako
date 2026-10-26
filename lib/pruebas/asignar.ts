// =============================================================================
// pruebas/asignar — a qué rama de una prueba A/B va cada persona (PURO, 25/10/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md (2.3 y 2.4, con la crítica): el reparto es FIJO, PEGAJOSO y SALADO con el id de la prueba.
//   · La huella es `huellaDeVisitante` (FNV-1a, lib/replay-contrato.ts) de `${pruebaId}:${epoca}:${unidad}`, módulo la
//     suma de los pesos de las ramas activas, contra los pesos acumulados en el orden de las claves (A, B, C, D).
//   · ⚠️ LA SAL ES OBLIGATORIA: sin el id de la prueba, dos pruebas que corren a la vez parten a la gente igual (la misma
//     persona cae en B en las dos) y sus resultados quedan correlacionados. Con la época, editar una rama re-sortea a
//     los que entran DESPUÉS; los que ya tienen rama la conservan (la fila de `prueba_asignaciones` manda).
//   · Sin bandido en v1: los pesos no se mueven solos.
// La unidad: `lead_id` en una automatización, `visitor_id` en una landing. «desconocido» (el visitante sin cookie,
// app/api/track/optin/route.ts) nunca se asigna: ve el control y no cuenta.
// Lo usan el motor de Automations (la tarjeta «A/B TEST») y la landing (Landings): no depende de nutrición.
// =============================================================================

import { huellaDeVisitante } from '../replay-contrato';

/** Una rama de la prueba, como la necesita el reparto. */
export type RamaReparto = { clave: string; peso: number; activa?: boolean; control?: boolean };

/** Lo mínimo y lo máximo de una prueba (diseño 2.4 y 3.1: de 2 a 4 ramas, cada una con 10 % o más, que suman 100). */
export const MIN_RAMAS = 2;
export const MAX_RAMAS = 4;
export const MIN_PESO = 10;

/** Una unidad que no se asigna: vacía o el visitante sin cookie. */
export const unidadValida = (unidad: string | null | undefined): unidad is string =>
  !!unidad && unidad.trim() !== '' && unidad.trim().toLowerCase() !== 'desconocido';

/** Los problemas de las ramas al crear o editar una prueba, en palabras. Vacío = se puede. */
export function problemasDeRamas(ramas: readonly RamaReparto[]): string[] {
  const err: string[] = [];
  if (ramas.length < MIN_RAMAS || ramas.length > MAX_RAMAS) err.push(`Una prueba tiene de ${MIN_RAMAS} a ${MAX_RAMAS} ramas (tiene ${ramas.length}).`);
  const claves = ramas.map((r) => r.clave);
  if (new Set(claves).size !== claves.length) err.push('Dos ramas con la misma letra.');
  if (ramas.filter((r) => r.control).length !== 1) err.push('Una prueba tiene UN control («Sin cambio»).');
  for (const r of ramas) {
    if (!Number.isInteger(r.peso) || r.peso < MIN_PESO) err.push(`La rama ${r.clave} lleva ${r.peso} %: cada rama, ${MIN_PESO} % o más.`);
  }
  const suma = ramas.reduce((s, r) => s + r.peso, 0);
  if (suma !== 100) err.push(`Los porcentajes suman ${suma}: tienen que sumar 100.`);
  return err;
}

/**
 * La rama que le toca a una unidad que todavía no tiene: la huella salada contra los pesos de las ramas ACTIVAS (una
 * rama cortada deja de recibir gente y las otras se reparten lo suyo en proporción). null si no hay rama activa o la
 * unidad no se asigna.
 */
export function asignar(pruebaId: number | string, epoca: number, unidad: string, ramas: readonly RamaReparto[]): string | null {
  if (!unidadValida(unidad)) return null;
  const activas = [...ramas].filter((r) => r.activa !== false && r.peso > 0).sort((a, b) => a.clave.localeCompare(b.clave));
  const total = activas.reduce((s, r) => s + r.peso, 0);
  if (!activas.length || total <= 0) return null;
  const h = huellaDeVisitante(`${pruebaId}:${epoca}:${unidad.trim()}`) % total;
  let acum = 0;
  for (const r of activas) {
    acum += r.peso;
    if (h < acum) return r.clave;
  }
  return activas[activas.length - 1].clave;
}

/** El estado de la prueba que importa para servir. */
export type PruebaParaServir = {
  id: number | string;
  estado: string;
  epoca: number;
  ramas: readonly RamaReparto[];
  /** La rama que recibe el 100 % al terminar (`pruebas.sirviendo_id`, como clave). */
  sirviendo?: string | null;
};

/**
 * QUÉ SE LE SIRVE a una unidad, y si hay que ESCRIBIR su asignación (insert … on conflict do nothing, y releer):
 *   · sin prueba corriendo (propuesta, detenida, sin tabla, lectura que falló río arriba) → el control, sin escribir.
 *     Nunca un sorteo sin registro (crítica, punto 15);
 *   · con `sirviendo` → esa rama, sin escribir;
 *   · la unidad ya tiene rama → ésa, siempre; si esa rama se cortó, el control (deja de servirse), sin escribir;
 *   · si no → la que da `asignar`, y se escribe.
 */
export function ramaParaServir(p: PruebaParaServir | null, unidad: string | null | undefined, previa?: string | null):
  { clave: string; escribir: boolean } {
  const control = p?.ramas.find((r) => r.control)?.clave ?? 'A';
  if (!p) return { clave: control, escribir: false };
  if (p.sirviendo) return { clave: p.sirviendo, escribir: false };
  if (p.estado !== 'corriendo' || !unidadValida(unidad)) return { clave: control, escribir: false };
  if (previa) {
    const r = p.ramas.find((x) => x.clave === previa);
    return { clave: r && r.activa !== false ? previa : control, escribir: false };
  }
  const nueva = asignar(p.id, p.epoca, unidad, p.ramas);
  return nueva ? { clave: nueva, escribir: true } : { clave: control, escribir: false };
}
