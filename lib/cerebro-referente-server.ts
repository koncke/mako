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

import { readFile } from 'node:fs/promises';
import path from 'node:path';
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

type ClaseDelIndice = { t: string; v: string };

/** Las clases de un curso por su slug, listas para leerles la transcripción. */
export function clasesDelIndice(slug: string): CursoParaLeer {
  const lista = (CLASES_POR_CURSO as Record<string, ClaseDelIndice[]>)[slug] ?? [];
  return { clases: lista.map((c) => ({ titulo: c.t, videoId: c.v })) };
}

/** Lo que hace falta de un curso para leerlo. Se le pasa ya cargado: este módulo no importa cursos. */
export type CursoParaLeer = {
  // ⚠️ `| null` Y NO SÓLO `| undefined`: el `Clase` del repo declara estos campos como
  // `string | null`, y con `?: string` el tipo de un `Curso` de verdad NO entra acá. Lo cazó el tsc
  // acotado antes de subirlo (`Argument of type 'Curso' is not assignable to 'CursoParaLeer'`).
  clases: ReadonlyArray<{ titulo?: string | null; videoId?: string | null }>;
};

const CARPETA_TX = path.join(process.cwd(), 'public', 'cono-tx');

/**
 * El texto de UNA clase, o `null` si no hay transcripción.
 *
 * ⚠️ Un `videoId` que no existe NO es un error: hay clases sin transcribir, y la capa tiene que
 * poder armarse igual con las que sí están. Fallar acá dejaría al gurú entero sin Second Brain por
 * una clase suelta.
 */
export async function textoDeClase(videoId: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(videoId)) return null;
  try {
    // ⚠️ EN PRODUCCIÓN EL ARCHIVO NO ESTÁ EN EL DISCO DE LA FUNCIÓN (3/11/2026). `public/cono-tx`
    // son 164 MB en 9.719 archivos: leídos con `readFile` desde acá, el trazado los metía en TODAS
    // las funciones (217 MB hasta `/api/promo-entrada`) y el deploy se cortó por el tope de 250 MB.
    // next.config.ts los excluye del trazado; en producción se leen del CDN, que los sirve igual.
    const crudo = await readFile(path.join(CARPETA_TX, `${videoId}.json`), 'utf8').catch(async () => {
      const r = await fetch(`${APP_BASE_URL}/cono-tx/${videoId}.json`, { cache: 'force-cache' });
      if (!r.ok) throw new Error(`cono-tx ${r.status}`);
      return r.text();
    });
    const leido: unknown = JSON.parse(crudo);
    // El archivo es una LISTA de strings (los tramos del video). También se acepta un string suelto
    // por si alguna vez se guardó así: lo que no se acepta es adivinar sobre otra forma.
    if (typeof leido === 'string') return leido.trim() || null;
    if (!Array.isArray(leido)) return null;
    const texto = leido.filter((t): t is string => typeof t === 'string').join(' ').replace(/\s+/g, ' ').trim();
    return texto || null;
  } catch {
    return null;
  }
}

/** Las clases de un curso, con su texto completo y en el orden del curso. Las que no tienen transcripción quedan afuera. */
export async function clasesDelCurso(curso: CursoParaLeer): Promise<ClaseDeCurso[]> {
  const pedidos = curso.clases.map(async (c, i) => {
    const videoId = (c.videoId ?? '').trim();
    if (!videoId) return null;
    const texto = await textoDeClase(videoId);
    if (!texto) return null;
    return { videoId, titulo: (c.titulo ?? '').trim() || `Clase ${i + 1}`, orden: i + 1, texto };
  });
  return (await Promise.all(pedidos)).filter((c): c is ClaseDeCurso => c != null);
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

/** La capa de un referente, leída una sola vez por proceso. */
export function cerebroDeReferenteMemo(r: ReferenteDelCerebro, curso: CursoParaLeer): Promise<Cerebro<string>> {
  const ya = memoria.get(r.id);
  if (ya) return ya;
  // Se guarda la PROMESA, no el resultado: dos turnos a la vez no pueden disparar dos lecturas.
  // Y si la lectura falla, se saca para que el próximo turno lo vuelva a intentar en vez de
  // quedarse con un error cacheado para siempre.
  const p = cerebroDeReferente(r, curso).catch((e) => { memoria.delete(r.id); throw e; });
  memoria.set(r.id, p);
  return p;
}

// ── DÓNDE SE CUELGA, Y POR QUÉ NO LLEVA EL HEURÍSTICO DE KNOWLEDGE ───────────────────────────────
//
// El punto de enganche es `lib/cerebro-para-chat.ts` (`armar`), con `conCapa` — el mismo que usan
// Knowledge y «Lo que hace MaKo».
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
