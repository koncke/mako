// =============================================================================
// ficha/config — la ficha de UN funnel: lo guardado, el saneo y la ficha que se dibuja
// =============================================================================
// Decisión 1 del diseño (docs/diseno-ficha-bloques.md, 14/10/2026): «la ficha y sus avisos de "datos sin
// marcar" se guardan por funnel, y lo que el negocio ya eligió queda de respaldo». Vive en
// `funnels.data.ficha` y guarda SÓLO lo que alguien cambió, como `seVe` (lib/resumen-ficha.ts):
//   · por tab, la lista de bloques puestos (si nadie tocó la tab, vale la de la plantilla, y así un
//     bloque nuevo del catálogo les llega a todos);
//   · los avisos prendidos o apagados a mano;
//   · el estilo de toda la ficha: el TemaHoja del Dashboard (lib/graficos-temas.ts, no otro) más la
//     densidad de las tarjetas, el «tamaño de las cards» que pidió Martín el 13/10;
//   · la plantilla, si alguien eligió otra que la que elige MaKo;
//   · POR TAB (16/10/2026, Martín: «Que se pueda cambiar el nombre de las tabs internas... que hayan templates para
//     "resumen", "tracking" y todas las tabs... que se pueda ver "epico"»): la plantilla de la tab elegida a mano
//     (./plantillas-tab.ts), el nombre que le puso el admin y la vista épica, si difiere de la de su plantilla;
//   · LAS HOJAS PROPIAS (17/10/2026, Martín: «el sistema para cambiar de hoja sea exactamente el mismo que tenemos en
//     Dashboard y General, el desplegable del título con las secciones, entonces ahí mismo se puede crear otra hoja»):
//     las que creó el admin con «Nueva hoja», en su orden, cada una con su nombre, sus bloques y su épica. No siguen a
//     ninguna plantilla (se arman de una, una vez) y salen para todo lead del funnel, después de las cuatro tabs.
//
// ⚠️ EL RESPALDO DEL NEGOCIO (`crm.resumen.campos` y `crm.datos_aviso.apagados`) manda en lo que nadie tocó
//    en ESE funnel: con Instagram apagado, `redes-y-web` sale sin Instagram; con el formulario de Meta
//    apagado, `lo-que-contesto` sale sin esa fuente; con la dirección prendida, entra el bloque. Una tab que
//    alguien tocó ya no lo lee: lo que quedó guardado es lo que esa persona vio.
// ⚠️ SACAR UN BLOQUE A MANO NO APAGA SU AVISO (§4): los apagados salen de la PLANTILLA, nunca de la lista
//    que quedó. Y las asistencias (NO_IGNORABLES) nunca se apagan, ni a mano.
// ⚠️ UNA HOJA PROPIA NO DECIDE AVISOS NI ES DONDE «SOLUCIONAR» VA PRIMERO: los avisos son del funnel y cada dato se
//    completa en la tab de siempre que lo dibuja (`dondeSeCompleta`); la hoja propia es el último lugar donde se busca.
// ⚠️ LA PLANTILLA DE UNA TAB NO TOCA LOS AVISOS: siguen saliendo de la plantilla del FUNNEL (la que elige MaKo o la
//    elegida a mano). Elegir «En blanco» para Pagos no apaga el aviso del monto: cambia lo que se ve, no lo que falta.
// ⚠️ UNA TAB «CONFIGURADA» ES UNA QUE ALGUIEN TOCÓ en este funnel (su lista, su plantilla, su nombre o su épica, o la
//    plantilla de todo el funnel). Las otras, la primera vez que un admin entra, abren la galería (`configuradas`).
//    La plantilla de una tab elegida a mano QUEDA aunque sea la sugerida: «Usar la sugerida» es elegir.
//
// Puro, sin `server-only`: lo leen config-server.ts, la API de MaKo, la pantalla y los tests.
// =============================================================================

import type { StepId } from '../stage-requirements';
import { DATOS_AVISABLES, NO_IGNORABLES, sanearApagados, sanearIds } from '../datos-aviso';
import { seVe, type ResumenElegido } from '../resumen-ficha';
import { sanearTema, TEMA_BASE, type TemaHoja } from '../graficos-temas';
import { esIconoMenu, type NombreIconoMenu } from '../../app/_ui/iconos-menu';
import {
  bloqueDef, esAncho, esBloqueId, esIdHoja, esLugarFicha, esTabFicha, esDensidad, vaEnLugar, REDES, FUENTES_RESPUESTA, TABS_FICHA, NOMBRE_TAB,
  DENSIDADES, DENSIDAD_BASE,
  type Ancho, type BloqueDef, type BloqueId, type Densidad, type FuenteRespuesta, type IdHoja, type LugarFicha, type Red, type TabFicha,
} from './catalogo';
import {
  apagadosDePlantilla, esPlantillaId, listaDePlantilla, plantillaFicha, type PlantillaFicha, type PlantillaId,
} from './plantillas';
import { bloquesDePlantillaTab, esPlantillaTabDe, plantillaTabDeEntrada, plantillaTabPorId, type PlantillaTab } from './plantillas-tab';

// ── Lo que se guarda ──────────────────────────────────────────────────────────

export { DENSIDADES, DENSIDAD_BASE, type Densidad };

/** Lo que se configura adentro de un bloque. Sólo vale lo que su BloqueDef declara en `opciones`. */
export type OpcionesBloque = {
  /** `redes-y-web`: cuáles van, en orden. */
  redes?: Red[];
  /** `lo-que-contesto`: qué fuentes, en orden. */
  fuentes?: FuenteRespuesta[];
  /** `respuesta-destacada`: la pregunta que se muestra en grande. */
  pregunta?: string;
};

/** Un bloque puesto en una tab. Es la forma de cada renglón de la lista guardada y de la que se dibuja. */
export type BloquePuesto = {
  id: BloqueId;
  ancho: Ancho;
  diseno: string;
  /** Otro ícono del set de la casa. Sin él, el del catálogo. */
  icono?: NombreIconoMenu;
  opciones?: OpcionesBloque;
};

export type EstiloFicha = { tema: TemaHoja; densidad: Densidad };

/** `funnels.data.ficha`: SÓLO lo que alguien cambió. Todo campo es opcional. */
export type FichaGuardada = {
  /** La plantilla elegida a mano. Sin ella, la que elige MaKo (`elegirPlantilla`). */
  plantilla?: PlantillaId;
  /** Las tabs que alguien tocó, cada una con su lista entera. */
  tabs?: Partial<Record<TabFicha, BloquePuesto[]>>;
  /** Los avisos cambiados a mano en este funnel: true prendido, false apagado. */
  avisos?: Partial<Record<StepId, boolean>>;
  estilo?: { tema?: TemaHoja; densidad?: Densidad };
  /** Por tab, la plantilla de la tab elegida a mano (un id de ./plantillas-tab.ts). Sin ella, la de entrada. */
  plantillasTab?: Partial<Record<TabFicha, string>>;
  /** Por tab, el nombre que le puso el admin. La clave (`?tab=`) no cambia. */
  nombres?: Partial<Record<TabFicha, string>>;
  /** Por tab, la vista épica prendida o apagada a mano (sólo si difiere de la de su plantilla). */
  epica?: Partial<Record<TabFicha, boolean>>;
  /** Las hojas propias, en su orden (después de las cuatro tabs). */
  hojas?: HojaGuardada[];
};

/** Una hoja propia de la ficha: la crea el admin con «Nueva hoja». Guarda TODO (no sigue a ninguna plantilla). */
export type HojaGuardada = {
  id: IdHoja;
  nombre: string;
  bloques: BloquePuesto[];
  /** La vista épica prendida. Sin el campo, apagada. */
  epica?: true;
};

/** Lo que el negocio ya eligió antes de que la ficha fuera por funnel. */
export type RespaldoNegocio = {
  /** `crm.resumen.campos` (lib/resumen-ficha-config.ts). */
  resumen: ResumenElegido;
  /** `crm.datos_aviso.apagados` (lib/datos-aviso-config.ts). */
  apagados: readonly StepId[];
};
export const RESPALDO_VACIO: RespaldoNegocio = { resumen: {}, apagados: [] };

