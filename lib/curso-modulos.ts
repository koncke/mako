// =============================================================================
// curso-modulos — los MÓDULOS del curso: cuáles son, en qué orden, y cómo se reordenan (puro)
// =============================================================================
// Pedido de Martín (07/10/2026, items 6, 7, 11 y 12): «Para las "Etapas" dentro del curso, llamalo
// "Módulos"… Debería poder editar los nombres de los módulos allí mismo. Y claro, que se editen en las
// etapas del kanban… agarrar una tarjeta y arrastrarla para cambiar la posición… Y eso también debería
// cambiar las etapas… Falta el botón de "Nuevo módulo"… un editor para los módulos, para poder
// "desvincularlo" del kanban… si creo un nuevo módulo, se crea una nueva etapa». Las decisiones, en
// docs/diseno-curso-skool.md (D1).
//
// EL MODELO, en una línea: un módulo VINCULADO es una etapa del kanban (`enCurso !== false`) y un
// módulo SUELTO es una fila de `curso_modulos` con su ancla. La clave del módulo es la que guarda
// `curso_clases.etapa` (no se creó `modulo_id`: ~40 lugares agrupan por `c.etapa` y siguen valiendo).
//
// ⚠️ LA LISTA DE MÓDULOS SE DERIVA Y NO SE GUARDA (`derivarModulos`). El orden de los vinculados es el
// del kanban; si el curso guardara un orden propio, el primer arrastre en el editor de etapas lo
// dejaría viejo y el curso mostraría un orden mientras el candado (`etapa`) aplica otro. Un suelto
// guarda sólo DESPUÉS DE QUIÉN va (`despues_de`), que sigue a su vecino adonde lo lleven.
//
// ⚠️ LA PRIMERA ETAPA DEL KANBAN ES LA ENTRADA Y NO SE MUEVE (`planReorden` lo rechaza). «Un cliente
// SIN fila está en la PRIMERA etapa» es una regla derivada (lib/servicio-etapas.ts,
// `repartirEnEtapas`): mover otra columna arriba pasaría EN SILENCIO a todos los clientes sin fila a
// esa columna. Un SUELTO sí puede ir antes de todo: no es una etapa y no mueve a nadie.
//
// Sin 'server-only' ni 'use client', a propósito: lo ejecuta tests/curso-modulos.test.ts y lo usan
// el server (las actions de los módulos, el portal) y el editor (para dibujar).

import {
  esModuloDelCurso, enOrden, conFase, grupoDe, nuevaClaveEtapa, colorNuevaEtapa, TOPE_NOMBRE_ETAPA,
  type EtapaEntrega, type FaseEntrega,
} from './servicio-etapas';
import { saneaBloqueo, type Bloqueo } from './curso-bloqueo';

/** Una fila de `curso_modulos` (mig 0220), como la lee lib/curso-modulos-datos.ts. */
export type FilaModulo = {
  clave: string;
  vinculado: boolean;
  /** Sólo los sueltos: el nombre de un vinculado es el de su etapa. */
  nombre: string | null;
  /** Sólo los sueltos: la clave del módulo que lo precede. `null` = al principio. */
  despuesDe: string | null;
  /** Crudo del jsonb: se sanea al derivar. */
  bloqueo: unknown;
  /** Para desempatar dos sueltos con la misma ancla (el más viejo primero). */
  id?: number;
};

/** Un módulo del curso, como lo usan el editor, el portal y la ficha. */
export type ModuloCurso = {
  clave: string;
  nombre: string;
  vinculado: boolean;
  /** Su número en el orden del curso: 1..N. */
  n: number;
  /** Cuándo se abre. `null` = el default (vinculado: al llegar a su etapa; suelto: abierto). */
  bloqueo: Bloqueo | null;
  /** Sólo los vinculados: su etapa del kanban. */
  etapa?: { key: string; label: string; fase?: string | null };
};

/** La forma de una clave de módulo: la de una etapa (lib/servicio-etapas.ts) y la de la portada. */
export const CLAVE_MODULO_RE = /^[a-z0-9_]{1,60}$/;

