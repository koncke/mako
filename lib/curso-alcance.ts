// =============================================================================
// curso-alcance — qué módulos del curso puede ver UN alumno (los permisos, puro)
// =============================================================================
// Pedido de Martín (07/10/2026, item 9): «poder administrar los permisos de ese alumno, ya sea
// solo algunos modulos o lo que sea». El contrato lo fija docs/diseno-curso-skool.md (D3):
//
//   curso_accesos.alcance jsonb (mig 0219), null = TODO.
//   Forma: { modulos: { [productoId]: string[] /* claves de módulo */ } }
//
// La clave de un módulo es la de `curso_clases.etapa` (D1): la de la etapa del kanban para un
// módulo vinculado, `m_<azar>` para uno suelto. Por eso acá no se valida contra ningún catálogo:
// qué claves EXISTEN lo decide quien guarda (la action de la ficha, contra las etapas y las clases
// del producto). Acá sólo se decide la FORMA y la regla de lectura.
//
// ⚠️ UN PRODUCTO QUE NO ESTÁ EN `modulos` VE TODO. «Todos los módulos» de un producto se guarda
// sacando su entrada, no listando sus claves: una lista con las claves de HOY dejaría afuera el
// módulo que se cree mañana, y ese alumno lo perdería sin que nadie lo haya decidido. Lo mismo al
// revés: un producto con lista ve SÓLO lo listado, y un módulo nuevo ahí arranca cerrado — que es
// lo que significa «elegir módulos».
//
// ⚠️ UNA LISTA VACÍA ES «NINGUNO», no «todos». Es la forma de esconderle a un alumno el curso de un
// producto entero sin sacarle el de los otros. Colapsarla a «todos» sería la decisión del default.
//
// ⚠️ LAS CLAVES DEL OBJETO SE MIRAN CON `hasOwnProperty`, NUNCA CON `in` NI CON `obj[k]` A SECAS.
// El alcance viene de un jsonb que escribió un navegador (pasando por `saneaAlcance`, pero la regla
// no puede depender de eso): con `obj[k]`, un `productoId` que valga `'constructor'` o `'__proto__'`
// encuentra la función del prototipo, que no es un array, y la rama «no hay entrada = ve todo» se
// da vuelta sin que nada falle. Lo fija tests/curso-invitar.test.ts.
//
// ⚠️ SIN `server-only` NI `'use client'`, a propósito: lo usan la capa de datos (lib/curso-datos.ts,
// que lo lee en cada pedido del portal), la ficha (FichaCurso, para dibujar las casillas) y el test.
//
// QUIÉN LO APLICA: el portal, en la MISMA puerta que los bloqueos (`decidirClase` / `armarModulos`
// de lib/curso-portal.ts) — lo bloqueado NO viaja al navegador. `resolverAcceso` y
// `resolverAccesoPortal` (lib/curso-datos.ts) devuelven el alcance para que esa puerta lo tenga.

/** Los permisos de un alumno. `null` = ve todo (el default de toda fila). */
export type AlcanceCurso = { modulos: Record<string, string[]> } | null;

/** Topes contra un jsonb inflado a mano: muy por encima de cualquier curso real (el más grande, 9 etapas). */
const MAX_PRODUCTOS = 50;
const MAX_MODULOS = 200;
const MAX_LARGO_CLAVE = 120;

/** Un id de producto: entero positivo, escrito como lo escribe `String(n)`. Nada de `'01'`, `'1e3'` ni `'__proto__'`. */
const esIdProducto = (k: string): boolean => /^[1-9]\d{0,11}$/.test(k);

const tiene = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Una clave de módulo utilizable: texto, sin caracteres de control, con algo adentro y corta. */
function claveDeModulo(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > MAX_LARGO_CLAVE) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(s)) return null;
  return s;
}

/**
 * Lo que llegue (de la base o del navegador), a un alcance que se puede creer. Nunca tira.
 *
 * · Cualquier cosa que no sea `{ modulos: { … } }` → `null` (ve todo).
 * · Se quedan sólo las entradas cuya clave es un id de producto y cuyo valor es una lista; de cada
 *   lista, sólo las claves de texto válidas, sin repetir y en el orden en que llegaron.
 * · Un `modulos` sin ninguna entrada válida → `null`: «sin restricciones» se escribe UNA forma.
 *
 * ⚠️ El objeto de salida se arma de cero (nunca se copia el de entrada con spread): lo que no se
 * nombró acá no viaja, y un `__proto__` del jsonb no termina siendo el prototipo de nada.
 */
