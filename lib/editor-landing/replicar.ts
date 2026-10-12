// =============================================================================
// editor-landing/replicar — «Replicar en el editor» una landing de AFUERA (tanda 2, puntos 8 y 9)
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2): «si traigo una landing de afuera […] me gustaría si es una
// landing de afuera tener la opción de replicarla con nuestro editor» y «Si se tiene que poder editar
// libremente con "HTML personalizado", esto permitirá copiar otras landing». Decisiones T5/T6 en
// docs/diseno-editor-landing.md. Lo puro (cómo se parte el HTML, qué se saca, el contenido) vive en
// replicar-reglas.ts, con test; acá está lo que baja, llama a la IA y crea la landing.
//
//   · «Como bloques editables» (`modo: 'bloques'`): el esquema en modo «importar» con «Conservar»
//     (el extractor del Landing Analyst, con su guarda anti-SSRF, y el texto tal cual, sin IA) y las
//     secciones de la IA en tandas de 3 (`secciones`, ia.ts). Las tandas van de a DOS en paralelo
//     (una sola key de Gemini no aguanta más: AGENTS.md, «N llamadas grandes en paralelo… 429») y
//     con un plazo total: la que no entra queda armada desde el esquema (`tarjetaDesdeEsquema`) y el
//     aviso lo dice — nunca una landing con secciones de menos.
//   · «Copia fiel (HTML)» (`modo: 'fiel'`): baja el HTML con `htmlDePagina` (lib/landing-fetch.ts:
//     IP clavada, redirecciones revalidadas, tope de tamaño y de tiempo) y arma una sección «HTML
//     personalizado» por parte de la página (`copiaFiel`).
//
// Las dos crean la landing con `crear` (server.ts): el saneo, el workspace de la sesión y el autor
// son los de siempre. Devuelven su id; la pantalla la abre en el editor.
// =============================================================================

import 'server-only';
import { htmlDePagina } from '../landing-fetch';
import { crear } from './server';
import { esquema as pedirEsquema, secciones as pedirSecciones } from './ia';
import { tandasDe, tarjetaDesdeEsquema } from './ia-reglas';
import { nuevoId, type JsonNodo, type LandingContenido } from './doc';
import type { Esquema, ParamsGeneracion } from './api-tipos';
import {
  contenidoDeCopiaFiel, copiaFiel, modoReplicar, urlParaReplicar, type RespuestaReplicar,
} from './replicar-reglas';

export type ResultadoReplicar = RespuestaReplicar & { status?: number };

/** Plazo total de «Como bloques»: por debajo del `maxDuration` de la ruta (300 s), con aire para crear. */
const PLAZO_BLOQUES_MS = 240_000;
/** Lo que tarda como mucho una tanda (`PLAZOS.secciones.total` de ia.ts, 57 s, con margen). */
const TANDA_MS = 60_000;
/** Tandas a la vez. */
const EN_PARALELO = 2;

const falla = (error: string, status = 400): ResultadoReplicar => ({ ok: false, error, status });

/** Replica la landing de `url` en una landing nueva del workspace de la sesión. */
export async function replicar(urlRaw: unknown, modoRaw: unknown): Promise<ResultadoReplicar> {
  const url = urlParaReplicar(urlRaw);
  if (!url) return falla('Pega un enlace válido.');
  const modo = modoReplicar(modoRaw);
  if (!modo) return falla('Elige cómo replicarla.');
  return modo === 'fiel' ? replicarFiel(url) : replicarComoBloques(url);
}

async function crearLanding(titulo: string, contenido: LandingContenido): Promise<{ id: number; titulo: string } | ResultadoReplicar> {
  const r = await crear({ accion: 'crear', titulo, contenido });
  if (!r.ok) return falla(r.error, r.status);
  return { id: r.doc.id, titulo: r.doc.titulo };
}

// ─────────────────────────────────────────────────────────────────────────────
// Copia fiel
// ─────────────────────────────────────────────────────────────────────────────

async function replicarFiel(url: string): Promise<ResultadoReplicar> {
  let html: string;
  try {
    html = await htmlDePagina(url);
  } catch (e) {
    // landing-fetch ya escribe el motivo para una persona («La página respondió 403…»).
    return falla(e instanceof Error ? e.message : 'No pude abrir esa página.', 502);
  }
  const copia = copiaFiel(html, url);
  if (!copia.ok) return falla(copia.error, 422);
  const creada = await crearLanding(copia.titulo, contenidoDeCopiaFiel(copia.documentos, copia.partida));
  if ('ok' in creada) return creada;
  console.log(`[editor-landing/replicar] copia fiel de ${url} → #${creada.id} (${copia.documentos.length} sección(es))`);
  return {
    ok: true, id: creada.id, titulo: creada.titulo, secciones: copia.documentos.length,
    ...(copia.partida ? {} : { aviso: 'Quedó en una sola sección.' }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Como bloques editables
// ─────────────────────────────────────────────────────────────────────────────

async function replicarComoBloques(url: string): Promise<ResultadoReplicar> {
  const t0 = Date.now();
  const params: Partial<ParamsGeneracion> = { modoTexto: 'conservar' };
  const e = await pedirEsquema({ modo: 'importar', url, params });
  if (!e.ok) return falla(e.error, e.status);
  const esq: Esquema = e.esquema;
  const tandas = tandasDe(esq.secciones.length);
  const porIndice = new Map<number, JsonNodo>();
  let sinIA = 0;

  // Las tandas, de a EN_PARALELO, mientras quede plazo para una entera.
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < tandas.length) {
      const indices = tandas[siguiente++];
      if (Date.now() - t0 + TANDA_MS > PLAZO_BLOQUES_MS) continue;
      try {
        const r = await pedirSecciones({ esquema: esq, indices, params });
        if (r.ok) r.tarjetas.forEach((t, k) => porIndice.set(indices[k], t));
        else console.warn(`[editor-landing/replicar] tanda ${indices.join(',')} de ${url}: ${r.error}`);
      } catch (err) {
        console.warn(`[editor-landing/replicar] tanda ${indices.join(',')} de ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(EN_PARALELO, tandas.length) }, trabajador));

  const tarjetas = esq.secciones.map((s, i) => {
    const t = porIndice.get(i);
    if (t) return t;
    sinIA++;
    return tarjetaDesdeEsquema(s, i === 0);
  });
  if (!tarjetas.length) return falla('No encontré secciones en esa página.', 422);
  const contenido: LandingContenido = { v: 1, paginas: [{ id: nuevoId('p'), titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: tarjetas } }] };
  const creada = await crearLanding(esq.titulo, contenido);
  if ('ok' in creada) return creada;
  console.log(`[editor-landing/replicar] como bloques ${url} → #${creada.id} (${tarjetas.length} secciones, ${sinIA} sin IA, ${Math.round((Date.now() - t0) / 1000)} s)`);
  return {
    ok: true, id: creada.id, titulo: creada.titulo, secciones: tarjetas.length,
    ...(sinIA ? { aviso: sinIA === 1 ? 'Una sección quedó sin diseño.' : `${sinIA} secciones quedaron sin diseño.` } : {}),
  };
}