/** Tope de bloques por tab: la plantilla más larga trae 18 y el catálogo de una tab ronda los 30. */
export const TOPE_BLOQUES_TAB = 40;
const TOPE_PREGUNTA = 200;
/** El nombre de una tab: corto, entra en la fila de pestañas (Martín: el texto que se dibuja es corto). */
export const TOPE_NOMBRE_TAB = 24;
/**
 * Las otras pestañas de la ficha, que no se personalizan (app/crm/lead-view/ficha/FichaPorBloques.tsx): una tab de
 * datos no puede llamarse como ellas, o la fila tendría dos «Historial».
 */
export const NOMBRES_DE_OTRAS_TABS: readonly string[] = ['MaKo Analyst', 'Historial'];
/** Tope de hojas propias por funnel: el desplegable del título las lista todas, y una ficha no es un informe. */
export const TOPE_HOJAS = 8;

/** El nombre de una tab tal como llega: sin espacios de más ni caracteres de control, con tope. Vacío → null. */
export function sanearNombreTab(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const t = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TOPE_NOMBRE_TAB).trim();
  return t || null;
}

// ── El saneo ──────────────────────────────────────────────────────────────────

const lista = <T extends string>(x: unknown, validos: readonly T[]): T[] | undefined => {
  if (!Array.isArray(x)) return undefined;
  const out: T[] = [];
  for (const v of x) if ((validos as readonly unknown[]).includes(v) && !out.includes(v as T)) out.push(v as T);
  return out;
};

/** Las opciones de un bloque, sólo las que declara. Vacío → undefined. */
export function sanearOpciones(def: BloqueDef, raw: unknown): OpcionesBloque | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !def.opciones?.length) return undefined;
  const o = raw as Record<string, unknown>;
  const out: OpcionesBloque = {};
  if (def.opciones.includes('redes')) { const r = lista(o.redes, REDES); if (r) out.redes = r; }
  if (def.opciones.includes('fuentes')) { const f = lista(o.fuentes, FUENTES_RESPUESTA); if (f) out.fuentes = f; }
  if (def.opciones.includes('pregunta') && typeof o.pregunta === 'string' && o.pregunta.trim()) out.pregunta = o.pregunta.trim().slice(0, TOPE_PREGUNTA);
  return Object.keys(out).length ? out : undefined;
}

/**
 * Un bloque puesto que viene de la base o del navegador, en una tab. Corrige en vez de rechazar: un ancho
 * que el bloque no acepta cae al de entrada, un diseño que no existe al primero, un ícono que no es del
 * set se tira. Un id que no existe o que no va en esa tab devuelve null (se tira).
 */
export function sanearPuesto(raw: unknown, tab: LugarFicha): BloquePuesto | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!esBloqueId(o.id)) return null;
  const def = bloqueDef(o.id)!;
  if (!vaEnLugar(def, tab)) return null;
  const ancho = esAncho(o.ancho) && def.anchos.includes(o.ancho) ? o.ancho : def.ancho;
  const diseno = typeof o.diseno === 'string' && def.disenos.some((x) => x.id === o.diseno) ? o.diseno : def.disenos[0].id;
  const out: BloquePuesto = { id: def.id, ancho, diseno };
  if (esIconoMenu(o.icono) && o.icono !== def.icono) out.icono = o.icono;
  const op = sanearOpciones(def, o.opciones);
  if (op) out.opciones = op;
  return out;
}

/**
 * La lista de una tab: sin ids rotos, sin repetidos (salvo los que van varias veces), con tope. En el
 * Resumen, `contacto` no se puede quitar: si falta, vuelve arriba de todo.
 */
export function sanearLista(raw: unknown, tab: LugarFicha): BloquePuesto[] {
  const out: BloquePuesto[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    if (out.length >= TOPE_BLOQUES_TAB) break;
    const p = sanearPuesto(x, tab);
    if (!p) continue;
    if (!bloqueDef(p.id)!.varias && out.some((y) => y.id === p.id)) continue;
    out.push(p);
  }
  return conFijos(out, tab);
}

/** Los bloques que no se pueden quitar de su tab principal (`contacto` en el Resumen), arriba si faltan. Una hoja propia no tiene. */
function conFijos(l: BloquePuesto[], tab: LugarFicha): BloquePuesto[] {
  if (!esTabFicha(tab)) return l;
  const faltan = TABS_FIJOS[tab].filter((id) => !l.some((p) => p.id === id));
  return faltan.length ? [...faltan.map((id) => puestoDeEntrada(id, RESPALDO_VACIO)), ...l] : l;
}
const TABS_FIJOS: Readonly<Record<TabFicha, readonly BloqueId[]>> = {
  resumen: ['contacto'], reuniones: [], pagos: [], tracking: [],
};

/**
 * `funnels.data.ficha` tal como venga (de una versión vieja, a mano, roto): sólo lo que existe y vale.
 * Nunca tira. Un aviso de asistencia apagado se tira: no se apaga.
 */
export function sanearFicha(raw: unknown): FichaGuardada {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: FichaGuardada = {};
  if (esPlantillaId(o.plantilla)) out.plantilla = o.plantilla;
  if (o.tabs && typeof o.tabs === 'object' && !Array.isArray(o.tabs)) {
    const tabs: Partial<Record<TabFicha, BloquePuesto[]>> = {};
    for (const [k, v] of Object.entries(o.tabs as Record<string, unknown>)) {
      if (esTabFicha(k) && Array.isArray(v)) tabs[k] = sanearLista(v, k);
    }
    if (Object.keys(tabs).length) out.tabs = tabs;
  }
  if (o.avisos && typeof o.avisos === 'object' && !Array.isArray(o.avisos)) {
    const avisos: Partial<Record<StepId, boolean>> = {};
    const validos = new Set(sanearIds(Object.keys(o.avisos as object)));
    for (const [k, v] of Object.entries(o.avisos as Record<string, unknown>)) {
      if (!validos.has(k as StepId) || typeof v !== 'boolean') continue;
      if (NO_IGNORABLES.has(k as StepId)) continue;
      avisos[k as StepId] = v;
    }
    if (Object.keys(avisos).length) out.avisos = avisos;
  }
  if (o.estilo && typeof o.estilo === 'object' && !Array.isArray(o.estilo)) {
    const e = o.estilo as Record<string, unknown>;
    const estilo: NonNullable<FichaGuardada['estilo']> = {};
    if (e.tema && typeof e.tema === 'object') estilo.tema = sanearTema(e.tema);
    if (esDensidad(e.densidad)) estilo.densidad = e.densidad;
    if (Object.keys(estilo).length) out.estilo = estilo;
  }
  const porTab = <T>(x: unknown, sano: (v: unknown, tab: TabFicha) => T | null): Partial<Record<TabFicha, T>> | undefined => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined;
    const r: Partial<Record<TabFicha, T>> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (!esTabFicha(k)) continue;
      const ok = sano(v, k);
      if (ok !== null) r[k] = ok;
    }
    return Object.keys(r).length ? r : undefined;
  };
  const plantillasTab = porTab(o.plantillasTab, (v, tab) => (esPlantillaTabDe(v, tab) ? v : null));
  if (plantillasTab) out.plantillasTab = plantillasTab;
  const nombres = porTab(o.nombres, (v) => sanearNombreTab(v));
  if (nombres) out.nombres = nombres;
  const epica = porTab(o.epica, (v) => (typeof v === 'boolean' ? v : null));
  if (epica) out.epica = epica;
  const hojas = sanearHojas(o.hojas);
  if (hojas.length) out.hojas = hojas;
  return out;
}

/**
 * Las hojas propias tal como vengan: sólo las de clave válida y sin repetir, con nombre (sin él, «Hoja N»), sus
 * bloques saneados para una hoja propia y la épica si es `true`. Con tope.
 */
export function sanearHojas(raw: unknown): HojaGuardada[] {
  const out: HojaGuardada[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    if (out.length >= TOPE_HOJAS) break;
    if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
    const h = x as Record<string, unknown>;
    if (!esIdHoja(h.id) || out.some((y) => y.id === h.id)) continue;
    const hoja: HojaGuardada = { id: h.id, nombre: sanearNombreTab(h.nombre) ?? `Hoja ${out.length + 1}`, bloques: sanearLista(h.bloques, h.id) };
    if (h.epica === true) hoja.epica = true;
    out.push(hoja);
  }
  return out;
}

