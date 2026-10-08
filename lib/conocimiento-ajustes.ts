// =============================================================================
// conocimiento-ajustes — lo que el SUPER ADMIN le cambió a un curso de Conocimientos
// =============================================================================
// Pedido de Martín (07/10/2026, item 1): «En la tab de CONOCIMIENTOS como SuperAdmin debería poder
// editar todo, aplicalo también allí. Claro que los links compartidos y otros usuarios no deben poder
// editar eso.» D9 de docs/diseno-curso-skool.md.
//
// Los cursos viven en el CÓDIGO (app/conocimientos/catalogo.ts y sus fichas) y las fichas las
// reescribe entera `scripts/curso-a-portal.mjs` en cada corrida: un cambio escrito ahí no sobrevive.
// Por eso lo que el super admin cambia se guarda aparte (`conocimiento_ajustes`, mig 0221) y se
// APLICA ENCIMA del catálogo acá. Este módulo decide qué se puede ajustar, qué vale cada ajuste, y
// cómo queda el curso con las filas puestas. La base sólo pone techos.
//
// ⚠️ SIN `server-only` A PROPÓSITO: lo importan el server (el saneo de lo que se guarda, los links
//    compartidos), el navegador (el portal ya trae el catálogo entero, así que aplica las filas que le
//    manda la página) y los tests.
// ⚠️ LO QUE SE LEE TAMBIÉN SE SANEA (`filaLeida`), no sólo lo que se escribe: una portada con un origen
//    que hoy no se acepta, o un nombre escrito a mano en la base, se dibujaría en el navegador de un
//    tercero. Una fila que no pasa el saneo se ignora y vuelve lo de la ficha.
// ⚠️ LA IDENTIDAD DE UN MÓDULO ES EL NOMBRE ORIGINAL DE SU GRUPO (`key`), y renombrarlo cambia sólo lo
//    que se DIBUJA (`nombre`). Los `#mod=<nombre>` que ya circulan siguen andando, y ningún ajuste se
//    escribe contra un nombre que el propio super admin puede cambiar.
// ⚠️ UN AJUSTE HUÉRFANO NO ROMPE NADA: si una regeneración renombra un grupo o saca una clase, sus
//    filas no encuentran a quién aplicarse y se ignoran (el test lo fija).

import type { Clase, Curso } from '../app/conocimientos/curso';
import { saneaPortada } from './portadas';
import { leerLamina, valorDeLamina } from './laminas';
import { ACENTO_DEFAULT, acentoLegible, hexValido, tapaDe } from './curso-estilo';

/**
 * El nombre del módulo que se INVENTA cuando una clase no trae `grupo`. Una sola constante porque lo
 * usan el que agrupa y el que filtra, y si no coinciden el módulo se dibuja y al abrirlo sale vacío
 * (eran 82 clases de 10 cursos inalcanzables, medido el 29/08/2026).
 */
export const SIN_MODULO = 'Clases';

/** Los topes de lo que se escribe. Los de la ficha no pasan por acá: un título del catálogo de 82 se ve igual. */
export const TOPE_TITULO_CURSO = 120;
export const TOPE_RESUMEN_CURSO = 400;
export const TOPE_NOMBRE_MODULO = 120;
export const TOPE_TITULO_CLASE = 160;
/** El largo de una identidad de módulo: el grupo más largo del catálogo mide 91 (08/10/2026). */
const TOPE_ID_MODULO = 300;
const TOPE_SLUG = 200;
const ORDEN_MAX = 9999;
/**
 * Lo que no tiene `orden` propio va DESPUÉS de todo lo ordenado, en su orden de la ficha. Así una
 * clase que una regeneración suma a un módulo ya ordenado cae al final, y no en el medio de un orden
 * que alguien eligió.
 */
const SIN_ORDEN = 1_000_000;

export type ObjetoAjuste = 'curso' | 'modulo' | 'clase';
export type CampoAjuste = 'titulo' | 'resumen' | 'acento' | 'portada' | 'nombre' | 'orden' | 'oculto' | 'modulo' | 'oculta';

/**
 * Qué se puede ajustar de cada cosa. Es lo de D9: del curso su título, resumen, color y portada; de un
 * módulo su nombre, portada, orden y si está oculto; de una clase su título, portada, orden, módulo y
 * si está oculta. ⚠️ Un `Map` y no un objeto: un campo llamado `constructor` existiría en un objeto
 * común sin estar en la lista (es el bug que lib/curso-estilo.ts encontró con una etapa «Constructor»).
 */
