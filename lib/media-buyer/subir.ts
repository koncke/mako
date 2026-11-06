// =============================================================================
// Media Buyer — SUBIR CREATIVOS NUEVOS a un conjunto (el servidor)
// =============================================================================
// El navegador sube cada archivo al staging de siempre (bucket privado, `creative-signurl`); acá se arma una URL firmada
// por una hora y Zernio crea UN anuncio por archivo dentro del conjunto elegido (lib/media-buyer/creativos.ts). Lo creado
// queda como una decisión «hecha» (`crear_anuncios`, táctica `manual`) con los ids de los anuncios nuevos: «Deshacer» los
// borra. Sin la Zernio del negocio conectada no se puede: con su token propio, Meta rechaza el creativo nuevo (1885183).
//
// Y un video que MaKo YA GENERÓ (6/11/2026, lo prometido a Thiago: el video del AI Avatar o del Video Generator, sin bajarlo y
// volverlo a subir): llega por su `ref` (lib/creativo-mako.ts) y se resuelve ACÁ, en el negocio de la sesión, con la MISMA
// función que armó la lista (resolverCreativoMako). Su archivo está en el bucket público `video-clips`, que no vence: Zernio
// lo baja de ahí. Una ref que no es de este negocio, o una toma que se volvió a filmar después de elegirla, no se publica.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { ADS_CREATIVES_BUCKET, getAdForEdit } from '@/lib/meta-ads-create';
import { esPathDeStaging } from '@/lib/ads-staging';
import { leerRefCreativo, type CreativoMako } from '@/lib/creativo-mako';
import { montadosDelWorkspace, resolverCreativoMako, tomasDelWorkspace } from '@/lib/creativo-mako-fuentes';
import { crearAnuncioPorZernio, leerAnuncioPorZernio, leerErrorDeZernio } from '@/lib/zernio-ads';
import { leerDatosCuenta, type DatosCuenta } from './datos';
import { resultados } from './motor';
import { leerConfig, guardarPropuestas, reclamar, actualizar } from './store';
import { CTAS, archivoValido, cuerpoCreativoEnConjunto, errorDeTextos, nombreDeAnuncio, type ArchivoSubido, type ConjuntoParaSubir, type Cta, type TextosCreativo } from './creativos';
export type { ConjuntoParaSubir } from './creativos';
import type { NodoMB } from './motor';


const prendidoEn = (datos: DatosCuenta, n: NodoMB): boolean => {
  const porId = new Map(datos.arbol.map((x) => [x.id, x] as const));
  let x: NodoMB | undefined = n;
  while (x) { if (x.configurado !== 'ACTIVE') return false; if (!x.parentId) return true; x = porId.get(x.parentId); }
  return false;
};

/** Los conjuntos de la cuenta, los prendidos primero: a dónde se puede subir. */
export function conjuntosDe(datos: DatosCuenta): ConjuntoParaSubir[] {
  const porId = new Map(datos.arbol.map((x) => [x.id, x] as const));
  return datos.arbol.filter((n) => n.nivel === 'adset').map((s) => ({
    id: s.id, nombre: s.nombre,
    campana: s.parentId ? porId.get(s.parentId)?.nombre ?? null : null,
    prendido: prendidoEn(datos, s),
    anuncios: datos.arbol.filter((a) => a.parentId === s.id).length,
  })).sort((a, b) => Number(b.prendido) - Number(a.prendido) || a.nombre.localeCompare(b.nombre));
}

/**
 * Los textos de partida para un conjunto: los del anuncio que MÁS resultados trajo en él (7 días), o del primero que
 * haya. Lo nuevo se prueba contra el ganador con su mismo destino y su mismo botón.
 */
export async function plantillaDelConjunto(ws: number, datos: DatosCuenta, adSetId: string): Promise<{ textos: TextosCreativo; deAnuncio: string | null }> {
  const config = await leerConfig(ws);
  const ads = datos.arbol.filter((a) => a.parentId === adSetId && a.nivel === 'ad');
  const res = (id: string) => { const s = datos.larga.find((x) => x.adId === id); return s ? resultados(s, config.kpi) : 0; };
  const mejor = [...ads].sort((a, b) => res(b.id) - res(a.id) || Number(b.configurado === 'ACTIVE') - Number(a.configurado === 'ACTIVE'))[0] ?? null;
  const vacio: TextosCreativo = { textoPrincipal: '', titulo: '', cta: 'LEARN_MORE', link: null, formularioId: null };
  if (!mejor) return { textos: vacio, deAnuncio: null };
  try {
    const a = await runWithWorkspace(ws, () => getAdForEdit(mejor.id));
    if (a.creative) {
      const cta = (CTAS as readonly string[]).includes(a.creative.cta_type ?? '') ? (a.creative.cta_type as Cta) : (a.creative.lead_form_id ? 'SIGN_UP' : 'LEARN_MORE');
      return {
        textos: {
          textoPrincipal: a.creative.primary_text ?? '', titulo: a.creative.headline ?? '', cta,
          link: a.creative.destination_url?.startsWith('https://') ? a.creative.destination_url : null, formularioId: a.creative.lead_form_id ?? null,
        },
        deAnuncio: mejor.nombre,
      };
    }
  } catch { /* sin token propio: se prueba Zernio */ }
  const z = await leerAnuncioPorZernio(ws, mejor.id).catch(() => null);
  return { textos: { ...vacio, textoPrincipal: z?.body ?? '', link: z?.linkUrl?.startsWith('https://') ? z.linkUrl : null }, deAnuncio: mejor.nombre };
}

