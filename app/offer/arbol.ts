// =============================================================================
// /offer — el ÁRBOL de las ofertas (funnel → sus ofertas → sus conversaciones), PURO
// =============================================================================
// ⚠️ DESDE EL 29/10/2026 NO HAY DESPLEGABLE (Martín: «en offer pon el mismo sistema de la sidebar, en lugar del desplegable
// actual»): el árbol sigue siendo el dato (el server lo arma, el teléfono lo dibuja en su hoja) y la computadora lo muestra como
// la LISTA de la tarjeta del chat y las plantillas de «Nueva oferta» (`renglonesDeOffer`, `plantillasDeOffer`, al final).
// Lo de abajo es la historia del desplegable.
// Pedido de Martín (11/10/2026): «donde hoy está el título de "Offer" se elimine y ahí se
// seleccione un funnel, y se pueda crear o analizar una oferta… Elimina el botón de "Ofertas
// anteriores", para eso ya estará el desplegable… Y ese desplegable debe ser modo arbol, como lo
// hacemos siempre. Primero el paso del funnel y dentro las ofertas que hayan.»
//
// «Como lo hacemos siempre» es el `Dropdown` de la casa con `secciones` y `grupos` (un nivel más):
// el molde es el del disparador por etapa de /automations (app/automations/EditorDisparadores.tsx:
// producto → «Adquisición» / «Entrega» → la etapa), con el botón dibujando el CAMINO (`botonLabel`).
// Aquí se arma sólo el DATO de ese árbol; el componente es ./SelectorFunnel.tsx.
//
//   raíz            un renglón por funnel (y «Sin funnel» para las conversaciones de la v1)
//   funnel          sus ofertas (cada una abre su nivel), sus conversaciones de «oferta nueva» y
//                   «＋ Nueva oferta» al final (`crear`: la salida para crear, apagada hasta el hover)
//   oferta          sus conversaciones (la más nueva arriba) y «＋ Analizar» al final
//
// Sin React y sin `server-only`: lo importa la página (server, para abrir la conversación más
// reciente) y la pantalla. De ./Dropdown sólo viajan TIPOS (`import type` se borra al compilar):
// un valor de un módulo 'use client' acá rompería el server (AGENTS.md, «'use client' es una
// frontera de DATOS»).
//
// ⚠️ LA NAVEGACIÓN DEL DROPDOWN VA POR TÍTULO (`ruta` es un camino de títulos): dos funnels o dos
// ofertas con el mismo nombre abrirían siempre la primera. Por eso los títulos de un mismo nivel se
// desambiguan (`titulosUnicos`).

import type { ArbolOffer, OfferSesionResumen, OfferSesionVista } from '@/lib/offer-marco';
import { masReciente } from './ayudas';

export const ARBOL_VACIO: ArbolOffer = { funnels: [], sueltas: [] };

/** El título de la sección de las conversaciones sin funnel (las de la v1). */
export const TITULO_SUELTAS = 'Sin funnel';

// ── Lo que se elige ──────────────────────────────────────────────────────────

export type EleccionArbol =
  | { tipo: 'sesion'; id: number }
  | { tipo: 'nueva'; funnelId: number; ofertaBaseId: number | null };

export const valorSesion = (id: number): string => `sesion:${id}`;
export const valorNueva = (funnelId: number, ofertaBaseId: number | null): string =>
  ofertaBaseId == null ? `nueva:${funnelId}` : `analizar:${funnelId}:${ofertaBaseId}`;