const CAMPOS: ReadonlyMap<string, readonly CampoAjuste[]> = new Map<string, readonly CampoAjuste[]>([
  ['curso', ['titulo', 'resumen', 'acento', 'portada']],
  ['modulo', ['nombre', 'portada', 'orden', 'oculto']],
  ['clase', ['titulo', 'portada', 'orden', 'modulo', 'oculta']],
]);

/** QUÉ se ajusta, sin el valor: lo que viaja de la pantalla a la acción. */
export type QueAjuste = { objeto: ObjetoAjuste; objetoId: string; campo: CampoAjuste };

/** Una fila de `conocimiento_ajustes`, como se lee de la base (ya saneada por `filaLeida`). */
export type FilaAjuste = { curso_slug: string; objeto: ObjetoAjuste; objeto_id: string; campo: CampoAjuste; valor: string };

/** Lo que una escritura pone y saca. Sacar una fila es volver a lo de la ficha. */
export type Cambios = { poner: Array<QueAjuste & { valor: string }>; quitar: QueAjuste[] };

/** Lo que contestan las acciones: las filas de ESE curso como quedaron, o por qué no. */
export type ResultadoAjuste = { ok: true; filas: FilaAjuste[] } | { ok: false; error: string };

/** Sin caracteres de control: una identidad que viaja en una URL y en un `title` no lleva saltos ni NULs. */
const CONTROL = /[\p{Cc}\p{Cf}]/u;

const idModuloValido = (v: unknown): v is string =>
  typeof v === 'string' && v.length >= 1 && v.length <= TOPE_ID_MODULO && v.trim() !== '' && !CONTROL.test(v);

/** Un QUÉ que llega de la pantalla (no confiable), validado; `null` si no es uno que exista. */
export function queValido(x: unknown): QueAjuste | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const campos = typeof o.objeto === 'string' ? CAMPOS.get(o.objeto) : undefined;
  if (!campos || typeof o.campo !== 'string' || !(campos as readonly string[]).includes(o.campo)) return null;
  const objeto = o.objeto as ObjetoAjuste;
  const campo = o.campo as CampoAjuste;
  const id = o.objetoId ?? '';
  if (objeto === 'curso') return id === '' ? { objeto, objetoId: '', campo } : null;
  if (objeto === 'modulo') return idModuloValido(id) ? { objeto, objetoId: id, campo } : null;
  // Una clase es su `n`: un entero > 0 (el `#clase=` exige `> 0`, app/conocimientos/posicion.ts).
  return typeof id === 'string' && /^[1-9]\d{0,8}$/.test(id) ? { objeto, objetoId: id, campo } : null;
}

/** Un texto de una línea: sin controles, espacios colapsados, recortado al tope EN CARACTERES. `''` = nada. */
function linea(v: unknown, tope: number): string {
  if (typeof v !== 'string') return '';
  const limpio = v.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim();
  const chars = Array.from(limpio);
  return chars.length > tope ? chars.slice(0, tope).join('').trim() : limpio;
}

/**
 * La portada de un módulo o de una clase: lo de lib/portadas.ts o una LÁMINA dibujada, guardada en su
 * forma canónica (la que marca el selector es el mismo string que la guardada). La del curso no
 * acepta láminas: una lámina es un número con su rótulo, y la portada del curso no tiene número.
 */
function portadaConLamina(v: unknown): string | null {
  const l = leerLamina(v);
  return l ? valorDeLamina(l) : saneaPortada(v);
}

/**
 * Lo que de verdad se guarda para un ajuste. `null` = volver a lo de la ficha (se BORRA la fila).
 * Corre en el SERVER al escribir y en cualquier lado al leer: lo que manda el navegador es una propuesta.
 */
