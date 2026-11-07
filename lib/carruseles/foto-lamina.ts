// =============================================================================
// carruseles/foto-lamina — la foto de una lámina, generada con la IA de imagen del negocio (6/11/2026)
// =============================================================================
// EL PENDIENTE QUE CIERRA (ids 25, 120, 193 y 387 del 6/11/2026, y `docs/relevo/nube-carruseles-rediseno.md` →
// «Una persona en una lámina que no es el cliente»): cuando el ejemplo tiene gente, la lámina salía sin nada. El recuadro gris
// «Tu foto» ya se había sacado el 6/11 (docs/hallazgos-carruseles.md), así que lo que quedaba abierto era la otra mitad: que
// ahí haya una FOTO.
//
// Lo PURO (qué escena se pide y de qué láminas) vive en ./replica.ts (`escenaDeLamina`, `fotosAGenerar`). Acá, la red.
//
// ── Por qué esto es asíncrono, y no puede no serlo ──────────────────────────
// La IA de imagen de MaKo es el Google Flow DEL CLIENTE, por la extensión en su Chrome (lib/flow-cola.ts): el que genera es su
// navegador, que VIENE A BUSCAR el trabajo con un polling. No hay a quién esperar desde Vercel, y «Editar» ya llega a 276,9 s
// contra un `maxDuration` de 300 (docs/hallazgos-carruseles.md). Así que el camino es:
//
//   1. «Editar» arma el diseño con lo que HAY (la foto del cliente donde el ejemplo muestra a su autor) y lo abre;
//   2. le pide a la IA de imagen las fotos que faltan (`pedirFotosDeLamina`), reservando su lugar en la lámina;
//   3. cuando el navegador del cliente las devuelve, se asientan en el diseño ya guardado (`asentarFotosDeLamina`), que es
//      lo que corre al ABRIR un diseño.
//
// ⚠️ LA URL QUE DEVUELVE FLOW VENCE (`Expires`, ~6 h: lib/flow-imagen.ts, `urlDeFlowVencida`). Guardarla dentro del documento
// sería una imagen que mañana se dibuja ROTA, y una imagen rota no se lee como «venció un enlace»: se lee como que la app
// perdió el archivo. Por eso la foto se BAJA y se sube a «Subidos» del Image Editor (`subirAlEditor`), igual que la del
// cliente: así el diseño la guarda, se puede cambiar y no vence.

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSupabaseServer } from '../supabase';
import { getTenantDb } from '../workspace';
import { getSetting, setSetting } from '../settings';
import { BUCKET_IMAGE } from '../image-editor/reglas';
import { leerDiseno, guardarDiseno } from '../image-editor/server';
import { tipoDeImagen } from '../spy-miniaturas';
import { estadoPuente, encolar, esRechazoDeModeracion } from '../flow-cola';
import { estaVivo } from '../flow-puente-frescura';
import { usaInterfaz, pedidoImagenInterfaz, rutaDeSubida } from '../flow-interfaz';
import { promptFinal, imagenesDeRespuesta } from '../flow-imagen';
import { caraDeFoto } from '../flow-cara';
import { frenoDePrueba, sumarUsoDePrueba } from '../prueba-uso';
import { QUIENES, fotoQueCubre, medidasDeImagen, type CajaDeFoto, type FotoDelCliente, type PedidoDeFotoLamina, type QuienEnLaFoto } from './replica';

/** Dónde se anotan las fotos que la IA de imagen está armando (una clave por negocio, como los looks de AI Avatar). */
export const KEY_FOTOS_LAMINA = 'carruseles.fotos-de-lamina';
/** Cuántos pendientes se recuerdan: más que esto es una cola que nadie va a mirar. */
const PENDIENTES_MAX = 40;
/** Cuánto se espera una foto antes de soltarla. El puente cierra los abandonados a los 12 min; esto es el margen de afuera. */
export const VENCE_MS = 6 * 60 * 60 * 1000;
/** Lo que se acepta bajar de una foto generada. */
const PESO_MAXIMO = 15 * 1024 * 1024;
const ESPERA_MS = 10_000;