/**
 * La clave de un módulo SUELTO nuevo: `m_` + 8 al azar. Nunca una que ya exista (`existentes`: las de
 * las etapas, las de los módulos, las que nombran las clases y las del kanban de los clientes).
 *
 * ⚠️ AL AZAR Y NO DERIVADA DEL NOMBRE, al revés que una etapa (`nuevaClaveEtapa`): un suelto se puede
 * vincular después, y su clave nueva de etapa sí sale del nombre. Con `m_` no choca con una etapa
 * salvo por un nombre muy raro, y igual se mira contra `existentes`.
 */
export function nuevaClaveSuelto(existentes: readonly string[], azar: () => number = Math.random): string {
  const usadas = new Set(existentes);
  for (let i = 0; i < 50; i++) {
    const k = `m_${Math.floor(azar() * 36 ** 8).toString(36).padStart(8, '0')}`;
    if (!usadas.has(k)) return k;
  }
  // Cincuenta choques seguidos sólo pasan con un azar roto: se sale por un contador.
  let n = existentes.length + 1;
  while (usadas.has(`m_${n}`)) n++;
  return `m_${n}`;
}

/**
 * El nombre de un módulo, como se guarda: espacios colapsados y con el tope de las etapas
 * (`TOPE_NOMBRE_ETAPA`) PARA TODOS. Un suelto que se vincula pasa a ser la cabecera de una columna
 * del kanban: con un tope propio más largo, vincular daría un nombre que el kanban no deja escribir.
 */
export function nombreDeModulo(raw: unknown): { ok: true; nombre: string } | { ok: false; error: string } {
  const nombre = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (!nombre) return { ok: false, error: 'Falta el nombre.' };
  if (nombre.length > TOPE_NOMBRE_ETAPA) return { ok: false, error: `El nombre pasa de ${TOPE_NOMBRE_ETAPA} letras.` };
  return { ok: true, nombre };
}

/** Una marca que no puede ser una clave (`[a-z0-9_]`): el ancla de «al final». */
const AL_FINAL = '\u0000final';
const RAIZ = '\u0000raiz';

/**
 * La lista de módulos: las etapas con `enCurso !== false` en el orden del kanban, y los sueltos
 * metidos después de su ancla, EN CADENA (un suelto puede ir después de otro suelto).
 *
 *   · Ancla `null` → al principio.
 *   · Ancla que es una etapa del kanban que NO es módulo (`enCurso: false`) → donde estaría esa
 *     etapa: después del módulo vinculado más cercano de antes en el kanban (o al principio). Así
 *     sacar una etapa del curso no le mueve los sueltos que la seguían.
 *   · Ancla que ya no existe → al final (y lo que colgaba de él, detrás).
 *   · Dos sueltos con la misma ancla → el más viejo primero (`id`), después por clave.
 *   · Un ciclo (A después de B y B después de A, que nada escribe pero un jsonb editado a mano sí) no
 *     pierde módulos: los que no se alcanzaron van al final.
 *
 * ⚠️ UNA FILA VINCULADA CUYA ETAPA YA NO ES MÓDULO NO CREA UN MÓDULO: la fila guarda sólo el bloqueo
 * de una etapa, y sin la etapa no hay módulo. Y un suelto con la clave de una etapa no se dibuja dos
 * veces: gana la etapa.
 */