// ── La ficha que se dibuja ────────────────────────────────────────────────────

/** Las opciones de entrada de un bloque, con el respaldo del negocio. */
function opcionesDeEntrada(def: BloqueDef, respaldo: RespaldoNegocio): OpcionesBloque | undefined {
  const out: OpcionesBloque = {};
  if (def.opciones?.includes('redes')) out.redes = REDES.filter((r) => seVe(respaldo.resumen, r));
  if (def.opciones?.includes('fuentes')) {
    out.fuentes = FUENTES_RESPUESTA.filter((f) => (f === 'meta' ? seVe(respaldo.resumen, 'form_meta') : f === 'landing' ? seVe(respaldo.resumen, 'form_landing') : true));
  }
  return Object.keys(out).length ? out : undefined;
}

/** Un bloque recién puesto: su ancho y su diseño de entrada, y las opciones que dice el respaldo del negocio. */
export function puestoDeEntrada(id: BloqueId, respaldo: RespaldoNegocio): BloquePuesto {
  const def = bloqueDef(id)!;
  const p: BloquePuesto = { id, ancho: def.ancho, diseno: def.disenos[0].id };
  const op = opcionesDeEntrada(def, respaldo);
  if (op) p.opciones = op;
  return p;
}

/**
 * Lo que el negocio prendió y viene APAGADO de fábrica (YouTube, LinkedIn, dirección, sexo): eso es una
 * elección, y en una tab que nadie tocó suma su bloque. Lo prendido de fábrica (web, Instagram) no suma
 * nada: no se distingue de «nadie eligió», y sumarlo cambiaría la plantilla de todos.
 */
const eligioPrender = (r: ResumenElegido, id: 'youtube' | 'linkedin' | 'direccion' | 'sexo'): boolean => r[id] === true;

/**
 * La lista de una tab que nadie tocó: la de la plantilla con el respaldo del negocio aplicado.
 *   · ingreso, cohorte, dirección o sexo apagados → sin su bloque;
 *   · dirección, sexo, YouTube o LinkedIn prendidos a propósito → entra su bloque al Resumen, después
 *     del contacto (y de las redes, si están);
 *   · las redes y las fuentes de lo que contestó, como las eligió el negocio; sin ninguna red, sin bloque.
 */
export function listaDeEntrada(p: PlantillaFicha, tab: TabFicha, respaldo: RespaldoNegocio): BloquePuesto[] {
  return listaDeIds(listaDePlantilla(p, tab), tab, respaldo);
}

/**
 * La lista de una tab que nadie tocó, con la PLANTILLA DE LA TAB (./plantillas-tab.ts): sus bloques con el respaldo
 * del negocio (como `listaDeEntrada`), el ancho y el diseño que trae la plantilla si el bloque los acepta, y lo que
 * no se puede quitar (el contacto del Resumen, también en «En blanco»).
 */
export function listaDeEntradaTab(pt: PlantillaTab, tab: TabFicha, respaldo: RespaldoNegocio): BloquePuesto[] {
  const propios = bloquesDePlantillaTab(pt);
  const de = new Map(propios.map((b) => [b.id, b] as const));
  const l = listaDeIds(propios.map((b) => b.id), tab, respaldo).map((b) => {
    const pide = de.get(b.id);
    const def = bloqueDef(b.id)!;
    const out = { ...b };
    if (pide?.ancho && def.anchos.includes(pide.ancho)) out.ancho = pide.ancho;
    if (pide?.diseno && def.disenos.some((d) => d.id === pide.diseno)) out.diseno = pide.diseno;
    return out;
  });
  return conFijos(l, tab);
}

/** La lista de entrada de unos ids, con el respaldo del negocio (la regla de `listaDeEntrada`). */
function listaDeIds(deLaPlantilla: readonly BloqueId[], tab: TabFicha, respaldo: RespaldoNegocio): BloquePuesto[] {
  const r = respaldo.resumen;
  let ids: BloqueId[] = [...deLaPlantilla];
  const fuera = new Set<BloqueId>();
  if (!seVe(r, 'ingreso')) fuera.add('ingreso-estimado');
  if (!seVe(r, 'cohorte')) fuera.add('cohorte');
  if (!seVe(r, 'direccion')) fuera.add('direccion');
  if (!seVe(r, 'sexo')) fuera.add('sexo');
  ids = ids.filter((id) => !fuera.has(id));
  if (tab === 'resumen') {
    const suma: BloqueId[] = [];
    if ((eligioPrender(r, 'youtube') || eligioPrender(r, 'linkedin')) && !ids.includes('redes-y-web')) suma.push('redes-y-web');
    if (eligioPrender(r, 'direccion') && !ids.includes('direccion')) suma.push('direccion');
    if (eligioPrender(r, 'sexo') && !ids.includes('sexo')) suma.push('sexo');
    if (suma.length) {
      const ancla = ids.includes('redes-y-web') ? ids.indexOf('redes-y-web') : ids.indexOf('contacto');
      ids.splice(ancla + 1, 0, ...suma);
    }
  }
  return ids
    .map((id) => puestoDeEntrada(id, respaldo))
    .filter((b) => !(b.id === 'redes-y-web' && !b.opciones?.redes?.length));
}

/** Por qué avisa o no avisa un dato en ESTE funnel. */
export type PorQueAvisa = 'siempre' | 'a-mano' | 'negocio' | 'plantilla' | 'de-entrada';
export type EstadoAviso = { id: StepId; label: string; avisa: boolean; por: PorQueAvisa };

/** La ficha que se dibuja y la que cuenta los avisos. */
export type FichaEfectiva = {
  plantilla: PlantillaId;
  /** true si alguien eligió la plantilla (no la eligió MaKo). */
  plantillaAMano: boolean;
  /** Las cuatro tabs, siempre. Si una tab sale o no lo deciden sus reglas (Reuniones, Tracking, Pagos), no esto. */
  tabs: Record<TabFicha, BloquePuesto[]>;
  /** Las tabs que alguien tocó: ésas ya no siguen a la plantilla. */
  tocadas: TabFicha[];
  /** Por tab, la plantilla de la tab que manda: la elegida a mano o la de entrada (./plantillas-tab.ts). */
  plantillasTab: Record<TabFicha, string>;
  /** Las tabs cuya plantilla eligió alguien. */
  plantillasTabAMano: TabFicha[];
  /** El nombre que se dibuja de cada tab: el que le puso el admin, o el de siempre. */
  nombres: Record<TabFicha, string>;
  /** La vista épica de cada tab: la de su plantilla, o la que eligió el admin. */
  epica: Record<TabFicha, boolean>;
  /**
   * Las tabs que alguien CONFIGURÓ en este funnel: su lista, su plantilla, su nombre o su épica (o eligió la plantilla de
   * todo el funnel). Las otras, la primera vez que entra un admin, abren la galería con «¿Qué vas a crear hoy?».
   */
  configuradas: TabFicha[];
  /** Las hojas propias, en su orden: su nombre, sus bloques y su épica. */
  hojas: Array<{ id: IdHoja; nombre: string; bloques: BloquePuesto[]; epica: boolean }>;
  /** Los datos que NO avisan en este funnel (nunca una asistencia). En el orden de DATOS_AVISABLES. */
  apagados: StepId[];
  /** Cada dato con su estado y su porqué, para el panel de avisos y para MaKo. */
  avisos: EstadoAviso[];
  estilo: EstiloFicha;
};

/** La plantilla que manda: la elegida a mano, o la que eligió MaKo. */
export const plantillaQueManda = (elegida: PlantillaId, guardada: FichaGuardada | null | undefined): PlantillaId =>
  guardada?.plantilla ?? elegida;

/** El estado de cada aviso: a mano le gana al negocio, y el negocio a la plantilla. Las asistencias, siempre. */
export function estadoAvisos(plantilla: PlantillaFicha, guardada: FichaGuardada | null | undefined, respaldo: RespaldoNegocio): EstadoAviso[] {
  const dePlantilla = new Set(apagadosDePlantilla(plantilla));
  const delNegocio = new Set(sanearApagados(respaldo.apagados));
  const aMano = guardada?.avisos ?? {};
  return DATOS_AVISABLES.map(({ id, label }) => {
    if (NO_IGNORABLES.has(id)) return { id, label, avisa: true, por: 'siempre' as const };
    const m = aMano[id];
    if (typeof m === 'boolean') return { id, label, avisa: m, por: 'a-mano' as const };
    if (delNegocio.has(id)) return { id, label, avisa: false, por: 'negocio' as const };
    if (dePlantilla.has(id)) return { id, label, avisa: false, por: 'plantilla' as const };
    return { id, label, avisa: true, por: 'de-entrada' as const };
  });
}

