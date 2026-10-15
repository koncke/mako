// =============================================================================
// editor-landing/diagnostico-guardado — lo PURO del análisis de una landing NUESTRA (tanda 6)
// =============================================================================
// Pendientes de la tanda 2 que se cierran en la tanda 6 (docs/hallazgos-editor-landing.md, «Lo que quedó
// sin hacer (tanda 2)»): «Sólo se analiza la página de inicio y el puntaje de una landing nuestra no se
// guarda». Y uno de las piezas de la tanda 6: una landing nuestra ignoraba la lectura del navegador
// (el pedido de Martín del 14/10/2026: «El mimso error que nos saltaba con Mauricio "No pude leer el
// texto de esa página.". Soluciona eso...»).
//
// Lo usa diagnostico-server.ts, que es `server-only` y no lo importa ningún test. Acá vive lo que se
// puede probar sin base ni IA:
//   · el PUNTAJE que se guarda en `landing_docs.diagnostico` (mig 0281) y cómo se vuelve a leer
//     (`aColumna` / `deColumna`), y cómo se reconoce que esa migración todavía no se aplicó
//     (`esColumnaQueFalta`);
//   · el texto de TODAS las páginas (`textoDeLanding`), cada una con su renglón «— Página «X» —», y la
//     página donde vive una sección (`paginaDeSeccion`);
//   · lo que la PANTALLA necesita para mostrar todas las páginas (verificación de la tanda 6: miraba sólo
//     la de inicio): su orden (`paginasEnOrden`), sus secciones para ubicar una cita (`bloquesDeLanding`)
//     y la vista con un rótulo por página (`htmlDeVistaDiagnostico`);
//   · la página que va al análisis (`paginaDeNuestra`), con lo que el navegador probó si lo hay.
// Sin server-only ni imports de node: lo importan el server, la pantalla y los tests.
// =============================================================================

import { tarjetasDe, type LandingContenido, type Pagina } from './doc';
import {
  bloquesDeTexto, contarPalabras, paginaPrincipal, resumenDeAnalisis, textoParaAnalisis,
  type BloqueTexto, type ResumenDiagnostico,
} from './diagnostico';
import { TOPES_LECTURA } from './lectura-reglas';
import type { Lectura } from './lectura-tipos';
import type { LandingExtraida } from '../landing-extraer';

// ─────────────────────────────────────────────────────────────────────────────
// El puntaje guardado (landing_docs.diagnostico, mig 0281)
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que se escribe en `landing_docs.diagnostico`: el veredicto saneado y cuándo se analizó. */
export type ColumnaDiagnostico = { score: number | null; veredicto: string | null; resumen: string | null; analyzed_at: string };

/**
 * El veredicto del modelo, listo para la columna. Pasa por `resumenDeAnalisis` (diagnostico.ts) ANTES
 * de guardar: la escala es la del Landing Analyst (0-10 con una décima) y un score que no se puede
 * leer queda null, nunca un número inventado («7/100», tanda 2).
 */
export function aColumna(analysis: unknown, fecha: string): ColumnaDiagnostico {
  const r = resumenDeAnalisis(analysis, fecha);
  return { score: r.score, veredicto: r.veredicto, resumen: r.resumen, analyzed_at: fecha };
}

/**
 * Lo guardado, como lo muestra el panel; null si no hay nada que mostrar (nunca se diagnosticó, o la
 * fila trae otra cosa). Se vuelve a sanear al leer: el jsonb no tiene CHECK (ver la 0281).
 */
export function deColumna(raw: unknown): ResumenDiagnostico | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const a = raw as Record<string, unknown>;
  const fecha = typeof a.analyzed_at === 'string' && Number.isFinite(Date.parse(a.analyzed_at)) ? a.analyzed_at : null;
  const r = resumenDeAnalisis(a, fecha);
  return r.score === null && !r.veredicto && !r.resumen ? null : r;
}

