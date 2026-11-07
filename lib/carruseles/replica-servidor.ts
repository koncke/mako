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
//      se arma: AGENTS.md, «Lo que MaKo construye se ve CONSTRUYÉNDOSE»);
//   6. y las fotos que le faltan a una lámina con gente se le PIDEN a la IA de imagen del negocio (./foto-lamina.ts), sin
//      esperarlas: la que genera es la pestaña del cliente, y se asientan en el diseño al abrirlo.
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
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSupabaseServer } from '../supabase';
import { crearDiseno } from '../image-editor/server';
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
  IMAGENES_MAX, LAMINAS_MAX, avisoSinIA, documentoDeReplica, esCdnPermitido, documentoGuiaMiniatura, fotosAGenerar, leerReplica, medidasDeImagen, notasDeReplica, promptDeReplica,
  vuelveASinVer, type EventoReplica, type FotoDelCliente, type PedidoDeFotoLamina,
} from './replica';
import { imagenDeVideo, urlDeVideo, type Thumbnail } from '../thumbnails/explorar';

/** La función de la IA para el registro del uso y la puerta de «sólo su IA» (lib/model-catalogo.ts). */
export const FEATURE_REPLICA = 'carrusel-replica';
/** Cuánto se espera a cada lámina (es nuestro bucket o un CDN: si tarda más, algo anda mal). */
const ESPERA_IMAGEN_MS = 8_000;
const PESO_MAXIMO = 4 * 1024 * 1024;
/** Lo que puede escribir el modelo: un carrusel de 12 láminas con 8 textos cada una, en JSON. 512 (el de `chatCheap`) no alcanza. */
const TOKENS_DE_SALIDA = 8_000;

export type ResultadoReplica =
  | {
    ok: true; id: string; titulo: string; sinIA?: boolean; aviso?: string | null; conectar?: string | null;
    doc?: Record<string, unknown>; vistas?: number; errores?: string[];
    /** Una NOTA que no hay que arreglar (la foto que la IA de imagen está armando): no frena el salto al editor. */
    nota?: string | null;
    /** Cuántas fotos de lámina quedaron pedidas a la IA de imagen del negocio (./foto-lamina.ts). */
    fotosPedidas?: number;
    /** EN SECO: qué fotos se le habrían pedido (en seco no se le pide nada a la pestaña del cliente). */
    aGenerar?: PedidoDeFotoLamina[];
  }
  | { ok: false; error: string; falla?: boolean; conectar?: string | null };

/** De dónde se puede bajar una imagen para la IA: NUESTRO bucket y los CDN de las fuentes (./replica.ts, `esCdnPermitido`). */
export const esImagenPermitida = (url: string): boolean => esNuestra(url) || esCdnPermitido(url);

