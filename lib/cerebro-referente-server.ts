import 'server-only';

// =============================================================================
// cerebro-referente-server — leer el curso entero de un gurú del disco (2/11/2026)
// =============================================================================
// La parte que toca archivos de la capa de un referente. Lo PURO —armar el grafo— vive en
// `lib/cerebro-referente.ts` y se puede probar; esto no, y por eso es lo más chico posible.
//
// ⚠️ LA TRANSCRIPCIÓN NO ESTÁ EN EL ARCHIVO DEL CURSO, y es la trampa que más tiempo me costó.
// `app/conocimientos/curso-*.ts` trae `transcripcion: []` y `resumen: ''` A PROPÓSITO: su propio
// comentario lo dice —«la transcripción cruda no viaja en el bundle»—. El texto vive en
// `public/cono-tx/<videoId>.json`, y ese JSON es una **LISTA de strings**, no un string.
//
// ⚠️ UN CURSO PUEDE TENER 740 KB. Para la FICHA se eligen cuatro o cinco clases del método; para
// ESTA CAPA se leen TODAS. Son dos pasos distintos sobre el mismo curso y confundirlos fue mi error
// (docs/pendientes-martin.md).
//
// MEDIDO EL 2/11/2026 contra los dos referentes que ya están cargados, leyendo los archivos de
// verdad —no suponiendo—:
//   · Emilio Puigrredón («Social Funnel»):      11 clases, 11 con transcripción,  78.695 caracteres
//   · Julián Alborna («Inteligencia Viral»):    41 clases, 41 con transcripción, 742.094 caracteres
// Ninguna clase sin transcribir. Y esos 742 KB son exactamente la razón por la que esto NO puede ir
// en la ficha: ahí viajaría en CADA mensaje de cada chat.
// =============================================================================

import { APP_BASE_URL } from './app-url';
import { armarReferente, type ClaseDeCurso, type ReferenteDelCerebro } from './cerebro-referente';
import type { Cerebro } from './cerebro-modelo';

/**
 * El índice chico: por slug de curso, sus clases con título y `videoId`.
 *
 * ⚠️ ESTO EXISTE POR UN DEPLOY ROTO, y es el hallazgo que más caro salió. Antes se importaba
 * `@/app/conocimientos/catalogo` para encontrar el curso del gurú, y ese catálogo arrastra los 100+
 * archivos de cursos. Vercel lo rechazó:
 *
 *     The Vercel Function "admin/docs" is 281.43mb uncompressed, exceeds the maximum of 250mb
 *
 * ⚠️ **Y ACTIONS ESTABA EN VERDE.** El límite es del EMPAQUETADO, no de los tipos ni de los tests:
 * CI corre `tsc` y la suite, no `next build` ni el empaquetado de funciones. Un verde en Actions no
 * dice nada sobre el tamaño de un bundle.
 *
 * El JSON son **99 KB** con las 1.158 clases de los 12 referentes. Se regenera con
 * `node scripts/generar-clases-de-referentes.mjs` cuando se suma un referente o cambia su curso.
 */
import CLASES_POR_CURSO from './asesores/clases-de-referentes.json';

type ClaseDelIndice = { t: string; v: string; g?: string };

/** Las clases de un curso por su slug, listas para leerles la transcripción. El módulo es la sección de su Second Brain. */
export function clasesDelIndice(slug: string): CursoParaLeer {
  const lista = (CLASES_POR_CURSO as Record<string, ClaseDelIndice[]>)[slug] ?? [];
  return { clases: lista.map((c) => ({ titulo: c.t, videoId: c.v, modulo: c.g })) };
}

/** Lo que hace falta de un curso para leerlo. Se le pasa ya cargado: este módulo no importa cursos. */
export type CursoParaLeer = {
  // ⚠️ `| null` Y NO SÓLO `| undefined`: el `Clase` del repo declara estos campos como
  // `string | null`, y con `?: string` el tipo de un `Curso` de verdad NO entra acá. Lo cazó el tsc
  // acotado antes de subirlo (`Argument of type 'Curso' is not assignable to 'CursoParaLeer'`).
  clases: ReadonlyArray<{ titulo?: string | null; videoId?: string | null; modulo?: string | null }>;
};

