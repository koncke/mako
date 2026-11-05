// =============================================================================
// cerebro-union — UN SOLO cerebro para el super admin: el negocio y la construcción de MaKo (17/10 y 20/10/2026)
// =============================================================================
// Martín, 17/10/2026: «en SuperAdmin no pongas 2 grafos, todo 1 solo... Para eso existen los filtros para ver desarrollo
// o ventas o marketing». Hasta hoy `VistaCerebro` dibujaba DOS `<Grafo>` y un selector «Negocio / Construcción». Ahora se
// dibuja uno: esto junta los dos `Cerebro` en uno, y las capas son un atajo del filtro de carpetas (cerebro-filtro.ts).
//
// PURO, sin `server-only` y sin React: lo importa el cliente (`esAreaDeNegocio`, `filtroDelNegocio`, `soloElNegocio`) y
// lo prueban tests/second-brain-grafo-movil.test.ts y tests/second-brain-un-cerebro.test.ts sin base. No corre ninguna
// física: la corre lib/cerebro-union-servidor.ts, en el servidor, sobre lo que arma `unirCerebros`.
//
// QUÉ NO SE PIERDE: ningún nodo ni ninguna arista de los dos grafos. Lo único que cambia es el id de la raíz de la
// construcción (`raiz` choca con la del negocio): pasa a `n1:obra`, que es lo que es, la carpeta madre de su nube.
// Cualquier otro id que chocara se prefija con `obra:` (hoy no choca ninguno; el test lo mira).
//
// 🚨 UNA SOLA RAÍZ Y UN SOLO COMPONENTE (Martín, 20/10/2026: «En ningún caso jamás los cerebros se deben dividir en 2»;
//    ya lo había pedido el 17 y el 18). Hasta ese día este archivo decía «NO HAY UNA ARISTA ENTRE LAS DOS RAÍCES, a
//    propósito» y ponía la nube de la construcción AL LADO de la del negocio, con aire en el medio: el código dibujaba un
//    solo `<Grafo>` y la pantalla mostraba DOS cerebros. Ahora la carpeta de la construcción cuelga de la raíz del negocio
//    (`PUENTE_OBRA`), todo componente suelto se engancha a la raíz (`puentesARaiz`) y, en el servidor, la física arma UNA
//    nube con todo junto (lib/cerebro-union-servidor.ts). Lo de acá sigue siendo puro: sin física.
// =============================================================================

import {
  AREAS, CAPA_CONOCIMIENTO, CAPA_CONSTRUCCION, CAPA_FUNCIONES, CAPA_NEGOCIO, TAXONOMIA_NEGOCIO,
  type AristaCerebro, type Cerebro, type Encuadre, type NodoCerebro, type Punto, type Taxonomia,
} from './cerebro-modelo';
import type { EstadoFiltro } from './cerebro-filtro';
import type { Paquete } from './cerebro-recuperar';

export { CAPA_CONSTRUCCION, CAPA_NEGOCIO };
/** La raíz de la construcción dentro del mapa único. */
export const ID_RAIZ_OBRA = 'n1:obra';

/** Cuánto aire entre las dos nubes, como fracción del lado más grande de las dos. */
const AIRE_ENTRE_NUBES = 0.18;

const IDS_AREAS_NEGOCIO: ReadonlySet<string> = new Set(AREAS.map((a) => a.id));
/** ¿Esta área es una de las diez del negocio? Sólo ésas se editan («Editar» en la barra lateral). */
export const esAreaDeNegocio = (area: string): boolean => IDS_AREAS_NEGOCIO.has(area);