/**
 * Los apagados de la CASA de un lead (`leads.funnel_id`) cuando ya se leyeron todos los funnels del workspace
 * (el worklist, `avisosDelWorkspace` en ./config-server.ts). `idDelNegocio` es el funnel del negocio (el
 * `es_default`, o el primero); `delNegocio`, el respaldo del negocio, para cuando no hay ningún funnel.
 *
 * ⚠️ UNA CASA QUE NO ESTÁ EN EL MAPA ES COMO UNA NULL: el funnel del negocio, no el respaldo pelado. Es la
 *    regla de mig 0181 («un `funnel_id` que apunta a un funnel que ya no existe se comporta igual que un
 *    NULL») y la de los lectores de UN funnel (`apagadosDeFunnel`, `fichaDelFunnelDelLead`), que cuentan la
 *    ficha. Con el respaldo pelado, un lead con la casa borrada salía con 12 datos en «A revisar» y 6 en su
 *    ficha (revisión del 16/10/2026, tests/ficha-casa-huerfana.test.ts).
 */
export function apagadosDeLaCasa(
  porFunnel: ReadonlyMap<number, readonly StepId[]>, idDelNegocio: number | null, delNegocio: readonly StepId[], casa: number | null | undefined,
): StepId[] {
  const propia = casa == null ? undefined : porFunnel.get(Number(casa));
  const delFunnelDelNegocio = idDelNegocio == null ? undefined : porFunnel.get(idDelNegocio);
  return [...(propia ?? delFunnelDelNegocio ?? delNegocio)];
}

/** Completa las opciones que le faltan a un bloque de una tab tocada (uno puesto por la API sin opciones). */
function conOpciones(b: BloquePuesto, respaldo: RespaldoNegocio): BloquePuesto {
  const def = bloqueDef(b.id);
  if (!def?.opciones?.length) return b;
  const base = opcionesDeEntrada(def, respaldo);
  if (!base) return b;
  const op = { ...base, ...(b.opciones ?? {}) };
  return { ...b, opciones: op };
}

/**
 * LA FICHA DE UN FUNNEL. `elegida` es la plantilla que eligió MaKo (`elegirPlantilla`); lo guardado puede
 * elegir otra. Por tab: lo guardado si alguien la tocó, si no la plantilla con el respaldo del negocio.
 */
export function fichaEfectiva(elegida: PlantillaId, guardada: FichaGuardada | null | undefined, respaldo: RespaldoNegocio): FichaEfectiva {
  const id = plantillaQueManda(elegida, guardada);
  const p = plantillaFicha(id);
  const tabs = {} as Record<TabFicha, BloquePuesto[]>;
  const tocadas: TabFicha[] = [];
  const plantillasTab = {} as Record<TabFicha, string>;
  const plantillasTabAMano: TabFicha[] = [];
  const nombres = {} as Record<TabFicha, string>;
  const epica = {} as Record<TabFicha, boolean>;
  const configuradas: TabFicha[] = [];
  for (const tab of TABS_FICHA) {
    const pt = plantillaTabQueManda(tab, id, guardada);
    plantillasTab[tab] = pt.id;
    if (guardada?.plantillasTab?.[tab]) plantillasTabAMano.push(tab);
    const g = guardada?.tabs?.[tab];
    if (g) { tocadas.push(tab); tabs[tab] = g.map((b) => conOpciones(b, respaldo)); }
    else tabs[tab] = listaDeEntradaTab(pt, tab, respaldo);
    nombres[tab] = guardada?.nombres?.[tab] ?? NOMBRE_TAB[tab];
    epica[tab] = guardada?.epica?.[tab] ?? !!pt.epico;
    if (guardada?.plantilla || g || guardada?.plantillasTab?.[tab] || guardada?.nombres?.[tab] || typeof guardada?.epica?.[tab] === 'boolean') configuradas.push(tab);
  }
  const avisos = estadoAvisos(p, guardada, respaldo);
  const hojas = (guardada?.hojas ?? []).map((h) => ({ id: h.id, nombre: h.nombre, bloques: h.bloques.map((b) => conOpciones(b, respaldo)), epica: h.epica === true }));
  return {
    plantilla: id,
    plantillaAMano: !!guardada?.plantilla,
    tabs, tocadas, plantillasTab, plantillasTabAMano, nombres, epica, configuradas, hojas,
    apagados: avisos.filter((a) => !a.avisa).map((a) => a.id),
    avisos,
    estilo: {
      tema: guardada?.estilo?.tema ?? TEMA_BASE,
      densidad: guardada?.estilo?.densidad ?? DENSIDAD_BASE,
    },
  };
}

/** La plantilla de una tab que manda: la elegida a mano (si sigue existiendo y es de esa tab) o la de entrada del tipo. */
export function plantillaTabQueManda(tab: TabFicha, tipo: PlantillaId, guardada: FichaGuardada | null | undefined): PlantillaTab {
  const elegida = guardada?.plantillasTab?.[tab];
  const pt = elegida ? plantillaTabPorId(elegida) : undefined;
  return pt && pt.tab === tab ? pt : plantillaTabDeEntrada(tab, tipo);
}

/** Una tab o una hoja propia, leída igual: su lista, su nombre y su épica. Una hoja que ya no existe, vacía. */
export function lugarDe(f: Pick<FichaEfectiva, 'tabs' | 'nombres' | 'epica' | 'hojas'>, lugar: LugarFicha): { bloques: BloquePuesto[]; nombre: string; epica: boolean } {
  if (esTabFicha(lugar)) return { bloques: f.tabs[lugar], nombre: f.nombres[lugar], epica: f.epica[lugar] };
  const h = f.hojas.find((x) => x.id === lugar);
  return h ? { bloques: h.bloques, nombre: h.nombre, epica: h.epica } : { bloques: [], nombre: '', epica: false };
}

/** La tab donde se completa un dato en ESTA ficha (la del primer bloque que lo pide), o null si ninguno lo tiene. */
export function dondeSeCompleta(f: Pick<FichaEfectiva, 'tabs'>, paso: StepId): TabFicha | null {
  for (const tab of TABS_FICHA) if (f.tabs[tab].some((b) => bloqueDef(b.id)?.avisa.includes(paso))) return tab;
  return null;
}

/**
 * Los bloques que se dibujan en una tab, con su definición. Lo privado (el coaching de la llamada, decisión
 * 5) sólo para el admin y el closer de ese lead: quien llama dice si quien mira puede (`verPrivado`).
 */
export function bloquesDeTab(f: Pick<FichaEfectiva, 'tabs'>, tab: TabFicha, o: { verPrivado: boolean }): Array<{ puesto: BloquePuesto; def: BloqueDef }> {
  return f.tabs[tab].flatMap((puesto) => {
    const def = bloqueDef(puesto.id);
    if (!def || (def.privado && !o.verPrivado)) return [];
    return [{ puesto, def }];
  });
}

// ── Cambiar la ficha (un parche sobre lo de hoy) ─────────────────────────────

/**
 * UN cambio sobre la ficha de un funnel. Se aplica sobre lo que hay HOY en la base (config-server.ts), así
 * dos admins que cambian cosas distintas a la vez no se pisan. `lugar` y `n` cuentan desde 1, como una persona.
 */
