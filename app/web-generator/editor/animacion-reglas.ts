// =============================================================================
// editor/animacion-reglas — lo puro del panel «Animar» y de las animaciones de las secciones EN EL EDITOR
// =============================================================================
// Pedido de Martín (14/10/2026), a «¿cuál de los dos frentes?»: «las dos cosas» — las animaciones de la página y
// el video de fondo en loop. Decidido el 15/10 (no se re-pregunta): el panel se COPIA del de animaciones del Image
// Editor (app/image-editor/_doory/editor/panels/AnimatePanel.tsx) más la ayuda pública de Canva; dos niveles (un
// estilo para toda la landing y un efecto por sección, nunca por bloque); cada efecto se reproduce solo al pasar el
// mouse. El contrato es lib/editor-landing/animaciones.ts: acá no se inventa ningún efecto ni ningún tiempo.
//
// Tres cosas, sin React (las prueba tests/editor-landing-panel-animacion.test.ts):
//   1. Los data-* de cada sección DEL EDITOR. La publicada los escribe render.ts; en el editor los pone un plugin de
//      DECORACIONES (`pluginAnimacionSecciones`), no `attrsDeSeccion` de extensiones/index.ts: el estilo de la
//      página vive en la config (no en el nodo), y ProseMirror sólo vuelve a llamar al `update` de un NodeView cuyo
//      nodo o cuyas decoraciones cambiaron. Con los data-* en el NodeView, cambiar el estilo no tocaba ninguna
//      sección, y agregar o mover una dejaba viejo el «alterna» de las de abajo. La decoración se recalcula con el
//      documento y con la config, y ProseMirror le escribe los atributos a la `section` sin pasar por React.
//   2. Lo que el panel muestra de una sección y lo que escribe al elegir (`vistaDeSeccion`, `cambiosAlElegir`).
//   3. Reproducir: poner y sacar `gm-reproducir` (la clase que la hoja, css.ts bloque 16, anima en `.gm-doc`), con
//      un reflow en el medio para que vuelva a empezar, y el ▶ de la página.
// NUNCA la clase de la publicada en <html> (la que esconde lo no visto): en la app escondería las miniaturas de la
// tira y del Panel, que viven en el mismo documento (lo fija tests/editor-landing-animaciones-render.test.ts).
// =============================================================================

import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as NodoPM } from '@tiptap/pm/model';
import { NODO } from '@/lib/editor-landing/doc';
import {
  EFECTOS, ESTILOS_PAGINA, ESTILO_DEFAULT, GRUPOS_EFECTO, SIN_ANIMACION,
  animacionDeSeccion, datosDeAnimacion, duracionTotalMs, efectoPorId, esEfecto, estiloPorId,
  sanearAnimacionSeccion, sanearDireccion, sanearEstilo,
  type AnimacionSeccion, type DatosAnimacion, type DefEfecto, type DefEstilo, type Direccion, type IdEfecto, type IdEstilo,
} from '@/lib/editor-landing/animaciones';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Los data-* de las secciones del editor
// ─────────────────────────────────────────────────────────────────────────────

/** Lo de la config que decide la animación de las secciones (`ConfigLanding.pagina`). */
export type PaginaAnimacion = { animaciones: boolean; estiloAnimacion?: unknown };
export const PAGINA_ANIMACION_DEFAULT: PaginaAnimacion = { animaciones: true, estiloAnimacion: ESTILO_DEFAULT };

/**
 * Los data-* de cada sección, en orden, con su lugar entre las VISIBLES: el mismo cálculo que `htmlDePagina`
 * (render.ts) — una oculta toma el lugar de la siguiente visible y no lo corre. Así el «alterna» del editor es el
 * de la publicada aunque el editor dibuje las ocultas.
 */
export function datosDeSecciones(
  secciones: readonly Readonly<Record<string, unknown>>[],
  pagina: PaginaAnimacion,
): DatosAnimacion[] {
  let visibles = 0;
  return secciones.map((a) => {
    const indice = visibles;
    if (a.oculta !== true) visibles++;
    return datosDeAnimacion(animacionDeSeccion(a, pagina, indice));
  });
}

type EstadoAnimacion = { pagina: PaginaAnimacion; deco: DecorationSet };
export const CLAVE_ANIMACION = new PluginKey<EstadoAnimacion>('animacionSecciones');

