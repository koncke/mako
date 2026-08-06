// =============================================================================
// buscar-tareas — DÓNDE busca la barra de búsqueda, en un solo lugar
// =============================================================================
// El problema, dicho por el dueño: «es incómodo y contraintuitivo que intente buscar
// coincidencia en un título y me salgan muchas tareas porque está leyendo el detalle y
// otras cosas».
//
// Tenía razón y era literal: `matchTexto` armaba un heno con título + detalle + notas +
// razón del score + los pasos de la checklist, TODO junto y siempre. Buscar «landing»
// devolvía media lista, porque «landing» aparece en el detalle de treinta tareas.
//
// El arreglo NO es sacar esos campos —buscar adentro del detalle o de la checklist es
// justamente lo que a veces se necesita— sino que sea una ELECCIÓN:
//   · por defecto, solo el TÍTULO (y el #número, que nunca es ruido);
//   · la búsqueda avanzada suma los campos que uno pida, de a uno.
//
// Este módulo NO tiene `server-only` a propósito: lo importan la barra (navegador) y la
// búsqueda con IA (server), y los dos tienen que estar de acuerdo en qué campo es cuál.
// Ver «Una cosa, un lugar» en AGENTS.md.
// =============================================================================

/** Lo mínimo que necesita el buscador de una tarea. Deliberadamente flojo: así sirve
 *  para `BoardTask` del tablero del dueño y para la `Tarea` de los clientes. */
export type TareaBuscable = {
  title?: string; titulo?: string;
  num?: number;
  detalle?: string;
  notas?: string;
  scoreRazon?: string;
  deadlineRazon?: string;
  checklist?: Array<{ text?: string; texto?: string }>;
};

export type CampoBusqueda = 'titulo' | 'detalle' | 'checklist' | 'notas' | 'razones';

/** Los campos, con su etiqueta y de dónde sale el texto. Es la lista que pinta la UI
 *  y la misma que le describe los campos a la IA: si acá se agrega uno, aparece en los
 *  dos lados sin tocar nada más. */
export const CAMPOS: Array<{ id: CampoBusqueda; label: string; ayuda: string; texto: (t: TareaBuscable) => string }> = [
  { id: 'titulo', label: 'Título', ayuda: 'el nombre de la tarea', texto: (t) => t.title ?? t.titulo ?? '' },
  { id: 'detalle', label: 'Detalle', ayuda: 'el doc completo de la tarea', texto: (t) => t.detalle ?? '' },
  { id: 'checklist', label: 'Checklist', ayuda: 'los pasos de adentro', texto: (t) => (t.checklist ?? []).map((c) => c.text ?? c.texto ?? '').join(' ') },
  { id: 'notas', label: 'Notas', ayuda: 'tu cuaderno, que la IA nunca pisa', texto: (t) => t.notas ?? '' },
  { id: 'razones', label: 'Razones de MaKo', ayuda: 'por qué te puso ese puntaje y esa fecha', texto: (t) => `${t.scoreRazon ?? ''} ${t.deadlineRazon ?? ''}` },
];

/** Lo que busca la barra sin tocar nada. Solo el título: es lo que uno espera cuando
 *  escribe una palabra en un buscador. */
export const CAMPOS_POR_DEFECTO: CampoBusqueda[] = ['titulo'];

/** Todos, que es lo que hacía ANTES para todo el mundo, ahora bajo pedido explícito. */
export const CAMPOS_TODOS: CampoBusqueda[] = CAMPOS.map((c) => c.id);

/** Sin acentos, sin mayúsculas, sin puntuación: «Añadí» encuentra «anadi» y «anadí». */
export const paraBuscar = (s: string): string =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9áéíóúñ\s]/gi, ' ').replace(/\s+/g, ' ').trim();

/**
 * ¿El texto contiene lo buscado? Por PALABRAS y en cualquier orden: «landing copy»
 * encuentra «Reescribir el copy de la landing». Con `includes` a secas, invertir dos
 * palabras devolvía cero.
 */
export function coincide(heno: string, q: string): boolean {
  const h = paraBuscar(heno);
  const piezas = paraBuscar(q).split(' ').filter(Boolean);
  return piezas.length > 0 && piezas.every((p) => h.includes(p));
}

/**
 * El filtro de la barra. `campos` decide dónde mira.
 *
 * El `#número` se busca SIEMPRE, sin importar los campos elegidos: escribir «#412» es
 * pedir una tarea puntual, no buscar texto, y es la única forma de llegar a una tarea
 * cuyo título no se recuerda.
 */
export function matchTarea(t: TareaBuscable, q: string, campos: CampoBusqueda[] = CAMPOS_POR_DEFECTO): boolean {
  const s = (q ?? '').trim();
  if (!s) return true;

  const soloNum = /^#\s*(\d+)$/.exec(s);
  if (soloNum) return t.num === Number(soloNum[1]);
  if (/^\d+$/.test(s) && t.num === Number(s)) return true;

  const activos = CAMPOS.filter((c) => campos.includes(c.id));
  if (!activos.length) return false;
  return coincide(activos.map((c) => c.texto(t)).join(' \n '), s);
}

/** Para el chip de la barra: «Título» · «Título y 2 más» · «Todos los campos». */
export function resumenCampos(campos: CampoBusqueda[]): string {
  if (campos.length >= CAMPOS.length) return 'Todos los campos';
  const nombres = CAMPOS.filter((c) => campos.includes(c.id)).map((c) => c.label);
  if (!nombres.length) return 'Ningún campo';
  if (nombres.length === 1) return nombres[0];
  return `${nombres[0]} y ${nombres.length - 1} más`;
}