export type CambioFicha =
  // Los cambios de bloques, de nombre, de épica y de plantilla valen igual en una tab y en una hoja propia (`tab`).
  | { op: 'poner'; tab: LugarFicha; bloque: BloqueId; lugar?: number; ancho?: Ancho; diseno?: string }
  | { op: 'quitar'; tab: LugarFicha; bloque: BloqueId; n?: number }
  | { op: 'mover'; tab: LugarFicha; bloque: BloqueId; lugar: number; n?: number }
  | { op: 'ancho'; tab: LugarFicha; bloque: BloqueId; ancho: Ancho; n?: number }
  | { op: 'diseno'; tab: LugarFicha; bloque: BloqueId; diseno: string; n?: number }
  | { op: 'icono'; tab: LugarFicha; bloque: BloqueId; icono: NombreIconoMenu | null; n?: number }
  | { op: 'opciones'; tab: LugarFicha; bloque: BloqueId; opciones: OpcionesBloque; n?: number }
  /** La lista entera de una tab (el arrastre de la pantalla). */
  | { op: 'lista'; tab: LugarFicha; bloques: BloquePuesto[] }
  | { op: 'aviso'; paso: StepId; avisa: boolean }
  /** Todos los avisos de una vez: los que NO avisan (el panel «De qué te avisa MaKo»). */
  | { op: 'avisos'; apagados: StepId[] }
  | { op: 'tema'; tema: Partial<TemaHoja> }
  | { op: 'densidad'; densidad: Densidad }
  /**
   * Volver a la plantilla: una tab (su lista, su nombre y su épica; la plantilla de la tab elegida queda), o toda la
   * ficha (las tabs, sus plantillas, sus nombres, sus épicas y los avisos). El estilo y las hojas propias quedan: una
   * hoja propia no viene de ninguna plantilla, y borrarla así sería perder lo que alguien armó.
   */
  | { op: 'volver'; tab?: TabFicha }
  /**
   * Usar otra plantilla para TODA la ficha (null = la que elige MaKo). Arranca de cero las tabs, sus plantillas, sus
   * épicas y los avisos; el estilo, los nombres de las tabs y las hojas propias quedan.
   */
  | { op: 'plantilla'; plantilla: PlantillaId | null; tab?: undefined }
  /**
   * Usar una plantilla de TAB (./plantillas-tab.ts) en esa tab, y sólo en esa (null = la de entrada). Arranca de cero
   * su lista y su épica; su nombre queda. Elegir la sugerida también se guarda: es elegir. En una hoja propia vale
   * cualquier plantilla de cualquier tab (se copia una vez), y null es «En blanco».
   */
  | { op: 'plantilla'; tab: LugarFicha; plantilla: string | null }
  /** El nombre de una tab (null o vacío = el de siempre; una hoja propia no se queda sin nombre). La clave no cambia. */
  | { op: 'nombre'; tab: LugarFicha; nombre: string | null }
  /** La vista épica de una tab: pocas cosas, en grande y con más aire. */
  | { op: 'epica'; tab: LugarFicha; epica: boolean }
  /**
   * Lo que armó MaKo con un pedido («¿Qué vas a crear hoy?», lib/ficha/ia.ts): la lista entera de la tab y su épica,
   * en UN cambio (un solo «Deshacer»). Deja fija la plantilla de la tab sobre la que se armó: la tab queda configurada.
   */
  | { op: 'armar'; tab: LugarFicha; bloques: BloquePuesto[]; epica: boolean }
  /**
   * UNA HOJA PROPIA NUEVA («Nueva hoja» del desplegable del título): con una plantilla de tab (sus bloques y su épica),
   * con unos bloques (lo que armó MaKo, o la hoja que se duplica) o en blanco. `hoja` es su clave y la elige quien la
   * crea: la pantalla va a ella en el acto, sin esperar al server. Sin nombre, el de la plantilla o «Hoja N»; un nombre
   * que ya usa otra tab se numera («Resumen 2»).
   */
  | { op: 'hoja'; hoja: IdHoja; nombre: string | null; plantilla?: string; bloques?: BloquePuesto[]; epica?: boolean }
  /** Borrar una hoja propia (la pantalla ofrece «Deshacer»). Las cuatro tabs no se borran. */
  | { op: 'quitar-hoja'; hoja: IdHoja }
  /** Mover una hoja propia entre las propias (1 es la primera). */
  | { op: 'mover-hoja'; hoja: IdHoja; lugar: number }
  /**
   * Deshacer: vuelve a una ficha guardada antes (la que devolvió el cambio anterior). `esperado` es cómo dejó
   * la ficha el cambio que se deshace: si hoy es otra, alguien la cambió después y NO se restaura (sería
   * borrarle su cambio a la otra persona, para todos los leads del funnel). Sin `esperado`, restaura igual.
   */
  | { op: 'restaurar'; ficha: FichaGuardada; esperado?: FichaGuardada };

export type ResultadoCambio = { ok: true; ficha: FichaGuardada; cambio: boolean } | { ok: false; error: string };

const OPS = ['poner', 'quitar', 'mover', 'ancho', 'diseno', 'icono', 'opciones', 'lista', 'aviso', 'avisos', 'tema', 'densidad', 'volver', 'plantilla', 'nombre', 'epica', 'armar', 'hoja', 'quitar-hoja', 'mover-hoja', 'restaurar'] as const;
/** El nombre de un lugar en un error o en el historial: el de la tab, o «la hoja» (el cambio no trae su nombre). */
const nombreLugar = (l: LugarFicha): string => (esTabFicha(l) ? NOMBRE_TAB[l] : 'la hoja');
const entero = (x: unknown): number | undefined => (typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 999 ? x : undefined);

/**
 * Un cambio que llega del navegador o de la API, validado en su forma (que el bloque exista y vaya en esa
 * tab, que el ancho sea uno de los cuatro, que el aviso sea un dato que avisa). Lo que depende de la ficha
 * de hoy (que el bloque esté puesto, que el diseño sea de ese bloque) lo dice `aplicarCambio`.
 */