/** Una decoración de NODO por sección con data-* (ProseMirror se los escribe a la `section` del NodeView). */
export function decoracionesAnimacion(doc: NodoPM, pagina: PaginaAnimacion): DecorationSet {
  const secciones: { pos: number; nodo: NodoPM }[] = [];
  doc.forEach((nodo, pos) => { if (nodo.type.name === NODO.tarjeta) secciones.push({ pos, nodo }); });
  const datos = datosDeSecciones(secciones.map((s) => s.nodo.attrs), pagina);
  const decos: Decoration[] = [];
  secciones.forEach((s, i) => {
    if (Object.keys(datos[i]).length) decos.push(Decoration.node(s.pos, s.pos + s.nodo.nodeSize, datos[i] as Record<string, string>));
  });
  return decos.length ? DecorationSet.create(doc, decos) : DecorationSet.empty;
}

/**
 * El plugin. La config le llega por una transacción con meta (`ponerAnimacionDePagina`), fuera del historial.
 * `ultima` vive en el cierre del plugin y no en su estado A PROPÓSITO: el armazón abre cada página con un
 * EditorState NUEVO (mismos plugins, EditorLanding.tsx `abrirEnEditor`), y el `init` de ese estado tiene que
 * arrancar con la config de la landing, no con el default.
 */
export function pluginAnimacionSecciones(): Plugin<EstadoAnimacion> {
  let ultima: PaginaAnimacion = PAGINA_ANIMACION_DEFAULT;
  return new Plugin<EstadoAnimacion>({
    key: CLAVE_ANIMACION,
    state: {
      init: (_config, state) => ({ pagina: ultima, deco: decoracionesAnimacion(state.doc, ultima) }),
      apply: (tr, prev, _viejo, nuevo) => {
        const meta = tr.getMeta(CLAVE_ANIMACION) as PaginaAnimacion | undefined;
        if (meta) ultima = meta;
        if (!meta && !tr.docChanged) return prev;
        const pagina = meta ?? prev.pagina;
        return { pagina, deco: decoracionesAnimacion(nuevo.doc, pagina) };
      },
    },
    props: { decorations: (s) => CLAVE_ANIMACION.getState(s)?.deco ?? DecorationSet.empty },
  });
}

/**
 * Le pasa la config al plugin (sólo si cambió). Fuera del historial (Ctrl+Z no deshace un cambio de config: lo
 * deshace quien la cambió) y sin el evento `update` (el autoguardado no marca «sin guardar» al abrir).
 * Devuelve si despachó.
 */
export function ponerAnimacionDePagina(
  view: { state: EditorState; dispatch: (tr: Transaction) => void } | null | undefined,
  pagina: PaginaAnimacion,
): boolean {
  const actual = view ? CLAVE_ANIMACION.getState(view.state) : undefined;
  if (!view || !actual) return false;
  const p: PaginaAnimacion = { animaciones: pagina.animaciones === true, estiloAnimacion: sanearEstilo(pagina.estiloAnimacion) };
  if (actual.pagina.animaciones === p.animaciones && sanearEstilo(actual.pagina.estiloAnimacion) === p.estiloAnimacion) return false;
  view.dispatch(view.state.tr.setMeta(CLAVE_ANIMACION, p).setMeta('addToHistory', false).setMeta('preventUpdate', true));
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Lo que el panel muestra y escribe
// ─────────────────────────────────────────────────────────────────────────────

/** La grilla de la vista «Sección»: los grupos del Image Editor (`panel.groups`) con sus efectos, en orden. */
export const GRILLA: readonly { id: string; nombre: string; efectos: readonly { id: IdEfecto; nombre: string }[] }[] =
  GRUPOS_EFECTO.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    efectos: (EFECTOS as readonly DefEfecto[]).filter((e) => e.grupo === g.id).map((e) => ({ id: e.id as IdEfecto, nombre: e.nombre })),
  }));

/**
 * Las direcciones con el nombre del Image Editor (`panel.directionFrom`) y la flecha hacia DONDE VIAJA el bloque
 * (`DIRECTION_ICON` de AnimateSettings.tsx: «desde la izquierda» se mueve a la derecha). Íconos del set del editor.
 */
