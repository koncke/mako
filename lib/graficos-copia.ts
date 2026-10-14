// =============================================================================
// graficos-copia — COPIAR un dashboard (una hoja del informe) y pasarlo con un TOKEN, y lo que viaja en él
// =============================================================================
// Pedido de Martín (12/10/2026, por el chat Chatbot), textual: «pasale la sección de "¿Qué vamos a hacer hoy?" al chat
// de graphics para que lo implemente tal cual en lo que se tiene hoy de "Pídeselo a MaKo". Tiene que ser funcional, es
// decir, que los dashboards también deberían poder copiarse y enviarse con ese token».
//
// Es el mismo patrón que «Copiar flujo» de Automations (lib/flujo-copia.ts, mig 0265): el ⋮ de una hoja tiene «Copiar
// dashboard», el server guarda la copia en `dashboard_copias` (mig 0268, lib/graficos-copia-server.ts) y al
// portapapeles va un token corto («MAKO-DASH-…»). Pegarlo en la caja de «Nueva hoja» dice «Dashboard copiado:
// <nombre>» y el ↑ lo agrega al informe de quien pega, en su negocio.
//
// LO QUE VIAJA ES LA DEFINICIÓN, NUNCA LOS DATOS NI LAS PERSONAS (la nota del relevo, docs/relevo/dashboard.md):
//   · Una hoja no tiene datos: tiene gráficos (qué conjunto, qué métricas, qué dimensión), filtros, textos, secciones
//     y su estilo. Los números los lee el negocio que la abre, con lo suyo.
//   · AL COPIAR (`hojaParaCopiar`): un filtro sobre un campo que NO es público (`dimensionPublica`, la misma lista
//     POSITIVA del AI Analyst y del link compartido) se vacía. Sus valores son nombres de personas (un closer, un
//     setter, un cliente) y el token lo lee cualquiera que lo tenga.
//   · AL PEGAR EN OTRO NEGOCIO (`hojaParaOtroNegocio`): los valores de un filtro PARA MIRAR que no sean de un
//     vocabulario fijo (`Dimension.valores`: las prioridades, la madurez, «Sí/No») son cosas del negocio que copió
//     (una campaña, un producto, una página) y allá no existen: un filtro así deja el gráfico en CERO sin decir nada.
//     Se vacían, y se avisa cuántos. ⚠️ Los de DEFINICIÓN (`fijo`) se quedan: definen la tarjeta (la KPI de R1 es R1,
//     y «R1» no es de ningún negocio), y si uno nombra algo del otro negocio, el título de la tarjeta lo dice.
//   · Pegar en el MISMO negocio no vacía nada más (sólo lo de las personas, que ya salió al copiar).
//
// Y lo pegado entra con TODOS los ids nuevos (`hojaConIdsNuevos`): con los de la hoja de origen, pegarla dos veces
// compartiría lo elegido mirando, y en el mismo negocio una caja de «Conclusiones de MaKo» leería las conclusiones de
// la hoja original (se guardan por id del elemento). «Duplicar» una hoja usa la misma función.
//
// Puro y sin `server-only`: lo usan la pantalla (reconocer un token pegado, los ids nuevos), la ruta y el test.
// =============================================================================

import { campoDe, dimensionDe, fuenteDe, nuevoId, sanearHoja, type Componente, type ControlVista, type Hoja } from './graficos-catalogo';
import { dimensionPublica } from './graficos-analisis';
import { sacarToken, tokenDeBytesCon, tokenEnTexto } from './token-copia';

// ── El token ────────────────────────────────────────────────────────────────────────────────────

/** El comienzo de todo token de un dashboard (dice qué es, también en un WhatsApp). El check de la mig 0268 es éste. */
export const PREFIJO_TOKEN_DASH = 'MAKO-DASH-';
export const tokenDashDeBytes = (bytes: ArrayLike<number>): string => tokenDeBytesCon(PREFIJO_TOKEN_DASH, bytes);
/** El token de un dashboard que hay en un texto (pegado solo o en una frase), normalizado. Si no, null. */
export const tokenDashDeTexto = (texto: unknown): string | null => tokenEnTexto(PREFIJO_TOKEN_DASH, texto);
/** LO PEGADO EN LA CAJA: ¿trae un dashboard? El token sale del texto; lo demás que se escribió queda. */
export const dashPegado = (texto: string): { token: string; resto: string } | null => sacarToken(PREFIJO_TOKEN_DASH, texto);