export function sanearCambio(raw: unknown): CambioFicha | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Falta el cambio.' };
  const o = raw as Record<string, unknown>;
  const op = o.op;
  if (typeof op !== 'string' || !(OPS as readonly string[]).includes(op)) return { error: 'Ese cambio no existe.' };
  const conBloque = ['poner', 'quitar', 'mover', 'ancho', 'diseno', 'icono', 'opciones'].includes(op);
  const conTab = conBloque || op === 'lista' || op === 'nombre' || op === 'epica' || op === 'armar';
  if (conTab && !esLugarFicha(o.tab)) return { error: 'Falta la tab: resumen, reuniones, pagos, tracking o una hoja propia (h-…).' };
  const tab = o.tab as LugarFicha;
  if (conBloque) {
    if (!esBloqueId(o.bloque)) return { error: `«${String(o.bloque ?? '')}» no es un bloque.` };
    if (!vaEnLugar(bloqueDef(o.bloque)!, tab)) return { error: `«${bloqueDef(o.bloque)!.titulo}» no va en ${nombreLugar(tab)}.` };
  }
  const conHoja = op === 'hoja' || op === 'quitar-hoja' || op === 'mover-hoja';
  if (conHoja && !esIdHoja(o.hoja)) return { error: 'Falta la hoja: su clave es h- y de 3 a 16 letras o números.' };
  const hoja = o.hoja as IdHoja;
  const bloque = o.bloque as BloqueId;
  const n = entero(o.n);
  switch (op) {
    case 'poner': {
      if (o.ancho !== undefined && !esAncho(o.ancho)) return { error: 'El ancho es 3, 4, 6 o 12 columnas.' };
      return { op, tab, bloque, ...(entero(o.lugar) ? { lugar: entero(o.lugar) } : {}), ...(esAncho(o.ancho) ? { ancho: o.ancho } : {}), ...(typeof o.diseno === 'string' ? { diseno: o.diseno } : {}) };
    }
    case 'quitar': return { op, tab, bloque, ...(n ? { n } : {}) };
    case 'mover': {
      const lugar = entero(o.lugar);
      if (!lugar) return { error: 'Falta el lugar (1 es el primero).' };
      return { op, tab, bloque, lugar, ...(n ? { n } : {}) };
    }
    case 'ancho':
      if (!esAncho(o.ancho)) return { error: 'El ancho es 3, 4, 6 o 12 columnas.' };
      return { op, tab, bloque, ancho: o.ancho, ...(n ? { n } : {}) };
    case 'diseno':
      if (typeof o.diseno !== 'string' || !o.diseno.trim()) return { error: 'Falta el diseño.' };
      return { op, tab, bloque, diseno: o.diseno.trim(), ...(n ? { n } : {}) };
    case 'icono':
      if (o.icono !== null && !esIconoMenu(o.icono)) return { error: 'Ese ícono no es del set.' };
      return { op, tab, bloque, icono: (o.icono ?? null) as NombreIconoMenu | null, ...(n ? { n } : {}) };
    case 'opciones': {
      const opciones = sanearOpciones(bloqueDef(bloque)!, o.opciones);
      if (!opciones) return { error: 'Ese bloque no tiene esas opciones.' };
      return { op, tab, bloque, opciones, ...(n ? { n } : {}) };
    }
    case 'lista':
      if (!Array.isArray(o.bloques)) return { error: 'Falta la lista de bloques.' };
      return { op, tab, bloques: sanearLista(o.bloques, tab) };
    case 'aviso': {
      const [paso] = sanearIds([o.paso]);
      if (!paso) return { error: 'Ese dato no existe.' };
      if (typeof o.avisa !== 'boolean') return { error: 'Falta si avisa o no.' };
      if (NO_IGNORABLES.has(paso) && !o.avisa) return { error: 'Las asistencias siempre avisan.' };
      return { op, paso, avisa: o.avisa };
    }
    case 'avisos': return { op, apagados: sanearApagados(o.apagados) };
    case 'tema': {
      if (!o.tema || typeof o.tema !== 'object') return { error: 'Falta el tema.' };
      const t = o.tema as Record<string, unknown>;
      const tema: Partial<TemaHoja> = {};
      if ('plantilla' in t) tema.plantilla = String(t.plantilla ?? '');
      if ('acento' in t) tema.acento = t.acento == null ? null : String(t.acento);
      if ('fuente' in t) tema.fuente = t.fuente == null ? null : String(t.fuente);
      return { op, tema };
    }
    case 'densidad':
      if (!esDensidad(o.densidad)) return { error: 'La densidad es compacta, normal o amplia.' };
      return { op, densidad: o.densidad };
    case 'volver':
      if (esIdHoja(o.tab)) return { error: 'Una hoja propia no sigue a ninguna plantilla: no hay a qué volver.' };
      if (o.tab !== undefined && !esTabFicha(o.tab)) return { error: 'Esa tab no existe.' };
      return { op, ...(esTabFicha(o.tab) ? { tab: o.tab } : {}) };
    case 'plantilla':
      if (esIdHoja(o.tab)) {
        const pt = o.plantilla ?? null;
        if (pt !== null && (typeof pt !== 'string' || !plantillaTabPorId(pt))) return { error: 'Esa plantilla no existe.' };
        return { op, tab: o.tab, plantilla: pt };
      }
      if (o.tab !== undefined) {
        if (!esTabFicha(o.tab)) return { error: 'Esa tab no existe.' };
        const pt = o.plantilla ?? null;
        if (pt !== null && !esPlantillaTabDe(pt, o.tab)) return { error: `Esa plantilla no es de ${NOMBRE_TAB[o.tab]}.` };
        return { op, tab: o.tab, plantilla: pt as string | null };
      }
      if (o.plantilla !== null && !esPlantillaId(o.plantilla)) return { error: 'Esa plantilla no existe.' };
      return { op, plantilla: (o.plantilla ?? null) as PlantillaId | null };
    case 'nombre': {
      if (o.nombre !== null && o.nombre !== undefined && typeof o.nombre !== 'string') return { error: 'El nombre es un texto.' };
      const nombre = sanearNombreTab(o.nombre);
      if (!nombre && esIdHoja(tab)) return { error: 'La hoja necesita un nombre.' };
      return { op, tab, nombre };
    }
    case 'epica':
      if (typeof o.epica !== 'boolean') return { error: 'Falta si va épica o no.' };
      return { op, tab, epica: o.epica };
    case 'armar':
      if (!Array.isArray(o.bloques)) return { error: 'Falta la lista de bloques.' };
      return { op, tab, bloques: sanearLista(o.bloques, tab), epica: o.epica === true };
    case 'hoja': {
      if (o.nombre !== null && o.nombre !== undefined && typeof o.nombre !== 'string') return { error: 'El nombre es un texto.' };
      if (o.plantilla !== undefined && o.plantilla !== null && (typeof o.plantilla !== 'string' || !plantillaTabPorId(o.plantilla))) return { error: 'Esa plantilla no existe.' };
      if (o.bloques !== undefined && !Array.isArray(o.bloques)) return { error: 'Los bloques van en una lista.' };
      if (typeof o.plantilla === 'string' && Array.isArray(o.bloques)) return { error: 'La hoja nueva sale de una plantilla o de unos bloques, no de los dos.' };
      return {
        op, hoja, nombre: sanearNombreTab(o.nombre),
        ...(typeof o.plantilla === 'string' ? { plantilla: o.plantilla } : {}),
        ...(Array.isArray(o.bloques) ? { bloques: sanearLista(o.bloques, hoja) } : {}),
        ...(typeof o.epica === 'boolean' ? { epica: o.epica } : {}),
      };
    }
    case 'quitar-hoja': return { op, hoja };
    case 'mover-hoja': {
      const lugar = entero(o.lugar);
      if (!lugar) return { error: 'Falta el lugar (1 es la primera).' };
      return { op, hoja, lugar };
    }
    case 'restaurar': return { op, ficha: sanearFicha(o.ficha), ...(o.esperado !== undefined ? { esperado: sanearFicha(o.esperado) } : {}) };
  }
  return { error: 'Ese cambio no existe.' };
}

const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** El índice del bloque `id` número `n` (desde 1) en la lista, o -1. */
function indiceDe(l: readonly BloquePuesto[], id: BloqueId, n = 1): number {
  let vistos = 0;
  for (let i = 0; i < l.length; i++) if (l[i].id === id && ++vistos === n) return i;
  return -1;
}

/**
 * Deja guardado SÓLO lo que difiere de la plantilla: una tab igual a la de entrada se borra (vuelve a
 * seguir a la plantilla), un aviso igual al de la plantilla y el negocio se borra, el tema base y la
 * densidad normal se borran.
 */
export function normalizar(g: FichaGuardada, elegida: PlantillaId, respaldo: RespaldoNegocio): FichaGuardada {
  const out: FichaGuardada = {};
  // La plantilla elegida a mano queda aunque hoy coincida con la de MaKo: si mañana el funnel suma una
  // reunión, MaKo elegiría otra, y lo que la persona eligió no puede cambiar solo.
  if (g.plantilla) out.plantilla = g.plantilla;
  const tipo = out.plantilla ?? elegida;
  const p = plantillaFicha(tipo);
  // La plantilla de una tab elegida a mano queda aunque sea la de entrada (es lo que dice que alguien la eligió).
  const plantillasTab: Partial<Record<TabFicha, string>> = {};
  for (const tab of TABS_FICHA) {
    const pt = g.plantillasTab?.[tab];
    if (pt && esPlantillaTabDe(pt, tab)) plantillasTab[tab] = pt;
  }
  if (Object.keys(plantillasTab).length) out.plantillasTab = plantillasTab;
  const tabs: Partial<Record<TabFicha, BloquePuesto[]>> = {};
  const epica: Partial<Record<TabFicha, boolean>> = {};
  const nombres: Partial<Record<TabFicha, string>> = {};
  for (const tab of TABS_FICHA) {
    const pt = plantillaTabQueManda(tab, tipo, out);
    const l = g.tabs?.[tab];
    if (l && !igual(l, listaDeEntradaTab(pt, tab, respaldo))) tabs[tab] = l;
    const e = g.epica?.[tab];
    if (typeof e === 'boolean' && e !== !!pt.epico) epica[tab] = e;
    const nom = sanearNombreTab(g.nombres?.[tab]);
    if (nom && nom !== NOMBRE_TAB[tab]) nombres[tab] = nom;
  }
  if (Object.keys(tabs).length) out.tabs = tabs;
  const base = estadoAvisos(p, {}, respaldo);
  const avisos: Partial<Record<StepId, boolean>> = {};
  for (const [k, v] of Object.entries(g.avisos ?? {})) {
    const b = base.find((x) => x.id === k);
    if (b && b.por !== 'siempre' && typeof v === 'boolean' && v !== b.avisa) avisos[k as StepId] = v;
  }
  if (Object.keys(avisos).length) out.avisos = avisos;
  const estilo: NonNullable<FichaGuardada['estilo']> = {};
  if (g.estilo?.tema && !igual(g.estilo.tema, TEMA_BASE)) estilo.tema = g.estilo.tema;
  if (g.estilo?.densidad && g.estilo.densidad !== DENSIDAD_BASE) estilo.densidad = g.estilo.densidad;
  if (Object.keys(estilo).length) out.estilo = estilo;
  if (Object.keys(nombres).length) out.nombres = nombres;
  if (Object.keys(epica).length) out.epica = epica;
  // Las hojas propias quedan enteras y en su orden: no hay plantilla contra la que compararlas.
  const hojas = sanearHojas(g.hojas);
  if (hojas.length) out.hojas = hojas;
  return out;
}