/**
 * ¿El error dice que la columna `diagnostico` no existe (la 0281 sin aplicar)? PostgREST contesta
 * DISTINTO según la operación: 42703 al LEERLA en un select y PGRST204 al ESCRIBIRLA en un update
 * («Could not find the 'diagnostico' column … in the schema cache»). Mirar sólo el 42703 dejaba el
 * update tirando con la migración pendiente. Cualquier otro error (la red, un permiso) NO es esto.
 */
export function esColumnaQueFalta(e: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!e) return false;
  const code = String(e.code ?? '');
  if (code === '42703' || code === 'PGRST204') return true;
  const m = String(e.message ?? '');
  return /diagnostico/.test(m) && /does not exist|could not find|schema cache/i.test(m);
}

// ─────────────────────────────────────────────────────────────────────────────
// El texto de TODAS las páginas
// ─────────────────────────────────────────────────────────────────────────────

/** El renglón que separa una página de la otra en el texto que lee el modelo. */
export const renglonDePagina = (titulo: string): string => `— Página «${titulo}» —`;

/** El nombre de una página: su título, o su ruta, o «Inicio». */
export const tituloDePagina = (p: Pagina): string => (typeof p.titulo === 'string' && p.titulo.trim()) || (p.ruta ? `/${p.ruta}` : 'Inicio');

/**
 * Las páginas en el orden en que se leen: la de inicio primero y después las demás en su orden. Es el
 * orden del texto que lee el modelo (`textoDeLanding`), y el de la vista del Diagnóstico: el recorrido
 * y «Aplicar todos» van de arriba hacia abajo de ESTA lista (verificación de la tanda 6: la pantalla
 * miraba sólo la de inicio y los comentarios de las otras salían «Sin ubicar»).
 */
export function paginasEnOrden(c: LandingContenido | null | undefined): Pagina[] {
  const todas = Array.isArray(c?.paginas) ? c.paginas.filter((p): p is Pagina => !!p && typeof p === 'object') : [];
  const inicio = paginaPrincipal(c);
  return inicio ? [inicio, ...todas.filter((p) => p !== inicio)] : todas;
}

/**
 * Las secciones con texto de TODAS las páginas, sin tope: para UBICAR una cita (el contexto de
 * «Preguntar a MaKo», los comentarios que pasan a una copia). El tope de `textoDeLanding` es de lo que
 * lee el modelo; ubicar no cuesta nada y una sección editada después puede haber cambiado de largo.
 */
export const bloquesDeLanding = (c: LandingContenido | null | undefined): BloqueTexto[] => paginasEnOrden(c).flatMap((p) => bloquesDeTexto(p));

/** Un texto para un atributo HTML (el título de una página lo escribió la persona). */
const enAtributo = (t: string): string => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * La vista del Diagnóstico de una landing nuestra: TODAS sus páginas, una debajo de la otra en el orden
 * de `paginasEnOrden`, y con más de una, cada una con su rótulo. Así cada comentario se ubica en su
 * página sin cambiar de vista (el recorrido mide posiciones en UN lienzo). El rótulo va en un atributo
 * y lo dibuja el CSS (`::before`): no es un nodo de texto, y una cita nunca se ubica en él.
 */
export function htmlDeVistaDiagnostico(paginas: readonly Pagina[], html: (p: Pagina) => string): string {
  if (paginas.length < 2) return paginas.length ? html(paginas[0]) : '';
  return paginas.map((p) => `<div class="gdg-pagina" data-titulo="${enAtributo(tituloDePagina(p))}"></div>${html(p)}`).join('');
}

export type TextoDeLanding = {
  /** Las secciones visibles de todas las páginas que entraron, en orden: con esto se ubica cada cita. */
  bloques: BloqueTexto[];
  /** Lo que lee el modelo: cada página con su renglón (si hay más de una con texto). */
  texto: string;
  /** Las palabras del COPY (sin los renglones de página): el piso del análisis y el meta las cuentan. */
  palabras: number;
  /** Cuántas páginas entraron y cuántas quedaron afuera por el tope. */
  paginas: number;
  afuera: number;
};