/** La taxonomía de las dos capas juntas, con la capa de cada carpeta. */
export function unirTaxonomias(negocio: Taxonomia, obra: Taxonomia): Taxonomia {
  return {
    carpetas: [...negocio.carpetas, ...obra.carpetas],
    areas: [...negocio.areas, ...obra.areas],
    capas: [
      { id: CAPA_NEGOCIO, nombre: 'Negocio', carpetas: negocio.carpetas.map((c) => c.id) },
      { id: CAPA_CONSTRUCCION, nombre: 'Construcción de MaKo', carpetas: obra.carpetas.map((c) => c.id) },
    ],
  };
}

/**
 * UNA CAPA MÁS para los CHATS, sin física (28/10/2026): sus nodos y sus aristas, su taxonomía, y una arista de la raíz del
 * negocio a la carpeta madre de la capa (`raiz`), así sigue siendo UN cerebro. Un id que chocara con uno del negocio se
 * prefija con el de la capa (hoy no choca ninguno: las funciones son `fn:` y `n1:funciones`). Lo usa `grafoParaChat`
 * (lib/cerebro-para-chat.ts); el mapa que se DIBUJA sigue con `unirCerebros`, que además junta las posiciones.
 */
export function conCapa(base: Cerebro<string>, capa: Cerebro<string>, c: { id: string; nombre: string; raiz: string; motivo: string }): Cerebro<string> {
  const ids = new Set(base.nodos.map((n) => n.id));
  const id = (x: string) => (ids.has(x) ? `${c.id}:${x}` : x);
  const tax = base.taxonomia ?? TAXONOMIA_NEGOCIO;
  const suya = capa.taxonomia ?? { carpetas: [], areas: [] };
  const raizBase = base.nodos.find((n) => n.id === 'raiz') ? 'raiz' : null;
  return {
    ...base,
    nodos: [...base.nodos, ...capa.nodos.map((n) => ({ ...n, id: id(n.id) }))],
    aristas: [
      ...base.aristas, ...capa.aristas.map((a) => ({ ...a, de: id(a.de), a: id(a.a) })),
      ...(raizBase ? [{ de: raizBase, a: id(c.raiz), motivo: c.motivo }] : []),
    ],
    taxonomia: {
      carpetas: [...tax.carpetas, ...suya.carpetas],
      areas: [...tax.areas, ...suya.areas],
      capas: [
        ...(tax.capas ?? [{ id: CAPA_NEGOCIO, nombre: 'Negocio', carpetas: tax.carpetas.map((x) => x.id) }]),
        { id: c.id, nombre: c.nombre, carpetas: suya.carpetas.map((x) => x.id) },
      ],
    },
    huella: undefined,
  };
}

/**
 * LO QUE SÍ VE UN CLOSER O UN SETTER del grafo (28/10/2026, como `sinNumerosDelNegocio` de lib/mako-context.ts), EN POSITIVO:
 * la estructura; lo que se vende y a cuánto (oferta, productos, lead magnet, entregables, los campos de la oferta); a quién
 * (avatares, razones, los campos del cliente ideal); cómo se le habla (voz, persona, glosario, formatos, audios, secuencias,
 * los campos de la marca); la landing; por dónde pasa un lead (funnels, etapas, cuántos leads hay); los cinco planos del
 * panorama, y en la plataforma, las funciones de MaKo. Lo demás NO: el Norte (la fase con cuánto invertir, el cuello, el
 * objetivo «12 cierres en 90 días — Y USD 30.000 de facturación», los OKR, los KPI, los campos del negocio), los clientes
 * ganados, las reuniones analizadas, los documentos, los chats y cualquier otro plano del panorama. Se saca ANTES de
 * recuperar, con sus aristas: el grafo que guarda la caché de los chats es del negocio, no de la persona.
 * ⚠️ Era la lista de lo que se SACABA (okr, kpi, cliente) y el nodo `objetivo` (los settings del onboarding) se coló: un closer
 * lo recibía en cinco de seis preguntas (la verificación de b2c19c445). En positivo, un tipo de nodo NUEVO no lo ve un closer
 * hasta que alguien lo sume acá a propósito.
 */
