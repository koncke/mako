// =============================================================================
// copywriter/pegado-servidor — guardar lo que trae la persona y armar su réplica (server; 14/11/2026)
// =============================================================================
// Lo puro (qué es lo pegado, cómo se guarda, cómo se lee como un outlier) vive en ./pegado.ts. Acá:
//   · `replicarPegado`: de un link, un texto o lo leído de un archivo, el ORIGINAL (`mako.copywriter.original.<n>`) y la página que
//     lo replica (vacía, con `props.outlier = pegado:<n>`: la escribe MaKo con el flujo de siempre, app/copywriter/PanelMaKo.tsx);
//   · `originalPegadoPorId`: el original como outlier, con lo que se DICE si su video ya se transcribió;
//   · `asegurarGuionPegado`: la transcripción de su video de YouTube, con el Gemini del negocio y el tope del día de Spy (la misma
//     cola que un YouTube de Competitors Spy: lib/spy-transcripcion.ts). La pantalla la pide y la espera como la de Spy.
// Una LANDING se baja con las barandas de siempre (lib/landing-fetch.ts: IP clavada, tope de tamaño, plazo) y su VSL se busca con
// el mismo detector del Pixel (lib/landing-analisis.ts, `videosDeHtml`): si está en YouTube se transcribe; si está en Panda, Vimeo
// o Wistia no hay de dónde bajarlo y MaKo lo dice (replica con el texto de la página).
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { cambiarSettingSi, getSettingEstricto } from '../settings';
import { paginaConDireccion } from '../landing-fetch';
import { copyDeHtml } from '../landing-extraer';
import { videosDeHtml } from '../landing-analisis';
import { claveDeYoutube } from '../youtube';
import {
  CLAVE_DIA_GUIONES_YT, GUIONES_YT_POR_DIA, TRANSCRIBIENDO_YT_VENCE_MS, leerGuion, reclamarGuion, transcribirGuionYoutube, vistaDeGuion,
  type DepsGuionYoutube, type VistaGuion,
} from '../spy-transcripcion';
import { tramoDeYoutube } from '../spy-transcripcion-servidor';
import { reservarDelDia } from '../spy-todo';
import { crear, type Falla } from './server';
import { docVacio } from './doc';
import { propsNuevas, type GuionAbierto, type PaginaCopy } from './tipos';
import { idDeYouTube, primeraLinea, type OutlierCopy } from './outliers';
import {
  INFO_PEGADO, TOPE_PEGADO, claveDePegado, claveGuionDePegado, esTipoPegado, leerOriginalPegado, outlierDePegado, queEsLoPegado,
  type OriginalPegado, type TipoPegado,
} from './pegado';

const falla = (status: Falla['status'], error: string): Falla => ({ ok: false, error, status });

/** Lo que dice MaKo de un video de una página que no se puede bajar (no está en YouTube). */
const NOMBRE_DEL_REPRODUCTOR: Readonly<Record<string, string>> = {
  'video-panda': 'Panda', 'video-vimeo': 'Vimeo', 'video-wistia': 'Wistia', 'video-bunny': 'Bunny', 'video-cloudflare': 'Cloudflare',
  'video-drive': 'Google Drive', 'video-nativo': 'la misma página',
};

/** El título, el canal y la duración de un video de YouTube (la API pública; sin clave o si falla, null: se replica igual). */
async function datosDelVideo(id: string): Promise<{ titulo: string; canal: string; duracion: string | null } | null> {
  const clave = await claveDeYoutube().catch(() => null);
  if (!clave) return null;
  try {
    const u = new URL('https://www.googleapis.com/youtube/v3/videos');
    u.searchParams.set('part', 'snippet,contentDetails');
    u.searchParams.set('id', id);
    u.searchParams.set('key', clave);
    const r = await fetch(u, { signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return null;
    const d = (await r.json()) as { items?: Array<{ snippet?: { title?: string; channelTitle?: string }; contentDetails?: { duration?: string } }> };
    const v = d.items?.[0];
    if (!v) return null;
    return { titulo: v.snippet?.title ?? '', canal: v.snippet?.channelTitle ?? '', duracion: v.contentDetails?.duration ?? null };
  } catch {
    return null;
  }
}

/** El host de una página, como se lee («ejemplo.com»). */
const hostDe = (url: string): string => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'una página'; } };

