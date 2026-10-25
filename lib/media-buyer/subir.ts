// =============================================================================
// Media Buyer — SUBIR CREATIVOS NUEVOS a un conjunto (el servidor)
// =============================================================================
// El navegador sube cada archivo al staging de siempre (bucket privado, `creative-signurl`); acá se arma una URL firmada
// por una hora y Zernio crea UN anuncio por archivo dentro del conjunto elegido (lib/media-buyer/creativos.ts). Lo creado
// queda como una decisión «hecha» (`crear_anuncios`, táctica `manual`) con los ids de los anuncios nuevos: «Deshacer» los
// borra. Sin la Zernio del negocio conectada no se puede: con su token propio, Meta rechaza el creativo nuevo (1885183).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { ADS_CREATIVES_BUCKET, getAdForEdit } from '@/lib/meta-ads-create';
import { esPathDeStaging } from '@/lib/ads-staging';
import { crearAnuncioPorZernio, leerAnuncioPorZernio, leerErrorDeZernio } from '@/lib/zernio-ads';
import { leerDatosCuenta, type DatosCuenta } from './datos';
import { resultados } from './motor';
import { leerConfig, guardarPropuestas, reclamar, actualizar } from './store';
import { CTAS, cuerpoCreativoEnConjunto, errorDeTextos, nombreDeAnuncio, type ArchivoSubido, type ConjuntoParaSubir, type Cta, type TextosCreativo } from './creativos';
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

/** Crea un anuncio por archivo en el conjunto, por la Zernio del negocio, y lo deja registrado para poder deshacerlo. */
export async function subirCreativos(ws: number, x: { adSetId: string; archivos: ArchivoSubido[]; textos: TextosCreativo; activo: boolean }, quien: string): Promise<ResultadoSubida> {
  const config = await leerConfig(ws);
  if (!config.existeTabla) return { ok: false, error: 'Falta aplicar la migración del Media Buyer: sin el registro no se publica nada (no se podría deshacer).' };
  const errTextos = errorDeTextos(x.textos);
  if (errTextos) return { ok: false, error: errTextos };
  const archivos = x.archivos.filter((a) => esPathDeStaging(a.path) && (a.tipo === 'image' || a.tipo === 'video')).slice(0, 10);
  if (!archivos.length) return { ok: false, error: 'No llegó ningún archivo.' };

  const datos = await leerDatosCuenta(ws);
  if (!datos.conexion) return { ok: false, error: 'Para publicar creativos nuevos conecta tu cuenta por Zernio (con tu token propio, Meta los rechaza: error 1885183).' };
  const conjunto = datos.arbol.find((n) => n.id === x.adSetId && n.nivel === 'adset');
  if (!conjunto) return { ok: false, error: 'Ese conjunto no está en tu cuenta publicitaria.' };
  const campana = conjunto.parentId ? datos.arbol.find((n) => n.id === conjunto.parentId)?.nombre ?? null : null;

  // El registro ANTES de escribir (como lanzar una decisión): si algo se corta a mitad, queda qué se creó.
  const [d] = await guardarPropuestas(ws, [{
    clave: `manual:adset:${x.adSetId}:${Date.now()}`, tipo: 'crear_anuncios', tactica: 'manual', nivel: 'adset',
    entidadId: x.adSetId, entidadNombre: conjunto.nombre, campanaNombre: campana,
    titulo: `Subir ${archivos.length} ${archivos.length === 1 ? 'creativo' : 'creativos'} a «${conjunto.nombre}»`,
    titular: `${archivos.length} ${archivos.length === 1 ? 'anuncio nuevo' : 'anuncios nuevos'} ${x.activo ? 'activos' : 'en pausa'}, con los textos del conjunto`,
    porque: [`Lo subió ${quien} desde el Media Buyer.`, 'Cada archivo es un anuncio nuevo en el mismo conjunto: hereda su presupuesto y su público.'],
    numeros: [], antes: {}, despues: {},
  }], datos.moneda);
  if (!d) return { ok: false, error: 'No pude registrar la subida.' };
  await reclamar(ws, d.id, ['abierta'], { estado: 'aplicada', origen: 'persona', aplicada_por: quien.slice(0, 200), aplicada_at: new Date().toISOString(), canal: 'zernio' });

  const db = getSupabaseServer();
  const creados: string[] = [];
  const errores: string[] = [];
  for (const [i, a] of archivos.entries()) {
    try {
      const { data, error } = await db.storage.from(ADS_CREATIVES_BUCKET).createSignedUrl(a.path, 3600);
      if (error || !data?.signedUrl) throw new Error(`no pude leer «${a.nombre}» del staging`);
      const cuerpo = cuerpoCreativoEnConjunto({ conexion: datos.conexion, adSetId: x.adSetId, nombre: nombreDeAnuncio(a.nombre, i), archivo: a, urlDescarga: data.signedUrl, textos: x.textos, activo: x.activo });
      const r = await crearAnuncioPorZernio(ws, cuerpo, `mb-subir:${ws}:${a.path}`, a.tipo === 'video' ? 240_000 : 90_000);
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
