// =============================================================================
// buscar-cerebro — dónde busca la barra del segundo cerebro
// =============================================================================
// El matcheo NO se reescribe: sale de `lib/buscar-tareas.ts` (`coincide`), que ya resuelve
// palabras en cualquier orden, sin acentos ni mayúsculas, con frontera de palabra y plural
// tolerado. Dos búsquedas que se comportan distinto en la misma app es exactamente lo que
// «una cosa, un lugar» viene a evitar.
//
// Lo que SÍ es propio de acá es en QUÉ mira. Un nodo tiene cuatro textos y no ocho como
// una tarea, y cada uno contesta una pregunta distinta:
//   · el NOMBRE es lo que se ve dibujado en el mapa — lo que uno escribe casi siempre;
//   · el DETALLE es el contenido, y encuentra mucho más (a veces demasiado);
//   · la PROCEDENCIA contesta «¿de dónde salió esto?»;
//   · el ÁREA hace que buscar «voz» encuentre lo que vive en «Voz y cara».
//
// Este módulo NO lleva `server-only`: lo importan la barra (navegador) y la ruta de la
// búsqueda con MaKo (servidor).
// =============================================================================

import { coincide } from './buscar-tareas';
import { AREAS, type NodoCerebro } from './cerebro-modelo';

export type CampoCerebro = 'nombre' | 'detalle' | 'fuente' | 'area';

export const CAMPOS_CEREBRO: Array<{ id: CampoCerebro; label: string; ayuda: string; texto: (n: NodoCerebro) => string }> = [
  { id: 'nombre', label: 'El nombre', ayuda: 'Lo que se lee al lado del punto en el mapa.', texto: (n) => n.etiqueta },
  { id: 'detalle', label: 'El contenido', ayuda: 'Lo que dice adentro. Encuentra mucho más.', texto: (n) => `${n.detalle} ${(n.datos ?? []).map((d) => `${d.k} ${d.v}`).join(' ')} ${n.cuerpo ?? ''}` },
  { id: 'fuente', label: 'De dónde salió', ayuda: 'Si lo dedujo MaKo, de qué documento, o si lo escribiste tú.', texto: (n) => n.fuente },
  { id: 'area', label: 'El área', ayuda: 'Buscar «voz» encuentra lo que vive en Voz y cara.', texto: (n) => AREAS.find((a) => a.id === n.area)?.nombre ?? '' },
];

/** Lo que la barra busca por defecto: el nombre. Es lo que uno espera al escribir una
 *  palabra, y ampliarlo a mano es un click. */
export const CAMPOS_CEREBRO_DEFECTO: CampoCerebro[] = ['nombre'];
export const CAMPOS_CEREBRO_TODOS: CampoCerebro[] = CAMPOS_CEREBRO.map((c) => c.id);

/** ¿Este nodo matchea? */
export function matchNodo(n: NodoCerebro, q: string, campos: CampoCerebro[] = CAMPOS_CEREBRO_DEFECTO): boolean {
  if (!q.trim()) return false;
  const heno = CAMPOS_CEREBRO.filter((c) => campos.includes(c.id)).map((c) => c.texto(n)).join(' ');
  return coincide(heno, q);
}

/** El chip que dice DÓNDE se está buscando. Sin esto, sumar «el contenido» hace aparecer
 *  treinta resultados y parece que el buscador se rompió. */
export function resumenCamposCerebro(campos: CampoCerebro[]): string {
  if (campos.length === 0) return 'sin campos: no va a encontrar nada';
  if (campos.length === CAMPOS_CEREBRO_TODOS.length) return 'buscando en todo';
  const nombres = CAMPOS_CEREBRO.filter((c) => campos.includes(c.id)).map((c) => c.label.replace(/^(El|La) /, '').toLowerCase());
  return `buscando en ${nombres.join(' + ')}`;
}
