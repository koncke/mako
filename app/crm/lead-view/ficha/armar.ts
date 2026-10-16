// =============================================================================
// ficha/armar — lo que decide el armador, PURO: qué bloques se dibujan en una tab, con qué ancho y dónde
// =============================================================================
// Pedido de Martín (14/10/2026): la ficha del lead como el editor del Dashboard, por bloques. Esto es la
// parte que se puede probar sin un navegador (tests/ficha-armador.test.ts); el dibujo está en
// ./Armador.tsx y ./FichaPorBloques.tsx.
//
// ⚠️ UN BLOQUE QUE NO TIENE QUÉ MOSTRAR NO DEJA HUECO (§3 del diseño). Mirando, el armador saltea lo vacío
//    (`estaVacio` de su registro) y lo que todavía no tiene componente; editando, lo vacío se dibuja con un
//    marco que lo dice, así se puede mover o sacar igual (el Dashboard hace lo mismo con «ocultar si da cero»).
// ⚠️ Y UNA FILA QUE NO SE LLENA SE ESTIRA. La grilla es la del Dashboard (12 columnas) pero sin posiciones
//    guardadas: los bloques van en orden y cada fila se reparte las 12 columnas en proporción a lo que pidió
//    cada bloque. Así un bloque de ⅓ que quedó solo en su fila ocupa la fila entera, en vez de dejar ⅔ en
//    blanco, y la ficha con la plantilla de respaldo se ve como la de antes (todo de ancho completo).
// ⚠️ EL ALTO LO DA EL CONTENIDO (§5, descartes): nada de filas de alto fijo.
// =============================================================================

import { bloqueDef, bloquesDeLaTab, type Ancho, type BloqueDef, type BloqueId, type TabFicha } from '@/lib/ficha/catalogo';
import type { BloquePuesto, EstiloFicha } from '@/lib/ficha/config';
import type { StepId } from '@/lib/stage-requirements';
import { TEMA_BASE, paletaDe, plantillaDe, varsDeTema } from '@/lib/graficos-temas';
import type { LeadFullData } from '@/app/crm/actions';
import type { ReglasBloque } from './tipos';

/** Las columnas de la grilla: las del Dashboard (`COLS`, lib/graficos-catalogo.ts). Lo fija el test. */
export const COLS_FICHA = 12;

/** La clave de cada tab en la fila de pestañas: es la que viaja en los links (`?tab=`), y no se cambia. */
export const CLAVE_DE_TAB: Readonly<Record<TabFicha, string>> = {
  resumen: 'resumen', reuniones: 'reuniones', pagos: 'cobranza', tracking: 'comportamiento',
};

/** Un bloque que el armador va a dibujar. */
export type BloqueEnGrilla = {
  puesto: BloquePuesto;
  def: BloqueDef;
  reglas: ReglasBloque;
  /** Su lugar en la lista ENTERA de la tab (con lo que no se dibuja): es lo que usan mover, quitar y el ancho. */
  indice: number;
  /** Cuál de los de su id es (desde 1): sólo `respuesta-destacada` va varias veces. */
  n: number;
  /** No tiene nada para este lead: mirando no llega acá; editando se dibuja con su marco y «Sin datos». */
  vacio: boolean;
  /** Las columnas que ocupa en su fila, ya repartidas (`spansDeFilas`). */
  span: number;
  /** Las que ocupa en una tablet: ¼ y ⅓ pasan a ½, y la fila se vuelve a repartir (`spansPorDispositivo`). */
  spanTableta: number;
};

/** El número de ocurrencia (desde 1) del bloque en `indice` entre los de su mismo id. */
export function ocurrencia(lista: readonly BloquePuesto[], indice: number): number {
  let n = 0;
  for (let i = 0; i <= indice && i < lista.length; i++) if (lista[i].id === lista[indice]?.id) n++;
  return n;
}

/** El índice del bloque `id` número `n` (desde 1) en la lista, o -1. */
export function indiceDeOcurrencia(lista: readonly BloquePuesto[], id: BloqueId, n = 1): number {
  let vistos = 0;
  for (let i = 0; i < lista.length; i++) if (lista[i].id === id && ++vistos === n) return i;
  return -1;
}

/**
 * Reparte las 12 columnas: los bloques van en orden, una fila se llena hasta que el siguiente no entra, y
 * una fila que no suma 12 se estira en proporción (con los sobrantes para los de fracción más grande, y en
 * empate para el primero). Nunca un ancho menor a 1.
 */