export type ResultadoSubida = { ok: true; creados: string[]; errores: string[]; decisionId: string | null } | { ok: false; error: string };

/** Un archivo ya revisado: los de MaKo, con su url pública resuelta en el negocio (nunca la que mandó el navegador). */
export type ArchivoRevisado = ArchivoSubido & { url?: string };

export type SubidaRevisada = {
  ok: true; datos: DatosCuenta; conjunto: NodoMB; campana: string | null; archivos: ArchivoRevisado[];
  /** El anuncio del conjunto contra el que se prueban, si se pidió (ver `PedidoDeSubida.original`). */
  original: NodoMB | null;
} | { ok: false; error: string };

/**
 * Los videos que MaKo ya generó en este negocio, para elegirlos en «Subir creativos» (y en «Usar en un anuncio»): el anuncio
 * montado y las tomas del Video Generator y del AI Avatar, del más nuevo al más viejo. Las MISMAS lecturas que resuelven una
 * ref (lib/creativo-mako-fuentes.ts). Tira si no pudo leer: «no pude» no es «no tienes videos».
 */
export async function generadosDelNegocio(ws: number, tope = 40): Promise<CreativoMako[]> {
  return runWithWorkspace(ws, async () => {
    const [montados, tomas] = await Promise.all([montadosDelWorkspace(), tomasDelWorkspace()]);
    return [...montados, ...tomas].slice(0, tope);
  });
}

/**
 * Lo que se puede saber de una subida SIN escribir: el registro, los textos, los archivos (sólo paths del staging, hasta 10),
 * la Zernio del negocio y que el conjunto sea de su cuenta. La llaman `subirCreativos` (la pantalla y el «sí» de la API) y la
 * API de MaKo al PROPONER (subir_creativos_media_buyer): lo que va a fallar falla antes de que una persona lo confirme.
 */
export async function revisarSubida(ws: number, x: { adSetId: string; archivos: ArchivoSubido[]; textos: TextosCreativo; original?: string | null }): Promise<SubidaRevisada> {
  const config = await leerConfig(ws);
  if (!config.existeTabla) return { ok: false, error: 'Falta aplicar la migración del Media Buyer: sin el registro no se publica nada (no se podría deshacer).' };
  const errTextos = errorDeTextos(x.textos);
  if (errTextos) return { ok: false, error: errTextos };
  const validos = x.archivos.filter((a) => archivoValido(a, esPathDeStaging) && (a.tipo === 'image' || a.tipo === 'video')).slice(0, 10);
  if (!validos.length) return { ok: false, error: 'No llegó ningún archivo.' };
  // Los de MaKo se resuelven en ESTE negocio: lo que no está (otro negocio, una toma que ya no se ofrece) o cambió desde que se
  // eligió no se publica, y se dice cuál.
  const archivos: ArchivoRevisado[] = [];
  for (const a of validos) {
    if (!a.ref) { archivos.push(a); continue; }
    const ref = leerRefCreativo(a.ref)!;
    const c = await runWithWorkspace(ws, () => resolverCreativoMako(ref));
    if (c === 'cambio') return { ok: false, error: `«${a.nombre}» se volvió a filmar después de elegirlo: elígelo otra vez para ver el de ahora.` };
    if (!c) return { ok: false, error: `«${a.nombre}» ya no está entre tus videos de MaKo.` };
    archivos.push({ ...a, tipo: c.media_type === 'image' ? 'image' : 'video', url: c.url });
  }

  const datos = await leerDatosCuenta(ws);
  if (!datos.conexion) return { ok: false, error: 'Para publicar creativos nuevos conecta tu cuenta por Zernio (con tu token propio, Meta los rechaza: error 1885183).' };
  const conjunto = datos.arbol.find((n) => n.id === x.adSetId && n.nivel === 'adset');
  if (!conjunto) return { ok: false, error: 'Ese conjunto no está en tu cuenta publicitaria.' };
  const campana = conjunto.parentId ? datos.arbol.find((n) => n.id === conjunto.parentId)?.nombre ?? null : null;
  // El original tiene que ser un anuncio de ESTE conjunto: el Relevo compara los dos con el mismo presupuesto y el mismo público.
  const original = x.original ? datos.arbol.find((n) => n.id === x.original && n.nivel === 'ad' && n.parentId === conjunto.id) ?? null : null;
  if (x.original && !original) return { ok: false, error: 'El anuncio contra el que se prueba no está en ese conjunto.' };
  return { ok: true, datos, conjunto, campana, archivos, original };
}

