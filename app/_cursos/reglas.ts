/**
 * Las reglas PURAS del dibujo de un curso (`CursoUgc`): qué se lista, qué está marcado,
 * qué se puede abrir y qué dice cada contador.
 *
 * Viven aparte del componente para que tengan test (tests/cursos-ugc.test.ts) sin montar
 * React. No son reglas del CURSO —cuándo una tarea cuenta como enviada, cuándo una etapa
 * está completa—: ésas viven en lib/curso.ts y las trae cada adaptador ya resueltas.
 */
import type { ClaseUgc, DisposicionUgc, ModuloUgc, TextosUgc } from './tipos';

export const TEXTOS_DEFAULT: TextosUgc = {
  inicio: 'Inicio del curso',
  recursos: 'Recursos del curso',
  modulos: 'Módulos',
  modulo: 'Módulo',
  losModulos: 'Los módulos',
  buscar: 'Buscar lección',
  todasLasClases: 'Todas las clases',
  salir: 'Volver a los cursos',
  empezar: 'Empezar',
  leccion: 'lección',
  lecciones: 'lecciones',
  clases: 'clases',
  // El genérico, para cuando el server no manda su motivo (lib/curso-bloqueo.ts usa el mismo).
  bloqueada: 'Se abre más adelante',
  menu: 'Módulos',
  // Los dos «+» del pedido de Martín (item 12), con su nombre entero: «+ Clase» no decía qué agregaba.
  nueva: '+ Nueva clase',
  nuevoModulo: '+ Nuevo módulo',
  nombreModulo: 'Nombre del módulo',
  opciones: 'Opciones',
  sinResumen: 'Escribe una descripción',
  portada: 'Portada',
};

/** Un módulo bloqueado se dibuja y no se abre: ni desde la barra, ni desde su tarjeta, ni por URL. */
export const abrible = (m: ModuloUgc | undefined) => !!m && m.estado !== 'bloqueada';

/**
 * Las clases de la grilla. `null` = no hay grilla: se muestra el índice.
 *
 * ⚠️ ABRIR UN MÓDULO ES FILTRAR POR SU IDENTIDAD, NO BUSCAR SU NOMBRE. Antes era un
 *    `includes` de texto, y fallaba en las dos direcciones: un nombre contenido en otro
 *    arrastraba clases ajenas, y el módulo sintético de las clases sin grupo («Clases») no
 *    matcheaba a ninguna — 82 clases inalcanzables en 10 cursos, medido el 29/08/2026. Por
 *    eso es una igualdad contra `moduloKey`.
 *
 * Un módulo bloqueado no lista nada aunque la URL lo pida: sus clases no existen para
 * quien cursa (lib/curso-portal.ts no las manda), y si alguna viniera igual, abrirla sería
 * saltearse la etapa.
 */
export function clasesVisibles(
  clases: ClaseUgc[], modulos: ModuloUgc[], mod: string | null | undefined, q: string,
): ClaseUgc[] | null {
  if (mod) {
    const m = modulos.find((x) => x.key === mod);
    if (m && !abrible(m)) return [];
    return clases.filter((c) => c.moduloKey === mod);
  }
  const t = q.trim().toLowerCase();
  if (!t) return null;
  const nombre = new Map(modulos.map((m) => [m.key, m.nombre]));
  return clases.filter((c) => `${c.titulo} ${c.buscar ?? nombre.get(c.moduloKey) ?? ''}`.toLowerCase().includes(t));
}

/**
 * Anterior y siguiente, en el ORDEN DEL CURSO (no del módulo): terminar el último de un
 * módulo te lleva al primero del siguiente, que es lo que se hace después de ver.
 */
export function vecinas(clases: ClaseUgc[], id: number) {
  const i = clases.findIndex((c) => c.id === id);
  return {
    anterior: i > 0 ? clases[i - 1] : null,
    siguiente: i >= 0 && i < clases.length - 1 ? clases[i + 1] : null,
  };
}