export function spansDeFilas(anchos: readonly number[], cols = COLS_FICHA): number[] {
  const out: number[] = [];
  let fila: number[] = [];
  const cerrar = () => {
    if (!fila.length) return;
    const suma = fila.reduce((a, b) => a + b, 0);
    if (suma >= cols) { out.push(...fila.map((a) => Math.min(a, cols))); fila = []; return; }
    const exactos = fila.map((a) => (a * cols) / suma);
    const spans = exactos.map((x) => Math.max(1, Math.floor(x)));
    let resto = cols - spans.reduce((a, b) => a + b, 0);
    const orden = exactos.map((x, i) => ({ i, f: x - Math.floor(x) })).sort((a, b) => b.f - a.f || a.i - b.i);
    for (let k = 0; resto > 0 && orden.length; k = (k + 1) % orden.length, resto--) spans[orden[k].i]++;
    out.push(...spans);
    fila = [];
  };
  for (const a0 of anchos) {
    const a = Math.max(1, Math.min(cols, Math.round(a0)));
    if (fila.reduce((x, y) => x + y, 0) + a > cols) cerrar();
    fila.push(a);
  }
  cerrar();
  return out;
}

/**
 * LOS BLOQUES QUE SE DIBUJAN EN UNA TAB, en orden y con su ancho repartido. Se saltean: un id que el
 * catálogo ya no tiene, uno sin componente (`reglasDe` → undefined), lo privado para quien no lo ve y,
 * mirando, lo vacío para este lead.
 */
export function bloquesDeLaGrilla(lista: readonly BloquePuesto[], o: {
  reglasDe: (id: BloqueId) => ReglasBloque | undefined;
  vacio: (puesto: BloquePuesto, reglas: ReglasBloque) => boolean;
  editando: boolean;
  verPrivado: boolean;
}): BloqueEnGrilla[] {
  const quedan: Omit<BloqueEnGrilla, 'span' | 'spanTableta'>[] = [];
  lista.forEach((puesto, indice) => {
    const def = bloqueDef(puesto.id);
    const reglas = def ? o.reglasDe(def.id) : undefined;
    if (!def || !reglas) return;
    if (def.privado && !o.verPrivado) return;
    const vacio = o.vacio(puesto, reglas);
    if (vacio && !o.editando) return;
    quedan.push({ puesto, def, reglas, indice, n: ocurrencia(lista, indice), vacio });
  });
  const spans = spansPorDispositivo(quedan.map((b) => b.puesto.ancho));
  return quedan.map((b, i) => ({ ...b, span: spans.escritorio[i], spanTableta: spans.tableta[i] }));
}

/**
 * EL CORTE DE COLUMNAS POR PANTALLA (Martín, 14/10/2026: «La app de MaKo se debe adaptar al tamaño de la
 * pantalla siempre», desde un iPad). La grilla sigue siendo de 12, pero lo que no entra se ensancha:
 *   · escritorio: el ancho que eligió el admin;
 *   · tablet (la ventana hasta CORTE_TABLETA, un iPad de 820 parado o de 1024 acostado): ¼ y ⅓ pasan a ½.
 *     En una tablet un ¼ queda en ~160 px, y las tarjetas de adentro (tres botones, una fecha con su
 *     etiqueta) no entran. Como mucho dos bloques por fila;
 *   · celular (hasta CORTE_MOVIL): uno abajo del otro.
 * Es lo mismo que muestra «Personalizar» con el selector de dispositivo (./ficha-css.ts lo dice dos veces:
 * por el ancho de la ventana y por `data-dispositivo`), así lo que se arma en la vista de tablet es lo que ve
 * la tablet.
 */
export const CORTE_TABLETA = 1024;
export const CORTE_MOVIL = 720;

export function anchoEnDispositivo(ancho: number, d: DispositivoFicha): number {
  if (d === 'movil') return COLS_FICHA;
  if (d === 'tableta') return ancho < COLS_FICHA / 2 ? COLS_FICHA / 2 : ancho;
  return ancho;
}