const VE_SIN_PLATA = new RegExp([
  // `marca` (5/11/2026, lib/marca/kits.ts): los colores, las fuentes y el logo; sin un número del negocio adentro.
  '^(?:raiz|leads|voz|vozcom|persona|glosario|marca)$',
  // `kn:` y la capa `knowledge` (31/10/2026, lib/cerebro-knowledge.ts): el método de los cursos no tiene un número del
  // negocio adentro, y es justo lo que un closer o un setter necesitan leer para escribir un mensaje o cerrar una
  // llamada. Se suma A PROPÓSITO, como pide la regla de esta lista en positivo.
  `^(?:n1|area|fn|${CAPA_FUNCIONES}|kn|${CAPA_CONOCIMIENTO}|oferta|prod|lm|ent|av|raz|fmt|sec|land|audio|etapa|funnel):`,
  '^campo:(?:oferta|avatar|marca)_',
  '^pan:(?:IDENTIDAD Y POSICIONAMIENTO|OFERTA Y PRECIOS|AVATAR Y CLIENTE IDEAL|NICHO Y MERCADO|TONO Y VOZ DE MARCA)$',
].join('|'));
export function sinLaPlata<C extends Pick<Cerebro<string>, 'nodos' | 'aristas'>>(c: C): C {
  const fuera = new Set(c.nodos.filter((n) => !VE_SIN_PLATA.test(n.id)).map((n) => n.id));
  if (!fuera.size) return c;
  return { ...c, nodos: c.nodos.filter((n) => !fuera.has(n.id)), aristas: c.aristas.filter((a) => !fuera.has(a.de) && !fuera.has(a.a)) };
}

/** Los tokens del Second Brain en el system de un turno: la vista local de la pregunta, no el grafo (el default es 1.500). */
export const PRESUPUESTO_TURNO = 1_200;

/** Las letras del mensaje con las que el turno busca en el grafo: las primeras, cortadas en una palabra. `recuperar` es
 *  sincrónico y crece con las palabras distintas por los nodos: un texto pegado de 32.000 letras bloqueaba el proceso de 2 a
 *  6 s, FUERA de la espera acotada del grafo (la verificación de b2c19c445). */
export const LARGO_PREGUNTA_TURNO = 600;
export function preguntaDelTurno(texto: string): string {
  const t = texto.trim();
  if (t.length <= LARGO_PREGUNTA_TURNO) return t;
  const corte = t.slice(0, LARGO_PREGUNTA_TURNO);
  const espacio = corte.lastIndexOf(' ');
  return (espacio > LARGO_PREGUNTA_TURNO / 2 ? corte.slice(0, espacio) : corte).trim();
}

/** El bloque del system de un turno con lo que el Second Brain sabe de la pregunta. Sólo con una vista local: el índice
 *  (la pregunta no nombró nada del grafo) no viaja en cada turno. */
export function bloqueDelSecondBrain(p: Pick<Paquete, 'modo' | 'texto'>): string {
  if (p.modo !== 'vista-local' || !p.texto.trim()) return '';
  return `LO QUE TU SECOND BRAIN SABE DE ESTA PREGUNTA (los datos del negocio que nombra, con sus vecinos; lo demás del negocio está más arriba o se pide con una herramienta):\n${p.texto}`;
}

/** La arista que hace UNO del negocio y la construcción: la raíz del negocio y la carpeta madre de la construcción. */
export const PUENTE_OBRA = 'Lo que construye MaKo, el producto con el que trabaja este negocio';
export const PUENTE_ISLA = 'Es parte de tu negocio';
export const PUENTE_ISLA_OBRA = 'Es parte de MaKo';