/** Una foto que la IA de imagen está armando para una lámina de un diseño que ya está abierto. */
export type FotoDeLaminaPendiente = {
  /** El diseño del Image Editor (uuid). */
  diseno: string;
  /** Qué página (0 = la portada). */
  lamina: number;
  /** El trabajo del puente (`flow_trabajos.id`). */
  trabajo: number;
  caja: CajaDeFoto;
  quien: QuienEnLaFoto;
  creadoEn: string;
  /**
   * La foto YA copiada a «Subidos», cuando el asentado se quedó a mitad de camino (la persona guardó el diseño en el medio
   * y el compare-and-set perdió). Sin esto, el reintento la vuelve a bajar y a subir, y deja una copia huérfana por vuelta.
   */
  lista?: FotoDelCliente;
};

const esEntero = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Una foto ya subida, anotada en el pendiente: se vuelve a leer con desconfianza, como todo lo que sale de un setting. */
function fotoSana(v: unknown): FotoDelCliente | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id || typeof o.url !== 'string' || !/^https?:\/\//.test(o.url)) return null;
  if (!esEntero(o.ancho) || !esEntero(o.alto) || o.ancho <= 0 || o.alto <= 0) return null;
  return { id: o.id, url: o.url, ancho: o.ancho, alto: o.alto };
}

function sana(v: unknown): FotoDeLaminaPendiente | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const c = (o.caja ?? {}) as Record<string, unknown>;
  if (typeof o.diseno !== 'string' || !o.diseno) return null;
  if (!esEntero(o.lamina) || o.lamina < 0 || !esEntero(o.trabajo)) return null;
  if (!['left', 'top', 'width', 'height'].every((k) => esEntero(c[k]))) return null;
  const lista = fotoSana(o.lista);
  return {
    diseno: o.diseno,
    lamina: o.lamina,
    trabajo: o.trabajo,
    caja: { left: c.left as number, top: c.top as number, width: c.width as number, height: c.height as number },
    quien: QUIENES.includes(o.quien as QuienEnLaFoto) ? (o.quien as QuienEnLaFoto) : 'otra',
    creadoEn: typeof o.creadoEn === 'string' ? o.creadoEn : '',
    ...(lista ? { lista } : {}),
  };
}

/** Lo anotado. Para MOSTRAR y para asentar: si no se puede leer, no hay nada que asentar (nunca tira). */
export async function pendientesDeFoto(): Promise<FotoDeLaminaPendiente[]> {
  try {
    const crudo = await getSetting(KEY_FOTOS_LAMINA);
    const a = JSON.parse(crudo || '[]');
    return Array.isArray(a) ? a.map(sana).filter((x): x is FotoDeLaminaPendiente => !!x) : [];
  } catch { return []; }
}

async function anotar(lista: FotoDeLaminaPendiente[]): Promise<void> {
  await setSetting(KEY_FOTOS_LAMINA, JSON.stringify(lista.slice(0, PENDIENTES_MAX)));
}

/**
 * ¿La IA de imagen del negocio puede generar AHORA? Es la misma puerta que AI Avatar (app/ai-avatar/actions.ts,
 * `puenteParaAvatar`): su extensión conectada, latiendo, con el motor por interfaz y Flow abierto con su cuenta.
 *
 * ⚠️ Se pregunta ANTES de pedir: encolar para un navegador que no está deja un trabajo que nadie toma y una lámina con el
 * lugar reservado y vacío. Peor que no ofrecerlo.
 */
export async function puedeGenerarFotos(): Promise<boolean> {
  const p = await estadoPuente().catch(() => null);
  if (!p || p.estado !== 'listo') return false;
  return estaVivo(p.ultimoVisto, Date.now()) && usaInterfaz(p.version);
}

/**
 * Una imagen a «Subidos» del Image Editor, para que el diseño la guarde y se pueda cambiar. Devuelve `null` si no se pudo
 * (no es una imagen, pesa de más, el bucket dijo que no): el diseño queda como estaba, nunca con un archivo a medias.
 */
export async function subirAlEditor(ws: number, bytes: Uint8Array, nombre: string): Promise<FotoDelCliente | null> {
  if (!bytes.length || bytes.length > PESO_MAXIMO) return null;
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
}

/** ¿Esa url es de NUESTRO Storage? (la que sube la pestaña con la firma del puente). Las de Flow vencen; éstas no. */
function esDeNuestroStorage(url: string): boolean {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  if (!base) return false;
  return url.startsWith(`${base}/storage/v1/object/public/`);
}

