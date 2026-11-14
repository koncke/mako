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
//
// LO QUE ARREGLÓ LA PRUEBA DEL 6/11/2026 (Martín, en producción, con un carrusel sin láminas: «Tu IA no contestó ahora», una guía
// sin parecido al ejemplo y las miniaturas del modal vacías):
//   · la PORTADA no llegaba a la IA si no estaba en nuestro bucket (una miniatura que no se pudo copiar queda con la URL del CDN
//     de Instagram): ahora se baja también de los CDN conocidos (Instagram, Meta y YouTube), con `fetchSeguro`;
//   · sin ninguna imagen, el texto iba por `chatCheap`, que NO prueba el Claude del negocio y tenía 512 tokens de salida (un
//     carrusel no entra): ahora va por `chatCheapCascade` (su Claude primero, después su GPT o su Gemini) con lugar para el JSON;
//   · el aviso decía lo mismo para todo: ahora dice la causa (clave, cuota, tardó, saturada…) y de qué IA (./replica.ts, `avisoSinIA`);
//   · sin la IA, las láminas guía no se mandaban a la pantalla y el modal quedaba con los cuadros vacíos: ahora se ven armándose.
//
// THUMBNAILS (6/11/2026): la miniatura de un video de YouTube se replica igual, en UNA lámina de 1280 × 720 (`replicarEjemplo` con
// `que: 'thumbnail'`), leyendo la imagen de i.ytimg.com.
// VERTICALES (13/11/2026): la portada de un reel que Spy ya trajo (lib/thumbnails/verticales.ts), en UNA lámina de 1080 × 1920
// (`que: 'vertical'`, con el id del outlier de video). El mismo camino: la plancha, y la persona generada con IA, nunca pegada.
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
  IMAGENES_MAX, LAMINAS_MAX, avisoSinIA, documentoDeReplica, esCdnPermitido, documentoGuiaMiniatura, leerReplica, medidasDeImagen, notasDeReplica, promptDeReplica,
  vuelveASinVer, type EventoReplica, type FotoDelCliente,
} from './replica';
import { imagenDeVideo, urlDeVideo, type Thumbnail } from '../thumbnails/explorar';
import { notasDeVertical, type Vertical } from '../thumbnails/verticales';
import { LAMINAS_DE_LA_LECTURA, PROMPT_LECTURA, fotoDelGuiado, leerLectura, type Lectura, type PedidoGuiado } from './guiado';
import { bloqueDeOferta, cifrasDeLaReplica, leerCompletado, medidasDe, promptDeCompletar, type OfertaDelPrompt, type Replica } from './replica';
import { marcarLaminas, planchasDeLaReplica } from './plancha-servidor';

/** La función de la IA para el registro del uso y la puerta de «sólo su IA» (lib/model-catalogo.ts). */
export const FEATURE_REPLICA = 'carrusel-replica';
/** Cuánto se espera a cada lámina (es nuestro bucket o un CDN: si tarda más, algo anda mal). */
const ESPERA_IMAGEN_MS = 8_000;
const PESO_MAXIMO = 4 * 1024 * 1024;
/** Lo que puede escribir el modelo: un carrusel de 12 láminas con 8 textos cada una, en JSON. 512 (el de `chatCheap`) no alcanza. */
const TOKENS_DE_SALIDA = 8_000;

export type ResultadoReplica =
  | { ok: true; id: string; titulo: string; sinIA?: boolean; aviso?: string | null; conectar?: string | null; doc?: Record<string, unknown>; vistas?: number; errores?: string[]; replica?: Replica; imagenes?: string[]; marcadas?: string[] }
  | { ok: false; error: string; falla?: boolean; conectar?: string | null };

/** De dónde se puede bajar una imagen para la IA: NUESTRO bucket y los CDN de las fuentes (./replica.ts, `esCdnPermitido`). */
export const esImagenPermitida = (url: string): boolean => esNuestra(url) || esCdnPermitido(url);