/** Los componentes conexos del grafo (cada uno, la lista de sus ids), el más grande primero. */
export function componentes(nodos: readonly Pick<NodoCerebro<string>, 'id'>[], aristas: readonly AristaCerebro[]): string[][] {
  const padre = new Map(nodos.map((n) => [n.id, n.id]));
  const raizDe = (x: string): string => { let r = x; while (padre.get(r) !== r) r = padre.get(r)!; padre.set(x, r); return r; };
  for (const a of aristas) {
    if (!padre.has(a.de) || !padre.has(a.a)) continue;
    const x = raizDe(a.de); const y = raizDe(a.a);
    if (x !== y) padre.set(x, y);
  }
  const grupos = new Map<string, string[]>();
  for (const n of nodos) { const r = raizDe(n.id); grupos.set(r, [...(grupos.get(r) ?? []), n.id]); }
  return [...grupos.values()].sort((a, b) => b.length - a.length);
}

/**
 * Las aristas que faltan para que TODO cuelgue de UNA raíz: una por cada componente que no la contiene, desde su nodo
 * más estructural (una carpeta madre, si no un área, si no el más conectado) hasta la raíz. Medido antes: una isla
 * (un área cuyos datos no tienen ninguna arista lateral) se dibujaba flotando aparte, y eso también es un cerebro partido.
 */
export function puentesARaiz(nodos: readonly Pick<NodoCerebro<string>, 'id'>[], aristas: readonly AristaCerebro[], raiz = 'raiz', motivo = PUENTE_ISLA): AristaCerebro[] {
  if (!nodos.some((n) => n.id === raiz)) return [];
  const grado = new Map<string, number>();
  for (const a of aristas) { grado.set(a.de, (grado.get(a.de) ?? 0) + 1); grado.set(a.a, (grado.get(a.a) ?? 0) + 1); }
  const peso = (id: string) => (id.startsWith('n1:') ? 3 : id.startsWith('area:') ? 2 : 1) * 1000 + (grado.get(id) ?? 0);
  return componentes(nodos, aristas)
    .filter((c) => !c.includes(raiz))
    .map((c) => ({ de: [...c].sort((x, y) => peso(y) - peso(x) || (x < y ? -1 : 1))[0], a: raiz, motivo }));
}