/**
 * De lo traído, el original (sin guardar). `lecturas`: lo leído de los archivos subidos (lib/adjuntos-del-chat.ts). Una falla es lo
 * que la persona tiene que cambiar, dicho corto.
 */
export async function originalDeLoTraido(tipo: TipoPegado, crudo: string, lecturas: readonly { nombre: string; texto: string }[]): Promise<OriginalPegado | Falla> {
  const lo = queEsLoPegado(crudo);
  const leido = lecturas.map((l) => l.texto.trim()).filter(Boolean).join('\n\n').slice(0, TOPE_PEGADO);
  const archivos = lecturas.map((l) => l.nombre).filter(Boolean).join(', ').slice(0, 120);
  const base = { tipo, video: null, duracion: null, nota: null, creado: new Date().toISOString() };
  if (lo.clase === 'vacio') {
    if (!leido) return falla(400, 'Pega un link o un texto, o sube un archivo.');
    return { ...base, de: archivos || 'lo que subiste', titulo: primeraLinea(leido, 120), texto: leido, deDonde: 'guion', url: '' };
  }
  if (lo.clase === 'texto') {
    const texto = [lo.texto, leido].filter(Boolean).join('\n\n').slice(0, TOPE_PEGADO);
    return { ...base, de: 'lo que pegaste', titulo: primeraLinea(texto, 120), texto, deDonde: 'guion', url: '' };
  }
  if (lo.clase === 'instagram') {
    // Sin la clave de Apify (da 401) no hay cómo traer el video: con una captura o su texto, sí.
    if (!leido) return falla(422, 'De Instagram no puedo traer el video desde el link. Pega lo que dice o sube una captura.');
    return { ...base, de: 'Instagram', titulo: primeraLinea(leido, 120), texto: leido, deDonde: 'guion', url: lo.url };
  }
  if (lo.clase === 'youtube') {
    const d = await datosDelVideo(idDeYouTube(lo.video)!);
    const titulo = d?.titulo || INFO_PEGADO[tipo].rotulo;
    return {
      ...base, de: d?.canal ? `YouTube · ${d.canal}` : 'YouTube', titulo, url: lo.url, video: lo.video, duracion: d?.duracion ?? null,
      // Hasta transcribirlo, lo que se sabe es su título (y lo leído de un archivo, si subió uno).
      texto: [titulo, leido].filter(Boolean).join('\n\n'), deDonde: leido ? 'guion' : 'descripcion',
    };
  }
  // Una página: su texto y, si tiene, su VSL.
  let pagina: { html: string; final: string };
  try {
    pagina = await paginaConDireccion(lo.url, { talCual: true });
  } catch (e) {
    return falla(422, `No pude abrir esa página (${(e instanceof Error ? e.message : 'no contestó').replace(/\.$/, '')}). Pega su texto.`);
  }
  const copy = copyDeHtml(pagina.html);
  const videos = videosDeHtml(pagina.final, pagina.html);
  const yt = videos.map((v) => idDeYouTube(v.url)).find(Boolean) ?? null;
  const otro = yt ? null : videos[0] ?? null;
  const textoPagina = [copy.titulo, copy.texto].filter(Boolean).join('\n\n').slice(0, TOPE_PEGADO).trim();
  const texto = [leido, textoPagina].filter(Boolean).join('\n\n').slice(0, TOPE_PEGADO);
  if (!texto && !yt) return falla(422, 'No pude leer el texto de esa página. Pega su texto o súbelo.');
  const d = yt ? await datosDelVideo(yt) : null;
  return {
    ...base, de: hostDe(pagina.final), titulo: copy.titulo || d?.titulo || hostDe(pagina.final), url: lo.url,
    texto: texto || d?.titulo || INFO_PEGADO[tipo].rotulo, deDonde: leido ? 'guion' : 'copy',
    video: yt ? `https://www.youtube.com/watch?v=${yt}` : null, duracion: d?.duracion ?? null,
    nota: otro
      ? `Su video está en ${NOMBRE_DEL_REPRODUCTOR[otro.pieza] ?? 'otro reproductor'}: no lo puedo transcribir desde la página. Replico con el texto de la página; si tienes lo que dice, pégalo.`
      : !yt && tipo === 'vsl' ? 'No encontré el video en la página: replico con su texto.' : null,
  };
}

/** Un número nuevo para un original (12 cifras: el id de outlier admite hasta 12). */
const numeroNuevo = (): number => Date.now() % 1_000_000_000_000;