const entero = (s: string | undefined): number | null => {
  if (!s || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** Lo inverso de `valorSesion` / `valorNueva`. null = un valor que no es de este árbol. */
export function leerValor(v: string): EleccionArbol | null {
  const [tipo, a, b, ...resto] = v.split(':');
  if (resto.length) return null;
  if (tipo === 'sesion' && b === undefined) {
    const id = entero(a);
    return id == null ? null : { tipo: 'sesion', id };
  }
  if (tipo === 'nueva' && b === undefined) {
    const funnelId = entero(a);
    return funnelId == null ? null : { tipo: 'nueva', funnelId, ofertaBaseId: null };
  }
  if (tipo === 'analizar') {
    const funnelId = entero(a);
    const ofertaBaseId = entero(b);
    return funnelId == null || ofertaBaseId == null ? null : { tipo: 'nueva', funnelId, ofertaBaseId };
  }
  return null;
}

/** Un parámetro de la URL leído como id. Lo que no es un entero positivo, null. */
export const idDeParametro = (v: string | string[] | undefined): number | null => entero(Array.isArray(v) ? v[0] : v);

/**
 * Lo que abre un link que nombra una oferta: el «Analizar oferta →» de la ficha del lead en el CRM
 * (13/10/2026), `/offer?oferta=<id>&funnel=<id>`. La conversación más reciente de esa oferta si ya
 * tiene una; si no, una nueva para analizarla (la misma que el «Analizar» del selector).
 *
 * El funnel del link desempata cuando la oferta cuelga de varios; sin él, o si no es uno de los suyos,
 * el primero que la tenga. null = la oferta no está en el árbol (no es de este workspace, o no está
 * ligada a ningún funnel): la pantalla abre como siempre, en la conversación más reciente.
 */
export function entradaDelLink(a: ArbolOffer, ofertaId: number | null, funnelId: number | null): EleccionArbol | null {
  if (ofertaId == null) return null;
  const con = a.funnels.filter((f) => f.ofertas.some((o) => o.id === ofertaId));
  const f = con.find((x) => x.id === funnelId) ?? con[0];
  const o = f?.ofertas.find((x) => x.id === ofertaId);
  if (!f || !o) return null;
  const ultima = masReciente(o.sesiones);
  return ultima ? { tipo: 'sesion', id: ultima.id } : { tipo: 'nueva', funnelId: f.id, ofertaBaseId: ofertaId };
}

// ── El árbol que viene del servidor ──────────────────────────────────────────

const ms = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

const masNuevasPrimero = (l: OfferSesionResumen[]): OfferSesionResumen[] =>
  [...l].sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt));

const esResumen = (x: unknown): x is OfferSesionResumen =>
  !!x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'number';
const resumenes = (x: unknown): OfferSesionResumen[] => (Array.isArray(x) ? x.filter(esResumen) : []);
const nombreDe = (x: unknown): string => (typeof x === 'string' ? x : '');

/**
 * El árbol leído A LA DEFENSIVA: lo que no tiene la forma se descarta en vez de tirar la
 * pantalla (un desplegable que se rompe al dibujarse deja la tab sin salida).
 */
export function arbolSeguro(x: unknown): ArbolOffer {
  if (!x || typeof x !== 'object') return ARBOL_VACIO;
  const o = x as { funnels?: unknown; sueltas?: unknown };
  const funnels = (Array.isArray(o.funnels) ? o.funnels : [])
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object' && typeof (f as { id?: unknown }).id === 'number')
    .map((f) => ({
      id: f.id as number,
      nombre: nombreDe(f.nombre),
      ofertas: (Array.isArray(f.ofertas) ? f.ofertas : [])
        .filter((of): of is Record<string, unknown> => !!of && typeof of === 'object' && typeof (of as { id?: unknown }).id === 'number')
        .map((of) => ({ id: of.id as number, nombre: nombreDe(of.nombre), principal: of.principal === true, sesiones: resumenes(of.sesiones) })),
      sesionesNuevas: resumenes(f.sesionesNuevas),
    }));
  return { funnels, sueltas: resumenes(o.sueltas) };
}

/** Todas las conversaciones del árbol, en cualquier rama. */
export function todasLasSesiones(a: ArbolOffer): OfferSesionResumen[] {
  return [
    ...a.funnels.flatMap((f) => [...f.ofertas.flatMap((o) => o.sesiones), ...f.sesionesNuevas]),
    ...a.sueltas,
  ];
}

/** ¿Hay algo para elegir? Sin funnels ni conversaciones, el selector no tiene qué abrir. */
export const arbolVacio = (a: ArbolOffer): boolean => a.funnels.length === 0 && a.sueltas.length === 0;

