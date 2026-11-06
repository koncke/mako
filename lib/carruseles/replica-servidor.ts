// =============================================================================
// carruseles/replica-servidor — «Editar» un carrusel (o un anuncio) de ejemplo: de las láminas a un diseño editable (6/11/2026)
// =============================================================================
// Lo puro (el prompt, leer lo que vuelve, el documento) está en ./replica.ts, con su porqué. Acá, la red, en este orden:
//   1. el carrusel se vuelve a leer de la base del negocio (nunca lo que mande el navegador: ./crear-servidor.ts);
//   2. sus láminas, de NUESTRO bucket (las que bajó el script de la biblioteca; si no hay, la portada sola);
//   3. lo que se sabe del negocio (el Second Brain y su voz), su marca (el kit) y la foto del cliente (su avatar);
//   4. la IA DEL NEGOCIO mira las láminas y devuelve el diseño con sus textos (`leerDocumentoIA` adentro de
//      `conSuIADelNegocio`: su Claude, su GPT o su Gemini; nunca la de la plataforma);
//   5. el diseño se guarda en el Image Editor (`crearDiseno`) y se avisa lámina por lámina (la pantalla lo dibuja mientras
//      se arma: AGENTS.md, «Lo que MaKo construye se ve CONSTRUYÉNDOSE»).
//
// SIN IA (no conectó ninguna, o la suya no contestó): igual sale un diseño EDITABLE, con la estructura del ejemplo y una guía
// en cada lámina (./crear-servidor.ts), y la pantalla dice por qué y dónde se conecta. Nunca un error seco.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSupabaseServer } from '../supabase';
import { getTenantDb } from '../workspace';
import { crearDiseno } from '../image-editor/server';
import { BUCKET_IMAGE } from '../image-editor/reglas';
import { esNuestra, tipoDeImagen } from '../spy-miniaturas';
import { kitParaUsar } from '../marca/kits-server';
import { fuenteDelEditorDeImagen } from '../image-editor/fuente-del-editor';
import { estiloConKit, estiloSinSerif } from './marca-kit';
import { marcaDelNegocio } from './marca';
import { tipoCarrusel } from './tipos';
import { estructuraDe } from './referencia';
import { imagenesDe, type Carrusel } from './explorar';
import { crearCarruselDesdeReferencia, referenciaDelNegocio } from './crear-servidor';
import {
  IMAGENES_MAX, LAMINAS_MAX, avisoSinIA, documentoDeReplica, leerReplica, medidasDeImagen, notasDeReplica, promptDeReplica,
  type EventoReplica, type FotoDelCliente,
} from './replica';

/** La función de la IA para el registro del uso y la puerta de «sólo su IA» (lib/model-catalogo.ts). */
export const FEATURE_REPLICA = 'carrusel-replica';
/** Cuánto se espera a cada lámina (es nuestro bucket: si tarda más, algo anda mal). */
const ESPERA_IMAGEN_MS = 8_000;
const PESO_MAXIMO = 4 * 1024 * 1024;

export type ResultadoReplica =
  | { ok: true; id: string; titulo: string; sinIA?: boolean; aviso?: string | null; conectar?: string | null }
  | { ok: false; error: string; falla?: boolean; conectar?: string | null };

/** Una lámina de NUESTRO bucket como data URL (lo que mira la IA). Sólo lo nuestro: nunca se baja una URL ajena. */
async function comoDataUrl(url: string): Promise<string | null> {
  if (!esNuestra(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ESPERA_IMAGEN_MS), cache: 'no-store' });
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (!buf.length || buf.length > PESO_MAXIMO) return null;
    const tipo = tipoDeImagen(buf);
    return tipo ? `data:${tipo.mime};base64,${Buffer.from(buf).toString('base64')}` : null;
  } catch { return null; }
}

/**
 * La foto del cliente (su avatar) en «Subidos» del Image Editor: la primera de su cara de marca (lib/persona.ts, las fotos
 * que subió en el onboarding o en Video) y, si no tiene, el último look de AI Avatar que salió bien. Se COPIA al bucket del
 * editor (la de la cara de marca vive en uno privado, con un link que vence): así el diseño la guarda y se puede cambiar.
 * null = no tiene foto, o no se pudo copiar (el diseño sale con el lugar de la foto marcado).
 */