/** Lo que dice la caja en lugar del token (como «Flujo copiado: <nombre>» de Automations). */
export const rotuloDashPegado = (nombre: string): string => `Dashboard copiado: ${nombre}`;
/** El nombre con que se lo nombra al pegarlo: el emoji y el título de la hoja. */
export const nombreDeHoja = (h: Pick<Hoja, 'nombre' | 'emoji'>): string => (h.emoji ? `${h.emoji} ${h.nombre}` : h.nombre);

/** El aviso (toast) de lo que se vació, o null. Corto: «2 filtros vaciados». */
export const avisoDeVaciados = (n: number): string | null => (n > 0 ? (n === 1 ? '1 filtro vaciado' : `${n} filtros vaciados`) : null);

// ── Los filtros: qué se queda y qué se vacía ────────────────────────────────────────────────────

/** Cada control de la hoja (la barra, cada gráfico y cada gráfico de un pop-up), pasado por `f`. */
function conControles(h: Hoja, f: (c: ControlVista) => ControlVista): Hoja {
  const enComponentes = (cs: readonly Componente[]): Componente[] => cs.map((c) => {
    if (c.clase !== 'grafico') return c;
    const g = { ...c, controles: c.controles.map(f) };
    return g.popup ? { ...g, popup: { ...g.popup, componentes: enComponentes(g.popup.componentes) } } : g;
  });
  return { ...h, controles: h.controles.map(f), componentes: enComponentes(h.componentes) };
}

/** ¿El control elige algo de un campo? (Un período o un «agrupar por» no nombran nada del negocio.) */
const eligeAlgo = (c: ControlVista): boolean =>
  (c.tipo === 'lista' && !!c.valores?.length) || (c.tipo === 'texto' && c.texto.trim() !== '');

/** El campo es PÚBLICO si lo es en TODOS sus conjuntos (en positivo: un campo que no existe, no lo es). */
function campoPublico(campoId: string | null): boolean {
  const campo = campoDe(campoId);
  if (!campo) return false;
  const en = Object.entries(campo.en);
  return en.length > 0 && en.every(([f, d]) => dimensionPublica(f, d));
}

/**
 * El vocabulario FIJO del campo (los valores que no son de ningún negocio: `Dimension.valores`), o null si en alguno
 * de sus conjuntos no lo tiene. En positivo: sólo lo que el catálogo declara fijo cruza de negocio.
 */
function vocabularioFijo(campoId: string | null): ReadonlySet<string> | null {
  const campo = campoDe(campoId);
  if (!campo) return null;
  let comun: Set<string> | null = null;
  for (const [f, d] of Object.entries(campo.en)) {
    const fuente = fuenteDe(f);
    const valores = fuente ? dimensionDe(fuente, d)?.valores : undefined;
    if (!valores?.length) return null;
    const estos = new Set<string>(valores);
    const previo: Set<string> | null = comun;
    comun = previo ? new Set<string>([...previo].filter((v: string) => estos.has(v))) : estos;
  }
  return comun;
}

/**
 * LA HOJA QUE SE GUARDA DETRÁS DEL TOKEN: sin los valores de los filtros sobre personas (de mirar o de definición).
 * `vaciados` = cuántos filtros perdieron algo (se le avisa a quien pega).
 */
export function hojaParaCopiar(h: Hoja): { hoja: Hoja; vaciados: number } {
  let vaciados = 0;
  const hoja = conControles(h, (c) => {
    if (!eligeAlgo(c) || campoPublico(c.campo)) return c;
    vaciados++;
    return { ...c, valores: null, texto: '' };
  });
  return { hoja, vaciados };
}

