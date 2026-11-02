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
import { armarReferente, type ClaseDeCurso, type ReferenteDelCerebro } from './cerebro-referente';
import type { Cerebro } from './cerebro-modelo';

/** Lo que hace falta de un curso para leerlo. Se le pasa ya cargado: este módulo no importa cursos. */
export type CursoParaLeer = {
  clases: ReadonlyArray<{ titulo?: string; videoId?: string }>;
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
    const crudo = await readFile(path.join(CARPETA_TX, `${videoId}.json`), 'utf8');
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