export function derivarModulos(etapas: readonly EtapaEntrega[], filas: readonly FilaModulo[]): ModuloCurso[] {
  const vinc = etapas.filter(esModuloDelCurso);
  const clavesVinc = new Set(vinc.map((e) => e.key));
  const filaVinc = new Map(filas.filter((f) => f.vinculado && clavesVinc.has(f.clave)).map((f) => [f.clave, f]));
  const vistos = new Set<string>();
  const sueltos = filas
    .filter((f) => !f.vinculado && CLAVE_MODULO_RE.test(f.clave) && !clavesVinc.has(f.clave) && (vistos.has(f.clave) ? false : (vistos.add(f.clave), true)))
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0) || a.clave.localeCompare(b.clave));
  const clavesSueltos = new Set(sueltos.map((s) => s.clave));

  // El ancla EFECTIVA de cada suelto (ver arriba).
  const ancla = (s: FilaModulo): string => {
    const d = s.despuesDe;
    if (d == null) return RAIZ;
    if (clavesVinc.has(d) || clavesSueltos.has(d)) return d;
    const i = etapas.findIndex((e) => e.key === d);
    if (i >= 0) {
      for (let j = i - 1; j >= 0; j--) if (esModuloDelCurso(etapas[j])) return etapas[j].key;
      return RAIZ;
    }
    return AL_FINAL;
  };
  const hijos = new Map<string, FilaModulo[]>();
  for (const s of sueltos) {
    const a = ancla(s);
    if (!hijos.has(a)) hijos.set(a, []);
    hijos.get(a)!.push(s);
  }

  const out: Array<Omit<ModuloCurso, 'n'>> = [];
  const emitidos = new Set<string>();
  const emitirHijos = (clave: string) => {
    for (const s of hijos.get(clave) ?? []) emitirSuelto(s);
  };
  const emitirSuelto = (s: FilaModulo) => {
    if (emitidos.has(s.clave)) return;
    emitidos.add(s.clave);
    out.push({ clave: s.clave, nombre: (s.nombre ?? '').trim() || 'Módulo', vinculado: false, bloqueo: saneaBloqueo(s.bloqueo) });
    emitirHijos(s.clave);
  };
  emitirHijos(RAIZ);
  for (const e of vinc) {
    emitidos.add(e.key);
    out.push({
      clave: e.key, nombre: e.label, vinculado: true, bloqueo: saneaBloqueo(filaVinc.get(e.key)?.bloqueo),
      etapa: { key: e.key, label: e.label, fase: e.fase ?? null },
    });
    emitirHijos(e.key);
  }
  emitirHijos(AL_FINAL);
  for (const s of sueltos) emitirSuelto(s);
  return out.map((m, i) => ({ ...m, n: i + 1 }));
}

/** Las claves de los módulos, en orden: lo que valida a qué módulo puede ir una clase. */
export const clavesDeModulos = (modulos: readonly Pick<ModuloCurso, 'clave'>[]): string[] => modulos.map((m) => m.clave);

/** El ancla de cada suelto de una secuencia: el módulo que lo precede en ELLA (`null` = el primero). */
export function anclasDe(claves: readonly string[], esSuelto: (clave: string) => boolean): Array<{ clave: string; despuesDe: string | null }> {
  return claves.flatMap((k, i) => (esSuelto(k) ? [{ clave: k, despuesDe: i > 0 ? claves[i - 1] : null }] : []));
}

/**
 * Las posiciones que se quedan QUIETAS de una permutación: la subsecuencia creciente más larga de los
 * índices originales. Lo que NO está en ella es lo que se movió (y adopta la fase de su vecino). Con
 * un empate (un intercambio de dos vecinos, donde «subió uno» y «bajó el otro» son la misma lista) se
 * queda quieto el de índice más chico: se lee como que el otro SUBIÓ.
 */
function quietos(orig: readonly number[]): Set<number> {
  const n = orig.length;
  const largo: number[] = new Array(n).fill(1);
  const prev: number[] = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (orig[j] < orig[i] && (largo[j] + 1 > largo[i] || (largo[j] + 1 === largo[i] && prev[i] >= 0 && orig[j] < orig[prev[i]]))) {
        largo[i] = largo[j] + 1;
        prev[i] = j;
      }
    }
  }
  let fin = -1;
  for (let i = 0; i < n; i++) if (fin < 0 || largo[i] > largo[fin] || (largo[i] === largo[fin] && orig[i] < orig[fin])) fin = i;
  const out = new Set<number>();
  for (let i = fin; i >= 0; i = prev[i]) out.add(i);
  return out;
}

/** Lo que devuelve un plan: el kanban nuevo (si cambia) y el ancla de cada suelto. */
export type Plan =
  | {
    ok: true;
    /** El kanban entero, en su orden nuevo (con `enOrden`: las fases contiguas). */
    etapas: EtapaEntrega[];
    fases: FaseEntrega[];
    /** ¿Hay que escribir el kanban? (`false` = sólo cambian anclas de sueltos). */
    cambiaEntrega: boolean;
    /** El ancla de CADA suelto de la secuencia nueva. Quien escribe guarda las que cambiaron. */
    anclas: Array<{ clave: string; despuesDe: string | null }>;
  }
  | { ok: false; error: string };

export const ERROR_PRIMERA = 'La primera etapa no se mueve.';

const firma = (etapas: readonly EtapaEntrega[], fases: readonly FaseEntrega[]) =>
  JSON.stringify([etapas.map((e) => [e.key, e.fase ?? '', e.enCurso === false]), fases.map((f) => f.key)]);