/** Crea un anuncio por archivo en el conjunto, por la Zernio del negocio, y lo deja registrado para poder deshacerlo. */
export async function subirCreativos(ws: number, x: { adSetId: string; archivos: ArchivoSubido[]; textos: TextosCreativo; activo: boolean; original?: string | null }, quien: string, desde = 'el Media Buyer'): Promise<ResultadoSubida> {
  const rev = await revisarSubida(ws, x);
  if (!rev.ok) return rev;
  const { datos, conjunto, campana, archivos, original } = rev;
  const conexion = datos.conexion!;

  // El registro ANTES de escribir (como lanzar una decisión): si algo se corta a mitad, queda qué se creó.
  const [d] = await guardarPropuestas(ws, [{
    clave: `manual:adset:${x.adSetId}:${Date.now()}`, tipo: 'crear_anuncios', tactica: 'manual', nivel: 'adset',
    entidadId: x.adSetId, entidadNombre: conjunto.nombre, campanaNombre: campana,
    titulo: `Subir ${archivos.length} ${archivos.length === 1 ? 'creativo' : 'creativos'} a «${conjunto.nombre}»`,
    titular: `${archivos.length} ${archivos.length === 1 ? 'anuncio nuevo' : 'anuncios nuevos'} ${x.activo ? 'activos' : 'en pausa'}, con los textos del conjunto`,
    porque: [
      `Lo subió ${quien} desde ${desde}.`, 'Cada archivo es un anuncio nuevo en el mismo conjunto: hereda su presupuesto y su público.',
      ...(original ? [`Se prueba contra «${original.nombre}»: si uno le gana, MaKo propone pausar el original (táctica Ganador).`] : []),
    ],
    numeros: [], antes: {}, despues: {},
    // Con el original anotado, el Relevo (motor.ts) sabe contra quién comparar lo que se creó.
    ...(original ? { anuncioBase: { id: original.id, esVideo: archivos.some((a) => a.tipo === 'video'), miniatura: null } } : {}),
  }], datos.moneda);
  if (!d) return { ok: false, error: 'No pude registrar la subida.' };
  await reclamar(ws, d.id, ['abierta'], { estado: 'aplicada', origen: 'persona', aplicada_por: quien.slice(0, 200), aplicada_at: new Date().toISOString(), canal: 'zernio' });

  const db = getSupabaseServer();
  const creados: string[] = [];
  const errores: string[] = [];
  for (const [i, a] of archivos.entries()) {
    try {
      // Uno de MaKo ya trae su url pública (la resolvió revisarSubida en este negocio); uno del disco, su firma por una hora.
      let urlDescarga = a.url ?? null;
      if (!urlDescarga) {
        const { data, error } = await db.storage.from(ADS_CREATIVES_BUCKET).createSignedUrl(a.path, 3600);
        if (error || !data?.signedUrl) throw new Error(`no pude leer «${a.nombre}» del staging`);
        urlDescarga = data.signedUrl;
      }
      const cuerpo = cuerpoCreativoEnConjunto({ conexion, adSetId: x.adSetId, nombre: nombreDeAnuncio(a.nombre, i), archivo: a, urlDescarga, textos: x.textos, activo: x.activo });
      // La clave de idempotencia: el path del staging (único por subida), o la ref del video de MaKo en ESTA subida (su
      // decisión): subir el mismo video otra vez, después de deshacerlo, es otro anuncio y no la respuesta guardada del borrado.
      const clave = a.ref ? `mb-subir:${ws}:${d.id}:${a.ref}` : `mb-subir:${ws}:${a.path}`;
      const r = await crearAnuncioPorZernio(ws, cuerpo, clave, a.tipo === 'video' ? 240_000 : 90_000);
      creados.push(r.adId);
    } catch (e) {
      const z = leerErrorDeZernio(e);
      errores.push(`${a.nombre}: ${z ? `${z.mensaje}${z.subcode ? ` (Meta ${z.subcode})` : ''}` : e instanceof Error ? e.message : String(e)}`);
    }
  }
  await actualizar(ws, d.id, creados.length
    ? { creados, nota: errores.length ? `Se crearon ${creados.length} de ${archivos.length}: ${errores.join(' · ')}`.slice(0, 1000) : null }
    : { estado: 'fallida', error: errores.join(' · ').slice(0, 1000), aplicada_at: null, aplicada_por: null, origen: null });
  if (!creados.length) return { ok: false, error: errores[0] ?? 'Zernio no creó ningún anuncio.' };
  return { ok: true, creados, errores, decisionId: d.id };
}