/** Los anchos ya repartidos en filas, en cada pantalla: una fila de tablet se reparte con los anchos de tablet. */
export function spansPorDispositivo(anchos: readonly number[]): Record<DispositivoFicha, number[]> {
  return {
    escritorio: spansDeFilas(anchos.map((a) => anchoEnDispositivo(a, 'escritorio'))),
    tableta: spansDeFilas(anchos.map((a) => anchoEnDispositivo(a, 'tableta'))),
    movil: spansDeFilas(anchos.map((a) => anchoEnDispositivo(a, 'movil'))),
  };
}

/** ¿El bloque comparte su fila en esa pantalla? (la raya de «soltar aquí» va al costado, no arriba). */
export function compartiendoFila(b: Pick<BloqueEnGrilla, 'span' | 'spanTableta'>, d: DispositivoFicha): boolean {
  const span = d === 'movil' ? COLS_FICHA : d === 'tableta' ? b.spanTableta : b.span;
  return span < COLS_FICHA;
}

/** Los «datos sin marcar» cuyos campos dibuja un bloque: los suyos y los de lo que incluye, o los que declara. */
export function cubreDe(def: BloqueDef, reglas: ReglasBloque): StepId[] {
  if (reglas.cubre) return [...reglas.cubre];
  const out = new Set<StepId>(def.avisa);
  for (const id of reglas.incluye ?? []) for (const p of bloqueDef(id)?.avisa ?? []) out.add(p);
  return [...out];
}

/**
 * «Solucionar» un dato: la PRIMERA tab, entre las que este lead ve y en su orden, donde se dibuja un bloque
 * que tiene su campo. null = ningún bloque de la ficha lo tiene: queda el asistente («Completar datos»).
 * Reemplaza a `TAB_DE_DATO` (lib/datos-aviso.ts), que era un mapa fijo y no sabía de la ficha del funnel.
 */
