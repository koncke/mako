// =============================================================================
// ficha/plantillas-tab — las plantillas de UNA tab de la ficha (la galería de cada tab)
// =============================================================================
// Martín, 16/10/2026: «Sobre todo que sea PERSONALIZABLE, como tenemos en dashboard o general cada tab... Que no
// sea complejo de utilizar, que hayan templates para "resumen", "tracking" y todas las tabs... Si nunca configuró
// una tab, y entra por primera vez al detail de un lead, que le salten los templates y el ¿Qué vas a crear hoy?».
//
// Hasta acá la plantilla era del FUNNEL y fijaba las cuatro tabs juntas (./plantillas.ts). Ahora cada tab tiene su
// galería y elegir una plantilla para una tab reemplaza SÓLO esa tab. La del funnel sigue: decide los avisos de
// «datos sin marcar» que nacen apagados y cuál de cada tab va de entrada (la sugerida).
//
// QUÉ HAY EN CADA GALERÍA:
//   · «En blanco», primera siempre (como «Hoja en blanco» del Dashboard): sólo lo que no se puede quitar.
//   · las de hoy, PARTIDAS POR TAB: la lista de cada tipo de funnel (./plantillas.ts) para esa tab. Dos tipos con
//     la misma lista son UNA plantilla (Tracking: las dos de llamada comparten la suya), sugerida para los dos;
//   · una ÉPICA por tab (pocas cosas, en grande: la vista épica de General y de MaKo Mobile v3);
//   · en Pagos, las del chat Pagos (./plantillas-pagos.ts) cuando las haya; mientras ese archivo esté vacío, las de
//     hoy partidas. ⚠️ Las de Pagos las escribe Pagos: este archivo sólo las importa (acordado el 16/10/2026).
//   · en el Resumen (16/10/2026, el Resumen nativo), las suyas (./plantillas-resumen.ts): las mismas listas de cada tipo
//     ARMADAS, con su ancho y su diseño, la épica y «Para llamarlo». Las partidas de hoy dejan de ofrecerse ahí, pero
//     sus ids siguen valiendo (una ficha que ya eligió una la conserva: `porId`).
//
// ⚠️ LA DE ENTRADA DE UNA TAB es, para el tipo de funnel X, la primera plantilla de la galería con X en `sugeridaPara`.
//    En Tracking y Reuniones son las partidas de hoy, así que un funnel que nadie tocó se ve como antes. En Pagos y en
//    el Resumen son las ARMADAS de su archivo, con los mismos bloques de la lista de su tipo como mínimo (los avisos
//    siguen teniendo dónde llenarse): ahí un funnel sin tocar cambia de diseño a propósito (Martín, 16/10/2026:
//    «completamente diferente en diseño y funcionalidad»). La épica no se sugiere: se elige.
// ⚠️ «SUGERIDO» ES LA REGLA DE LA CASA (lib/plantillas-sugeridas.ts, docs/plantillas-sugeridas.md): primero, hasta
//    MAX_SUGERIDAS, con un rótulo sutil. La señal acá es el TIPO del funnel (`elegirPlantilla`: sus etapas de
//    reunión, su canal efectivo y por dónde entra la gente), que es lo analizado de ESE funnel. `sugeridasDeTab` es
//    la ÚNICA función que decide qué se sugiere: lo que se enchufe después (la oferta, el cobro) entra por ahí.
// ⚠️ EL ID SE GUARDA (`funnels.data.ficha.plantillasTab`): no se renombra. Uno que ya no existe se tira en el
//    saneo y la tab vuelve a la de entrada.
//
// Puro, sin `server-only`: lo leen el motor (./config.ts), la API de MaKo, la pantalla y los tests.
// =============================================================================

import { MAX_SUGERIDAS } from '../plantillas-sugeridas';
import { vaEnTab, bloqueDef, TABS_FICHA, type Ancho, type BloqueId, type TabFicha } from './catalogo';
import { PLANTILLAS_FICHA, listaDePlantilla, plantillaFicha, type PlantillaId } from './plantillas';
import { PLANTILLAS_TAB_PAGOS } from './plantillas-pagos';
import { PLANTILLAS_TAB_RESUMEN } from './plantillas-resumen';

/**
 * Una plantilla de UNA tab. ⚠️ ES EL CONTRATO CON EL CHAT PAGOS (16/10/2026): no se cambia sin avisarle.
 *   · `bloques`: en orden; el ancho y el diseño son opcionales (sin ellos, los de entrada del catálogo).
 *   · `epico`: la plantilla trae la vista épica prendida.
 *   · `sugeridaPara`: los tipos de funnel (ids de ./plantillas.ts) para los que sale primero, con «Sugerido».
 */
export type PlantillaTab = {
  id: string;
  tab: TabFicha;
  nombre: string;
  bajada: string;
  bloques: { id: BloqueId; ancho?: Ancho; diseno?: string }[];
  epico?: boolean;
  sugeridaPara?: PlantillaId[];
};