/**
 * El copy de una landing nuestra para el análisis: la página de inicio primero y después las demás en
 * su orden, cada una precedida por «— Página «<título>» —» para que el modelo sepa dónde está cada cosa
 * (una landing de una sola página sale igual que antes, sin el renglón). Las citas se siguen ubicando
 * con `ubicarCitaEnBloques` sobre `bloques`: los ids de sección son únicos en TODA la landing
 * (`sanearTarjeta`, validar.ts, regenera el repetido).
 *
 * `tope`: las páginas enteras que no entran se quedan afuera (la de inicio entra siempre). Es el mismo
 * tope que el texto de una lectura del navegador: lo que el análisis ya acepta de una página de afuera.
 */
export function textoDeLanding(c: LandingContenido | null | undefined, tope: number = TOPES_LECTURA.texto): TextoDeLanding {
  const conTexto = paginasEnOrden(c).map((p) => ({ p, bs: bloquesDeTexto(p) })).filter((x) => x.bs.length > 0);
  const varias = conTexto.length > 1;
  const bloques: BloqueTexto[] = [];
  const partes: string[] = [];
  let largo = 0;
  let afuera = 0;
  for (const { p, bs } of conTexto) {
    const parte = `${varias ? `${renglonDePagina(tituloDePagina(p))}\n\n` : ''}${textoParaAnalisis(bs)}`;
    if (partes.length && largo + parte.length > tope) { afuera++; continue; }
    partes.push(parte);
    bloques.push(...bs);
    largo += parte.length + 2;
  }
  return { bloques, texto: partes.join('\n\n'), palabras: contarPalabras(textoParaAnalisis(bloques)), paginas: partes.length, afuera };
}

/**
 * La página donde vive una sección (por su id), o null. Con el análisis de todas las páginas, un
 * comentario puede ser de una que no es la de inicio: el recorrido la abre antes de señalar.
 */
export function paginaDeSeccion(c: LandingContenido | null | undefined, seccionId: string | null | undefined): Pagina | null {
  if (!seccionId) return null;
  const ps = Array.isArray(c?.paginas) ? c.paginas : [];
  return ps.find((p) => !!p?.doc && tarjetasDe(p).some((t) => t.attrs?.id === seccionId)) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// La página que va al análisis
// ─────────────────────────────────────────────────────────────────────────────

export type DatosDeNuestra = {
  titulo: string;
  seoTitulo?: string;
  seoDescripcion?: string;
  /** La URL publicada, normalizada; null = un borrador sin publicar. */
  url: string | null;
  texto: string;
  palabras: number;
  /** Lo que leyó el navegador de la persona (ya saneado con `sanearLectura`), si lo hay. */
  lectura?: Pick<Lectura, 'interacciones'> | null;
};

/**
 * El `LandingExtraida` de una landing nuestra para `analizarCopy`. El TEXTO sale siempre del documento
 * (lo que el editor guarda es la verdad, no lo que dibujó una página); la lectura del navegador sólo
 * suma lo que se PROBÓ (a dónde lleva cada botón, si el calendario cargó), que el `meta` del análisis
 * ya sabe decir (landing-analyst.ts, `buildUserPrompt`). Antes la lectura se tiraba sin mirarla.
 */
export function paginaDeNuestra(d: DatosDeNuestra): LandingExtraida {
  const donde = d.url ?? `Borrador sin publicar: «${d.titulo}»`;
  return {
    url: donde,
    urlFinal: donde,
    titulo: d.seoTitulo || d.titulo,
    descripcion: d.seoDescripcion ?? '',
    bloques: [],
    texto: d.texto,
    palabras: d.palabras,
    htmlBytes: 0,
    fetchMs: 0,
    // El texto salió del documento, no de una página que no se pudo leer.
    bloqueada: false,
    ...(d.lectura ? { leidaEnNavegador: { interacciones: d.lectura.interacciones } } : {}),
  };
}
