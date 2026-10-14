// =============================================================================
// editor-landing/replicar — «Replicar en el editor» una landing de AFUERA (tanda 2, puntos 8 y 9)
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2): «si traigo una landing de afuera […] me gustaría si es una
// landing de afuera tener la opción de replicarla con nuestro editor» y «Si se tiene que poder editar
// libremente con "HTML personalizado", esto permitirá copiar otras landing». Decisiones T5/T6 en
// docs/diseno-editor-landing.md. Lo puro (cómo se parte el HTML, qué se saca, el contenido, la receta
// de cada formato) vive en replicar-reglas.ts, con test; acá está lo que baja, llama a la IA y crea la
// landing.
//
// Tanda 6 (14/10/2026), decisión de Martín: «Replicar» pregunta 3 FORMATOS — Presentación
// (diapositivas), Landing (secciones editables) y Página web (la copia idéntica de hoy) — y ninguno
// pone fotos de stock al azar (`configDeReplica`). Los tres van por dos caminos:
//
//   · por bloques (Presentación y Landing): el esquema en modo «importar» (el extractor, con su guarda
//     anti-SSRF, la URL TAL CUAL) y las secciones de la IA en tandas de 3 (`secciones`, ia.ts).
//     Landing usa «Conservar» (el texto tal cual, sin IA en el esquema); Presentación, «Condensar» en
//     diapositivas 16:9. Las tandas van de a DOS en paralelo (una sola key de Gemini no aguanta más:
//     AGENTS.md, «N llamadas grandes en paralelo… 429») y con un plazo total: la que no entra queda
//     armada desde el esquema (`tarjetaDesdeEsquema`) y el aviso lo dice — nunca con secciones de menos.
//     Si la página no se lee desde el server (se arma en el navegador, o nos rechaza), la falla trae
//     `enNavegador` y la pantalla vuelve con la `lectura` del navegador o el `texto` pegado.
//   · fiel (Página web): baja el HTML con `htmlDePagina` (lib/landing-fetch.ts: IP clavada,
//     redirecciones revalidadas, tope de tamaño y de tiempo; la URL tal cual) y arma una sección «HTML
//     personalizado» por parte de la página (`copiaFiel`). Necesita el HTML: una lectura del navegador
//     no le sirve.
//
// Todas crean la landing con `crear` (server.ts): el saneo, el workspace de la sesión y el autor son
// los de siempre, y nacen con el formato y el origen de su receta. Devuelven su id; la pantalla la abre
// en el editor. La usan la ruta (app/api/landing-generator/replicar) y la API de MaKo
// (`replicar_landing`, lib/api-mako/areas/landing.run.ts).
//
// Tanda 6 (14/10/2026), la otra mitad de la decisión (d): «Al replicar como landing se COPIA el estilo
// (colores y fuentes leídos en el navegador → tema propio; imágenes al bucket), nada de fotos de stock».
// Por bloques (Presentación y Landing), mientras la IA arma las secciones:
//   · el ESTILO de la original sale de la lectura del navegador (`lectura.estilo`, los estilos
//     computados) o, si no vino, del HTML y las hojas que baja el server (`estiloDeLaPagina`);
//   · se guarda como un TEMA PROPIO del workspace («Estilo de <sitio>», `temaDeEstilo`) y la landing nace
//     con él; el mismo estilo replicado dos veces reusa el tema (su id sale del contenido);
//   · las imágenes de la original se copian a NUESTRO bucket (`subirImagenes`) y van a las secciones que
//     las tenían, con los fondos de sección distintos (`aplicarEstilo`). La que no se copia deja el
//     marcador de hoy. La Página web (copia fiel) no cambia: ya lleva el HTML y los estilos de la original.
// =============================================================================

import 'server-only';
import { htmlDePagina } from '../landing-fetch';
import { getWorkspaceActual } from '../workspace';
import { crear, guardarTema, temasPropiosDe } from './server';
import { esquema as pedirEsquema, secciones as pedirSecciones } from './ia';
import { tandasDe, tarjetaDesdeEsquema } from './ia-reglas';
import { nuevoId, type JsonNodo, type LandingContenido } from './doc';
import { terminoTarjeta, type ConfigLanding, type Esquema, type TemaPropio } from './api-tipos';
import { motivoDeError, seLeeEnNavegador } from './lectura-reglas';
import {
  configDeReplica, contenidoDeCopiaFiel, copiaFiel, formatoReplicar, urlParaReplicar,
  type ConfigReplica, type RespuestaReplicar,
} from './replicar-reglas';
import { estiloDeLectura, temaDeEstilo, type EstiloOriginal } from './estilo-original';
import { TOPES_IMAGENES_REPLICA, aplicarEstilo, asignarSecciones, imagenesParaSubir, imagenesQueFaltan } from './estilo-aplicar';
import { estiloDeLaPagina, subirImagenes } from './estilo-server';
import { colorDeRelleno, temaPorId } from './temas';

export type ResultadoReplicar = RespuestaReplicar & { status?: number };