/** Los bytes de una foto generada: la nuestra con `fetch`, la de Flow con la baranda (la url la escribió la extensión). */
async function bajar(url: string): Promise<Uint8Array | null> {
  try {
    const r = esDeNuestroStorage(url)
      ? await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS), cache: 'no-store' })
      : await (await import('../fetch-seguro')).fetchSeguro(url, { signal: AbortSignal.timeout(ESPERA_MS) });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch { return null; }
}

/** `nota` es informativa: el diseño está bien y la foto llega después. No es un aviso de algo que haya que arreglar. */
export type ResultadoPedido = { pedidas: number; nota: string | null };

/**
 * Le pide a la IA de imagen del negocio las fotos de las láminas de `pedidos`, para el diseño `diseno`. No espera nada: deja
 * un trabajo del puente por foto y las anota. Nunca tira: una foto que no se pudo pedir deja el diseño como está.
 *
 * ⚠️ `encolar` de un tipo que genera pasa por la moderación y por el permiso de IA de la persona (lib/flow-cola.ts), y la
 * PRUEBA GRATIS cuenta cada imagen (lib/prueba-uso.ts, `prueba.imagenes`): las dos puertas son las mismas que usa AI Avatar.
 */
export async function pedirFotosDeLamina(
  ws: number,
  diseno: string,
  pedidos: readonly PedidoDeFotoLamina[],
  o: { fotoId?: string | null } = {},
): Promise<ResultadoPedido> {
  if (!pedidos.length) return { pedidas: 0, nota: null };
  if (!(await puedeGenerarFotos())) return { pedidas: 0, nota: null };

  // La cara: el mediaId en Flow de la foto del dueño. Sólo hace falta para las láminas que son SUYAS; si todavía se está
  // subiendo (devuelve ''), esas se saltean y las de «otra persona» igual se piden.
  let cara = '';
  if (o.fotoId && pedidos.some((p) => p.conCara)) cara = await caraDeFoto(o.fotoId).catch(() => '');

  const nuevos: FotoDeLaminaPendiente[] = [];
  let sinCupo = false;
  for (const p of pedidos) {
    if (p.conCara && !cara) continue;
    const freno = await frenoDePrueba(ws, 'prueba.imagenes');
    if (!freno.ok) { sinCupo = true; break; }
    const trabajo = await encolar('generar_imagen', pedidoImagenInterfaz({
      prompt: promptFinal(p.escena, { conCara: p.conCara }),
      cara: p.conCara ? cara : '',
      vertical: p.caja.height >= p.caja.width,
      ruta: rutaDeSubida(`carrusel-${diseno.replace(/-/g, '').slice(0, 24)}`, 'escena', p.lamina + 1, randomUUID()),
    })).catch(() => null);
    if (esRechazoDeModeracion(trabajo) || trabajo == null) continue;
    await sumarUsoDePrueba(ws, 'prueba.imagenes');
    nuevos.push({ diseno, lamina: p.lamina, trabajo, caja: p.caja, quien: p.quien, creadoEn: new Date().toISOString() });
  }
  if (!nuevos.length) return { pedidas: 0, nota: sinCupo ? 'Tu prueba ya usó todas sus imágenes: la lámina con una persona queda sin foto.' : null };
  try { await anotar([...nuevos, ...(await pendientesDeFoto())]); } catch { return { pedidas: 0, nota: null }; }
  return {
    pedidas: nuevos.length,
    nota: `Tu IA de imagen está armando ${nuevos.length === 1 ? 'la foto de una lámina' : `las fotos de ${nuevos.length} láminas`}: aparece${nuevos.length === 1 ? '' : 'n'} en el diseño en unos minutos.`,
  };
}

/** La foto generada, puesta DETRÁS de los textos de su lámina (es el fondo de esa lámina, no una capa encima). */
function conLaFoto(doc: unknown, lamina: number, foto: FotoDelCliente, caja: CajaDeFoto): Record<string, unknown> | null {
  if (!doc || typeof doc !== 'object') return null;
  const d = doc as Record<string, unknown>;
  const paginas = Array.isArray(d.pages) ? [...(d.pages as unknown[])] : null;
  if (!paginas || !paginas[lamina] || typeof paginas[lamina] !== 'object') return null;
  const pagina = { ...(paginas[lamina] as Record<string, unknown>) };
  const objetos = Array.isArray(pagina.objects) ? (pagina.objects as Record<string, unknown>[]) : [];
  // Si ya hay una foto nuestra ahí (la del cliente, puesta al armar), la generada la REEMPLAZA: es la misma lámina y el
  // mismo lugar, y dos fotos superpuestas no es lo que nadie pidió.
  const sinLaVieja = objetos.filter((x) => !(x.type === 'image' && typeof x.name === 'string' && /^Foto: /.test(x.name)));
  pagina.objects = [fotoQueCubre(randomUUID(), foto, caja, 'Foto: la armó tu IA'), ...sinLaVieja];
  paginas[lamina] = pagina;
  return { ...d, pages: paginas };
}