export function sanearValor(q: QueAjuste, v: unknown): string | null {
  switch (q.campo) {
    case 'titulo': return linea(v, q.objeto === 'clase' ? TOPE_TITULO_CLASE : TOPE_TITULO_CURSO) || null;
    case 'resumen': return linea(v, TOPE_RESUMEN_CURSO) || null;
    case 'nombre': return linea(v, TOPE_NOMBRE_MODULO) || null;
    case 'acento': {
      // Aclarado hasta que la tinta se LEA encima (el acento es fondo de texto oscuro). El lima de la
      // casa es el default: elegirlo es volver a él, y eso es borrar la fila.
      const hex = hexValido(v);
      const leg = hex ? acentoLegible(hex) : null;
      return leg && leg !== ACENTO_DEFAULT ? leg : null;
    }
    case 'portada': return q.objeto === 'curso' ? saneaPortada(v) : portadaConLamina(v);
    case 'orden': {
      const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,4}$/.test(v.trim()) ? Number(v.trim()) : NaN;
      return Number.isInteger(n) && n >= 0 && n <= ORDEN_MAX ? String(n) : null;
    }
    // Oculto es un SÍ; mostrar es borrar la fila. «Nadie lo ocultó» y «lo volvieron a mostrar» son lo mismo.
    case 'oculto':
    case 'oculta': return v === true || v === '1' || v === 'true' ? '1' : null;
    // El módulo al que se MUDÓ una clase: la identidad de otro módulo. Si existe o no, lo decide quien
    // aplica (un huérfano se ignora) y la acción antes de escribir.
    case 'modulo': return idModuloValido(v) ? v : null;
    default: return null;
  }
}

/** Una fila que llega de la base, validada y con su valor SANEADO; `null` si no se puede aplicar. */
export function filaLeida(x: unknown): FilaAjuste | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.curso_slug !== 'string' || !o.curso_slug || o.curso_slug.length > TOPE_SLUG) return null;
  const q = queValido({ objeto: o.objeto, objetoId: o.objeto_id, campo: o.campo });
  if (!q) return null;
  const valor = sanearValor(q, o.valor);
  if (valor == null) return null;
  return { curso_slug: o.curso_slug, objeto: q.objeto, objeto_id: q.objetoId, campo: q.campo, valor };
}

/** La clave de un QUÉ: un solo lugar la arma (dos filas con la misma clave son la misma fila). */
export const claveDe = (q: QueAjuste): string => JSON.stringify([q.objeto, q.objetoId, q.campo]);
const claveDeFila = (f: FilaAjuste): string => claveDe({ objeto: f.objeto, objetoId: f.objeto_id, campo: f.campo });

/**
 * Las filas con unos cambios aplicados: lo que la pantalla muestra en el acto, antes de que conteste
 * el server (que contesta con las filas de verdad y ésas mandan).
 */
export function conCambios(filas: readonly FilaAjuste[], slug: string, c: Cambios): FilaAjuste[] {
  const fuera = new Set([...c.poner, ...c.quitar].map(claveDe));
  const quedan = filas.filter((f) => f.curso_slug !== slug || !fuera.has(claveDeFila(f)));
  const nuevas = c.poner.map((p): FilaAjuste => ({ curso_slug: slug, objeto: p.objeto, objeto_id: p.objetoId, campo: p.campo, valor: p.valor }));
  return [...quedan, ...nuevas];
}

// ── El curso con los ajustes puestos ─────────────────────────────────────────────────

/** Lo que el super admin le cambió al curso entero, ya saneado. Sin fila, `null`. */
type DelCurso = { titulo: string | null; resumen: string | null; acento: string | null; portada: string | null };

/** La ficha de un curso con lo suyo aplicado (sin tocar las clases): lo que necesita la grilla de cursos. */
export type CursoAjustado = Curso & {
  /** El color de acento elegido, legible; `null` = el lima de la casa. */
  acento: string | null;
  /** La portada que se le eligió, tal como se guardó (`grad:` o una foto); `null` = la del catálogo. */
  portadaElegida: string | null;
  /** Un degradado elegido, como `background` CSS (la portada, si se eligió una foto, va en `portada`). */
  fondo?: string;
};

export type ClaseAjustada = Clase & {
  /** Su módulo (la `key`): el de su grupo, o al que se la mudó. */
  moduloKey: string;
  /** El módulo de su grupo en la ficha. */
  moduloOriginal: string;
  /** El título de la ficha (para «Volver al título original»). */
  tituloOriginal: string;
  /** La portada elegida (lámina, degradado o foto); `null` = la de siempre. */
  portadaElegida: string | null;
  /** Oculta ella, o su módulo. Sólo llega con `conOcultos`: a nadie más se le manda. */
  oculta: boolean;
  /** Oculta ELLA (no por su módulo): lo que «Mostrar» puede deshacer desde la clase. */
  ocultaPropia: boolean;
};