/** Plazo total por bloques: por debajo del `maxDuration` de la ruta (300 s), con aire para crear. */
const PLAZO_BLOQUES_MS = 240_000;
/** Lo que tarda como mucho una tanda (`PLAZOS.secciones.total` de ia.ts, 57 s, con margen). */
const TANDA_MS = 60_000;
/** Tandas a la vez. */
const EN_PARALELO = 2;
/** El texto pegado que se acepta (el de un esquema, `MAX_TEXTO_ENTRADA`: ia.ts lo vuelve a cortar). */
const MAX_TEXTO = 60_000;
/**
 * Hasta cuándo se copian imágenes de la original: después de las tandas, con aire para guardar el tema
 * y crear antes del `maxDuration` de la ruta (300 s). `subirImagenes` no empieza una que no termina.
 */
const PLAZO_IMAGENES_MS = 265_000;

const falla = (error: string, status = 400): ResultadoReplicar => ({ ok: false, error, status });

/**
 * Lo que llega del pedido, sin forma confiable. `formato` manda; sin él, el `modo` viejo (tanda 2).
 * `lectura` / `texto` reemplazan la bajada (sólo por bloques).
 */
export type EntradaReplicar = { url: unknown; formato?: unknown; modo?: unknown; lectura?: unknown; texto?: unknown };

/** Replica la landing de `url` en una landing nueva del workspace de la sesión. */
export async function replicar(p: EntradaReplicar): Promise<ResultadoReplicar> {
  const url = urlParaReplicar(p.url);
  if (!url) return falla('Pega un enlace válido.');
  const formato = formatoReplicar(p.formato, p.modo);
  if (!formato) return falla('Elige el formato: Presentación, Landing o Página web.');
  const receta = configDeReplica(formato, url);
  if (receta.via === 'fiel') return replicarFiel(url, receta);
  const texto = typeof p.texto === 'string' ? p.texto.trim().slice(0, MAX_TEXTO) : '';
  return replicarComoBloques(url, receta, { lectura: p.lectura, texto });
}

async function crearLanding(titulo: string, contenido: LandingContenido, config: Partial<ConfigLanding>): Promise<{ id: number; titulo: string } | ResultadoReplicar> {
  const r = await crear({ accion: 'crear', titulo, contenido, config });
  if (!r.ok) return falla(r.error, r.status);
  return { id: r.doc.id, titulo: r.doc.titulo };
}

// ─────────────────────────────────────────────────────────────────────────────
// Página web (la copia fiel)
// ─────────────────────────────────────────────────────────────────────────────

