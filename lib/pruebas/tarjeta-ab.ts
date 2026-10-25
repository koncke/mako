// =============================================================================
// pruebas/tarjeta-ab — lo que la tarjeta «A/B TEST» necesita saber de su flujo (PURO, 25/10/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md (2.4 y 3.1, con la crítica D.16):
//   · LA FIRMA DE UNA RAMA son las tarjetas que son SÓLO suyas: las que se alcanzan por esa rama y no por otra (las ramas se
//     vuelven a juntar en el resto del flujo, y lo de después de la junta es de todas). Editar una tarjeta de una rama, o su
//     porcentaje, abre una ÉPOCA nueva: desde ahí sólo cuentan los que entran después (`reiniciarEpoca`, lib/pruebas/store.ts).
//   · QUÉ CAMBIÓ al publicar contra la prueba que corre: nada, otra época, o hay que DETENERLA (se borró la tarjeta o
//     cambiaron las ramas: lo que se medía ya no existe).
//   · LA MÉTRICA de la prueba: el objetivo de la automatización (`estrategia.desenlace.logrado`) si es «respondió» o «agendó»;
//     si no, «respondió». «Pagó» no decide: es demasiado raro (va de guardrail).
// =============================================================================

import { huellaDeVisitante } from '../replay-contrato';
import { claseDe, descendientes, idDe, nodoPorId, ramasABDe, type PasoGrafo, type RamaAB } from '../flujo-grafo';

/** Los campos de una tarjeta que cambian lo que le llega al lead (lo demás —posición, orden— no es la rama). */
const CAMPOS_QUE_LLEGAN = ['nodo', 'canal', 'tipo', 'cuerpo', 'asunto', 'partes', 'audio_id', 'media_id', 'botones', 'espera', 'accion', 'ramas', 'si_no', 'proveedor', 'template_wa'] as const;

/** Lo que es SÓLO de cada rama: lo que se alcanza por ella y no por ninguna otra. */
export function tarjetasDeCadaRama(pasos: readonly PasoGrafo[], abId: string): Map<string, string[]> {
  const ramas = ramasABDe(nodoPorId(pasos, abId));
  const alcance = new Map(ramas.map((r) => [r.clave, r.siguiente ? new Set([r.siguiente, ...descendientes(pasos, r.siguiente)]) : new Set<string>()]));
  const out = new Map<string, string[]>();
  for (const r of ramas) {
    const mias = [...(alcance.get(r.clave) ?? [])].filter((id) => id !== abId && ramas.every((o) => o.clave === r.clave || !alcance.get(o.clave)?.has(id)));
    out.set(r.clave, mias.sort());
  }
  return out;
}

/** LA FIRMA de una rama: su porcentaje y el contenido de sus tarjetas (las que son sólo suyas), en un hash. */
export function firmaDeRama(pasos: readonly PasoGrafo[], abId: string, r: RamaAB, propias = tarjetasDeCadaRama(pasos, abId).get(r.clave) ?? []): string {
  const contenido = propias.map((id) => {
    const p = nodoPorId(pasos, id) as Record<string, unknown> | null;
    return p ? [id, ...CAMPOS_QUE_LLEGAN.map((k) => p[k] ?? null)] : [id];
  });
  return huellaDeVisitante(JSON.stringify([r.pct, r.siguiente ?? null, contenido])).toString(36);
}

/** Las ramas de la tarjeta como las guarda la prueba: letra, peso, nombre, firma y a dónde sigue. */
export function ramasParaLaPrueba(pasos: readonly PasoGrafo[], abId: string): Array<{ clave: string; nombre: string; peso: number; control: boolean; firma: string; contenido: { nodo_destino: string | null } }> {
  const propias = tarjetasDeCadaRama(pasos, abId);
  return ramasABDe(nodoPorId(pasos, abId)).map((r) => ({
    clave: r.clave, nombre: r.nombre ?? (r.clave === 'A' ? 'Sin cambio' : ''), peso: r.pct, control: r.clave === 'A',
    firma: firmaDeRama(pasos, abId, r, propias.get(r.clave) ?? []), contenido: { nodo_destino: r.siguiente ?? null },
  }));
}

/**
 * QUÉ HACER CON LA PRUEBA QUE CORRE al publicar el flujo. `nada`: las ramas son las mismas. `epoca`: cambió el porcentaje o
 * lo de una rama (las firmas). `detener`: se borró la tarjeta, o cambiaron las letras (sumaron o sacaron ramas).
 */
export function cambiosDeLaPrueba(
  pasos: readonly PasoGrafo[], abId: string, guardadas: ReadonlyArray<{ clave: string; firma: string | null }>,
): { que: 'nada' } | { que: 'epoca'; porque: string; ramas: ReturnType<typeof ramasParaLaPrueba> } | { que: 'detener'; porque: string } {
  const ab = nodoPorId(pasos, abId);
  if (!ab || claseDe(ab) !== 'ab') return { que: 'detener', porque: 'Se borró la tarjeta de la prueba.' };
  const nuevas = ramasParaLaPrueba(pasos, abId);
  const claves = (xs: ReadonlyArray<{ clave: string }>) => xs.map((x) => x.clave).sort().join(',');
  if (claves(nuevas) !== claves(guardadas)) return { que: 'detener', porque: 'Cambiaron las ramas de la prueba: empieza otra.' };
  const cambiadas = nuevas.filter((n) => guardadas.find((g) => g.clave === n.clave)?.firma !== n.firma).map((n) => n.clave);
  if (!cambiadas.length) return { que: 'nada' };
  return { que: 'epoca', porque: `Cambiaste ${cambiadas.join(' y ')}.`, ramas: nuevas };
}

/** La métrica de la prueba de una automatización: su objetivo si es «respondió» o «agendó»; si no, «respondió». */
export function metricaDeLaAutomatizacion(estrategia: unknown): 'respondio' | 'agendo' {
  const l = (estrategia as { desenlace?: { logrado?: unknown } } | null | undefined)?.desenlace?.logrado;
  return l === 'agendo' ? 'agendo' : 'respondio';
}

/** El id de la tarjeta «A/B TEST» de un flujo (una por automatización), o null. */
export function tarjetaABDe(pasos: readonly PasoGrafo[]): string | null {
  const i = pasos.findIndex((p) => p && claseDe(p) === 'ab');
  return i >= 0 ? idDe(pasos[i], i) : null;
}