export function saneaAlcance(x: unknown): AlcanceCurso {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  if (!tiene(x, 'modulos')) return null;
  const crudo = (x as { modulos?: unknown }).modulos;
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
  const modulos: Record<string, string[]> = {};
  let n = 0;
  for (const k of Object.keys(crudo)) {
    if (n >= MAX_PRODUCTOS) break;
    if (!esIdProducto(k)) continue;
    const lista = (crudo as Record<string, unknown>)[k];
    if (!Array.isArray(lista)) continue;
    const claves: string[] = [];
    for (const v of lista) {
      const c = claveDeModulo(v);
      if (c && !claves.includes(c)) claves.push(c);
      if (claves.length >= MAX_MODULOS) break;
    }
    modulos[k] = claves;
    n++;
  }
  return n ? { modulos } : null;
}

/** ¿Este alumno tiene restringido ESTE producto? (Si no, ve todos sus módulos.) */
export function productoRestringido(alcance: AlcanceCurso, productoId: number | string): boolean {
  return alcance != null && tiene(alcance.modulos, String(productoId));
}

/**
 * ¿Puede ver este módulo de este producto? La regla de lectura, en UN lugar:
 *   · sin alcance → sí;
 *   · el producto sin entrada → sí (todos los módulos);
 *   · el producto con entrada → sólo si la clave está en su lista.
 */
export function moduloPermitido(alcance: AlcanceCurso, productoId: number | string, clave: string): boolean {
  if (!alcance) return true;
  const k = String(productoId);
  if (!tiene(alcance.modulos, k)) return true;
  const lista = alcance.modulos[k];
  return Array.isArray(lista) && lista.includes(clave);
}

/**
 * El alcance con UN producto cambiado. `claves: null` = «todos los módulos» (saca su entrada);
 * un array = sólo ésos. Devuelve `null` cuando ya no queda ningún producto restringido.
 *
 * Es lo que arma la ficha al tildar: la casilla de un módulo no puede escribir los otros productos.
 */
export function conModulos(alcance: AlcanceCurso, productoId: number | string, claves: readonly string[] | null): AlcanceCurso {
  const k = String(productoId);
  const modulos: Record<string, string[]> = {};
  for (const [p, lista] of Object.entries(alcance?.modulos ?? {})) if (p !== k) modulos[p] = [...lista];
  if (claves) modulos[k] = [...claves];
  return saneaAlcance({ modulos });
}

/**
 * Lo que GUARDA la ficha al tocar UN producto: su lista nueva, validada contra los módulos que ese
 * producto tiene HOY (`existen`), y los OTROS productos tal como estaban. `claves: null` = «Todos
 * los módulos» (saca su entrada).
 *
 * ⚠️ SE VALIDA SÓLO EL PRODUCTO QUE CAMBIA (revisión del 08/10/2026). Pasar el alcance ENTERO por
 * `alcanceValido` contra los productos que hoy tienen curso borraba la entrada de un producto
 * restringido que se quedó sin clases un rato, o del que lo sacaron — y «sin entrada» es «ve TODO»:
 * tocar un producto ABRÍA otro sin que nadie lo decidiera. Una clave vieja en otro producto no abre
 * nada; borrarla, sí.
 */
export function cambiarModulos(
  alcance: AlcanceCurso,
  productoId: number | string,
  claves: readonly string[] | null,
  existen: readonly string[],
): AlcanceCurso {
  if (claves == null) return conModulos(alcance, productoId, null);
  const k = String(productoId);
  const pedido = alcanceValido(saneaAlcance({ modulos: { [k]: [...claves] } }), new Map([[Number(k), existen]]));
  return conModulos(alcance, productoId, pedido?.modulos[k] ?? []);
}

/**
 * Deja en cada producto restringido SÓLO las claves que existen (`validas`: productoId → claves de
 * sus módulos hoy). Un producto que no está en `validas` (no es del alumno, o no tiene curso) se
 * descarta entero. Lo usa quien GUARDA, para el producto que cambia (`cambiarModulos`): lo que llega
 * del navegador no se cree. ⚠️ No sobre el alcance entero: ver `cambiarModulos`.
 */
export function alcanceValido(alcance: AlcanceCurso, validas: ReadonlyMap<number, readonly string[]>): AlcanceCurso {
  if (!alcance) return null;
  const modulos: Record<string, string[]> = {};
  for (const [p, lista] of Object.entries(alcance.modulos)) {
    const existen = validas.get(Number(p));
    if (!existen) continue;
    modulos[p] = lista.filter((c) => existen.includes(c));
  }
  return saneaAlcance({ modulos });
}