/** De qué se trata cada tipo de funnel, en una línea (va en el title de la tarjeta y en la API). */
const BAJADA_DE_TIPO: Readonly<Record<PlantillaId, string>> = {
  'dos-reuniones': 'Dos reuniones antes de cerrar.',
  'una-llamada': 'Una llamada y el cierre.',
  evento: 'Un webinar o una sesión con fecha fija.',
  'formulario-meta': 'Dejan sus datos en un anuncio.',
  landing: 'Llenan un formulario en tu página.',
  'te-escriben': 'Te escriben por chat.',
  prospeccion: 'Tú les escribes primero.',
  carrito: 'Compran solos en tu página.',
  respaldo: 'Todo lo que tenía la ficha.',
};

/** «En blanco», de cada tab: sólo lo que no se puede quitar (en el Resumen, el contacto; lo pone el saneo). */
const enBlanco = (tab: TabFicha): PlantillaTab => ({
  id: `${tab}-en-blanco`, tab, nombre: 'En blanco', bajada: 'Arma la tab desde cero.', bloques: [],
});

/**
 * LAS DE HOY, PARTIDAS POR TAB: la lista de cada tipo de funnel para esta tab. Los tipos con la MISMA lista son una
 * sola plantilla, sugerida para todos ellos; la del respaldo («Completa») va al final, como en el menú del funnel.
 */
function derivadas(tab: TabFicha): readonly PlantillaTab[] {
  const hecha = DERIVADAS.get(tab);
  if (hecha) return hecha;
  const grupos = new Map<string, PlantillaId[]>();
  for (const p of PLANTILLAS_FICHA) {
    const clave = listaDePlantilla(p, tab).join(',');
    grupos.set(clave, [...(grupos.get(clave) ?? []), p.id]);
  }
  const out: PlantillaTab[] = [];
  for (const [clave, tipos] of grupos) {
    const conRespaldo = tipos.includes('respaldo');
    const deLlamada = tipos.length > 1 && tipos.every((t) => t === 'dos-reuniones' || t === 'una-llamada');
    const base = conRespaldo ? 'respaldo' : tipos[0];
    out.push({
      id: `${tab}-${base}`, tab,
      nombre: conRespaldo ? 'Completa' : deLlamada ? 'Llamada' : plantillaFicha(base).nombre,
      bajada: conRespaldo ? BAJADA_DE_TIPO.respaldo : deLlamada ? 'Una o dos llamadas antes de cerrar.' : BAJADA_DE_TIPO[base],
      bloques: (clave ? clave.split(',') : []).map((id) => ({ id: id as BloqueId })),
      sugeridaPara: tipos,
    });
  }
  // La completa al final: es lo que queda si nada aplica.
  const lista = [...out.filter((p) => !p.sugeridaPara?.includes('respaldo')), ...out.filter((p) => p.sugeridaPara?.includes('respaldo'))];
  DERIVADAS.set(tab, lista);
  return lista;
}
/** Las partidas de hoy, calculadas una vez por tab: las plantillas del funnel son constantes y esto corre en cada ficha. */
const DERIVADAS = new Map<TabFicha, readonly PlantillaTab[]>();

/**
 * LAS ÉPICAS (Martín, 16/10/2026: «que se pueda ver "epico" como lo tenemos en general»): pocas cosas y en grande,
 * como General y MaKo Mobile v3. Los diseños son los «Número grande», «Banner» y «Botonera grande» del catálogo; la
 * grilla épica les da más aire (./config.ts no la toca: es de la pantalla, app/crm/lead-view/ficha/armar.ts). Pagos
 * trae las suyas (./plantillas-pagos.ts).
 */
const EPICAS: Readonly<Partial<Record<TabFicha, PlantillaTab>>> = {
  // La del Resumen vive con las suyas (./plantillas-resumen.ts, mismo id `resumen-epica`).
  reuniones: {
    id: 'reuniones-epica', tab: 'reuniones', nombre: 'Épica', bajada: 'La reunión y lo que salió, en grande.', epico: true,
    bloques: [
      { id: 'reunion-1', ancho: 12, diseno: 'completa' },
      { id: 'reunion-2', ancho: 12, diseno: 'completa' },
      { id: 'lo-que-salio-de-la-llamada', ancho: 12, diseno: 'paso' },
      { id: 'ciclo-de-venta', ancho: 6, diseno: 'numero' },
    ],
  },
  tracking: {
    id: 'tracking-epica', tab: 'tracking', nombre: 'Épica', bajada: 'Qué vio y cuántas veces vino.', epico: true,
    bloques: [
      { id: 'video-visto', ancho: 12, diseno: 'numero' },
      { id: 'visitas', ancho: 6, diseno: 'numeros' },
      { id: 'grabacion-de-visita', ancho: 12, diseno: 'ultima' },
    ],
  },
};

/** Las de Pagos que valen: las de su archivo que son de Pagos (una de otra tab no entra a esta galería). */
const dePagos = (): PlantillaTab[] => PLANTILLAS_TAB_PAGOS.filter((p) => p.tab === 'pagos');
/** Las del Resumen, con la misma regla. */
const deResumen = (): PlantillaTab[] => PLANTILLAS_TAB_RESUMEN.filter((p) => p.tab === 'resumen');