/**
 * «Replicar» lo traído: guarda el original y crea la página vacía que lo replica (la escribe MaKo, que pregunta antes la oferta).
 */
export async function replicarPegado(p: { tipo: unknown; texto: unknown; lecturas?: readonly { nombre: string; texto: string }[] }): Promise<({ ok: true; paginas: PaginaCopy[] } & GuionAbierto) | Falla> {
  if (!esTipoPegado(p.tipo)) return falla(400, 'Elige qué es.');
  const o = await originalDeLoTraido(p.tipo, typeof p.texto === 'string' ? p.texto : '', p.lecturas ?? []);
  if ('ok' in o) return o;
  let n = numeroNuevo();
  let guardado = false;
  try {
    for (let i = 0; i < 3 && !guardado; i++, n++) {
      guardado = await cambiarSettingSi(claveDePegado(n), null, JSON.stringify(o));
      if (guardado) break;
    }
  } catch (e) {
    return falla(500, e instanceof Error ? e.message : 'No pude guardar el original.');
  }
  if (!guardado) return falla(409, 'Vuelve a intentar.');
  // El título hasta que MaKo ponga el suyo: con qué abre (no «Como lo que pegaste: …», que es `tituloDeReplica` de un outlier).
  const titulo = `Réplica: ${primeraLinea(o.titulo || o.texto, 70)}`.slice(0, 200);
  return crear({ tipo: p.tipo, titulo, props: { ...propsNuevas(p.tipo), outlier: `pegado:${n}` }, contenido: docVacio() });
}

/** El original traído, como outlier (con lo que se dice, si ya se transcribió). null = no existe en este negocio. */
export async function originalPegadoPorId(n: number): Promise<OutlierCopy | null> {
  const [crudo, guion] = await Promise.all([getSettingEstricto(claveDePegado(n)), getSettingEstricto(claveGuionDePegado(n))]);
  const o = leerOriginalPegado(crudo);
  if (!o) return null;
  const g = leerGuion(guion);
  return outlierDePegado(n, o, g?.estado === 'listo' && g.texto ? g.texto : null);
}

/**
 * La transcripción del video de lo traído: lo que hay y, si hace falta, el trabajo para un `after()` (como `asegurarGuion` de Spy,
 * lib/spy-transcripcion-servidor.ts). Sin video: «no-aplica». Sin el Gemini del negocio, se dice y no se reclama nada.
 */
export async function asegurarGuionPegado(n: number, hayGemini: () => Promise<boolean>): Promise<{ vista: VistaGuion; trabajo: (() => Promise<void>) | null } | null> {
  const o = leerOriginalPegado(await getSettingEstricto(claveDePegado(n)));
  if (!o) return null;
  if (!o.video) return { vista: { estado: 'no-aplica' }, trabajo: null };
  const clave = claveGuionDePegado(n);
  const deps: DepsGuionYoutube = {
    leer: async () => { const crudo = await getSettingEstricto(clave); return { crudo, version: crudo }; },
    cambiarSi: (version, nuevo) => cambiarSettingSi(clave, version, nuevo),
    nuevoIntento: () => randomUUID(),
    youtube: tramoDeYoutube,
    reservarDia: () => reservarDelDia(CLAVE_DIA_GUIONES_YT, GUIONES_YT_POR_DIA),
  };
  if (!(await hayGemini())) return { vista: vistaDeGuion(leerGuion((await deps.leer()).crudo), { aplica: true, sinGemini: true }), trabajo: null };
  const r = await reclamarGuion(deps, Date.now(), TRANSCRIBIENDO_YT_VENCE_MS);
  if (!r.corre) return { vista: vistaDeGuion(r.actual, { aplica: true }), trabajo: null };
  const video = o.video;
  const trabajo = async () => {
    try {
      const fin = await transcribirGuionYoutube(deps, video, o.duracion, r);
      if (fin.estado !== 'listo') console.warn(`[copywriter-pegado] ${n}: ${fin.motivo ?? (fin.reintentarEn ? `pendiente hasta ${fin.reintentarEn}` : fin.estado)}`);
    } catch (e) {
      console.error(`[copywriter-pegado] ${n}:`, e instanceof Error ? e.message : String(e));
    }
  };
  return { vista: vistaDeGuion(r.actual, { aplica: true }), trabajo };
}