/**
 * ⚠️ SE LEE POR HTTP, DEL CDN, Y NO DEL DISCO (3/11/2026). Dos razones, y las dos fallan en silencio:
 *   · la función de Vercel sólo lleva lo que se IMPORTA (next.config.ts, `outputFileTracingIncludes`:
 *     «un readFileSync no es un import»). `public/` lo sirve el CDN: en producción el `readFile` de antes
 *     podía devolver `null` en cada clase —el `catch` lo traga— y el gurú quedaba sin curso sin un error;
 *   · y si el trazado SÍ siguiera la ruta, arrastraría `public/cono-tx` entero: 187 MB medidos el 3/11,
 *     contra un tope de 250 MB por función. Es el mismo deploy roto del 2/11, por otra puerta.
 * El archivo es público (lo baja el navegador en /conocimientos): pedirlo por URL no expone nada nuevo.
 */
const urlDeClase = (videoId: string): string => `${APP_BASE_URL.replace(/\/+$/, '')}/cono-tx/${videoId}.json`;
const ESPERA_CLASE_MS = 8_000;

/**
 * El texto de UNA clase, o `null` si no hay transcripción.
 *
 * ⚠️ Un `videoId` que no existe NO es un error: hay clases sin transcribir, y la capa tiene que
 * poder armarse igual con las que sí están. Fallar acá dejaría al gurú entero sin Second Brain por
 * una clase suelta.
 */
export async function textoDeClase(videoId: string): Promise<string | null> {
  return (await pedirClase(videoId)) ?? null;
}

/** Las clases que el CDN contestó que no tienen transcripción (un 404): su falta no deja el curso «a medias». */
const sinTranscripcion = new Set<string>();

/** El texto de una clase; `null` si no tiene transcripción (definitivo) y `undefined` si no llegó (un corte: se vuelve a pedir). */
async function pedirClase(videoId: string): Promise<string | null | undefined> {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(videoId)) return null;
  try {
    // ⚠️ SE LEE DEL CDN, NUNCA DEL DISCO (3/11/2026). `public/cono-tx` son 164 MB en 9.719
    // archivos: con un `readFile(path.join(process.cwd(), 'public', 'cono-tx', …))` acá, el
    // empaquetado los metía en TODAS las funciones (217 MB hasta `/api/promo-entrada`) y el deploy
    // se cortó seis horas por el tope de 250 MB. Excluirlos en next.config.ts NO alcanzó: Turbopack
    // ignora `outputFileTracingExcludes` para lo que traza él. La única salida segura es no tocar fs.
    const r = await fetch(urlDeClase(videoId), { signal: AbortSignal.timeout(ESPERA_CLASE_MS), cache: 'force-cache' });
    if (r.status === 404) { sinTranscripcion.add(videoId); return null; }
    if (!r.ok) return undefined;
    const leido: unknown = await r.json();
    // El archivo es una LISTA de strings (los tramos del video). También se acepta un string suelto
    // por si alguna vez se guardó así: lo que no se acepta es adivinar sobre otra forma.
    if (typeof leido === 'string') return leido.trim() || null;
    if (!Array.isArray(leido)) return null;
    const texto = leido.filter((t): t is string => typeof t === 'string').join(' ').replace(/\s+/g, ' ').trim();
    return texto || null;
  } catch {
    return undefined;
  }
}

/** Cuántas clases se piden a la vez: el curso de Marc Verdú tiene 452, y de un saque son 452 conexiones abiertas desde una función. */
const CLASES_A_LA_VEZ = 16;

/** Las clases de un curso, con su texto completo y en el orden del curso. Las que no tienen transcripción quedan afuera. */
export async function clasesDelCurso(curso: CursoParaLeer): Promise<ClaseDeCurso[]> {
  const leidas: Array<ClaseDeCurso | null> = curso.clases.map(() => null);
  let siguiente = 0;
  const leerLasQueSiguen = async () => {
    while (siguiente < curso.clases.length) {
      const i = siguiente++;
      const c = curso.clases[i];
      const videoId = (c.videoId ?? '').trim();
      const texto = videoId ? await textoDeClaseMemo(videoId) : null;
      const modulo = (c.modulo ?? '').trim();
      if (texto) leidas[i] = { videoId, titulo: (c.titulo ?? '').trim() || `Clase ${i + 1}`, orden: i + 1, texto, ...(modulo ? { modulo } : {}) };
    }
  };
  await Promise.all(Array.from({ length: Math.min(CLASES_A_LA_VEZ, curso.clases.length) }, leerLasQueSiguen));
  return leidas.filter((c): c is ClaseDeCurso => c != null);
}