export type ModuloAjustado = {
  /** La identidad: el nombre ORIGINAL del grupo (o `SIN_MODULO`). */
  key: string;
  /** Lo que se dibuja: el nombre elegido, o el de la ficha. */
  nombre: string;
  /** La portada elegida (lámina, degradado o foto); `null` = la de siempre. */
  portadaElegida: string | null;
  oculto: boolean;
  /** Sus clases, en su orden (con `conOcultos`, también las ocultas). */
  clases: ClaseAjustada[];
  /** Su lugar en la ficha (0, 1, …). */
  orden0: number;
  /**
   * El número con el que se arma la ruta de su tapa de la ficha (`${portadasModulo}${n}.webp`): el de
   * la regla de siempre, sobre la ficha ENTERA. Es un dato del archivo y no de la posición: mover el
   * módulo no puede cambiarle la foto.
   */
  nFicha: number;
  /** Sus clases son las de la ficha, en el orden de la ficha (ninguna movida, sacada ni reordenada). */
  clasesIntactas: boolean;
};

export type CursoConAjustes = Omit<CursoAjustado, 'clases'> & {
  /** Las clases en el orden del curso, módulo por módulo (Anterior/Siguiente lo siguen). */
  clases: ClaseAjustada[];
  modulos: ModuloAjustado[];
  /** Cuántos módulos tiene la ficha: si los de acá son los mismos y en su orden, se numeran como siempre. */
  modulosDeLaFicha: number;
};

/** Las filas de UN curso, ya saneadas. Las de otro curso se ignoran: pasar todas es seguro. */
function filasDe(slug: string, filas: readonly unknown[]): FilaAjuste[] {
  const out: FilaAjuste[] = [];
  for (const x of filas) {
    // El slug se mira ANTES de sanear: la grilla aplica esto a los 132 cursos con TODAS las filas, y
    // sanear cada fila 132 veces es trabajo tirado.
    if (!x || typeof x !== 'object' || (x as { curso_slug?: unknown }).curso_slug !== slug) continue;
    const f = filaLeida(x);
    if (f) out.push(f);
  }
  return out;
}

function delCurso(filas: readonly FilaAjuste[]): DelCurso {
  const d: DelCurso = { titulo: null, resumen: null, acento: null, portada: null };
  for (const f of filas) {
    if (f.objeto !== 'curso') continue;
    if (f.campo === 'titulo' || f.campo === 'resumen' || f.campo === 'acento' || f.campo === 'portada') d[f.campo] = f.valor;
  }
  return d;
}

function ficha(curso: Curso, d: DelCurso): CursoAjustado {
  // La portada elegida le gana a la del catálogo: una FOTO va donde iba la tapa (la grilla, la vista
  // previa del link); un DEGRADADO va como fondo, y entonces la tapa del catálogo NO se dibuja encima.
  const { tapa, fondo } = tapaDe(d.portada);
  return {
    ...curso,
    titulo: d.titulo ?? curso.titulo,
    // El hero de adentro usa el título SIN autor. Si el super admin escribió uno, ése es el que va
    // en los dos lados: «el título» es uno solo para quien lo eligió.
    tituloCorto: d.titulo ?? curso.tituloCorto,
    resumen: d.resumen ?? curso.resumen,
    portada: tapa ?? (fondo ? undefined : curso.portada),
    ...(fondo ? { fondo } : {}),
    acento: d.acento,
    portadaElegida: d.portada,
  };
}

/** La ficha de un curso con lo suyo aplicado, SIN tocar las clases. Es lo que pinta la grilla de cursos. */
export function ajustarFicha(curso: Curso, filas: readonly unknown[]): CursoAjustado {
  return ficha(curso, delCurso(filasDe(curso.slug, filas)));
}

/**
 * ⚠️ CUANDO EL MÓDULO DICE CÓMO SE LLAMA, GANA ÉL (la regla que vivía en CursoReplica). En `m5-95` los
 * módulos se llaman «Módulo 9»… «Módulo 19» y la posición daba 8..18: 95 de 134 discrepaban. Se adopta
 * la numeración propia sólo si TODOS la traen y ninguna con parte decimal («Módulo 1.1» es un hijo del
 * 1); si no, la posición. Un ordinal repetido NO se corrige: es lo que dice la fuente.
 */
export const ORDINAL_PROPIO = /^\s*[([]?\s*(?:m[oó]dulo|semana|unidad|secci[oó]n|bloque|cap[ií]tulo)\s*[)\]]?\s*(\d{1,3})(\.\d+)?\b/iu;