/**
 * El plan de una secuencia de módulos NUEVA sobre el kanban de hoy: el kanban reordenado y las anclas.
 *
 *   · `claves` tiene que ser EXACTAMENTE los módulos de `modulos` (la misma lista, en otro orden).
 *   · Las etapas que NO son módulo (`enCurso: false`) se quedan en su lugar del kanban; los módulos
 *     vinculados se reparten en los lugares de los módulos, en el orden pedido.
 *   · Con FASES: la etapa que se movió adopta la fase de la que queda antes de ella (es «la meto en
 *     este grupo»), y el orden sale de `enOrden` —los grupos contiguos—, que es lo que se guarda
 *     siempre (EtapasEntregaModal). Lo que se quedó quieto conserva la suya.
 *   · ⚠️ Si la PRIMERA etapa del kanban cambia, se rechaza (`ERROR_PRIMERA`): ver la cabecera.
 *
 * Una etapa NUEVA (crear un módulo vinculado, vincular un suelto) va por `planConEtapaNueva`, que la
 * mete en su lugar y compara la primera contra el kanban de ANTES (`primera`).
 *
 * `primera`: la clave de la primera etapa del kanban COMO ESTÁ HOY. Default: la de `entrega`. Con una
 * etapa nueva ya metida en `entrega`, el default sería la nueva misma, y el chequeo no frenaría nada.
 */
export function planReorden(
  entrega: { etapas: readonly EtapaEntrega[]; fases: readonly FaseEntrega[] },
  modulos: readonly Pick<ModuloCurso, 'clave' | 'vinculado'>[],
  claves: readonly string[],
  primera: string | null = entrega.etapas[0]?.key ?? null,
): Plan {
  const actuales = modulos.map((m) => m.clave);
  if (claves.length !== actuales.length || new Set(claves).size !== claves.length || claves.some((k) => !actuales.includes(k))) {
    return { ok: false, error: 'El orden no coincide con los módulos.' };
  }
  const esVinculado = new Map(modulos.map((m) => [m.clave, m.vinculado]));
  const deseados = claves.filter((k) => esVinculado.get(k));
  const etapas = [...entrega.etapas];
  const lugares = etapas.map((e, i) => (esModuloDelCurso(e) && esVinculado.get(e.key) ? i : -1)).filter((i) => i >= 0);
  if (lugares.length !== deseados.length) return { ok: false, error: 'El orden no coincide con los módulos.' };
  const porClave = new Map(etapas.map((e) => [e.key, e]));
  const L = [...etapas];
  lugares.forEach((lugar, j) => { L[lugar] = porClave.get(deseados[j])!; });

  let final = L;
  let fases = [...entrega.fases];
  if (fases.length) {
    // Lo que se movió sale SÓLO de los lugares de los módulos: una etapa que no es módulo no se
    // mueve nunca (sigue en su lugar), aunque por los índices parezca que sí.
    const indiceOriginal = new Map(etapas.map((e, i) => [e.key, i]));
    const q = quietos(lugares.map((i) => indiceOriginal.get(L[i].key)!));
    const movidos = new Set(lugares.filter((_, j) => !q.has(j)));
    const conGrupo: EtapaEntrega[] = [];
    L.forEach((e, i) => {
      if (!movidos.has(i) || i === 0) { conGrupo.push(e); return; }
      conGrupo.push(conFase(e, grupoDe(conGrupo[i - 1], fases)));
    });
    const o = enOrden(conGrupo, fases);
    final = o.etapas;
    fases = o.fases;
  }
  if ((final[0]?.key ?? null) !== primera) return { ok: false, error: ERROR_PRIMERA };
  return {
    ok: true,
    etapas: final,
    fases,
    cambiaEntrega: firma(final, fases) !== firma(etapas, entrega.fases),
    anclas: anclasDe(claves, (k) => esVinculado.get(k) === false),
  };
}