/**
 * El árbol con ESTA conversación puesta en su lugar (o movida, o con su título y su fecha al día), sin
 * volver a pedirlo al servidor.
 *
 * ⚠️ CON LA MISMA REGLA QUE `construirArbol` (lib/offer-reglas.ts), y sobre el MISMO dato: la columna
 * cruda `oferta_id` (`ofertaGuardadaId` de la vista), nunca `ofertaId`, que vale null cuando lo guardado
 * ya no es la versión vigente. Con `ofertaId` la conversación saltaba de rama en cada turno y el servidor
 * la devolvía al volver a la pestaña (revisión adversarial del 11/10). La regla: su funnel y, adentro, la
 * oferta guardada si ese funnel la tiene, si no la que analiza, si no «oferta nueva» del funnel; sin
 * funnel conocido, las sueltas. `tests/offer-v2-pantalla.test.ts` la cruza contra `construirArbol`.
 *
 * No se importa `construirArbol` en el navegador: arma el árbol ENTERO desde las filas de la base
 * (funnels, ligas, ofertas), que la pantalla no tiene, y traería el motor entero (lib/offer-reglas.ts,
 * con el diagnóstico de fase) por una regla de una línea. Por eso el test diferencial.
 */
export function conSesionEnArbol(a: ArbolOffer, s: Pick<OfferSesionVista, 'id' | 'funnelId' | 'ofertaGuardadaId' | 'ofertaBaseId'>, r: OfferSesionResumen): ArbolOffer {
  const sin = (l: OfferSesionResumen[]) => l.filter((x) => x.id !== s.id);
  const con = (l: OfferSesionResumen[]) => masNuevasPrimero([r, ...sin(l)]);
  const funnel = s.funnelId == null ? undefined : a.funnels.find((f) => f.id === s.funnelId);
  const deLaOferta = (id: number | null) => (funnel && id != null ? funnel.ofertas.find((o) => o.id === id) : undefined);
  const oferta = deLaOferta(s.ofertaGuardadaId) ?? deLaOferta(s.ofertaBaseId);
  return {
    funnels: a.funnels.map((f) => ({
      ...f,
      ofertas: f.ofertas.map((o) => ({ ...o, sesiones: o === oferta ? con(o.sesiones) : sin(o.sesiones) })),
      sesionesNuevas: f === funnel && !oferta ? con(f.sesionesNuevas) : sin(f.sesionesNuevas),
    })),
    sueltas: funnel ? sin(a.sueltas) : con(a.sueltas),
  };
}

// ── Las secciones del desplegable ────────────────────────────────────────────

/**
 * Los títulos de UN nivel, sin repetidos: el Dropdown navega por título, así que dos iguales
 * abrirían siempre el primero. El segundo pasa a «Nombre (2)». Un nombre vacío toma el respaldo.
 */
export function titulosUnicos(nombres: readonly string[], respaldo: string, reservados: readonly string[] = []): string[] {
  const usados = new Set(reservados);
  return nombres.map((n) => {
    const base = n.trim() || respaldo;
    let t = base;
    for (let i = 2; usados.has(t); i++) t = `${base} (${i})`;
    usados.add(t);
    return t;
  });
}

// (Acá estaban `seccionesDelArbol` y el renglón de cada conversación del desplegable: se fueron con él el 29/10/2026. La
// lista y las plantillas que lo reemplazan están al final: `renglonesDeOffer` y `plantillasDeOffer`.)

// ── Lo que dice el botón ─────────────────────────────────────────────────────

/**
 * El CAMINO de la conversación abierta, para el botón del selector: el funnel en grande y, al lado,
 * la oferta que se analiza o la que se está armando. Sale de la conversación (no del árbol): así
 * dice lo correcto aunque el árbol todavía no la tenga.
 */
export function caminoDeSesion(s: Pick<OfferSesionVista, 'funnelId' | 'funnelNombre' | 'ofertaBaseNombre' | 'modo' | 'titulo'>): { funnel: string; oferta: string } {
  const funnel = s.funnelId == null ? TITULO_SUELTAS : (s.funnelNombre?.trim() || 'Funnel');
  const oferta = (s.modo === 'analizar' ? s.ofertaBaseNombre?.trim() : '') || s.titulo?.trim() || 'Nueva oferta';
  return { funnel, oferta };
}