export function numerosPropios(nombres: readonly string[]): number[] | null {
  const m = nombres.map((n) => ORDINAL_PROPIO.exec(n));
  return m.length > 0 && m.every((x) => x && !x[2]) ? m.map((x) => Number(x![1])) : null;
}

/**
 * El curso con TODOS sus ajustes: título, portada y color del curso; nombre, portada, orden y ocultos
 * de los módulos; título, portada, orden, módulo y ocultas de las clases.
 *
 * `conOcultos`: lo ve el super admin (los módulos y clases ocultos vienen, marcados, para poder
 * mostrarlos de nuevo). Sin eso —un link compartido, cualquier otro— lo oculto NO VIENE: ni el módulo,
 * ni sus clases, ni la clase. Y un módulo que se quedó sin clases tampoco: una tarjeta de «0 lecciones»
 * no le dice nada a quien cursa.
 */
export function aplicarAjustes(curso: Curso, filas: readonly unknown[], opts: { conOcultos?: boolean } = {}): CursoConAjustes {
  const propias = filasDe(curso.slug, filas);
  const base = ficha(curso, delCurso(propias));

  // Los ajustes de cada módulo y de cada clase, por su identidad.
  const mod = new Map<string, Partial<Record<CampoAjuste, string>>>();
  const cla = new Map<string, Partial<Record<CampoAjuste, string>>>();
  for (const f of propias) {
    const m = f.objeto === 'modulo' ? mod : f.objeto === 'clase' ? cla : null;
    if (!m) continue;
    const prev = m.get(f.objeto_id) ?? {};
    prev[f.campo] = f.valor;
    m.set(f.objeto_id, prev);
  }

  // 1. Los módulos de la FICHA, en el orden en que aparecen sus clases (lo de siempre).
  const grupos = new Map<string, Clase[]>();
  for (const c of curso.clases) {
    const g = c.grupo || SIN_MODULO;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(c);
  }
  const keys = [...grupos.keys()];
  const propios = numerosPropios(keys);
  const nFicha = new Map(keys.map((k, i) => [
    k,
    propios ? propios[i] : (Number(String(grupos.get(k)![0]?.codigo ?? '').split('.')[0]) || i + 1),
  ]));

  // 2. Cada clase a su módulo: el suyo, o al que se la mudó si ése existe (un destino huérfano se ignora).
  const indice = new Map(curso.clases.map((c, i) => [c.n, i]));
  const enModulo = new Map<string, ClaseAjustada[]>(keys.map((k) => [k, []]));
  for (const c of curso.clases) {
    const a = cla.get(String(c.n)) ?? {};
    const original = c.grupo || SIN_MODULO;
    const destino = a.modulo && enModulo.has(a.modulo) ? a.modulo : original;
    enModulo.get(destino)!.push({
      ...c,
      titulo: a.titulo ?? c.titulo,
      tituloOriginal: c.titulo,
      moduloKey: destino,
      moduloOriginal: original,
      portadaElegida: a.portada ?? null,
      oculta: a.oculta === '1',
      ocultaPropia: a.oculta === '1',
    });
  }
  const clave = (orden: string | undefined, i: number) => (orden != null ? Number(orden) : SIN_ORDEN + i);

  // 3. Los módulos en su orden: el elegido, y lo que no tiene orden después, en el de la ficha.
  const ordenados = keys
    .map((k, i) => ({ k, i, o: clave(mod.get(k)?.orden, i) }))
    .sort((a, b) => a.o - b.o || a.i - b.i);

  const modulos: ModuloAjustado[] = [];
  for (const { k, i } of ordenados) {
    const a = mod.get(k) ?? {};
    const oculto = a.oculto === '1';
    const todas = enModulo.get(k)!
      .map((c) => ({ c, o: clave(cla.get(String(c.n))?.orden, indice.get(c.n)!) }))
      .sort((x, y) => x.o - y.o || indice.get(x.c.n)! - indice.get(y.c.n)!)
      .map(({ c }) => (oculto ? { ...c, oculta: true } : c));
    const clases = opts.conOcultos ? todas : todas.filter((c) => !c.oculta);
    if (!opts.conOcultos && (oculto || clases.length === 0)) continue;
    const deLaFicha = grupos.get(k)!;
    modulos.push({
      key: k,
      nombre: a.nombre ?? k,
      portadaElegida: a.portada ?? null,
      oculto,
      clases,
      orden0: i,
      nFicha: nFicha.get(k)!,
      clasesIntactas: clases.length === deLaFicha.length && clases.every((c, j) => c.n === deLaFicha[j].n),
    });
  }

  return { ...base, modulos, clases: modulos.flatMap((m) => m.clases), modulosDeLaFicha: keys.length };
}