/** La capa lista de un referente: se lee su curso del disco y se arma el grafo. */
export async function cerebroDeReferente(r: ReferenteDelCerebro, curso: CursoParaLeer): Promise<Cerebro<string>> {
  return armarReferente(r, await clasesDelCurso(curso));
}

// ── Memoria por proceso ───────────────────────────────────────────────────────────────────────────
// ⚠️ SIN ESTO, CADA TURNO DE CHAT ABRE 41 ARCHIVOS. El curso de Alborna son 41 clases y 742 KB, y el
// contenido NO cambia entre deploys: es código y archivos del repo, igual que el catálogo de
// Knowledge, que por eso se memoiza en `knowledgeDeMako()`. Una capa por referente, una vez por
// proceso.
const memoria = new Map<string, Promise<Cerebro<string>>>();
const textos = new Map<string, Promise<string | null>>();

/**
 * El texto de una clase, leído una vez por proceso. Lo que NO llegó (un 404, un corte) no se guarda:
 * desde que se lee por HTTP, un tropiezo de red no puede dejar una clase vacía para siempre.
 */
function textoDeClaseMemo(videoId: string): Promise<string | null> {
  const ya = textos.get(videoId);
  if (ya) return ya;
  const p = pedirClase(videoId).then((t) => { if (t === undefined) textos.delete(videoId); return t ?? null; });
  textos.set(videoId, p);
  return p;
}

/** La capa de un referente, leída una sola vez por proceso. */
export function cerebroDeReferenteMemo(r: ReferenteDelCerebro, curso: CursoParaLeer): Promise<Cerebro<string>> {
  const ya = memoria.get(r.id);
  if (ya) return ya;
  // Se guarda la PROMESA, no el resultado: dos turnos a la vez no pueden disparar dos lecturas.
  // Y si la lectura falla, se saca para que el próximo turno lo vuelva a intentar en vez de
  // quedarse con un error cacheado para siempre.
  // ⚠️ Y UN CURSO A MEDIAS TAMPOCO SE GUARDA: con una clase que no llegó, el próximo turno la vuelve a
  // pedir. Las que sí llegaron están en `textos`, así que reintentar cuesta sólo lo que faltó. Una clase SIN
  // transcripción (un 404: dos de Five Stars y dos de Marca Personal 5.0) no es «a medias»: contarla como
  // tal rearmaba esos cursos en cada turno, para siempre.
  const p = cerebroDeReferente(r, curso).then((c) => {
    const esperadas = curso.clases.filter((x) => !sinTranscripcion.has((x.videoId ?? '').trim())).length;
    if (c.nodos.length - 1 < esperadas) memoria.delete(r.id);
    return c;
  }, (e) => { memoria.delete(r.id); throw e; });
  memoria.set(r.id, p);
  return p;
}

// ── DÓNDE SE CUELGA, Y POR QUÉ NO LLEVA EL HEURÍSTICO DE KNOWLEDGE ───────────────────────────────
//
// ⚠️ NO VA EN `armar()` (lib/cerebro-para-chat.ts), aunque así lo decía el tablero: `armar` es el grafo
// del NEGOCIO, en caché por workspace, y el referente es de cada CHAT. Colgado ahí, el curso del chat de
// uno viajaba en el de todos. Entra por dos puertas que sí saben de qué chat se trata: el turno
// (`paqueteParaElTurno`, con el referente que eligió el servidor por `desde.tab`) y la herramienta que
// pide una clase por id (`recuperar_del_segundo_cerebro`: el id `ref:<gurú>:<video>` dice de quién es).
//
// ⚠️ ESTO CORRIGE LO QUE YO MISMO HABÍA ESCRITO EN EL TABLERO («copiar el criterio de Knowledge»).
// Knowledge necesita un heurístico —`esPreguntaDeConocimiento`— porque va en TODOS los negocios y
// los nombres de sus módulos son palabras del negocio: «¿cuál es mi oferta?» no pregunta por el
// método de armar una. La capa de un referente no tiene ese problema: **se cuelga sólo cuando el
// chat TIENE a ese referente al frente**, cosa que el servidor ya sabe (`lib/asesores/contexto.ts`).
// Si el chat es con Alborna, su curso es pertinente por definición; si no lo es, la capa ni se arma.
//
// O sea que el criterio es «¿qué referente tiene este chat?», no «¿de qué habla la pregunta?», y es
// más barato y más exacto. Copiar el heurístico habría sido resolver un problema que acá no existe.