/**
 * El renglón de la barra que va marcado. Estar «en un módulo» son DOS cosas y se marcan
 * las dos: verlo filtrado, y estar adentro de una de sus clases — esa es la que faltaba, y
 * es justo cuando más hace falta saber de qué módulo es lo que estás viendo.
 */
export const moduloMarcado = (clase: ClaseUgc | undefined, mod: string | null | undefined): string | null =>
  clase ? clase.moduloKey : (mod ?? null);

/** Si una clase se puede mover: por posición dentro de SU módulo. */
export function puedeMoverPorPosicion(clases: ClaseUgc[], id: number, dir: 'arriba' | 'abajo'): boolean {
  const c = clases.find((x) => x.id === id);
  if (!c) return false;
  const delModulo = clases.filter((x) => x.moduloKey === c.moduloKey);
  const i = delModulo.findIndex((x) => x.id === id);
  return dir === 'arriba' ? i > 0 : i < delModulo.length - 1;
}

const plural = (n: number, t: Pick<TextosUgc, 'leccion' | 'lecciones'>) => (n === 1 ? t.leccion : t.lecciones);

/** La línea chica de la tarjeta de un módulo: «16 lecciones · 71 min». */
export function textoTarjetaModulo(m: ModuloUgc, t: Pick<TextosUgc, 'leccion' | 'lecciones'>): string {
  if (m.textoTarjeta !== undefined) return m.textoTarjeta;
  return `${m.cuantas} ${plural(m.cuantas, t)}${m.rotuloExtra ? ` · ${m.rotuloExtra}` : ''}`;
}

/**
 * El contador de un módulo en la barra. Con avance, el avance: es lo que cambia. Sin avance, SÓLO la
 * cantidad de clases.
 *
 * ⚠️ SIN EL TIEMPO (`rotuloExtra`), y en el dibujo y no en un adaptador: «elimina en la sidebar de los
 *    módulos el tiempo. Si está bien que estén la cantidad de clases nada más» (Martín, 07/10/2026,
 *    item 11), y el item 1 pide lo mismo para Conocimientos, que monta este dibujo. La tarjeta del
 *    módulo sí lo sigue diciendo («16 lecciones · 71 min»): ahí hay lugar y se lee.
 */
export function textoBarraModulo(m: ModuloUgc): string {
  if (m.progreso) return `${m.progreso.hechas}/${m.progreso.total}`;
  if (m.textoBarra !== undefined) return m.textoBarra;
  return `${m.cuantas}`;
}

/** El título de la grilla: el módulo abierto con su cuenta, o «N de M» en una búsqueda. */
export function rotuloGrilla(
  nombreMod: string | null, cuantas: number, total: number, t: Pick<TextosUgc, 'leccion' | 'lecciones'>,
): string {
  return nombreMod != null ? `${nombreMod} · ${cuantas} ${plural(cuantas, t)}` : `${cuantas} de ${total}`;
}

/** El ancho de una barra de avance, en %. Recortado: una barra que pasa del 100% desborda la página. */
export function pctAvance(p: { hechas: number; total: number } | undefined): number {
  if (!p || !(p.total > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((p.hechas / p.total) * 100)));
}

/**
 * El interruptor de la lección (item 16): las dos disposiciones, en su orden, con lo que dicen. Texto
 * de pantalla: dos o tres palabras, la acción y su objeto.
 */
export const OPCIONES_DISPOSICION: ReadonlyArray<{ valor: DisposicionUgc; texto: string }> = [
  { valor: 'costado', texto: 'Texto al costado' },
  { valor: 'abajo', texto: 'Texto abajo' },
];

/**
 * La clase del contenedor de la lección. «Abajo» lleva su modificador, y su regla vive en
 * ./estilos.ts acotada a `.ahdoc--ugc`: la cola de la hoja del origen les da `flex: 1 1 0` a las dos
 * columnas, y apiladas en un alto que sale del contenido eso las deja en CERO (el papel se dibujaba
 * encima del título, ya pasó en el teléfono). Cualquier otro valor, al costado.
 */
export const claseDelSplit = (d: DisposicionUgc | null | undefined): string => (d === 'abajo' ? 'ugc-split ugc-split--abajo' : 'ugc-split');