export async function fotoDelCliente(ws: number): Promise<FotoDelCliente | null> {
  try {
    let bytes: Uint8Array | null = null;
    let nombre = 'Tu foto';
    const { getPersona } = await import('../persona');
    const persona = await getPersona().catch(() => null);
    const primera = persona?.fotos[0];
    if (primera) {
      const { data } = await getSupabaseServer().storage.from('archivero').download(primera.path);
      if (data) { bytes = new Uint8Array(await data.arrayBuffer()); nombre = 'Tu foto (cara de marca)'; }
    }
    if (!bytes) {
      const { leerLooks } = await import('@/app/ai-avatar/looks');
      const look = (await leerLooks().catch(() => [])).find((l) => /^https:\/\//.test(l.url) && !l.error);
      if (look) {
        const r = await fetch(look.url, { signal: AbortSignal.timeout(ESPERA_IMAGEN_MS) }).catch(() => null);
        if (r?.ok) { bytes = new Uint8Array(await r.arrayBuffer()); nombre = 'Tu foto (AI Avatar)'; }
      }
    }
    if (!bytes || bytes.length > 15 * 1024 * 1024) return null;
    const tipo = tipoDeImagen(bytes);
    const medidas = medidasDeImagen(bytes);
    if (!tipo || !medidas || medidas.ancho < 8 || medidas.alto < 8) return null;
    const id = randomUUID();
    const ruta = `${ws}/${id}.${tipo.ext}`;
    const bucket = getSupabaseServer().storage.from(BUCKET_IMAGE);
    const up = await bucket.upload(ruta, bytes, { contentType: tipo.mime, upsert: false, cacheControl: '31536000' });
    if (up.error) return null;
    const url = bucket.getPublicUrl(ruta).data.publicUrl;
    const db = await getTenantDb();
    const ins = await db.from('image_subidos').insert({
      id, workspace_id: ws, nombre, tipo: tipo.mime, ancho: medidas.ancho, alto: medidas.alto, bytes: bytes.length, ruta, url,
    });
    if (ins.error) return null;
    return { id, url, ancho: medidas.ancho, alto: medidas.alto };
  } catch (e) {
    console.warn('[carruseles] no pude preparar la foto del cliente:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * «Editar» el carrusel `id` (o el anuncio) del explorador en el negocio `ws`. `alEvento` recibe el armado en vivo; sin él,
 * sólo el resultado (la API de MaKo). Nunca tira.
 */
export async function replicarCarrusel(ws: number, quien: string, id: number, o: { pedido?: string | null; alEvento?: (e: EventoReplica) => void; timeoutMs?: number } = {}): Promise<ResultadoReplica> {
  const avisar = (e: EventoReplica) => { try { o.alEvento?.(e); } catch { /* la pantalla se fue */ } };
  let c: Carrusel | null;
  try { c = await referenciaDelNegocio(id); } catch { return { ok: false, error: 'No pude leer ese carrusel. Vuelve a intentar.', falla: true }; }
  if (!c) return { ok: false, error: 'Ese ejemplo ya no está: elige otro.' };

  const anuncio = c.clase === 'anuncio';
  const urls = imagenesDe(c).slice(0, IMAGENES_MAX);
  const total = anuncio ? 1 : Math.max(1, Math.min(LAMINAS_MAX, c.laminas ?? urls.length ?? 1));
  const imagenes = (await Promise.all(urls.map(comoDataUrl))).filter((x): x is string => !!x);
  avisar({ fase: 'leer', laminas: total, vistas: Math.min(imagenes.length, total) });

  /** Sin IA (o sin láminas que mirar): la estructura del ejemplo, editable, con guías. */
  const conGuias = async (motivo: { aviso: string; conectar: string | null } | null): Promise<ResultadoReplica> => {
    const est = estructuraDe(c as Carrusel);
    const r = await crearCarruselDesdeReferencia(ws, quien, id, est.tipo ?? 'lista', anuncio ? 3 : total);
    if (!r.ok) return { ok: false, error: r.error, falla: r.falla };
    avisar({ fase: 'fin', ok: true, id: r.id, titulo: r.titulo, sinIA: true, aviso: motivo?.aviso ?? null, conectar: motivo?.conectar ?? null });
    return { ok: true, id: r.id, titulo: r.titulo, sinIA: true, aviso: motivo?.aviso ?? null, conectar: motivo?.conectar ?? null };
  };

  const [{ contextoDelNegocio, vozDelNegocio }, kit] = await Promise.all([import('../negocio-para-crear'), kitParaUsar().catch(() => null)]);
  const [negocio, voz, marca, foto] = await Promise.all([
    contextoDelNegocio(`carrusel de Instagram ${c.gancho ?? ''} ${o.pedido ?? ''}`.trim()).catch(() => ''),
    vozDelNegocio().catch(() => null),
    marcaDelNegocio(ws, kit),
    fotoDelCliente(ws),
  ]);
  const prompt = promptDeReplica({
    laminas: total, vistas: imagenes.length, negocio, voz: voz ?? '', nombreNegocio: marca.nombre, cta: c.cta?.palabra ?? null,
    conAvatar: !!foto, pedido: o.pedido ?? null, anuncio, pie: c.texto || c.gancho || null,
  });
  avisar({ fase: 'escribir', con: 'tu IA' });
  let crudo: string;
  try {
    const { leerDocumentoIA, chatCheap } = await import('../ai-cheap');
    const { conSuIADelNegocio } = await import('../ia-del-negocio');
    const motivo = anuncio ? 'Editar un anuncio de ejemplo' : 'Editar un carrusel de ejemplo';
    // Sin ninguna imagen que mirar (la portada no se pudo bajar), la IA escribe la versión del negocio con el tema y el pie.
    if (!imagenes.length) {
      crudo = await conSuIADelNegocio(ws, () => chatCheap({
        system: 'Eres diseñador de carruseles de Instagram para negocios. Respondes sólo con el JSON pedido.', user: prompt, json: true,
        feature: FEATURE_REPLICA, motivo, timeoutMs: o.timeoutMs ?? 120_000,
      }));
    } else {
      const r = await conSuIADelNegocio(ws, () => leerDocumentoIA({
        dataUrl: imagenes[0], dataUrls: imagenes, isPdf: false, nombreArchivo: anuncio ? 'anuncio' : 'carrusel', prompt, json: true,
        feature: FEATURE_REPLICA, motivo, timeoutMs: o.timeoutMs ?? 120_000,
      }));
      crudo = r.text;
    }
  } catch (e) {
    return conGuias(avisoSinIA(e instanceof Error ? e.message : String(e)));
  }
  const replica = leerReplica(crudo, { laminas: total });
  if ('error' in replica) return conGuias({ aviso: `${replica.error} Por ahora, cada lámina trae una guía.`, conectar: null });

  const estilo = estiloSinSerif(estiloConKit((tipoCarrusel(estructuraDe(c).tipo ?? 'lista') ?? tipoCarrusel('lista'))!.estilo, kit, fuenteDelEditorDeImagen), kit);
  const doc = documentoDeReplica({ replica, estilo, marca, foto, nuevoId: randomUUID, notas: notasDeReplica(c), conFuentesDeMarca: !!kit?.fuentes.titulos });
  const paginas = (doc.pages as Record<string, unknown>[]) ?? [];
  paginas.forEach((pagina, indice) => avisar({ fase: 'lamina', indice, total: paginas.length, pagina, ancho: doc.width as number, alto: doc.height as number }));
  const titulo = `${anuncio ? 'Anuncio' : 'Carrusel'} · ${replica.titulo}`.slice(0, 120);
  const r = await crearDiseno(ws, quien, { titulo, doc });
  if (!r.ok) return { ok: false, error: r.error, falla: true };
  const aviso = foto || !replica.laminas.some((l) => l.foto?.persona) ? null : 'Sube tu foto en AI Avatar o en tu cara de marca y va donde el ejemplo tiene una persona.';
  avisar({ fase: 'fin', ok: true, id: r.id, titulo, aviso });
  return { ok: true, id: r.id, titulo, aviso };
}