/**
 * Dónde entra en el kanban la etapa de un módulo vinculado NUEVO que va en la posición `i` de la
 * secuencia `claves` (crear uno, o vincular un suelto): justo después de la etapa del vinculado más
 * cercano de ANTES en la secuencia; si no hay, justo antes de la del más cercano de DESPUÉS; y si el
 * curso no tiene ningún vinculado, al final del kanban.
 *
 * ⚠️ «JUSTO ANTES» DE LA PRIMERA ETAPA ES EL LUGAR 0, y ahí `planConEtapaNueva` la rechaza
 * (`ERROR_PRIMERA`): un módulo vinculado no puede ir antes de la entrada. La pantalla lo dice; no se
 * lo corre a escondidas.
 *
 * La fase: la de la etapa que queda antes (o ninguna). Devuelve el kanban con la etapa adentro.
 */
export function etapaNuevaEn(
  etapas: readonly EtapaEntrega[],
  fases: readonly FaseEntrega[],
  claves: readonly string[],
  i: number,
  esVinculado: (clave: string) => boolean,
  nueva: EtapaEntrega,
): EtapaEntrega[] {
  const lista = [...etapas];
  const idx = (k: string) => lista.findIndex((e) => e.key === k);
  let at = lista.length;
  const antes = claves.slice(0, i).reverse().find((k) => esVinculado(k) && idx(k) >= 0);
  if (antes) at = idx(antes) + 1;
  else {
    const despues = claves.slice(i + 1).find((k) => esVinculado(k) && idx(k) >= 0);
    if (despues) at = idx(despues);
  }
  const previa = at > 0 ? lista[at - 1] : null;
  const g = previa ? grupoDe(previa, fases) : '';
  lista.splice(at, 0, conFase(nueva, g));
  return lista;
}

/**
 * El plan de una secuencia que trae una etapa NUEVA (`nueva.key` en `claves`, en su lugar): crear un
 * módulo vinculado o vincular un suelto. Mete la etapa en el kanban (`etapaNuevaEn`) y planea.
 *
 * ⚠️ LA PRIMERA SE COMPARA CONTRA EL KANBAN DE ANTES DE METERLA. Hasta que esto existió (08/10/2026,
 * lo cazó tests/curso-modulos.test.ts) los dos llamadores pasaban a `planReorden` el kanban CON la
 * nueva adentro: crear un módulo vinculado «al principio» la dejaba en el lugar 0, el plan comparaba
 * la nueva contra sí misma, y pasaba — con lo cual TODOS los clientes sin fila caían en silencio a una
 * columna que nadie eligió.
 *
 * `modulos`: los de hoy, SIN la nueva (un suelto que se vincula ya no figura con su clave vieja).
 */
export function planConEtapaNueva(
  entrega: { etapas: readonly EtapaEntrega[]; fases: readonly FaseEntrega[] },
  modulos: readonly Pick<ModuloCurso, 'clave' | 'vinculado'>[],
  claves: readonly string[],
  nueva: EtapaEntrega,
): Plan {
  const i = claves.indexOf(nueva.key);
  if (i < 0 || entrega.etapas.some((e) => e.key === nueva.key)) return { ok: false, error: 'El orden no coincide con los módulos.' };
  const esVinc = new Map(modulos.map((m) => [m.clave, m.vinculado]));
  esVinc.set(nueva.key, true);
  const etapas = etapaNuevaEn(entrega.etapas, entrega.fases, claves, i, (k) => esVinc.get(k) === true, nueva);
  return planReorden({ etapas, fases: entrega.fases }, [...modulos, { clave: nueva.key, vinculado: true }], claves, entrega.etapas[0]?.key ?? null);
}

/** La etapa nueva de un módulo que se vincula o se crea vinculado: clave del nombre, color de la paleta. */
export function etapaDeModulo(nombre: string, existentes: readonly string[], cuantas: number): EtapaEntrega {
  return { key: nuevaClaveEtapa(nombre, existentes), label: nombre, ...colorNuevaEtapa(cuantas) };
}

/**
 * El plan de DEVOLVER una etapa que se acaba de quitar (el «Deshacer» del interruptor del kanban o de
 * «Eliminar módulo»): la MISMA etapa —su clave, su color, su fase, su agenda— en el MISMO lugar del
 * kanban (`indice`), no una igual en el lugar que elegiría `etapaNuevaEn`. Con otra clave, las
 * secuencias de entrega que apuntaban a la vieja quedarían colgando (AGENTS.md, «Deshacer una acción
 * destructiva devuelve la MISMA identidad, no una igual»).
 *
 * `indice` se acota a [1, largo]: el lugar 0 es la entrada del kanban, que nunca se quitó (ver
 * `decidirQuitarEtapa`). `modulos`: los de hoy SIN la devuelta (su suelto ya no figura con su clave
 * vieja); `claves`: la secuencia de módulos con la devuelta en su lugar.
 */