/** Los dos cerebros en uno. `negocio` es el del workspace que se mira; `obra`, la construcción de MaKo. */
export function unirCerebros(negocio: Cerebro<string>, obra: Cerebro<string>): Cerebro<string> {
  const taxNegocio = negocio.taxonomia ?? TAXONOMIA_NEGOCIO;
  const taxObra = obra.taxonomia ?? TAXONOMIA_NEGOCIO;

  // Los ids de la construcción que chocan con los del negocio (siempre `raiz`) cambian; el resto queda igual.
  const delNegocio = new Set(negocio.nodos.map((n) => n.id));
  const idNuevo = (id: string): string => (id === 'raiz' ? ID_RAIZ_OBRA : delNegocio.has(id) ? `obra:${id}` : id);

  // POSICIONES DE PARTIDA, no las finales: la construcción a la derecha, centrada con el negocio. El servidor le corre la
  // física a todo junto (lib/cerebro-union-servidor.ts); dibujar ESTO tal cual es dibujar dos nubes.
  const vacio = negocio.nodos.length === 0;
  const en = negocio.encuadre;
  const eo = obra.encuadre;
  const aire = Math.max(en.lado, eo.lado) * AIRE_ENTRE_NUBES;
  const dx = vacio ? 0 : en.x + en.lado + aire - eo.x;
  const dy = vacio ? 0 : en.y + en.lado / 2 - (eo.y + eo.lado / 2);

  const nodosObra: NodoCerebro<string>[] = obra.nodos.map((n) => ({ ...n, id: idNuevo(n.id) }));
  const aristasObra: AristaCerebro[] = obra.aristas.map((a) => ({ ...a, de: idNuevo(a.de), a: idNuevo(a.a) }));
  const posiciones: Record<string, Punto> = { ...negocio.posiciones };
  for (const [id, p] of Object.entries(obra.posiciones)) posiciones[idNuevo(id)] = { x: p.x + dx, y: p.y + dy };

  // El encuadre que abarca las dos cajas (cuadrado, como el resto del modelo): `ajustar()` del grafo encuadra contra el
  // bbox real de los nodos, así que esto sólo fija la escala del viewBox.
  const cajas: Encuadre[] = vacio ? [eo] : [en, { x: eo.x + dx, y: eo.y + dy, lado: eo.lado }];
  const x0 = Math.min(...cajas.map((c) => c.x));
  const y0 = Math.min(...cajas.map((c) => c.y));
  const x1 = Math.max(...cajas.map((c) => c.x + c.lado));
  const y1 = Math.max(...cajas.map((c) => c.y + c.lado));
  const lado = Math.max(x1 - x0, y1 - y0);
  const encuadre: Encuadre = { x: (x0 + x1) / 2 - lado / 2, y: (y0 + y1) / 2 - lado / 2, lado };

  // UNA raíz: la carpeta madre de la construcción cuelga de la raíz del negocio, y lo que quedara suelto también.
  const nodos = [...negocio.nodos, ...nodosObra];
  const aristasJuntas = [...negocio.aristas, ...aristasObra];
  if (!vacio && nodos.some((n) => n.id === ID_RAIZ_OBRA)) aristasJuntas.push({ de: 'raiz', a: ID_RAIZ_OBRA, motivo: PUENTE_OBRA });
  aristasJuntas.push(...puentesARaiz(nodos, aristasJuntas));
  return {
    negocio: negocio.negocio,
    nodos,
    aristas: aristasJuntas,
    cuenta: {
      total: negocio.cuenta.total + obra.cuenta.total,
      mako: negocio.cuenta.mako + obra.cuenta.mako,
      usuario: negocio.cuenta.usuario + obra.cuenta.usuario,
      pendientes: negocio.cuenta.pendientes + obra.cuenta.pendientes,
    },
    vacias: [...negocio.vacias],
    posiciones,
    encuadre,
    huella: negocio.huella,
    taxonomia: unirTaxonomias(taxNegocio, taxObra),
  };
}

/** Sólo el negocio del cerebro unido (sus nodos son los de las diez áreas): lo que cuenta «Exportar», que baja el ZIP del
 *  negocio. Sin la construcción, devuelve el mismo cerebro. */
export function soloElNegocio(c: Cerebro<string>): Cerebro {
  if (!c.taxonomia?.capas?.length) return c as Cerebro;
  const nodos = c.nodos.filter((n) => esAreaDeNegocio(n.area)) as NodoCerebro[];
  const ids = new Set(nodos.map((n) => n.id));
  return { ...c, nodos, aristas: c.aristas.filter((a) => ids.has(a.de) && ids.has(a.a)), taxonomia: TAXONOMIA_NEGOCIO } as Cerebro;
}

/** Lo que «Exportar» puede bajar del filtro puesto: sólo existe el ZIP del negocio, no el de la construcción.
 *  Devuelve el filtro recortado a lo del negocio, o `null` si lo que se mira es SÓLO la construcción (ahí no hay nada
 *  del negocio que bajar, y un filtro vacío bajaría TODO el negocio, que no es lo que se está viendo). */
export function filtroDelNegocio(f: EstadoFiltro, tax: Taxonomia): EstadoFiltro | null {
  const carpetasNegocio = new Set(tax.capas?.find((c) => c.id === CAPA_NEGOCIO)?.carpetas ?? tax.carpetas.map((c) => c.id));
  const carpetas = new Set([...f.carpetas].filter((c) => carpetasNegocio.has(c)));
  if (f.carpetas.size && !carpetas.size) return null;
  const areas = new Set([...f.areas].filter((a) => esAreaDeNegocio(a)));
  if (f.areas.size && !areas.size) return null;
  return { carpetas, areas, autoria: f.autoria };
}