export type ResultadoAsentar = { puestas: number; caidas: number };

/**
 * Asienta en sus diseños las fotos que la IA de imagen ya devolvió, y suelta las que fallaron o vencieron. Idempotente y
 * barata cuando no hay nada anotado (una lectura): la llama el GET de un diseño, que es cuando alguien lo mira.
 *
 * ⚠️ El guardado es un compare-and-set por versión (lib/image-editor/server.ts). Si la persona guardó en el medio, el
 * pendiente SE QUEDA y se reintenta en la próxima: perder la foto por una carrera sería el mismo bug de siempre contado al
 * revés.
 */
export async function asentarFotosDeLamina(ws: number, soloDiseno?: string): Promise<ResultadoAsentar> {
  const pendientes = await pendientesDeFoto();
  if (!pendientes.length) return { puestas: 0, caidas: 0 };
  const mios = pendientes.filter((p) => !soloDiseno || p.diseno === soloDiseno);
  if (!mios.length) return { puestas: 0, caidas: 0 };

  const db = await getTenantDb();
  const { data, error } = await db.from('flow_trabajos')
    .select('id, estado, resultado')
    .in('id', mios.map((p) => p.trabajo));
  // No poder leer no es «no salió»: se vuelve a preguntar la próxima vez.
  if (error) return { puestas: 0, caidas: 0 };
  const porId = new Map<number, { estado: string; resultado: unknown }>();
  for (const f of (data ?? []) as Array<Record<string, unknown>>) porId.set(Number(f.id), { estado: String(f.estado ?? ''), resultado: f.resultado });

  const ahora = Date.now();
  const quedan: FotoDeLaminaPendiente[] = [];
  const preguntados = new Set(mios.map((p) => p.trabajo));
  let puestas = 0;
  let caidas = 0;
  for (const p of pendientes) {
    // Lo de OTRO diseño se conserva tal cual: no se preguntó por él, así que no se sabe nada (ni que venció sirve para
    // soltarlo: su foto puede estar lista y esperando que alguien abra ESE diseño).
    if (!preguntados.has(p.trabajo)) { quedan.push(p); continue; }
    const t = porId.get(p.trabajo);
    const nacio = Date.parse(p.creadoEn);
    const vencio = Number.isFinite(nacio) && ahora - nacio > VENCE_MS;
    if (!t) { if (vencio) caidas++; else quedan.push(p); continue; }
    if (t.estado === 'fallido') { caidas++; continue; }
    if (t.estado !== 'listo') { if (vencio) caidas++; else quedan.push(p); continue; }

    const url = imagenesDeRespuesta(t.resultado).map((x) => x.url).find((x) => /^https?:\/\//.test(x));
    if (!url) { caidas++; continue; }
    // Si un intento anterior ya la copió, no se baja ni se sube otra vez (una copia huérfana por vuelta).
    let subida = p.lista ?? null;
    if (!subida) {
      const bytes = await bajar(url);
      subida = bytes ? await subirAlEditor(ws, bytes, p.quien === 'dueno' ? 'Tu foto en la escena de la lámina' : 'La foto que armó tu IA').catch(() => null) : null;
    }
    if (!subida) { if (vencio) caidas++; else quedan.push(p); continue; }

    const d = await leerDiseno(ws, p.diseno);
    if (!d.ok) { caidas++; continue; }
    const doc = conLaFoto(d.diseno.doc, p.lamina, subida, p.caja);
    if (!doc) { caidas++; continue; }
    const g = await guardarDiseno(ws, p.diseno, { version: d.diseno.version, doc });
    if (g.ok) puestas++;
    else if (g.conflicto) quedan.push({ ...p, lista: subida });
    else caidas++;
  }
  if (quedan.length !== pendientes.length) {
    try { await anotar(quedan); } catch { /* la próxima lo reintenta */ }
  }
  return { puestas, caidas };
}