export function tabDelDato(paso: StepId, tabs: readonly TabFicha[], o: {
  listaDe: (tab: TabFicha) => readonly BloquePuesto[];
  reglasDe: (id: BloqueId) => ReglasBloque | undefined;
  vacio: (puesto: BloquePuesto, reglas: ReglasBloque) => boolean;
  verPrivado: boolean;
}): TabFicha | null {
  for (const tab of tabs) {
    const dibujados = bloquesDeLaGrilla(o.listaDe(tab), { reglasDe: o.reglasDe, vacio: o.vacio, editando: false, verPrivado: o.verPrivado });
    if (dibujados.some((b) => cubreDe(b.def, b.reglas).includes(paso))) return tab;
  }
  return null;
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Lo que ofrece «Agregar bloque» en una tab: los bloques que van ahí (los suyos y los de «también en»), que
 * TIENEN componente, que no están puestos (salvo los que van varias veces) y que quien mira puede ver,
 * filtrados por lo que se escribió en el buscador. Lo que todavía no tiene componente NO se ofrece: un
 * «pronto» en un menú es una promesa que no hace nada.
 */
export function ofrecerEnAgregar(tab: TabFicha, lista: readonly BloquePuesto[], o: {
  registrado: (id: BloqueId) => boolean;
  verPrivado: boolean;
  buscar?: string;
}): BloqueDef[] {
  const q = sinTildes(o.buscar?.trim() ?? '');
  return bloquesDeLaTab(tab).filter((def) =>
    o.registrado(def.id)
    && (def.varias || !lista.some((p) => p.id === def.id))
    && (!def.privado || o.verPrivado)
    && (!q || sinTildes(def.titulo).includes(q)));
}

/**
 * El `lugar` (desde 1, el de `CambioFicha.mover`) de un bloque que estaba en `desde` y se suelta ANTES del
 * que está en `antesDe` (o al final, con `antesDe` = largo de la lista). null = queda donde estaba.
 */
export function lugarAlSoltar(desde: number, antesDe: number): number | null {
  const final = antesDe > desde ? antesDe - 1 : antesDe;
  return final === desde ? null : final + 1;
}

/**
 * Los diseños del catálogo que el componente sabe dibujar, en el orden en que los declara (el primero es el
 * suyo de entrada). Un id que el catálogo no tiene se ignora.
 */
const disenosQueSabe = (def: BloqueDef, reglas: ReglasBloque): BloqueDef['disenos'] =>
  (reglas.disenos ?? []).flatMap((id) => def.disenos.filter((d) => d.id === id));

/** Los diseños que se ofrecen en la barra del bloque: con menos de dos, no hay nada que elegir. */
export function disenosOfrecidos(def: BloqueDef, reglas: ReglasBloque): BloqueDef['disenos'] {
  const hay = disenosQueSabe(def, reglas);
  return hay.length >= 2 ? hay : [];
}

/** El diseño a dibujar: el puesto si el componente lo sabe dibujar; si no, el primero que sabe (o el del catálogo). */
export function disenoADibujar(puesto: BloquePuesto, def: BloqueDef, reglas: ReglasBloque): string {
  const sabe = disenosQueSabe(def, reglas).map((d) => d.id);
  if (!sabe.length) return puesto.diseno || def.disenos[0].id;
  return sabe.includes(puesto.diseno) ? puesto.diseno : sabe[0];
}

/**
 * ¿Se ofrece «Personalizar»? Sólo al ADMIN (es la ficha y los avisos de TODOS los leads del funnel) y sólo si
 * la ficha del funnel se pudo leer: sin ella, el primer cambio pisaría una ficha que no se vio (la regla del
 * Dashboard con una lectura caída). La pantalla sólo esconde: lo que cierra es `cambiarFichaFunnelAction`.
 */
export function puedePersonalizar(d: Pick<LeadFullData, 'puedeEditarFicha' | 'rol' | 'ficha'>): boolean {
  return d.puedeEditarFicha === true && d.rol === 'admin' && !!d.ficha;
}

/**
 * LA VISTA POR DISPOSITIVO mientras se personaliza (Martín, 14/10/2026: «tal como lo tenemos en la edición de
 * Landing Generator, tienes que poder visualizar en la versión mobile»). Es `DISPOSITIVOS` del editor del
 * Dashboard (app/dashboard/EditorInforme.tsx), copiado: los mismos tres y con los mismos nombres (lo fija el
 * test). No es una simulación aparte: angosta la ficha real (./FichaPorBloques.tsx y la regla de
 * ./ficha-css.ts). No se guarda: es cómo se mira mientras se arma.
 */
export type DispositivoFicha = 'escritorio' | 'tableta' | 'movil';
export const DISPOSITIVOS_FICHA: ReadonlyArray<{ id: DispositivoFicha; nombre: string }> = [
  { id: 'escritorio', nombre: 'Vista de escritorio' },
  { id: 'tableta', nombre: 'Vista de tablet' },
  { id: 'movil', nombre: 'Vista de celular' },
];

/** El dispositivo con que se mira: el elegido sólo personalizando; al volver a «Ver», el escritorio (como el Dashboard). */
export function dispositivoVisto(editando: boolean, elegido: DispositivoFicha): DispositivoFicha {
  return editando ? elegido : 'escritorio';
}

/** Los anchos de la barra del bloque: los cuatro, con los que el bloque no acepta apagados. */
export function anchosDeLaBarra(def: BloqueDef): Array<{ id: Ancho; nombre: string; puede: boolean }> {
  return ([3, 4, 6, 12] as const).map((id) => ({ id, nombre: { 3: '¼', 4: '⅓', 6: '½', 12: 'Completo' }[id], puede: def.anchos.includes(id) }));
}

/**
 * El estilo de TODA la ficha (§1): el tema del Dashboard (lib/graficos-temas.ts) y la densidad. Con el tema
 * de siempre y la densidad normal no se pisa nada: la ficha se ve como antes. El acento pinta lo que ya es
 * azul de la ficha (`--primary`), con un color de la paleta, que se lee en claro y en oscuro.
 */
export function estiloDeFicha(e: EstiloFicha): { clases: string[]; vars: Record<string, string> } {
  const clases: string[] = [];
  let vars: Record<string, string> = {};
  const t = e.tema;
  const p = plantillaDe(t.plantilla);
  const conTema = t.plantilla !== TEMA_BASE.plantilla || !!t.acento || !!t.fuente;
  if (conTema) {
    clases.push('fb--tema');
    vars = { ...varsDeTema(t) };
    if (t.acento || t.plantilla !== TEMA_BASE.plantilla) vars['--primary'] = paletaDe(t)[0];
    if ((t.fuente ?? p.fuente) !== 'geist') clases.push('fb--letra');
  }
  if (e.densidad === 'compacta') clases.push('fb-dens-compacta');
  if (e.densidad === 'amplia') clases.push('fb-dens-amplia');
  return { clases, vars };
}