/**
 * Aplica UN cambio a la ficha guardada de un funnel. Una tab que nadie tocó arranca de la de entrada (la
 * plantilla con el respaldo del negocio), así el primer cambio no le borra nada a lo que se veía. Lo que
 * queda pasa por `normalizar`: si el cambio deja todo como la plantilla, no queda nada guardado.
 * `cambio: false` = ya estaba así (no hay nada que escribir).
 */
export function aplicarCambio(actual: FichaGuardada, c: CambioFicha, elegida: PlantillaId, respaldo: RespaldoNegocio): ResultadoCambio {
  const ef = fichaEfectiva(elegida, actual, respaldo);
  const g: FichaGuardada = JSON.parse(JSON.stringify(actual));
  const tabDe = (tab: LugarFicha): BloquePuesto[] => lugarDe(ef, tab).bloques.map((b) => ({ ...b }));
  const hojaDe = (id: IdHoja): HojaGuardada | undefined => g.hojas?.find((h) => h.id === id);
  const ponerTab = (tab: LugarFicha, l: BloquePuesto[]) => {
    if (esTabFicha(tab)) { g.tabs = { ...(g.tabs ?? {}), [tab]: l }; return; }
    const h = hojaDe(tab);
    if (h) h.bloques = l;
  };
  const nombre = (id: BloqueId) => bloqueDef(id)?.titulo ?? id;
  const lugarTxt = (tab: LugarFicha) => (esTabFicha(tab) ? NOMBRE_TAB[tab] : `«${lugarDe(ef, tab).nombre}»`);
  // Un cambio sobre una hoja propia que ya no está (otra persona la borró): no se escribe nada.
  if ('tab' in c && c.tab && esIdHoja(c.tab) && !hojaDe(c.tab)) return { ok: false, error: 'Esa hoja ya no existe.' };
  /** ¿Ya se usa este nombre? Las tabs, las hojas propias y las otras pestañas, menos el lugar que se renombra. */
  const usado = (nom: string, salvo?: LugarFicha): string | undefined => [
    ...TABS_FICHA.filter((t) => t !== salvo).map((t) => ef.nombres[t]),
    ...ef.hojas.filter((h) => h.id !== salvo).map((h) => h.nombre),
    ...NOMBRES_DE_OTRAS_TABS,
  ].find((x) => x.toLocaleLowerCase('es') === nom.toLocaleLowerCase('es'));

  switch (c.op) {
    case 'poner': {
      const def = bloqueDef(c.bloque)!;
      const l = tabDe(c.tab);
      if (!def.varias && l.some((b) => b.id === c.bloque)) return { ok: false, error: `«${def.titulo}» ya está en ${lugarTxt(c.tab)}.` };
      if (l.length >= TOPE_BLOQUES_TAB) return { ok: false, error: `${lugarTxt(c.tab)} ya tiene ${TOPE_BLOQUES_TAB} bloques.` };
      if (c.ancho !== undefined && !def.anchos.includes(c.ancho)) return { ok: false, error: `«${def.titulo}» va de ${anchosTxt(def)}.` };
      if (c.diseno !== undefined && !def.disenos.some((x) => x.id === c.diseno)) return { ok: false, error: `«${def.titulo}» tiene estos diseños: ${disenosTxt(def)}.` };
      const nuevo = { ...puestoDeEntrada(c.bloque, respaldo), ...(c.ancho ? { ancho: c.ancho } : {}), ...(c.diseno ? { diseno: c.diseno } : {}) };
      const i = c.lugar ? Math.min(Math.max(c.lugar - 1, 0), l.length) : l.length;
      l.splice(i, 0, nuevo);
      ponerTab(c.tab, l);
      break;
    }
    case 'quitar': case 'mover': case 'ancho': case 'diseno': case 'icono': case 'opciones': {
      const def = bloqueDef(c.bloque)!;
      const l = tabDe(c.tab);
      const i = indiceDe(l, c.bloque, c.n ?? 1);
      if (i < 0) return { ok: false, error: `«${nombre(c.bloque)}» no está en ${lugarTxt(c.tab)}.` };
      if (c.op === 'quitar') {
        if (!def.quitable && def.tab === c.tab) return { ok: false, error: `«${def.titulo}» no se puede quitar.` };
        l.splice(i, 1);
      } else if (c.op === 'mover') {
        const [b] = l.splice(i, 1);
        l.splice(Math.min(Math.max(c.lugar - 1, 0), l.length), 0, b);
      } else if (c.op === 'ancho') {
        if (!def.anchos.includes(c.ancho)) return { ok: false, error: `«${def.titulo}» va de ${anchosTxt(def)}.` };
        l[i] = { ...l[i], ancho: c.ancho };
      } else if (c.op === 'diseno') {
        if (!def.disenos.some((x) => x.id === c.diseno)) return { ok: false, error: `«${def.titulo}» tiene estos diseños: ${disenosTxt(def)}.` };
        l[i] = { ...l[i], diseno: c.diseno };
      } else if (c.op === 'icono') {
        const b = { ...l[i] };
        if (c.icono && c.icono !== def.icono) b.icono = c.icono; else delete b.icono;
        l[i] = b;
      } else {
        l[i] = { ...l[i], opciones: { ...(l[i].opciones ?? {}), ...c.opciones } };
      }
      ponerTab(c.tab, l);
      break;
    }
    case 'lista': ponerTab(c.tab, sanearLista(c.bloques, c.tab)); break;
    case 'aviso': g.avisos = { ...(g.avisos ?? {}), [c.paso]: c.avisa }; break;
    case 'avisos': {
      const apagar = new Set(sanearApagados(c.apagados));
      const avisos: Partial<Record<StepId, boolean>> = {};
      for (const { id } of DATOS_AVISABLES) if (!NO_IGNORABLES.has(id)) avisos[id] = !apagar.has(id);
      g.avisos = avisos;
      break;
    }
    case 'tema': g.estilo = { ...(g.estilo ?? {}), tema: sanearTema({ ...ef.estilo.tema, ...c.tema }) }; break;
    case 'densidad': g.estilo = { ...(g.estilo ?? {}), densidad: c.densidad }; break;
    case 'volver':
      if (c.tab) { if (g.tabs) delete g.tabs[c.tab]; if (g.nombres) delete g.nombres[c.tab]; if (g.epica) delete g.epica[c.tab]; }
      else { delete g.tabs; delete g.avisos; delete g.plantillasTab; delete g.nombres; delete g.epica; }
      break;
    case 'plantilla':
      if (c.tab && esIdHoja(c.tab)) {
        // En una hoja propia, la plantilla se copia UNA vez (sus bloques y su épica): la hoja no la sigue después.
        const pt = c.plantilla ? plantillaTabPorId(c.plantilla) : undefined;
        if (c.plantilla && !pt) return { ok: false, error: 'Esa plantilla no existe.' };
        const h = hojaDe(c.tab)!;
        h.bloques = pt ? sanearLista(listaDeEntradaTab(pt, pt.tab, respaldo), h.id) : [];
        if (pt?.epico) h.epica = true; else delete h.epica;
        break;
      }
      if (c.tab) {
        const tab = c.tab;
        if (c.plantilla) g.plantillasTab = { ...(g.plantillasTab ?? {}), [tab]: c.plantilla };
        else if (g.plantillasTab) delete g.plantillasTab[tab];
        if (g.tabs) delete g.tabs[tab];
        if (g.epica) delete g.epica[tab];
        break;
      }
      if (c.plantilla) g.plantilla = c.plantilla; else delete g.plantilla;
      delete g.tabs; delete g.avisos; delete g.plantillasTab; delete g.epica;
      break;
    case 'nombre': {
      const nombre = c.nombre ?? null;
      const otra = nombre ? usado(nombre, c.tab) : undefined;
      if (otra) return { ok: false, error: `Ya hay una tab que se llama «${otra}».` };
      if (esIdHoja(c.tab)) {
        if (!nombre) return { ok: false, error: 'La hoja necesita un nombre.' };
        hojaDe(c.tab)!.nombre = nombre;
        break;
      }
      if (nombre) g.nombres = { ...(g.nombres ?? {}), [c.tab]: nombre };
      else if (g.nombres) delete g.nombres[c.tab];
      break;
    }
    case 'epica':
      if (esIdHoja(c.tab)) { const h = hojaDe(c.tab)!; if (c.epica) h.epica = true; else delete h.epica; break; }
      g.epica = { ...(g.epica ?? {}), [c.tab]: c.epica };
      break;
    case 'armar':
      if (esIdHoja(c.tab)) {
        const h = hojaDe(c.tab)!;
        h.bloques = sanearLista(c.bloques, c.tab);
        if (c.epica) h.epica = true; else delete h.epica;
        break;
      }
      ponerTab(c.tab, sanearLista(c.bloques, c.tab));
      g.epica = { ...(g.epica ?? {}), [c.tab]: c.epica };
      // La tab queda configurada aunque MaKo haya armado lo mismo que traía su plantilla.
      g.plantillasTab = { ...(g.plantillasTab ?? {}), [c.tab]: ef.plantillasTab[c.tab] };
      break;
    case 'hoja': {
      if (hojaDe(c.hoja)) return { ok: false, error: 'Esa hoja ya existe.' };
      if ((g.hojas?.length ?? 0) >= TOPE_HOJAS) return { ok: false, error: `La ficha ya tiene ${TOPE_HOJAS} hojas propias.` };
      const pt = c.plantilla ? plantillaTabPorId(c.plantilla) : undefined;
      if (c.plantilla && !pt) return { ok: false, error: 'Esa plantilla no existe.' };
      const bloques = pt ? sanearLista(listaDeEntradaTab(pt, pt.tab, respaldo), c.hoja) : sanearLista(c.bloques ?? [], c.hoja);
      // El nombre: el pedido, el de la plantilla o «Hoja N»; si ya lo usa otra, numerado («Resumen 2»), con el tope.
      const base = c.nombre ?? (pt && pt.bloques.length ? pt.nombre : `Hoja ${(g.hojas?.length ?? 0) + 1}`);
      let nom = base;
      for (let k = 2; usado(nom) && k < 100; k++) {
        const sufijo = ` ${k}`;
        nom = `${base.slice(0, TOPE_NOMBRE_TAB - sufijo.length).trimEnd()}${sufijo}`;
      }
      const h: HojaGuardada = { id: c.hoja, nombre: nom, bloques };
      if (c.epica ?? pt?.epico) h.epica = true;
      g.hojas = [...(g.hojas ?? []), h];
      break;
    }
    case 'quitar-hoja':
      if (!hojaDe(c.hoja)) return { ok: false, error: 'Esa hoja ya no existe.' };
      g.hojas = (g.hojas ?? []).filter((h) => h.id !== c.hoja);
      if (!g.hojas.length) delete g.hojas;
      break;
    case 'mover-hoja': {
      const l = [...(g.hojas ?? [])];
      const i = l.findIndex((h) => h.id === c.hoja);
      if (i < 0) return { ok: false, error: 'Esa hoja ya no existe.' };
      const [h] = l.splice(i, 1);
      l.splice(Math.min(Math.max(c.lugar - 1, 0), l.length), 0, h);
      g.hojas = l;
      break;
    }
    case 'restaurar': {
      const hoy = normalizar(actual, elegida, respaldo);
      // Compare-and-set del Deshacer: el parche de los demás cambios no pisa a nadie, pero restaurar reemplaza
      // la ficha entera. Si no está como la dejó el cambio que se deshace, otra persona la tocó después.
      if (c.esperado && !igual(normalizar(sanearFicha(c.esperado), elegida, respaldo), hoy)) {
        return { ok: false, error: 'Otra persona cambió la ficha.' };
      }
      const n = normalizar(sanearFicha(c.ficha), elegida, respaldo);
      return { ok: true, ficha: n, cambio: !igual(n, hoy) };
    }
  }
  const n = normalizar(g, elegida, respaldo);
  return { ok: true, ficha: n, cambio: !igual(n, normalizar(actual, elegida, respaldo)) };
}