export function planConEtapaDevuelta(
  entrega: { etapas: readonly EtapaEntrega[]; fases: readonly FaseEntrega[] },
  modulos: readonly Pick<ModuloCurso, 'clave' | 'vinculado'>[],
  claves: readonly string[],
  etapa: EtapaEntrega,
  indice: number,
): Plan {
  if (!claves.includes(etapa.key) || entrega.etapas.some((e) => e.key === etapa.key)) return { ok: false, error: 'El orden no coincide con los módulos.' };
  const i = Math.max(1, Math.min(Number.isInteger(indice) ? indice : entrega.etapas.length, entrega.etapas.length));
  const etapas = [...entrega.etapas.slice(0, i), etapa, ...entrega.etapas.slice(i)];
  return planReorden({ etapas, fases: entrega.fases }, [...modulos, { clave: etapa.key, vinculado: true }], claves, entrega.etapas[0]?.key ?? null);
}

/** Por qué no se quita la entrada del kanban: corto, va en el menú al lado del interruptor apagado. */
export const ERROR_ENTRADA = 'Es la entrada del kanban.';

/** A dónde puede ir un cliente de una etapa que se quita: las OTRAS etapas del kanban, en su orden. */
export type DestinoClientes = { key: string; label: string };

/** Lo que hay que preguntar antes de quitar una etapa con clientes adentro. */
export type PreguntaDestino = { clientes: number; destinos: DestinoClientes[] };

/**
 * QUITAR UNA ETAPA DEL KANBAN desde el curso (08/10/2026, item 15): apagar «Etapa del kanban» o
 * «Eliminar módulo» de un vinculado. Pedido de Martín: «si se desactiva se elimina esa etapa del
 * kanban, y si hay leads debería preguntar a dónde los mueve».
 *
 *   · La ENTRADA del kanban (la primera) no se quita (`ERROR_ENTRADA`): «un cliente sin fila está en
 *     la primera etapa» (lib/servicio-etapas.ts, `repartirEnEtapas`), así que sacarla pasaría EN
 *     SILENCIO a todos los clientes sin fila a la siguiente.
 *   · Con clientes adentro y sin `destino`: no decide, PREGUNTA (las otras etapas, en orden).
 *   · El `destino` tiene que ser OTRA etapa de este kanban.
 *   · Las fases se conservan tal cual: quitar una columna no le borra el color a las demás.
 *
 * Puro: lo ejecuta tests/curso-modulos.test.ts. Quien escribe (lib/curso-modulos-datos.ts) mueve a
 * los clientes SIN mensajes y recién después guarda el kanban sin la etapa.
 */
export function decidirQuitarEtapa(
  entrega: { etapas: readonly EtapaEntrega[]; fases: readonly FaseEntrega[] },
  clave: string,
  clientes: number,
  destino?: string | null,
):
  | { ok: true; etapas: EtapaEntrega[]; fases: FaseEntrega[]; etapa: EtapaEntrega; indice: number; destino: string | null }
  | { ok: false; error: string; pregunta?: PreguntaDestino } {
  const indice = entrega.etapas.findIndex((e) => e.key === clave);
  if (indice < 0) return { ok: false, error: 'Esa etapa ya no existe.' };
  if (indice === 0) return { ok: false, error: ERROR_ENTRADA };
  const otras = entrega.etapas.filter((e) => e.key !== clave).map((e) => ({ key: e.key, label: e.label }));
  const d = destino == null || destino === '' ? null : String(destino);
  if (clientes > 0 && !d) return { ok: false, error: 'Elige a dónde van sus clientes.', pregunta: { clientes, destinos: otras } };
  if (d && !otras.some((e) => e.key === d)) return { ok: false, error: 'Esa etapa ya no existe.' };
  return {
    ok: true, etapa: entrega.etapas[indice], indice, destino: clientes > 0 ? d : null,
    etapas: entrega.etapas.filter((e) => e.key !== clave), fases: [...entrega.fases],
  };
}