/** Una imagen (de NUESTRO bucket o de un CDN permitido) como data URL: lo que mira la IA. null si no se pudo. */
async function comoDataUrl(url: string): Promise<string | null> {
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
export type FotoDelClienteConOrigen = FotoDelCliente & {
  /**
   * El id de la foto de su cara de marca (lib/persona.ts) de la que salió. Es lo ÚNICO con lo que la IA de imagen puede
   * generarla en otra escena: `caraDeFoto` lo traduce al `mediaId` dentro de Flow. `null` cuando lo que hay es un look (ahí
   * la foto original puede no estar más).
   */
  fotoId: string | null;
};

export async function fotoDelCliente(ws: number, o: { seco?: boolean } = {}): Promise<FotoDelClienteConOrigen | null> {
  try {
    let bytes: Uint8Array | null = null;
    let nombre = 'Tu foto';
    let fotoId: string | null = null;
    const { getPersona } = await import('../persona');
    const persona = await getPersona().catch(() => null);
    const primera = persona?.fotos[0];
    if (primera) {
      const { data } = await getSupabaseServer().storage.from('archivero').download(primera.path);
      if (data) { bytes = new Uint8Array(await data.arrayBuffer()); nombre = 'Tu foto (cara de marca)'; fotoId = primera.id; }
    }
    if (!bytes) {
      const { leerLooks } = await import('@/app/ai-avatar/looks');
      const look = (await leerLooks().catch(() => [])).find((l) => /^https:\/\//.test(l.url) && !l.error);
      if (look) {
        const r = await fetch(look.url, { signal: AbortSignal.timeout(ESPERA_IMAGEN_MS) }).catch(() => null);
        if (r?.ok) { bytes = new Uint8Array(await r.arrayBuffer()); nombre = 'Tu foto (AI Avatar)'; fotoId = look.fotoId || null; }
      }
    }
    if (!bytes || bytes.length > 15 * 1024 * 1024) return null;
    const medidas = medidasDeImagen(bytes);
    if (!medidas || medidas.ancho < 8 || medidas.alto < 8) return null;
    // ⚠️ EN SECO SE AVERIGUA QUE LA FOTO EXISTE, PERO NO SE COPIA: el comando de prueba (scripts/carruseles-probar-editar.mts)
    // tiene que poder ver el camino CON foto —si no, `conAvatar` sale false y el prompt pide «no pongas fotos», justo el paso
    // que se quiere probar—. Es la regla del 6/11/2026: un modo de prueba sólo puede dejar de ESCRIBIR.
    if (o.seco) return { id: '(seco)', url: 'seco://tu-foto', ancho: medidas.ancho, alto: medidas.alto, fotoId };
    const { subirAlEditor } = await import('./foto-lamina');
    const subida = await subirAlEditor(ws, bytes, nombre);
    return subida ? { ...subida, fotoId } : null;
  } catch (e) {
    console.warn('[carruseles] no pude preparar la foto del cliente:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Qué se replica: un carrusel (o un anuncio) del explorador, o una miniatura de YouTube de la biblioteca de Thumbnails. */
export type EjemploAReplicar = { que: 'carrusel'; id: number } | { que: 'thumbnail'; id: number };

export type OpcionesReplica = {
  pedido?: string | null;
  alEvento?: (e: EventoReplica) => void;
  timeoutMs?: number;
  /**
   * EN SECO (el comando de prueba de la PC, scripts/carruseles-probar-editar.mts): corre TODO (las láminas, la IA del negocio,
   * leer lo que devolvió) pero no copia la foto del cliente ni guarda el diseño. El resultado trae el documento y los errores.
   */
  seco?: boolean;
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
  const miniatura = ej.que === 'thumbnail';
  let c: Carrusel | null = null;
  let t: Thumbnail | null = null;
  try {
    if (miniatura) { const { thumbnailPorId } = await import('../thumbnails/servidor'); t = await thumbnailPorId(ej.id); }
    else c = await referenciaDelNegocio(ej.id);
  } catch { return { ok: false, error: miniatura ? 'No pude leer esa miniatura. Vuelve a intentar.' : 'No pude leer ese carrusel. Vuelve a intentar.', falla: true }; }
  if (!c && !t) return { ok: false, error: miniatura ? 'Esa miniatura ya no está: elige otra.' : 'Ese ejemplo ya no está: elige otro.' };

  const anuncio = c?.clase === 'anuncio';
  // La miniatura de YouTube: la grande si la tiene, si no la de siempre (`hq` existe en todos los videos).
  const urls = t ? [imagenDeVideo(t.video, 'max'), imagenDeVideo(t.video, 'hq')] : imagenesDe(c as Carrusel).slice(0, IMAGENES_MAX);
  const total = t || anuncio ? 1 : Math.max(1, Math.min(LAMINAS_MAX, c?.laminas ?? urls.length ?? 1));
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
    if (t) {
      const doc = documentoGuiaMiniatura({ marca, nuevoId: randomUUID, notas: notasDeMiniatura(t) });
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
    const r = await crearCarruselDesdeReferencia(ws, quien, ej.id, est.tipo ?? 'lista', anuncio ? 3 : total, { seco: o.seco });
    if (!r.ok) return { ok: false, error: r.error, falla: r.falla };
    return fin(r);
  };

  const tema = t ? `miniatura de YouTube ${t.titulo ?? ''}` : `carrusel de Instagram ${c?.gancho ?? ''}`;
  const [negocio, voz, foto, conIAdeImagen] = await Promise.all([
    contextoDelNegocio(`${tema} ${o.pedido ?? ''}`.trim()).catch(() => ''),
    vozDelNegocio().catch(() => null),
    fotoDelCliente(ws, { seco: o.seco }),
    // La IA de IMAGEN es el Flow del cliente por su extensión: se pregunta si está ANTES de prometerle una foto a la lámina.
    // Dinámico a propósito: un «Editar» de un negocio sin extensión no tiene por qué cargar el puente entero.
    import('./foto-lamina').then((m) => m.puedeGenerarFotos()).catch(() => false),
  ]);
  const pedidoBase = {
    laminas: total, vistas: imagenes.length, negocio, voz: voz ?? '', nombreNegocio: marca.nombre, cta: c?.cta?.palabra ?? null,
    conAvatar: !!foto, conIAdeImagen, pedido: o.pedido ?? null, anuncio, pie: c ? c.texto || c.gancho || null : null,
    miniatura, tituloOriginal: t?.titulo ?? null,
  };
  const prompt = promptDeReplica(pedidoBase);
  avisar({ fase: 'escribir', con: 'tu IA' });
  const errores: string[] = [];
  let crudo = '';
  try {
    const { leerDocumentoIA, chatCheapCascade } = await import('../ai-cheap');
    const { conSuIADelNegocio } = await import('../ia-del-negocio');
    const motivo = miniatura ? 'Editar una miniatura de YouTube de ejemplo' : anuncio ? 'Editar un anuncio de ejemplo' : 'Editar un carrusel de ejemplo';
    /** Sin mirar las imágenes: la IA escribe la versión del negocio con el tema y el pie (`sinVer` es el prompt de 0 vistas). */
    const escribirSinVer = async (sinVer: string): Promise<string> => {
      // Por la CASCADA: su Claude primero, después su GPT o su Gemini (`chatCheap` suelto no probaba el Claude y cortaba en 512
      // tokens: así falló «Editar» el 6/11/2026 con un carrusel sin láminas).
      const x = await conSuIADelNegocio(ws, () => chatCheapCascade({
        system: 'Eres diseñador de carruseles de Instagram y miniaturas de YouTube para negocios. Respondes sólo con el JSON pedido.', user: sinVer, json: true,
        maxTokens: TOKENS_DE_SALIDA, temperature: 0.4, feature: FEATURE_REPLICA, motivo, timeoutMs: o.timeoutMs ?? 120_000, erroresOut: errores,
        validar: (y) => !('error' in leerReplica(y, { laminas: total, miniatura, usuario: marca.usuario })),
      }));
      if (!x.trim()) throw new Error(errores.length ? errores.join(' · ') : 'sin_keys: no hay ninguna IA del negocio conectada');
      return x;
    };
    if (!imagenes.length) {
      crudo = await escribirSinVer(prompt);
    } else {
      try {
        const r = await conSuIADelNegocio(ws, () => leerDocumentoIA({
          dataUrl: imagenes[0], dataUrls: imagenes, isPdf: false, nombreArchivo: miniatura ? 'miniatura' : anuncio ? 'anuncio' : 'carrusel', prompt, json: true,
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
    return conGuias(avisoSinIA(m), errores);
  }
  const replica = leerReplica(crudo, { laminas: total, miniatura, usuario: marca.usuario });
  if ('error' in replica) {
    console.warn(`[carruseles] «Editar»: la IA contestó algo que no se pudo leer (ws=${ws}): ${crudo.slice(0, 300)}`);
    return conGuias({ aviso: `${replica.error} Por ahora, cada lámina trae una guía.`, conectar: null }, [...errores, replica.error]);
  }

  const estilo = estiloSinSerif(estiloConKit((tipoCarrusel((c ? estructuraDe(c).tipo : null) ?? 'lista') ?? tipoCarrusel('lista'))!.estilo, kit, fuenteDelEditorDeImagen), kit);
  // Las fotos que le faltan a la lámina y la IA de IMAGEN del negocio puede armar (./foto-lamina.ts): su lugar se RESERVA
  // acá, antes de dibujar, para que la foto que llegue después no le caiga encima al titular.
  const aGenerar = conIAdeImagen ? fotosAGenerar(replica, { tieneCara: !!foto?.fotoId }) : [];
  const doc = documentoDeReplica({
    replica, estilo, marca, foto, nuevoId: randomUUID, notas: t ? notasDeMiniatura(t) : notasDeReplica(c as Carrusel),
    conFuentesDeMarca: !!kit?.fuentes.titulos, reservadas: aGenerar.map((p) => p.lamina),
  });
  mostrar(doc);
  const titulo = `${miniatura ? 'Miniatura' : anuncio ? 'Anuncio' : 'Carrusel'} · ${replica.titulo}`.slice(0, 120);
  const faltaSuFoto = !foto && replica.laminas.some((l) => l.foto?.quien === 'dueno');
  const avisoFoto = faltaSuFoto ? 'Sube tu foto en AI Avatar o en tu cara de marca y va donde el ejemplo tiene una persona.' : null;
  if (o.seco) return { ok: true, id: '(seco)', titulo, aviso: avisoFoto, doc, vistas: imagenes.length, errores, aGenerar };
  const r = await crearDiseno(ws, quien, { titulo, doc });
  if (!r.ok) return { ok: false, error: r.error, falla: true };
  // Las fotos se PIDEN con el diseño ya guardado (el pendiente apunta a su id) y no se esperan: la que genera es la pestaña
  // del cliente. Se asientan al abrir el diseño (`asentarFotosDeLamina`).
  const pedidas: { pedidas: number; nota: string | null } = aGenerar.length
    ? await import('./foto-lamina')
      .then((m) => m.pedirFotosDeLamina(ws, r.id, aGenerar, { fotoId: foto?.fotoId ?? null }))
      .catch((e) => { console.warn('[carruseles] no pude pedirle la foto a la IA de imagen:', e instanceof Error ? e.message : e); return { pedidas: 0, nota: null }; })
    : { pedidas: 0, nota: null };
  avisar({ fase: 'fin', ok: true, id: r.id, titulo, aviso: avisoFoto, nota: pedidas.nota });
  return { ok: true, id: r.id, titulo, aviso: avisoFoto, nota: pedidas.nota, vistas: imagenes.length, fotosPedidas: pedidas.pedidas };
}

/** Las notas de la miniatura (no salen en la imagen): de qué video salió el diseño. */
function notasDeMiniatura(t: Thumbnail): string {
  const quien = t.canal.handle || t.canal.nombre;
  return `Diseño tomado de la miniatura de un video de ${quien} (${urlDeVideo(t.video)}). Los textos son tuyos: cámbialos como quieras.`;
}