// ── Los gestos que tocan el ORDEN: qué filas escriben ────────────────────────────────
// Puros, para que la pantalla los aplique en el acto y el server los recalcule desde SUS filas (la
// acción recibe la intención, no las filas: dos pestañas no se pisan con un orden viejo).

/** Un error de un gesto, dicho para la pantalla. */
type ErrorGesto = { error: string };

/**
 * Arrastrar un módulo: la lista ENTERA de keys en el orden nuevo (la que manda el dibujo). Se escribe el
 * `orden` de todos, así lo que no tenía orden no queda mezclado con lo que sí.
 */
export function planOrdenModulos(cur: CursoConAjustes, keys: readonly string[]): Cambios | ErrorGesto {
  const actuales = cur.modulos.map((m) => m.key);
  const iguales = keys.length === actuales.length && new Set(keys).size === keys.length && keys.every((k) => actuales.includes(k));
  if (!iguales) return { error: 'La lista de módulos cambió. Recarga la página.' };
  // Soltado donde estaba: nada que escribir (un guardado de más es un parpadeo y una fila de historial).
  if (keys.every((k, i) => k === actuales[i])) return { poner: [], quitar: [] };
  return {
    poner: keys.map((k, i) => ({ objeto: 'modulo' as const, objetoId: k, campo: 'orden' as const, valor: String(i) })),
    quitar: [],
  };
}

/**
 * Llevar una clase a un módulo (el suyo u otro), antes de `antesDe` (`null` = al final). Se escribe el
 * orden de TODAS las clases del módulo destino, y del de origen si es otro; y su módulo, salvo que
 * vuelva al de su grupo (entonces se BORRA la fila: es lo de la ficha).
 */
export function planLlevarClase(cur: CursoConAjustes, n: number, destino: string, antesDe: number | null): Cambios | ErrorGesto {
  const clase = cur.clases.find((c) => c.n === n);
  const dest = cur.modulos.find((m) => m.key === destino);
  if (!clase || !dest) return { error: 'Esa clase o ese módulo ya no están. Recarga la página.' };
  const origen = cur.modulos.find((m) => m.key === clase.moduloKey);
  const lista = dest.clases.filter((c) => c.n !== n).map((c) => c.n);
  const i = antesDe == null ? lista.length : lista.indexOf(antesDe);
  if (i < 0) return { error: 'Esa clase ya no está en ese módulo. Recarga la página.' };
  lista.splice(i, 0, n);
  // Soltada donde estaba: nada que escribir.
  if (origen?.key === dest.key && lista.every((x, k) => x === dest.clases[k]?.n)) return { poner: [], quitar: [] };
  const orden = (ns: readonly number[]) => ns.map((x, k) => ({ objeto: 'clase' as const, objetoId: String(x), campo: 'orden' as const, valor: String(k) }));
  const poner: Cambios['poner'] = orden(lista);
  const quitar: QueAjuste[] = [];
  if (origen && origen.key !== dest.key) {
    poner.push(...orden(origen.clases.filter((c) => c.n !== n).map((c) => c.n)));
    const q = { objeto: 'clase' as const, objetoId: String(n), campo: 'modulo' as const };
    if (dest.key === clase.moduloOriginal) quitar.push(q);
    else poner.push({ ...q, valor: dest.key });
  }
  return { poner, quitar };
}

/**
 * ↑ / ↓ de una clase: a qué clase queda pegada (lo que pide `planLlevarClase`). `undefined` = no se
 * puede (es la primera o la última de su módulo).
 */
export function antesDeAlMover(cur: CursoConAjustes, n: number, dir: 'arriba' | 'abajo'): number | null | undefined {
  const c = cur.clases.find((x) => x.n === n);
  const m = c ? cur.modulos.find((x) => x.key === c.moduloKey) : undefined;
  if (!c || !m) return undefined;
  const ns = m.clases.map((x) => x.n);
  const i = ns.indexOf(n);
  if (dir === 'arriba') return i > 0 ? ns[i - 1] : undefined;
  if (i < 0 || i >= ns.length - 1) return undefined;
  return i + 2 < ns.length ? ns[i + 2] : null;
}

/** ¿Este gesto devolvió un error? */
export const esErrorGesto = (x: Cambios | ErrorGesto): x is ErrorGesto => 'error' in x;