const anchosTxt = (def: BloqueDef) => def.anchos.map((a) => ({ 3: '¼', 4: '⅓', 6: '½', 12: 'completo' })[a]).join(', ');
const disenosTxt = (def: BloqueDef) => def.disenos.map((x) => `${x.id} (${x.nombre})`).join(', ');

/** El cambio en una frase corta, para el historial y para la confirmación de MaKo. */
export function describirCambio(c: CambioFicha): string {
  const b = 'bloque' in c ? `«${bloqueDef(c.bloque)?.titulo ?? c.bloque}»` : '';
  const t = 'tab' in c && c.tab ? nombreLugar(c.tab) : '';
  switch (c.op) {
    case 'poner': return `Poner ${b} en ${t}${c.lugar ? ` (lugar ${c.lugar})` : ''}`;
    case 'quitar': return `Quitar ${b} de ${t}`;
    case 'mover': return `Mover ${b} al lugar ${c.lugar} de ${t}`;
    case 'ancho': return `${b} en ${t}: ancho ${({ 3: '¼', 4: '⅓', 6: '½', 12: 'completo' })[c.ancho]}`;
    case 'diseno': return `${b} en ${t}: diseño «${bloqueDef(c.bloque)?.disenos.find((x) => x.id === c.diseno)?.nombre ?? c.diseno}»`;
    case 'icono': return `${b} en ${t}: ${c.icono ? `ícono «${c.icono}»` : 'su ícono de siempre'}`;
    case 'opciones': return `${b} en ${t}: opciones`;
    case 'lista': return `Ordenar ${t}`;
    case 'aviso': return `${c.avisa ? 'Avisar' : 'No avisar'}: ${DATOS_AVISABLES.find((x) => x.id === c.paso)?.label ?? c.paso}`;
    case 'avisos': return c.apagados.length ? `No avisar: ${c.apagados.map((id) => DATOS_AVISABLES.find((x) => x.id === id)?.label ?? id).join(', ')}` : 'Avisar de todo';
    case 'tema': return 'Cambiar el estilo de la ficha';
    case 'densidad': return `Tarjetas: ${DENSIDADES.find((x) => x.id === c.densidad)?.nombre ?? c.densidad}`;
    case 'volver': return c.tab ? `Volver ${t} a la plantilla` : 'Volver toda la ficha a la plantilla';
    case 'plantilla':
      if (c.tab) return c.plantilla ? `Usar «${plantillaTabPorId(c.plantilla)?.nombre ?? c.plantilla}» en ${t}` : `${t} con la plantilla sugerida`;
      return c.plantilla ? `Usar la plantilla «${plantillaFicha(c.plantilla).nombre}»` : 'Usar la plantilla que elige MaKo';
    case 'nombre': return c.nombre ? `Llamar «${c.nombre}» a ${t}` : `${t} con su nombre de siempre`;
    case 'epica': return `${t}: vista épica ${c.epica ? 'prendida' : 'apagada'}`;
    case 'armar': return `Armar ${t} con ${c.bloques.length} ${c.bloques.length === 1 ? 'bloque' : 'bloques'}${c.epica ? ', épica' : ''}`;
    case 'hoja': {
      const pt = c.plantilla ? plantillaTabPorId(c.plantilla) : undefined;
      const con = pt ? ` con «${pt.nombre}»` : c.bloques?.length ? ` con ${c.bloques.length} ${c.bloques.length === 1 ? 'bloque' : 'bloques'}` : ' en blanco';
      return `Crear ${c.nombre ? `la hoja «${c.nombre}»` : 'una hoja'}${con}`;
    }
    case 'quitar-hoja': return 'Borrar una hoja';
    case 'mover-hoja': return `Mover una hoja al lugar ${c.lugar}`;
    case 'restaurar': return 'Deshacer el último cambio de la ficha';
  }
}
