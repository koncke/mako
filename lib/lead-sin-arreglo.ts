// =============================================================================
// lead-sin-arreglo — lo que no se arregla reintentando un envío (23/10/2026)
// =============================================================================
// La #198 «Un Lead Entró» del ws1 reintentaba cada 4 h, para siempre, a leads de PRUEBA de Meta (la Lead Ads Testing
// Tool: «<test lead: dummy data for PHONE>», sin un solo dígito): el 2767 falló cuatro veces con «teléfono inválido» y los
// 2769-2773 cada 24 h con «lead sin teléfono». Un teléfono que no está, o que no tiene ningún dígito, no se arregla
// esperando: el motor cierra la inscripción con su motivo (`terminal`, lib/nutricion.ts), como el opt-out o el email que
// falta. Y a un lead de prueba de Meta no se le escribe por ningún canal: su email es `test+…@meta.com`.
//
// PURO y sin `server-only`: lo usan el motor y su test.
// =============================================================================

/** El nombre que le pone Meta a un lead de la herramienta de prueba («<test lead: dummy data for full_name>»). */
const RE_PRUEBA_META = /^\s*<test lead: dummy data\b/i;

export const esLeadDePruebaDeMeta = (nombre: string | null | undefined): boolean =>
  typeof nombre === 'string' && RE_PRUEBA_META.test(nombre);

/** Lo que queda escrito en el envío y cierra la inscripción. */
export const MOTIVO_PRUEBA_META = 'lead de prueba de Meta: no se le escribe';

/**
 * El teléfono que NO se arregla reintentando, con su motivo: vacío, o sin ningún dígito. null = puede salir (o fallar por
 * otra cosa, que sí se reintenta: la línea caída, el número sin código de país, que se arregla configurando la línea).
 * Los textos son los de siempre («lead sin teléfono», el «teléfono inválido» de `numeroParaWhatsApp`).
 */
export function telefonoSinArreglo(telefono: string | null | undefined): 'lead sin teléfono' | 'teléfono inválido' | null {
  if (typeof telefono !== 'string' || !telefono.trim()) return 'lead sin teléfono';
  if (!/\d/.test(telefono)) return 'teléfono inválido';
  return null;
}