export const DIRECCION_UI: Readonly<Record<Direccion, { nombre: string; icono: string }>> = {
  izquierda: { nombre: 'Desde la izquierda', icono: 'flecha-derecha' },
  derecha: { nombre: 'Desde la derecha', icono: 'flecha-izquierda' },
  arriba: { nombre: 'Desde arriba', icono: 'flecha-abajo' },
  abajo: { nombre: 'Desde abajo', icono: 'flecha-arriba' },
};

/** Lo que el panel muestra de una sección. `elegido` null = hereda el estilo de la página (ninguna tile marcada). */
export type VistaSeccion = {
  elegido: AnimacionSeccion;
  /** Las direcciones del efecto elegido (vacío si no ofrece, o si no hay efecto propio). */
  direcciones: readonly Direccion[];
  direccion: Direccion | null;
  /** El nombre del estilo de la página, para «Usa la de la página: …». */
  estiloPagina: string;
};

export function vistaDeSeccion(a: { animacion?: unknown; animacionDireccion?: unknown }, pagina: PaginaAnimacion): VistaSeccion {
  const elegido = sanearAnimacionSeccion(a.animacion);
  const def = elegido && elegido !== SIN_ANIMACION ? efectoPorId(elegido) : null;
  const direcciones = def?.direcciones ?? [];
  const direccion = def ? sanearDireccion(a.animacionDireccion, elegido) ?? direcciones[0] ?? null : null;
  return { elegido, direcciones, direccion, estiloPagina: estiloPorId(sanearEstilo(pagina.estiloAnimacion)).nombre };
}

export type CambiosAnimacion = { animacion: AnimacionSeccion; animacionDireccion: Direccion | null };

/**
 * Los attrs al elegir un efecto, «ninguna» o null («Quitar animación»: vuelve a heredar). La dirección que ya
 * tenía se conserva si el efecto nuevo la ofrece (de Deslizar a Barrido sigue «desde abajo»); si no, null = la de
 * default del efecto. Lo que no está en el catálogo cae a null, como en el saneo del server.
 */
// Vive en el contrato (lib/editor-landing/animaciones.ts) porque la API de MaKo escribe con la MISMA regla.
export { cambiosAlElegir } from '@/lib/editor-landing/animaciones';

/** La dirección nueva, o null si el efecto de la sección no la ofrece (no se escribe nada). */
export function cambiosDeDireccion(direccion: unknown, actual: { animacion?: unknown }): { animacionDireccion: Direccion } | null {
  const d = sanearDireccion(direccion, sanearAnimacionSeccion(actual.animacion));
  return d ? { animacionDireccion: d } : null;
}

/** Qué muestra una tile: un efecto (o «Ninguna») con su dirección, o un estilo de la página. */
export type MuestraTile =
  | { tipo: 'efecto'; efecto: IdEfecto | typeof SIN_ANIMACION; direccion?: Direccion | null }
  | { tipo: 'estilo'; estilo: IdEstilo };

/** Los data-* de la mini sección de una tile: los MISMOS que le pondría el render a una sección real. */
export function datosDeTile(m: MuestraTile): DatosAnimacion {
  if (m.tipo === 'estilo') return datosDeAnimacion(animacionDeSeccion({}, { animaciones: true, estiloAnimacion: m.estilo }, 0));
  if (m.efecto === SIN_ANIMACION) return { 'data-anim': SIN_ANIMACION };
  return datosDeAnimacion({ efecto: m.efecto, direccion: m.direccion ?? null, texto: null, propio: true });
}

/** La mini sección de una tile: barra de título, dos renglones y un botón (4 bloques). */
export const BLOQUES_TILE = 4;
/** En cuántos pedazos se parte su título con los estilos «Palabras» y «Máquina de escribir». */
export const PIEZAS_TILE: Readonly<Record<'palabra' | 'letra', number>> = { palabra: 3, letra: 9 };
/** La demora de la sección antes del primer bloque y del primer pedazo de título (css.ts, bloque 16: `+ 150ms`). */
const DEMORA_BASE_MS = 150;

/**
 * Cuánto dura la entrada de una sección con estos data-*, `bloques` bloques y un título partido en `piezas`
 * (0 = no anima: sin efecto, «ninguna» o un valor que no es del catálogo). Los bloques, con `duracionTotalMs` del
 * contrato; el título partido, con el escalón de su estilo (la regla de `.gm-u` de la hoja).
 */