// ── La tab dentro de la pantalla de Create (29/10/2026) ───────────────────────
// Martín, 29/10/2026: «También en offer pon el mismo sistema de la sidebar, en lugar del desplegable actual... Y sin otras
// tabs, incluso en SuperAdmin». El desplegable en árbol se fue: las conversaciones son la LISTA de la tarjeta del chat
// (app/_crear/PantallaCrear.tsx, la «←») y crear o analizar es «Nueva oferta», con una plantilla por funnel y por oferta.

/** Un renglón de la lista: una conversación, con el funnel al lado cuando hay más de uno (si no, sobra). */
export type RenglonOffer = { id: string; nombre: string; cuando: number | null; valor: string };

const msDe = (iso: string): number | null => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };

/** Todas las conversaciones, la más nueva arriba, con el nombre que se reconoce («Mentoría · Funnel principal»). */
export function renglonesDeOffer(a: ArbolOffer): RenglonOffer[] {
  const variosFunnels = a.funnels.length + (a.sueltas.length ? 1 : 0) > 1;
  const conFunnel = (s: OfferSesionResumen, funnel: string) => ({ s, funnel });
  const todas = [
    ...a.funnels.flatMap((f) => [...f.ofertas.flatMap((o) => o.sesiones), ...f.sesionesNuevas].map((s) => conFunnel(s, f.nombre.trim() || 'Funnel sin nombre'))),
    ...a.sueltas.map((s) => conFunnel(s, TITULO_SUELTAS)),
  ];
  return todas
    .sort((x, y) => (msDe(y.s.updatedAt) ?? 0) - (msDe(x.s.updatedAt) ?? 0))
    .map(({ s, funnel }) => {
      const titulo = s.titulo?.trim() || 'Oferta sin título';
      return { id: String(s.id), nombre: variosFunnels ? `${titulo} · ${funnel}` : titulo, cuando: msDe(s.updatedAt), valor: valorSesion(s.id) };
    });
}

/** Una plantilla de «Nueva oferta»: crear una en un funnel, o analizar una oferta que el funnel ya tiene. */
export type PlantillaOffer = { id: string; nombre: string; rotulo: string };

export function plantillasDeOffer(a: ArbolOffer): PlantillaOffer[] {
  // Dos funnels que se llaman igual se distinguen con «(2)», como las conversaciones (`titulosUnicos`).
  const funnels = titulosUnicos(a.funnels.map((f) => f.nombre), 'Funnel sin nombre');
  const crudas = a.funnels.flatMap((f, i) => {
    const funnel = funnels[i];
    const ofertas = [...f.ofertas.filter((o) => o.principal), ...f.ofertas.filter((o) => !o.principal)];
    return [
      { id: valorNueva(f.id, null), nombre: 'Crear una oferta nueva', rotulo: funnel },
      ...ofertas.map((o) => ({ id: valorNueva(f.id, o.id), nombre: `Analizar «${o.nombre.trim() || 'Oferta sin nombre'}»`, rotulo: funnel })),
    ];
  });
  // OF1 del recorrido visual (30/10/2026): con dos funnels, dos tarjetas se llamaban «Crear una oferta nueva» y lo que las
  // distinguía era el rótulo, un texto chiquito adentro del cuadro. El nombre que se repite lleva su funnel al lado, como en
  // la lista de conversaciones («a · Coaching», `renglonesDeOffer`); el que no se repite queda corto.
  const veces = new Map<string, number>();
  for (const p of crudas) veces.set(p.nombre, (veces.get(p.nombre) ?? 0) + 1);
  const nombres = titulosUnicos(crudas.map((p) => ((veces.get(p.nombre) ?? 0) > 1 ? `${p.nombre} · ${p.rotulo}` : p.nombre)), 'Oferta');
  return crudas.map((p, i) => ({ ...p, nombre: nombres[i] }));
}

/**
 * El funnel donde nace una oferta que se pide escribiendo en «¿Qué vas a crear hoy?»: el de la conversación abierta, si
 * tiene; si no, el primero (el principal del negocio llega primero del server). null = no hay funnels.
 */
export function funnelParaPedido(a: ArbolOffer, abierta: Pick<OfferSesionVista, 'funnelId'> | null): number | null {
  if (abierta?.funnelId != null && a.funnels.some((f) => f.id === abierta.funnelId)) return abierta.funnelId;
  return a.funnels[0]?.id ?? null;
}