/**
 * LA HOJA PEGADA EN OTRO NEGOCIO: los filtros PARA MIRAR se quedan sólo con lo del vocabulario fijo; una búsqueda por
 * texto se vacía (lo que se buscaba es del otro negocio). Los de definición (`fijo`) no se tocan (ver el encabezado).
 */
export function hojaParaOtroNegocio(h: Hoja): { hoja: Hoja; vaciados: number } {
  let vaciados = 0;
  const hoja = conControles(h, (c) => {
    if (c.fijo || !eligeAlgo(c)) return c;
    if (c.tipo === 'texto') { vaciados++; return { ...c, texto: '' }; }
    const fijo = vocabularioFijo(c.campo);
    const quedan = (c.valores ?? []).filter((v) => fijo?.has(v));
    if (quedan.length === (c.valores ?? []).length) return c;
    vaciados++;
    return { ...c, valores: quedan.length ? quedan : null };
  });
  return { hoja, vaciados };
}

// ── Los ids nuevos ──────────────────────────────────────────────────────────────────────────────

/**
 * La hoja con TODO lo que tiene id acuñado de nuevo: ella, sus controles, sus componentes (y los controles y el pop-up
 * de cada gráfico, con lo de adentro) y sus conectores. Lo que APUNTA a un id lo sigue al nuevo: los conectores
 * (`desde`/`hasta`) y lo que lee una caja de «Conclusiones de MaKo» (`ia.fuentes`). Un conector a un id que no está se
 * cae, como en el saneo. `nombre`: el de la copia («(copia)» al duplicar); sin esto, el mismo.
 * ⚠️ Antes «Duplicar» re-acuñaba los ids de los gráficos y NO seguía `ia.fuentes`: el saneo podaba las fuentes que
 *    ya no estaban y la caja de la copia pasaba a no leer ningún gráfico (`[]` = «se borraron»), sin un error.
 */
export function hojaConIdsNuevos(h: Hoja, nombre?: string): Hoja {
  const nuevoDe = new Map<string, string>();
  const acunar = (viejo: string): string => { const n = nuevoId(); nuevoDe.set(viejo, n); return n; };
  const controles = (cs: readonly ControlVista[]) => cs.map((c) => ({ ...c, id: nuevoId() }));
  // Primero los ids (en los dos niveles), después lo que apunta a ellos: una caja puede leer un gráfico que está
  // después de ella en la lista.
  const conIds = (cs: readonly Componente[]): Componente[] => cs.map((c) => {
    const id = acunar(c.id);
    if (c.clase === 'elemento') return { ...c, id };
    const base = { ...c, id, controles: controles(c.controles) };
    return c.clase === 'grafico' && c.popup ? { ...base, popup: { ...c.popup, componentes: conIds(c.popup.componentes) } } as Componente : base;
  });
  const seguir = (cs: readonly Componente[]): Componente[] => cs.map((c) => {
    if (c.clase === 'elemento' && c.ia?.fuentes) return { ...c, ia: { ...c.ia, fuentes: c.ia.fuentes.map((id) => nuevoDe.get(id) ?? id) } };
    if (c.clase === 'grafico' && c.popup) return { ...c, popup: { ...c.popup, componentes: seguir(c.popup.componentes) } };
    return c;
  });
  const componentes = seguir(conIds(h.componentes));
  const conectores = (h.conectores ?? []).flatMap((k) => {
    const desde = nuevoDe.get(k.desde), hasta = nuevoDe.get(k.hasta);
    return desde && hasta ? [{ ...k, id: nuevoId(), desde, hasta }] : [];
  });
  const copia: Hoja = { ...h, id: nuevoId(), nombre: (nombre ?? h.nombre).slice(0, 40), controles: controles(h.controles), componentes };
  if (conectores.length) copia.conectores = conectores;
  else delete copia.conectores;
  return copia;
}

// ── Lo que se guarda detrás del token ───────────────────────────────────────────────────────────

/** Una hoja que llega por la red (al copiar, o leída de la tabla): pasa por el saneo de siempre. null = no es una hoja. */
export function hojaDeCopia(raw: unknown): Hoja | null {
  const h = sanearHoja(raw, 0);
  return h && (h.componentes.length || h.controles.length) ? h : null;
}