/** Una imagen (de NUESTRO bucket o de un CDN permitido) como data URL: lo que mira la IA. null si no se pudo. */
export async function comoDataUrl(url: string): Promise<string | null> {
  if (!esImagenPermitida(url)) return null;
  try {
    let r: Response;
    if (esNuestra(url)) r = await fetch(url, { signal: AbortSignal.timeout(ESPERA_IMAGEN_MS), cache: 'no-store' });
    else {
      // Un CDN ajeno: con `fetchSeguro` (IP pública validada en cada salto, techo de 3 MB).
      const { fetchSeguro } = await import('../fetch-seguro');
      r = await fetchSeguro(url, { signal: AbortSignal.timeout(ESPERA_IMAGEN_MS) });
    }
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
export async function fotoDelCliente(ws: number, preferir: 'cara' | 'look' = 'cara'): Promise<FotoDelCliente | null> {
  try {
    let bytes: Uint8Array | null = null;
    let nombre = 'Tu foto';
    const deLaCara = async () => {
      const { getPersona } = await import('../persona');
      const persona = await getPersona().catch(() => null);
      const primera = persona?.fotos[0];
      if (!primera) return;
      const { data } = await getSupabaseServer().storage.from('archivero').download(primera.path);
      if (data) { bytes = new Uint8Array(await data.arrayBuffer()); nombre = 'Tu foto (cara de marca)'; }
    };
    const delLook = async () => {
      const { leerLooks } = await import('@/app/ai-avatar/looks');
      const look = (await leerLooks().catch(() => [])).find((l) => /^https:\/\//.test(l.url) && !l.error);
      if (!look) return;
      const r = await fetch(look.url, { signal: AbortSignal.timeout(ESPERA_IMAGEN_MS) }).catch(() => null);
      if (r?.ok) { bytes = new Uint8Array(await r.arrayBuffer()); nombre = 'Tu foto (AI Avatar)'; }
    };
    // La que eligió el dueño en el guiado va primero (lib/carruseles/guiado.ts); la otra, si la elegida no está.
    for (const probar of preferir === 'look' ? [delLook, deLaCara] : [deLaCara, delLook]) { if (!bytes) await probar(); }
    const b = bytes as Uint8Array | null;
    if (!b || b.length > 15 * 1024 * 1024) return null;
    const tipo = tipoDeImagen(b);
    const medidas = medidasDeImagen(b);
    if (!tipo || !medidas || medidas.ancho < 8 || medidas.alto < 8) return null;
    const id = randomUUID();
    const ruta = `${ws}/${id}.${tipo.ext}`;
    const bucket = getSupabaseServer().storage.from(BUCKET_IMAGE);
    const up = await bucket.upload(ruta, b, { contentType: tipo.mime, upsert: false, cacheControl: '31536000' });
    if (up.error) return null;
    const url = bucket.getPublicUrl(ruta).data.publicUrl;
    const db = await getTenantDb();
    const ins = await db.from('image_subidos').insert({
      id, workspace_id: ws, nombre, tipo: tipo.mime, ancho: medidas.ancho, alto: medidas.alto, bytes: b.length, ruta, url,
    });
    if (ins.error) return null;
    return { id, url, ancho: medidas.ancho, alto: medidas.alto };
  } catch (e) {
    console.warn('[carruseles] no pude preparar la foto del cliente:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Qué se replica: un carrusel (o un anuncio) del explorador, o una miniatura de YouTube de la biblioteca de Thumbnails. */
export type EjemploAReplicar = { que: 'carrusel'; id: number } | { que: 'thumbnail'; id: number } | { que: 'vertical'; id: string };

export type OpcionesReplica = {
  pedido?: string | null;
  alEvento?: (e: EventoReplica) => void;
  timeoutMs?: number;
  /**
   * EN SECO (el comando de prueba de la PC, scripts/carruseles-probar-editar.mts): corre TODO (las láminas, la IA del negocio,
   * leer lo que devolvió) pero no copia la foto del cliente ni guarda el diseño. El resultado trae el documento y los errores.
   */
  seco?: boolean;
  /**
   * Lo que contestó el dueño en el guiado (9/11/2026, lib/carruseles/guiado.ts): la oferta, la foto que va en lugar de la persona y
   * qué cambia. Sin esto, lo de siempre (la API vieja y el comando de prueba).
   */
  guiado?: PedidoGuiado | null;
  /**
   * El nombre del negocio cuando quien pide está INSPECCIONANDO esa cuenta (14/11/2026; la ruta lo saca de lib/vista-de-otro.ts).
   * La IA que escribe es la de ese negocio (`conSuIADelNegocio(ws)`), y si falla, el aviso la nombra en vez de decir «Tu IA».
   */
  negocioAjeno?: string | null;
};

/** «Editar» el carrusel `id` (o el anuncio) del explorador: lo que llama la API de MaKo. */
export function replicarCarrusel(ws: number, quien: string, id: number, o: OpcionesReplica = {}): Promise<ResultadoReplica> {
  return replicarEjemplo(ws, quien, { que: 'carrusel', id }, o);
}

/**
 * «Editar» un ejemplo en el negocio `ws`: lo arma con la IA del negocio y lo guarda en el Image Editor. `alEvento` recibe el
 * armado en vivo; sin él, sólo el resultado (la API de MaKo). Nunca tira.
 */
export async function replicarEjemplo(ws: number, quien: string, ej: EjemploAReplicar, o: OpcionesReplica = {}): Promise<ResultadoReplica> {
  const avisar = (e: EventoReplica) => { try { o.alEvento?.(e); } catch { /* la pantalla se fue */ } };
  // Una miniatura: la de YouTube (16:9) o la vertical (9:16, la portada de un reel). Las dos son UNA lámina.
  const vertical = ej.que === 'vertical';
  const miniatura = ej.que === 'thumbnail' || vertical;
  let c: Carrusel | null = null;
  let t: Thumbnail | null = null;
  let v: Vertical | null = null;
  try {
    if (ej.que === 'thumbnail') { const { thumbnailPorId } = await import('../thumbnails/servidor'); t = await thumbnailPorId(ej.id); }
    else if (ej.que === 'vertical') { const { verticalPorId } = await import('../thumbnails/verticales-servidor'); v = await verticalPorId(ej.id); }
    else c = await referenciaDelNegocio(ej.id);
  } catch { return { ok: false, error: miniatura ? 'No pude leer esa miniatura. Vuelve a intentar.' : 'No pude leer ese carrusel. Vuelve a intentar.', falla: true }; }
  if (!c && !t && !v) return { ok: false, error: miniatura ? 'Esa miniatura ya no está: elige otra.' : 'Ese ejemplo ya no está: elige otro.' };

  const anuncio = c?.clase === 'anuncio';
  // La miniatura de YouTube: la grande si la tiene, si no la de siempre (`hq` existe en todos los videos). La vertical: su portada.
  const urls = t ? [imagenDeVideo(t.video, 'max'), imagenDeVideo(t.video, 'hq')] : v ? [v.miniatura] : imagenesDe(c as Carrusel).slice(0, IMAGENES_MAX);
  const total = miniatura || anuncio ? 1 : Math.max(1, Math.min(LAMINAS_MAX, c?.laminas ?? urls.length ?? 1));
  let imagenes: string[];
  if (t) { const una = (await comoDataUrl(urls[0])) ?? (await comoDataUrl(urls[1])); imagenes = una ? [una] : []; }
  else imagenes = (await Promise.all(urls.map(comoDataUrl))).filter((x): x is string => !!x);
  avisar({ fase: 'leer', laminas: total, vistas: Math.min(imagenes.length, total) });

  const [{ contextoDelNegocio, vozDelNegocio }, kit] = await Promise.all([import('../negocio-para-crear'), kitParaUsar().catch(() => null)]);
  const marca = await marcaDelNegocio(ws, kit);

  /** Las páginas de un diseño, de a una, a la pantalla (también las de las guías: así el modal nunca queda en blanco). */
  const mostrar = (doc: Record<string, unknown>) => {
    const paginas = (doc.pages as Record<string, unknown>[]) ?? [];
    paginas.forEach((pagina, indice) => avisar({ fase: 'lamina', indice, total: paginas.length, pagina, ancho: doc.width as number, alto: doc.height as number }));
  };

  /** Sin IA (o sin láminas que mirar): la estructura del ejemplo, editable, con guías. */
  const conGuias = async (motivo: { aviso: string; conectar: string | null } | null, errores: string[] = []): Promise<ResultadoReplica> => {
    const fin = (r: { id: string; titulo: string; doc: Record<string, unknown> }): ResultadoReplica => {
      mostrar(r.doc);
      avisar({ fase: 'fin', ok: true, id: r.id, titulo: r.titulo, sinIA: true, aviso: motivo?.aviso ?? null, conectar: motivo?.conectar ?? null });
      return { ok: true, id: r.id, titulo: r.titulo, sinIA: true, aviso: motivo?.aviso ?? null, conectar: motivo?.conectar ?? null, doc: r.doc, vistas: imagenes.length, errores };
    };
    if (t || v) {
      const doc = documentoGuiaMiniatura({ marca, nuevoId: randomUUID, notas: t ? notasDeMiniatura(t) : notasDeVertical(v as Vertical), vertical });
      const titulo = 'Miniatura · guía';
      if (o.seco) return fin({ id: '(seco)', titulo, doc });
      const r = await crearDiseno(ws, quien, { titulo, doc });
      if (!r.ok) return { ok: false, error: r.error, falla: true };
      return fin({ id: r.id, titulo, doc });
    }
    // ⚠️ En seco se arma el documento igual y se muestra: hasta el 6/11/2026 esto devolvía acá mismo, sin `doc` ni láminas, así
    // que el comando de prueba NO podía ver justo lo que se había arreglado ese día (que el camino de guías mande sus láminas
    // a la pantalla, en vez de dejar el modal en blanco). Un modo de prueba que saltea un paso no prueba ese paso.
    const est = estructuraDe(c as Carrusel);
    const r = await crearCarruselDesdeReferencia(ws, quien, (c as Carrusel).id, est.tipo ?? 'lista', anuncio ? 3 : total, { seco: o.seco });
    if (!r.ok) return { ok: false, error: r.error, falla: r.falla };
    return fin(r);
  };

  // La oferta que eligió el dueño en el guiado: se vuelve a leer de SU base (un id de otro negocio no está ahí). Una que ya no
  // está activa no se cambia por otra en silencio: se dice, y el guiado vuelve a preguntar.
  const g = o.guiado ?? null;
  let oferta: OfertaDelPrompt | null = null;
  if (g?.ofertaId) {
    try {
      const { listarOfertas } = await import('../ofertas');
      oferta = (await listarOfertas(true)).find((x) => x.id === g.ofertaId) ?? null;
    } catch { return { ok: false, error: 'No pude leer tus ofertas. Vuelve a intentar.', falla: true }; }
    if (!oferta) return { ok: false, error: 'Esa oferta ya no está activa: elige otra.' };
  } else if (g?.ofertaLibre) oferta = { nombre: g.ofertaLibre };
  const pedidoDelDueno = g ? g.pedido : o.pedido ?? null;

  const tema = t ? `miniatura de YouTube ${t.titulo ?? ''}` : v ? `portada de un reel ${v.titulo}` : `carrusel de Instagram ${c?.gancho ?? ''}`;
  const [negocio, voz, foto] = await Promise.all([
    contextoDelNegocio(`${tema} ${oferta?.nombre ?? ''} ${pedidoDelDueno ?? ''}`.trim()).catch(() => ''),
    vozDelNegocio().catch(() => null),
    // ⛔ La foto del negocio NO se pega en una réplica (Martín, 13/11/2026, sobre su foto de noche en la portada de @lifeofarjav:
    // «quiero que la elimines de todos lados… no que de pronto me ponga mi imagen. Queda muy, muy feo»). Donde el original tiene
    // una persona va la del negocio GENERADA con la IA de imagen (./plancha.ts), y mientras tanto su lugar queda marcado.
    Promise.resolve(null),
  ]);
  const coloresDeMarca = g?.cambio === 'marca' && kit?.colores.length ? kit.colores.map((x) => x.hex).filter((x) => /^#[0-9a-f]{6}$/i.test(x)) : null;
  const pedidoBase = {
    laminas: total, vistas: imagenes.length, negocio, voz: voz ?? '', nombreNegocio: marca.nombre, cta: c?.cta?.palabra ?? null,
    // Donde el original tiene una persona va la del negocio (generada con IA, nunca su foto), salvo que el dueño haya dicho «Sin
    // persona» en el guiado. La del original se borra de la plancha igual: el segundo pedido mira cada figura (./plancha-servidor.ts).
    conAvatar: imagenes.length > 0 && fotoDelGuiado(g) !== null, pedido: pedidoDelDueno, anuncio, pie: c ? c.texto || c.gancho || null : null,
    miniatura, vertical, tituloOriginal: t?.titulo ?? v?.titulo ?? null, oferta, coloresDeMarca,
  };
  // Cada lámina leída a píxeles, con sus renglones y figuras detectados (./plancha-servidor.ts): con eso se arma la plancha. Si
  // una no se pudo leer, la réplica sale como antes.
  const proporcion = vertical ? '9:16' : miniatura ? '16:9' : '4:5';
  const medidas = medidasDe(proporcion);
  const marcas = imagenes.length ? await marcarLaminas(imagenes, medidas.ancho, medidas.alto) : [];
  const conMarcas = marcas.length > 0 && marcas.every(Boolean);
  // ⚠️ La IA mira las láminas LIMPIAS (13/11/2026): con las figuras numeradas encima («F1», «F2») las listó como textos y corrió
  // todo el contenido una lámina. A la persona la reconoce el segundo pedido, que mira cada figura recortada.
  const paraLaIA = imagenes;
  const prompt = promptDeReplica(pedidoBase);
  avisar({ fase: 'escribir', con: 'tu IA' });
  const errores: string[] = [];
  let crudo = '';
  try {
    const { leerDocumentoIA, chatCheapCascade } = await import('../ai-cheap');
    const { conSuIADelNegocio } = await import('../ia-del-negocio');
    const motivo = vertical ? 'Editar una miniatura vertical de ejemplo' : miniatura ? 'Editar una miniatura de YouTube de ejemplo' : anuncio ? 'Editar un anuncio de ejemplo' : 'Editar un carrusel de ejemplo';
    /** Sin mirar las imágenes: la IA escribe la versión del negocio con el tema y el pie (`sinVer` es el prompt de 0 vistas). */
    const escribirSinVer = async (sinVer: string): Promise<string> => {
      // Por la CASCADA: su Claude primero, después su GPT o su Gemini (`chatCheap` suelto no probaba el Claude y cortaba en 512
      // tokens: así falló «Editar» el 6/11/2026 con un carrusel sin láminas).
      const x = await conSuIADelNegocio(ws, () => chatCheapCascade({
        system: 'Eres diseñador de carruseles de Instagram y miniaturas de YouTube para negocios. Respondes sólo con el JSON pedido.', user: sinVer, json: true,
        maxTokens: TOKENS_DE_SALIDA, temperature: 0.4, feature: FEATURE_REPLICA, motivo, timeoutMs: o.timeoutMs ?? 120_000, erroresOut: errores,
        validar: (y) => !('error' in leerReplica(y, { laminas: total, miniatura, vertical, usuario: marca.usuario, nombre: marca.nombre })),
      }));
      if (!x.trim()) throw new Error(errores.length ? errores.join(' · ') : 'sin_keys: no hay ninguna IA del negocio conectada');
      return x;
    };
    if (!imagenes.length) {
      crudo = await escribirSinVer(prompt);
    } else {
      try {
        const r = await conSuIADelNegocio(ws, () => leerDocumentoIA({
          dataUrl: paraLaIA[0], dataUrls: paraLaIA, isPdf: false, nombreArchivo: miniatura ? 'miniatura' : anuncio ? 'anuncio' : 'carrusel', prompt, json: true,
          feature: FEATURE_REPLICA, motivo, timeoutMs: o.timeoutMs ?? 120_000, maxTokens: TOKENS_DE_SALIDA,
        }));
        crudo = r.text;
      } catch (e) {
        // La IA que mira no pudo (no mira imágenes, las láminas no le entran, contestó vacío): se prueba UNA vez sin mirar, antes
        // de dejar guías. Lo que no se arregla con otro pedido (su cuenta, su clave, la demora) va derecho al aviso.
        const m = e instanceof Error ? e.message : String(e);
        errores.push(m);
        if (!vuelveASinVer(m)) throw e;
        avisar({ fase: 'escribir', con: 'tu IA, sin mirar las láminas' });
        crudo = await escribirSinVer(promptDeReplica({ ...pedidoBase, vistas: 0 }));
      }
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (!errores.includes(m)) errores.push(m);
    console.warn(`[carruseles] «Editar» sin la IA del negocio (ws=${ws}, ${ej.que} ${ej.id}): ${m.slice(0, 600)}`);
    return conGuias(avisoSinIA(m, o.negocioAjeno ?? null), errores);
  }
  const replica = leerReplica(crudo, { laminas: total, miniatura, vertical, usuario: marca.usuario, nombre: marca.nombre });
  // Lo que leyó la IA TAL CUAL (la plancha le suma y le saca textos a `replica`): en seco viaja esto, para repetir la plancha.
  const leidaDeLaIA = o.seco && !('error' in replica) ? structuredClone(replica) : null;
  if ('error' in replica) {
    console.warn(`[carruseles] «Editar»: la IA contestó algo que no se pudo leer (ws=${ws}): ${crudo.slice(0, 300)}`);
    return conGuias({ aviso: `${replica.error} Por ahora, cada lámina trae una guía.`, conectar: null }, [...errores, replica.error]);
  }

  const estilo = estiloSinSerif(estiloConKit((tipoCarrusel((c ? estructuraDe(c).tipo : null) ?? 'lista') ?? tipoCarrusel('lista'))!.estilo, kit, fuenteDelEditorDeImagen), kit);
  // La escena PARECIDA de cada cuadro de tipo «escena» (11/11/2026): nunca la foto del negocio pegada como si fuera el lugar.
  // La réplica FIEL (13/11/2026): cada lámina original sin sus letras, de fondo, con los textos nuevos encima en su lugar exacto
  // (./plancha-local.ts). Así quedan las capturas, el marco y los íconos del original, que el JSON de la IA no sabe decir. Una
  // lámina que no se puede planchar (texto sobre una foto) vuelve todo al armado de antes, que busca escenas parecidas.
  const planchas = conMarcas && replica.proporcion === proporcion
    ? await planchasDeLaReplica(ws, replica, marcas.map((m) => m!.leida), {
      seco: !!o.seco,
      lugarDePersona: pedidoBase.conAvatar,
      // Lo que la IA no listó (un encabezado, una pastilla, una persona) va recortado en un segundo pedido, con la misma IA del
      // negocio: sólo tiene que leer y adaptar (./plancha-servidor.ts → `completarLoQueFalta`).
      completar: async (p) => {
        try {
          const { leerDocumentoIA } = await import('../ai-cheap');
          const { conSuIADelNegocio } = await import('../ia-del-negocio');
          const r = await conSuIADelNegocio(ws, () => leerDocumentoIA({
            dataUrl: p.recortes[0], dataUrls: p.recortes, isPdf: false, nombreArchivo: 'recortes', json: true,
            prompt: promptDeCompletar({ textos: p.textos, figuras: p.figuras, nombreNegocio: marca.nombre, contexto: p.contexto, oferta }),
            feature: FEATURE_REPLICA, motivo: 'Leer lo que faltaba de un carrusel de ejemplo', timeoutMs: 90_000, maxTokens: 4_000,
          }));
          return leerCompletado(r.text, { textos: p.textos, figuras: p.figuras, usuario: marca.usuario, nombre: marca.nombre });
        } catch (e) {
          console.warn(`[carruseles] el segundo pedido (lo que faltaba) no contestó (ws=${ws}): ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}`);
          return null;
        }
      },
    })
    : replica.laminas.map(() => null);
  const fiel = planchas.every(Boolean);
  const escenas = fiel ? new Map<string, FotoDelCliente>() : await escenasParecidas(ws, replica, !!o.seco);
  const notasBase = t ? notasDeMiniatura(t) : v ? notasDeVertical(v) : notasDeReplica(c as Carrusel);
  const notas = replica.lectura ? `${notasBase}

Lo que leí del original: ${replica.lectura}` : notasBase;
  const doc = documentoDeReplica({ replica, estilo, marca, foto, nuevoId: randomUUID, notas, conFuentesDeMarca: !!kit?.fuentes.titulos, escenas, lugarDePersona: pedidoBase.conAvatar, ...(fiel ? { planchas } : {}) });
  mostrar(doc);
  const titulo = `${vertical ? 'Miniatura vertical' : miniatura ? 'Miniatura' : anuncio ? 'Anuncio' : 'Carrusel'} · ${replica.titulo}`.slice(0, 120);
  const cuadros = replica.laminas.flatMap((l) => l.cuadros ?? []);
  const conPersona = pedidoBase.conAvatar && (cuadros.some((x) => x.persona) || replica.laminas.some((l) => l.personas?.length));
  // Las cifras que no salen del negocio (la regla de Copywriting): se avisan, como allá.
  const cifras = cifrasDeLaReplica(replica, [negocio, voz ?? '', oferta ? bloqueDeOferta(oferta) : '', pedidoDelDueno ?? ''].join('\n'));
  const aviso = [
    conPersona ? 'Donde el original tiene una persona dejé su lugar marcado: ahí vas tú, generado con IA en el mismo estilo (necesita Google Flow abierto desde el ícono de MaKo).' : '',
    cifras.length ? `Revisa ${cifras.length === 1 ? 'esta cifra' : 'estas cifras'}: no salen de tu negocio (${cifras.join(', ')}). Cámbialas por algo tuyo o sácalas.` : '',
  ].filter(Boolean).join(' ') || null;
  // En seco viaja también lo que leyó la IA y las láminas que miró: el script lo guarda para probar la plancha sin pagar otra IA.
  if (o.seco) return { ok: true, id: '(seco)', titulo, aviso, doc, vistas: imagenes.length, errores, replica: leidaDeLaIA ?? replica, imagenes, marcadas: conMarcas ? marcas.map((m) => m!.marcada) : [] };
  const r = await crearDiseno(ws, quien, { titulo, doc });
  if (!r.ok) return { ok: false, error: r.error, falla: true };
  avisar({ fase: 'fin', ok: true, id: r.id, titulo, aviso });
  return { ok: true, id: r.id, titulo, aviso, vistas: imagenes.length };
}

/**
 * La escena PARECIDA de cada cuadro «escena» de la réplica (11/11/2026): una foto libre del banco (Openverse y Picsum,
 * lib/imagenes-stock.ts) por cada búsqueda que escribió la IA (en inglés, «rocky beach at sunset»), copiada a nuestro bucket.
 * UNA por búsqueda: el original repite el mismo lugar en todas sus láminas, y la réplica también. En seco, se busca sin copiar
 * (la URL del proveedor: no se guarda nada). Hasta `ESCENAS_MAX` búsquedas, A LA VEZ. Nunca tira: un cuadro cuya búsqueda no trajo
 * nada lleva otra escena de la réplica, y una lámina sin ninguna se arma como tipografía (`documentoDeReplica`).
 *
 * ⚠️ 12/11/2026, «traer tu outlier» de @vilmanunez (10 láminas con fotos de salones): eran «hasta 3» y de a una. La IA escribe una
 * búsqueda por cuadro (salón, sala de reuniones, escenario…), así que 7 de 10 láminas quedaron con un hueco amarillo del tamaño de
 * la foto. «El original repite el mismo lugar» vale para @jasonrewired_, no para todos.
 */
async function escenasParecidas(ws: number, replica: Replica, seco: boolean): Promise<Map<string, FotoDelCliente>> {
  const out = new Map<string, FotoDelCliente>();
  const cuadros = replica.laminas.flatMap((l) => l.cuadros ?? []).filter((c) => c.tipo === 'escena' && c.busqueda);
  const busquedas = [...new Set(cuadros.map((c) => c.busqueda))].slice(0, ESCENAS_MAX);
  if (!busquedas.length) return out;
  const { buscarStock, buscarYCopiar } = await import('../imagenes-stock');
  await Promise.all(busquedas.map(async (q) => {
    try {
      const c = cuadros.find((x) => x.busqueda === q)!;
      const orientacion = c.ancho * 1080 >= c.alto * 1350 ? 'horizontal' : 'vertical';
      let url: string | null = null;
      if (seco) { const r = await buscarStock(q, 1, orientacion); url = r.ok ? r.fotos[0]?.grande ?? null : null; }
      else url = await buscarYCopiar(q, ws, orientacion);
      if (!url) return;
      const r = await fetch(url, { signal: AbortSignal.timeout(ESPERA_IMAGEN_MS * 2), cache: 'no-store' });
      if (!r.ok) return;
      const medidas = medidasDeImagen(new Uint8Array(await r.arrayBuffer()));
      if (!medidas) return;
      out.set(q, { id: '', url, ancho: medidas.ancho, alto: medidas.alto });
    } catch (e) {
      console.warn(`[carruseles] sin escena parecida para «${q.slice(0, 60)}»:`, e instanceof Error ? e.message : e);
    }
  }));
  return out;
}

/** Cuántas escenas parecidas se buscan como mucho por réplica (cada una es una búsqueda y una copia al bucket, en paralelo). */
const ESCENAS_MAX = 8;

/** Las notas de la miniatura (no salen en la imagen): de qué video salió el diseño. */
function notasDeMiniatura(t: Thumbnail): string {
  const quien = t.canal.handle || t.canal.nombre;
  return `Diseño tomado de la miniatura de un video de ${quien} (${urlDeVideo(t.video)}). Los textos son tuyos: cámbialos como quieras.`;
}

/**
 * La lectura del guiado (9/11/2026): ¿el carrusel muestra a una persona?, ¿tiene un lettering dibujado? La IA DEL NEGOCIO mira
 * sus primeras láminas (`LAMINAS_DE_LA_LECTURA`). Decide QUÉ se pregunta (el avatar sólo si hay persona: «si es solo texto, que lo
 * detecte y no le pregunte eso»), no escribe nada. Sin IA, sin láminas o con una respuesta que no se entiende: `null` en cada
 * campo — «no sé» no es «no»: con `null`, el guiado pregunta el avatar igual (lib/carruseles/guiado.ts → `preguntaAvatar`).
 * Nunca tira.
 */
export async function leerLoQueTiene(ws: number, id: number): Promise<Lectura & { motivo?: string }> {
  const nada = (motivo: string): Lectura & { motivo: string } => ({ persona: null, lettering: null, motivo });
  let c: Carrusel | null;
  try { c = await referenciaDelNegocio(id); } catch { return nada('No pude leer ese carrusel.'); }
  if (!c) return nada('Ese ejemplo ya no está.');
  const imagenes = (await Promise.all(imagenesDe(c).slice(0, LAMINAS_DE_LA_LECTURA).map(comoDataUrl))).filter((x): x is string => !!x);
  if (!imagenes.length) return nada('No tengo sus láminas para mirar.');
  try {
    const { leerDocumentoIA } = await import('../ai-cheap');
    const { conSuIADelNegocio } = await import('../ia-del-negocio');
    const r = await conSuIADelNegocio(ws, () => leerDocumentoIA({
      dataUrl: imagenes[0], dataUrls: imagenes, isPdf: false, nombreArchivo: 'carrusel', prompt: PROMPT_LECTURA, json: true,
      feature: FEATURE_REPLICA, motivo: 'Ver si un carrusel de ejemplo tiene una persona', timeoutMs: 45_000, maxTokens: 120,
    }));
    return leerLectura(r.text);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn(`[carruseles] lectura del guiado sin la IA del negocio (ws=${ws}, ${id}): ${m.slice(0, 300)}`);
    return nada(m.slice(0, 200));
  }
}
