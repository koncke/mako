// =============================================================================
// estructura — lo que la tab Curso hace EN EL ACTO con sus módulos y sus clases (puro)
// =============================================================================
// Arrastrar un módulo, llevar una clase a otro módulo, desvincular uno del kanban: la pantalla lo
// muestra en el acto y el server confirma detrás (./modulos-actions.ts). Lo que el server contesta
// MANDA —la lista de módulos como QUEDÓ, la clase como quedó—; esto es sólo la versión optimista, y
// la vuelta atrás si el server rechaza la arma quien llama guardando el estado de antes.
//
// Puro y sin React, para que tenga test (tests/curso-editor.test.ts).

import type { Clase } from '@/lib/curso';
import type { ModuloCurso } from '@/lib/curso-modulos';
import type { EstiloCurso } from '@/lib/curso-estilo';
import { conMovidoAntesDe } from '@/app/_cursos/orden';

/**
 * Los módulos en el orden de `claves`, renumerados 1..N. Una clave que no está se ignora y un módulo
 * que no se nombró queda al final (no se pierde ninguno por una lista vieja).
 */
export function modulosEnOrden(modulos: readonly ModuloCurso[], claves: readonly string[]): ModuloCurso[] {
  const porClave = new Map(modulos.map((m) => [m.clave, m]));
  const vistos = new Set<string>();
  const out: ModuloCurso[] = [];
  for (const k of claves) {
    const m = porClave.get(k);
    if (m && !vistos.has(k)) { vistos.add(k); out.push(m); }
  }
  for (const m of modulos) if (!vistos.has(m.clave)) out.push(m);
  return out.map((m, i) => (m.n === i + 1 ? m : { ...m, n: i + 1 }));
}

/**
 * Las claves con `clave` corrida UN lugar (`-1` = antes, `1` = después): «Mover antes / después» del
 * menú de un módulo, lo mismo que arrastrarlo un lugar. `null` en una punta (no hay a dónde).
 */
export function clavesConMovido(claves: readonly string[], clave: string, dir: -1 | 1): string[] | null {
  const i = claves.indexOf(clave);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= claves.length) return null;
  const out = [...claves];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/**
 * Las clases con `claseId` llevada al módulo `clave`, antes de `antesDe` (`null` = al final): el
 * módulo de destino queda renumerado 0..n-1, como lo deja el server (`moverClaseA`).
 */
export function clasesConMovida(clases: readonly Clase[], claseId: number, clave: string, antesDe: number | null): Clase[] {
  const yo = clases.find((c) => c.id === claseId);
  if (!yo) return [...clases];
  const delDestino = clases
    .filter((c) => c.productoId === yo.productoId && c.etapa === clave)
    .sort((a, b) => a.orden - b.orden || a.id - b.id)
    .map((c) => c.id);
  const ids = conMovidoAntesDe(delDestino, claseId, antesDe);
  return conOrdenDe(clases.map((c) => (c.id === claseId ? { ...c, etapa: clave } : c)), yo.productoId, clave, ids);
}

/** Las clases del módulo `clave` con el orden de `ids` (0..n-1). Lo que contesta el server (`ids`) manda. */
export function conOrdenDe(clases: readonly Clase[], productoId: number, clave: string, ids: readonly number[]): Clase[] {
  return clases.map((c) => {
    if (c.productoId !== productoId || c.etapa !== clave) return c;
    const i = ids.indexOf(c.id);
    return i >= 0 && c.orden !== i ? { ...c, orden: i } : c;
  });
}

/**
 * Desvincular o vincular CAMBIA LA CLAVE del módulo (lib/curso-modulos-datos.ts, `reclavear`): el
 * server ya mudó las clases y la portada; esto hace lo mismo con lo que la pantalla tiene en memoria,
 * o las clases quedarían en «Sin módulo» hasta recargar.
 */
export function clasesReclaveadas(clases: readonly Clase[], productoId: number, vieja: string, nueva: string): Clase[] {
  return clases.map((c) => (c.productoId === productoId && c.etapa === vieja ? { ...c, etapa: nueva } : c));
}

/**
 * Dónde está HOY una clase en su módulo, dicho como lo entiende el server (`moverClaseA`): la clase
 * que la sigue (`null` = es la última). Es lo que guarda el «Deshacer» de un arrastre o de «Mover
 * antes / después» para devolverla a su lugar EXACTO, no un lugar parecido.
 */
export function lugarDe(clases: readonly Clase[], claseId: number): { clave: string; antesDe: number | null } | null {
  const yo = clases.find((c) => c.id === claseId);
  if (!yo) return null;
  const hermanas = clases
    .filter((c) => c.productoId === yo.productoId && c.etapa === yo.etapa)
    .sort((a, b) => a.orden - b.orden || a.id - b.id);
  const i = hermanas.findIndex((c) => c.id === claseId);
  return { clave: yo.etapa, antesDe: hermanas[i + 1]?.id ?? null };
}

/** Las clases con `vuelven` puestas (las que devolvió el «Deshacer»): reemplaza por id, o agrega. */
export function clasesConDevueltas(clases: readonly Clase[], vuelven: readonly Clase[]): Clase[] {
  const ids = new Set(vuelven.map((c) => c.id));
  return [...clases.filter((c) => !ids.has(c.id)), ...vuelven];
}

// ── El menú «…» (08/10/2026, item 15) ─────────────────────────────────────────

/** Lo que puede tener el menú «…» de un módulo o de una clase. */
export type ItemMenuEstructura = 'renombrar' | 'portada' | 'mover-antes' | 'mover-despues' | 'acceso' | 'kanban' | 'eliminar';

/**
 * EL MENÚ «…» ES UNO Y TIENE LA MISMA FORMA para un módulo y para una clase. Pedido de Martín
 * (08/10/2026, item 15): «los tres puntos al editar un modulo o clase, el desplegable es diferente.
 * Debería ser igual. Primero Renombrar, Portada, Mover Antes, Mover Después y ahí un divider. Luego la
 * sección de "Público o Privado"… divider. Abajo en el caso de los módulos, ahí la sección del kanban…
 * divider. Y abajo en módulo falta la opción de eliminar módulo… En el desplegable de las clases, las
 * primeras opciones como ya mencioné, y luego nuevamente la opción de público o privado. No entiendo eso
 * de "Por área"» (salió del menú: va con la tarea).
 *
 * Cada lista es una SECCIÓN y entre dos secciones va una línea. ./MenuCurso.tsx dibuja ESTO, en este
 * orden, para los dos: el día que el de la clase gane un renglón que el del módulo no tiene, se escribe
 * acá, a la vista, y no en un segundo componente (que es como habían quedado distintos).
 */
export function seccionesDelMenu(tipo: 'modulo' | 'clase'): ItemMenuEstructura[][] {
  const arriba: ItemMenuEstructura[] = ['renombrar', 'portada', 'mover-antes', 'mover-despues'];
  return tipo === 'modulo'
    ? [arriba, ['acceso'], ['kanban'], ['eliminar']]
    : [arriba, ['acceso'], ['eliminar']];
}

/** La portada elegida del módulo, mudada a su clave nueva (lo mismo que hizo el server). */
export function estiloReclaveado(e: EstiloCurso, vieja: string, nueva: string): EstiloCurso {
  if (!Object.prototype.hasOwnProperty.call(e.portadasEtapa, vieja)) return e;
  const portadasEtapa = { ...e.portadasEtapa };
  portadasEtapa[nueva] = portadasEtapa[vieja];
  delete portadasEtapa[vieja];
  return { ...e, portadasEtapa };
}