async function replicarFiel(url: string, receta: ConfigReplica): Promise<ResultadoReplicar> {
  let html: string;
  try {
    // TAL CUAL: `normalizarUrl` le saca el www, y hay hosts que sólo existen con www.
    html = await htmlDePagina(url, { talCual: true });
  } catch (e) {
    // Una página que nos rechaza se lee en el navegador de la persona, pero la copia idéntica necesita
    // su HTML: la salida es el formato que copia el texto.
    if (motivoDeError(e)) return falla('Esta página no deja que MaKo la copie tal cual. Prueba el formato «Landing».', 422);
    // landing-fetch ya escribe el motivo para una persona («La página respondió 404…»).
    return falla(e instanceof Error ? e.message : 'No pude abrir esa página.', 502);
  }
  const copia = copiaFiel(html, url);
  if (!copia.ok) return falla(copia.error, 422);
  const creada = await crearLanding(copia.titulo, contenidoDeCopiaFiel(copia.documentos, copia.partida), receta.config);
  if ('ok' in creada) return creada;
  console.log(`[editor-landing/replicar] copia fiel de ${url} → #${creada.id} (${copia.documentos.length} sección(es))`);
  return {
    ok: true, id: creada.id, titulo: creada.titulo, secciones: copia.documentos.length, formato: receta.formato,
    ...(copia.partida ? {} : { aviso: 'Quedó en una sola sección.' }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Presentación y Landing (por bloques)
// ─────────────────────────────────────────────────────────────────────────────

async function replicarComoBloques(url: string, receta: ConfigReplica, entrada: { lectura: unknown; texto: string }): Promise<ResultadoReplicar> {
  const t0 = Date.now();
  const params = receta.params ?? {};
  // El estilo de la original, EN PARALELO con el esquema: el de la lectura del navegador si vino (los
  // estilos computados de la página armada), o el del HTML y sus hojas. `estiloDeLaPagina` nunca tira.
  const leido = estiloDeLectura(entrada.lectura);
  const estiloP: Promise<EstiloOriginal | null> = leido ? Promise.resolve(leido) : estiloDeLaPagina(url);
  // El texto pegado entra como «Pegar texto»; la lectura del navegador, como «Importar» sin bajar nada.
  const e = entrada.texto
    ? await pedirEsquema({ modo: 'pegar', texto: entrada.texto, params })
    : await pedirEsquema({ modo: 'importar', url, lectura: entrada.lectura, params });
  if (!e.ok) {
    // `enNavegador` viaja tal cual: la pantalla ofrece el lector o pegar el texto y vuelve con eso.
    return { ok: false, error: e.error, status: e.status, ...(e.enNavegador && e.motivo ? seLeeEnNavegador(e.motivo) : {}) };
  }
  const esq: Esquema = e.esquema;
  const estilo = await estiloP;
  // Qué sección de la réplica es cuál de la original (por el título), y la primera imagen de cada una
  // a NUESTRO bucket mientras la IA arma las secciones.
  const asig = estilo ? asignarSecciones(esq.secciones, estilo.secciones) : [];
  const ws = estilo?.imagenes.length ? await getWorkspaceActual().catch(() => null) : null;
  const primeras = estilo && ws != null ? imagenesParaSubir(asig, estilo).primeras : [];
  const subidasP = ws != null && primeras.length ? subirImagenes(primeras, ws, t0 + PLAZO_IMAGENES_MS) : Promise.resolve(new Map<string, string>());
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

  // Las imágenes que faltan para los huecos que dejó la IA (una galería, las caras de un equipo), si
  // queda plazo y tope; después el tema propio y lo de la original puesto en las secciones.
  const subidas = await subidasP;
  const intentadas = new Set(primeras);
  if (estilo && ws != null) {
    const faltan = imagenesQueFaltan(tarjetas, asig, estilo, subidas).slice(0, Math.max(0, TOPES_IMAGENES_REPLICA.total - primeras.length));
    for (const u of faltan) intentadas.add(u);
    if (faltan.length) for (const [k, v] of await subirImagenes(faltan, ws, t0 + PLAZO_IMAGENES_MS)) subidas.set(k, v);
  }
  const tema = await temaParaLaCopia(estilo, url);
  const config: Partial<ConfigLanding> = tema.ok ? { ...receta.config, tema: `ws:${tema.tema.id}` } : receta.config;
  // El fondo de la tarjeta del tema que quedó (el guardado: si la persona ya lo había tocado, el suyo).
  const fondoTema = tema.ok ? colorDeRelleno(temaPorId(`ws:${tema.tema.id}`, [tema.tema]).tarjeta.fondo) : null;
  const puesto = estilo ? aplicarEstilo(tarjetas, asig, estilo, subidas, { fondoTema }) : { tarjetas, imagenes: 0, fondos: 0 };

  const contenido: LandingContenido = { v: 1, paginas: [{ id: nuevoId('p'), titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: puesto.tarjetas } }] };
  const creada = await crearLanding(esq.titulo, contenido, config);
  if ('ok' in creada) return creada;
  const noCopiadas = Math.max(0, intentadas.size - subidas.size);
  console.log(`[editor-landing/replicar] ${receta.formato} ${url}${entrada.texto ? ' (texto pegado)' : entrada.lectura ? ' (leída en el navegador)' : ''} → #${creada.id} (${tarjetas.length} secciones, ${sinIA} sin IA, estilo ${estilo ? (leido ? 'del navegador' : 'del HTML') : 'no'}, tema ${tema.ok ? tema.tema.id : tema.error}, ${puesto.imagenes} imágenes y ${puesto.fondos} fondos de la original, ${noCopiadas} sin copiar, ${Math.round((Date.now() - t0) / 1000)} s)`);
  const una = terminoTarjeta(receta.config);
  const varias = terminoTarjeta(receta.config, { plural: true });
  const avisos = [
    sinIA ? (sinIA === 1 ? `Una ${una} quedó sin diseño.` : `${sinIA} ${varias} quedaron sin diseño.`) : '',
    !estilo ? 'Sin el estilo de la original.' : !tema.ok && tema.tope ? 'Llegaste al tope de temas.' : '',
    noCopiadas ? (noCopiadas === 1 ? 'Una imagen no se copió.' : `${noCopiadas} imágenes no se copiaron.`) : '',
  ].filter(Boolean);
  return {
    ok: true, id: creada.id, titulo: creada.titulo, secciones: tarjetas.length, formato: receta.formato,
    ...(avisos.length ? { aviso: avisos.join(' ') } : {}),
  };
}

/**
 * El tema propio con el estilo de la original, guardado en el workspace. Si ya hay uno con el mismo id
 * (el mismo estilo, replicado antes) se REUSA tal como está: no se pisa lo que la persona le haya cambiado.
 * Nunca tira: sin tema, la réplica nace con el de fábrica (`tope` cuando no entra uno más).
 */
async function temaParaLaCopia(estilo: EstiloOriginal | null, url: string): Promise<{ ok: true; tema: TemaPropio } | { ok: false; error: string; tope?: boolean }> {
  const tema = temaDeEstilo(estilo, url);
  if (!tema) return { ok: false, error: 'sin estilo' };
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return { ok: false, error: 'sin negocio' };
    const ya = (await temasPropiosDe(ws)).find((t) => t.id === tema.id);
    if (ya) return { ok: true, tema: ya };
    const r = await guardarTema(tema);
    if (r.ok) return { ok: true, tema: r.tema };
    return { ok: false, error: r.error, tope: r.status === 409 && /tope/i.test(r.error) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