/** La galería de una tab en su orden de siempre: «En blanco», la épica, las de cada tipo y la completa al final. */
export function plantillasDeTab(tab: TabFicha): readonly PlantillaTab[] {
  if (tab === 'pagos' && dePagos().length) return [enBlanco('pagos'), ...dePagos()];
  if (tab === 'resumen' && deResumen().length) return [enBlanco('resumen'), ...deResumen()];
  const epica = EPICAS[tab];
  return [enBlanco(tab), ...(epica ? [epica] : []), ...derivadas(tab)];
}

/** Todas las que se pueden guardar, por id: las de cada galería y las partidas de hoy (de entrada, aunque Pagos traiga las suyas). */
let todas: ReadonlyMap<string, PlantillaTab> | null = null;
function porId(): ReadonlyMap<string, PlantillaTab> {
  if (todas) return todas;
  const out = new Map<string, PlantillaTab>();
  for (const tab of TABS_FICHA) {
    for (const p of plantillasDeTab(tab)) if (!out.has(p.id)) out.set(p.id, p);
    for (const p of derivadas(tab)) if (!out.has(p.id)) out.set(p.id, p);
  }
  todas = out;
  return out;
}

/** La plantilla de tab por id, o undefined (un id viejo guardado en una ficha). */
export const plantillaTabPorId = (id: unknown): PlantillaTab | undefined =>
  typeof id === 'string' ? porId().get(id) : undefined;

/** ¿Este id es una plantilla de ESTA tab? */
export const esPlantillaTabDe = (id: unknown, tab: TabFicha): id is string => plantillaTabPorId(id)?.tab === tab;

/**
 * LA DE ENTRADA de una tab para un tipo de funnel: la primera de la galería sugerida para ese tipo, y si ninguna lo
 * está (Pagos todavía no cubre ese tipo), la de hoy partida. Siempre hay una.
 */
export function plantillaTabDeEntrada(tab: TabFicha, tipo: PlantillaId): PlantillaTab {
  const deLaGaleria = plantillasDeTab(tab).find((p) => p.sugeridaPara?.includes(tipo));
  if (deLaGaleria) return deLaGaleria;
  return derivadas(tab).find((p) => p.sugeridaPara?.includes(tipo))!;
}

/**
 * LA FUNCIÓN DE LAS SUGERIDAS de una tab (Martín, 16/10/2026: «al principio se posicionen los sugeridos para el
 * negocio... Y que tenga un texto sutil de "Sugerido"»). Los ids de la galería sugeridos para el funnel: la de entrada
 * primero, después las otras que lo nombran, hasta MAX_SUGERIDAS. Hoy la señal es el tipo del funnel; lo que se sume
 * (la oferta, el cobro del módulo compartido) entra acá y en ningún otro lado.
 */
export function sugeridasDeTab(tab: TabFicha, f: { plantilla: PlantillaId }): string[] {
  const entrada = plantillaTabDeEntrada(tab, f.plantilla);
  const galeria = plantillasDeTab(tab);
  const otras = galeria.filter((p) => p.id !== entrada.id && p.sugeridaPara?.includes(f.plantilla)).map((p) => p.id);
  return [...(galeria.some((p) => p.id === entrada.id) ? [entrada.id] : []), ...otras].slice(0, MAX_SUGERIDAS);
}

/** Una plantilla de la galería con su porqué si va sugerida (la forma de `ordenarConSugeridas`, lib/plantillas-sugeridas.ts). */
export type PlantillaTabEnGaleria = { plantilla: PlantillaTab; porque: string | null };

/**
 * LA GALERÍA COMO SE DIBUJA: «En blanco» primera siempre, después las sugeridas (con su porqué) y el resto en su orden.
 * Es lo que muestran la pantalla y la API, en el mismo orden.
 */
export function galeriaDeTab(tab: TabFicha, f: { plantilla: PlantillaId; porque?: string }): PlantillaTabEnGaleria[] {
  const galeria = plantillasDeTab(tab);
  const sugeridas = sugeridasDeTab(tab, f);
  const porque = f.porque?.trim() || `Va con «${plantillaFicha(f.plantilla).nombre}».`;
  const blanco = galeria.filter((p) => p.bloques.length === 0 && p.id === `${tab}-en-blanco`);
  return [
    ...blanco.map((plantilla) => ({ plantilla, porque: null })),
    ...sugeridas.map((id) => ({ plantilla: galeria.find((p) => p.id === id)!, porque })),
    ...galeria.filter((p) => !blanco.includes(p) && !sugeridas.includes(p.id)).map((plantilla) => ({ plantilla, porque: null })),
  ];
}

/** Los bloques de la plantilla que van en su tab (los de otra tab se ignoran: una plantilla rota no rompe la ficha). */
export function bloquesDePlantillaTab(p: PlantillaTab): PlantillaTab['bloques'] {
  return p.bloques.filter((b) => { const d = bloqueDef(b.id); return !!d && vaEnTab(d, p.tab); });
}