export function duracionDeVista(datos: DatosAnimacion, bloques: number, piezas = 0): number {
  const efecto = datos['data-anim'];
  if (!esEfecto(efecto)) return 0;
  let ms = duracionTotalMs(efecto, bloques);
  const por = datos['data-anim-texto'];
  if (por && piezas > 0) {
    const texto = (ESTILOS_PAGINA as readonly DefEstilo[]).find((e) => e.texto?.por === por)?.texto;
    const def = texto ? efectoPorId(texto.efecto) : null;
    if (texto && def) ms = Math.max(ms, DEMORA_BASE_MS + (piezas - 1) * texto.escalonMs + def.duracionMs);
  }
  return ms;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Reproducir
// ─────────────────────────────────────────────────────────────────────────────

/** La clase que anima en `.gm-doc` (css.ts, bloque 16: `REPRODUCE`). No esconde nada mientras no reproduce. */
export const CLASE_REPRODUCIR = 'gm-reproducir';
/** La pausa entre una vuelta y la siguiente de una tile con el mouse encima (~700 ms, pedido del paquete). */
export const PAUSA_ENTRE_VUELTAS_MS = 700;
/** Lo que se espera de más antes de sacar la clase (el último cuadro y algo de holgura del navegador). */
export const MARGEN_FIN_MS = 250;
/** La consulta de «reducir movimiento» (la de useReducedMotion.ts del Image Editor). */
export const CONSULTA_MENOS_MOVIMIENTO = '(prefers-reduced-motion: reduce)';
/** Cuándo una sección «entra en pantalla»: lo mismo que el script de la publicada (pagina-publica.ts, SCRIPT_PAGINA). */
export const ENTRADA_EN_PANTALLA = { rootMargin: '0px 0px -6% 0px', threshold: 0.06 } as const;

/** Lo que hace falta de un elemento para reproducirlo (un HTMLElement; en el test, uno de mentira). */
export type Reproducible = { classList: { add(c: string): void; remove(c: string): void }; readonly offsetWidth: number };
export type Reloj = { poner: (f: () => void, ms: number) => unknown; sacar: (t: unknown) => void };
export const RELOJ: Reloj = {
  poner: (f, ms) => setTimeout(f, ms),
  sacar: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
};

/** ¿El sistema pide menos movimiento? false donde no hay `matchMedia`. */
export function pideMenosMovimiento(
  w: { matchMedia?: (q: string) => { matches: boolean } } | undefined = typeof window !== 'undefined' ? window : undefined,
): boolean {
  try { return w?.matchMedia?.(CONSULTA_MENOS_MOVIMIENTO).matches === true; } catch { return false; }
}

/**
 * Saca la clase, fuerza un reflow y la vuelve a poner. Sin el reflow, sacar y poner en el mismo cuadro no
 * reinicia la animación: el navegador nunca ve el estado sin la clase.
 */
function arrancar(el: Reproducible): void {
  el.classList.remove(CLASE_REPRODUCIR);
  void el.offsetWidth;
  el.classList.add(CLASE_REPRODUCIR);
}

/** La reproducción en curso de cada elemento: una nueva corta la anterior (si no, su timer le sacaría la clase). */
const enCurso = new WeakMap<object, () => void>();

/**
 * Reproduce UNA vez y saca la clase a los `ms` + margen. El fin va por timer y no por `animationend`: cada bloque
 * dispara el suyo, uno con `display: none` no dispara ninguno, y un NodeView con una animación propia adentro (el
 * giro de «Subiendo…») dispara los de él; el timer usa la duración del contrato. Devuelve cómo cortarla.
 */
export function reproducirUnaVez(el: Reproducible, ms: number, reloj: Reloj = RELOJ): () => void {
  enCurso.get(el)?.();
  if (ms <= 0) return () => {};
  arrancar(el);
  let t: unknown = null;
  const cortar = () => {
    if (t === null) return;
    reloj.sacar(t);
    t = null;
    el.classList.remove(CLASE_REPRODUCIR);
    if (enCurso.get(el) === cortar) enCurso.delete(el);
  };
  t = reloj.poner(() => {
    t = null;
    el.classList.remove(CLASE_REPRODUCIR);
    if (enCurso.get(el) === cortar) enCurso.delete(el);
  }, ms + MARGEN_FIN_MS);
  enCurso.set(el, cortar);
  return cortar;
}

/** La tile con el mouse encima: reproduce, espera la duración + la pausa, y otra vez, hasta que se corte. */
export function repetirMientras(el: Reproducible, ms: number, reloj: Reloj = RELOJ): () => void {
  enCurso.get(el)?.();
  if (ms <= 0) return () => {};
  let vivo = true;
  let t: unknown = null;
  const vuelta = () => {
    if (!vivo) return;
    arrancar(el);
    t = reloj.poner(vuelta, ms + PAUSA_ENTRE_VUELTAS_MS);
  };
  const cortar = () => {
    if (!vivo) return;
    vivo = false;
    if (t !== null) reloj.sacar(t);
    t = null;
    el.classList.remove(CLASE_REPRODUCIR);
    if (enCurso.get(el) === cortar) enCurso.delete(el);
  };
  enCurso.set(el, cortar);
  vuelta();
  return cortar;
}

/** Una `section.gm-tarjeta` del lienzo, con lo que el ▶ necesita leer de ella. */
export type SeccionDom = Reproducible & {
  getAttribute(nombre: string): string | null;
  children: ArrayLike<{ classList: { contains(c: string): boolean }; children: ArrayLike<unknown> }>;
};

/** Los data-* que tiene puestos la sección (los de la decoración). */
export function datosDelDom(el: { getAttribute(nombre: string): string | null }): DatosAnimacion {
  const out: DatosAnimacion = {};
  for (const k of ['data-anim', 'data-anim-dir', 'data-anim-texto'] as const) {
    const v = el.getAttribute(k);
    if (v) out[k] = v;
  }
  return out;
}

/** Cuántos bloques tiene (los hijos de su `.gm-tarjeta-cuerpo`, que es lo que la hoja anima en cascada). */
export function bloquesDelDom(el: SeccionDom): number {
  for (const h of Array.from(el.children)) if (h.classList.contains('gm-tarjeta-cuerpo')) return h.children.length;
  return 0;
}

/** Cuánto dura la entrada de esa sección del lienzo (0 = no anima). En el editor los títulos no se parten. */
export function duracionDelDom(el: SeccionDom): number {
  return duracionDeVista(datosDelDom(el), bloquesDelDom(el));
}

type Entrada = { target: unknown; isIntersecting: boolean };
type Observador = { observe(t: unknown): void; unobserve(t: unknown): void; disconnect(): void };
export type ObservadorCtor = new (
  cb: (entradas: Entrada[]) => void,
  op: { root?: unknown; rootMargin?: string; threshold?: number },
) => Observador;

/**
 * El ▶ «Reproducir la página»: cada sección que anima se reproduce UNA vez al entrar en pantalla (las que ya se
 * ven, enseguida), con el umbral de la publicada. `soloLasDePantalla`: sólo las que se ven ahora y se termina
 * (lo que se ve al elegir un estilo). Sin IntersectionObserver, todas a la vez. Devuelve cómo cortarlo.
 */
export function reproducirPagina(
  secciones: readonly SeccionDom[],
  op: { raiz?: unknown; soloLasDePantalla?: boolean; IO?: ObservadorCtor; reloj?: Reloj } = {},
): () => void {
  const cortes: (() => void)[] = [];
  const cortarTodo = () => { for (const f of cortes.splice(0)) f(); };
  const animadas = secciones.filter((s) => duracionDelDom(s) > 0);
  if (!animadas.length) return () => {};
  const IO = op.IO ?? (globalThis as unknown as { IntersectionObserver?: ObservadorCtor }).IntersectionObserver;
  if (!IO) {
    for (const s of animadas) cortes.push(reproducirUnaVez(s, duracionDelDom(s), op.reloj));
    return cortarTodo;
  }
  let quedan = animadas.length;
  const io = new IO((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      const s = e.target as SeccionDom;
      io.unobserve(s);
      quedan--;
      cortes.push(reproducirUnaVez(s, duracionDelDom(s), op.reloj));
    }
    if (op.soloLasDePantalla || quedan <= 0) io.disconnect();
  }, { root: op.raiz ?? null, ...ENTRADA_EN_PANTALLA });
  for (const s of animadas) io.observe(s);
  return () => { io.disconnect(); cortarTodo(); };
}
